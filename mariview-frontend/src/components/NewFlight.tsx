import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useMutation, useQuery } from '@apollo/client';
import { CREATE_MISSION, START_MISSION, DELETE_MISSION, GET_MISSIONS, GET_PILOTS, GET_ASSETS, GET_LIVE_DRONES } from '../graphql/queries';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Checkbox } from './ui/checkbox';
import { Textarea } from './ui/textarea';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Plus, Edit, Trash2, CheckCircle, Users, Plane, ListChecks, ArrowLeft, AlertCircle, ChevronRight, MapPin, Square, Pentagon, Eraser, Radio, Brain, Ship, Anchor, BarChart3, Activity, History as LuHistory, Upload, FileVideo, FileJson, Cpu, Check, X } from 'lucide-react';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from './ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Progress } from './ui/progress';
import { toast } from 'sonner';
import LeafletDrawMap from './LeafletDrawMap';
import LeafletMiniMap from './LeafletMiniMap';
import LiveOperations from './LiveOperationsNew';
import MapOverlayControls from './MapOverlayControls';
import { saveToStorage, loadFromStorage } from '../utils/storage';
import { mockAISData, mockADSBData } from './shared-data';


interface Mission {
  id: string;
  name: string;
  area: string;
  category: string;
  duration: string;
  description: string;
  status: 'pending' | 'accepted' | 'completed' | 'live';
  createdAt: string;
  assignedTeam: string[];
  assignedDevice: string;
  coordinates?: { lat: number; lng: number }[];
}

interface TeamMember {
  id: string;
  name: string;
  role: string;
  status: 'available' | 'assigned' | 'busy';
}

interface Device {
  id: string;
  name: string;
  type: 'UAV' | 'AUV';
  battery: number;
  status: 'available' | 'assigned' | 'maintenance';
}

interface Point {
  x: number;
  y: number;
}

const mockTeamMembers: TeamMember[] = [
  { id: '1', name: 'John Anderson', role: 'Pilot', status: 'available' },
  { id: '2', name: 'Sarah Williams', role: 'Camera Operator', status: 'available' },
  { id: '3', name: 'Mike Chen', role: 'Navigator', status: 'assigned' },
  { id: '4', name: 'Emily Davis', role: 'Pilot', status: 'available' },
  { id: '5', name: 'David Brown', role: 'Technical Specialist', status: 'busy' },
];

const mockDevices: Device[] = [
  { id: '1', name: 'Pyrhos X V1', type: 'UAV', battery: 100, status: 'available' },
  { id: '2', name: 'AR-2 Aerial', type: 'UAV', battery: 85, status: 'available' },
  { id: '3', name: 'AquaScan Alpha', type: 'AUV', battery: 92, status: 'available' },
  { id: '4', name: 'DeepSeeker Pro', type: 'AUV', battery: 78, status: 'available' },
];

const physicalChecks = [
  { id: 'propellers', label: 'Propeller Condition', critical: true },
  { id: 'camera', label: 'Camera Lens Cleanliness', critical: true },
  { id: 'battery', label: 'Battery Connections', critical: true },
  { id: 'gimbal', label: 'Gimbal Movement', critical: true },
  { id: 'sensors', label: 'Sensor Calibration', critical: false },
  { id: 'body', label: 'Body Integrity Check', critical: false },
  { id: 'gps', label: 'GPS Module Status', critical: true },
  { id: 'motors', label: 'Motor Temperatures', critical: false },
];

const uavChecks = [
  { id: 'propellers', label: 'Propeller Condition', critical: true },
  { id: 'camera', label: 'Camera Lens Cleanliness', critical: true },
  { id: 'battery', label: 'Battery Connections', critical: true },
  { id: 'gimbal', label: 'Gimbal Movement', critical: true },
  { id: 'sensors', label: 'Sensor Calibration', critical: false },
  { id: 'body', label: 'Body Integrity Check', critical: false },
  { id: 'gps', label: 'GPS Module Status', critical: true },
  { id: 'motors', label: 'Motor Temperatures', critical: false },
];

const auvChecks = [
  { id: 'hull', label: 'Hull Integrity Check', critical: true },
  { id: 'sonar', label: 'Sonar System Test', critical: true },
  { id: 'battery', label: 'Battery Connections', critical: true },
  { id: 'thrusters', label: 'Thruster Functionality', critical: true },
  { id: 'depth', label: 'Depth Sensor Calibration', critical: false },
  { id: 'seals', label: 'Waterproof Seals Inspection', critical: true },
  { id: 'navigation', label: 'Navigation System Check', critical: true },
  { id: 'communication', label: 'Communication System Test', critical: false },
];

interface NewFlightProps {
  onMissionLaunch?: (missionId?: string) => void;
}

