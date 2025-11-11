// Centralized cache management system
// Provides consistent cache keys, versioning, and cleanup

import AsyncStorage from '@react-native-async-storage/async-storage';
// import { cacheAnalytics } from './cacheAnalytics';

// Cache configuration
export const CACHE_CONFIG = {
  VERSION: '1.0.0',
  EXPIRY: 5 * 60 * 1000, // 5 minutes
  MAX_SIZE: 50 * 1024 * 1024, // 50MB
  CLEANUP_THRESHOLD: 0.8, // Clean when 80% full
};

// Standardized cache keys
export const CACHE_KEYS = {
  // User-specific data
  REPORTS: (userId: string) => `reports_${userId}`,
  GAS_STATIONS: (userId: string) => `gasStations_${userId}`,
  MOTORS: (userId: string) => `motors_${userId}`,
  TRIPS: (userId: string) => `trips_${userId}`,
  DESTINATIONS: (userId: string) => `destinations_${userId}`,
  FUEL_LOGS: (userId: string) => `fuelLogs_${userId}`,
  MAINTENANCE: (userId: string) => `maintenance_${userId}`,
  
  // Global data (not user-specific)
  GLOBAL_REPORTS: 'global_reports',
  GLOBAL_GAS_STATIONS: 'global_gasStations',
  
  // Cache metadata
  CACHE_VERSION: 'cache_version',
  CACHE_TIMESTAMP: (userId: string) => `cache_timestamp_${userId}`,
  CACHE_SIZE: 'cache_size',
};

// Cache entry interface
export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  version: string;
  expiry: number;
  userId?: string;
}

// Cache manager class
export class CacheManager {
  private static instance: CacheManager;
  private cacheLocks: Map<string, Promise<any>> = new Map();

