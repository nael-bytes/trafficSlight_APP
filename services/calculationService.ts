// Calculation Service - Backend API calls for mathematical calculations
// Replaces heavy frontend calculations with optimized backend processing

const API_BASE = "https://ts-backend-1-jyit.onrender.com";

export interface DistanceCalculationRequest {
  coordinates: Array<{
    lat1: number;
    lon1: number;
    lat2: number;
    lon2: number;
  }>;
}

export interface DistanceCalculationResponse {
  distances: number[];
  totalDistance: number;
  processingTime: number;
}

export interface FuelCalculationRequest {
  motorData: {
    fuelEfficiency: number;
    fuelTank: number;
    currentLevel: number;
  };
  distanceTraveled: number;
  refuelData?: {
    amount: number;
    cost: number;
  };
}

export interface FuelCalculationResponse {
  newFuelLevel: number;
  fuelConsumed: number;
  remainingDistance: number;
  recommendations: string[];
}

export interface TripStatisticsRequest {
  routeCoordinates: Array<{ latitude: number; longitude: number }>;
  startTime: Date;
  endTime: Date;
  motorData: {
    fuelEfficiency: number;
    fuelTank: number;
  };
}

export interface TripStatisticsResponse {
  distance: number;
  duration: number;
  fuelConsumed: number;
  averageSpeed: number;
  processingTime: number;
}

/**
 * Calculate distances between coordinates using backend API
 * Replaces heavy frontend haversine calculations
 */
export const calculateDistance = async (
  coordinates: DistanceCalculationRequest['coordinates']
): Promise<DistanceCalculationResponse> => {
  try {
    const response = await fetch(`${API_BASE}/api/calculations/distance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ coordinates })
    });

    if (!response.ok) {
      throw new Error(`Distance calculation failed: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('[CalculationService] Distance calculation error:', error);
    throw error;
  }
};

/**
 * Calculate fuel consumption using backend API
 * Replaces heavy frontend fuel calculations
 */
export const calculateFuelConsumption = async (
  request: FuelCalculationRequest
): Promise<FuelCalculationResponse> => {
  try {
    const response = await fetch(`${API_BASE}/api/calculations/fuel-consumption`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      throw new Error(`Fuel calculation failed: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('[CalculationService] Fuel calculation error:', error);
    throw error;
  }
};

/**
 * Calculate trip statistics using backend API
 * Replaces heavy frontend trip analytics
 */
export const calculateTripStatistics = async (
  request: TripStatisticsRequest
): Promise<TripStatisticsResponse> => {
  try {
    const response = await fetch(`${API_BASE}/api/calculations/trip-statistics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      throw new Error(`Trip statistics calculation failed: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('[CalculationService] Trip statistics error:', error);
    throw error;
  }
};

/**
 * Batch calculate multiple distances for better performance
 */
export const batchCalculateDistances = async (
  coordinatePairs: Array<{ lat1: number; lon1: number; lat2: number; lon2: number }>
): Promise<number[]> => {
  try {
    const response = await calculateDistance(coordinatePairs);
    return response.distances;
  } catch (error) {
    console.error('[CalculationService] Batch distance calculation error:', error);
    throw error;
  }
};

/**
 * Calculate fuel level after refuel using backend API
 */
export const calculateFuelAfterRefuel = async (
  motorData: FuelCalculationRequest['motorData'],
  refuelAmount: number,
  refuelCost: number
): Promise<FuelCalculationResponse> => {
  try {
    const response = await calculateFuelConsumption({
      motorData,
      distanceTraveled: 0,
      refuelData: {
        amount: refuelAmount,
        cost: refuelCost
      }
    });
    return response;
  } catch (error) {
    console.error('[CalculationService] Fuel after refuel calculation error:', error);
    throw error;
  }
};
