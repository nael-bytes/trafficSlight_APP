// Trip Service - Backend API calls for trip processing and analytics
// Replaces heavy frontend trip processing with optimized backend processing

const API_BASE = "https://ts-backend-1-jyit.onrender.com";

export interface CalculateTripStatisticsRequest {
  tripData: any;
  motorData: {
    fuelEfficiency: number;
    fuelTank: number;
  };
  locationData: any;
}

export interface CalculateTripStatisticsResponse {
  duration: number;
  distance: number;
  fuelLevel: number;
  efficiency: number;
  maintenanceAlerts: string[];
  recommendations: string[];
  processingTime: number;
}

export interface GenerateTripSummaryRequest {
  tripData: any;
  motorData: {
    fuelEfficiency: number;
    fuelTank: number;
  };
  locationData: any;
  maintenanceData: any;
}

export interface GenerateTripSummaryResponse {
  summary: {
    basicSummary: any;
    analytics: any;
    maintenance: any;
    recommendations: any;
    performance: any;
  };
  processingTime: number;
}

export interface ManageTripCacheRequest {
  action: 'save' | 'recover' | 'complete' | 'clear';
  tripData: any;
  userId: string;
  options?: {
    includeValidation?: boolean;
    includeOptimization?: boolean;
    includeBackup?: boolean;
  };
}

export interface ManageTripCacheResponse {
  success: boolean;
  tripData: any;
  cacheInfo: any;
  performance: {
    action: string;
    processingTime: number;
    dataSize: number;
  };
}

/**
 * Calculate trip statistics using backend API
 * Replaces heavy frontend trip analytics
 */
export const calculateTripStatistics = async (
  request: CalculateTripStatisticsRequest
): Promise<CalculateTripStatisticsResponse> => {
  try {
    const response = await fetch(`${API_BASE}/api/trip/calculate-statistics`, {
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
    console.error('[TripService] Trip statistics error:', error);
    throw error;
  }
};

/**
 * Generate trip summary using backend API
 * Replaces heavy frontend trip summary generation
 */
export const generateTripSummary = async (
  request: GenerateTripSummaryRequest
): Promise<GenerateTripSummaryResponse> => {
  try {
    const response = await fetch(`${API_BASE}/api/trip/summary-analysis`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      throw new Error(`Trip summary generation failed: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('[TripService] Trip summary error:', error);
    throw error;
  }
};

/**
 * Manage trip cache using backend API
 * Replaces heavy frontend trip cache management
 */
export const manageTripCache = async (
  request: ManageTripCacheRequest
): Promise<ManageTripCacheResponse> => {
  try {
    const response = await fetch(`${API_BASE}/api/trip/cache-management`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      throw new Error(`Trip cache management failed: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('[TripService] Trip cache management error:', error);
    throw error;
  }
};

/**
 * Save trip data using backend API
 * Simplified wrapper for saving trip data
 */
export const saveTripData = async (
  tripData: any,
  userId: string,
  options: any = {}
): Promise<boolean> => {
  try {
    const response = await manageTripCache({
      action: 'save',
      tripData,
      userId,
      options: {
        includeValidation: true,
        includeOptimization: true,
        includeBackup: true,
        ...options
      }
    });

    return response.success;
  } catch (error) {
    console.error('[TripService] Save trip data error:', error);
    throw error;
  }
};

/**
 * Recover trip data using backend API
 * Simplified wrapper for recovering trip data
 */
export const recoverTrip = async (
  tripId: string,
  userId: string
): Promise<any> => {
  try {
    const response = await manageTripCache({
      action: 'recover',
      tripData: { tripId },
      userId,
      options: {
        includeValidation: true,
        includeOptimization: true
      }
    });

    return response.tripData;
  } catch (error) {
    console.error('[TripService] Recover trip error:', error);
    throw error;
  }
};

/**
 * Complete trip using backend API
 * Simplified wrapper for completing trip
 */
export const completeTrip = async (
  tripData: any,
  userId: string
): Promise<boolean> => {
  try {
    const response = await manageTripCache({
      action: 'complete',
      tripData,
      userId,
      options: {
        includeValidation: true,
        includeOptimization: true,
        includeBackup: true
      }
    });

    return response.success;
  } catch (error) {
    console.error('[TripService] Complete trip error:', error);
    throw error;
  }
};

/**
 * Clear trip cache using backend API
 * Simplified wrapper for clearing trip cache
 */
export const clearTripCache = async (
  userId: string
): Promise<boolean> => {
  try {
    const response = await manageTripCache({
      action: 'clear',
      tripData: {},
      userId,
      options: {
        includeValidation: false,
        includeOptimization: false,
        includeBackup: false
      }
    });

    return response.success;
  } catch (error) {
    console.error('[TripService] Clear trip cache error:', error);
    throw error;
  }
};

/**
 * Get trip analytics using backend API
 * Provides comprehensive trip analytics
 */
export const getTripAnalytics = async (
  tripData: any,
  motorData: any,
  locationData: any
): Promise<{
  statistics: CalculateTripStatisticsResponse;
  summary: GenerateTripSummaryResponse;
}> => {
  try {
    const [statistics, summary] = await Promise.all([
      calculateTripStatistics({
        tripData,
        motorData,
        locationData
      }),
      generateTripSummary({
        tripData,
        motorData,
        locationData,
        maintenanceData: tripData.maintenanceActions || []
      })
    ]);

    return { statistics, summary };
  } catch (error) {
    console.error('[TripService] Trip analytics error:', error);
    throw error;
  }
};

/**
 * Format trip time using backend API
 * Replaces heavy frontend time formatting
 */
export const formatTripTime = async (
  seconds: number
): Promise<string> => {
  try {
    // For now, use frontend formatting as fallback
    // This should be replaced with backend API call when available
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    } else {
      return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
  } catch (error) {
    console.error('[TripService] Time formatting error:', error);
    return '0:00';
  }
};

/**
 * Get trip recommendations using backend API
 * Uses backend analytics for better recommendations
 */
export const getTripRecommendations = async (
  tripData: any,
  motorData: any
): Promise<string[]> => {
  try {
    const response = await generateTripSummary({
      tripData,
      motorData,
      locationData: tripData.locationData || [],
      maintenanceData: tripData.maintenanceActions || []
    });

    return response.summary.recommendations || [];
  } catch (error) {
    console.error('[TripService] Trip recommendations error:', error);
    return ['Unable to get recommendations at this time'];
  }
};

/**
 * Batch process multiple trips for better performance
 */
export const batchProcessTrips = async (
  trips: Array<{
    tripData: any;
    motorData: any;
    locationData: any;
  }>
): Promise<Array<{
  statistics: CalculateTripStatisticsResponse;
  summary: GenerateTripSummaryResponse;
}>> => {
  try {
    const promises = trips.map(trip => getTripAnalytics(
      trip.tripData,
      trip.motorData,
      trip.locationData
    ));

    const results = await Promise.all(promises);
    return results;
  } catch (error) {
    console.error('[TripService] Batch trip processing error:', error);
    throw error;
  }
};
