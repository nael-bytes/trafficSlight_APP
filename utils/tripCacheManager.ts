/**
 * Trip Cache Manager
 * Handles saving and retrieving trip data to prevent data loss during crashes
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LocationCoords, Motor } from '../types';

const TRIP_CACHE_KEY = 'current_trip_data';
const TRIP_BACKUP_KEY = 'trip_backup_data';
const TRIP_HISTORY_KEY = 'trip_history';

export interface TripCacheData {
  // Trip identification
  tripId: string;
  startTime: number;
  lastUpdateTime: number;
  
  // Trip state
  isTracking: boolean;
  screenMode: 'planning' | 'tracking' | 'summary';
  
  // Location data
  currentLocation: LocationCoords | null;
  startLocation: LocationCoords | null;
  endLocation: LocationCoords | null;
  region: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  };
  
  // Motor data
  selectedMotor: Motor | null;
  
  // Trip statistics
  rideStats: {
    distance: number;
    duration: number;
    avgSpeed: number;
    speed: number;
    fuelConsumed: number;
  };
  
  // Route data
  routeCoordinates: LocationCoords[];
  snappedRouteCoordinates: LocationCoords[];
  
  // Addresses
  startAddress: string;
  endAddress: string;
  
  // Maintenance actions during trip
  tripMaintenanceActions: Array<{
    type: 'refuel' | 'oil_change' | 'tune_up';
    timestamp: number;
    cost: number;
    quantity?: number;
    costPerLiter?: number;
    notes: string;
  }>;
  
  // Background tracking
  isBackgroundTracking: boolean;
  backgroundTrackingId: string | null;
  
  // Trip metadata
  tripMetadata: {
    appVersion: string;
    deviceInfo?: string;
    crashRecovery: boolean;
  };
}

class TripCacheManager {
  private static instance: TripCacheManager;
  private cacheUpdateInterval: NodeJS.Timeout | null = null;
  private readonly CACHE_UPDATE_INTERVAL = 10000; // 10 seconds
  private readonly MAX_CACHE_AGE = 24 * 60 * 60 * 1000; // 24 hours

  private constructor() {}

  public static getInstance(): TripCacheManager {
    if (!TripCacheManager.instance) {
      TripCacheManager.instance = new TripCacheManager();
    }
    return TripCacheManager.instance;
  }

  /**
   * Start automatic cache updates
   */
  public startAutoCache(): void {
    if (this.cacheUpdateInterval) {
      clearInterval(this.cacheUpdateInterval);
    }

    this.cacheUpdateInterval = setInterval(async () => {
      try {
        const currentTrip = await this.getCurrentTrip();
        if (currentTrip && currentTrip.isTracking) {
          console.log('[TripCache] Auto-saving trip data...');
          await this.saveTripData(currentTrip);
        }
      } catch (error) {
        console.error('[TripCache] Auto-save failed:', error);
      }
    }, this.CACHE_UPDATE_INTERVAL);
  }

  /**
   * Stop automatic cache updates
   */
  public stopAutoCache(): void {
    if (this.cacheUpdateInterval) {
      clearInterval(this.cacheUpdateInterval);
      this.cacheUpdateInterval = null;
    }
  }

  /**
   * Save trip data to cache
   */
  public async saveTripData(tripData: Partial<TripCacheData>): Promise<void> {
    try {
      const existingTrip = await this.getCurrentTrip();
      const mergedTrip: TripCacheData = {
        ...existingTrip,
        ...tripData,
        lastUpdateTime: Date.now(),
        tripMetadata: {
          ...existingTrip?.tripMetadata,
          ...tripData.tripMetadata,
          appVersion: '1.0.0', // You can get this from package.json
          crashRecovery: true,
        },
      };

      // Save primary cache
      await AsyncStorage.setItem(TRIP_CACHE_KEY, JSON.stringify(mergedTrip));
      
      // Create backup
      await AsyncStorage.setItem(TRIP_BACKUP_KEY, JSON.stringify(mergedTrip));
      
      console.log('[TripCache] Trip data saved:', {
        tripId: mergedTrip.tripId,
        isTracking: mergedTrip.isTracking,
        distance: mergedTrip.rideStats.distance,
        duration: mergedTrip.rideStats.duration,
      });
    } catch (error) {
      console.error('[TripCache] Failed to save trip data:', error);
      throw error;
    }
  }

  /**
   * Get current trip data from cache
   */
  public async getCurrentTrip(): Promise<TripCacheData | null> {
    try {
      const cached = await AsyncStorage.getItem(TRIP_CACHE_KEY);
      if (!cached) return null;

      const tripData: TripCacheData = JSON.parse(cached);
      
      // Check if cache is still valid (not too old)
      const now = Date.now();
      if (now - tripData.lastUpdateTime > this.MAX_CACHE_AGE) {
        console.log('[TripCache] Cache expired, clearing...');
        await this.clearTripData();
        return null;
      }

      return tripData;
    } catch (error) {
      console.error('[TripCache] Failed to get current trip:', error);
      return null;
    }
  }

  /**
   * Get trip data from backup
   */
  public async getTripBackup(): Promise<TripCacheData | null> {
    try {
      const backup = await AsyncStorage.getItem(TRIP_BACKUP_KEY);
      if (!backup) return null;

      const tripData: TripCacheData = JSON.parse(backup);
      return tripData;
    } catch (error) {
      console.error('[TripCache] Failed to get trip backup:', error);
      return null;
    }
  }

  /**
   * Check if there's a recoverable trip
   */
  public async hasRecoverableTrip(): Promise<boolean> {
    const currentTrip = await this.getCurrentTrip();
    const backupTrip = await this.getTripBackup();
    
    // Check if trip exists and is actually recoverable (was tracking, not completed)
    const trip = currentTrip || backupTrip;
    if (!trip) return false;
    
    // Only consider it recoverable if it was actually tracking
    return trip.isTracking || trip.screenMode === 'tracking';
  }

  /**
   * Recover trip data (try current first, then backup)
   */
  public async recoverTrip(): Promise<TripCacheData | null> {
    try {
      // Try current cache first
      let tripData = await this.getCurrentTrip();
      
      // If no current cache, try backup
      if (!tripData) {
        console.log('[TripCache] No current trip, trying backup...');
        tripData = await this.getTripBackup();
      }

      if (tripData) {
        console.log('[TripCache] Trip recovered:', {
          tripId: tripData.tripId,
          isTracking: tripData.isTracking,
          distance: tripData.rideStats.distance,
          duration: tripData.rideStats.duration,
          lastUpdate: new Date(tripData.lastUpdateTime).toISOString(),
        });
      }

      return tripData;
    } catch (error) {
      console.error('[TripCache] Failed to recover trip:', error);
      return null;
    }
  }

  /**
   * Save trip to history before clearing
   */
  public async saveToHistory(tripData: TripCacheData): Promise<void> {
    try {
      const history = await this.getTripHistory();
      const newHistory = [tripData, ...history].slice(0, 10); // Keep last 10 trips
      
      await AsyncStorage.setItem(TRIP_HISTORY_KEY, JSON.stringify(newHistory));
      console.log('[TripCache] Trip saved to history');
    } catch (error) {
      console.error('[TripCache] Failed to save to history:', error);
    }
  }

  /**
   * Get trip history
   */
  public async getTripHistory(): Promise<TripCacheData[]> {
    try {
      const history = await AsyncStorage.getItem(TRIP_HISTORY_KEY);
      return history ? JSON.parse(history) : [];
    } catch (error) {
      console.error('[TripCache] Failed to get trip history:', error);
      return [];
    }
  }

  /**
   * Clear current trip data
   */
  public async clearTripData(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([TRIP_CACHE_KEY, TRIP_BACKUP_KEY]);
      this.stopAutoCache();
      console.log('[TripCache] Trip data cleared');
    } catch (error) {
      console.error('[TripCache] Failed to clear trip data:', error);
    }
  }

  /**
   * Clear completed trips (non-tracking trips)
   */
  public async clearCompletedTrips(): Promise<void> {
    try {
      const currentTrip = await this.getCurrentTrip();
      const backupTrip = await this.getTripBackup();
      
      // Clear if trip exists but is not tracking
      if (currentTrip && !currentTrip.isTracking && currentTrip.screenMode !== 'tracking') {
        await this.clearTripData();
        console.log('[TripCache] Completed trip cleared');
      }
    } catch (error) {
      console.error('[TripCache] Failed to clear completed trips:', error);
    }
  }

  /**
   * Clear all trip data including history
   */
  public async clearAllTripData(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([TRIP_CACHE_KEY, TRIP_BACKUP_KEY, TRIP_HISTORY_KEY]);
      this.stopAutoCache();
      console.log('[TripCache] All trip data cleared');
    } catch (error) {
      console.error('[TripCache] Failed to clear all trip data:', error);
    }
  }

  /**
   * Get cache statistics
   */
  public async getCacheStats(): Promise<{
    hasCurrentTrip: boolean;
    hasBackup: boolean;
    lastUpdateTime?: number;
    tripId?: string;
    isTracking?: boolean;
  }> {
    try {
      const currentTrip = await this.getCurrentTrip();
      const backupTrip = await this.getTripBackup();
      
      return {
        hasCurrentTrip: !!currentTrip,
        hasBackup: !!backupTrip,
        lastUpdateTime: currentTrip?.lastUpdateTime || backupTrip?.lastUpdateTime,
        tripId: currentTrip?.tripId || backupTrip?.tripId,
        isTracking: currentTrip?.isTracking || backupTrip?.isTracking,
      };
    } catch (error) {
      console.error('[TripCache] Failed to get cache stats:', error);
      return {
        hasCurrentTrip: false,
        hasBackup: false,
      };
    }
  }
}

// Export singleton instance
export const tripCacheManager = TripCacheManager.getInstance();

// Export types
export type { TripCacheData };
