// Map Service - Backend API calls for map processing and clustering
// Replaces heavy frontend map processing with optimized backend processing

const API_BASE = "https://ts-backend-1-jyit.onrender.com";

export interface ClusterMarkersRequest {
  reports: any[];
  gasStations: any[];
  currentZoom: number;
  options?: {
    radius?: number;
    minZoom?: number;
    maxZoom?: number;
  };
}

export interface ClusterMarkersResponse {
  clusters: Array<{
    id: string;
    coordinate: { latitude: number; longitude: number };
    count: number;
    markers: any[];
    type: 'report' | 'gasStation' | 'mixed';
  }>;
  performance: {
    processingTime: number;
    markersProcessed: number;
    clustersGenerated: number;
  };
}

export interface ProcessMarkersRequest {
  reports: any[];
  gasStations: any[];
  currentZoom: number;
  mapFilters: any;
  viewport: any;
}

export interface ProcessMarkersResponse {
  markers: any[];
  clusters: any[];
  performance: {
    markersProcessed: number;
    clustersGenerated: number;
    processingTime: number;
    memoryUsage: number;
  };
}

export interface ApplyFiltersRequest {
  data: any[];
  filters: any;
  dataType: string;
}

export interface ApplyFiltersResponse {
  filteredData: any[];
  statistics: {
    originalCount: number;
    filteredCount: number;
  };
  performance: {
    processingTime: number;
  };
}

export interface SnapToRoadsRequest {
  coordinates: Array<{ latitude: number; longitude: number }>;
  interpolate?: boolean;
}

export interface SnapToRoadsResponse {
  snappedPoints: Array<{
    latitude: number;
    longitude: number;
    originalIndex: number;
    placeId?: string;
  }>;
  snappedCoordinates: Array<{ latitude: number; longitude: number }>;
  hasSnapped: boolean;
  processingTime: number;
}

/**
 * Cluster markers using backend API
 * Replaces heavy frontend clustering algorithms
 */
export const clusterMarkers = async (
  request: ClusterMarkersRequest
): Promise<ClusterMarkersResponse> => {
  try {
    const response = await fetch(`${API_BASE}/api/map/cluster-markers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      throw new Error(`Marker clustering failed: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('[MapService] Marker clustering error:', error);
    throw error;
  }
};

/**
 * Process markers for rendering using backend API
 * Replaces heavy frontend marker processing
 */
export const processMarkers = async (
  request: ProcessMarkersRequest
): Promise<ProcessMarkersResponse> => {
  try {
    const response = await fetch(`${API_BASE}/api/map/process-markers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      throw new Error(`Marker processing failed: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('[MapService] Marker processing error:', error);
    throw error;
  }
};

/**
 * Apply map filters using backend API
 * Replaces heavy frontend filter processing
 */
export const applyMapFilters = async (
  request: ApplyFiltersRequest
): Promise<ApplyFiltersResponse> => {
  try {
    const response = await fetch(`${API_BASE}/api/map/apply-filters`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      throw new Error(`Map filter application failed: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('[MapService] Map filter application error:', error);
    throw error;
  }
};

/**
 * Snap coordinates to roads using backend API
 * Replaces heavy frontend road snapping
 */
export const snapToRoads = async (
  request: SnapToRoadsRequest
): Promise<SnapToRoadsResponse> => {
  try {
    const response = await fetch(`${API_BASE}/api/map/snap-to-roads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      throw new Error(`Road snapping failed: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('[MapService] Road snapping error:', error);
    throw error;
  }
};

/**
 * Batch process multiple map operations for better performance
 */
export const batchProcessMapData = async (
  reports: any[],
  gasStations: any[],
  currentZoom: number,
  mapFilters: any,
  viewport: any
): Promise<{
  markers: any[];
  clusters: any[];
  filteredData: any[];
}> => {
  try {
    const [markersResult, filtersResult] = await Promise.all([
      processMarkers({ reports, gasStations, currentZoom, mapFilters, viewport }),
      applyMapFilters({ data: [...reports, ...gasStations], filters: mapFilters, dataType: 'mixed' })
    ]);

    return {
      markers: markersResult.markers,
      clusters: markersResult.clusters,
      filteredData: filtersResult.filteredData
    };
  } catch (error) {
    console.error('[MapService] Batch map processing error:', error);
    throw error;
  }
};

/**
 * Get cluster icon for a cluster marker
 * NOTE: This function is deprecated - use getClusterIcon from utils/markerClustering.ts instead
 * This function returns a string path, but React Native requires require() for local assets
 * @deprecated Use getClusterIcon from utils/markerClustering.ts
 */
export const getClusterIcon = (cluster: any): string => {
  // DEPRECATED: This returns a string, but React Native needs require() for local assets
  // Use getClusterIcon from utils/markerClustering.ts instead
  if (__DEV__) {
    console.warn('[mapService.getClusterIcon] This function is deprecated. Use getClusterIcon from utils/markerClustering.ts instead');
  }
  return 'cluster-marker.png';
};

/**
 * Preload map data for better performance
 */
export const preloadMapData = async (
  reports: any[],
  gasStations: any[],
  currentZoom: number
): Promise<void> => {
  try {
    // Preload clusters and markers
    await clusterMarkers({
      reports,
      gasStations,
      currentZoom,
      options: { radius: 100, minZoom: 10, maxZoom: 15 }
    });
    
    console.log('[MapService] Map data preloaded successfully');
  } catch (error) {
    console.error('[MapService] Map data preloading error:', error);
    // Don't throw error for preloading failures
  }
};
