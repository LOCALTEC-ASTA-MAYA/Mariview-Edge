import 'maplibre-gl/dist/maplibre-gl.css';
import { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@apollo/client';
import DeckGL from '@deck.gl/react';
import { IconLayer } from '@deck.gl/layers';
import Map from 'react-map-gl/maplibre';
import { Plane, Activity, AlertTriangle, RefreshCw, Gauge, TrendingUp, Radio, Target } from 'lucide-react';
import { GET_ADSB_AIRCRAFT } from '../graphql/queries';
import { useGhostGlide } from '../hooks/useGhostGlide';

// ── Constants ─────────────────────────────────────────────────────────────────
const INITIAL_VIEW_STATE = {
  longitude: 118.0,
  latitude: -2.0,
  zoom: 4.2,
  pitch: 25,
  bearing: 0,
};

const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

// Altitude-based color coding (feet)
function altitudeColor(alt: number, onGround: boolean): [number, number, number, number] {
  if (onGround) return [239, 68, 68, 240];       // red — on ground
  if (alt < 10000) return [251, 191, 36, 230];   // amber — low
  if (alt < 25000) return [74, 222, 128, 230];   // green — mid
  if (alt < 35000) return [56, 189, 248, 230];   // sky blue — high
  return [167, 139, 250, 230];                    // purple — ultra high
}

interface Flight {
  id: string; icao24: string; callsign: string; aircraftType: string;
  position: number[]; altitude: number; speed: number;
  heading: number; onGround: boolean;
}

interface TooltipInfo { x: number; y: number; flight: Flight; }

// ICAO type code categorization
function aircraftIcon(type: string, onGround: boolean): { char: string; size: number } {
  if (onGround) return { char: '●', size: 10 }; // on ground: filled circle
  const t = (type ?? '').toUpperCase();
  // Helicopter: Bell, Airbus H/EC, Sikorsky, etc.
  if (t.startsWith('B0') || t.startsWith('H') || t.startsWith('EC') || t.startsWith('AS3') || t.startsWith('R4') || t === 'HELI')
    return { char: '✦', size: 12 };
  // Military C-130, C-17, etc.
  if (t.startsWith('C13') || t.startsWith('C17') || t.startsWith('P3') || t.startsWith('F') || t.startsWith('MQ'))
    return { char: '◆', size: 12 };
  // Turboprop / regional
  if (t.startsWith('AT') || t.startsWith('Q4') || t.startsWith('DH') || t.startsWith('E1') ||  t.startsWith('SF') || t === 'AT75' || t === 'AT72')
    return { char: '▶', size: 10 };
  // Large widebody (always bigger)
  if (t.startsWith('B74') || t.startsWith('B77') || t.startsWith('B78') || t.startsWith('B79') ||
      t.startsWith('A33') || t.startsWith('A34') || t.startsWith('A35') || t.startsWith('A38'))
    return { char: '▲', size: 16 };
  // Default narrow/medium body jet
  return { char: '▲', size: 12 };
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function AdsbStream() {
  const { data, loading, error, refetch } = useQuery(GET_ADSB_AIRCRAFT, {
    fetchPolicy: 'cache-and-network',
    // No pollInterval — fetched once per page visit, cached 5 min on backend
  });

  const [tooltip, setTooltip] = useState<TooltipInfo | null>(null);

  const flights: Flight[] = useMemo(
    () => (data?.getLiveFlights ?? []) as Flight[],
    [data]
  );

  // Ghost Glide: dead-reckoning extrapolation + smooth blend on data refresh
  // Aircraft keep moving realistically between 5-min cache refreshes.
  const glideFlights = useGhostGlide(flights, {
    getId:      f => f.icao24,
    getLat:     f => f.position[0],
    getLon:     f => f.position[1],
    getHeading: f => f.heading ?? 0,
    getSpeed:   f => f.onGround ? 0 : (f.speed ?? 0), // no DR for ground
    transitionMs: 5_000,
  });

  const stats = useMemo(() => {
    if (!flights.length) return { count: 0, airborne: 0, grounded: 0, avgAlt: 0, avgSpeed: 0 };
    const airborne  = flights.filter(f => !f.onGround).length;
    const grounded  = flights.filter(f => f.onGround).length;
    const avgAlt    = Math.round(flights.filter(f => !f.onGround).reduce((s, f) => s + f.altitude, 0) / (airborne || 1));
    const avgSpeed  = Math.round(flights.reduce((s, f) => s + f.speed, 0) / flights.length);
    return { count: flights.length, airborne, grounded, avgAlt, avgSpeed };
  }, [flights]);

  const onHover = useCallback((info: any) => {
    setTooltip(info.object ? { x: info.x, y: info.y, flight: info.object } : null);
  }, []);

  // SVG airplane icon as data URI (classic airplane top-down silhouette)
  const makePlaneIcon = (color: string) =>
    `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">
      <path fill="${color}" d="M16 2 L19 14 L30 18 L19 20 L18 29 L16 27 L14 29 L13 20 L2 18 L13 14 Z"/>
    </svg>`)}`;

  const makeGroundIcon = (color: string) =>
    `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">
      <circle cx="16" cy="16" r="8" fill="${color}" stroke="rgba(0,0,0,0.5)" stroke-width="1.5"/>
      <circle cx="16" cy="16" r="3" fill="rgba(0,0,0,0.3)"/>
    </svg>`)}`;

  const iconLayer = new IconLayer({
    id: 'adsb-icons',
    data: glideFlights,                       // ← Ghost Glide output (60fps)
    getPosition: (d: any) => [d._lon, d._lat], // ← dead-reckoned position
    getIcon: (d: any) => ({
      url: d.onGround
        ? makeGroundIcon('rgb(239,68,68)')
        : makePlaneIcon((() => {
            const [r, g, b] = altitudeColor(d.altitude, false);
            return `rgb(${r},${g},${b})`;
          })()),
      width: 32,
      height: 32,
      anchorX: 16,
      anchorY: 16,
    }),
    getSize: (d: any) => d.onGround ? 22 : 30,
    getAngle: (d: any) => d.onGround ? 0 : -(d._heading ?? 0), // ← short-arc lerped
    pickable: true,
    onHover,
    sizeScale: 1,
  });

  return (
    <div className="flex flex-col h-full" style={{ background: '#070b14' }}>

      {/* ── Header ── */}
      <div style={{
        background: 'linear-gradient(90deg,#0a0f1e 0%,#0d1628 100%)',
        borderBottom: '1px solid rgba(56,189,248,0.15)',
        padding: '12px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
        gap: 12,
      }}>
        {/* Left title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            background: 'rgba(56,189,248,0.12)',
            border: '1px solid rgba(56,189,248,0.3)',
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
                  animation: 'ping 1.5s cubic-bezier(0,0,0.2,1) infinite',
                }} />
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#38bdf8', display: 'block' }} />
              </span>
              <span style={{ fontSize: 10, color: '#38bdf8', fontWeight: 700, letterSpacing: '0.12em' }}>LIVE</span>
            </div>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.05em' }}>
              INDONESIAN FIR · ADS-B CLASS A/B · 1090MHz MLAT
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
            <span style={{ fontSize: 10, color: '#f87171', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
              <AlertTriangle style={{ width: 12, height: 12 }} />ERROR
            </span>
          )}
          {[
            { icon: Plane,   label: `${stats.count}`,   sub: 'AIRCRAFT', color: '#38bdf8' },
            { icon: Target,  label: `${stats.airborne}`, sub: 'AIRBORNE', color: '#4ade80' },
            { icon: Gauge,   label: `${stats.avgAlt.toLocaleString()}`, sub: 'AVG ALT FT', color: '#fbbf24' },
            { icon: TrendingUp, label: `${stats.avgSpeed}`, sub: 'AVG KN', color: '#a78bfa' },
          ].map(({ icon: Icon, label, sub, color }) => (
            <div key={sub} style={{
              background: 'rgba(255,255,255,0.04)',
              border: `1px solid ${color}30`,
              borderRadius: 8, padding: '5px 10px',
              display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 64,
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
              background: 'rgba(56,189,248,0.08)',
              border: '1px solid rgba(56,189,248,0.25)',
              borderRadius: 8, padding: '6px 12px',
              color: '#38bdf8', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.5 : 1,
              transition: 'all 0.2s', textTransform: 'uppercase',
            }}
          >
            <RefreshCw style={{ width: 12, height: 12 }} />Refresh
          </button>
        </div>
      </div>

      {/* ── Body ── */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 280px', overflow: 'hidden', minHeight: 0 }}>

        {/* Map */}
        <div style={{ position: 'relative' }}>
          <DeckGL
            initialViewState={INITIAL_VIEW_STATE}
            controller={true}
            layers={[iconLayer]}
            style={{ position: 'absolute', inset: '0' }}
          >
            <Map mapStyle={MAP_STYLE} />

            {/* Hover tooltip */}
            {tooltip && (() => {
              const c = altitudeColor(tooltip.flight.altitude, tooltip.flight.onGround);
              const colorStr = `rgb(${c[0]},${c[1]},${c[2]})`;
              return (
                <div className="pointer-events-none" style={{ position: 'absolute', left: tooltip.x + 16, top: tooltip.y - 8 }}>
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
                        { k: 'ICAO24',   v: tooltip.flight.icao24.toUpperCase(),                   c: '#94a3b8', mono: true },
                        { k: 'TYPE',     v: tooltip.flight.aircraftType || '—',                    c: colorStr },
                        { k: 'ALTITUDE', v: `${tooltip.flight.altitude.toLocaleString()} ft`,      c: colorStr, mono: true },
                        { k: 'SPEED',    v: `${Math.round(tooltip.flight.speed)} kn`,              c: '#a78bfa', mono: true },
                        { k: 'HEADING',  v: `${Math.round(tooltip.flight.heading)}°`,              c: '#94a3b8', mono: true },
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
            position: 'absolute', bottom: 20, left: 16, zIndex: 20,
            background: 'rgba(7,11,20,0.90)', backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '10px 12px',
            minWidth: 170,
          }}>
            <p style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', fontWeight: 800, letterSpacing: '0.15em', marginBottom: 6, textTransform: 'uppercase' }}>
              Altitude Band
            </p>
            {[
              { color: '#ef4444', label: 'On Ground / Taxiing' },
              { color: '#fbbf24', label: '< 10,000 ft' },
              { color: '#4ade80', label: '10,000 – 25,000 ft' },
              { color: '#38bdf8', label: '25,000 – 35,000 ft' },
              { color: '#a78bfa', label: '> 35,000 ft' },
            ].map(({ color, label }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
                <div style={{
                  width: 8, height: 8, borderRadius: '50%', background: color,
                  boxShadow: `0 0 6px ${color}80`, flexShrink: 0,
                }} />
                <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.65)', fontWeight: 600 }}>{label}</span>
              </div>
            ))}
            <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', margin: '7px 0' }} />
            <p style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', fontWeight: 800, letterSpacing: '0.15em', marginBottom: 6, textTransform: 'uppercase' }}>
              Aircraft Type
            </p>
            {[
              { icon: '▲', label: 'Narrow-body Jet (A320, B738…)', size: 13 },
              { icon: '▲', label: 'Wide-body Jet (A330, B77W…)', size: 16 },
              { icon: '▶', label: 'Turboprop / Regional', size: 12 },
              { icon: '✦', label: 'Helicopter', size: 13 },
              { icon: '◆', label: 'Military / Special', size: 12 },
              { icon: '●', label: 'On Ground', size: 12 },
            ].map(({ icon, label, size }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
                <span style={{ fontSize: size, color: '#fff', fontWeight: 700, width: 14, textAlign: 'center', flexShrink: 0 }}>{icon}</span>
                <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.65)', fontWeight: 600 }}>{label}</span>
              </div>
            ))}
          </div>

          {/* Coord tag */}
          <div style={{
            position: 'absolute', bottom: 20, right: 16, zIndex: 20,
            background: 'rgba(7,11,20,0.75)', border: '1px solid rgba(56,189,248,0.15)',
            borderRadius: 8, padding: '6px 10px',
            fontSize: 9, color: '#38bdf8', fontFamily: 'monospace', fontWeight: 700,
          }}>
            REF: WIIX / WAAA / WRRR · INDONESIAN FIR
          </div>
        </div>

        {/* ── Sidebar ── */}
        <div style={{
          background: 'linear-gradient(180deg,#0a0f1e 0%,#070b14 100%)',
          borderLeft: '1px solid rgba(56,189,248,0.12)',
          display: 'flex', flexDirection: 'column', overflowY: 'auto',
        }}>
          <div style={{ padding: '16px 16px 10px' }}>
            <p style={{ fontSize: 9, color: '#38bdf8', fontWeight: 800, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 12 }}>
              Traffic Summary
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { icon: Plane,      label: 'Total Aircraft', value: stats.count,              color: '#38bdf8', bg: 'rgba(56,189,248,0.08)' },
                { icon: Target,     label: 'Airborne',       value: stats.airborne,           color: '#4ade80', bg: 'rgba(74,222,128,0.08)' },
                { icon: Plane,      label: 'On Ground',      value: stats.grounded,           color: '#f87171', bg: 'rgba(248,113,113,0.08)' },
                { icon: Gauge,      label: 'Avg Altitude',   value: `${stats.avgAlt.toLocaleString()} ft`, color: '#fbbf24', bg: 'rgba(251,191,36,0.08)' },
                { icon: TrendingUp, label: 'Avg Speed',      value: `${stats.avgSpeed} kn`,   color: '#a78bfa', bg: 'rgba(167,139,250,0.08)' },
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
                    <Icon style={{ width: 14, height: 14, color }} />
                  </div>
                  <div>
                    <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 1 }}>{label}</p>
                    <p style={{ fontSize: 18, fontWeight: 900, color: '#fff', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ height: 1, background: 'rgba(255,255,255,0.05)', margin: '4px 16px' }} />

          {/* Intel notice */}
          <div style={{ padding: '12px 16px' }}>
            <div style={{
              background: 'rgba(56,189,248,0.05)', border: '1px solid rgba(56,189,248,0.2)',
              borderRadius: 10, padding: '10px 12px',
            }}>
              <p style={{ fontSize: 9, color: '#38bdf8', fontWeight: 800, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 5 }}>
                📡 MLAT Coverage
              </p>
              <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', lineHeight: 1.6 }}>
                1090 MHz ADS-B · MLAT multilateration active · Indonesian FIR coverage · ADS-B Exchange live feed
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
            <span style={{ color: '#38bdf8', fontWeight: 700 }}>ADS-B ENCRYPTED</span>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes ping { 75%, 100% { transform: scale(2); opacity: 0; } }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
