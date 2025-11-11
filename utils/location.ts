// Location utility functions
import * as Location from 'expo-location';

/**
 * GPS Service Status Types
 */
export enum GPSServiceStatus {
  ENABLED = 'enabled',
  DISABLED = 'disabled',
  ACQUIRING = 'acquiring', // GPS is enabled but signal not acquired yet
  TIMEOUT = 'timeout', // GPS check timed out
}

/**
 * Result of GPS service check
 */
export interface GPSServiceCheckResult {
  isAvailable: boolean;
  status: GPSServiceStatus;
  message: string;
  canAttemptLocation: boolean; // Whether we should still try to get location
}

/**
 * Check GPS service status with retry mechanism and better error handling
 * This function:
 * 1. Checks if location services are enabled
 * 2. Retries if GPS is still acquiring signal
 * 3. Attempts to get a test location to verify GPS is actually working
 * 4. Provides clear error messages
 * 
 * @param maxRetries - Maximum number of retries (default: 3)
 * @param retryDelay - Delay between retries in milliseconds (default: 2000)
 * @param testLocationTimeout - Timeout for test location request in milliseconds (default: 5000)
 * @returns Promise<GPSServiceCheckResult>
 */
export const checkGPSServiceStatus = async (
  maxRetries: number = 3,
  retryDelay: number = 2000,
  testLocationTimeout: number = 5000
): Promise<GPSServiceCheckResult> => {
  // First check: Is location service enabled according to the system?
  let servicesEnabled = await Location.hasServicesEnabledAsync();
  
  // If services are disabled, return immediately
  if (!servicesEnabled) {
    // But wait - sometimes the system check is wrong, so let's try once more after a short delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    servicesEnabled = await Location.hasServicesEnabledAsync();
    
    if (!servicesEnabled) {
      return {
        isAvailable: false,
        status: GPSServiceStatus.DISABLED,
        message: 'Location services (GPS) are disabled. Please enable GPS in your device settings.',
        canAttemptLocation: false,
      };
    }
  }

  // Second check: Try to get a test location to verify GPS is actually working
  // This helps distinguish between "GPS disabled" and "GPS signal not acquired yet"
  let locationAcquired = false;
  let attempts = 0;
  
  while (attempts < maxRetries && !locationAcquired) {
    try {
      // Attempt to get location with a short timeout
      const testLocation = await Promise.race([
        Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Low, // Use low accuracy for faster acquisition
        }),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('TIMEOUT')), testLocationTimeout)
        ),
      ]);

      // Validate location data
      if (testLocation?.coords?.latitude && testLocation?.coords?.longitude) {
        const lat = testLocation.coords.latitude;
        const lon = testLocation.coords.longitude;
        
        // Verify coordinates are valid
        if (
          typeof lat === 'number' &&
          typeof lon === 'number' &&
          !isNaN(lat) &&
          !isNaN(lon) &&
          lat >= -90 && lat <= 90 &&
          lon >= -180 && lon <= 180
        ) {
          locationAcquired = true;
        }
      }
    } catch (error: any) {
      attempts++;
      
      // Check if it's a timeout or permission error
      const errorMessage = error?.message || error?.toString() || '';
      
      if (errorMessage.includes('TIMEOUT') || errorMessage.includes('timeout')) {
        // GPS might be enabled but signal not acquired yet
        if (attempts < maxRetries) {
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          continue;
        } else {
          // After max retries, GPS might still be acquiring signal
          return {
            isAvailable: false,
            status: GPSServiceStatus.ACQUIRING,
            message: 'GPS is enabled but signal is not acquired yet. Please move to an area with better GPS signal or wait a few moments.',
            canAttemptLocation: true, // Still attempt location - might work with longer timeout
          };
        }
      } else if (errorMessage.includes('permission') || errorMessage.includes('Permission')) {
        return {
          isAvailable: false,
          status: GPSServiceStatus.DISABLED,
          message: 'Location permission not granted. Please grant location permission in app settings.',
          canAttemptLocation: false,
        };
      } else {
        // Other errors - might be temporary
        if (attempts < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          continue;
        }
      }
    }
  }

  // If we got here and location was acquired, GPS is working
  if (locationAcquired) {
    return {
      isAvailable: true,
      status: GPSServiceStatus.ENABLED,
      message: 'GPS is enabled and working.',
      canAttemptLocation: true,
    };
  }

  // If we couldn't acquire location after retries, but services are enabled
  // This likely means GPS signal is weak or not acquired yet
  return {
    isAvailable: false,
    status: GPSServiceStatus.ACQUIRING,
    message: 'GPS is enabled but signal is weak or not acquired yet. Please move to an area with better GPS signal.',
    canAttemptLocation: true, // Still attempt location - might work with longer timeout
  };
};

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param lat1 - First latitude
 * @param lon1 - First longitude
 * @param lat2 - Second latitude
 * @param lon2 - Second longitude
 * @returns Distance in kilometers
 */
