/**
 * Simple location cache utility for sharing location between screens
 * This provides a lightweight alternative to full Context API
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { locationPermissionManager } from './locationPermissionManager';

const LOCATION_CACHE_KEY = 'user_current_location';
const LOCATION_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export interface CachedLocation {
  latitude: number;
  longitude: number;
  timestamp: number;
  address?: string;
}

/**
 * Save current location to cache
 */
export async function cacheLocation(location: CachedLocation): Promise<void> {
  try {
    await AsyncStorage.setItem(LOCATION_CACHE_KEY, JSON.stringify(location));
    console.log('[LocationCache] Location cached:', location);
  } catch (error) {
    console.error('[LocationCache] Failed to cache location:', error);
  }
}

/**
 * Get cached location if still valid
 */
export async function getCachedLocation(): Promise<CachedLocation | null> {
  try {
    const cached = await AsyncStorage.getItem(LOCATION_CACHE_KEY);
    if (!cached) return null;

    const location: CachedLocation = JSON.parse(cached);
    const now = Date.now();

    // Check if cache is still valid
    if (now - location.timestamp < LOCATION_CACHE_DURATION) {
      console.log('[LocationCache] Using cached location:', location);
      return location;
    } else {
      console.log('[LocationCache] Cache expired, clearing');
      await AsyncStorage.removeItem(LOCATION_CACHE_KEY);
      return null;
    }
  } catch (error) {
    console.error('[LocationCache] Failed to get cached location:', error);
    return null;
  }
}

/**
 * Get current location with caching
 * - First checks cache
 * - If cache is invalid or forceRefresh is true, gets fresh location
 * - Uses centralized permission manager to avoid multiple permission requests
 */
export async function getCurrentLocationWithCache(
  forceRefresh: boolean = false
): Promise<CachedLocation | null> {
  try {
    // Check cache first unless forcing refresh
    if (!forceRefresh) {
      const cached = await getCachedLocation();
      if (cached) return cached;
    }

    // Check if permission is already granted
    if (!locationPermissionManager.isPermissionGranted()) {
      console.log('[LocationCache] Permission not granted, checking status...');
      
      // Check current permission status first
      const currentStatus = await locationPermissionManager.checkPermissionStatus();
      
      if (currentStatus !== 'granted') {
        console.warn('[LocationCache] Location permission not granted:', currentStatus);
        return null;
      }
    }

    // Get fresh location
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    const newLocation: CachedLocation = {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      timestamp: Date.now(),
    };

    // Cache the new location
    await cacheLocation(newLocation);

    return newLocation;
  } catch (error) {
    console.error('[LocationCache] Failed to get current location:', error);
    
    // Try to return cached location as fallback
    const cached = await getCachedLocation();
    if (cached) {
      console.log('[LocationCache] Returning cached location as fallback');
      return cached;
    }
    
    return null;
  }
}

/**
 * Clear location cache
 */
export async function clearLocationCache(): Promise<void> {
  try {
    await AsyncStorage.removeItem(LOCATION_CACHE_KEY);
    console.log('[LocationCache] Cache cleared');
  } catch (error) {
    console.error('[LocationCache] Failed to clear cache:', error);
  }
}

