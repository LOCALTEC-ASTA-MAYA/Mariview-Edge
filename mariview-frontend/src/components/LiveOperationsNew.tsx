import { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useQuery, useMutation } from '@apollo/client';
import { GET_MISSION_BY_ID, GET_MISSION_TELEMETRY, GET_AIS_VESSELS, GET_ADSB_AIRCRAFT, GET_WEATHER, ABORT_MISSION, GET_MISSIONS } from '../graphql/queries';
import MissionMap from './MissionMap';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { VisuallyHidden } from './ui/visually-hidden';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
// Mock detection images removed — real YOLO snapshots come via WebSocket
import MapOverlayControls from './MapOverlayControls';
import { mockAISData, mockADSBData, mockGeofences, mockENCData } from '../data/mock-data';
import { useVisionWebSocket } from '../hooks/useVisionWebSocket';
import { useHlsPlayer } from '../hooks/useHlsPlayer';
import BoundingBoxOverlay from './BoundingBoxOverlay';
import {
  Battery,
  Gauge,
  Navigation,
  Radio,
  Satellite,
  Layers,
  Eye,
  EyeOff,
  Thermometer,
  Wind,
  Compass,
  MapPin,
  Clock,
  Activity,
  Zap,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  Ship,
  Plane as PlaneIcon,
  Waves,
  Maximize2,
  Minimize2,
  X,
  Square,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

// Default telemetry shape (used as fallback before live data arrives)
const defaultTelemetry = {
  altitude: 0,
  speed: 0,
  battery: 0,
  distance: 0,
  signal: 0,
  satellites: 0,
  droneHeight: 0,
  temperature: 0,
  windSpeed: 0,
  heading: 0,
  voltage: 0,
  current: 0,
  latitude: -10.1950,
  longitude: 123.5450,
  flightTime: '00:00:00',
  isLanding: false,
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'active': return '#22c55e';
    case 'warning': return '#D4E268';
    case 'critical': return '#ef4444';
    default: return '#71717a';
  }
};

const getBatteryColor = (battery: number) => {
  if (battery > 50) return '#22c55e';
  if (battery > 20) return '#D4E268';
  return '#ef4444';
};

const getSignalColor = (signal: number) => {
  if (signal > 80) return '#22c55e';
  if (signal > 50) return '#D4E268';
  return '#ef4444';
};

interface LiveOperationsProps {
  missionId?: string | null;
  onEndFlightComplete?: () => void;
}

