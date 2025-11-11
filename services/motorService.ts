// Motor Service - Backend API calls for motor analytics and statistics
// Replaces heavy frontend motor analytics processing with optimized backend processing

const API_BASE = "https://ts-backend-1-jyit.onrender.com";

export interface MotorOverviewResponse {
  motorId: string;
  totalMotors: number;
  totalDistance: number;
  totalFuelUsed: number;
  averageEfficiency: number;
  trips: number;
  maintenanceRecords: number;
  fuelLogs: number;
}

export interface FuelStatsResponse {
  motorId: string;
  totalLiters: number;
  totalCost: number;
  averagePrice: number;
  averageEfficiency: number;
  totalDistance: number;
}

export interface MaintenanceAnalyticsResponse {
  totalRecords: number;
  totalCost: number;
  byType: {
    oil_change: number;
    tire_rotation: number;
    brake_service: number;
    refuel: number;
    tune_up: number;
    other: number;
  };
  upcomingServices: Array<{
    motorId: string;
    nextServiceDate: string;
    type: string;
  }>;
}

/**
 * Get motor overview analytics using backend API
 * Uses: GET /api/user-motors/motor-overview/:motorId
 * Replaces heavy frontend motor analytics calculations
 */
export const getMotorOverview = async (
  motorId: string
): Promise<MotorOverviewResponse> => {
  try {
    const response = await fetch(`${API_BASE}/api/user-motors/motor-overview/${motorId}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
      throw new Error(`Motor overview failed: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('[MotorService] Motor overview error:', error);
    throw error;
  }
};

/**
 * Get fuel statistics for a motor using backend API
 * Uses: GET /api/fuel-stats/:motorId
 * Replaces heavy frontend fuel stats calculations
 */
export const getFuelStats = async (
  motorId: string
): Promise<FuelStatsResponse> => {
  try {
    const response = await fetch(`${API_BASE}/api/fuel-stats/${motorId}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
      throw new Error(`Fuel stats failed: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('[MotorService] Fuel stats error:', error);
    throw error;
  }
};

/**
 * Get user overview analytics using backend API
 * Uses: GET /api/user-motors/user-overview/:userId
 */
export const getUserOverview = async (
  userId: string
): Promise<{
  userId: string;
  totalMotors: number;
  totalDistance: number;
  totalFuelUsed: number;
  averageEfficiency: number;
}> => {
  try {
    const response = await fetch(`${API_BASE}/api/user-motors/user-overview/${userId}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
      throw new Error(`User overview failed: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('[MotorService] User overview error:', error);
    throw error;
  }
};

/**
 * Get maintenance analytics using backend API
 * Uses: GET /api/maintenance-records/analytics/summary?userId=user_id
 * Replaces heavy frontend maintenance analytics calculations
 */
export const getMaintenanceAnalytics = async (
  userId: string,
  motorId?: string
): Promise<MaintenanceAnalyticsResponse> => {
  try {
    const queryParams = new URLSearchParams({ userId });
    if (motorId) {
      queryParams.append('motorId', motorId);
    }

    const response = await fetch(`${API_BASE}/api/maintenance-records/analytics/summary?${queryParams}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
      throw new Error(`Maintenance analytics failed: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('[MotorService] Maintenance analytics error:', error);
    throw error;
  }
};

/**
 * Get comprehensive motor analytics (combines multiple endpoints)
 * Replaces heavy frontend analytics processing
 */
export const getMotorAnalytics = async (
  motorId: string,
  userId: string
): Promise<{
  overview: MotorOverviewResponse;
  fuelStats: FuelStatsResponse;
  maintenance: MaintenanceAnalyticsResponse;
}> => {
  try {
    const [overview, fuelStats, maintenance] = await Promise.allSettled([
      getMotorOverview(motorId),
      getFuelStats(motorId),
      getMaintenanceAnalytics(userId, motorId)
    ]);

    return {
      overview: overview.status === 'fulfilled' ? overview.value : {} as MotorOverviewResponse,
      fuelStats: fuelStats.status === 'fulfilled' ? fuelStats.value : {} as FuelStatsResponse,
      maintenance: maintenance.status === 'fulfilled' ? maintenance.value : {} as MaintenanceAnalyticsResponse
    };
  } catch (error) {
    console.error('[MotorService] Comprehensive motor analytics error:', error);
    throw error;
  }
};


