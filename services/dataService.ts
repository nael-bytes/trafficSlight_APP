// Data Service - Backend API calls for data aggregation and filtering
// Replaces heavy frontend data processing with optimized backend processing

const API_BASE = "https://ts-backend-1-jyit.onrender.com";

export interface FilterAggregateRequest {
  dataType: string;
  filters: {
    archived?: boolean;
    status?: string[];
    location?: {
      coordinates: [number, number];
      radius: number;
    };
  };
  userId: string;
}

export interface FilterAggregateResponse {
  data: any[];
  aggregated: any;
  filters: any;
  count: number;
  processingTime: number;
}

export interface AggregatedDataRequest {
  userId: string;
  includeCache?: boolean;
  forceRefresh?: boolean;
}

export interface AggregatedDataResponse {
  reports: any[];
  gasStations: any[];
  motors: any[];
  cacheInfo: any;
  performance: {
    dataSources: string[];
    processingTime: number;
    cacheHitRate: number;
  };
}

export interface AggregatedCachedDataRequest {
  userId: string;
  includeCache?: boolean;
  forceRefresh?: boolean;
}

export interface AggregatedCachedDataResponse {
  data: any;
  cacheInfo: any;
  performance: {
    dataSources: string[];
    processingTime: number;
    cacheHitRate: number;
    memoryUsage: number;
  };
}

/**
 * Filter and aggregate data using backend API
 * Replaces heavy frontend data filtering
 */