export default function LiveOperations({ missionId, onEndFlightComplete }: LiveOperationsProps) {
  // Fetch real mission data from Postgres (micro-surgery injection)
  const { data: missionData } = useQuery(GET_MISSION_BY_ID, {
    variables: { id: missionId },
    skip: !missionId,
  });
  const realMission = missionData?.getMissionById;

  // Build live operation from real DB mission data (no more hardcoded dummy)
  const operationFromMission = useMemo(() => ({
    id: realMission?.id || missionId || 'OP-LIVE',
    droneName: realMission?.asset?.name || 'Drone',
    droneType: realMission?.asset?.type || 'UAV',
    pilot: realMission?.pilot?.name || 'Operator',
    status: 'active' as const,
    mission: realMission?.name || 'Live Mission',
    videoId: '',
    location: { lat: -10.1735, lng: 123.5250 },
    telemetry: { ...defaultTelemetry },
    aiDetections: [] as any[],
  }), [realMission, missionId]);

  // Abort / End Flight mutation
  const [abortMissionMutation, { loading: isEnding }] = useMutation(ABORT_MISSION, {
    refetchQueries: [{ query: GET_MISSIONS }],
  });

  // Video ready state — gates WebSocket data processing
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [isModalVideoReady, setIsModalVideoReady] = useState(false);

  // Live AI Vision WebSocket — only processes data when video is playing
  const { detections: liveDetections, lastFrame, isConnected: wsConnected, frameCount, telemetry: liveTelemetry, detectionHistory } = useVisionWebSocket(3000, isVideoReady);

  // Video refs
  const sidebarVideoRef = useRef<HTMLVideoElement>(null);
  const fullscreenVideoRef = useRef<HTMLVideoElement>(null);

  const [liveOperations, setLiveOperations] = useState([operationFromMission]);
  const [selectedDrone, setSelectedDrone] = useState(operationFromMission);

  // Sync state when real mission data arrives from DB
  useEffect(() => {
    setLiveOperations([operationFromMission]);
    setSelectedDrone(operationFromMission);
  }, [operationFromMission]);

  // GraphQL fetching for telemetry — uses real mission ID, not mock drone ID
  const { data: telemetryData, loading: telemetryLoading } = useQuery(GET_MISSION_TELEMETRY, {
    variables: { missionId: missionId },
    skip: !missionId,
    pollInterval: 2000,
  });

  // GraphQL fetching for other layers
  const { data: aisData } = useQuery(GET_AIS_VESSELS, { pollInterval: 5000 });
  const { data: adsbData } = useQuery(GET_ADSB_AIRCRAFT, { pollInterval: 5000 });
  const { data: weatherData } = useQuery(GET_WEATHER, { pollInterval: 10000 });

  const aisMarkers = useMemo(() => {
    if (!aisData?.aisVessels) return mockAISData;
    return aisData.aisVessels.map((v: any) => ({
      ...v,
      position: [v.position?.[0] || 0, v.position?.[1] || 0] as [number, number]
    }));
  }, [aisData]);

  const adsbMarkers = useMemo(() => {
    if (!adsbData?.adsbAircraft) return mockADSBData;
    return adsbData.adsbAircraft.map((a: any) => ({
      ...a,
      position: [a.position?.[0] || 0, a.position?.[1] || 0] as [number, number]
    }));
  }, [adsbData]);

  const weatherMarkers = useMemo(() => {
    if (!weatherData?.weather) return [];
    return weatherData.weather.map((w: any) => ({
      ...w,
      position: [w.position?.[0] || 0, w.position?.[1] || 0] as [number, number]
    }));
  }, [weatherData]);

  // Sync GraphQL telemetry to state
  useEffect(() => {
    if (telemetryData?.missionTelemetry && telemetryData.missionTelemetry.length > 0) {
      const latest = telemetryData.missionTelemetry[telemetryData.missionTelemetry.length - 1];
      setLiveOperations(prev => prev.map(drone => {
        if (drone.id === latest.flightId) {
          return {
            ...drone,
            location: { lat: latest.lat, lng: latest.lon },
            telemetry: {
              ...drone.telemetry,
              latitude: latest.lat,
              longitude: latest.lon,
              // Other fields if available in schema
            }
          };
        }
        return drone;
      }));
    }
  }, [telemetryData]);

  const [showAIS, setShowAIS] = useState(true);
  const [showADSB, setShowADSB] = useState(true);
  const [showENC, setShowENC] = useState(false);
  const [showWeather, setShowWeather] = useState(false);
  const [mapView, setMapView] = useState<'kupang' | 'indonesia'>('kupang');
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);
  const [mapKey, setMapKey] = useState(0);
  const [isVideoFullscreen, setIsVideoFullscreen] = useState(false);

  // End Flight Dialog States
  const [showEndFlightDialog, setShowEndFlightDialog] = useState(false);
  const [droneToEnd, setDroneToEnd] = useState<any>(null);


  // Sidebar HLS — always active
  useHlsPlayer(sidebarVideoRef, true);

  // Fullscreen HLS — lifecycle-aware: create/destroy when Dialog opens/closes
  const fullscreenHlsRef = useRef<any>(null);
  useEffect(() => {
    if (!isVideoFullscreen) {
      // Dialog closed → destroy HLS instance
      if (fullscreenHlsRef.current) {
        fullscreenHlsRef.current.destroy();
        fullscreenHlsRef.current = null;
      }
      return;
    }

    let cancelled = false;

    // Jump to live edge when tab regains focus (hoisted for cleanup access)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && fullscreenVideoRef.current) {
        const v = fullscreenVideoRef.current;
        if (v.duration && isFinite(v.duration)) {
          v.currentTime = v.duration;
        }
        v.play().catch(() => { });
      }
    };

    const attachHls = async () => {
      const { default: Hls } = await import('hls.js');
      // Wait for Dialog to render and populate the ref
      await new Promise(r => setTimeout(r, 200));
      const video = fullscreenVideoRef.current;
      if (!video || cancelled) return;

      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          liveSyncDurationCount: 3,
          liveMaxLatencyDurationCount: 10,
          maxBufferLength: 10,
          maxMaxBufferLength: 30,
          backBufferLength: 0,
        });
        hls.loadSource('http://localhost:8888/drone-cam/index.m3u8');
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          video.play().catch(() => { });
        });
        hls.on(Hls.Events.ERROR, (_e: any, data: any) => {
          if (data.fatal) {
            if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
              setTimeout(() => hls.startLoad(), 3000);
            } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
              hls.recoverMediaError();
            }
          }
        });
        fullscreenHlsRef.current = hls;
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = 'http://localhost:8888/drone-cam/index.m3u8';
        video.play().catch(() => { });
      }

      document.addEventListener('visibilitychange', handleVisibility);
    };

    attachHls();

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', handleVisibility);
      if (fullscreenHlsRef.current) {
        fullscreenHlsRef.current.destroy();
        fullscreenHlsRef.current = null;
      }
    };
  }, [isVideoFullscreen]);

  // NOTE: Mock telemetry simulator REMOVED.
  // Real telemetry now comes from NATS TELEMETRY.drone.live → GraphQL.

  // Update selected drone with live data
  useEffect(() => {
    const updatedDrone = liveOperations.find((d) => d.id === selectedDrone.id);
    if (updatedDrone) {
      setSelectedDrone(updatedDrone);
    }
  }, [liveOperations]);

  // Trigger map resize when sidebar expands/collapses
  useEffect(() => {
    const timer = setTimeout(() => {
      // Force map to recalculate size by incrementing key
      setMapKey(prev => prev + 1);

      // Also trigger window resize event to force Leaflet map to resize
      window.dispatchEvent(new Event('resize'));
    }, 350); // Delay slightly longer than animation duration (300ms)

    return () => clearTimeout(timer);
  }, [isSidebarExpanded]);

  const handleManualEndFlight = () => {
    setDroneToEnd(selectedDrone);
    setShowEndFlightDialog(true);
  };

  const handleConfirmEndFlight = async () => {
    if (!droneToEnd) return;

    try {
      // Persist to DB: set mission status → COMPLETED
      if (missionId) {
        await abortMissionMutation({ variables: { id: missionId } });
        console.log('✅ Mission status set to COMPLETED in DB');
      }

      // Remove drone from live operations UI
      setLiveOperations(prev => prev.filter(d => d.id !== droneToEnd.id));

      // Close dialogs and reset
      setShowEndFlightDialog(false);
      setDroneToEnd(null);

      // Navigate to Mission History
      if (onEndFlightComplete) {
        setTimeout(() => onEndFlightComplete(), 300);
      }
    } catch (err: any) {
      console.error('Failed to end flight:', err);
    }
  };

  const handleCancelEndFlight = () => {
    setShowEndFlightDialog(false);
    setDroneToEnd(null);
  };

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <div className="p-2 md:p-3 border-b border-border flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-sm md:text-base text-[rgb(255,255,255)] mb-0">Live Operations</h1>
            <p className="text-muted-foreground text-[10px] md:text-xs">Real-time drone monitoring</p>
          </div>
          <Badge className="bg-[#22c55e] text-white px-2 py-0.5 text-[10px]">
            <div className="w-1.5 h-1.5 bg-white rounded-full mr-1.5 animate-pulse" />
            {liveOperations.filter(d => d.status === 'active').length} Active
          </Badge>
        </div>
      </div>

      {/* Fullscreen Video Modal — Dialog approach with lifecycle-managed HLS */}
      <Dialog open={isVideoFullscreen} onOpenChange={setIsVideoFullscreen}>
        <DialogContent className="max-w-4xl w-full p-0 bg-black border-none overflow-hidden aspect-video">
          <VisuallyHidden>
            <DialogTitle>Live Video Stream Fullscreen</DialogTitle>
            <DialogDescription>
              Fullscreen view of live drone video feed from {selectedDrone.droneName} with real-time telemetry overlay
            </DialogDescription>
          </VisuallyHidden>

          <div className="relative w-full flex-1 flex flex-col">
            {/* Header */}
            <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4 bg-gradient-to-b from-black/80 to-transparent">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1 bg-black/60 px-3 py-1.5 rounded">
                  <div className="w-2 h-2 bg-[#ef4444] rounded-full animate-pulse" />
                  <span className="text-white text-sm font-semibold">LIVE</span>
                </div>
                <div>
                  <p className="text-white font-semibold">{realMission?.asset?.name || selectedDrone.droneName}</p>
                  <p className="text-white/60 text-sm">{realMission?.name || selectedDrone.mission}</p>
                </div>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="bg-black/40 hover:bg-black/60 text-white"
                onClick={() => setIsVideoFullscreen(false)}
              >
                <X className="w-5 h-5" />
              </Button>
            </div>

            {/* Video + AI Overlay — fills entire dialog */}
            <div className="relative flex-1 bg-black overflow-hidden">
              <video
                ref={fullscreenVideoRef}
                autoPlay
                muted
                playsInline
                onPlaying={() => setIsModalVideoReady(true)}
                onWaiting={() => setIsModalVideoReady(false)}
                className="absolute inset-0 w-full h-full object-contain"
              />
              {isModalVideoReady && (
                <BoundingBoxOverlay
                  detections={liveDetections}
                  videoRef={fullscreenVideoRef}
                  sourceResolution={lastFrame?.resolution || [1920, 1080]}
                  className="z-10"
                />
              )}
              {!isModalVideoReady && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-10">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-2 border-[#21A68D]/30 border-t-[#21A68D] rounded-full animate-spin" />
                    <span className="text-white/60 text-xs font-mono tracking-wider">BUFFERING STREAM...</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Map */}
        <div className="flex-1 flex relative">
          <MissionMap
            key={`${mapView}-${mapKey}`}
            className="flex-1"
            center={mapView === 'kupang' ? [-10.1735, 123.5250] : [-2.5, 118.0]}
            zoom={mapView === 'kupang' ? 14 : 5}
            drones={liveOperations.map(op => ({
              id: op.id,
              position: (liveTelemetry?.lat && liveTelemetry?.lon)
                ? [liveTelemetry.lat, liveTelemetry.lon] as [number, number]
                : [op.location.lat, op.location.lng] as [number, number],
              name: op.droneName,
              status: op.status as any,
              color: getStatusColor(op.status)
            }))}
            aisMarkers={aisMarkers}
            adsbMarkers={adsbMarkers}
            encMarkers={mockENCData as any}
            geofences={mockGeofences as any}
            showAIS={showAIS}
            showADSB={showADSB}
            showENC={showENC}
            onDroneClick={(id) => {
              const drone = liveOperations.find(d => d.id === id);
              if (drone) setSelectedDrone(drone);
            }}
          />

          {/* Layer Toggle Dropdown -> Replaced with MapOverlayControls */}
          <MapOverlayControls
            mapView={mapView}
            onMapViewChange={setMapView}
            aisCount={showAIS ? mockAISData.length : 0}
            nonAisCount={0}
            activeUavCount={liveOperations.filter(d => d.status === 'active').length}
            anomaliesCount={0}
            showAIS={showAIS}
            showADSB={showADSB}
            showENC={showENC}
            showWeather={showWeather}
            onToggleAIS={() => setShowAIS(!showAIS)}
            onToggleADSB={() => setShowADSB(!showADSB)}
            onToggleENC={() => setShowENC(!showENC)}
            onToggleWeather={() => setShowWeather(!showWeather)}
            showViewToggle={false}
            showLegend={false}
          />
        </div>

        {/* Right Sidebar: Live Stream & AI Results - Expandable */}
        <motion.div
          className="border-l border-border flex flex-col overflow-hidden bg-[#0a0e1a] relative"
          initial={false}
          animate={{ width: isSidebarExpanded ? 384 : 48 }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
        >
          {/* Toggle Button */}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setIsSidebarExpanded(!isSidebarExpanded)}
            className="absolute top-2 left-2 z-10 bg-[#21A68D]/20 hover:bg-[#21A68D]/40 text-white"
          >
            {isSidebarExpanded ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </Button>

          <AnimatePresence>
            {isSidebarExpanded && (
              <motion.div
                className="flex-1 flex flex-col overflow-hidden"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                {/* Live Stream */}
                <div className="p-3 border-b border-white/5 flex-shrink-0 bg-white/[0.02]">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#22c55e] animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                      <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#22c55e]">Live Stream Feed</h3>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0 hover:bg-white/10 rounded-full transition-colors"
                      onClick={() => setIsVideoFullscreen(true)}
                    >
                      <Maximize2 className="w-3.5 h-3.5 text-white/60" />
                    </Button>
                  </div>
                  <div className="relative aspect-video bg-black rounded-xl overflow-hidden border border-white/10 shadow-2xl group">
                    <video
                      ref={sidebarVideoRef}
                      autoPlay
                      muted
                      playsInline
                      onPlaying={() => setIsVideoReady(true)}
                      onWaiting={() => setIsVideoReady(false)}
                      className="w-full h-full object-cover scale-105"
                    />
                    {/* Only render bboxes when video is actually playing (not buffering) */}
                    {isVideoReady && (
                      <BoundingBoxOverlay
                        detections={liveDetections}
                        videoRef={sidebarVideoRef}
                        sourceResolution={lastFrame?.resolution || [1920, 1080]}
                        className="scale-105"
                      />
                    )}
                    {/* Buffering overlay */}
                    {!isVideoReady && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-10">
                        <div className="flex flex-col items-center gap-2">
                          <div className="w-6 h-6 border-2 border-[#21A68D]/30 border-t-[#21A68D] rounded-full animate-spin" />
                          <span className="text-white/60 text-[9px] font-mono tracking-wider">BUFFERING STREAM...</span>
                        </div>
                      </div>
                    )}
                    {/* Live overlay */}
                    <div className="absolute top-3 left-3 flex items-center gap-2 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10">
                      <div className="w-1.5 h-1.5 bg-[#ef4444] rounded-full animate-pulse shadow-[0_0_5px_rgba(239,68,68,0.5)]" />
                      <span className="text-white text-[9px] font-black tracking-widest">LIVE</span>
                    </div>
                    {/* WS Status + Detection count */}
                    <div className="absolute top-3 right-3 flex items-center gap-1.5">
                      <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[8px] font-mono border ${wsConnected ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-red-500/10 text-red-400 border-red-500/30'}`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${wsConnected ? 'bg-emerald-400' : 'bg-red-400'}`} />
                        {wsConnected ? 'AI LINKED' : 'AI OFFLINE'}
                      </div>
                      {liveDetections.length > 0 && (
                        <div className="bg-[#21A68D]/10 text-[#21A68D] px-1.5 py-0.5 rounded-full text-[8px] font-mono border border-[#21A68D]/30">
                          {liveDetections.length} OBJ
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* AI Detection Results */}
                <div className="flex-1 flex flex-col min-h-0">
                  <div className="p-3 flex-shrink-0 bg-white/[0.01]">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Activity className="w-3.5 h-3.5 text-sky-400" />
                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-sky-400">AI Detection Engine</h3>
                      </div>
                      {lastFrame && (
                        <span className="text-[8px] font-mono text-white/40">
                          {lastFrame.model} • {lastFrame.inference_ms}ms • F#{frameCount}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto px-3 pb-3">
                    {/* Detection History — 50-item scrollable log, newest first */}
                    {detectionHistory.length > 0 ? (
                      <div className="space-y-2.5">
                        <div className="flex items-center gap-1.5 mb-1">
                          <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                          <span className="text-[9px] font-black uppercase tracking-[0.15em] text-emerald-400">AI Detections</span>
                          <span className="text-[9px] font-mono text-white/30 ml-auto">{detectionHistory.length} events</span>
                        </div>
                        {detectionHistory.map((det, idx) => (
                          <motion.div
                            key={`det-${idx}-${(det as any)._ts || ''}`}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx < 3 ? idx * 0.1 : 0 }}
                          >
                            <Card className="overflow-hidden bg-background/50 border-[#21A68D]/30 hover:border-[#21A68D]/60 transition-all">
                              {/* Card Header — Detection type + Confidence pill */}
                              <div className="p-2 bg-[#21A68D]/10 border-b border-[#21A68D]/30">
                                <div className="flex items-center justify-between mb-0.5">
                                  <div className="flex items-center gap-1.5">
                                    <Ship className="w-3.5 h-3.5" style={{ color: '#21A68D' }} />
                                    <span className="text-[10px] font-semibold text-white">
                                      {det.aisData?.vesselName
                                        ? 'Vessel Detection & Recognition'
                                        : det.class.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                                    </span>
                                  </div>
                                  <Badge
                                    variant="outline"
                                    className="text-[9px] font-mono"
                                    style={{
                                      borderColor: det.confidence > 0.9 ? '#22c55e' : det.confidence > 0.75 ? '#eab308' : '#ef4444',
                                      color: det.confidence > 0.9 ? '#22c55e' : det.confidence > 0.75 ? '#eab308' : '#ef4444',
                                    }}
                                  >
                                    {Math.round(det.confidence * 100)}%
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                                  <Clock className="w-3 h-3" />
                                  <span>{(det as any)._ts ? new Date((det as any)._ts).toLocaleTimeString() : '--:--:--'}</span>
                                </div>
                              </div>

                              {/* Full-frame Snapshot */}
                              {det.snapshot_b64 && (
                                <div className="relative aspect-video bg-black">
                                  <img
                                    src={`data:image/jpeg;base64,${det.snapshot_b64}`}
                                    alt={det.class}
                                    className="w-full h-full object-cover"
                                  />
                                  <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-sm px-2 py-1 rounded text-[9px] font-bold tracking-wider border border-[#21A68D]/40">
                                    <span className="text-[#21A68D]">AI DETECTED</span>
                                  </div>
                                </div>
                              )}

                              {/* Detection Details */}
                              <div className="p-2 space-y-1.5">
                                {/* Vessel name + type */}
                                {det.aisData && (
                                  <>
                                    <div className="flex items-center justify-between text-[10px]">
                                      <span className="text-muted-foreground">Vessel Name</span>
                                      <span className="font-semibold" style={{ color: '#21A68D' }}>
                                        {det.aisData.vesselName}
                                      </span>
                                    </div>
                                    <div className="flex items-center justify-between text-[10px]">
                                      <span className="text-muted-foreground">Type</span>
                                      <span className="text-white/70">{det.aisData.type}</span>
                                    </div>
                                  </>
                                )}

                                {/* AIS Correlation Table */}
                                {det.aisData && (
                                  <div className="mt-2 pt-2 border-t border-border">
                                    <div className="flex items-center gap-2 mb-2">
                                      <Radio className="w-3 h-3" style={{ color: '#0F4C75' }} />
                                      <span className="text-[10px] font-semibold" style={{ color: '#0F4C75' }}>
                                        AIS Data Correlation
                                      </span>
                                      <Badge
                                        variant="outline"
                                        className="ml-auto text-[8px]"
                                        style={{ borderColor: '#22c55e', color: '#22c55e' }}
                                      >
                                        MATCHED
                                      </Badge>
                                    </div>
                                    <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                                      <div className="p-1 px-1.5 rounded bg-muted/30">
                                        <p className="text-white/40 text-[9px]">MMSI</p>
                                        <p className="font-mono text-white/80">{det.aisData.mmsi}</p>
                                      </div>
                                      <div className="p-1 px-1.5 rounded bg-muted/30">
                                        <p className="text-white/40 text-[9px]">IMO</p>
                                        <p className="font-mono text-white/80">{det.aisData.imo}</p>
                                      </div>
                                      <div className="p-1 px-1.5 rounded bg-muted/30">
                                        <p className="text-white/40 text-[9px]">Speed</p>
                                        <p className="text-white/80">{det.aisData.speed} kn</p>
                                      </div>
                                      <div className="p-1 px-1.5 rounded bg-muted/30">
                                        <p className="text-white/40 text-[9px]">Course</p>
                                        <p className="text-white/80">{det.aisData.course}°</p>
                                      </div>
                                      <div className="p-1 px-1.5 rounded bg-muted/30">
                                        <p className="text-white/40 text-[9px]">Length</p>
                                        <p className="text-white/80">{det.aisData.length}m</p>
                                      </div>
                                      <div className="p-1 px-1.5 rounded bg-muted/30">
                                        <p className="text-white/40 text-[9px]">Draft</p>
                                        <p className="text-white/80">{det.aisData.draft}m</p>
                                      </div>
                                    </div>
                                    {(det.aisData.destination || det.aisData.eta) && (
                                      <div className="mt-2 p-2 rounded bg-[#0F4C75]/10 border border-[#0F4C75]/30">
                                        {det.aisData.destination && (
                                          <div className="flex items-center justify-between text-[10px]">
                                            <span className="text-muted-foreground">Destination</span>
                                            <span className="font-semibold text-white/80">{det.aisData.destination}</span>
                                          </div>
                                        )}
                                        {det.aisData.eta && (
                                          <div className="flex items-center justify-between text-[10px] mt-1">
                                            <span className="text-muted-foreground">ETA</span>
                                            <span className="text-white/60">{det.aisData.eta}</span>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* AIS Pending Skeleton */}
                                {det.aisData === null && (
                                  <div className="mt-2 pt-2 border-t border-white/5">
                                    <div className="flex items-center gap-2 mb-2">
                                      <Radio className="w-3 h-3 text-white/20 animate-pulse" />
                                      <span className="text-[10px] text-white/30 italic animate-pulse">
                                        Scanning AIS Signatures...
                                      </span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-1.5">
                                      {[...Array(6)].map((_, i) => (
                                        <div key={i} className="p-1 px-1.5 rounded bg-muted/10 animate-pulse">
                                          <div className="h-2 w-10 bg-white/8 rounded mb-1" />
                                          <div className="h-3 w-16 bg-white/5 rounded" />
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Confidence Bar */}
                                <div className="w-full bg-muted rounded-full h-1.5 mt-2">
                                  <div
                                    className="h-1.5 rounded-full transition-all"
                                    style={{
                                      width: `${Math.round(det.confidence * 100)}%`,
                                      backgroundColor: det.confidence > 0.9 ? '#22c55e' : det.confidence > 0.75 ? '#eab308' : '#ef4444',
                                    }}
                                  />
                                </div>
                              </div>
                            </Card>
                          </motion.div>
                        ))}
                      </div>
                    ) : (
                      <Card className="p-4 bg-background/50 border-dashed">
                        <div className="flex flex-col items-center gap-2">
                          <Eye className="w-5 h-5 text-white/20" />
                          <p className="text-[10px] text-muted-foreground text-center">
                            {wsConnected ? 'Scanning for objects...' : 'AI Vision offline — waiting for connection'}
                          </p>
                        </div>
                      </Card>
                    )}

                    {/* Sidebar Telemetry Strip */}
                    {liveTelemetry && (
                      <div className="mt-3 pt-3 border-t border-white/5">
                        <div className="flex items-center gap-1.5 mb-2">
                          <Gauge className="w-3 h-3 text-cyan-400" />
                          <span className="text-[9px] font-black uppercase tracking-[0.15em] text-cyan-400">Live Telemetry</span>
                        </div>
                        <div className="grid grid-cols-4 gap-1">
                          {[
                            { l: 'ALT', v: `${liveTelemetry.alt.toFixed(1)}m`, c: 'text-cyan-400' },
                            { l: 'SPD', v: `${liveTelemetry.spd.toFixed(1)}`, c: 'text-cyan-400' },
                            { l: 'BAT', v: `${liveTelemetry.battery.toFixed(1)}%`, c: liveTelemetry.battery < 30 ? 'text-red-400' : 'text-emerald-400' },
                            { l: 'SIG', v: `${liveTelemetry.sig.toFixed(0)}%`, c: 'text-emerald-400' },
                          ].map(t => (
                            <div key={t.l} className="text-center bg-white/[0.02] rounded py-1 border border-white/[0.04]">
                              <div className="text-[7px] text-white/30 font-black tracking-widest">{t.l}</div>
                              <div className={`text-[10px] font-mono font-bold tabular-nums ${t.c}`}>{t.v}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Collapsed State - Vertical Icons */}
          <AnimatePresence>
            {!isSidebarExpanded && (
              <motion.div
                className="flex-1 flex flex-col items-center justify-center gap-6 py-8"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <div className="flex flex-col items-center gap-2">
                  <div className="w-8 h-8 rounded bg-[#21A68D]/20 flex items-center justify-center">
                    <Activity className="w-4 h-4" style={{ color: '#21A68D' }} />
                  </div>
                  <span className="text-[10px] text-white/60 writing-mode-vertical">LIVE</span>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <div className="w-8 h-8 rounded bg-[#0F4C75]/20 flex items-center justify-center">
                    <Eye className="w-4 h-4" style={{ color: '#0F4C75' }} />
                  </div>
                  <span className="text-[10px] text-white/60 writing-mode-vertical">AI</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* End Flight Confirmation Dialog */}
      <Dialog open={showEndFlightDialog} onOpenChange={setShowEndFlightDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Square className="w-5 h-5" style={{ color: '#ef4444' }} />
              <span>End Flight</span>
            </DialogTitle>
            <DialogDescription>
              {`Are you sure you want to end the flight for ${droneToEnd?.droneName}? This will stop recording and save telemetry data.`}
            </DialogDescription>
          </DialogHeader>

          {droneToEnd && (
            <div className="space-y-4">
              {/* Flight Summary */}
              <Card className="p-4 bg-muted/30">
                <h4 className="text-sm mb-3" style={{ color: '#21A68D' }}>Flight Summary</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs">Drone</p>
                    <p>{droneToEnd.droneName}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Pilot</p>
                    <p>{droneToEnd.pilot}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Mission</p>
                    <p className="text-xs">{droneToEnd.mission}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Flight Time</p>
                    <p style={{ color: '#21A68D' }}>{droneToEnd.telemetry.flightTime}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Battery</p>
                    <p style={{ color: getBatteryColor(droneToEnd.telemetry.battery) }}>
                      {Math.round(droneToEnd.telemetry.battery)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Altitude</p>
                    <p>{Math.round(droneToEnd.telemetry.altitude)}m</p>
                  </div>
                </div>
              </Card>



              {/* Action Buttons */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={handleCancelEndFlight}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  style={{ backgroundColor: '#ef4444' }}
                  onClick={handleConfirmEndFlight}
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Confirm End Flight
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Bottom: Enhanced Live Telemetry — Ultra Compact */}
      <div className="h-[84px] border-t-2 border-[#21A68D] bg-gradient-to-b from-[#0a0e1a] to-[#050810] flex-shrink-0">
        <div className="h-full px-3 py-1">
          {/* Top Row: Drone Info & Controls — Compact */}
          <div className="flex items-center justify-between mb-2">
            {/* Drone Info */}
            <div className="flex items-center gap-2">
              <div className="flex flex-col">
                <span className="text-[10px] text-white/60">ACTIVE DRONE</span>
                <span className="text-sm font-bold" style={{ color: '#21A68D' }}>
                  {realMission?.asset?.name || selectedDrone.droneName}
                </span>
              </div>
              <div className="h-6 w-px bg-border" />
              <div className="flex flex-col">
                <span className="text-[10px] text-white/60">MISSION</span>
                <span className="text-[11px] text-white">{realMission?.name || selectedDrone.mission}</span>
              </div>
              <div className="h-6 w-px bg-border" />
              <div className="flex flex-col">
                <span className="text-[10px] text-white/60">PILOT</span>
                <span className="text-xs text-white">{realMission?.pilot?.name || selectedDrone.pilot}</span>
              </div>
            </div>

            {/* Flight Time */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-[#21A68D]/10 border border-[#21A68D]">
                <Clock className="w-3 h-3" style={{ color: '#21A68D' }} />
                <span className="text-[10px] text-white/60">TIME</span>
                <span className="text-white text-xs font-mono font-bold">{selectedDrone.telemetry.flightTime}</span>
              </div>
            </div>

            {/* End Flight Button */}
            <Button
              size="sm"
              className="h-7 px-3 text-xs"
              style={{ backgroundColor: '#ef4444' }}
              onClick={handleManualEndFlight}
            >
              <Square className="w-2.5 h-2.5 mr-1" />
              End Flight
            </Button>
          </div>

          {/* Bottom Row: Detailed Telemetry Grid — Compact 12-col */}
          <div className="grid grid-cols-12 gap-2">
            {/* Battery with Progress */}
            <motion.div className="col-span-2 flex flex-col" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <div className="flex items-center gap-1 mb-0.5">
                <Battery className="w-3 h-3" style={{ color: getBatteryColor(liveTelemetry?.battery ?? 0) }} />
                <span className="text-[10px] text-white/60">BATTERY</span>
              </div>
              <span className="text-base font-bold font-mono tabular-nums" style={{ color: getBatteryColor(liveTelemetry?.battery ?? 0) }}>
                {liveTelemetry ? `${liveTelemetry.battery.toFixed(1)}%` : '--%'}
              </span>
              <div className="w-full bg-muted/30 rounded-full h-1 mt-0.5">
                <motion.div className="h-1 rounded-full" initial={{ width: 0 }} animate={{ width: `${liveTelemetry?.battery ?? 0}%` }} transition={{ duration: 0.5 }} style={{ backgroundColor: getBatteryColor(liveTelemetry?.battery ?? 0) }} />
              </div>
            </motion.div>

            {/* Altitude */}
            <motion.div className="col-span-1 flex flex-col" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
              <div className="flex items-center gap-1 mb-0.5">
                <Navigation className="w-3 h-3" style={{ color: '#21A68D' }} />
                <span className="text-[10px] text-white/60">ALT</span>
              </div>
              <span className="text-base font-bold text-white font-mono tabular-nums">{liveTelemetry ? liveTelemetry.alt.toFixed(1) : '--'}</span>
              <span className="text-[10px] text-white/60">m</span>
            </motion.div>

            {/* Speed */}
            <motion.div className="col-span-1 flex flex-col" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <div className="flex items-center gap-1 mb-0.5">
                <Gauge className="w-3 h-3" style={{ color: '#0F4C75' }} />
                <span className="text-[10px] text-white/60">SPD</span>
              </div>
              <span className="text-base font-bold text-white font-mono tabular-nums">{liveTelemetry ? liveTelemetry.spd.toFixed(1) : '--'}</span>
              <span className="text-[10px] text-white/60">m/s</span>
            </motion.div>

            {/* Distance */}
            <motion.div className="col-span-1 flex flex-col" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
              <div className="flex items-center gap-1 mb-0.5">
                <TrendingUp className="w-3 h-3" style={{ color: '#8b5cf6' }} />
                <span className="text-[10px] text-white/60">DIST</span>
              </div>
              <span className="text-sm font-bold text-white font-mono tabular-nums">{liveTelemetry ? (liveTelemetry.dist / 1000).toFixed(1) : '--'}</span>
              <span className="text-[10px] text-white/60">km</span>
            </motion.div>

            {/* Signal with Progress */}
            <motion.div className="col-span-1 flex flex-col" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              <div className="flex items-center gap-1 mb-0.5">
                <Radio className="w-3 h-3" style={{ color: getSignalColor(liveTelemetry?.sig ?? 0) }} />
                <span className="text-[10px] text-white/60">SIG</span>
              </div>
              <span className="text-sm font-bold font-mono tabular-nums" style={{ color: getSignalColor(liveTelemetry?.sig ?? 0) }}>
                {liveTelemetry ? `${liveTelemetry.sig.toFixed(0)}%` : '--%'}
              </span>
              <div className="w-full bg-muted/30 rounded-full h-1 mt-0.5">
                <motion.div className="h-1 rounded-full" initial={{ width: 0 }} animate={{ width: `${liveTelemetry?.sig ?? 0}%` }} transition={{ duration: 0.5 }} style={{ backgroundColor: getSignalColor(liveTelemetry?.sig ?? 0) }} />
              </div>
            </motion.div>

            {/* Satellites */}
            <motion.div className="col-span-1 flex flex-col" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
              <div className="flex items-center gap-1 mb-0.5">
                <Satellite className="w-3 h-3" style={{ color: '#22c55e' }} />
                <span className="text-[10px] text-white/60">GPS</span>
              </div>
              <span className="text-sm font-bold text-white font-mono tabular-nums">{liveTelemetry ? liveTelemetry.gps_sats : '--'}</span>
              <span className="text-[10px] text-white/60">sats</span>
            </motion.div>

            {/* Heading */}
            <motion.div className="col-span-1 flex flex-col" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
              <div className="flex items-center gap-1 mb-0.5">
                <Compass className="w-3 h-3" style={{ color: '#D4E268' }} />
                <span className="text-[10px] text-white/60">HDG</span>
              </div>
              <span className="text-sm font-bold text-white font-mono tabular-nums">{liveTelemetry?.heading != null ? Math.round(liveTelemetry.heading) : '--'}</span>
              <span className="text-[10px] text-white/60">deg</span>
            </motion.div>

            {/* Voltage */}
            <motion.div className="col-span-1 flex flex-col" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}>
              <div className="flex items-center gap-1 mb-0.5">
                <Zap className="w-3 h-3" style={{ color: '#f59e0b' }} />
                <span className="text-[10px] text-white/60">VOLT</span>
              </div>
              <span className="text-sm font-bold text-white font-mono tabular-nums">{liveTelemetry ? ((liveTelemetry.battery / 100) * 25.2).toFixed(1) : '--'}</span>
              <span className="text-[10px] text-white/60">V</span>
            </motion.div>

            {/* Coordinates */}
            <motion.div className="col-span-2 flex flex-col" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
              <div className="flex items-center gap-1 mb-0.5">
                <MapPin className="w-3 h-3" style={{ color: '#21A68D' }} />
                <span className="text-[10px] text-white/60">COORDS</span>
              </div>
              <span className="text-xs font-mono text-white tabular-nums">
                {liveTelemetry ? `${liveTelemetry.lat.toFixed(4)}, ${liveTelemetry.lon.toFixed(4)}` : '-- , --'}
              </span>
            </motion.div>
          </div>
        </div>
      </div>



    </div>
  );
}