// Marker clustering utility for React Native Maps
// Groups nearby markers to improve performance and reduce visual clutter

import { Image } from 'react-native';
import { LocationCoords } from '../types';

export interface ClusterMarker {
  id: string;
  coordinate: LocationCoords;
  count: number;
  markers: any[];
  type: 'report' | 'gasStation' | 'mixed';
}

export interface ClusteringOptions {
  radius: number; // Distance in meters to cluster markers
  minZoom: number; // Minimum zoom level to show individual markers
  maxZoom: number; // Maximum zoom level to cluster markers
}

const DEFAULT_OPTIONS: ClusteringOptions = {
  radius: 100, // 100 meters
  minZoom: 15,
  maxZoom: 10,
};

/**
 * Calculate distance between two coordinates in meters
 */
const calculateDistance = (coord1: LocationCoords, coord2: LocationCoords): number => {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (coord1.latitude * Math.PI) / 180;
  const φ2 = (coord2.latitude * Math.PI) / 180;
  const Δφ = ((coord2.latitude - coord1.latitude) * Math.PI) / 180;
  const Δλ = ((coord2.longitude - coord1.longitude) * Math.PI) / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

/**
 * Cluster markers based on proximity and zoom level
 */
export const clusterMarkers = (
  reports: any[],
  gasStations: any[],
  currentZoom: number,
  options: Partial<ClusteringOptions> = {}
): ClusterMarker[] => {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  // If zoom level is too high, don't cluster
  if (currentZoom > opts.minZoom) {
    return [];
  }

  const allMarkers: Array<{ id: string; coordinate: LocationCoords; data: any; type: 'report' | 'gasStation' }> = [];

  // Add reports
  reports.forEach((report, index) => {
    if (report?.location) {
      allMarkers.push({
        id: `report-${report._id || index}`,
        coordinate: report.location,
        data: report,
        type: 'report',
      });
    }
  });

  // Add gas stations
  gasStations.forEach((station, index) => {
    if (station?.location?.coordinates) {
      const coords = station.location.coordinates;
      allMarkers.push({
        id: `gas-${station._id || index}`,
        coordinate: {
          latitude: Number(coords[1]),
          longitude: Number(coords[0]),
        },
        data: station,
        type: 'gasStation',
      });
    }
  });

  const clusters: ClusterMarker[] = [];
  const processed = new Set<string>();

  allMarkers.forEach((marker, index) => {
    if (processed.has(marker.id)) return;

    const cluster: ClusterMarker = {
      id: `cluster-${index}`,
      coordinate: marker.coordinate,
      count: 1,
      markers: [marker.data],
      type: marker.type,
    };

    // Find nearby markers to cluster
    allMarkers.forEach((otherMarker, otherIndex) => {
      if (otherIndex <= index || processed.has(otherMarker.id)) return;

      const distance = calculateDistance(marker.coordinate, otherMarker.coordinate);
      if (distance <= opts.radius) {
        cluster.count++;
        cluster.markers.push(otherMarker.data);
        processed.add(otherMarker.id);

        // Update cluster type if mixed
        if (cluster.type !== otherMarker.type) {
          cluster.type = 'mixed';
        }

        // Update cluster center (average position)
        cluster.coordinate = {
          latitude: (cluster.coordinate.latitude + otherMarker.coordinate.latitude) / 2,
          longitude: (cluster.coordinate.longitude + otherMarker.coordinate.longitude) / 2,
        };
      }
    });

    processed.add(marker.id);
    clusters.push(cluster);
  });

  return clusters;
};

/**
 * Get cluster icon - always use cluster-marker.png for all clusters
 * CRITICAL: Returns require() result to ensure proper asset loading
 */
export const getClusterIcon = (cluster: ClusterMarker): any => {
  try {
  // Always return the cluster marker image for all clusters and single markers
    const clusterIcon = require('../assets/icons/cluster-marker.png');
    // Validate that the icon was loaded correctly
    if (!clusterIcon) {
      if (__DEV__) {
        console.warn('[getClusterIcon] Cluster icon not found, using default');
      }
      return require('../assets/icons/default.png');
    }
    return clusterIcon;
  } catch (error) {
    if (__DEV__) {
      console.error('[getClusterIcon] Error loading cluster icon:', error);
    }
    // Fallback to default icon if cluster icon fails to load
    return require('../assets/icons/default.png');
  }
};

/**
 * Get report icon
 */
export const getReportIcon = (reportType: string): any => {
  const iconMap: Record<string, any> = {
    'accident': require('../assets/icons/ROAD INCIDENTS ICON/Road_Accident.png'),
    'congestion': require('../assets/icons/ROAD INCIDENTS ICON/Traffic_Jam.png'),
    'hazard': require('../assets/icons/ROAD INCIDENTS ICON/Hazard.png'),
    'roadwork': require('../assets/icons/ROAD INCIDENTS ICON/Road_Closure.png'),
    'all': require('../assets/icons/Reports.png'),
  };
  
  return iconMap[reportType] || require('../assets/icons/default.png');
};

/**
 * Get gas station icon
 */
export const getGasStationIcon = (brand: string): any => {
  const iconMap: Record<string, any> = {
    'caltex': require('../assets/icons/GAS_STATIONS/CALTEX.png'),
    'cleanfuel': require('../assets/icons/GAS_STATIONS/CLEANFUEL.png'),
    'flying v': require('../assets/icons/GAS_STATIONS/FLYINGV.png'),
    'jetti': require('../assets/icons/GAS_STATIONS/JETTI.png'),
    'petro gazz': require('../assets/icons/GAS_STATIONS/PETROGAZZ.png'),
    'petron': require('../assets/icons/GAS_STATIONS/PETRON.png'),
    'phoenix': require('../assets/icons/GAS_STATIONS/PHOENIX.png'),
    'rephil': require('../assets/icons/GAS_STATIONS/REPHIL.png'),
    'seaoil': require('../assets/icons/GAS_STATIONS/SEAOIL.png'),
    'shell': require('../assets/icons/GAS_STATIONS/SHELL.png'),
    'total': require('../assets/icons/GAS_STATIONS/TOTAL.png'),
    'unioil': require('../assets/icons/GAS_STATIONS/UNIOIL.png'),
    'all': require('../assets/icons/Gas_Station-MARKER.png'),
    'other': require('../assets/icons/Gas_Station-MARKER.png'),
  };
  
  return iconMap[brand] || require('../assets/icons/Gas_Station-MARKER.png');
};

// Icon cache to store preloaded/resolved image sources
const iconCache: Record<string, any> = {};

/**
 * Resolve and cache an icon source
 */
const resolveAndCacheIcon = (key: string, iconPath: any): any => {
  if (!iconCache[key]) {
    try {
      const resolved = Image.resolveAssetSource(iconPath);
      if (resolved) {
        iconCache[key] = resolved;
        return resolved;
      }
    } catch (error) {
      if (__DEV__) {
        console.warn(`[MarkerClustering] Failed to resolve icon ${key}:`, error);
      }
    }
    // Return default icon if resolution fails
    try {
      const defaultIcon = Image.resolveAssetSource(require('../assets/icons/default.png'));
      iconCache[key] = defaultIcon;
      return defaultIcon;
    } catch {
      return iconPath; // Fallback to original path
    }
  }
  return iconCache[key];
};

/**
 * Preload all marker icons for better performance
 * This caches the resolved image sources so they're ready immediately
 */
export const preloadMarkerIcons = async (): Promise<void> => {
  const iconMap: Array<{ key: string; path: any }> = [
    // Cluster icon - CRITICAL: Must be preloaded to prevent crashes on zoom out
    { key: 'cluster', path: require('../assets/icons/cluster-marker.png') },
    
    // Report icons
    { key: 'accident', path: require('../assets/icons/ROAD INCIDENTS ICON/Road_Accident.png') },
    { key: 'traffic_jam', path: require('../assets/icons/ROAD INCIDENTS ICON/Traffic_Jam.png') },
    { key: 'hazard', path: require('../assets/icons/ROAD INCIDENTS ICON/Hazard.png') },
    { key: 'road_closure', path: require('../assets/icons/ROAD INCIDENTS ICON/Road_Closure.png') },
    
    // Gas station icons
    { key: 'caltex', path: require('../assets/icons/GAS_STATIONS/CALTEX.png') },
    { key: 'cleanfuel', path: require('../assets/icons/GAS_STATIONS/CLEANFUEL.png') },
    { key: 'flying_v', path: require('../assets/icons/GAS_STATIONS/FLYINGV.png') },
    { key: 'jetti', path: require('../assets/icons/GAS_STATIONS/JETTI.png') },
    { key: 'petro_gazz', path: require('../assets/icons/GAS_STATIONS/PETROGAZZ.png') },
    { key: 'petron', path: require('../assets/icons/GAS_STATIONS/PETRON.png') },
    { key: 'phoenix', path: require('../assets/icons/GAS_STATIONS/PHOENIX.png') },
    { key: 'rephil', path: require('../assets/icons/GAS_STATIONS/REPHIL.png') },
    { key: 'seaoil', path: require('../assets/icons/GAS_STATIONS/SEAOIL.png') },
    { key: 'shell', path: require('../assets/icons/GAS_STATIONS/SHELL.png') },
    { key: 'total', path: require('../assets/icons/GAS_STATIONS/TOTAL.png') },
    { key: 'unioil', path: require('../assets/icons/GAS_STATIONS/UNIOIL.png') },
    
    // Other icons
    { key: 'user_marker', path: require('../assets/icons/User-onTrack-MARKER.png') },
    { key: 'destination', path: require('../assets/icons/DESTINATION MARKER.png') },
    { key: 'gas_station_default', path: require('../assets/icons/Gas_Station-MARKER.png') },
    { key: 'default', path: require('../assets/icons/default.png') },
  ];

  // Resolve and cache all icons first (synchronous)
  iconMap.forEach(({ key, path }) => {
    resolveAndCacheIcon(key, path);
  });

  // Then preload images using Image.prefetch (asynchronous)
  const preloadPromises = iconMap.map(({ key, path }) => {
    return new Promise<void>((resolve) => {
      try {
        const resolved = iconCache[key] || Image.resolveAssetSource(path);
        if (resolved?.uri) {
          Image.prefetch(resolved.uri)
            .then(() => {
              if (__DEV__) {
                console.log(`[MarkerClustering] ✅ Preloaded icon: ${key}`);
              }
              resolve();
            })
            .catch((error) => {
              if (__DEV__) {
                console.warn(`[MarkerClustering] ⚠️ Failed to preload icon ${key}:`, error);
              }
              resolve(); // Continue even if preload fails
            });
        } else {
          resolve(); // Skip if no URI
        }
      } catch (error) {
        if (__DEV__) {
          console.warn(`[MarkerClustering] ⚠️ Error processing icon ${key}:`, error);
        }
        resolve(); // Continue even if processing fails
      }
    });
  });

  await Promise.all(preloadPromises);
  
  if (__DEV__) {
    console.log(`[MarkerClustering] ✅ All ${iconMap.length} marker icons preloaded and cached`);
  }
};

/**
 * Get cached icon (returns immediately from cache)
 */
export const getCachedIcon = (key: string): any => {
  return iconCache[key] || null;
};