export default function NewFlight({ onMissionLaunch }: NewFlightProps) {
  // GraphQL: Create Mission mutation
  const [createMissionMutation, { loading: isSaving }] = useMutation(CREATE_MISSION, {
    refetchQueries: [{ query: GET_MISSIONS }],
    onCompleted: (data) => {
      toast.success('Mission Created', {
        description: `Mission "${data.createMission.name}" saved to database.`,
      });
    },
    onError: (error) => {
      toast.error('Failed to Create Mission', {
        description: error.message,
      });
    },
  });

  // GraphQL: Start Mission mutation (sets status → ACTIVE, stamps startedAt)
  const [startMissionMutation, { loading: isLaunching }] = useMutation(START_MISSION, {
    refetchQueries: [{ query: GET_MISSIONS }],
    onCompleted: (data) => {
      toast.success('Mission Launched! 🚀', {
        description: `Mission is now ACTIVE. Redirecting to Live Operations...`,
      });
    },
    onError: (error) => {
      toast.error('Failed to Launch Mission', {
        description: error.message,
      });
    },
  });

  // GraphQL: Fetch pilots and assets from Postgres
  const { data: pilotsData } = useQuery(GET_PILOTS);
  const { data: assetsData } = useQuery(GET_ASSETS);

  // GraphQL: Fetch mission list from Postgres
  const { data: missionsData, loading: missionsLoading } = useQuery(GET_MISSIONS, {
    fetchPolicy: 'cache-and-network',
  });

  // Use live Postgres data, fall back to mock data if query hasn't loaded
  const teamMembers = (pilotsData?.getPilots || []).map((p: any) => ({
    id: p.id,
    name: p.name,
    role: p.role,
    status: (p.status || 'AVAILABLE').toLowerCase() === 'available' ? 'available' as const : 'assigned' as const,
  }));
  const useLivePilots = teamMembers.length > 0;
  const finalTeamMembers = useLivePilots ? teamMembers : mockTeamMembers;

  // RBAC: current user context
  const { user: currentUser } = useAuth();
  const isPilotUser = currentUser?.roles?.some(r => r.toLowerCase() === 'pilot') ?? false;
  const isCommanderOrAdmin = currentUser?.roles?.some(r => ['commander', 'admin'].includes(r.toLowerCase())) ?? false;
  const canCreateMission = isCommanderOrAdmin || isPilotUser;

  const devices = (assetsData?.getAssets || []).map((a: any) => ({
    id: a.id,
    name: a.name,
    type: a.category as 'UAV' | 'AUV',
    battery: a.battery || 100,
    status: (a.status || 'STANDBY').toLowerCase() === 'standby' ? 'available' as const : 'assigned' as const,
  }));
  const useLiveAssets = devices.length > 0;
  const finalDevices = useLiveAssets ? devices : mockDevices;

  const [view, setView] = useState<'mission-list' | 'create-mission' | 'accept-mission' | 'pre-check' | 'ai-model-selection' | 'pre-check-summary' | 'live-mission-summary' | 'live-mission-detail' | 'post-analysis' | 'event-detection'>('mission-list');
  const [createStep, setCreateStep] = useState(1);

  // AI Model Selection State (single selection)
  const [selectedAIModel, setSelectedAIModel] = useState<string>('');

  // Post Analysis State
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisTasks, setAnalysisTasks] = useState([
    { id: 1, name: 'Frame Extraction & Alignment', status: 'pending' as 'pending' | 'processing' | 'completed' },
    { id: 2, name: 'Vessel Detection & Tracking', status: 'pending' as 'pending' | 'processing' | 'completed' },
    { id: 3, name: 'Telemetry Interpolation', status: 'pending' as 'pending' | 'processing' | 'completed' },
    { id: 4, name: 'Anomaly Scoring', status: 'pending' as 'pending' | 'processing' | 'completed' },
    { id: 5, name: 'Report Generation', status: 'pending' as 'pending' | 'processing' | 'completed' },
  ]);

  // AI Vision Status (WebSocket from backend /ws/ai-status)
  const [aiStatus, setAiStatus] = useState<string>('OFFLINE');
  const [aiMessage, setAiMessage] = useState<string>('Connecting to AI system...');
  const [aiProgress, setAiProgress] = useState<number>(0);

  // Pre-Flight System Checks
  type CheckState = 'pending' | 'checking' | 'ok' | 'fail';
  const [pfAI,      setPfAI]      = useState<CheckState>('pending');
  const [pfRTSP,    setPfRTSP]    = useState<CheckState>('pending');
  const [pfTelem,   setPfTelem]   = useState<CheckState>('pending');
  const [pfMessage, setPfMessage] = useState<Record<string, string>>({
    ai: 'Waiting for AI engine...', rtsp: 'Probing video stream...', telem: 'Listening for telemetry...'
  });

  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.hostname}:8080/ws/ai-status`;
      ws = new WebSocket(wsUrl);

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.status) setAiStatus(data.status);
          if (data.message) setAiMessage(data.message);
          if (data.progress !== undefined) setAiProgress(data.progress);
        } catch { /* ignore parse errors */ }
      };

      ws.onclose = () => {
        // Auto-reconnect after 3s
        reconnectTimer = setTimeout(connect, 3000);
      };

      ws.onerror = () => {
        ws?.close();
      };
    };

    connect();

    return () => {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, []);

  // ─── Pre-Flight: Poll getLiveDrones every 3s for RTSP + Telemetry checks ───
  const { data: liveDronesData } = useQuery(GET_LIVE_DRONES, {
    pollInterval: 3000,
    fetchPolicy: 'network-only',
    skip: view !== 'pre-check-summary',  // only poll on the summary page
  });

  useEffect(() => {
    const drones: any[] = liveDronesData?.getLiveDrones ?? [];
    const active = drones.find((d: any) => d.lat !== 0 || d.lon !== 0);

    if (active) {
      // RTSP: drone is streaming (vision worker is alive and pushing frames)
      setPfRTSP('ok');
      setPfMessage(prev => ({ ...prev, rtsp: `Stream active — drone "${active.name || active.assetId}" detected` }));
      // Telemetry: lat/lon coming from MAVLink bridge
      setPfTelem('ok');
      setPfMessage(prev => ({ ...prev, telem: `Lat ${active.lat?.toFixed(4)}, Lon ${active.lon?.toFixed(4)} | Alt ${active.alt?.toFixed(1)}m | Bat ${active.battery}%` }));
    } else if (drones.length > 0) {
      // Drones visible but with zero coords → no telemetry yet
      setPfRTSP('ok');
      setPfMessage(prev => ({ ...prev, rtsp: 'Vision worker online — awaiting RTSP frame data' }));
      setPfTelem('checking');
      setPfMessage(prev => ({ ...prev, telem: 'Bridge connected — waiting for MAVLink GPS lock…' }));
    } else {
      // Nothing in InfluxDB yet → both pending/fail
      setPfRTSP('checking');
      setPfMessage(prev => ({ ...prev, rtsp: 'No active stream detected — ensure DRONE_MODE=real and container running' }));
      setPfTelem('checking');
      setPfMessage(prev => ({ ...prev, telem: 'No telemetry in InfluxDB — check MAVLink bridge and injector' }));
    }
  }, [liveDronesData]);

  const handleStartAnalysis = () => {
    if (!selectedMission) return;

    setIsAnalyzing(true);
    setAnalysisProgress(0);
    setAnalysisTasks(prev => prev.map(t => ({ ...t, status: 'pending' })));

    let currentTask = 0;
    const interval = setInterval(() => {
      setAnalysisProgress((prev: number) => {
        const next = prev + 1;

        // Update task statuses based on progress
        if (next === 1) setAnalysisTasks((tasks: any[]) => tasks.map(t => t.id === 1 ? { ...t, status: 'processing' } : t));
        if (next === 20) setAnalysisTasks((tasks: any[]) => tasks.map(t => t.id === 1 ? { ...t, status: 'completed' } : t.id === 2 ? { ...t, status: 'processing' } : t));
        if (next === 50) setAnalysisTasks((tasks: any[]) => tasks.map(t => t.id === 2 ? { ...t, status: 'completed' } : t.id === 3 ? { ...t, status: 'processing' } : t));
        if (next === 70) setAnalysisTasks((tasks: any[]) => tasks.map(t => t.id === 3 ? { ...t, status: 'completed' } : t.id === 4 ? { ...t, status: 'processing' } : t));
        if (next === 90) setAnalysisTasks((tasks: any[]) => tasks.map(t => t.id === 4 ? { ...t, status: 'completed' } : t.id === 5 ? { ...t, status: 'processing' } : t));

        if (next >= 100) {
          clearInterval(interval);
          setAnalysisTasks((tasks: any[]) => tasks.map(t => ({ ...t, status: 'completed' })));
          setIsAnalyzing(false);
          toast.success('Analysis Complete', {
            description: 'Mission report and detections are now available in History.',
          });
          return 100;
        }
        return next;
      });
    }, 100);
  };

  // Map live Postgres missions to local Mission interface.
  // NO mock data — 100% live Postgres data.
  const liveMissions: Mission[] = useMemo(() => {
    if (!missionsData?.getMissions || !Array.isArray(missionsData.getMissions)) return [];
    return missionsData.getMissions.map((m: any) => {
      // Parse areaPolygon safely
      let coords: { lat: number; lng: number }[] = [];
      if (m.areaPolygon) {
        try {
          const parsed = typeof m.areaPolygon === 'string' ? JSON.parse(m.areaPolygon) : m.areaPolygon;
          if (Array.isArray(parsed)) coords = parsed;
        } catch { /* ignore parse errors */ }
      }
      // Map status from Postgres to local UI status (handles both legacy and current values)
      const statusMap: Record<string, Mission['status']> = {
        // Legacy lowercase keys
        planned: 'pending',
        in_progress: 'live',
        completed: 'completed',
        aborted: 'completed',
        // Current uppercase DB values (Go backend stores these)
        PENDING: 'pending',
        LIVE: 'live',
        ACTIVE: 'live',
        COMPLETED: 'completed',
        ABORTED: 'completed',
      };
      // Parse teamMemberIds from DB (JSON array string), fallback to pilot
      let teamMembers: string[] = [];
      if (m.teamMemberIds) {
        try {
          const parsed = JSON.parse(m.teamMemberIds);
          if (Array.isArray(parsed)) teamMembers = parsed;
        } catch { /* ignore */ }
      }
      if (teamMembers.length === 0 && m.pilot?.id) {
        teamMembers = [m.pilot.id];
      }

      return {
        id: m.id ?? '',
        name: m.name ?? 'Unnamed Mission',
        area: coords.length > 0 ? `Area: ${coords.length} points defined` : m.category ?? '',
        category: m.category ?? 'General',
        duration: String(m.duration ?? 0),
        description: m.name ?? '',
        status: statusMap[m.status] ?? (m.status?.toLowerCase() as Mission['status']) ?? 'pending',
        createdAt: m.createdAt ?? new Date().toISOString(),
        assignedTeam: teamMembers,
        assignedDevice: m.asset?.id ?? '',
        coordinates: coords.length > 0 ? coords : undefined,
        lat: coords[0]?.lat ?? -6.1064,
        lng: coords[0]?.lng ?? 106.8818,
      };
    });
  }, [missionsData]);

  // Local-only missions (created in this session before refetch completes)
  const [localMissions, setLocalMissions] = useState<Mission[]>([]);

  // Merge: live Postgres missions + any local-only missions not yet in Postgres
  // Exclude completed missions — they belong in Mission History, not this active list
  const missions = useMemo(() => {
    const liveIds = new Set(liveMissions.map(m => m.id));
    const uniqueLocal = localMissions.filter(m => !liveIds.has(m.id));
    return [...liveMissions, ...uniqueLocal].filter(
      m => m.status !== 'completed'
    );
  }, [liveMissions, localMissions]);

  const [editingMission, setEditingMission] = useState<Mission | null>(null);
  const [missionForm, setMissionForm] = useState({
    name: '',
    area: '',
    category: '',
    duration: '',
    description: '',
  });

  const [selectedMission, setSelectedMission] = useState<Mission | null>(null);
  const [assignedTeam, setAssignedTeam] = useState<string[]>([]);
  const [assignedDevice, setAssignedDevice] = useState<string>('');
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [missionCoordinates, setMissionCoordinates] = useState<{ lat: number; lng: number }[]>([]);
  const [showAIS, setShowAIS] = useState(true);
  const [showADSB, setShowADSB] = useState(true);
  const [showENC, setShowENC] = useState(false);
  const [showWeather, setShowWeather] = useState(false);
  const [isNewCategory, setIsNewCategory] = useState(false);
  const [customCategory, setCustomCategory] = useState('');

  const allCriticalChecked = physicalChecks
    .filter(check => check.critical)
    .every(check => checks[check.id]);

  // Get device type for pre-check
  const getDeviceType = (): 'UAV' | 'AUV' | null => {
    if (!selectedMission) return null;
    const device = mockDevices.find(d => d.id === selectedMission.assignedDevice);
    return device?.type || null;
  };

  // Get appropriate checks based on device type
  const getPreCheckList = () => {
    const deviceType = getDeviceType();
    if (deviceType === 'UAV') return uavChecks;
    if (deviceType === 'AUV') return auvChecks;
    return physicalChecks; // fallback
  };

  const currentCheckList = getPreCheckList();
  const allCurrentCriticalChecked = currentCheckList
    .filter(check => check.critical)
    .every(check => checks[check.id]);

  // Canvas Drawing
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawingMode, setDrawingMode] = useState<'polygon' | 'rectangle' | null>(null);
  const [points, setPoints] = useState<Point[]>([]);
  const [drawnShapes, setDrawnShapes] = useState<Point[][]>([]);

  useEffect(() => {
    if (view === 'create-mission' && createStep === 1 && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw grid background
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 1;
      for (let i = 0; i < canvas.width; i += 50) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, canvas.height);
        ctx.stroke();
      }
      for (let i = 0; i < canvas.height; i += 50) {
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(canvas.width, i);
        ctx.stroke();
      }

      // Draw all saved shapes
      drawnShapes.forEach(shape => {
        if (shape.length > 0) {
          ctx.fillStyle = 'rgba(33, 166, 141, 0.2)';
          ctx.strokeStyle = '#21A68D';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(shape[0].x, shape[0].y);
          shape.forEach(point => ctx.lineTo(point.x, point.y));
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }
      });

      // Draw current polygon
      if (drawingMode === 'polygon' && points.length > 0) {
        ctx.strokeStyle = '#21A68D';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        points.forEach(point => ctx.lineTo(point.x, point.y));
        ctx.stroke();
        ctx.setLineDash([]);

        // Draw points
        points.forEach(point => {
          ctx.fillStyle = '#21A68D';
          ctx.beginPath();
          ctx.arc(point.x, point.y, 5, 0, Math.PI * 2);
          ctx.fill();
        });
      }
    }
  }, [view, createStep, points, drawnShapes, drawingMode]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (drawingMode !== 'polygon') return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setPoints([...points, { x, y }]);
  };

  const startPolygonDrawing = () => {
    setDrawingMode('polygon');
    setPoints([]);
  };

  const finishPolygonDrawing = () => {
    if (points.length >= 3) {
      setDrawnShapes([...drawnShapes, points]);
      const coords = `Area: ${points.length} points defined`;
      setMissionForm(prev => ({ ...prev, area: coords }));
    }
    setDrawingMode(null);
    setPoints([]);
  };

  const drawRectangle = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const width = 200;
    const height = 150;

    const rectanglePoints: Point[] = [
      { x: centerX - width / 2, y: centerY - height / 2 },
      { x: centerX + width / 2, y: centerY - height / 2 },
      { x: centerX + width / 2, y: centerY + height / 2 },
      { x: centerX - width / 2, y: centerY + height / 2 },
    ];

    setDrawnShapes([...drawnShapes, rectanglePoints]);
    setMissionForm(prev => ({ ...prev, area: 'Rectangle Area Defined' }));
  };

  const clearDrawing = () => {
    setDrawnShapes([]);
    setPoints([]);
    setDrawingMode(null);
    setMissionForm(prev => ({ ...prev, area: '' }));
  };

  // CRUD Mission Functions
  const handleCreateMission = async () => {
    // Prevent double-submit while mutation is in-flight
    if (isSaving) return;

    // Build the polygon string from drawn coordinates
    const polygonStr = missionCoordinates.length > 0
      ? JSON.stringify(missionCoordinates)
      : missionForm.area || '[]';

    // Find the selected pilot and device UUIDs
    // For now, map team member IDs and device IDs from local mock lists.
    // The assigned pilot is the first team member; the asset is the selected device.
    const pilotMember = mockTeamMembers.find(t => t.id === assignedTeam[0]);
    const device = mockDevices.find(d => d.id === assignedDevice);

    const missionCode = 'AUTO';

    try {
      // Call GraphQL mutation → Postgres
      // refetchQueries on the hook will auto-refresh the mission list
      await createMissionMutation({
        variables: {
          input: {
            missionCode,
            name: missionForm.name,
            category: missionForm.category || 'General',
            areaPolygon: polygonStr,
            duration: parseInt(missionForm.duration, 10) || 0,
            // These IDs must be valid Postgres UUIDs.
            // When real Pilots/Assets are loaded from DB, use their real IDs.
            // For now, pass the mock IDs — the backend will validate.
            assetId: assignedDevice,
            pilotId: assignedTeam[0] || '',
            teamMemberIds: JSON.stringify(assignedTeam),
          },
        },
      });

      // No local optimistic append — refetchQueries handles the list refresh
      // from Postgres, preventing duplicate entries (local ID ≠ DB UUID).
      resetForm();
      setView('mission-list');
    } catch (err) {
      // Error already handled by onError callback
      console.error('[CreateMission] Mutation failed:', err);
    }
  };

  const handleUpdateMission = () => {
    if (editingMission) {
      setLocalMissions(prev => prev.map(m =>
        m.id === editingMission.id
          ? { ...m, ...missionForm, assignedTeam, assignedDevice, coordinates: missionCoordinates.length > 0 ? missionCoordinates : m.coordinates }
          : m
      ));
      resetForm();
      setEditingMission(null);
      setView('mission-list');
    }
  };

  const [deleteMissionMutation] = useMutation(DELETE_MISSION, {
    refetchQueries: [{ query: GET_MISSIONS }],
  });

  const handleDeleteMission = async (id: string) => {
    if (!confirm('Are you sure you want to delete this mission?')) return;
    try {
      await deleteMissionMutation({ variables: { id } });
      // Also remove from local state
      setLocalMissions(prev => prev.filter(m => m.id !== id));
      toast.success('Mission deleted');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete mission');
    }
  };

  const resetForm = () => {
    setMissionForm({
      name: '',
      area: '',
      category: '',
      duration: '',
      description: '',
    });
    setAssignedTeam([]);
    setAssignedDevice('');
    setCreateStep(1);
    setDrawnShapes([]);
    setPoints([]);
    setDrawingMode(null);
    setIsNewCategory(false);
    setCustomCategory('');
  };

  const handleEditClick = (mission: Mission) => {
    setEditingMission(mission);
    setMissionForm({
      name: mission.name,
      area: mission.area,
      category: mission.category,
      duration: mission.duration,
      description: mission.description,
    });
    setAssignedTeam(mission.assignedTeam);
    setAssignedDevice(mission.assignedDevice);
    setCreateStep(1);
    setView('create-mission');
  };

  const handleAcceptMission = (mission: Mission) => {
    setSelectedMission(mission);
    setAssignedTeam(mission.assignedTeam);
    setView('accept-mission');
  };

  const handleViewLiveMission = (mission: Mission) => {
    // Always show the Live Mission Summary first
    setSelectedMission(mission);
    setAssignedTeam(mission.assignedTeam);
    setView('live-mission-summary');
  };

  const handleProceedToPreCheck = () => {
    setView('pre-check');
  };

  const handleLaunchMission = async () => {
    if (!selectedMission) return;

    try {
      // Call GraphQL mutation → Postgres: sets status = ACTIVE, stamps startedAt
      await startMissionMutation({
        variables: { id: selectedMission.id },
      });

      // Update local state optimistically
      setLocalMissions(prev => prev.map(m =>
        m.id === selectedMission.id
          ? { ...m, status: 'live' as const, assignedTeam }
          : m
      ));
      setSelectedMission({ ...selectedMission, status: 'live' as const });

      // Redirect to Live Operations view via parent callback, passing the mission ID
      if (onMissionLaunch) {
        onMissionLaunch(selectedMission.id);
      }
    } catch (err) {
      // Error already handled by onError callback above
      console.error('[LaunchMission] Mutation failed:', err);
    }
  };

  const canProceedStep1 = missionForm.name && missionForm.area;
  const canProceedStep2 = assignedTeam.length > 0;
  const canProceedStep3 = assignedDevice !== '';

  return (
    <div className={`p-4 md:p-6 w-full ${['live-mission-detail', 'post-analysis'].includes(view) ? '!p-0' : ''}`}>
      {/* Header */}
      {!['live-mission-detail', 'post-analysis'].includes(view) && (
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl text-[rgb(255,255,255)]">
            {['mission-list', 'event-detection'].includes(view) && 'Mission Management'}
            {view === 'create-mission' && (editingMission ? 'Edit Mission' : 'Create New Mission')}
            {view === 'accept-mission' && 'Mission Details'}
            {view === 'pre-check' && 'Pre-Flight Check'}
            {view === 'ai-model-selection' && 'AI Model Selection'}
            {view === 'pre-check-summary' && 'Pre-Flight Check Summary'}
            {view === 'live-mission-summary' && 'Live Mission Summary'}
          </h1>
          <p className="text-muted-foreground text-sm md:text-base">
            {['mission-list', 'event-detection'].includes(view) && 'Manage and deploy drone missions'}
            {view === 'create-mission' && createStep === 1 && 'Configure mission parameters'}
            {view === 'create-mission' && createStep === 2 && 'Select team members for mission'}
            {view === 'create-mission' && createStep === 3 && 'Choose drone for deployment'}
            {view === 'accept-mission' && 'Review and accept mission assignment'}
            {view === 'pre-check' && 'Complete pre-flight inspection checklist'}
            {view === 'ai-model-selection' && 'Select AI detection models for this mission'}
            {view === 'pre-check-summary' && 'Review inspection results before launch'}
            {view === 'live-mission-summary' && 'Review mission status and progress'}
          </p>
        </div>
      )}

      {/* Mission Section Navigation */}
      {!['live-mission-detail', 'post-analysis'].includes(view) && (
        <div className="flex items-center gap-3 mb-6">
          {canCreateMission && (
            <Button
              onClick={() => {
                resetForm();
                setEditingMission(null);
                setView('create-mission');
                // Auto-fill pilot user as Lead Pilot (first team member)
                if (isPilotUser && currentUser?.id) {
                  setAssignedTeam([currentUser.id]);
                }
              }}
              className="bg-[#21A68D] hover:bg-[#1a8a72] text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Mission
            </Button>
          )}
          <Button
            variant={view === 'mission-list' ? 'default' : 'outline'}
            className={`transition-all duration-300 hover:scale-105 active:scale-95 shadow-sm hover:shadow-md ${view === 'mission-list'
              ? 'bg-[#0F4C75] hover:bg-[#0d3d5e] text-white border-[#0F4C75]'
              : 'border-[#0F4C75] text-[#0F4C75] hover:bg-[#0F4C75]/10'
              }`}
            onClick={() => setView('mission-list')}
          >
            <LuHistory className="w-4 h-4 mr-2" />
            Mission List
          </Button>
          <Button
            variant={view === 'event-detection' ? 'default' : 'outline'}
            className={`transition-all duration-300 hover:scale-105 active:scale-95 shadow-sm hover:shadow-md ${view === 'event-detection'
              ? 'bg-[#0F4C75] hover:bg-[#0d3d5e] text-white border-[#0F4C75]'
              : 'border-[#0F4C75] text-[#0F4C75] hover:bg-[#0F4C75]/10'
              }`}
            onClick={() => setView('event-detection')}
          >
            <Activity className="w-4 h-4 mr-2" />
            Event Detection
          </Button>
          <Button
            variant={view === 'post-analysis' ? 'default' : 'outline'}
            className={`transition-all duration-300 hover:scale-105 active:scale-95 shadow-sm hover:shadow-md ${view === 'post-analysis'
              ? 'bg-[#0F4C75] hover:bg-[#0d3d5e] text-white border-[#0F4C75]'
              : 'border-[#0F4C75] text-[#0F4C75] hover:bg-[#0F4C75]/10'
              }`}
            onClick={() => setView('post-analysis')}
          >
            <BarChart3 className="w-4 h-4 mr-2" />
            Post Analysis
          </Button>
        </div>
      )}

      {view === 'mission-list' && (
        <div className="space-y-6">

          {/* Loading state */}
          {missionsLoading && missions.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-10 h-10 border-4 border-[#21A68D]/30 border-t-[#21A68D] rounded-full animate-spin mb-4" />
              <p className="text-muted-foreground text-sm">Loading missions from database...</p>
            </div>
          )}

          {/* Empty state */}
          {!missionsLoading && missions.length === 0 && (
            <Card className="p-12 bg-card border-border text-center">
              <div className="flex flex-col items-center gap-3">
                <ListChecks className="w-12 h-12 text-muted-foreground/30" />
                <p className="text-lg text-muted-foreground font-bold">No missions available</p>
                <p className="text-sm text-muted-foreground/60">Click "Create Mission" to plan your first operation.</p>
              </div>
            </Card>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {missions.map((mission) => (
              <Card key={mission.id} className="p-5 bg-card border-border hover:border-[#21A68D] transition-all">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-lg">{mission.name}</h3>
                      {mission.status === 'live' && (
                        <div className="flex items-center gap-1 bg-[#22c55e]/20 border border-[#22c55e] px-2 py-0.5 rounded">
                          <div className="w-2 h-2 bg-[#22c55e] rounded-full animate-pulse" />
                          <span className="text-xs font-bold text-[#22c55e]">LIVE</span>
                        </div>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{mission.area}</p>
                  </div>
                  {/* Only show status badge if not live */}
                  {mission.status !== 'live' && (
                    <Badge
                      variant="outline"
                      className={
                        mission.status === 'pending' ? 'border-[#D4E268] text-[#D4E268]' :
                          mission.status === 'accepted' ? 'border-[#0F4C75] text-[#0F4C75]' :
                            'border-[#21A68D] text-[#21A68D]'
                      }
                    >
                      {mission.status}
                    </Badge>
                  )}
                </div>

                {/* Mini Map Preview */}
                {mission.coordinates && mission.coordinates.length > 0 && (
                  <div className="mb-4 rounded-lg overflow-hidden border border-border">
                    <LeafletMiniMap coordinates={mission.coordinates} />
                  </div>
                )}

                <div className="space-y-2 text-sm mb-4">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Category:</span>
                    <span>{mission.category ?? 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Duration:</span>
                    <span>{mission.duration ?? '0'} {Number(mission.duration) > 24 ? 'min' : 'days'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Team:</span>
                    <span>{(mission.assignedTeam ?? []).length} members</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Drone:</span>
                    <span>{finalDevices.find((d: any) => d.id === mission.assignedDevice)?.name || 'Not assigned'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Created:</span>
                    <span>{mission.createdAt ? new Date(mission.createdAt).toLocaleDateString() : 'N/A'}</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  {mission.status === 'pending' && (
                    <Button
                      size="sm"
                      onClick={() => handleAcceptMission(mission)}
                      className="flex-1 bg-[#21A68D] hover:bg-[#1a8a72] text-white"
                    >
                      Accept Mission
                    </Button>
                  )}
                  {(mission.status === 'live' || mission.status === 'accepted') && (
                    <Button
                      size="sm"
                      onClick={() => handleViewLiveMission(mission)}
                      className="flex-1 bg-[#22c55e]/20 text-[#22c55e] hover:bg-[#22c55e]/30"
                    >
                      Mission In Progress
                    </Button>
                  )}
                  {mission.status === 'pending' && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEditClick(mission)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDeleteMission(mission.id)}
                        className="border-red-500 text-red-500 hover:bg-red-500 hover:text-white"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </div>
      )
      }

      {/* Create/Edit Mission View */}
      {
        view === 'create-mission' && (
          <div className="space-y-6">
            {/* Progress Steps */}
            <div className="flex items-center justify-between w-full max-w-4xl">
              {[
                { num: 1, label: 'Mission Info' },
                { num: 2, label: 'Assign Team' },
                { num: 3, label: 'Assign Device' },
              ].map((s, idx) => (
                <div key={s.num} className="flex items-center flex-1">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${createStep > s.num
                        ? 'bg-[#21A68D] border-[#21A68D] text-white'
                        : createStep === s.num
                          ? 'border-[#21A68D] text-[#21A68D]'
                          : 'border-muted text-muted-foreground'
                        }`}
                    >
                      {createStep > s.num ? <CheckCircle className="w-5 h-5" /> : s.num}
                    </div>
                    <div className="hidden sm:block">
                      <p className={`text-sm ${createStep >= s.num ? 'text-foreground' : 'text-muted-foreground'}`}>
                        {s.label}
                      </p>
                    </div>
                  </div>
                  {idx < 2 && (
                    <div className={`flex-1 h-0.5 mx-4 ${createStep > s.num ? 'bg-[#21A68D]' : 'bg-muted'}`}></div>
                  )}
                </div>
              ))}
            </div>

            {/* Step 1: Mission Info */}
            {createStep === 1 && (
              <Card className="p-6 bg-card border-border">
                <div className="space-y-6">
                  <div>
                    <h2>Mission Parameters</h2>
                    <p className="text-sm text-muted-foreground">Define the basic mission configuration</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="mission-name">Mission Name *</Label>
                      <Input
                        id="mission-name"
                        placeholder="e.g., Downtown Infrastructure Scan"
                        value={missionForm.name}
                        onChange={(e) => setMissionForm({ ...missionForm, name: e.target.value })}
                        className="bg-input"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="duration">Mission Duration (days)</Label>
                      <Input
                        id="duration"
                        type="number"
                        placeholder="e.g., 3"
                        value={missionForm.duration}
                        onChange={(e) => setMissionForm({ ...missionForm, duration: e.target.value })}
                        className="bg-input"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="category">Mission Category</Label>
                      <Select
                        value={isNewCategory ? 'New Category' : missionForm.category}
                        onValueChange={(value: string) => {
                          if (value === 'New Category') {
                            setIsNewCategory(true);
                            setMissionForm({ ...missionForm, category: '' });
                          } else {
                            setIsNewCategory(false);
                            setCustomCategory('');
                            setMissionForm({ ...missionForm, category: value });
                          }
                        }}
                      >
                        <SelectTrigger id="category" className="bg-input">
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent className="z-[10000]">
                          <SelectItem value="Infrastructure Assessment">Infrastructure Assessment</SelectItem>
                          <SelectItem value="Environmental Monitoring">Environmental Monitoring</SelectItem>
                          <SelectItem value="Search and Rescue">Search and Rescue</SelectItem>
                          <SelectItem value="Agriculture Survey">Agriculture Survey</SelectItem>
                          <SelectItem value="Security Patrol">Security Patrol</SelectItem>
                          <SelectItem value="Mapping and Survey">Mapping and Survey</SelectItem>
                          <SelectItem value="Emergency Response">Emergency Response</SelectItem>
                          <SelectItem value="New Category">+ New Category</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Custom Category Input - Positioned in grid */}
                    {isNewCategory ? (
                      <div className="space-y-2">
                        <Label htmlFor="custom-category">Enter New Category Name *</Label>
                        <Input
                          id="custom-category"
                          placeholder="e.g., Disaster Relief"
                          value={customCategory}
                          onChange={(e) => {
                            setCustomCategory(e.target.value);
                            setMissionForm({ ...missionForm, category: e.target.value });
                          }}
                          className="bg-input"
                        />
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {/* Empty placeholder to maintain grid layout */}
                      </div>
                    )}
                  </div>

                  {/* Leaflet Map for Drawing Area */}
                  <div className="space-y-2">
                    <Label>
                      <MapPin className="w-4 h-4 inline mr-2" />
                      Draw Mission Area on Map
                    </Label>

                    <div className="flex gap-2 mb-2">
                      <Button
                        type="button"
                        size="sm"
                        variant={drawingMode === 'polygon' ? 'default' : 'outline'}
                        onClick={() => {
                          if (drawingMode === 'polygon') {
                            (window as any).leafletDrawMap?.finishPolygon();
                            setDrawingMode(null);
                          } else {
                            (window as any).leafletDrawMap?.startPolygon();
                            setDrawingMode('polygon');
                          }
                        }}
                        className={drawingMode === 'polygon' ? 'bg-[#21A68D] hover:bg-[#1a8a72]' : ''}
                      >
                        <Pentagon className="w-4 h-4 mr-2" />
                        {drawingMode === 'polygon' ? 'Finish Polygon' : 'Draw Polygon'}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => (window as any).leafletDrawMap?.drawRectangle()}
                        disabled={drawingMode === 'polygon'}
                      >
                        <Square className="w-4 h-4 mr-2" />
                        Draw Rectangle
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          (window as any).leafletDrawMap?.clear();
                          setMissionForm(prev => ({ ...prev, area: '' }));
                        }}
                        className="border-red-500 text-red-500 hover:bg-red-500 hover:text-white"
                      >
                        <Eraser className="w-4 h-4 mr-2" />
                        Clear
                      </Button>
                    </div>

                    <div className="relative">
                      <LeafletDrawMap
                        center={[-10.20073, 123.53838]}
                        zoom={13}
                        className="rounded-lg border-2 border-border overflow-hidden"
                        onAreaDrawn={(coordinates, description) => {
                          setMissionForm(prev => ({ ...prev, area: description }));
                          setMissionCoordinates(coordinates);
                        }}
                        aisMarkers={mockAISData || []}
                        adsbMarkers={mockADSBData || []}
                        showAIS={showAIS}
                        showADSB={showADSB}
                        showENC={showENC}
                        height="600px"
                      />
                      <MapOverlayControls
                        mapView="kupang"
                        onMapViewChange={() => { }}
                        aisCount={(mockAISData || []).length}
                        nonAisCount={0}
                        activeUavCount={0}
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
                        showLayers={false}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {drawingMode === 'polygon'
                        ? 'Click on the map to add points. Click "Finish Polygon" when done (minimum 3 points).'
                        : 'Use the drawing tools above to define your mission area on the map.'}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Mission Description</Label>
                    <Textarea
                      id="description"
                      placeholder="Describe the mission objectives and any special requirements..."
                      value={missionForm.description}
                      onChange={(e) => setMissionForm({ ...missionForm, description: e.target.value })}
                      className="bg-input min-h-24"
                    />
                  </div>

                  {!canProceedStep1 && (
                    <div className="p-3 rounded-lg border" style={{ borderColor: '#D4E268', backgroundColor: 'rgba(212, 226, 104, 0.1)' }}>
                      <p className="text-sm" style={{ color: '#D4E268' }}>
                        ⚠ Please fill in Mission Name and draw an area on the canvas to continue
                      </p>
                    </div>
                  )}

                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      onClick={() => {
                        resetForm();
                        setView('mission-list');
                      }}
                    >
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Cancel
                    </Button>
                    <Button
                      onClick={() => setCreateStep(2)}
                      disabled={!canProceedStep1}
                      className="bg-[#21A68D] hover:bg-[#1a8a72] text-white"
                    >
                      Next: Assign Team
                      <ChevronRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </div>
              </Card>
            )}

            {/* Step 2: Assign Team */}
            {createStep === 2 && (
              <Card className="p-6 bg-card border-border">
                <div className="space-y-6">
                  <div>
                    <h2>Assign Team Members</h2>
                    <p className="text-sm text-muted-foreground">Select team members for this mission</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {finalTeamMembers.map((member: { id: string; name: string; role: string; status: string }) => {
                      const isAssigned = assignedTeam.includes(member.id);
                      return (
                        <Card
                          key={member.id}
                          className={`p-4 cursor-pointer transition-all ${isAssigned ? 'border-[#21A68D] border-2' : 'border-border'
                            } ${member.status === 'busy' ? 'opacity-50' : ''}`}
                          onClick={() => {
                            if (member.status !== 'busy') {
                              setAssignedTeam(
                                isAssigned
                                  ? assignedTeam.filter(id => id !== member.id)
                                  : [...assignedTeam, member.id]
                              );
                            }
                          }}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-full bg-[#21A68D] flex items-center justify-center text-white">
                              {member.name.split(' ').map((n: string) => n[0]).join('')}
                            </div>
                            <div className="flex-1">
                              <p className="font-medium">{member.name}</p>
                              <p className="text-sm text-muted-foreground">{member.role}</p>
                            </div>
                            {isAssigned && <CheckCircle className="w-5 h-5 text-[#21A68D]" />}
                          </div>
                          <Badge
                            variant="outline"
                            className={`mt-3 ${member.status === 'available' ? 'border-green-500 text-green-500' :
                              member.status === 'assigned' ? 'border-[#0F4C75] text-[#0F4C75]' :
                                'border-red-500 text-red-500'
                              }`}
                          >
                            {member.status}
                          </Badge>
                        </Card>
                      );
                    })}
                  </div>

                  {!canProceedStep2 && (
                    <div className="p-3 rounded-lg border" style={{ borderColor: '#D4E268', backgroundColor: 'rgba(212, 226, 104, 0.1)' }}>
                      <p className="text-sm" style={{ color: '#D4E268' }}>
                        ⚠ Please select at least one team member to continue
                      </p>
                    </div>
                  )}

                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      onClick={() => setCreateStep(1)}
                    >
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Back
                    </Button>
                    <Button
                      disabled={!canProceedStep2}
                      className="bg-[#21A68D] hover:bg-[#1a8a72] text-white"
                      onClick={() => setCreateStep(3)}
                    >
                      Next: Assign Device
                      <ChevronRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </div>
              </Card>
            )}

            {/* Step 3: Assign Device */}
            {createStep === 3 && (
              <Card className="p-6 bg-card border-border">
                <div className="space-y-6">
                  <div>
                    <h2>Assign Drone</h2>
                    <p className="text-sm text-muted-foreground">Select a drone for this mission</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {finalDevices.map((device: { id: string; name: string; type: string; battery: number; status: string }) => {
                      const isSelected = assignedDevice === device.id;
                      const isDisabled = device.status === 'maintenance' || device.battery < 20;
                      return (
                        <Card
                          key={device.id}
                          className={`p-4 cursor-pointer transition-all ${isSelected ? 'border-[#21A68D] border-2' : 'border-border'
                            } ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                          onClick={() => {
                            if (!isDisabled) {
                              setAssignedDevice(device.id);
                            }
                          }}
                        >
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <h3 className="font-medium mb-1">{device.name}</h3>
                              <Badge variant="outline" className="text-xs">
                                {device.type}
                              </Badge>
                            </div>
                            {isSelected && <CheckCircle className="w-5 h-5 text-[#21A68D]" />}
                          </div>

                          <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Battery:</span>
                              <span className={device.battery < 30 ? 'text-red-500' : 'text-green-500'}>
                                {device.battery}%
                              </span>
                            </div>
                            <div className="w-full bg-muted rounded-full h-2">
                              <div
                                className={`h-2 rounded-full ${device.battery < 30 ? 'bg-red-500' :
                                  device.battery < 60 ? 'bg-yellow-500' :
                                    'bg-green-500'
                                  }`}
                                style={{ width: `${device.battery}%` }}
                              />
                            </div>
                            <Badge
                              variant="outline"
                              className={`${device.status === 'available' ? 'border-green-500 text-green-500' :
                                device.status === 'assigned' ? 'border-[#0F4C75] text-[#0F4C75]' :
                                  'border-red-500 text-red-500'
                                }`}
                            >
                              {device.status}
                            </Badge>
                          </div>
                        </Card>
                      );
                    })}
                  </div>

                  {!canProceedStep3 && (
                    <div className="p-3 rounded-lg border" style={{ borderColor: '#D4E268', backgroundColor: 'rgba(212, 226, 104, 0.1)' }}>
                      <p className="text-sm" style={{ color: '#D4E268' }}>
                        ⚠ Please select a drone to continue
                      </p>
                    </div>
                  )}

                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      onClick={() => setCreateStep(2)}
                    >
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Back
                    </Button>
                    <Button
                      disabled={!canProceedStep3 || isSaving}
                      className="bg-[#21A68D] hover:bg-[#1a8a72] text-white"
                      onClick={editingMission ? handleUpdateMission : handleCreateMission}
                    >
                      {isSaving ? (
                        <>
                          <div className="w-4 h-4 mr-2 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-4 h-4 mr-2" />
                          {editingMission ? 'Update Mission' : 'Create Mission'}
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </Card>
            )}
          </div>
        )
      }

      {/* Accept Mission View */}
      {
        view === 'accept-mission' && selectedMission && (
          <Card className="p-6 bg-card border-border">
            <div className="space-y-6">
              <div className="p-4 rounded-lg bg-[#21A68D]/10 border border-[#21A68D]">
                <h2 className="text-xl mb-2">{selectedMission.name}</h2>
                <p className="text-muted-foreground">{selectedMission.description}</p>
              </div>

              {/* Mission Area Map Preview */}
              {selectedMission.coordinates && selectedMission.coordinates.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm" style={{ color: '#21A68D' }}>Mission Area</h3>
                  <div className="rounded-lg overflow-hidden border border-border">
                    <LeafletMiniMap coordinates={selectedMission.coordinates} />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <h3 className="text-sm" style={{ color: '#21A68D' }}>Mission Parameters</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Area:</span>
                      <span>{selectedMission.area}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Category:</span>
                      <span>{selectedMission.category}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Duration:</span>
                      <span>{selectedMission.duration} days</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Drone:</span>
                      <span>{mockDevices.find(d => d.id === selectedMission.assignedDevice)?.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Created:</span>
                      <span>{new Date(selectedMission.createdAt).toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="text-sm" style={{ color: '#0F4C75' }}>Assignment Status</h3>
                  <div className="space-y-2">
                    <div className="p-3 rounded-lg bg-muted/30 flex items-center justify-between">
                      <span className="text-sm">Team Members</span>
                      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                        <DialogTrigger asChild>
                          <Button size="sm" variant="outline">
                            <Users className="w-4 h-4 mr-1" />
                            Edit Team
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="bg-card border-border">
                          <DialogHeader>
                            <DialogTitle>Edit Team Assignment</DialogTitle>
                            <DialogDescription>
                              Select team members for this mission
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-3 max-h-[400px] overflow-y-auto">
                            {mockTeamMembers.map((member) => {
                              const isAssigned = assignedTeam.includes(member.id);
                              return (
                                <Card
                                  key={member.id}
                                  className={`p-3 cursor-pointer ${isAssigned ? 'border-[#21A68D]' : ''
                                    }`}
                                  onClick={() => {
                                    if (member.status !== 'busy') {
                                      setAssignedTeam(
                                        isAssigned
                                          ? assignedTeam.filter(id => id !== member.id)
                                          : [...assignedTeam, member.id]
                                      );
                                    }
                                  }}
                                >
                                  <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-full bg-[#21A68D] flex items-center justify-center text-white text-xs">
                                      {member.name.split(' ').map(n => n[0]).join('')}
                                    </div>
                                    <div className="flex-1">
                                      <p className="text-sm font-medium">{member.name}</p>
                                      <p className="text-xs text-muted-foreground">{member.role}</p>
                                    </div>
                                    {isAssigned && <CheckCircle className="w-4 h-4 text-[#21A68D]" />}
                                  </div>
                                </Card>
                              );
                            })}
                          </div>
                          <Button
                            onClick={() => setIsDialogOpen(false)}
                            className="bg-[#21A68D] hover:bg-[#1a8a72] text-white"
                          >
                            Confirm
                          </Button>
                        </DialogContent>
                      </Dialog>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/30">
                      <div className="space-y-1">
                        <span className="text-sm text-muted-foreground block mb-2">
                          {assignedTeam.length} members assigned:
                        </span>
                        {assignedTeam.map(teamId => {
                          const member = mockTeamMembers.find(m => m.id === teamId);
                          return member ? (
                            <div key={teamId} className="text-sm flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-[#21A68D] flex items-center justify-center text-white text-xs">
                                {member.name.split(' ').map(n => n[0]).join('')}
                              </div>
                              <span>{member.name}</span>
                              <span className="text-muted-foreground">({member.role})</span>
                            </div>
                          ) : null;
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setView('mission-list')}
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to List
                </Button>
                <Button
                  onClick={handleProceedToPreCheck}
                  className="bg-[#21A68D] hover:bg-[#1a8a72] text-white"
                >
                  <ListChecks className="w-4 h-4 mr-2" />
                  Proceed to Pre-Check
                </Button>
              </div>
            </div>
          </Card>
        )
      }

      {/* Pre-Flight Check View */}
      {
        view === 'pre-check' && (
          <Card className="p-6 bg-card border-border">
            <div className="space-y-6">
              <div className="p-4 rounded-lg bg-[#0F4C75]/10 border border-[#0F4C75]">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-[#0F4C75]" />
                  <p className="text-sm">Complete all critical checks before launching the mission</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {currentCheckList.map((check) => (
                  <label key={check.id} htmlFor={check.id} className="cursor-pointer block">
                    <Card className={`p-4 transition-colors hover:border-[#21A68D]/50 ${checks[check.id] ? 'border-[#21A68D]' : 'border-border'}`}>
                      <div className="flex items-start gap-3">
                        <Checkbox
                          id={check.id}
                          checked={checks[check.id] || false}
                          onCheckedChange={(checked: boolean) => setChecks({ ...checks, [check.id]: !!checked })}
                          className="mt-1"
                        />
                        <div className="flex-1">
                          <span
                            className="text-sm cursor-pointer flex items-center gap-2"
                          >
                            {check.label}
                            {check.critical && (
                              <Badge variant="outline" className="text-xs" style={{ borderColor: '#ef4444', color: '#ef4444' }}>
                                Critical
                              </Badge>
                            )}
                          </span>
                          {checks[check.id] && (
                            <p className="text-xs text-muted-foreground mt-1">✓ Verified at {new Date().toLocaleTimeString()}</p>
                          )}
                        </div>
                      </div>
                    </Card>
                  </label>
                ))}
              </div>

              {!allCurrentCriticalChecked && (
                <div className="p-4 rounded-lg border" style={{ borderColor: '#D4E268', backgroundColor: 'rgba(212, 226, 104, 0.1)' }}>
                  <p className="text-sm" style={{ color: '#D4E268' }}>
                    ⚠ All critical checks must be completed before continuing
                  </p>
                </div>
              )}

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setView('accept-mission')}
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Mission
                </Button>
                <Button
                  onClick={() => setView('ai-model-selection')}
                  disabled={!allCurrentCriticalChecked}
                  className="bg-[#21A68D] hover:bg-[#1a8a72] text-white disabled:bg-gray-600 disabled:cursor-not-allowed"
                >
                  Continue to AI Selection
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          </Card>
        )
      }

      {/* AI Model Selection View */}
      {
        view === 'ai-model-selection' && selectedMission && (
          <Card className="p-6 bg-card border-border">
            <div className="space-y-6">
              {/* Header */}
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-full bg-[#21A68D]/20 flex items-center justify-center">
                  <Brain className="w-6 h-6 text-[#21A68D]" />
                </div>
                <div>
                  <h2 className="text-xl">AI Detection Model</h2>
                  <p className="text-sm text-muted-foreground">Select one AI model to use during this mission</p>
                </div>
              </div>

              {/* AI Models Selection */}
              <RadioGroup value={selectedAIModel} onValueChange={setSelectedAIModel} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Vessel Detection & Recognition */}
                <Label htmlFor="vessel-detection" className="cursor-pointer h-full">
                  <Card
                    className={`p-5 h-full cursor-pointer transition-all duration-300 hover:shadow-lg hover:shadow-[#21A68D]/10 hover:border-[#21A68D]/50 border-2 ${selectedAIModel === 'vessel-detection'
                      ? 'border-[#21A68D] bg-[#21A68D]/5 shadow-md shadow-[#21A68D]/20'
                      : 'border-border bg-card/40'
                      }`}
                  >
                    <div className="flex items-start gap-4">
                      <RadioGroupItem
                        value="vessel-detection"
                        id="vessel-detection"
                        className="mt-1 border-[#21A68D] text-[#21A68D]"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Ship className="w-5 h-5" style={{ color: '#21A68D' }} />
                          <h3 className="font-bold text-white">Vessel Detection & Recognition</h3>
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          Detect and identify vessels in the surveillance area with intelligent classification
                        </p>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <Badge variant="secondary" className="bg-[#21A68D]/10 text-[#21A68D] border-none text-[10px] font-bold">REAL-TIME</Badge>
                          <Badge variant="secondary" className="bg-[#21A68D]/10 text-[#21A68D] border-none text-[10px] font-bold">CLASSIFICATION</Badge>
                        </div>
                      </div>
                    </div>
                  </Card>
                </Label>

                {/* Vessel Hull Number Recognition */}
                <Label htmlFor="hull-recognition" className="cursor-pointer h-full">
                  <Card
                    className={`p-5 h-full cursor-pointer transition-all duration-300 hover:shadow-lg hover:shadow-[#3b82f6]/10 hover:border-[#3b82f6]/50 border-2 ${selectedAIModel === 'hull-recognition'
                      ? 'border-[#3b82f6] bg-[#3b82f6]/5 shadow-md shadow-[#3b82f6]/20'
                      : 'border-border bg-card/40'
                      }`}
                  >
                    <div className="flex items-start gap-4">
                      <RadioGroupItem
                        value="hull-recognition"
                        id="hull-recognition"
                        className="mt-1 border-[#3b82f6] text-[#3b82f6]"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Anchor className="w-5 h-5" style={{ color: '#3b82f6' }} />
                          <h3 className="font-bold text-white">Vessel Hull Number Recognition</h3>
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          Optical Character Recognition (OCR) for precise vessel hull identification numbers
                        </p>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <Badge variant="secondary" className="bg-[#3b82f6]/10 text-[#3b82f6] border-none text-[10px] font-bold">OCR ENGINE</Badge>
                          <Badge variant="secondary" className="bg-[#3b82f6]/10 text-[#3b82f6] border-none text-[10px] font-bold">IDENTIFICATION</Badge>
                        </div>
                      </div>
                    </div>
                  </Card>
                </Label>

                {/* Vessel Attribute Detection */}
                <Label htmlFor="vessel-attribute" className="cursor-pointer h-full">
                  <Card
                    className={`p-5 h-full cursor-pointer transition-all duration-300 hover:shadow-lg hover:shadow-[#0F4C75]/10 hover:border-[#0F4C75]/50 border-2 ${selectedAIModel === 'vessel-attribute'
                      ? 'border-[#0F4C75] bg-[#0F4C75]/5 shadow-md shadow-[#0F4C75]/20'
                      : 'border-border bg-card/40'
                      }`}
                  >
                    <div className="flex items-start gap-4">
                      <RadioGroupItem
                        value="vessel-attribute"
                        id="vessel-attribute"
                        className="mt-1 border-[#0F4C75] text-[#0F4C75]"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <ListChecks className="w-5 h-5" style={{ color: '#0F4C75' }} />
                          <h3 className="font-bold text-white">Vessel Attribute Detection</h3>
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          Analyze vessel attributes including size, type, and detailed operational status
                        </p>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <Badge variant="secondary" className="bg-[#0F4C75]/10 text-[#0F4C75] border-none text-[10px] font-bold">ANALYSIS</Badge>
                          <Badge variant="secondary" className="bg-[#0F4C75]/10 text-[#0F4C75] border-none text-[10px] font-bold">METADATA</Badge>
                        </div>
                      </div>
                    </div>
                  </Card>
                </Label>

                {/* Marine Debris Detection */}
                <Label htmlFor="debris-detection" className="cursor-pointer h-full">
                  <Card
                    className={`p-5 h-full cursor-pointer transition-all duration-300 hover:shadow-lg hover:shadow-[#D4E268]/10 hover:border-[#D4E268]/50 border-2 ${selectedAIModel === 'debris-detection'
                      ? 'border-[#D4E268] bg-[#D4E268]/5 shadow-md shadow-[#D4E268]/20'
                      : 'border-border bg-card/40'
                      }`}
                  >
                    <div className="flex items-start gap-4">
                      <RadioGroupItem
                        value="debris-detection"
                        id="debris-detection"
                        className="mt-1 border-[#D4E268] text-[#D4E268]"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <AlertCircle className="w-5 h-5" style={{ color: '#D4E268' }} />
                          <h3 className="font-bold text-white">Marine Debris Detection</h3>
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          Identify and track marine debris, waste, and pollution in monitored coastal areas
                        </p>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <Badge variant="secondary" className="bg-[#D4E268]/10 text-[#D4E268] border-none text-[10px] font-bold">ECO-GUARD</Badge>
                          <Badge variant="secondary" className="bg-[#D4E268]/10 text-[#D4E268] border-none text-[10px] font-bold">DETECTION</Badge>
                        </div>
                      </div>
                    </div>
                  </Card>
                </Label>

                {/* Event Detection & Behavior Analysis */}
                <Label htmlFor="event-detection" className="cursor-pointer h-full md:col-span-2">
                  <Card
                    className={`p-5 h-full cursor-pointer transition-all duration-300 hover:shadow-lg hover:shadow-[#3b82f6]/10 hover:border-[#3b82f6]/50 border-2 ${selectedAIModel === 'event-detection'
                      ? 'border-[#3b82f6] bg-[#3b82f6]/5 shadow-md shadow-[#3b82f6]/20'
                      : 'border-border bg-card/40'
                      }`}
                  >
                    <div className="flex items-start gap-4">
                      <RadioGroupItem
                        value="event-detection"
                        id="event-detection"
                        className="mt-1 border-[#3b82f6] text-[#3b82f6]"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Activity className="w-5 h-5" style={{ color: '#3b82f6' }} />
                          <h3 className="font-bold text-white">Event Detection & Behavioral Analysis</h3>
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          Detect specific security events like illegal fishing, unauthorized docking, or suspicious behavior
                        </p>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <Badge variant="secondary" className="bg-[#3b82f6]/10 text-[#3b82f6] border-none text-[10px] font-bold">BEHAVIORAL</Badge>
                          <Badge variant="secondary" className="bg-[#3b82f6]/10 text-[#3b82f6] border-none text-[10px] font-bold">SECURITY</Badge>
                        </div>
                      </div>
                    </div>
                  </Card>
                </Label>
              </RadioGroup>

              {/* Info Banner */}
              {selectedAIModel && (
                <div className="p-4 rounded-lg bg-[#21A68D]/10 border border-[#21A68D]/30">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-[#21A68D] mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-[#21A68D]">
                        AI Model Selected
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        The selected model will run continuously during the mission and provide real-time detection results
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-between pt-4">
                <Button
                  variant="outline"
                  onClick={() => setView('pre-check')}
                  className="border-border hover:bg-accent"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Pre-Check
                </Button>
                <Button
                  onClick={() => setView('pre-check-summary')}
                  disabled={!selectedAIModel}
                  className="bg-[#21A68D] hover:bg-[#1a8a72] text-white disabled:bg-gray-600 disabled:cursor-not-allowed"
                >
                  Continue to Summary
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          </Card>
        )
      }

      {/* Pre-Check Summary View */}
      {
        view === 'pre-check-summary' && selectedMission && (
          <div className="space-y-6">
            {/* Summary Header */}
            <Card className="p-6 bg-card border-border">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-[#21A68D]/20 flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-[#21A68D]" />
                </div>
                <div>
                  <h2 className="text-xl">Pre-Flight Check Completed</h2>
                  <p className="text-sm text-muted-foreground">All critical systems verified and ready for launch</p>
                </div>
              </div>

              <div className="p-4 rounded-lg bg-[#21A68D]/10 border border-[#21A68D]">
                <h3 className="font-medium mb-2">{selectedMission.name}</h3>
                <p className="text-sm text-muted-foreground">{selectedMission.description}</p>
              </div>
            </Card>

            {/* Check Results Summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Completed Checks */}
              <Card className="p-6 bg-card border-border">
                <h3 className="flex items-center gap-2 mb-4" style={{ color: '#21A68D' }}>
                  <CheckCircle className="w-5 h-5" />
                  Completed Checks
                </h3>
                <div className="space-y-2">
                  {currentCheckList.filter(check => checks[check.id]).map(check => (
                    <div key={check.id} className="flex items-center gap-2 p-2 rounded bg-muted/30">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span className="text-sm flex-1">{check.label}</span>
                      {check.critical && (
                        <Badge variant="outline" className="text-xs border-[#21A68D] text-[#21A68D]">
                          Critical
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </Card>

              {/* Mission & Drone Info */}
              <Card className="p-6 bg-card border-border">
                <h3 className="flex items-center gap-2 mb-4" style={{ color: '#0F4C75' }}>
                  <Plane className="w-5 h-5" />
                  Mission Configuration
                </h3>
                <div className="space-y-3">
                  <div className="p-3 rounded-lg bg-muted/30">
                    <p className="text-xs text-muted-foreground mb-1">Drone</p>
                    <p className="font-medium">
                      {finalDevices.find((d: any) => d.id === selectedMission.assignedDevice)?.name || selectedMission.assignedDevice || 'Unknown Asset'}
                    </p>
                    <Badge variant="outline" className="mt-1" style={{ borderColor: '#21A68D', color: '#21A68D' }}>
                      {finalDevices.find((d: any) => d.id === selectedMission.assignedDevice)?.type || 'UAV'}
                    </Badge>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/30">
                    <p className="text-xs text-muted-foreground mb-1">Team Members</p>
                    <p className="font-medium">{assignedTeam.length} members assigned</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/30">
                    <p className="text-xs text-muted-foreground mb-1">Mission Area</p>
                    <p className="font-medium">{selectedMission.area}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/30">
                    <p className="text-xs text-muted-foreground mb-1">Duration</p>
                    <p className="font-medium">{selectedMission.duration} days</p>
                  </div>
                </div>
              </Card>
            </div>

            {/* AI Model Section */}
            {selectedAIModel && (
              <Card className="p-6 bg-card border-border">
                <h3 className="flex items-center gap-2 mb-4" style={{ color: '#21A68D' }}>
                  <Brain className="w-5 h-5" />
                  AI Detection Model
                </h3>
                <div className="space-y-3">
                  {selectedAIModel === 'vessel-detection' && (
                    <div className="flex items-center gap-3 p-4 rounded-lg bg-[#21A68D]/10 border border-[#21A68D]/30">
                      <Ship className="w-6 h-6 text-[#21A68D] flex-shrink-0" />
                      <div>
                        <p className="font-medium">Vessel Detection & Recognition</p>
                        <p className="text-sm text-muted-foreground">Real-time vessel detection and classification</p>
                      </div>
                    </div>
                  )}
                  {selectedAIModel === 'hull-recognition' && (
                    <div className="flex items-center gap-3 p-4 rounded-lg bg-[#3b82f6]/10 border border-[#3b82f6]/30">
                      <Anchor className="w-6 h-6 text-[#3b82f6] flex-shrink-0" />
                      <div>
                        <p className="font-medium">Vessel Hull Number Recognition</p>
                        <p className="text-sm text-muted-foreground">OCR for hull identification numbers</p>
                      </div>
                    </div>
                  )}
                  {selectedAIModel === 'vessel-attribute' && (
                    <div className="flex items-center gap-3 p-4 rounded-lg bg-[#0F4C75]/10 border border-[#0F4C75]/30">
                      <ListChecks className="w-6 h-6 text-[#0F4C75] flex-shrink-0" />
                      <div>
                        <p className="font-medium">Vessel Attribute Detection</p>
                        <p className="text-sm text-muted-foreground">Analyze vessel attributes and status</p>
                      </div>
                    </div>
                  )}
                  {selectedAIModel === 'debris-detection' && (
                    <div className="flex items-center gap-3 p-4 rounded-lg bg-[#D4E268]/10 border border-[#D4E268]/30">
                      <AlertCircle className="w-6 h-6 text-[#D4E268] flex-shrink-0" />
                      <div>
                        <p className="font-medium">Marine Debris Detection</p>
                        <p className="text-sm text-muted-foreground">Environmental monitoring and pollution detection</p>
                      </div>
                    </div>
                  )}
                  {selectedAIModel === 'event-detection' && (
                    <div className="flex items-center gap-3 p-4 rounded-lg bg-[#3b82f6]/10 border border-[#3b82f6]/30">
                      <Activity className="w-6 h-6 text-[#3b82f6] flex-shrink-0" />
                      <div>
                        <p className="font-medium">Event Detection & Behavior Analysis</p>
                        <p className="text-sm text-muted-foreground">Autonomous security event identification and alerting</p>
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            )}

            {/* ═══════════════════════════════════════════════════════════════
                 PRE-FLIGHT SYSTEM CHECK — 3-step readiness gate
                 1. AI Engine ready (WebSocket /ws/ai-status → IDLE)
                 2. RTSP Stream reachable (getLiveDrones detects active drone)
                 3. Telemetry alive (lat/lon non-zero from NATS bridge)
            ═══════════════════════════════════════════════════════════════ */}
            {(() => {
              // Derive check states directly from live data
              const aiOk    = aiStatus === 'IDLE';
              const rtspOk  = pfRTSP === 'ok';
              const telemOk = pfTelem === 'ok';
              const passCount  = [aiOk, rtspOk, telemOk].filter(Boolean).length;
              const totalReady = passCount === 3;
              const pct        = Math.round((passCount / 3) * 100);

              const checks = [
                {
                  key: 'ai',
                  label: 'AI Engine',
                  desc: aiOk
                    ? 'YOLOv8 + CLIP loaded — ready'
                    : aiStatus === 'BOOTING'
                      ? `Loading models… ${aiProgress}%`
                      : aiStatus === 'ACTIVE'
                        ? 'Mission already active'
                        : 'AI system offline — start docker service',
                  ok: aiOk,
                  warn: aiStatus === 'BOOTING' || aiStatus === 'ACTIVE',
                  icon: <Brain className="w-4 h-4" />,
                },
                {
                  key: 'rtsp',
                  label: 'Video Stream (RTSP)',
                  desc: pfMessage.rtsp,
                  ok: rtspOk,
                  warn: pfRTSP === 'checking',
                  icon: <Radio className="w-4 h-4" />,
                },
                {
                  key: 'telem',
                  label: 'Telemetry (MAVLink → NATS)',
                  desc: pfMessage.telem,
                  ok: telemOk,
                  warn: pfTelem === 'checking',
                  icon: <Activity className="w-4 h-4" />,
                },
              ];

              return (
                <Card className={`p-5 border transition-all duration-500 ${
                  totalReady
                    ? 'bg-emerald-500/5 border-emerald-500/40'
                    : passCount > 0
                      ? 'bg-amber-500/5 border-amber-500/30'
                      : 'bg-slate-800/60 border-slate-600/40'
                }`}>
                  {/* Header */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className={`w-2.5 h-2.5 rounded-full ${
                        totalReady ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400 animate-pulse'
                      }`} />
                      <span className={`font-semibold text-sm ${
                        totalReady ? 'text-emerald-400' : 'text-amber-400'
                      }`}>
                        {totalReady ? '🟢 All Systems Ready — CLEARED FOR LAUNCH' : `System Check — ${pct}% Ready`}
                      </span>
                    </div>
                    <span className={`text-xs font-mono px-2 py-0.5 rounded border ${
                      totalReady
                        ? 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10'
                        : 'text-amber-400 border-amber-500/40 bg-amber-500/10'
                    }`}>{passCount}/3 OK</span>
                  </div>

                  {/* Overall progress bar */}
                  <div className="mb-4">
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>System Readiness</span>
                      <span className={totalReady ? 'text-emerald-400' : 'text-amber-400'}>{pct}%</span>
                    </div>
                    <div className="h-2 bg-slate-700/80 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ease-out ${
                          totalReady
                            ? 'bg-gradient-to-r from-emerald-600 to-emerald-400'
                            : 'bg-gradient-to-r from-amber-600 to-amber-400'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  {/* Individual checks */}
                  <div className="space-y-2">
                    {checks.map(c => (
                      <div key={c.key} className={`flex items-center gap-3 px-3 py-2 rounded-lg border transition-all duration-300 ${
                        c.ok
                          ? 'bg-emerald-500/10 border-emerald-500/30'
                          : c.warn
                            ? 'bg-amber-500/10 border-amber-500/30'
                            : 'bg-slate-700/30 border-slate-600/40'
                      }`}>
                        {/* Icon */}
                        <div className={`flex-shrink-0 ${
                          c.ok ? 'text-emerald-400' : c.warn ? 'text-amber-400' : 'text-slate-500'
                        }`}>{c.icon}</div>

                        {/* Label + desc */}
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs font-semibold ${
                            c.ok ? 'text-emerald-300' : c.warn ? 'text-amber-300' : 'text-slate-400'
                          }`}>{c.label}</p>
                          <p className="text-xs text-muted-foreground truncate">{c.desc}</p>
                        </div>

                        {/* Status badge */}
                        {c.ok ? (
                          <div className="flex items-center gap-1 text-emerald-400 flex-shrink-0">
                            <CheckCircle className="w-4 h-4" />
                            <span className="text-xs font-bold">PASS</span>
                          </div>
                        ) : c.warn ? (
                          <div className="flex items-center gap-1 text-amber-400 flex-shrink-0">
                            <div className="w-3.5 h-3.5 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
                            <span className="text-xs font-bold">WAIT</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-slate-500 flex-shrink-0">
                            <AlertCircle className="w-3.5 h-3.5" />
                            <span className="text-xs font-bold">FAIL</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Footer tip */}
                  {!totalReady && (
                    <p className="text-xs text-muted-foreground mt-3 text-center">
                      ⏳ Waiting for all 3 systems to clear before launch is enabled...
                    </p>
                  )}
                </Card>
              );
            })()}

            {/* Action Buttons */}
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setView('ai-model-selection')}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to AI Selection
              </Button>
              <Button
                onClick={handleLaunchMission}
                disabled={isLaunching || !(aiStatus === 'IDLE' && pfRTSP === 'ok' && pfTelem === 'ok')}
                className="bg-[#22c55e] hover:bg-[#22c55e]/90 text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLaunching ? (
                  <>
                    <div className="w-4 h-4 mr-2 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Launching...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Launch Mission
                  </>
                )}
              </Button>
            </div>
          </div>
        )
      }

      {/* Live Mission Summary View */}
      {
        view === 'live-mission-summary' && selectedMission && (
          <div className="space-y-6">
            {/* Mission Header with LIVE badge */}
            <Card className="p-6 bg-card border-border">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h2 className="text-2xl">{selectedMission.name}</h2>
                    <div className="flex items-center gap-1 bg-[#22c55e]/20 border border-[#22c55e] px-3 py-1 rounded">
                      <div className="w-2.5 h-2.5 bg-[#22c55e] rounded-full animate-pulse" />
                      <span className="text-sm font-bold text-[#22c55e]">LIVE</span>
                    </div>
                  </div>
                  <p className="text-muted-foreground">{selectedMission.description}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                <Card className="p-4 bg-muted/30 border-border">
                  <p className="text-xs text-muted-foreground mb-1">Mission Time</p>
                  <p className="text-xl font-semibold" style={{ color: '#21A68D' }}>
                    {Math.floor((new Date().getTime() - new Date(selectedMission.createdAt).getTime()) / 1000 / 60)} min
                  </p>
                </Card>
                <Card className="p-4 bg-muted/30 border-border">
                  <p className="text-xs text-muted-foreground mb-1">Category</p>
                  <p className="text-sm font-semibold">{selectedMission.category}</p>
                </Card>
                <Card className="p-4 bg-muted/30 border-border">
                  <p className="text-xs text-muted-foreground mb-1">Area</p>
                  <p className="text-sm font-semibold">{selectedMission.area}</p>
                </Card>
                <Card className="p-4 bg-muted/30 border-border">
                  <p className="text-xs text-muted-foreground mb-1">Status</p>
                  <p className="text-sm font-semibold text-[#22c55e]">Active</p>
                </Card>
              </div>
            </Card>

            {/* Team & Drone Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Team Members */}
              <Card className="p-6 bg-card border-border">
                <h3 className="flex items-center gap-2 mb-4" style={{ color: '#21A68D' }}>
                  <Users className="w-5 h-5" />
                  Team Members
                </h3>
                <div className="space-y-3">
                  {(() => {
                    // Look up the raw GraphQL mission to get real pilot data
                    const rawMission = missionsData?.getMissions?.find((m: any) => m.id === selectedMission.id);
                    const pilot = rawMission?.pilot;

                    // If we have a real pilot from DB, show them
                    if (pilot?.name) {
                      return (
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                          <div className="w-10 h-10 rounded-full bg-[#21A68D] flex items-center justify-center text-white font-bold">
                            {pilot.name.split(' ').map((n: string) => n[0]).join('')}
                          </div>
                          <div className="flex-1">
                            <p className="font-medium">{pilot.name}</p>
                            <p className="text-sm text-muted-foreground">{pilot.role || 'Pilot'}</p>
                          </div>
                          <Badge variant="outline" className="border-green-500 text-green-500">
                            Active
                          </Badge>
                        </div>
                      );
                    }

                    // Fallback: use assignedTeam + mockTeamMembers for local missions
                    return assignedTeam.map(teamId => {
                      const member = mockTeamMembers.find(m => m.id === teamId);
                      return member ? (
                        <div key={teamId} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                          <div className="w-10 h-10 rounded-full bg-[#21A68D] flex items-center justify-center text-white font-bold">
                            {member.name.split(' ').map(n => n[0]).join('')}
                          </div>
                          <div className="flex-1">
                            <p className="font-medium">{member.name}</p>
                            <p className="text-sm text-muted-foreground">{member.role}</p>
                          </div>
                          <Badge variant="outline" className="border-green-500 text-green-500">
                            Active
                          </Badge>
                        </div>
                      ) : null;
                    });
                  })()}
                </div>
              </Card>

              {/* Drone Info */}
              <Card className="p-6 bg-card border-border">
                <h3 className="flex items-center gap-2 mb-4" style={{ color: '#0F4C75' }}>
                  <Radio className="w-5 h-5" />
                  Drone Information
                </h3>
                {(() => {
                  // Look up the raw GraphQL mission to get real asset data
                  const rawMission = missionsData?.getMissions?.find((m: any) => m.id === selectedMission.id);
                  const asset = rawMission?.asset;
                  // Fallback to mock device for local missions
                  const device = asset || mockDevices.find(d => d.id === selectedMission.assignedDevice);

                  return device ? (
                    <div className="space-y-4">
                      <div className="p-4 rounded-lg bg-muted/30">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <h4 className="font-medium text-lg">{device.name || 'Unknown Drone'}</h4>
                            <Badge variant="outline" className="mt-1">
                              {device.type || device.category || 'UAV'}
                            </Badge>
                          </div>
                          <Badge variant="outline" className="border-green-500 text-green-500">
                            {asset?.status || 'Operating'}
                          </Badge>
                        </div>
                        <div className="space-y-3 mt-4">
                          <div>
                            <div className="flex justify-between text-sm mb-2">
                              <span className="text-muted-foreground">Battery Level:</span>
                              <span className="text-green-500 font-medium">{device.battery ?? '--'}%</span>
                            </div>
                            <div className="w-full bg-muted rounded-full h-2">
                              <div className="h-2 rounded-full bg-green-500" style={{ width: `${device.battery ?? 0}%` }} />
                            </div>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Signal Strength:</span>
                            <span className="text-green-500 font-medium">95%</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Altitude:</span>
                            <span className="font-medium">127m</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Speed:</span>
                            <span className="font-medium">12.3 km/h</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">No drone assigned</p>
                  );
                })()}
              </Card>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setView('mission-list')}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to List
              </Button>
              <Button
                onClick={() => {
                  if (onMissionLaunch && selectedMission) {
                    onMissionLaunch(selectedMission.id);
                  }
                }}
                className="bg-[#22c55e] hover:bg-[#22c55e]/90 text-white"
              >
                <Radio className="w-4 h-4 mr-2" />
                View Live Operations
              </Button>
            </div>
          </div>
        )
      }

      {/* Live Mission Detail View - Embedded Live Operations */}
      {
        view === 'live-mission-detail' && selectedMission && (
          <div className="h-full flex flex-col">
            {/* Header with mission info */}
            <div className="px-4 md:px-6 pt-4 pb-3 border-b border-border bg-card">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setView('live-mission-summary')}
                    className="gap-2 shrink-0"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Back
                  </Button>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-lg font-medium">{selectedMission.name}</h2>
                    <div className="flex items-center gap-1 bg-[#22c55e]/20 border border-[#22c55e] px-2 py-0.5 rounded">
                      <div className="w-2 h-2 bg-[#22c55e] rounded-full animate-pulse" />
                      <span className="text-xs font-bold text-[#22c55e]">LIVE</span>
                    </div>
                  </div>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mt-2">{selectedMission.description}</p>
            </div>

            {/* Live Operations Content - Embedded */}
            <div className="flex-1 overflow-hidden">
              <LiveOperations />
            </div>
          </div>
        )
      }
      {
        view === 'post-analysis' && (
          <div className="space-y-6 pb-20">
            {/* Post Analysis Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                  <BarChart3 className="w-6 h-6 text-[#21A68D]" />
                  Mission Post-Analysis
                </h2>
                <p className="text-sm text-muted-foreground">Upload flight media and telemetry for AI processing and reporting</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column: Mission Selection & Controls */}
              <div className="lg:col-span-1 space-y-6">
                <Card className="p-6 bg-[#0f172a]/60 backdrop-blur-xl border-white/10 shadow-2xl">
                  <h3 className="text-sm font-bold text-[#21A68D] uppercase tracking-widest mb-4">1. Mission Context</h3>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground uppercase font-bold">Select Completed Mission</Label>
                      <Select
                        value={selectedMission?.id || ''}
                        onValueChange={(id: string) => setSelectedMission(missions.find((m: Mission) => m.id === id) || null)}
                      >
                        <SelectTrigger className="bg-white/5 border-white/10 text-white h-12">
                          <SelectValue placeholder="Choose a mission..." />
                        </SelectTrigger>
                        <SelectContent className="bg-[#0f172a] border-white/10">
                          {missions.filter((m: Mission) => m.status === 'completed' || m.status === 'pending').map((m: Mission) => (
                            <SelectItem key={m.id} value={m.id} className="text-white hover:bg-[#21A68D]/10">
                              {m.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-[10px] text-muted-foreground italic">Target mission for analysis synchronization</p>
                    </div>

                    {selectedMission && (
                      <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-2">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Category:</span>
                          <span className="text-white font-medium">{selectedMission.category}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Created:</span>
                          <span className="text-white font-medium">{new Date(selectedMission.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </Card>

                <Card className="p-6 bg-[#0f172a]/60 backdrop-blur-xl border-white/10 shadow-2xl">
                  <h3 className="text-sm font-bold text-[#21A68D] uppercase tracking-widest mb-4">3. Analysis Configuration</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
                      <div className="flex items-center gap-3">
                        <Cpu className="w-5 h-5 text-blue-400" />
                        <div>
                          <p className="text-xs font-bold text-white">AI Engine v2.4</p>
                          <p className="text-[10px] text-muted-foreground">Optimal Processing</p>
                        </div>
                      </div>
                      <Badge className="bg-blue-500/20 text-blue-400 border-none">Active</Badge>
                    </div>

                    <div className="space-y-3 pt-2">
                      <div className="flex items-center gap-2">
                        <Checkbox id="opt-detection" checked />
                        <label htmlFor="opt-detection" className="text-xs text-white">Object Detection (Vessels/Vehicles)</label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox id="opt-ocr" />
                        <label htmlFor="opt-ocr" className="text-xs text-white">Hull/Number Recognition</label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox id="opt-telemetry" checked />
                        <label htmlFor="opt-telemetry" className="text-xs text-white">Telemetry Interpolation</label>
                      </div>
                    </div>

                    <Button
                      className="w-full h-12 mt-4 bg-[#21A68D] hover:bg-[#1a8a72] text-white font-bold"
                      disabled={!selectedMission || isAnalyzing}
                      onClick={handleStartAnalysis}
                    >
                      <Activity className="w-4 h-4 mr-2" />
                      Run Mission Analysis
                    </Button>
                  </div>
                </Card>
              </div>

              {/* Right Column: Upload Zones */}
              <div className="lg:col-span-2 space-y-6">
                <Card className="p-8 bg-[#0f172a]/60 backdrop-blur-xl border-white/10 shadow-2xl">
                  <h3 className="text-sm font-bold text-[#21A68D] uppercase tracking-widest mb-6">2. Data Ingestion</h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Video Upload Zone */}
                    <div className="space-y-4">
                      <Label className="text-xs text-muted-foreground uppercase font-bold flex items-center gap-2">
                        <FileVideo className="w-4 h-4 text-[#D4E268]" />
                        Flight Recording (MP4/MOV)
                      </Label>
                      <div
                        className="group relative h-48 rounded-2xl border-2 border-dashed border-white/10 hover:border-[#21A68D]/50 hover:bg-[#21A68D]/5 transition-all flex flex-col items-center justify-center p-6 text-center cursor-pointer"
                        onClick={() => document.getElementById('video-upload')?.click()}
                      >
                        <input id="video-upload" type="file" accept="video/*" className="hidden" />
                        <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                          <Upload className="w-6 h-6 text-muted-foreground" />
                        </div>
                        <p className="text-sm font-medium text-white">Drop video file here</p>
                        <p className="text-[10px] text-muted-foreground mt-1">Maximum file size: 2GB</p>
                      </div>
                    </div>

                    {/* Telemetry Upload Zone */}
                    <div className="space-y-4">
                      <Label className="text-xs text-muted-foreground uppercase font-bold flex items-center gap-2">
                        <FileJson className="w-4 h-4 text-blue-400" />
                        Telemetry Log (CSV/JSON/LOG)
                      </Label>
                      <div
                        className="group relative h-48 rounded-2xl border-2 border-dashed border-white/10 hover:border-[#21A68D]/50 hover:bg-[#21A68D]/5 transition-all flex flex-col items-center justify-center p-6 text-center cursor-pointer"
                        onClick={() => document.getElementById('log-upload')?.click()}
                      >
                        <input id="log-upload" type="file" accept=".csv,.json,.log" className="hidden" />
                        <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                          <Upload className="w-6 h-6 text-muted-foreground" />
                        </div>
                        <p className="text-sm font-medium text-white">Drop telemetry file here</p>
                        <p className="text-[10px] text-muted-foreground mt-1">Exported from GCS or Drone Local Storage</p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-8 p-4 rounded-xl bg-muted/20 border border-white/5 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-[#D4E268] mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-white mb-1">Processing Note</p>
                      <p className="text-[10px] text-muted-foreground leading-relaxed">
                        For accurate AI analysis, please ensure the mission timestamps in the video match the telemetry logs.
                        The system will attempt to auto-sync using the mission takeoff event metadata.
                      </p>
                    </div>
                  </div>
                </Card>

                {/* Analysis Status / Results Simulation (Hidden until run) */}
                <Card className={`p-6 bg-[#0f172a]/60 backdrop-blur-xl border-white/10 shadow-2xl border-t-2 transition-all duration-500 ${isAnalyzing ? 'border-t-blue-500' : 'border-t-[#21A68D]'}`}>
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-sm font-bold text-white uppercase tracking-widest">Processing Queue</h3>
                    <Badge className={isAnalyzing ? "bg-blue-500/20 text-blue-400 animate-pulse" : "bg-[#21A68D]/10 text-[#21A68D]"}>
                      {isAnalyzing ? 'Analyzing...' : analysisProgress === 100 ? 'Analysis Complete' : 'Ready to start'}
                    </Badge>
                  </div>

                  <div className="space-y-6">
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-muted-foreground">AI Inference Pipeline</span>
                        <span className="text-white font-bold">{analysisProgress}%</span>
                      </div>
                      <Progress value={analysisProgress} className="h-2 bg-white/5" />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
                      {analysisTasks.map((task: any) => (
                        <div key={task.id} className={`p-3 rounded-lg border flex flex-col gap-2 transition-all duration-300 ${task.status === 'completed' ? 'bg-[#21A68D]/10 border-[#21A68D]/30' : task.status === 'processing' ? 'bg-blue-500/10 border-blue-500/30' : 'bg-white/5 border-white/5 opacity-50'}`}>
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] font-bold text-white uppercase truncate pr-1">{task.name}</span>
                            {task.status === 'completed' ? (
                              <Check className="w-3 h-3 text-[#21A68D]" />
                            ) : task.status === 'processing' ? (
                              <div className="w-2 h-2 rounded-full bg-blue-500 animate-ping"></div>
                            ) : (
                              <div className="w-2 h-2 rounded-full bg-muted"></div>
                            )}
                          </div>
                          <div className="text-[8px] text-muted-foreground uppercase font-bold">
                            {task.status}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          </div>
        )
      }
      {
        view === 'event-detection' && (
          <div className="space-y-6">

            <Card className="p-6 bg-card border-border">
              <div className="flex items-center gap-3 mb-6">
                <Activity className="w-6 h-6 text-[#3b82f6]" />
                <div>
                  <h2 className="text-xl font-semibold">Event Detection Log</h2>
                  <p className="text-sm text-muted-foreground">Behavioral anomalies and security event history</p>
                </div>
              </div>

              <div className="space-y-4">
                {[
                  { id: 1, type: 'Illegal Fishing', location: 'Zone A-12', time: '10:24 AM', confidence: '94%' },
                  { id: 2, type: 'Unauthorized Docking', location: 'East Pier', time: '09:15 AM', confidence: '88%' },
                  { id: 3, type: 'Border Intrusion', location: 'Northern Edge', time: 'Yesterday', confidence: '91%' },
                ].map((event) => (
                  <div key={event.id} className="p-4 rounded-lg bg-muted/30 border border-border flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-2 rounded bg-[#3b82f6]/10 text-[#3b82f6]">
                        <AlertCircle className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{event.type}</p>
                        <p className="text-xs text-muted-foreground">{event.location} • {event.time}</p>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[#3b82f6] border-[#3b82f6]">
                      {event.confidence} Match
                    </Badge>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )
      }
    </div >
  );
}
