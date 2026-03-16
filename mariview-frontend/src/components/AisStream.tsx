import 'maplibre-gl/dist/maplibre-gl.css';
import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useQuery } from '@apollo/client';
import DeckGL from '@deck.gl/react';
import { IconLayer, ScatterplotLayer } from '@deck.gl/layers';
import Map from 'react-map-gl/maplibre';
import { Ship, Navigation, Anchor, Zap, Radio, RefreshCw, Activity, AlertTriangle } from 'lucide-react';
import { GET_AIS_VESSELS } from '../graphql/queries';
import { useGhostGlide } from '../hooks/useGhostGlide';

// ── Constants ─────────────────────────────────────────────────────────────────

const INITIAL_VIEW_STATE = {
  longitude: 123.59,
  latitude:  -10.17,
  zoom:       11,
  pitch:      50,
  bearing:    -15,
  minPitch:   0,
  maxPitch:   75,
};

const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

const TYPE_COLORS: Record<string, [number, number, number, number]> = {
  Cargo:             [ 34, 197,  94, 255],
  Tanker:            [239,  68,  68, 255],
  Passenger:         [ 59, 130, 246, 255],
  'Passenger/Ferry': [ 59, 130, 246, 255],
  Fishing:           [234, 179,   8, 255],
  Tug:               [168,  85, 247, 255],
  Naval:             [  0, 229, 255, 255],
  Military:          [  0, 229, 255, 255],
  'Bulk Carrier':    [249, 115,  22, 255],
  'Ro-Ro':           [ 20, 184, 166, 255],
  'Container Ship':  [ 34, 197,  94, 255],
  'Cargo Ship':      [ 34, 197,  94, 255],
  'Pilot Vessel':    [236,  72, 153, 255],
  'Sailing/Yacht':   [139,  92, 246, 255],
  'Law Enforcement': [244,  63,  94, 255],
};
const DEFAULT_COLOR: [number, number, number, number] = [100, 200, 230, 255];

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

// ── SVG Arrow Icon Generator ─────────────────────────────────────────────────
// Generates a crisp arrow/chevron SVG for each vessel type.
// Each arrow is rendered into a canvas atlas for IconLayer consumption.

const ICON_SIZE = 64;

function drawArrowToCanvas(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  color: [number, number, number, number],
  isAnchored: boolean
): void {
  const [r, g, b] = color;
  const cx = x + ICON_SIZE / 2;
  const cy = y + ICON_SIZE / 2;
  const s = ICON_SIZE;

  ctx.save();
  ctx.translate(cx, cy);

  if (isAnchored) {
    // Anchored: diamond shape
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.3);
    ctx.lineTo(s * 0.22, 0);
    ctx.lineTo(0, s * 0.3);
    ctx.lineTo(-s * 0.22, 0);
    ctx.closePath();
    ctx.fillStyle = `rgba(${r},${g},${b},0.6)`;
    ctx.fill();
    ctx.strokeStyle = `rgba(${r},${g},${b},0.9)`;
    ctx.lineWidth = 2;
    ctx.stroke();
  } else {
    // Underway: sharp arrow/chevron pointing UP
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.38);            // tip
    ctx.lineTo(s * 0.24, s * 0.32);      // bottom-right
    ctx.lineTo(0, s * 0.15);             // notch center
    ctx.lineTo(-s * 0.24, s * 0.32);     // bottom-left
    ctx.closePath();

    // Gradient fill
    const grad = ctx.createLinearGradient(0, -s * 0.38, 0, s * 0.32);
    grad.addColorStop(0, `rgba(${r},${g},${b},1)`);
    grad.addColorStop(1, `rgba(${r},${g},${b},0.6)`);
    ctx.fillStyle = grad;
    ctx.fill();

    // Bright outline for glow
    ctx.strokeStyle = `rgba(${Math.min(r + 60, 255)},${Math.min(g + 60, 255)},${Math.min(b + 60, 255)},0.8)`;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  ctx.restore();
}

