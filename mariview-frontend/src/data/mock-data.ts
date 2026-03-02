/**
 * Central Mock Data Source
 * Sinkronisasi data untuk seluruh aplikasi Mariview
 */

// =====================================================
// TYPE DEFINITIONS
// =====================================================

export interface Drone {
  id: string;
  name: string;
  model: string;
  serial: string;
  type: 'UAV' | 'AUV';
  status: 'available' | 'in-flight' | 'maintenance' | 'charging';
  battery: number;
  flightHours?: number;
  diveHours?: number;
  lastMaintenance: string;
  nextMaintenance: string;
  location: string;
  totalFlights?: number;
  totalDives?: number;
  maxDepth?: number;
  color: string;
}

export interface Flight {
  id: string;
  missionId: string;
  flightNumber: number;
  name: string;
  date: string;
  time: string;
  duration: number; // minutes
  status: 'pending' | 'live' | 'completed' | 'failed';
  drone: string;
  droneId: string;
  droneType: 'UAV' | 'AUV';
  pilot: string;
  aiModel: string;
  avgSpeed: number;
  maxAltitude?: number;
  maxDepth?: number;
  distance: number;
  detections: number;
  area: number;
  anomalies: number;
  videoId?: string;
  hasVideo: boolean;
  hasTelemetry: boolean;
}

export interface Mission {
  id: string;
  name: string;
  description: string;
  objective: string;
  droneType: 'UAV' | 'AUV';
  location: string;
  area: string;
  startDate: string;
  endDate: string;
  status: 'planning' | 'active' | 'completed' | 'cancelled';
  totalFlights: number;
  completedFlights: number;
  totalDuration: number; // minutes
  totalDetections: number;
  totalAnomalies: number;
  coverageArea: number; // km²
  flights: Flight[];
}

// =====================================================
// 1. DRONE FLEET DATA (UAV & AUV)
// =====================================================

export const drones: Drone[] = [
  // UAV Fleet
  {
    id: 'UAV-001',
    name: 'Pyrhos X V1',
    model: 'Aerial Quadcopter',
    serial: 'PXV1-2024-001',
    type: 'UAV',
    status: 'available',
    battery: 100,
    flightHours: 245,
    lastMaintenance: '2025-01-15',
    nextMaintenance: '2025-02-15',
    location: 'Hangar A',
    totalFlights: 89,
    color: '#21A68D',
  },
  {
    id: 'UAV-002',
    name: 'AR-2 Aerial',
    model: 'Tactical Drone',
    serial: 'AR2-2024-003',
    type: 'UAV',
    status: 'in-flight',
    battery: 85,
    flightHours: 156,
    lastMaintenance: '2025-01-10',
    nextMaintenance: '2025-02-10',
    location: 'Active Mission',
    totalFlights: 54,
    color: '#21A68D',
  },

  // AUV Fleet
  {
    id: 'AUV-001',
    name: 'AquaScan Alpha',
    model: 'Survey AUV',
    serial: 'ASA-2024-001',
    type: 'AUV',
    status: 'available',
    battery: 92,
    diveHours: 123,
    lastMaintenance: '2025-01-12',
    nextMaintenance: '2025-02-12',
    location: 'Dock A',
    totalDives: 34,
    maxDepth: 500,
    color: '#0F4C75',
  },
  {
    id: 'AUV-002',
    name: 'DeepSeeker Pro',
    model: 'Deep Sea AUV',
    serial: 'DSP-2024-002',
    type: 'AUV',
    status: 'maintenance',
    battery: 78,
    diveHours: 289,
    lastMaintenance: '2025-01-18',
    nextMaintenance: '2025-02-18',
    location: 'Maintenance Bay',
    totalDives: 56,
    maxDepth: 1000,
    color: '#0F4C75',
  },
];

// =====================================================
// 2. MISSION HISTORY DATA
// =====================================================

