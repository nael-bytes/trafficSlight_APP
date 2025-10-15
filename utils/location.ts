// Location utility functions
import * as Location from 'expo-location';

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
