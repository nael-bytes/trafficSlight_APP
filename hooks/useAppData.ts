// Custom hook for app data management

import { useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchReports, fetchGasStations, fetchUserMotors } from '../utils/api';
import type { User, TrafficReport, GasStation, Motor } from '../types';
import { useUser } from '../AuthContext/UserContextImproved';

// CRITICAL FIX: Move refs OUTSIDE the hook to survive unmount/remount cycles
// This prevents re-initialization when the component unmounts and remounts
const globalHasInitialized = new Map<string, boolean>();
const globalHasLoadedMotors = new Map<string, boolean>();

  // Export cleanup function for logout
export const clearAppDataCache = (userId?: string) => {
  if (userId) {
    globalHasInitialized.delete(userId);
    globalHasLoadedMotors.delete(userId);
    console.log('[useAppData] Cleared cache for user:', userId);
  } else {
    globalHasInitialized.clear();
    globalHasLoadedMotors.clear();
    console.log('[useAppData] Cleared all cache');
  }
};

  // Export function to force refresh motors
export const forceRefreshMotors = async (userId: string) => {
  globalHasLoadedMotors.delete(userId);
  console.log('[useAppData] Forced motor refresh for user:', userId);
};

interface UseAppDataProps {
  user: User | null;
  isTracking?: boolean;
}

interface UseAppDataReturn {
  reports: TrafficReport[];
  gasStations: GasStation[];
  motors: Motor[];
  loading: boolean;
  error: string | null;
  refreshData: () => Promise<void>;
}

