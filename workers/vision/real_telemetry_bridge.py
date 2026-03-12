#!/usr/bin/env python3
"""
real_telemetry_bridge.py
=========================
MAVLink -> NATS telemetry bridge for live drone operations.

Reads real drone telemetry via MAVLink (UDP/TCP/Serial from GCS or Herelink)
and publishes to NATS **TELEMETRY.drone.live** using the EXACT schema expected
by the Go backend's DroneIngestor (workers/ingestor/drone.go).

Required JSON schema (must match DroneIngestor struct):
    {
        "mission_id":  str,
        "asset_id":    str,
        "flight_id":   str,
        "drone_name":  str,
        "drone_type":  str,
        "battery":     float,          # percent (0-100)
        "alt":         float,          # metres AGL
        "spd":         float,          # m/s groundspeed
        "dist":        float,          # distance from home (m)
        "sig":         float,          # link quality (0-100)
        "gps_sats":    int,
        "lat":         float,          # decimal degrees
        "lon":         float,
    }

Environment Variables:
    MAVLINK_URL           -- MAVLink connection string (default: udp:0.0.0.0:14550)
                            Examples:
                              UDP listener  : udp:0.0.0.0:14550   (GCS pushes here)
                              UDP initiator : udpout:192.168.1.10:14550
                              TCP initiator : tcp:192.168.1.10:5760
                              Serial        : /dev/ttyAMA0,57600
    NATS_URL              -- NATS broker (default: nats://locallitix-backbone:4222)
    PUBLISH_HZ            -- Publish rate 1-10 Hz (default: 5)
    MAVLINK_HOME_LAT      -- Home latitude (for distance calc, default: 0.0)
    MAVLINK_HOME_LON      -- Home longitude (default: 0.0)
    DRONE_ASSET_ID        -- e.g. PYRHOS-X1
    DRONE_NAME            -- Display name
    DRONE_TYPE            -- e.g. Fixed Wing, Multirotor
    MISSION_ID            -- e.g. MSN-LIVE-001
    FLIGHT_ID             -- e.g. FLT-LIVE-001
"""

import asyncio
import json
import math
import os
import signal
import sys
import time
from datetime import datetime, timezone

# ── Configuration ─────────────────────────────────────────────────────────────

MAVLINK_URL    = os.getenv("MAVLINK_URL",    "udp:0.0.0.0:14550")
NATS_URL       = os.getenv("NATS_URL",       "nats://locallitix-backbone:4222")
PUBLISH_HZ     = max(1, min(10, int(os.getenv("PUBLISH_HZ", "5"))))
PUBLISH_INTV   = 1.0 / PUBLISH_HZ

HOME_LAT       = float(os.getenv("MAVLINK_HOME_LAT", "0.0"))
HOME_LON       = float(os.getenv("MAVLINK_HOME_LON", "0.0"))

DRONE_ASSET_ID = os.getenv("DRONE_ASSET_ID", "PYRHOS-X1")
DRONE_NAME     = os.getenv("DRONE_NAME",     "Real Drone")
DRONE_TYPE     = os.getenv("DRONE_TYPE",     "Real")
MISSION_ID     = os.getenv("MISSION_ID",     "MSN-LIVE-001")
FLIGHT_ID      = os.getenv("FLIGHT_ID",      "FLT-LIVE-001")

# ── CORRECT NATS subject — matches Go backend DroneIngestor ──────────────────
NATS_SUBJECT   = "TELEMETRY.drone.live"


# ── State ─────────────────────────────────────────────────────────────────────