  static getInstance(): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager();
    }
    return CacheManager.instance;
  }

  // Get cached data with version check
  async get<T>(key: string): Promise<T | null> {
    const startTime = Date.now();
    
    try {
      const cached = await AsyncStorage.getItem(key);
      const responseTime = Date.now() - startTime;
      
      if (!cached) {
        // Track cache miss
        // await cacheAnalytics.trackCacheAccess(key, false, responseTime);
        return null;
      }

      const entry: CacheEntry<T> = JSON.parse(cached);
      
      // Check version compatibility
      if (entry.version !== CACHE_CONFIG.VERSION) {
        console.log(`[CacheManager] Version mismatch for ${key}, clearing cache`);
        await this.remove(key);
        // await cacheAnalytics.trackCacheAccess(key, false, responseTime);
        return null;
      }

      // Check expiry
      if (Date.now() - entry.timestamp > entry.expiry) {
        console.log(`[CacheManager] Cache expired for ${key}, clearing`);
        await this.remove(key);
        // await cacheAnalytics.trackCacheAccess(key, false, responseTime);
        return null;
      }

      // Track cache hit
      // await cacheAnalytics.trackCacheAccess(key, true, responseTime);
      return entry.data;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      // await cacheAnalytics.trackCacheAccess(key, false, responseTime);
      console.error(`[CacheManager] Error getting cache for ${key}:`, error);
      return null;
    }
  }

  // Set cached data with version and expiry
  async set<T>(key: string, data: T, userId?: string): Promise<void> {
    try {
      const entry: CacheEntry<T> = {
        data,
        timestamp: Date.now(),
        version: CACHE_CONFIG.VERSION,
        expiry: CACHE_CONFIG.EXPIRY,
        userId,
      };

      await AsyncStorage.setItem(key, JSON.stringify(entry));
      
      // Update cache timestamp for user
      if (userId) {
        await AsyncStorage.setItem(CACHE_KEYS.CACHE_TIMESTAMP(userId), Date.now().toString());
      }
    } catch (error) {
      console.error(`[CacheManager] Error setting cache for ${key}:`, error);
    }
  }

  // Remove cached data
  async remove(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.error(`[CacheManager] Error removing cache for ${key}:`, error);
    }
  }

  // Remove all user-specific cache
  async clearUserCache(userId: string): Promise<void> {
    try {
      const userKeys = [
        CACHE_KEYS.REPORTS(userId),
        CACHE_KEYS.GAS_STATIONS(userId),
        CACHE_KEYS.MOTORS(userId),
        CACHE_KEYS.TRIPS(userId),
        CACHE_KEYS.DESTINATIONS(userId),
        CACHE_KEYS.FUEL_LOGS(userId),
        CACHE_KEYS.MAINTENANCE(userId),
        CACHE_KEYS.CACHE_TIMESTAMP(userId),
      ];

      await AsyncStorage.multiRemove(userKeys);
      console.log(`[CacheManager] Cleared cache for user: ${userId}`);
    } catch (error) {
      console.error(`[CacheManager] Error clearing user cache:`, error);
    }
  }

  // Clear all cache
  async clearAllCache(): Promise<void> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const cacheKeys = allKeys.filter(key => 
        key.startsWith('reports_') ||
        key.startsWith('gasStations_') ||
        key.startsWith('motors_') ||
        key.startsWith('trips_') ||
        key.startsWith('destinations_') ||
        key.startsWith('fuelLogs_') ||
        key.startsWith('maintenance_') ||
        key.startsWith('cache_timestamp_') ||
        key === 'global_reports' ||
        key === 'global_gasStations'
      );

      await AsyncStorage.multiRemove(cacheKeys);
      console.log(`[CacheManager] Cleared all cache: ${cacheKeys.length} keys`);
    } catch (error) {
      console.error(`[CacheManager] Error clearing all cache:`, error);
    }
  }

  // Get cache size
  async getCacheSize(): Promise<number> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      let totalSize = 0;

      for (const key of allKeys) {
        const value = await AsyncStorage.getItem(key);
        if (value) {
          totalSize += value.length;
        }
      }

      return totalSize;
    } catch (error) {
      console.error(`[CacheManager] Error calculating cache size:`, error);
      return 0;
    }
  }

  // Cleanup old cache entries
  async cleanupOldCache(): Promise<void> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const cacheKeys = allKeys.filter(key => 
        key.startsWith('reports_') ||
        key.startsWith('gasStations_') ||
        key.startsWith('motors_') ||
        key.startsWith('trips_') ||
        key.startsWith('destinations_') ||
        key.startsWith('fuelLogs_') ||
        key.startsWith('maintenance_')
      );

      const now = Date.now();
      const keysToRemove: string[] = [];

      for (const key of cacheKeys) {
        try {
          const cached = await AsyncStorage.getItem(key);
          if (cached) {
            const entry = JSON.parse(cached);
            if (now - entry.timestamp > entry.expiry) {
              keysToRemove.push(key);
            }
          }
        } catch (error) {
          // If we can't parse the entry, remove it
          keysToRemove.push(key);
        }
      }

      if (keysToRemove.length > 0) {
        await AsyncStorage.multiRemove(keysToRemove);
        console.log(`[CacheManager] Cleaned up ${keysToRemove.length} expired cache entries`);
      }
    } catch (error) {
      console.error(`[CacheManager] Error cleaning up old cache:`, error);
    }
  }

  // Prevent race conditions with locks
  async withLock<T>(key: string, operation: () => Promise<T>): Promise<T> {
    if (this.cacheLocks.has(key)) {
      return this.cacheLocks.get(key)!;
    }

    const promise = operation().finally(() => {
      this.cacheLocks.delete(key);
    });

    this.cacheLocks.set(key, promise);
    return promise;
  }

  // Get cache statistics
  async getCacheStats(): Promise<{
    totalKeys: number;
    totalSize: number;
    userKeys: number;
    expiredKeys: number;
  }> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const cacheKeys = allKeys.filter(key => 
        key.startsWith('reports_') ||
        key.startsWith('gasStations_') ||
        key.startsWith('motors_') ||
        key.startsWith('trips_') ||
        key.startsWith('destinations_') ||
        key.startsWith('fuelLogs_') ||
        key.startsWith('maintenance_') ||
        key.startsWith('cache_timestamp_') ||
        key === 'global_reports' ||
        key === 'global_gasStations'
      );

      let totalSize = 0;
      let expiredKeys = 0;
      const now = Date.now();

      for (const key of cacheKeys) {
        try {
          const value = await AsyncStorage.getItem(key);
          if (value) {
            totalSize += value.length;
            
            // Check if expired
            const entry = JSON.parse(value);
            if (entry.timestamp && now - entry.timestamp > entry.expiry) {
              expiredKeys++;
            }
          }
        } catch (error) {
          // If we can't parse, consider it expired
          expiredKeys++;
        }
      }

      return {
        totalKeys: cacheKeys.length,
        totalSize,
        userKeys: cacheKeys.filter(key => key.includes('_')).length,
        expiredKeys,
      };
    } catch (error) {
      console.error(`[CacheManager] Error getting cache stats:`, error);
      return {
        totalKeys: 0,
        totalSize: 0,
        userKeys: 0,
        expiredKeys: 0,
      };
    }
  }
}

// Export singleton instance
export const cacheManager = CacheManager.getInstance();

// Utility functions for common operations
export const cacheUtils = {
  // Get user-specific cache key
  getUserKey: (type: keyof typeof CACHE_KEYS, userId: string) => {
    const keyFunction = CACHE_KEYS[type] as (userId: string) => string;
    return keyFunction(userId);
  },

  // Check if cache is valid
  isCacheValid: (timestamp: number, expiry: number = CACHE_CONFIG.EXPIRY): boolean => {
    return Date.now() - timestamp < expiry;
  },

  // Get cache age
  getCacheAge: (timestamp: number): number => {
    return Date.now() - timestamp;
  },

  // Format cache size
  formatCacheSize: (bytes: number): string => {
    const sizes = ['B', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  },
};
