#!/usr/bin/env python3
"""
real_telemetry_bridge.py
=========================
MAVLink → NATS telemetry bridge for live drone operations.

Reads real drone telemetry via MAVLink (UDP/TCP/Serial from GCS or Herelink)
and publishes it to NATS in the exact format expected by the LOCALLITIX C4I backend.

Environment Variables:
    MAVLINK_URL       — MAVLink connection string (default: udp:0.0.0.0:14550)
                        Examples:
                          UDP listener  : udp:0.0.0.0:14550   (GCS/Herelink pushes here)
                          UDP initiator : udpout:192.168.1.10:14550
                          TCP initiator : tcp:192.168.1.10:5760
                          Serial        : /dev/ttyAMA0,57600
    NATS_URL          — NATS broker URL (default: nats://locallitix-backbone:4222)
    PUBLISH_HZ        — Telemetry publish rate in Hz, 1–10 (default: 5)
    DRONE_ASSET_ID    — Asset identifier in payloads (default: PYRHOS-X1)
    DRONE_NAME        — Drone display name (default: Real Drone)
    DRONE_TYPE        — Drone type label (default: Real)
    MISSION_ID        — Mission ID string (default: MSN-LIVE-001)
    FLIGHT_ID         — Flight ID string  (default: FLT-LIVE-001)

Publishes to:
    TELEMETRY.drone.live  — same subject as virtual_drone.py so all consumers
                            receive data transparently without any changes.
"""

import asyncio
import json
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

DRONE_ASSET_ID = os.getenv("DRONE_ASSET_ID", "PYRHOS-X1")
DRONE_NAME     = os.getenv("DRONE_NAME",     "Real Drone")
DRONE_TYPE     = os.getenv("DRONE_TYPE",     "Real")
MISSION_ID     = os.getenv("MISSION_ID",     "MSN-LIVE-001")
FLIGHT_ID      = os.getenv("FLIGHT_ID",      "FLT-LIVE-001")

NATS_SUBJECT   = "TELEMETRY.drone.live"

# ── State ─────────────────────────────────────────────────────────────────────

class TelemetrySnapshot:
    """Holds the latest telemetry values extracted from MAVLink messages.
    Thread-safe for asyncio single-thread usage (no locks needed).
    """
    def __init__(self):
        self.lat:      float = 0.0
        self.lon:      float = 0.0
        self.alt:      float = 0.0   # metres above home (relative_alt from GLOBAL_POSITION_INT)
        self.heading:  float = 0.0   # 0-359 degrees
        self.speed:    float = 0.0   # m/s ground speed
        self.battery:  int   = -1    # percent, -1 = unknown
        self.gps_sats: int   = 0
        self.ready:    bool  = False  # True once we have at least one fix

    def to_payload(self) -> dict:
        return {
            # Identity
            "mission_id":  MISSION_ID,
            "asset_id":    DRONE_ASSET_ID,
            "flight_id":   FLIGHT_ID,
            "drone_name":  DRONE_NAME,
            "drone_type":  DRONE_TYPE,
            # Position
            "lat":         round(self.lat, 6),
            "lon":         round(self.lon, 6),
            "alt":         round(self.alt, 1),
            # Movement
            "spd":         round(self.speed, 1),
            "heading":     round(self.heading, 1),
            # System
            "battery":     self.battery,
            "gps_sats":    self.gps_sats,
            "sig":         99,          # RTSP link quality — hardcoded for real drone
            "dist":        0,           # not computed in real mode
            "status":      "LIVE",
            "timestamp":   datetime.now(timezone.utc).isoformat(),
        }


# ── MAVLink reader (runs in executor on separate thread) ──────────────────────

