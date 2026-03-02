package influxclient

import (
	"context"
	"fmt"
	"log"
	"time"

	influxdb2 "github.com/influxdata/influxdb-client-go/v2"
	"github.com/influxdata/influxdb-client-go/v2/api"
	"github.com/influxdata/influxdb-client-go/v2/api/write"
)

// Client wraps an InfluxDB v2 client with both Write and Query APIs.
type Client struct {
	inner    influxdb2.Client
	WriteAPI api.WriteAPI
	QueryAPI api.QueryAPI
	Org      string
	Bucket   string
}

// Connect initializes the InfluxDB client with both Write and Query APIs.
// Retries connection up to 10 times before failing.
func Connect(url, token, org, bucket string) (*Client, error) {
	inner := influxdb2.NewClientWithOptions(url, token,
		influxdb2.DefaultOptions().
			SetBatchSize(1000).
			SetFlushInterval(1000).
			SetPrecision(time.Millisecond),
	)

	// Verify connectivity
	var healthy bool
	for i := 0; i < 10; i++ {
		ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		check, err := inner.Health(ctx)
		cancel()
		if err == nil && check.Status == "pass" {
			healthy = true
			break
		}
		log.Printf("[INFLUX] Health check %d/10 failed: %v", i+1, err)
		time.Sleep(2 * time.Second)
	}
	if !healthy {
		inner.Close()
		return nil, fmt.Errorf("[INFLUX] Failed to connect to %s after 10 retries", url)
	}

	writeAPI := inner.WriteAPI(org, bucket)
	queryAPI := inner.QueryAPI(org)

	// Background error logging for async writes
	go func() {
		for err := range writeAPI.Errors() {
			log.Printf("[INFLUX] Write error: %v", err)
		}
	}()

	log.Printf("[INFLUX] Connected to %s (org=%s, bucket=%s)", url, org, bucket)

	return &Client{
		inner:    inner,
		WriteAPI: writeAPI,
		QueryAPI: queryAPI,
		Org:      org,
		Bucket:   bucket,
	}, nil
}

// Close flushes pending writes and closes the client.
func (c *Client) Close() {
	c.WriteAPI.Flush()
	c.inner.Close()
}

// WritePoint writes a single point to InfluxDB asynchronously.
func (c *Client) WritePoint(p *write.Point) {
	c.WriteAPI.WritePoint(p)
}

// NewPoint is a convenience wrapper for creating an InfluxDB Point.
func NewPoint(measurement string, tags map[string]string, fields map[string]interface{}, t time.Time) *write.Point {
	return influxdb2.NewPoint(measurement, tags, fields, t)
}
