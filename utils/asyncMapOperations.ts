// Async map operations for MapScreenTryRefactored.tsx
// Handles all map-related operations asynchronously without blocking UI

import { runAsyncOperation, createDebouncedAsyncOperation, createThrottledAsyncOperation } from './asyncOperations';
import { GOOGLE_MAPS_API_KEY } from '@env';

export interface RouteData {
  distance: string;
  duration: string;
  polyline: string;
  steps: any[];
  summary: string;
  warnings: string[];
  waypoint_order: number[];
  bounds: {
    northeast: { lat: number; lng: number };
    southwest: { lat: number; lng: number };
  };
}

export interface DirectionsResponse {
  routes: RouteData[];
  status: string;
  error_message?: string;
}

export interface GeocodingResponse {
  results: Array<{
    formatted_address: string;
    geometry: {
      location: { lat: number; lng: number };
    };
    place_id: string;
  }>;
  status: string;
}

/**
 * Async route fetching with caching and error handling
 */
export const fetchRoutesAsync = async (
  origin: { latitude: number; longitude: number },
  destination: { latitude: number; longitude: number },
  options: {
    alternatives?: boolean;
    departureTime?: string;
    trafficModel?: string;
    avoid?: string[];
  } = {}
): Promise<RouteData[]> => {
  // CRITICAL OPTIMIZATION: Remove double async wrapping
  // fetchRoutesAsync is already called from runAsyncOperation in destinationFlowManager
  // So we should make the actual API call directly without another runAsyncOperation wrapper
  const {
    alternatives = true,
    departureTime = 'now',
    trafficModel = 'best_guess',
    avoid = ['tolls'],
  } = options;

  const baseUrl = 'https://maps.googleapis.com/maps/api/directions/json';
  const params = new URLSearchParams({
    origin: `${origin.latitude},${origin.longitude}`,
    destination: `${destination.latitude},${destination.longitude}`,
    alternatives: alternatives.toString(),
    departure_time: departureTime,
    traffic_model: trafficModel,
    avoid: avoid.join('|'),
    key: GOOGLE_MAPS_API_KEY,
  });

  const url = `${baseUrl}?${params.toString()}`;
  if (__DEV__) {
    console.log('[AsyncMapOperations] Fetching routes from Google Maps API');
  }

  // NOTE: Timeout is handled by runAsyncOperation wrapper, so we don't need a timeout here
  // This prevents double timeout issues and allows the wrapper to handle retries properly
  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data: DirectionsResponse = await response.json();

    if (data.status !== 'OK') {
      throw new Error(data.error_message || `Google Maps API error: ${data.status}`);
    }

    return data.routes;
  } catch (error: any) {
    if (__DEV__) {
      console.error('[AsyncMapOperations] Route fetch error:', error);
    }
    // Re-throw with more context
    if (error.message && !error.message.includes('timeout')) {
      throw new Error(`Route fetch failed: ${error.message}`);
    }
    throw error;
  }
};

/**
 * Debounced route fetching to prevent excessive API calls
 */
export const createDebouncedRouteFetcher = () => {
  return createDebouncedAsyncOperation(
    fetchRoutesAsync,
    500, // 500ms debounce
    {
      priority: 'normal',
      timeout: 30000, // Increased to 30s to match route fetching timeout
      retries: 2,
    }
  );
};

/**
 * Async geocoding with caching
 */
export const geocodeAddressAsync = async (address: string): Promise<GeocodingResponse> => {
  const result = await runAsyncOperation(async () => {
    const baseUrl = 'https://maps.googleapis.com/maps/api/geocode/json';
    const params = new URLSearchParams({
      address,
      key: GOOGLE_MAPS_API_KEY,
    });

    const url = `${baseUrl}?${params.toString()}`;
    console.log('[AsyncMapOperations] Geocoding address:', address);

    const response = await fetch(url);
    const data: GeocodingResponse = await response.json();

    if (data.status !== 'OK') {
      throw new Error(`Geocoding failed: ${data.status}`);
    }

    return data;
  }, {
    priority: 'normal',
    timeout: 10000,
    retries: 2,
  });

  if (!result.success || !result.data) {
    throw new Error(result.error?.message || 'Geocoding failed');
  }

  return result.data;
};

/**
 * Reverse geocoding with caching
 */
export const reverseGeocodeAsync = async (
  latitude: number,
  longitude: number
): Promise<GeocodingResponse> => {
  const result = await runAsyncOperation(async () => {
    const baseUrl = 'https://maps.googleapis.com/maps/api/geocode/json';
    const params = new URLSearchParams({
      latlng: `${latitude},${longitude}`,
      key: GOOGLE_MAPS_API_KEY,
    });

    const url = `${baseUrl}?${params.toString()}`;
    console.log('[AsyncMapOperations] Reverse geocoding:', latitude, longitude);

    const response = await fetch(url);
    const data: GeocodingResponse = await response.json();

    if (data.status !== 'OK') {
      throw new Error(`Reverse geocoding failed: ${data.status}`);
    }

    return data;
  }, {
    priority: 'normal',
    timeout: 10000,
    retries: 2,
  });

  if (!result.success || !result.data) {
    throw new Error(result.error?.message || 'Reverse geocoding failed');
  }

  return result.data;
};

/**
 * Throttled location updates to prevent excessive processing
 */
