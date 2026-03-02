package graph

import (
	"context"
	"fmt"
	"log"
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

// queryAISVessels retrieves the most recent position for each unique MMSI
// within the last 5 minutes from the ais_position measurement in InfluxDB.
func queryAISVessels(influx *influxclient.Client) ([]Vessel, error) {
	if influx == nil {
		return nil, fmt.Errorf("InfluxDB client not initialized")
	}

	// Flux query: get latest record per MMSI within last 5 minutes
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
	if err != nil {
		return nil, fmt.Errorf("InfluxDB query failed: %w", err)
	}

	var vessels []Vessel

	for result.Next() {
		record := result.Record()
		values := record.Values()

		v := Vessel{
			MMSI: safeString(values["mmsi"]),
		}

		// Generate a stable ID from MMSI
		v.ID = fmt.Sprintf("ais-%s", v.MMSI)
		v.Name = safeString(values["vessel_name"])
		v.Type = safeString(values["vessel_type"])

		lat := safeFloat(values["lat"])
		lon := safeFloat(values["lon"])
		v.Position = []float64{lat, lon}

		v.Speed = safeFloat(values["speed"])
		v.Course = safeFloat(values["course"])
		v.Heading = safeFloat(values["heading"])
		v.Status = safeString(values["status"])
		v.Length = safeFloat(values["length"])

		vessels = append(vessels, v)
	}

	if err := result.Err(); err != nil {
		return nil, fmt.Errorf("InfluxDB result error: %w", err)
	}

	log.Printf("[GRAPHQL] getAISVessels: returned %d vessels", len(vessels))
	return vessels, nil
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

// queryLiveFlights retrieves the most recent position for each unique icao24
// within the last 5 minutes from the adsb_position measurement in InfluxDB.
func queryLiveFlights(influx *influxclient.Client) ([]Flight, error) {
	if influx == nil {
		return nil, fmt.Errorf("InfluxDB client not initialized")
	}

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
	if err != nil {
		return nil, fmt.Errorf("InfluxDB flight query failed: %w", err)
	}

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

	if err := result.Err(); err != nil {
		return nil, fmt.Errorf("InfluxDB flight result error: %w", err)
	}

	log.Printf("[GRAPHQL] getLiveFlights: returned %d flights", len(flights))
	return flights, nil
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
