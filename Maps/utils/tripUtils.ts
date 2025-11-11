/**
 * Trip Utilities
 * 
 * Handles all trip-related operations including:
 * - Trip data creation
 * - Trip saving
 * - Trip cancellation
 * - Trip recovery
 */

import { Alert } from 'react-native';
import Toast from 'react-native-toast-message';
import type { Motor, LocationCoords, RouteData, RideStats } from '../../types';

const API_BASE = "https://ts-backend-1-jyit.onrender.com";

export interface TripData {
  // Estimated (Planned)
  distance: number;
  fuelUsedMin: number;
  fuelUsedMax: number;
  eta: string | null;
  timeArrived: string | null;
  
  // Actual (Tracked)
  tripStartTime: Date;
  tripEndTime: Date;
  actualDistance: number;
  actualFuelUsedMin: number;
  actualFuelUsedMax: number;
  duration: number;
  kmph: number;
  
  // Location
  startLocation: {
    address: string;
    lat: number;
    lng: number;
  };
  endLocation: {
    address: string;
    lat: number;
    lng: number;
  };
  
  // Routing
  plannedPolyline: string | null;
  actualPolyline: string | null;
  wasRerouted: boolean;
  rerouteCount: number;
  
  // Background & Analytics
  wasInBackground: boolean;
  showAnalyticsModal: boolean;
  analyticsNotes: string;
  trafficCondition: 'low' | 'moderate' | 'high';
  
  // Trip Summary
  destination: string;
  isSuccessful: boolean;
  status: 'completed' | 'cancelled' | 'failed';
}

export interface CreateTripDataParams {
  tripEndTime: Date;
  rideStats: RideStats | null;
  routeCoordinates: LocationCoords[] | null;
  currentLocation: LocationCoords | null;
  destination: LocationCoords | null;
  startAddress: string;
  endAddress: string;
  selectedMotor: Motor | null;
  isBackgroundTracking: boolean;
  hasArrived?: boolean; // Whether destination was reached (for destination flow)
}

/**
 * Create trip data for modal display
 */
export const createTripDataForModal = (params: CreateTripDataParams): TripData => {
  const {
    tripEndTime,
    rideStats,
    routeCoordinates,
    currentLocation,
    destination,
    startAddress,
    endAddress,
    selectedMotor,
    isBackgroundTracking,
    hasArrived = false,
  } = params;

  // Ensure rideStats is always defined with safe defaults
  const safeRideStats = rideStats || {
    duration: 0,
    distance: 0,
    avgSpeed: 0,
    speed: 0,
  };
  
  // Ensure routeCoordinates is always an array
  const safeRouteCoordinates = Array.isArray(routeCoordinates) ? routeCoordinates : [];
  const startCoords = safeRouteCoordinates[0] || currentLocation;
  const endCoords = safeRouteCoordinates[safeRouteCoordinates.length - 1] || currentLocation;
  
  // Debug duration calculation (only in dev mode)
  if (__DEV__) {
    console.log('[TripData] Duration calculation debug:', {
      rideStatsDuration: safeRideStats.duration,
      rideStatsDurationType: typeof safeRideStats.duration,
      rideStatsDurationValid: !isNaN(safeRideStats.duration) && safeRideStats.duration > 0,
      calculatedDuration: Math.round((safeRideStats.duration || 0) / 60),
      rideStatsFull: safeRideStats,
      tripEndTime: tripEndTime.toISOString(),
      currentTime: Date.now()
    });
  }

  // Determine trip status based on destination and arrival
  // - Free drive (no destination): always successful
  // - Destination flow with arrival: successful
  // - Destination flow without arrival: incomplete (cancelled)
  const isFreeDrive = !destination;
  const isSuccessful = isFreeDrive || hasArrived;
  const tripStatus: 'completed' | 'cancelled' | 'failed' = isFreeDrive 
    ? 'completed' 
    : hasArrived 
      ? 'completed' 
      : 'cancelled';
  const timeArrivedValue = (destination && hasArrived) ? tripEndTime.toISOString() : null;
  
  return {
    // Estimated (Planned) - Default values for free drive
    distance: 0,
    fuelUsedMin: 0,
    fuelUsedMax: 0,
    eta: null,
    timeArrived: timeArrivedValue,
    
    // Actual (Tracked) - Real data from tracking with safe defaults
    tripStartTime: new Date(tripEndTime.getTime() - ((safeRideStats.duration || 0) * 1000)), // Calculate start time
    tripEndTime: tripEndTime, // Use the fixed end time
    actualDistance: safeRideStats.distance || 0,
    actualFuelUsedMin: 0,
    actualFuelUsedMax: 0,
    duration: safeRideStats.duration > 0 ? Math.round(safeRideStats.duration / 60) : 0,
    kmph: safeRideStats.avgSpeed || 0,
    
    // Location
    startLocation: {
      address: startAddress || "Start Location",
      lat: startCoords?.latitude || 0,
      lng: startCoords?.longitude || 0,
    },
    endLocation: {
      address: destination ? 
        (destination.formatted_address || destination.name || "Destination") : 
        (endAddress || "End Location"),
      lat: destination ? 
        destination.latitude : 
        (endCoords?.latitude || 0),
      lng: destination ? 
        destination.longitude : 
        (endCoords?.longitude || 0),
    },
    
    // Routing
    plannedPolyline: null,
    actualPolyline: safeRouteCoordinates.length > 0 ? JSON.stringify(safeRouteCoordinates) : null,
    wasRerouted: false,
    rerouteCount: 0,
    
    // Background & Analytics
    wasInBackground: isBackgroundTracking,
    showAnalyticsModal: false,
    analyticsNotes: `Free drive completed with ${selectedMotor?.nickname || 'motor'}`,
    trafficCondition: "moderate" as const,
    
    // Trip Summary
    destination: destination ? 
      (destination.formatted_address || destination.name || "Selected Destination") : 
      "Free Drive",
    isSuccessful: isSuccessful,
    status: tripStatus,
  };
};

