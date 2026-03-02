package simulator

import (
	"encoding/json"
	"log"
	"math"
	"math/rand"
	"time"

	"github.com/nats-io/nats.go"
)

// FlightPayload is the JSON payload published to TELEMETRY.adsb.live.
type FlightPayload struct {
	ICAO24       string  `json:"icao24"`
	Callsign     string  `json:"callsign"`
	AircraftType string  `json:"aircraft_type"`
	Lat          float64 `json:"lat"`
	Lon          float64 `json:"lon"`
	Altitude     float64 `json:"altitude"`
	Speed        float64 `json:"speed"`
	Heading      float64 `json:"heading"`
	OnGround     bool    `json:"on_ground"`
}

// flightSeed defines a simulated commercial flight with waypoints.
type flightSeed struct {
	ICAO24       string
	Callsign     string
	AircraftType string
	StartLat     float64
	StartLon     float64
	EndLat       float64
	EndLon       float64
	AltitudeFt   float64 // cruise altitude in feet
	SpeedKmh     float64 // cruise speed in km/h
}

var flights = []flightSeed{
	// East-West corridors across NTT
	{"A1B2C3", "GA-714", "Boeing 737-800", -10.17, 122.80, -10.16, 124.40, 35000, 850},
	{"D4E5F6", "JT-892", "Boeing 737 MAX 8", -10.10, 124.50, -10.20, 122.60, 33000, 830},
	// North-South corridors
	{"G7H8I9", "QZ-7701", "Airbus A320neo", -9.50, 123.60, -10.80, 123.55, 37000, 870},
	{"J1K2L3", "ID-6543", "Airbus A330-300", -10.90, 123.50, -9.40, 123.65, 39000, 900},
	// Diagonal routes
	{"M4N5O6", "SJ-234", "Boeing 737-500", -9.80, 122.90, -10.50, 124.20, 31000, 800},
	{"P7Q8R9", "GA-431", "ATR 72-600", -10.30, 124.10, -9.90, 123.00, 22000, 510},
	// Long-haul overflights
	{"S1T2U3", "SQ-942", "Airbus A350-900", -9.60, 122.50, -10.60, 124.60, 41000, 920},
	{"V4W5X6", "QF-188", "Boeing 787-9", -10.70, 124.50, -9.50, 122.60, 40000, 910},
}

// flightState tracks current position along the flight route.
type flightState struct {
	seed     flightSeed
	progress float64 // 0.0 = start, 1.0 = end
	heading  float64
}

// StartFlightSimulator publishes simulated ADS-B flight positions to NATS
// on the subject TELEMETRY.adsb.live. Each aircraft traverses a linear route.
func StartFlightSimulator(js nats.JetStreamContext) {
	states := make([]flightState, len(flights))
	for i, f := range flights {
		states[i] = flightState{
			seed:     f,
			progress: rand.Float64() * 0.3, // start 0-30% into the route
		}
		// Calculate initial heading
		states[i].heading = calcHeading(f.StartLat, f.StartLon, f.EndLat, f.EndLon)
	}

	log.Printf("[SIM] Flight Simulator started — %d commercial flights over NTT airspace", len(flights))

	go func() {
		idx := 0
		for {
			s := &states[idx%len(states)]

			// Advance along route (~0.3-0.5% per tick)
			s.progress += 0.003 + rand.Float64()*0.002
			if s.progress >= 1.0 {
				// Reverse direction (simulate return flight)
				s.seed.StartLat, s.seed.EndLat = s.seed.EndLat, s.seed.StartLat
				s.seed.StartLon, s.seed.EndLon = s.seed.EndLon, s.seed.StartLon
				s.progress = 0.0
				s.heading = calcHeading(s.seed.StartLat, s.seed.StartLon, s.seed.EndLat, s.seed.EndLon)
			}

			// Interpolate position
			lat := s.seed.StartLat + (s.seed.EndLat-s.seed.StartLat)*s.progress
			lon := s.seed.StartLon + (s.seed.EndLon-s.seed.StartLon)*s.progress

			// Add slight lateral drift for realism
			lat += (rand.Float64() - 0.5) * 0.002
			lon += (rand.Float64() - 0.5) * 0.002

			// Altitude with minor turbulence oscillation
			alt := s.seed.AltitudeFt + math.Sin(s.progress*20)*200 + (rand.Float64()-0.5)*100

			// Speed with jitter
			spd := s.seed.SpeedKmh + (rand.Float64()-0.5)*20

			// Heading with very slight drift
			heading := s.heading + (rand.Float64()-0.5)*2

			payload := FlightPayload{
				ICAO24:       s.seed.ICAO24,
				Callsign:     s.seed.Callsign,
				AircraftType: s.seed.AircraftType,
				Lat:          math.Round(lat*1e6) / 1e6,
				Lon:          math.Round(lon*1e6) / 1e6,
				Altitude:     math.Round(alt),
				Speed:        math.Round(spd*10) / 10,
				Heading:      math.Round(heading*10) / 10,
				OnGround:     false,
			}

			data, err := json.Marshal(payload)
			if err != nil {
				log.Printf("[SIM] Flight marshal error: %v", err)
			} else {
				if _, err := js.Publish("TELEMETRY.adsb.live", data); err != nil {
					log.Printf("[SIM] Flight NATS publish error: %v", err)
				}
			}

			idx++
			sleepMs := 300 + rand.Intn(200) // round-robin ~300-500ms
			time.Sleep(time.Duration(sleepMs) * time.Millisecond)
		}
	}()
}

// calcHeading calculates the initial bearing from point A to point B.
func calcHeading(lat1, lon1, lat2, lon2 float64) float64 {
	dLon := (lon2 - lon1) * math.Pi / 180
	lat1R := lat1 * math.Pi / 180
	lat2R := lat2 * math.Pi / 180

	x := math.Sin(dLon) * math.Cos(lat2R)
	y := math.Cos(lat1R)*math.Sin(lat2R) - math.Sin(lat1R)*math.Cos(lat2R)*math.Cos(dLon)

	bearing := math.Atan2(x, y) * 180 / math.Pi
	if bearing < 0 {
		bearing += 360
	}
	return bearing
}
