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

          // Update fuel level
          const fuelUsed = distance / state.selectedMotor.fuelEfficiency;
          const newFuelLevel = Math.max(0, state.selectedMotor.currentFuelLevel - (fuelUsed / state.selectedMotor.totalDrivableDistance) * 100);

          // Update motor fuel level in background
          if (!isNaN(newFuelLevel) && state.selectedMotor.totalDrivableDistance > 0) {
            updateFuelLevel(state.selectedMotor._id, newFuelLevel).catch((error) => {
              console.warn('[Background] Fuel level update failed:', error.message);
            });
          }

          // Update tracking stats
          const newStats = {
            ...state.stats,
            distance: state.stats.distance + distance,
            fuelConsumed: state.stats.fuelConsumed + fuelUsed,
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
    await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    await AsyncStorage.removeItem('trackingState');
    console.log('[Background] Location tracking stopped');
    return true;
  } catch (error) {
    console.error('[Background] Error stopping location tracking:', error);
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
