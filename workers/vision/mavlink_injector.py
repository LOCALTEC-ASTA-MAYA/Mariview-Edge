#!/usr/bin/env python3
"""
mavlink_injector.py
====================
Fake drone MAVLink UDP injector — QA / HITL simulation tool.

Simulates a flying quadrotor over Jakarta by broadcasting HEARTBEAT,
GLOBAL_POSITION_INT, and SYS_STATUS via UDP to 127.0.0.1:14550 at 1 Hz.

Usage:
    pip install pymavlink
    python mavlink_injector.py

Point your real_telemetry_bridge.py at:
    MAVLINK_URL=udp:0.0.0.0:14550
"""

import math
import random
import time

from pymavlink import mavutil

# ── Target (where real_telemetry_bridge.py is listening) ──────────────────────
TARGET = "udpout:127.0.0.1:14550"

# ── Starting position: Monas, Jakarta ─────────────────────────────────────────
BASE_LAT =  -6.1919057
BASE_LON = 106.7368401
BASE_ALT_MM  = 84125     # 84.125 metres
BASE_HEADING = 63213     # 63.213 degrees (cdeg) — northeast

print("=" * 56)
print("  LOCALLITIX MAVLink UDP Injector — Fake Drone (Jakarta)")
print("=" * 56)
print(f"  Target : {TARGET}")
print(f"  Origin : lat={BASE_LAT}, lon={BASE_LON}")
print(f"  Alt    : {BASE_ALT_MM / 1000:.1f} m")
print("  Press Ctrl+C to stop.")
print("=" * 56)

master = mavutil.mavlink_connection(TARGET, source_system=1)

tick        = 0
drift_lat   = 0.0   # accumulated drift in degrees
drift_lon   = 0.0
heading_deg = 63.213  # degrees

try:
    while True:
        tick += 1
        t_ms = int(time.time() * 1000) & 0xFFFFFFFF  # uint32 time_boot_ms

        # ── Drift: small random walk so the dot moves on the map ──────────────
        drift_lat += random.uniform(-0.00002, 0.00002)
        drift_lon += random.uniform(-0.00002, 0.00002)
        heading_deg = (heading_deg + random.uniform(-1.0, 1.5)) % 360
        alt_mm = BASE_ALT_MM + int(random.uniform(-500, 500))  # ±0.5 m noise

        lat_int = int((BASE_LAT + drift_lat) * 1e7)
        lon_int = int((BASE_LON + drift_lon) * 1e7)
        hdg_cdeg = int(heading_deg * 100)  # centidegrees

        # ── 1. HEARTBEAT ──────────────────────────────────────────────────────
        master.mav.heartbeat_send(
            mavutil.mavlink.MAV_TYPE_QUADROTOR,
            mavutil.mavlink.MAV_AUTOPILOT_ARDUPILOTMEGA,
            0,   # base_mode
            0,   # custom_mode
            0,   # system_status
        )

        # ── 2. GLOBAL_POSITION_INT ────────────────────────────────────────────
        master.mav.global_position_int_send(
            t_ms,           # time_boot_ms
            lat_int,        # lat (degE7)
            lon_int,        # lon (degE7)
            alt_mm,         # alt mm above MSL (not used by bridge)
            alt_mm,         # relative_alt mm above home — bridge reads this
            0,              # vx  (cm/s)
            0,              # vy  (cm/s)
            0,              # vz  (cm/s)
            hdg_cdeg,       # hdg (cdeg, 0=north)
        )

        # ── 3. VFR_HUD (gives groundspeed to bridge) ─────────────────────────
        groundspeed = 12.5 + random.uniform(-1.0, 1.0)  # ~12.5 m/s
        master.mav.vfr_hud_send(
            groundspeed,    # airspeed m/s
            groundspeed,    # groundspeed m/s
            int(heading_deg),  # heading deg
            50,             # throttle %
            alt_mm / 1000.0,   # altitude m
            0.0,            # climb m/s
        )

        # ── 4. SYS_STATUS (battery) ───────────────────────────────────────────
        battery = max(0, 88 - tick // 60)  # slowly drains 1% per minute
        master.mav.sys_status_send(
            0,       # onboard_control_sensors_present
            0,       # onboard_control_sensors_enabled
            0,       # onboard_control_sensors_health
            500,     # load (1/10 %)
            11100,   # voltage_battery (mV)
            -1,      # current_battery (cA, -1 = unknown)
            battery, # battery_remaining (%)
            0, 0,    # drop_rate_comm, errors_comm
            0, 0, 0, 0,  # errors_count1-4
        )

        # ── 5. GPS_RAW_INT (satellite count) ─────────────────────────────────
        master.mav.gps_raw_int_send(
            t_ms * 1000,    # time_usec
            3,              # fix_type (3 = 3D fix)
            lat_int,
            lon_int,
            alt_mm,
            65535,          # eph (unknown)
            65535,          # epv (unknown)
            0,              # vel (cm/s)
            0,              # cog (cdeg)
            16,             # satellites_visible
        )

        print(
            f"[INJ] tick={tick:04d} | "
            f"lat={BASE_LAT + drift_lat:.6f} lon={BASE_LON + drift_lon:.6f} | "
            f"alt={alt_mm/1000:.1f}m | hdg={heading_deg:.1f}° | "
            f"spd={groundspeed:.1f}m/s | bat={battery}%"
        )

        time.sleep(1.0)

except KeyboardInterrupt:
    print("\n[INJ] Stopped. Goodbye!")
