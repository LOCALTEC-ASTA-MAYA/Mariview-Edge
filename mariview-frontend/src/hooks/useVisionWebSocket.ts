import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Detection payload from the YOLO vision WebSocket.
 * Matches the Python mock_yolo.py output format.
 */
export interface AISData {
    mmsi: string;
    vesselName: string;
    imo: string;
    type: string;
    speed: number;
    course: number;
    length: number;
    width?: number;
    draft: number;
    destination: string;
    eta: string;
    callSign: string;
}

export interface VisionDetection {
    track_id?: number;
    class: string;
    confidence: number;
    bbox: [number, number, number, number]; // [x_min, y_min, x_max, y_max]
    status?: string; // PENDING | ANALYZED
    snapshot_b64?: string; // base64 JPEG crop of the detected object
    aisData?: AISData | null; // AIS correlation data (null = pending, undefined = not a vessel)
    estimatedGps?: { lat: number; lon: number }; // estimated GPS from bbox projection
}

export interface VisionFrame {
    camera_id: string;
    frame_id: number;
    resolution: [number, number];
    model: string;
    inference_ms: number;
    timestamp: string;
    detections: VisionDetection[];
    telemetry?: DroneTelemetry;
}

export interface DroneTelemetry {
    battery: number;
    alt: number;
    spd: number;
    dist: number;
    sig: number;
    gps_sats: number;
    lat: number;
    lon: number;
    heading?: number;
    drone_name?: string;
    flight_id?: string;
}

interface UseVisionWebSocketReturn {
    /** Current live detections from the latest frame */
    detections: VisionDetection[];
    /** Full frame metadata */
    lastFrame: VisionFrame | null;
    /** WebSocket connection state */
    isConnected: boolean;
    /** Total frames received since mount */
    frameCount: number;
    /** Live drone telemetry from the embedded payload */
    telemetry: DroneTelemetry | null;
    /** Rolling history of detections with snapshots (max 50) */
    detectionHistory: VisionDetection[];
}

/**
 * useVisionWebSocket — connects to the Go WebSocket at /ws/vision
 * and streams live AI detection bounding boxes.
 *
 * Features:
 * - Auto-reconnect with exponential backoff (1s → 2s → 4s, max 10s)
 * - Stale detection clearing after `staleTimeoutMs` of no data
 * - Clean unmount lifecycle
 */
export function useVisionWebSocket(staleTimeoutMs = 3000, enabled = true): UseVisionWebSocketReturn {
    const [detections, setDetections] = useState<VisionDetection[]>([]);
    const [lastFrame, setLastFrame] = useState<VisionFrame | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [frameCount, setFrameCount] = useState(0);
    const [telemetry, setTelemetry] = useState<DroneTelemetry | null>(null);
    const [detectionHistory, setDetectionHistory] = useState<VisionDetection[]>([]);

    const wsRef = useRef<WebSocket | null>(null);
    const staleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const mountedRef = useRef(true);
    const backoffRef = useRef(1000);
    const enabledRef = useRef(enabled);
    enabledRef.current = enabled;

    const clearStaleTimer = useCallback(() => {
        if (staleTimerRef.current) {
            clearTimeout(staleTimerRef.current);
            staleTimerRef.current = null;
        }
    }, []);

    const resetStaleTimer = useCallback(() => {
        clearStaleTimer();
        staleTimerRef.current = setTimeout(() => {
            if (mountedRef.current) {
                setDetections([]);
            }
        }, staleTimeoutMs);
    }, [staleTimeoutMs, clearStaleTimer]);

    const connect = useCallback(() => {
        if (!mountedRef.current) return;

        // Determine WS URL relative to current page
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.hostname;
        // In dev, the Go API runs on :8080; in prod, nginx proxies /ws/*
        const port = import.meta.env.DEV ? '8080' : window.location.port;
        const wsUrl = `${protocol}//${host}:${port}/ws/vision`;

        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
            if (!mountedRef.current) return;
            console.log('[VISION-WS] Connected to', wsUrl);
            setIsConnected(true);
            backoffRef.current = 1000; // reset backoff
        };

        ws.onmessage = (event) => {
            if (!mountedRef.current) return;
            // Drop data when not enabled (video not yet playing)
            if (!enabledRef.current) return;
            try {
                const frame: VisionFrame = JSON.parse(event.data);
                setLastFrame(frame);
                setDetections(frame.detections || []);
                setFrameCount(c => c + 1);
                // Update live telemetry if present
                if (frame.telemetry) {
                    setTelemetry(frame.telemetry);
                }
                // Upsert detectionHistory by track_id (deduplicate cards)
                const incoming = frame.detections || [];
                if (incoming.length > 0) {
                    setDetectionHistory(prev => {
                        const map = new Map<number, VisionDetection>();
                        // Index existing entries by track_id
                        for (const d of prev) {
                            if (d.track_id != null) map.set(d.track_id, d);
                        }
                        // Upsert incoming detections
                        for (const d of incoming) {
                            if (d.track_id == null) continue;
                            const existing = map.get(d.track_id);
                            if (existing) {
                                // Update fields but PRESERVE snapshot if incoming is empty
                                map.set(d.track_id, {
                                    ...existing,
                                    class: d.class,
                                    confidence: d.confidence,
                                    bbox: d.bbox,
                                    status: d.status,
                                    aisData: d.aisData ?? existing.aisData,
                                    estimatedGps: d.estimatedGps ?? existing.estimatedGps,
                                    snapshot_b64: d.snapshot_b64 || existing.snapshot_b64,
                                });
                            } else {
                                // New track_id
                                map.set(d.track_id, { ...d });
                            }
                        }
                        return Array.from(map.values()).slice(0, 50);
                    });
                }
                resetStaleTimer();
            } catch (err) {
                console.error('[VISION-WS] Parse error:', err);
            }
        };

        ws.onclose = () => {
            if (!mountedRef.current) return;
            console.log('[VISION-WS] Disconnected, reconnecting in', backoffRef.current, 'ms');
            setIsConnected(false);

            // Exponential backoff reconnect
            reconnectTimerRef.current = setTimeout(() => {
                backoffRef.current = Math.min(backoffRef.current * 2, 10000);
                connect();
            }, backoffRef.current);
        };

        ws.onerror = () => {
            // onclose will fire after onerror, which triggers reconnect
        };
    }, [resetStaleTimer]);

    useEffect(() => {
        mountedRef.current = true;
        connect();

        return () => {
            mountedRef.current = false;
            clearStaleTimer();
            if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
            if (wsRef.current) {
                wsRef.current.onclose = null; // prevent reconnect on unmount
                wsRef.current.close();
            }
        };
    }, [connect, clearStaleTimer]);

    return { detections, lastFrame, isConnected, frameCount, telemetry, detectionHistory };
}
