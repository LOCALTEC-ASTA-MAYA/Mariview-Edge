import { Card } from './ui/card';
import React, { useState, useEffect, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { BarChart, Bar, LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import {
  BarChart3,
  MapPin,
  Play,
  Download,
  Pentagon,
  Square,
  Trash2,
  CheckCircle,
  Calendar,
  Clock,
  ChevronLeft,
  ChevronRight,
  Filter,
  Search,
  MoreVertical,
  ExternalLink,
  Video,
  FileText,
  Upload,
  FileVideo,
  FileJson,
  Cpu,
  XCircle,
  Activity,
  Navigation,
  TrendingUp,
  Layers,
  Ship,
  Plane as PlaneIcon,
  Waves,
  Eye,
  Target
} from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from './ui/sheet';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { useQuery } from '@apollo/client';
import { GET_MISSIONS } from '../graphql/queries';
import { Mission, Flight } from './shared-data';
import { ImageWithFallback } from './figma/ImageWithFallback';
import LeafletDrawMap from './LeafletDrawMap';
import FlightPathCanvas from './FlightPathCanvas';
import AOIPreviewCanvas from './AOIPreviewCanvas';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
// Fallback images for AI detections
const vehicleCountingImg = "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=800&q=80"; // Bus/Vehicle
const crowdEstimationImg = "https://images.unsplash.com/photo-1517457373958-b7bdd4587205?w=800&q=80"; // Crowd
const peopleCountingImg = "https://images.unsplash.com/photo-1531058020387-3be344556be6?w=800&q=80"; // People at event

const speedData = [
  { time: '0:00', speed: 0 },
  { time: '0:10', speed: 8.5 },
  { time: '0:20', speed: 12.3 },
  { time: '0:30', speed: 11.8 },
  { time: '0:40', speed: 13.1 },
  { time: '0:50', speed: 9.7 },
];

const altitudeData = [
  { time: '0:00', altitude: 0 },
  { time: '0:10', altitude: 45 },
  { time: '0:20', altitude: 98 },
  { time: '0:30', altitude: 128 },
  { time: '0:40', altitude: 115 },
  { time: '0:50', altitude: 67 },
];

const distributionData = [
  { name: 'Dark Vessel', value: 1705, color: '#00E5FF' },
  { name: 'AIS Off', value: 980, color: '#B388FF' },
  { name: 'Speed Anomaly', value: 210, color: '#FFB300' },
  { name: 'Identity Mismatch', value: 85, color: '#00E676' },
  { name: 'Zone Violation', value: 60, color: '#FF5252' },
];

// Sample AI detection results
const getAIDetectionResults = (missionId: string) => {
  const detections = [
    {
      id: 1,
      type: 'Vehicles',
      image: vehicleCountingImg,
      timestamp: '0:08:23',
      confidence: 94.2,
      detectedObjects: 3,
      description: 'Vehicle Counting',
    },
    {
      id: 2,
      type: 'People',
      image: peopleCountingImg,
      timestamp: '0:15:47',
      confidence: 89.7,
      detectedObjects: 24,
      description: 'People Counting',
    },
    {
      id: 3,
      type: 'Vehicles',
      image: vehicleCountingImg,
      timestamp: '0:23:12',
      confidence: 96.5,
      detectedObjects: 18,
      description: 'Vehicle Counting',
    },
    {
      id: 4,
      type: 'People',
      image: crowdEstimationImg,
      timestamp: '0:32:05',
      confidence: 92.8,
      detectedObjects: 156,
      description: 'Crowd Estimation',
    },
  ];
  return detections;
};

// Flight path waypoints
const getFlightPath = (missionId: string) => {
  // Tanjung Priok, Jakarta area coordinates
  return [
    { id: 1, lat: -6.1068, lng: 106.8830, time: '0:00', label: 'Start', type: 'start' as const, altitude: 0 },
    { id: 2, lat: -6.1050, lng: 106.8860, time: '0:08', label: 'WP1', type: 'waypoint' as const, altitude: 45 },
    { id: 3, lat: -6.1030, lng: 106.8900, time: '0:15', label: 'WP2', type: 'waypoint' as const, altitude: 98 },
    { id: 4, lat: -6.1010, lng: 106.8920, time: '0:23', label: 'WP3', type: 'waypoint' as const, altitude: 128 },
    { id: 5, lat: -6.0990, lng: 106.8950, time: '0:32', label: 'WP4', type: 'waypoint' as const, altitude: 115 },
    { id: 6, lat: -6.0970, lng: 106.8980, time: '0:40', label: 'WP5', type: 'waypoint' as const, altitude: 87 },
    { id: 7, lat: -6.0950, lng: 106.9000, time: '0:47', label: 'End', type: 'end' as const, altitude: 0 },
  ];
};

// Area of Interest data (Sentul, Bogor area)
const getAreaOfInterest = (missionId: string) => {
  return {
    missionId,
    title: 'Focused areas in this flight',
    generatedAt: new Date().toISOString(),
    areas: [
      {
        id: 1,
        name: 'Primary Inspection Zone',
        type: 'Structure Inspection',
        coordinates: [
          { lat: -6.5625, lng: 106.8942 },
          { lat: -6.5600, lng: 106.8990 },
          { lat: -6.5640, lng: 106.9010 },
          { lat: -6.5670, lng: 106.8970 },
          { lat: -6.5650, lng: 106.8930 },
        ],
        area: 0.42, // km²
        priority: 'High',
        detections: 12,
        notes: 'Critical infrastructure requiring detailed assessment',
      },
      {
        id: 2,
        name: 'Secondary Survey Area',
        type: 'Area Surveillance',
        coordinates: [
          { lat: -6.5550, lng: 106.9050 },
          { lat: -6.5580, lng: 106.9080 },
          { lat: -6.5610, lng: 106.9070 },
          { lat: -6.5590, lng: 106.9040 },
        ],
        area: 0.18, // km²
        priority: 'Medium',
        detections: 7,
        notes: 'Routine monitoring zone',
      },
    ],
    summary: {
      totalAreas: 2,
      totalCoverage: 0.60, // km²
      totalDetections: 19,
      flightDuration: '47 minutes',
    },
  };
};

// Download AOI data as JSON
const downloadAOIData = (aoiData: ReturnType<typeof getAreaOfInterest>, missionName: string) => {
  const dataStr = JSON.stringify(aoiData, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `AOI_${aoiData.missionId}_${Date.now()}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// Area of Interest Map Component
function AreaOfInterestMap({ aoiData }: { aoiData: ReturnType<typeof getAreaOfInterest> }) {
  return (
    <div className="space-y-4">
      <AOIPreviewCanvas areas={aoiData.areas} width={800} height={500} />

      {/* Area Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {aoiData.areas.map((area) => (
          <Card key={area.id} className="p-3 bg-background/50 border-border">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-[#ef4444] flex items-center justify-center">
                  <span className="text-sm text-white">{area.id}</span>
                </div>
                <div>
                  <p className="text-sm">{area.name}</p>
                  <p className="text-xs text-muted-foreground">{area.type}</p>
                </div>
              </div>
              <Badge
                variant="outline"
                style={{
                  borderColor: area.priority === 'High' ? '#ef4444' : '#D4E268',
                  color: area.priority === 'High' ? '#ef4444' : '#D4E268',
                }}
              >
                {area.priority}
              </Badge>
            </div>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Coverage:</span>
                <span>{area.area} km²</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Detections:</span>
                <span style={{ color: '#21A68D' }}>{area.detections} found</span>
              </div>
              <p className="text-muted-foreground mt-2 italic">{area.notes}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* Summary Stats */}
      <Card className="p-3 bg-muted/30">
        <div className="grid grid-cols-4 gap-4 text-center">
          <div>
            <p className="text-xs text-muted-foreground">Total Areas</p>
            <p className="text-lg mt-1" style={{ color: '#21A68D' }}>{aoiData.summary.totalAreas}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Coverage</p>
            <p className="text-lg mt-1" style={{ color: '#0F4C75' }}>{aoiData.summary.totalCoverage} km²</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Detections</p>
            <p className="text-lg mt-1" style={{ color: '#21A68D' }}>{aoiData.summary.totalDetections}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Duration</p>
            <p className="text-lg mt-1">{aoiData.summary.flightDuration}</p>
          </div>
        </div>
      </Card>
    </div>
  );
}

// Safely parse areaPolygon which may arrive as stringified JSON from GraphQL/Postgres
function safeParsePolygon(polygon: any): Array<{ lat: number; lng: number }> {
  if (!polygon) return [];
  if (Array.isArray(polygon)) return polygon;
  if (typeof polygon === 'string') {
    try {
      const parsed = JSON.parse(polygon);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

interface MissionHistoryProps {
  onNavigateToLive?: (missionId: string) => void;
}

/**
 * calculateMissionDuration — single source of truth for mission duration (minutes).
 * Priority: DB duration field → endedAt - startedAt → live running time → 0
 */
export function calculateMissionDuration(mission: any): number {
  const dbDur = Number(mission?.totalDuration ?? mission?.duration);
  if (dbDur > 0) return dbDur;
  const s = mission?.startedAt ? new Date(mission.startedAt).getTime() : 0;
  const isLive = String(mission?.status ?? '').toLowerCase().includes('live');
  const e = mission?.endedAt
    ? new Date(mission.endedAt).getTime()
    : isLive ? Date.now() : 0;
  if (s > 0 && e > 0) return Math.max(1, Math.round((e - s) / 60000));
  return 0;
}

/**
 * calculateMissionCoverage — single source of truth for coverage area (km²).
 * Priority: DB coverageArea field → tactical estimate: 1.5 km²/min + 0.05/snapshot
 */
export function calculateMissionCoverage(mission: any, durationMins?: number): number {
  const dbCov = Number(mission?.coverageArea);
  if (dbCov > 0) return dbCov;
  const dur = durationMins !== undefined ? durationMins : calculateMissionDuration(mission);
  const snaps = Array.isArray(mission?.snapshots) ? mission.snapshots.length : (mission?.snapshots?.length || 0);
  return parseFloat(((dur * 1.5) + (snaps * 0.05)).toFixed(2));
}

export default function MissionHistory({ onNavigateToLive }: MissionHistoryProps) {
  const { loading, error, data } = useQuery(GET_MISSIONS);

  // Map live Postgres/GraphQL data to UI-compatible shape.
  // NO mock data fallback — 100% live Postgres data.
  const missions: any[] = useMemo(() => {
    if (!data?.getMissions || !Array.isArray(data.getMissions)) return [];

    return data.getMissions.map((m: any) => {
      const safePoly = safeParsePolygon(m.areaPolygon);
      const safeFlights = Array.isArray(m.flights) ? m.flights : [];
      return {
        id: m.id ?? '',
        name: m.name ?? 'Unnamed Mission',
        status: (m.status ?? 'pending').toLowerCase(),
        missionCode: m.missionCode ?? '',
        category: m.category ?? 'Reconnaissance',
        startDate: m.startedAt?.split('T')[0] ?? m.createdAt?.split('T')[0] ?? new Date().toISOString().split('T')[0],
        totalDuration: m.duration ?? 0,
        totalFlights: safeFlights.length || 1,
        totalDetections: m.totalDetections ?? 0,
        totalAnomalies: m.totalAnomalies ?? 0,
        coverageArea: m.coverageArea ?? 0,
        droneType: m.asset?.category ?? m.asset?.type ?? 'UAV',
        flights: safeFlights.length > 0 ? safeFlights : [{
          id: `flight-${m.id}`,
          drone: m.asset?.name ?? 'Unassigned',
          pilot: m.pilot?.name ?? 'Unassigned',
          aiModel: 'YOLOv8-Maritime',
          distance: 0, duration: m.duration ?? 0,
          detections: 0, anomalies: 0, maxAltitude: 0, avgSpeed: 0, videoId: '',
        }],
        areaPolygon: safePoly,
        asset: m.asset ?? null,
        pilot: m.pilot ?? null,
        snapshots: Array.isArray(m.snapshots) ? m.snapshots : [],
        createdAt: m.createdAt ?? '',
        startedAt: m.startedAt ?? '',
        endedAt: m.endedAt ?? '',
        videoPath: m.videoPath ?? '',
      };
    });
  }, [data]);

  // DYNAMIC: Real-time aggregation from live Postgres + Snapshot data
  const dynamicSummary = useMemo(() => {
    const total = missions.length;
    const uav = missions.filter((m: any) => (m?.droneType ?? 'UAV').toUpperCase() === 'UAV').length;
    const auv = total - uav;

    // BULLETPROOF status classification — every mission in exactly ONE bucket
    let completed = 0;
    let live = 0;
    let pending = 0;
    missions.forEach((m: any) => {
      const stat = String(m?.status || '').toUpperCase().trim();
      const hasDuration = (Number(m?.duration) || 0) > 0;
      const hasEndedAt = !!m?.endedAt;

      if (stat === 'COMPLETED' || stat === 'SUCCESS' || stat.includes('COMPLETE') || (hasEndedAt && hasDuration)) {
        completed++;
      } else if (stat === 'LIVE' || stat === 'ACTIVE' || stat.includes('LIVE')) {
        live++;
      } else {
        // PENDING, ABORTED, unknown, empty → pending
        pending++;
      }
    });

    // AI: sum snapshot counts across all missions
    const allSnapshots = missions.flatMap((m: any) => Array.isArray(m?.snapshots) ? m.snapshots : []);
    const totalHits = allSnapshots.length > 0
      ? allSnapshots.length
      : missions.reduce((acc: number, m: any) => acc + (Number(m?.totalDetections) || 0), 0);
    const avgConfidence = allSnapshots.length > 0
      ? Math.round((allSnapshots.reduce((sum: number, s: any) => sum + (Number(s?.confidence) || 0), 0) / allSnapshots.length) * 10) / 10
      : 0;

    // Unique assets
    const uniqueAssetIds = new Set(missions.map((m: any) => m?.asset?.id).filter(Boolean));
    const uniqueAssets = uniqueAssetIds.size;

    // Coverage — uses calculateMissionCoverage so global total === sum of individual missions
    const area = missions.reduce((acc: number, m: any) => {
      const dur = calculateMissionDuration(m);
      return acc + calculateMissionCoverage(m, dur);
    }, 0);

    return {
      totalMissions: total,
      uavMissions: uav,
      auvMissions: auv,
      completed,
      pending,
      live,
      successRate: total > 0 ? Math.round((completed / total) * 100) : 0,
      totalHits,
      avgConfidence,
      uniqueAssets,
      totalArea: area,
    };
  }, [missions]);

  // DYNAMIC: Group ALL snapshots by CLIP classification for BarChart
  const dynamicDistributionData = useMemo(() => {
    const colors = ['#00E5FF', '#B388FF', '#FFB300', '#00E676', '#FF5252', '#FF6E40', '#64FFDA', '#EA80FC'];
    const classMap: Record<string, number> = {};
    missions.forEach((m: any) => {
      (Array.isArray(m?.snapshots) ? m.snapshots : []).forEach((s: any) => {
        const cls = s?.classification ?? 'Unclassified';
        classMap[cls] = (classMap[cls] ?? 0) + 1;
      });
    });
    // If no snapshots at all, show placeholder
    if (Object.keys(classMap).length === 0) {
      return [{ name: 'No Detections', value: 0, color: '#334155' }];
    }
    return Object.entries(classMap)
      .sort(([, a], [, b]) => b - a)
      .map(([name, value], i) => ({ name, value, color: colors[i % colors.length] }));
  }, [missions]);

  // DYNAMIC: Device operation — group by asset name, sum duration (hours)
  const deviceOperationData = useMemo(() => {
    const deviceColors = ['#3B82F6', '#F97316', '#22c55e', '#A855F7', '#EF4444', '#06b6d4', '#f59e0b', '#ec4899'];
    const deviceMap: Record<string, { name: string; type: string; minutes: number }> = {};
    missions.forEach((m: any) => {
      const deviceName = m?.asset?.name ?? 'Unknown Asset';
      const deviceType = m?.droneType ?? 'UAV';
      if (!deviceMap[deviceName]) {
        deviceMap[deviceName] = { name: deviceName, type: deviceType, minutes: 0 };
      }
      // Use the same helper as the modal — includes timestamp fallback
      deviceMap[deviceName].minutes += calculateMissionDuration(m);
    });
    const devices = Object.values(deviceMap).filter(d => d.minutes > 0);
    const pieData = devices.map((d, i) => ({
      id: i,
      value: d.minutes,          // minutes — keeps sub-60min flights visible
      label: d.name,
      color: deviceColors[i % deviceColors.length],
    }));
    const totalMinutes = pieData.reduce((s, d) => s + d.value, 0);
    return { totalDevices: devices.length, devices, pieData, totalMinutes };
  }, [missions]);


  // Pagination with configurable rows per page
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);
  const totalPages = Math.max(1, Math.ceil(missions.length / itemsPerPage));
  const paginatedMissions = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return missions.slice(start, start + itemsPerPage);
  }, [missions, currentPage, itemsPerPage]);

  // Reset to page 1 when data changes
  useEffect(() => { setCurrentPage(1); }, [missions.length]);

  const [selectedMission, setSelectedMission] = useState<any | null>(null);

  // Single source of truth for modal display — delegates to module-level helpers
  const displayDuration: string = (() => {
    const d = calculateMissionDuration(selectedMission);
    return d > 0 ? `${d}` : '—';
  })();
  const displayCoverage: string = calculateMissionCoverage(
    selectedMission,
    calculateMissionDuration(selectedMission)
  ).toFixed(1);

  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [isAnalyzeOpen, setIsAnalyzeOpen] = useState(false);
  const [isReplayOpen, setIsReplayOpen] = useState(false);
  const [zoomedReplayImage, setZoomedReplayImage] = useState<string | null>(null);
  const [aoiNotes, setAoiNotes] = useState('');
  const [analyzedMission, setAnalyzedMission] = useState<typeof missions[0] | null>(null);
  const [showAIS, setShowAIS] = useState(true);
  const [showADSB, setShowADSB] = useState(true);
  const [showENC, setShowENC] = useState(false);
  const [mapKey, setMapKey] = useState(0);

  interface AnalysisTask {
    id: number;
    name: string;
    status: 'pending' | 'processing' | 'completed';
  }

  // Analysis & Upload State
  const [analysisVideoFile, setAnalysisVideoFile] = useState<File | null>(null);
  const [analysisTelemetryFile, setAnalysisTelemetryFile] = useState<File | null>(null);
  const [isAnalyzingLocal, setIsAnalyzingLocal] = useState(false);
  const [localAnalysisProgress, setLocalAnalysisProgress] = useState(0);
  const [localAnalysisTasks, setLocalAnalysisTasks] = useState<AnalysisTask[]>([
    { id: 1, name: 'Frame Extraction', status: 'pending' },
    { id: 2, name: 'Vessel Detection', status: 'pending' },
    { id: 3, name: 'Trajectory Mapping', status: 'pending' },
    { id: 4, name: 'Report Generation', status: 'pending' },
  ]);

  // Video List State
  const [analysisDroneType, setAnalysisDroneType] = useState<'UAV' | 'AUV' | null>(null);
  const [videoFilter, setVideoFilter] = useState<'All' | 'UAV' | 'AUV'>('All');
  const [uploadedVideos, setUploadedVideos] = useState([
    {
      id: 'VID-001',
      name: 'port_surveillance_morning.mp4',
      type: 'UAV',
      duration: '23:45',
      date: '2025-01-20',
      time: '14:23',
      size: '2.4 GB',
      status: 'processed',
      missionId: 'MSN-2025-001',
      missionName: 'Port Surveillance - Morning Patrol',
      hasLog: true
    },
    {
      id: 'VID-002',
      name: 'underwater_inspection.mp4',
      type: 'AUV',
      duration: '18:30',
      date: '2025-01-19',
      time: '10:15',
      size: '1.8 GB',
      status: 'processed',
      missionId: 'MSN-2025-002',
      missionName: 'Underwater Hull Inspection',
      hasLog: false
    }
  ]);

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setAnalysisVideoFile(e.target.files[0]);
    }
  };

  const handleTelemetryUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setAnalysisTelemetryFile(e.target.files[0]);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return '#22c55e';
      case 'partial': return '#D4E268';
      case 'failed': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return CheckCircle;
      case 'partial': return Clock;
      case 'failed': return XCircle;
      default: return Clock;
    }
  };

  const handleAnalyzeMission = () => {
    if (!selectedMission || !analysisVideoFile) {
      alert('Please upload a video file to begin analysis.');
      return;
    }

    setIsAnalyzingLocal(true);
    setLocalAnalysisProgress(0);
    setLocalAnalysisTasks(prev => prev.map(t => ({ ...t, status: 'pending' })));

    let progress = 0;
    const interval = setInterval(() => {
      progress += 2;
      setLocalAnalysisProgress(progress);

      // Update task statuses
      if (progress === 10) setLocalAnalysisTasks((tasks: AnalysisTask[]) => tasks.map(t => t.id === 1 ? { ...t, status: 'processing' } : t));
      if (progress === 30) setLocalAnalysisTasks((tasks: AnalysisTask[]) => tasks.map(t => t.id === 1 ? { ...t, status: 'completed' } : t.id === 2 ? { ...t, status: 'processing' } : t));
      if (progress === 60) setLocalAnalysisTasks((tasks: AnalysisTask[]) => tasks.map(t => t.id === 2 ? { ...t, status: 'completed' } : t.id === 3 ? { ...t, status: 'processing' } : t));
      if (progress === 85) setLocalAnalysisTasks((tasks: AnalysisTask[]) => tasks.map(t => t.id === 3 ? { ...t, status: 'completed' } : t.id === 4 ? { ...t, status: 'processing' } : t));

      if (progress >= 100) {
        clearInterval(interval);
        setLocalAnalysisTasks((tasks: AnalysisTask[]) => tasks.map(t => ({ ...t, status: 'completed' })));
        setIsAnalyzingLocal(false);
        setAnalyzedMission(selectedMission);
        alert(`Analysis for ${selectedMission.name} Complete! Mission report available.`);
        setTimeout(() => {
          setIsAnalyzeOpen(false);
          // Reset uploads
          setAnalysisVideoFile(null);
          setAnalysisTelemetryFile(null);
        }, 1500);
      }
    }, 150);
  };

  const handleReplayMission = (mission: typeof missions[0]) => {
    setSelectedMission(mission);
    setIsReplayOpen(true);
  };

  const downloadPDFReport = () => {
    if (!analyzedMission) return;
    alert(`Generating PDF Report for ${analyzedMission.name}...`);
  };

  const openAnalyzeSheet = () => {
    setIsDetailDialogOpen(false); // Close dialog first
    setTimeout(() => {
      setIsAnalyzeOpen(true); // Then open sheet
    }, 100);
  };

  const openReplaySheet = (mission: typeof missions[0]) => {
    setIsDetailDialogOpen(false); // Close dialog first
    setTimeout(() => {
      setSelectedMission(mission);
      setIsReplayOpen(true); // Then open sheet
    }, 100);
  };

  const openDetailDialog = (mission: typeof missions[0]) => {
    setSelectedMission(mission);
    setIsDetailDialogOpen(true);
  };

  return (
    <div className="p-4 md:p-8 space-y-6 bg-[#0a0e1a] min-h-full pb-20">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-2">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white mb-2">
            Mission Intelligence & <span className="text-[#21A68D]">History</span>
          </h1>
          <p className="text-muted-foreground text-sm md:text-base">
            Operational archive and spatial intelligence analytics
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="bg-[#21A68D]/10 text-[#21A68D] border-[#21A68D]/30 py-1.5 px-3">
            <Activity className="w-4 h-4 mr-2" />
            LIVE FLEET SYNC: ACTIVE
          </Badge>
          <Button variant="outline" className="border-border/30 bg-white/5 hover:bg-white/10 text-white">
            <Download className="w-4 h-4 mr-2" />
            Export Archive
          </Button>
        </div>
      </div>

      {/* Summary Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Fleet Assets Card */}
        <Card className="group relative overflow-hidden bg-[#0f172a]/60 backdrop-blur-xl border border-white/10 p-0 hover:border-[#21A68D]/50 transition-all duration-500 shadow-2xl">
          <div className="p-5">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-gradient-to-br from-[#21A68D]/20 to-[#21A68D]/5 rounded-2xl border border-[#21A68D]/20 group-hover:scale-110 transition-transform duration-500">
                <Navigation className="w-6 h-6 text-[#21A68D]" />
              </div>
              <Badge className="bg-[#21A68D]/10 text-[#21A68D] border-[#21A68D]/20 text-[10px] px-2 py-0.5 uppercase tracking-widest font-bold">
                Multi-Domain
              </Badge>
            </div>
            <div className="space-y-0.5">
              <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-[0.2em]">Fleet Operations</p>
              <div className="flex items-baseline gap-2">
                <h3 className="text-3xl font-black text-white tracking-tighter">{dynamicSummary.totalMissions}</h3>
                <span className="text-[10px] text-[#21A68D] font-bold bg-[#21A68D]/10 px-1.5 py-0.5 rounded">{dynamicSummary.uniqueAssets} Assets</span>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="p-3 bg-white/[0.03] rounded-xl border border-white/[0.05] group-hover:bg-white/[0.05] transition-colors">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">UAV</p>
                <p className="text-xl font-bold text-white tracking-tight">{dynamicSummary.uavMissions}</p>
              </div>
              <div className="p-3 bg-white/[0.03] rounded-xl border border-white/[0.05] group-hover:bg-white/[0.05] transition-colors">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">AUV</p>
                <p className="text-xl font-bold text-white tracking-tight">{dynamicSummary.auvMissions}</p>
              </div>
            </div>
          </div>
          <div className="absolute bottom-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-[#21A68D] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
        </Card>

        {/* Mission Status Comparison Card */}
        <Card className="group relative overflow-hidden bg-[#0f172a]/60 backdrop-blur-xl border border-white/10 p-0 hover:border-blue-500/50 transition-all duration-500 shadow-2xl">
          <div className="p-5">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-gradient-to-br from-blue-500/20 to-blue-500/5 rounded-2xl border border-blue-500/20 group-hover:scale-110 transition-transform duration-500">
                <CheckCircle className="w-6 h-6 text-blue-400" />
              </div>
              <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20 text-[10px] px-2 py-0.5 uppercase tracking-widest font-bold">
                Comparison
              </Badge>
            </div>
            <div className="space-y-0.5">
              <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-[0.2em]">Mission Status</p>
              <div className="flex items-baseline gap-2">
                <h3 className="text-3xl font-black text-white tracking-tighter">{missions.length}</h3>
                <span className="text-[10px] text-muted-foreground font-bold uppercase">Total Missions</span>
              </div>
            </div>
            <div className="mt-4 space-y-3">
              {/* Progress Bar */}
              <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden border border-white/5 flex">
                <div
                  className="h-full bg-gradient-to-r from-[#22c55e] to-[#4ade80] transition-all duration-1000"
                  style={{ width: `${dynamicSummary.totalMissions > 0 ? (dynamicSummary.completed / dynamicSummary.totalMissions) * 100 : 0}%` }}
                ></div>
                <div
                  className="h-full bg-gradient-to-r from-[#f59e0b] to-[#fbbf24] transition-all duration-1000"
                  style={{ width: `${dynamicSummary.totalMissions > 0 ? (dynamicSummary.pending / dynamicSummary.totalMissions) * 100 : 0}%` }}
                ></div>
                <div
                  className="h-full bg-gradient-to-r from-[#3b82f6] to-[#60a5fa] transition-all duration-1000"
                  style={{ width: `${dynamicSummary.totalMissions > 0 ? (dynamicSummary.live / dynamicSummary.totalMissions) * 100 : 0}%` }}
                ></div>
              </div>
              {/* Stats */}
              <div className="grid grid-cols-3 gap-2">
                <div className="p-2.5 bg-white/[0.03] rounded-xl border border-white/[0.05]">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#22c55e]"></div>
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Completed</span>
                  </div>
                  <p className="text-xl font-black text-[#22c55e]">{dynamicSummary.completed}</p>
                </div>
                <div className="p-2.5 bg-white/[0.03] rounded-xl border border-white/[0.05]">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#f59e0b]"></div>
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Pending</span>
                  </div>
                  <p className="text-xl font-black text-[#f59e0b]">{dynamicSummary.pending}</p>
                </div>
                <div className="p-2.5 bg-white/[0.03] rounded-xl border border-white/[0.05]">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#3b82f6]"></div>
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Live</span>
                  </div>
                  <p className="text-xl font-black text-[#3b82f6]">{dynamicSummary.live}</p>
                </div>
              </div>
            </div>
          </div>
          <div className="absolute bottom-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
        </Card>

        {/* AI Intelligence Card */}
        <Card className="group relative overflow-hidden bg-[#0f172a]/60 backdrop-blur-xl border border-white/10 p-0 hover:border-[#D4E268]/50 transition-all duration-500 shadow-2xl">
          <div className="p-5">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-gradient-to-br from-[#D4E268]/20 to-[#D4E268]/5 rounded-2xl border border-[#D4E268]/20 group-hover:scale-110 transition-transform duration-500">
                <BarChart3 className="w-6 h-6 text-[#D4E268]" />
              </div>
              <Badge className="bg-[#D4E268]/10 text-[#D4E268] border-[#D4E268]/20 text-[10px] px-2 py-0.5 uppercase tracking-widest font-bold">
                Intelligence
              </Badge>
            </div>
            <div className="space-y-0.5">
              <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-[0.2em]">AI detections</p>
              <div className="flex items-baseline gap-2">
                <h3 className="text-3xl font-black text-white tracking-tighter">{dynamicSummary.totalHits}</h3>
                <span className="text-[10px] text-muted-foreground font-bold uppercase">Total Hits</span>
              </div>
            </div>
            <div className="mt-5 space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] text-muted-foreground uppercase font-bold tracking-wider">Avg Prediction Confidence</span>
                  <span className="text-[11px] text-[#D4E268] font-black uppercase">{dynamicSummary.avgConfidence}%</span>
                </div>
                <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden border border-white/5">
                  <div
                    className="h-full bg-gradient-to-r from-[#D4E268]/40 to-[#D4E268] transition-all duration-1000"
                    style={{ width: `${dynamicSummary.avgConfidence}%` }}
                  ></div>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground/60 uppercase tracking-tighter font-bold">Across {dynamicSummary.totalMissions} mission profiles</p>
            </div>
          </div>
          <div className="absolute bottom-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-[#D4E268] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
        </Card>

        {/* Total Coverage Card */}
        <Card className="group relative overflow-hidden bg-[#0f172a]/60 backdrop-blur-xl border border-white/10 p-0 hover:border-purple-500/50 transition-all duration-500 shadow-2xl">
          <div className="p-5">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-gradient-to-br from-purple-500/20 to-purple-500/5 rounded-2xl border border-purple-500/20 group-hover:scale-110 transition-transform duration-500">
                <TrendingUp className="w-6 h-6 text-purple-400" />
              </div>
              <Badge className="bg-purple-500/10 text-purple-400 border-purple-500/20 text-[10px] px-2 py-0.5 uppercase tracking-widest font-bold">
                Spatial
              </Badge>
            </div>
            <div className="space-y-0.5">
              <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-[0.2em]">Territorial coverage</p>
              <div className="flex items-baseline gap-1">
                <h3 className="text-3xl font-black text-white tracking-tighter">{dynamicSummary.totalArea.toFixed(1)}</h3>
                <span className="text-[10px] text-muted-foreground font-black uppercase tracking-tighter ml-1">KM²</span>
              </div>
            </div>
            <div className="mt-5 flex items-center gap-3 bg-white/5 p-2.5 rounded-xl border border-white/5">
              <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                <Layers className="w-5 h-5 text-purple-400" />
              </div>
              <p className="text-[11px] text-muted-foreground leading-[1.3] font-medium italic">
                Equivalent to tracking across {Math.floor(dynamicSummary.totalArea / 0.5)} identified high-priority maritime zones
              </p>
            </div>
          </div>
          <div className="absolute bottom-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-purple-500 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
        </Card>
      </div>

      {/* Analytics & Distribution Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 my-2">
        {/* Mission Type Distribution Card */}
        <Card className="relative overflow-hidden bg-[#0f172a]/60 backdrop-blur-xl border border-white/10 p-0 shadow-2xl">
          <div className="p-5 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Ship className="w-5 h-5 text-blue-400" />
              </div>
              <h3 className="text-sm font-black text-white uppercase tracking-widest">Operation Type Profiling</h3>
            </div>
            <Badge variant="outline" className="border-white/10 text-muted-foreground/70 text-[9px] uppercase font-bold tracking-tighter">
              Contextual Data
            </Badge>
          </div>
          <div className="p-4">
            {dynamicDistributionData.length === 0 || (dynamicDistributionData.length === 1 && dynamicDistributionData[0].value === 0) ? (
              <div className="h-[260px] flex flex-col items-center justify-center gap-3">
                <div className="w-16 h-16 rounded-2xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-center">
                  <Eye className="w-8 h-8 text-muted-foreground/20" />
                </div>
                <p className="text-sm font-bold text-muted-foreground/40 uppercase tracking-widest">No Intel Available</p>
                <p className="text-[10px] text-muted-foreground/30">AI classification data will appear after missions with CLIP detections</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart
                  data={dynamicDistributionData}
                  layout="vertical"
                  margin={{ left: 10, right: 20, top: 5, bottom: 5 }}
                  barCategoryGap="20%"
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                  <XAxis
                    type="number"
                    tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }}
                    axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                    tickLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fill: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: 600 }}
                    axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                    tickLine={false}
                    width={130}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 8,
                      color: '#fff',
                      fontSize: 12,
                    }}
                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20}>
                    {dynamicDistributionData.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        {/* Operational Timeline Card */}
        <Card className="relative overflow-hidden bg-[#0f172a]/60 backdrop-blur-xl border border-white/10 p-0 shadow-2xl">
          <div className="p-5 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-[#21A68D]/10 rounded-lg">
                <Clock className="w-5 h-5 text-[#21A68D]" />
              </div>
              <h3 className="text-sm font-black text-white uppercase tracking-widest">Device Operation</h3>
            </div>
            <Badge variant="outline" className="border-white/10 text-[#21A68D] text-[9px] uppercase font-bold tracking-tighter">
              Historical Cycle
            </Badge>
          </div>
          <div className="p-5">
            {deviceOperationData.totalMinutes === 0 ? (
              <div className="h-[230px] flex flex-col items-center justify-center gap-3">
                <div className="w-16 h-16 rounded-2xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-center">
                  <Clock className="w-8 h-8 text-muted-foreground/20" />
                </div>
                <p className="text-sm font-bold text-muted-foreground/40 uppercase tracking-widest">No Flight Data</p>
                <p className="text-[10px] text-muted-foreground/30">Device operation hours will appear after completed missions</p>
              </div>
            ) : (
              <>
                {/* Donut chart with absolute-positioned center overlay */}
                <div className="relative w-full mt-1">
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={deviceOperationData.pieData}
                        cx="50%" cy="50%"
                        innerRadius={70} outerRadius={90}
                        paddingAngle={10} dataKey="value" nameKey="label"
                        stroke="none"
                        startAngle={90} endAngle={-270}
                      >
                        {deviceOperationData.pieData.map((_: any, index: number) => {
                          const COLORS = ['#3B82F6', '#A855F7', '#F97316', '#22C55E'];
                          return <Cell key={`dev-${index}`} fill={COLORS[index % COLORS.length]} />;
                        })}
                      </Pie>
                      <Tooltip
                        contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '11px' }}
                        itemStyle={{ color: '#fff', fontWeight: 'bold' }}
                        formatter={(v: any, _: any, p: any) => [`${v} min`, p.payload.label]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Center text overlay — HTML positioned over SVG */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-3xl font-black text-white leading-none">{deviceOperationData.totalDevices}</span>
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] mt-0.5" style={{ color: '#9CA3AF' }}>Devices</span>
                  </div>
                </div>

                {/* Custom legend grid */}
                <div className="grid grid-cols-2 gap-3 mt-6">
                  {deviceOperationData.pieData.map((device: any, index: number) => {
                    const COLORS = ['#3B82F6', '#A855F7', '#F97316', '#22C55E'];
                    const color = COLORS[index % COLORS.length];
                    return (
                      <div key={device.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                        {/* Colored pill */}
                        <div className="w-1.5 h-10 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                        <div>
                          <p className="text-[9px] font-bold uppercase tracking-widest truncate" style={{ color: '#9CA3AF' }}>{device.label}</p>
                          <p className="text-xl font-black text-white leading-tight">{device.value} <span className="text-xs font-bold" style={{ color: '#9CA3AF' }}>min</span></p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </Card>
      </div>

      {/* Recent Missions Table */}
      <div className="mt-6 pb-10">
        <Card className="bg-[#0f172a]/60 backdrop-blur-lg border border-border/40 overflow-hidden shadow-2xl">
          <div className="p-5 border-b border-border/30 bg-white/5 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Layers className="w-5 h-5 text-[#21A68D]" />
                Recent Operations Archive
              </h2>
              <p className="text-xs text-muted-foreground mt-1 tracking-tight">Accessing full telemetry and AI report logs</p>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-white">Sort by Date</Button>
              <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-white">Filter AI Impact</Button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-[#0a0e1a]/80 text-[10px] font-bold text-muted-foreground uppercase tracking-widest border-b border-border/20">
                <tr>
                  <th className="pl-6 pr-5 py-3">Status & Mission ID</th>
                  <th className="px-5 py-3">Operation Detail</th>
                  <th className="px-5 py-3">Assets</th>
                  <th className="px-5 py-3 text-center">AI Impact</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {paginatedMissions.length === 0 && missions.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-16 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <Layers className="w-10 h-10 text-muted-foreground/30" />
                        <p className="text-sm text-muted-foreground font-bold">No missions found in database</p>
                        <p className="text-xs text-muted-foreground/60">Create a new mission from the New Flight page to see it here.</p>
                      </div>
                    </td>
                  </tr>
                )}
                {paginatedMissions.map((mission: typeof missions[0]) => {
                  const StatusIcon = getStatusIcon(mission.status);
                  const statusColor = getStatusColor(mission.status);

                  return (
                    <tr key={mission.id} className="hover:bg-[#21A68D]/5 group transition-all duration-200">
                      <td className="pl-6 pr-5 py-3.5">
                        <div className="flex items-center gap-4">
                          <div
                            className="w-10 h-10 rounded-full flex items-center justify-center border-2"
                            style={{ borderColor: `${statusColor}30`, backgroundColor: `${statusColor}10` }}
                          >
                            <StatusIcon className="w-5 h-5" style={{ color: statusColor }} />
                          </div>
                          <div>
                            <p className="text-[10px] text-muted-foreground font-bold tracking-tighter mb-0.5">{mission?.missionCode || mission?.id || '—'}</p>
                            <p className="text-xs font-bold text-white group-hover:text-[#21A68D] transition-colors">{mission?.name ?? 'Unnamed'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-xs text-white/90">
                            <Clock className="w-3 h-3 text-muted-foreground" />
                            <span>
                              {(() => {
                                const dur = calculateMissionDuration(mission);
                                return dur > 0 ? `${dur}m Duration` : '—';
                              })()}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                            <MapPin className="w-3 h-3" />
                            <span>{mission?.startedAt ? new Date(mission.startedAt).toLocaleDateString() : (mission?.createdAt ? new Date(mission.createdAt).toLocaleDateString() : 'N/A')} Operation</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex flex-col">
                          <span className="text-xs font-medium text-white/80">{mission?.asset?.name ?? 'N/A'}</span>
                          <span className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-tighter">{mission?.droneType ?? 'UAV'} Fleet</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <div className="inline-flex flex-col items-center p-2 rounded-lg bg-white/5 border border-white/5 min-w-[3.5rem]">
                          <span className="text-xs font-black text-[#D4E268]">{(mission?.snapshots ?? []).length}</span>
                          <span className="text-[9px] text-muted-foreground font-bold uppercase tracking-tighter">Hits</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-3">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 border-border/40 text-xs font-semibold hover:bg-[#21A68D] hover:text-white"
                            onClick={() => openDetailDialog(mission)}
                          >
                            Telemetry Report
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-white">
                                <Download className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-[#0f172a] border-border/50">
                              <DropdownMenuLabel>Export Mission</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuCheckboxItem>PDF Full Report</DropdownMenuCheckboxItem>
                              <DropdownMenuCheckboxItem>JSON Telemetry</DropdownMenuCheckboxItem>
                              <DropdownMenuCheckboxItem>KMZ Spatial Data</DropdownMenuCheckboxItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* NEW: Pagination Controls */}
          {missions.length > 0 && (
            <div className="px-5 py-3 border-t border-white/5 flex items-center justify-between bg-[#0a0e1a]/40">
              <div className="flex items-center gap-4">
                <p className="text-xs text-muted-foreground">
                  Showing{' '}
                  <span className="text-white font-bold">{(currentPage - 1) * itemsPerPage + 1}</span>
                  –
                  <span className="text-white font-bold">{Math.min(currentPage * itemsPerPage, missions.length)}</span>
                  {' '}of <span className="text-white font-bold">{missions.length}</span> missions
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Rows</span>
                  <select
                    value={itemsPerPage}
                    onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                    className="h-7 px-2 text-xs bg-[#0a0e1a] border border-white/10 rounded-lg text-white focus:border-[#21A68D] focus:outline-none cursor-pointer"
                  >
                    {[5, 10, 50, 100].map(n => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 px-3 text-xs border-white/10 hover:bg-[#21A68D] hover:text-white hover:border-[#21A68D] disabled:opacity-30"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="w-3.5 h-3.5 mr-1" />
                  Prev
                </Button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(page => page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1)
                  .map((page, idx, arr) => (
                    <React.Fragment key={page}>
                      {idx > 0 && arr[idx - 1] !== page - 1 && (
                        <span className="text-muted-foreground text-xs px-1">…</span>
                      )}
                      <button
                        onClick={() => setCurrentPage(page)}
                        className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${page === currentPage
                          ? 'bg-[#21A68D] text-white shadow-lg shadow-[#21A68D]/25'
                          : 'text-muted-foreground hover:text-white hover:bg-white/5'
                          }`}
                      >
                        {page}
                      </button>
                    </React.Fragment>
                  ))}
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 px-3 text-xs border-white/10 hover:bg-[#21A68D] hover:text-white hover:border-[#21A68D] disabled:opacity-30"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                >
                  Next
                  <ChevronRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </Card>

        {/* Mission Detail Dialog - Controlled */}
        <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
          <DialogContent className="max-w-[95vw] sm:max-w-4xl max-h-[90vh] overflow-y-auto">
            {selectedMission && (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-3">
                    {selectedMission.name}
                    <Badge variant="outline" style={{ borderColor: getStatusColor(selectedMission.status), color: getStatusColor(selectedMission.status) }}>
                      {selectedMission.status}
                    </Badge>
                  </DialogTitle>
                  <DialogDescription>
                    {selectedMission?.missionCode ?? selectedMission.id} &mdash; {new Date(selectedMission.startDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 mt-4">
                  {/* Mission Details */}
                  <Card className="p-4 bg-muted/30">
                    <h3 className="text-sm mb-3" style={{ color: '#21A68D' }}>Mission Details</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Mission ID</p>
                        <p className="mt-1 font-mono font-semibold">{selectedMission?.missionCode ?? '—'}</p>
                        <p className="mt-0.5 text-[10px] text-muted-foreground/50">System Ref: {selectedMission.id}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Date</p>
                        <p className="mt-1">{selectedMission?.startedAt ? new Date(selectedMission.startedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : (selectedMission?.createdAt ? new Date(selectedMission.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'N/A')}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Asset</p>
                        <p className="mt-1">{selectedMission?.asset?.name || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Category</p>
                        <p className="mt-1">{selectedMission?.category || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Duration</p>
                        <p className="mt-1">{displayDuration} minutes</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Coverage Area</p>
                        <p className="mt-1">{displayCoverage} km²</p>
                      </div>
                    </div>
                  </Card>

                  {/* Performance Metrics */}
                  <Card className="p-4 bg-muted/30">
                    <h3 className="text-sm mb-3" style={{ color: '#0F4C75' }}>Performance Metrics</h3>
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <p className="text-xs text-muted-foreground">Total Duration</p>
                        <p className="text-lg mt-1">{displayDuration} min</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Coverage</p>
                        <p className="text-lg mt-1">{displayCoverage} km²</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Detections</p>
                        <p className="text-lg mt-1" style={{ color: '#21A68D' }}>{(selectedMission?.snapshots ?? []).length}</p>
                      </div>
                    </div>
                  </Card>

                  {/* Action Buttons - Flow: Detail Mission → Analyze/Replay → Generate Report */}
                  <div className="grid grid-cols-3 gap-3">
                    <Button
                      variant="outline"
                      className="border-[#21A68D] text-[#21A68D] hover:bg-[#21A68D] hover:text-white"
                      onClick={openAnalyzeSheet}
                    >
                      <BarChart3 className="w-4 h-4 mr-2" />
                      Analyze Mission
                    </Button>
                    <Button
                      variant="outline"
                      className="border-[#0F4C75] text-[#0F4C75] hover:bg-[#0F4C75] hover:text-white"
                      onClick={() => openReplaySheet(selectedMission)}
                    >
                      <Play className="w-4 h-4 mr-2" />
                      Replay Mission
                    </Button>
                    <Button
                      className="bg-[#21A68D] hover:bg-[#1a8a72]"
                      onClick={downloadPDFReport}
                      disabled={!analyzedMission || analyzedMission.id !== selectedMission.id}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Generate Report
                    </Button>
                  </div>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* Analyze Mission Sheet - Add AOI Information */}
        <Sheet open={isAnalyzeOpen} onOpenChange={setIsAnalyzeOpen}>
          <SheetContent side="right" className="w-full sm:max-w-7xl overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Analyze Mission & Add AOI Information</SheetTitle>
              <SheetDescription>
                {selectedMission && `${selectedMission?.missionCode ?? selectedMission.id} — ${selectedMission.name}`}
              </SheetDescription>
            </SheetHeader>

            <div className="mt-6 space-y-6">
              {/* Current Mission Info */}
              {selectedMission && (
                <Card className="p-4 bg-muted/30">
                  <h3 className="text-sm mb-3" style={{ color: '#21A68D' }}>Mission Summary</h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground">Drone</p>
                      <p className="mt-1">{selectedMission?.asset?.name || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Duration</p>
                      <p className="mt-1">{displayDuration} min</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Coverage</p>
                      <p className="mt-1">{displayCoverage} km²</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Detections</p>
                      <p className="mt-1">{(selectedMission?.snapshots ?? []).length}</p>
                    </div>
                  </div>
                </Card>
              )}

              {/* Editable AOI Canvas Map */}
              {selectedMission && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm" style={{ color: '#21A68D' }}>Draw & Edit AOI Zones</h3>
                  </div>
                  <div className="rounded-lg overflow-hidden border-2 border-[#21A68D] bg-black" style={{ height: '500px' }}>
                    <LeafletDrawMap
                      key={mapKey}
                      center={[-6.1064, 106.8818]}
                      zoom={13}
                      className="w-full h-full"
                      onAreaDrawn={(coordinates, description) => {
                        console.log('AOI Area drawn:', coordinates, description);
                        // Here you could save the AOI data
                      }}
                    />
                  </div>
                  {/* Drawing Controls */}
                  <div className="flex gap-2 mt-3">
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-[#21A68D] text-[#21A68D] hover:bg-[#21A68D] hover:text-white"
                      onClick={() => {
                        if ((window as any).leafletDrawMap) {
                          (window as any).leafletDrawMap.startPolygon();
                        }
                      }}
                    >
                      <Pentagon className="w-4 h-4 mr-2" />
                      Draw Polygon
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-[#21A68D] text-[#21A68D] hover:bg-[#21A68D] hover:text-white"
                      onClick={() => {
                        if ((window as any).leafletDrawMap) {
                          (window as any).leafletDrawMap.finishPolygon();
                        }
                      }}
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Finish Drawing
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-[#21A68D] text-[#21A68D] hover:bg-[#21A68D] hover:text-white"
                      onClick={() => {
                        if ((window as any).leafletDrawMap) {
                          (window as any).leafletDrawMap.drawRectangle();
                        }
                      }}
                    >
                      <Square className="w-4 h-4 mr-2" />
                      Add Rectangle
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-red-500 text-red-500 hover:bg-red-500 hover:text-white"
                      onClick={() => {
                        if ((window as any).leafletDrawMap) {
                          (window as any).leafletDrawMap.clear();
                        }
                      }}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Clear All
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Click "Draw Polygon" to start, click on map to add points, then "Finish Drawing". Or click "Add Rectangle" for quick area marking.
                  </p>
                </div>
              )}

              {/* Enhanced Video Analysis Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

                {/* Left Panel: Upload Video */}
                <div className="lg:col-span-4 space-y-6">
                  <div className="p-6 rounded-2xl bg-muted/20 border border-white/5 space-y-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-[#21A68D]/10">
                        <Upload className="w-5 h-5 text-[#21A68D]" />
                      </div>
                      <h3 className="text-lg font-bold text-white">Upload Video</h3>
                    </div>

                    <div className="space-y-4">
                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Step 1: Select Drone Type</p>
                      <div className="grid grid-cols-2 gap-3">
                        <Button
                          variant="outline"
                          className={`h-12 gap-2 border-2 transition-all ${analysisDroneType === 'UAV' ? 'border-[#21A68D] bg-[#21A68D]/10 text-white' : 'border-white/5 hover:border-[#21A68D]/50'}`}
                          onClick={() => setAnalysisDroneType('UAV')}
                        >
                          <PlaneIcon className="w-4 h-4" />
                          UAV
                        </Button>
                        <Button
                          variant="outline"
                          className={`h-12 gap-2 border-2 transition-all ${analysisDroneType === 'AUV' ? 'border-[#21A68D] bg-[#21A68D]/10 text-white' : 'border-white/5 hover:border-[#21A68D]/50'}`}
                          onClick={() => setAnalysisDroneType('AUV')}
                        >
                          <Waves className="w-4 h-4" />
                          AUV
                        </Button>
                      </div>
                    </div>

                    {analysisDroneType && (
                      <div className="space-y-4 animate-in fade-in slide-in-from-top-4">
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Step 2: Choose Files</p>
                        <div className="grid grid-cols-1 gap-4">
                          <div
                            className={`p-8 rounded-xl border-2 border-dashed transition-all text-center cursor-pointer ${analysisVideoFile ? 'border-[#21A68D] bg-[#21A68D]/5' : 'border-white/5 hover:border-[#21A68D]/50 hover:bg-[#21A68D]/5'}`}
                            onClick={() => document.getElementById('analyze-video-upload')?.click()}
                          >
                            <input id="analyze-video-upload" type="file" accept="video/*" className="hidden" onChange={handleVideoUpload} />
                            <FileVideo className={`w-10 h-10 mx-auto mb-3 ${analysisVideoFile ? 'text-[#21A68D]' : 'text-muted-foreground'}`} />
                            <p className="text-sm font-medium text-white">{analysisVideoFile ? analysisVideoFile.name : 'Drop Flight Video here'}</p>
                            <p className="text-xs text-muted-foreground mt-2">MP4, MOV up to 2GB</p>
                          </div>

                          <div
                            className={`p-4 rounded-xl border-2 border-dashed transition-all flex items-center gap-4 cursor-pointer ${analysisTelemetryFile ? 'border-[#21A68D] bg-[#21A68D]/5' : 'border-white/5 hover:border-[#21A68D]/50 hover:bg-[#21A68D]/5'}`}
                            onClick={() => document.getElementById('analyze-telemetry-upload')?.click()}
                          >
                            <input id="analyze-telemetry-upload" type="file" accept=".csv,.json,.log" className="hidden" onChange={handleTelemetryUpload} />
                            <div className={`p-2 rounded-lg ${analysisTelemetryFile ? 'bg-[#21A68D]/20' : 'bg-white/5'}`}>
                              <FileJson className={`w-5 h-5 ${analysisTelemetryFile ? 'text-[#21A68D]' : 'text-muted-foreground'}`} />
                            </div>
                            <div className="text-left flex-1">
                              <p className="text-xs font-medium text-white">{analysisTelemetryFile ? analysisTelemetryFile.name : 'Upload Flight Logs (Optional)'}</p>
                              <p className="text-[10px] text-muted-foreground">{analysisTelemetryFile ? `${(analysisTelemetryFile.size / 1024).toFixed(1)} KB` : 'CSV, JSON supported'}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {isAnalyzingLocal && (
                      <div className="space-y-4 pt-4 border-t border-white/5 animate-in fade-in slide-in-from-top-4">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-white uppercase tracking-wider">AI Pipeline</span>
                          <span className="text-xs text-[#21A68D] font-mono">{localAnalysisProgress}%</span>
                        </div>
                        <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#21A68D] transition-all duration-300"
                            style={{ width: `${localAnalysisProgress}%` }}
                          />
                        </div>
                        <div className="space-y-2">
                          {localAnalysisTasks.map((task: any) => (
                            <div key={task.id} className={`p-2 rounded border text-[10px] flex items-center justify-between ${task.status === 'completed' ? 'bg-[#21A68D]/10 border-[#21A68D]/30 text-[#21A68D]' : task.status === 'processing' ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' : 'bg-white/2 border-white/5 text-muted-foreground opacity-50'}`}>
                              <span>{task.name}</span>
                              <span className="text-[8px] uppercase font-bold">{task.status}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex gap-3">
                      <Button
                        variant="ghost"
                        className="flex-1 text-muted-foreground hover:text-white"
                        onClick={() => setIsAnalyzeOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        className="flex-1 bg-[#21A68D] hover:bg-[#1a8a72]"
                        onClick={handleAnalyzeMission}
                        disabled={isAnalyzingLocal || !analysisVideoFile}
                      >
                        {isAnalyzingLocal ? (
                          <>
                            <Cpu className="w-4 h-4 mr-2 animate-spin" />
                            Analyzing...
                          </>
                        ) : (
                          <>
                            <BarChart3 className="w-4 h-4 mr-2" />
                            Start AI Analysis
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Right Panel: Uploaded Videos */}
                <div className="lg:col-span-8 space-y-6">
                  <div className="p-6 rounded-2xl bg-muted/20 border border-white/5 min-h-[600px] flex flex-col">
                    <div className="flex items-center justify-between mb-8">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-[#21A68D]/10">
                          <Video className="w-5 h-5 text-[#21A68D]" />
                        </div>
                        <h3 className="text-lg font-bold text-white">Uploaded Videos ({uploadedVideos.length})</h3>
                      </div>
                      <div className="flex bg-black/40 p-1 rounded-lg border border-white/5">
                        {['All', 'UAV', 'AUV'].map((f) => (
                          <button
                            key={f}
                            onClick={() => setVideoFilter(f as any)}
                            className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all ${videoFilter === f ? 'bg-[#21A68D] text-white shadow-lg' : 'text-muted-foreground hover:text-white'}`}
                          >
                            {f}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex-1 space-y-4">
                      {uploadedVideos
                        .filter(v => videoFilter === 'All' || v.type === videoFilter)
                        .map((video) => (
                          <div key={video.id} className="p-4 rounded-xl bg-black/40 border border-white/5 hover:border-[#21A68D]/30 transition-all group">
                            <div className="flex gap-6">
                              {/* Video Thumbnail Placeholder */}
                              <div className="relative w-48 aspect-video rounded-lg bg-white/5 border border-white/10 overflow-hidden flex-shrink-0">
                                <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/0 transition-all">
                                  <div className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 group-hover:scale-110 transition-all">
                                    <Play className="w-4 h-4 text-white fill-white" />
                                  </div>
                                </div>
                                <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-black/60 text-[10px] font-mono text-white">
                                  {video.duration}
                                </div>
                              </div>

                              {/* Info */}
                              <div className="flex-1 space-y-3">
                                <div className="flex items-start justify-between">
                                  <div>
                                    <h4 className="text-sm font-bold text-white mb-2 group-hover:text-[#21A68D] transition-all">{video.name}</h4>
                                    <div className="flex items-center gap-2">
                                      <Badge variant="outline" className={`text-[10px] h-5 bg-white/5 ${video.type === 'UAV' ? 'text-blue-400 border-blue-400/30' : 'text-purple-400 border-purple-400/30'}`}>
                                        {video.type === 'UAV' ? <PlaneIcon className="w-3 h-3 mr-1" /> : <Waves className="w-3 h-3 mr-1" />}
                                        {video.type}
                                      </Badge>
                                      {video.hasLog && (
                                        <Badge variant="outline" className="text-[10px] h-5 bg-[#21A68D]/10 text-[#21A68D] border-[#21A68D]/30">
                                          <FileJson className="w-3 h-3 mr-1" />
                                          Flight Log
                                        </Badge>
                                      )}
                                      <Badge variant="outline" className="text-[10px] h-5 bg-green-500/10 text-green-400 border-green-500/30">
                                        <CheckCircle className="w-3 h-3 mr-1" />
                                        {video.status}
                                      </Badge>
                                    </div>
                                  </div>

                                  <div className="flex gap-2">
                                    <Button size="icon" variant="ghost" className="w-8 h-8 rounded-lg hover:bg-[#21A68D]/10 hover:text-[#21A68D]">
                                      <Eye className="w-4 h-4" />
                                    </Button>
                                    <Button size="icon" variant="ghost" className="w-8 h-8 rounded-lg hover:bg-[#21A68D]/10 hover:text-[#21A68D]">
                                      <Download className="w-4 h-4" />
                                    </Button>
                                    <Button size="icon" variant="ghost" className="w-8 h-8 rounded-lg hover:bg-red-500/10 hover:text-red-500">
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </div>
                                </div>

                                <div className="flex items-center gap-4 text-[10px] text-muted-foreground pb-3 border-b border-white/5">
                                  <div className="flex items-center gap-1.5">
                                    <Calendar className="w-3 h-3" />
                                    {video.date}
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <Clock className="w-3 h-3" />
                                    {video.time}
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <Upload className="w-3 h-3" />
                                    {video.size}
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 pt-1 text-[10px]">
                                  <span className="text-muted-foreground">Linked to:</span>
                                  <span className="px-2 py-0.5 rounded bg-[#21A68D]/10 text-[#21A68D] font-medium flex items-center gap-1.5">
                                    <ExternalLink className="w-3 h-3" />
                                    {video.missionName}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* TACTICAL ZOOM — inside Sheet portal so Radix overlay never blocks it */}
            {zoomedReplayImage && (
              <div
                style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.86)' }}
                onClick={() => setZoomedReplayImage(null)}
              >
                <div
                  style={{ position: 'relative', maxWidth: '640px', width: '90%', borderRadius: '12px', overflow: 'hidden', border: '1px solid rgba(33,166,141,0.4)', boxShadow: '0 25px 60px rgba(0,0,0,0.8)' }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <img
                    src={zoomedReplayImage}
                    alt="AI Detection Zoom"
                    style={{ width: '100%', maxHeight: '70vh', objectFit: 'contain', display: 'block', background: '#0a0e1a' }}
                  />
                  <button
                    onClick={() => setZoomedReplayImage(null)}
                    style={{ position: 'absolute', top: '10px', right: '10px', width: '30px', height: '30px', borderRadius: '50%', background: 'rgba(220,38,38,0.95)', border: '1px solid #f87171', color: 'white', fontWeight: 900, fontSize: '15px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 10px rgba(0,0,0,0.6)' }}
                  >
                    ✕
                  </button>
                  <div style={{ padding: '6px 12px', background: 'rgba(10,14,26,0.95)', borderTop: '1px solid rgba(33,166,141,0.2)' }}>
                    <span style={{ fontSize: '10px', color: '#21A68D', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase' }}>AI Detection — Tactical Zoom</span>
                  </div>
                </div>
              </div>
            )}
          </SheetContent>
        </Sheet>

        {/* Replay Mission Sheet */}
        <Sheet open={isReplayOpen} onOpenChange={setIsReplayOpen}>
          <SheetContent side="right" className="w-full sm:max-w-4xl overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Replay Mission</SheetTitle>
              <SheetDescription>
                {selectedMission && `${selectedMission.name} — ${selectedMission?.missionCode ?? selectedMission.id}`}
              </SheetDescription>
            </SheetHeader>

            <div className="mt-6 space-y-6">
              {selectedMission && (
                <>
                  {/* Mission Recording Replay */}
                  <Card className="p-4 bg-muted/30">
                    <h3 className="text-sm mb-3 flex items-center gap-2" style={{ color: '#21A68D' }}>
                      <Play className="w-4 h-4" />
                      Mission Recording Replay
                    </h3>
                    <div className="relative overflow-hidden">
                      {selectedMission?.videoPath ? (
                        <video
                          key={selectedMission.videoPath}
                          src={selectedMission.videoPath}
                          controls
                          autoPlay
                          muted
                          playsInline
                          className="w-full aspect-video object-cover rounded-lg border border-slate-700 bg-slate-900 shadow-lg"
                        />
                      ) : (
                        <div className="w-full aspect-video flex flex-col items-center justify-center gap-4 bg-slate-900 rounded-lg border border-slate-700/50 shadow-lg">
                          <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/40">
                            <Video className="w-10 h-10 text-slate-600" />
                          </div>
                          <div className="text-center">
                            <p className="text-xs font-black text-slate-500 uppercase tracking-[0.25em]">Classified Footage</p>
                            <p className="text-[10px] text-slate-600 mt-1 uppercase tracking-wider">No Recording Available</p>
                          </div>
                          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800/40 border border-slate-700/30">
                            <div className="w-1.5 h-1.5 rounded-full bg-slate-600" />
                            <span className="text-[9px] font-mono text-slate-600 uppercase tracking-widest">Video will be linked after mission processing</span>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                      <div className="p-2 rounded bg-background border border-border text-center">
                        <p className="text-muted-foreground">Duration</p>
                        <p className="mt-1">{displayDuration} min</p>
                      </div>
                      <div className="p-2 rounded bg-background border border-border text-center">
                        <p className="text-muted-foreground">Detections</p>
                        <p className="mt-1">{(selectedMission?.snapshots ?? []).length}</p>
                      </div>
                      <div className="p-2 rounded bg-background border border-border text-center">
                        <p className="text-muted-foreground">Coverage</p>
                        <p className="mt-1">{displayCoverage} km²</p>
                      </div>
                    </div>
                  </Card>

                  {/* AI Snapshot Results */}
                  <Card className="p-4 bg-muted/30">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm flex items-center gap-2" style={{ color: '#D4E268' }}>
                        <BarChart3 className="w-4 h-4" />
                        AI Snapshot Results
                      </h3>
                      <Badge variant="outline" className="text-[10px] border-[#D4E268]/30 text-[#D4E268]">
                        {(selectedMission?.snapshots ?? []).length} DETECTIONS
                      </Badge>
                    </div>

                    {(selectedMission?.snapshots ?? []).length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-10 gap-3">
                        <BarChart3 className="w-10 h-10 text-muted-foreground/20" />
                        <p className="text-sm text-muted-foreground/40 font-bold uppercase tracking-wider">No AI Detections</p>
                        <p className="text-[10px] text-muted-foreground/30">No snapshots were captured during this mission</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                        {(selectedMission?.snapshots ?? []).map((snapshot: any, idx: number) => (
                          <div
                            key={snapshot.id || idx}
                            className="bg-[#0a0e1a]/80 rounded-lg border border-slate-700/50 overflow-hidden hover:border-[#21A68D]/60 hover:ring-1 hover:ring-[#21A68D]/40 transition-all group cursor-pointer"
                            onClick={() => snapshot.snapshotUrl && setZoomedReplayImage(snapshot.snapshotUrl)}
                          >                            <div className="relative aspect-video bg-slate-900">
                              {snapshot.snapshotUrl ? (
                                <img
                                  src={snapshot.snapshotUrl}
                                  alt={snapshot.classification || 'Detection'}
                                  className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <div className="text-center">
                                    <Target className="w-6 h-6 text-[#D4E268]/20 mx-auto mb-1" />
                                    <span className="text-muted-foreground/20 text-[9px] font-bold uppercase tracking-wider">No Image</span>
                                  </div>
                                </div>
                              )}
                              {/* Classification badge — top left */}
                              <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/70 backdrop-blur-sm text-[9px] font-bold text-[#D4E268] uppercase tracking-wider">
                                {snapshot.classification || 'Unknown'}
                              </div>
                              {/* Confidence badge — top right */}
                              <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/70 backdrop-blur-sm text-[9px] font-mono text-white">
                                {((Number(snapshot.confidence) || 0) * 100).toFixed(0)}%
                              </div>
                            </div>
                            <div className="px-2.5 py-2 flex items-center justify-between">
                              <span className="text-[10px] font-semibold text-white/70">Track #{snapshot.trackId || idx + 1}</span>
                              <span className="text-[9px] text-muted-foreground font-mono">
                                {snapshot.detectedAt ? new Date(snapshot.detectedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>

                  {/* Flight Path Replay */}
                  <Card className="p-4 bg-muted/30">
                    <h3 className="text-sm mb-3 flex items-center gap-2" style={{ color: '#21A68D' }}>
                      <MapPin className="w-4 h-4" />
                      Flight Path
                    </h3>
                    <FlightPathCanvas waypoints={getFlightPath(selectedMission.id)} />
                  </Card>

                  {/* Telemetry Data */}
                  <div className="grid grid-cols-2 gap-4">
                    <Card className="p-4 bg-muted/30">
                      <h3 className="text-sm mb-3">Speed Profile</h3>
                      <ResponsiveContainer width="100%" height={200}>
                        <LineChart data={speedData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                          <XAxis dataKey="time" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                          <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
                          <Tooltip />
                          <Line type="monotone" dataKey="speed" stroke="#21A68D" strokeWidth={2} />
                        </LineChart>
                      </ResponsiveContainer>
                    </Card>

                    <Card className="p-4 bg-muted/30">
                      <h3 className="text-sm mb-3">Altitude Profile</h3>
                      <ResponsiveContainer width="100%" height={200}>
                        <LineChart data={altitudeData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                          <XAxis dataKey="time" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                          <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
                          <Tooltip />
                          <Line type="monotone" dataKey="altitude" stroke="#0F4C75" strokeWidth={2} />
                        </LineChart>
                      </ResponsiveContainer>
                    </Card>
                  </div>

                  {/* Quick Actions */}
                  <div className="flex gap-3 pt-4 border-t border-border">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => setIsReplayOpen(false)}
                    >
                      Close Replay
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download Recording
                    </Button>
                  </div>
                </>
              )}
            </div>
          </SheetContent>
        </Sheet>

        {/* TACTICAL ZOOM — Dialog correctly stacks over Sheet via Radix focus-scope */}
        <Dialog open={!!zoomedReplayImage} onOpenChange={(open) => { if (!open) setZoomedReplayImage(null); }}>
          <DialogContent className="max-w-7xl w-[92vw] p-0 border-0 bg-transparent shadow-none overflow-hidden">
            <div className="relative rounded-xl overflow-hidden border border-[#21A68D]/30 shadow-2xl bg-[#0a0e1a]">
              <img
                src={zoomedReplayImage ?? ''}
                alt="AI Detection Zoom"
                className="w-full object-contain max-h-[80vh] block"
                style={{ background: '#0a0e1a' }}
              />
              {/* Explicit red CLOSE button overlaid on image */}

              <div className="px-3 py-2 border-t border-[#21A68D]/20 bg-[#0a0e1a]/95">
                <span className="text-[10px] text-[#21A68D] font-bold uppercase tracking-widest">AI Detection — Tactical Zoom</span>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}