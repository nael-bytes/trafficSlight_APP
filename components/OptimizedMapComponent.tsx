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
import { getClusterIcon, preloadMarkerIcons, ClusterMarker } from '../../utils/markerClustering';
import { silentVoteManager, useSilentVote, useVoteCountListener } from '../../utils/silentVoteManager';
import { MapFilters } from '../../components/MapFilterModal';
import type { MapComponentProps, TrafficReport, GasStation, LocationCoords } from '../../types';

// Preload icons on module load
let iconsPreloaded = false;
if (!iconsPreloaded) {
  preloadMarkerIcons().then(() => {
    iconsPreloaded = true;
  });
}

// Memoized marker components to prevent unnecessary re-renders
const ReportMarker = React.memo<{
  report: TrafficReport;
  onPress: (report: TrafficReport) => void;
  icon: any;
}>(({ report, onPress, icon }) => {
  if (!report?.location || !validateCoordinates(report.location)) return null;
  
  return (
    <Marker
      key={`report-${report._id}`}
      coordinate={report.location}
      onPress={() => onPress(report)}
    >
      <Image source={icon} style={styles.iconMarker} />
    </Marker>
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

  return (
    <Marker
      key={`gas-${station._id}`}
      coordinate={coordinate}
      onPress={() => onPress(station)}
    >
      <Image source={icon} style={styles.iconMarker} />
    </Marker>
  );
});

const ClusterMarkerComponent = React.memo<{
  cluster: ClusterMarker;
  onPress: (cluster: ClusterMarker) => void;
}>(({ cluster, onPress }) => {
  // Calculate size based on cluster count for better visual hierarchy
  const size = Math.min(cluster.count * 3 + 30, 60); // Scale from 30px to 60px max
  
  return (
    <Marker
      key={cluster.id}
      coordinate={cluster.coordinate}
      onPress={() => onPress(cluster)}
      anchor={{ x: 0.5, y: 1 }} // Anchor at bottom center for pin shape
    >
      <View style={[styles.clusterContainer, { width: size, height: size }]}>
        <Image 
          source={getClusterIcon(cluster)} 
          style={[styles.clusterIcon, { width: size, height: size }]} 
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
});

const UserLocationMarker = React.memo<{
  currentLocation: LocationCoords;
  snappedRouteCoordinates: LocationCoords[];
}>(({ currentLocation, snappedRouteCoordinates }) => {
  if (!currentLocation || !validateCoordinates(currentLocation)) return null;
  
  const coordinate = snappedRouteCoordinates && snappedRouteCoordinates.length > 0 
    ? snappedRouteCoordinates[snappedRouteCoordinates.length - 1] 
    : currentLocation;

  return (
    <Marker 
      coordinate={coordinate} 
      title="Your Location"
    >
      <Image 
        source={require('../../assets/icons/User-onTrack-MARKER.png')} 
        style={styles.userMarker} 
      />
    </Marker>
  );
});

const DestinationMarker = React.memo<{
  destination: any;
}>(({ destination }) => {
  if (!destination || !validateCoordinates(destination)) return null;
  
  return (
    <Marker 
      coordinate={destination} 
      title="Destination"
      description={destination.address || "Your destination"}
    >
      <Image 
        source={require('../assets/icons/DESTINATION MARKER.png')} 
        style={styles.destinationMarker} 
      />
    </Marker>
  );
});

const SelectedLocationMarker = React.memo<{
  selectedMapLocation: LocationCoords;
}>(({ selectedMapLocation }) => {
  if (!selectedMapLocation || !validateCoordinates(selectedMapLocation)) return null;
  
  return (
    <Marker 
      coordinate={selectedMapLocation} 
      title="Selected Location"
      description={selectedMapLocation.address || "Tap to confirm this location"}
    >
      <Image 
        source={require('../assets/icons/DESTINATION MARKER.png')} 
        style={styles.destinationMarker} 
      />
    </Marker>
  );
});

const RoutePolyline = React.memo<{
  coordinates: LocationCoords[];
  isTracking: boolean;
  color: string;
  strokeWidth: number;
  lineDashPattern?: number[];
}>(({ coordinates, isTracking, color, strokeWidth, lineDashPattern }) => {
  if (!coordinates || coordinates.length <= 1) return null;
  
  return (
    <Polyline
      coordinates={coordinates}
      strokeColor={color}
      strokeWidth={strokeWidth}
      lineCap="round"
      lineJoin="round"
      lineDashPattern={lineDashPattern}
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
const arePropsEqual = (prevProps: MapComponentProps, nextProps: MapComponentProps): boolean => {
  // Compare currentLocation by coordinates, not by reference
  const currentLocEqual = 
    (!prevProps.currentLocation && !nextProps.currentLocation) ||
    (prevProps.currentLocation?.latitude === nextProps.currentLocation?.latitude &&
     prevProps.currentLocation?.longitude === nextProps.currentLocation?.longitude);
  
  // Compare other props that might change frequently
  if (!currentLocEqual) return false;
  if (prevProps.isTracking !== nextProps.isTracking) return false;
  if (prevProps.region?.latitude !== nextProps.region?.latitude || 
      prevProps.region?.longitude !== nextProps.region?.longitude) return false;
  
  // Compare arrays by length and reference (shallow comparison)
  if (prevProps.reportMarkers?.length !== nextProps.reportMarkers?.length) return false;
  if (prevProps.gasStations?.length !== nextProps.gasStations?.length) return false;
  if (prevProps.routeCoordinates?.length !== nextProps.routeCoordinates?.length) return false;
  if (prevProps.showReports !== nextProps.showReports) return false;
  if (prevProps.showGasStations !== nextProps.showGasStations) return false;
  
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
  isTracking,
  onReportVoted,
  onMapPress,
  selectedMapLocation,
  mapFilters,
  onRegionChange,
  onRegionChangeComplete,
  // 3D Navigation props
  is3DNavigation = false,
  mapPitch = 0,
  mapBearing = 0,
  elevationAngle = 0,
  cameraTilt = 0,
  cameraHeading = 0,
  cameraFollow = false,
}) => {
  const [state, setState] = useState<MapComponentState>({
    selectedReport: null,
    selectedGasStation: null,
    selectedCluster: null,
    currentZoom: 100,
  });

  // Apply map filters to markers
  const filteredReportMarkers = useMemo(() => {
    if (!mapFilters || !reportMarkers) return reportMarkers;
    
    return reportMarkers.filter((report: any) => {
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
  }, [reportMarkers, mapFilters]);

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
    
    // Filter by gas station brand
    return validGasStations.filter((station: any) => {
      switch (station.brand?.toLowerCase()) {
        case 'petron':
          return mapFilters.showPetron;
        case 'shell':
          return mapFilters.showShell;
        case 'caltex':
          return mapFilters.showCaltex;
        case 'unioil':
          return mapFilters.showUnioil;
        case 'cleanfuel':
          return mapFilters.showCleanfuel;
        case 'flying v':
          return mapFilters.showFlyingV;
        case 'jetti':
          return mapFilters.showJetti;
        case 'petro gazz':
          return mapFilters.showPetroGazz;
        case 'phoenix':
          return mapFilters.showPhoenix;
        case 'rephil':
          return mapFilters.showRephil;
        case 'seaoil':
          return mapFilters.showSeaoil;
        case 'total':
          return mapFilters.showTotal;
        default:
          return mapFilters.showOtherGasStations;
      }
    });
  }, [validGasStations, mapFilters]);

  // Ref to prevent rapid state changes
  const isSelectingRef = useRef(false);

  // Memoized icon mapping to prevent recreation on every render
  const iconMap = useMemo(() => {
    const map: Record<string, any> = {
      // Traffic incidents
      'Accident': require('../../assets/icons/ROAD INCIDENTS ICON/Road_Accident.png'),
      'Traffic Jam': require('../../assets/icons/ROAD INCIDENTS ICON/Traffic_Jam.png'),
      'Hazard': require('../../assets/icons/ROAD INCIDENTS ICON/Hazard.png'),
      'Road Closure': require('../../assets/icons/ROAD INCIDENTS ICON/Road_Closure.png'),
      
      // Gas stations
      'Caltex': require('../../assets/icons/GAS_STATIONS/CALTEX.png'),
      'Cleanfuel': require('../../assets/icons/GAS_STATIONS/CLEANFUEL.png'),
      'Flying V': require('../../assets/icons/GAS_STATIONS/FLYINGV.png'),
      'Jetti': require('../../assets/icons/GAS_STATIONS/JETTI.png'),
      'Petro Gazz': require('../../assets/icons/GAS_STATIONS/PETROGAZZ.png'),
      'Petron': require('../../assets/icons/GAS_STATIONS/PETRON.png'),
      'Phoenix': require('../../assets/icons/GAS_STATIONS/PHOENIX.png'),
      'Rephil': require('../../assets/icons/GAS_STATIONS/REPHIL.png'),
      'Seaoil': require('../../assets/icons/GAS_STATIONS/SEAOIL.png'),
      'Shell': require('../../assets/icons/GAS_STATIONS/SHELL.png'),
      'Total': require('../../assets/icons/GAS_STATIONS/TOTAL.png'),
      'Unioil': require('../../assets/icons/GAS_STATIONS/UNIOIL.png'),
    };
    return map;
  }, []);

  const getIcon = useCallback((type: string) => {
    return iconMap[type] || require('../../assets/icons/default.png');
  }, [iconMap]);

  // Memoized clusters using backend service for better performance
  const [clusters, setClusters] = useState<ClusterMarker[]>([]);
  const [clustersLoading, setClustersLoading] = useState(false);

  useEffect(() => {
    const processClusters = async () => {
      if (!showReports && !showGasStations) {
        setClusters([]);
        return;
      }

      setClustersLoading(true);
      try {
        const response = await clusterMarkersService({
          reports: showReports ? reportMarkers : [],
          // Use filteredGasStationMarkers instead of validGasStations to respect map filters
          gasStations: showGasStations ? filteredGasStationMarkers : [],
          currentZoom: state.currentZoom,
          options: {
            radius: 100, // 100 meters
            minZoom: 15,
            maxZoom: 10,
          }
        });

        setClusters(response.clusters);
      } catch (error) {
        if (__DEV__) {
          console.error('[OptimizedMapComponent] Clustering error:', error);
        }
        // Fallback to empty clusters
        setClusters([]);
      } finally {
        setClustersLoading(false);
      }
    };

    processClusters();
  }, [reportMarkers, filteredGasStationMarkers, showReports, showGasStations, state.currentZoom]);

  // Memoized individual markers (only when not clustering)
  const individualMarkers = useMemo(() => {
    if (state.currentZoom <= 10) return { reports: [], gasStations: [] }; // Use clusters instead
    
    const reports = showReports ? reportMarkers.map(report => ({
      report,
      icon: getIcon(report.reportType),
    })) : [];
    
    // CRITICAL FIX: Use filteredGasStationMarkers instead of validGasStations to respect map filters
    const gasStations = showGasStations ? filteredGasStationMarkers.map(station => ({
      station,
      icon: getIcon(station.brand),
    })) : [];
    
    return { reports, gasStations };
  }, [reportMarkers, filteredGasStationMarkers, showReports, showGasStations, state.currentZoom, getIcon]);

  // Memoized route polylines to prevent recreation
  const routePolylines = useMemo(() => {
    const polylines = [];
    
    // Snapped route (preferred)
    if (snappedRouteCoordinates && snappedRouteCoordinates.length > 1) {
      polylines.push({
        coordinates: snappedRouteCoordinates,
        color: "#1e3a8a", // Dark blue color
        strokeWidth: 8, // Thick line
        lineDashPattern: undefined, // Solid line
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
      });
    }
    
    // Add alternative routes as thinner polylines
    if (alternativeRoutes && alternativeRoutes.length > 0) {
      alternativeRoutes.forEach((route, index) => {
        if (route.coordinates && route.coordinates.length > 1) {
          polylines.push({
            coordinates: route.coordinates,
            color: "#3b82f6", // Lighter blue for alternatives
            strokeWidth: 4, // Thinner than main route
            lineDashPattern: undefined, // Solid line
          });
        }
      });
    }
    
    return polylines;
  }, [snappedRouteCoordinates, routeCoordinates, alternativeRoutes, isTracking]);

  const handleReportPress = useCallback((report: TrafficReport) => {
    try {
      if (isSelectingRef.current) {
        if (__DEV__) {
          console.log('[OptimizedMapComponent] Selection already in progress, ignoring report press');
        }
        return;
      }

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
  }, []);

  const handleGasStationPress = useCallback((station: GasStation) => {
    try {
      if (isSelectingRef.current) {
        if (__DEV__) {
          console.log('[OptimizedMapComponent] Selection already in progress, ignoring gas station press');
        }
        return;
      }

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
  }, []);

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
    // Calculate zoom level from latitudeDelta (for marker clustering)
    const zoom = Math.round(Math.log2(360 / region.latitudeDelta));
    // Use setTimeout to prevent state updates during render
    setTimeout(() => {
      setState(prev => ({
        ...prev,
        currentZoom: zoom,
      }));
    }, 0);
    
    // Notify parent that user manually panned the map (disable auto-follow)
    // This fires when user drags the map, allowing them to pan freely
    // IMPORTANT: This should only fire on manual user interaction, not during animateToRegion
    if (onRegionChange) {
      onRegionChange(region);
    }
  }, [onRegionChange]);

  const handleRegionChangeComplete = useCallback((region: any) => {
    // Calculate zoom level from latitudeDelta
    const zoom = Math.round(Math.log2(360 / region.latitudeDelta));
    // Use setTimeout to prevent state updates during render
    setTimeout(() => {
      setState(prev => ({
        ...prev,
        currentZoom: zoom,
      }));
    }, 0);
    
    // Notify parent when region change completes
    if (onRegionChangeComplete) {
      onRegionChangeComplete(region);
    }
  }, [onRegionChangeComplete]);

  // Initialize silent vote counts for all reports
  useEffect(() => {
    reportMarkers.forEach(report => {
      const reportVoteCount = report.votes?.reduce((sum, vote) => sum + vote.vote, 0) || 0;
      silentVoteManager.initializeVoteCount(report._id, reportVoteCount);
    });
  }, [reportMarkers]);

  // Calculate region with default fallback if region is null (prevents map error)
  // This ensures the map always has a valid region to render
  const adjustedRegion = useMemo(() => {
    // Default region (Valenzuela City) if region is null or invalid
    const defaultRegion = {
      latitude: 14.7006,
      longitude: 120.9830,
      latitudeDelta: 0.05,
      longitudeDelta: 0.05,
    };
    
    // If region is null or invalid, use default
    if (!region || typeof region.latitude !== 'number' || typeof region.longitude !== 'number' || 
        isNaN(region.latitude) || isNaN(region.longitude)) {
      return defaultRegion;
    }
    
    return region;
  }, [region]);

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        region={adjustedRegion}
        provider={PROVIDER_GOOGLE}
        showsTraffic={true}
        showsMyLocationButton={false}
        showsCompass={true}
        onPress={onMapPress}
        onRegionChange={handleRegionChange}
        onRegionChangeComplete={handleRegionChangeComplete}
        zoomEnabled={true}
        zoomTapEnabled={true}
        scrollEnabled={true}
        pitchEnabled={false}
        rotateEnabled={false}
        mapType="standard"
        toolbarEnabled={false}
      >
        {/* User location marker - Use custom image marker */}
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


        {/* Destination marker */}
        <DestinationMarker destination={destination} />

        {/* Selected map location marker */}
        <SelectedLocationMarker selectedMapLocation={selectedMapLocation} />

        {/* Clustered markers */}
        {state.currentZoom <= 10 && clusters.map((cluster) => (
          <ClusterMarkerComponent
            key={cluster.id}
            cluster={cluster}
            onPress={handleClusterPress}
          />
        ))}

        {/* Individual markers (when zoomed in) */}
        {state.currentZoom > 10 && (
          <>
            {individualMarkers.reports.map(({ report, icon }) => (
              <ReportMarker
                key={`report-${report._id}`}
                report={report}
                onPress={handleReportPress}
                icon={icon}
              />
            ))}
            
            {individualMarkers.gasStations.map(({ station, icon }) => (
              <GasStationMarker
                key={`gas-${station._id}`}
                station={station}
                onPress={handleGasStationPress}
                icon={icon}
              />
            ))}
          </>
        )}

        {/* Route polylines */}
        {routePolylines.map((polyline, index) => (
          <RoutePolyline
            key={`polyline-${index}`}
            coordinates={polyline.coordinates}
            isTracking={isTracking}
            color={polyline.color}
            strokeWidth={polyline.strokeWidth}
            lineDashPattern={polyline.lineDashPattern}
          />
        ))}
      </MapView>

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
      {state.selectedGasStation && (
        <GasStationCard 
          station={state.selectedGasStation} 
          onClose={closeSelection}
          getIcon={getIcon}
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
          <Text style={styles.reportTitle}>{report.reportType}</Text>
        </View>
        {report.verified?.verifiedByAdmin > 0 && (
          <View style={styles.verifiedBadge}>
            <MaterialIcons name="verified" size={16} color="#4CAF50" />
            <Text style={styles.verifiedText}>Verified</Text>
          </View>
        )}
      </View>

      <Text style={styles.reportDescription}>{report.description}</Text>
      {report.address && <Text style={styles.reportAddress}>{report.address}</Text>}
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
}>(({ station, onClose, getIcon }) => {
  // Safety check for station data
  if (!station || !station._id) {
    console.warn('[GasStationCard] Invalid station data:', station);
    return null;
  }

  return (
    <View style={styles.infoBox}>
      <View style={styles.stationHeader}>
        <View style={styles.stationTitleRow}>
          <View style={styles.stationInfo}>
            <Text style={styles.stationTitle}>{station.brand || "NO NAME"}</Text>
            <Text style={styles.stationAddress}>
              {typeof station.address === 'string' ? station.address : 
               station.address ? `${station.address.street || "NO ADDRESS"}, ${station.address.city || ""}, ${station.address.province || ""}` : 
               'Address not available'}
            </Text>
          </View>
          <View style={styles.stationIconContainer}>
            <Image source={getIcon(station.brand)} style={styles.stationIcon} />
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
          {(station as any).services.map((service: string, index: number) => (
            <Text key={index} style={styles.serviceItem}>• {service}</Text>
          ))}
        </View>
      )}

      {/* Close Button */}
      <View style={styles.gasStationButtons}>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  closeGasButton: {
    flex: 1,
    marginLeft: 6,
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
});

OptimizedMapComponent.displayName = 'OptimizedMapComponent';