export const missions: Mission[] = [
  // Mission dengan Multiple Flights - PSDKP Kupang Campaign
  {
    id: 'MSN-2025-001',
    name: 'PSDKP Kupang Campaign - Week 3',
    description: 'Weekly surveillance campaign to monitor Kupang waters and ensure maritime security compliance.',
    objective: 'Comprehensive maritime security monitoring, vessel tracking, and illegal fishing detection in Kupang area.',
    droneType: 'UAV',
    location: 'Kupang Waters',
    area: 'Kupang Zone A-D',
    startDate: '2025-01-20',
    endDate: '2025-01-22',
    status: 'active',
    totalFlights: 4,
    completedFlights: 2,
    totalDuration: 185, // minutes (combined)
    totalDetections: 87,
    totalAnomalies: 14,
    coverageArea: 8.5, // km²
    flights: [
      {
        id: 'F-2025-01-20-001-001',
        missionId: 'MSN-2025-001',
        flightNumber: 1,
        name: 'Morning Patrol - Zone A',
        date: '2025-01-20',
        time: '08:00',
        duration: 47,
        status: 'completed',
        drone: 'Pyrhos X V1',
        droneId: 'UAV-001',
        droneType: 'UAV',
        pilot: 'Sarah Chen',
        aiModel: 'Vessel Detection & Recognition',
        avgSpeed: 12.4,
        maxAltitude: 128,
        distance: 8.7,
        detections: 23,
        area: 2.3,
        anomalies: 5,
        videoId: 'JxrGGacMlys',
        hasVideo: true,
        hasTelemetry: true,
      },
      {
        id: 'F-2025-01-20-001-002',
        missionId: 'MSN-2025-001',
        flightNumber: 2,
        name: 'Afternoon Patrol - Zone B',
        date: '2025-01-20',
        time: '14:30',
        duration: 52,
        status: 'completed',
        drone: 'AR-2 Aerial',
        droneId: 'UAV-002',
        droneType: 'UAV',
        pilot: 'Mike Johnson',
        aiModel: 'Vessel Attribute Detection',
        avgSpeed: 11.8,
        maxAltitude: 115,
        distance: 9.2,
        detections: 31,
        area: 2.8,
        anomalies: 6,
        videoId: '2TmJKrhBzs4',
        hasVideo: true,
        hasTelemetry: true,
      },
      {
        id: 'F-2025-01-21-001-003',
        missionId: 'MSN-2025-001',
        flightNumber: 3,
        name: 'Morning Patrol - Zone C',
        date: '2025-01-21',
        time: '08:15',
        duration: 45,
        status: 'pending',
        drone: 'Pyrhos X V1',
        droneId: 'UAV-001',
        droneType: 'UAV',
        pilot: 'Sarah Chen',
        aiModel: 'Vessel Detection & Recognition',
        avgSpeed: 0,
        maxAltitude: 0,
        distance: 0,
        detections: 0,
        area: 0,
        anomalies: 0,
        hasVideo: false,
        hasTelemetry: false,
      },
      {
        id: 'F-2025-01-22-001-004',
        missionId: 'MSN-2025-001',
        flightNumber: 4,
        name: 'Final Sweep - Zone D',
        date: '2025-01-22',
        time: '09:00',
        duration: 41,
        status: 'pending',
        drone: 'AR-2 Aerial',
        droneId: 'UAV-002',
        droneType: 'UAV',
        pilot: 'Mike Johnson',
        aiModel: 'Vessel Hull Number Recognition',
        avgSpeed: 0,
        maxAltitude: 0,
        distance: 0,
        detections: 0,
        area: 0,
        anomalies: 0,
        hasVideo: false,
        hasTelemetry: false,
      },
    ],
  },

  // Mission dengan Multiple Flights - Bolok Harbor Security
  {
    id: 'MSN-2025-002',
    name: 'Bolok Harbor Security Assessment',
    description: 'Comprehensive security assessment of Bolok Harbor with multiple patrol sessions.',
    objective: 'Identify security vulnerabilities and monitor unauthorized vessel activities in Bolok area.',
    droneType: 'UAV',
    location: 'Bolok, Kupang',
    area: 'Bolok Zones 1-3',
    startDate: '2025-01-19',
    endDate: '2025-01-20',
    status: 'completed',
    totalFlights: 3,
    completedFlights: 3,
    totalDuration: 148,
    totalDetections: 112,
    totalAnomalies: 23,
    coverageArea: 12.7,
    flights: [
      {
        id: 'F-2025-01-19-002-001',
        missionId: 'MSN-2025-002',
        flightNumber: 1,
        name: 'Zone 1 Security Sweep',
        date: '2025-01-19',
        time: '09:00',
        duration: 52,
        status: 'completed',
        drone: 'AR-2 Aerial',
        droneId: 'UAV-002',
        droneType: 'UAV',
        pilot: 'Mike Johnson',
        aiModel: 'Vessel Attribute Detection',
        avgSpeed: 10.5,
        maxAltitude: 95,
        distance: 9.1,
        detections: 47,
        area: 5.2,
        anomalies: 11,
        videoId: '2TmJKrhBzs4',
        hasVideo: true,
        hasTelemetry: true,
      },
      {
        id: 'F-2025-01-19-002-002',
        missionId: 'MSN-2025-002',
        flightNumber: 2,
        name: 'Zone 2 Perimeter Check',
        date: '2025-01-19',
        time: '13:45',
        duration: 48,
        status: 'completed',
        drone: 'Pyrhos X V1',
        droneId: 'UAV-001',
        droneType: 'UAV',
        pilot: 'Sarah Chen',
        aiModel: 'Vessel Detection & Recognition',
        avgSpeed: 11.2,
        maxAltitude: 105,
        distance: 8.9,
        detections: 38,
        area: 4.5,
        anomalies: 7,
        videoId: 'JxrGGacMlys',
        hasVideo: true,
        hasTelemetry: true,
      },
      {
        id: 'F-2025-01-20-002-003',
        missionId: 'MSN-2025-002',
        flightNumber: 3,
        name: 'Zone 3 Final Assessment',
        date: '2025-01-20',
        time: '08:30',
        duration: 48,
        status: 'completed',
        drone: 'AR-2 Aerial',
        droneId: 'UAV-002',
        droneType: 'UAV',
        pilot: 'Mike Johnson',
        aiModel: 'Vessel Hull Number Recognition',
        avgSpeed: 10.8,
        maxAltitude: 98,
        distance: 8.6,
        detections: 27,
        area: 3.0,
        anomalies: 5,
        videoId: '_PWIJ3a_XZ4',
        hasVideo: true,
        hasTelemetry: true,
      },
    ],
  },

  // Single Flight Missions (existing format)
  {
    id: 'M-2025-01-19-003',
    name: 'Tenau Coastal Monitoring',
    description: 'Daily patrol to monitor coastal activities near Tenau.',
    objective: 'Ensure coastal security and monitor environmental issues in Tenau waters.',
    droneType: 'UAV',
    location: 'Tenau Waters',
    area: '2 km²',
    startDate: '2025-01-19',
    endDate: '2025-01-19',
    status: 'completed',
    totalFlights: 1,
    completedFlights: 1,
    totalDuration: 38,
    totalDetections: 312,
    totalAnomalies: 8,
    coverageArea: 1.2,
    flights: [
      {
        id: 'F-2025-01-19-003-001',
        missionId: 'M-2025-01-19-003',
        flightNumber: 1,
        name: 'Tenau Coastal Monitoring',
        date: '2025-01-19',
        time: '10:00',
        duration: 38,
        status: 'completed',
        drone: 'Pyrhos X V1',
        droneId: 'UAV-001',
        droneType: 'UAV',
        pilot: 'Sarah Chen',
        aiModel: 'Trash Detection',
        avgSpeed: 8.2,
        maxAltitude: 45,
        distance: 3.2,
        detections: 312,
        area: 1.2,
        anomalies: 8,
        videoId: '_PWIJ3a_XZ4',
        hasVideo: true,
        hasTelemetry: true,
      },
    ],
  },
  {
    id: 'M-2025-01-18-004',
    name: 'Harbor Gate Inspection - Kupang',
    description: 'Inspection of Kupang Harbor Gate area.',
    objective: 'Ensure bridge integrity and monitor structural issues near Kupang Port.',
    droneType: 'UAV',
    location: 'Kupang Port',
    area: '1 km²',
    startDate: '2025-01-18',
    endDate: '2025-01-18',
    status: 'completed',
    totalFlights: 1,
    completedFlights: 1,
    totalDuration: 65, // minutes
    totalDetections: 18,
    totalAnomalies: 3,
    coverageArea: 0.8, // km²
    flights: [
      {
        id: 'F-2025-01-18-004-001',
        missionId: 'M-2025-01-18-004',
        flightNumber: 1,
        name: 'Harbor Gate Inspection - Kupang',
        date: '2025-01-18',
        time: '11:00',
        duration: 65, // minutes
        status: 'completed',
        drone: 'AR-2 Aerial',
        droneId: 'UAV-002',
        droneType: 'UAV',
        pilot: 'Mike Johnson',
        aiModel: 'Vessel Hull Number Recognition',
        avgSpeed: 9.5,
        maxAltitude: 78,
        distance: 5.8,
        detections: 18,
        area: 0.8,
        anomalies: 3,
        videoId: 'JxrGGacMlys',
        hasVideo: true,
        hasTelemetry: true,
      },
    ],
  },
  {
    id: 'M-2025-01-18-005',
    name: 'Emergency Response - Sector 7',
    description: 'Emergency response mission in Sector 7.',
    objective: 'Assess and respond to emergency situations.',
    droneType: 'UAV',
    location: 'Emergency Zone',
    area: '4 km²',
    startDate: '2025-01-18',
    endDate: '2025-01-18',
    status: 'completed',
    totalFlights: 1,
    completedFlights: 1,
    totalDuration: 28, // minutes
    totalDetections: 3,
    totalAnomalies: 1,
    coverageArea: 3.5, // km²
    flights: [
      {
        id: 'F-2025-01-18-005-001',
        missionId: 'M-2025-01-18-005',
        flightNumber: 1,
        name: 'Emergency Response - Sector 7',
        date: '2025-01-18',
        time: '12:00',
        duration: 28, // minutes
        status: 'completed',
        drone: 'Pyrhos X V1',
        droneId: 'UAV-001',
        droneType: 'UAV',
        pilot: 'Sarah Chen',
        aiModel: 'Vessel Detection & Recognition',
        avgSpeed: 15.2,
        maxAltitude: 142,
        distance: 7.1,
        detections: 3,
        area: 3.5,
        anomalies: 1,
        videoId: 'QelM_5EPOHE',
        hasVideo: true,
        hasTelemetry: true,
      },
    ],
  },

  // AUV Missions
  {
    id: 'M-2025-01-17-006',
    name: 'Underwater Pipeline Inspection',
    description: 'Inspection of underwater pipeline.',
    objective: 'Ensure pipeline integrity and monitor structural issues.',
    droneType: 'AUV',
    location: 'Tanjung Priok Underwater',
    area: '1 km²',
    startDate: '2025-01-17',
    endDate: '2025-01-17',
    status: 'completed',
    totalFlights: 1,
    completedFlights: 1,
    totalDuration: 71, // minutes
    totalDetections: 12,
    totalAnomalies: 3,
    coverageArea: 0.5, // km²
    flights: [
      {
        id: 'F-2025-01-17-006-001',
        missionId: 'M-2025-01-17-006',
        flightNumber: 1,
        name: 'Underwater Pipeline Inspection',
        date: '2025-01-17',
        time: '13:00',
        duration: 71, // minutes
        status: 'completed',
        drone: 'AquaScan Alpha',
        droneId: 'AUV-001',
        droneType: 'AUV',
        pilot: 'David Lee',
        aiModel: 'Structure Inspection',
        avgSpeed: 2.3,
        maxDepth: 45,
        distance: 2.8,
        detections: 12,
        area: 0.5,
        anomalies: 3,
        videoId: '2TmJKrhBzs4',
        hasVideo: true,
        hasTelemetry: true,
      },
    ],
  },
  {
    id: 'M-2025-01-17-007',
    name: 'Deep Sea Survey',
    description: 'Survey of deep sea area.',
    objective: 'Map seabed and monitor environmental issues.',
    droneType: 'AUV',
    location: 'Jakarta Bay',
    area: '2 km²',
    startDate: '2025-01-17',
    endDate: '2025-01-17',
    status: 'completed',
    totalFlights: 1,
    completedFlights: 1,
    totalDuration: 95, // minutes
    totalDetections: 28,
    totalAnomalies: 7,
    coverageArea: 1.8, // km²
    flights: [
      {
        id: 'F-2025-01-17-007-001',
        missionId: 'M-2025-01-17-007',
        flightNumber: 1,
        name: 'Deep Sea Survey',
        date: '2025-01-17',
        time: '14:00',
        duration: 95, // minutes
        status: 'completed',
        drone: 'DeepSeeker Pro',
        droneId: 'AUV-002',
        droneType: 'AUV',
        pilot: 'David Lee',
        aiModel: 'Seabed Mapping',
        avgSpeed: 1.8,
        maxDepth: 120,
        distance: 4.2,
        detections: 28,
        area: 1.8,
        anomalies: 7,
        videoId: 'QelM_5EPOHE',
        hasVideo: true,
        hasTelemetry: true,
      },
    ],
  },
  {
    id: 'M-2025-01-16-008',
    name: 'Port Infrastructure Assessment',
    description: 'Assessment of port infrastructure.',
    objective: 'Evaluate port infrastructure and monitor structural issues.',
    droneType: 'AUV',
    location: 'Port Foundation',
    area: '1 km²',
    startDate: '2025-01-16',
    endDate: '2025-01-16',
    status: 'completed',
    totalFlights: 1,
    completedFlights: 1,
    totalDuration: 88, // minutes
    totalDetections: 19,
    totalAnomalies: 4,
    coverageArea: 0.9, // km²
    flights: [
      {
        id: 'F-2025-01-16-008-001',
        missionId: 'M-2025-01-16-008',
        flightNumber: 1,
        name: 'Port Infrastructure Assessment',
        date: '2025-01-16',
        time: '15:00',
        duration: 88, // minutes
        status: 'completed',
        drone: 'AquaScan Alpha',
        droneId: 'AUV-001',
        droneType: 'AUV',
        pilot: 'David Lee',
        aiModel: 'Structure Inspection',
        avgSpeed: 2.1,
        maxDepth: 35,
        distance: 3.1,
        detections: 19,
        area: 0.9,
        anomalies: 4,
        videoId: 'QelM_5EPOHE',
        hasVideo: true,
        hasTelemetry: true,
      },
    ],
  },
  {
    id: 'M-2025-01-16-009',
    name: 'Ship Hull Inspection',
    description: 'Inspection of ship hull.',
    objective: 'Ensure ship hull integrity and monitor structural issues.',
    droneType: 'UAV',
    location: 'Dock 3',
    area: '0.5 km²',
    startDate: '2025-01-16',
    endDate: '2025-01-16',
    status: 'completed',
    totalFlights: 1,
    completedFlights: 1,
    totalDuration: 42, // minutes
    totalDetections: 8,
    totalAnomalies: 2,
    coverageArea: 0.4, // km²
    flights: [
      {
        id: 'F-2025-01-16-009-001',
        missionId: 'M-2025-01-16-009',
        flightNumber: 1,
        name: 'Ship Hull Inspection',
        date: '2025-01-16',
        time: '16:00',
        duration: 42, // minutes
        status: 'completed',
        drone: 'Pyrhos X V1',
        droneId: 'UAV-001',
        droneType: 'UAV',
        pilot: 'Sarah Chen',
        aiModel: 'Vessel Hull Number Recognition',
        avgSpeed: 6.5,
        maxAltitude: 25,
        distance: 2.3,
        detections: 8,
        area: 0.4,
        anomalies: 2,
        videoId: '_PWIJ3a_XZ4',
        hasVideo: true,
        hasTelemetry: true,
      },
    ],
  },
];

