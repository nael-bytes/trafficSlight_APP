/**
 * Simple location cache utility for sharing location between screens
 * This provides a lightweight alternative to full Context API
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { locationPermissionManager } from './locationPermissionManager';
import { checkGPSServiceStatus, GPSServiceStatus } from './location';

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

    // CRITICAL: Check GPS service status with retry mechanism and better error handling
    const gpsCheck = await checkGPSServiceStatus(3, 2000, 5000);
    
    if (!gpsCheck.isAvailable && !gpsCheck.canAttemptLocation) {
      // GPS is disabled - cannot proceed
      console.error('[LocationCache]', gpsCheck.message);
      throw new Error(`LOCATION_SERVICES_DISABLED: ${gpsCheck.message}`);
    }
    
    // If GPS is acquiring signal but we can still attempt, use longer timeout
    const locationTimeout = gpsCheck.status === GPSServiceStatus.ACQUIRING ? 20000 : 15000;
    
    if (gpsCheck.status === GPSServiceStatus.ACQUIRING) {
      console.warn('[LocationCache] GPS is acquiring signal, using longer timeout:', gpsCheck.message);
    }

    // Get fresh location with timeout
    // Use Promise.race for timeout handling since timeout option might not be available
    const location = await Promise.race([
      Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      }),
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Location request timed out')), locationTimeout)
      ),
    ]);

    const newLocation: CachedLocation = {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      timestamp: Date.now(),
    };

    // Cache the new location
    await cacheLocation(newLocation);

    return newLocation;
  } catch (error: any) {
    // Check for specific error types
    const errorMessage = error?.message || error?.toString() || 'Unknown error';
    
    if (errorMessage.includes('LOCATION_SERVICES_DISABLED')) {
      console.error('[LocationCache] Location services disabled:', error);
    } else if (errorMessage.includes('permission') || errorMessage.includes('Permission')) {
      console.error('[LocationCache] Permission error:', error);
    } else if (errorMessage.includes('unavailable') || errorMessage.includes('timeout')) {
      console.error('[LocationCache] Location unavailable or timeout:', error);
      console.warn('[LocationCache] This might mean GPS signal is weak or not acquired yet. Try:');
      console.warn('[LocationCache] 1. Move to an area with better GPS signal (outdoors, away from buildings)');
      console.warn('[LocationCache] 2. Wait a few moments for GPS to acquire signal');
      console.warn('[LocationCache] 3. Check if device is in airplane mode');
      console.warn('[LocationCache] 4. Ensure location services are enabled in device settings');
    } else {
      console.error('[LocationCache] Failed to get current location:', error);
    }
    
    // Try to return cached location as fallback (even if expired)
    const cached = await getCachedLocation();
    if (cached) {
      console.log('[LocationCache] Returning cached location as fallback');
      return cached;
    }
    
    // If no cache and error is not a permission issue, throw the error with helpful message
    if (errorMessage.includes('LOCATION_SERVICES_DISABLED')) {
      throw new Error('Location services (GPS) are disabled. Please enable GPS in your device settings.');
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

