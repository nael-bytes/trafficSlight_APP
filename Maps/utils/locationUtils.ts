/**
 * Location Utilities
 * 
 * Handles all location-related operations including:
 * - Location permission handling
 * - GPS service status checking
 * - Location fetching with caching
 * - Region updates
 * - Error handling
 */

import { Alert } from 'react-native';
import Toast from 'react-native-toast-message';
import * as Location from 'expo-location';
import { checkGPSServiceStatus, GPSServiceStatus } from '../../utils/location';
import type { LocationCoords } from '../../types';

const LOCATION_CACHE_DURATION = 30000; // 30 seconds

/**
 * GPS Error Types
 */
export enum GPSErrorType {
  DISABLED = 'disabled',
  PERMISSION_DENIED = 'permission',
  TIMEOUT = 'timeout',
  WEAK_SIGNAL = 'weak_signal',
  INVALID_DATA = 'invalid',
  HARDWARE_UNAVAILABLE = 'hardware',
  UNKNOWN = 'unknown',
}

/**
 * GPS Error Information
 */
export interface GPSErrorInfo {
  type: GPSErrorType;
  message: string;
  userFriendlyMessage: string;
  canRetry: boolean;
  requiresSettings: boolean;
}

/**
 * Get detailed GPS error information
 */
export const getGPSErrorInfo = (error: any): GPSErrorInfo => {
  const errorMessage = error?.message || error?.toString() || '';
  
  // Check for disabled GPS
  if (errorMessage.includes('unavailable') || errorMessage.includes('disabled')) {
    return {
      type: GPSErrorType.DISABLED,
      message: errorMessage,
      userFriendlyMessage: 'GPS is disabled on your device. Please enable location services in your device settings.',
      canRetry: false,
      requiresSettings: true,
    };
  }
  
  // Check for permission denied
  if (errorMessage.includes('permission') || errorMessage.includes('Permission') || errorMessage.includes('denied')) {
    return {
      type: GPSErrorType.PERMISSION_DENIED,
      message: errorMessage,
      userFriendlyMessage: 'Location permission not granted. Please grant location permission in app settings.',
      canRetry: false,
      requiresSettings: true,
    };
  }
  
  // Check for timeout
  if (errorMessage.includes('timeout') || errorMessage.includes('TIMEOUT') || errorMessage.includes('timed out')) {
    return {
      type: GPSErrorType.TIMEOUT,
      message: errorMessage,
      userFriendlyMessage: 'GPS signal timed out. You may be in an area with poor GPS signal. Please move to an open area.',
      canRetry: true,
      requiresSettings: false,
    };
  }
  
  // Check for weak signal
  if (errorMessage.includes('weak') || errorMessage.includes('signal') || errorMessage.includes('acquiring')) {
    return {
      type: GPSErrorType.WEAK_SIGNAL,
      message: errorMessage,
      userFriendlyMessage: 'GPS signal is weak. Please move to an open area or wait a few moments for GPS to acquire signal.',
      canRetry: true,
      requiresSettings: false,
    };
  }
  
  // Check for invalid data
  if (errorMessage.includes('Invalid location') || errorMessage.includes('Invalid coordinates') || errorMessage.includes('invalid')) {
    return {
      type: GPSErrorType.INVALID_DATA,
      message: errorMessage,
      userFriendlyMessage: 'Invalid GPS data received. This may indicate GPS signal is too weak. Please try again or move to an area with better signal.',
      canRetry: true,
      requiresSettings: false,
    };
  }
  
  // Check for hardware unavailable
  if (errorMessage.includes('hardware') || errorMessage.includes('not available') || errorMessage.includes('unavailable')) {
    return {
      type: GPSErrorType.HARDWARE_UNAVAILABLE,
      message: errorMessage,
      userFriendlyMessage: 'GPS hardware may not be available on this device. The app will use network location instead.',
      canRetry: false,
      requiresSettings: false,
    };
  }
  
  // Unknown error
  return {
    type: GPSErrorType.UNKNOWN,
    message: errorMessage,
    userFriendlyMessage: 'Failed to get your location. Possible issues:\n• GPS is disabled\n• Location permission denied\n• Poor GPS signal\n• Please check your location settings and try again',
    canRetry: true,
    requiresSettings: false,
  };
};

