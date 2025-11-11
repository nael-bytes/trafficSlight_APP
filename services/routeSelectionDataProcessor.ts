/**
 * Route Selection Data Processor
 * 
 * Separates all data processing logic from RouteSelectionScreenOptimized.tsx
 * for better code organization and maintainability.
 * 
 * All data transformation, filtering, and processing happens here.
 */

import { validateCoordinates } from '../utils/location';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface Report {
  _id: string;
  location?: {
    latitude: number;
    longitude: number;
  };
  archived?: boolean;
  status?: string;
  updatedAt?: string;
}

export interface GasStation {
  _id: string;
  location?: {
    coordinates: [number, number]; // [lng, lat]
  };
}

export interface Motor {
  _id: string;
  [key: string]: any;
}

export interface MapMarker {
  id: string;
  coordinate: {
    latitude: number;
    longitude: number;
  };
  title: string;
  description?: string;
  pinColor?: string;
  type: string;
  reports?: any[];
  gasStations?: any[];
  currentZoom?: number;
}

export interface MapPolyline {
  id: string;
  coordinates: Array<{ latitude: number; longitude: number }>;
  strokeColor: string;
  strokeWidth: number;
  type: string;
}

export interface MapData {
  markers: MapMarker[];
  polylines: MapPolyline[];
}

export interface EffectiveDataState {
  reports: number;
  gasStations: number;
  motors: number;
}

// ============================================================================
// Effective Data Selection
// ============================================================================

/**
 * Get effective reports data with priority:
 * API data > Local cache > Global cache
 */
export const getEffectiveReports = (
  appReports?: Report[],
  localReports?: Report[],
  cachedReports?: Report[],
  lastEffectiveState?: EffectiveDataState
): { data: Report[]; hasChanged: boolean } => {
  const result = appReports?.length 
    ? appReports 
    : (localReports?.length 
      ? localReports 
      : (cachedReports || []));
  
  const hasChanged = lastEffectiveState 
    ? result.length !== lastEffectiveState.reports 
    : true;
  
  if (hasChanged && __DEV__) {
    console.log('[DataProcessor] Reports Data:', {
      apiReports: appReports?.length || 0,
      localReports: localReports?.length || 0,
      globalCachedReports: cachedReports?.length || 0,
      effectiveReports: result?.length || 0,
      source: appReports?.length ? 'API' : localReports?.length ? 'Local Cache' : cachedReports?.length ? 'Global Cache' : 'None'
    });
  }
  
  return { data: result, hasChanged };
};

/**
 * Get effective gas stations data with priority:
 * API data > Local cache > Global cache
 */
export const getEffectiveGasStations = (
  appGasStations?: GasStation[],
  localGasStations?: GasStation[],
  cachedGasStations?: GasStation[],
  lastEffectiveState?: EffectiveDataState
): { data: GasStation[]; hasChanged: boolean } => {
  const result = appGasStations?.length 
    ? appGasStations 
    : (localGasStations?.length 
      ? localGasStations 
      : (cachedGasStations || []));
  
  const hasChanged = lastEffectiveState 
    ? result.length !== lastEffectiveState.gasStations 
    : true;
  
  if (hasChanged && __DEV__) {
    console.log('[DataProcessor] Gas Stations Data:', {
      apiGasStations: appGasStations?.length || 0,
      localGasStations: localGasStations?.length || 0,
      globalCachedGasStations: cachedGasStations?.length || 0,
      effectiveGasStations: result?.length || 0,
      source: appGasStations?.length ? 'API' : localGasStations?.length ? 'Local Cache' : cachedGasStations?.length ? 'Global Cache' : 'None'
    });
  }
  
  return { data: result, hasChanged };
};

/**
 * Get effective motors data with priority:
 * API data > Motor Management > Local cache > Global cache
 */
