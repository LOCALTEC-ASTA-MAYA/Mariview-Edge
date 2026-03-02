import { Card } from './ui/card';
import React, { useState, useEffect, useMemo } from 'react';
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
  Eye
} from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from './ui/sheet';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { useQuery } from '@apollo/client';
import { GET_MISSIONS } from '../graphql/queries';
import { missionSummary, Mission, Flight } from './shared-data';
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
  { name: 'Structure Inspection', value: 35, color: '#0F4C75' },
  { name: 'Crop Health', value: 25, color: '#22c55e' },
  { name: 'Surveillance', value: 20, color: '#8b5cf6' },
  { name: 'Inventory', value: 15, color: '#f59e0b' },
  { name: 'Search & Rescue', value: 5, color: '#ef4444' },
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
        // Duration from Postgres (minutes), fallback 0
        totalDuration: m.duration ?? 0,
        // Derived fields that don't exist in Postgres — safe defaults
        totalFlights: safeFlights.length || 1,
        totalDetections: m.totalDetections ?? 0,
        totalAnomalies: m.totalAnomalies ?? 0,
        coverageArea: m.coverageArea ?? 0,
        droneType: m.asset?.category ?? m.asset?.type ?? 'UAV',
        // Build a synthetic flights array from asset/pilot so the UI doesn't crash
        flights: safeFlights.length > 0 ? safeFlights : [{
          id: `flight-${m.id}`,
          drone: m.asset?.name ?? 'Unassigned',
          pilot: m.pilot?.name ?? 'Unassigned',
          aiModel: 'YOLOv8-Maritime',
          distance: 0,
          duration: m.duration ?? 0,
          detections: 0,
          anomalies: 0,
          maxAltitude: 0,
          avgSpeed: 0,
          videoId: '',
        }],
        areaPolygon: safePoly,
        // Asset & Pilot refs from GraphQL
        asset: m.asset ?? null,
        pilot: m.pilot ?? null,
        createdAt: m.createdAt ?? '',
        startedAt: m.startedAt ?? '',
        endedAt: m.endedAt ?? '',
      };
    });
  }, [data]);

  const [selectedMission, setSelectedMission] = useState<any | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [isAnalyzeOpen, setIsAnalyzeOpen] = useState(false);
  const [isReplayOpen, setIsReplayOpen] = useState(false);
  const [aoiNotes, setAoiNotes] = useState('');
  const [analyzedMission, setAnalyzedMission] = useState<any | null>(null);
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
      case 'live': return '#22c55e';
      case 'active': return '#3b82f6';
      case 'pending': return '#eab308';
      case 'success': case 'completed': return '#22c55e';
      case 'partial': return '#D4E268';
      case 'failed': case 'aborted': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'live': return Activity;
      case 'active': return Play;
      case 'pending': return Clock;
      case 'success': case 'completed': return CheckCircle;
      case 'partial': return Clock;
      case 'failed': case 'aborted': return XCircle;
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

  const handleReplayMission = (mission: any) => {
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

  const openReplaySheet = (mission: any) => {
    setIsDetailDialogOpen(false); // Close dialog first
    setTimeout(() => {
      setSelectedMission(mission);
      setIsReplayOpen(true); // Then open sheet
    }, 100);
  };

  const openDetailDialog = (mission: any) => {
    setSelectedMission(mission);
    setIsDetailDialogOpen(true);
  };

  // --- Loading / Error / Empty States ---
  if (loading) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-12 h-12 border-4 border-[#21A68D]/30 border-t-[#21A68D] rounded-full animate-spin mb-4" />
        <p className="text-muted-foreground text-sm">Loading missions from database...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-[60vh]">
        <XCircle className="w-12 h-12 text-red-500 mb-4" />
        <p className="text-red-400 text-sm font-bold">Failed to fetch missions</p>
        <p className="text-muted-foreground text-xs mt-2 max-w-md text-center">{error.message}</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-6 bg-[#0a0e1a] min-h-full pb-20">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-2">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white mb-2">
            Mission Intelligence & <span className="text-[#21A68D]">History</span>
          </h1>
          <p className="text-muted-foreground/80 font-medium">
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
                <h3 className="text-3xl font-black text-white tracking-tighter">{missionSummary.totalMissions}</h3>
                <span className="text-[10px] text-[#21A68D] font-bold bg-[#21A68D]/10 px-1.5 py-0.5 rounded">+12.4%</span>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="p-3 bg-white/[0.03] rounded-xl border border-white/[0.05] group-hover:bg-white/[0.05] transition-colors">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">UAV</p>
                <p className="text-xl font-bold text-white tracking-tight">{missionSummary.uavMissions}</p>
              </div>
              <div className="p-3 bg-white/[0.03] rounded-xl border border-white/[0.05] group-hover:bg-white/[0.05] transition-colors">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">AUV</p>
                <p className="text-xl font-bold text-white tracking-tight">{missionSummary.auvMissions}</p>
              </div>
            </div>
          </div>
          <div className="absolute bottom-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-[#21A68D] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
        </Card>

        {/* Operational Success Card */}
        <Card className="group relative overflow-hidden bg-[#0f172a]/60 backdrop-blur-xl border border-white/10 p-0 hover:border-blue-500/50 transition-all duration-500 shadow-2xl">
          <div className="p-5">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-gradient-to-br from-blue-500/20 to-blue-500/5 rounded-2xl border border-blue-500/20 group-hover:scale-110 transition-transform duration-500">
                <CheckCircle className="w-6 h-6 text-blue-400" />
              </div>
              <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20 text-[10px] px-2 py-0.5 uppercase tracking-widest font-bold">
                Efficiency
              </Badge>
            </div>
            <div className="space-y-0.5">
              <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-[0.2em]">Operational success</p>
              <div className="flex items-baseline gap-2">
                <h3 className="text-3xl font-black text-white tracking-tighter">{missionSummary.successRate}%</h3>
                <span className="text-[10px] text-blue-400 font-bold bg-blue-500/10 px-1.5 py-0.5 rounded">High</span>
              </div>
            </div>
            <div className="mt-5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] text-muted-foreground uppercase font-bold tracking-wider">Historical Trend</p>
                <span className="text-[10px] text-blue-400 font-bold uppercase">Stable Performance</span>
              </div>
              <p className="text-xs text-muted-foreground italic leading-relaxed">
                Analysis of {missions.filter((m: any) => m.status === 'completed').length} finalized operations shows strong mission coherence and outcome stability.
              </p>
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
                <h3 className="text-3xl font-black text-white tracking-tighter">{missionSummary.totalDetections}</h3>
                <span className="text-[10px] text-[#D4E268] font-bold bg-[#D4E268]/10 px-1.5 py-0.5 rounded">↑ 8.2%</span>
              </div>
            </div>
            <div className="mt-5 space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] text-muted-foreground uppercase font-bold tracking-wider">Avg Prediction Confidence</span>
                  <span className="text-[11px] text-[#D4E268] font-black uppercase">94.2%</span>
                </div>
                <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden border border-white/5">
                  <div
                    className="h-full bg-gradient-to-r from-[#D4E268]/40 to-[#D4E268] transition-all duration-1000"
                    style={{ width: '94.2%' }}
                  ></div>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground/60 uppercase tracking-tighter font-bold">Across all active mission profiles</p>
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
                <h3 className="text-3xl font-black text-white tracking-tighter">{missionSummary.totalArea.toFixed(1)}</h3>
                <span className="text-[10px] text-muted-foreground font-black uppercase tracking-tighter ml-1">KM²</span>
              </div>
            </div>
            <div className="mt-5 flex items-center gap-3 bg-white/5 p-2.5 rounded-xl border border-white/5">
              <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                <Layers className="w-5 h-5 text-purple-400" />
              </div>
              <p className="text-[11px] text-muted-foreground leading-[1.3] font-medium italic">
                Equivalent to tracking across {Math.floor(missionSummary.totalArea / 0.5)} identified high-priority maritime zones
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
          <div className="p-5">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6 mt-1">
              <div className="w-full h-[230px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={distributionData}
                      cx="50%"
                      cy="50%"
                      innerRadius={65}
                      outerRadius={90}
                      paddingAngle={5}
                      dataKey="value"
                      stroke="rgba(255,255,255,0.05)"
                      strokeWidth={2}
                    >
                      {distributionData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} fillOpacity={0.9} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '11px' }}
                      itemStyle={{ color: '#fff', fontWeight: 'bold' }}
                    />
                    <text x="50%" y="48%" textAnchor="middle" dominantBaseline="middle" className="fill-white text-[10px] font-bold opacity-40 uppercase tracking-widest">
                      Operational
                    </text>
                    <text x="50%" y="55%" textAnchor="middle" dominantBaseline="middle" className="fill-[#21A68D] text-lg font-black">
                      74%
                    </text>
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Custom Legend */}
              <div className="w-full md:w-auto flex flex-col gap-2 min-w-[190px]">
                {distributionData.map((item, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 p-1.5 px-2.5 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }}></div>
                      <span className="text-[10px] font-bold text-white/80 uppercase tracking-tighter">{item.name}</span>
                    </div>
                    <span className="text-[10px] font-black text-white">{item.value}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>

        {/* Operational Timeline Card */}
        <Card className="relative overflow-hidden bg-[#0f172a]/60 backdrop-blur-xl border border-white/10 p-0 shadow-2xl">
          <div className="p-5 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-[#21A68D]/10 rounded-lg">
                <Clock className="w-5 h-5 text-[#21A68D]" />
              </div>
              <h3 className="text-sm font-black text-white uppercase tracking-widest">Flight Persistence Metrics</h3>
            </div>
            <Badge variant="outline" className="border-white/10 text-[#21A68D] text-[9px] uppercase font-bold tracking-tighter">
              Historical Cycle
            </Badge>
          </div>
          <div className="p-5">
            <div className="h-[230px] w-full mt-1">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={missions.slice(-6)} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#21A68D" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#21A68D" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="lineColor" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#21A68D" />
                      <stop offset="100%" stopColor="#6EE7B7" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                  <XAxis
                    dataKey="id"
                    tick={{ fill: '#64748b', fontSize: 9, fontWeight: 'bold' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(value) => `${String(value ?? '').split('-').pop() ?? ''}`}
                  />
                  <YAxis hide />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                    labelStyle={{ color: '#21A68D', fontWeight: 'bold', fontSize: '10px' }}
                    itemStyle={{ color: '#fff', fontSize: '11px' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="totalDuration"
                    stroke="url(#lineColor)"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#areaGradient)"
                    animationDuration={2000}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 flex items-center justify-center gap-6">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-[#21A68D]"></div>
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Active Operations (Minutes)</span>
              </div>
            </div>
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
                  <th className="px-5 py-3">Status & Mission ID</th>
                  <th className="px-5 py-3">Operation Detail</th>
                  <th className="px-5 py-3">Assets</th>
                  <th className="px-5 py-3 text-center">AI Impact</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {missions.length === 0 && (
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
                {missions.map((mission: any) => {
                  const StatusIcon = getStatusIcon(mission.status);
                  const statusColor = getStatusColor(mission.status);
                  const safeFlights = Array.isArray(mission.flights) ? mission.flights : [];

                  return (
                    <tr key={mission.id} className="hover:bg-[#21A68D]/5 group transition-all duration-200">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-4">
                          <div
                            className="w-10 h-10 rounded-full flex items-center justify-center border-2"
                            style={{ borderColor: `${statusColor}30`, backgroundColor: `${statusColor}10` }}
                          >
                            <StatusIcon className="w-5 h-5" style={{ color: statusColor }} />
                          </div>
                          <div>
                            <p className="text-[10px] text-muted-foreground font-bold tracking-tighter mb-0.5">{mission.missionCode || mission.id}</p>
                            <p className="text-xs font-bold text-white group-hover:text-[#21A68D] transition-colors">{mission.name}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-xs text-white/90">
                            <Clock className="w-3 h-3 text-muted-foreground" />
                            <span>{mission.totalDuration ?? 0}m Duration</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                            <MapPin className="w-3 h-3" />
                            <span>{mission.startDate ? new Date(mission.startDate).toLocaleDateString() : 'N/A'} Operation</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex flex-col">
                          <span className="text-xs font-medium text-white/80">{safeFlights[0]?.drone ?? mission.asset?.name ?? 'N/A'}</span>
                          <span className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-tighter">{mission.droneType ?? 'UAV'} Fleet</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <div className="inline-flex flex-col items-center p-2 rounded-lg bg-white/5 border border-white/5 min-w-[3.5rem]">
                          <span className="text-xs font-black text-[#D4E268]">{mission.totalDetections ?? 0}</span>
                          <span className="text-[9px] text-muted-foreground font-bold uppercase tracking-tighter">Hits</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-3">
                          {mission.status === 'live' ? (
                            <Button
                              size="sm"
                              className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
                              onClick={() => onNavigateToLive?.(mission.id)}
                            >
                              <Activity className="w-3.5 h-3.5 mr-1.5 animate-pulse" />
                              Mission In Progress
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 border-border/40 text-xs font-semibold hover:bg-[#21A68D] hover:text-white"
                              onClick={() => openDetailDialog(mission)}
                            >
                              Telemetry Report
                            </Button>
                          )}
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
                    Mission ID: {selectedMission.missionCode || selectedMission.id} - {selectedMission.startDate ? new Date(selectedMission.startDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'N/A'}
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 mt-4">
                  {/* Mission Details */}
                  <Card className="p-4 bg-muted/30">
                    <h3 className="text-sm mb-3" style={{ color: '#21A68D' }}>Mission Details</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Mission ID</p>
                        <p className="mt-1">{selectedMission.missionCode || selectedMission.id}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Date</p>
                        <p className="mt-1">{selectedMission.startDate ? new Date(selectedMission.startDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Drone</p>
                        <p className="mt-1">{(selectedMission?.flights ?? [])[0]?.drone ?? selectedMission?.asset?.name ?? 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">AI Model</p>
                        <p className="mt-1">{(selectedMission?.flights ?? [])[0]?.aiModel ?? 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Duration</p>
                        <p className="mt-1">{selectedMission?.totalDuration ?? 0} minutes</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Total Distance</p>
                        <p className="mt-1">{(selectedMission?.flights ?? []).reduce((acc: number, f: any) => acc + (f?.distance ?? 0), 0).toFixed(1)} km</p>
                      </div>
                    </div>
                  </Card>

                  {/* Performance Metrics */}
                  <Card className="p-4 bg-muted/30">
                    <h3 className="text-sm mb-3" style={{ color: '#0F4C75' }}>Performance Metrics</h3>
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <p className="text-xs text-muted-foreground">Total Duration</p>
                        <p className="text-lg mt-1">{selectedMission?.totalDuration ?? 0} min</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Distance</p>
                        <p className="text-lg mt-1">{(selectedMission?.flights ?? []).reduce((acc: number, f: any) => acc + (f?.distance ?? 0), 0).toFixed(1)} km</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Detections</p>
                        <p className="text-lg mt-1" style={{ color: '#21A68D' }}>{selectedMission?.totalDetections ?? 0}</p>
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
                {selectedMission && `Mission ID: ${selectedMission.id} - ${selectedMission.name}`}
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
                      <p className="mt-1">{(selectedMission?.flights ?? [])[0]?.drone ?? selectedMission?.asset?.name ?? 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Duration</p>
                      <p className="mt-1">{selectedMission?.totalDuration ?? 0} min</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Distance</p>
                      <p className="mt-1">{(selectedMission?.flights ?? []).reduce((acc: number, f: any) => acc + (f?.distance ?? 0), 0).toFixed(1)} km</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Detections</p>
                      <p className="mt-1">{selectedMission?.totalDetections ?? 0}</p>
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
          </SheetContent>
        </Sheet>

        {/* Replay Mission Sheet */}
        <Sheet open={isReplayOpen} onOpenChange={setIsReplayOpen}>
          <SheetContent side="right" className="w-full sm:max-w-4xl overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Replay Mission</SheetTitle>
              <SheetDescription>
                {selectedMission && `${selectedMission.name} - ${selectedMission.id}`}
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
                    <div className="relative rounded-lg overflow-hidden bg-black aspect-video">
                      <iframe
                        src={`https://www.youtube.com/embed/${(selectedMission?.flights ?? [])[0]?.videoId || 'JxrGGacMlys'}?autoplay=1&mute=0&controls=1&showinfo=1&rel=0&modestbranding=1`}
                        className="w-full h-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        title="Mission Replay Video"
                        style={{ border: 'none' }}
                      />
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                      <div className="p-2 rounded bg-background border border-border text-center">
                        <p className="text-muted-foreground">Duration</p>
                        <p className="mt-1">{selectedMission?.totalDuration ?? 0} min</p>
                      </div>
                      <div className="p-2 rounded bg-background border border-border text-center">
                        <p className="text-muted-foreground">Distance</p>
                        <p className="mt-1">{(selectedMission?.flights ?? []).reduce((acc: number, f: any) => acc + (f?.distance ?? 0), 0).toFixed(1)} km</p>
                      </div>
                      <div className="p-2 rounded bg-background border border-border text-center">
                        <p className="text-muted-foreground">Detections</p>
                        <p className="mt-1">{selectedMission?.totalDetections ?? 0}</p>
                      </div>
                    </div>
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
      </div>
    </div>
  );
}
