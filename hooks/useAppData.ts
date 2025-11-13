// Custom hook for app data management

import { useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchReports, fetchGasStations, fetchUserMotors } from '../utils/api';
import { getAggregatedCachedData as getAggregatedCachedDataService } from '../services/dataService';
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
  mapRegion?: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  };
  reportFilters?: {
    types?: string[];
    status?: string[];
  };
  includeArchived?: boolean;
  includeInvalid?: boolean;
}

interface UseAppDataReturn {
  reports: TrafficReport[];
  gasStations: GasStation[];
  motors: Motor[];
  error: string | null;
  networkError: boolean;
  isOffline: boolean;
  refreshData: () => Promise<void>;
  retryFailedRequests: () => Promise<void>;
}

export const useAppData = ({ 
  user, 
  isTracking = false,
  mapRegion,
  reportFilters,
  includeArchived = false,
  includeInvalid = false,
}: UseAppDataProps): UseAppDataReturn => {
  const [reports, setReports] = useState<TrafficReport[]>([]);
  const [gasStations, setGasStations] = useState<GasStation[]>([]);
  const [motors, setMotors] = useState<Motor[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [networkError, setNetworkError] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [failedRequests, setFailedRequests] = useState<{
    reports: boolean;
    gasStations: boolean;
    motors: boolean;
  }>({
    reports: false,
    gasStations: false,
    motors: false,
  });

  const abortControllerRef = useRef<AbortController | null>(null);
  const {
    cachedReports,
    cachedGasStations,
    cachedMotors,
    updateCachedReports,
    updateCachedGasStations,
    updateCachedMotors,
  } = useUser();

  // Network error detection helper
  const isNetworkError = useCallback((error: any): boolean => {
    if (!error) return false;
    
    const errorMessage = error.message?.toLowerCase() || '';
    const errorName = error.name?.toLowerCase() || '';
    
    return (
      errorName === 'networkerror' ||
      errorName === 'typeerror' ||
      errorMessage.includes('network request failed') ||
      errorMessage.includes('fetch failed') ||
      errorMessage.includes('connection failed') ||
      errorMessage.includes('timeout') ||
      errorMessage.includes('no internet') ||
      errorMessage.includes('offline') ||
      error.code === 'NETWORK_ERROR' ||
      error.code === 'TIMEOUT' ||
      error.status === 0 || // Network error status
      error.status === -1   // Network error status
    );
  }, []);

  // Check if device is offline (non-blocking, used as hint only)
  // OPTIMIZED: Reduced timeout to 1 second and made it truly non-blocking
  const checkOfflineStatus = useCallback(async () => {
    try {
      // Create an AbortController for timeout (very short timeout to avoid blocking)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1000); // Reduced to 1 second
      
      // Try a simple fetch to check connectivity
      const response = await fetch(`https://ts-backend-1-jyit.onrender.com/api/health`, {
        method: 'HEAD',
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      // Only mark as offline if explicitly not OK, otherwise assume online
      const isOffline = !response.ok;
      setIsOffline(isOffline);
      return isOffline;
    } catch (error) {
      // Don't immediately mark as offline on error - might be network hiccup
      // Only mark as offline if it's a clear network error, not timeout/abort
      if (error.name === 'AbortError' || error.message?.includes('timeout')) {
        // Timeout/abort - backend might be slow, but we're still online
        setIsOffline(false);
        return false;
      }
      
      // For other errors, assume we're still online (will retry actual API calls)
      setIsOffline(false);
      return false;
    }
  }, []);

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
        AsyncStorage.setItem(`reports_${userId}`, JSON.stringify(data.reports)),
        AsyncStorage.setItem(`gasStations_${userId}`, JSON.stringify(data.gasStations)),
        AsyncStorage.setItem(`motors_${userId}`, JSON.stringify(data.motors)),
      ]);
      console.log('[useAppData] Data saved to cache using standardized keys');
    } catch (err) {
      console.warn('Failed to save to cache:', err);
    }
  }, []);

  // Fetch data from API with fallback to cache
  // OPTIMIZED: Don't wait for health check - start fetching immediately
  const fetchData = useCallback(async (userId: string, signal?: AbortSignal) => {
    if (__DEV__) {
      console.log('[useAppData] 🔄 Fetching data from API...', {
        userId,
        hasSignal: !!signal,
        timestamp: new Date().toISOString(),
      });
    }

    // Reset error states at start of fetch
    setError(null);
    setNetworkError(false);
    setFailedRequests({ reports: false, gasStations: false, motors: false });

    // OPTIMIZED: Check offline status in background (non-blocking)
    // Don't wait for it - start fetching immediately
    checkOfflineStatus().catch(() => {
      // Silent failure - health check is just a hint
    });

    try {

      // Build viewport from map region if available
      let viewport: { north: number; south: number; east: number; west: number } | undefined;
      if (mapRegion) {
        viewport = {
          north: mapRegion.latitude + mapRegion.latitudeDelta / 2,
          south: mapRegion.latitude - mapRegion.latitudeDelta / 2,
          east: mapRegion.longitude + mapRegion.longitudeDelta / 2,
          west: mapRegion.longitude - mapRegion.longitudeDelta / 2,
        };
      }

      // Build filters object
      const filters = reportFilters && (reportFilters.types || reportFilters.status)
        ? {
            types: reportFilters.types,
            status: reportFilters.status,
          }
        : undefined;

      // Fetch all data in parallel from API
      const [reportsResult, gasStationsResult, motorsResult] = await Promise.allSettled([
        fetchReports({
          signal,
          includeArchived,
          includeInvalid,
          filters,
          viewport,
        }),
        fetchGasStations(signal),
        fetchUserMotors(userId, signal),
      ]);

      // Process reports
      if (reportsResult.status === 'fulfilled') {
        const reportsData = reportsResult.value || [];
        setReports(reportsData);
        updateCachedReports(reportsData);
        // Save to AsyncStorage
        await AsyncStorage.setItem(`cachedReports_${userId}`, JSON.stringify(reportsData));
        if (__DEV__) {
          console.log('[useAppData] ✅ Reports fetched successfully:', reportsData.length);
        }
      } else {
        const reportsError = reportsResult.reason;
        setFailedRequests(prev => ({ ...prev, reports: true }));
        if (isNetworkError(reportsError)) {
          setNetworkError(true);
          if (__DEV__) {
            console.warn('[useAppData] ❌ Network error fetching reports:', reportsError);
          }
        } else {
          if (__DEV__) {
            console.warn('[useAppData] ❌ Error fetching reports:', reportsError);
          }
        }
        // Load from cache as fallback
        try {
          const cachedStr = await AsyncStorage.getItem(`cachedReports_${userId}`);
          if (cachedStr) {
            const cached = JSON.parse(cachedStr);
            setReports(cached);
            updateCachedReports(cached);
            if (__DEV__) {
              console.log('[useAppData] 📦 Loaded reports from cache (fallback)');
            }
          }
        } catch (cacheError) {
          if (__DEV__) {
            console.warn('[useAppData] Failed to load cached reports:', cacheError);
          }
        }
      }

      // Process gas stations
      if (gasStationsResult.status === 'fulfilled') {
        const gasStationsData = gasStationsResult.value || [];
        setGasStations(gasStationsData);
        updateCachedGasStations(gasStationsData);
        // Save to AsyncStorage
        await AsyncStorage.setItem(`cachedGasStations_${userId}`, JSON.stringify(gasStationsData));
        if (__DEV__) {
          console.log('[useAppData] ✅ Gas stations fetched successfully:', gasStationsData.length);
        }
      } else {
        const gasStationsError = gasStationsResult.reason;
        setFailedRequests(prev => ({ ...prev, gasStations: true }));
        if (isNetworkError(gasStationsError)) {
          setNetworkError(true);
          if (__DEV__) {
            console.warn('[useAppData] ❌ Network error fetching gas stations:', gasStationsError);
          }
        } else {
          if (__DEV__) {
            console.warn('[useAppData] ❌ Error fetching gas stations:', gasStationsError);
          }
        }
        // Load from cache as fallback
        try {
          const cachedStr = await AsyncStorage.getItem(`cachedGasStations_${userId}`);
          if (cachedStr) {
            const cached = JSON.parse(cachedStr);
            setGasStations(cached);
            updateCachedGasStations(cached);
            if (__DEV__) {
              console.log('[useAppData] 📦 Loaded gas stations from cache (fallback)');
            }
          }
        } catch (cacheError) {
          if (__DEV__) {
            console.warn('[useAppData] Failed to load cached gas stations:', cacheError);
          }
        }
      }

      // Process motors
      if (motorsResult.status === 'fulfilled') {
        const motorsData = motorsResult.value || [];
        setMotors(motorsData);
        updateCachedMotors(motorsData);
        // Save to AsyncStorage
        await AsyncStorage.setItem(`cachedMotors_${userId}`, JSON.stringify(motorsData));
        if (__DEV__) {
          console.log('[useAppData] ✅ Motors fetched successfully:', motorsData.length);
        }
      } else {
        const motorsError = motorsResult.reason;
        setFailedRequests(prev => ({ ...prev, motors: true }));
        if (isNetworkError(motorsError)) {
          setNetworkError(true);
          if (__DEV__) {
            console.warn('[useAppData] ❌ Network error fetching motors:', motorsError);
          }
        } else {
          if (__DEV__) {
            console.warn('[useAppData] ❌ Error fetching motors:', motorsError);
          }
        }
        // Load from cache as fallback
        try {
          const cachedStr = await AsyncStorage.getItem(`cachedMotors_${userId}`);
          if (cachedStr) {
            const cached = JSON.parse(cachedStr);
            if (Array.isArray(cached)) {
              setMotors(cached);
              updateCachedMotors(cached);
              if (__DEV__) {
                console.log('[useAppData] 📦 Loaded motors from cache (fallback)');
              }
            }
          }
        } catch (cacheError) {
          if (__DEV__) {
            console.warn('[useAppData] Failed to load cached motors:', cacheError);
          }
        }
      }

      // Set error state if all requests failed
      const allFailed = 
        reportsResult.status === 'rejected' &&
        gasStationsResult.status === 'rejected' &&
        motorsResult.status === 'rejected';
      
      if (allFailed) {
        setError('Failed to fetch data. Using cached data if available.');
      }

      // Save combined data to cache
      try {
        const currentReports = reportsResult.status === 'fulfilled' ? reportsResult.value : [];
        const currentGasStations = gasStationsResult.status === 'fulfilled' ? gasStationsResult.value : [];
        const currentMotors = motorsResult.status === 'fulfilled' ? motorsResult.value : [];
        
        await saveToCache(userId, {
          reports: currentReports || [],
          gasStations: currentGasStations || [],
          motors: currentMotors || [],
        });
      } catch (cacheError) {
        if (__DEV__) {
          console.warn('[useAppData] Failed to save to cache:', cacheError);
        }
      }

      if (__DEV__) {
        const fetchedReports = reportsResult.status === 'fulfilled' ? reportsResult.value : [];
        const fetchedGasStations = gasStationsResult.status === 'fulfilled' ? gasStationsResult.value : [];
        const fetchedMotors = motorsResult.status === 'fulfilled' ? motorsResult.value : [];
        
        console.log('[useAppData] ✅ Data fetch completed', {
          reportsCount: fetchedReports.length,
          gasStationsCount: fetchedGasStations.length,
          motorsCount: fetchedMotors.length,
          hasErrors: allFailed,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error: any) {
      // Handle abort errors gracefully
      if (error.name === 'AbortError' || signal?.aborted) {
        if (__DEV__) {
          console.log('[useAppData] Request aborted');
        }
        return;
      }

      // General error handling
      if (__DEV__) {
        console.error('[useAppData] ❌ Critical error in fetchData:', error);
      }

      setError(error.message || 'Failed to fetch data');
      if (isNetworkError(error)) {
        setNetworkError(true);
        setIsOffline(true);
      }

      // Load from cache as last resort
      try {
        await loadCachedData(userId);
        if (__DEV__) {
          console.log('[useAppData] 📦 Loaded all data from cache (error fallback)');
        }
      } catch (cacheError) {
        if (__DEV__) {
          console.warn('[useAppData] Failed to load cached data:', cacheError);
        }
      }
    }
  }, [mapRegion, reportFilters, includeArchived, includeInvalid, saveToCache, updateCachedReports, updateCachedGasStations, updateCachedMotors, isNetworkError, checkOfflineStatus, loadCachedData]);

  const refreshData = useCallback(async (refreshOptions?: {
    mapRegion?: {
      latitude: number;
      longitude: number;
      latitudeDelta: number;
      longitudeDelta: number;
    };
    reportFilters?: {
      types?: string[];
      status?: string[];
    };
  }) => {
    if (!user?._id) return;
    
    // Cancel any ongoing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller
    abortControllerRef.current = new AbortController();

    await fetchData(user._id, abortControllerRef.current.signal, refreshOptions);
  }, [user?._id, fetchData, mapRegion, reportFilters]);

  // Retry failed requests function
  const retryFailedRequests = useCallback(async () => {
    if (!user?._id) return;
    
    console.log('[useAppData] Retrying failed requests:', failedRequests);
    
    // Reset error states
    setError(null);
    setNetworkError(false);
    setIsOffline(false);
    
    // Cancel any ongoing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller
    abortControllerRef.current = new AbortController();

    // Retry the data fetch with current map region and filters
    await fetchData(user._id, abortControllerRef.current.signal, {
      mapRegion,
      reportFilters,
    });
  }, [user?._id, fetchData, failedRequests, mapRegion, reportFilters]);

  // Initial load - use GLOBAL Map to survive unmount/remount
  useEffect(() => {
    if (!user?._id) return;

    // Check if we already initialized this session
    const hasInitialized = globalHasInitialized.get(user._id);
    if (hasInitialized) {
      if (__DEV__) {
        console.log('[useAppData] Already initialized for user:', user._id, '- using cached data');
      }
      // Don't fetch again if already initialized - just use cached data
      // This prevents constant refreshing
      loadCachedData(user._id).catch(() => {
        // Silent failure - cached data might not exist
      });
      return;
    }

    const initializeData = async () => {
      console.log('[useAppData] INITIALIZING for user:', user._id);
      globalHasInitialized.set(user._id, true);

      // OPTIMIZED: Load cached data first (synchronous for immediate display)
      // This shows data immediately without waiting
      loadCachedData(user._id).catch(() => {
        // Silent failure - cached data might not exist
      });

      // OPTIMIZED: Fetch fresh data in background (non-blocking)
      // Don't await - let it run in background while UI shows cached data
      // This makes the UI appear instantly while data refreshes
      refreshData().catch((error) => {
        if (__DEV__) {
          console.warn('[useAppData] Background fetch failed:', error);
        }
        // Silent failure - cached data is already shown
      });

      // If we loaded motors from cache, mark as loaded to skip future fetches
      // Do this in background too (non-blocking)
      AsyncStorage.getItem(`cachedMotors_${user._id}`).then((cachedMotorsStr) => {
        if (cachedMotorsStr) {
          try {
            const parsed = JSON.parse(cachedMotorsStr);
            if (Array.isArray(parsed) && parsed.length > 0) {
              globalHasLoadedMotors.set(user._id, true);
              if (__DEV__) {
                console.log('[useAppData] Found cached motors, marking as loaded');
              }
            }
          } catch (e) {
            if (__DEV__) {
              console.warn('[useAppData] Failed to parse cached motors:', e);
            }
          }
        }
      }).catch(() => {
        // Silent failure
      });
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
    error,
    networkError,
    isOffline,
    refreshData,
    retryFailedRequests,
  };
};