def mavlink_reader_thread(snap: TelemetrySnapshot, stop_flag: list):
    """
    Blocking MAVLink read loop — runs inside asyncio.get_event_loop().run_in_executor().
    Continuously updates `snap` in-place as messages arrive.
    stop_flag[0] = True signals this thread to exit.
    """
    try:
        from pymavlink import mavutil
    except ImportError:
        print("[BRIDGE] FATAL: pymavlink not installed. Run: pip install pymavlink")
        stop_flag[0] = True
        return

    print(f"[BRIDGE] Connecting to MAVLink: {MAVLINK_URL}")
    try:
        mav = mavutil.mavlink_connection(MAVLINK_URL, autoreconnect=True, source_system=255)
    except Exception as e:
        print(f"[BRIDGE] FATAL: Cannot create MAVLink connection: {e}")
        stop_flag[0] = True
        return

    # Wait for first heartbeat (proves connection is alive)
    print("[BRIDGE] Waiting for MAVLink heartbeat...")
    while not stop_flag[0]:
        hb = mav.recv_match(type="HEARTBEAT", blocking=True, timeout=5)
        if hb:
            print(f"[BRIDGE] ✓ Heartbeat received — system {hb.get_srcSystem()}, "
                  f"component {hb.get_srcComponent()}, autopilot {hb.autopilot}")
            break
        print("[BRIDGE] No heartbeat yet — retrying...")

    if stop_flag[0]:
        return

    print("[BRIDGE] MAVLink link established. Streaming telemetry...")

    # Enable message streams (works on ArduPilot/PX4 via MAVLink GCS protocol)
    try:
        mav.mav.request_data_stream_send(
            mav.target_system, mav.target_component,
            mavutil.mavlink.MAV_DATA_STREAM_ALL,
            10,   # 10 Hz from vehicle (we republish at PUBLISH_HZ)
            1,    # start
        )
    except Exception as e:
        print(f"[BRIDGE] WARNING: Could not request data stream: {e} (continuing anyway)")

    while not stop_flag[0]:
        try:
            msg = mav.recv_match(
                type=["GLOBAL_POSITION_INT", "SYS_STATUS", "GPS_RAW_INT", "VFR_HUD"],
                blocking=True,
                timeout=1.0,
            )
            if msg is None:
                continue

            msg_type = msg.get_type()

            if msg_type == "GLOBAL_POSITION_INT":
                # lat/lon in 1e-7 degrees, alt in mm
                snap.lat     = msg.lat     / 1e7
                snap.lon     = msg.lon     / 1e7
                snap.alt     = msg.relative_alt / 1000.0   # mm → metres
                snap.heading = msg.hdg / 100.0             # cdeg → degrees
                snap.ready   = True

            elif msg_type == "VFR_HUD":
                snap.speed   = msg.groundspeed             # m/s

            elif msg_type == "SYS_STATUS":
                # battery_remaining is in percent (0-100), or -1 if unknown
                snap.battery = msg.battery_remaining

            elif msg_type == "GPS_RAW_INT":
                snap.gps_sats = msg.satellites_visible

        except Exception as e:
            print(f"[BRIDGE] MAVLink read error: {e} — continuing")
            time.sleep(0.1)

    print("[BRIDGE] MAVLink reader thread exiting.")


# ── Main async loop ───────────────────────────────────────────────────────────

async def main():
    print("=" * 60)
    print("  LOCALLITIX Real Drone MAVLink → NATS Bridge")
    print("=" * 60)
    print(f"  MAVLink:   {MAVLINK_URL}")
    print(f"  NATS:      {NATS_URL}")
    print(f"  Subject:   {NATS_SUBJECT}")
    print(f"  Rate:      {PUBLISH_HZ} Hz  ({PUBLISH_INTV*1000:.0f} ms interval)")
    print(f"  Asset:     {DRONE_ASSET_ID} / {DRONE_NAME}")
    print("=" * 60)

    try:
        import nats
        from nats.errors import ConnectionClosedError, NoServersError
    except ImportError:
        print("[BRIDGE] FATAL: nats-py not installed. Run: pip install nats-py")
        sys.exit(1)

    # Connect to NATS
    nc = None
    for attempt in range(1, 31):
        try:
            nc = await nats.connect(NATS_URL)
            print(f"[BRIDGE] ✓ Connected to NATS on attempt {attempt}")
            break
        except (ConnectionClosedError, NoServersError, OSError) as e:
            print(f"[BRIDGE] NATS attempt {attempt}/30 failed: {e}")
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

    # MAVLink state + thread
    snap      = TelemetrySnapshot()
    stop_flag = [False]             # mutable container so thread can see updates

    mavlink_task = loop.run_in_executor(
        None, mavlink_reader_thread, snap, stop_flag
    )

    print("[BRIDGE] MAVLink reader started. Waiting for first GPS fix...")

    last_publish = 0.0
    frames_published = 0

    try:
        while not shutdown.is_set():
            now = time.monotonic()

            if not snap.ready:
                # No GPS fix yet — wait quietly
                await asyncio.sleep(0.5)
                continue

            if now - last_publish >= PUBLISH_INTV:
                payload = snap.to_payload()

                try:
                    data = json.dumps(payload).encode()
                    await js.publish(NATS_SUBJECT, data)
                    frames_published += 1

                    if frames_published == 1:
                        print(f"[BRIDGE] ✓ First telemetry published — "
                              f"lat={snap.lat:.6f}, lon={snap.lon:.6f}, "
                              f"alt={snap.alt:.1f}m, hdg={snap.heading:.1f}°")
                    elif frames_published % (PUBLISH_HZ * 30) == 0:
                        # Log every 30 seconds
                        print(f"[BRIDGE] ♦ Streaming — "
                              f"lat={snap.lat:.5f}, lon={snap.lon:.5f}, "
                              f"alt={snap.alt:.1f}m, bat={snap.battery}%, "
                              f"hdg={snap.heading:.0f}°, spd={snap.speed:.1f}m/s")
                except Exception as e:
                    print(f"[BRIDGE] NATS publish error: {e}")

                last_publish = now

            await asyncio.sleep(0.01)  # ~100Hz polling loop — CPU friendly

    finally:
        print("[BRIDGE] Shutting down...")
        stop_flag[0] = True
        try:
            await asyncio.wait_for(asyncio.wrap_future(mavlink_task), timeout=3.0)
        except (asyncio.TimeoutError, Exception):
            pass
        await nc.drain()
        print(f"[BRIDGE] Clean shutdown. Published {frames_published} telemetry frames.")


if __name__ == "__main__":
    asyncio.run(main())