class TelemetrySnapshot:
    """Holds the latest values extracted from MAVLink messages."""

    def __init__(self):
        self.lat:        float = 0.0
        self.lon:        float = 0.0
        self.alt:        float = 0.0   # metres AGL (relative_alt from GLOBAL_POSITION_INT)
        self.heading:    float = 0.0   # degrees 0-359
        self.speed:      float = 0.0   # m/s groundspeed
        self.battery:    float = -1.0  # percent
        self.gps_sats:   int   = 0
        self.sig:        float = 99.0  # link quality — hardcoded for real drone
        self.ready:      bool  = False  # True once first GPS fix received

    def dist_from_home(self) -> float:
        """Haversine distance (metres) from home point."""
        if HOME_LAT == 0.0 and HOME_LON == 0.0:
            return 0.0
        R = 6371000.0
        lat1, lat2 = math.radians(HOME_LAT), math.radians(self.lat)
        dlat = math.radians(self.lat - HOME_LAT)
        dlon = math.radians(self.lon - HOME_LON)
        a = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
        return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    def to_payload(self) -> dict:
        """Returns the exact JSON schema expected by DroneIngestor."""
        return {
            "mission_id":  MISSION_ID,
            "asset_id":    DRONE_ASSET_ID,
            "flight_id":   FLIGHT_ID,
            "drone_name":  DRONE_NAME,
            "drone_type":  DRONE_TYPE,
            "battery":     round(self.battery, 1),
            "alt":         round(self.alt, 1),
            "spd":         round(self.speed, 1),
            "dist":        round(self.dist_from_home()),
            "sig":         self.sig,
            "gps_sats":    self.gps_sats,
            "lat":         round(self.lat, 6),
            "lon":         round(self.lon, 6),
        }


# ── MAVLink reader thread ─────────────────────────────────────────────────────

def mavlink_reader_thread(snap: TelemetrySnapshot, stop_flag: list):
    """
    Blocking MAVLink read loop.
    Runs in asyncio.get_event_loop().run_in_executor() (separate OS thread).
    Updates `snap` in-place as messages arrive.
    """
    try:
        from pymavlink import mavutil
    except ImportError:
        print("[BRIDGE] FATAL: pymavlink not installed — run: pip install pymavlink")
        stop_flag[0] = True
        return

    print(f"[BRIDGE] Connecting to MAVLink: {MAVLINK_URL}")
    try:
        mav = mavutil.mavlink_connection(MAVLINK_URL, autoreconnect=True, source_system=255)
    except Exception as e:
        print(f"[BRIDGE] FATAL: Cannot open MAVLink connection: {e}")
        stop_flag[0] = True
        return

    # Wait for first heartbeat
    print("[BRIDGE] Waiting for MAVLink HEARTBEAT...")
    while not stop_flag[0]:
        hb = mav.recv_match(type="HEARTBEAT", blocking=True, timeout=5)
        if hb:
            print(f"[BRIDGE] HEARTBEAT received — "
                  f"sysid={hb.get_srcSystem()} autopilot={hb.autopilot}")
            break
        print("[BRIDGE] No heartbeat yet, retrying...")

    if stop_flag[0]:
        return

    # Request all data streams at 10 Hz from vehicle (ArduPilot / PX4)
    try:
        mav.mav.request_data_stream_send(
            mav.target_system, mav.target_component,
            mavutil.mavlink.MAV_DATA_STREAM_ALL,
            10, 1,
        )
    except Exception as e:
        print(f"[BRIDGE] WARNING: Could not request data stream: {e}")

    print("[BRIDGE] MAVLink link active — streaming telemetry...")

    while not stop_flag[0]:
        try:
            msg = mav.recv_match(
                type=["GLOBAL_POSITION_INT", "SYS_STATUS", "VFR_HUD", "GPS_RAW_INT"],
                blocking=True,
                timeout=1.0,
            )
            if msg is None:
                continue

            t = msg.get_type()

            if t == "GLOBAL_POSITION_INT":
                snap.lat     = msg.lat / 1e7
                snap.lon     = msg.lon / 1e7
                snap.alt     = msg.relative_alt / 1000.0   # mm -> m
                snap.heading = msg.hdg / 100.0              # cdeg -> deg
                snap.ready   = True

            elif t == "VFR_HUD":
                snap.speed = msg.groundspeed

            elif t == "SYS_STATUS":
                snap.battery  = float(msg.battery_remaining)
                link_errors   = msg.errors_comm
                # Infer signal quality: 99 if no errors, else degrade
                snap.sig = max(50.0, 99.0 - link_errors * 0.1)

            elif t == "GPS_RAW_INT":
                snap.gps_sats = msg.satellites_visible

        except Exception as e:
            print(f"[BRIDGE] MAVLink read error: {e}")
            time.sleep(0.1)

    print("[BRIDGE] MAVLink reader thread exiting.")


