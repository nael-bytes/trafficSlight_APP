import { Alert } from 'react-native';

export interface LocationCoords {
  latitude: number;
  longitude: number;
  address?: string;
}

// Check if user is off route
export const isUserOffRoute = (
  currentLoc: LocationCoords,
  routeCoords: LocationCoords[],
  threshold = 50
): boolean => {
  return !routeCoords.some((coord) => {
    const dx = currentLoc.latitude - coord.latitude;
    const dy = currentLoc.longitude - coord.longitude;
    const dist = Math.sqrt(dx * dx + dy * dy) * 111139;
    return dist < threshold;
  });
};

// Format ETA time
export const formatETA = (duration: number): string => {
  const eta = new Date(Date.now() + duration * 1000);
  return eta.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};

// Get traffic label from rate
export const getTrafficLabel = (rate: number): string => {
  if (rate < 1.1) return "Light";
  if (rate < 1.3) return "Moderate";
  if (rate < 1.5) return "Heavy";
  if (rate < 2.0) return "Very Heavy";
  return "Extreme";
};

// Calculate distance between two points
export const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371; // Radius of the Earth in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

// Validate coordinates
export const validateCoordinates = (coords: LocationCoords): boolean => {
  return (
    coords &&
    typeof coords.latitude === 'number' &&
    typeof coords.longitude === 'number' &&
    coords.latitude >= -90 &&
    coords.latitude <= 90 &&
    coords.longitude >= -180 &&
    coords.longitude <= 180 &&
    !isNaN(coords.latitude) &&
    !isNaN(coords.longitude)
  );
};

// Get region from coordinates
export const getRegionFromCoordinates = (
  coordinates: LocationCoords[],
  padding = 0.01
) => {
  if (coordinates.length === 0) {
    return {
      latitude: 14.6042,
      longitude: 120.9822,
      latitudeDelta: 0.0922,
      longitudeDelta: 0.0421,
    };
  }

  const latitudes = coordinates.map(coord => coord.latitude);
  const longitudes = coordinates.map(coord => coord.longitude);

  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const minLng = Math.min(...longitudes);
  const maxLng = Math.max(...longitudes);

  const centerLat = (minLat + maxLat) / 2;
  const centerLng = (minLng + maxLng) / 2;

  const deltaLat = Math.max(maxLat - minLat, padding);
  const deltaLng = Math.max(maxLng - minLng, padding);

  return {
    latitude: centerLat,
    longitude: centerLng,
    latitudeDelta: deltaLat,
    longitudeDelta: deltaLng,
  };
};

// Animate to region
export const animateToRegion = (
  mapRef: React.RefObject<any>,
  region: any,
  duration = 1000
) => {
  if (mapRef.current) {
    mapRef.current.animateToRegion(region, duration);
  }
};

// Check if location is within bounds
export const isLocationInBounds = (
  location: LocationCoords,
  bounds: {
    northeast: LocationCoords;
    southwest: LocationCoords;
  }
): boolean => {
  return (
    location.latitude >= bounds.southwest.latitude &&
    location.latitude <= bounds.northeast.latitude &&
    location.longitude >= bounds.southwest.longitude &&
    location.longitude <= bounds.northeast.longitude
  );
};

// Get bearing between two points
export const getBearing = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const lat1Rad = lat1 * Math.PI / 180;
  const lat2Rad = lat2 * Math.PI / 180;

  const y = Math.sin(dLon) * Math.cos(lat2Rad);
  const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - 
            Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);

  let bearing = Math.atan2(y, x) * 180 / Math.PI;
  return (bearing + 360) % 360;
};

// Format distance for display
export const formatDistance = (distance: number): string => {
  if (distance < 1) {
    return `${Math.round(distance * 1000)}m`;
  }
  return `${distance.toFixed(1)}km`;
};

// Format duration for display
export const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
};