export const getEffectiveMotors = (
  appMotors?: Motor[],
  motorList?: Motor[],
  localMotors?: Motor[],
  cachedMotors?: Motor[],
  lastEffectiveState?: EffectiveDataState
): { data: Motor[]; hasChanged: boolean } => {
  const result = appMotors?.length 
    ? appMotors 
    : (motorList?.length 
      ? motorList 
      : (localMotors?.length 
        ? localMotors 
        : (cachedMotors || [])));
  
  const hasChanged = lastEffectiveState 
    ? result.length !== lastEffectiveState.motors 
    : true;
  
  if (hasChanged && __DEV__) {
    console.log('[DataProcessor] Motor Data:', {
      apiMotors: appMotors?.length || 0,
      motorManagementMotors: motorList?.length || 0,
      localMotors: localMotors?.length || 0,
      globalCachedMotors: cachedMotors?.length || 0,
      effectiveMotors: result?.length || 0,
      source: appMotors?.length 
        ? 'useAppData' 
        : motorList?.length 
          ? 'useMotorManagement' 
          : localMotors?.length 
            ? 'Local Cache' 
            : cachedMotors?.length 
              ? 'Global Cache' 
              : 'None'
    });
  }
  
  return { data: result, hasChanged };
};

// ============================================================================
// Data Filtering
// ============================================================================

/**
 * Filter reports to remove invalid, archived, or deleted ones
 */
export const filterReports = (reports: Report[]): Report[] => {
  return reports.filter(report => {
    if (!report?.location) return false;
    
    // Filter out archived reports
    if (report.archived === true) {
      if (__DEV__) {
        console.log('[DataProcessor] Filtering out archived report:', report._id);
      }
      return false;
    }
    
    // Filter out reports with invalid status
    if (report.status === 'archived' || report.status === 'deleted') {
      if (__DEV__) {
        console.log('[DataProcessor] Filtering out report with status:', report.status, report._id);
      }
      return false;
    }
    
    return validateCoordinates(report.location);
  });
};

/**
 * Filter gas stations to remove invalid ones
 */
export const filterGasStations = (stations: GasStation[]): GasStation[] => {
  return stations.filter(station => {
    const coords = station?.location?.coordinates;
    if (!coords || !Array.isArray(coords) || coords.length < 2) return false;
    
    return validateCoordinates({
      latitude: Number(coords[1]),
      longitude: Number(coords[0]),
    });
  });
};

// ============================================================================
// Map Data Preparation
// ============================================================================

/**
 * Prepare map markers and polylines from current state
 */
export const prepareMapMarkersAndPolylines = (
  currentLocation?: { latitude: number; longitude: number },
  destination?: { latitude: number; longitude: number; address?: string },
  selectedRoute?: { coordinates: Array<{ latitude: number; longitude: number }> },
  alternativeRoutes?: Array<{ coordinates: Array<{ latitude: number; longitude: number }> }>,
  showReports: boolean = false,
  filteredReports: Report[] = [],
  showGasStations: boolean = false,
  filteredGasStations: GasStation[] = [],
  currentZoom?: number
): MapData => {
  const markers: MapMarker[] = [];
  const polylines: MapPolyline[] = [];

  // Add current location marker
  if (currentLocation) {
    markers.push({
      id: 'current-location',
      coordinate: currentLocation,
      title: 'Current Location',
      description: 'Your current position',
      pinColor: '#00ADB5',
      type: 'current'
    });
  }

  // Add destination marker
  if (destination) {
    markers.push({
      id: 'destination',
      coordinate: destination,
      title: 'Destination',
      description: destination.address || 'Selected destination',
      pinColor: '#e74c3c',
      type: 'destination'
    });
  }

  // Add route polylines
  if (selectedRoute?.coordinates && selectedRoute.coordinates.length > 0) {
    polylines.push({
      id: 'selected-route',
      coordinates: selectedRoute.coordinates,
      strokeColor: '#1e3a8a', // Dark blue color
      strokeWidth: 8, // Thick line
      type: 'route'
    });
  }

  // Add alternative routes
  alternativeRoutes?.forEach((route, index) => {
    if (route.coordinates && route.coordinates.length > 0) {
      polylines.push({
        id: `alternative-route-${index}`,
        coordinates: route.coordinates,
        strokeColor: '#3b82f6', // Lighter blue for alternatives
        strokeWidth: 4, // Thinner than main route
        type: 'alternative'
      });
    }
  });

  // Use backend clustering for reports and gas stations
  if ((showReports && filteredReports.length > 0) || (showGasStations && filteredGasStations.length > 0)) {
    // This will be processed by backend clustering service
    // The actual clustering will be handled in the OptimizedMapComponent
    const reportsToCluster = showReports ? filteredReports : [];
    const gasStationsToCluster = showGasStations ? filteredGasStations : [];
    
    // Store data for backend processing
    markers.push({
      id: 'cluster-data',
      reports: reportsToCluster,
      gasStations: gasStationsToCluster,
      currentZoom: currentZoom || 0.01,
      type: 'cluster-data',
      coordinate: currentLocation || { latitude: 0, longitude: 0 }, // Required but not used for clustering
      title: 'Cluster Data'
    });
  }

  return { markers, polylines };
};

