package main

import (
	"log"
	"net/http"
	"os"

	"locallitix-core/internal/gateway/api"
	"locallitix-core/internal/gateway/api/graph"
	"locallitix-core/internal/infrastructure/auth"
	"locallitix-core/internal/infrastructure/database"
	"locallitix-core/internal/workers/ai_adapter"
	influxclient "locallitix-core/pkg/influxclient"
	"locallitix-core/pkg/natsjs"
	"locallitix-core/workers/ingestor"
	"locallitix-core/workers/simulator"

	"github.com/nats-io/nats.go"
)

func main() {
	// ============================================
	// INFRASTRUCTURE INIT
	// ============================================

	dbDsn := os.Getenv("DB_DSN")
	db := database.InitPostgres(dbDsn)
	database.SeedDefaults(db)

	influxUrl := os.Getenv("INFLUX_URL")
	influxToken := os.Getenv("INFLUX_TOKEN")

	// Phase 2 InfluxDB client (WriteAPI + QueryAPI)
	influx, err := influxclient.Connect(influxUrl, influxToken, "locallitix", "telemetry")
	if err != nil {
		log.Fatalf("[CORE] InfluxDB connection failed: %v", err)
	}
	defer influx.Close()

	// Legacy InfluxDB client for AI adapter backward compatibility
	legacyInflux := database.InitInflux(influxUrl, influxToken, "locallitix", "telemetry")
	defer legacyInflux.Client.Close()

	// ============================================
	// NATS JETSTREAM (Phase 2 — stream provisioning)
	// ============================================

	natsURL := os.Getenv("NATS_URL")

	natsClient, err := natsjs.Connect(natsURL)
	if err != nil {
		log.Fatalf("[CORE] NATS connection failed: %v", err)
	}
	defer natsClient.Close()

	// ============================================
	// NATS AI ADAPTER (legacy — uses own connection)
	// ============================================

	visionChannel := make(chan []byte, 1000)

	adapter, err := ai_adapter.NewAIAdapter(natsURL, visionChannel, legacyInflux, database.DB)
	if err != nil {
		log.Fatalf("%v", err)
	}

	if err := adapter.ListenForVision(); err != nil {
		log.Fatalf("%v", err)
	}

	// ============================================
	// AI STATUS MANAGER (Gatekeeper)
	// ============================================

	aiStatus := api.NewAIStatusManager()

	// Subscribe to AI lifecycle broadcasts from virtual_drone.py
	_, err = natsClient.Conn.Subscribe("SYSTEM.ai.status", func(msg *nats.Msg) {
		aiStatus.HandleNATSMessage(msg.Data)
	})
	if err != nil {
		log.Printf("[CORE] WARNING: Failed to subscribe to SYSTEM.ai.status: %v", err)
	} else {
		log.Println("[CORE] ✓ Subscribed to SYSTEM.ai.status (AI Gatekeeper active)")
	}

	// ============================================
	// PHASE 2: MARITIME DATA PIPELINE
	// ============================================

	// Ingestor: MARITIME.ais.live → InfluxDB
	aisIngestor := ingestor.NewMaritimeIngestor(natsClient.JetStream, influx)
	if err := aisIngestor.Start(); err != nil {
		log.Fatalf("[CORE] AIS ingestor failed: %v", err)
	}

	// Simulator: Publish mock AIS data (dev/demo mode)
	simulator.StartAISSimulator(natsClient.JetStream)

	// Ingestor: TELEMETRY.drone.live → InfluxDB
	droneIngestor := ingestor.NewDroneIngestor(natsClient.JetStream, influx)
	if err := droneIngestor.Start(); err != nil {
		log.Fatalf("[CORE] Drone ingestor failed: %v", err)
	}

	// Simulator: Publish mock drone telemetry (dev/demo mode)
	// ⚠️  DISABLE when using real_telemetry_bridge.py — both publish to
	//    TELEMETRY.drone.live with the same asset_id, causing InfluxDB race.
	//    Set DISABLE_DRONE_SIM=true in .env to suppress simulator.
	if os.Getenv("DISABLE_DRONE_SIM") != "true" {
		simulator.StartDroneSimulator(natsClient.JetStream)
		log.Println("[CORE] 🟡 DroneSimulator active (set DISABLE_DRONE_SIM=true to disable)")
	} else {
		log.Println("[CORE] ✅ DroneSimulator suppressed (DISABLE_DRONE_SIM=true) — real bridge mode")
	}

	// Ingestor: TELEMETRY.adsb.live → InfluxDB
	flightIngestor := ingestor.NewFlightIngestor(natsClient.JetStream, influx)
	if err := flightIngestor.Start(); err != nil {
		log.Fatalf("[CORE] Flight ingestor failed: %v", err)
	}

	// Simulator: Publish mock ADS-B flights (dev/demo mode)
	simulator.StartFlightSimulator(natsClient.JetStream)

	// Inject InfluxDB client into GraphQL resolvers
	graph.SetInfluxClient(influx)

	// ============================================
	// KEYCLOAK SECURITY
	// ============================================

	keycloakURL := os.Getenv("KEYCLOAK_URL")
	cookieMiddleware := auth.CookieAuthMiddleware(keycloakURL)

	// ============================================
	// HTTP ROUTER
	// ============================================

	mux := http.NewServeMux()

	// --- Auth Endpoints (no middleware, these handle auth themselves) ---
	mux.HandleFunc("/api/auth/login", api.LoginHandler())
	mux.HandleFunc("/api/auth/logout", api.LogoutHandler())
	mux.HandleFunc("/api/auth/me", api.MeHandler(keycloakURL))

	// --- GraphQL Endpoint (cookie-protected) ---
	mux.Handle("/api/graphql", cookieMiddleware(http.HandlerFunc(graph.Handler())))

	// --- User Management (cookie-protected, COMMANDER role enforced inside handler) ---
	mux.Handle("/api/admin/users", cookieMiddleware(http.HandlerFunc(api.UserManagementHandler())))
	mux.Handle("/api/admin/users/", cookieMiddleware(http.HandlerFunc(api.UserManagementHandler())))

	// --- WebSocket (no cookie middleware — WS uses its own auth) ---
	visionHub := api.NewVisionHub(visionChannel)
	mux.HandleFunc("/ws/vision", api.WsVisionHandler(visionHub))
	mux.HandleFunc("/ws/ai-status", api.WsAIStatusHandler(aiStatus))
	// --- Drone Command Endpoints (publish to NATS) ---
	mux.Handle("/api/drone/start", cookieMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}
		// GATEKEEPER: Reject if AI is not ready
		if aiStatus.GetStatus() != "IDLE" {
			log.Printf("[CORE] ⚠️ Drone start REJECTED — AI status: %s", aiStatus.GetStatus())
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusBadRequest)
			w.Write([]byte(`{"error":"AI System is not ready","aiStatus":"` + aiStatus.GetStatus() + `"}`))
			return
		}
		if err := natsClient.Conn.Publish("COMMAND.drone.start", []byte(`{"action":"start"}`)); err != nil {
			log.Printf("[CORE] Failed to publish drone start: %v", err)
			http.Error(w, "failed to publish start command", http.StatusInternalServerError)
			return
		}
		log.Println("[CORE] 🟢 COMMAND.drone.start published — drone will begin mission")
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"ok":true}`))
	})))
	mux.Handle("/api/drone/stop", cookieMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}
		if err := natsClient.Conn.Publish("COMMAND.drone.stop", []byte(`{"action":"stop"}`)); err != nil {
			log.Printf("[CORE] Failed to publish drone stop: %v", err)
			http.Error(w, "failed to publish stop command", http.StatusInternalServerError)
			return
		}
		log.Println("[CORE] ⛔ COMMAND.drone.stop published — drone will shut down")
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"ok":true}`))
	})))

	// --- Legacy secure test ---
	bearerMiddleware := auth.KeycloakMiddleware(keycloakURL)
	mux.Handle("/api/secure/test", bearerMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("SECURE ZONE ACCESSED"))
	})))

	// ============================================
	// SERVER START
	// ============================================

	log.Println("[CORE] ======================================")
	log.Println("[CORE]  Locallitix Core API v2.0")
	log.Println("[CORE]  Listening on :8080")
	log.Println("[CORE]  Auth:     /api/auth/login | /api/auth/logout | /api/auth/me")
	log.Println("[CORE]  GraphQL:  /api/graphql")
	log.Println("[CORE]  Users:    /api/admin/users")
	log.Println("[CORE]  Vision:   /ws/vision")
	log.Println("[CORE]  AI Status:/ws/ai-status")
	log.Println("[CORE]  Pipeline: MARITIME.ais.live → InfluxDB")
	log.Println("[CORE]  Sim:      AIS Simulator (16 vessels)")
	log.Println("[CORE] ======================================")

	handler := api.CORSMiddleware(mux)

	if err := http.ListenAndServe(":8080", handler); err != nil {
		log.Fatalf("[CORE] Server failed: %v", err)
	}
}