export interface GetCurrentLocationParams {
  showOverlay?: boolean;
  forceRefresh?: boolean;
  isFocused: boolean;
  hasInitializedMapRegion: boolean;
  lastKnownLocation: LocationCoords | null;
  lastLocationUpdateTime: number;
  isFetchingLocation: boolean;
  onSetLocation: (location: LocationCoords) => void;
  onSetRegion: (region: any) => void;
  onSetIsFollowingUser: (following: boolean) => void;
  onSetLocationPermissionGranted: (granted: boolean) => void;
  onSetIsGettingLocation: (getting: boolean) => void;
  onSetIsUserDrivenRegionChange: (driven: boolean) => void;
  onSetHasInitializedMapRegion: (initialized: boolean) => void;
  onUpdateLastKnownLocation: (location: LocationCoords) => void;
  onUpdateLastLocationUpdateTime: (time: number) => void;
  onSetIsFetchingLocation: (fetching: boolean) => void;
  mapRef: any;
  validateCoordinates: (coords: LocationCoords) => boolean;
}

/**
 * Get current location with caching and error handling
 */
export const getCurrentLocation = async (params: GetCurrentLocationParams): Promise<LocationCoords | null> => {
  const {
    showOverlay = true,
    forceRefresh = false,
    isFocused,
    hasInitializedMapRegion,
    lastKnownLocation,
    lastLocationUpdateTime,
    isFetchingLocation,
    onSetLocation,
    onSetRegion,
    onSetIsFollowingUser,
    onSetLocationPermissionGranted,
    onSetIsGettingLocation,
    onSetIsUserDrivenRegionChange,
    onSetHasInitializedMapRegion,
    onUpdateLastKnownLocation,
    onUpdateLastLocationUpdateTime,
    onSetIsFetchingLocation,
    mapRef,
    validateCoordinates,
  } = params;

  // Prevent duplicate requests
  if (isFetchingLocation && !forceRefresh) {
    return lastKnownLocation;
  }

  // Use cached location if available and recent (within 30 seconds)
  if (!forceRefresh && lastKnownLocation) {
    const cacheAge = Date.now() - lastLocationUpdateTime;
    if (cacheAge < LOCATION_CACHE_DURATION) {
      return lastKnownLocation;
    }
  }

  // Set loading state
  onSetIsFetchingLocation(true);
  onSetIsGettingLocation(true);
  onSetIsUserDrivenRegionChange(true);

  try {
    // Request permission
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      onSetLocationPermissionGranted(false);
      Alert.alert(
        'Location Permission Required',
        'This app needs location access to show your current position.',
        [{ text: 'OK' }]
      );
      return null;
    }

    onSetLocationPermissionGranted(true);
    
    // CRITICAL: Check GPS service status with retry mechanism and better error handling
    const gpsCheck = await checkGPSServiceStatus(3, 2000, 5000);
    
    if (!gpsCheck.isAvailable && !gpsCheck.canAttemptLocation) {
      // GPS is disabled - cannot proceed
      // Enhanced error message with specific guidance
      let detailedMessage = gpsCheck.message;
      
      if (gpsCheck.status === GPSServiceStatus.DISABLED) {
        detailedMessage = `${gpsCheck.message}\n\nTo fix this:\n• Open your device Settings\n• Go to Location/GPS settings\n• Enable Location Services\n• Make sure GPS is turned on\n• Then return to the app and try again`;
      } else if (gpsCheck.status === GPSServiceStatus.ACQUIRING) {
        detailedMessage = `${gpsCheck.message}\n\nTips to improve GPS signal:\n• Move to an open area (away from buildings)\n• Go outside or near a window\n• Wait 10-30 seconds for GPS to acquire signal\n• Make sure you're not in a basement or underground`;
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
      return null;
    }
    
    // If GPS is acquiring signal but we can still attempt, show a warning and use longer timeout
    const locationTimeout = gpsCheck.status === GPSServiceStatus.ACQUIRING ? 20000 : 15000;
    
    if (gpsCheck.status === GPSServiceStatus.ACQUIRING) {
      // Show a non-blocking toast with helpful information
      Toast.show({
        type: 'info',
        text1: 'GPS Signal Acquiring',
        text2: 'GPS is enabled but signal is weak. Please move to an open area or wait a moment...',
        visibilityTime: 4000,
      });
    }
    
    // Check GPS accuracy level if available
    try {
      const locationAccuracy = await Location.getProviderStatusAsync();
      if (locationAccuracy && !locationAccuracy.gpsAvailable) {
        // GPS hardware not available (rare case)
        Toast.show({
          type: 'error',
          text1: 'GPS Hardware Issue',
          text2: 'GPS hardware may not be available on this device. Using network location instead.',
          visibilityTime: 3000,
        });
      }
    } catch (accuracyError) {
      // Silently fail - accuracy check is optional
      if (__DEV__) {
        console.warn('[LocationUtils] Could not check GPS accuracy:', accuracyError);
      }
    }
    
    // Get location with balanced accuracy
    // Use Promise.race for timeout handling since timeout option might not be available
    const location = await Promise.race([
      Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      }),
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Location request timed out')), locationTimeout)
      ),
    ]);
    
    // Validate location
    if (!location?.coords?.latitude || !location?.coords?.longitude ||
        isNaN(location.coords.latitude) || isNaN(location.coords.longitude)) {
      throw new Error('Invalid location data');
    }
    
    const coords: LocationCoords = {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
    };
    
    // Validate coordinates
    if (!validateCoordinates(coords)) {
      throw new Error('Invalid coordinates');
    }
    
    // Update location
    onUpdateLastKnownLocation(coords);
    onUpdateLastLocationUpdateTime(Date.now());
    onSetLocation(coords);
    
    // Enable following user when location is obtained
    onSetIsFollowingUser(true);
    
    // CRITICAL: Only update map region/camera when screen is focused (Map tab is active)
    // Markers will still update in background, but map won't move
    if (isFocused && (forceRefresh || !hasInitializedMapRegion)) {
      onSetHasInitializedMapRegion(true);
      const newRegion = {
        latitude: coords.latitude,
        longitude: coords.longitude,
        latitudeDelta: 0.0015,
        longitudeDelta: 0.0015,
      };
      onSetRegion(newRegion);
      mapRef.current?.animateToRegion(newRegion, 1000);
    }
    
    return coords;
  } catch (error: any) {
    // Enhanced GPS error handling using helper function
    const gpsErrorInfo = getGPSErrorInfo(error);
    
    // Log detailed error for debugging
    if (__DEV__) {
      console.error('[LocationUtils] GPS Error Details:', {
        type: gpsErrorInfo.type,
        message: gpsErrorInfo.message,
        canRetry: gpsErrorInfo.canRetry,
        requiresSettings: gpsErrorInfo.requiresSettings,
        error: error,
      });
    }
    
    // Build detailed message with specific guidance
    let detailedMessage = gpsErrorInfo.userFriendlyMessage;
    
    // Add specific guidance based on error type
    if (gpsErrorInfo.type === GPSErrorType.DISABLED) {
      detailedMessage += '\n\nTo fix this:\n• Open your device Settings\n• Go to Location/GPS settings\n• Enable Location Services\n• Make sure GPS is turned on\n• Then return to the app and try again';
    } else if (gpsErrorInfo.type === GPSErrorType.PERMISSION_DENIED) {
      detailedMessage += '\n\nTo fix this:\n• Open your device Settings\n• Go to App Settings\n• Find this app and select it\n• Enable Location permission\n• Then return to the app and try again';
    } else if (gpsErrorInfo.type === GPSErrorType.TIMEOUT || gpsErrorInfo.type === GPSErrorType.WEAK_SIGNAL) {
      detailedMessage += '\n\nTips to improve GPS signal:\n• Move to an open area (away from buildings)\n• Go outside or near a window\n• Wait 10-30 seconds for GPS to acquire signal\n• Make sure you\'re not in a basement or underground\n• Try again in a few moments';
    } else if (gpsErrorInfo.type === GPSErrorType.INVALID_DATA) {
      detailedMessage += '\n\nThis usually means:\n• GPS signal is too weak\n• Location services are having issues\n• Please move to an area with better signal\n• Wait a moment and try again';
    }
    
    // Show appropriate error message
    const alertButtons: any[] = [
      {
        text: 'OK',
        style: 'default',
      },
    ];
    
    // Add retry button if retry is possible
    if (gpsErrorInfo.canRetry) {
      alertButtons.push({
        text: 'Retry',
        style: 'default',
        onPress: () => {
          // Retry will be handled by the caller if needed
          // The error is returned, so caller can decide to retry
        },
      });
    }
    
    // Show alert with detailed message
    Alert.alert(
      'GPS Location Error',
      detailedMessage,
      alertButtons
    );
    
    return null;
  } finally {
    onSetIsFetchingLocation(false);
    onSetIsGettingLocation(false);
    onSetIsUserDrivenRegionChange(false);
  }
};

