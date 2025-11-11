// Fuel Service - Backend API calls for fuel calculations and data combination
// Replaces heavy frontend fuel processing with optimized backend processing

const API_BASE = "https://ts-backend-1-jyit.onrender.com";

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
  processingTime: number;
}

export interface CombineFuelDataRequest {
  fuelLogs: any[];
  maintenanceRecords: any[];
  userId: string;
}

export interface CombineFuelDataResponse {
  combinedData: any[];
  statistics: {
    fuelLogsCount: number;
    maintenanceRefuelsCount: number;
    totalRecords: number;
    processingTime: number;
  };
  performance: {
    originalDataSize: number;
    processedDataSize: number;
    transformationTime: number;
  };
}

export interface FuelAfterRefuelRequest {
  motorData: {
    fuelEfficiency: number;
    fuelTank: number;
    currentLevel: number;
  };
  refuelAmount: number;
  refuelCost: number;
}

export interface DrivableDistanceRequest {
  motorData: {
    fuelEfficiency: number;
    fuelTank: number;
    currentLevel: number;
  };
}

export interface DrivableDistanceResponse {
  totalDrivableDistance: number;
  currentDrivableDistance: number;
  fuelEfficiency: number;
  tankCapacity: number;
  processingTime: number;
}

/**
 * Calculate fuel consumption using backend API
 * Replaces heavy frontend fuel calculations
 */
export const calculateFuelConsumption = async (
  request: FuelCalculationRequest
): Promise<FuelCalculationResponse> => {
  try {
    const response = await fetch(`${API_BASE}/api/fuel/calculate`, {
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
    console.error('[FuelService] Fuel calculation error:', error);
    throw error;
  }
};

/**
 * Get combined fuel data using backend API
 * Replaces heavy frontend data transformation
 * Uses: GET /api/fuel/combined?userId=user_id&motorId=motor_id
 * 
 * NOTE: If endpoint doesn't exist (404), returns null to indicate fallback needed
 */
export const combineFuelData = async (
  userId: string,
  motorId?: string
): Promise<CombineFuelDataResponse | null> => {
  try {
    const queryParams = new URLSearchParams({
      userId,
      ...(motorId && { motorId })
    });

    const response = await fetch(`${API_BASE}/api/fuel/combined?${queryParams}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    // If endpoint doesn't exist (404), return null to trigger fallback
    if (response.status === 404) {
      if (__DEV__) {
        console.warn('[FuelService] /api/fuel/combined endpoint not available (404). Falling back to frontend processing.');
      }
      return null;
    }

    if (!response.ok) {
      // For other errors, also return null to trigger fallback
      if (__DEV__) {
        console.warn(`[FuelService] Fuel data combination failed: ${response.status}. Falling back to frontend processing.`);
      }
      return null;
    }

    const data = await response.json();
    return {
      combinedData: data.combinedData || data.fuelLogs || [],
      statistics: data.statistics || {},
      performance: data.performance || {}
    };
  } catch (error) {
    // Network errors or other issues - return null to trigger fallback
    if (__DEV__) {
      console.warn('[FuelService] Fuel data combination error. Falling back to frontend processing:', error);
    }
    return null;
  }
};

/**
 * Legacy method for backward compatibility
 * Combines fuel logs and maintenance records (deprecated - use combineFuelData instead)
 */
export const combineFuelDataLegacy = async (
  request: CombineFuelDataRequest
): Promise<CombineFuelDataResponse> => {
  // Use the new API endpoint instead
  return combineFuelData(request.userId);
};

/**
 * Calculate fuel level after refuel using backend API
 * Replaces heavy frontend refuel calculations
 */
export const calculateFuelAfterRefuel = async (
  request: FuelAfterRefuelRequest
): Promise<FuelCalculationResponse> => {
  try {
    const response = await fetch(`${API_BASE}/api/fuel/calculate-after-refuel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      throw new Error(`Fuel after refuel calculation failed: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('[FuelService] Fuel after refuel calculation error:', error);
    throw error;
  }
};

/**
 * Calculate drivable distance using backend API
 * Replaces heavy frontend distance calculations
 */
export const calculateDrivableDistance = async (
  request: DrivableDistanceRequest
): Promise<DrivableDistanceResponse> => {
  try {
    const response = await fetch(`${API_BASE}/api/fuel/calculate-drivable-distance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      throw new Error(`Drivable distance calculation failed: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('[FuelService] Drivable distance calculation error:', error);
    throw error;
  }
};

/**
 * Calculate new fuel level after distance traveled
 * Simplified wrapper for common use case
 */
export const calculateNewFuelLevel = async (
  motor: any,
  distanceTraveled: number
): Promise<number> => {
  try {
    const response = await calculateFuelConsumption({
      motorData: {
        fuelEfficiency: motor.fuelEfficiency || motor.fuelConsumption,
        fuelTank: motor.fuelTank,
        currentLevel: motor.currentFuelLevel
      },
      distanceTraveled
    });

    return response.newFuelLevel;
  } catch (error) {
    console.error('[FuelService] New fuel level calculation error:', error);
    throw error;
  }
};

/**
 * Calculate fuel level after refuel
 * Simplified wrapper for common use case
 */
export const calculateFuelLevelAfterRefuel = async (
  motor: any,
  refuelAmount: number,
  refuelCost: number
): Promise<number> => {
  try {
    const response = await calculateFuelAfterRefuel({
      motorData: {
        fuelEfficiency: motor.fuelEfficiency || motor.fuelConsumption,
        fuelTank: motor.fuelTank,
        currentLevel: motor.currentFuelLevel
      },
      refuelAmount,
      refuelCost
    });

    return response.newFuelLevel;
  } catch (error) {
    console.error('[FuelService] Fuel level after refuel calculation error:', error);
    throw error;
  }
};

/**
 * Get fuel recommendations based on current level
 * Uses backend analytics for better recommendations
 */
export const getFuelRecommendations = async (
  motor: any,
  currentLocation?: { latitude: number; longitude: number }
): Promise<string[]> => {
  try {
    const response = await calculateFuelConsumption({
      motorData: {
        fuelEfficiency: motor.fuelEfficiency || motor.fuelConsumption,
        fuelTank: motor.fuelTank,
        currentLevel: motor.currentFuelLevel
      },
      distanceTraveled: 0
    });

    return response.recommendations;
  } catch (error) {
    console.error('[FuelService] Fuel recommendations error:', error);
    return ['Unable to get recommendations at this time'];
  }
};

/**
 * Batch process multiple fuel calculations for better performance
 */
export const batchCalculateFuel = async (
  calculations: Array<{
    motor: any;
    distanceTraveled: number;
  }>
): Promise<Array<{ newFuelLevel: number; fuelConsumed: number }>> => {
  try {
    const promises = calculations.map(calc => 
      calculateFuelConsumption({
        motorData: {
          fuelEfficiency: calc.motor.fuelEfficiency || calc.motor.fuelConsumption,
          fuelTank: calc.motor.fuelTank,
          currentLevel: calc.motor.currentFuelLevel
        },
        distanceTraveled: calc.distanceTraveled
      })
    );

    const results = await Promise.all(promises);
    return results.map(result => ({
      newFuelLevel: result.newFuelLevel,
      fuelConsumed: result.fuelConsumed
    }));
  } catch (error) {
    console.error('[FuelService] Batch fuel calculation error:', error);
    throw error;
  }
};
