/**
 * Tracking Utilities
 * 
 * Handles all tracking-related operations including:
 * - Start tracking logic
 * - Stop tracking logic
 * - Trip data creation on stop
 * - Address resolution
 * - Distance tracking reset
 * - Emergency cleanup
 */

import { Alert } from 'react-native';
import Toast from 'react-native-toast-message';
import { reverseGeocodeLocation } from '../../utils/location';
import { getGPSErrorInfo, GPSErrorType } from './locationUtils';
import type { LocationCoords, Motor, RideStats } from '../../types';

export interface StartTrackingParams {
  selectedMotor: Motor | null;
  currentLocation: LocationCoords | null;
  isDestinationFlowActive: boolean;
  onStartTracking: () => void | Promise<void>;
  onGetCurrentLocation: (showOverlay?: boolean) => Promise<LocationCoords | null>;
  onSetStartAddress: (address: string) => void;
  onSetTripDataForModal: (data: any) => void;
  onResetLastProcessedDistance: () => void | Promise<void>;
  onResetManualPanFlag: () => void | Promise<void>;
  onSetScreenMode: (mode: 'planning' | 'tracking' | 'summary') => void;
  onClearDestination?: () => void; // Optional callback to clear destination for Free Drive
  onResetDestinationFlow?: () => void; // Optional callback to reset destination flow state
}

export interface StartDestinationTrackingParams {
  selectedMotor: Motor | null;
  currentLocation: LocationCoords | null;
  isDestinationFlowActive?: boolean; // Optional - not used in destination tracking but kept for consistency
  onStartTracking: () => Promise<void>;
  onGetCurrentLocation: (showOverlay?: boolean) => Promise<LocationCoords | null>;
  onSetStartAddress: (address: string) => void;
  onResetLastProcessedDistance: () => void;
  onSetTripDataForModal: (data: any) => void;
  onResetManualPanFlag?: () => void; // Optional - for consistency with StartTrackingParams
  onSetScreenMode?: (mode: 'planning' | 'tracking' | 'summary') => void; // Optional
}

/**
 * Start free drive tracking
 */
