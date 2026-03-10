package graph

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math/rand"
	"net/http"
	"os"
	"time"

	influxclient "locallitix-core/pkg/influxclient"
)

// Vessel matches the GraphQL Vessel type.
type Vessel struct {
	ID         string    `json:"id"`
	MMSI       string    `json:"mmsi"`
	Name       string    `json:"name"`
	Type       string    `json:"type"`
	Position   []float64 `json:"position"`
	Speed      float64   `json:"speed"`
	Course     float64   `json:"course"`
	Heading    float64   `json:"heading"`
	Status     string    `json:"status"`
	Length     float64   `json:"length"`
}

// aisCache holds the last successful Datalastic result (30-minute TTL).
var aisCache struct {
	vessels   []Vessel
	fetchedAt time.Time
}

// adsbCache holds the last ADS-B Exchange result (5-minute TTL).
var adsbCache struct {
	flights   []Flight
	fetchedAt time.Time
}

// queryAISVessels is the main resolver for getAISVessels.
//
// Priority order:
//  1. ENABLE_DATALASTIC_API=true  → Datalastic (5 concurrent choke points) → dummy fallback
//  2. ENABLE_DATALASTIC_API!=true → InfluxDB if data exists → else dummy fallback
func queryAISVessels(influx *influxclient.Client) ([]Vessel, error) {
	enableAPI := os.Getenv("ENABLE_DATALASTIC_API")
	log.Printf("[AIS] ENABLE_DATALASTIC_API=%q", enableAPI)

	// ── PATH A: Datalastic is explicitly enabled ──────────────────────────────
	if enableAPI == "true" {
		// Serve from 30-min cache if warm — regardless of whether it's real or dummy data
		if time.Since(aisCache.fetchedAt) < 30*time.Minute && len(aisCache.vessels) > 0 {
			log.Printf("[AIS] Serving %d vessels from cache (age: %s)", len(aisCache.vessels), time.Since(aisCache.fetchedAt).Round(time.Second))
			return aisCache.vessels, nil
		}

		apiKey := os.Getenv("DATALASTIC_API_KEY")
		if apiKey == "" {
			log.Println("[AIS] DATALASTIC_API_KEY not set — using dummy (cached)")
			dummy := generateDummyVessels(500)
			aisCache.vessels = dummy
			aisCache.fetchedAt = time.Now()
			return dummy, nil
		}

		vessels, err := fetchDatalasticMultiPoint(apiKey)
		if err != nil || len(vessels) == 0 {
			// CRITICAL: cache the dummy result so we do NOT hit Datalastic again for 3 minutes
			log.Printf("[AIS] API Failed/Empty (%v) — generating dummy and caching for 3min", err)
			dummy := generateDummyVessels(500)
			aisCache.vessels = dummy
			aisCache.fetchedAt = time.Now()
			return dummy, nil
		}

		aisCache.vessels = vessels
		aisCache.fetchedAt = time.Now()
		log.Printf("[AIS] Datalastic returned %d vessels (cached for 3min)", len(vessels))
		return vessels, nil
	}


	// ── PATH B: Datalastic disabled — try InfluxDB, then dummy ───────────────
	if influx != nil {
		fluxQuery := `
from(bucket: "telemetry")
  |> range(start: -5m)
  |> filter(fn: (r) => r._measurement == "ais_position")
  |> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")
  |> group(columns: ["mmsi"])
  |> sort(columns: ["_time"], desc: true)
  |> limit(n: 1)
  |> group()
`
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		result, err := influx.QueryAPI.Query(ctx, fluxQuery)
		if err == nil {
			var vessels []Vessel
			for result.Next() {
				record := result.Record()
				values := record.Values()
				v := Vessel{
					MMSI:     safeString(values["mmsi"]),
					Name:     safeString(values["vessel_name"]),
					Type:     safeString(values["vessel_type"]),
					Position: []float64{safeFloat(values["lat"]), safeFloat(values["lon"])},
					Speed:    safeFloat(values["speed"]),
					Course:   safeFloat(values["course"]),
					Heading:  safeFloat(values["heading"]),
					Status:   safeString(values["status"]),
					Length:   safeFloat(values["length"]),
				}
				v.ID = fmt.Sprintf("ais-%s", v.MMSI)
				vessels = append(vessels, v)
			}
			if result.Err() == nil && len(vessels) > 0 {
				log.Printf("[AIS] InfluxDB returned %d vessels", len(vessels))
				return vessels, nil
			}
		}
	}

	log.Println("[AIS] Triggering dummy fallback — 500 vessels across Indonesia bbox")
	return generateDummyVessels(500), nil
}

