package influxclient

import (
	"time"

	"github.com/influxdata/influxdb-client-go/v2/api/write"
)

// =============================================================================
// InfluxDB Measurement Schemas
//
// Tags  = indexed, low-cardinality identifiers (used for GROUP BY / filtering)
// Fields = high-cardinality measured values (the actual data)
// =============================================================================

// AISPosition represents a single AIS vessel position report.
//
// Measurement: "ais_position"
// Tags:        mmsi, vessel_name, vessel_type
// Fields:      lat, lon, speed, course, heading, status, length
type AISPosition struct {
	// --- Tags (indexed) ---
	MMSI       string `json:"mmsi"       influx:"tag"`
	VesselName string `json:"vessel_name" influx:"tag"`
	VesselType string `json:"vessel_type" influx:"tag"`

	// --- Fields (values) ---
	Lat     float64 `json:"lat"     influx:"field"`
	Lon     float64 `json:"lon"     influx:"field"`
	Speed   float64 `json:"speed"   influx:"field"`
	Course  float64 `json:"course"  influx:"field"`
	Heading float64 `json:"heading" influx:"field"`
	Status  string  `json:"status"  influx:"field"`
	Length  float64 `json:"length"  influx:"field"`

	// --- Timestamp ---
	Timestamp time.Time `json:"timestamp"`
}

// ADSBPosition represents a single ADS-B aircraft position report.
//
// Measurement: "adsb_position"
// Tags:        icao24, callsign, aircraft_type
// Fields:      lat, lon, altitude, speed, heading, on_ground
type ADSBPosition struct {
	// --- Tags (indexed) ---
	ICAO24       string `json:"icao24"        influx:"tag"`
	Callsign     string `json:"callsign"      influx:"tag"`
	AircraftType string `json:"aircraft_type" influx:"tag"`

	// --- Fields (values) ---
	Lat      float64 `json:"lat"       influx:"field"`
	Lon      float64 `json:"lon"       influx:"field"`
	Altitude float64 `json:"altitude"  influx:"field"`
	Speed    float64 `json:"speed"     influx:"field"`
	Heading  float64 `json:"heading"   influx:"field"`
	OnGround bool    `json:"on_ground" influx:"field"`

	// --- Timestamp ---
	Timestamp time.Time `json:"timestamp"`
}

// DroneTelemetry represents a single drone telemetry sample.
//
// Measurement: "drone_telemetry"
// Tags:        mission_id, asset_id, flight_id
// Fields:      battery, alt, spd, dist, sig, gps_sats, lat, lon
type DroneTelemetry struct {
	// --- Tags (indexed) ---
	MissionID string `json:"mission_id" influx:"tag"`
	AssetID   string `json:"asset_id"   influx:"tag"`
	FlightID  string `json:"flight_id"  influx:"tag"`

	// --- Fields (values) ---
	Battery float64 `json:"battery"  influx:"field"`
	Alt     float64 `json:"alt"      influx:"field"`
	Spd     float64 `json:"spd"      influx:"field"`
	Dist    float64 `json:"dist"     influx:"field"`
	Sig     float64 `json:"sig"      influx:"field"`
	GpsSats int     `json:"gps_sats" influx:"field"`
	Lat     float64 `json:"lat"      influx:"field"`
	Lon     float64 `json:"lon"      influx:"field"`

	// --- Timestamp ---
	Timestamp time.Time `json:"timestamp"`
}

// WeatherObservation represents a weather data sample.
//
// Measurement: "weather_observation"
// Tags:        station_id, region
// Fields:      temp, humidity, wind_speed, wind_dir, pressure, description, lat, lon
type WeatherObservation struct {
	// --- Tags (indexed) ---
	StationID string `json:"station_id" influx:"tag"`
	Region    string `json:"region"     influx:"tag"`

	// --- Fields (values) ---
	Temp        float64 `json:"temp"        influx:"field"`
	Humidity    float64 `json:"humidity"    influx:"field"`
	WindSpeed   float64 `json:"wind_speed"  influx:"field"`
	WindDir     float64 `json:"wind_dir"    influx:"field"`
	Pressure    float64 `json:"pressure"    influx:"field"`
	Description string  `json:"description" influx:"field"`
	Lat         float64 `json:"lat"         influx:"field"`
	Lon         float64 `json:"lon"         influx:"field"`

	// --- Timestamp ---
	Timestamp time.Time `json:"timestamp"`
}

// =============================================================================
// Conversion helpers: struct → InfluxDB Point
// =============================================================================

// ToPoint converts an AISPosition to an InfluxDB write.Point.
func (a *AISPosition) ToPoint() *Point {
	return NewPoint(
		"ais_position",
		map[string]string{
			"mmsi":        a.MMSI,
			"vessel_name": a.VesselName,
			"vessel_type": a.VesselType,
		},
		map[string]interface{}{
			"lat":     a.Lat,
			"lon":     a.Lon,
			"speed":   a.Speed,
			"course":  a.Course,
			"heading": a.Heading,
			"status":  a.Status,
			"length":  a.Length,
		},
		a.Timestamp,
	)
}

// ToPoint converts an ADSBPosition to an InfluxDB write.Point.
func (a *ADSBPosition) ToPoint() *Point {
	return NewPoint(
		"adsb_position",
		map[string]string{
			"icao24":        a.ICAO24,
			"callsign":      a.Callsign,
			"aircraft_type": a.AircraftType,
		},
		map[string]interface{}{
			"lat":       a.Lat,
			"lon":       a.Lon,
			"altitude":  a.Altitude,
			"speed":     a.Speed,
			"heading":   a.Heading,
			"on_ground": a.OnGround,
		},
		a.Timestamp,
	)
}

// ToPoint converts a DroneTelemetry to an InfluxDB write.Point.
func (d *DroneTelemetry) ToPoint() *Point {
	return NewPoint(
		"drone_telemetry",
		map[string]string{
			"mission_id": d.MissionID,
			"asset_id":   d.AssetID,
			"flight_id":  d.FlightID,
		},
		map[string]interface{}{
			"battery":  d.Battery,
			"alt":      d.Alt,
			"spd":      d.Spd,
			"dist":     d.Dist,
			"sig":      d.Sig,
			"gps_sats": d.GpsSats,
			"lat":      d.Lat,
			"lon":      d.Lon,
		},
		d.Timestamp,
	)
}

// ToPoint converts a WeatherObservation to an InfluxDB write.Point.
func (w *WeatherObservation) ToPoint() *Point {
	return NewPoint(
		"weather_observation",
		map[string]string{
			"station_id": w.StationID,
			"region":     w.Region,
		},
		map[string]interface{}{
			"temp":        w.Temp,
			"humidity":    w.Humidity,
			"wind_speed":  w.WindSpeed,
			"wind_dir":    w.WindDir,
			"pressure":    w.Pressure,
			"description": w.Description,
			"lat":         w.Lat,
			"lon":         w.Lon,
		},
		w.Timestamp,
	)
}

// Point is an alias for the InfluxDB write.Point type, exposed for convenience.
type Point = write.Point