// =====================================================
// 3. LIVE OPERATIONS DATA
// =====================================================

export const liveOperations = [
  {
    id: 'OP-2025-001',
    droneName: 'Pyrhos X V1',
    droneId: 'UAV-001',
    droneType: 'UAV',
    pilot: 'Sarah Chen',
    status: 'active',
    mission: 'Port Surveillance',
    videoId: 'JxrGGacMlys',
    position: [-10.1735, 123.5250] as [number, number], // Kupang area - Center (UAV position from image)
    color: '#21A68D',
    telemetry: {
      altitude: 127,
      speed: 12.3,
      battery: 78,
      distance: 2.4,
      signal: 95,
      satellites: 14,
      droneHeight: 150,
      temperature: 32,
      windSpeed: 8.5,
      heading: 145,
      voltage: 24.3,
      current: 12.5,
      latitude: -10.1950,
      longitude: 123.5450,
      flightTime: '00:23:45',
    },
  },
];

// =====================================================
// 4. AI DETECTION DATA
// =====================================================

export const aiDetections = [
  {
    id: 'DET-001',
    type: 'Vessel Detection & Recognition',
    missionId: 'M-2025-01-20-001',
    vesselName: 'MV OCEANIC SPIRIT',
    vesselType: 'Container Ship',
    confidence: 96,
    timestamp: '14:23:45',
    captureImage: 'https://images.unsplash.com/photo-1578942219017-04e8a5a61da9?w=400',
    aisData: {
      mmsi: '477123456',
      imo: 'IMO9234567',
      callSign: 'VRXY2',
      speed: 8.5,
      course: 145,
      length: 294,
      width: 32,
      draft: 12.5,
      destination: 'Jakarta Port',
      eta: '2025-01-20 16:00',
    },
  },
  {
    id: 'DET-002',
    type: 'Vessel Hull Number Recognition',
    missionId: 'M-2025-01-18-004',
    hullNumber: 'TK-2847',
    confidence: 92,
    timestamp: '14:24:12',
    captureImage: 'https://images.unsplash.com/photo-1548599878-3e44d8d1d50d?w=400',
    aisData: {
      mmsi: '477234567',
      imo: 'IMO9345678',
      callSign: 'VTKY8',
      speed: 6.2,
      course: 180,
      length: 182,
      width: 28,
      draft: 10.2,
      destination: 'Singapore',
      eta: '2025-01-21 08:00',
    },
  },
  {
    id: 'DET-003',
    type: 'Vessel Attribute Detection',
    missionId: 'M-2025-01-19-002',
    attributes: ['Cargo Crane', 'Container Stack', 'Navigation Lights'],
    count: 3,
    confidence: 89,
    timestamp: '14:24:38',
    captureImage: 'https://images.unsplash.com/photo-1566576721346-d4a3b4eaeb55?w=400',
  },
  {
    id: 'DET-004',
    type: 'Illegal Fishing Indicator',
    missionId: 'M-2025-01-19-003',
    trashType: 'Suspicious Vessel',
    severity: 'High',
    count: 1,
    confidence: 87,
    timestamp: '14:25:01',
    captureImage: 'https://images.unsplash.com/photo-1621451537084-482c73073a0f?w=400',
    location: { lat: -10.1800, lng: 123.5100 },
  },
  {
    id: 'DET-005',
    type: 'Collision Risk',
    missionId: 'M-2025-01-20-001',
    location: { lat: -10.1700, lng: 123.5300 },
  },
  {
    id: 'DET-006',
    type: 'Unidentified Object',
    missionId: 'M-2025-01-20-001',
    location: { lat: -10.1900, lng: 123.5200 },
  },
  {
    id: 'DET-007',
    type: 'Speeding Violation',
    missionId: 'M-2025-01-20-001',
    location: { lat: -10.2000, lng: 123.5400 },
  },
];