// datalasticChokePoint defines a maritime query point.
type datalasticChokePoint struct {
	name   string
	lat    float64
	lon    float64
	radius int // nautical miles
}

// fetchDatalasticMultiPoint fires concurrent Datalastic vessel_inradius requests
// to Indonesian maritime choke points (max 50 NM each), merges, and deduplicates.
func fetchDatalasticMultiPoint(apiKey string) ([]Vessel, error) {
	// 9 choke points at 50 NM radius to cover the full archipelago
	chokePoints := []datalasticChokePoint{
		{"Malacca N",       3.5,  100.5, 50},
		{"Malacca S",       1.2,  103.8, 50},
		{"Singapore Strait", 1.2, 104.5, 50},
		{"Java Sea W",      -5.8,  107.5, 50},
		{"Java Sea E",      -6.0,  112.5, 50},
		{"Makassar Strait", -2.0,  117.5, 50},
		{"Banda Sea",       -5.0,  127.0, 50},
		{"Maluku Sea",       1.0,  127.5, 50},
		{"Arafura/Papua",   -4.0,  135.0, 50},
	}

	type result struct {
		vessels []Vessel
		err     error
		name    string
	}

	ch := make(chan result, len(chokePoints))
	client := &http.Client{Timeout: 10 * time.Second}

	for _, cp := range chokePoints {
		cp := cp
		go func() {
			url := fmt.Sprintf(
				"https://api.datalastic.com/api/v0/vessel_inradius?api-key=%s&lat=%f&lon=%f&radius=%d",
				apiKey, cp.lat, cp.lon, cp.radius,
			)
			log.Printf("[AIS] Querying %s → %s", cp.name, url[:80]+"...")
			resp, err := client.Get(url) //nolint:gosec
			if err != nil {
				log.Printf("[AIS] %s request error: %v", cp.name, err)
				ch <- result{name: cp.name, err: err}
				return
			}
			defer resp.Body.Close()

			if resp.StatusCode != http.StatusOK {
				log.Printf("[AIS] %s HTTP %d", cp.name, resp.StatusCode)
				ch <- result{name: cp.name, err: fmt.Errorf("HTTP %d", resp.StatusCode)}
				return
			}

			// Real response: {"data":{"point":{...},"total":N,"vessels":[...]}}
			var payload struct {
				Data struct {
					Total   int `json:"total"`
					Vessels []struct {
						UUID       string   `json:"uuid"`
						MMSI       string   `json:"mmsi"`
						Name       string   `json:"name"`
						VesselType string   `json:"type"`
						Lat        float64  `json:"lat"`
						Lon        float64  `json:"lon"`
						Speed      float64  `json:"speed"`
						Course     float64  `json:"course"`
						Heading    *float64 `json:"heading"` // nullable
						Length     *float64 `json:"length"`  // nullable
					} `json:"vessels"`
				} `json:"data"`
			}
			if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
				log.Printf("[AIS] %s decode error: %v", cp.name, err)
				ch <- result{name: cp.name, err: err}
				return
			}
			log.Printf("[AIS] %s: total=%d in area", cp.name, payload.Data.Total)

			var vessels []Vessel
			for _, d := range payload.Data.Vessels {
				heading := 0.0
				if d.Heading != nil {
					heading = *d.Heading
				}
				length := 0.0
				if d.Length != nil {
					length = *d.Length
				}
				vessels = append(vessels, Vessel{
					ID:       "ais-" + d.UUID,
					MMSI:     d.MMSI,
					Name:     d.Name,
					Type:     d.VesselType,
					Position: []float64{d.Lat, d.Lon},
					Speed:    d.Speed,
					Course:   d.Course,
					Heading:  heading,
					Status:   "Under Way",
					Length:   length,
				})
			}
			log.Printf("[AIS] %s: %d vessels", cp.name, len(vessels))
			ch <- result{name: cp.name, vessels: vessels}
		}()
	}

	// Collect all results, deduplicate by MMSI
	seen := make(map[string]bool)
	var merged []Vessel
	allFailed := true

	for range chokePoints {
		r := <-ch
		if r.err == nil {
			allFailed = false
		}
		for _, v := range r.vessels {
			if v.MMSI != "" && !seen[v.MMSI] {
				seen[v.MMSI] = true
				merged = append(merged, v)
			}
		}
	}

	if allFailed {
		return nil, fmt.Errorf("all Datalastic choke-point requests failed")
	}
	if len(merged) == 0 {
		return nil, fmt.Errorf("Datalastic returned 0 vessels across all choke points")
	}
	return merged, nil
}

