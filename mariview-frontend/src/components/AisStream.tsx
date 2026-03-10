import 'maplibre-gl/dist/maplibre-gl.css';
import { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@apollo/client';
import DeckGL from '@deck.gl/react';
import { ColumnLayer, TextLayer } from '@deck.gl/layers';
import Map from 'react-map-gl/maplibre';
import { Ship, Navigation, Activity, AlertTriangle, RefreshCw, Anchor, Zap, Radio } from 'lucide-react';
import { GET_AIS_VESSELS } from '../graphql/queries';
import { useGhostGlide } from '../hooks/useGhostGlide';

// ── Constants ─────────────────────────────────────────────────────────────────

const INITIAL_VIEW_STATE = {
  longitude: 118.0,
  latitude:  -2.0,
  zoom:       4.2,
  pitch:     65,    // war-table tilt
  bearing:   20,    // slight rotation for depth illusion
  minPitch:   0,
  maxPitch:  80,
};

const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

const TYPE_COLORS: Record<string, [number, number, number, number]> = {
  Cargo:          [ 34, 197,  94, 230],
  Tanker:         [239,  68,  68, 230],
  Passenger:      [ 59, 130, 246, 230],
  Fishing:        [234, 179,   8, 230],
  Tug:            [168,  85, 247, 230],
  Naval:          [  0, 229, 255, 230],
  'Bulk Carrier': [249, 115,  22, 230],
  'Ro-Ro':        [ 20, 184, 166, 230],
};
const DEFAULT_COLOR: [number, number, number, number] = [0, 229, 255, 200];

function getVesselColor(type: string): [number, number, number, number] {
  return TYPE_COLORS[type] ?? DEFAULT_COLOR;
}

function rgbStr(c: [number, number, number, number]) {
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

interface AisVessel {
  id: string; mmsi: string; name: string; type: string;
  position: number[]; speed: number; course: number;
  heading: number; status: string; length: number;
}
interface TooltipInfo { x: number; y: number; vessel: AisVessel; }

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Height of the 3D pillar: fast ships soar, moored ships are stubs. */
function getPillarElevation(d: any): number {
  if (d.status === 'At Anchor' || d.status === 'Moored') return 800;
  return Math.max(2000, (d.speed ?? 0) * 800);
}

/** Floating icon text above the pillar. */
function getPillarIcon(type: string, status: string): string {
  if (status === 'At Anchor' || status === 'Moored') return '⚓';
  if (type === 'Naval')   return '◆';
  if (type === 'Fishing') return '✦';
  return '▲';
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AisStream() {
  const { data, loading, error, refetch } = useQuery(GET_AIS_VESSELS, {
    fetchPolicy: 'cache-and-network',
  });

  const [tooltip, setTooltip] = useState<TooltipInfo | null>(null);
  const vessels: AisVessel[] = data?.getAISVessels ?? [];

  // Ghost Glide: dead-reckoning at 60fps + smooth blend when fresh data arrives.
  // MMSI is the stable AIS identity key.
  const glideVessels = useGhostGlide(vessels, {
    getId:      v => v.mmsi,
    getLat:     v => v.position[0],
    getLon:     v => v.position[1],
    getHeading: v => v.course ?? v.heading ?? 0,
    getSpeed:   v => v.speed ?? 0,
    transitionMs: 6_000,
  });

  const stats = useMemo(() => {
    if (!vessels.length) return { count: 0, underway: 0, anchored: 0, avgSpeed: '0.0', byType: {} as Record<string, number> };
    const underway = vessels.filter(v => v.status === 'Under Way').length;
    const anchored = vessels.filter(v => v.status === 'At Anchor' || v.status === 'Moored').length;
    const avgSpeed = (vessels.reduce((s, v) => s + v.speed, 0) / vessels.length).toFixed(1);
    const byType   = vessels.reduce((acc: Record<string, number>, v) => {
      acc[v.type] = (acc[v.type] ?? 0) + 1; return acc;
    }, {});
    return { count: vessels.length, underway, anchored, avgSpeed, byType };
  }, [vessels]);

  const onHover = useCallback((info: any) => {
    setTooltip(info.object ? { x: info.x, y: info.y, vessel: info.object } : null);
  }, []);

  // ── Layer 1: holographic hexagonal pillars (ColumnLayer) ─────────────────
  const columnLayer = new ColumnLayer({
    id: 'ais-holographic-pillars',
    data: glideVessels,
    getPosition:  (d: any) => [d._lon, d._lat],
    getElevation: getPillarElevation,
    getFillColor: (d: any) => {
      const [r, g, b] = getVesselColor(d.type);
      // Moored/anchored ships: dimmer fill so they don't compete with underway
      const alpha = (d.status === 'At Anchor' || d.status === 'Moored') ? 100 : 200;
      return [r, g, b, alpha];
    },
    getLineColor: (d: any) => {
      const [r, g, b] = getVesselColor(d.type);
      return [r, g, b, 255];   // bright ouline = holographic edge glow
    },
    radius:             1500,
    diskResolution:     6,      // hexagonal = tactical, renders faster than circle
    extruded:           true,
    lineWidthMinPixels: 1,
    stroked:            true,
    pickable:           true,
    onHover,
    elevationScale:     1,
  });

  // ── Layer 2: floating heading arrows above each pillar (TextLayer) ────────
  const arrowLayer = new TextLayer({
    id: 'ais-pillar-arrows',
    data: glideVessels,
    // Position the icon 600m above the pillar top so it crowns the pillar
    getPosition: (d: any) => [d._lon, d._lat, getPillarElevation(d) + 600],
    getText:     (d: any) => getPillarIcon(d.type, d.status),
    getSize:     (d: any) => d.type === 'Tug' ? 12 : 15,
    getColor:    [255, 255, 255, 230],
    getAngle: (d: any) => {
      // Stationary/non-directional icons: no rotation
      if (d.status === 'At Anchor' || d.status === 'Moored') return 0;
      if (d.type === 'Naval' || d.type === 'Fishing') return 0;
      // Moving vessels: rotate ▲ by Ghost Glide short-arc-lerped heading
      return -(d._heading ?? 0);
    },
    getTextAnchor:        'middle',
    getAlignmentBaseline: 'center',
    billboard:            false,     // anchored in 3D world space
    sizeScale:            1,
    parameters: { depthTest: false }, // arrows always visible, never occluded
  });

  const layers = [columnLayer, arrowLayer];

  return (
    <div className="flex flex-col h-full" style={{ background: '#070b14' }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(90deg,#0a0f1e 0%,#0d1628 100%)',
        borderBottom: '1px solid rgba(45,212,191,0.15)',
        padding: '12px 20px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0, gap: 12,
      }}>
        {/* Left: title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            background: 'rgba(45,212,191,0.12)', border: '1px solid rgba(45,212,191,0.3)',
            borderRadius: 8, padding: '6px 8px', display: 'flex',
          }}>
            <Radio style={{ width: 16, height: 16, color: '#2DD4BF' }} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: '#fff', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                AIS Maritime Stream
              </span>
              <span style={{ position: 'relative', display: 'inline-flex' }}>
                <span style={{
                  position: 'absolute', inset: 0, borderRadius: '50%',
                  background: '#22c55e', opacity: 0.4,
                  animation: 'ping 1.5s cubic-bezier(0,0,0.2,1) infinite',
                }} />
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', display: 'block' }} />
              </span>
              <span style={{ fontSize: 10, color: '#22c55e', fontWeight: 700, letterSpacing: '0.12em' }}>LIVE</span>
            </div>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.05em' }}>
              INDONESIAN MARITIME ZONE · 3D HOLOGRAPHIC RADAR · AIS CLASS A/B
            </span>
          </div>
        </div>

        {/* Right: stat chips + refresh */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {loading && (
            <span style={{ fontSize: 10, color: '#facc15', fontWeight: 700, letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Activity style={{ width: 12, height: 12, animation: 'spin 1s linear infinite' }} />SCANNING
            </span>
          )}
          {error && (
            <span style={{ fontSize: 10, color: '#f87171', fontWeight: 700, letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: 4 }}>
              <AlertTriangle style={{ width: 12, height: 12 }} />ERROR
            </span>
          )}
          {[
            { icon: Ship,       label: `${stats.count}`,     sub: 'VESSELS',  color: '#2DD4BF' },
            { icon: Navigation, label: `${stats.underway}`,   sub: 'UNDERWAY', color: '#22c55e' },
            { icon: Anchor,     label: `${stats.anchored}`,   sub: 'ANCHORED', color: '#f59e0b' },
            { icon: Zap,        label: `${stats.avgSpeed}`,   sub: 'AVG KN',   color: '#a78bfa' },
          ].map(({ icon: Icon, label, sub, color }) => (
            <div key={sub} style={{
              background: 'rgba(255,255,255,0.04)', border: `1px solid ${color}30`,
              borderRadius: 8, padding: '5px 10px',
              display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 56,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Icon style={{ width: 10, height: 10, color }} />
                <span style={{ fontSize: 15, fontWeight: 800, color: '#fff', fontVariantNumeric: 'tabular-nums' }}>{label}</span>
              </div>
              <span style={{ fontSize: 8, color, fontWeight: 700, letterSpacing: '0.1em' }}>{sub}</span>
            </div>
          ))}

          <button
            onClick={() => refetch()}
            disabled={loading}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'rgba(45,212,191,0.08)', border: '1px solid rgba(45,212,191,0.25)',
              borderRadius: 8, padding: '6px 12px', color: '#2DD4BF',
              fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.5 : 1, transition: 'all 0.2s', textTransform: 'uppercase',
            }}
          >
            <RefreshCw style={{ width: 12, height: 12 }} />Refresh
          </button>
        </div>
      </div>

      {/* ── Body ─────────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 280px', overflow: 'hidden', minHeight: 0 }}>

        {/* Map */}
        <div style={{ position: 'relative' }}>
          <DeckGL
            initialViewState={INITIAL_VIEW_STATE}
            controller={true}
            layers={layers}
            style={{ position: 'absolute', inset: '0' }}
          >
            <Map mapStyle={MAP_STYLE} />

            {/* Hover tooltip */}
            {tooltip && (
              <div
                className="pointer-events-none"
                style={{ position: 'absolute', left: tooltip.x + 16, top: tooltip.y - 8 }}
              >
                <div style={{
                  background: 'rgba(7,11,20,0.97)', backdropFilter: 'blur(16px)',
                  border: `1px solid ${rgbStr(getVesselColor(tooltip.vessel.type))}50`,
                  borderRadius: 12, padding: '12px 14px', minWidth: 200,
                  boxShadow: `0 0 24px ${rgbStr(getVesselColor(tooltip.vessel.type))}30`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <div style={{
                      width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
                      background: rgbStr(getVesselColor(tooltip.vessel.type)),
                      boxShadow: `0 0 10px ${rgbStr(getVesselColor(tooltip.vessel.type))}`,
                    }} />
                    <span style={{ fontSize: 12, fontWeight: 800, color: '#fff', letterSpacing: '0.05em' }}>
                      {tooltip.vessel.name || 'UNKNOWN VESSEL'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {[
                      { k: 'MMSI',   v: tooltip.vessel.mmsi,                        c: '#94a3b8', mono: true },
                      { k: 'TYPE',   v: tooltip.vessel.type,                         c: rgbStr(getVesselColor(tooltip.vessel.type)) },
                      { k: 'SPEED',  v: `${tooltip.vessel.speed.toFixed(1)} kn`,     c: '#a78bfa', mono: true },
                      { k: 'COURSE', v: `${Math.round(tooltip.vessel.course)}°`,      c: '#94a3b8', mono: true },
                      { k: 'STATUS', v: tooltip.vessel.status,
                        c: tooltip.vessel.status === 'Under Way' ? '#22c55e' : '#f59e0b' },
                      ...(tooltip.vessel.length > 0
                        ? [{ k: 'LENGTH', v: `${Math.round(tooltip.vessel.length)} m`, c: '#94a3b8', mono: true }]
                        : []),
                    ].map(({ k, v, c, mono }) => (
                      <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', fontWeight: 700, letterSpacing: '0.12em' }}>{k}</span>
                        <span style={{ fontSize: 11, color: c, fontWeight: 700, fontFamily: mono ? 'monospace' : undefined }}>{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </DeckGL>

          {/* Pillar height legend — bottom-left */}
          <div style={{
            position: 'absolute', bottom: 20, left: 16, zIndex: 20,
            background: 'rgba(7,11,20,0.90)', backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '10px 12px',
          }}>
            <p style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', fontWeight: 800, letterSpacing: '0.15em', marginBottom: 6, textTransform: 'uppercase' }}>
              Vessel Class
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {Object.entries(TYPE_COLORS).map(([type, color]) => (
                <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <div style={{
                    width: 8, height: 8, borderRadius: 2,
                    background: rgbStr(color), boxShadow: `0 0 6px ${rgbStr(color)}80`, flexShrink: 0,
                  }} />
                  <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.75)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {type}
                  </span>
                </div>
              ))}
            </div>
            <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', margin: '7px 0' }} />
            <p style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', fontWeight: 800, letterSpacing: '0.15em', marginBottom: 5, textTransform: 'uppercase' }}>
              Pillar Height
            </p>
            {[
              { label: 'Fast (&gt;20kn)',  h: 'Tall' },
              { label: 'Slow (&lt;5kn)',   h: 'Medium' },
              { label: 'Moored/Anchor',    h: 'Stub 800m' },
            ].map(({ label, h }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 3 }}>
                <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', fontWeight: 600 }} dangerouslySetInnerHTML={{ __html: label }} />
                <span style={{ fontSize: 9, color: '#2DD4BF', fontWeight: 700 }}>{h}</span>
              </div>
            ))}
          </div>

          {/* Coord tag — bottom-right */}
          <div style={{
            position: 'absolute', bottom: 20, right: 16, zIndex: 20,
            background: 'rgba(7,11,20,0.75)', border: '1px solid rgba(45,212,191,0.15)',
            borderRadius: 8, padding: '6px 10px',
            fontSize: 9, color: '#2DD4BF', fontFamily: 'monospace', fontWeight: 700,
          }}>
            REF: 118.0°E / 2.0°S · INDONESIAN EEZ · 3D
          </div>
        </div>

        {/* ── Sidebar ──────────────────────────────────────────────────────── */}
        <div style={{
          background: 'linear-gradient(180deg,#0a0f1e 0%,#070b14 100%)',
          borderLeft: '1px solid rgba(45,212,191,0.12)',
          display: 'flex', flexDirection: 'column', overflowY: 'auto', gap: 0,
        }}>
          {/* Summary */}
          <div style={{ padding: '16px 16px 10px' }}>
            <p style={{ fontSize: 9, color: '#2DD4BF', fontWeight: 800, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 12 }}>
              Traffic Summary
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { icon: Ship,       label: 'Total Vessels',    value: stats.count,            color: '#2DD4BF', bg: 'rgba(45,212,191,0.08)' },
                { icon: Navigation, label: 'Under Way',        value: stats.underway,          color: '#22c55e', bg: 'rgba(34,197,94,0.08)' },
                { icon: Anchor,     label: 'Anchor/Moored',    value: stats.anchored,          color: '#f59e0b', bg: 'rgba(245,158,11,0.08)' },
                { icon: Zap,        label: 'Avg Speed',        value: `${stats.avgSpeed} kn`,  color: '#a78bfa', bg: 'rgba(167,139,250,0.08)' },
              ].map(({ icon: Icon, label, value, color, bg }) => (
                <div key={label} style={{
                  background: bg, border: `1px solid ${color}20`,
                  borderRadius: 10, padding: '10px 12px',
                  display: 'flex', alignItems: 'center', gap: 12,
                }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 8,
                    background: `${color}15`, border: `1px solid ${color}30`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <Icon style={{ width: 15, height: 15, color }} />
                  </div>
                  <div>
                    <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 1 }}>{label}</p>
                    <p style={{ fontSize: 20, fontWeight: 900, color: '#fff', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ height: 1, background: 'rgba(255,255,255,0.05)', margin: '4px 16px' }} />

          {/* Fleet breakdown */}
          <div style={{ padding: '12px 16px' }}>
            <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', fontWeight: 800, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 10 }}>
              Fleet Breakdown
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {Object.entries(stats.byType)
                .sort((a, b) => b[1] - a[1])
                .map(([type, count]) => {
                  const color = TYPE_COLORS[type] ?? DEFAULT_COLOR;
                  const pct = stats.count > 0 ? Math.round((count / stats.count) * 100) : 0;
                  return (
                    <div key={type}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.6)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{type}</span>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)' }}>{pct}%</span>
                          <span style={{ fontSize: 11, fontWeight: 800, color: '#fff' }}>{count}</span>
                        </div>
                      </div>
                      <div style={{ height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 99 }}>
                        <div style={{
                          height: 3, borderRadius: 99, width: `${pct}%`,
                          background: `linear-gradient(90deg, ${rgbStr(color)}, ${rgbStr(color)}88)`,
                          boxShadow: `0 0 6px ${rgbStr(color)}60`,
                          transition: 'width 0.8s ease',
                        }} />
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          <div style={{ height: 1, background: 'rgba(255,255,255,0.05)', margin: '0 16px' }} />

          {/* Intel notice */}
          <div style={{ padding: '12px 16px' }}>
            <div style={{
              background: 'rgba(45,212,191,0.05)', border: '1px solid rgba(45,212,191,0.2)',
              borderRadius: 10, padding: '10px 12px',
            }}>
              <p style={{ fontSize: 9, color: '#2DD4BF', fontWeight: 800, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 5 }}>
                📡 Intel Notice
              </p>
              <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', lineHeight: 1.6 }}>
                Anomaly detection active · Malacca Strait watchzone enabled · 3 unidentified signals filtered
              </p>
            </div>
          </div>

          {/* Footer */}
          <div style={{
            marginTop: 'auto', padding: '10px 16px',
            borderTop: '1px solid rgba(255,255,255,0.05)',
            display: 'flex', justifyContent: 'space-between',
            fontSize: 9, color: 'rgba(255,255,255,0.25)',
          }}>
            <span>© MARIVIEW C4I</span>
            <span style={{ color: '#2DD4BF', fontWeight: 700 }}>AIS-ENCRYPTED</span>
          </div>
        </div>
      </div>

      {/* Global keyframes */}
      <style>{`
        @keyframes ping  { 75%, 100% { transform: scale(2); opacity: 0; } }
        @keyframes spin  { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