# ── Main async loop ───────────────────────────────────────────────────────────

async def main():
    print("=" * 60)
    print("  LOCALLITIX MAVLink -> NATS Telemetry Bridge")
    print("=" * 60)
    print(f"  MAVLink   : {MAVLINK_URL}")
    print(f"  NATS      : {NATS_URL}")
    print(f"  Subject   : {NATS_SUBJECT}")   # always TELEMETRY.drone.live
    print(f"  Rate      : {PUBLISH_HZ} Hz")
    print(f"  Asset     : {DRONE_ASSET_ID} / {DRONE_NAME} / {DRONE_TYPE}")
    print(f"  Mission   : {MISSION_ID} / {FLIGHT_ID}")
    print("=" * 60)

    try:
        import nats
        from nats.errors import ConnectionClosedError, NoServersError
    except ImportError:
        print("[BRIDGE] FATAL: nats-py not installed — run: pip install nats-py")
        sys.exit(1)

    # Connect to NATS with retry
    nc = None
    for attempt in range(1, 31):
        try:
            nc = await nats.connect(NATS_URL)
            print(f"[BRIDGE] Connected to NATS on attempt {attempt}")
            break
        except (ConnectionClosedError, NoServersError, OSError) as e:
            print(f"[BRIDGE] NATS attempt {attempt}/30: {e}")
            await asyncio.sleep(2)

    if nc is None:
        print("[BRIDGE] FATAL: Could not connect to NATS after 30 attempts")
        sys.exit(1)

    js = nc.jetstream()

    # Shutdown event
    shutdown = asyncio.Event()
    loop = asyncio.get_event_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, shutdown.set)

    # Start MAVLink reader in background thread
    snap      = TelemetrySnapshot()
    stop_flag = [False]
    mavlink_future = loop.run_in_executor(None, mavlink_reader_thread, snap, stop_flag)

    print("[BRIDGE] MAVLink reader started. Waiting for first GPS fix...")

    frames_published = 0
    last_publish     = 0.0

    try:
        while not shutdown.is_set():
            now = time.monotonic()

            if not snap.ready:
                await asyncio.sleep(0.5)
                continue

            if now - last_publish >= PUBLISH_INTV:
                payload = snap.to_payload()

                # ── LOUD LOGGING as requested ──────────────────────────────
                print(f"[BRIDGE] --> NATS ({NATS_SUBJECT}): {json.dumps(payload)}")

                try:
                    await js.publish(NATS_SUBJECT, json.dumps(payload).encode())
                    frames_published += 1

                    if frames_published % (PUBLISH_HZ * 10) == 0:
                        # Once every 10 seconds — summary log
                        print(f"[BRIDGE] tick={frames_published} | "
                              f"lat={snap.lat:.5f} lon={snap.lon:.5f} "
                              f"alt={snap.alt:.1f}m bat={snap.battery:.0f}% "
                              f"hdg={snap.heading:.0f} spd={snap.speed:.1f}m/s")
                except Exception as e:
                    print(f"[BRIDGE] NATS publish error: {e}")

                last_publish = now

            await asyncio.sleep(0.01)

    finally:
        print("[BRIDGE] Shutting down...")
        stop_flag[0] = True
        try:
            await asyncio.wait_for(asyncio.wrap_future(mavlink_future), timeout=3.0)
        except (asyncio.TimeoutError, Exception):
            pass
        await nc.drain()
        print(f"[BRIDGE] Goodbye. Published {frames_published} telemetry frames.")


if __name__ == "__main__":
    asyncio.run(main())
