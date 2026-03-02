package natsjs

import (
	"log"
	"time"

	"github.com/nats-io/nats.go"
)

// Client wraps a NATS connection and JetStream context.
type Client struct {
	Conn      *nats.Conn
	JetStream nats.JetStreamContext
}

// StreamConfig defines a JetStream stream to be provisioned.
type StreamConfig struct {
	Name     string
	Subjects []string
	MaxAge   time.Duration
}

// Streams to provision on startup.
var requiredStreams = []StreamConfig{
	{
		Name:     "VISION_STREAM",
		Subjects: []string{"VISION.>"},
		MaxAge:   0, // unlimited
	},
	{
		Name:     "MARITIME_STREAM",
		Subjects: []string{"MARITIME.>"},
		MaxAge:   1 * time.Hour,
	},
	{
		Name:     "TELEMETRY_STREAM",
		Subjects: []string{"TELEMETRY.>"},
		MaxAge:   24 * time.Hour,
	},
}

// Connect establishes a NATS connection with JetStream and provisions all
// required streams. Retries up to 10 times on connection failure.
func Connect(natsURL string) (*Client, error) {
	var nc *nats.Conn
	var err error

	for i := 0; i < 10; i++ {
		nc, err = nats.Connect(natsURL,
			nats.MaxReconnects(-1),
			nats.ReconnectWait(2*time.Second),
		)
		if err == nil {
			break
		}
		log.Printf("[NATS] Connection attempt %d/10 failed: %v", i+1, err)
		time.Sleep(2 * time.Second)
	}
	if err != nil {
		return nil, err
	}

	js, err := nc.JetStream()
	if err != nil {
		nc.Close()
		return nil, err
	}

	client := &Client{
		Conn:      nc,
		JetStream: js,
	}

	if err := client.provisionStreams(); err != nil {
		nc.Close()
		return nil, err
	}

	log.Println("[NATS] Connected and all streams provisioned")
	return client, nil
}

// provisionStreams creates or updates each required JetStream stream.
func (c *Client) provisionStreams() error {
	for _, s := range requiredStreams {
		cfg := &nats.StreamConfig{
			Name:      s.Name,
			Subjects:  s.Subjects,
			MaxAge:    s.MaxAge,
			Storage:   nats.FileStorage,
			Retention: nats.LimitsPolicy,
		}

		// Try to get existing stream info
		existing, err := c.JetStream.StreamInfo(s.Name)
		if err != nil && err != nats.ErrStreamNotFound {
			return err
		}

		if existing != nil {
			// Update if it already exists (idempotent)
			if _, err := c.JetStream.UpdateStream(cfg); err != nil {
				log.Printf("[NATS] Warning: could not update stream %s: %v", s.Name, err)
			} else {
				log.Printf("[NATS] Stream updated: %s (subjects=%v, maxAge=%v)", s.Name, s.Subjects, s.MaxAge)
			}
		} else {
			// Create new stream
			if _, err := c.JetStream.AddStream(cfg); err != nil {
				return err
			}
			log.Printf("[NATS] Stream created: %s (subjects=%v, maxAge=%v)", s.Name, s.Subjects, s.MaxAge)
		}
	}
	return nil
}

// Close cleanly shuts down the NATS connection.
func (c *Client) Close() {
	if c.Conn != nil {
		c.Conn.Drain()
	}
}
