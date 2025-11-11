// Shared data manager for HomeScreen and RouteSelectionScreenOptimized
// Prevents duplicate data fetching and provides centralized caching

import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

const API_BASE = "https://ts-backend-1-jyit.onrender.com";

interface SharedDataCache {
  motors: any[];
  trips: any[];
  destinations: any[];
  fuelLogs: any[];
  maintenanceRecords: any[];
  gasStations: any[];
  combinedFuelData: any[];
  timestamp: number;
}

interface DataManagerOptions {
  userId: string;
  cacheExpiry?: number; // in milliseconds, default 5 minutes
  autoRefresh?: boolean;
  refreshInterval?: number; // in milliseconds, default 30 seconds
}

class SharedDataManager {
  private cache: Map<string, SharedDataCache> = new Map();
  private refreshIntervals: Map<string, NodeJS.Timeout> = new Map();
  private isFetching: Map<string, boolean> = new Map();
  private abortControllers: Map<string, AbortController> = new Map();
  private retryQueues: Map<string, Set<string>> = new Map(); // Track which endpoints failed and need retry
  private backendAvailable: boolean = true; // Track backend availability
  private lastBackendCheck: number = 0; // Last time we checked backend status

  // Helper function to retry a request with exponential backoff for 503 errors
  private async retryRequest<T>(
    requestFn: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<T> {
    let lastError: any;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const result = await requestFn();
        // If successful and we had a retry, backend is back online
        if (attempt > 0) {
          this.backendAvailable = true;
          if (__DEV__) {
            console.log('[SharedDataManager] Backend recovered after retry');
          }
        }
        return result;
      } catch (error: any) {
        lastError = error;
        
        // Only retry on 503 (Service Unavailable) or network errors
        const status = error.response?.status;
        const isRetryable = status === 503 || 
                           status === 429 || // Too Many Requests
                           status === 408 || // Request Timeout
                           error.code === 'ECONNREFUSED' ||
                           error.code === 'ETIMEDOUT' ||
                           error.message?.includes('timeout') ||
                           error.message?.includes('Network Error');
        
        if (!isRetryable || attempt === maxRetries - 1) {
          // Not retryable or last attempt, throw error
          if (status === 503 && attempt === maxRetries - 1) {
            this.backendAvailable = false;
            this.lastBackendCheck = Date.now();
          }
          throw error;
        }
        
        // Exponential backoff: 1s, 2s, 4s
        const delay = baseDelay * Math.pow(2, attempt);
        
        if (__DEV__) {
          console.log(`[SharedDataManager] Retrying after ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
        }
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError;
  }

  // Check if backend is available by making a lightweight health check
  async checkBackendHealth(): Promise<boolean> {
    const now = Date.now();
    // Don't check more than once every 30 seconds
    if (now - this.lastBackendCheck < 30000) {
      return this.backendAvailable;
    }
    
    try {
      this.lastBackendCheck = now;
      const response = await axios.get(`${API_BASE}/api/health`, { timeout: 5000 });
      this.backendAvailable = response.status === 200;
      return this.backendAvailable;
    } catch (error) {
      // If health check fails, assume backend is down
      this.backendAvailable = false;
      return false;
    }
  }

  // Get cached data if available and not expired
  async getCachedData(userId: string, cacheExpiry: number = 5 * 60 * 1000): Promise<SharedDataCache | null> {
    try {
      const cacheKey = `sharedData_${userId}`;
      const cachedDataStr = await AsyncStorage.getItem(cacheKey);
      const cachedData = cachedDataStr ? JSON.parse(cachedDataStr) : null;
      
      if (cachedData) {
        if (__DEV__) {
          console.log('[SharedDataManager] Using cached data for user:', userId);
        }
        return cachedData;
      }
    } catch (error) {
      console.error('[SharedDataManager] Error getting cached data:', error);
    }
    return null;
  }

  // Fetch all data for a user
  async fetchAllData(userId: string, forceRefresh = false): Promise<SharedDataCache> {
    const cacheKey = `sharedData_${userId}`;
    
    // Check if already fetching
    if (this.isFetching.get(cacheKey)) {
      console.log('[SharedDataManager] Already fetching for user:', userId);
      // Wait for current fetch to complete
      return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          if (!this.isFetching.get(cacheKey)) {
            clearInterval(checkInterval);
            this.getCachedData(userId).then(resolve);
          }
        }, 100);
      });
    }

    // Check cache first if not forcing refresh
    if (!forceRefresh) {
      const cached = await this.getCachedData(userId);
      if (cached) {
        return cached;
      }
    }

    this.isFetching.set(cacheKey, true);
    
    // Cancel any previous request
    if (this.abortControllers.has(cacheKey)) {
      this.abortControllers.get(cacheKey)?.abort();
    }
    
    // Create new abort controller
    const abortController = new AbortController();
    this.abortControllers.set(cacheKey, abortController);

    try {
      console.log('[SharedDataManager] Fetching data for user:', userId);
      
      // Get authentication token from AsyncStorage (stored by AuthContext)
      let authToken: string | null = null;
      try {
        authToken = await AsyncStorage.getItem('token');
      } catch (tokenError) {
        console.warn('[SharedDataManager] Failed to get token from AsyncStorage:', tokenError);
      }
      
      // Prepare headers with authorization if token is available
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }
      
      // Helper to create a retryable request with proper error handling
      const createRetryableRequest = (url: string, endpointName: string) => {
        return this.retryRequest(
          () => axios.get(url, { 
            headers,
            signal: abortController.signal,
            timeout: 10000
          }),
          3, // max 3 retries
          1000 // base delay 1 second
        ).catch((error) => {
          const status = error.response?.status;
          
          // Only log in development for 503 errors (expected on free tier)
          if (__DEV__) {
            if (status === 503) {
              console.warn(`[SharedDataManager] ${endpointName} returned 503 (Service Unavailable). Using cached data.`);
            } else {
              console.warn(`[SharedDataManager] Failed to fetch ${endpointName}:`, status || error.message);
            }
          }
          
          // Track failed endpoints for retry later
          if (status === 503) {
            if (!this.retryQueues.has(cacheKey)) {
              this.retryQueues.set(cacheKey, new Set());
            }
            this.retryQueues.get(cacheKey)?.add(endpointName);
          }
          
          return { data: [] };
        });
      };

      // Fetch all data in parallel with retry logic for 503 errors
      const [motorsRes, tripsRes, destinationsRes, logsRes, maintenanceRes, gasRes] = await Promise.all([
        createRetryableRequest(`${API_BASE}/api/user-motors/user/${userId}`, 'motors'),
        createRetryableRequest(`${API_BASE}/api/trips/user/${userId}`, 'trips'),
        createRetryableRequest(`${API_BASE}/api/saved-destinations/${userId}`, 'destinations'),
        createRetryableRequest(`${API_BASE}/api/fuel-logs/${userId}`, 'fuel logs'),
        createRetryableRequest(`${API_BASE}/api/maintenance-records/user/${userId}`, 'maintenance'),
        createRetryableRequest(`${API_BASE}/api/gas-stations`, 'gas stations'),
      ]);

      // Helper function to limit array size to prevent memory issues
      const limitArraySize = (arr: any[], maxSize: number = 500): any[] => {
        if (!Array.isArray(arr)) return [];
        return arr.length > maxSize ? arr.slice(0, maxSize) : arr;
      };

      // Process and sort data with size limits
      // Handle different response formats: array directly, or wrapped in object
      const motorsData = motorsRes.data || [];
      const motorsArray = Array.isArray(motorsData) 
        ? motorsData 
        : (motorsData.motors || motorsData.data || []);
      const motors = limitArraySize(motorsArray, 500); // Limit to 500 motors
      
      if (__DEV__) {
        if (motors.length > 0) {
          console.log(`[SharedDataManager] Successfully fetched ${motors.length} motors for user ${userId}`);
        } else {
          console.warn(`[SharedDataManager] No motors found for user ${userId}`);
        }
      }
      
      const tripsData = tripsRes.data || [];
      const trips = limitArraySize(
        Array.isArray(tripsData) ? tripsData : [],
        500
      ).sort(
        (a: any, b: any) => new Date(b.tripStartTime || b.date || 0).getTime() - new Date(a.tripStartTime || a.date || 0).getTime()
      );
      
      const destinations = limitArraySize(destinationsRes.data || [], 500);
      
      const fuelLogs = limitArraySize(
        logsRes.data || [],
        500
      ).sort(
        (a: any, b: any) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()
      );
      
      const maintenanceRecords = limitArraySize(
        maintenanceRes.data || [],
        500
      ).sort(
        (a: any, b: any) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime()
      );
      
      // Gas stations might be global, so limit but don't restrict as much
      const gasStations = limitArraySize(gasRes.data || [], 1000); // Allow more for global data

      // Get combined fuel data from API endpoint instead of processing locally
      // Uses: GET /api/fuel/combined?userId=user_id
      // NOTE: If endpoint doesn't exist (404), falls back to empty array
      // Frontend will handle combining fuel logs and maintenance records if needed
      let combinedFuelData: any[] = [];
      try {
        const combinedFuelRes = await this.retryRequest(
          () => axios.get(`${API_BASE}/api/fuel/combined?userId=${userId}`, { 
            headers,
            signal: abortController.signal,
            timeout: 10000
          }),
          2, // Only 2 retries for combined endpoint (less critical)
          1000
        ).catch((error) => {
          // Silently handle 404 (endpoint doesn't exist) - expected in some cases
          if (error.response?.status === 404) {
            if (__DEV__) {
              console.warn('[SharedDataManager] /api/fuel/combined endpoint not available (404). Using empty array - frontend will combine if needed.');
            }
          } else if (error.response?.status === 503 && __DEV__) {
            // Only log 503 in development
            console.warn('[SharedDataManager] Combined fuel data endpoint returned 503. Frontend will combine locally.');
          }
          return { data: null };
        });
        
        if (combinedFuelRes?.data) {
          // Handle different response formats
          combinedFuelData = combinedFuelRes.data.combinedData || combinedFuelRes.data.fuelLogs || combinedFuelRes.data || [];
        } else {
          // Endpoint doesn't exist or returned no data - use empty array
          // Frontend will handle combining fuel logs with maintenance records if needed
          combinedFuelData = [];
        }
      } catch (error: any) {
        // Silently handle errors - frontend will combine if needed
        if (error.name !== 'AbortError' && __DEV__ && error.response?.status !== 503) {
          console.warn('[SharedDataManager] Failed to fetch combined fuel data from API, using empty array:', error.message || error);
        }
        combinedFuelData = [];
      }

      const data: SharedDataCache = {
        motors,
        trips,
        destinations,
        fuelLogs,
        maintenanceRecords,
        gasStations,
        combinedFuelData,
        timestamp: Date.now()
      };

      // Cache the data using standardized cache manager
      await Promise.all([
        AsyncStorage.setItem(cacheKey, JSON.stringify(data)),
        AsyncStorage.setItem(`motors_${userId}`, JSON.stringify(motors)),
        AsyncStorage.setItem(`trips_${userId}`, JSON.stringify(trips)),
        AsyncStorage.setItem(`destinations_${userId}`, JSON.stringify(destinations)),
        AsyncStorage.setItem(`fuelLogs_${userId}`, JSON.stringify(fuelLogs)),
        AsyncStorage.setItem(`maintenance_${userId}`, JSON.stringify(maintenanceRecords)),
        AsyncStorage.setItem(`gasStations_${userId}`, JSON.stringify(gasStations)),
      ]);

      this.cache.set(cacheKey, data);
      if (__DEV__) {
        console.log('[SharedDataManager] Data fetched and cached successfully for user:', userId);
      }
      
      return data;
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('[SharedDataManager] Request aborted for user:', userId);
        throw error;
      }
      console.error('[SharedDataManager] Error fetching data:', error);
      throw error;
    } finally {
      this.isFetching.set(cacheKey, false);
      this.abortControllers.delete(cacheKey);
    }
  }

  // Start auto-refresh for a user
  startAutoRefresh(userId: string, refreshInterval: number = 30000) {
    const cacheKey = `sharedData_${userId}`;
    
    // Clear existing interval
    if (this.refreshIntervals.has(cacheKey)) {
      clearInterval(this.refreshIntervals.get(cacheKey)!);
    }
    
    // Start new interval with smart retry logic
    const interval = setInterval(() => {
      // Check if backend is available before attempting refresh
      this.checkBackendHealth().then(isAvailable => {
        if (isAvailable || !this.backendAvailable) {
          // Backend is available, or we should check if it recovered
          if (__DEV__) {
            console.log('[SharedDataManager] Auto-refresh for user:', userId);
          }
          this.fetchAllData(userId, false).catch(error => {
            // Only log in development, ignore 503 errors (expected)
            if (__DEV__ && error.name !== 'AbortError' && error.response?.status !== 503) {
              console.error('[SharedDataManager] Auto-refresh failed:', error);
            }
          });
        } else {
          // Backend is down, skip refresh to avoid unnecessary requests
          if (__DEV__) {
            console.log('[SharedDataManager] Skipping auto-refresh - backend unavailable');
          }
        }
      });
    }, refreshInterval);
    
    this.refreshIntervals.set(cacheKey, interval);
  }
  
  // Retry failed requests when backend comes back online
  async retryFailedRequests(userId: string): Promise<void> {
    const cacheKey = `sharedData_${userId}`;
    const failedEndpoints = this.retryQueues.get(cacheKey);
    
    if (!failedEndpoints || failedEndpoints.size === 0) {
      return; // No failed requests to retry
    }
    
    // Check if backend is available
    const isAvailable = await this.checkBackendHealth();
    if (!isAvailable) {
      if (__DEV__) {
        console.log('[SharedDataManager] Backend still unavailable, will retry later');
      }
      return;
    }
    
    // Backend is available, clear retry queue and fetch fresh data
    this.retryQueues.delete(cacheKey);
    try {
      await this.fetchAllData(userId, true); // Force refresh
      if (__DEV__) {
        console.log('[SharedDataManager] Successfully retried failed requests');
      }
    } catch (error) {
      // If retry fails, re-add to queue
      if (__DEV__ && error.response?.status === 503) {
        console.warn('[SharedDataManager] Retry failed, backend may be down again');
      }
    }
  }
  
  // Get backend availability status
  isBackendAvailable(): boolean {
    return this.backendAvailable;
  }

  // Stop auto-refresh for a user
  stopAutoRefresh(userId: string) {
    const cacheKey = `sharedData_${userId}`;
    const interval = this.refreshIntervals.get(cacheKey);
    
    if (interval) {
      clearInterval(interval);
      this.refreshIntervals.delete(cacheKey);
    }
  }

  // Clear cache for a user
  async clearCache(userId: string) {
    const cacheKey = `sharedData_${userId}`;
    
    try {
      await AsyncStorage.multiRemove([
        cacheKey,
        `${cacheKey}_timestamp`,
        `cachedMotors_${userId}`,
        `cachedTrips_${userId}`,
        `cachedDestinations_${userId}`,
        `cachedFuelLogs_${userId}`,
        `cachedMaintenance_${userId}`,
        `cachedGasStations_${userId}`,
      ]);
      
      this.cache.delete(cacheKey);
      if (__DEV__) {
        console.log('[SharedDataManager] Cache cleared for user:', userId);
      }
    } catch (error) {
      console.error('[SharedDataManager] Error clearing cache:', error);
    }
  }

  // Invalidate cache for a user (force next fetch to be fresh)
  async invalidateCache(userId: string) {
    try {
      const cacheKey = `sharedData_${userId}`;
      await AsyncStorage.removeItem(cacheKey);
      this.cache.delete(cacheKey);
      if (__DEV__) {
        console.log('[SharedDataManager] Cache invalidated for user:', userId);
      }
    } catch (error) {
      console.error('[SharedDataManager] Error invalidating cache:', error);
    }
  }

  // Cleanup all resources
  cleanup() {
    // Clear all intervals
    this.refreshIntervals.forEach(interval => clearInterval(interval));
    this.refreshIntervals.clear();
    
    // Abort all requests
    this.abortControllers.forEach(controller => controller.abort());
    this.abortControllers.clear();
    
    // Clear cache
    this.cache.clear();
    this.isFetching.clear();
    this.retryQueues.clear();
    this.backendAvailable = true;
    this.lastBackendCheck = 0;
  }
}

// Export singleton instance
export const sharedDataManager = new SharedDataManager();
export default sharedDataManager;
