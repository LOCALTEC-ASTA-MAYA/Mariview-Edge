import 'maplibre-gl/dist/maplibre-gl.css';
import { useState, useMemo, useCallback, useRef } from 'react';
import { useQuery } from '@apollo/client';
import DeckGL from '@deck.gl/react';
import { IconLayer, ScatterplotLayer } from '@deck.gl/layers';
import Map from 'react-map-gl/maplibre';
import { Plane, Activity, AlertTriangle, RefreshCw, Gauge, TrendingUp, Radio, Target } from 'lucide-react';
import { GET_ADSB_AIRCRAFT } from '../graphql/queries';
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

// Altitude bands → colors
const ALT_BANDS = [
  { key: 'ground',  label: 'On Ground / Taxiing',   color: [239,  68,  68, 255] as [number,number,number,number] },
  { key: 'low',     label: '< 10,000 ft',           color: [251, 191,  36, 255] as [number,number,number,number] },
  { key: 'mid',     label: '10,000 – 25,000 ft',    color: [ 74, 222, 128, 255] as [number,number,number,number] },
  { key: 'high',    label: '25,000 – 35,000 ft',    color: [ 56, 189, 248, 255] as [number,number,number,number] },
  { key: 'ultra',   label: '> 35,000 ft',           color: [167, 139, 250, 255] as [number,number,number,number] },
];

function altBandKey(alt: number, onGround: boolean): string {
  if (onGround) return 'ground';
  if (alt < 10000) return 'low';
  if (alt < 25000) return 'mid';
  if (alt < 35000) return 'high';
  return 'ultra';
}

function altitudeColor(alt: number, onGround: boolean): [number, number, number, number] {
  const band = ALT_BANDS.find(b => b.key === altBandKey(alt, onGround))!;
  return band.color;
}

