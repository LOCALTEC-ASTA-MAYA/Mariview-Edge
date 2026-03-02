package simulator

import (
	"encoding/json"
	"log"
	"math"
	"math/rand"
	"time"

	"github.com/nats-io/nats.go"
)

// AISPayload is the JSON payload published to MARITIME.ais.live.
type AISPayload struct {
	MMSI       string  `json:"mmsi"`
	VesselName string  `json:"vessel_name"`
	VesselType string  `json:"vessel_type"`
	Lat        float64 `json:"lat"`
	Lon        float64 `json:"lon"`
	Speed      float64 `json:"speed"`
	Course     float64 `json:"course"`
	Heading    float64 `json:"heading"`
	Status     string  `json:"status"`
	Length     float64 `json:"length"`
}

// vesselSeed defines a simulated vessel with its base properties.
type vesselSeed struct {
	MMSI       string
	Name       string
	Type       string
	BaseLat    float64
	BaseLon    float64
	Speed      float64
	Course     float64
	Length     float64
	Status     string
}

// Kupang-area vessels — realistic positions around NTT waters
var vessels = []vesselSeed{
	{"525100001", "MV OCEANIC SPIRIT", "Container Ship", -10.145, 123.590, 8.5, 45.0, 190, "Under Way"},
	{"525100002", "ASIAN TRADER", "Tanker", -10.170, 123.620, 6.2, 120.0, 225, "Under Way"},
	{"525100003", "PACIFIC HARMONY", "Container Ship", -10.130, 123.550, 4.8, 210.0, 180, "Under Way"},
	{"525100004", "TIMOR EXPRESS", "Cargo Ship", -10.200, 123.640, 7.3, 330.0, 145, "Under Way"},
	{"525100005", "KRI DIPONEGORO", "Military", -10.110, 123.510, 12.5, 90.0, 105, "Under Way"},
	{"525100006", "NELAYAN JAYA", "Fishing", -10.185, 123.570, 3.1, 180.0, 22, "Fishing"},
	{"525100007", "PELNI KELUD", "Passenger/Ferry", -10.155, 123.605, 14.0, 270.0, 147, "Under Way"},
	{"525100008", "KUPANG TUG 01", "Tug", -10.160, 123.585, 5.5, 15.0, 32, "Under Way"},
	{"525100009", "BOLOK TANKER", "Tanker", -10.195, 123.560, 4.0, 150.0, 200, "At Anchor"},
	{"525100010", "SAIL TIMOR", "Sailing/Yacht", -10.120, 123.530, 6.8, 310.0, 15, "Under Way"},
	{"525100011", "KAPAL IKAN 07", "Fishing", -10.210, 123.610, 2.5, 60.0, 18, "Fishing"},
	{"525100012", "TENAU PILOT", "Pilot Vessel", -10.158, 123.595, 8.0, 200.0, 28, "Under Way"},
	{"525100013", "CARGO NUSANTARA", "Bulk Carrier", -10.175, 123.650, 5.6, 100.0, 210, "Under Way"},
	{"525100014", "DHARMA FERRY II", "Passenger/Ferry", -10.140, 123.575, 11.0, 350.0, 130, "Under Way"},
	{"525100015", "PERTAMINA 109", "Tanker", -10.190, 123.545, 3.2, 240.0, 170, "Under Way"},
	{"525100016", "LAW ENFORCEMENT 03", "Law Enforcement", -10.165, 123.600, 15.0, 135.0, 45, "Under Way"},
}

// vesselState tracks the current mutable position of a simulated vessel.
type vesselState struct {
	seed    vesselSeed
	lat     float64
	lon     float64
	course  float64
	speed   float64
}

// StartAISSimulator publishes simulated AIS position reports to NATS JetStream
// on the subject MARITIME.ais.live every 2-3 seconds per vessel (round-robin).
func StartAISSimulator(js nats.JetStreamContext) {
	states := make([]vesselState, len(vessels))
	for i, v := range vessels {
		states[i] = vesselState{
			seed:   v,
			lat:    v.BaseLat,
			lon:    v.BaseLon,
			course: v.Course,
			speed:  v.Speed,
		}
	}

	log.Printf("[SIM] AIS Simulator started — %d vessels around Kupang waters", len(vessels))

	go func() {
		idx := 0
		for {
			s := &states[idx%len(states)]

			// Simulate movement: drift position based on speed and course
			// ~1 knot = 1.852 km/h, 1° lat ≈ 111 km
			dt := 3.0 // seconds since last update
			distNm := s.speed * (dt / 3600.0)
			distDeg := distNm / 60.0

			courseRad := s.course * math.Pi / 180.0
			s.lat += distDeg * math.Cos(courseRad)
			s.lon += distDeg * math.Sin(courseRad) / math.Cos(s.lat*math.Pi/180.0)

			// Add slight randomness to course and speed
			s.course += (rand.Float64() - 0.5) * 5.0 // ±2.5° wander
			if s.course < 0 {
				s.course += 360
			}
			if s.course >= 360 {
				s.course -= 360
			}
			s.speed = s.seed.Speed + (rand.Float64()-0.5)*2.0
			if s.speed < 0.5 {
				s.speed = 0.5
			}

			// Boundary check — keep vessels within Kupang area
			if s.lat < -10.30 || s.lat > -10.00 || s.lon < 123.40 || s.lon > 123.80 {
				s.course += 180
				if s.course >= 360 {
					s.course -= 360
				}
			}

			payload := AISPayload{
				MMSI:       s.seed.MMSI,
				VesselName: s.seed.Name,
				VesselType: s.seed.Type,
				Lat:        math.Round(s.lat*1e6) / 1e6,
				Lon:        math.Round(s.lon*1e6) / 1e6,
				Speed:      math.Round(s.speed*10) / 10,
				Course:     math.Round(s.course*10) / 10,
				Heading:    math.Round(s.course*10) / 10,
				Status:     s.seed.Status,
				Length:     s.seed.Length,
			}

			data, err := json.Marshal(payload)
			if err != nil {
				log.Printf("[SIM] Marshal error: %v", err)
			} else {
				if _, err := js.Publish("MARITIME.ais.live", data); err != nil {
					log.Printf("[SIM] NATS publish error: %v", err)
				}
			}

			idx++
			// ~2-3s cycle time spread across all vessels
			sleepMs := 150 + rand.Intn(50) // ~150-200ms per vessel, full cycle ≈ 2.5s
			time.Sleep(time.Duration(sleepMs) * time.Millisecond)
		}
	}()
}
