/**
 * Shared Data - Re-export from central mock data with localStorage sync
 * This file maintains backward compatibility while using centralized data
 */

import {
  missions as initialMissions,
  drones as initialDrones,
  missionSummary as initialMissionSummary,
  liveOperations,
  aiDetections,
  mockAISData,
  mockADSBData,
  mockENCData,
  mockGeofences,
  mockWeatherData,
  getDroneById as _getDroneById,
  getDroneByName as _getDroneByName,
  getMissionById as _getMissionById,
  getMissionsByDrone as _getMissionsByDrone,
  getRecentMissions as _getRecentMissions,
  getDetectionsByMission,
  getVesselByMMSI,
  Mission,
  Drone,
  Flight,
} from '../data/mock-data';

export type { Mission, Drone, Flight };

import { loadFromStorage } from '../utils/storage';

// Load missions and drones from localStorage, fallback to initial data
export const missions: Mission[] = loadFromStorage('mariview_missions', initialMissions);
export const drones: Drone[] = loadFromStorage('mariview_drones', initialDrones);

// Recalculate mission summary based on current data
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

// Helper functions that work with localStorage data
export function getDroneById(id: string) {
  return drones.find(d => d.id === id);
}

export function getDroneByName(name: string) {
  return drones.find(d => d.name === name);
}

export function getRecentMissions(limit: number = 5) {
  return missions.slice(0, limit);
}

// Re-export other data that doesn't need localStorage
export {
  liveOperations,
  aiDetections,
  mockAISData,
  mockADSBData,
  mockENCData,
  mockGeofences,
  mockWeatherData,
  getDetectionsByMission,
  getVesselByMMSI,
};
