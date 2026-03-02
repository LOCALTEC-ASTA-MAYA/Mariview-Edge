/**
 * Custom Hooks for Storage Management
 * React hooks untuk manage data persistence dengan localStorage
 */

import { useState, useEffect, useCallback } from 'react';
import { Mission, Drone } from '../data/mock-data';
import {
  loadMissions,
  saveMissions,
  addMission as addMissionToStorage,
  updateMission as updateMissionInStorage,
  deleteMission as deleteMissionFromStorage,
  loadDrones,
  saveDrones,
  addDrone as addDroneToStorage,
  updateDrone as updateDroneInStorage,
  deleteDrone as deleteDroneFromStorage,
  initializeStorage,
  Asset,
  loadAssets,
  saveAssets,
  addAsset as addAssetToStorage,
  updateAsset as updateAssetInStorage,
  deleteAsset as deleteAssetFromStorage,
} from '../utils/storage';

// =====================================================
// MISSIONS HOOK
// =====================================================

export function useMissions() {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);

  // Load missions on mount
  useEffect(() => {
    initializeStorage();
    const loadedMissions = loadMissions();
    setMissions(loadedMissions);
    setLoading(false);
  }, []);

  const addMission = useCallback((mission: Mission) => {
    const updated = addMissionToStorage(mission);
    setMissions(updated);
    return mission;
  }, []);

  const updateMission = useCallback((missionId: string, updates: Partial<Mission>) => {
    const updated = updateMissionInStorage(missionId, updates);
    setMissions(updated);
  }, []);

  const deleteMission = useCallback((missionId: string) => {
    const updated = deleteMissionFromStorage(missionId);
    setMissions(updated);
  }, []);

  const refreshMissions = useCallback(() => {
    const loaded = loadMissions();
    setMissions(loaded);
  }, []);

  return {
    missions,
    loading,
    addMission,
    updateMission,
    deleteMission,
    refreshMissions,
  };
}

// =====================================================
// DRONES HOOK
// =====================================================

export function useDrones() {
  const [drones, setDrones] = useState<Drone[]>([]);
  const [loading, setLoading] = useState(true);

  // Load drones on mount
  useEffect(() => {
    initializeStorage();
    const loadedDrones = loadDrones();
    setDrones(loadedDrones);
    setLoading(false);
  }, []);

  const addDrone = useCallback((drone: Drone) => {
    const updated = addDroneToStorage(drone);
    setDrones(updated);
    return drone;
  }, []);

  const updateDrone = useCallback((droneId: string, updates: Partial<Drone>) => {
    const updated = updateDroneInStorage(droneId, updates);
    setDrones(updated);
  }, []);

  const deleteDrone = useCallback((droneId: string) => {
    const updated = deleteDroneFromStorage(droneId);
    setDrones(updated);
  }, []);

  const refreshDrones = useCallback(() => {
    const loaded = loadDrones();
    setDrones(loaded);
  }, []);

  return {
    drones,
    loading,
    addDrone,
    updateDrone,
    deleteDrone,
    refreshDrones,
  };
}

// =====================================================
// ASSETS HOOK (Other than drones)
// =====================================================

export function useAssets() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);

  // Load assets on mount
  useEffect(() => {
    const loadedAssets = loadAssets();
    setAssets(loadedAssets);
    setLoading(false);
  }, []);

  const addAsset = useCallback((asset: Asset) => {
    const updated = addAssetToStorage(asset);
    setAssets(updated);
    return asset;
  }, []);

  const updateAsset = useCallback((assetId: string, updates: Partial<Asset>) => {
    const updated = updateAssetInStorage(assetId, updates);
    setAssets(updated);
  }, []);

  const deleteAsset = useCallback((assetId: string) => {
    const updated = deleteAssetFromStorage(assetId);
    setAssets(updated);
  }, []);

  const refreshAssets = useCallback(() => {
    const loaded = loadAssets();
    setAssets(loaded);
  }, []);

  return {
    assets,
    loading,
    addAsset,
    updateAsset,
    deleteAsset,
    refreshAssets,
  };
}

// =====================================================
// SYNC HOOK (untuk real-time sync antar tabs)
// =====================================================

export function useStorageSync() {
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key?.startsWith('mariview_')) {
        // Trigger re-render when storage changes in another tab
        window.dispatchEvent(new CustomEvent('mariview-storage-change'));
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);
}
