#!/usr/bin/env python3
"""
Virtual Drone Simulator
========================
A complete C4I virtual drone that:

1. Reads a local MP4 video file frame-by-frame (OpenCV)
2. Runs YOLOv8 inference on each frame
3. Draws annotated bounding boxes on the frame
4. Pipes the annotated video to FFmpeg → RTSP push → MediaMTX
5. Publishes detection JSON to NATS  VISION.ai.raw
6. Publishes simulated telemetry to NATS  TELEMETRY.drone.live
7. Loops the video indefinitely

Environment Variables:
    NATS_URL            — NATS server URL (default: nats://locallitix-backbone:4222)
    MEDIAMTX_RTSP_URL   — RTSP push target (default: rtsp://locallitix-video:8554/drone-cam)
    VIDEO_PATH          — Path to the input MP4 (default: /app/videos/raw_drone.mp4)
    YOLO_MODEL          — YOLOv8 model name (default: yolov8n.pt for speed)
    YOLO_CONF           — Minimum confidence threshold (default: 0.35)
    PUBLISH_INTERVAL    — Seconds between NATS detection publishes (default: 0.5)
"""

import asyncio
import base64
import json
import math
import os
import random
import signal
import subprocess
import sys
import time
from datetime import datetime, timezone

import cv2
import numpy as np

try:
    import aiohttp
except ImportError:
    aiohttp = None  # type: ignore
    print("[VDRONE] WARNING: aiohttp not installed — Datalastic AIS enrichment disabled")

# ─────────────────────────────────────────────
# Datalastic AIS Service
# ─────────────────────────────────────────────

DATALASTIC_API_KEY = os.getenv("DATALASTIC_API_KEY", "")
DATALASTIC_BASE_URL = "https://api.datalastic.com/api/v0"
AIS_SEARCH_RADIUS_KM = 5  # search for vessels within 5km of estimated GPS
AIS_CACHE_TTL = 60  # cache AIS results for 60 seconds
AIS_RATE_LIMIT_SECS = 30  # max 1 API call per 30 seconds

# Vessel-class labels that should trigger AIS enrichment
VESSEL_CLASSES = {"cargo_vessel", "speedboat", "patrol_boat"}

# Camera field of view (assumed horizontal FOV in degrees)
CAMERA_HFOV_DEG = 90.0