// =====================================================
// 5. AIS VESSEL DATA (MOCK)
// =====================================================

export const mockAISData = [
  {
    id: 'AIS-477123456',
    mmsi: '477123456',
    imo: 'IMO9234567',
    name: 'MV OCEANIC SPIRIT',
    callsign: 'VRXY2',
    position: [-10.1610, 123.5180] as [number, number], // Top left area
    type: 'Container Ship',
    speed: 8.5,
    course: 145,
    heading: 145,
    length: 294,
    width: 32,
    draft: 12.5,
    destination: 'Kupang Port',
    eta: '2025-01-20 16:00',
    status: 'Under way using engine',
  },
  {
    id: 'AIS-477234567',
    mmsi: '477234567',
    imo: 'IMO9345678',
    name: 'ASIAN TRADER',
    callsign: 'VTKY8',
    position: [-10.1650, 123.5210] as [number, number], // Top left area - second
    type: 'Tanker',
    speed: 6.2,
    course: 180,
    heading: 180,
    length: 182,
    width: 28,
    draft: 10.2,
    destination: 'Dili',
    eta: '2025-01-21 08:00',
    status: 'Under way using engine',
  },
  {
    id: 'AIS-477345678',
    mmsi: '477345678',
    imo: 'IMO9456789',
    name: 'PACIFIC HARMONY',
    callsign: 'VRPL5',
    position: [-10.1880, 123.5120] as [number, number], // Left center area
    type: 'Container Ship',
    speed: 4.8,
    course: 90,
    heading: 92,
    length: 225,
    width: 30,
    draft: 11.0,
    destination: 'Kupang Port',
    eta: '2025-01-20 14:30',
    status: 'Moored',
  },
  {
    id: 'AIS-477456789',
    mmsi: '477456789',
    imo: 'IMO9567890',
    name: 'TIMOR EXPRESS',
    callsign: 'VREX3',
    position: [-10.1680, 123.5050] as [number, number], // Moved further into sea
    type: 'Cargo Ship',
    speed: 7.3,
    course: 220,
    heading: 220,
    length: 156,
    width: 24,
    draft: 8.5,
    destination: 'Kupang Port',
    eta: '2025-01-20 18:00',
    status: 'Under way using engine',
  },
  {
    id: 'AIS-477567890',
    mmsi: '477567890',
    imo: 'IMO9678901',
    name: 'NUSA TENGGARA',
    callsign: 'VRNT7',
    position: [-10.1750, 123.5100] as [number, number], // Moved further into sea
    type: 'Ferry',
    speed: 5.5,
    course: 310,
    heading: 310,
    length: 98,
    width: 18,
    draft: 5.2,
    destination: 'Kupang Port',
    eta: '2025-01-20 15:30',
    status: 'Under way using engine',
  },
  {
    id: 'AIS-477678901',
    mmsi: '477678901',
    imo: 'IMO9789012',
    name: 'KUPANG CARRIER',
    callsign: 'VRKC5',
    position: [-10.1820, 123.4950] as [number, number], // Moved further into sea
    type: 'Bulk Carrier',
    speed: 6.8,
    course: 180,
    heading: 180,
    length: 210,
    width: 29,
    draft: 10.8,
    destination: 'Darwin',
    eta: '2025-01-21 12:00',
    status: 'Under way using engine',
  },
  {
    id: 'AIS-477789012',
    mmsi: '477789012',
    imo: 'IMO9890123',
    name: 'SEA EXPLORER',
    callsign: 'VRSE9',
    position: [-10.1900, 123.4700] as [number, number],
    type: 'Research Vessel',
    speed: 4.2,
    course: 270,
    heading: 270,
    length: 85,
    width: 15,
    draft: 6.5,
    destination: 'Tasman Sea',
    eta: '2025-01-25 08:00',
    status: 'Under way using engine',
  },
  {
    id: 'AIS-477890123',
    mmsi: '477890123',
    imo: 'IMO9901234',
    name: 'KUPANG TUG 01',
    callsign: 'VRTG1',
    position: [-10.1650, 123.5350] as [number, number],
    type: 'Tug',
    speed: 3.5,
    course: 45,
    heading: 45,
    length: 32,
    width: 11,
    draft: 4.5,
    destination: 'Kupang Port',
    eta: '2025-01-20 14:15',
    status: 'Restricted maneuverability',
  },
  {
    id: 'AIS-477901234',
    mmsi: '477901234',
    imo: 'IMO9012345',
    name: 'BARUNA JAYA',
    callsign: 'VRBJ2',
    position: [-10.2050, 123.5200] as [number, number],
    type: 'Fishing Vessel',
    speed: 8.2,
    course: 160,
    heading: 155,
    length: 45,
    width: 9,
    draft: 3.8,
    destination: 'Fishing Grounds',
    eta: '2025-01-22 12:00',
    status: 'Engaged in fishing',
  },
  {
    id: 'AIS-477012345',
    mmsi: '477012345',
    imo: 'IMO9123456',
    name: 'PETRO NAVIGATOR',
    callsign: 'VRPN4',
    position: [-10.2200, 123.4500] as [number, number],
    type: 'Tanker',
    speed: 12.5,
    course: 280,
    heading: 280,
    length: 245,
    width: 42,
    draft: 14.2,
    destination: 'Singapore',
    eta: '2025-01-24 10:00',
    status: 'Under way using engine',
  },
  {
    id: 'AIS-477123456',
    mmsi: '477123456',
    imo: 'IMO9234567',
    name: 'LADY LUCK',
    callsign: 'VRLL1',
    position: [-10.2250, 123.3500] as [number, number],
    type: 'Yacht',
    speed: 15.0,
    course: 120,
    heading: 120,
    length: 42,
    width: 8,
    draft: 2.5,
    destination: 'Labuan Bajo',
    eta: '2025-01-21 16:00',
    status: 'Under way using engine',
  },
  {
    id: 'AIS-477000001',
    mmsi: '477000001',
    name: 'KRI DIPONEGORO',
    callsign: 'VRNA1',
    position: [-10.1500, 123.5800] as [number, number],
    type: 'Military Ops',
    speed: 22.0,
    course: 90,
    heading: 90,
    length: 90,
    width: 12,
    draft: 4.5,
    destination: 'Naval Base',
    eta: '2025-01-20 20:00',
    status: 'Under way using engine',
  },
  {
    id: 'AIS-477000002',
    mmsi: '477000002',
    name: 'EXPRESS BAHARI',
    callsign: 'VREB2',
    position: [-10.1720, 123.5150] as [number, number],
    type: 'High Speed Craft',
    speed: 28.5,
    course: 340,
    heading: 340,
    length: 35,
    width: 7,
    draft: 1.8,
    destination: 'Rote Island',
    eta: '2025-01-20 15:00',
    status: 'Under way using engine',
  },
  {
    id: 'AIS-477000003',
    mmsi: '477000003',
    name: 'PILOT BOAT 02',
    callsign: 'VRPB2',
    position: [-10.1620, 123.5300] as [number, number],
    type: 'Pilot Vessel',
    speed: 10.0,
    course: 210,
    heading: 210,
    length: 18,
    width: 4,
    draft: 1.2,
    destination: 'Kupang Port',
    eta: '2025-01-20 14:05',
    status: 'Under way using engine',
  },
  {
    id: 'AIS-477000004',
    mmsi: '477000004',
    name: 'WIND SURFER',
    callsign: 'VRWS4',
    position: [-10.2400, 123.3200] as [number, number],
    type: 'Sailing Vessel',
    speed: 6.5,
    course: 45,
    heading: 50,
    length: 15,
    width: 3.5,
    draft: 2.2,
    destination: 'Coastal Tour',
    eta: '2025-01-20 17:00',
    status: 'Under way using sail',
  },
  {
    id: 'AIS-477000005',
    mmsi: '477000005',
    name: 'GLOBAL FREIGHTER',
    callsign: 'VRGF5',
    position: [-10.2100, 123.4200] as [number, number],
    type: 'Cargo',
    speed: 11.2,
    course: 300,
    heading: 300,
    length: 280,
    width: 38,
    draft: 13.5,
    destination: 'Jakarta',
    eta: '2025-01-23 09:00',
    status: 'Under way using engine',
  },
];

