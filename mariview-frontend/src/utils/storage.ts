/**
 * Local Storage Utility
 * Menyimpan data aplikasi Mariview di browser localStorage
 */

import { Mission, Drone, Flight } from '../data/mock-data';
import { missions as initialMissions, drones as initialDrones } from '../data/mock-data';

const STORAGE_KEYS = {
  MISSIONS: 'mariview_missions',
  DRONES: 'mariview_drones',
  FLIGHTS: 'mariview_flights',
  ASSETS: 'mariview_assets',
  SETTINGS: 'mariview_settings',
};

// =====================================================
// GENERIC STORAGE FUNCTIONS
// =====================================================

export function saveToStorage<T>(key: string, data: T): void {
  try {
    const serialized = JSON.stringify(data);
    localStorage.setItem(key, serialized);
    // Notify storage change
    window.dispatchEvent(new CustomEvent('mariview-storage-change'));
  } catch (error) {
    console.error(`Error saving to localStorage (${key}):`, error);
  }
}

export function loadFromStorage<T>(key: string, defaultValue: T): T {
  try {
    const item = localStorage.getItem(key);
    if (item === null) {
      return defaultValue;
    }
    return JSON.parse(item) as T;
  } catch (error) {
    console.error(`Error loading from localStorage (${key}):`, error);
    return defaultValue;
  }
}

export function removeFromStorage(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.error(`Error removing from localStorage (${key}):`, error);
  }
}

export function clearAllStorage(): void {
  try {
    Object.values(STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
  } catch (error) {
    console.error('Error clearing localStorage:', error);
  }
}

// =====================================================
// MISSIONS STORAGE
// =====================================================

export function saveMissions(missions: Mission[]): void {
  saveToStorage(STORAGE_KEYS.MISSIONS, missions);
}

export function loadMissions(): Mission[] {
  return loadFromStorage(STORAGE_KEYS.MISSIONS, initialMissions);
}

export function addMission(mission: Mission): Mission[] {
  const missions = loadMissions();
  const updated = [...missions, mission];
  saveMissions(updated);
  return updated;
}

export function updateMission(missionId: string, updates: Partial<Mission>): Mission[] {
  const missions = loadMissions();
  const updated = missions.map(m => 
    m.id === missionId ? { ...m, ...updates } : m
  );
  saveMissions(updated);
  return updated;
}

export function deleteMission(missionId: string): Mission[] {
  const missions = loadMissions();
  const updated = missions.filter(m => m.id !== missionId);
  saveMissions(updated);
  return updated;
}

// =====================================================
// DRONES/ASSETS STORAGE
// =====================================================

export function saveDrones(drones: Drone[]): void {
  saveToStorage(STORAGE_KEYS.DRONES, drones);
}

export function loadDrones(): Drone[] {
  return loadFromStorage(STORAGE_KEYS.DRONES, initialDrones);
}

export function addDrone(drone: Drone): Drone[] {
  const drones = loadDrones();
  const updated = [...drones, drone];
  saveDrones(updated);
  return updated;
}

export function updateDrone(droneId: string, updates: Partial<Drone>): Drone[] {
  const drones = loadDrones();
  const updated = drones.map(d => 
    d.id === droneId ? { ...d, ...updates } : d
  );
  saveDrones(updated);
  return updated;
}

export function deleteDrone(droneId: string): Drone[] {
  const drones = loadDrones();
  const updated = drones.filter(d => d.id !== droneId);
  saveDrones(updated);
  return updated;
}

// =====================================================
// ASSETS STORAGE (Other than drones)
// =====================================================

export interface Asset {
  id: string;
  name: string;
  type: string;
  status: string;
  battery?: number;
  location: string;
  serial: string;
  category: 'uav' | 'auv' | 'vehicle' | 'accessory';
}

export function saveAssets(assets: Asset[]): void {
  saveToStorage(STORAGE_KEYS.ASSETS, assets);
}

export function loadAssets(): Asset[] {
  return loadFromStorage(STORAGE_KEYS.ASSETS, []);
}

export function addAsset(asset: Asset): Asset[] {
  const assets = loadAssets();
  const updated = [...assets, asset];
  saveAssets(updated);
  return updated;
}

export function updateAsset(assetId: string, updates: Partial<Asset>): Asset[] {
  const assets = loadAssets();
  const updated = assets.map(a => 
    a.id === assetId ? { ...a, ...updates } : a
  );
  saveAssets(updated);
  return updated;
}

export function deleteAsset(assetId: string): Asset[] {
  const assets = loadAssets();
  const updated = assets.filter(a => a.id !== assetId);
  saveAssets(updated);
  return updated;
}

// =====================================================
// FLIGHTS STORAGE
// =====================================================

export function saveFlights(flights: Flight[]): void {
  saveToStorage(STORAGE_KEYS.FLIGHTS, flights);
}

export function loadFlights(): Flight[] {
  return loadFromStorage(STORAGE_KEYS.FLIGHTS, []);
}

export function addFlight(flight: Flight): Flight[] {
  const flights = loadFlights();
  const updated = [...flights, flight];
  saveFlights(updated);
  return updated;
}

// =====================================================
// SETTINGS STORAGE
// =====================================================

export interface AppSettings {
  theme: 'dark' | 'light';
  mapProvider: 'google' | 'mapbox' | 'osm';
  units: 'metric' | 'imperial';
  language: 'en' | 'id';
  notifications: boolean;
}

const defaultSettings: AppSettings = {
  theme: 'dark',
  mapProvider: 'google',
  units: 'metric',
  language: 'id',
  notifications: true,
};

export function saveSettings(settings: AppSettings): void {
  saveToStorage(STORAGE_KEYS.SETTINGS, settings);
}

export function loadSettings(): AppSettings {
  return loadFromStorage(STORAGE_KEYS.SETTINGS, defaultSettings);
}

// =====================================================
// INITIALIZATION
// =====================================================

export function initializeStorage(): void {
  // Check if this is first time load
  const missions = localStorage.getItem(STORAGE_KEYS.MISSIONS);
  const drones = localStorage.getItem(STORAGE_KEYS.DRONES);
  
  // If no data exists, initialize with mock data
  if (!missions) {
    saveMissions(initialMissions);
  }
  if (!drones) {
    saveDrones(initialDrones);
  }
}

// =====================================================
// EXPORT DATA (for backup)
// =====================================================

export function exportAllData() {
  return {
    missions: loadMissions(),
    drones: loadDrones(),
    assets: loadAssets(),
    flights: loadFlights(),
    settings: loadSettings(),
    exportDate: new Date().toISOString(),
  };
}

// =====================================================
// IMPORT DATA (for restore)
// =====================================================

export function importAllData(data: ReturnType<typeof exportAllData>): void {
  if (data.missions) saveMissions(data.missions);
  if (data.drones) saveDrones(data.drones);
  if (data.assets) saveAssets(data.assets);
  if (data.flights) saveFlights(data.flights);
  if (data.settings) saveSettings(data.settings);
}
