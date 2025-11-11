// Async data manager for RouteSelectionScreenOptimized.tsx
// Handles all data fetching operations asynchronously without blocking UI

import { runAsyncOperation, batchAsyncOperations, createBackgroundDataFetcher, safeAsyncStorage } from './asyncOperations';
import { LOCALHOST_IP } from '@env';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = `http://${LOCALHOST_IP}:3000`;

export interface DataFetchResult<T> {
  data: T | null;
  error: Error | null;
  success: boolean;
  fromCache: boolean;
  timestamp: number;
}

export interface DataManagerOptions {
  enableCaching?: boolean;
  cacheDuration?: number;
  retries?: number;
  timeout?: number;
}

class AsyncDataManager {
  private cache = new Map<string, { data: any; timestamp: number }>();
  private options: DataManagerOptions;
  
  constructor(options: DataManagerOptions = {}) {
    this.options = {
      enableCaching: true,
      cacheDuration: 5 * 60 * 1000, // 5 minutes
      retries: 3,
      timeout: 30000,
      ...options,
    };
  }

  /**
   * Fetch data with caching and error handling
   */
  async fetchData<T>(
    key: string,
    fetchFunction: () => Promise<T>,
    options: Partial<DataManagerOptions> = {}
  ): Promise<DataFetchResult<T>> {
    const config = { ...this.options, ...options };
    const cacheKey = `data_${key}`;
    const now = Date.now();
    
    // Check cache first
    if (config.enableCaching) {
      const cached = this.cache.get(cacheKey);
      if (cached && (now - cached.timestamp) < (config.cacheDuration || 0)) {
        return {
          data: cached.data,
          error: null,
          success: true,
          fromCache: true,
          timestamp: cached.timestamp,
        };
      }
    }

    // Fetch from API
    const result = await runAsyncOperation(fetchFunction, {
      priority: 'normal',
      timeout: config.timeout,
      retries: config.retries,
    });

    // Update cache on success
    if (result.success && result.data && config.enableCaching) {
      this.cache.set(cacheKey, {
        data: result.data,
        timestamp: now,
      });
    }

    return {
      data: result.data,
      error: result.error,
      success: result.success,
      fromCache: false,
      timestamp: now,
    };
  }

  /**
   * Fetch multiple data sources in parallel
   */
  async fetchMultipleData<T extends Record<string, any>>(
    dataSources: { [K in keyof T]: () => Promise<T[K]> },
    options: Partial<DataManagerOptions> = {}
  ): Promise<{ [K in keyof T]: DataFetchResult<T[K]> }> {
    const results = await batchAsyncOperations(
      Object.values(dataSources),
      {
        priority: 'normal',
        timeout: options.timeout || this.options.timeout,
        retries: options.retries || this.options.retries,
      }
    );

    const dataKeys = Object.keys(dataSources) as Array<keyof T>;
    const resultData = results.data || [];
    
    const finalResults = {} as { [K in keyof T]: DataFetchResult<T[K]> };
    
    dataKeys.forEach((key, index) => {
      finalResults[key] = {
        data: resultData[index] || null,
        error: results.error,
        success: results.success,
        fromCache: false,
        timestamp: Date.now(),
      };
    });

    return finalResults;
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Clear expired cache entries
   */
  clearExpiredCache(): void {
    const now = Date.now();
    const cacheDuration = this.options.cacheDuration || 0;
    
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > cacheDuration) {
        this.cache.delete(key);
      }
    }
  }
}

// Create singleton instance
export const dataManager = new AsyncDataManager();

// Helper function to get auth headers
const getAuthHeaders = async (): Promise<Record<string, string>> => {
  try {
    const token = await AsyncStorage.getItem('token');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  } catch (error) {
    if (__DEV__) {
      console.warn('[AsyncDataManager] Failed to get token:', error);
    }
    return { 'Content-Type': 'application/json' };
  }
};

// Specific data fetching functions for RouteSelectionScreenOptimized
export const fetchMotorsData = async (userId: string): Promise<any[]> => {
  const result = await dataManager.fetchData(
    `motors_${userId}`,
    async () => {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/api/user-motors/user/${userId}`, {
        headers,
      });
      if (!response.ok) {
        // Suppress auth errors - only log in dev
        if (response.status === 401 && __DEV__) {
          console.warn('[AsyncDataManager] Authentication required for motors fetch');
        }
        throw new Error('Failed to fetch motors');
      }
      return response.json();
    }
  );
  return result.data || [];
};

export const fetchReportsData = async (): Promise<any[]> => {
  const result = await dataManager.fetchData(
    'reports',
    async () => {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/api/traffic-reports`, {
        headers,
      });
      if (!response.ok) {
        if (response.status === 401 && __DEV__) {
          console.warn('[AsyncDataManager] Authentication required for reports fetch');
        }
        throw new Error('Failed to fetch reports');
      }
      return response.json();
    }
  );
  return result.data || [];
};

export const fetchGasStationsData = async (): Promise<any[]> => {
  const result = await dataManager.fetchData(
    'gas_stations',
    async () => {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/api/gas-stations`, {
        headers,
      });
      if (!response.ok) {
        if (response.status === 401 && __DEV__) {
          console.warn('[AsyncDataManager] Authentication required for gas stations fetch');
        }
        throw new Error('Failed to fetch gas stations');
      }
      return response.json();
    }
  );
  return result.data || [];
};

export const fetchTripsData = async (userId: string): Promise<any[]> => {
  const result = await dataManager.fetchData(
    `trips_${userId}`,
    async () => {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/api/trips/user/${userId}`, {
        headers,
      });
      if (!response.ok) {
        if (response.status === 401 && __DEV__) {
          console.warn('[AsyncDataManager] Authentication required for trips fetch');
        }
        throw new Error('Failed to fetch trips');
      }
      return response.json();
    }
  );
  return result.data || [];
};

