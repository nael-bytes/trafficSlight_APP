/**
 * useCacheManagement Hook
 * 
 * Extracts cache management logic:
 * - Cache loading
 * - Cache saving
 * - Local cache state management
 * 
 * @module useCacheManagement
 */

import { useState, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Motor } from '../../types';

interface UseCacheManagementParams {
  user: any;
  isFocused: boolean;
  appMotors?: Motor[];
  appReports?: any[];
  appGasStations?: any[];
  cachedMotors?: Motor[];
  cachedReports?: any[];
  cachedGasStations?: any[];
}

interface UseCacheManagementReturn {
  localMotors: Motor[];
  localReports: any[];
  localGasStations: any[];
  setLocalMotors: React.Dispatch<React.SetStateAction<Motor[]>>;
  setLocalReports: React.Dispatch<React.SetStateAction<any[]>>;
  setLocalGasStations: React.Dispatch<React.SetStateAction<any[]>>;
  loadCachedData: () => Promise<void>;
  saveCachedData: (motorsData?: Motor[], reportsData?: any[], gasStationsData?: any[]) => Promise<void>;
}

/**
 * Custom hook for managing cache operations
 */
export const useCacheManagement = ({
  user,
  isFocused,
  appMotors,
  appReports,
  appGasStations,
  cachedMotors,
  cachedReports,
  cachedGasStations,
}: UseCacheManagementParams): UseCacheManagementReturn => {
  // Local cache states (similar to HomeScreen)
  const [localMotors, setLocalMotors] = useState<Motor[]>([]);
  const [localReports, setLocalReports] = useState<any[]>([]);
  const [localGasStations, setLocalGasStations] = useState<any[]>([]);

  // Simple fallback: just load cached data
  const loadCachedData = useCallback(async () => {
    if (!user?._id || !isFocused) return;

    try {
      // Simple fallback: just load cached data
      const [cachedMotorsStr, cachedReportsStr, cachedGasStationsStr] = await Promise.all([
        AsyncStorage.getItem(`cachedMotors_${user._id}`),
        AsyncStorage.getItem(`cachedReports_${user._id}`),
        AsyncStorage.getItem(`cachedGasStations_${user._id}`),
      ]);

      if (cachedMotorsStr) {
        const motors = JSON.parse(cachedMotorsStr);
        if (Array.isArray(motors)) {
          setLocalMotors(motors);
        }
      }
      if (cachedReportsStr) {
        const reports = JSON.parse(cachedReportsStr);
        if (Array.isArray(reports)) {
          setLocalReports(reports);
        }
      }
      if (cachedGasStationsStr) {
        const gasStations = JSON.parse(cachedGasStationsStr);
        if (Array.isArray(gasStations)) {
          setLocalGasStations(gasStations);
        }
      }

      if (__DEV__) {
        console.log('[useCacheManagement] Loaded cached data (fallback mode)');
      }
    } catch (error: any) {
      if (__DEV__) {
        console.warn('[useCacheManagement] Failed to load cached data:', error);
      }
    }
  }, [user?._id, isFocused]);

  // Simple fallback: No-op function, no cache saving
  const saveCachedData = useCallback(async (motorsData?: Motor[], reportsData?: any[], gasStationsData?: any[]) => {
    // No-op in fallback mode
  }, []);

  // OPTIMIZED: Load cached data immediately on mount (don't wait for focus)
  // This shows data instantly when component mounts
  useEffect(() => {
    if (!user?._id) return;

    // Load cached data immediately (non-blocking)
    loadCachedData().catch(() => {
      // Silent failure - cached data might not exist
    });
  }, [user?._id, loadCachedData]); // Removed isFocused dependency for faster initial load

  // Use cached motors from useAppData if available
  useEffect(() => {
    if (!user?._id) return;

    // Simple fallback: just use motors from useAppData if available
    if (appMotors && appMotors.length > 0 && localMotors.length === 0) {
      setLocalMotors(appMotors);
    }
    if (appReports && appReports.length > 0 && localReports.length === 0) {
      setLocalReports(appReports);
    }
    if (appGasStations && appGasStations.length > 0 && localGasStations.length === 0) {
      setLocalGasStations(appGasStations);
    }
  }, [appMotors, appReports, appGasStations, user?._id, localMotors.length, localReports.length, localGasStations.length]);

  // Use cached motors from context if available
  useEffect(() => {
    if (!user?._id) return;

    // Simple fallback: just use cached motors from useAppData or context
    if (cachedMotors && cachedMotors.length > 0 && localMotors.length === 0) {
      setLocalMotors(cachedMotors);
      if (__DEV__) {
        console.log('[useCacheManagement] Using cached motors (fallback mode):', cachedMotors.length);
      }
    }
  }, [user?._id, cachedMotors, localMotors.length]);

  return {
    localMotors,
    localReports,
    localGasStations,
    setLocalMotors,
    setLocalReports,
    setLocalGasStations,
    loadCachedData,
    saveCachedData,
  };
};