// generateDummyVessels generates n vessels scattered UNIFORMLY and RANDOMLY
// across the ENTIRE Indonesian archipelago bounding box.
//
//	Latitude:  -11.0 to +6.0
//	Longitude:  95.0 to 141.0
//
// No sub-region clustering. No hardcoded cities.
func generateDummyVessels(n int) []Vessel {
	const (
		latMin = -11.0
		latMax =   6.0
		lonMin =  95.0
		lonMax = 141.0
	)

	prefixes := []string{"KRI", "KM", "MV", "MT", "MFV", "TB", "LCT", "KFC"}
	basenames := []string{
		"Macan Tutul", "Nusantara", "Arjuna", "Dewata", "Rajawali",
		"Samudra", "Diponegoro", "Borneo Star", "Bahari", "Garuda",
		"Gajah Mada", "Pertamina", "Lombok", "Hasanuddin", "Ekspres",
		"Sabuk Nusantara", "Kelud", "Papua Star", "Nelayan", "Kalimantan",
		"Barakuda", "Mentari", "Bintang Laut", "Sriwijaya", "Majapahit",
		"Banda", "Flores", "Timor", "Sulawesi", "Ternate",
	}
	types    := []string{"Cargo", "Tanker", "Fishing", "Passenger", "Tug", "Naval", "Bulk Carrier", "Ro-Ro"}
	statuses := []string{"Under Way", "Under Way", "Under Way", "At Anchor", "Moored"}

	rnd := rand.New(rand.NewSource(time.Now().UnixNano()))
	vessels := make([]Vessel, n)
	for i := 0; i < n; i++ {
		lat  := latMin + rnd.Float64()*(latMax-latMin) // pure uniform across bbox
		lon  := lonMin + rnd.Float64()*(lonMax-lonMin)
		mmsi := fmt.Sprintf("%09d", 510000000+rnd.Intn(89999999))
		name := fmt.Sprintf("%s %s %d",
			prefixes[rnd.Intn(len(prefixes))],
			basenames[rnd.Intn(len(basenames))],
			100+rnd.Intn(900))
		vessels[i] = Vessel{
			ID:       fmt.Sprintf("dummy-%d", i),
			MMSI:     mmsi,
			Name:     name,
			Type:     types[rnd.Intn(len(types))],
			Position: []float64{lat, lon},
			Speed:    rnd.Float64() * 25,
			Course:   rnd.Float64() * 360,
			Heading:  rnd.Float64() * 360,
			Status:   statuses[rnd.Intn(len(statuses))],
			Length:   20 + rnd.Float64()*400,
		}
	}
	log.Printf("[AIS] generateDummyVessels: created %d vessels (lat %.1f..%.1f, lon %.1f..%.1f)",
		n, latMin, latMax, lonMin, lonMax)
	return vessels
}

// safeString extracts a string from an interface{} value, returning "" if nil.
func safeString(v interface{}) string {
	if v == nil {
		return ""
	}
	if s, ok := v.(string); ok {
		return s
	}
	return fmt.Sprintf("%v", v)
}

// safeFloat extracts a float64 from an interface{} value, returning 0 if nil.
func safeFloat(v interface{}) float64 {
	if v == nil {
		return 0
	}
	switch val := v.(type) {
	case float64:
		return val
	case int64:
		return float64(val)
	case float32:
		return float64(val)
	default:
		return 0
	}
}

// safeInt extracts an int from an interface{} value, returning 0 if nil.
func safeInt(v interface{}) int {
	if v == nil {
		return 0
	}
	switch val := v.(type) {
	case int64:
		return int(val)
	case float64:
		return int(val)
	default:
		return 0
	}
}