export const createThrottledLocationProcessor = () => {
  return createThrottledAsyncOperation(
    async (location: { latitude: number; longitude: number }) => {
      // Process location update
      console.log('[AsyncMapOperations] Processing location:', location);
      return location;
    },
    1000, // 1 second throttle
    {
      priority: 'low',
      timeout: 5000,
      retries: 1,
    }
  );
};

/**
 * Async map data processing
 */
export const processMapDataAsync = async <T>(
  data: T[],
  processor: (item: T) => Promise<any>,
  options: {
    batchSize?: number;
    concurrency?: number;
  } = {}
): Promise<any[]> => {
  const { batchSize = 10, concurrency = 3 } = options;
  
  const result = await runAsyncOperation(async () => {
    const results: any[] = [];
    
    // Process data in batches
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      
      // Process batch with limited concurrency
      const batchPromises = batch.map(item => processor(item));
      const batchResults = await Promise.allSettled(batchPromises);
      
      // Collect successful results
      batchResults.forEach(result => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        }
      });
      
      // Small delay between batches to prevent UI blocking
      if (i + batchSize < data.length) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }
    
    return results;
  }, {
    priority: 'low',
    timeout: 30000,
    retries: 1,
  });

  if (!result.success || !result.data) {
    throw new Error(result.error?.message || 'Map data processing failed');
  }

  return result.data;
};

/**
 * Async map region updates
 */
export const updateMapRegionAsync = async (
  region: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  },
  mapRef: any
): Promise<void> => {
  const result = await runAsyncOperation(async () => {
    if (mapRef?.current) {
      await new Promise<void>((resolve) => {
        mapRef.current.animateToRegion(region, 1000, () => {
          resolve();
        });
      });
    }
  }, {
    priority: 'high',
    timeout: 5000,
    retries: 1,
  });

  if (!result.success) {
    console.warn('[AsyncMapOperations] Failed to update map region:', result.error);
  }
};

/**
 * Async marker clustering
 */
export const clusterMarkersAsync = async (
  markers: any[],
  region: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  }
): Promise<any[]> => {
  const result = await runAsyncOperation(async () => {
    // Import clustering function dynamically to avoid blocking
    const { clusterMarkers } = await import('./markerClustering');
    
    // Calculate zoom level from region
    const zoom = Math.round(Math.log2(360 / region.latitudeDelta));
    
    return clusterMarkers(markers, [], zoom, {
      radius: 100,
      minZoom: 15,
      maxZoom: 10,
    });
  }, {
    priority: 'low',
    timeout: 5000,
    retries: 1,
  });

  if (!result.success || !result.data) {
    console.warn('[AsyncMapOperations] Marker clustering failed:', result.error);
    return markers; // Return original markers as fallback
  }

  return result.data;
};

/**
 * Async map initialization
 */
export const initializeMapAsync = async (
  initialLocation: { latitude: number; longitude: number },
  mapRef: any
): Promise<void> => {
  const result = await runAsyncOperation(async () => {
    if (mapRef?.current) {
      const region = {
        ...initialLocation,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      };
      
      await new Promise<void>((resolve) => {
        mapRef.current.animateToRegion(region, 1000, () => {
          resolve();
        });
      });
    }
  }, {
    priority: 'high',
    timeout: 10000,
    retries: 2,
  });

  if (!result.success) {
    console.warn('[AsyncMapOperations] Map initialization failed:', result.error);
  }
};

/**
 * Async data validation
 */
export const validateMapDataAsync = async (data: any[]): Promise<any[]> => {
  const result = await runAsyncOperation(async () => {
    return data.filter(item => {
      // Validate coordinates
      if (item.location) {
        const { latitude, longitude } = item.location;
        return (
          typeof latitude === 'number' &&
          typeof longitude === 'number' &&
          latitude >= -90 &&
          latitude <= 90 &&
          longitude >= -180 &&
          longitude <= 180
        );
      }
      
      // Validate coordinate arrays
      if (item.coordinates && Array.isArray(item.coordinates)) {
        const [lng, lat] = item.coordinates;
        return (
          typeof lat === 'number' &&
          typeof lng === 'number' &&
          lat >= -90 &&
          lat <= 90 &&
          lng >= -180 &&
          lng <= 180
        );
      }
      
      return false;
    });
  }, {
    priority: 'low',
    timeout: 5000,
    retries: 1,
  });

  if (!result.success || !result.data) {
    console.warn('[AsyncMapOperations] Data validation failed:', result.error);
    return data; // Return original data as fallback
  }

  return result.data;
};

/**
 * Performance monitoring for map operations
 */
export const createMapPerformanceMonitor = () => {
  const metrics = new Map<string, { start: number; end?: number; duration?: number }>();
  
  const startOperation = (operation: string) => {
    metrics.set(operation, { start: Date.now() });
  };
  
  const endOperation = (operation: string) => {
    const metric = metrics.get(operation);
    if (metric) {
      metric.end = Date.now();
      metric.duration = metric.end - metric.start;
      console.log(`[MapPerformance] ${operation}: ${metric.duration}ms`);
    }
  };
  
  const getMetrics = () => {
    return Array.from(metrics.entries()).map(([operation, metric]) => ({
      operation,
      duration: metric.duration || 0,
    }));
  };
  
  const clearMetrics = () => {
    metrics.clear();
  };
  
  return {
    startOperation,
    endOperation,
    getMetrics,
    clearMetrics,
  };
};
