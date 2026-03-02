package ingestor

import (
	"encoding/json"
	"log"
	"time"

	influxclient "locallitix-core/pkg/influxclient"

	"github.com/nats-io/nats.go"
)

// FlightIngestor subscribes to TELEMETRY.adsb.live on NATS JetStream
// and writes each ADS-B position report to InfluxDB.
type FlightIngestor struct {
	js     nats.JetStreamContext
	influx *influxclient.Client
}

// NewFlightIngestor creates a new flight ingestor instance.
func NewFlightIngestor(js nats.JetStreamContext, influx *influxclient.Client) *FlightIngestor {
	return &FlightIngestor{
		js:     js,
		influx: influx,
	}
}

// flightMessage matches the JSON payload published by the flight simulator.
type flightMessage struct {
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

// Start begins consuming ADS-B position messages from NATS and writing to InfluxDB.
func (f *FlightIngestor) Start() error {
	sub, err := f.js.Subscribe("TELEMETRY.adsb.live", func(msg *nats.Msg) {
		var payload flightMessage
		if err := json.Unmarshal(msg.Data, &payload); err != nil {
			log.Printf("[INGEST-ADSB] Unmarshal error: %v", err)
			msg.Nak()
			return
		}

		// Map to InfluxDB schema struct
		point := influxclient.ADSBPosition{
			ICAO24:       payload.ICAO24,
			Callsign:     payload.Callsign,
			AircraftType: payload.AircraftType,
			Lat:          payload.Lat,
			Lon:          payload.Lon,
			Altitude:     payload.Altitude,
			Speed:        payload.Speed,
			Heading:      payload.Heading,
			OnGround:     payload.OnGround,
			Timestamp:    time.Now(),
		}

		f.influx.WritePoint(point.ToPoint())
		msg.Ack()
	},
		nats.Durable("ADSB_INGESTOR"),
		nats.ManualAck(),
		nats.AckWait(10*time.Second),
		nats.MaxDeliver(3),
	)
	if err != nil {
		return err
	}

	log.Printf("[INGEST-ADSB] Subscribed to TELEMETRY.adsb.live (durable=ADSB_INGESTOR)")
	_ = sub
	return nil
}