// LiveDrone matches the GraphQL LiveDrone type.
type LiveDrone struct {
	ID        string    `json:"id"`
	MissionID string    `json:"missionId"`
	AssetID   string    `json:"assetId"`
	FlightID  string    `json:"flightId"`
	DroneName string    `json:"droneName"`
	DroneType string    `json:"droneType"`
	Position  []float64 `json:"position"`
	Battery   float64   `json:"battery"`
	Altitude  float64   `json:"altitude"`
	Speed     float64   `json:"speed"`
	Distance  float64   `json:"distance"`
	Signal    float64   `json:"signal"`
	GpsSats   int       `json:"gpsSats"`
}

// queryLiveDrones retrieves the most recent telemetry for each unique asset_id
// within the last 5 minutes from the drone_telemetry measurement in InfluxDB.
func queryLiveDrones(influx *influxclient.Client) ([]LiveDrone, error) {
	if influx == nil {
		return nil, fmt.Errorf("InfluxDB client not initialized")
	}

	fluxQuery := `
from(bucket: "telemetry")
  |> range(start: -5m)
  |> filter(fn: (r) => r._measurement == "drone_telemetry")
  |> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")
  |> group(columns: ["asset_id"])
  |> sort(columns: ["_time"], desc: true)
  |> limit(n: 1)
  |> group()
`

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	result, err := influx.QueryAPI.Query(ctx, fluxQuery)
	if err != nil {
		return nil, fmt.Errorf("InfluxDB drone query failed: %w", err)
	}

	var drones []LiveDrone

	for result.Next() {
		record := result.Record()
		values := record.Values()

		assetID := safeString(values["asset_id"])

		d := LiveDrone{
			ID:        fmt.Sprintf("drone-%s", assetID),
			MissionID: safeString(values["mission_id"]),
			AssetID:   assetID,
			FlightID:  safeString(values["flight_id"]),
			Position:  []float64{safeFloat(values["lat"]), safeFloat(values["lon"])},
			Battery:   safeFloat(values["battery"]),
			Altitude:  safeFloat(values["alt"]),
			Speed:     safeFloat(values["spd"]),
			Distance:  safeFloat(values["dist"]),
			Signal:    safeFloat(values["sig"]),
			GpsSats:   safeInt(values["gps_sats"]),
		}

		// Drone name/type come from the simulator payload but are not stored as
		// InfluxDB tags. We map known asset IDs to names here.
		d.DroneName, d.DroneType = droneNameFromAssetID(assetID)

		drones = append(drones, d)
	}

	if err := result.Err(); err != nil {
		return nil, fmt.Errorf("InfluxDB drone result error: %w", err)
	}

	log.Printf("[GRAPHQL] getLiveDrones: returned %d drones", len(drones))
	return drones, nil
}

// droneNameFromAssetID maps known asset IDs to human-readable names.
func droneNameFromAssetID(assetID string) (name, droneType string) {
	switch assetID {
	case "PYRHOS-X1":
		return "Pyrhos X V1", "Fixed Wing"
	case "AR2-001":
		return "AR-2 Aerial", "Multirotor"
	case "PYRHOS-X2":
		return "Pyrhos X V2", "Fixed Wing"
	case "HEX-001":
		return "Hexacopter H6", "Multirotor"
	case "VTOL-001":
		return "VTOL Scout", "VTOL"
	default:
		return assetID, "Unknown"
	}
}

// Flight matches the GraphQL Flight type.
type Flight struct {
	ID           string    `json:"id"`
	ICAO24       string    `json:"icao24"`
	Callsign     string    `json:"callsign"`
	AircraftType string    `json:"aircraftType"`
	Position     []float64 `json:"position"`
	Altitude     float64   `json:"altitude"`
	Speed        float64   `json:"speed"`
	Heading      float64   `json:"heading"`
	OnGround     bool      `json:"onGround"`
}

