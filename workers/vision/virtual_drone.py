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
import io
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
from PIL import Image

try:
    import aiohttp
except ImportError:
    aiohttp = None  # type: ignore
    print("[VDRONE] WARNING: aiohttp not installed — Datalastic AIS enrichment disabled")

# CLIP candidate classes for zero-shot maritime classification
CLIP_CANDIDATES = ["Yacht", "Sailboat", "Cargo Vessel", "Patrol Boat", "Speedboat", "Warship", "Floating Debris"]

# ─────────────────────────────────────────────
# Datalastic AIS Service
# ─────────────────────────────────────────────

DATALASTIC_API_KEY = os.getenv("DATALASTIC_API_KEY", "")
DATALASTIC_BASE_URL = "https://api.datalastic.com/api/v0"
AIS_SEARCH_RADIUS_KM = 5  # search for vessels within 5km of estimated GPS
AIS_CACHE_TTL = 60  # cache AIS results for 60 seconds
AIS_RATE_LIMIT_SECS = 30  # max 1 API call per 30 seconds

# ── Circuit Breaker / Demo Flag ──
SIMULATE_API_DOWN = os.getenv("SIMULATE_API_DOWN", "false").lower() == "true"

# KKP Demo fallback AIS payload (used when API is down or SIMULATE_API_DOWN=True)
KKP_FALLBACK_AIS = {
    "mmsi": "525000301",
    "vesselName": "KN TANJUNG DATU 301",
    "imo": "IMO999301",
    "type": "Patrol Vessel",
    "speed": 12.5,
    "course": 220,
    "length": 57,
    "width": 8,
    "draft": 2.8,
    "destination": "SEA PATROL Z-1",
    "eta": "",
    "callSign": "PNAV7",
}

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
        if not DATALASTIC_API_KEY or aiohttp is None or SIMULATE_API_DOWN:
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
            async with session.get(url, params=params, timeout=aiohttp.ClientTimeout(total=3)) as resp:
                if resp.status == 200:
                    body = await resp.json()
                    # Safely parse response — data can be list or dict
                    raw_data = body.get("data")
                    vessels_list = []
                    if isinstance(raw_data, list):
                        vessels_list = raw_data
                    elif isinstance(raw_data, dict):
                        vessels_list = raw_data.get("vessels", [])
                        if not isinstance(vessels_list, list):
                            vessels_list = []
                    # Normalize to our format
                    result = []
                    for v in vessels_list[:10]:  # cap at 10 nearest
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
            # Fallback: inject KKP demo AIS when real API unavailable
            det["aisData"] = dict(KKP_FALLBACK_AIS)

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
    """Simulates a drone flying a patrol route with video-time-synced telemetry.

    Altitude phases (307s video):
      Takeoff  (t < 30s):    0 → 120m
      Cruising (30 ≤ t < 270): 120m ± 1.5m oscillation
      Landing  (t ≥ 270s):   120m → 0m at t=307
    """

    VIDEO_DURATION = 307.0  # drone.mp4 is 5m07s

    def __init__(self):
        self.waypoint_idx = 0
        self.progress = 0.0  # 0..1 between current and next waypoint
        self.battery = 98.0
        self.alt = 0.0
        self.heading = 145.0
        self.speed = 0.0
        self.orbit_dist_km = 1.5
        self._start_time = time.time()

    def tick(self, dt: float, video_time: float = -1.0):
        """Advance the drone state.
        video_time: seconds into the video (drives altitude phases).
        dt: elapsed real seconds (drives waypoint progress).
        """
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

        t = video_time if video_time >= 0 else (time.time() - self._start_time)

        # ── Phase-based altitude (synchronized to video time) ──
        if t < 30:
            # Takeoff: climb from 0 to 120m
            self.alt = (t / 30.0) * 120.0
            self.speed = 5.0 + (t / 30.0) * 10.5  # accelerate during takeoff
        elif t < 270:
            # Cruising: hold at 120m with subtle oscillation
            self.alt = 120.0 + math.sin(t * 0.15) * 1.5
            self.speed = 15.5 + math.sin(t * 0.2) * 1.0 + random.uniform(-0.2, 0.2)
        else:
            # Landing: descend from 120 to 0 over 37 seconds
            landing_progress = (t - 270.0) / 37.0
            self.alt = max(0.0, 120.0 * (1.0 - landing_progress))
            self.speed = max(0.0, 15.5 * (1.0 - landing_progress))

        # Battery: starts at 98%, drains ~0.01% per second
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
# Async Tracking Pipeline: Cache, Queue & Worker
# ─────────────────────────────────────────────

