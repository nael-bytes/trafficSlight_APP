import { useCallback } from 'react';
import { Alert } from 'react-native';
import * as Location from 'expo-location';
import { startBackgroundLocationTracking, stopBackgroundLocationTracking } from './backgroundLocation';

export interface LocationCoords {
  latitude: number;
  longitude: number;
  address?: string;
}

export interface RouteData {
  id: string;
  distance: number;
  duration: number;
  fuelEstimate: number;
  trafficRate: number;
  coordinates: LocationCoords[];
  instructions?: string[];
}

export interface TripSummary {
  userId: string;
  motorId: string;
  distance: number;
  fuelUsed: number;
  timeArrived: string;
  eta: string;
  destination: string;
  startAddress?: string;
}

// Start navigation
export const startNavigation = async (
  selectedRoute: RouteData,
  currentLocation: LocationCoords,
  selectedMotor: any,
  setNavigationStartTime: (time: number) => void,
  setIsNavigating: (navigating: boolean) => void,
  setPathCoords: (coords: LocationCoords[]) => void,
  flowStateManager: (state: string) => void
): Promise<void> => {
  try {
    console.log('🚀 Starting navigation...');
    
    // Set navigation state
    setNavigationStartTime(Date.now());
    setIsNavigating(true);
    setPathCoords([currentLocation]);
    
    // Start background location tracking
    await startBackgroundLocationTracking();
    
    // Update flow state
    flowStateManager('navigating');
    
    console.log('✅ Navigation started successfully');
  } catch (error) {
    console.error('❌ Error starting navigation:', error);
    Alert.alert('Error', 'Failed to start navigation');
  }
};

// End navigation
export const endNavigation = async (
  arrived: boolean,
  isNavigating: boolean,
  navigationStartTime: number | null,
  pathCoords: LocationCoords[],
  selectedRoute: RouteData | null,
  selectedMotor: any,
  destination: LocationCoords | null,
  currentLocation: LocationCoords | null,
  setIsNavigating: (navigating: boolean) => void,
  setNavigationStartTime: (time: number | null) => void,
  setPathCoords: (coords: LocationCoords[]) => void,
  flowStateManager: (state: string) => void,
  saveTripSummaryToBackend: (summary: TripSummary, arrived: boolean, extras: any) => Promise<void>
): Promise<void> => {
  try {
    console.log('🛑 Ending navigation...');
    
    if (!isNavigating) return;
    
    // Stop background location tracking
    await stopBackgroundLocationTracking();
    
    // Calculate trip data
    const durationInMinutes = navigationStartTime 
      ? Math.floor((Date.now() - navigationStartTime) / 60000)
      : 0;
    
    const actualDistance = pathCoords.length > 1 
      ? calculateTotalPathDistance(pathCoords)
      : 0;
    
    // Create trip summary
    const tripSummary: TripSummary = {
      userId: selectedMotor?.userId || '',
      motorId: selectedMotor?._id || '',
      distance: actualDistance,
      fuelUsed: selectedRoute?.fuelEstimate || 0,
      timeArrived: new Date().toISOString(),
      eta: selectedRoute?.duration ? formatDuration(selectedRoute.duration) : '0m',
      destination: destination?.address || 'Unknown',
      startAddress: currentLocation?.address || 'Unknown',
    };
    
    // Save trip summary
    const extras = {
      startAddress: currentLocation?.address,
      estimatedFuel: {
        min: selectedRoute?.fuelEstimate * 0.9 || 0,
        max: selectedRoute?.fuelEstimate * 1.1 || 0,
        avg: selectedRoute?.fuelEstimate || 0,
      },
      actualFuel: {
        min: selectedRoute?.fuelEstimate * 0.9 || 0,
        max: selectedRoute?.fuelEstimate * 1.1 || 0,
        avg: selectedRoute?.fuelEstimate || 0,
      },
      actualDistance,
      pathCoords,
      plannedCoords: selectedRoute?.coordinates || [],
      wasRerouted: false,
      durationInMinutes,
    };
    
    await saveTripSummaryToBackend(tripSummary, arrived, extras);
    
    // Reset navigation state
    setIsNavigating(false);
    setNavigationStartTime(null);
    setPathCoords([]);
    
    // Update flow state
    flowStateManager('completed');
    
    console.log('✅ Navigation ended successfully');
  } catch (error) {
    console.error('❌ Error ending navigation:', error);
    Alert.alert('Error', 'Failed to end navigation');
  }
};

// Calculate total path distance
const calculateTotalPathDistance = (pathCoords: LocationCoords[]): number => {
  if (pathCoords.length < 2) return 0;
  
  let totalDistance = 0;
  for (let i = 1; i < pathCoords.length; i++) {
    const prev = pathCoords[i - 1];
    const curr = pathCoords[i];
    totalDistance += calculateDistance(
      prev.latitude,
      prev.longitude,
      curr.latitude,
      curr.longitude
    );
  }
  return totalDistance;
};

// Calculate distance between two points
const calculateDistance = (
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

// Format duration for display
const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
};

// Navigation handlers hook
export const useNavigationHandlers = (
  selectedRoute: RouteData | null,
  currentLocation: LocationCoords | null,
  selectedMotor: any,
  destination: LocationCoords | null,
  isNavigating: boolean,
  navigationStartTime: number | null,
  pathCoords: LocationCoords[],
  setNavigationStartTime: (time: number | null) => void,
  setIsNavigating: (navigating: boolean) => void,
  setPathCoords: (coords: LocationCoords[]) => void,
  flowStateManager: (state: string) => void,
  saveTripSummaryToBackend: (summary: TripSummary, arrived: boolean, extras: any) => Promise<void>
) => {
  
  const startNav = useCallback(async () => {
    if (!selectedRoute || !currentLocation || !selectedMotor) {
      Alert.alert('Error', 'Missing required information to start navigation');
      return;
    }
    
    await startNavigation(
      selectedRoute,
      currentLocation,
      selectedMotor,
      setNavigationStartTime,
      setIsNavigating,
      setPathCoords,
      flowStateManager
    );
  }, [selectedRoute, currentLocation, selectedMotor, setNavigationStartTime, setIsNavigating, setPathCoords, flowStateManager]);

  const endNav = useCallback(async (arrived: boolean = false) => {
    await endNavigation(
      arrived,
      isNavigating,
      navigationStartTime,
      pathCoords,
      selectedRoute,
      selectedMotor,
      destination,
      currentLocation,
      setIsNavigating,
      setNavigationStartTime,
      setPathCoords,
      flowStateManager,
      saveTripSummaryToBackend
    );
  }, [arrived, isNavigating, navigationStartTime, pathCoords, selectedRoute, selectedMotor, destination, currentLocation, setIsNavigating, setNavigationStartTime, setPathCoords, flowStateManager, saveTripSummaryToBackend]);

  return {
    startNavigation: startNav,
    endNavigation: endNav,
  };
};