// =====================================================
// 6. ADS-B AIRCRAFT DATA (MOCK)
// =====================================================

export const mockADSBData = [
  {
    id: 'ADSB-001',
    name: 'GA123',
    callsign: 'GIA123',
    position: [-10.1700, 123.6200] as [number, number], // Kupang airspace - East
    altitude: 35000,
    speed: 460,
    heading: 90,
    type: 'aircraft',
    onGround: false,
  },
  {
    id: 'ADSB-002',
    name: 'QZ456',
    callsign: 'AWQ456',
    position: [-10.2300, 123.4800] as [number, number], // Kupang airspace - West
    altitude: 4200,
    speed: 280,
    heading: 180,
    type: 'aircraft',
    onGround: false,
  },
  {
    id: 'ADSB-003',
    name: 'SJ123',
    callsign: 'SJY123',
    position: [-10.1900, 123.5800] as [number, number],
    altitude: 12000,
    speed: 320,
    heading: 270,
    type: 'aircraft',
    onGround: false,
  },
  {
    id: 'ADSB-004',
    name: 'JT789',
    callsign: 'LNI789',
    position: [-10.1500, 123.5500] as [number, number],
    altitude: 8500,
    speed: 290,
    heading: 45,
    type: 'aircraft',
    onGround: false,
  },
  {
    id: 'ADSB-005',
    name: 'ID567',
    callsign: 'BTK567',
    position: [-10.2100, 123.6500] as [number, number],
    altitude: 33000,
    speed: 440,
    heading: 315,
    type: 'aircraft',
    onGround: false,
  },
  {
    id: 'ADSB-006',
    name: 'IW321',
    callsign: 'WON321',
    position: [-10.2500, 123.5200] as [number, number],
    altitude: 2500,
    speed: 180,
    heading: 0,
    type: 'aircraft',
    onGround: false,
  },
  {
    id: 'ADSB-007',
    name: 'QG987',
    callsign: 'CTV987',
    position: [-10.2800, 123.4000] as [number, number],
    altitude: 21000,
    speed: 380,
    heading: 135,
    type: 'aircraft',
    onGround: false,
  },
];

