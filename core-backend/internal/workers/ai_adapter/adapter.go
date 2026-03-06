package ai_adapter

import (
	"encoding/json"
	"fmt"
	"locallitix-core/internal/domain"
	"locallitix-core/internal/infrastructure/database"
	"log"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/nats-io/nats.go"
	"gorm.io/gorm"
)

type AIAdapter struct {
	nc          *nats.Conn
	js          nats.JetStreamContext
	Broadcaster chan []byte
	Influx      *database.InfluxClient
	DB          *gorm.DB

	// Cached active mission ID (refreshed periodically)
	activeMissionID uuid.UUID
	activeMu        sync.RWMutex
}

func NewAIAdapter(natsURL string, broadcastChan chan []byte, influx *database.InfluxClient, db *gorm.DB) (*AIAdapter, error) {
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

	adapter := &AIAdapter{
		nc:          nc,
		js:          js,
		Broadcaster: broadcastChan,
		Influx:      influx,
		DB:          db,
	}

	// Start background goroutine to refresh active mission cache every 5 seconds
	go adapter.refreshActiveMissionLoop()

	return adapter, nil
}

// refreshActiveMissionLoop polls Postgres for the LIVE mission every 5 seconds
func (a *AIAdapter) refreshActiveMissionLoop() {
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	// Initial fetch
	a.refreshActiveMission()

	for range ticker.C {
		a.refreshActiveMission()
	}
}

func (a *AIAdapter) refreshActiveMission() {
	if a.DB == nil {
		return
	}
	var mission domain.Mission
	err := a.DB.Where("status = ?", "LIVE").Order("started_at DESC").First(&mission).Error
	a.activeMu.Lock()
	defer a.activeMu.Unlock()
	if err != nil {
		// No active mission — clear cache
		if a.activeMissionID != uuid.Nil {
			log.Printf("[AI_ADAPTER] ⚪ No active LIVE mission — cache cleared")
		}
		a.activeMissionID = uuid.Nil
		return
	}
	if a.activeMissionID != mission.ID {
		log.Printf("[AI_ADAPTER] 🎯 Active mission updated: %s (%s)", mission.MissionCode, mission.ID)
	}
	a.activeMissionID = mission.ID
}

func (a *AIAdapter) getActiveMissionID() uuid.UUID {
	a.activeMu.RLock()
	defer a.activeMu.RUnlock()
	return a.activeMissionID
}

// ==========================================================================
// NATS payload structure — matches Python virtual_drone.py output EXACTLY
// The Python worker sends:
//   {
//     "camera_id": "drone-cam-...",
//     "frame_id": 123,
//     "timestamp": "...",
//     "detections": [
//       { "track_id": 1, "class": "warship", "confidence": 0.94,
//         "bbox": {"x1":..,"y1":..,"x2":..,"y2":..}, "snapshot_b64": "..." }
//     ]
//   }
// ==========================================================================

type visionFrame struct {
	CameraID   string      `json:"camera_id"`
	FrameID    int         `json:"frame_id"`
	Timestamp  string      `json:"timestamp"`
	Detections []detection `json:"detections"`
}

type detection struct {
	TrackID     int     `json:"track_id"`
	Class       string  `json:"class"`
	Confidence  float64 `json:"confidence"`
	Status      string  `json:"status"`
	SnapshotB64 string    `json:"snapshot_b64"`
	BBox        []float64 `json:"bbox"`
}

func (a *AIAdapter) ListenForVision() error {
	// Throttle map: prevent DB spam for same class on same mission
	lastSaved := make(map[string]time.Time)
	var throttleMu sync.Mutex

	_, err := a.js.Subscribe("VISION.ai.raw", func(m *nats.Msg) {
		// 1. Forward raw payload to WebSocket broadcast channel (always, for live UI)
		select {
		case a.Broadcaster <- m.Data:
		default:
			// Channel full — drop frame
		}

		// 2. Parse the vision frame (the FULL nested structure)
		var frame visionFrame
		if err := json.Unmarshal(m.Data, &frame); err != nil {
			log.Printf("[AI_ADAPTER] ⚠️ JSON unmarshal failed: %v | raw=%s", err, string(m.Data[:min(200, len(m.Data))]))
			m.Ack()
			return
		}

		// 3. Write to InfluxDB (legacy persistence — one point per frame)
		if frame.CameraID != "" {
			p := database.InfluxPoint(
				"ai_detections",
				map[string]string{"camera_id": frame.CameraID},
				map[string]interface{}{"frame_id": frame.FrameID, "detection_count": len(frame.Detections)},
				time.Now(),
			)
			a.Influx.WriteAPI.WritePoint(p)
		}

		// 4. PERSIST EACH DETECTION TO POSTGRES (with throttle)
		if a.DB == nil || len(frame.Detections) == 0 {
			m.Ack()
			return
		}

		// Resolve which mission to attach to
		missionID := a.getActiveMissionID()
		if missionID == uuid.Nil {
			m.Ack()
			return
		}

		saved := 0
		skipped := 0
		for _, det := range frame.Detections {
			// Skip detections without class, low confidence, or NO IMAGE
			if det.Class == "" || det.Confidence <= 0.01 || det.SnapshotB64 == "" {
				continue
			}

			// SNIPER FILTER: throttle same class on same mission to 1 insert per 5 seconds
			throttleKey := fmt.Sprintf("%s-%s", missionID, det.Class)
			throttleMu.Lock()
			if lastTime, exists := lastSaved[throttleKey]; exists && time.Since(lastTime) < 5*time.Second {
				throttleMu.Unlock()
				skipped++
				continue
			}
			throttleMu.Unlock()

			// Safe bbox mapping: Python sends [x1, y1, x2, y2] as array
			var bx1, by1, bx2, by2 float64
			if len(det.BBox) >= 4 {
				bx1, by1, bx2, by2 = det.BBox[0], det.BBox[1], det.BBox[2], det.BBox[3]
			}

			// Map base64 snapshot to data URI for browser rendering
			snapshotURL := ""
			if det.SnapshotB64 != "" {
				snapshotURL = "data:image/jpeg;base64," + det.SnapshotB64
			}

			snapshot := domain.Snapshot{
				MissionID:      missionID,
				TrackID:        det.TrackID,
				Classification: det.Class,
				Confidence:     det.Confidence,
				SnapshotURL:    snapshotURL,
				BboxX1:         bx1,
				BboxY1:         by1,
				BboxX2:         bx2,
				BboxY2:         by2,
				DetectedAt:     time.Now(),
			}

			if err := a.DB.Create(&snapshot).Error; err != nil {
				log.Printf("[AI_ADAPTER] ❌ FAILED to save snapshot: %v (mission=%s class=%s)", err, missionID, det.Class)
			} else {
				saved++
				// Update throttle timestamp on success
				throttleMu.Lock()
				lastSaved[throttleKey] = time.Now()
				throttleMu.Unlock()
			}
		}

		if saved > 0 {
			log.Printf("[AI_ADAPTER] ✅ Saved %d/%d snapshots for mission %s (frame=%d, skipped=%d)", saved, len(frame.Detections), missionID, frame.FrameID, skipped)
		}

		m.Ack()
	}, nats.Durable("VISION_AI_RAW_FE"), nats.ManualAck())

	return err
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// Close cleanly shuts down the NATS connection.
func (a *AIAdapter) Close() {
	if a.nc != nil {
		a.nc.Close()
	}
}