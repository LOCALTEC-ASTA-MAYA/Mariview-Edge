import { Badge } from './ui/badge';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { AlertTriangle, TrendingUp, Target, Eye, Ship, Radio, Cloud, Wind, Clock, Globe, Home, Activity, Layers, ChevronLeft, ChevronRight } from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { missions as mockMissions, missionSummary as mockMissionSummary, mockWeatherData, mockGeofences } from './shared-data';
import { useQuery } from '@apollo/client';
import { GET_AIS_VESSELS, GET_LIVE_DRONES, GET_LIVE_FLIGHTS, GET_WEATHER } from '../graphql/queries';
import DigitalTwinMap, { MapMarker } from './DigitalTwinMap';
import vesselDetectionImg from '../assets/vessel_detection.png';
import hullNumberImg from '../assets/hull_number.png';
import vesselAttributeImg from '../assets/vessel_attribute.png';

const detectionResults = [
  { id: 1, type: 'Vessel Detection', mission: 'PSDKP Kupang - Morning Patrol', detected: 23, confidence: 96, timestamp: '2025-01-20 14:23', drone: 'Pyrhos X V1', location: 'Kupang Waters', image: vesselDetectionImg },
  { id: 2, type: 'Hull Number Recognition', mission: 'Harbor Gate Inspection - Kupang', detected: 18, confidence: 92, timestamp: '2025-01-18 14:24', drone: 'AR-2 Aerial', location: 'Kupang Port', image: hullNumberImg },
  { id: 3, type: 'Vessel Attributes', mission: 'Bolok Harbor Security', detected: 47, confidence: 89, timestamp: '2025-01-19 10:15', drone: 'AR-2 Aerial', location: 'Bolok, Kupang', image: vesselAttributeImg },
  { id: 4, type: 'Trash Detection', mission: 'Tenau Coastal Monitoring', detected: 312, confidence: 87, timestamp: '2025-01-19 08:21', drone: 'Pyrhos X V1', location: 'Tenau Waters', image: vesselDetectionImg },
  { id: 5, type: 'Event Detection', mission: 'NTT Maritime Border Security', detected: 'Unauthorized Entry', confidence: 94, timestamp: '2025-01-20 16:20', drone: 'Pyrhos X V1', location: 'Border Zone NTT', image: vesselAttributeImg },
];