// =====================================================
// 7. ENC (ELECTRONIC NAVIGATIONAL CHARTS) DATA
// =====================================================

export const mockENCData = [
  // Depth Soundings (Matching the blue numbers in reference)
  { id: 'DEPTH-01', type: 'depth', name: '24', position: [-10.1550, 123.5100] as [number, number], color: 'blue', description: 'Depth sounding' },
  { id: 'DEPTH-02', type: 'depth', name: '35', position: [-10.1600, 123.5250] as [number, number], color: 'blue', description: 'Depth sounding' },
  { id: 'DEPTH-03', type: 'depth', name: '13', position: [-10.1700, 123.5350] as [number, number], color: 'blue', description: 'Depth sounding' },
  { id: 'DEPTH-04', type: 'depth', name: '52', position: [-10.1780, 123.5380] as [number, number], color: 'blue', description: 'Depth sounding' },
  { id: 'DEPTH-05', type: 'depth', name: '70', position: [-10.1820, 123.5420] as [number, number], color: 'blue', description: 'Depth sounding' },
  { id: 'DEPTH-06', type: 'depth', name: '9.2', position: [-10.1650, 123.5420] as [number, number], color: 'blue', description: 'Depth sounding' },

  // Rocks / Hazards (Matching the asterisks/stars in reference)
  { id: 'ROCK-01', type: 'rock', name: 'Baron Rock', position: [-10.1820, 123.5350] as [number, number], color: 'black', description: 'Submerged rock hazard' },
  { id: 'ROCK-02', type: 'rock', name: 'Heron Rock', position: [-10.1620, 123.5120] as [number, number], color: 'black', description: 'Submerged rock hazard' },
  { id: 'ROCK-03', type: 'rock', name: 'Unnamed Hazard', position: [-10.2050, 123.5300] as [number, number], color: 'black', description: 'Obstruction' },

  // Restricted / Special Areas (Matching the magenta X in reference)
  { id: 'SPECIAL-01', type: 'special', name: 'No Anchorage', position: [-10.1450, 123.5350] as [number, number], color: 'magenta', description: 'Restricted area marker' },
  { id: 'SPECIAL-02', type: 'special', name: 'Pipeline Area', position: [-10.1580, 123.5480] as [number, number], color: 'magenta', description: 'Restricted area marker' },

  // Buoys with Light flares
  {
    id: 'BUOY-RED-01',
    type: 'buoy',
    subType: 'port',
    name: 'PS(1) R 4s',
    position: [-10.1650, 123.5150] as [number, number],
    color: 'red',
    description: 'Port side marker',
    lightCharacter: 'Fl(1) R 4s',
  },
  {
    id: 'BUOY-GREEN-01',
    type: 'buoy',
    subType: 'starboard',
    name: 'SB(1) G 4s',
    position: [-10.1680, 123.5280] as [number, number],
    color: 'green',
    description: 'Starboard side marker',
    lightCharacter: 'Fl(1) G 4s',
  },

  // Beacons / Lighthouses
  {
    id: 'BEACON-01',
    type: 'beacon',
    subType: 'lighthouse',
    name: 'Kupang Main Light',
    position: [-10.1590, 123.5380] as [number, number],
    color: 'yellow',
    description: 'Main port entrance lighthouse',
    lightCharacter: 'Fl(2) W 10s',
  },
  {
    id: 'BEACON-02',
    type: 'beacon',
    subType: 'lighthouse',
    name: 'East Beacon',
    position: [-10.1750, 123.5450] as [number, number],
    color: 'yellow',
    description: 'Eastern navigation beacon',
    lightCharacter: 'Fl 5s',
  },

  // Safe Water Marks
  {
    id: 'SAFE-01',
    type: 'safe_water',
    subType: 'fairway',
    name: 'Fairway Buoy',
    position: [-10.1750, 123.5240] as [number, number],
    color: 'white',
    description: 'Safe water passage',
  },

  // Anchorage Points
  {
    id: 'ANCHOR-01',
    type: 'anchorage',
    name: 'Anchorage Area A',
    position: [-10.1920, 123.5280] as [number, number],
    color: 'purple',
    description: 'Designated anchorage area',
  },
  {
    id: 'ANCHOR-02',
    type: 'anchorage',
    name: 'Anchorage Area B',
    position: [-10.1880, 123.5280] as [number, number],
    color: 'purple',
    description: 'Designated anchorage area',
  },

  // Navigation Hazards
  {
    id: 'HAZARD-01',
    type: 'hazard',
    subType: 'rock',
    name: 'Submerged Rock',
    position: [-10.1640, 123.5200] as [number, number],
    color: 'orange',
    description: 'Dangerous submerged rock',
  },
  {
    id: 'HAZARD-02',
    type: 'hazard',
    subType: 'wreck',
    name: 'Wreck Site',
    position: [-10.1880, 123.5150] as [number, number],
    color: 'orange',
    description: 'Sunken vessel wreck',
  },

  // Channel Markers
  {
    id: 'CHANNEL-01',
    type: 'channel',
    name: 'Channel Marker North',
    position: [-10.1620, 123.5220] as [number, number],
    color: 'cyan',
    description: 'Navigation channel boundary',
  },
  {
    id: 'CHANNEL-02',
    type: 'channel',
    name: 'Channel Marker South',
    position: [-10.1780, 123.5260] as [number, number],
    color: 'cyan',
    description: 'Navigation channel boundary',
  },

  // Port Facilities
  {
    id: 'PORT-01',
    type: 'port_facility',
    subType: 'pier',
    name: 'Main Pier',
    position: [-10.1580, 123.5350] as [number, number],
    color: 'blue',
    description: 'Main loading pier',
  },
  {
    id: 'PORT-02',
    type: 'port_facility',
    subType: 'dock',
    name: 'Container Dock',
    position: [-10.1595, 123.5370] as [number, number],
    color: 'blue',
    description: 'Container terminal',
  },
];

