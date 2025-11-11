// Route Service - Backend API calls for route processing and traffic analysis
// Replaces heavy frontend route processing with optimized backend processing

const API_BASE = "https://ts-backend-1-jyit.onrender.com";

export interface ProcessDirectionsRequest {
  origin: { latitude: number; longitude: number };
  destination: { latitude: number; longitude: number };
  motorData: {
    fuelEfficiency: number;
    fuelTank: number;
  };
  options?: {
    alternatives?: boolean;
    trafficModel?: string;
    avoid?: string[];
  };
}

export interface ProcessDirectionsResponse {
  routes: Array<{
    id: string;
    distance: number;
    duration: number;
    fuelEstimate: number;
    trafficRate: number;
    coordinates: Array<{ latitude: number; longitude: number }>;
  }>;
  mainRoute: any;
  alternatives: any[];
  fuelEstimates: any[];
  trafficAnalysis: any;
  performance: {
    routesProcessed: number;
    processingTime: number;
    apiCalls: number;
  };
}

export interface ProcessTrafficAnalysisRequest {
  routes: any[];
  motorData: {
    fuelEfficiency: number;
    fuelTank: number;
  };
  options?: {
    includeFuelCalculations?: boolean;
    includeTrafficAnalysis?: boolean;
    includePolylineDecoding?: boolean;
    includeSafetyMetrics?: boolean;
  };
}

export interface ProcessTrafficAnalysisResponse {
  routes: any[];
  trafficAnalysis: any;
  fuelEstimates: any[];
  safetyMetrics: any;
  performance: {
    routesProcessed: number;
    processingTime: number;
    polylineDecodingTime: number;
  };
}

export interface ProcessRoutesRequest {
  origin: { latitude: number; longitude: number };
  destination: { latitude: number; longitude: number };
  options: {
    alternatives?: boolean;
    departureTime?: string;
    trafficModel?: string;
    avoid?: string[];
  };
  motorData: {
    fuelEfficiency: number;
    fuelTank: number;
  };
}

export interface ProcessRoutesResponse {
  routes: any[];
  trafficAnalysis: any;
  recommendations: any[];
  performance: {
    routesProcessed: number;
    processingTime: number;
  };
}

/**
 * Process route directions using backend API
 * Replaces heavy frontend route processing
 */
export const processDirections = async (
  request: ProcessDirectionsRequest
): Promise<ProcessDirectionsResponse> => {
  try {
    const response = await fetch(`${API_BASE}/api/routes/process-directions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      throw new Error(`Route processing failed: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('[RouteService] Route processing error:', error);
    throw error;
  }
};

/**
 * Process traffic analysis using backend API
 * Replaces heavy frontend traffic analysis
 */
export const processTrafficAnalysis = async (
  request: ProcessTrafficAnalysisRequest
): Promise<ProcessTrafficAnalysisResponse> => {
  try {
    const response = await fetch(`${API_BASE}/api/routes/process-traffic-analysis`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      throw new Error(`Traffic analysis failed: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('[RouteService] Traffic analysis error:', error);
    throw error;
  }
};

/**
 * Process routes with options using backend API
 * Replaces heavy frontend route optimization
 */
export const processRoutes = async (
  request: ProcessRoutesRequest
): Promise<ProcessRoutesResponse> => {
  try {
    const response = await fetch(`${API_BASE}/api/routes/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      throw new Error(`Route processing failed: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('[RouteService] Route processing error:', error);
    throw error;
  }
};

/**
 * Get traffic rate from route leg using backend API
 * Replaces heavy frontend traffic calculations
 */
export const getTrafficRateFromLeg = async (
  leg: any
): Promise<number> => {
  try {
    if (!leg || !leg.duration || !leg.duration_in_traffic) return 1;
    
    const dur = leg.duration.value;
    const durTraffic = leg.duration_in_traffic.value;
    if (!dur || dur <= 0) return 1;
    
    const ratio = durTraffic / dur;
    if (ratio <= 1.2) return 1;
    else if (ratio <= 1.5) return 2;
    else if (ratio <= 2.0) return 3;
    else if (ratio <= 2.5) return 4;
    else return 5;
  } catch (error) {
    console.error('[RouteService] Traffic rate calculation error:', error);
    return 1;
  }
};

/**
 * Decode polyline using backend API
 * Replaces heavy frontend polyline decoding
 */
export const decodePolyline = async (
  polylinePoints: string
): Promise<Array<{ latitude: number; longitude: number }>> => {
  try {
    // For now, use frontend decoding as fallback
    // This should be replaced with backend API call when available
    const polyline = require('@mapbox/polyline');
    return polyline.decode(polylinePoints).map(([lat, lng]: [number, number]) => ({
      latitude: lat,
      longitude: lng,
    }));
  } catch (error) {
    console.error('[RouteService] Polyline decoding error:', error);
    return [];
  }
};

/**
 * Process routes with fuel calculations using backend API
 * Simplified wrapper for common use case
 */
export const processRoutesWithFuel = async (
  origin: { latitude: number; longitude: number },
  destination: { latitude: number; longitude: number },
  motorData: { fuelEfficiency: number; fuelTank: number },
  options: any = {}
): Promise<ProcessDirectionsResponse> => {
  try {
    return await processDirections({
      origin,
      destination,
      motorData,
      options: {
        alternatives: true,
        trafficModel: 'best_guess',
        ...options
      }
    });
  } catch (error) {
    console.error('[RouteService] Routes with fuel processing error:', error);
    throw error;
  }
};

/**
 * Get route recommendations using backend API
 * Uses backend analytics for better recommendations
 */
export const getRouteRecommendations = async (
  routes: any[],
  motorData: { fuelEfficiency: number; fuelTank: number }
): Promise<any[]> => {
  try {
    const response = await processTrafficAnalysis({
      routes,
      motorData,
      options: {
        includeFuelCalculations: true,
        includeTrafficAnalysis: true,
        includeSafetyMetrics: true
      }
    });

    return response.trafficAnalysis.recommendations || [];
  } catch (error) {
    console.error('[RouteService] Route recommendations error:', error);
    return [];
  }
};

/**
 * Batch process multiple routes for better performance
 */
export const batchProcessRoutes = async (
  routeRequests: ProcessDirectionsRequest[]
): Promise<ProcessDirectionsResponse[]> => {
  try {
    const promises = routeRequests.map(request => processDirections(request));
    const results = await Promise.all(promises);
    return results;
  } catch (error) {
    console.error('[RouteService] Batch route processing error:', error);
    throw error;
  }
};

/**
 * Get optimized route based on motor data and preferences
 */
export const getOptimizedRoute = async (
  origin: { latitude: number; longitude: number },
  destination: { latitude: number; longitude: number },
  motorData: { fuelEfficiency: number; fuelTank: number },
  preferences: {
    avoidTolls?: boolean;
    avoidHighways?: boolean;
    preferFuelEfficient?: boolean;
  } = {}
): Promise<ProcessDirectionsResponse> => {
  try {
    const avoid = [];
    if (preferences.avoidTolls) avoid.push('tolls');
    if (preferences.avoidHighways) avoid.push('highways');

    return await processDirections({
      origin,
      destination,
      motorData,
      options: {
        alternatives: true,
        trafficModel: 'best_guess',
        avoid,
        ...preferences
      }
    });
  } catch (error) {
    console.error('[RouteService] Optimized route error:', error);
    throw error;
  }
};
