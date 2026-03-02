package ingestor

import (
	"encoding/json"
	"log"
	"time"

	influxclient "locallitix-core/pkg/influxclient"

	"github.com/nats-io/nats.go"
)

// MaritimeIngestor subscribes to MARITIME.ais.live on NATS JetStream
// and writes each AIS position report to InfluxDB.
type MaritimeIngestor struct {
	js     nats.JetStreamContext
	influx *influxclient.Client
}

// NewMaritimeIngestor creates a new ingestor instance.
func NewMaritimeIngestor(js nats.JetStreamContext, influx *influxclient.Client) *MaritimeIngestor {
	return &MaritimeIngestor{
		js:     js,
		influx: influx,
	}
}

// aisMessage matches the JSON payload published by the AIS simulator.
type aisMessage struct {
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

// Start begins consuming AIS messages from NATS and writing to InfluxDB.
// It uses a durable consumer so messages are not lost across restarts.
func (m *MaritimeIngestor) Start() error {
	sub, err := m.js.Subscribe("MARITIME.ais.live", func(msg *nats.Msg) {
		var payload aisMessage
		if err := json.Unmarshal(msg.Data, &payload); err != nil {
			log.Printf("[INGEST-AIS] Unmarshal error: %v", err)
			msg.Nak()
			return
		}

		// Map to InfluxDB schema struct
		point := influxclient.AISPosition{
			MMSI:       payload.MMSI,
			VesselName: payload.VesselName,
			VesselType: payload.VesselType,
			Lat:        payload.Lat,
			Lon:        payload.Lon,
			Speed:      payload.Speed,
			Course:     payload.Course,
			Heading:    payload.Heading,
			Status:     payload.Status,
			Length:     payload.Length,
			Timestamp:  time.Now(),
		}

		m.influx.WritePoint(point.ToPoint())
		msg.Ack()
	},
		nats.Durable("AIS_INGESTOR"),
		nats.ManualAck(),
		nats.AckWait(10*time.Second),
		nats.MaxDeliver(3),
	)
	if err != nil {
		return err
	}

	log.Printf("[INGEST-AIS] Subscribed to MARITIME.ais.live (durable=AIS_INGESTOR)")
	_ = sub // keep reference alive
	return nil
}