export const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const R = 6371; // Earth's radius in km

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/**
 * Check if user is off route based on distance threshold
 * @param currentLoc - Current location
 * @param routeCoords - Route coordinates array
 * @param threshold - Distance threshold in meters (default: 50)
 * @returns boolean indicating if user is off route
 */
export const isUserOffRoute = (
  currentLoc: { latitude: number; longitude: number },
  routeCoords: { latitude: number; longitude: number }[],
  threshold = 50
): boolean => {
  if (!routeCoords || routeCoords.length === 0) return false;
  
  // Find the closest point on the route
  const distances = routeCoords.map(coord => 
    calculateDistance(
      currentLoc.latitude,
      currentLoc.longitude,
      coord.latitude,
      coord.longitude
    )
  );
  
  const minDistance = Math.min(...distances);
  return minDistance > (threshold / 1000); // Convert meters to km
};

/**
 * Calculate fuel range based on distance and efficiency
 * @param distance - Distance in kilometers
 * @param fuelEfficiency - Fuel efficiency in km/L
 * @returns Fuel required in liters
 */
export const calculateFuelRange = (distance: number, fuelEfficiency: number): number => {
  if (fuelEfficiency <= 0) return 0;
  return distance / fuelEfficiency;
};

/**
 * Format ETA from duration
 * @param duration - Duration in seconds
 * @returns Formatted time string
 */
export const formatETA = (duration: number): string => {
  const hours = Math.floor(duration / 3600);
  const minutes = Math.floor((duration % 3600) / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
};

/**
 * Validate coordinates
 * @param coords - Coordinates object
 * @returns boolean indicating if coordinates are valid
 */
export const validateCoordinates = (coords: any): boolean => {
  if (!coords || typeof coords !== 'object') return false;

  const { latitude, longitude } = coords;
  return (
    typeof latitude === 'number' &&
    typeof longitude === 'number' &&
    !isNaN(latitude) &&
    !isNaN(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
};

/**
 * Reverse geocode coordinates to get address
 * @param coords - Coordinates object with latitude and longitude
 * @returns Promise<string> - Formatted address string
 */
export const reverseGeocodeLocation = async (coords: { latitude: number; longitude: number }): Promise<string> => {
  try {
    // Request location permissions if not already granted
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      console.warn('Location permission not granted for reverse geocoding');
      return `${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)}`;
    }

    // Use expo-location's reverseGeocodeAsync
    const address = await Location.reverseGeocodeAsync({
      latitude: coords.latitude,
      longitude: coords.longitude,
    });

    if (address && address.length > 0) {
      const addr = address[0];
      // Format address components into a readable string
      const parts = [
        addr.streetNumber,
        addr.street,
        addr.city,
        addr.region,
        addr.postalCode,
        addr.country
      ].filter(Boolean);

      return parts.join(', ') || `${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)}`;
    }

    // Fallback to coordinates if geocoding fails
    return `${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)}`;
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    // Fallback to coordinates
    return `${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)}`;
  }
};
