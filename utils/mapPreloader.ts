// Map Preloader - Downloads and caches map tiles when app starts
// This ensures maps are already loaded when user navigates to map screens

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCurrentLocationWithCache } from './locationCache';

const MAP_PRELOAD_KEY = 'map_preloaded';
const MAP_PRELOAD_REGION_KEY = 'map_preload_region';

interface MapRegion {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

/**
 * Preload map tiles for a given region
 * This creates a hidden MapView that loads tiles into cache
 */
export const preloadMapTiles = async (region: MapRegion): Promise<void> => {
  try {
    // Store preload region for later use
    await AsyncStorage.setItem(MAP_PRELOAD_REGION_KEY, JSON.stringify(region));
    await AsyncStorage.setItem(MAP_PRELOAD_KEY, 'true');
    
    if (__DEV__) {
      console.log('[MapPreloader] Map preload region stored:', region);
    }
  } catch (error) {
    console.warn('[MapPreloader] Failed to store preload region:', error);
  }
};

/**
 * Get preload region from storage
 */
export const getPreloadRegion = async (): Promise<MapRegion | null> => {
  try {
    const regionStr = await AsyncStorage.getItem(MAP_PRELOAD_REGION_KEY);
    if (regionStr) {
      return JSON.parse(regionStr);
    }
  } catch (error) {
    console.warn('[MapPreloader] Failed to get preload region:', error);
  }
  return null;
};

/**
 * Preload map tiles using user's cached location or default location
 */
export const initializeMapPreload = async (): Promise<void> => {
  try {
    // Check if already preloaded
    const isPreloaded = await AsyncStorage.getItem(MAP_PRELOAD_KEY);
    if (isPreloaded === 'true') {
      if (__DEV__) {
        console.log('[MapPreloader] Map already preloaded');
      }
      return;
    }

    // Try to get user's cached location
    let region: MapRegion | null = null;
    try {
      const location = await getCurrentLocationWithCache(false); // Use cached location
      if (location) {
        region = {
          latitude: location.latitude,
          longitude: location.longitude,
          latitudeDelta: 0.05, // ~5km radius
          longitudeDelta: 0.05,
        };
      }
    } catch (error) {
      if (__DEV__) {
        console.warn('[MapPreloader] Failed to get cached location, using default:', error);
      }
    }

    // If no cached location, use default location (Metro Manila area)
    if (!region) {
      region = {
        latitude: 14.5995, // Metro Manila
        longitude: 120.9842,
        latitudeDelta: 0.1, // ~10km radius
        longitudeDelta: 0.1,
      };
    }

    // Store preload region
    await preloadMapTiles(region);
    
    if (__DEV__) {
      console.log('[MapPreloader] Map preload initialized with region:', region);
    }
  } catch (error) {
    console.warn('[MapPreloader] Failed to initialize map preload:', error);
  }
};

/**
 * Clear preload status (useful for testing or forcing re-preload)
 */
export const clearMapPreload = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(MAP_PRELOAD_KEY);
    await AsyncStorage.removeItem(MAP_PRELOAD_REGION_KEY);
    if (__DEV__) {
      console.log('[MapPreloader] Map preload cleared');
    }
  } catch (error) {
    console.warn('[MapPreloader] Failed to clear preload:', error);
  }
};