export default function Dashboard() {
  const [selectedDetection, setSelectedDetection] = useState<any>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [mapView, setMapView] = useState<'kupang' | 'indonesia'>('kupang');
  const [showAIS, setShowAIS] = useState(true);
  const [showADSB, setShowADSB] = useState(true);
  const [showWeather, setShowWeather] = useState(false);
  const [is3D, setIs3D] = useState(true);
  const [showLayersDropdown, setShowLayersDropdown] = useState(false);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);

  // AIS: cache-only = NEVER sends network request from Dashboard.
  // Data appears here only after user visits the AIS Stream page.
  const { data: aisData, error: aisError } = useQuery(GET_AIS_VESSELS, {
    fetchPolicy: 'cache-only',
  });
  const { data: droneData, error: droneError } = useQuery(GET_LIVE_DRONES, { pollInterval: 3000 });
  const { data: flightData, error: flightError } = useQuery(GET_LIVE_FLIGHTS, { pollInterval: 3000 });
  const { data: weatherData } = useQuery(GET_WEATHER, { pollInterval: 20000 });

  // Debug: log query errors to browser console
  if (aisError) console.error('[AIS QUERY ERROR]', aisError);
  if (droneError) console.error('[DRONE QUERY ERROR]', droneError);
  if (flightError) console.error('[FLIGHT QUERY ERROR]', flightError);

  const getAISColor = (type: string) => {
    const t = type.toLowerCase();
    if (t.includes('cargo') || t.includes('container') || t.includes('bulk')) return '#22c55e';
    if (t.includes('tanker')) return '#ef4444';
    if (t.includes('passenger') || t.includes('ferry')) return '#3b82f6';
    if (t.includes('fishing')) return '#f97316';
    if (t.includes('tug') || t.includes('pilot')) return '#06b6d4';
    if (t.includes('yacht') || t.includes('sailing')) return '#d946ef';
    if (t.includes('military') || t.includes('law')) return '#111827';
    return '#9ca3af';
  };

  const mapMarkers = useMemo<MapMarker[]>(() => {
    const m: MapMarker[] = [];

    // Live drones from InfluxDB
    const liveDrones = droneData?.getLiveDrones || [];
    liveDrones.forEach((d: any) => {
      m.push({ id: d.id, position: d.position, type: 'drone', label: d.droneName, color: '#22c55e', meta: { battery: d.battery, altitude: d.altitude, mission: d.missionId, droneType: d.droneType } });
    });

    // AI detections removed — only live data renders on the map

    const vessels = aisData?.getAISVessels || [];
    if (showAIS) {
      vessels.forEach((v: any) => {
        m.push({ id: v.id, position: v.position, type: 'ais', label: v.name, color: getAISColor(v.type), heading: v.heading || v.course || 0, meta: { type: v.type, speed: v.speed, length: v.length || 'N/A' } });
      });
    }

    const aircraft = flightData?.getLiveFlights || [];
    if (showADSB) {
      aircraft.forEach((a: any) => {
        m.push({ id: a.id, position: a.position, type: 'adsb', label: a.callsign, color: '#facc15', heading: a.heading || 0, meta: { altitude: a.altitude, speed: a.speed, aircraftType: a.aircraftType } });
      });
    }

    if (showWeather) {
      const weather = weatherData?.weather || mockWeatherData;
      weather.forEach((w: any) => {
        m.push({ id: w.id, position: w.position, type: 'weather', label: w.description, color: '#3b82f6', meta: { temp: w.temp, value: w.value, unit: w.unit } });
      });
    }
    return m;
  }, [showAIS, showADSB, showWeather, aisData, droneData, flightData, weatherData]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (d: Date) => d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <div className="dt-root">
      {/* ═══ HEADER BAR ═══ */}
      <header className="dt-header">
        <div className="dt-header-left">
          <div className="dt-header-time-block">
            <Clock className="w-4 h-4 text-[#21A68D]" />
            <span className="dt-header-time">{formatTime(currentTime)}</span>
            <span className="dt-header-tz">WIB</span>
          </div>
          <div className="dt-sep" />
          <span className="dt-header-date">
            {currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </span>
        </div>

        <div className="dt-header-center">
          <div className="dt-title-text">
            <h1 className="dt-main-title text-center">MARIVIEW COMMAND CENTER</h1>
            <span className="dt-sub-title block text-center">Maritime Digital Twin v2.0</span>
          </div>
        </div>

        <div className="dt-header-right">
          <div className="dt-header-wx-item">
            <Cloud className="w-4 h-4 text-blue-400" />
            <span className="dt-header-wx-val">28°C</span>
            <span className="dt-header-wx-label">Partly Cloudy</span>
          </div>
          <div className="dt-sep" />
          <div className="dt-header-wx-item">
            <Wind className="w-4 h-4 text-cyan-500" />
            <span className="dt-header-wx-val">12.5 kn</span>
            <span className="dt-header-wx-label">Wind Speed</span>
          </div>
          <div className="dt-sep" />
          <div className="dt-header-sys">
            <div className="dt-sys-dot" />
            <span className="dt-header-wx-label">SYSTEM ONLINE</span>
          </div>
        </div>
      </header>

      {/* ═══ FULL-SCREEN MAP (behind everything) ═══ */}
      <div className="dt-map-fullscreen">
        <div className="dt-map-title-overlay">
          Ministry of Marine Affairs and Fisheries RI
        </div>
        <DigitalTwinMap
          is3D={is3D}
          markers={mapMarkers}
          geofences={mockGeofences as any}
          mapView={mapView}
          onMarkerClick={(id) => {
            console.log('[MAP] Marker clicked:', id);
          }}
        />
      </div>

      {/* ═══ OVERLAY CONTENT (floats above the map) ═══ */}
      <div className="dt-body">
        {/* LEFT SIDEBAR */}
        <aside className={`dt-sidebar dt-sidebar-left ${leftCollapsed ? 'dt-collapsed' : ''}`}>
          <button className="dt-toggle-btn dt-toggle-left" onClick={() => setLeftCollapsed(!leftCollapsed)}>
            {leftCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>

          <div className="dt-sidebar-content">
            {/* Stats Cards */}
            <div className="dt-stat-grid">
              <div className="dt-stat-card dt-border-accent">
                <p className="dt-stat-label">Missions</p>
                <div className="dt-stat-row">
                  <span className="dt-stat-value">{mockMissionSummary.totalMissions}</span>
                  <Target className="w-4 h-4 text-[#21A68D]" />
                </div>
              </div>
              <div className="dt-stat-card" style={{ borderLeftColor: '#D4E268' }}>
                <p className="dt-stat-label">Detections</p>
                <div className="dt-stat-row">
                  <span className="dt-stat-value" style={{ color: '#D4E268' }}>{mockMissionSummary.totalDetections}</span>
                  <Eye className="w-4 h-4 text-[#D4E268]" />
                </div>
              </div>
              <div className="dt-stat-card" style={{ borderLeftColor: '#ef4444' }}>
                <p className="dt-stat-label">Anomalies</p>
                <div className="dt-stat-row">
                  <span className="dt-stat-value" style={{ color: '#ef4444' }}>{mockMissionSummary.totalAnomalies}</span>
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                </div>
              </div>
              <div className="dt-stat-card" style={{ borderLeftColor: '#3b82f6' }}>
                <p className="dt-stat-label">Flights</p>
                <div className="dt-stat-row">
                  <span className="dt-stat-value">{(droneData?.getLiveDrones || []).length}</span>
                  <Activity className="w-4 h-4 text-blue-400" />
                </div>
              </div>
            </div>

            {/* Active Operations */}
            <div className="dt-panel">
              <h3 className="dt-panel-title"><Radio className="w-3 h-3 text-emerald-400 animate-pulse" /> Active Operations ({(droneData?.getLiveDrones || []).length})</h3>
              <div className="dt-panel-body">
                {(droneData?.getLiveDrones || []).map((d: any) => (
                  <div key={d.id} className="dt-op-card">
                    <div className="dt-op-header">
                      <div className="dt-op-name"><div className="dt-dot-live" />{d.droneName}</div>
                      <Badge className="dt-badge-sm">{d.droneType}</Badge>
                    </div>
                    <p className="dt-op-mission">{d.missionId}</p>
                    <div className="dt-op-telem">
                      <div><span className="dt-telem-label">Bat</span><span className="dt-telem-val text-emerald-400">{d.battery}%</span></div>
                      <div><span className="dt-telem-label">Alt</span><span className="dt-telem-val">{d.altitude}m</span></div>
                    </div>
                    <div className="dt-progress-bg"><div className="dt-progress-fill" style={{ width: `${d.battery}%` }} /></div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Missions */}
            <div className="dt-panel dt-panel-grow">
              <h3 className="dt-panel-title"><Target className="w-3 h-3 text-[#21A68D]" /> Recent Missions</h3>
              <div className="dt-panel-body dt-panel-scroll">
                {mockMissions.slice(0, 5).map((mission: any) => {
                  const sc = mission.status === 'completed' ? '#22c55e' : mission.status === 'active' ? '#D4E268' : '#ef4444';
                  return (
                    <div key={mission.id} className="dt-mission-card">
                      <div className="dt-mission-header">
                        <span className="dt-mission-name">{mission.name}</span>
                        <div className="dt-dot-status" style={{ background: sc }} />
                      </div>
                      <p className="dt-mission-meta">{mission.droneType} • {mission.location}</p>
                      <div className="dt-mission-stats">
                        <div><span className="dt-telem-label">Flights</span><span className="dt-telem-val">{mission.totalFlights}</span></div>
                        <div><span className="dt-telem-label">Area</span><span className="dt-telem-val">{mission.coverageArea}km²</span></div>
                        <div><span className="dt-telem-label">Det</span><span className="dt-telem-val text-[#21A68D]">{mission.totalDetections}</span></div>
                      </div>
                      <div className="dt-progress-bg"><div className="dt-progress-fill" style={{ width: `${(mission.completedFlights / mission.totalFlights) * 100}%` }} /></div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </aside>

        {/* CENTER SPACER — lets map show through */}
        <div className="dt-center-spacer">
          {/* TOP RIGHT: LAYER TOGGLES */}
          <div className="dt-layer-controls">
            <button
              className={`dt-layer-master-btn ${showLayersDropdown ? 'dt-layer-master-active' : ''}`}
              onClick={() => setShowLayersDropdown(!showLayersDropdown)}
              title="Map Layers"
            >
              <Layers className="w-4 h-4" />
            </button>

            {showLayersDropdown && (
              <div className="dt-layer-dropdown">
                <button className={`dt-layer-item ${showAIS ? 'dt-layer-item-on text-blue-500' : ''}`} onClick={() => setShowAIS(!showAIS)}>
                  <Ship className="w-4 h-4" />
                  <span>AIS Vessels</span>
                </button>
                <button className={`dt-layer-item ${showADSB ? 'dt-layer-item-on text-yellow-500' : ''}`} onClick={() => setShowADSB(!showADSB)}>
                  <Radio className="w-4 h-4" />
                  <span>ADSB Aircraft</span>
                </button>
                <button className={`dt-layer-item ${showWeather ? 'dt-layer-item-on text-sky-500' : ''}`} onClick={() => setShowWeather(!showWeather)}>
                  <Cloud className="w-4 h-4" />
                  <span>Weather</span>
                </button>
              </div>
            )}
          </div>

          {/* Map Controls Floating (Bottom) */}
          <div className="dt-map-controls">
            <button className={`dt-map-btn ${mapView === 'kupang' ? 'dt-map-btn-active' : ''}`} onClick={() => setMapView('kupang')}>
              <Home className="w-3.5 h-3.5" /> Kupang
            </button>
            <button className={`dt-map-btn ${mapView === 'indonesia' ? 'dt-map-btn-active' : ''}`} onClick={() => setMapView('indonesia')}>
              <Globe className="w-3.5 h-3.5" /> Indonesia
            </button>
            <div className="dt-sep-v" />
            <button className={`dt-map-btn ${is3D ? 'dt-map-btn-active' : ''}`} onClick={() => setIs3D(!is3D)}>
              <TrendingUp className={`w-3.5 h-3.5 transition-transform ${is3D ? 'rotate-45' : ''}`} /> 3D
            </button>
          </div>
        </div>

        {/* RIGHT SIDEBAR */}
        <aside className={`dt-sidebar dt-sidebar-right ${rightCollapsed ? 'dt-collapsed' : ''}`}>
          <button className="dt-toggle-btn dt-toggle-right" onClick={() => setRightCollapsed(!rightCollapsed)}>
            {rightCollapsed ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>

          <div className="dt-sidebar-content">
            {/* Fleet Summary */}
            <div className="dt-stat-grid">
              <div className="dt-stat-card" style={{ borderLeftColor: '#3b82f6' }}>
                <p className="dt-stat-label">AIS Vessels</p>
                <div className="dt-stat-row">
                  <span className="dt-stat-value">{aisData?.getAISVessels?.length || 0}</span>
                  <Ship className="w-4 h-4 text-blue-400" />
                </div>
              </div>
              <div className="dt-stat-card" style={{ borderLeftColor: '#eab308' }}>
                <p className="dt-stat-label">Aircraft</p>
                <div className="dt-stat-row">
                  <span className="dt-stat-value">{(flightData?.getLiveFlights || []).length}</span>
                  <Radio className="w-4 h-4 text-yellow-400" />
                </div>
              </div>
              <div className="dt-stat-card dt-border-accent">
                <p className="dt-stat-label">Fleet</p>
                <div className="dt-stat-row">
                  <span className="dt-stat-value">{(droneData?.getLiveDrones || []).length}</span>
                  <Activity className="w-4 h-4 text-[#21A68D]" />
                </div>
              </div>
              <div className="dt-stat-card" style={{ borderLeftColor: '#a855f7' }}>
                <p className="dt-stat-label">Success</p>
                <div className="dt-stat-row">
                  <span className="dt-stat-value">{mockMissionSummary.successRate}%</span>
                  <TrendingUp className="w-4 h-4 text-purple-400" />
                </div>
              </div>
            </div>

            {/* Vessel Traffic */}
            <div className="dt-panel dt-panel-grow">
              <h3 className="dt-panel-title"><Ship className="w-3 h-3 text-blue-400" /> Vessel Traffic ({(aisData?.getAISVessels || []).length})</h3>
              <div className="dt-panel-body dt-panel-scroll">
                {(aisData?.getAISVessels || []).map((vessel: any) => (
                  <div key={vessel.id} className="dt-vessel-card">
                    <div className="dt-vessel-header">
                      <div className="dt-vessel-name">
                        <div className="dt-dot-vessel" style={{ background: getAISColor(vessel.type) }} />
                        {vessel.name}
                      </div>
                      <span className="dt-vessel-speed">{vessel.speed} kn</span>
                    </div>
                    <div className="dt-vessel-meta">
                      <span>{vessel.type}</span>
                      <span>{(vessel as any).length || '—'}m</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* AI Visual Intel */}
            <div className="dt-panel">
              <h3 className="dt-panel-title"><Eye className="w-3 h-3 text-[#D4E268]" /> AI Visual Intel</h3>
              <div className="dt-ai-grid">
                {detectionResults.slice(0, 4).map(res => (
                  <div key={res.id} className="dt-ai-thumb" onClick={() => setSelectedDetection(res)}>
                    <img src={res.image} className="dt-ai-img" alt="" />
                    <div className="dt-ai-overlay">
                      <span className="dt-ai-type">{res.type}</span>
                      <span className="dt-ai-conf">{res.confidence}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* ═══ DETECTION DIALOG ═══ */}
      <Dialog open={!!selectedDetection} onOpenChange={() => setSelectedDetection(null)}>
        <DialogContent className="max-w-2xl bg-[#0a0e1a]/95 border-white/10 backdrop-blur-xl text-white">
          {selectedDetection && (
            <>
              <DialogHeader>
                <DialogTitle className="text-white">{selectedDetection.type}</DialogTitle>
                <DialogDescription className="text-white/60">{selectedDetection.mission || selectedDetection.missionId}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="relative aspect-video bg-black rounded-xl overflow-hidden border border-white/5">
                  <ImageWithFallback src={selectedDetection.captureImage || selectedDetection.image} alt={selectedDetection.type} className="w-full h-full object-cover" />
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="bg-white/5 p-3 rounded-xl"><p className="text-white/40 mb-1">Detected</p><p className="text-lg font-bold text-white">{selectedDetection.detected || 'N/A'}</p></div>
                  <div className="bg-white/5 p-3 rounded-xl"><p className="text-white/40 mb-1">Confidence</p><p className="text-lg font-bold text-emerald-400">{selectedDetection.confidence}%</p></div>
                  {selectedDetection.location && <div className="bg-white/5 p-3 rounded-xl"><p className="text-white/40 mb-1">Location</p><p className="text-sm text-white">{selectedDetection.location}</p></div>}
                  {selectedDetection.timestamp && <div className="bg-white/5 p-3 rounded-xl"><p className="text-white/40 mb-1">Timestamp</p><p className="text-sm text-white">{selectedDetection.timestamp}</p></div>}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ═══ SCOPED STYLES ═══ */}
      <style>{`
        /* ---- ROOT LAYOUT ---- */
        .dt-root {
          display: flex;
          flex-direction: column;
          width: 100%;
          height: 100%;
          overflow: hidden;
          background: #060a14;
          position: relative;
        }

        /* ---- HEADER ---- */
        .dt-header {
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 20px;
          height: 52px;
          background: rgba(8, 12, 22, 0.92);
          backdrop-filter: blur(16px);
          border-bottom: 1px solid rgba(255,255,255,0.06);
          z-index: 50;
        }
        .dt-header-left,
        .dt-header-center,
        .dt-header-right {
          display: flex;
          align-items: center;
          gap: 14px;
        }
        .dt-header-center {
          flex: 1;
          justify-content: center;
        }
        .dt-header-time-block {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .dt-header-time {
          font-size: 20px;
          font-weight: 800;
          color: white;
          letter-spacing: 0.03em;
          font-variant-numeric: tabular-nums;
        }
        .dt-header-tz {
          font-size: 10px;
          font-weight: 700;
          color: #21A68D;
          text-transform: uppercase;
        }
        .dt-header-date {
          font-size: 11px;
          font-weight: 600;
          color: rgba(255,255,255,0.5);
          text-transform: uppercase;
          letter-spacing: 0.12em;
        }
        .dt-sep {
          width: 1px;
          height: 20px;
          background: rgba(255,255,255,0.1);
        }
        .dt-main-title {
          font-size: 14px;
          font-weight: 800;
          color: white;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          margin: 0;
        }
        .dt-sub-title {
          font-size: 9px;
          font-weight: 600;
          color: #21A68D;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          opacity: 0.8;
        }
        .dt-sep-v {
          width: 1px;
          height: 24px;
          background: rgba(255,255,255,0.1);
          margin: 0 4px;
        }
        .dt-header-wx-item {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .dt-header-wx-val {
          font-size: 13px;
          font-weight: 700;
          color: white;
        }
        .dt-header-wx-label {
          font-size: 10px;
          font-weight: 600;
          color: rgba(255,255,255,0.4);
          text-transform: uppercase;
          letter-spacing: 0.1em;
        }
        .dt-header-sys {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .dt-sys-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #22c55e;
          animation: dt-blink 2s infinite;
        }
        @keyframes dt-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }

        /* ---- FULL-SCREEN MAP BACKGROUND ---- */
        .dt-map-fullscreen {
          position: absolute;
          inset: 0;
          z-index: 0;
        }
        .dt-map-title-overlay {
          position: absolute;
          top: 72px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 45;
          pointer-events: none;
          color: white;
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.3em;
          background: rgba(8, 12, 22, 0.6);
          padding: 8px 32px;
          border-radius: 99px;
          border: 1px solid rgba(255, 255, 255, 0.15);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          white-space: nowrap;
          box-shadow: 0 4px 20px rgba(0,0,0,0.5);
          text-shadow: 0 0 10px rgba(255,255,255,0.2);
        }

        /* ---- BODY: Overlay layout ---- */
        .dt-body {
          flex: 1;
          display: flex;
          min-height: 0;
          overflow: hidden;
          position: relative;
          z-index: 10;
          pointer-events: none; /* Let clicks pass to map */
        }

        /* ---- SIDEBARS ---- */
        .dt-sidebar {
          width: 300px;
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding: 10px;
          overflow: visible; /* To let toggle button show outside */
          background: rgba(8, 12, 22, 0.3); /* Subtle base layer */
          backdrop-filter: blur(8px);
          border-right: none;
          pointer-events: auto;
          position: relative;
          transition: width 0.4s cubic-bezier(0.4, 0, 0.2, 1), padding 0.4s cubic-bezier(0.4, 0, 0.2, 1), background 0.4s;
          z-index: 40;
        }
        .dt-sidebar-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 8px;
          width: 280px; /* Fixed width to prevent content squishing during transition */
          transition: opacity 0.3s ease-in-out;
          opacity: 1;
          min-height: 0;
        }
        .dt-collapsed {
          width: 0 !important;
          padding: 0 !important;
          background: transparent !important;
          backdrop-filter: none !important;
          border-color: transparent !important;
        }
        .dt-collapsed .dt-sidebar-content {
          opacity: 0;
          pointer-events: none;
          overflow: hidden;
        }

        .dt-toggle-btn {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          width: 24px;
          height: 48px;
          background: rgba(8, 12, 22, 0.85);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(255,255,255,0.1);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          z-index: 100;
          transition: all 0.2s;
        }
        .dt-toggle-btn:hover { background: #21A68D; color: white; border-color: #21A68D; }
        
        .dt-toggle-left {
          right: -24px;
          border-radius: 0 8px 8px 0;
          border-left: none;
        }
        .dt-toggle-right {
          left: -24px;
          border-radius: 8px 0 0 8px;
          border-right: none;
        }

        .dt-sidebar-right {
          border-right: none;
          border-left: none;
        }
        .dt-center-spacer {
          flex: 1;
          position: relative;
          min-width: 0;
          pointer-events: none;
        }
        .dt-sidebar::-webkit-scrollbar { width: 3px; }
        .dt-sidebar::-webkit-scrollbar-track { background: transparent; }
        .dt-sidebar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }

        /* ---- STAT GRID ---- */
        .dt-stat-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 6px;
        }
        .dt-stat-card {
          background: rgba(8, 12, 22, 0.82);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border: 1px solid rgba(255,255,255,0.1);
          border-left: 3px solid transparent;
          border-radius: 12px;
          padding: 12px;
          box-shadow: 0 4px 15px rgba(0,0,0,0.2);
        }
        .dt-border-accent { border-left-color: #21A68D; }
        .dt-stat-label {
          font-size: 9px;
          font-weight: 800;
          color: rgba(255,255,255,0.35);
          text-transform: uppercase;
          letter-spacing: 0.15em;
          margin-bottom: 4px;
        }
        .dt-stat-row {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
        }
        .dt-stat-value {
          font-size: 22px;
          font-weight: 900;
          color: white;
          line-height: 1;
        }

        /* ---- PANELS ---- */
        .dt-panel {
          background: rgba(8, 12, 22, 0.82);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 12px;
          padding: 14px;
          display: flex;
          flex-direction: column;
          box-shadow: 0 4px 15px rgba(0,0,0,0.2);
        }
        .dt-panel-grow {
          flex: 1;
          min-height: 0;
          display: flex;
          flex-direction: column;
        }
        .dt-panel-title {
          font-size: 10px;
          font-weight: 800;
          color: rgba(255,255,255,0.8);
          text-transform: uppercase;
          letter-spacing: 0.15em;
          margin-bottom: 10px;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .dt-panel-body {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .dt-panel-scroll {
          flex: 1;
          overflow-y: auto;
          min-height: 0;
          padding-right: 4px;
        }
        .dt-panel-scroll::-webkit-scrollbar { width: 3px; }
        .dt-panel-scroll::-webkit-scrollbar-track { background: transparent; }
        .dt-panel-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 10px; }

        /* ---- OP CARDS ---- */
        .dt-op-card {
          background: transparent;
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 8px;
          padding: 10px;
          transition: background 0.2s;
        }
        .dt-op-card:hover { background: rgba(255,255,255,0.04); }
        .dt-op-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; }
        .dt-op-name { display: flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 700; color: white; }
        .dt-dot-live { width: 5px; height: 5px; border-radius: 50%; background: #22c55e; animation: dt-blink 2s infinite; }
        .dt-badge-sm { font-size: 8px !important; background: rgba(33,166,141,0.1) !important; color: #21A68D !important; border: none !important; padding: 0 6px !important; height: 16px !important; }
        .dt-op-mission { font-size: 9px; color: rgba(255,255,255,0.35); margin-bottom: 6px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .dt-op-telem { display: flex; gap: 16px; font-size: 9px; }
        .dt-telem-label { color: rgba(255,255,255,0.3); margin-right: 4px; }
        .dt-telem-val { font-weight: 700; color: white; }
        .dt-progress-bg { height: 2px; background: rgba(255,255,255,0.05); border-radius: 2px; margin-top: 6px; overflow: hidden; }
        .dt-progress-fill { height: 100%; background: #21A68D; border-radius: 2px; transition: width 0.3s; }

        /* ---- MISSION CARDS ---- */
        .dt-mission-card {
          background: transparent;
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 8px;
          padding: 10px;
        }
        .dt-mission-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 3px; }
        .dt-mission-name { font-size: 10px; font-weight: 700; color: white; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; }
        .dt-dot-status { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; margin-left: 6px; }
        .dt-mission-meta { font-size: 9px; color: rgba(255,255,255,0.3); margin-bottom: 6px; }
        .dt-mission-stats { display: flex; gap: 14px; font-size: 9px; }

        /* ---- VESSEL CARDS ---- */
        .dt-vessel-card {
          background: transparent;
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 8px;
          padding: 8px 10px;
          transition: background 0.2s;
        }
        .dt-vessel-card:hover { background: rgba(255,255,255,0.04); }
        .dt-vessel-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 2px; }
        .dt-vessel-name { display: flex; align-items: center; gap: 6px; font-size: 10px; font-weight: 700; color: white; }
        .dt-dot-vessel { width: 5px; height: 5px; border-radius: 50%; flex-shrink: 0; }
        .dt-vessel-speed { font-size: 10px; font-weight: 700; color: rgba(255,255,255,0.5); }
        .dt-vessel-meta { display: flex; justify-content: space-between; font-size: 9px; color: rgba(255,255,255,0.3); }

        /* ---- AI THUMBS ---- */
        .dt-ai-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
        .dt-ai-thumb {
          position: relative;
          aspect-ratio: 1;
          border-radius: 8px;
          overflow: hidden;
          border: 1px solid rgba(255,255,255,0.05);
          cursor: pointer;
          transition: border-color 0.2s;
        }
        .dt-ai-thumb:hover { border-color: rgba(212,226,104,0.4); }
        .dt-ai-img { width: 100%; height: 100%; object-fit: cover; opacity: 0.5; transition: opacity 0.2s; }
        .dt-ai-thumb:hover .dt-ai-img { opacity: 0.85; }
        .dt-ai-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 60%);
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
          padding: 6px;
        }
        .dt-ai-type { font-size: 8px; font-weight: 700; color: rgba(255,255,255,0.8); }
        .dt-ai-conf { font-size: 7px; color: rgba(255,255,255,0.4); }

        /* ---- MAP CONTROLS ---- */
        .dt-map-controls {
          position: absolute;
          bottom: 16px;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 10px;
          background: rgba(8, 12, 22, 0.85);
          backdrop-filter: blur(16px);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 14px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.3);
          z-index: 40;
          pointer-events: auto; /* Enable clicks for controls */
        }
        .dt-map-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          border-radius: 8px;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: rgba(255,255,255,0.4);
          background: transparent;
          border: 1px solid transparent;
          cursor: pointer;
          transition: all 0.2s;
        }
        .dt-map-btn:hover { color: white; background: rgba(255,255,255,0.05); }
        .dt-map-btn-active {
          color: #21A68D !important;
          background: rgba(33,166,141,0.1) !important;
          border-color: rgba(33,166,141,0.2) !important;
        }
        .dt-map-btn-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 34px;
          height: 34px;
          border-radius: 8px;
          color: rgba(255,255,255,0.3);
          background: transparent;
          border: 1px solid transparent;
          cursor: pointer;
          transition: all 0.2s;
        }
        .dt-map-btn-icon:hover { background: rgba(255,255,255,0.05); }
        .dt-map-btn-icon-on {
          background: rgba(255,255,255,0.06) !important;
          border-color: rgba(255,255,255,0.1) !important;
        }

        /* ---- LAYER CONTROLS (Top Right) ---- */
        .dt-layer-controls {
          position: absolute;
          top: 16px;
          right: 16px;
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 8px;
          z-index: 45;
          pointer-events: auto;
        }
        .dt-layer-master-btn {
          width: 42px;
          height: 42px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(8, 12, 22, 0.85);
          backdrop-filter: blur(16px);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 12px;
          color: white;
          cursor: pointer;
          transition: all 0.2s;
          box-shadow: 0 4px 15px rgba(0,0,0,0.3);
        }
        .dt-layer-master-btn:hover { background: rgba(33,166,141,0.2); border-color: rgba(33,166,141,0.4); }
        .dt-layer-master-active {
          color: #21A68D;
          border-color: rgba(33,166,141,0.5);
          background: rgba(33,166,141,0.15);
        }
        .dt-layer-dropdown {
          display: flex;
          flex-direction: column;
          gap: 4px;
          padding: 6px;
          background: rgba(8, 12, 22, 0.85);
          backdrop-filter: blur(16px);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 12px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.4);
          min-width: 160px;
          animation: dt-slide-in 0.2s ease-out;
        }
        @keyframes dt-slide-in {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .dt-layer-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 12px;
          border-radius: 8px;
          background: transparent;
          border: none;
          color: rgba(255,255,255,0.5);
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          cursor: pointer;
          transition: all 0.2s;
          text-align: left;
        }
        .dt-layer-item:hover { background: rgba(255,255,255,0.05); color: white; }
        .dt-layer-item-on {
          background: rgba(255,255,255,0.05);
          color: white !important;
        }

        /* ---- MARKER ANIMATIONS ---- */
        .twin-marker-pulse { animation: twin-pulse 2s ease-out infinite; }
        @keyframes twin-pulse {
          0% { transform: scale(0.7); opacity: 0.8; }
          100% { transform: scale(1.6); opacity: 0; }
        }

        /* ---- RESPONSIVENESS (iPad Focus) ---- */
        @media (max-width: 1024px) {
          .dt-sidebar { width: 240px; }
          .dt-sidebar-content { width: 220px; }
          .dt-header-left, .dt-header-right { gap: 8px; }
          .dt-header-wx-label { display: none; }
        }

        @media (max-width: 768px) {
          .dt-sidebar { width: 200px; }
          .dt-sidebar-content { width: 180px; }
          .dt-stat-grid { grid-template-columns: 1fr; }
          .dt-header-date { display: none; }
          .dt-header-time { font-size: 16px; }
          .dt-title-text h1 { font-size: 12px; }
          .dt-map-title-overlay { font-size: 9px; padding: 6px 16px; top: 60px; }
        }
      `}</style>
    </div>
  );
}