class DatalasticService:
    """Async AIS data fetcher with caching and rate limiting."""

    def __init__(self):
        self._cache: dict[str, dict] = {}  # key = "lat,lon" → {data, time}
        self._last_request_time: float = 0
        self._session: aiohttp.ClientSession | None = None

    async def _get_session(self) -> "aiohttp.ClientSession":
        if self._session is None or self._session.closed:
            if aiohttp is None:
                raise RuntimeError("aiohttp not available")
            self._session = aiohttp.ClientSession()
        return self._session

    async def close(self):
        if self._session and not self._session.closed:
            await self._session.close()

    async def fetch_nearby_vessels(self, lat: float, lon: float) -> list[dict]:
        """Fetch AIS vessels near (lat, lon) from Datalastic API.
        Returns cached results if available and fresh."""
        if not DATALASTIC_API_KEY or aiohttp is None:
            return []

        # Cache key: rounded to 3 decimal places (~111m precision)
        cache_key = f"{lat:.3f},{lon:.3f}"
        now = time.time()

        # Check cache
        cached = self._cache.get(cache_key)
        if cached and (now - cached["time"]) < AIS_CACHE_TTL:
            return cached["data"]

        # Rate limit
        if (now - self._last_request_time) < AIS_RATE_LIMIT_SECS:
            # Return stale cache if available, else empty
            return cached["data"] if cached else []

        try:
            session = await self._get_session()
            self._last_request_time = now
            url = f"{DATALASTIC_BASE_URL}/vessel_inradius"
            params = {
                "api-key": DATALASTIC_API_KEY,
                "latitude": str(lat),
                "longitude": str(lon),
                "radius": str(AIS_SEARCH_RADIUS_KM),
            }
            async with session.get(url, params=params, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                if resp.status == 200:
                    body = await resp.json()
                    vessels = body.get("data", [])
                    # Normalize to our format
                    result = []
                    for v in vessels[:10]:  # cap at 10 nearest
                        result.append({
                            "mmsi": v.get("mmsi", ""),
                            "vesselName": v.get("name", "Unknown"),
                            "imo": v.get("imo", ""),
                            "type": v.get("type_specific") or v.get("type", "Unknown"),
                            "speed": v.get("speed", 0),
                            "course": v.get("course", 0),
                            "length": v.get("length", 0),
                            "width": v.get("width", 0),
                            "draft": v.get("draft", 0),
                            "destination": v.get("destination", ""),
                            "eta": v.get("eta", ""),
                            "callSign": v.get("callsign", ""),
                            "lat": v.get("lat", lat),
                            "lon": v.get("lon", lon),
                        })
                    self._cache[cache_key] = {"data": result, "time": now}
                    print(f"[DATALASTIC] Found {len(result)} vessels near ({lat:.4f}, {lon:.4f})")
                    return result
                else:
                    print(f"[DATALASTIC] API error: HTTP {resp.status}")
                    return cached["data"] if cached else []
        except Exception as e:
            print(f"[DATALASTIC] Request failed: {e}")
            return cached["data"] if cached else []


def estimate_detection_gps(
    bbox: list[int],
    frame_w: int,
    frame_h: int,
    drone_lat: float,
    drone_lon: float,
    drone_alt: float,
) -> dict:
    """Estimate the GPS coordinates of a detected object based on its bbox
    position in the frame and the drone's GPS + altitude.

    Uses a pinhole camera model with assumed 90° horizontal FOV.
    """
    # Bbox center offset from frame center (in pixels)
    bbox_cx = (bbox[0] + bbox[2]) / 2.0
    bbox_cy = (bbox[1] + bbox[3]) / 2.0
    offset_x = bbox_cx - (frame_w / 2.0)  # positive = right
    offset_y = bbox_cy - (frame_h / 2.0)  # positive = down (south)

    # Ground footprint at drone altitude
    hfov_rad = math.radians(CAMERA_HFOV_DEG)
    ground_half_w = drone_alt * math.tan(hfov_rad / 2.0)  # meters
    vfov_rad = hfov_rad * (frame_h / frame_w)  # approximate vertical FOV
    ground_half_h = drone_alt * math.tan(vfov_rad / 2.0)

    # Pixel → meter offset
    offset_m_east = (offset_x / (frame_w / 2.0)) * ground_half_w
    offset_m_south = (offset_y / (frame_h / 2.0)) * ground_half_h

    # Meter offset → lat/lon delta (approximate at equator-ish latitudes)
    # 1 degree latitude ≈ 111,320 meters
    # 1 degree longitude ≈ 111,320 * cos(lat) meters
    d_lat = -offset_m_south / 111320.0  # negative because y-down = south
    d_lon = offset_m_east / (111320.0 * math.cos(math.radians(drone_lat)))

    return {
        "lat": round(drone_lat + d_lat, 6),
        "lon": round(drone_lon + d_lon, 6),
    }


async def enrich_detections_with_ais(
    detections: list[dict],
    frame_w: int,
    frame_h: int,
    drone_lat: float,
    drone_lon: float,
    drone_alt: float,
    ais_service: "DatalasticService",
) -> list[dict]:
    """Enrich vessel detections with AIS data from Datalastic.
    Non-vessel detections pass through unchanged."""
    for det in detections:
        if det["class"] not in VESSEL_CLASSES:
            continue

        # Estimate GPS of detected vessel
        est_gps = estimate_detection_gps(
            det["bbox"], frame_w, frame_h,
            drone_lat, drone_lon, drone_alt,
        )
        det["estimatedGps"] = est_gps

        # Fetch nearby AIS vessels
        nearby = await ais_service.fetch_nearby_vessels(est_gps["lat"], est_gps["lon"])
        if nearby:
            # Pick closest vessel by haversine approximation
            best = min(nearby, key=lambda v: (
                (v["lat"] - est_gps["lat"]) ** 2 + (v["lon"] - est_gps["lon"]) ** 2
            ))
            det["aisData"] = {
                "mmsi": best["mmsi"],
                "vesselName": best["vesselName"],
                "imo": best["imo"],
                "type": best["type"],
                "speed": best["speed"],
                "course": best["course"],
                "length": best["length"],
                "width": best.get("width", 0),
                "draft": best["draft"],
                "destination": best["destination"],
                "eta": best["eta"],
                "callSign": best["callSign"],
            }
        else:
            # No AIS data available — mark as pending
            det["aisData"] = None

    return detections


# ─────────────────────────────────────────────
# Configuration
# ─────────────────────────────────────────────

NATS_URL = os.getenv("NATS_URL", "nats://locallitix-backbone:4222")
MEDIAMTX_RTSP_URL = os.getenv("MEDIAMTX_RTSP_URL", "rtsp://locallitix-video:8554/drone-cam")
VIDEO_PATH = os.getenv("VIDEO_PATH", "/app/videos/raw_drone.mp4")
YOLO_MODEL = os.getenv("YOLO_MODEL", "yolov8n.pt")
YOLO_CONF = float(os.getenv("YOLO_CONF", "0.35"))
PUBLISH_INTERVAL = float(os.getenv("PUBLISH_INTERVAL", "0.5"))

# Drone identity
DRONE_FLIGHT_ID = "FLT-001"
DRONE_MISSION_ID = "MSN-KPG-001"
DRONE_ASSET_ID = "PYRHOS-X1"
DRONE_NAME = "Pyrhos X V1"
DRONE_TYPE = "Fixed Wing"

# Kupang patrol waypoints (lat, lon)
PATROL_WAYPOINTS = [
    (-10.1550, 123.5800),
    (-10.1650, 123.5950),
    (-10.1800, 123.6100),
    (-10.1950, 123.5900),
    (-10.1850, 123.5650),
    (-10.1700, 123.5500),
]

# YOLOv8 COCO class name → our maritime class name mapping
COCO_TO_MARITIME = {
    "boat": "cargo_vessel",
    "ship": "cargo_vessel",
    "airplane": "patrol_boat",
    "person": "person_on_deck",
    "surfboard": "floating_debris",
    "sports ball": "floating_debris",
    "kite": "floating_debris",
    "car": "speedboat",
    "truck": "cargo_vessel",
    "bus": "cargo_vessel",
    "bird": "floating_debris",
    "umbrella": "floating_debris",
}

# ─────────────────────────────────────────────
# Telemetry State
# ─────────────────────────────────────────────

class TelemetryState:
    """Simulates a drone flying a patrol route with highly realistic telemetry."""

    def __init__(self):
        self.waypoint_idx = 0
        self.progress = 0.0  # 0..1 between current and next waypoint
        self.battery = 98.0
        self.alt = 120.0
        self.heading = 145.0
        self.speed = 15.5
        self.orbit_dist_km = 1.5
        self._start_time = time.time()

    def tick(self, dt: float):
        """Advance the drone state by dt seconds."""
        # Move along patrol route
        self.progress += dt * 0.02  # ~50s per leg
        if self.progress >= 1.0:
            self.progress -= 1.0
            self.waypoint_idx = (self.waypoint_idx + 1) % len(PATROL_WAYPOINTS)

        # Interpolate position
        wp_a = PATROL_WAYPOINTS[self.waypoint_idx]
        wp_b = PATROL_WAYPOINTS[(self.waypoint_idx + 1) % len(PATROL_WAYPOINTS)]
        lat = wp_a[0] + (wp_b[0] - wp_a[0]) * self.progress
        lon = wp_a[1] + (wp_b[1] - wp_a[1]) * self.progress

        # Heading from A to B
        dlat = wp_b[0] - wp_a[0]
        dlon = wp_b[1] - wp_a[1]
        self.heading = (math.degrees(math.atan2(dlon, dlat)) + 360) % 360

        # Smooth, tight oscillations matching user spec
        t = time.time()
        # Altitude: 118.0 – 122.0m (smooth sine wave + micro-jitter)
        self.alt = 120.0 + math.sin(t * 0.15) * 2.0 + random.uniform(-0.3, 0.3)
        # Speed: 14.5 – 16.5 m/s
        self.speed = 15.5 + math.sin(t * 0.2) * 1.0 + random.uniform(-0.2, 0.2)
        # Battery: starts at 98%, drains ~0.01% per second (very slow)
        self.battery -= dt * 0.01
        if self.battery < 15:
            self.battery = 98.0  # simulate battery swap
        # Signal: 92 – 98%
        sig = 95.0 + math.sin(t * 0.1) * 3.0 + random.uniform(-0.5, 0.5)

        return {
            "mission_id": DRONE_MISSION_ID,
            "asset_id": DRONE_ASSET_ID,
            "flight_id": DRONE_FLIGHT_ID,
            "drone_name": DRONE_NAME,
            "drone_type": DRONE_TYPE,
            "battery": round(self.battery, 1),
            "alt": round(self.alt, 1),
            "spd": round(self.speed, 1),
            "heading": round(self.heading, 1),
            "dist": round(self.orbit_dist_km * 1000),
            "sig": round(max(92, min(98, sig)), 1),
            "gps_sats": 14 + random.randint(0, 4),
            "lat": round(lat, 6),
            "lon": round(lon, 6),
        }


# ─────────────────────────────────────────────
# FFmpeg RTSP Push Process
# ─────────────────────────────────────────────

def start_ffmpeg(width: int, height: int, fps: float) -> subprocess.Popen:
    """Start an FFmpeg subprocess that reads raw BGR frames from stdin
    and pushes H.264/RTSP to MediaMTX."""
    cmd = [
        "ffmpeg",
        "-y",
        "-f", "rawvideo",
        "-vcodec", "rawvideo",
        "-pix_fmt", "bgr24",
        "-s", f"{width}x{height}",
        "-r", str(fps),
        "-i", "-",
        # Encode
        "-c:v", "libx264",
        "-preset", "ultrafast",
        "-tune", "zerolatency",
        "-g", str(int(fps * 2)),  # GOP = 2 seconds
        "-f", "rtsp",
        "-rtsp_transport", "tcp",
        MEDIAMTX_RTSP_URL,
    ]
    print(f"[VDRONE] FFmpeg cmd: {' '.join(cmd)}")
    proc = subprocess.Popen(
        cmd,
        stdin=subprocess.PIPE,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.PIPE,
    )
    return proc


# ─────────────────────────────────────────────
# Detection → NATS payload adapter
# ─────────────────────────────────────────────

# Snapshot cache: send a FULL FRAME snapshot for active detections, re-encode every 10s.
# { class_name: { "b64": str, "time": float } }
_snapshot_cache: dict[str, dict] = {}

SNAPSHOT_COOLDOWN = 10  # seconds between re-encoding the same class
SNAPSHOT_MAX_WIDTH = 640  # resize full frame to save bandwidth

# Dummy AIS data pool for vessel detections (used when no real Datalastic key)
_DUMMY_AIS_POOL = [
    {
        "mmsi": "477123456", "vesselName": "MV OCEANIC SPIRIT", "imo": "IMO9234567",
        "type": "Container Ship", "speed": 8.5, "course": 145, "length": 294,
        "width": 32, "draft": 12.5, "destination": "Jakarta Port",
        "eta": "2025-01-20 16:00", "callSign": "VRXY2",
    },
    {
        "mmsi": "477567890", "vesselName": "HAPAG-LLOYD EXPRESS", "imo": "IMO9456789",
        "type": "Bulk Carrier", "speed": 12.8, "course": 90, "length": 334,
        "width": 48, "draft": 14.5, "destination": "Rotterdam",
        "eta": "2025-02-05 18:00", "callSign": "VRHL4",
    },
    {
        "mmsi": "412345678", "vesselName": "KRI BUNG TOMO", "imo": "IMO8801234",
        "type": "Patrol Vessel", "speed": 18.2, "course": 220, "length": 57,
        "width": 8, "draft": 2.8, "destination": "Kupang Naval Base",
        "eta": "2025-01-19 09:30", "callSign": "PNAV7",
    },
    {
        "mmsi": "525009876", "vesselName": "PELNI KELUD", "imo": "IMO9012345",
        "type": "Passenger/Cargo", "speed": 15.0, "course": 310, "length": 146,
        "width": 23, "draft": 5.9, "destination": "Surabaya",
        "eta": "2025-01-21 14:00", "callSign": "YBLK2",
    },
]


def results_to_payload(results, frame: np.ndarray, frame_id: int, frame_w: int, frame_h: int) -> dict:
    """Convert YOLOv8 Results to the VISION.ai.raw payload format.
    Sends FULL FRAME snapshots (not bbox crops) and injects dummy AIS for vessels."""
    detections = []
    if results and len(results) > 0:
        boxes = results[0].boxes
        if boxes is not None:
            for i in range(len(boxes)):
                cls_id = int(boxes.cls[i].item())
                cls_name = results[0].names.get(cls_id, "unknown")
                conf = float(boxes.conf[i].item())
                x1, y1, x2, y2 = [int(v) for v in boxes.xyxy[i].tolist()]

                # Map COCO class to maritime class
                maritime_cls = COCO_TO_MARITIME.get(cls_name, cls_name)

                # Refresh FULL FRAME snapshot in cache every SNAPSHOT_COOLDOWN seconds
                now = time.time()
                cached = _snapshot_cache.get(maritime_cls)
                if cached is None or (now - cached["time"]) > SNAPSHOT_COOLDOWN:
                    try:
                        # Resize full frame to save bandwidth
                        scale = SNAPSHOT_MAX_WIDTH / frame_w
                        resized = cv2.resize(frame, (SNAPSHOT_MAX_WIDTH, int(frame_h * scale))).copy()

                        # Draw bounding box on the resized frame
                        sx1, sy1 = int(x1 * scale), int(y1 * scale)
                        sx2, sy2 = int(x2 * scale), int(y2 * scale)
                        color = (0, 255, 0)  # green BGR
                        cv2.rectangle(resized, (sx1, sy1), (sx2, sy2), color, 2)

                        # Draw label + confidence above the box
                        label = f"{maritime_cls} {conf:.0%}"
                        font = cv2.FONT_HERSHEY_SIMPLEX
                        font_scale, thickness = 0.45, 1
                        (tw, th), _ = cv2.getTextSize(label, font, font_scale, thickness)
                        # Filled background for readability
                        cv2.rectangle(resized, (sx1, sy1 - th - 6), (sx1 + tw + 4, sy1), color, -1)
                        cv2.putText(resized, label, (sx1 + 2, sy1 - 4), font, font_scale, (0, 0, 0), thickness)

                        _, buf = cv2.imencode('.jpg', resized, [cv2.IMWRITE_JPEG_QUALITY, 55])
                        b64 = base64.b64encode(buf.tobytes()).decode('ascii')
                        _snapshot_cache[maritime_cls] = {"b64": b64, "time": now}
                    except Exception:
                        pass  # keep old cache on error

                # Build detection payload
                det: dict = {
                    "class": maritime_cls,
                    "confidence": round(conf, 4),
                    "bbox": [x1, y1, x2, y2],
                }

                # ALWAYS attach the cached snapshot (never empty for known classes)
                cached = _snapshot_cache.get(maritime_cls)
                if cached:
                    det["snapshot_b64"] = cached["b64"]

                # Inject dummy AIS data for vessel-class detections
                if maritime_cls in VESSEL_CLASSES:
                    # Deterministic pick based on class name so same class gets same vessel
                    ais_idx = hash(maritime_cls) % len(_DUMMY_AIS_POOL)
                    det["aisData"] = dict(_DUMMY_AIS_POOL[ais_idx])  # copy to avoid mutation

                detections.append(det)

    return {
        "camera_id": "drone-cam-pyrhos-x1",
        "frame_id": frame_id,
        "resolution": [frame_w, frame_h],
        "model": f"yolov8-maritime ({YOLO_MODEL})",
        "inference_ms": 0,  # filled in after inference
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "detections": detections,
    }


# ─────────────────────────────────────────────
# Main Loop
# ─────────────────────────────────────────────

async def main():
    import nats
    from nats.errors import ConnectionClosedError, NoServersError

    print("=" * 60)
    print("  LOCALLITIX Virtual Drone Simulator")
    print("=" * 60)
    print(f"  Video:     {VIDEO_PATH}")
    print(f"  Model:     {YOLO_MODEL} (conf={YOLO_CONF})")
    print(f"  NATS:      {NATS_URL}")
    print(f"  RTSP Push: {MEDIAMTX_RTSP_URL}")
    print(f"  Drone:     {DRONE_NAME} ({DRONE_TYPE})")
    print("=" * 60)

    # ── Load YOLOv8 ──────────────────────────
    from ultralytics import YOLO
    print(f"[VDRONE] Loading YOLOv8 model: {YOLO_MODEL} ...")
    model = YOLO(YOLO_MODEL)
    print(f"[VDRONE] Model loaded. Classes: {len(model.names)}")

    # ── Open video ───────────────────────────
    if not os.path.exists(VIDEO_PATH):
        print(f"[VDRONE] FATAL: Video file not found: {VIDEO_PATH}")
        sys.exit(1)

    cap = cv2.VideoCapture(VIDEO_PATH)
    if not cap.isOpened():
        print(f"[VDRONE] FATAL: Cannot open video: {VIDEO_PATH}")
        sys.exit(1)

    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    print(f"[VDRONE] Video: {width}x{height} @ {fps:.1f} FPS ({total_frames} frames)")

    # ── Connect to NATS ──────────────────────
    nc = None
    for attempt in range(1, 31):
        try:
            nc = await nats.connect(NATS_URL)
            print(f"[VDRONE] Connected to NATS on attempt {attempt}")
            break
        except (ConnectionClosedError, NoServersError, OSError) as e:
            print(f"[VDRONE] NATS attempt {attempt}/30 failed: {e}")
            await asyncio.sleep(2)

    if nc is None:
        print("[VDRONE] FATAL: Could not connect to NATS after 30 attempts")
        sys.exit(1)

    js = nc.jetstream()

    # ── Start FFmpeg ─────────────────────────
    ffmpeg_proc = start_ffmpeg(width, height, fps)
    print(f"[VDRONE] FFmpeg started (PID: {ffmpeg_proc.pid})")

    # ── State ─────────────────────────────
    telemetry = TelemetryState()
    ais_service = DatalasticService()
    if DATALASTIC_API_KEY:
        print(f"[VDRONE] Datalastic AIS enrichment ENABLED (key={DATALASTIC_API_KEY[:8]}...)")
    else:
        print("[VDRONE] Datalastic AIS enrichment DISABLED (no DATALASTIC_API_KEY)")
    frame_id = 0
    total_detections = 0
    last_nats_publish = 0.0
    last_telemetry_publish = 0.0
    frame_interval = 1.0 / fps

    # ── Graceful shutdown ────────────────────
    shutdown = asyncio.Event()

    def signal_handler():
        print("\n[VDRONE] Shutting down...")
        shutdown.set()

    loop = asyncio.get_event_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, signal_handler)

    print(f"[VDRONE] Starting processing loop...")

    try:
        while not shutdown.is_set():
            t_start = time.monotonic()

            # Read frame (loop on EOF)
            ret, frame = cap.read()
            if not ret:
                cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                ret, frame = cap.read()
                if not ret:
                    print("[VDRONE] Cannot re-read video, exiting")
                    break

            frame_id += 1

            # ── YOLOv8 Inference ─────────────
            t_inf = time.monotonic()
            results = model(frame, conf=YOLO_CONF, verbose=False)
            inference_ms = round((time.monotonic() - t_inf) * 1000, 1)

            # ── Draw annotated frame ─────────
            annotated = results[0].plot() if results and len(results) > 0 else frame

            # ── Pipe to FFmpeg (RTSP) ────────
            try:
                ffmpeg_proc.stdin.write(annotated.tobytes())
            except BrokenPipeError:
                print("[VDRONE] FFmpeg pipe broken, restarting...")
                ffmpeg_proc = start_ffmpeg(width, height, fps)

            # ── Publish detections to NATS ───
            now = time.monotonic()
            if now - last_nats_publish >= PUBLISH_INTERVAL:
                payload = results_to_payload(results, frame, frame_id, width, height)
                payload["inference_ms"] = inference_ms
                # Embed current telemetry so frontend gets it via /ws/vision
                telem_snap = telemetry.tick(0)  # 0 dt = read-only snapshot
                payload["telemetry"] = telem_snap

                # Enrich vessel detections with AIS data from Datalastic
                if payload["detections"]:
                    await enrich_detections_with_ais(
                        payload["detections"], width, height,
                        telem_snap["lat"], telem_snap["lon"], telem_snap["alt"],
                        ais_service,
                    )

                det_count = len(payload["detections"])
                total_detections += det_count

                try:
                    data = json.dumps(payload).encode()
                    await js.publish("VISION.ai.raw", data)
                except Exception as e:
                    print(f"[VDRONE] NATS vision publish error: {e}")

                last_nats_publish = now

            # ── Publish telemetry ────────────
            if now - last_telemetry_publish >= 1.0:
                telem = telemetry.tick(1.0)
                try:
                    data = json.dumps(telem).encode()
                    await js.publish("TELEMETRY.drone.live", data)
                except Exception as e:
                    print(f"[VDRONE] NATS telemetry publish error: {e}")

                last_telemetry_publish = now

            # ── Progress logging ─────────────
            if frame_id % 100 == 0:
                print(
                    f"[VDRONE] Frame #{frame_id} | "
                    f"Inference: {inference_ms}ms | "
                    f"Detections total: {total_detections} | "
                    f"Battery: {telemetry.battery:.0f}%"
                )

            # ── Frame pacing ─────────────────
            elapsed = time.monotonic() - t_start
            sleep_time = max(0, frame_interval - elapsed)
            if sleep_time > 0:
                await asyncio.sleep(sleep_time)

    finally:
        print(f"\n[VDRONE] Summary: {frame_id} frames, {total_detections} detections")
        if ffmpeg_proc.stdin:
            ffmpeg_proc.stdin.close()
        ffmpeg_proc.wait(timeout=5)
        cap.release()
        await ais_service.close()
        await nc.drain()
        print("[VDRONE] Clean shutdown complete. Goodbye!")


if __name__ == "__main__":
    asyncio.run(main())