export interface SaveTripParams {
  tripData: TripData;
  user: { _id: string; token?: string };
  selectedMotor: Motor;
  rideStats: RideStats | null;
  routeCoordinates: LocationCoords[] | null;
  currentLocation: LocationCoords | null;
  startAddress: string;
  endAddress: string;
}

/**
 * Save trip to backend
 */
export const saveTripToBackend = async (params: SaveTripParams): Promise<void> => {
  const {
    tripData,
    user,
    selectedMotor,
    rideStats,
    routeCoordinates,
    currentLocation,
    startAddress,
    endAddress,
  } = params;

  // Validate required fields
  if (!user._id) {
    throw new Error('User ID is required');
  }
  if (!selectedMotor._id) {
    throw new Error('Motor ID is required');
  }
  
  // Ensure rideStats is defined with safe defaults
  const safeRideStats = rideStats || {
    duration: 0,
    distance: 0,
    avgSpeed: 0,
    speed: 0,
  };
  
  // For free drive, allow very small distances (even 0) as it's valid
  // Only reject if distance is negative or undefined
  if (safeRideStats.distance === undefined || safeRideStats.distance === null || safeRideStats.distance < 0) {
    throw new Error('Invalid distance data');
  }
  
  // Optional: Warn if distance is very small (less than 10 meters)
  if (safeRideStats.distance < 0.01) {
    console.warn('[TripSave] Very small distance detected:', safeRideStats.distance, 'km');
  }
  
  // Ensure routeCoordinates is always an array
  const safeRouteCoordinatesForSave = Array.isArray(routeCoordinates) ? routeCoordinates : [];
  
  const tripPayload = {
    // Required fields
    userId: user._id,
    motorId: selectedMotor._id,
    destination: tripData.destination || "Free Drive",
    
    // Estimated (Planned)
    distance: tripData.distance || 0,
    fuelUsedMin: tripData.fuelUsedMin || 0,
    fuelUsedMax: tripData.fuelUsedMax || 0,
    eta: tripData.eta || null,
    timeArrived: tripData.timeArrived || null,
    
    // Actual (Tracked)
    tripStartTime: tripData.tripStartTime || new Date(),
    tripEndTime: tripData.tripEndTime || new Date(),
    actualDistance: tripData.actualDistance || safeRideStats.distance || 0,
    actualFuelUsedMin: tripData.actualFuelUsedMin || 0,
    actualFuelUsedMax: tripData.actualFuelUsedMax || 0,
    duration: tripData.duration || Math.round((safeRideStats.duration || 0) / 60),
    kmph: tripData.kmph || safeRideStats.avgSpeed || 0,
    
    // Location
    startLocation: tripData.startLocation || {
      address: startAddress || "Start Location",
      lat: safeRouteCoordinatesForSave[0]?.latitude || currentLocation?.latitude || 0,
      lng: safeRouteCoordinatesForSave[0]?.longitude || currentLocation?.longitude || 0,
    },
    endLocation: tripData.endLocation || {
      address: endAddress || "End Location",
      lat: safeRouteCoordinatesForSave[safeRouteCoordinatesForSave.length - 1]?.latitude || currentLocation?.latitude || 0,
      lng: safeRouteCoordinatesForSave[safeRouteCoordinatesForSave.length - 1]?.longitude || currentLocation?.longitude || 0,
    },
    
    // Routing
    plannedPolyline: tripData.plannedPolyline || null,
    actualPolyline: tripData.actualPolyline || (safeRouteCoordinatesForSave.length > 0 ? JSON.stringify(safeRouteCoordinatesForSave) : null),
    wasRerouted: tripData.wasRerouted || false,
    rerouteCount: tripData.rerouteCount || 0,
    
    // Background & Analytics
    wasInBackground: tripData.wasInBackground || false,
    showAnalyticsModal: tripData.showAnalyticsModal || false,
    analyticsNotes: tripData.analyticsNotes || `Free drive completed with ${selectedMotor.nickname}`,
    trafficCondition: tripData.trafficCondition || "moderate",
    
    // Trip Summary
    isSuccessful: tripData.isSuccessful || true,
    status: tripData.status || "completed",
  };

  console.log('[TripSave] Sending trip data to API:', {
    url: `${API_BASE}/api/trips`,
    method: 'POST',
    hasToken: !!user.token,
    tripDataKeys: Object.keys(tripPayload)
  });

  const response = await fetch(`${API_BASE}/api/trips`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${user.token || ''}`,
    },
    body: JSON.stringify(tripPayload),
  });

  console.log('[TripSave] API Response:', {
    status: response.status,
    statusText: response.statusText,
    ok: response.ok
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[TripSave] API Error Response:', errorText);
    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }

  const responseData = await response.json();
  console.log('[TripSave] ✅ Trip saved successfully:', responseData);
  
  return responseData;
};

/**
 * Cancel trip and reset state
 */
export interface CancelTripParams {
  selectedMotor: Motor | null;
  rideStats: RideStats | null;
  updateFuelLevel: (motorId: string, fuelLevel: number) => Promise<void>;
  resetTracking: () => void;
  clearTripData: () => Promise<void>;
}

export const cancelTrip = async (params: CancelTripParams): Promise<void> => {
  const {
    selectedMotor,
    rideStats,
    updateFuelLevel,
    resetTracking,
    clearTripData,
  } = params;

  // Update fuel level to backend even if trip is cancelled
  const safeRideStats = rideStats || { duration: 0, distance: 0, avgSpeed: 0, speed: 0 };
  if (selectedMotor && safeRideStats.distance > 0) {
    try {
      console.log('[TripUtils] Updating fuel level to backend after trip cancellation:', {
        motorId: selectedMotor._id,
        currentFuelLevel: selectedMotor.currentFuelLevel,
        distanceTraveled: safeRideStats.distance,
        timestamp: new Date().toISOString()
      });
      
      await updateFuelLevel(selectedMotor._id, selectedMotor.currentFuelLevel);
      console.log('[TripUtils] ✅ Fuel level updated to backend after trip cancellation');
    } catch (error: any) {
      console.warn('[TripUtils] ❌ Failed to update fuel level to backend after cancellation:', {
        motorId: selectedMotor._id,
        currentFuelLevel: selectedMotor.currentFuelLevel,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  // Clear trip cache
  await clearTripData();

  // Reset tracking without saving
  resetTracking();
};

