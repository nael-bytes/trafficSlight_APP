// Optimized map component with marker clustering and performance improvements

import React, { useState, useCallback, useMemo, useRef, useEffect, memo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { voteOnReport } from '../../utils/api';
import { validateCoordinates } from '../../utils/location';
import { clusterMarkers as clusterMarkersService, processMarkers as processMarkersService } from '../../services/mapService';
import { getClusterIcon, preloadMarkerIcons, getReportIcon, getGasStationIcon, getCachedIcon, ClusterMarker } from '../../utils/markerClustering';
import { silentVoteManager, useSilentVote, useVoteCountListener } from '../../utils/silentVoteManager';
import { MapFilters } from '../../components/MapFilterModal';
import { reverseGeocodeLocation } from '../../utils/map-selection-handlers-mapscreentry';
import type { MapComponentProps, TrafficReport, GasStation, LocationCoords } from '../../types';

// Preload icons on module load - track globally
let iconsPreloaded = false;
let iconsPreloadPromise: Promise<void> | null = null;

// Ensure icons are preloaded and cached
const ensureIconsPreloaded = (): Promise<void> => {
  if (iconsPreloaded) {
    return Promise.resolve();
  }
  if (!iconsPreloadPromise) {
    iconsPreloadPromise = preloadMarkerIcons().then(() => {
      iconsPreloaded = true;
      if (__DEV__) {
        console.log('[OptimizedMapComponent] ✅ All marker icons preloaded and cached');
      }
    }).catch((error) => {
      if (__DEV__) {
        console.error('[OptimizedMapComponent] ❌ Error preloading icons:', error);
      }
      iconsPreloaded = true; // Continue anyway - icons will load on demand
    });
  }
  return iconsPreloadPromise;
};

// Start preloading immediately when module loads (non-blocking)
// This ensures icons are ready as early as possible
if (!iconsPreloaded && !iconsPreloadPromise) {
  ensureIconsPreloaded();
}

// Memoized marker components to prevent unnecessary re-renders
// CRITICAL: Only re-render when report data actually changes
const ReportMarker = React.memo<{
  report: TrafficReport;
  onPress: (report: TrafficReport) => void;
  icon: any;
}>(({ report, onPress, icon }) => {
  if (!report?.location || !validateCoordinates(report.location)) return null;
  
  // Ensure icon exists, use default if not
  const markerIcon = icon || require('../../assets/icons/default.png');
  
  // Debug: Log icon source in development
  if (__DEV__ && !icon) {
    console.warn('[ReportMarker] Icon missing for report:', report._id, 'reportType:', report.reportType);
  }
  
  return (
    <Marker
      key={`report-${report._id}`}
      coordinate={report.location}
      onPress={() => onPress(report)}
      tracksViewChanges={false}
      anchor={{ x: 0.5, y: 1 }}
    >
      <View style={{ width: 35, height: 35, justifyContent: 'center', alignItems: 'center', backgroundColor: 'transparent' }}>
        <Image 
          source={markerIcon} 
          style={[styles.iconMarker, { width: 35, height: 35 }]}
          resizeMode="contain"
          defaultSource={require('../../assets/icons/default.png')}
          onError={(error) => {
            if (__DEV__) {
              console.error('[ReportMarker] Image load error:', error.nativeEvent.error, 'for report:', report._id, 'icon:', markerIcon);
            }
          }}
          onLoad={() => {
            if (__DEV__) {
              console.log('[ReportMarker] Image loaded successfully for report:', report._id);
            }
          }}
        />
      </View>
    </Marker>
  );
}, (prevProps, nextProps) => {
  // Only re-render if report ID or location changed
  return (
    prevProps.report._id === nextProps.report._id &&
    prevProps.report.location?.latitude === nextProps.report.location?.latitude &&
    prevProps.report.location?.longitude === nextProps.report.location?.longitude &&
    prevProps.icon === nextProps.icon
  );
});

const GasStationMarker = React.memo<{
  station: GasStation;
  onPress: (station: GasStation) => void;
  icon: any;
}>(({ station, onPress, icon }) => {
  if (!station?.location?.coordinates) return null;
  
  const coords = station.location.coordinates;
  const coordinate = {
    latitude: Number(coords[1]),
    longitude: Number(coords[0]),
  };

  // Ensure icon exists, use default if not
  const markerIcon = icon || require('../../assets/icons/Gas_Station-MARKER.png');

  // Debug: Log icon source in development
  if (__DEV__ && !icon) {
    console.warn('[GasStationMarker] Icon missing for station:', station._id, 'brand:', station.brand);
  }

  return (
    <Marker
      key={`gas-${station._id}`}
      coordinate={coordinate}
      onPress={() => onPress(station)}
      tracksViewChanges={false}
      anchor={{ x: 0.5, y: 1 }}
    >
      <View style={{ width: 35, height: 35, justifyContent: 'center', alignItems: 'center', backgroundColor: 'transparent' }}>
        <Image 
          source={markerIcon} 
          style={[styles.iconMarker, { width: 35, height: 35 }]}
          resizeMode="contain"
          defaultSource={require('../../assets/icons/Gas_Station-MARKER.png')}
          onError={(error) => {
            if (__DEV__) {
              console.error('[GasStationMarker] Image load error:', error.nativeEvent.error, 'for station:', station._id, 'icon:', markerIcon);
            }
          }}
          onLoad={() => {
            if (__DEV__) {
              console.log('[GasStationMarker] Image loaded successfully for station:', station._id);
            }
          }}
        />
      </View>
    </Marker>
  );
}, (prevProps, nextProps) => {
  // Only re-render if station ID or location changed
  const prevCoords = prevProps.station?.location?.coordinates;
  const nextCoords = nextProps.station?.location?.coordinates;
  
  return (
    prevProps.station._id === nextProps.station._id &&
    prevCoords?.[0] === nextCoords?.[0] &&
    prevCoords?.[1] === nextCoords?.[1] &&
    prevProps.icon === nextProps.icon
  );
});

const ClusterMarkerComponent = React.memo<{
  cluster: ClusterMarker;
  onPress: (cluster: ClusterMarker) => void;
}>(({ cluster, onPress }) => {
  // CRITICAL: Validate cluster data before rendering
  if (!cluster || !cluster.coordinate || 
      typeof cluster.coordinate.latitude !== 'number' || 
      typeof cluster.coordinate.longitude !== 'number' ||
      isNaN(cluster.coordinate.latitude) || 
      isNaN(cluster.coordinate.longitude)) {
    if (__DEV__) {
      console.warn('[ClusterMarkerComponent] Invalid cluster data:', cluster);
    }
    return null;
  }

  // Calculate size based on cluster count for better visual hierarchy
  const size = Math.min(cluster.count * 3 + 30, 60); // Scale from 30px to 60px max
  
  // CRITICAL: Get cluster icon with error handling
  let clusterIcon;
  try {
    clusterIcon = getClusterIcon(cluster);
  } catch (error) {
    if (__DEV__) {
      console.error('[ClusterMarkerComponent] Error getting cluster icon:', error);
    }
    // Fallback to default icon
    clusterIcon = require('../../assets/icons/default.png');
  }
  
  return (
    <Marker
      key={cluster.id}
      coordinate={cluster.coordinate}
      onPress={() => onPress(cluster)}
      tracksViewChanges={false}
      anchor={{ x: 0.5, y: 1 }} // Anchor at bottom center for pin shape
    >
      <View style={[styles.clusterContainer, { width: size, height: size }]}>
        <Image 
          source={clusterIcon} 
          style={[styles.clusterIcon, { width: size, height: size }]} 
          defaultSource={require('../../assets/icons/default.png')}
          onError={(error) => {
            if (__DEV__) {
              console.error('[ClusterMarkerComponent] Image load error:', error.nativeEvent?.error || error, 'for cluster:', cluster.id);
            }
          }}
        />
        {cluster.count > 1 && (
          <View style={[styles.clusterBadge, { 
            top: size * 0.1, // Position relative to image size
            right: size * 0.1,
            width: size * 0.4,
            height: size * 0.4,
            borderRadius: size * 0.2,
          }]}>
            <Text style={[styles.clusterText, { 
              fontSize: size * 0.25, // Scale text with image size
            }]}>
              {cluster.count}
            </Text>
          </View>
        )}
      </View>
    </Marker>
  );
}, (prevProps, nextProps) => {
  // Only re-render if cluster ID, coordinate, or count changed
  return (
    prevProps.cluster.id === nextProps.cluster.id &&
    prevProps.cluster.coordinate.latitude === nextProps.cluster.coordinate.latitude &&
    prevProps.cluster.coordinate.longitude === nextProps.cluster.coordinate.longitude &&
    prevProps.cluster.count === nextProps.cluster.count
  );
});

const UserLocationMarker = React.memo<{
  currentLocation: LocationCoords;
  snappedRouteCoordinates: LocationCoords[];
}>(({ currentLocation, snappedRouteCoordinates }) => {
  // CRITICAL: Always show marker when location is available (even when idle/AFK)
  // App always watches user location, so marker should always be visible
  if (!currentLocation || !validateCoordinates(currentLocation)) return null;
  
  // Always create a new coordinate object to ensure Marker detects changes
  const sourceCoord = snappedRouteCoordinates && snappedRouteCoordinates.length > 0 
    ? snappedRouteCoordinates[snappedRouteCoordinates.length - 1] 
    : currentLocation;
  
  // Create new coordinate object to ensure React Native Maps detects the change
  const coordinate = {
    latitude: sourceCoord.latitude,
    longitude: sourceCoord.longitude,
  };

  return (
    <Marker 
      coordinate={coordinate} 
      title="Your Location"
      tracksViewChanges={false}
      anchor={{ x: 0.5, y: 1 }}
      // CRITICAL: Always visible when location is available
      zIndex={1000} // Ensure user marker is always on top
    >
      <View style={{ width: 40, height: 40, justifyContent: 'center', alignItems: 'center' }}>
      <Image 
        source={require('../../assets/icons/User-onTrack-MARKER.png')} 
        style={[styles.userMarker, { width: 40, height: 40 }]} 
        resizeMode="contain"
      />
      </View>
    </Marker>
  );
}, (prevProps, nextProps) => {
  // Only re-render if coordinates actually changed
  const prevCoord = prevProps.snappedRouteCoordinates && prevProps.snappedRouteCoordinates.length > 0
    ? prevProps.snappedRouteCoordinates[prevProps.snappedRouteCoordinates.length - 1]
    : prevProps.currentLocation;
  
  const nextCoord = nextProps.snappedRouteCoordinates && nextProps.snappedRouteCoordinates.length > 0
    ? nextProps.snappedRouteCoordinates[nextProps.snappedRouteCoordinates.length - 1]
    : nextProps.currentLocation;
  
  // Check if coordinates changed (with small threshold to avoid unnecessary updates)
  const coordsChanged = !prevCoord || !nextCoord ||
    Math.abs(prevCoord.latitude - nextCoord.latitude) > 0.000001 ||
    Math.abs(prevCoord.longitude - nextCoord.longitude) > 0.000001;
  
  // Return true if coordinates are the same (skip re-render), false if changed (re-render)
  return !coordsChanged;
});

const DestinationMarker = React.memo<{
  destination: any;
}>(({ destination }) => {
  if (!destination) return null;
  
  // Validate coordinates
  const lat = destination.latitude || destination.lat;
  const lng = destination.longitude || destination.lng || destination.lon;
  
  if (lat === undefined || lng === undefined || isNaN(lat) || isNaN(lng)) {
    if (__DEV__) {
      console.warn('[DestinationMarker] Invalid destination coordinates:', destination);
    }
    return null;
  }
  
  const coordinate = {
    latitude: Number(lat),
    longitude: Number(lng),
  };
  
  return (
    <Marker 
      coordinate={coordinate} 
      title="Destination"
      description={destination.address || "Your destination"}
      tracksViewChanges={false}
      anchor={{ x: 0.5, y: 1 }}
    >
      <View style={{ width: 40, height: 40, justifyContent: 'center', alignItems: 'center' }}>
      <Image 
        source={require('../../assets/icons/DESTINATION MARKER.png')} 
          style={[styles.destinationMarker, { width: 40, height: 40 }]} 
          resizeMode="contain"
      />
      </View>
    </Marker>
  );
});

const SelectedLocationMarker = React.memo<{
  selectedMapLocation: LocationCoords | null;
}>(({ selectedMapLocation }) => {
  if (!selectedMapLocation) return null;
  
  // Validate coordinates
  const lat = selectedMapLocation.latitude || selectedMapLocation.lat;
  const lng = selectedMapLocation.longitude || selectedMapLocation.lng || selectedMapLocation.lon;
  
  if (lat === undefined || lng === undefined || isNaN(lat) || isNaN(lng)) {
    if (__DEV__) {
      console.warn('[SelectedLocationMarker] Invalid selected location coordinates:', selectedMapLocation);
    }
    return null;
  }
  
  const coordinate = {
    latitude: Number(lat),
    longitude: Number(lng),
  };
  
  return (
    <Marker 
      coordinate={coordinate} 
      title="Selected Location"
      description={selectedMapLocation.address || "Tap to confirm this location"}
      tracksViewChanges={false}
      anchor={{ x: 0.5, y: 1 }}
    >
      <View style={{ width: 40, height: 40, justifyContent: 'center', alignItems: 'center' }}>
      <Image 
        source={require('../../assets/icons/DESTINATION MARKER.png')} 
          style={[styles.destinationMarker, { width: 40, height: 40 }]} 
          resizeMode="contain"
      />
      </View>
    </Marker>
  );
});

const RoutePolyline = React.memo<{
  coordinates: LocationCoords[];
  isTracking: boolean;
  color: string;
  strokeWidth: number;
  lineDashPattern?: number[];
  routeId?: string;
  isSelected?: boolean;
  onPress?: (routeId: string) => void;
}>(({ coordinates, isTracking, color, strokeWidth, lineDashPattern, routeId, isSelected, onPress }) => {
  if (!coordinates || coordinates.length <= 1) return null;
  
  // Use highlighted color if selected
  const finalColor = isSelected ? '#00ADB5' : color;
  const finalStrokeWidth = isSelected ? Math.max(strokeWidth + 2, 10) : strokeWidth;
  
  return (
    <Polyline
      coordinates={coordinates}
      strokeColor={finalColor}
      strokeWidth={finalStrokeWidth}
      lineCap="round"
      lineJoin="round"
      lineDashPattern={lineDashPattern}
      tappable={!!onPress && !!routeId && !isTracking} // Only tappable when not tracking
      onPress={() => {
        if (onPress && routeId && !isTracking) {
          onPress(routeId);
        }
      }}
    />
  );
});

interface MapComponentState {
  selectedReport: TrafficReport | null;
  selectedGasStation: GasStation | null;
  selectedCluster: ClusterMarker | null;
  currentZoom: number;
}

// Custom comparison function for React.memo to prevent unnecessary re-renders
// CRITICAL: Only re-render when marker data actually changes, NOT when region changes
// CRITICAL: Skip re-renders when screen is not focused
const arePropsEqual = (prevProps: MapComponentProps, nextProps: MapComponentProps): boolean => {
  // CRITICAL: If screen is not focused, skip re-render (don't process updates)
  if (!nextProps.isFocused) {
    return true; // Skip re-render when not focused
  }

  // Compare currentLocation by coordinates, not by reference
  const currentLocEqual = 
    (!prevProps.currentLocation && !nextProps.currentLocation) ||
    (prevProps.currentLocation?.latitude === nextProps.currentLocation?.latitude &&
     prevProps.currentLocation?.longitude === nextProps.currentLocation?.longitude);
  
  // Compare snappedRouteCoordinates - CRITICAL: User marker uses this for position
  const prevSnappedCoord = prevProps.snappedRouteCoordinates && prevProps.snappedRouteCoordinates.length > 0
    ? prevProps.snappedRouteCoordinates[prevProps.snappedRouteCoordinates.length - 1]
    : null;
  const nextSnappedCoord = nextProps.snappedRouteCoordinates && nextProps.snappedRouteCoordinates.length > 0
    ? nextProps.snappedRouteCoordinates[nextProps.snappedRouteCoordinates.length - 1]
    : null;
  
  const snappedCoordEqual = 
    (!prevSnappedCoord && !nextSnappedCoord) ||
    (prevSnappedCoord?.latitude === nextSnappedCoord?.latitude &&
     prevSnappedCoord?.longitude === nextSnappedCoord?.longitude);
  
  // Also check if the array length changed (new coordinates added)
  const snappedArrayLengthEqual = 
    (prevProps.snappedRouteCoordinates?.length || 0) === (nextProps.snappedRouteCoordinates?.length || 0);
  
  // Compare other props that might change frequently
  if (!currentLocEqual) return false;
  if (!snappedCoordEqual) return false; // Re-render if snapped coordinates changed
  if (!snappedArrayLengthEqual) return false; // Re-render if new coordinates were added
  if (prevProps.isTracking !== nextProps.isTracking) return false;
  if (prevProps.isFocused !== nextProps.isFocused) return false; // Re-render when focus changes
  
  // CRITICAL FIX: Don't compare region changes - they cause full MapView re-renders
  // Region changes should be handled via animateToRegion, not prop updates
  // Only compare region if it's a MAJOR change (different location entirely)
  const regionChangedSignificantly = 
    Math.abs((prevProps.region?.latitude || 0) - (nextProps.region?.latitude || 0)) > 0.01 ||
    Math.abs((prevProps.region?.longitude || 0) - (nextProps.region?.longitude || 0)) > 0.01;
  
  if (regionChangedSignificantly) return false;
  
  // Compare arrays by length and reference (shallow comparison)
  // CRITICAL: Marker data changes should trigger re-render
  if (prevProps.reportMarkers?.length !== nextProps.reportMarkers?.length) return false;
  if (prevProps.gasStations?.length !== nextProps.gasStations?.length) return false;
  if (prevProps.routeCoordinates?.length !== nextProps.routeCoordinates?.length) return false;
  if (prevProps.showReports !== nextProps.showReports) return false;
  if (prevProps.showGasStations !== nextProps.showGasStations) return false;
  
  // Compare mapFilters - if filters change, markers need to update
  if (prevProps.mapFilters?.showTrafficReports !== nextProps.mapFilters?.showTrafficReports) return false;
  if (prevProps.mapFilters?.showGasStations !== nextProps.mapFilters?.showGasStations) return false;
  if (prevProps.mapFilters?.showAccidents !== nextProps.mapFilters?.showAccidents) return false;
  if (prevProps.mapFilters?.showRoadwork !== nextProps.mapFilters?.showRoadwork) return false;
  if (prevProps.mapFilters?.showCongestion !== nextProps.mapFilters?.showCongestion) return false;
  if (prevProps.mapFilters?.showHazards !== nextProps.mapFilters?.showHazards) return false;
  
  // Compare map selection mode - if it changes, component needs to update
  if (prevProps.isMapSelectionMode !== nextProps.isMapSelectionMode) return false;
  if (prevProps.selectedMapLocation?.latitude !== nextProps.selectedMapLocation?.latitude) return false;
  if (prevProps.selectedMapLocation?.longitude !== nextProps.selectedMapLocation?.longitude) return false;
  
  // If all critical props are equal, skip re-render
  return true;
};

export const OptimizedMapComponent: React.FC<MapComponentProps> = memo(({
  mapRef,
  region,
  mapStyle,
  currentLocation,
  destination,
  userId,
  reportMarkers,
  gasStations,
  showReports,
  showGasStations,
  routeCoordinates,
  snappedRouteCoordinates,
  alternativeRoutes,
  selectedRouteId,
  onSelectRoute,
  isTracking,
  onReportVoted,
  onMapPress,
  selectedMapLocation,
  isMapSelectionMode = false,
  mapFilters,
  onRegionChange,
  onRegionChangeComplete,
  isFocused = true, // CRITICAL: Default to true for backward compatibility
  // 3D Navigation props
  is3DNavigation = false,
  mapPitch = 0,
  mapBearing = 0,
  elevationAngle = 0,
  cameraTilt = 0,
  cameraHeading = 0,
  cameraFollow = false,
}) => {
  // Default region (Valenzuela City) - defined early for use in early return
  const defaultRegionValue = {
    latitude: 14.7006,
    longitude: 120.9830,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  };

  // CRITICAL: Skip all updates if screen is not focused
  // This prevents unnecessary processing when user is on other tabs
  if (!isFocused) {
    // Return last known state - don't process any updates
    return (
      <View style={styles.container}>
        <MapView
          ref={mapRef}
          style={styles.map}
          region={defaultRegionValue}
          provider={PROVIDER_GOOGLE}
          showsTraffic={false}
          showsMyLocationButton={false}
          showsCompass={false}
          zoomEnabled={false}
          scrollEnabled={false}
          pitchEnabled={false}
          rotateEnabled={false}
          mapType="standard"
          toolbarEnabled={false}
          pitch={0}
        />
      </View>
    );
  }

  // Custom map style to disable 3D buildings (flat buildings)
  const flatBuildingsMapStyle = useMemo(() => {
    const baseStyle = mapStyle ? (typeof mapStyle === 'string' ? [] : mapStyle) : [];
    const flatBuildingsStyle = [
      {
        featureType: 'building',
        stylers: [{ visibility: 'off' }],
      },
      {
        featureType: 'landscape.man_made',
        elementType: 'geometry',
        stylers: [{ visibility: 'off' }],
      },
    ];
    return Array.isArray(baseStyle) ? [...baseStyle, ...flatBuildingsStyle] : flatBuildingsStyle;
  }, [mapStyle]);

  // Calculate camera props for pitch (when mapPitch is set)
  const cameraProps = useMemo(() => {
    if (mapPitch > 0 && safeRegionForRender) {
      return {
        camera: {
          center: {
            latitude: safeRegionForRender.latitude,
            longitude: safeRegionForRender.longitude,
          },
          pitch: mapPitch,
          heading: 0,
          altitude: 1000,
          zoom: safeRegionForRender.latitudeDelta && safeRegionForRender.latitudeDelta > 0 && !isNaN(safeRegionForRender.latitudeDelta) ? 
            (() => {
              try {
                const safeDelta = Math.max(0.0001, Math.min(180, safeRegionForRender.latitudeDelta));
                const zoom = Math.log2(360 / safeDelta);
                return Math.max(0, Math.min(20, zoom));
              } catch {
                return 15;
              }
            })() : 15,
        },
      };
    }
    return {};
  }, [mapPitch, safeRegionForRender?.latitude, safeRegionForRender?.longitude, safeRegionForRender?.latitudeDelta]);

  // DEBUG: Log marker data on mount and when props change (only when focused)
  useEffect(() => {
    if (__DEV__ && isFocused) {
      console.log('[OptimizedMapComponent] 📊 Marker Data Received', {
        reportMarkersCount: reportMarkers?.length || 0,
        gasStationsCount: gasStations?.length || 0,
        showReports,
        showGasStations,
        mapFilters: mapFilters ? {
          showTrafficReports: mapFilters.showTrafficReports,
          showGasStations: mapFilters.showGasStations,
          showAccidents: mapFilters.showAccidents,
          showRoadwork: mapFilters.showRoadwork,
          showCongestion: mapFilters.showCongestion,
          showHazards: mapFilters.showHazards,
        } : 'no filters',
        timestamp: new Date().toISOString(),
      });
    }
  }, [reportMarkers?.length, gasStations?.length, showReports, showGasStations, mapFilters, isFocused]);
  // Calculate initial zoom from region if available
  // CRITICAL FIX: Add validation to prevent crashes
  const initialZoom = useMemo(() => {
    if (region?.latitudeDelta && region.latitudeDelta > 0 && !isNaN(region.latitudeDelta)) {
      try {
        // Clamp latitudeDelta to prevent division by zero or invalid calculations
        const safeDelta = Math.max(0.0001, Math.min(180, region.latitudeDelta));
        const zoom = Math.round(Math.log2(360 / safeDelta));
        
        // Clamp zoom to valid range (0-20) to prevent crashes
        const clampedZoom = Math.max(0, Math.min(20, zoom));
        
        // Return valid zoom or default
        return (!isNaN(clampedZoom) && isFinite(clampedZoom)) ? clampedZoom : 15;
      } catch (error) {
        if (__DEV__) {
          console.error('[OptimizedMapComponent] Error calculating initial zoom:', error);
        }
        return 15; // Default fallback
      }
    }
    return 15; // Default to zoom level 15 (shows individual markers)
  }, [region?.latitudeDelta]);

  const [state, setState] = useState<MapComponentState>({
    selectedReport: null,
    selectedGasStation: null,
    selectedCluster: null,
    currentZoom: initialZoom,
  });

  // Track map center coordinate for map selection mode
  const [mapCenterCoordinate, setMapCenterCoordinate] = useState<LocationCoords | null>(
    region ? { latitude: region.latitude, longitude: region.longitude } : null
  );

  // Track icon preload state to ensure icons are ready before rendering markers
  // CRITICAL: Start with true if icons are already preloaded (from app startup)
  const [iconsReady, setIconsReady] = useState(iconsPreloaded);

  // Ensure icons are preloaded on mount and check if markers need reload
  useEffect(() => {
    if (!iconsReady) {
      ensureIconsPreloaded().then(() => {
        setIconsReady(true);
        if (__DEV__) {
          console.log('[OptimizedMapComponent] ✅ Icons ready, forcing re-render');
        }
      });
    } else if (__DEV__) {
      console.log('[OptimizedMapComponent] ✅ Icons already preloaded');
    }
  }, [iconsReady]);

  // Check if markers are showing default icons and reload if needed
  // This ensures markers show proper icons on app start (logged in or not)
  useEffect(() => {
    if (!isFocused) return;

    // Wait a bit for markers to render
    const checkTimeout = setTimeout(() => {
      // Check if we have markers but icons might not be loaded
      const hasMarkers = (reportMarkers?.length || 0) > 0 || (gasStations?.length || 0) > 0;
      
      // If we have markers but icons aren't ready, ensure they're loaded
      if (hasMarkers && !iconsReady) {
        if (__DEV__) {
          console.log('[OptimizedMapComponent] ⚠️ Markers present but icons not ready, ensuring icons are loaded');
        }
        // Force icon reload
        ensureIconsPreloaded().then(() => {
          setIconsReady(true);
          if (__DEV__) {
            console.log('[OptimizedMapComponent] ✅ Icons reloaded, markers should now show proper icons');
          }
        }).catch((error) => {
          if (__DEV__) {
            console.warn('[OptimizedMapComponent] Failed to reload icons:', error);
          }
        });
      }
    }, 1500); // Check after 1.5 seconds to allow initial render

    return () => {
      clearTimeout(checkTimeout);
    };
  }, [isFocused, iconsReady, reportMarkers?.length, gasStations?.length]);

  // Sync zoom when region changes (important for initial render)
  // CRITICAL: Skip zoom sync when screen is not focused
  // CRITICAL FIX: Add validation to prevent crashes when zooming out
  useEffect(() => {
    if (!isFocused) {
      return; // Silent skip - no updates when not focused
    }

    if (region?.latitudeDelta && region.latitudeDelta > 0 && !isNaN(region.latitudeDelta)) {
      try {
        // Clamp latitudeDelta to prevent division by zero or invalid calculations
        const safeDelta = Math.max(0.0001, Math.min(180, region.latitudeDelta));
        const zoom = Math.round(Math.log2(360 / safeDelta));
        
        // Clamp zoom to valid range (0-20) to prevent crashes
        const clampedZoom = Math.max(0, Math.min(20, zoom));
        
        // Only update if zoom is valid and different
        if (!isNaN(clampedZoom) && isFinite(clampedZoom)) {
      setState(prev => {
            if (prev.currentZoom !== clampedZoom) {
          return {
            ...prev,
                currentZoom: clampedZoom,
          };
        }
        return prev;
      });
        }
      } catch (error) {
        if (__DEV__) {
          console.error('[OptimizedMapComponent] Error calculating zoom:', error);
        }
        // Fallback to default zoom
        setState(prev => {
          if (prev.currentZoom !== 15) {
            return {
              ...prev,
              currentZoom: 15,
            };
          }
          return prev;
        });
      }
    }
  }, [region?.latitudeDelta, isFocused]);

  // Apply map filters to markers
  const filteredReportMarkers = useMemo(() => {
    // If showReports is false, return empty array
    if (!showReports) {
      return [];
    }
    
    // If no reportMarkers, return empty array
    if (!reportMarkers) {
      return [];
    }
    
    // First, filter out archived reports (CRITICAL: Only show non-archived reports)
    const nonArchivedReports = reportMarkers.filter((report: any) => {
      // Filter out archived reports
      if (report.archived === true) {
        if (__DEV__) {
          console.log('[OptimizedMapComponent] 🗑️ Filtering out archived report:', report._id);
        }
        return false;
      }
      
      // Filter out reports with invalid status
      if (report.status === 'archived' || report.status === 'deleted') {
        if (__DEV__) {
          console.log('[OptimizedMapComponent] 🗑️ Filtering out report with status:', report.status, report._id);
        }
        return false;
      }
      
      return true;
    });
    
    // If no mapFilters, return non-archived reports
    if (!mapFilters) {
      return nonArchivedReports;
    }
    
    // Apply map filters to non-archived reports
    const filtered = nonArchivedReports.filter((report: any) => {
      if (!mapFilters.showTrafficReports) return false;
      
      // Filter by report type
      switch (report.reportType) {
        case 'accident':
          return mapFilters.showAccidents;
        case 'roadwork':
          return mapFilters.showRoadwork;
        case 'congestion':
          return mapFilters.showCongestion;
        case 'hazard':
          return mapFilters.showHazards;
        default:
          return true;
      }
    });
    
    if (__DEV__) {
      console.log('[OptimizedMapComponent] 🔍 Filtered report markers', {
        originalCount: reportMarkers?.length || 0,
        nonArchivedCount: nonArchivedReports.length,
        filteredCount: filtered.length,
        showReports,
        showTrafficReports: mapFilters?.showTrafficReports,
        timestamp: new Date().toISOString(),
      });
    }
    
    return filtered;
  }, [reportMarkers, mapFilters, showReports]);

  // Memoized filtered data to prevent unnecessary recalculations
  // First validate coordinates, then apply map filters
  const validGasStations = useMemo(() => {
    return gasStations.filter(station => {
      const coords = station?.location?.coordinates;
      if (!coords || !Array.isArray(coords) || coords.length < 2) return false;
      return validateCoordinates({
        latitude: Number(coords[1]),
        longitude: Number(coords[0]),
      });
    });
  }, [gasStations]);

  // Apply map filters to valid gas stations
  const filteredGasStationMarkers = useMemo(() => {
    // If no mapFilters, return all valid gas stations
    if (!mapFilters || !validGasStations) return validGasStations || [];
    
    // If gas stations are globally disabled, return empty
    if (!mapFilters.showGasStations) return [];
    
    // Debug: Log brand names in development (once per filter calculation)
    if (__DEV__ && validGasStations.length > 0) {
      const uniqueBrands = [...new Set(validGasStations.map((s: any) => s.brand?.toLowerCase()?.trim() || 'unknown'))];
      console.log('[OptimizedMapComponent] 🔍 Gas station brands found:', uniqueBrands);
      console.log('[OptimizedMapComponent] 🔍 Map filter settings:', {
        showPetron: mapFilters.showPetron,
        showShell: mapFilters.showShell,
        showCaltex: mapFilters.showCaltex,
        showOtherGasStations: mapFilters.showOtherGasStations,
      });
    }
    
    // Filter by gas station brand
    // CRITICAL: Only Petron, Shell, and Caltex have individual toggles
    // All other brands (Unioil, Cleanfuel, Flying V, Jetti, Petro Gazz, Phoenix, Rephil, Seaoil, Total, etc.) 
    // are grouped under "Other Stations"
    const filtered = validGasStations.filter((station: any) => {
      // Normalize brand name: lowercase, trim whitespace, handle variations
      const brand = station.brand?.toLowerCase()?.trim()?.replace(/\s+/g, ' ') || '';
      
      // Check individual toggles for Petron, Shell, and Caltex only
      if (brand === 'petron') {
          return mapFilters.showPetron;
      }
      if (brand === 'shell') {
          return mapFilters.showShell;
      }
      if (brand === 'caltex') {
          return mapFilters.showCaltex;
      }
      
      // All other brands are grouped under "Other Stations"
      // This includes: Unioil, Cleanfuel, Flying V, Jetti, Petro Gazz, Phoenix, Rephil, Seaoil, Total, and any unknown brands
      return mapFilters.showOtherGasStations;
    });
    
    if (__DEV__) {
      console.log('[OptimizedMapComponent] 🔍 Filtered gas station markers', {
        originalCount: validGasStations?.length || 0,
        filteredCount: filtered.length,
        showGasStations: mapFilters?.showGasStations,
        timestamp: new Date().toISOString(),
      });
    }
    
    return filtered;
  }, [validGasStations, mapFilters?.showGasStations, mapFilters?.showPetron, mapFilters?.showShell, mapFilters?.showCaltex, mapFilters?.showOtherGasStations]);

  // Ref to prevent rapid state changes
  const isSelectingRef = useRef(false);

  // Memoized icon mapping to prevent recreation on every render
  // Include both capitalized and lowercase versions for better matching
  const iconMap = useMemo(() => {
    const map: Record<string, any> = {
      // Traffic incidents - multiple variations
      'Accident': require('../../assets/icons/ROAD INCIDENTS ICON/Road_Accident.png'),
      'accident': require('../../assets/icons/ROAD INCIDENTS ICON/Road_Accident.png'),
      'Traffic Jam': require('../../assets/icons/ROAD INCIDENTS ICON/Traffic_Jam.png'),
      'traffic jam': require('../../assets/icons/ROAD INCIDENTS ICON/Traffic_Jam.png'),
      'congestion': require('../../assets/icons/ROAD INCIDENTS ICON/Traffic_Jam.png'),
      'Congestion': require('../../assets/icons/ROAD INCIDENTS ICON/Traffic_Jam.png'),
      'Hazard': require('../../assets/icons/ROAD INCIDENTS ICON/Hazard.png'),
      'hazard': require('../../assets/icons/ROAD INCIDENTS ICON/Hazard.png'),
      'Road Closure': require('../../assets/icons/ROAD INCIDENTS ICON/Road_Closure.png'),
      'road closure': require('../../assets/icons/ROAD INCIDENTS ICON/Road_Closure.png'),
      'roadwork': require('../../assets/icons/ROAD INCIDENTS ICON/Road_Closure.png'),
      'Roadwork': require('../../assets/icons/ROAD INCIDENTS ICON/Road_Closure.png'),
      
      // Gas stations - multiple variations
      'Caltex': require('../../assets/icons/GAS_STATIONS/CALTEX.png'),
      'caltex': require('../../assets/icons/GAS_STATIONS/CALTEX.png'),
      'Cleanfuel': require('../../assets/icons/GAS_STATIONS/CLEANFUEL.png'),
      'cleanfuel': require('../../assets/icons/GAS_STATIONS/CLEANFUEL.png'),
      'Flying V': require('../../assets/icons/GAS_STATIONS/FLYINGV.png'),
      'flying v': require('../../assets/icons/GAS_STATIONS/FLYINGV.png'),
      'flyingv': require('../../assets/icons/GAS_STATIONS/FLYINGV.png'),
      'Jetti': require('../../assets/icons/GAS_STATIONS/JETTI.png'),
      'jetti': require('../../assets/icons/GAS_STATIONS/JETTI.png'),
      'Petro Gazz': require('../../assets/icons/GAS_STATIONS/PETROGAZZ.png'),
      'petro gazz': require('../../assets/icons/GAS_STATIONS/PETROGAZZ.png'),
      'petrogazz': require('../../assets/icons/GAS_STATIONS/PETROGAZZ.png'),
      'Petron': require('../../assets/icons/GAS_STATIONS/PETRON.png'),
      'petron': require('../../assets/icons/GAS_STATIONS/PETRON.png'),
      'Phoenix': require('../../assets/icons/GAS_STATIONS/PHOENIX.png'),
      'phoenix': require('../../assets/icons/GAS_STATIONS/PHOENIX.png'),
      'Rephil': require('../../assets/icons/GAS_STATIONS/REPHIL.png'),
      'rephil': require('../../assets/icons/GAS_STATIONS/REPHIL.png'),
      'Seaoil': require('../../assets/icons/GAS_STATIONS/SEAOIL.png'),
      'seaoil': require('../../assets/icons/GAS_STATIONS/SEAOIL.png'),
      'Shell': require('../../assets/icons/GAS_STATIONS/SHELL.png'),
      'shell': require('../../assets/icons/GAS_STATIONS/SHELL.png'),
      'Total': require('../../assets/icons/GAS_STATIONS/TOTAL.png'),
      'total': require('../../assets/icons/GAS_STATIONS/TOTAL.png'),
      'Unioil': require('../../assets/icons/GAS_STATIONS/UNIOIL.png'),
      'unioil': require('../../assets/icons/GAS_STATIONS/UNIOIL.png'),
    };
    return map;
  }, []);

  const getIcon = useCallback((type: string) => {
    if (!type) return require('../../assets/icons/default.png');
    
    // Try exact match first
    if (iconMap[type]) return iconMap[type];
    
    // Try case-insensitive match
    const lowerType = type.toLowerCase();
    const matchedKey = Object.keys(iconMap).find(key => key.toLowerCase() === lowerType);
    if (matchedKey) return iconMap[matchedKey];
    
    // Fallback to default icon
    return require('../../assets/icons/default.png');
  }, [iconMap]);

  // Normalize report type to match icon mapping
  const normalizeReportType = useCallback((reportType: string): string => {
    if (!reportType) return 'accident';
    const normalized = reportType.toLowerCase().trim();
    // Map common variations to standard types
    if (normalized.includes('accident') || normalized === 'accident') return 'accident';
    if (normalized.includes('congestion') || normalized.includes('jam') || normalized === 'congestion' || normalized === 'traffic jam') return 'congestion';
    if (normalized.includes('hazard') || normalized === 'hazard') return 'hazard';
    if (normalized.includes('roadwork') || normalized.includes('closure') || normalized === 'roadwork' || normalized === 'road closure') return 'roadwork';
    return normalized; // Return as-is if no match
  }, []);

  // Normalize gas station brand to match icon mapping
  const normalizeBrand = useCallback((brand: string): string => {
    if (!brand) return 'other';
    const normalized = brand.toLowerCase().trim().replace(/\s+/g, ' ');
    // Map common variations to standard brands
    if (normalized.includes('petron')) return 'petron';
    if (normalized.includes('shell')) return 'shell';
    if (normalized.includes('caltex')) return 'caltex';
    if (normalized.includes('unioil')) return 'unioil';
    if (normalized.includes('cleanfuel')) return 'cleanfuel';
    if (normalized.includes('flying') && normalized.includes('v')) return 'flying v';
    if (normalized.includes('jetti')) return 'jetti';
    if (normalized.includes('petro') && normalized.includes('gazz')) return 'petro gazz';
    if (normalized.includes('phoenix')) return 'phoenix';
    if (normalized.includes('rephil')) return 'rephil';
    if (normalized.includes('seaoil')) return 'seaoil';
    if (normalized.includes('total')) return 'total';
    return normalized; // Return as-is if no match
  }, []);

  // Get icon for report using proper icon function
  const getReportIconForMarker = useCallback((reportType: string) => {
    const normalized = normalizeReportType(reportType);
    return getReportIcon(normalized);
  }, [normalizeReportType]);

  // Get icon for gas station using proper icon function
  // CRITICAL: Function name must be exactly 'getGasStationIconForMarker' (uppercase 'F' in 'For')
  // Any typo with lowercase 'f' will cause "Property doesn't exist" error
  const getGasStationIconForMarker = useCallback((brand: string) => {
    if (!brand) {
      return getGasStationIcon('other');
    }
    const normalized = normalizeBrand(brand);
    return getGasStationIcon(normalized);
  }, [normalizeBrand]);

  // Memoized clusters using backend service for better performance
  const [clusters, setClusters] = useState<ClusterMarker[]>([]);
  const [clustersLoading, setClustersLoading] = useState(false);

  useEffect(() => {
    // CRITICAL: Skip clustering updates when screen is not focused
    if (!isFocused) {
      return; // Silent skip - no updates when not focused
    }

    // CRITICAL FIX: Validate zoom before clustering
    if (isNaN(state.currentZoom) || !isFinite(state.currentZoom) || state.currentZoom < 0 || state.currentZoom > 20) {
      if (__DEV__) {
        console.warn('[OptimizedMapComponent] Invalid zoom for clustering:', state.currentZoom);
      }
      setClusters([]);
      return;
    }

    const processClusters = async () => {
      if (!showReports && !showGasStations) {
        setClusters([]);
        return;
      }

      setClustersLoading(true);
      try {
        // CRITICAL FIX: Limit marker count to prevent memory issues when zooming out
        const maxMarkers = 1000; // Limit to prevent crashes
        const reports = showReports ? (filteredReportMarkers || []).slice(0, maxMarkers) : [];
        const gasStations = showGasStations ? filteredGasStationMarkers.slice(0, maxMarkers) : [];
        
        // Skip clustering if too many markers (will cause memory issues)
        if (reports.length + gasStations.length > maxMarkers * 2) {
          if (__DEV__) {
            console.warn('[OptimizedMapComponent] Too many markers for clustering, skipping');
          }
          setClusters([]);
          setClustersLoading(false);
          return;
        }

        const response = await clusterMarkersService({
          reports,
          gasStations,
          currentZoom: state.currentZoom,
          options: {
            radius: 100, // 100 meters
            minZoom: 15,
            maxZoom: 10,
          }
        });

        // CRITICAL: Validate and filter cluster response to prevent crashes
        const validClusters = (response.clusters || []).filter((cluster: any) => {
          return cluster && 
                 cluster.coordinate && 
                 typeof cluster.coordinate.latitude === 'number' && 
                 typeof cluster.coordinate.longitude === 'number' &&
                 !isNaN(cluster.coordinate.latitude) && 
                 !isNaN(cluster.coordinate.longitude) &&
                 cluster.coordinate.latitude >= -90 &&
                 cluster.coordinate.latitude <= 90 &&
                 cluster.coordinate.longitude >= -180 &&
                 cluster.coordinate.longitude <= 180 &&
                 cluster.id && // Ensure cluster has an ID
                 typeof cluster.count === 'number' && 
                 cluster.count > 0; // Ensure cluster has a valid count
        });

        setClusters(validClusters);
      } catch (error) {
        if (__DEV__) {
          console.error('[OptimizedMapComponent] Clustering error:', error);
        }
        // Fallback to empty clusters - don't crash the app
        setClusters([]);
      } finally {
        setClustersLoading(false);
      }
    };

    // CRITICAL FIX: Debounce clustering to prevent excessive calls during zoom
    const timeoutId = setTimeout(() => {
    processClusters();
    }, 100); // 100ms debounce

    return () => {
      clearTimeout(timeoutId);
    };
  }, [filteredReportMarkers, filteredGasStationMarkers, showReports, showGasStations, state.currentZoom, isFocused]);

  // Memoized individual markers - ALWAYS compute them, rendering logic decides when to show
  // CRITICAL FIX: Don't return empty array based on zoom - compute markers regardless of zoom
  const individualMarkers = useMemo(() => {
    // CRITICAL FIX: Use filteredReportMarkers instead of reportMarkers to respect map filters
    // Use proper icon function with normalized report types
    const reports = showReports ? (filteredReportMarkers || []).map(report => ({
      report,
      icon: getReportIconForMarker(report.reportType || 'accident'),
    })) : [];
    
    // CRITICAL FIX: Use filteredGasStationMarkers instead of validGasStations to respect map filters
    // Use proper icon function with normalized brands
    const gasStations = showGasStations ? filteredGasStationMarkers.map(station => ({
      station,
      icon: getGasStationIconForMarker(station.brand || 'other'),
    })) : [];
    
    if (__DEV__) {
      console.log('[OptimizedMapComponent] 🗺️ Individual markers computed', {
        reportsCount: reports.length,
        gasStationsCount: gasStations.length,
        currentZoom: state.currentZoom,
        showReports,
        showGasStations,
        filteredReportMarkersCount: filteredReportMarkers?.length || 0,
        filteredGasStationMarkersCount: filteredGasStationMarkers?.length || 0,
        willShowAsClusters: state.currentZoom <= 10,
        willShowAsIndividual: state.currentZoom > 10,
        timestamp: new Date().toISOString(),
      });
    }
    
    return { reports, gasStations };
  }, [filteredReportMarkers, filteredGasStationMarkers, showReports, showGasStations, state.currentZoom, getReportIconForMarker, getGasStationIconForMarker, iconsReady]);

  // Memoized route polylines to prevent recreation
  // CRITICAL: Show polylines for both free drive and destination navigation
  // In free drive mode, show the tracked path (snappedRouteCoordinates or routeCoordinates)
  const routePolylines = useMemo(() => {
    const polylines = [];
    
    // CRITICAL: For free drive mode (isTracking && no destination), show tracked path
    // For destination navigation, show planned route
    const shouldShowTrackedPath = isTracking;
    
    if (shouldShowTrackedPath) {
      // Snapped route (preferred) - shows the actual path traveled
      if (snappedRouteCoordinates && snappedRouteCoordinates.length > 1) {
        polylines.push({
          coordinates: snappedRouteCoordinates,
          color: "#1e3a8a", // Dark blue color for tracked path
          strokeWidth: 8, // Thick line
          lineDashPattern: undefined, // Solid line
        });
      }
      
      // Fallback to original coordinates if snapped coordinates not available
      if ((!snappedRouteCoordinates || snappedRouteCoordinates.length <= 1) && 
          routeCoordinates && routeCoordinates.length > 1) {
        polylines.push({
          coordinates: routeCoordinates,
          color: "#1e3a8a", // Dark blue color for tracked path
          strokeWidth: 8, // Thick line
          lineDashPattern: undefined, // Solid line
        });
      }
    } else {
      // When not tracking, show planned route if available (destination navigation)
      // CRITICAL: Main route polyline must have routeId for selection/highlighting
      // Snapped route (preferred)
      if (snappedRouteCoordinates && snappedRouteCoordinates.length > 1) {
        polylines.push({
          coordinates: snappedRouteCoordinates,
          color: "#1e3a8a", // Dark blue color
          strokeWidth: 8, // Thick line
          lineDashPattern: undefined, // Solid line
          routeId: selectedRouteId || 'main-route', // CRITICAL: Add routeId for selection
        });
      }
      
      // Fallback to original coordinates
      if ((!snappedRouteCoordinates || snappedRouteCoordinates.length <= 1) && 
          routeCoordinates && routeCoordinates.length > 1) {
        polylines.push({
          coordinates: routeCoordinates,
          color: "#1e3a8a", // Dark blue color
          strokeWidth: 8, // Thick line
          lineDashPattern: undefined, // Solid line
          routeId: selectedRouteId || 'main-route', // CRITICAL: Add routeId for selection
        });
      }
    }
    
    // Add alternative routes as thinner polylines (only for destination navigation)
    // CRITICAL: Exclude the selected route from alternatives to avoid duplication
    // Make them pressable for route selection
    if (!shouldShowTrackedPath && alternativeRoutes && alternativeRoutes.length > 0) {
      alternativeRoutes.forEach((route, index) => {
        // Skip if this route is the currently selected route (already shown as main route)
        if (route.id === selectedRouteId) {
          return;
        }
        
        if (route.coordinates && route.coordinates.length > 1) {
          polylines.push({
            coordinates: route.coordinates,
            color: "#3b82f6", // Lighter blue for alternatives
            strokeWidth: 4, // Thinner than main route
            lineDashPattern: undefined, // Solid line
            routeId: route.id || `alt-route-${index}`, // Use route ID from data
          });
        }
      });
    }
    
    // Add route IDs to main route polylines
    // CRITICAL: Ensure unique routeIds to prevent duplicate keys
    const seenRouteIds = new Set<string>();
    
    return polylines.map((polyline, index) => {
      // Generate unique routeId if not already set
      let uniqueRouteId = polyline.routeId;
      
      if (!uniqueRouteId) {
        // For main route (first polyline when not tracking)
        if (index === 0 && !isTracking) {
          uniqueRouteId = selectedRouteId || 'main-route';
        } else {
          // For alternative routes or tracked paths, use index-based ID
          uniqueRouteId = `route-${index}`;
        }
      }
      
      // Ensure routeId is unique - if duplicate, append index
      let finalRouteId = uniqueRouteId;
      let suffix = 0;
      while (seenRouteIds.has(finalRouteId)) {
        suffix++;
        finalRouteId = `${uniqueRouteId}-${suffix}`;
      }
      seenRouteIds.add(finalRouteId);
      
      // Generate unique key using routeId + index + first coordinate (for guaranteed uniqueness)
      const firstCoord = polyline.coordinates?.[0];
      const coordHash = firstCoord 
        ? `${firstCoord.latitude.toFixed(6)}-${firstCoord.longitude.toFixed(6)}`
        : index.toString();
      const uniqueKey = `polyline-${finalRouteId}-${index}-${coordHash}`;
      
      return {
        ...polyline,
        routeId: finalRouteId,
        uniqueKey, // Add unique key for React rendering
      };
    });
  }, [snappedRouteCoordinates, routeCoordinates, alternativeRoutes, isTracking, selectedRouteId]);

  const handleReportPress = useCallback(async (report: TrafficReport) => {
    try {
      if (isSelectingRef.current) {
        if (__DEV__) {
          console.log('[OptimizedMapComponent] Selection already in progress, ignoring report press');
        }
        return;
      }

      // Check if map selection is active
      if (selectedMapLocation && onMapPress) {
        // Map selection mode: set marker location as destination
        if (__DEV__) {
          console.log('[OptimizedMapComponent] Report marker pressed in map selection mode, setting as destination');
        }
        
        if (!report.location || !validateCoordinates(report.location)) {
          if (__DEV__) {
            console.warn('[OptimizedMapComponent] Invalid report location, cannot set as destination');
          }
          return;
        }

        isSelectingRef.current = true;
        
        try {
          // Get address from reverse geocoding
          const address = await reverseGeocodeLocation(
            report.location.latitude,
            report.location.longitude
          );

          const location: LocationCoords = {
            latitude: report.location.latitude,
            longitude: report.location.longitude,
            address: address,
          };

          // Set destination via onMapPress
          onMapPress({ nativeEvent: { coordinate: location } });
          
          if (__DEV__) {
            console.log('[OptimizedMapComponent] Destination set from report marker:', address);
          }
        } catch (error) {
          if (__DEV__) {
            console.error('[OptimizedMapComponent] Error setting destination from report marker:', error);
          }
          // Fallback: set destination without address
          const location: LocationCoords = {
            latitude: report.location.latitude,
            longitude: report.location.longitude,
            address: report.address || 'Selected Location',
          };
          onMapPress({ nativeEvent: { coordinate: location } });
        } finally {
          setTimeout(() => {
            isSelectingRef.current = false;
          }, 300);
        }
        return;
      }

      // Normal mode: show report card
      if (__DEV__) {
        console.log('[OptimizedMapComponent] Report pressed:', report._id);
      }
      isSelectingRef.current = true;
      
      // Initialize silent vote count for this report
      const reportVoteCount = report.votes?.reduce((sum, vote) => sum + vote.vote, 0) || 0;
      silentVoteManager.initializeVoteCount(report._id, reportVoteCount);
      
      setState(prev => ({
        ...prev,
        selectedReport: report,
        selectedGasStation: null,
        selectedCluster: null,
      }));

      // Reset selection flag after a short delay
      setTimeout(() => {
        isSelectingRef.current = false;
      }, 300);
    } catch (error) {
      if (__DEV__) {
        console.error('[OptimizedMapComponent] Error handling report press:', error);
      }
      isSelectingRef.current = false;
    }
  }, [selectedMapLocation, onMapPress]);

  const handleGasStationPress = useCallback(async (station: GasStation) => {
    try {
      if (isSelectingRef.current) {
        if (__DEV__) {
          console.log('[OptimizedMapComponent] Selection already in progress, ignoring gas station press');
        }
        return;
      }

      // Check if map selection is active
      if (selectedMapLocation && onMapPress) {
        // Map selection mode: set marker location as destination
        if (__DEV__) {
          console.log('[OptimizedMapComponent] Gas station marker pressed in map selection mode, setting as destination');
        }
        
        const coords = station.location?.coordinates;
        if (!coords || coords.length < 2) {
          if (__DEV__) {
            console.warn('[OptimizedMapComponent] Invalid gas station location, cannot set as destination');
          }
          return;
        }

        isSelectingRef.current = true;
        
        try {
          const latitude = Number(coords[1]);
          const longitude = Number(coords[0]);
          
          if (isNaN(latitude) || isNaN(longitude)) {
            throw new Error('Invalid coordinates');
          }

          // Get address from reverse geocoding
          const address = await reverseGeocodeLocation(latitude, longitude);

          const location: LocationCoords = {
            latitude: latitude,
            longitude: longitude,
            address: address,
          };

          // Set destination via onMapPress
          onMapPress({ nativeEvent: { coordinate: location } });
          
          if (__DEV__) {
            console.log('[OptimizedMapComponent] Destination set from gas station marker:', address);
          }
        } catch (error) {
          if (__DEV__) {
            console.error('[OptimizedMapComponent] Error setting destination from gas station marker:', error);
          }
          // Fallback: set destination without address
          const latitude = Number(coords[1]);
          const longitude = Number(coords[0]);
          const location: LocationCoords = {
            latitude: latitude,
            longitude: longitude,
            address: typeof station.address === 'string' 
              ? station.address 
              : station.address 
                ? `${station.address.street || ""}, ${station.address.city || ""}, ${station.address.province || ""}`.trim()
                : 'Gas Station',
          };
          onMapPress({ nativeEvent: { coordinate: location } });
        } finally {
          setTimeout(() => {
            isSelectingRef.current = false;
          }, 300);
        }
        return;
      }

      // Normal mode: show gas station card
      if (__DEV__) {
        console.log('[OptimizedMapComponent] Gas station pressed:', station._id);
      }
      isSelectingRef.current = true;
      
      setState(prev => ({
        ...prev,
        selectedGasStation: station,
        selectedReport: null,
        selectedCluster: null,
      }));

      // Reset selection flag after a short delay
      setTimeout(() => {
        isSelectingRef.current = false;
      }, 300);
    } catch (error) {
      if (__DEV__) {
        console.error('[OptimizedMapComponent] Error handling gas station press:', error);
      }
      isSelectingRef.current = false;
    }
  }, [selectedMapLocation, onMapPress]);

  const handleClusterPress = useCallback((cluster: ClusterMarker) => {
    try {
      if (isSelectingRef.current) {
        if (__DEV__) {
          console.log('[OptimizedMapComponent] Selection already in progress, ignoring cluster press');
        }
        return;
      }

      if (__DEV__) {
        console.log('[OptimizedMapComponent] Cluster pressed:', cluster.id);
      }
      isSelectingRef.current = true;
      
      setState(prev => ({
        ...prev,
        selectedCluster: cluster,
        selectedReport: null,
        selectedGasStation: null,
      }));

      // Reset selection flag after a short delay
      setTimeout(() => {
        isSelectingRef.current = false;
      }, 300);
    } catch (error) {
      if (__DEV__) {
        console.error('[OptimizedMapComponent] Error handling cluster press:', error);
      }
      isSelectingRef.current = false;
    }
  }, []);

  const handleVote = useCallback(async (reportId: string, userId: string, vote: number) => {
    try {
      if (__DEV__) {
        console.log('[OptimizedMapComponent] Silent voting on report:', { reportId, userId, vote });
      }
      
      // Use silent vote manager - no state updates, no re-renders
      await silentVoteManager.silentVote(reportId, userId, vote);
      
      if (__DEV__) {
        console.log('[OptimizedMapComponent] Silent vote queued successfully');
      }
      
      // Notify parent component for data refresh (but don't wait for it)
      if (onReportVoted) {
        onReportVoted();
      }
    } catch (error) {
      console.error('[OptimizedMapComponent] Silent vote failed:', error);
      throw error; // Re-throw to allow ReportCard to handle it
    }
  }, [onReportVoted]);

  // Update selectedReport when reportMarkers are refreshed (e.g., after voting)
  // This ensures the selected report shows the latest vote count from backend
  useEffect(() => {
    if (state.selectedReport && reportMarkers) {
      // Find the updated report in the fresh reportMarkers
      const updatedReport = reportMarkers.find((r: any) => r._id === state.selectedReport?._id);
      
      if (updatedReport) {
        // Check if votes have changed
        const currentVoteCount = state.selectedReport.votes?.reduce((sum: number, v: any) => sum + (v.vote || 0), 0) || 0;
        const updatedVoteCount = updatedReport.votes?.reduce((sum: number, v: any) => sum + (v.vote || 0), 0) || 0;
        
        if (currentVoteCount !== updatedVoteCount) {
          if (__DEV__) {
            console.log('[OptimizedMapComponent] ✅ Updating selectedReport with fresh data from backend', {
              reportId: state.selectedReport._id,
              oldVoteCount: currentVoteCount,
              newVoteCount: updatedVoteCount,
            });
          }
          
          // Update selectedReport with fresh data from backend
          setState(prev => ({
            ...prev,
            selectedReport: updatedReport,
          }));
        }
      }
    }
  }, [reportMarkers, state.selectedReport?._id]);

  const closeSelection = useCallback(() => {
    try {
      console.log('[OptimizedMapComponent] Closing selection');
      setState(prev => ({
        ...prev,
        selectedReport: null,
        selectedGasStation: null,
        selectedCluster: null,
      }));
    } catch (error) {
      console.error('[OptimizedMapComponent] Error closing selection:', error);
    }
  }, []);

  const handleRegionChange = useCallback((region: any) => {
    // CRITICAL: Skip region change updates when screen is not focused
    if (!isFocused) {
      return; // Silent skip - no updates when not focused
    }

    // CRITICAL FIX: Add validation to prevent crashes when zooming out
    if (!region?.latitudeDelta || region.latitudeDelta <= 0 || isNaN(region.latitudeDelta)) {
      return; // Skip invalid region data
    }

    try {
      // CRITICAL: When in map selection mode, update center coordinate based on region center
      // This allows the destination marker to follow the map center as user pans
      if (isMapSelectionMode && region?.latitude && region?.longitude) {
        const centerCoord: LocationCoords = {
          latitude: region.latitude,
          longitude: region.longitude,
        };
        
        // Update center coordinate state
        setMapCenterCoordinate(centerCoord);
        
        // Update selected location via onMapPress callback
        // This ensures parent component knows about the new center location
        if (onMapPress) {
          onMapPress({
            nativeEvent: {
              coordinate: centerCoord,
            },
          });
        }
      }

      // Clamp latitudeDelta to prevent division by zero or invalid calculations
      const safeDelta = Math.max(0.0001, Math.min(180, region.latitudeDelta));
      const zoom = Math.round(Math.log2(360 / safeDelta));
      
      // Clamp zoom to valid range (0-20) to prevent crashes
      const clampedZoom = Math.max(0, Math.min(20, zoom));
      
      // Only update if zoom is valid
      if (!isNaN(clampedZoom) && isFinite(clampedZoom)) {
    // Use setTimeout to prevent state updates during render
    setTimeout(() => {
          setState(prev => {
            // Only update if zoom actually changed
            if (prev.currentZoom !== clampedZoom) {
              return {
        ...prev,
                currentZoom: clampedZoom,
              };
            }
            return prev;
          });
    }, 0);
      }
    } catch (error) {
      if (__DEV__) {
        console.error('[OptimizedMapComponent] Error in handleRegionChange:', error);
      }
      // Silently fail - don't crash the app
      return;
    }
    
    // Notify parent that user manually panned the map (disable auto-follow)
    // This fires when user drags the map, allowing them to pan freely
    // IMPORTANT: This should only fire on manual user interaction, not during animateToRegion
    if (onRegionChange) {
      onRegionChange(region);
    }
  }, [onRegionChange, isFocused, isMapSelectionMode, onMapPress]);

  const handleRegionChangeComplete = useCallback((region: any) => {
    // CRITICAL: Skip region change complete updates when screen is not focused
    if (!isFocused) {
      return; // Silent skip - no updates when not focused
    }

    // CRITICAL FIX: Add validation to prevent crashes when zooming out
    if (!region?.latitudeDelta || region.latitudeDelta <= 0 || isNaN(region.latitudeDelta)) {
      return; // Skip invalid region data
    }

    try {
      // CRITICAL: When in map selection mode, update center coordinate when panning completes
      // This ensures the final selected location is accurate
      if (isMapSelectionMode && region?.latitude && region?.longitude) {
        const centerCoord: LocationCoords = {
          latitude: region.latitude,
          longitude: region.longitude,
        };
        
        // Update center coordinate state
        setMapCenterCoordinate(centerCoord);
        
        // Update selected location via onMapPress callback
        // This ensures parent component knows about the final center location
        if (onMapPress) {
          onMapPress({
            nativeEvent: {
              coordinate: centerCoord,
            },
          });
        }
      }

      // Clamp latitudeDelta to prevent division by zero or invalid calculations
      const safeDelta = Math.max(0.0001, Math.min(180, region.latitudeDelta));
      const zoom = Math.round(Math.log2(360 / safeDelta));
      
      // Clamp zoom to valid range (0-20) to prevent crashes
      const clampedZoom = Math.max(0, Math.min(20, zoom));
      
      // Only update if zoom is valid
      if (!isNaN(clampedZoom) && isFinite(clampedZoom)) {
    // Use setTimeout to prevent state updates during render
    setTimeout(() => {
          setState(prev => {
            // Only update if zoom actually changed
            if (prev.currentZoom !== clampedZoom) {
              return {
        ...prev,
                currentZoom: clampedZoom,
              };
            }
            return prev;
          });
    }, 0);
      }
    } catch (error) {
      if (__DEV__) {
        console.error('[OptimizedMapComponent] Error in handleRegionChangeComplete:', error);
      }
      // Silently fail - don't crash the app
      return;
    }
    
    // Notify parent when region change completes
    if (onRegionChangeComplete) {
      onRegionChangeComplete(region);
    }
  }, [onRegionChangeComplete, isFocused, isMapSelectionMode, onMapPress]);

  // Initialize silent vote counts for all reports
  // CRITICAL: Skip vote initialization when screen is not focused
  useEffect(() => {
    if (!isFocused) {
      return; // Silent skip - no updates when not focused
    }

    (filteredReportMarkers || []).forEach(report => {
      const reportVoteCount = report.votes?.reduce((sum, vote) => sum + vote.vote, 0) || 0;
      silentVoteManager.initializeVoteCount(report._id, reportVoteCount);
    });
  }, [filteredReportMarkers, isFocused]);

  // Default region (Valenzuela City) - used as fallback
  // CRITICAL: Define once and reuse to prevent errors
  const defaultRegion = useMemo(() => ({
    latitude: 14.7006,
    longitude: 120.9830,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  }), []);

  // Calculate region with default fallback if region is null (prevents map error)
  // This ensures the map always has a valid region to render
  const adjustedRegion = useMemo(() => {
    // If region is null or invalid, use default
    if (!region || typeof region.latitude !== 'number' || typeof region.longitude !== 'number' || 
        isNaN(region.latitude) || isNaN(region.longitude)) {
      return defaultRegion;
    }
    
    return region;
  }, [region, defaultRegion]);

  // CRITICAL: Stabilize region to prevent MapView from re-rendering unnecessarily
  // Only update region when it changes significantly (not on every zoom/pan)
  // CRITICAL FIX: Always initialize with default to prevent undefined errors
  const stableRegionRef = useRef(adjustedRegion || defaultRegion);
  const [stableRegion, setStableRegion] = useState(adjustedRegion || defaultRegion);
  
  useEffect(() => {
    // CRITICAL: Skip region updates when screen is not focused
    if (!isFocused) {
      return; // Silent skip - no updates when not focused
    }

    // CRITICAL FIX: Ensure adjustedRegion is always valid before using
    const validRegion = adjustedRegion || defaultRegion;
    
    // CRITICAL: When entering map selection mode, initialize center coordinate
    if (isMapSelectionMode && validRegion && !mapCenterCoordinate) {
      setMapCenterCoordinate({
        latitude: validRegion.latitude,
        longitude: validRegion.longitude,
      });
    }
    
    if (validRegion && stableRegionRef.current) {
      const latDiff = Math.abs((stableRegionRef.current.latitude || 0) - (validRegion.latitude || 0));
      const lngDiff = Math.abs((stableRegionRef.current.longitude || 0) - (validRegion.longitude || 0));
      const deltaDiff = Math.abs((stableRegionRef.current.latitudeDelta || 0) - (validRegion.latitudeDelta || 0));
      
      // CRITICAL: In map selection mode, don't auto-animate to region
      // User should be able to pan freely without the map jumping
      // Only update if region changed significantly (location > 0.01 degrees OR zoom changed by > 0.01)
      if (latDiff > 0.01 || lngDiff > 0.01 || deltaDiff > 0.01) {
        stableRegionRef.current = validRegion;
        setStableRegion(validRegion);
        
        // Use animateToRegion for smooth updates (but only if map ref is available and NOT in map selection mode)
        if (mapRef?.current && !isMapSelectionMode) {
          // Use setTimeout to prevent state updates during render
          setTimeout(() => {
            if (mapRef?.current) {
              mapRef.current.animateToRegion(validRegion, 300);
            }
          }, 0);
        }
      }
    } else if (validRegion && !stableRegionRef.current) {
      stableRegionRef.current = validRegion;
      setStableRegion(validRegion);
    } else if (!stableRegionRef.current) {
      // CRITICAL FIX: Fallback to default if everything else fails
      stableRegionRef.current = defaultRegion;
      setStableRegion(defaultRegion);
    }
  }, [adjustedRegion, mapRef, defaultRegion, isFocused, isMapSelectionMode, mapCenterCoordinate]);

  // CRITICAL: Log destination marker visibility for debugging
  // This helps verify that destination marker is always visible when destination is set
  useEffect(() => {
    if (__DEV__) {
      const shouldShow = !!(destination && !isMapSelectionMode);
      console.log('[OptimizedMapComponent] 🎯 Destination marker visibility check:', {
        hasDestination: !!destination,
        destinationCoords: destination ? {
          lat: destination.latitude || destination.lat,
          lng: destination.longitude || destination.lng || destination.lon,
        } : null,
        isMapSelectionMode,
        shouldShow,
        timestamp: new Date().toISOString(),
      });
    }
  }, [destination, isMapSelectionMode]);

  // CRITICAL FIX: Ensure region is always valid before passing to MapView
  // This prevents "Cannot read property 'latitude' of undefined" errors
  // Must be calculated inline to catch edge cases during unmount/remount
  const safeRegion = useMemo(() => {
    // CRITICAL: Check all possible undefined states
    if (!stableRegion || 
        typeof stableRegion !== 'object' ||
        typeof stableRegion.latitude !== 'number' || 
        typeof stableRegion.longitude !== 'number' ||
        isNaN(stableRegion.latitude) || 
        isNaN(stableRegion.longitude) ||
        !stableRegion.latitudeDelta ||
        !stableRegion.longitudeDelta) {
      if (__DEV__) {
        console.warn('[OptimizedMapComponent] ⚠️ Invalid region detected, using default', {
          stableRegion,
          hasStableRegion: !!stableRegion,
          timestamp: new Date().toISOString(),
        });
      }
      return defaultRegion;
    }
    return stableRegion;
  }, [stableRegion, defaultRegion]);

  // CRITICAL FIX: Double-check region right before render to catch any edge cases
  // This ensures we never pass undefined to MapView, even during unmount/remount
  const finalRegion = useMemo(() => {
    // Validate safeRegion completely
    if (!safeRegion || 
        typeof safeRegion !== 'object' ||
        typeof safeRegion.latitude !== 'number' || 
        typeof safeRegion.longitude !== 'number' ||
        typeof safeRegion.latitudeDelta !== 'number' ||
        typeof safeRegion.longitudeDelta !== 'number' ||
        isNaN(safeRegion.latitude) || 
        isNaN(safeRegion.longitude) ||
        isNaN(safeRegion.latitudeDelta) ||
        isNaN(safeRegion.longitudeDelta)) {
      if (__DEV__) {
        console.warn('[OptimizedMapComponent] ⚠️ safeRegion invalid, using default', {
          safeRegion,
          timestamp: new Date().toISOString(),
        });
      }
      return defaultRegion;
    }
    return safeRegion;
  }, [safeRegion, defaultRegion]);

  // CRITICAL FIX: Final validation right before render - ensure all properties exist
  // This is the last line of defense against undefined region errors
  const validatedRegion = useMemo(() => {
    if (!finalRegion || 
        typeof finalRegion !== 'object' ||
        typeof finalRegion.latitude !== 'number' || 
        typeof finalRegion.longitude !== 'number' ||
        typeof finalRegion.latitudeDelta !== 'number' ||
        typeof finalRegion.longitudeDelta !== 'number' ||
        isNaN(finalRegion.latitude) || 
        isNaN(finalRegion.longitude) ||
        isNaN(finalRegion.latitudeDelta) ||
        isNaN(finalRegion.longitudeDelta) ||
        finalRegion.latitude < -90 ||
        finalRegion.latitude > 90 ||
        finalRegion.longitude < -180 ||
        finalRegion.longitude > 180) {
      if (__DEV__) {
        console.error('[OptimizedMapComponent] ❌ CRITICAL: finalRegion invalid, using default', {
          finalRegion,
          defaultRegion,
          timestamp: new Date().toISOString(),
        });
      }
      return defaultRegion;
    }
    return finalRegion;
  }, [finalRegion, defaultRegion]);

  // CRITICAL FIX: Don't render MapView if region is still invalid after all checks
  // This prevents errors during unmount/remount cycles
  if (!validatedRegion || 
      typeof validatedRegion.latitude !== 'number' || 
      typeof validatedRegion.longitude !== 'number' ||
      typeof validatedRegion.latitudeDelta !== 'number' ||
      typeof validatedRegion.longitudeDelta !== 'number') {
    if (__DEV__) {
      console.error('[OptimizedMapComponent] ❌ CRITICAL: Cannot render MapView - invalid region after all checks', {
        validatedRegion,
        finalRegion,
        safeRegion,
        defaultRegion,
        timestamp: new Date().toISOString(),
      });
    }
    // Return empty view instead of crashing
    return (
      <View style={styles.container}>
        <View style={styles.map} />
      </View>
    );
  }

  // CRITICAL FIX: Final safety check - ensure region is valid before rendering
  // This is the absolute last check before passing to MapView
  const safeRegionForRender = useMemo(() => {
    if (!validatedRegion || 
        typeof validatedRegion !== 'object' ||
        typeof validatedRegion.latitude !== 'number' || 
        typeof validatedRegion.longitude !== 'number' ||
        typeof validatedRegion.latitudeDelta !== 'number' ||
        typeof validatedRegion.longitudeDelta !== 'number' ||
        isNaN(validatedRegion.latitude) ||
        isNaN(validatedRegion.longitude) ||
        isNaN(validatedRegion.latitudeDelta) ||
        isNaN(validatedRegion.longitudeDelta) ||
        validatedRegion.latitude < -90 ||
        validatedRegion.latitude > 90 ||
        validatedRegion.longitude < -180 ||
        validatedRegion.longitude > 180) {
      if (__DEV__) {
        console.error('[OptimizedMapComponent] ❌ CRITICAL: validatedRegion invalid, using default', {
          validatedRegion,
          defaultRegion,
          timestamp: new Date().toISOString(),
        });
      }
      return defaultRegion;
    }
    return validatedRegion;
  }, [validatedRegion, defaultRegion]);

  // CRITICAL FIX: Ensure safeRegionForRender is always valid
  // This prevents any possibility of undefined region reaching MapView
  if (!safeRegionForRender || 
      typeof safeRegionForRender.latitude !== 'number' || 
      typeof safeRegionForRender.longitude !== 'number' ||
      typeof safeRegionForRender.latitudeDelta !== 'number' ||
      typeof safeRegionForRender.longitudeDelta !== 'number') {
    if (__DEV__) {
      console.error('[OptimizedMapComponent] ❌ CRITICAL: safeRegionForRender invalid after all checks', {
        safeRegionForRender,
        validatedRegion,
        defaultRegion,
        timestamp: new Date().toISOString(),
      });
    }
    return (
      <View style={styles.container}>
        <View style={styles.map} />
      </View>
    );
  }

  // CRITICAL FIX: Create a safe render function with error handling
  // This ensures MapView never receives undefined region
  const renderMapView = () => {
    return (
      <MapView
        ref={mapRef}
        style={styles.map}
        region={safeRegionForRender}
        provider={PROVIDER_GOOGLE}
        showsTraffic={true}
        showsMyLocationButton={false}
        showsCompass={true}
        onPress={(event) => {
          // CRITICAL: In map selection mode, don't handle tap presses
          // The center marker follows the map center automatically via onRegionChange
          // User should pan the map to move the marker, not tap
          if (!isMapSelectionMode && onMapPress) {
            // Normal map press handling (only when not in selection mode)
            onMapPress(event);
          }
        }}
        onRegionChange={handleRegionChange}
        onRegionChangeComplete={handleRegionChangeComplete}
        zoomEnabled={true}
        zoomTapEnabled={true}
        scrollEnabled={true}
        pitchEnabled={true} // Enable tilt functionality
        rotateEnabled={true} // Enable map rotation
        mapType="standard"
        toolbarEnabled={false}
        customMapStyle={flatBuildingsMapStyle} // Apply custom style to disable 3D buildings
        {...cameraProps} // Apply camera props for pitch
      >
        {/* User location marker - ALWAYS show when location is available (even when idle/AFK) */}
        {/* CRITICAL: App always watches user location, so marker should always be visible */}
        {currentLocation && 
         typeof currentLocation.latitude === 'number' && 
         typeof currentLocation.longitude === 'number' &&
         !isNaN(currentLocation.latitude) &&
         !isNaN(currentLocation.longitude) &&
         currentLocation.latitude >= -90 &&
         currentLocation.latitude <= 90 &&
         currentLocation.longitude >= -180 &&
         currentLocation.longitude <= 180 && (
          <UserLocationMarker
            currentLocation={currentLocation}
            snappedRouteCoordinates={snappedRouteCoordinates || []}
          />
        )}


        {/* Destination marker - Show when destination is set AND not actively in map selection mode */}
        {/* CRITICAL: Always show destination marker when destination exists, regardless of selection method */}
        {/* Only hide during active map selection (when user is choosing from map) */}
        {destination && !isMapSelectionMode && <DestinationMarker destination={destination} />}

        {/* Center destination marker - Only show when in map selection mode */}
        {/* This marker is always at the center of the map view */}

        {/* Selected map location marker - Only show when NOT in map selection mode */}
        {!isMapSelectionMode && <SelectedLocationMarker selectedMapLocation={selectedMapLocation} />}

        {/* Clustered markers (when zoomed out) */}
        {state.currentZoom <= 10 && clusters.length > 0 && (
          <>
            {clusters
              .filter((cluster) => {
                // CRITICAL: Filter out invalid clusters to prevent crashes
                return cluster && 
                       cluster.coordinate && 
                       typeof cluster.coordinate.latitude === 'number' && 
                       typeof cluster.coordinate.longitude === 'number' &&
                       !isNaN(cluster.coordinate.latitude) && 
                       !isNaN(cluster.coordinate.longitude) &&
                       cluster.coordinate.latitude >= -90 &&
                       cluster.coordinate.latitude <= 90 &&
                       cluster.coordinate.longitude >= -180 &&
                       cluster.coordinate.longitude <= 180;
              })
              .map((cluster) => (
              <ClusterMarkerComponent
                key={cluster.id}
                cluster={cluster}
                onPress={handleClusterPress}
              />
            ))}
          </>
        )}

        {/* Individual markers - Show when zoomed in OR when no clusters available */}
        {/* CRITICAL: Only render when icons are ready to prevent default markers */}
        {iconsReady && (
          <>
            {/* Show individual markers when zoomed in (zoom > 10) */}
            {state.currentZoom > 10 && (
              <>
                {individualMarkers.reports.length > 0 && individualMarkers.reports.map(({ report, icon }) => (
                  <ReportMarker
                    key={`report-${report._id}`}
                    report={report}
                    onPress={handleReportPress}
                    icon={icon}
                  />
                ))}
                
                {individualMarkers.gasStations.length > 0 && individualMarkers.gasStations.map(({ station, icon }) => (
                  <GasStationMarker
                    key={`gas-${station._id}`}
                    station={station}
                    onPress={handleGasStationPress}
                    icon={icon}
                  />
                ))}
              </>
            )}

            {/* FALLBACK: Show individual markers at low zoom if no clusters available */}
            {/* CRITICAL FIX: Always show markers if no clusters, regardless of zoom level */}
            {state.currentZoom <= 10 && clusters.length === 0 && (
              <>
                {/* Show reports if available */}
                {individualMarkers.reports.length > 0 && individualMarkers.reports.map(({ report, icon }) => (
                  <ReportMarker
                    key={`report-${report._id}`}
                    report={report}
                    onPress={handleReportPress}
                    icon={icon}
                  />
                ))}
                
                {/* Show gas stations if available */}
                {individualMarkers.gasStations.length > 0 && individualMarkers.gasStations.map(({ station, icon }) => (
                  <GasStationMarker
                    key={`gas-${station._id}`}
                    station={station}
                    onPress={handleGasStationPress}
                    icon={icon}
                  />
                ))}
              </>
            )}
          </>
        )}

        {/* Route polylines - Pressable to select routes */}
        {routePolylines.map((polyline, index) => {
          // CRITICAL: Use uniqueKey from polyline data to prevent React duplicate key warnings
          // This key is guaranteed unique as it combines routeId, index, and coordinate hash
          const uniqueKey = polyline.uniqueKey || `polyline-${polyline.routeId || 'unknown'}-${index}`;
          
          return (
            <RoutePolyline
              key={uniqueKey}
              coordinates={polyline.coordinates}
              isTracking={isTracking}
              color={polyline.color}
              strokeWidth={polyline.strokeWidth}
              lineDashPattern={polyline.lineDashPattern}
              routeId={polyline.routeId}
              isSelected={selectedRouteId === polyline.routeId}
              onPress={onSelectRoute}
            />
          );
        })}
      </MapView>
    );
  };

  // CRITICAL FIX: Render with multiple validation layers ensuring region is always valid
  // All validation checks above ensure safeRegionForRender is always valid
  return (
    <View style={styles.container}>
      {renderMapView()}

      {/* Center destination marker overlay - Always at screen center when in map selection mode */}
      {/* This is an overlay, not a map marker, so it stays fixed at screen center */}
      {isMapSelectionMode && (
        <View style={styles.centerMarkerOverlay} pointerEvents="none">
          <View style={styles.centerMarkerContainer}>
            <View style={styles.centerMarkerPin}>
              <Image 
                source={require('../../assets/icons/DESTINATION MARKER.png')} 
                style={[styles.destinationMarker, { width: 50, height: 50 }]} 
                resizeMode="contain"
              />
            </View>
            <View style={styles.centerMarkerDot} />
          </View>
        </View>
      )}

      {/* Selected report card */}
      {state.selectedReport && (
        <ReportCard 
          report={state.selectedReport} 
          onClose={closeSelection}
          onVote={handleVote}
          userId={userId}
        />
      )}

      {/* Selected gas station card */}
      {/* CRITICAL: getIcon prop must be getGasStationIconForMarker (uppercase 'F') */}
      {state.selectedGasStation && (
        <GasStationCard 
          station={state.selectedGasStation} 
          onClose={closeSelection}
          getIcon={getGasStationIconForMarker}
          onSetAsDestination={(station) => {
            // Convert gas station to location and set as destination
            if (station?.location?.coordinates) {
              const coords = station.location.coordinates;
              const location: LocationCoords = {
                latitude: Number(coords[1]),
                longitude: Number(coords[0]),
                address: typeof station.address === 'string' 
                  ? station.address 
                  : station.address 
                    ? `${station.address.street || ""}, ${station.address.city || ""}, ${station.address.province || ""}`.trim()
                    : 'Gas Station',
              };
              // Trigger destination selection via map press handler
              if (onMapPress) {
                onMapPress({ nativeEvent: { coordinate: location } });
              }
            }
          }}
          onAddStop={(station) => {
            // Add gas station as a stop in the current route
            // This will be handled by the parent component
            if (onMapPress) {
              const coords = station.location?.coordinates;
              if (coords) {
                const location: LocationCoords = {
                  latitude: Number(coords[1]),
                  longitude: Number(coords[0]),
                  address: typeof station.address === 'string' 
                    ? station.address 
                    : station.address 
                      ? `${station.address.street || ""}, ${station.address.city || ""}, ${station.address.province || ""}`.trim()
                      : 'Gas Station',
                };
                // Trigger add stop via map press handler
                onMapPress({ nativeEvent: { coordinate: location, action: 'addStop' } });
              }
            }
          }}
          onViewUpdatePrices={(station) => {
            // Open gas price update modal
            // This will be handled by the parent component
            if (onMapPress) {
              onMapPress({ nativeEvent: { action: 'viewUpdatePrices', station } });
            }
          }}
          isNavigating={isTracking || false}
        />
      )}

      {/* Selected cluster card */}
      {state.selectedCluster && (
        <ClusterCard 
          cluster={state.selectedCluster} 
          onClose={closeSelection}
          onMarkerPress={handleReportPress}
        />
      )}
    </View>
  );
}, arePropsEqual);

// Report card component (memoized)
const ReportCard = React.memo<{
  report: TrafficReport;
  onClose: () => void;
  onVote: (reportId: string, userId: string, vote: number) => void;
  userId?: string;
}>(({ report, onClose, onVote, userId }) => {
  // Safety check for report data
  if (!report || !report._id) {
    console.warn('[ReportCard] Invalid report data:', report);
    return null;
  }

  // Get initial vote count from report data - no re-renders
  const reportVoteCount = report.votes?.reduce((sum, vote) => sum + vote.vote, 0) || 0;
  const [optimisticVoteCount, setOptimisticVoteCount] = React.useState(reportVoteCount);

  // Update optimistic count when report data changes
  React.useEffect(() => {
    setOptimisticVoteCount(reportVoteCount);
  }, [reportVoteCount]);

  const handleVote = async (vote: number) => {
    if (!userId) {
      console.warn('[ReportCard] No userId provided, cannot vote');
      return;
    }
    
    try {
      // Update optimistic count immediately for instant feedback
      setOptimisticVoteCount(prev => prev + vote);
      
      // Call the silent vote handler
      await onVote(report._id, userId, vote);
    } catch (error) {
      // Revert optimistic update on error
      setOptimisticVoteCount(prev => prev - vote);
      console.error('[ReportCard] Vote failed, reverted optimistic update:', error);
    }
  };

  return (
    <View style={styles.infoBox}>
      <View style={styles.reportHeader}>
        <View style={styles.reportTitleContainer}>
          {report.verified?.verifiedByAdmin > 0 && (
            <MaterialIcons name="verified" size={20} color="#4CAF50" style={styles.verifiedIcon} />
          )}
          <Text style={styles.reportTitle}>
            {typeof report.reportType === 'string' ? report.reportType : String(report.reportType || 'Unknown')}
          </Text>
        </View>
        {report.verified?.verifiedByAdmin > 0 && (
          <View style={styles.verifiedBadge}>
            <MaterialIcons name="verified" size={16} color="#4CAF50" />
            <Text style={styles.verifiedText}>Verified</Text>
          </View>
        )}
      </View>

      <Text style={styles.reportDescription}>
        {typeof report.description === 'string' ? report.description : String(report.description || '')}
      </Text>
      {report.address && (
        <Text style={styles.reportAddress}>
          {typeof report.address === 'string' ? report.address : String(report.address || '')}
        </Text>
      )}
      <Text style={styles.reportTimestamp}>
        {new Date(report.timestamp).toLocaleString()}
      </Text>

      <View style={styles.voteContainer}>
        <Text style={styles.voteLabel}>Votes: {optimisticVoteCount}</Text>
        <View style={styles.voteButtons}>
          <TouchableOpacity
            style={[styles.voteButton, styles.upvoteButton]}
            onPress={() => handleVote(1)}
          >
            <MaterialIcons name="thumb-up" size={20} color="#4CAF50" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.voteButton, styles.downvoteButton]}
            onPress={() => handleVote(-1)}
          >
            <MaterialIcons name="thumb-down" size={20} color="#F44336" />
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity style={styles.closeButton} onPress={onClose}>
        <MaterialIcons name="close" size={24} color="#666" />
      </TouchableOpacity>
    </View>
  );
});

