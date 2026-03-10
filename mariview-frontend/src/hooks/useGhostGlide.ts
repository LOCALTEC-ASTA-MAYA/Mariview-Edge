/**
 * useGhostGlide — "Ghost Glide" smooth interpolation hook for Deck.gl markers.
 *
 * Strategy:
 *   1. Dead reckoning: continuously extrapolate each entity's position forward in
 *      time using its last known speed + heading.  This way assets keep moving
 *      smoothly on the map even while the backend cache hasn't refreshed yet.
 *   2. Transition blend: when new API data arrives, detect each entity's current
 *      dead-reckoned position and blend it toward the new target over `transitionMs`.
 *   3. Short-angle lerp: heading interpolation always takes the shortest arc, so we
 *      never get the ugly 359→0 reverse-spin.
 *   4. Dynamic poll detection: the hook measures the real interval between data
 *      arrivals and adjusts the transition cap automatically.
 */

import { useEffect, useRef, useState } from 'react';

// ── Math helpers ──────────────────────────────────────────────────────────────

const KM_PER_NM = 1.852;
const DEG_PER_KM_LAT = 1 / 111.32;

function toRad(deg: number): number { return (deg * Math.PI) / 180; }

/**
 * Dead-reckoned lat/lon after `elapsedMs` milliseconds.
 * Speed is in knots; heading is in degrees (0 = North, clockwise).
 */
function deadReckon(
  baseLat: number, baseLon: number,
  speedKnots: number, headingDeg: number,
  elapsedMs: number,
): { lat: number; lon: number } {
  if (speedKnots <= 0 || elapsedMs <= 0) return { lat: baseLat, lon: baseLon };
  const elapsedHours = elapsedMs / 3_600_000;
  const distKm = speedKnots * KM_PER_NM * elapsedHours;
  const hr = toRad(headingDeg);
  const latR = toRad(baseLat);
  const deltaLat = distKm * Math.cos(hr) * DEG_PER_KM_LAT;
  const deltaLon = distKm * Math.sin(hr) / (111.32 * Math.cos(latR));
  return { lat: baseLat + deltaLat, lon: baseLon + deltaLon };
}

/** Interpolate angle via the shortest arc — prevents 359→1° backward spin. */
function shortAngleLerp(from: number, to: number, t: number): number {
  const delta = (((to - from) % 360) + 540) % 360 - 180; // in [-180, 180]
  return from + delta * t;
}

function lerp(a: number, b: number, t: number): number { return a + (b - a) * t; }