export const filterAndAggregate = async (
  request: FilterAggregateRequest
): Promise<FilterAggregateResponse> => {
  try {
    const response = await fetch(`${API_BASE}/api/data/filter-aggregate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      throw new Error(`Data filtering failed: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('[DataService] Data filtering error:', error);
    throw error;
  }
};

/**
 * Get aggregated data using backend API
 * Replaces heavy frontend data aggregation
 */
export const getAggregatedData = async (
  request: AggregatedDataRequest
): Promise<AggregatedDataResponse> => {
  try {
    const queryParams = new URLSearchParams({
      userId: request.userId,
      includeCache: request.includeCache?.toString() || 'true',
      forceRefresh: request.forceRefresh?.toString() || 'false'
    });

    const response = await fetch(`${API_BASE}/api/data/aggregated?${queryParams}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
      throw new Error(`Data aggregation failed: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('[DataService] Data aggregation error:', error);
    throw error;
  }
};

/**
 * Get aggregated cached data using backend API
 * Replaces heavy frontend data aggregation with caching
 */
export const getAggregatedCachedData = async (
  request: AggregatedCachedDataRequest
): Promise<AggregatedCachedDataResponse> => {
  try {
    const queryParams = new URLSearchParams({
      userId: request.userId,
      includeCache: request.includeCache?.toString() || 'true',
      forceRefresh: request.forceRefresh?.toString() || 'false'
    });

    const response = await fetch(`${API_BASE}/api/data/aggregated-cached?${queryParams}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
      throw new Error(`Cached data aggregation failed: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('[DataService] Cached data aggregation error:', error);
    throw error;
  }
};

/**
 * Filter reports using backend API
 * Simplified wrapper for report filtering
 */
export const filterReports = async (
  reports: any[],
  filters: {
    archived?: boolean;
    status?: string[];
    location?: {
      coordinates: [number, number];
      radius: number;
    };
  },
  userId: string
): Promise<any[]> => {
  try {
    const response = await filterAndAggregate({
      dataType: 'reports',
      filters,
      userId
    });

    return response.data;
  } catch (error) {
    console.error('[DataService] Report filtering error:', error);
    throw error;
  }
};

/**
 * Filter gas stations using backend API
 * Simplified wrapper for gas station filtering
 */
export const filterGasStations = async (
  gasStations: any[],
  filters: {
    archived?: boolean;
    status?: string[];
    location?: {
      coordinates: [number, number];
      radius: number;
    };
  },
  userId: string
): Promise<any[]> => {
  try {
    const response = await filterAndAggregate({
      dataType: 'gasStations',
      filters,
      userId
    });

    return response.data;
  } catch (error) {
    console.error('[DataService] Gas station filtering error:', error);
    throw error;
  }
};

/**
 * Get dashboard overview using backend API
 * Uses: GET /api/dashboard/overview
 * Replaces heavy frontend dashboard data processing
 */
export const getDashboardOverview = async (
  token: string
): Promise<{
  totalTrips: number;
  totalDistance: number;
  totalFuelCost: number;
  activeMotors: number;
}> => {
  try {
    const response = await fetch(`${API_BASE}/api/dashboard/overview`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error(`Dashboard overview failed: ${response.status}`);
    }

    const data = await response.json();
    return data.overview || {};
  } catch (error) {
    console.error('[DataService] Dashboard overview error:', error);
    throw error;
  }
};

/**
 * Get dashboard statistics using backend API
 * Uses: GET /api/dashboard/stats?period=30d
 * Replaces heavy frontend dashboard statistics processing
 */
export const getDashboardStats = async (
  token: string,
  period: string = '30d'
): Promise<any> => {
  try {
    const response = await fetch(`${API_BASE}/api/dashboard/stats?period=${period}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error(`Dashboard stats failed: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('[DataService] Dashboard stats error:', error);
    throw error;
  }
};

/**
 * Get dashboard data using backend API (legacy method for backward compatibility)
 * Replaces heavy frontend dashboard data processing
 */
export const getDashboardData = async (
  userId: string,
  includeCache: boolean = true
): Promise<{
  motors: any[];
  trips: any[];
  destinations: any[];
  fuelLogs: any[];
  maintenance: any[];
  gasStations: any[];
}> => {
  try {
    const response = await getAggregatedData({
      userId,
      includeCache,
      forceRefresh: false
    });

    return {
      motors: response.motors || [],
      trips: response.trips || [],
      destinations: response.destinations || [],
      fuelLogs: response.fuelLogs || [],
      maintenance: response.maintenance || [],
      gasStations: response.gasStations || []
    };
  } catch (error) {
    console.error('[DataService] Dashboard data error:', error);
    throw error;
  }
};

/**
 * Get cached dashboard data for better performance
 * Uses backend caching for faster data retrieval
 */
export const getCachedDashboardData = async (
  userId: string,
  forceRefresh: boolean = false
): Promise<{
  motors: any[];
  trips: any[];
  destinations: any[];
  fuelLogs: any[];
  maintenance: any[];
  gasStations: any[];
  cacheInfo: any;
}> => {
  try {
    const response = await getAggregatedCachedData({
      userId,
      includeCache: true,
      forceRefresh
    });

    return {
      motors: response.data.motors || [],
      trips: response.data.trips || [],
      destinations: response.data.destinations || [],
      fuelLogs: response.data.fuelLogs || [],
      maintenance: response.data.maintenance || [],
      gasStations: response.data.gasStations || [],
      cacheInfo: response.cacheInfo
    };
  } catch (error) {
    console.error('[DataService] Cached dashboard data error:', error);
    throw error;
  }
};

/**
 * Batch filter multiple data types for better performance
 */
export const batchFilterData = async (
  dataTypes: string[],
  filters: any,
  userId: string
): Promise<Record<string, any[]>> => {
  try {
    const promises = dataTypes.map(dataType => 
      filterAndAggregate({
        dataType,
        filters,
        userId
      })
    );

    const results = await Promise.all(promises);
    const batchResults: Record<string, any[]> = {};

    dataTypes.forEach((dataType, index) => {
      batchResults[dataType] = results[index].data;
    });

    return batchResults;
  } catch (error) {
    console.error('[DataService] Batch data filtering error:', error);
    throw error;
  }
};

/**
 * Get data statistics using backend API
 * Provides insights into data processing performance
 */
export const getDataStatistics = async (
  userId: string
): Promise<{
  totalRecords: number;
  processingTime: number;
  cacheHitRate: number;
  dataSources: string[];
}> => {
  try {
    const response = await getAggregatedCachedData({
      userId,
      includeCache: true,
      forceRefresh: false
    });

    return {
      totalRecords: response.data.totalRecords || 0,
      processingTime: response.performance.processingTime,
      cacheHitRate: response.performance.cacheHitRate,
      dataSources: response.performance.dataSources
    };
  } catch (error) {
    console.error('[DataService] Data statistics error:', error);
    throw error;
  }
};
