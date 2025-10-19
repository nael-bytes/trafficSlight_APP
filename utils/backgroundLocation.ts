import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { updateFuelLevel } from './api';

// Background task name
export const BACKGROUND_LOCATION_TASK = 'background-location-task';

// Background location tracking task
TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    console.error('Background location task error:', error);
    return;
  }

  if (data) {
    const { locations } = data as any;
    const location = locations[0];
    
    if (location) {
      try {
        // Get current tracking state from storage
        const trackingState = await AsyncStorage.getItem('trackingState');
        if (!trackingState) return;

        const state = JSON.parse(trackingState);
        if (!state.isTracking || !state.selectedMotor) return;

        // Update location in storage
        const newLocation = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          timestamp: location.timestamp,
        };

        // Get existing route coordinates
        const existingRoute = await AsyncStorage.getItem(`route_${state.tripId}`);
        let routeCoordinates = existingRoute ? JSON.parse(existingRoute) : [];
        
        // Add new location to route
        routeCoordinates.push(newLocation);
        
        // Save updated route
        await AsyncStorage.setItem(`route_${state.tripId}`, JSON.stringify(routeCoordinates));

        // Calculate distance and fuel consumption
        if (routeCoordinates.length > 1) {
          const prevLocation = routeCoordinates[routeCoordinates.length - 2];
          const distance = calculateDistance(
            prevLocation.latitude,
            prevLocation.longitude,
            newLocation.latitude,
            newLocation.longitude
          );

          // CRITICAL FIX: Remove fuel calculation from background to prevent double consumption
          // Fuel calculation is now handled only in the foreground component
          // This prevents duplicate fuel updates and API calls

          // Update tracking stats (without fuel calculation)
          const newStats = {
            ...state.stats,
            distance: state.stats.distance + distance,
            duration: Math.floor((Date.now() - state.startTime) / 1000),
          };

          // Save updated stats
          await AsyncStorage.setItem('trackingState', JSON.stringify({
            ...state,
            stats: newStats,
            lastLocation: newLocation,
          }));
        }

        console.log('[Background] Location updated:', newLocation);
      } catch (error) {
        console.error('[Background] Error processing location:', error);
      }
    }
  }
});

// Helper function to calculate distance between two points
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radius of the Earth in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c * 1000; // Distance in meters
}

// Start background location tracking
export async function startBackgroundLocationTracking(tripId: string, selectedMotor: any, stats: any) {
  try {
    // Request background location permissions
    const { status } = await Location.requestBackgroundPermissionsAsync();
    if (status !== 'granted') {
      console.warn('Background location permission not granted');
      return false;
    }

    // Check if task is already running and stop it first
    const isAlreadyRunning = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    if (isAlreadyRunning) {
      console.log('[Background] Stopping existing location tracking before starting new one');
      try {
        await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
        // Small delay to ensure cleanup
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (stopError) {
        console.warn('[Background] Error stopping existing tracking:', stopError);
      }
    }

    // Save tracking state
    const trackingState = {
      isTracking: true,
      tripId,
      selectedMotor,
      stats,
      startTime: Date.now(),
      lastLocation: null,
    };
    
    await AsyncStorage.setItem('trackingState', JSON.stringify(trackingState));

    // Try to start location tracking without foreground service first
    try {
      await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
        accuracy: Location.Accuracy.High,
        timeInterval: 10000, // Update every 10 seconds
        distanceInterval: 20, // Update every 20 meters
      });
      console.log('[Background] Location tracking started (basic mode)');
      return true;
    } catch (basicError) {
      console.warn('[Background] Basic location tracking failed, trying with foreground service');
      
      // Check if app is in foreground before starting foreground service
      const appState = require('react-native').AppState.currentState;
      
      if (appState === 'active') {
        try {
          // Start background location task with foreground service
          await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
            accuracy: Location.Accuracy.High,
            timeInterval: 5000, // Update every 5 seconds
            distanceInterval: 10, // Update every 10 meters
            foregroundService: {
              notificationTitle: 'TrafficSlight Navigation',
              notificationBody: 'Tracking your route in the background',
              notificationColor: '#00ADB5',
            },
          });
          console.log('[Background] Location tracking started with foreground service');
          return true;
        } catch (foregroundError) {
          console.error('[Background] Foreground service failed:', foregroundError);
          return false;
        }
      } else {
        console.error('[Background] Cannot start foreground service when app is in background');
        return false;
      }
    }
  } catch (error) {
    console.error('[Background] Error starting location tracking:', error);
    return false;
  }
}

// Stop background location tracking
export async function stopBackgroundLocationTracking() {
  try {
    // Check if the task is registered before trying to stop it
    const isRegistered = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    
    if (isRegistered) {
      await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
      console.log('[Background] Location tracking stopped successfully');
    } else {
      console.log('[Background] Location tracking was not active, skipping stop');
    }
    
    // Always clean up the tracking state
    await AsyncStorage.removeItem('trackingState');
    return true;
  } catch (error) {
    console.error('[Background] Error stopping location tracking:', error);
    
    // Even if stopping fails, clean up the tracking state
    try {
      await AsyncStorage.removeItem('trackingState');
      console.log('[Background] Cleaned up tracking state despite stop error');
    } catch (cleanupError) {
      console.error('[Background] Error cleaning up tracking state:', cleanupError);
    }
    
    return false;
  }
}

// Check if background tracking is active
export async function isBackgroundTrackingActive(): Promise<boolean> {
  try {
    const trackingState = await AsyncStorage.getItem('trackingState');
    return trackingState !== null;
  } catch (error) {
    console.error('[Background] Error checking tracking state:', error);
    return false;
  }
}

// Get current tracking state
export async function getTrackingState() {
  try {
    const trackingState = await AsyncStorage.getItem('trackingState');
    return trackingState ? JSON.parse(trackingState) : null;
  } catch (error) {
    console.error('[Background] Error getting tracking state:', error);
    return null;
  }
}

// Safely check if background location task is running
export async function isLocationTaskRunning(): Promise<boolean> {
  try {
    return await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  } catch (error) {
    console.error('[Background] Error checking if location task is running:', error);
    return false;
  }
}

// Safely stop background location task with error handling
export async function safeStopBackgroundLocation(): Promise<boolean> {
  try {
    const isRunning = await isLocationTaskRunning();
    
    if (isRunning) {
      await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
      console.log('[Background] Location task stopped successfully');
    } else {
      console.log('[Background] Location task was not running');
    }
    
    // Always clean up tracking state
    await AsyncStorage.removeItem('trackingState');
    return true;
  } catch (error) {
    console.error('[Background] Error in safe stop:', error);
    
    // Clean up tracking state even if stop failed
    try {
      await AsyncStorage.removeItem('trackingState');
    } catch (cleanupError) {
      console.error('[Background] Error cleaning up after safe stop:', cleanupError);
    }
    
    return false;
  }
}

// Resume tracking when app comes to foreground
export async function resumeTrackingFromBackground() {
  try {
    const trackingState = await getTrackingState();
    if (trackingState && trackingState.isTracking) {
      console.log('[Background] Resuming tracking from background');
      return trackingState;
    }
    return null;
  } catch (error) {
    console.error('[Background] Error resuming tracking:', error);
    return null;
  }
}