# TRACKING_CACHE: {track_id: {class_name, maritime_cls, confidence, bbox, aisData, status, snapshot_b64, last_seen_frame}}
TRACKING_CACHE: dict[int, dict] = {}
VISUAL_HUD_CACHE: dict[int, dict] = {}  # Separate cache for HUD rendering
analysis_queue: asyncio.Queue | None = None  # initialized per mission
_snapshot_taken: set[int] = set()  # One-shot full-frame snapshot tracker

SNAPSHOT_MAX_WIDTH = 1024  # full-frame snapshot max width (HD)


async def api_worker(ais_service: "DatalasticService", telemetry: "TelemetryState",
                     queue: asyncio.Queue, clip_model, clip_processor, device: str):
    """Background worker: Local CLIP classification + Datalastic AIS enrichment.
    Updates TRACKING_CACHE in-place — zero blocking on main video loop."""
    while True:
        try:
            track_id, maritime_cls, crop_b64, frame_w, frame_h = await queue.get()
        except asyncio.CancelledError:
            break

        try:
            # ────────────────────────────────────────────────
            # STEP 1: Local CLIP Zero-Shot Classification
            # ────────────────────────────────────────────────
            classified_name = maritime_cls  # fallback if CLIP fails

            if crop_b64:
                try:
                    image = Image.open(io.BytesIO(base64.b64decode(crop_b64))).convert("RGB")
                    inputs = clip_processor(
                        text=CLIP_CANDIDATES, images=image,
                        return_tensors="pt", padding=True
                    )
                    # Move tensors to device
                    import torch
                    inputs = {k: v.to(device) if hasattr(v, 'to') else v for k, v in inputs.items()}

                    with torch.no_grad():
                        outputs = clip_model(**inputs)

                    logits = outputs.logits_per_image  # shape: [1, len(CLIP_CANDIDATES)]
                    probs = logits.softmax(dim=-1)
                    best_idx = probs.argmax().item()
                    best_prob = probs[0, best_idx].item()
                    classified_name = CLIP_CANDIDATES[best_idx]
                    print(f"[CLIP] Track #{track_id} → {classified_name} ({best_prob:.1%})")
                except Exception as e:
                    print(f"[CLIP] Classification failed for track #{track_id}: {e}")

            # ────────────────────────────────────────────────
            # STEP 2: Datalastic AIS enrichment
            # ────────────────────────────────────────────────
            telem_snap = telemetry.tick(0, video_time=-1)
            drone_lat, drone_lon, drone_alt = telem_snap["lat"], telem_snap["lon"], telem_snap["alt"]

            cached_entry = TRACKING_CACHE.get(track_id)
            if cached_entry and cached_entry.get("bbox"):
                est_gps = estimate_detection_gps(
                    cached_entry["bbox"], frame_w, frame_h,
                    drone_lat, drone_lon, drone_alt,
                )
            else:
                est_gps = {"lat": drone_lat, "lon": drone_lon}

            # Fetch AIS (works if API key exists; falls back to KKP demo AIS otherwise)
            nearby = await ais_service.fetch_nearby_vessels(est_gps["lat"], est_gps["lon"])
            if nearby:
                best = min(nearby, key=lambda v: (
                    (v["lat"] - est_gps["lat"]) ** 2 + (v["lon"] - est_gps["lon"]) ** 2
                ))
                ais_data = {
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
                ais_data = dict(KKP_FALLBACK_AIS)

            # ── Update cache in-place ──
            if track_id in TRACKING_CACHE:
                TRACKING_CACHE[track_id].update({
                    "class_name": classified_name,
                    "aisData": ais_data,
                    "estimatedGps": est_gps,
                    "status": "ANALYZED",
                })
                print(f"[WORKER] Track #{track_id} → {classified_name} | MMSI: {ais_data.get('mmsi', 'N/A')} ✓")

        except Exception as e:
            print(f"[WORKER] Error processing track #{track_id}: {e}")
            if track_id in TRACKING_CACHE:
                TRACKING_CACHE[track_id]["status"] = "ERROR"
        finally:
            queue.task_done()


# ─────────────────────────────────────────────
# Military HUD renderer (draws from active visuals list)
# ─────────────────────────────────────────────

# Per-class color map (BGR)
_HUD_COLORS: dict[str, tuple[int, int, int]] = {
    "cargo_vessel":    (0, 230, 118),   # green
    "speedboat":       (230, 216, 0),   # cyan-ish
    "patrol_boat":     (0, 180, 255),   # amber
    "person_on_deck":  (80, 127, 255),  # coral
    "floating_debris": (180, 180, 180), # silver
}
_HUD_DEFAULT_COLOR = (200, 200, 200)


def draw_hud_from_cache(frame: np.ndarray, active_visuals: list[dict]) -> np.ndarray:
    """Draw military HUD-style bounding boxes ONLY for objects actively seen THIS frame.
    Pulls enrichment data (class_name, MMSI) from TRACKING_CACHE if ANALYZED."""
    annotated = frame.copy()
    if not active_visuals:
        return annotated

    overlay = annotated.copy()

    for vis in active_visuals:
        track_id = vis["id"]
        x1, y1, x2, y2 = vis["bbox"]
        conf = vis["conf"]
        maritime_cls = vis["maritime_cls"]

        # Pull enrichment from cache
        cache_entry = TRACKING_CACHE.get(track_id, {})
        status = cache_entry.get("status", "PENDING")

        color = _HUD_COLORS.get(maritime_cls, _HUD_DEFAULT_COLOR)
        w, h = x2 - x1, y2 - y1
        bracket_len = max(12, min(w, h) // 4)
        thick = 2

        # ── Semi-transparent fill (20% opacity) ──
        cv2.rectangle(overlay, (x1, y1), (x2, y2), color, -1)

        # ── Corner reticle brackets ──
        cv2.line(annotated, (x1, y1), (x1 + bracket_len, y1), color, thick, cv2.LINE_AA)
        cv2.line(annotated, (x1, y1), (x1, y1 + bracket_len), color, thick, cv2.LINE_AA)
        cv2.line(annotated, (x2, y1), (x2 - bracket_len, y1), color, thick, cv2.LINE_AA)
        cv2.line(annotated, (x2, y1), (x2, y1 + bracket_len), color, thick, cv2.LINE_AA)
        cv2.line(annotated, (x1, y2), (x1 + bracket_len, y2), color, thick, cv2.LINE_AA)
        cv2.line(annotated, (x1, y2), (x1, y2 - bracket_len), color, thick, cv2.LINE_AA)
        cv2.line(annotated, (x2, y2), (x2 - bracket_len, y2), color, thick, cv2.LINE_AA)
        cv2.line(annotated, (x2, y2), (x2, y2 - bracket_len), color, thick, cv2.LINE_AA)

        # ── Alpha blend ──
        cv2.addWeighted(overlay, 0.20, annotated, 0.80, 0, annotated)
        overlay = annotated.copy()

        # ── Label: [ID: N] CLASS | MMSI ──
        if status == "ANALYZED":
            ais = cache_entry.get("aisData", {})
            label = f"[ID:{track_id}] {cache_entry.get('class_name', maritime_cls).upper()} {conf:.0%}"
            mmsi_line = f"MMSI: {ais.get('mmsi', 'N/A')} | {ais.get('vesselName', '')}"
        elif status == "PENDING":
            label = f"[ID:{track_id}] DETECTING... {conf:.0%}"
            mmsi_line = "MMSI: FETCHING..."
        else:
            label = f"[ID:{track_id}] {maritime_cls.upper()} {conf:.0%}"
            mmsi_line = ""

        font = cv2.FONT_HERSHEY_SIMPLEX
        font_scale, font_thick = 0.45, 1
        pad = 4

        (tw, th), _ = cv2.getTextSize(label, font, font_scale, font_thick)
        label_x, label_y = x1, y1 - 6

        lbl_overlay = annotated.copy()
        label_h = th + pad * 2
        if mmsi_line:
            (tw2, th2), _ = cv2.getTextSize(mmsi_line, font, font_scale * 0.85, font_thick)
            label_h += th2 + pad
            tw = max(tw, tw2)

        cv2.rectangle(lbl_overlay,
                      (label_x - 1, label_y - th - pad),
                      (label_x + tw + pad * 2, label_y - th - pad + label_h),
                      (30, 30, 30), -1)
        cv2.addWeighted(lbl_overlay, 0.70, annotated, 0.30, 0, annotated)

        cv2.putText(annotated, label,
                    (label_x + pad, label_y),
                    font, font_scale, (255, 255, 255), font_thick, cv2.LINE_AA)

        if mmsi_line:
            cv2.putText(annotated, mmsi_line,
                        (label_x + pad, label_y + th + pad),
                        font, font_scale * 0.85, (180, 220, 255), font_thick, cv2.LINE_AA)

        cv2.line(annotated,
                 (label_x - 1, label_y - th - pad + label_h),
                 (label_x + tw + pad * 2, label_y - th - pad + label_h),
                 color, 1, cv2.LINE_AA)

    return annotated


# ─────────────────────────────────────────────
def tracking_cache_to_payload(frame_id: int, frame_w: int, frame_h: int) -> dict:
    """Build VISION.ai.raw NATS payload from TRACKING_CACHE.
    Snapshots are full-frame HD images stored at capture time."""
    detections = []

    for track_id, entry in TRACKING_CACHE.items():
        bbox = entry.get("bbox")
        if bbox is None:
            continue

        det: dict = {
            "track_id": track_id,
            "class": entry.get("maritime_cls", "unknown"),
            "confidence": entry.get("confidence", 0.0),
            "bbox": bbox,
            "status": entry.get("status", "PENDING"),
        }

        # AIS data (filled by worker when ANALYZED)
        if entry.get("aisData"):
            det["aisData"] = entry["aisData"]
        if entry.get("estimatedGps"):
            det["estimatedGps"] = entry["estimatedGps"]

        # Full-frame HUD snapshot (stored in cache at capture time)
        # Send exactly ONCE to NATS, then purge from cache to prevent spam
        if entry.get("snapshot_b64"):
            det["snapshot_b64"] = entry["snapshot_b64"]
            entry["snapshot_b64"] = None

        detections.append(det)

    return {
        "camera_id": "drone-cam-pyrhos-x1",
        "frame_id": frame_id,
        "resolution": [frame_w, frame_h],
        "model": f"yolov8-tracking+clip ({YOLO_MODEL})",
        "inference_ms": 0,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "detections": detections,
    }




# ─────────────────────────────────────────────
# Main Loop — Stateful Engine (IDLE / ACTIVE)
# ─────────────────────────────────────────────

async def main():
    import nats
    from nats.errors import ConnectionClosedError, NoServersError

    print("=" * 60)
    print("  LOCALLITIX Virtual Drone Simulator — Stateful Engine")
    print("=" * 60)
    print(f"  Video:     {VIDEO_PATH}")
    print(f"  Model:     {YOLO_MODEL} (conf={YOLO_CONF})")
    print(f"  NATS:      {NATS_URL}")
    print(f"  RTSP Push: {MEDIAMTX_RTSP_URL}")
    print(f"  Drone:     {DRONE_NAME} ({DRONE_TYPE})")
    print("=" * 60)

    # ── Helper: broadcast AI lifecycle status to NATS ──
    async def broadcast_status(nc_conn, status: str, message: str, progress: int = 0):
        """Publish AI lifecycle state to SYSTEM.ai.status for backend gatekeeper."""
        payload = json.dumps({
            "status": status,
            "message": message,
            "progress": progress,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }).encode()
        try:
            await nc_conn.publish("SYSTEM.ai.status", payload)
            print(f"[STATUS] {status} ({progress}%): {message}")
        except Exception as e:
            print(f"[STATUS] Failed to broadcast: {e}")

    # ── Connect to NATS early (needed for status broadcasts during boot) ──
    import nats
    from nats.errors import ConnectionClosedError, NoServersError

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

    # ── Load YOLOv8 with dynamic device selection ──
    await broadcast_status(nc, "BOOTING", "Initializing Engine...", 10)
    import torch
    from ultralytics import YOLO
    device = 'cuda' if torch.cuda.is_available() else 'cpu'
    print(f"[VDRONE] Device: {device.upper()} ({'GPU accelerated' if device == 'cuda' else 'CPU mode'})")
    await broadcast_status(nc, "BOOTING", "Loading YOLOv8 Vision...", 40)
    print(f"[VDRONE] Loading YOLOv8 model: {YOLO_MODEL} ...")
    model = YOLO(YOLO_MODEL).to(device)
    print(f"[VDRONE] YOLO loaded on {device.upper()}. Classes: {len(model.names)}")

    # ── Load CLIP model for zero-shot classification ──
    await broadcast_status(nc, "BOOTING", "Loading CLIP Model (600MB)...", 80)
    from transformers import CLIPProcessor, CLIPModel
    clip_model_name = "openai/clip-vit-base-patch32"
    print(f"[VDRONE] Loading CLIP model: {clip_model_name} ...")
    clip_model = CLIPModel.from_pretrained(clip_model_name).to(device)
    clip_processor = CLIPProcessor.from_pretrained(clip_model_name)
    clip_model.eval()
    print(f"[VDRONE] CLIP loaded on {device.upper()}. Candidates: {CLIP_CANDIDATES}")

    # ── Verify video file exists ──
    if not os.path.exists(VIDEO_PATH):
        print(f"[VDRONE] FATAL: Video file not found: {VIDEO_PATH}")
        sys.exit(1)

    # Probe video dimensions once (needed for FFmpeg)
    probe_cap = cv2.VideoCapture(VIDEO_PATH)
    if not probe_cap.isOpened():
        print(f"[VDRONE] FATAL: Cannot open video: {VIDEO_PATH}")
        sys.exit(1)
    width = int(probe_cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(probe_cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = probe_cap.get(cv2.CAP_PROP_FPS) or 30.0
    total_frames = int(probe_cap.get(cv2.CAP_PROP_FRAME_COUNT))
    probe_cap.release()
    print(f"[VDRONE] Video: {width}x{height} @ {fps:.1f} FPS ({total_frames} frames)")

    frame_interval = 1.0 / fps
    ais_service = DatalasticService()

    if DATALASTIC_API_KEY and not SIMULATE_API_DOWN:
        print(f"[VDRONE] Datalastic AIS enrichment ENABLED (key={DATALASTIC_API_KEY[:8]}...)")
    elif SIMULATE_API_DOWN:
        print("[VDRONE] Datalastic AIS: SIMULATE_API_DOWN=True → using KKP fallback")
    else:
        print("[VDRONE] Datalastic AIS enrichment DISABLED (no DATALASTIC_API_KEY)")

    # ── Process-level shutdown (SIGINT / SIGTERM exits entire process) ──
    process_shutdown = asyncio.Event()

    def signal_handler():
        print("\n[VDRONE] SIGINT/SIGTERM — exiting process...")
        process_shutdown.set()

    loop = asyncio.get_event_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, signal_handler)

    # ── State Machine Events ──
    start_event = asyncio.Event()   # Set when COMMAND.drone.start received
    stop_event = asyncio.Event()    # Set when COMMAND.drone.stop received
    engine_active = False           # True while processing loop is running

    async def handle_start_command(msg):
        nonlocal engine_active
        if engine_active:
            print("[VDRONE] ⚠️ Engine already ACTIVE — ignoring duplicate start command")
            return
        print("[VDRONE] 🟢 COMMAND.drone.start received — launching mission...")
        stop_event.clear()
        start_event.set()

    async def handle_stop_command(msg):
        print("[VDRONE] ⛔ COMMAND.drone.stop received — returning to IDLE...")
        start_event.clear()
        stop_event.set()

    await nc.subscribe("COMMAND.drone.start", cb=handle_start_command)
    await nc.subscribe("COMMAND.drone.stop", cb=handle_stop_command)
    print("[VDRONE] Subscribed to COMMAND.drone.start / COMMAND.drone.stop")

    # ══════════════════════════════════════════════
    #  OUTER LOOP: IDLE → wait for start → ACTIVE → back to IDLE
    # ══════════════════════════════════════════════

    try:
        while not process_shutdown.is_set():
            # ── IDLE STATE ──
            await broadcast_status(nc, "IDLE", "System Ready for Mission", 100)
            print("\n[VDRONE] 💤 Engine IDLE — waiting for COMMAND.drone.start ...")
            start_event.clear()
            stop_event.clear()

            # Wait for either start command or process shutdown
            while not process_shutdown.is_set() and not start_event.is_set():
                await asyncio.sleep(0.25)

            if process_shutdown.is_set():
                break

            # ── TRANSITION TO ACTIVE ──
            engine_active = True
            await broadcast_status(nc, "ACTIVE", "Mission in Progress", 100)
            print("[VDRONE] 🚀 Transitioning to ACTIVE state...")

            # Start FFmpeg FIRST so HLS player can buffer
            ffmpeg_proc = start_ffmpeg(width, height, fps)
            print(f"[VDRONE] FFmpeg started (PID: {ffmpeg_proc.pid})")

            # Warmup: give FFmpeg + HLS player 3.5s to buffer before sending telemetry/video
            print("[VDRONE] ⏳ Warming up pipeline (3.5s) — syncing video + telemetry...")
            await asyncio.sleep(3.5)

            # Reset all state for a fresh mission
            telemetry = TelemetryState()
            TRACKING_CACHE.clear()
            VISUAL_HUD_CACHE.clear()
            _snapshot_taken.clear()
            frame_id = 0
            total_detections = 0
            last_nats_publish = 0.0
            last_telemetry_publish = 0.0

            # Create fresh analysis queue and start background api_worker
            mission_queue = asyncio.Queue()
            worker_task = asyncio.create_task(
                api_worker(ais_service, telemetry, mission_queue,
                           clip_model, clip_processor, device)
            )

            # Open video from frame 0
            cap = cv2.VideoCapture(VIDEO_PATH)
            if not cap.isOpened():
                print(f"[VDRONE] ERROR: Cannot open video: {VIDEO_PATH}")
                engine_active = False
                continue  # back to IDLE

            print(f"[VDRONE] ▶ ACTIVE — processing {total_frames} frames at {fps:.1f} fps...")

            # ── ACTIVE PROCESSING LOOP ──
            try:
                while not process_shutdown.is_set() and not stop_event.is_set():
                    t_start = time.monotonic()

                    # Read frame — on EOF, send final telemetry and return to IDLE
                    ret, frame = cap.read()
                    if not ret:
                        print("[VDRONE] Video ended — broadcasting final landing telemetry...")
                        final_telem = telemetry.tick(0, video_time=TelemetryState.VIDEO_DURATION)
                        final_telem["alt"] = 0.0
                        final_telem["spd"] = 0.0
                        try:
                            data = json.dumps(final_telem).encode()
                            await js.publish("TELEMETRY.drone.live", data)
                            print("[VDRONE] ✓ Final telemetry sent (alt=0.0, spd=0.0)")
                        except Exception as e:
                            print(f"[VDRONE] NATS final telemetry error: {e}")
                        break  # → back to IDLE

                    frame_id += 1
                    video_time = frame_id / fps

                    # ── YOLOv8 Tracking (model.track with persistent IDs) ──
                    t_inf = time.monotonic()
                    results = model.track(frame, persist=True, conf=YOLO_CONF, verbose=False)
                    inference_ms = round((time.monotonic() - t_inf) * 1000, 1)

                    # ── Process tracked objects → ACTIVE_VISUALS_THIS_FRAME ──
                    active_visuals: list[dict] = []
                    processed_centers: list[tuple[float, float]] = []
                    if results and len(results) > 0 and results[0].boxes is not None:
                        boxes = results[0].boxes
                        track_ids = boxes.id
                        if track_ids is not None:
                            for i in range(len(boxes)):
                                x1, y1, x2, y2 = [int(v) for v in boxes.xyxy[i].tolist()]

                                # Spatial dedup: skip if center is within 20px of an already-processed box
                                cx, cy = (x1 + x2) / 2.0, (y1 + y2) / 2.0
                                is_dup = False
                                for pc in processed_centers:
                                    if abs(cx - pc[0]) < 20 and abs(cy - pc[1]) < 20:
                                        is_dup = True
                                        break
                                if is_dup:
                                    continue
                                processed_centers.append((cx, cy))

                                tid = int(track_ids[i].item())
                                cls_id = int(boxes.cls[i].item())
                                cls_name = results[0].names.get(cls_id, "unknown")
                                conf = float(boxes.conf[i].item())
                                maritime_cls = COCO_TO_MARITIME.get(cls_name, cls_name)

                                if tid not in TRACKING_CACHE:
                                    # New tracked object — crop for CLIP (not stored as snapshot)
                                    crop_b64 = ""
                                    try:
                                        crop_img = frame[max(0, y1):y2, max(0, x1):x2]
                                        ch, cw = crop_img.shape[:2]
                                        if cw > 320:  # CLIP crop max (keep small for inference)
                                            scale = 320 / cw
                                            crop_img = cv2.resize(crop_img, (320, int(ch * scale)))
                                        _, buf = cv2.imencode('.jpg', crop_img, [cv2.IMWRITE_JPEG_QUALITY, 70])
                                        crop_b64 = base64.b64encode(buf.tobytes()).decode('ascii')
                                    except Exception:
                                        pass

                                    TRACKING_CACHE[tid] = {
                                        "class_name": "Detecting...",
                                        "maritime_cls": maritime_cls,
                                        "confidence": round(conf, 4),
                                        "bbox": [x1, y1, x2, y2],
                                        "aisData": None,
                                        "estimatedGps": None,
                                        "status": "PENDING",
                                        "last_seen_frame": frame_id,
                                    }
                                    mission_queue.put_nowait((tid, maritime_cls, crop_b64, width, height))
                                    print(f"[TRACK] New object #{tid} ({maritime_cls}) — queued for CLIP")
                                else:
                                    # Known object — update bbox + confidence
                                    TRACKING_CACHE[tid]["bbox"] = [x1, y1, x2, y2]
                                    TRACKING_CACHE[tid]["confidence"] = round(conf, 4)
                                    TRACKING_CACHE[tid]["last_seen_frame"] = frame_id

                                # Build active visuals for THIS frame only
                                active_visuals.append({
                                    "id": tid,
                                    "bbox": [x1, y1, x2, y2],
                                    "conf": conf,
                                    "maritime_cls": maritime_cls,
                                })

                    # ── Garbage collect stale objects (not seen for 15+ frames) ──
                    stale_ids = [tid for tid, entry in TRACKING_CACHE.items()
                                 if frame_id - entry.get("last_seen_frame", frame_id) > 15]
                    for tid in stale_ids:
                        del TRACKING_CACHE[tid]
                        VISUAL_HUD_CACHE.pop(tid, None)

                    # ── Draw HUD strictly from active visuals (NO ghost boxes) ──
                    annotated = draw_hud_from_cache(frame, active_visuals)

                    # ── One-shot full-frame HD snapshot for NEW track IDs ──
                    for vis in active_visuals:
                        tid = vis["id"]
                        if tid not in _snapshot_taken:
                            try:
                                h_frame, w_frame = annotated.shape[:2]
                                scale = SNAPSHOT_MAX_WIDTH / w_frame
                                resized = cv2.resize(annotated, (SNAPSHOT_MAX_WIDTH, int(h_frame * scale)))
                                _, buf = cv2.imencode('.jpg', resized, [cv2.IMWRITE_JPEG_QUALITY, 70])
                                snap_b64 = base64.b64encode(buf.tobytes()).decode('ascii')
                                if tid in TRACKING_CACHE:
                                    TRACKING_CACHE[tid]["snapshot_b64"] = snap_b64
                                _snapshot_taken.add(tid)
                                print(f"[SNAP] Full-frame HD snapshot taken for track #{tid}")
                            except Exception:
                                pass

                    # ── Pipe to FFmpeg (RTSP) ──
                    try:
                        ffmpeg_proc.stdin.write(annotated.tobytes())
                    except BrokenPipeError:
                        print("[VDRONE] FFmpeg pipe broken, restarting...")
                        ffmpeg_proc = start_ffmpeg(width, height, fps)

                    # ── Publish detections to NATS (from TRACKING_CACHE) ──
                    now = time.monotonic()
                    if now - last_nats_publish >= PUBLISH_INTERVAL:
                        payload = tracking_cache_to_payload(frame_id, width, height)
                        payload["inference_ms"] = inference_ms
                        telem_snap = telemetry.tick(0, video_time=video_time)
                        payload["telemetry"] = telem_snap

                        det_count = len(payload["detections"])
                        total_detections += det_count

                        try:
                            data = json.dumps(payload).encode()
                            await js.publish("VISION.ai.raw", data)
                        except Exception as e:
                            print(f"[VDRONE] NATS vision publish error: {e}")

                        last_nats_publish = now

                    # ── Publish telemetry ──
                    if now - last_telemetry_publish >= 1.0:
                        telem = telemetry.tick(1.0, video_time=video_time)
                        try:
                            data = json.dumps(telem).encode()
                            await js.publish("TELEMETRY.drone.live", data)
                        except Exception as e:
                            print(f"[VDRONE] NATS telemetry publish error: {e}")
                        last_telemetry_publish = now

                    # ── Progress logging ──
                    if frame_id % 100 == 0:
                        tracked_count = len(TRACKING_CACHE)
                        analyzed = sum(1 for e in TRACKING_CACHE.values() if e.get('status') == 'ANALYZED')
                        print(
                            f"[VDRONE] Frame #{frame_id} | "
                            f"t={video_time:.1f}s | "
                            f"Alt: {telemetry.alt:.1f}m | "
                            f"Inference: {inference_ms}ms | "
                            f"Tracked: {tracked_count} ({analyzed} analyzed)"
                        )

                    # ── Frame pacing ──
                    elapsed = time.monotonic() - t_start
                    sleep_time = max(0, frame_interval - elapsed)
                    if sleep_time > 0:
                        await asyncio.sleep(sleep_time)

            finally:
                # ── Cleanup ACTIVE resources (return to IDLE) ──
                engine_active = False

                # Cancel the background api_worker
                worker_task.cancel()
                try:
                    await worker_task
                except asyncio.CancelledError:
                    pass
                print(f"[VDRONE] Mission ended: {frame_id} frames, {len(TRACKING_CACHE)} tracked objects")

                # If stopped via COMMAND.drone.stop, send final zero-altitude telemetry
                if stop_event.is_set():
                    final_telem = telemetry.tick(0, video_time=TelemetryState.VIDEO_DURATION)
                    final_telem["alt"] = 0.0
                    final_telem["spd"] = 0.0
                    try:
                        data = json.dumps(final_telem).encode()
                        await js.publish("TELEMETRY.drone.live", data)
                        print("[VDRONE] ✓ Final telemetry sent (alt=0.0, spd=0.0)")
                    except Exception:
                        pass

                # Release video and FFmpeg
                cap.release()
                if ffmpeg_proc.stdin:
                    ffmpeg_proc.stdin.close()
                try:
                    ffmpeg_proc.wait(timeout=5)
                except Exception:
                    ffmpeg_proc.kill()

                print("[VDRONE] Resources released — returning to IDLE")

    finally:
        await ais_service.close()
        await nc.drain()
        print("[VDRONE] Clean shutdown complete. Goodbye!")


if __name__ == "__main__":
    asyncio.run(main())