// queryLiveFlights is the main resolver for getLiveFlights.
//
// Priority order:
//  1. ENABLE_ADSB_API=true  → ADS-B Exchange (4 concurrent Indonesia regions) → cached 5 min
//  2. ENABLE_ADSB_API!=true → InfluxDB if data exists → simulated fallback
func queryLiveFlights(influx *influxclient.Client) ([]Flight, error) {
	enableAPI := os.Getenv("ENABLE_ADSB_API")
	log.Printf("[ADSB] ENABLE_ADSB_API=%q", enableAPI)

	// ── PATH A: FlightRadar24 API ──────────────────────────────────────────────────
	if enableAPI == "true" {
		// Serve from 5-min cache if warm
		if time.Since(adsbCache.fetchedAt) < 5*time.Minute && len(adsbCache.flights) > 0 {
			log.Printf("[ADSB] Serving %d aircraft from cache (age: %s)",
				len(adsbCache.flights), time.Since(adsbCache.fetchedAt).Round(time.Second))
			return adsbCache.flights, nil
		}

		apiKey := os.Getenv("ADSB_API_KEY")
		if apiKey == "" {
			log.Println("[ADSB] ADSB_API_KEY not set — using simulated flights (cached)")
			sim := generateSimulatedFlights(80)
			adsbCache.flights = sim
			adsbCache.fetchedAt = time.Now()
			return sim, nil
		}

		flights, err := fetchFlightRadar24(apiKey)
		if err != nil || len(flights) == 0 {
			log.Printf("[ADSB] FR24 API Failed/Empty (%v) — using simulated flights (cached)", err)
			sim := generateSimulatedFlights(80)
			adsbCache.flights = sim
			adsbCache.fetchedAt = time.Now()
			return sim, nil
		}

		adsbCache.flights = flights
		adsbCache.fetchedAt = time.Now()
		log.Printf("[ADSB] FlightRadar24 returned %d aircraft (cached for 5min)", len(flights))
		return flights, nil
	}

	// ── PATH B: InfluxDB → simulated fallback ────────────────────────────────────
	if influx != nil {
		fluxQuery := `
from(bucket: "telemetry")
  |> range(start: -5m)
  |> filter(fn: (r) => r._measurement == "adsb_position")
  |> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")
  |> group(columns: ["icao24"])
  |> sort(columns: ["_time"], desc: true)
  |> limit(n: 1)
  |> group()
`
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		result, err := influx.QueryAPI.Query(ctx, fluxQuery)
		if err == nil {
			var flights []Flight
			for result.Next() {
				record := result.Record()
				values := record.Values()
				icao24 := safeString(values["icao24"])
				f := Flight{
					ID:           fmt.Sprintf("adsb-%s", icao24),
					ICAO24:       icao24,
					Callsign:     safeString(values["callsign"]),
					AircraftType: safeString(values["aircraft_type"]),
					Position:     []float64{safeFloat(values["lat"]), safeFloat(values["lon"])},
					Altitude:     safeFloat(values["altitude"]),
					Speed:        safeFloat(values["speed"]),
					Heading:      safeFloat(values["heading"]),
					OnGround:     safeBool(values["on_ground"]),
				}
				flights = append(flights, f)
			}
			if result.Err() == nil && len(flights) > 0 {
				log.Printf("[ADSB] InfluxDB returned %d flights", len(flights))
				return flights, nil
			}
		}
	}

	log.Println("[ADSB] Falling back to simulated flights")
	return generateSimulatedFlights(80), nil
}