export const startFreeDriveTracking = async (params: StartTrackingParams): Promise<void> => {
  const {
    selectedMotor,
    currentLocation,
    isDestinationFlowActive,
    onStartTracking,
    onGetCurrentLocation,
    onSetStartAddress,
    onSetTripDataForModal,
    onResetLastProcessedDistance,
    onResetManualPanFlag,
    onSetScreenMode,
    onClearDestination,
    onResetDestinationFlow,
  } = params;
  
  // Ensure optional callbacks are defined
  const clearDestination = onClearDestination || (() => {
    if (__DEV__) {
      console.warn('[TrackingUtils] onClearDestination not provided');
    }
  });
  
  const resetDestinationFlow = onResetDestinationFlow || (() => {
    if (__DEV__) {
      console.warn('[TrackingUtils] onResetDestinationFlow not provided');
    }
  });

  if (!selectedMotor) {
    Toast.show({
      type: 'error',
      text1: 'No Motor Selected',
      text2: 'Please select a motor first',
    });
    return;
  }

  if (!currentLocation) {
    Toast.show({
      type: 'info',
      text1: 'Getting Location',
      text2: 'Please wait while we get your current location...',
      visibilityTime: 3000,
    });
    
    // Try to get location with overlay and force refresh
    // This gives better feedback to the user and forces a fresh location fetch
    const location = await onGetCurrentLocation(true, true);
    
    // Check if location was successfully obtained
    if (!location) {
      // Location failed - show detailed GPS error
      // Create a mock error object to get GPS error info
      const locationError = new Error('Location is required to start free drive tracking');
      const gpsErrorInfo = getGPSErrorInfo(locationError);
      
      let detailedMessage = 'Unable to get your current location. This is required to start free drive tracking.\n\n' + gpsErrorInfo.userFriendlyMessage;
      
      // Add specific guidance based on error type
      if (gpsErrorInfo.type === GPSErrorType.DISABLED || gpsErrorInfo.type === GPSErrorType.PERMISSION_DENIED) {
        detailedMessage += '\n\nTo fix this:\n• Open your device Settings\n• Enable Location Services/GPS\n• Grant location permission to this app\n• Then return to the app and try again';
      } else {
        detailedMessage += '\n\nTips to improve GPS signal:\n• Move to an open area (away from buildings)\n• Go outside or near a window\n• Wait 10-30 seconds for GPS to acquire signal\n• Make sure you\'re not in a basement or underground';
      }
      
      Alert.alert(
        'GPS Location Error',
        detailedMessage,
        [
          {
            text: 'OK',
            style: 'default',
          },
        ]
      );
      throw new Error('Location is required to start free drive tracking');
    }
    
    // Location obtained, continue with tracking
    // Note: currentLocation will be updated by the callback, so we can proceed
    if (__DEV__) {
      console.log('[TrackingUtils] ✅ Location obtained successfully:', {
        latitude: location.latitude,
        longitude: location.longitude,
        timestamp: new Date().toISOString(),
      });
    }
  }

  // Prevent free drive tracking when destination flow is active
  if (isDestinationFlowActive) {
    Toast.show({
      type: 'info',
      text1: 'Destination Navigation Active',
      text2: 'Use the navigation controls to manage your route',
    });
    return;
  }

  try {
    // Clear destination and reset destination flow state for Free Drive
    // This prevents "Find the best routes" modal from showing
    clearDestination();
    if (__DEV__) {
      console.log('[TrackingUtils] 🧹 Cleared destination for Free Drive');
    }
    
    resetDestinationFlow();
    if (__DEV__) {
      console.log('[TrackingUtils] 🔄 Reset destination flow state for Free Drive');
    }

    // Reset distance tracking for incremental calculation
    onResetLastProcessedDistance();
    if (__DEV__) {
      console.log('[TrackingUtils] 🔄 Reset lastProcessedDistance to 0 for new tracking session');
    }
    
    // Reset manual pan flag when starting new tracking session
    if (onResetManualPanFlag) {
      onResetManualPanFlag();
    }
    
    // Clear previous trip data if callback provided
    if (onSetTripDataForModal) {
      onSetTripDataForModal(null);
    }
    
    // CRITICAL: Handle both sync and async startTracking
    const result = onStartTracking();
    if (result instanceof Promise) {
      await result;
    }
    onSetScreenMode('tracking');
    
    // Get start address
    if (currentLocation) {
      try {
        const address = await reverseGeocodeLocation(currentLocation);
        onSetStartAddress(address);
      } catch (error) {
        console.warn('[TrackingUtils] Failed to get start address:', error);
        onSetStartAddress('Unknown Location');
      }
    }
  } catch (error: any) {
    Toast.show({
      type: 'error',
      text1: 'Tracking Error',
      text2: error.message || 'Failed to start',
    });
    throw error;
  }
};

/**
 * Start destination-specific tracking
 */
export const startDestinationTracking = async (params: StartDestinationTrackingParams): Promise<void> => {
  const {
    selectedMotor,
    currentLocation,
    onStartTracking,
    onGetCurrentLocation,
    onSetStartAddress,
    onResetLastProcessedDistance,
    onSetTripDataForModal,
  } = params;

  if (!selectedMotor) {
    Toast.show({
      type: 'error',
      text1: 'No Motor Selected',
      text2: 'Please select a motor first',
    });
    return;
  }

  if (!currentLocation) {
    Toast.show({
      type: 'info',
      text1: 'Getting Location',
      text2: 'Please wait while we get your current location...',
      visibilityTime: 2000,
    });
    
    // Try to get location
    const location = await onGetCurrentLocation(false);
    
    // Check if location was successfully obtained
    if (!location) {
      // Location failed - show detailed GPS error
      // Create a mock error object to get GPS error info
      const locationError = new Error('Location is required to start navigation');
      const gpsErrorInfo = getGPSErrorInfo(locationError);
      
      let detailedMessage = 'Unable to get your current location. This is required to start navigation.\n\n' + gpsErrorInfo.userFriendlyMessage;
      
      // Add specific guidance based on error type
      if (gpsErrorInfo.type === GPSErrorType.DISABLED || gpsErrorInfo.type === GPSErrorType.PERMISSION_DENIED) {
        detailedMessage += '\n\nTo fix this:\n• Open your device Settings\n• Enable Location Services/GPS\n• Grant location permission to this app\n• Then return to the app and try again';
      } else {
        detailedMessage += '\n\nTips to improve GPS signal:\n• Move to an open area (away from buildings)\n• Go outside or near a window\n• Wait 10-30 seconds for GPS to acquire signal\n• Make sure you\'re not in a basement or underground';
      }
      
      Alert.alert(
        'GPS Location Error',
        detailedMessage,
        [
          {
            text: 'OK',
            style: 'default',
          },
        ]
      );
      throw new Error('Location is required to start navigation');
    }
    
    // Location obtained, continue with tracking
    // Note: currentLocation will be updated by the callback, so we can proceed
  }

  try {
    // Reset distance tracking for incremental calculation
    onResetLastProcessedDistance();
    if (__DEV__) {
      console.log('[TrackingUtils] 🔄 Reset lastProcessedDistance to 0 for destination tracking');
    }
    
    // Clear previous trip data
    if (onSetTripDataForModal) {
      onSetTripDataForModal(null);
    }
    
    // Start destination-specific tracking (NOT free drive tracking)
    await onStartTracking();
    
    // Get start address
    if (currentLocation) {
      try {
        const address = await reverseGeocodeLocation(currentLocation);
        onSetStartAddress(address);
      } catch (error) {
        console.warn('[TrackingUtils] Failed to get start address:', error);
        onSetStartAddress('Unknown Location');
      }
    }
  } catch (error: any) {
    if (__DEV__) {
      console.error('[TrackingUtils] ❌ Error starting destination tracking:', error);
    }
    Toast.show({
      type: 'error',
      text1: 'Navigation Failed',
      text2: 'Please try again',
    });
    throw error;
  }
};

