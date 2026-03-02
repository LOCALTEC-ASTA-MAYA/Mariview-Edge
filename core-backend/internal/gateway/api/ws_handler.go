package api

import (
	"log"
	"net/http"
	"sync"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 4096,
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

// VisionHub manages fan-out from a single NATS broadcast channel
// to multiple WebSocket clients. This allows many browser tabs to
// receive AI vision detections simultaneously.
type VisionHub struct {
	mu      sync.RWMutex
	clients map[*websocket.Conn]chan []byte
}

// NewVisionHub creates a hub and starts its broadcast loop.
func NewVisionHub(broadcastChan <-chan []byte) *VisionHub {
	h := &VisionHub{
		clients: make(map[*websocket.Conn]chan []byte),
	}

	// Fan-out goroutine: reads from the single NATS channel
	// and copies to every registered WebSocket client's buffer.
	go func() {
		for payload := range broadcastChan {
			h.mu.RLock()
			for _, ch := range h.clients {
				select {
				case ch <- payload:
				default:
					// Client buffer full — drop this frame for slow consumers
				}
			}
			h.mu.RUnlock()
		}
	}()

	log.Printf("[WS-HUB] Vision fan-out hub started")
	return h
}

// register adds a WebSocket client to the hub.
func (h *VisionHub) register(conn *websocket.Conn) chan []byte {
	ch := make(chan []byte, 64) // per-client buffer
	h.mu.Lock()
	h.clients[conn] = ch
	count := len(h.clients)
	h.mu.Unlock()
	log.Printf("[WS-HUB] Client connected (%d active)", count)
	return ch
}

// unregister removes a WebSocket client from the hub.
func (h *VisionHub) unregister(conn *websocket.Conn) {
	h.mu.Lock()
	if ch, ok := h.clients[conn]; ok {
		close(ch)
		delete(h.clients, conn)
	}
	count := len(h.clients)
	h.mu.Unlock()
	log.Printf("[WS-HUB] Client disconnected (%d active)", count)
}

// WsVisionHandler creates an HTTP handler that upgrades to WebSocket
// and streams AI vision detections from the fan-out hub.
func WsVisionHandler(hub *VisionHub) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			log.Printf("[WS] Upgrade failed: %v", err)
			return
		}
		defer conn.Close()

		clientCh := hub.register(conn)
		defer hub.unregister(conn)

		// Read pump: drain client messages (pings/close) in background
		go func() {
			for {
				if _, _, err := conn.ReadMessage(); err != nil {
					break
				}
			}
		}()

		// Write pump: send detection payloads to this client
		for payload := range clientCh {
			if err := conn.WriteMessage(websocket.TextMessage, payload); err != nil {
				break
			}
		}
	}
}