/** Smooth cubic ease-in-out. */
function ease(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface GlideOptions<T> {
  /** Stable unique key per entity. MMSI for ships, ICAO24 for aircraft. */
  getId: (item: T) => string;
  getLat: (item: T) => number;   // degrees
  getLon: (item: T) => number;   // degrees
  getHeading: (item: T) => number; // degrees 0-360
  getSpeed: (item: T) => number;   // knots
  /**
   * How long (ms) the blend from old → new position takes when fresh data
   * arrives.  Capped automatically to half the measured poll interval so the
   * animation always finishes before the next data fetch.
   * Default: 5 000 ms.
   */
  transitionMs?: number;
}

interface EntityState<T> {
  item: T;                    // latest raw data item (for non-position props)
  baseLat: number;            // position from last API snapshot
  baseLon: number;
  baseHeading: number;
  speed: number;              // knots
  baseTime: number;           // when snapshot was received (ms epoch)

  // Transition: blend from the DR position at update time → the new base
  transitionFrom: { lat: number; lon: number; heading: number };
  transitionStart: number;
  transitionDuration: number;
}

export type GlideItem<T> = T & {
  _lat: number;
  _lon: number;
  _heading: number;
};

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useGhostGlide<T>(
  data: T[],
  opts: GlideOptions<T>,
): GlideItem<T>[] {
  const { getId, getLat, getLon, getHeading, getSpeed, transitionMs = 5_000 } = opts;

  const statesRef   = useRef(new Map<string, EntityState<T>>());
  const rafRef      = useRef<number | null>(null);
  const lastDataMs  = useRef<number>(0); // ms-epoch of the previous data arrival
  const [output, setOutput] = useState<GlideItem<T>[]>([]);

  // ── Sync incoming data ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!data.length) return;

    const now = Date.now();

    // Measure actual poll interval to cap transition duration sensibly
    const measuredInterval = lastDataMs.current > 0 ? now - lastDataMs.current : Infinity;
    lastDataMs.current = now;
    // Never make the transition longer than half the measured poll interval
    const effectiveTransition = Math.min(transitionMs, measuredInterval / 2);

    const incomingIds = new Set<string>();

    for (const item of data) {
      const id = getId(item);
      incomingIds.add(id);

      const targetLat     = getLat(item);
      const targetLon     = getLon(item);
      const targetHeading = getHeading(item);
      const speed         = Math.max(0, getSpeed(item));

      const existing = statesRef.current.get(id);

      if (!existing) {
        // Brand-new entity — appear immediately with no transition
        statesRef.current.set(id, {
          item,
          baseLat: targetLat, baseLon: targetLon, baseHeading: targetHeading,
          speed, baseTime: now,
          transitionFrom: { lat: targetLat, lon: targetLon, heading: targetHeading },
          transitionStart: now, transitionDuration: 0,
        });
      } else {
        // Entity seen before — compute its current dead-reckoned position
        // so we can blend smoothly from there to the fresh API position.
        const elapsed = now - existing.baseTime;
        const drCurrent = deadReckon(
          existing.baseLat, existing.baseLon,
          existing.speed, existing.baseHeading,
          elapsed,
        );

        // Also carry forward any in-progress transition
        const tPrev = existing.transitionDuration > 0
          ? ease(Math.min(1, (now - existing.transitionStart) / existing.transitionDuration))
          : 1;
        const blendedLat     = lerp(existing.transitionFrom.lat, drCurrent.lat, tPrev);
        const blendedLon     = lerp(existing.transitionFrom.lon, drCurrent.lon, tPrev);
        const blendedHeading = shortAngleLerp(existing.transitionFrom.heading, existing.baseHeading, tPrev);

        statesRef.current.set(id, {
          item,
          baseLat: targetLat, baseLon: targetLon, baseHeading: targetHeading,
          speed, baseTime: now,
          transitionFrom: { lat: blendedLat, lon: blendedLon, heading: blendedHeading },
          transitionStart: now, transitionDuration: effectiveTransition,
        });
      }
    }

    // Remove entities that disappeared from the API response
    for (const id of statesRef.current.keys()) {
      if (!incomingIds.has(id)) statesRef.current.delete(id);
    }
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Animation loop ──────────────────────────────────────────────────────────
  useEffect(() => {
    const animate = () => {
      const now = Date.now();
      const items: GlideItem<T>[] = [];

      for (const state of statesRef.current.values()) {
        const elapsed = now - state.baseTime;

        // 1. Dead-reckoned target for this frame
        const drTarget = deadReckon(
          state.baseLat, state.baseLon,
          state.speed, state.baseHeading,
          elapsed,
        );

        let lat: number, lon: number, heading: number;

        if (state.transitionDuration > 0) {
          const tRaw = Math.min(1, (now - state.transitionStart) / state.transitionDuration);
          const t = ease(tRaw);
          lat     = lerp(state.transitionFrom.lat, drTarget.lat, t);
          lon     = lerp(state.transitionFrom.lon, drTarget.lon, t);
          heading = shortAngleLerp(state.transitionFrom.heading, state.baseHeading, t);
        } else {
          // No transition — pure dead reckoning
          lat     = drTarget.lat;
          lon     = drTarget.lon;
          heading = state.baseHeading;
        }

        items.push({ ...state.item, _lat: lat, _lon: lon, _heading: heading });
      }

      setOutput(items);
      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []); // start once, run for the component lifetime

  return output;
}