// Gas station card component (memoized)
const GasStationCard = React.memo<{
  station: GasStation;
  onClose: () => void;
  getIcon: (type: string) => any;
  onSetAsDestination?: (station: GasStation) => void;
  onAddStop?: (station: GasStation) => void;
  onViewUpdatePrices?: (station: GasStation) => void;
  isNavigating?: boolean;
}>(({ station, onClose, getIcon, onSetAsDestination, onAddStop, onViewUpdatePrices, isNavigating = false }) => {
  // Safety check for station data
  if (!station || !station._id) {
    console.warn('[GasStationCard] Invalid station data:', station);
    return null;
  }

  // State for geocoded address (when API address is missing)
  const [geocodedAddress, setGeocodedAddress] = React.useState<string | null>(null);
  const [isGeocoding, setIsGeocoding] = React.useState(false);

  // Helper to format address from station data
  const formatStationAddress = (): string => {
    if (typeof station.address === 'string' && station.address.trim()) {
      return station.address;
    }
    if (station.address && typeof station.address === 'object') {
      const parts = [
        station.address.street,
        station.address.city,
        station.address.province
      ].filter(Boolean);
      if (parts.length > 0) {
        return parts.join(', ');
      }
    }
    return '';
  };

  // Reverse geocode address if missing
  React.useEffect(() => {
    // Reset geocoding state when station changes
    setGeocodedAddress(null);
    setIsGeocoding(false);
    
    const formattedAddress = formatStationAddress();
    
    // Only geocode if address is missing and we have coordinates
    if (!formattedAddress && station?.location?.coordinates) {
      setIsGeocoding(true);
      const coords = station.location.coordinates;
      const latitude = Number(coords[1]);
      const longitude = Number(coords[0]);
      
      if (!isNaN(latitude) && !isNaN(longitude)) {
        // Use the reverse geocoding function (already imported at top of file)
        reverseGeocodeLocation(latitude, longitude)
          .then((address) => {
            setGeocodedAddress(address);
            setIsGeocoding(false);
          })
          .catch((error) => {
            console.warn('[GasStationCard] Reverse geocoding failed:', error);
            setGeocodedAddress(null);
            setIsGeocoding(false);
          });
      } else {
        setIsGeocoding(false);
      }
    }
    // Only depend on station ID and coordinates - reset and geocode when station changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [station?._id, station?.location?.coordinates]);

  // Get station coordinates for destination
  const getStationLocation = (): LocationCoords | null => {
    if (!station?.location?.coordinates) return null;
    const coords = station.location.coordinates;
    const formattedAddress = formatStationAddress() || geocodedAddress || 'Gas Station';
    return {
      latitude: Number(coords[1]),
      longitude: Number(coords[0]),
      address: formattedAddress,
    };
  };

  const handleSetAsDestination = () => {
    if (onSetAsDestination) {
      onSetAsDestination(station);
    }
    onClose();
  };

  const handleAddStop = () => {
    if (onAddStop) {
      onAddStop(station);
    }
    onClose();
  };

  const handleViewUpdatePrices = () => {
    if (onViewUpdatePrices) {
      onViewUpdatePrices(station);
    }
    // Don't close modal - user might want to update prices
  };

  // Determine display address
  const displayAddress = formatStationAddress() || geocodedAddress || (isGeocoding ? 'Loading address...' : 'Address not available');

  return (
    <View style={styles.infoBox}>
      <View style={styles.stationHeader}>
        <View style={styles.stationTitleRow}>
          <View style={styles.stationInfo}>
            <Text style={styles.stationTitle}>{station.brand || "NO NAME"}</Text>
            <Text style={styles.stationAddress}>
              {displayAddress}
            </Text>
          </View>
          <View style={styles.stationIconContainer}>
            {/* CRITICAL: getIcon prop is getGasStationIconForMarker function passed from parent */}
            <Image 
              source={getIcon ? getIcon(station.brand || 'other') : require('../../assets/icons/Gas_Station-MARKER.png')} 
              style={styles.stationIcon} 
            />
          </View>
        </View>
      </View>

      {/* Fuel Prices Section */}
      <View style={styles.fuelPricesContainer}>
        <View style={styles.fuelPriceCard}>
          <Text style={styles.fuelPriceLabel}>UNLEADED</Text>
          <Text style={styles.fuelPriceValue}>
            ₱{(station as any).fuelPrices?.gasoline || "N/A"}
          </Text>
        </View>
        
        <View style={[styles.fuelPriceCard, styles.premiumCard]}>
          <Text style={styles.fuelPriceLabel}>PREMIUM</Text>
          <Text style={styles.fuelPriceValue}>
            ₱{(station as any).fuelPrices?.premium || "N/A"}
          </Text>
        </View>
      </View>

      {/* Services Section (if available) */}
      {(station as any).services && (station as any).services.length > 0 && (
        <View style={styles.servicesContainer}>
          <Text style={styles.servicesTitle}>Services:</Text>
          {(station as any).services.map((service: any, index: number) => {
            // Ensure service is converted to string to prevent rendering errors
            const serviceText = typeof service === 'string' ? service : String(service || '');
            return (
              <Text key={index} style={styles.serviceItem}>• {serviceText}</Text>
            );
          })}
        </View>
      )}

      {/* Action Buttons */}
      <View style={styles.gasStationButtons}>
        {onViewUpdatePrices && (
          <TouchableOpacity 
            style={[styles.gasStationActionButton, styles.viewPricesButton]} 
            onPress={handleViewUpdatePrices}
          >
            <MaterialIcons name="edit" size={18} color="#FFF" />
            <Text style={styles.gasStationActionButtonText}>View & Update Prices</Text>
          </TouchableOpacity>
        )}
        
        {onSetAsDestination && (
          <TouchableOpacity 
            style={[styles.gasStationActionButton, styles.setDestinationButton]} 
            onPress={handleSetAsDestination}
          >
            <MaterialIcons name="place" size={18} color="#FFF" />
            <Text style={styles.gasStationActionButtonText}>Set as Destination</Text>
          </TouchableOpacity>
        )}
        
        {onAddStop && isNavigating && (
          <TouchableOpacity 
            style={[styles.gasStationActionButton, styles.addStopButton]} 
            onPress={handleAddStop}
          >
            <MaterialIcons name="add-location" size={18} color="#FFF" />
            <Text style={styles.gasStationActionButtonText}>Add Stop</Text>
          </TouchableOpacity>
        )}
        
        <TouchableOpacity style={styles.closeGasButton} onPress={onClose}>
          <Text style={styles.closeGasButtonText}>CLOSE</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
});

// Cluster card component (memoized)
const ClusterCard = React.memo<{
  cluster: ClusterMarker;
  onClose: () => void;
  onMarkerPress: (report: TrafficReport) => void;
}>(({ cluster, onClose, onMarkerPress }) => {
  const reports = cluster.markers.filter(marker => marker.reportType);
  const gasStations = cluster.markers.filter(marker => marker.brand);

  return (
    <View style={styles.infoBox}>
      <View style={styles.clusterHeader}>
        <Text style={styles.clusterTitle}>
          {cluster.count} markers in this area
        </Text>
        <Text style={styles.clusterSubtitle}>
          {reports.length} reports, {gasStations.length} gas stations
        </Text>
      </View>

      <View style={styles.clusterContent}>
        {reports.slice(0, 3).map((report, index) => (
          <TouchableOpacity
            key={index}
            style={styles.clusterItem}
            onPress={() => onMarkerPress(report)}
          >
            <Text style={styles.clusterItemText}>{report.reportType}</Text>
          </TouchableOpacity>
        ))}
        
        {reports.length > 3 && (
          <Text style={styles.clusterMoreText}>
            +{reports.length - 3} more reports
          </Text>
        )}
      </View>

      <TouchableOpacity style={styles.closeButton} onPress={onClose}>
        <MaterialIcons name="close" size={24} color="#666" />
      </TouchableOpacity>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  cameraIndicator: {
    backgroundColor: 'rgba(255, 87, 34, 0.9)',
    borderRadius: 15,
    padding: 5,
    borderWidth: 2,
    borderColor: '#FFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  userMarker3D: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 20,
    padding: 5,
    borderWidth: 2,
    borderColor: '#FFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  userMarker: {
    width: 30,
    height: 30,
    resizeMode: 'contain',
  },
  destinationMarker: {
    width: 30,
    height: 30,
    resizeMode: 'contain',
  },
  iconMarker: {
    width: 35,
    height: 35,
    resizeMode: 'contain',
  },
  clusterContainer: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  clusterIcon: {
    resizeMode: 'contain',
  },
  clusterBadge: {
    position: 'absolute',
    backgroundColor: '#FF5722',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  clusterText: {
    color: '#FFF',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  infoBox: {
    position: 'absolute',
    bottom: 140,
    left: 30,
    right: 70,
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  reportHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  reportTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  verifiedIcon: {
    marginRight: 8,
  },
  reportTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E8',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  verifiedText: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '600',
    marginLeft: 4,
  },
  reportDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  reportAddress: {
    fontSize: 12,
    color: '#888',
    marginBottom: 4,
  },
  reportTimestamp: {
    fontSize: 12,
    color: '#999',
    marginBottom: 12,
  },
  voteContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  voteLabel: {
    fontSize: 14,
    color: '#666',
  },
  voteButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  voteButton: {
    padding: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  upvoteButton: {
    borderColor: '#4CAF50',
  },
  downvoteButton: {
    borderColor: '#F44336',
  },
  stationHeader: {
    marginBottom: 12,
  },
  stationTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  stationInfo: {
    maxWidth: '70%',
    flex: 1,
  },
  stationTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  stationAddress: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  stationIconContainer: {
    marginLeft: 12,
  },
  stationIcon: {
    height: 50,
    width: 50,
    resizeMode: 'contain',
  },
  fuelPricesContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 12,
  },
  fuelPriceCard: {
    flex: 1,
    marginRight: 6,
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#4CAF50',
  },
  premiumCard: {
    marginLeft: 6,
    marginRight: 0,
    backgroundColor: '#FFD700',
  },
  fuelPriceLabel: {
    fontWeight: 'bold',
    color: '#333',
    fontSize: 12,
    marginBottom: 4,
  },
  fuelPriceValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  gasStationButtons: {
    flexDirection: 'column',
    gap: 8,
    marginTop: 10,
  },
  gasStationActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 8,
  },
  viewPricesButton: {
    backgroundColor: '#2196F3',
  },
  setDestinationButton: {
    backgroundColor: '#4CAF50',
  },
  addStopButton: {
    backgroundColor: '#FF9800',
  },
  gasStationActionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  closeGasButton: {
    backgroundColor: '#F44336',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  closeGasButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  servicesContainer: {
    marginBottom: 12,
  },
  servicesTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  serviceItem: {
    fontSize: 12,
    color: '#666',
    marginLeft: 8,
  },
  clusterHeader: {
    marginBottom: 12,
  },
  clusterTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  clusterSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  clusterContent: {
    marginBottom: 12,
  },
  clusterItem: {
    padding: 8,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    marginBottom: 4,
  },
  clusterItemText: {
    fontSize: 14,
    color: '#333',
  },
  clusterMoreText: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
    marginTop: 4,
  },
  closeButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    padding: 4,
  },
  centerMarkerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    pointerEvents: 'none', // Allow touches to pass through to map
    zIndex: 1000,
  },
  centerMarkerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 50,
    height: 50,
  },
  centerMarkerPin: {
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerMarkerDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#00ADB5',
    borderWidth: 2,
    borderColor: '#fff',
    position: 'absolute',
    top: 19, // Position at center of pin (50px height / 2 - 6px radius = 19px)
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
});

OptimizedMapComponent.displayName = 'OptimizedMapComponent';