// =====================================================
// 11. WEATHER DATA (MOCK)
// =====================================================

export const mockWeatherData = [
  { id: 'W-01', type: 'rain', value: '12', unit: 'mm/h', position: [-10.1500, 123.4800] as [number, number], temp: 24, description: 'Moderate Rain' },
  { id: 'W-02', type: 'cloud', value: '85', unit: '%', position: [-10.2200, 123.5800] as [number, number], temp: 27, description: 'Overcast' },
  { id: 'W-03', type: 'wind', value: '18', unit: 'kn', position: [-10.1800, 123.4200] as [number, number], temp: 26, description: 'Strong Breeze' },
  { id: 'W-04', type: 'wave', value: '2.4', unit: 'm', position: [-10.2500, 123.3500] as [number, number], temp: 25, description: 'High Swell' },
  { id: 'W-05', type: 'storm', value: '985', unit: 'hPa', position: [-10.3000, 123.6500] as [number, number], temp: 22, description: 'Low Pressure Area' },
  { id: 'W-06', type: 'wind', value: '12', unit: 'kn', position: [-10.1200, 123.5500] as [number, number], temp: 28, description: 'Calm Wind' },
  { id: 'W-07', type: 'rain', value: '5', unit: 'mm/h', position: [-10.0500, 123.5000] as [number, number], temp: 26, description: 'Light Drizzle' },
];