function buildIconAtlas(): { canvas: HTMLCanvasElement; mapping: Record<string, any> } {
  const allTypes = [...Object.keys(TYPE_COLORS), '_default'];
  // 2 icons per type: underway + anchored
  const totalIcons = allTypes.length * 2;
  const cols = Math.ceil(Math.sqrt(totalIcons));
  const rows = Math.ceil(totalIcons / cols);

  const canvas = document.createElement('canvas');
  canvas.width = cols * ICON_SIZE;
  canvas.height = rows * ICON_SIZE;
  const ctx = canvas.getContext('2d')!;

  const mapping: Record<string, any> = {};
  let idx = 0;

  for (const type of allTypes) {
    const color = type === '_default' ? DEFAULT_COLOR : TYPE_COLORS[type];

    // Underway icon
    const ux = (idx % cols) * ICON_SIZE;
    const uy = Math.floor(idx / cols) * ICON_SIZE;
    drawArrowToCanvas(ctx, ux, uy, color, false);
    mapping[`${type}_underway`] = {
      x: ux, y: uy, width: ICON_SIZE, height: ICON_SIZE,
      anchorY: ICON_SIZE / 2, mask: false,
    };
    idx++;

    // Anchored icon
    const ax = (idx % cols) * ICON_SIZE;
    const ay = Math.floor(idx / cols) * ICON_SIZE;
    drawArrowToCanvas(ctx, ax, ay, color, true);
    mapping[`${type}_anchored`] = {
      x: ax, y: ay, width: ICON_SIZE, height: ICON_SIZE,
      anchorY: ICON_SIZE / 2, mask: false,
    };
    idx++;
  }

  return { canvas, mapping };
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AisStream() {
  const { data, loading, error, refetch } = useQuery(GET_AIS_VESSELS, {
    fetchPolicy: 'cache-and-network',
  });

  const [tooltip, setTooltip] = useState<TooltipInfo | null>(null);
  const vessels: AisVessel[] = data?.getAISVessels ?? [];

  const glideVessels = useGhostGlide(vessels, {
    getId:        v => v.mmsi,
    getLat:       v => v.position[0],
    getLon:       v => v.position[1],
    getHeading:   v => v.course ?? v.heading ?? 0,
    getSpeed:     v => v.speed ?? 0,
    transitionMs: 6_000,
  });

  const stats = useMemo(() => {
    if (!vessels.length) return { count: 0, underway: 0, anchored: 0, avgSpeed: '0.0', byType: {} as Record<string, number> };
    const underway = vessels.filter(v => v.status === 'Under Way').length;
    const anchored = vessels.filter(v => v.status === 'At Anchor' || v.status === 'Moored').length;
    const avgSpeed = (vessels.reduce((s, v) => s + v.speed, 0) / vessels.length).toFixed(1);
    const byType = vessels.reduce((acc: Record<string, number>, v) => {
      acc[v.type] = (acc[v.type] ?? 0) + 1; return acc;
    }, {});
    return { count: vessels.length, underway, anchored, avgSpeed, byType };
  }, [vessels]);

  const onHover = useCallback((info: any) => {
    setTooltip(info.object ? { x: info.x, y: info.y, vessel: info.object } : null);
  }, []);

  // ── Build icon atlas once ──────────────────────────────────────────────────
  const atlasRef = useRef<{ canvas: HTMLCanvasElement; mapping: Record<string, any> } | null>(null);
  if (!atlasRef.current) {
    atlasRef.current = buildIconAtlas();
  }

  // ── Layers ─────────────────────────────────────────────────────────────────

  // Layer 1: Soft glow circles under each vessel
  const glowLayer = new ScatterplotLayer({
    id: 'vessel-glow',
    data: glideVessels,
    getPosition: (d: any) => [d._lon, d._lat],
    getRadius: (d: any) => {
      const isAnchored = d.status === 'At Anchor' || d.status === 'Moored';
      return isAnchored ? 150 : 200 + Math.min(d.speed * 25, 300);
    },
    getFillColor: (d: any) => {
      const [r, g, b] = getVesselColor(d.type);
      return [r, g, b, 35];
    },
    radiusMinPixels: 6,
    radiusMaxPixels: 24,
    pickable: false,
  });

  // Layer 2: Arrow icons — crisp SVG chevrons rendered from canvas atlas
  const iconLayer = new IconLayer({
    id: 'vessel-arrows',
    data: glideVessels,
    getPosition: (d: any) => [d._lon, d._lat],
    getIcon: (d: any) => {
      const isAnchored = d.status === 'At Anchor' || d.status === 'Moored';
      const typeKey = TYPE_COLORS[d.type] ? d.type : '_default';
      return isAnchored ? `${typeKey}_anchored` : `${typeKey}_underway`;
    },
    getSize: (d: any) => {
      const isAnchored = d.status === 'At Anchor' || d.status === 'Moored';
      return isAnchored ? 28 : 36 + Math.min(d.speed * 0.8, 12);
    },
    getAngle: (d: any) => {
      const isAnchored = d.status === 'At Anchor' || d.status === 'Moored';
      if (isAnchored) return 0;
      // SVG arrow points UP (0°). deck.gl IconLayer angle is clockwise.
      // heading 0 = North = UP → angle 0. heading 90 = East → angle -90 (CW).
      return -(d._heading ?? d.course ?? d.heading ?? 0);
    },
    iconAtlas: atlasRef.current.canvas,
    iconMapping: atlasRef.current.mapping,
    billboard: false,  // flatten to 3D surface — tilts with map pitch
    sizeScale: 1,
    pickable: true,
    onHover,
    parameters: { depthTest: false },
  });

  const layers = [glowLayer, iconLayer];

  return (
    <div className="flex flex-col h-full" style={{ background: '#070b14' }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(90deg,#0a0f1e 0%,#0d1628 100%)',
        borderBottom: '1px solid rgba(45,212,191,0.15)',
        padding: '10px 20px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0, gap: 12,
      }}>
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
                  animation: 'ais-ping 1.5s cubic-bezier(0,0,0.2,1) infinite',
                }} />
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', display: 'block' }} />
              </span>
              <span style={{ fontSize: 10, color: '#22c55e', fontWeight: 700, letterSpacing: '0.12em' }}>LIVE</span>
            </div>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.05em' }}>
              KUPANG MARITIME ZONE · 3D TACTICAL VIEW · AIS CLASS A/B
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {loading && (
            <span style={{ fontSize: 10, color: '#facc15', fontWeight: 700, letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Activity style={{ width: 12, height: 12, animation: 'ais-spin 1s linear infinite' }} />SCANNING
            </span>
          )}
          {error && (
            <span style={{ fontSize: 10, color: '#f87171', fontWeight: 700, letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: 4 }}>
              <AlertTriangle style={{ width: 12, height: 12 }} />ERROR
            </span>
          )}
          {[
            { icon: Ship,       label: `${stats.count}`,   sub: 'VESSELS',  color: '#2DD4BF' },
            { icon: Navigation, label: `${stats.underway}`, sub: 'UNDERWAY', color: '#22c55e' },
            { icon: Anchor,     label: `${stats.anchored}`, sub: 'ANCHORED', color: '#f59e0b' },
            { icon: Zap,        label: `${stats.avgSpeed}`, sub: 'AVG KN',   color: '#a78bfa' },
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
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 260px', overflow: 'hidden', minHeight: 0 }}>

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
                style={{ position: 'absolute', left: tooltip.x + 16, top: tooltip.y - 8, zIndex: 50 }}
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

          {/* Legend — bottom-left */}
          <div style={{
            position: 'absolute', bottom: 16, left: 16, zIndex: 20,
            background: 'rgba(7,11,20,0.88)', backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '10px 14px',
          }}>
            <p style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', fontWeight: 800, letterSpacing: '0.15em', marginBottom: 6, textTransform: 'uppercase' }}>
              Vessel Class
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {Object.entries(TYPE_COLORS)
                .filter(([t]) => !['Container Ship', 'Cargo Ship', 'Passenger/Ferry'].includes(t))
                .map(([type, color]) => (
                <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <div style={{
                    width: 0, height: 0, flexShrink: 0,
                    borderLeft: '5px solid transparent',
                    borderRight: '5px solid transparent',
                    borderBottom: `9px solid ${rgbStr(color)}`,
                  }} />
                  <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.75)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {type}
                  </span>
                </div>
              ))}
            </div>
            <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', margin: '7px 0' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{
                  width: 0, height: 0,
                  borderLeft: '4px solid transparent', borderRight: '4px solid transparent',
                  borderBottom: '7px solid #2DD4BF',
                }} />
                <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.45)', fontWeight: 600 }}>Underway</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{
                  width: 6, height: 6, transform: 'rotate(45deg)',
                  background: 'rgba(45,212,191,0.6)', border: '1px solid #2DD4BF',
                }} />
                <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.45)', fontWeight: 600 }}>Anchored</span>
              </div>
            </div>
          </div>

          {/* Coord tag — bottom-right */}
          <div style={{
            position: 'absolute', bottom: 16, right: 16, zIndex: 20,
            background: 'rgba(7,11,20,0.75)', border: '1px solid rgba(45,212,191,0.15)',
            borderRadius: 8, padding: '6px 10px',
            fontSize: 9, color: '#2DD4BF', fontFamily: 'monospace', fontWeight: 700,
          }}>
            KUPANG · 123.59°E / 10.17°S · 3D TACTICAL
          </div>
        </div>

        {/* ── Sidebar ──────────────────────────────────────────────────────── */}
        <div style={{
          background: 'linear-gradient(180deg,#0a0f1e 0%,#070b14 100%)',
          borderLeft: '1px solid rgba(45,212,191,0.12)',
          display: 'flex', flexDirection: 'column', overflowY: 'auto', gap: 0,
        }}>
          {/* Summary */}
          <div style={{ padding: '14px 14px 10px' }}>
            <p style={{ fontSize: 9, color: '#2DD4BF', fontWeight: 800, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 10 }}>
              Traffic Summary
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                { icon: Ship,       label: 'Total Vessels', value: stats.count,           color: '#2DD4BF', bg: 'rgba(45,212,191,0.08)' },
                { icon: Navigation, label: 'Under Way',     value: stats.underway,         color: '#22c55e', bg: 'rgba(34,197,94,0.08)' },
                { icon: Anchor,     label: 'Anchor/Moored', value: stats.anchored,         color: '#f59e0b', bg: 'rgba(245,158,11,0.08)' },
                { icon: Zap,        label: 'Avg Speed',     value: `${stats.avgSpeed} kn`, color: '#a78bfa', bg: 'rgba(167,139,250,0.08)' },
              ].map(({ icon: Icon, label, value, color, bg }) => (
                <div key={label} style={{
                  background: bg, border: `1px solid ${color}20`,
                  borderRadius: 8, padding: '8px 10px',
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: 7,
                    background: `${color}15`, border: `1px solid ${color}30`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <Icon style={{ width: 13, height: 13, color }} />
                  </div>
                  <div>
                    <p style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 1 }}>{label}</p>
                    <p style={{ fontSize: 18, fontWeight: 900, color: '#fff', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ height: 1, background: 'rgba(255,255,255,0.05)', margin: '2px 14px' }} />

          {/* Fleet breakdown */}
          <div style={{ padding: '10px 14px' }}>
            <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', fontWeight: 800, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 8 }}>
              Fleet Breakdown
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {Object.entries(stats.byType)
                .sort((a, b) => b[1] - a[1])
                .map(([type, count]) => {
                  const color = TYPE_COLORS[type] ?? DEFAULT_COLOR;
                  const pct = stats.count > 0 ? Math.round((count / stats.count) * 100) : 0;
                  return (
                    <div key={type}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <div style={{
                            width: 0, height: 0, flexShrink: 0,
                            borderLeft: '4px solid transparent',
                            borderRight: '4px solid transparent',
                            borderBottom: `7px solid ${rgbStr(color)}`,
                          }} />
                          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.6)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{type}</span>
                        </div>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>{pct}%</span>
                          <span style={{ fontSize: 11, fontWeight: 800, color: '#fff' }}>{count}</span>
                        </div>
                      </div>
                      <div style={{ height: 2, background: 'rgba(255,255,255,0.06)', borderRadius: 99 }}>
                        <div style={{
                          height: 2, borderRadius: 99, width: `${pct}%`,
                          background: `linear-gradient(90deg, ${rgbStr(color)}, ${rgbStr(color)}88)`,
                          boxShadow: `0 0 4px ${rgbStr(color)}50`,
                          transition: 'width 0.8s ease',
                        }} />
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          <div style={{ height: 1, background: 'rgba(255,255,255,0.05)', margin: '0 14px' }} />

          {/* Intel notice */}
          <div style={{ padding: '10px 14px' }}>
            <div style={{
              background: 'rgba(45,212,191,0.05)', border: '1px solid rgba(45,212,191,0.15)',
              borderRadius: 8, padding: '8px 10px',
            }}>
              <p style={{ fontSize: 9, color: '#2DD4BF', fontWeight: 800, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 4 }}>
                📡 Intel Notice
              </p>
              <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.40)', lineHeight: 1.5 }}>
                AIS anomaly detection active · Kupang Bay watchzone enabled · Dead-reckoning projection online
              </p>
            </div>
          </div>

          <div style={{
            marginTop: 'auto', padding: '8px 14px',
            borderTop: '1px solid rgba(255,255,255,0.05)',
            display: 'flex', justifyContent: 'space-between',
            fontSize: 9, color: 'rgba(255,255,255,0.25)',
          }}>
            <span>© MARIVIEW C4I</span>
            <span style={{ color: '#2DD4BF', fontWeight: 700 }}>AIS-ENCRYPTED</span>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes ais-ping  { 75%, 100% { transform: scale(2); opacity: 0; } }
        @keyframes ais-spin  { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
