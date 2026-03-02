#!/usr/bin/env python3
"""
Mock YOLOv8 AI Vision Worker
============================
Simulates a YOLOv8 inference engine watching drone camera feeds.
Publishes bounding box detections to NATS JetStream on the
VISION.ai.raw subject every 1-2 seconds.

This worker connects to the VISION_STREAM (created by the Go core API)
and publishes realistic detection payloads mimicking real object detection output.
"""

import asyncio
import json
import os
import random
import signal
import sys
from datetime import datetime, timezone

import nats
from nats.errors import ConnectionClosedError, NoServersError


# ─────────────────────────────────────────────
# Detection class definitions (YOLOv8 style)
# ─────────────────────────────────────────────

DETECTION_CLASSES = [
    # Maritime objects
    {"class": "illegal_fishing_vessel", "weight": 0.25, "conf_range": (0.82, 0.99)},
    {"class": "cargo_vessel", "weight": 0.15, "conf_range": (0.88, 0.97)},
    {"class": "patrol_boat", "weight": 0.10, "conf_range": (0.90, 0.99)},
    {"class": "speedboat", "weight": 0.12, "conf_range": (0.75, 0.95)},
    {"class": "fishing_net", "weight": 0.08, "conf_range": (0.70, 0.92)},
    # Hull / markings
    {"class": "hull_number", "weight": 0.07, "conf_range": (0.85, 0.98)},
    {"class": "vessel_name_plate", "weight": 0.05, "conf_range": (0.80, 0.96)},
    # Environmental
    {"class": "oil_spill", "weight": 0.04, "conf_range": (0.72, 0.90)},
    {"class": "floating_debris", "weight": 0.06, "conf_range": (0.65, 0.88)},
    # People
    {"class": "person_on_deck", "weight": 0.05, "conf_range": (0.78, 0.96)},
    {"class": "swimmer_in_water", "weight": 0.03, "conf_range": (0.60, 0.85)},
]

CAMERA_IDS = [
    "drone-cam-pyrhos-x1",
    "drone-cam-ar2-001",
    "drone-cam-pyrhos-x2",
    "drone-cam-hex-001",
    "drone-cam-vtol-001",
]

# Frame dimensions (simulated 1920x1080 HD feed)
FRAME_W = 1920
FRAME_H = 1080


def weighted_random_class() -> dict:
    """Select a detection class using weighted probability."""
    total = sum(c["weight"] for c in DETECTION_CLASSES)
    r = random.uniform(0, total)
    cumulative = 0
    for cls in DETECTION_CLASSES:
        cumulative += cls["weight"]
        if r <= cumulative:
            return cls
    return DETECTION_CLASSES[0]


def generate_bbox() -> list[int]:
    """Generate a realistic bounding box [x_min, y_min, x_max, y_max]."""
    w = random.randint(40, 400)
    h = random.randint(30, 350)
    x_min = random.randint(0, FRAME_W - w)
    y_min = random.randint(0, FRAME_H - h)
    return [x_min, y_min, x_min + w, y_min + h]


def generate_detection() -> dict:
    """Generate a single YOLOv8-style detection result."""
    cls = weighted_random_class()
    conf_lo, conf_hi = cls["conf_range"]
    return {
        "class": cls["class"],
        "confidence": round(random.uniform(conf_lo, conf_hi), 4),
        "bbox": generate_bbox(),
    }


def generate_payload() -> dict:
    """Generate a full detection frame payload."""
    camera_id = random.choice(CAMERA_IDS)
    num_detections = random.choices(
        population=[0, 1, 2, 3, 4, 5],
        weights=[0.05, 0.30, 0.30, 0.20, 0.10, 0.05],
        k=1,
    )[0]

    detections = [generate_detection() for _ in range(num_detections)]

    return {
        "camera_id": camera_id,
        "frame_id": random.randint(100000, 999999),
        "resolution": [FRAME_W, FRAME_H],
        "model": "yolov8x-maritime-v2",
        "inference_ms": round(random.uniform(12.0, 45.0), 1),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "detections": detections,
    }


async def main():
    nats_url = os.getenv("NATS_URL", "nats://locallitix-backbone:4222")
    subject = "VISION.ai.raw"

    print(f"[AI-VISION] Mock YOLOv8 Worker starting...")
    print(f"[AI-VISION] NATS: {nats_url}")
    print(f"[AI-VISION] Subject: {subject}")
    print(f"[AI-VISION] Detection classes: {len(DETECTION_CLASSES)}")
    print(f"[AI-VISION] Camera feeds: {len(CAMERA_IDS)}")

    # Connect with retry
    nc = None
    for attempt in range(1, 31):
        try:
            nc = await nats.connect(nats_url)
            print(f"[AI-VISION] Connected to NATS on attempt {attempt}")
            break
        except (ConnectionClosedError, NoServersError, OSError) as e:
            print(f"[AI-VISION] NATS connection attempt {attempt}/30 failed: {e}")
            await asyncio.sleep(2)

    if nc is None:
        print("[AI-VISION] FATAL: Could not connect to NATS after 30 attempts")
        sys.exit(1)

    # Get JetStream context
    js = nc.jetstream()

    # Graceful shutdown
    shutdown = asyncio.Event()

    def signal_handler():
        print("\n[AI-VISION] Shutting down...")
        shutdown.set()

    loop = asyncio.get_event_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, signal_handler)

    total_published = 0
    total_detections = 0

    print(f"[AI-VISION] Publishing detections to {subject}...")

    try:
        while not shutdown.is_set():
            payload = generate_payload()
            data = json.dumps(payload).encode()

            try:
                ack = await js.publish(subject, data)
                total_published += 1
                det_count = len(payload["detections"])
                total_detections += det_count

                if total_published % 10 == 0:
                    print(
                        f"[AI-VISION] Published {total_published} frames "
                        f"({total_detections} total detections) | "
                        f"Last: {payload['camera_id']} → {det_count} objects "
                        f"[stream={ack.stream}, seq={ack.seq}]"
                    )
            except Exception as e:
                print(f"[AI-VISION] Publish error: {e}")

            # Sleep 1-2 seconds between frames
            delay = random.uniform(1.0, 2.0)
            try:
                await asyncio.wait_for(shutdown.wait(), timeout=delay)
                break  # shutdown was set
            except asyncio.TimeoutError:
                pass  # continue publishing

    finally:
        print(
            f"\n[AI-VISION] Summary: {total_published} frames, "
            f"{total_detections} detections published"
        )
        await nc.drain()
        print("[AI-VISION] Disconnected from NATS. Goodbye!")


if __name__ == "__main__":
    asyncio.run(main())
