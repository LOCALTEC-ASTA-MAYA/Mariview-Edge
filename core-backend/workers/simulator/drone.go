package simulator

import (
	"encoding/json"
	"log"
	"math"
	"math/rand"
	"time"

	"github.com/nats-io/nats.go"
)

// DronePayload is the JSON payload published to TELEMETRY.drone.live.
type DronePayload struct {
	MissionID string  `json:"mission_id"`
	AssetID   string  `json:"asset_id"`
	FlightID  string  `json:"flight_id"`
	DroneName string  `json:"drone_name"`
	DroneType string  `json:"drone_type"`
	Battery   float64 `json:"battery"`
	Alt       float64 `json:"alt"`
	Spd       float64 `json:"spd"`
	Dist      float64 `json:"dist"`
	Sig       float64 `json:"sig"`
	GpsSats   int     `json:"gps_sats"`
	Lat       float64 `json:"lat"`
	Lon       float64 `json:"lon"`
}

// droneSeed defines a simulated drone with its base orbit parameters.
type droneSeed struct {
	MissionID  string
	AssetID    string
	FlightID   string
	DroneName  string
	DroneType  string
	OrbitLat   float64 // center of circular orbit
	OrbitLon   float64
	OrbitRadKm float64 // orbit radius in km
	AltBase    float64 // base altitude in meters
	SpeedBase  float64 // base speed in m/s
}

var drones = []droneSeed{
	{"MSN-KPG-001", "PYRHOS-X1", "FLT-001", "Pyrhos X V1", "Fixed Wing", -10.155, 123.580, 1.5, 120, 18.5},
	{"MSN-KPG-002", "AR2-001", "FLT-002", "AR-2 Aerial", "Multirotor", -10.175, 123.605, 0.8, 80, 12.0},
	{"MSN-KPG-003", "PYRHOS-X2", "FLT-003", "Pyrhos X V2", "Fixed Wing", -10.140, 123.550, 2.0, 150, 20.0},
	{"MSN-KPG-004", "HEX-001", "FLT-004", "Hexacopter H6", "Multirotor", -10.190, 123.620, 0.5, 60, 8.0},
	{"MSN-KPG-005", "VTOL-001", "FLT-005", "VTOL Scout", "VTOL", -10.165, 123.570, 1.2, 100, 15.0},
}

// droneState tracks the current position of a simulated drone in its orbit.
type droneState struct {
	seed    droneSeed
	angle   float64 // current orbit angle in radians
	battery float64 // current battery percentage
}

// StartDroneSimulator publishes simulated drone telemetry to NATS JetStream
// on the subject TELEMETRY.drone.live. Each drone orbits its assigned area.
func StartDroneSimulator(js nats.JetStreamContext) {
	states := make([]droneState, len(drones))
	for i, d := range drones {
		states[i] = droneState{
			seed:    d,
			angle:   rand.Float64() * 2 * math.Pi, // random starting angle
			battery: 85 + rand.Float64()*15,        // 85-100%
		}
	}

	log.Printf("[SIM] Drone Simulator started — %d drones orbiting Kupang airspace", len(drones))

	go func() {
		idx := 0
		for {
			s := &states[idx%len(states)]

			// Advance orbit angle (~2° per tick)
			s.angle += (0.03 + rand.Float64()*0.02)
			if s.angle > 2*math.Pi {
				s.angle -= 2 * math.Pi
			}

			// Calculate position on circular orbit
			radiusDeg := s.seed.OrbitRadKm / 111.0 // ~111km per degree
			lat := s.seed.OrbitLat + radiusDeg*math.Cos(s.angle)
			lon := s.seed.OrbitLon + radiusDeg*math.Sin(s.angle)/math.Cos(s.seed.OrbitLat*math.Pi/180.0)

			// Altitude with slight oscillation
			alt := s.seed.AltBase + math.Sin(s.angle*3)*10 + (rand.Float64()-0.5)*5

			// Speed with jitter
			spd := s.seed.SpeedBase + (rand.Float64()-0.5)*3

			// Battery slowly drains
			s.battery -= 0.01 + rand.Float64()*0.01
			if s.battery < 15 {
				s.battery = 85 + rand.Float64()*15 // "RTL and recharge"
			}

			// Distance from home (orbit center)
			dist := s.seed.OrbitRadKm * 1000 // meters

			payload := DronePayload{
				MissionID: s.seed.MissionID,
				AssetID:   s.seed.AssetID,
				FlightID:  s.seed.FlightID,
				DroneName: s.seed.DroneName,
				DroneType: s.seed.DroneType,
				Battery:   math.Round(s.battery*10) / 10,
				Alt:       math.Round(alt*10) / 10,
				Spd:       math.Round(spd*10) / 10,
				Dist:      math.Round(dist),
				Sig:       math.Round((85+rand.Float64()*15)*10) / 10,
				GpsSats:   12 + rand.Intn(8),
				Lat:       math.Round(lat*1e6) / 1e6,
				Lon:       math.Round(lon*1e6) / 1e6,
			}

			data, err := json.Marshal(payload)
			if err != nil {
				log.Printf("[SIM] Drone marshal error: %v", err)
			} else {
				if _, err := js.Publish("TELEMETRY.drone.live", data); err != nil {
					log.Printf("[SIM] Drone NATS publish error: %v", err)
				}
			}

			idx++
			sleepMs := 400 + rand.Intn(200) // ~400-600ms per drone, full cycle ≈ 2.5s
			time.Sleep(time.Duration(sleepMs) * time.Millisecond)
		}
	}()
}