export const fetchDestinationsData = async (userId: string): Promise<any[]> => {
  const result = await dataManager.fetchData(
    `destinations_${userId}`,
    async () => {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/api/saved-destinations/${userId}`, {
        headers,
      });
      if (!response.ok) {
        if (response.status === 401 && __DEV__) {
          console.warn('[AsyncDataManager] Authentication required for destinations fetch');
        }
        throw new Error('Failed to fetch destinations');
      }
      return response.json();
    }
  );
  return result.data || [];
};

export const fetchFuelLogsData = async (userId: string): Promise<any[]> => {
  const result = await dataManager.fetchData(
    `fuel_logs_${userId}`,
    async () => {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/api/fuel-logs/${userId}`, {
        headers,
      });
      if (!response.ok) {
        if (response.status === 401 && __DEV__) {
          console.warn('[AsyncDataManager] Authentication required for fuel logs fetch');
        }
        throw new Error('Failed to fetch fuel logs');
      }
      return response.json();
    }
  );
  return result.data || [];
};

export const fetchMaintenanceData = async (userId: string): Promise<any[]> => {
  const result = await dataManager.fetchData(
    `maintenance_${userId}`,
    async () => {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/api/maintenance-records/user/${userId}`, {
        headers,
      });
      if (!response.ok) {
        if (response.status === 401 && __DEV__) {
          console.warn('[AsyncDataManager] Authentication required for maintenance fetch');
        }
        throw new Error('Failed to fetch maintenance records');
      }
      return response.json();
    }
  );
  return result.data || [];
};

/**
 * Fetch all data for RouteSelectionScreenOptimized asynchronously
 */
export const fetchAllRouteSelectionData = async (userId: string) => {
  console.log('[AsyncDataManager] Starting async data fetch for user:', userId);
  
  const dataSources = {
    motors: () => fetchMotorsData(userId),
    reports: () => fetchReportsData(),
    gasStations: () => fetchGasStationsData(),
    trips: () => fetchTripsData(userId),
    destinations: () => fetchDestinationsData(userId),
    fuelLogs: () => fetchFuelLogsData(userId),
    maintenance: () => fetchMaintenanceData(userId),
  };

  const results = await dataManager.fetchMultipleData(dataSources, {
    enableCaching: true,
    cacheDuration: 5 * 60 * 1000, // 5 minutes
    retries: 2,
    timeout: 15000,
  });

  console.log('[AsyncDataManager] Data fetch completed:', {
    motors: results.motors.success ? results.motors.data?.length : 0,
    reports: results.reports.success ? results.reports.data?.length : 0,
    gasStations: results.gasStations.success ? results.gasStations.data?.length : 0,
    trips: results.trips.success ? results.trips.data?.length : 0,
    destinations: results.destinations.success ? results.destinations.data?.length : 0,
    fuelLogs: results.fuelLogs.success ? results.fuelLogs.data?.length : 0,
    maintenance: results.maintenance.success ? results.maintenance.data?.length : 0,
  });

  return results;
};

/**
 * Cache management functions
 */
export const cacheData = async (key: string, data: any): Promise<boolean> => {
  try {
    const cacheKey = `cached_${key}`;
    const serializedData = JSON.stringify({
      data,
      timestamp: Date.now(),
    });
    return await safeAsyncStorage.setItem(cacheKey, serializedData);
  } catch (error) {
    console.warn('[AsyncDataManager] Failed to cache data:', error);
    return false;
  }
};

export const loadCachedData = async (key: string): Promise<any | null> => {
  try {
    const cacheKey = `cached_${key}`;
    const cached = await safeAsyncStorage.getItem(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      // Check if cache is still valid (5 minutes)
      if (Date.now() - parsed.timestamp < 5 * 60 * 1000) {
        return parsed.data;
      }
    }
    return null;
  } catch (error) {
    console.warn('[AsyncDataManager] Failed to load cached data:', error);
    return null;
  }
};

/**
 * Background data refresh
 */
export const createBackgroundRefresh = (userId: string, interval: number = 5 * 60 * 1000) => {
  let intervalId: NodeJS.Timeout;
  
  const start = () => {
    intervalId = setInterval(async () => {
      console.log('[AsyncDataManager] Background refresh started');
      try {
        await fetchAllRouteSelectionData(userId);
        console.log('[AsyncDataManager] Background refresh completed');
      } catch (error) {
        console.warn('[AsyncDataManager] Background refresh failed:', error);
      }
    }, interval);
  };
  
  const stop = () => {
    if (intervalId) {
      clearInterval(intervalId);
    }
  };
  
  return { start, stop };
};

/**
 * Error handling utilities
 */
export const handleDataError = (error: Error, context: string) => {
  console.error(`[AsyncDataManager] Error in ${context}:`, error);
  
  // You can add error reporting, analytics, etc. here
  return {
    message: error.message,
    context,
    timestamp: Date.now(),
  };
};

/**
 * Performance monitoring
 */
export const createPerformanceMonitor = () => {
  const metrics = new Map<string, { start: number; end?: number; duration?: number }>();
  
  const start = (operation: string) => {
    metrics.set(operation, { start: Date.now() });
  };
  
  const end = (operation: string) => {
    const metric = metrics.get(operation);
    if (metric) {
      metric.end = Date.now();
      metric.duration = metric.end - metric.start;
      console.log(`[Performance] ${operation}: ${metric.duration}ms`);
    }
  };
  
  const getMetrics = () => {
    return Array.from(metrics.entries()).map(([operation, metric]) => ({
      operation,
      duration: metric.duration || 0,
    }));
  };
  
  return { start, end, getMetrics };
};