// =====================================================
// 10. GEOFENCES (MOCK)
// =====================================================

export const mockGeofences = [
  {
    id: 'GF-01',
    name: 'Primary Search Area',
    bounds: [[-10.25, 123.45], [-10.10, 123.65]] as [[number, number], [number, number]],
    color: '#22c55e', // Green
    dashed: true,
  },
  {
    id: 'GF-02',
    name: 'Sector A',
    bounds: [[-10.10, 123.50], [-10.05, 123.60]] as [[number, number], [number, number]],
    color: '#22c55e', // Green
    dashed: true,
  },
  {
    id: 'GF-03',
    name: 'Mission AOI',
    bounds: [[-10.21, 123.51], [-10.16, 123.58]] as [[number, number], [number, number]],
    color: '#ef4444', // Red
    dashed: true,
  }
];

// =====================================================
// 8. CALCULATED STATISTICS
// =====================================================

export const missionSummary = {
  totalMissions: missions.length,
  totalFlights: missions.reduce((sum, m) => sum + m.totalFlights, 0),
  uavMissions: missions.filter(m => m.droneType === 'UAV').length,
  auvMissions: missions.filter(m => m.droneType === 'AUV').length,
  activeMissions: liveOperations.length,
  totalDetections: missions.reduce((sum, m) => sum + m.totalDetections, 0),
  totalAnomalies: missions.reduce((sum, m) => sum + m.totalAnomalies, 0),
  totalArea: missions.reduce((sum, m) => sum + m.coverageArea, 0),
  totalDuration: missions.reduce((sum, m) => sum + m.totalDuration, 0),
  totalDistance: missions.reduce((sum, m) => sum + m.flights.reduce((sum, f) => sum + f.distance, 0), 0),
  successRate: Math.round(
    (missions.filter(m => m.status === 'completed').length / missions.length) * 100
  ),
  activeDrones: drones.filter(d => d.status === 'in-flight').length,
  availableDrones: drones.filter(d => d.status === 'available').length,
  maintenanceDrones: drones.filter(d => d.status === 'maintenance').length,
  chargingDrones: drones.filter(d => d.status === 'charging').length,
  totalDrones: drones.length,
  totalVessels: mockAISData.length,
  totalAircraft: mockADSBData.length,
};

// =====================================================
// 9. HELPER FUNCTIONS
// =====================================================

export function getDroneById(id: string) {
  return drones.find(d => d.id === id);
}

export function getDroneByName(name: string) {
  return drones.find(d => d.name === name);
}

export function getMissionById(id: string) {
  return missions.find(m => m.id === id);
}

export function getMissionsByDrone(droneName: string) {
  return missions.filter(m => m.flights.some(f => f.drone === droneName));
}

export function getRecentMissions(limit: number = 5) {
  return missions.slice(0, limit);
}

export function getDetectionsByMission(missionId: string) {
  return aiDetections.filter(d => d.missionId === missionId);
}

export function getVesselByMMSI(mmsi: string) {
  return mockAISData.find(v => v.mmsi === mmsi);
}