export interface StopTrackingParams {
  selectedMotor: Motor | null;
  currentLocation: LocationCoords | null;
  destination: LocationCoords | null;
  rideStats: RideStats | null;
  routeCoordinates: LocationCoords[] | null;
  snappedRouteCoordinates: LocationCoords[] | null;
  startAddress: string;
  endAddress: string;
  tripMaintenanceActions: any[];
  isBackgroundTracking: boolean;
  backgroundTrackingId: string | null;
  hasArrived?: boolean; // Whether destination was reached (for destination flow)
  onStopTracking: () => void;
  onResetTracking: () => void;
  onSetEndAddress: (address: string) => void;
  onSetTripDataForModal: (data: any) => void;
  onResetLastProcessedDistance: () => void;
  onSetScreenMode: (mode: 'planning' | 'tracking' | 'summary') => void;
  onSetShowTripSummary: (show: boolean) => void;
  onCreateTripData: (tripEndTime: Date, hasArrived?: boolean) => any;
}

/**
 * Stop tracking and create trip data
 */
export const stopTracking = async (params: StopTrackingParams): Promise<void> => {
  const {
    selectedMotor,
    currentLocation,
    destination,
    rideStats,
    routeCoordinates,
    snappedRouteCoordinates,
    startAddress,
    endAddress,
    tripMaintenanceActions,
    isBackgroundTracking,
    backgroundTrackingId,
    hasArrived = false,
    onStopTracking,
    onResetTracking,
    onSetEndAddress,
    onSetTripDataForModal,
    onResetLastProcessedDistance,
    onSetScreenMode,
    onSetShowTripSummary,
    onCreateTripData,
  } = params;

  if (__DEV__) {
    console.log('[TrackingUtils] 🛑 Starting stop tracking process...');
  }
  
  try {
    // Step 1: Get end address before stopping (with timeout)
    if (__DEV__) {
      console.log('[TrackingUtils] 📍 Getting end address...');
    }
    if (currentLocation) {
      try {
        const addressPromise = reverseGeocodeLocation(currentLocation);
        const timeoutPromise = new Promise<string>((_, reject) => 
          setTimeout(() => reject(new Error('Address resolution timeout')), 3000)
        );
        
        const address = await Promise.race([addressPromise, timeoutPromise]);
        onSetEndAddress(address);
        if (__DEV__) {
          console.log('[TrackingUtils] ✅ End address obtained:', address);
        }
      } catch (error) {
        if (__DEV__) {
          console.warn('[TrackingUtils] ⚠️ Failed to get end address:', error);
        }
        onSetEndAddress('Unknown Location');
      }
    } else {
      if (__DEV__) {
        console.log('[TrackingUtils] ⚠️ No current location for end address');
      }
      onSetEndAddress('Unknown Location');
    }
    
    // Step 2: Reset distance tracking
    onResetLastProcessedDistance();
    if (__DEV__) {
      console.log('[TrackingUtils] 🔄 Reset lastProcessedDistance to 0 after stopping tracking');
    }
    
    // Step 3: Stop foreground tracking with enhanced error handling
    if (__DEV__) {
      console.log('[TrackingUtils] 🛑 Stopping foreground tracking...');
    }
    try {
      onStopTracking();
      if (__DEV__) {
        console.log('[TrackingUtils] ✅ Foreground tracking stopped');
      }
    } catch (stopError) {
      if (__DEV__) {
        console.error('[TrackingUtils] ❌ Error stopping foreground tracking:', stopError);
      }
      // Continue with trip data creation even if stop fails
    }
    
    // Step 4: Create trip data for modal with fallback
    console.log('[TrackingUtils] 📊 Creating trip data...');
    try {
      const tripEndTime = new Date();
      const tripData = onCreateTripData(tripEndTime, hasArrived);
      onSetTripDataForModal(tripData);
      console.log('[TrackingUtils] ✅ Trip data created successfully', {
        hasArrived,
        isSuccessful: tripData.isSuccessful,
        status: tripData.status,
      });
    } catch (error) {
      console.error('[TrackingUtils] ❌ Error creating trip data:', error);
      // Create minimal trip data as fallback with safe rideStats access
      const safeRideStats = rideStats || {
        duration: 0,
        distance: 0,
        avgSpeed: 0,
        speed: 0,
      };
      const fallbackTripData = {
        distance: safeRideStats.distance || 0,
        duration: safeRideStats.duration > 0 ? Math.round(safeRideStats.duration / 60) : 0,
        kmph: safeRideStats.avgSpeed || 0,
        startLocation: { address: startAddress || "Start Location", lat: 0, lng: 0 },
        endLocation: { 
          address: destination ? 
            (destination.formatted_address || destination.name || "Destination") : 
            (endAddress || "End Location"), 
          lat: destination?.latitude || 0, 
          lng: destination?.longitude || 0 
        },
        destination: destination ? 
          (destination.formatted_address || destination.name || "Selected Destination") : 
          "Free Drive",
        isSuccessful: !destination || hasArrived, // Successful if no destination (free drive) or if arrived
        status: (!destination || hasArrived) ? "completed" as const : "cancelled" as const,
      };
      onSetTripDataForModal(fallbackTripData);
      console.log('[TrackingUtils] ✅ Fallback trip data created');
    }
    
    // Step 5: Update UI state
    onSetScreenMode('summary');
    onSetShowTripSummary(true);
    console.log('[TrackingUtils] ✅ UI state updated to summary mode');
    
    Toast.show({
      type: 'info',
      text1: 'Tracking Stopped',
      text2: 'Trip summary available',
    });
    
    console.log('[TrackingUtils] ✅ Stop tracking process completed successfully');
    
  } catch (error: any) {
    console.error('[TrackingUtils] ❌ Critical error in stop tracking process:', error);
    
    // Emergency cleanup - force stop everything
    console.log('[TrackingUtils] 🚨 Performing emergency cleanup...');
    
    try {
      // Force stop foreground tracking
      onStopTracking();
      console.log('[TrackingUtils] ✅ Emergency stop tracking completed');
    } catch (stopError) {
      console.error('[TrackingUtils] ❌ Error in emergency stop:', stopError);
    }
    
    // Force reset all tracking state
    onResetLastProcessedDistance();
    
    // Force reset UI state
    onSetScreenMode('summary');
    onSetShowTripSummary(true);
    console.log('[TrackingUtils] ✅ Emergency UI state reset');
    
    // Create emergency fallback trip data with safe rideStats access
    try {
      const safeRideStats = rideStats || {
        duration: 0,
        distance: 0,
        avgSpeed: 0,
        speed: 0,
      };
      const emergencyTripData = {
        distance: safeRideStats.distance || 0,
        duration: safeRideStats.duration > 0 ? Math.round(safeRideStats.duration / 60) : 0,
        kmph: safeRideStats.avgSpeed || 0,
        startLocation: { address: startAddress || "Start Location", lat: 0, lng: 0 },
        endLocation: { 
          address: endAddress || "End Location", 
          lat: 0, 
          lng: 0 
        },
        destination: "Free Drive",
        isSuccessful: true,
        status: "completed" as const,
      };
      onSetTripDataForModal(emergencyTripData);
      console.log('[TrackingUtils] ✅ Emergency trip data created');
    } catch (fallbackError) {
      console.error('[TrackingUtils] ❌ Error creating emergency trip data:', fallbackError);
    }
    
    Toast.show({
      type: 'error',
      text1: 'Tracking Stopped with Error',
      text2: 'Trip data may be incomplete',
    });
    
    console.log('[TrackingUtils] ✅ Emergency cleanup completed');
  } finally {
    console.log('[TrackingUtils] ✅ Stop tracking process finished');
  }
};

