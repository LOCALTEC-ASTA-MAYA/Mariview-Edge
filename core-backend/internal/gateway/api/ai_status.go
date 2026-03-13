package api

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

// ─────────────────────────────────────────────
// AI Status Manager — Gatekeeper for mission launch
// ─────────────────────────────────────────────

// AIStatusPayload mirrors the JSON published by virtual_drone.py on SYSTEM.ai.status
type AIStatusPayload struct {
	Status    string `json:"status"`
	Message   string `json:"message"`
	Progress  int    `json:"progress"`
	Timestamp string `json:"timestamp"`
	DroneMode string `json:"drone_mode"` // "real" or "virtual" — from DRONE_MODE env var
}

// droneMode reads DRONE_MODE from env once (lower-cased, defaults to "virtual").
func droneMode() string {
	m := strings.ToLower(strings.TrimSpace(os.Getenv("DRONE_MODE")))
	if m == "real" {
		return "real"
	}
	return "virtual"
}

// AIStatusManager maintains the current AI readiness state (thread-safe)
// and fans out updates to connected WebSocket clients.
type AIStatusManager struct {
	mu      sync.RWMutex
	current AIStatusPayload
	clients map[*websocket.Conn]chan []byte
}

// NewAIStatusManager creates a new manager with initial OFFLINE state.
func NewAIStatusManager() *AIStatusManager {
	return &AIStatusManager{
		current: AIStatusPayload{
			Status:    "OFFLINE",
			Message:   "AI system not connected",
			Timestamp: time.Now().UTC().Format(time.RFC3339),
		},
		clients: make(map[*websocket.Conn]chan []byte),
	}
}

// GetStatus returns the current AI status string (thread-safe).
func (m *AIStatusManager) GetStatus() string {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.current.Status
}

// GetPayload returns the full current status payload as JSON bytes.
func (m *AIStatusManager) GetPayload() []byte {
	m.mu.RLock()
	defer m.mu.RUnlock()
	copy := m.current
	copy.DroneMode = droneMode() // always stamp current mode
	data, _ := json.Marshal(copy)
	return data
}

// HandleNATSMessage processes an incoming SYSTEM.ai.status NATS message.
// Updates internal state and fans out to all connected WebSocket clients.
func (m *AIStatusManager) HandleNATSMessage(data []byte) {
	var payload AIStatusPayload
	if err := json.Unmarshal(data, &payload); err != nil {
		log.Printf("[AI-STATUS] Failed to parse status: %v", err)
		return
	}

	m.mu.Lock()
	m.current = payload
	m.current.DroneMode = droneMode() // always stamp current mode
	m.mu.Unlock()

	log.Printf("[AI-STATUS] %s: %s", payload.Status, payload.Message)

	// Fan-out to WebSocket clients
	m.mu.RLock()
	for _, ch := range m.clients {
		select {
		case ch <- data:
		default:
			// Drop if client buffer full
		}
	}
	m.mu.RUnlock()
}

// register adds a WebSocket client.
func (m *AIStatusManager) register(conn *websocket.Conn) chan []byte {
	ch := make(chan []byte, 16)
	m.mu.Lock()
	m.clients[conn] = ch
	count := len(m.clients)
	m.mu.Unlock()
	log.Printf("[AI-STATUS-WS] Client connected (%d active)", count)
	return ch
}

// unregister removes a WebSocket client.
func (m *AIStatusManager) unregister(conn *websocket.Conn) {
	m.mu.Lock()
	if ch, ok := m.clients[conn]; ok {
		close(ch)
		delete(m.clients, conn)
	}
	count := len(m.clients)
	m.mu.Unlock()
	log.Printf("[AI-STATUS-WS] Client disconnected (%d active)", count)
}

// WsAIStatusHandler creates an HTTP handler for /ws/ai-status.
// Sends current status immediately on connect, then streams updates.
func WsAIStatusHandler(manager *AIStatusManager) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			log.Printf("[AI-STATUS-WS] Upgrade failed: %v", err)
			return
		}
		defer conn.Close()

		clientCh := manager.register(conn)
		defer manager.unregister(conn)

		// Send current status immediately on connect
		if err := conn.WriteMessage(websocket.TextMessage, manager.GetPayload()); err != nil {
			return
		}

		// Read pump: drain client messages (pings/close) in background
		go func() {
			for {
				if _, _, err := conn.ReadMessage(); err != nil {
					break
				}
			}
		}()

		// Write pump: stream status updates
		for payload := range clientCh {
			if err := conn.WriteMessage(websocket.TextMessage, payload); err != nil {
				break
			}
		}
	}
}