// fetchFlightRadar24 fetches live aircraft positions over Indonesia from the
// FlightRadar24 API using a single bounds-based query.
//
// Auth: Authorization: Bearer <full-key>  (the full UUID|token string as-is)
// Endpoint: GET /api/live/flight-positions/light?bounds=minLat,maxLat,minLon,maxLon
// Response: {"data":[{"fr24_id":"...","callsign":"...","lat":...,"lon":...,"track":...,"alt":...,"gspeed":...,"hex":"...","type":"..."}]}
func fetchFlightRadar24(apiKey string) ([]Flight, error) {
	// The FULL key (UUID|token) is the Bearer token value — do NOT split on '|'
	token := apiKey

	// Full Indonesia bounding box: north=6, south=-11, west=95, east=141
	url := "https://fr24api.flightradar24.com/api/live/flight-positions/light?bounds=6,-11,95,141"
	log.Printf("[ADSB] FR24 querying Indonesia → %s", url)

	client := &http.Client{Timeout: 15 * time.Second}
	req, _ := http.NewRequest("GET", url, nil)
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Accept-Version", "v1")
	req.Header.Set("Accept", "application/json")

	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("FR24 request error: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("FR24 HTTP %d: %s", resp.StatusCode, string(body)[:minInt(200, len(body))])
	}

	// FR24 response schema:
	// {"data":[{"fr24_id":str,"flight":str,"callsign":str,"lat":f,"lon":f,
	//           "track":f,"alt":f,"gspeed":f,"squawk":str,"hex":str,"type":str,
	//           "reg":str,"orig_iata":str,"dest_iata":str}]}
	var payload struct {
		Data []struct {
			FR24ID   string  `json:"fr24_id"`
			Flight   string  `json:"flight"`
			Callsign string  `json:"callsign"`
			Lat      float64 `json:"lat"`
			Lon      float64 `json:"lon"`
			Track    float64 `json:"track"`
			Alt      float64 `json:"alt"`
			Gspeed   float64 `json:"gspeed"`
			Hex      string  `json:"hex"`
			Type     string  `json:"type"`
			Reg      string  `json:"reg"`
			OrigIATA string  `json:"orig_iata"`
			DestIATA string  `json:"dest_iata"`
		} `json:"data"`
	}

	body, _ := io.ReadAll(resp.Body)
	if err := json.Unmarshal(body, &payload); err != nil {
		preview := string(body)
		if len(preview) > 300 {
			preview = preview[:300]
		}
		return nil, fmt.Errorf("FR24 decode error: %v | body: %s", err, preview)
	}

	log.Printf("[ADSB] FR24 returned %d aircraft over Indonesia", len(payload.Data))

	var flights []Flight
	for _, ac := range payload.Data {
		if ac.Lat == 0 && ac.Lon == 0 {
			continue
		}
		cs := ac.Callsign
		if cs == "" {
			cs = ac.Flight
		}
		icao := ac.Hex
		if icao == "" {
			icao = ac.FR24ID
		}
		flights = append(flights, Flight{
			ID:           "fr24-" + ac.FR24ID,
			ICAO24:       icao,
			Callsign:     cs,
			AircraftType: ac.Type,
			Position:     []float64{ac.Lat, ac.Lon},
			Altitude:     ac.Alt,
			Speed:        ac.Gspeed,
			Heading:      ac.Track,
			OnGround:     ac.Alt == 0 && ac.Gspeed < 30,
		})
	}
	return flights, nil
}

// minInt returns the smaller of two ints.
func minInt(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// generateSimulatedFlights generates n realistic-ish flights over Indonesia.
func generateSimulatedFlights(n int) []Flight {
	callsigns := []string{"GA", "ID", "JT", "QZ", "SJ", "IW", "IN", "MH", "SQ", "TG"}
	types      := []string{"B738", "A320", "A330", "B77W", "A321", "AT75", "CRJ", "B739"}
	rnd := rand.New(rand.NewSource(time.Now().UnixNano()))
	flights := make([]Flight, n)
	for i := 0; i < n; i++ {
		lat := -9.0 + rnd.Float64()*14.0  // -9 to +5
		lon := 95.0 + rnd.Float64()*46.0  // 95 to 141
		alt := 15000.0 + rnd.Float64()*25000.0
		cs := fmt.Sprintf("%s%d", callsigns[rnd.Intn(len(callsigns))], 100+rnd.Intn(900))
		flights[i] = Flight{
			ID:           fmt.Sprintf("sim-%d", i),
			ICAO24:       fmt.Sprintf("%06x", rnd.Intn(0xFFFFFF)),
			Callsign:     cs,
			AircraftType: types[rnd.Intn(len(types))],
			Position:     []float64{lat, lon},
			Altitude:     alt,
			Speed:        350 + rnd.Float64()*200,
			Heading:      rnd.Float64() * 360,
			OnGround:     false,
		}
	}
	log.Printf("[ADSB] generateSimulatedFlights: created %d aircraft", n)
	return flights
}

// safeBool extracts a bool from an interface{} value, returning false if nil.
func safeBool(v interface{}) bool {
	if v == nil {
		return false
	}
	if b, ok := v.(bool); ok {
		return b
	}
	return false
}