// ============================================================================
// Report Comparison
// ============================================================================

interface ReportData {
  status: string;
  archived: boolean;
  updatedAt?: string;
  location?: {
    latitude: number;
    longitude: number;
  };
}

/**
 * Compare two report arrays to detect changes
 * Returns true if changes are detected
 */
export const compareReports = (currentReports: Report[], freshReports: Report[]): boolean => {
  // Quick length check
  if (currentReports.length !== freshReports.length) {
    if (__DEV__) {
      console.log('[DataProcessor] Report count changed:', {
        from: currentReports.length,
        to: freshReports.length
      });
    }
    return true;
  }

  // Create maps for efficient comparison
  const currentMap = new Map<string, ReportData>();
  const freshMap = new Map<string, ReportData>();

  currentReports.forEach(report => {
    if (report._id) {
      currentMap.set(report._id, {
        status: report.status || '',
        archived: report.archived || false,
        updatedAt: report.updatedAt,
        location: report.location
      });
    }
  });

  freshReports.forEach(report => {
    if (report._id) {
      freshMap.set(report._id, {
        status: report.status || '',
        archived: report.archived || false,
        updatedAt: report.updatedAt,
        location: report.location
      });
    }
  });

  // Check for changes in existing reports
  for (const [id, currentData] of currentMap) {
    const freshData = freshMap.get(id);
    
    if (!freshData) {
      if (__DEV__) {
        console.log('[DataProcessor] Report removed:', id);
      }
      return true;
    }

    // Check for status changes (especially archiving)
    if (currentData.status !== freshData.status || 
        currentData.archived !== freshData.archived) {
      if (__DEV__) {
        console.log('[DataProcessor] Report status changed:', {
          id,
          from: { status: currentData.status, archived: currentData.archived },
          to: { status: freshData.status, archived: freshData.archived }
        });
      }
      return true;
    }

    // Check for location changes
    if (currentData.location && freshData.location) {
      const currentLat = currentData.location.latitude;
      const currentLng = currentData.location.longitude;
      const freshLat = freshData.location.latitude;
      const freshLng = freshData.location.longitude;
      
      if (Math.abs(currentLat - freshLat) > 0.0001 || 
          Math.abs(currentLng - freshLng) > 0.0001) {
        if (__DEV__) {
          console.log('[DataProcessor] Report location changed:', id);
        }
        return true;
      }
    }
  }

  // Check for new reports
  for (const [id, freshData] of freshMap) {
    if (!currentMap.has(id)) {
      if (__DEV__) {
        console.log('[DataProcessor] New report added:', id);
      }
      return true;
    }
  }

  return false;
};

// ============================================================================
// Fuel Level Validation
// ============================================================================

/**
 * Validate fuel level value
 * Returns true if valid, false otherwise
 */
export const validateFuelLevel = (
  fuelLevel: number,
  motorId: string,
  previousFuelLevel?: number
): boolean => {
  // Check if fuelLevel is a valid number
  if (typeof fuelLevel !== 'number' || isNaN(fuelLevel) || !isFinite(fuelLevel)) {
    if (__DEV__) {
      console.error('[DataProcessor] ❌ Invalid fuel level type:', {
        fuelLevel,
        motorId,
        type: typeof fuelLevel,
        message: 'Fuel level must be a valid number'
      });
    }
    return false;
  }
  
  // Check if fuel level is within valid range
  if (fuelLevel < 0 || fuelLevel > 100) {
    if (__DEV__) {
      console.error('[DataProcessor] ❌ Invalid fuel level range:', {
        fuelLevel,
        motorId,
        message: 'Fuel level must be between 0 and 100'
      });
    }
    return false;
  }
  
  // Additional validation for reasonable fuel level changes
  if (previousFuelLevel !== undefined && Math.abs(fuelLevel - previousFuelLevel) > 50) {
    if (__DEV__) {
      console.warn('[DataProcessor] ⚠️ Large fuel level change detected:', {
        previous: previousFuelLevel,
        new: fuelLevel,
        motorId,
        change: Math.abs(fuelLevel - previousFuelLevel)
      });
    }
    // Don't block the update, just warn
  }
  
  return true;
};