export const useAppData = ({ user, isTracking = false }: UseAppDataProps): UseAppDataReturn => {
  const [reports, setReports] = useState<TrafficReport[]>([]);
  const [gasStations, setGasStations] = useState<GasStation[]>([]);
  const [motors, setMotors] = useState<Motor[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const {
    cachedReports,
    cachedGasStations,
    cachedMotors,
    updateCachedReports,
    updateCachedGasStations,
    updateCachedMotors,
  } = useUser();

  const loadCachedData = useCallback(async (userId: string) => {
    try {
      // Prefer global caches from context first for immediate paint
      if (Array.isArray(cachedReports) && cachedReports.length > 0) {
        setReports(cachedReports);
      }
      if (Array.isArray(cachedGasStations) && cachedGasStations.length > 0) {
        setGasStations(cachedGasStations);
      }
      if (Array.isArray(cachedMotors) && cachedMotors.length > 0) {
        setMotors(cachedMotors);
      }

      // Also backstop with AsyncStorage if global caches are empty
      const [repStr, gasStr, motStr] = await Promise.all([
        AsyncStorage.getItem('cachedReports'),
        AsyncStorage.getItem('cachedGasStations'),
        AsyncStorage.getItem(`cachedMotors_${userId}`),
      ]);

      if (!cachedReports?.length && repStr) {
        const parsed = JSON.parse(repStr);
        setReports(parsed);
      }
      if (!cachedGasStations?.length && gasStr) {
        const parsed = JSON.parse(gasStr);
        setGasStations(parsed);
      }
      if (!cachedMotors?.length && motStr) {
        const parsedMotors = JSON.parse(motStr);
        if (Array.isArray(parsedMotors)) {
          setMotors(parsedMotors);
        }
      }
    } catch (err) {
      console.warn('[useAppData] Failed to load cached data:', err);
    }
  }, [cachedReports, cachedGasStations, cachedMotors]);

  const saveToCache = useCallback(async (userId: string, data: {
    reports: TrafficReport[];
    gasStations: GasStation[];
    motors: Motor[];
  }) => {
    try {
      await Promise.all([
        AsyncStorage.setItem('cachedReports', JSON.stringify(data.reports)),
        AsyncStorage.setItem('cachedGasStations', JSON.stringify(data.gasStations)),
        AsyncStorage.setItem(`cachedMotors_${userId}`, JSON.stringify(data.motors)),
      ]);
    } catch (err) {
      console.warn('Failed to save to cache:', err);
    }
  }, []);

  const fetchData = useCallback(async (userId: string, signal?: AbortSignal) => {
    try {
      setLoading(true);
      setError(null);

      // Fetch reports and gas stations in parallel (always refresh)
      const [reportsRes, gasStationsRes] = await Promise.allSettled([
        fetchReports(signal),
        fetchGasStations(signal),
      ]);

      // Use functional setState to get current values without adding to dependencies
      let nextReports: TrafficReport[] = [];
      let nextGasStations: GasStation[] = [];
      let currentMotors: Motor[] = [];

      if (reportsRes.status === 'fulfilled') {
        nextReports = reportsRes.value;
        setReports(nextReports);
        updateCachedReports(nextReports);
      } else {
        // Keep existing reports on failure
        setReports(prev => {
          nextReports = prev;
          return prev;
        });
      }

      if (gasStationsRes.status === 'fulfilled') {
        nextGasStations = gasStationsRes.value;
        setGasStations(nextGasStations);
        updateCachedGasStations(nextGasStations);
      } else {
        // Keep existing gas stations on failure
        setGasStations(prev => {
          nextGasStations = prev;
          return prev;
        });
      }

      // Only fetch motors once per session, or if we have no cached motors
      const hasLoadedMotors = globalHasLoadedMotors.get(userId) || false;
      if (!hasLoadedMotors && userId) {
        try {
          console.log('[useAppData] Fetching motors from API for user:', userId);
          const motorsRes = await fetchUserMotors(userId, signal);
          console.log('[useAppData] API returned motors:', Array.isArray(motorsRes) ? motorsRes.length : 'not an array', motorsRes);
          if (Array.isArray(motorsRes)) {
            setMotors(motorsRes);
            updateCachedMotors(motorsRes);
            globalHasLoadedMotors.set(userId, true);
            currentMotors = motorsRes;
            console.log('[useAppData] Motors saved to state and cache:', motorsRes.length);
          }
        } catch (motorsErr: any) {
          if (motorsErr?.name !== 'AbortError') {
            console.error('[useAppData] Motors fetch failed:', motorsErr?.message || motorsErr);
          }
        }
      } else {
        console.log('[useAppData] Skipping motors fetch, already loaded:', hasLoadedMotors);
        // Get current motors for caching
        setMotors(prev => {
          currentMotors = prev;
          return prev;
        });
      }

      // Save to cache what we have
      try {
        await saveToCache(userId, {
          reports: nextReports,
          gasStations: nextGasStations,
          motors: currentMotors,
        });
      } catch {}

      // Warn consolidated errors (non-fatal)
      const nonAbortReportsError =
        reportsRes.status === 'rejected' && (reportsRes.reason?.name !== 'AbortError' ? reportsRes.reason : null);
      const nonAbortGasError =
        gasStationsRes.status === 'rejected' && (gasStationsRes.reason?.name !== 'AbortError' ? gasStationsRes.reason : null);

      if (nonAbortReportsError || nonAbortGasError) {
        console.warn('Some data fetch errors:', {
          reports: nonAbortReportsError || null,
          gasStations: nonAbortGasError || null,
        });
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        console.error('Failed to fetch data:', err);
        setError(err.message || 'Failed to fetch data');
      }
    } finally {
      setLoading(false);
    }
  }, [saveToCache, updateCachedReports, updateCachedGasStations, updateCachedMotors]);

  const refreshData = useCallback(async () => {
    if (!user?._id) return;
    
    // Cancel any ongoing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller
    abortControllerRef.current = new AbortController();

    await fetchData(user._id, abortControllerRef.current.signal);
  }, [user?._id, fetchData]);

  // Initial load - use GLOBAL Map to survive unmount/remount
  useEffect(() => {
    if (!user?._id) return;

    // Check if we already initialized this session
    const hasInitialized = globalHasInitialized.get(user._id);
    if (hasInitialized) {
      console.log('[useAppData] Already initialized for user:', user._id, '- checking for fresh data');
      // Still check for fresh data, but don't re-run full initialization
      const checkForFreshData = async () => {
        // Load cached data (might have changed)
        await loadCachedData(user._id);

        // Always fetch fresh data (but only if we don't have cached motors OR if forced refresh)
        const hasCachedMotors = globalHasLoadedMotors.get(user._id);
        if (!hasCachedMotors) {
          console.log('[useAppData] No cached motors, fetching from API');
          await refreshData();
        } else {
          console.log('[useAppData] Has cached motors, skipping API fetch for now');
        }
      };
      checkForFreshData();
      return;
    }

    const initializeData = async () => {
      console.log('[useAppData] INITIALIZING for user:', user._id);
      globalHasInitialized.set(user._id, true);

      // Load cached data first
      await loadCachedData(user._id);

      // If we loaded motors from cache, mark as loaded to skip future fetches
      const cachedMotorsStr = await AsyncStorage.getItem(`cachedMotors_${user._id}`);
      if (cachedMotorsStr) {
        try {
          const parsed = JSON.parse(cachedMotorsStr);
          if (Array.isArray(parsed) && parsed.length > 0) {
            globalHasLoadedMotors.set(user._id, true);
            console.log('[useAppData] Found cached motors, marking as loaded');
          }
        } catch (e) {
          console.warn('[useAppData] Failed to parse cached motors:', e);
        }
      }

      // Always fetch fresh data on first load
      console.log('[useAppData] Fetching fresh data from API');
      await refreshData();
    };

    initializeData();

    // Cleanup on unmount
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?._id]); // Only depend on user ID

  // Auto-refresh interval - DISABLED per user request
  // useEffect(() => {
  //   if (!user?._id || isTracking) return;

  //   const interval = setInterval(() => {
  //     refreshData();
  //   }, 10000); // Refresh every 10 seconds when not tracking

  //   return () => clearInterval(interval);
  // }, [user?._id, isTracking, refreshData]);

  // // Faster refresh when tracking (but still reasonable to avoid spam)
  // useEffect(() => {
  //   if (!user?._id || !isTracking) return;

  //   const interval = setInterval(() => {
  //     refreshData();
  //   }, 5000); // 5s while tracking to reduce churn

  //   return () => clearInterval(interval);
  // }, [user?._id, isTracking, refreshData]);

  // Debug: Log when return values change (DISABLED to reduce console spam)
  // useEffect(() => {
  //   console.log('[useAppData] State changed:', {
  //     reportsCount: reports.length,
  //     gasStationsCount: gasStations.length,
  //     motorsCount: motors.length,
  //     loading,
  //     hasError: !!error,
  //   });
  // }, [reports, gasStations, motors, loading, error]);

  return {
    reports,
    gasStations,
    motors,
    loading,
    error,
    refreshData,
  };
};
