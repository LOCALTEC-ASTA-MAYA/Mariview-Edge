package ai_adapter

import (
	"encoding/json"
	"locallitix-core/internal/domain"
	"locallitix-core/internal/infrastructure/database"
	"time"

	"github.com/nats-io/nats.go"
)

type AIAdapter struct {
	nc          *nats.Conn
	js          nats.JetStreamContext
	Broadcaster chan []byte
	Influx      *database.InfluxClient
}

func NewAIAdapter(natsURL string, broadcastChan chan []byte, influx *database.InfluxClient) (*AIAdapter, error) {
	nc, err := nats.Connect(natsURL)
	if err != nil {
		return nil, err
	}

	js, err := nc.JetStream()
	if err != nil {
		return nil, err
	}

	_, err = js.AddStream(&nats.StreamConfig{
		Name:     "VISION_STREAM",
		Subjects: []string{"VISION.>"},
		MaxAge:   0,
		Storage:  nats.FileStorage,
	})

	return &AIAdapter{
		nc:          nc,
		js:          js,
		Broadcaster: broadcastChan,
		Influx:      influx,
	}, nil
}

func (a *AIAdapter) ListenForVision() error {
	_, err := a.js.Subscribe("VISION.ai.raw", func(m *nats.Msg) {
		// Forward raw payload to WebSocket broadcast channel
		select {
		case a.Broadcaster <- m.Data:
		default:
			// Channel full — drop frame
		}

		// Also write to InfluxDB for persistence
		var payload domain.VisionPayload
		if err := json.Unmarshal(m.Data, &payload); err == nil {
			p := database.InfluxPoint(
				"ai_detections",
				map[string]string{"model_type": payload.Type, "flight_id": payload.FlightID},
				map[string]interface{}{"confidence": payload.Conf, "bbox_x1": payload.BBox.X1},
				time.Now(),
			)
			a.Influx.WriteAPI.WritePoint(p)
		}

		m.Ack()
	}, nats.Durable("VISION_AI_RAW_FE"), nats.ManualAck())

	return err
}