function rgbStr(c: [number, number, number, number]) {
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

interface Flight {
  id: string; icao24: string; callsign: string; aircraftType: string;
  position: number[]; altitude: number; speed: number;
  heading: number; onGround: boolean;
}

interface TooltipInfo { x: number; y: number; flight: Flight; }

// ── Canvas Icon Atlas ─────────────────────────────────────────────────────────
// Draws airplane silhouettes for each altitude band into a shared canvas atlas.
// On-ground → filled circle. Airborne → airplane top-down silhouette.

const ICON_SIZE = 64;

function drawAirplane(ctx: CanvasRenderingContext2D, x: number, y: number, color: [number, number, number, number]) {
  const [r, g, b] = color;
  const cx = x + ICON_SIZE / 2;
  const cy = y + ICON_SIZE / 2;
  const s = ICON_SIZE * 0.4; // scale factor

  ctx.save();
  ctx.translate(cx, cy);

  // Airplane silhouette pointing UP — matches the reference image
  ctx.beginPath();

  // Fuselage + nose
  ctx.moveTo(0, -s * 0.9);           // nose tip

  // Right wing sweep
  ctx.lineTo(s * 0.12, -s * 0.3);    // fuselage right before wing
  ctx.lineTo(s * 0.75, -s * 0.05);   // right wingtip
  ctx.lineTo(s * 0.7, s * 0.08);     // right wing trailing edge
  ctx.lineTo(s * 0.12, s * 0.05);    // wing root right

  // Right tail
  ctx.lineTo(s * 0.12, s * 0.55);    // fuselage right before tail
  ctx.lineTo(s * 0.35, s * 0.72);    // right tail tip
  ctx.lineTo(s * 0.3, s * 0.82);     // right tail trailing
  ctx.lineTo(s * 0.08, s * 0.7);     // tail root right

  // Tail center
  ctx.lineTo(0, s * 0.85);           // tail bottom center

  // Left tail (mirror)
  ctx.lineTo(-s * 0.08, s * 0.7);
  ctx.lineTo(-s * 0.3, s * 0.82);
  ctx.lineTo(-s * 0.35, s * 0.72);
  ctx.lineTo(-s * 0.12, s * 0.55);

  // Left wing
  ctx.lineTo(-s * 0.12, s * 0.05);
  ctx.lineTo(-s * 0.7, s * 0.08);
  ctx.lineTo(-s * 0.75, -s * 0.05);
  ctx.lineTo(-s * 0.12, -s * 0.3);

  ctx.closePath();

  // Gradient fill
  const grad = ctx.createLinearGradient(0, -s * 0.9, 0, s * 0.85);
  grad.addColorStop(0, `rgba(${r},${g},${b},1)`);
  grad.addColorStop(1, `rgba(${r},${g},${b},0.65)`);
  ctx.fillStyle = grad;
  ctx.fill();

  // Bright edge glow
  ctx.strokeStyle = `rgba(${Math.min(r + 50, 255)},${Math.min(g + 50, 255)},${Math.min(b + 50, 255)},0.7)`;
  ctx.lineWidth = 1.2;
  ctx.stroke();

  ctx.restore();
}

function drawGroundDot(ctx: CanvasRenderingContext2D, x: number, y: number, color: [number, number, number, number]) {
  const [r, g, b] = color;
  const cx = x + ICON_SIZE / 2;
  const cy = y + ICON_SIZE / 2;
  const radius = ICON_SIZE * 0.2;

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(${r},${g},${b},0.7)`;
  ctx.fill();
  ctx.strokeStyle = `rgba(${r},${g},${b},1)`;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Inner dot
  ctx.beginPath();
  ctx.arc(cx, cy, radius * 0.35, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(0,0,0,0.3)`;
  ctx.fill();
  ctx.restore();
}

function buildAircraftAtlas(): { canvas: HTMLCanvasElement; mapping: Record<string, any> } {
  // One airplane icon per altitude band + one ground dot
  const entries: { key: string; color: [number, number, number, number]; isGround: boolean }[] = [];

  for (const band of ALT_BANDS) {
    if (band.key === 'ground') {
      entries.push({ key: 'ground', color: band.color, isGround: true });
    } else {
      entries.push({ key: band.key, color: band.color, isGround: false });
    }
  }

  const cols = entries.length;
  const canvas = document.createElement('canvas');
  canvas.width = cols * ICON_SIZE;
  canvas.height = ICON_SIZE;
  const ctx = canvas.getContext('2d')!;

  const mapping: Record<string, any> = {};

  entries.forEach((entry, i) => {
    const x = i * ICON_SIZE;
    if (entry.isGround) {
      drawGroundDot(ctx, x, 0, entry.color);
    } else {
      drawAirplane(ctx, x, 0, entry.color);
    }
    mapping[entry.key] = {
      x, y: 0, width: ICON_SIZE, height: ICON_SIZE,
      anchorY: ICON_SIZE / 2, mask: false,
    };
  });

  return { canvas, mapping };
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AdsbStream() {
  const { data, loading, error, refetch } = useQuery(GET_ADSB_AIRCRAFT, {
    fetchPolicy: 'cache-and-network',
  });

  const [tooltip, setTooltip] = useState<TooltipInfo | null>(null);

  const flights: Flight[] = useMemo(
    () => (data?.getLiveFlights ?? []) as Flight[],
    [data]
  );

  const glideFlights = useGhostGlide(flights, {
    getId:      f => f.icao24,
    getLat:     f => f.position[0],
    getLon:     f => f.position[1],
    getHeading: f => f.heading ?? 0,
    getSpeed:   f => f.onGround ? 0 : (f.speed ?? 0),
    transitionMs: 5_000,
  });

  const stats = useMemo(() => {
    if (!flights.length) return { count: 0, airborne: 0, grounded: 0, avgAlt: 0, avgSpeed: 0 };
    const airborne = flights.filter(f => !f.onGround).length;
    const grounded = flights.filter(f => f.onGround).length;
    const avgAlt   = Math.round(flights.filter(f => !f.onGround).reduce((s, f) => s + f.altitude, 0) / (airborne || 1));
    const avgSpeed = Math.round(flights.reduce((s, f) => s + f.speed, 0) / flights.length);
    return { count: flights.length, airborne, grounded, avgAlt, avgSpeed };
  }, [flights]);

  const onHover = useCallback((info: any) => {
    setTooltip(info.object ? { x: info.x, y: info.y, flight: info.object } : null);
  }, []);

  // ── Build icon atlas once ──────────────────────────────────────────────────
  const atlasRef = useRef<{ canvas: HTMLCanvasElement; mapping: Record<string, any> } | null>(null);
  if (!atlasRef.current) {
    atlasRef.current = buildAircraftAtlas();
  }

  // ── Layers ─────────────────────────────────────────────────────────────────

  // Layer 1: Glow circles
  const glowLayer = new ScatterplotLayer({
    id: 'aircraft-glow',
    data: glideFlights,
    getPosition: (d: any) => [d._lon, d._lat],
    getRadius: (d: any) => d.onGround ? 120 : 200 + Math.min(d.speed * 15, 250),
    getFillColor: (d: any) => {
      const [r, g, b] = altitudeColor(d.altitude, d.onGround);
      return [r, g, b, 30];
    },
    radiusMinPixels: 5,
    radiusMaxPixels: 22,
    pickable: false,
  });

  // Layer 2: Aircraft icons from canvas atlas
  const iconLayer = new IconLayer({
    id: 'aircraft-icons',
    data: glideFlights,
    getPosition: (d: any) => [d._lon, d._lat],
    getIcon: (d: any) => altBandKey(d.altitude, d.onGround),
    getSize: (d: any) => d.onGround ? 20 : 36 + Math.min(d.speed * 0.3, 8),
    getAngle: (d: any) => d.onGround ? 0 : -(d._heading ?? d.heading ?? 0),
    iconAtlas: atlasRef.current.canvas,
    iconMapping: atlasRef.current.mapping,
    billboard: false,
    sizeScale: 1,
    pickable: true,
    onHover,
    parameters: { depthTest: false },
  });

  const layers = [glowLayer, iconLayer];

  return (
    <div className="flex flex-col h-full" style={{ background: '#070b14' }}>

      {/* ── Header ── */}
      <div style={{
        background: 'linear-gradient(90deg,#0a0f1e 0%,#0d1628 100%)',
        borderBottom: '1px solid rgba(56,189,248,0.15)',
        padding: '10px 20px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0, gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            background: 'rgba(56,189,248,0.12)', border: '1px solid rgba(56,189,248,0.3)',
            borderRadius: 8, padding: '6px 8px', display: 'flex',
          }}>
            <Radio style={{ width: 16, height: 16, color: '#38bdf8' }} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: '#fff', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                ADS-B Aircraft Stream
              </span>
              <span style={{ position: 'relative', display: 'inline-flex' }}>
                <span style={{
                  position: 'absolute', inset: 0, borderRadius: '50%', background: '#38bdf8', opacity: 0.4,
                  animation: 'adsb-ping 1.5s cubic-bezier(0,0,0.2,1) infinite',
                }} />
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#38bdf8', display: 'block' }} />
              </span>
              <span style={{ fontSize: 10, color: '#38bdf8', fontWeight: 700, letterSpacing: '0.12em' }}>LIVE</span>
            </div>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.05em' }}>
              KUPANG FIR · 3D TACTICAL VIEW · ADS-B 1090MHz MLAT
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {loading && (
            <span style={{ fontSize: 10, color: '#facc15', fontWeight: 700, letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Activity style={{ width: 12, height: 12, animation: 'adsb-spin 1s linear infinite' }} />SCANNING
            </span>
          )}
          {error && (
            <span style={{ fontSize: 10, color: '#f87171', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
              <AlertTriangle style={{ width: 12, height: 12 }} />ERROR
            </span>
          )}
          {[
            { icon: Plane,      label: `${stats.count}`,   sub: 'AIRCRAFT', color: '#38bdf8' },
            { icon: Target,     label: `${stats.airborne}`, sub: 'AIRBORNE', color: '#4ade80' },
            { icon: Gauge,      label: `${stats.avgAlt.toLocaleString()}`, sub: 'AVG ALT FT', color: '#fbbf24' },
            { icon: TrendingUp, label: `${stats.avgSpeed}`, sub: 'AVG KN', color: '#a78bfa' },
          ].map(({ icon: Icon, label, sub, color }) => (
            <div key={sub} style={{
              background: 'rgba(255,255,255,0.04)', border: `1px solid ${color}30`,
              borderRadius: 8, padding: '5px 10px',
              display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 60,
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
              background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.25)',
              borderRadius: 8, padding: '6px 12px',
              color: '#38bdf8', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.5 : 1, transition: 'all 0.2s', textTransform: 'uppercase',
            }}
          >
            <RefreshCw style={{ width: 12, height: 12 }} />Refresh
          </button>
        </div>
      </div>

      {/* ── Body ── */}
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
            {tooltip && (() => {
              const c = altitudeColor(tooltip.flight.altitude, tooltip.flight.onGround);
              const colorStr = rgbStr(c);
              return (
                <div className="pointer-events-none" style={{ position: 'absolute', left: tooltip.x + 16, top: tooltip.y - 8, zIndex: 50 }}>
                  <div style={{
                    background: 'rgba(7,11,20,0.97)', backdropFilter: 'blur(16px)',
                    border: `1px solid ${colorStr}50`, borderRadius: 12,
                    padding: '12px 14px', minWidth: 210,
                    boxShadow: `0 0 24px ${colorStr}30`,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      <div style={{
                        width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
                        background: colorStr, boxShadow: `0 0 10px ${colorStr}`,
                      }} />
                      <span style={{ fontSize: 13, fontWeight: 800, color: '#fff', letterSpacing: '0.06em' }}>
                        {tooltip.flight.callsign?.trim() || tooltip.flight.icao24.toUpperCase()}
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                      {[
                        { k: 'ICAO24',   v: tooltip.flight.icao24.toUpperCase(),              c: '#94a3b8', mono: true },
                        { k: 'TYPE',     v: tooltip.flight.aircraftType || '—',               c: colorStr },
                        { k: 'ALTITUDE', v: `${tooltip.flight.altitude.toLocaleString()} ft`, c: colorStr, mono: true },
                        { k: 'SPEED',    v: `${Math.round(tooltip.flight.speed)} kn`,         c: '#a78bfa', mono: true },
                        { k: 'HEADING',  v: `${Math.round(tooltip.flight.heading)}°`,         c: '#94a3b8', mono: true },
                        { k: 'STATUS',   v: tooltip.flight.onGround ? 'On Ground' : 'Airborne',
                          c: tooltip.flight.onGround ? '#f87171' : '#4ade80' },
                      ].map(({ k, v, c, mono }) => (
                        <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', fontWeight: 700, letterSpacing: '0.12em' }}>{k}</span>
                          <span style={{ fontSize: 11, color: c, fontWeight: 700, fontFamily: mono ? 'monospace' : undefined }}>{v}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })()}
          </DeckGL>

          {/* Legend — bottom-left */}
          <div style={{
            position: 'absolute', bottom: 16, left: 16, zIndex: 20,
            background: 'rgba(7,11,20,0.88)', backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '10px 14px',
          }}>
            <p style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', fontWeight: 800, letterSpacing: '0.15em', marginBottom: 6, textTransform: 'uppercase' }}>
              Altitude Band
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {ALT_BANDS.map(({ key, label, color }) => (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  {key === 'ground' ? (
                    <div style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: rgbStr(color), boxShadow: `0 0 5px ${rgbStr(color)}80`, flexShrink: 0,
                    }} />
                  ) : (
                    <span style={{ fontSize: 11, color: rgbStr(color), lineHeight: 1, flexShrink: 0, width: 10, textAlign: 'center' }}>✈</span>
                  )}
                  <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.65)', fontWeight: 600 }}>{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Coord tag — bottom-right */}
          <div style={{
            position: 'absolute', bottom: 16, right: 16, zIndex: 20,
            background: 'rgba(7,11,20,0.75)', border: '1px solid rgba(56,189,248,0.15)',
            borderRadius: 8, padding: '6px 10px',
            fontSize: 9, color: '#38bdf8', fontFamily: 'monospace', fontWeight: 700,
          }}>
            KUPANG · EL TARI (WATT) · 3D TACTICAL
          </div>
        </div>

        {/* ── Sidebar ── */}
        <div style={{
          background: 'linear-gradient(180deg,#0a0f1e 0%,#070b14 100%)',
          borderLeft: '1px solid rgba(56,189,248,0.12)',
          display: 'flex', flexDirection: 'column', overflowY: 'auto',
        }}>
          <div style={{ padding: '14px 14px 10px' }}>
            <p style={{ fontSize: 9, color: '#38bdf8', fontWeight: 800, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 10 }}>
              Traffic Summary
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                { icon: Plane,      label: 'Total Aircraft', value: stats.count,                          color: '#38bdf8', bg: 'rgba(56,189,248,0.08)' },
                { icon: Target,     label: 'Airborne',       value: stats.airborne,                       color: '#4ade80', bg: 'rgba(74,222,128,0.08)' },
                { icon: Plane,      label: 'On Ground',      value: stats.grounded,                       color: '#f87171', bg: 'rgba(248,113,113,0.08)' },
                { icon: Gauge,      label: 'Avg Altitude',   value: `${stats.avgAlt.toLocaleString()} ft`, color: '#fbbf24', bg: 'rgba(251,191,36,0.08)' },
                { icon: TrendingUp, label: 'Avg Speed',      value: `${stats.avgSpeed} kn`,               color: '#a78bfa', bg: 'rgba(167,139,250,0.08)' },
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

          {/* Intel notice */}
          <div style={{ padding: '10px 14px' }}>
            <div style={{
              background: 'rgba(56,189,248,0.05)', border: '1px solid rgba(56,189,248,0.15)',
              borderRadius: 8, padding: '8px 10px',
            }}>
              <p style={{ fontSize: 9, color: '#38bdf8', fontWeight: 800, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 4 }}>
                📡 MLAT Coverage
              </p>
              <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.40)', lineHeight: 1.5 }}>
                1090 MHz ADS-B · MLAT multilateration active · Kupang FIR coverage · El Tari radar zone
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
            <span style={{ color: '#38bdf8', fontWeight: 700 }}>ADS-B ENCRYPTED</span>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes adsb-ping { 75%, 100% { transform: scale(2); opacity: 0; } }
        @keyframes adsb-spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
