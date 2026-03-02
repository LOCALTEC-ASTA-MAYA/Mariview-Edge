package ingestor

import (
	"encoding/json"
	"log"
	"time"

	influxclient "locallitix-core/pkg/influxclient"

	"github.com/nats-io/nats.go"
)

// DroneIngestor subscribes to TELEMETRY.drone.live on NATS JetStream
// and writes each drone telemetry report to InfluxDB.
type DroneIngestor struct {
	js     nats.JetStreamContext
	influx *influxclient.Client
}

// NewDroneIngestor creates a new drone ingestor instance.
func NewDroneIngestor(js nats.JetStreamContext, influx *influxclient.Client) *DroneIngestor {
	return &DroneIngestor{
		js:     js,
		influx: influx,
	}
}

// droneMessage matches the JSON payload published by the drone simulator.
type droneMessage struct {
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

// Start begins consuming drone telemetry messages from NATS and writing to InfluxDB.
func (d *DroneIngestor) Start() error {
	sub, err := d.js.Subscribe("TELEMETRY.drone.live", func(msg *nats.Msg) {
		var payload droneMessage
		if err := json.Unmarshal(msg.Data, &payload); err != nil {
			log.Printf("[INGEST-DRONE] Unmarshal error: %v", err)
			msg.Nak()
			return
		}

		// Map to InfluxDB schema struct
		point := influxclient.DroneTelemetry{
			MissionID: payload.MissionID,
			AssetID:   payload.AssetID,
			FlightID:  payload.FlightID,
			Battery:   payload.Battery,
			Alt:       payload.Alt,
			Spd:       payload.Spd,
			Dist:      payload.Dist,
			Sig:       payload.Sig,
			GpsSats:   payload.GpsSats,
			Lat:       payload.Lat,
			Lon:       payload.Lon,
			Timestamp: time.Now(),
		}

		d.influx.WritePoint(point.ToPoint())
		msg.Ack()
	},
		nats.Durable("DRONE_INGESTOR"),
		nats.ManualAck(),
		nats.AckWait(10*time.Second),
		nats.MaxDeliver(3),
	)
	if err != nil {
		return err
	}

	log.Printf("[INGEST-DRONE] Subscribed to TELEMETRY.drone.live (durable=DRONE_INGESTOR)")
	_ = sub
	return nil
}
