import React, { useState, useRef, useCallback, useEffect, useMemo, memo } from 'react';
import {
  StyleSheet,
  View,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
  Platform,
  Text,
  TouchableOpacity,
  SafeAreaView,
  Dimensions,
  Alert,
  Modal,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Animated,
  PanResponder,
} from 'react-native';
import Toast from 'react-native-toast-message';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
// REMOVED: import * as Location from 'expo-location' - now handled by locationUtils
// REMOVED: 3D navigation sensor imports (Magnetometer, Gyroscope)
import AsyncStorage from '@react-native-async-storage/async-storage';
// Use deployed backend instead of localhost
const API_BASE = "https://ts-backend-1-jyit.onrender.com";
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaProvider } from "react-native-safe-area-context";
import polyline from '@mapbox/polyline';
import { useIsFocused } from '@react-navigation/native';

// Import custom hooks and components
import { useUser } from '../AuthContext/UserContextImproved';
import { useAppData } from '../hooks/useAppData';
// REMOVED: forceRefreshMotors - not used in this file
import { useTracking } from '../hooks/useTracking';
import { useTripCache } from '../hooks/useTripCache';
import { validateCoordinates } from '../utils/location';
// REMOVED: reverseGeocodeLocation, checkGPSServiceStatus, GPSServiceStatus - now handled by utilities
import { updateFuelLevel } from '../utils/api';
// REMOVED: getAuthToken - not used in this file
// REMOVED: calculateNewFuelLevel, calculateFuelLevelAfterRefuel - now handled by fuelCalculation utilities
// REMOVED: fetchAllRouteSelectionData, dataManager, createBackgroundRefresh - not used in this file
// REMOVED: runAsyncOperation, scheduleUIUpdate - not used in this file
import { debounce, performanceMonitor } from '../utils/performanceOptimizer';
// REMOVED: throttle, scheduleAfterInteractions - not used in this file

// Import MapScreenTryRefactored components and utilities
import { useMapState } from '../hooks/useMapState-mapscreentry';
import { useRouteHandling } from '../hooks/useRouteHandling-mapscreentry';
import { useMotorManagement } from '../hooks/useMotorManagement-mapscreentry';
import { useMapSelectionHandlers, reverseGeocodeLocation as reverseGeocodeLocationHandler } from '../utils/map-selection-handlers-mapscreentry';
import { useMaintenanceHandlers } from '../utils/maintenance-handlers-mapscreentry';
import { isUserOffRoute, getTrafficLabel } from '../utils/map-utils-mapscreentry';
import { fetchRoutesAsync, geocodeAddressAsync, reverseGeocodeAsync, createDebouncedRouteFetcher } from '../utils/asyncMapOperations';
import { processDirections as processDirectionsService, processTrafficAnalysis as processTrafficAnalysisService } from '../services/routeService';
import { useDestinationFlow } from '../utils/useDestinationFlow';
import { sharedDataManager } from '../utils/sharedDataManager';
// import { cacheManager, CACHE_KEYS } from '../utils/cacheManager';
import { MapFilterModal, MapFilters, defaultMapFilters } from '../components/MapFilterModal';

// Import components
import { OptimizedMapComponent } from './components/OptimizedMapComponent';
import { MotorSelector } from '../components/MotorSelector';
// REMOVED: TrafficReportModal - now handled by Reporting component
import { TripSummaryModal } from '../components/TripSummaryModal';
import { GasPriceUpdateModal } from './components/GasPriceUpdateModal';
// REMOVED: Speedometer - now handled by FreeDrive component
import { TrackingStats } from '../components/TrackingStats';
import { TripRecoveryModal } from '../components/TripRecoveryModal-mapscreentry';
import { SearchModal } from '../components/SearchModal-mapscreentry';
import { RouteSelectionModal } from '../components/RouteSelectionModal-mapscreentry';
import { FlowStateIndicator } from '../components/FlowStateIndicator-mapscreentry';
// REMOVED: NavigationControls - now handled by WithDestination component
import { MaintenanceModal } from '../components/MaintenanceModal-mapscreentry';
import { TripDetailsModal } from '../components/TripDetailsModal-mapscreentry';
import MapSelectionOverlay from '../components/MapSelectionOverlay';

// Import new Maps module components
import { FreeDrive } from './components/FreeDrive';
import { WithDestination } from './components/WithDestination';
import { Reporting } from './components/Reporting';
import { FuelCheckModal } from './components/FuelCheckModal';
import { FuelUpdateModal } from './components/FuelUpdateModal';
import { FuelUpdateSimulatorPanel } from './components/FuelUpdateSimulatorPanel';
// REMOVED: PredictiveAnalytics - now included in WithDestination component
// REMOVED: ToggleButtons - not used in this file
// REMOVED: MapMarkers - not used in this file (markers are handled by OptimizedMapComponent)

// Import new Maps module utilities
import {
  calculateRemainingFuelPercent,
  calculateFuelAfterDistance,
  calculateFuelAfterRefuel,
  calculateDistancePossible,
  isLowFuel,
  isCriticalFuel,
  canReachDestination,
  validateFuelLevel as validateFuelLevelUtil,
  updateFuelLevelInBackend,
} from './utils/fuelCalculation';

// Import new custom hooks for data processing and management
import { useMapDataProcessing } from './utils/useMapDataProcessing';
import { useModalManagement } from './utils/useModalManagement';
import { useMaintenanceForm } from './utils/useMaintenanceForm';
import { useFuelManagement } from './utils/useFuelManagement';
import { useTripManagement } from './utils/useTripManagement';
import { useMotorDetails } from './utils/useMotorDetails';
import { useLocationEffects } from './utils/useLocationEffects';
import { useCacheManagement } from './utils/useCacheManagement';
import { useReportChecking } from './utils/useReportChecking';
import { useStatsUpdate } from './utils/useStatsUpdate';
import { useErrorHandling } from './utils/useErrorHandling';
import {
  handleRefuel,
  handleOilChange,
  handleTuneUp,
  saveMaintenanceRecord,
  validateMaintenanceForm,
  calculateRefuelQuantity,
} from './utils/maintenanceUtils';
import {
  createTripDataForModal as createTripDataUtil,
  saveTripToBackend,
  cancelTrip as cancelTripUtil,
  type TripData,
  type CreateTripDataParams,
  type SaveTripParams,
  type CancelTripParams,
} from './utils/tripUtils';
import {
  handleFuelConfirmation as handleFuelConfirmationUtil,
  handleLowFuelConfirmation as handleLowFuelConfirmationUtil,
  handleFuelUpdate as handleFuelUpdateUtil,
  type FuelCheckParams,
  type FuelUpdateParams,
} from './utils/fuelCheckUtils';
import {
  checkReportUpdates as checkReportUpdatesUtil,
  type CheckReportUpdatesParams,
} from './utils/reportUtils';
import {
  getCurrentLocation as getCurrentLocationUtil,
  type GetCurrentLocationParams,
} from './utils/locationUtils';
import {
  startFreeDriveTracking,
  startDestinationTracking as startDestinationTrackingUtil,
  stopTracking as stopTrackingUtil,
  type StartTrackingParams,
  type StopTrackingParams,
} from './utils/trackingUtils';

// Import types
import type { ScreenMode, Motor, LocationCoords, RouteData, TripSummary, TrafficIncident, RideStats } from '../types';

const { width, height } = Dimensions.get('window');

// Flow state type for navigation flow (now handled by destinationFlow)
// type FlowState = 'initial' | 'searching' | 'destination_selected' | 'routes_found' | 'navigating' | 'completed';

interface RouteSelectionScreenProps {
  navigation: any;
  route?: {
    params?: {
      focusLocation?: LocationCoords;
    };
  };
}

// Import backend services
import { clusterMarkers as clusterMarkersService, processMarkers as processMarkersService } from '../services/mapService';
import {
  compareReports,
  type EffectiveDataState,
} from '../services/routeSelectionDataProcessor';
// REMOVED: getEffectiveReports, getEffectiveGasStations, getEffectiveMotors, filterReports, filterGasStations, prepareMapMarkersAndPolylines - now handled by useMapDataProcessing hook

// Import new Maps module utilities
import { calculateDistance } from './utils/distanceUtils';
import { checkNetworkConnectivity } from './utils/networkUtils';
import { logMapPerformance } from './utils/performanceUtils';
import { useMapInteraction } from './utils/useMapInteraction';
import { useRerouting } from './utils/useRerouting';
import { useArrivalDetection } from './utils/useArrivalDetection';
import { haversineDistance } from './utils/geo';

const RouteSelectionScreen = memo(function RouteSelectionScreen({ navigation, route }: RouteSelectionScreenProps) {
  const { user, cachedMotors, cachedReports, cachedGasStations } = useUser();
  const { focusLocation } = route?.params || {};
  const isFocused = useIsFocused(); // CRITICAL FIX: Track if screen is focused

  // SILENT UPDATE: Component renders silently - no logs unless errors

  // Location permission state (simple)
  const [locationPermissionGranted, setLocationPermissionGranted] = useState(false);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  
  // Map pitch state for free drive mode (camera tilt)
  const [mapPitch, setMapPitch] = useState(0); // 0 = flat, 45 = tilted for driving mode

  // MapScreenTryRefactored hooks - MUST be called before useAppData to ensure mapState is initialized
  const mapStateResult = useMapState();
  
  // CRITICAL: Ensure mapState is always defined to prevent "Cannot read property 'region' of undefined" errors
  // Provide default values if mapState is undefined (should never happen, but safety check)
  const {
    mapState = {
      currentLocation: null,
      destination: null,
      region: null,
      isFollowingUser: false,
    },
    navigationState,
    uiState,
    mapRef,
    searchRef,
    setCurrentLocation,
    setDestination,
    setRegion,
    setIsFollowingUser,
    setIsNavigating,
    setCurrentSpeed,
    setDistanceRemaining,
    setTimeElapsed,
    setCurrentEta,
    setCurrentFuelUsed,
    setIsOverSpeedLimit,
    setNavigationStartTime,
    updateUiState,
  } = mapStateResult || {};

  // App data hook - provides reports, gasStations, motors from API
  // Pass map region for viewport filtering to optimize performance
  // CRITICAL: mapState must be initialized before this hook (moved after useMapState)
  const {
    reports: appReports,
    gasStations: appGasStations,
    motors: appMotors,
    error: appDataError,
    refreshData: refreshAppData,
  } = useAppData({
    user,
    isTracking: false,
    mapRegion: mapState?.region || null, // Safely access region (may be null initially)
    reportFilters: mapFilters ? {
      // Map mapFilters to API filter format
      types: (() => {
        const types: string[] = [];
        if (mapFilters.showAccidents) types.push('Accident');
        if (mapFilters.showCongestion) types.push('Traffic Jam');
        if (mapFilters.showRoadwork) types.push('Road Closure');
        if (mapFilters.showHazards) types.push('Hazard');
        return types.length > 0 ? types : undefined;
      })(),
    } : undefined,
    includeArchived: false, // Don't include archived reports by default
    includeInvalid: false, // Don't include invalid reports by default
  });

  const {
    selectedRouteId,
    selectedRoute,
    alternativeRoutes,
    tripSummary,
    pathCoords,
    finalPathCoords,
    distanceTraveled,
    x,
    setSelectedRouteId,
    setSelectedRoute,
    setAlternativeRoutes,
    setTripSummary,
    setPathCoords,
    setFinalPathCoords,
    setDistanceTraveled,
    setXValue,
    handleRouteSelect,
    fetchRoutes: originalFetchRoutes,
  } = useRouteHandling();

  const {
    motorList,
    selectedMotor,
    handleMotorSelect,
  } = useMotorManagement(user?._id);

  // Add setSelectedMotor function for compatibility
  // Supports both direct value and updater function (like React state setter)
  const setSelectedMotor = useCallback((motorOrUpdater: Motor | null | ((prev: Motor | null) => Motor | null)) => {
    if (__DEV__) {
      console.log('[RouteSelection] 🔄 setSelectedMotor called', {
        type: typeof motorOrUpdater === 'function' ? 'updater' : 'direct',
        currentMotor: selectedMotor?._id,
        currentMotorNickname: selectedMotor?.nickname,
      });
    }

    if (typeof motorOrUpdater === 'function') {
      // Updater function - get current value and apply update
      const updatedMotor = motorOrUpdater(selectedMotor);
      if (updatedMotor) {
        if (__DEV__) {
          console.log('[RouteSelection] ✅ Motor updated via updater function', {
            motorId: updatedMotor._id,
            nickname: updatedMotor.nickname,
            fuelLevel: updatedMotor.currentFuelLevel,
          });
        }
        handleMotorSelect(updatedMotor);
      }
    } else {
      // Direct value
      if (motorOrUpdater) {
        if (__DEV__) {
          console.log('[RouteSelection] ✅ Motor set directly', {
            motorId: motorOrUpdater._id,
            nickname: motorOrUpdater.nickname,
            fuelLevel: motorOrUpdater.currentFuelLevel,
          });
        }
        handleMotorSelect(motorOrUpdater);
      }
    }
  }, [handleMotorSelect, selectedMotor]);

  // REMOVED: Optimized map update function
  // The OptimizedMapComponent now handles marker/polyline updates internally via props
  // This eliminates the need for manual marker updates that were causing re-renders
  // The component uses React.memo with custom comparison to prevent unnecessary re-renders



  // Cleanup effect for map optimization
  // SILENT UPDATE: Mount/unmount happen silently - no logs unless errors
  useEffect(() => {
    // Component mounted - silent
    return () => {
      // Component unmounting - silent cleanup

      // Clear any pending map updates when component unmounts
      if (mapUpdateTimeoutRef.current) {
        clearTimeout(mapUpdateTimeoutRef.current);
      }
      isMapUpdating.current = false;
      
      // Cleanup debounced report update function
      // The debounce function from performanceOptimizer should be cancelled
      // This prevents memory leaks and unnecessary updates after unmount
    };
  }, []);

  // Track if user manually panned the map (disables auto-follow)
  const userManuallyPannedRef = useRef(false);
  const manualPanTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastAutoFollowTimeRef = useRef<number>(0);
  // REMOVED: reportingRef - now handled by useModalManagement hook

  // Track if region change is from auto-follow (animateToRegion) vs manual pan
  const isAutoFollowingRef = useRef(false);

  // Additional refs for optimization (moved before useStatsUpdate to fix declaration order)
  const lastProcessedDistanceRef = useRef<number>(0);
  const isBackgroundTracking = useRef(false);
  const backgroundTrackingId = useRef<string | null>(null);
  const hasCheckedRecovery = useRef(false);
  const hasInitializedMapRegionRef = useRef(false); // Track if map region has been set initially
  const hasGottenLocationOnFocusRef = useRef(false); // Track if we've gotten location on focus

  // Stats update hook
  const { handleStatsUpdate } = useStatsUpdate({
    selectedMotor,
    setSelectedMotor,
    lastProcessedDistanceRef,
  });

  // Handle road snapping failure
  // Moved before tracking hook to avoid declaration order issues
  const handleSnappingFailed = useCallback(() => {
    if (__DEV__) {
      console.warn('[RouteSelection] ⚠️ Road snapping failed', {
        timestamp: new Date().toISOString(),
        currentLocation: mapState.currentLocation,
      });
    }

    Toast.show({
      type: 'error',
      text1: 'Road Snapping Failed',
      text2: 'Unable to snap to roads. Please move closer to a road for better tracking accuracy.',
      position: 'top',
      visibilityTime: 4000,
    });
  }, [mapState.currentLocation]);

  // Tracking hook - Must be declared before useMapInteraction since it provides isTracking
  const trackingResult = useTracking({
    selectedMotor,
    onStatsUpdate: handleStatsUpdate,
    onSnappingFailed: handleSnappingFailed,
    onFuelLevelUpdate: (newFuelLevel: number, lowFuelWarning: boolean) => {
      // Update motor fuel level from API response
      if (selectedMotor) {
        setSelectedMotor({
          ...selectedMotor,
          currentFuelLevel: newFuelLevel,
        });
        
        if (__DEV__) {
          console.log('[RouteSelection] ✅ Fuel level updated from API', {
            newFuelLevel,
            lowFuelWarning,
            motorId: selectedMotor._id,
          });
        }
        
        // Show low fuel warning if needed
        if (lowFuelWarning) {
          Toast.show({
            type: 'error',
            text1: 'Low Fuel Warning',
            text2: `Fuel level is at ${newFuelLevel.toFixed(1)}%. Please refuel soon.`,
            visibilityTime: 5000,
          });
        }
      }
    },
  });
  
  // Safely destructure with defaults to prevent "Property 'isTracking' doesn't exist" error
  const {
    isTracking = false,
    rideStats = { duration: 0, distance: 0, avgSpeed: 0, speed: 0 },
    routeCoordinates = [],
    snappedRouteCoordinates = [],
    startTracking,
    stopTracking,
    resetTracking,
  } = trackingResult || {};

  // Map interaction hook - Must be declared after useTracking since it needs isTracking
  // CRITICAL: Pass isFocused to prevent updates when screen is not focused
  const { handleManualPan } = useMapInteraction({
    isTracking,
    isFocused,
    userManuallyPannedRef,
    manualPanTimeoutRef,
  });

  // handleManualPan is now provided by useMapInteraction hook

  // State refs update - keep refs in sync with state for location callbacks
  // This is a simple effect that doesn't need to be extracted to a hook
  // SILENT UPDATE: State refs update silently in background - no logs
  useEffect(() => {
    mapStateRef.current = mapState;
    navigationStateRef.current = navigationState;
    isTrackingRef.current = isTracking;
  }, [mapState, navigationState, isTracking]);

  // REMOVED: Complex real-time location tracking subscription
  // Location updates are now handled by useTracking hook and manual getCurrentLocation calls


  // logMapPerformance is now imported from performanceUtils

  // Trip cache hook
  const {
    currentTrip,
    hasRecoverableTrip,
    saveTripData,
    recoverTrip,
    clearTripData,
    completeTrip,
    startAutoCache,
    stopAutoCache,
    checkRecoverableTrip,
    clearCompletedTrips,
  } = useTripCache();

  // Screen state
  const [screenMode, setScreenMode] = useState<ScreenMode>('planning');

  // Additional state for flow management
  const [searchText, setSearchText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [reports, setReports] = useState<TrafficIncident[]>([]);
  
  // Rerouting hook
  const {
    wasRerouted,
    isRerouting,
    rerouteCount,
    triggerReroute,
    completeReroute,
    resetRerouting,
  } = useRerouting({
    onReroute: () => fetchRoutes(),
  });
  
  // Arrival detection hook
  const {
    hasArrived,
    arrivalNotificationShown,
    arrivalDistance,
    resetArrival,
  } = useArrivalDetection({
    destination: mapState.destination,
    currentLocation: mapState.currentLocation,
    isNavigating: navigationState.isNavigating,
    calculateDistance,
  });

  // Modal management hook (excluding fuel modals - handled by fuel management hook)
  const {
    showMotorSelector,
    showReportModal,
    showTripSummary,
    showTripRecovery,
    showFilterModal,
    setShowMotorSelector,
    setShowReportModal,
    setShowTripSummary,
    setShowTripRecovery,
    setShowFilterModal,
    openMotorSelector,
    closeMotorSelector,
    openReportModal,
    closeReportModal,
    openTripSummary,
    closeTripSummary,
    openTripRecovery,
    closeTripRecovery,
    openFilterModal,
    closeFilterModal,
    reportingRef,
  } = useModalManagement();

  const [startAddress, setStartAddress] = useState<string>('');
  const [endAddress, setEndAddress] = useState<string>('');

  // Map and UI states
  const [showReports, setShowReports] = useState(true);
  const [showGasStations, setShowGasStations] = useState(true);
  
  // REMOVED: All 3D navigation state variables
  
  // Async operation states (removed loading states)
  const [asyncErrors, setAsyncErrors] = useState<Record<string, string | null>>({});
  const [backgroundRefresh, setBackgroundRefresh] = useState<any>(null);

  // Map selection state
  const [mapSelectionState, setMapSelectionState] = useState({
    selectedLocation: null as LocationCoords | null,
    isSelecting: false,
  });
  
  // CRITICAL: Centralized map selection active state for easier access
  // This state is updated synchronously and checked immediately in handleMapPress
  const [isMapSelectionActive, setIsMapSelectionActive] = useState(false);
  
  // CRITICAL: Guard against double-selection crashes
  // Track if map press is currently being processed to prevent concurrent operations
  const isProcessingMapPressRef = useRef(false);
  const isConfirmingSelectionRef = useRef(false);

  // Track maintenance actions during current trip (declared early for use in maintenance form hook)
  const [tripMaintenanceActions, setTripMaintenanceActions] = useState<any[]>([]);

  // Maintenance form management hook (declared early for use in useDestinationFlow)
  const {
    maintenanceFormData,
    maintenanceFormVisible: maintenanceFormVisibleFromHook,
    setMaintenanceFormData,
    setMaintenanceFormVisible: setMaintenanceFormVisibleFromHook,
    handleMaintenanceFormChange,
    handleMaintenanceFormSave,
    openMaintenanceForm,
    closeMaintenanceForm,
  } = useMaintenanceForm({
    selectedMotor,
    currentLocation: mapState.currentLocation,
    user,
    setSelectedMotor,
    setTripMaintenanceActions,
    onClose: () => {
      // Close maintenance form
    },
  });

  // Maintenance action handler - PARENT HANDLES: Backend updates for maintenance actions
  // Opens maintenance form modal via useMaintenanceForm hook
  // Backend updates: useMaintenanceForm -> handleMaintenanceFormSave -> maintenanceUtils -> saveMaintenanceRecord
  // Motor state updated via setSelectedMotor after refuel
  const handleMaintenanceAction = useCallback((actionType: 'refuel' | 'oil_change' | 'tune_up') => {
    if (__DEV__) {
      console.log('[RouteSelection] 🔧 handleMaintenanceAction called', {
        actionType,
        hasSelectedMotor: !!selectedMotor,
        hasCurrentLocation: !!mapState.currentLocation,
        timestamp: new Date().toISOString(),
      });
    }

    if (!mapState.currentLocation || !selectedMotor) {
      if (__DEV__) {
        console.warn('[RouteSelection] ❌ Cannot perform maintenance action - missing data', {
          hasSelectedMotor: !!selectedMotor,
          hasCurrentLocation: !!mapState.currentLocation,
        });
      }

      Alert.alert('Error', 'Location or motor data not available');
      return;
    }

    if (__DEV__) {
      console.log('[RouteSelection] ✅ Opening maintenance form modal', {
        actionType,
        timestamp: new Date().toISOString(),
      });
    }

    // Open maintenance form using hook
    openMaintenanceForm(actionType);
  }, [mapState.currentLocation, selectedMotor, openMaintenanceForm]);

  // Destination flow management
  const {
    destinationFlow,
    flowStateManager,
    resetDestinationFlow,
    cancelDestinationFlow,
    startNavigationFlow,
    completeNavigationFlow,
    isDestinationFlowActive,
    isInFlowState,
    getCurrentFlowState,
    confirmMapSelectionWithFlowUpdate,
    fetchRoutes,
    searchAddress,
    handleDestinationSelect,
    handleSearchModalClose,
    handleRouteButtonPress,
    // REMOVED: getNavigationControlsProps - not needed since WithDestination handles navigation UI
    renderFlowStateIndicator,
    renderLoadingIndicators,
    renderErrorHandling,
    renderDestinationDisplay,
    renderRouteSelectionDisplay,
  } = useDestinationFlow({
    mapState,
    navigationState,
    selectedMotor,
    user,
    navigation,
    setDestination,
    setRegion,
    setSelectedRoute,
    setSelectedRouteId,
    setAlternativeRoutes,
    setTripSummary,
    updateUiState,
    setSearchText,
    setIsTyping,
    setAsyncLoading: () => {}, // Removed loading states
    setAsyncErrors,
    onEndNavigation: async () => {
      // Stop tracking when navigation ends (for destination flow)
      if (isTracking) {
        try {
          await stopTrackingUtil({
            selectedMotor,
            currentLocation: mapState.currentLocation,
            destination: mapState.destination,
            rideStats,
            routeCoordinates,
            snappedRouteCoordinates,
            startAddress,
            endAddress,
            tripMaintenanceActions,
            isBackgroundTracking: isBackgroundTracking.current,
            backgroundTrackingId: backgroundTrackingId.current,
            hasArrived: hasArrived, // Pass arrival status from useArrivalDetection
            onStopTracking: stopTracking,
            onResetTracking: resetTracking,
            onSetEndAddress: setEndAddress,
            onSetTripDataForModal: setTripDataForModal,
            onResetLastProcessedDistance: () => {
              lastProcessedDistanceRef.current = 0;
            },
            onSetScreenMode: setScreenMode,
            onSetShowTripSummary: setShowTripSummary,
            onCreateTripData: createTripDataForModal,
          });
        } catch (error: any) {
          console.error('[RouteSelection] Failed to stop tracking on navigation end:', error);
        }
      }
      
      setIsNavigating(false);
      setNavigationStartTime(null);
      setIsFollowingUser(false);
      completeNavigationFlow();
      
      // Reset arrival state
      resetArrival();
      
      // Show trip summary modal after navigation ends
      updateUiState({ showTripSummary: true });
      
      console.log('[RouteSelection] Navigation ended, showing trip summary');
    },
    onShowDetails: () => updateUiState({ showTripDetails: true }),
    onMaintenanceAction: handleMaintenanceAction,
    onReroute: () => fetchRoutes(),
    isRerouting: isRerouting,
    onFuelLevelUpdate: (newFuelLevel) => {
      console.log('[RouteSelection] Fuel level updated from WithDestination:', newFuelLevel);
    },
  });

  // Map selection handlers
  const {
    startMapSelection: originalStartMapSelection,
    cancelMapSelection,
    handleMapPress: originalHandleMapPress,
    confirmMapSelection,
  } = useMapSelectionHandlers(
    uiState,
    updateUiState,
    mapSelectionState,
    setMapSelectionState,
    setDestination,
    mapState.currentLocation,
    setCurrentLocation,
    // Removed flowStateManager - flow state is now handled by confirmMapSelectionWithFlowUpdate wrapper
    undefined // flowStateManager is now optional and not used
  );
  
  // CRITICAL: Wrapper functions that update centralized state immediately
  // These ensure map selection state is set synchronously for immediate access
  const startMapSelection = useCallback(() => {
    if (__DEV__) {
      console.log('[RouteSelection] 🗺️ Starting map selection (centralized state)');
    }
    // Set centralized state immediately (synchronous)
    setIsMapSelectionActive(true);
    // Then call original handler (which also updates mapSelectionState and uiState)
    originalStartMapSelection();
  }, [originalStartMapSelection]);
  
  const stopMapSelection = useCallback(() => {
    if (__DEV__) {
      console.log('[RouteSelection] 🛑 Stopping map selection (centralized state)');
    }
    // Reset processing flags to prevent crashes
    isProcessingMapPressRef.current = false;
    isConfirmingSelectionRef.current = false;
    
    // Set centralized state immediately (synchronous)
    setIsMapSelectionActive(false);
    // Clear selected location
    setMapSelectionState({ selectedLocation: null, isSelecting: false });
    // Then call original cancel handler
    cancelMapSelection();
  }, [cancelMapSelection]);
  
  // Sync centralized state with mapSelectionState changes
  // This ensures state stays in sync even if mapSelectionState is updated elsewhere
  useEffect(() => {
    // Keep centralized state in sync with mapSelectionState
    if (mapSelectionState.isSelecting && !isMapSelectionActive) {
      setIsMapSelectionActive(true);
    } else if (!mapSelectionState.isSelecting && isMapSelectionActive && !uiState.isMapSelectionMode) {
      // Only clear if uiState also confirms it's not active
      setIsMapSelectionActive(false);
    }
  }, [mapSelectionState.isSelecting, uiState.isMapSelectionMode, isMapSelectionActive]);

  // Custom handleMapPress that handles gas station actions and map selection
  const handleMapPress = useCallback((event: any) => {
    // CRITICAL: Check centralized state first for immediate detection
    // This ensures map selection works immediately after "Choose from Maps" is clicked
    if (isMapSelectionActive || mapSelectionState.isSelecting || uiState.isMapSelectionMode) {
      if (__DEV__) {
        console.log('[RouteSelection] 🗺️ Map press in selection mode, calling original handler', {
          isMapSelectionActive, // Check centralized state first
          isSelecting: mapSelectionState.isSelecting,
          isMapSelectionMode: uiState.isMapSelectionMode,
        });
      }
      
      // CRITICAL: Allow multiple selections until user confirms
      // Only guard against concurrent processing (not multiple selections)
      // User can click multiple times to change selection, but we prevent rapid concurrent processing
      if (isProcessingMapPressRef.current) {
        if (__DEV__) {
          console.log('[RouteSelection] ⚠️ Map press processing in progress, queuing...');
        }
        // Queue the press after a short delay to allow current processing to complete
        setTimeout(() => {
          if (isMapSelectionActive || mapSelectionState.isSelecting || uiState.isMapSelectionMode) {
            originalHandleMapPress(event);
          }
        }, 100); // Short delay to prevent concurrent processing
        return;
      }
      
      // Set processing flag to prevent concurrent processing (not multiple selections)
      isProcessingMapPressRef.current = true;
      
      // Call the original map selection handler to handle map selection logic
      // Wrap in try-catch to prevent crashes
      try {
        originalHandleMapPress(event);
      } catch (error) {
        if (__DEV__) {
          console.error('[RouteSelection] ❌ Error in map press handler:', error);
        }
        // Reset flag on error
        isProcessingMapPressRef.current = false;
      } finally {
        // Reset processing flag quickly to allow next selection
        // This allows user to click multiple times to change selection
        setTimeout(() => {
          isProcessingMapPressRef.current = false;
        }, 200); // Short delay (200ms) to allow async operations but enable multiple selections
      }
      return;
    }

    // Check if this is a gas station action
    if (event?.nativeEvent?.action === 'viewUpdatePrices') {
      // Handle view/update gas prices
      const station = event.nativeEvent.station;
      if (station) {
        // Open gas price update modal
        setSelectedGasStationForPriceUpdate(station);
        setShowGasPriceUpdateModal(true);
      }
      return;
    }

    if (event?.nativeEvent?.action === 'addStop') {
      // Handle add stop to route
      const location = event.nativeEvent.coordinate;
      if (location && navigationState.isNavigating && selectedRoute) {
        // Recalculate route with gas station as a stop
        // This will be handled by the rerouting logic
        Toast.show({
          type: 'info',
          text1: 'Adding Stop',
          text2: 'Recalculating route with gas station stop...',
        });
        // Trigger reroute with the new stop
        // The rerouting logic should handle adding the stop
        fetchRoutes();
      }
      return;
    }

    // Default map press handling
    originalHandleMapPress(event);
  }, [originalHandleMapPress, isMapSelectionActive, uiState.isMapSelectionMode, mapSelectionState.isSelecting, setDestination, navigationState.isNavigating, selectedRoute, fetchRoutes, isDestinationFlowActive, handleDestinationSelect, startNavigationFlow]);

  // Custom confirm map selection that also updates destination flow state
  // CRITICAL: Add guard against double-confirmation crashes
  const confirmMapSelectionWithFlowUpdateWrapper = useCallback(async () => {
    // Guard against double-confirmation
    if (isConfirmingSelectionRef.current) {
      if (__DEV__) {
        console.log('[RouteSelection] ⚠️ Confirmation already in progress, ignoring duplicate confirmation');
      }
      return;
    }
    
    // Check if location is selected
    if (!mapSelectionState.selectedLocation) {
      if (__DEV__) {
        console.warn('[RouteSelection] ⚠️ No location selected, cannot confirm');
      }
      return;
    }
    
    // Set confirmation flag
    isConfirmingSelectionRef.current = true;
    
    // CRITICAL: Store the selected location before confirmation
    // This ensures we have the destination even if state hasn't updated yet
    const selectedLocation = mapSelectionState.selectedLocation;
    
    try {
      if (__DEV__) {
        console.log('[RouteSelection] ✅ Confirming map selection', {
          location: selectedLocation,
        });
      }
      
      // Pass the selected location directly to confirmMapSelectionWithFlowUpdate
      // This ensures routes are fetched immediately with the correct destination
      await confirmMapSelectionWithFlowUpdate(confirmMapSelection, selectedLocation);
      
      // Reset processing flags after successful confirmation
      isProcessingMapPressRef.current = false;
      setIsMapSelectionActive(false);
    } catch (error) {
      if (__DEV__) {
        console.error('[RouteSelection] ❌ Error confirming map selection:', error);
      }
      // Reset flags on error
      isProcessingMapPressRef.current = false;
      isConfirmingSelectionRef.current = false;
    } finally {
      // Reset confirmation flag after a delay
      setTimeout(() => {
        isConfirmingSelectionRef.current = false;
      }, 1000); // 1 second debounce
    }
  }, [confirmMapSelectionWithFlowUpdate, confirmMapSelection, mapSelectionState.selectedLocation]);

  // REMOVED: tripMaintenanceActions - moved earlier for use in maintenance form hook
  
  // Store trip data for modal display (created once when trip ends)
  const [tripDataForModal, setTripDataForModal] = useState<any>(null);
  
  // Trip management hook
  const {
    createTripDataForModal,
    handleTripSave,
    handleTripCancel,
    handleRecoverTrip,
    handleDiscardTrip,
  } = useTripManagement({
    selectedMotor,
    user,
    rideStats,
    routeCoordinates,
    snappedRouteCoordinates,
    mapState,
    startAddress,
    endAddress,
    tripDataForModal,
    tripMaintenanceActions,
    screenMode,
    currentTrip,
    isTracking,
    isBackgroundTracking,
    backgroundTrackingId,
    hasCheckedRecovery,
    setSelectedMotor,
    setScreenMode,
    setShowTripSummary,
    setStartAddress,
    setEndAddress,
    setTripMaintenanceActions,
    setTripDataForModal,
    resetTracking,
    completeTrip,
    clearTripData,
    saveTripData,
    checkRecoverableTrip,
    clearCompletedTrips,
    resetDestinationFlow,
    lastProcessedDistanceRef,
    setShowTripRecovery,
    // Callbacks for restoring trip state
    setCurrentLocation,
    setRegion,
    setPathCoords,
    setFinalPathCoords,
    setDistanceTraveled,
    startTracking,
    setDestination,
    setIsNavigating,
    setNavigationStartTime,
  });
  
  // Memoized callbacks for TripSummaryModal to prevent re-renders
  // CRITICAL FIX: Memoize callbacks to prevent TripSummaryModal from re-rendering on every parent render
  const memoizedHandleTripClose = useCallback(() => {
    setShowTripSummary(false);
  }, []);

  // Additional refs for optimization
  const isUserDrivenRegionChange = useRef(false);
  const hasRequestedLocation = useRef(false);
  const lastFuelWarningLevel = useRef<number>(100);
  // REMOVED: lastProcessedDistanceRef, isBackgroundTracking, backgroundTrackingId, hasCheckedRecovery, hasInitializedMapRegionRef - moved earlier
  // REMOVED: lastEffectiveData - now handled by useMapDataProcessing hook
  
  // Location optimization refs
  // Simple location caching (30 seconds)
  const lastLocationUpdateTime = useRef<number>(0);
  const lastKnownLocation = useRef<LocationCoords | null>(null);
  const isFetchingLocation = useRef(false);
  const LOCATION_CACHE_DURATION = 30000; // 30 seconds
  // Refs to access current state values in location callback (to avoid stale closures)
  const mapStateRef = useRef(mapState);
  const navigationStateRef = useRef(navigationState);
  // Initialize with false - will be updated in useEffect after isTracking is available
  // This prevents "Property 'isTracking' doesn't exist" error during initial render
  const isTrackingRef = useRef(false);

  // Map filter state
  const [mapFilters, setMapFilters] = useState<MapFilters>(defaultMapFilters);
  // REMOVED: showFilterModal and setShowFilterModal - now handled by useModalManagement hook

  // Gas price update modal state
  const [showGasPriceUpdateModal, setShowGasPriceUpdateModal] = useState(false);
  const [selectedGasStationForPriceUpdate, setSelectedGasStationForPriceUpdate] = useState<any>(null);
  
  // Fuel update simulator (development only)
  const [showFuelSimulator, setShowFuelSimulator] = useState(false);

  // sliderTrackRef is now provided by useFuelManagement hook
  const sliderTrackWidthRef = useRef<number>(280); // Default width, will be updated on layout

  // Map optimization refs - prevent full map re-renders
  // This optimization significantly improves performance by:
  // 1. Only updating markers and polylines instead of re-rendering the entire map
  // 2. Debouncing updates to prevent excessive re-renders
  // 3. Using memoization to prevent unnecessary recalculations
  // 4. Tracking changes to only update what actually changed
  const lastMarkersRef = useRef<any[]>([]);
  const lastPolylinesRef = useRef<any[]>([]);
  const mapUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isMapUpdating = useRef(false);

  // Cache management hook
  const {
    localMotors,
    localReports,
    localGasStations,
    setLocalMotors,
    setLocalReports,
    setLocalGasStations,
    loadCachedData,
    saveCachedData,
  } = useCacheManagement({
    user,
    isFocused,
    appMotors,
    appReports,
    appGasStations,
    cachedMotors,
    cachedReports,
    cachedGasStations,
  });

  // Report update tracking
  const [lastReportUpdate, setLastReportUpdate] = useState<number>(0);
  const [reportUpdateInterval, setReportUpdateInterval] = useState<NodeJS.Timeout | null>(null);
  const [isCheckingReports, setIsCheckingReports] = useState(false);

  // Cache loading is now handled by useCacheManagement hook

  // Data Processing - using custom hook
  const {
    effectiveReports,
    filteredReports,
    effectiveGasStations,
    filteredGasStations,
    effectiveMotors,
    mapMarkersAndPolylines,
  } = useMapDataProcessing({
    appReports,
    localReports,
    cachedReports,
    appGasStations,
    localGasStations,
    cachedGasStations,
    appMotors,
    motorList,
    localMotors,
    cachedMotors,
    mapState: {
      currentLocation: mapState?.currentLocation ?? null,
      destination: mapState?.destination ?? null,
      region: mapState?.region ?? null,
    },
    selectedRoute,
    alternativeRoutes,
    showReports,
    showGasStations,
  });

  // Check if markers are fully loaded when screen focuses and reload if needed
  // This works for both logged in and not logged in users
  useEffect(() => {
    // Only check when screen is focused
    if (!isFocused) return;

    // Wait a bit for initial data to load
    const checkTimeout = setTimeout(() => {
      // Check if markers are not fully loaded
      // Consider markers "not fully loaded" if:
      // 1. Both reports and gas stations are empty (or very few)
      // 2. Reports are empty but should have some
      const reportsCount = effectiveReports?.length || 0;
      const gasStationsCount = effectiveGasStations?.length || 0;
      const totalMarkers = reportsCount + gasStationsCount;

      // Threshold: If total markers is less than 5, consider it not fully loaded
      // This accounts for areas with genuinely few markers
      const MIN_EXPECTED_MARKERS = 5;
      const isMarkersNotFullyLoaded = totalMarkers < MIN_EXPECTED_MARKERS;

      if (isMarkersNotFullyLoaded && refreshAppData) {
        if (__DEV__) {
          console.log('[RouteSelection] ⚠️ Markers not fully loaded, reloading...', {
            reportsCount,
            gasStationsCount,
            totalMarkers,
            isLoggedIn: !!user?._id,
            timestamp: new Date().toISOString(),
          });
        }

        // Reload markers (works for both logged in and not logged in)
        refreshAppData().catch((error) => {
          if (__DEV__) {
            console.warn('[RouteSelection] Failed to reload markers:', error);
          }
        });
      }
    }, 2000); // Wait 2 seconds after focus to allow initial load

    return () => {
      clearTimeout(checkTimeout);
    };
  }, [isFocused, user?._id, effectiveReports?.length, effectiveGasStations?.length, refreshAppData]);

  // REMOVED: Effect to update map markers and polylines
  // The OptimizedMapComponent now receives props directly and handles updates internally via React.memo
  // This prevents unnecessary effect triggers that caused constant re-renders
  // The component's custom arePropsEqual comparison will handle when to re-render

  // COMMENTED OUT: Complex data processing - replaced with simple fallback
  // Data preloading and caching optimization - NON-BLOCKING
  // useEffect(() => {
  //   ... (entire complex preload logic commented out)
  // }, [user?._id, user?.token, effectiveReports.length, effectiveGasStations.length, setLocalReports, setLocalGasStations]);

  // SIMPLE FALLBACK: No preloading, just use cached data

  // Motor details hook
  const { fetchMotorcycleDetails } = useMotorDetails({
    user,
    selectedMotor,
    setSelectedMotor,
  });

  // checkNetworkConnectivity is now imported from networkUtils

  // Use compareReports directly from processor service (no wrapper needed)

  // Report checking hook
  const { checkReportUpdates, memoizedRefreshData } = useReportChecking({
    user,
    isFocused,
    effectiveReports,
    lastReportUpdate,
    isCheckingReports,
    setLocalReports,
    setLastReportUpdate,
    setIsCheckingReports,
  });

  // Use validateFuelLevelUtil directly (no wrapper needed)

  // REMOVED: Duplicate declarations - moved earlier to fix declaration order

  // Error handling hook
  useErrorHandling({ error: appDataError });

  // Map pitch effect: Tilt map for free drive mode
  // PARENT HANDLES: Map tilt on FreeDrive start
  // Sets mapPitch to 45 degrees when isTracking && !isDestinationFlowActive
  // Passed to OptimizedMapComponent as mapPitch prop
  useEffect(() => {
    // Set map pitch to 45 degrees when free drive starts (isTracking true and no destination)
    // Reset to 0 when tracking stops or destination flow is active
    if (isTracking && !isDestinationFlowActive) {
      // Free drive mode: tilt map to simulate driving mode
      setMapPitch(45);
    } else {
      // Reset to flat view
      setMapPitch(0);
    }
  }, [isTracking, isDestinationFlowActive]);

  // CRITICAL FIX: Define handleGetCurrentLocation before useLocationEffects hook
  // Use new utility function for location handling
  // PERFORMANCE: Use refs for stable values to prevent unnecessary re-creation
  const isFocusedForLocationRef = useRef(isFocused);
  isFocusedForLocationRef.current = isFocused;
  
  const handleGetCurrentLocation = useCallback(async (showOverlay: boolean = true, forceRefresh: boolean = false) => {
    if (__DEV__) {
      console.log('[RouteSelection] 📍 handleGetCurrentLocation called', {
        showOverlay,
        forceRefresh,
        isFocused: isFocusedForLocationRef.current,
        timestamp: new Date().toISOString(),
      });
    }

    const result = await getCurrentLocationUtil({
      showOverlay,
      forceRefresh,
      isFocused: isFocusedForLocationRef.current,
      hasInitializedMapRegion: hasInitializedMapRegionRef.current,
      lastKnownLocation: lastKnownLocation.current,
      lastLocationUpdateTime: lastLocationUpdateTime.current,
      isFetchingLocation: isFetchingLocation.current,
      onSetLocation: setCurrentLocation,
      onSetRegion: setRegion,
      onSetIsFollowingUser: setIsFollowingUser,
      onSetLocationPermissionGranted: setLocationPermissionGranted,
      onSetIsGettingLocation: setIsGettingLocation,
      onSetIsUserDrivenRegionChange: (driven: boolean) => {
        isUserDrivenRegionChange.current = driven;
      },
      onSetHasInitializedMapRegion: (initialized: boolean) => {
        hasInitializedMapRegionRef.current = initialized;
      },
      onUpdateLastKnownLocation: (location: LocationCoords) => {
        lastKnownLocation.current = location;
      },
      onUpdateLastLocationUpdateTime: (time: number) => {
        lastLocationUpdateTime.current = time;
      },
      onSetIsFetchingLocation: (fetching: boolean) => {
        isFetchingLocation.current = fetching;
      },
      mapRef,
      validateCoordinates,
    });

    if (__DEV__) {
      if (result) {
        console.log('[RouteSelection] ✅ Location obtained successfully', {
          latitude: result.latitude,
          longitude: result.longitude,
          timestamp: new Date().toISOString(),
        });
      } else {
        console.warn('[RouteSelection] ❌ Failed to get location', {
          timestamp: new Date().toISOString(),
        });
      }
    }

    return result;
  }, [setCurrentLocation, setRegion, setIsFollowingUser, setLocationPermissionGranted, setIsGettingLocation, mapRef, validateCoordinates]);

  // Location effects hook (handles Effects 3, 4, 5, 5.5, auto-focus, map region init, auto-get location)
  useLocationEffects({
    isFocused,
    focusLocation,
    effectiveMotors,
    selectedMotor,
    isTracking,
    screenMode,
    routeCoordinates,
    snappedRouteCoordinates,
    mapState,
    isDestinationFlowActive,
    userManuallyPannedRef,
    isAutoFollowingRef,
    hasInitializedMapRegionRef,
    hasRequestedLocation,
    hasGottenLocationOnFocusRef,
    setSelectedMotor,
    setCurrentLocation,
    setRegion,
    setScreenMode,
    startAutoCache,
    stopAutoCache,
    mapRef,
    handleGetCurrentLocation,
  });

  // ============================================================================
  // EFFECTS - Most effects are now handled by custom hooks
  // ============================================================================
  
  // Effects are handled by:
  // - useLocationEffects: Effects 3, 4, 5, 5.5, auto-focus, map region init, auto-get location
  // - useErrorHandling: Effect 7 (error handling)
  // - useMotorDetails: Effect 7.5 (populate motor details)
  // - useTripManagement: Effect 10 (auto-save trip data), Effect 11 (check recoverable trip)
  // - useCacheManagement: Cache loading effects

  // CRITICAL: Update navigation stats during destination navigation
  // This effect calculates and updates distanceRemaining, currentEta, currentSpeed, and timeElapsed
  useEffect(() => {
    if (!navigationState.isNavigating || !isDestinationFlowActive || !mapState.destination) {
      return;
    }

    // Update time elapsed based on navigation start time
    if (navigationState.navigationStartTime) {
      const elapsed = Math.floor((Date.now() - navigationState.navigationStartTime) / 1000);
      setTimeElapsed(elapsed);
    }

    // Update current speed from rideStats (from useTracking hook)
    if (rideStats?.speed !== undefined) {
      setCurrentSpeed(rideStats.speed);
    }

    // Calculate distance remaining from current location to destination
    if (mapState.currentLocation && mapState.destination) {
      // Use haversineDistance for quick calculation (synchronous)
      const distanceMeters = haversineDistance(
        [mapState.currentLocation.longitude, mapState.currentLocation.latitude],
        [mapState.destination.longitude, mapState.destination.latitude]
      );
      const distanceKm = distanceMeters / 1000; // Convert to kilometers
      setDistanceRemaining(distanceKm);

      // Calculate ETA based on remaining distance and current/average speed
      const currentSpeedKmh = rideStats?.speed || rideStats?.avgSpeed || 0;
      if (currentSpeedKmh > 0 && distanceKm > 0) {
        // ETA in seconds = (distance in km / speed in km/h) * 3600
        const etaSeconds = Math.max(0, Math.round((distanceKm / currentSpeedKmh) * 3600));
        // Format ETA as string (e.g., "5m" or "1h 30m")
        const hours = Math.floor(etaSeconds / 3600);
        const minutes = Math.floor((etaSeconds % 3600) / 60);
        const etaString = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
        setCurrentEta(etaString);
      } else if (selectedRoute && selectedRoute.duration) {
        // Fallback: Use route duration minus elapsed time
        const remainingTimeSeconds = Math.max(0, selectedRoute.duration - (navigationState.timeElapsed || 0));
        const hours = Math.floor(remainingTimeSeconds / 3600);
        const minutes = Math.floor((remainingTimeSeconds % 3600) / 60);
        const etaString = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
        setCurrentEta(etaString);
      } else {
        setCurrentEta(null);
      }
    } else {
      // No current location or destination, set defaults
      setDistanceRemaining(0);
      setCurrentEta(null);
    }
  }, [
    navigationState.isNavigating,
    navigationState.navigationStartTime,
    navigationState.timeElapsed,
    isDestinationFlowActive,
    mapState.currentLocation,
    mapState.destination,
    rideStats?.speed,
    rideStats?.avgSpeed,
    selectedRoute,
    setTimeElapsed,
    setCurrentSpeed,
    setDistanceRemaining,
    setCurrentEta,
  ]);

  // Timer effect: Update timeElapsed every second during navigation
  useEffect(() => {
    if (!navigationState.isNavigating || !navigationState.navigationStartTime || !isDestinationFlowActive) {
      return;
    }

    const timer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - navigationState.navigationStartTime!) / 1000);
      setTimeElapsed(elapsed);
    }, 1000);

    return () => clearInterval(timer);
  }, [navigationState.isNavigating, navigationState.navigationStartTime, isDestinationFlowActive, setTimeElapsed]);

  // CRITICAL FIX: Cleanup effect to prevent memory leaks
  useEffect(() => {
    return () => {
      // Clear all timers and refs on unmount
      if (lastFuelWarningLevel.current) {
        lastFuelWarningLevel.current = 100;
      }
      if (lastProcessedDistanceRef.current) {
        lastProcessedDistanceRef.current = 0;
      }
      if (isBackgroundTracking.current) {
        isBackgroundTracking.current = false;
      }
      if (backgroundTrackingId.current) {
        backgroundTrackingId.current = null;
      }
      if (hasCheckedRecovery.current) {
        hasCheckedRecovery.current = false;
      }
      
      // Clear any pending timeouts
      const timeouts = [
        // Add any other timeout refs here if needed
      ];
      
      timeouts.forEach(timeout => {
        if (timeout) {
          clearTimeout(timeout);
        }
      });
      
      // Log performance metrics on cleanup
      if (__DEV__) {
        performanceMonitor.logMetrics();
      }
      
      // SILENT REFRESH: Removed cleanup completion log
    };
  }, []);

  // REMOVED: hasGottenLocationOnFocusRef - moved earlier before useLocationEffects
  
  // Cleanup effect for any remaining intervals (safety cleanup)
  useEffect(() => {
    return () => {
      // Cleanup any remaining intervals on unmount
      if (reportUpdateInterval) {
        clearInterval(reportUpdateInterval);
        setReportUpdateInterval(null);
      }
    };
  }, [reportUpdateInterval]);

  // REMOVED: Background tracking resume and app state change handling

  // ============================================================================
  // CALLBACK FUNCTIONS
  // ============================================================================

  // createTripDataForModal is now provided by useTripManagement hook

  // Destination-specific tracking (using new utility function)
  const startDestinationTracking = useCallback(async () => {
    if (__DEV__) {
      console.log('[RouteSelection] 🚀 startDestinationTracking called', {
        hasSelectedMotor: !!selectedMotor,
        motorId: selectedMotor?._id,
        hasCurrentLocation: !!mapState.currentLocation,
        isDestinationFlowActive,
        timestamp: new Date().toISOString(),
      });
    }

    try {
      await startDestinationTrackingUtil({
      selectedMotor,
      currentLocation: mapState.currentLocation,
      isDestinationFlowActive: isDestinationFlowActive,
      onStartTracking: startTracking,
      onGetCurrentLocation: handleGetCurrentLocation,
      onSetStartAddress: setStartAddress,
      onSetTripDataForModal: setTripDataForModal,
      onResetLastProcessedDistance: () => {
        lastProcessedDistanceRef.current = 0;
      },
      onResetManualPanFlag: () => {
        userManuallyPannedRef.current = false;
        if (manualPanTimeoutRef.current) {
          clearTimeout(manualPanTimeoutRef.current);
          manualPanTimeoutRef.current = null;
        }
      },
      onSetScreenMode: setScreenMode,
      });

      if (__DEV__) {
        console.log('[RouteSelection] ✅ Destination tracking started successfully', {
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error: any) {
      if (__DEV__) {
        console.error('[RouteSelection] ❌ Failed to start destination tracking', {
          error: error.message,
          timestamp: new Date().toISOString(),
        });
      }
      throw error;
    }
  }, [selectedMotor, mapState.currentLocation, startTracking, handleGetCurrentLocation, isDestinationFlowActive]);

  // Use new utility functions for tracking
  const handleTrackingToggle = useCallback(async () => {
    if (__DEV__) {
      console.log('[RouteSelection] 🔄 handleTrackingToggle called', {
        isTracking,
        willStart: !isTracking,
        hasSelectedMotor: !!selectedMotor,
        motorId: selectedMotor?._id,
        timestamp: new Date().toISOString(),
      });
    }

    if (!isTracking) {
      // Start tracking using utility
      if (__DEV__) {
        console.log('[RouteSelection] ▶️ Starting free drive tracking', {
          timestamp: new Date().toISOString(),
        });
      }

      try {
        await startFreeDriveTracking({
        selectedMotor,
        currentLocation: mapState.currentLocation,
        isDestinationFlowActive,
        onStartTracking: startTracking,
        onGetCurrentLocation: handleGetCurrentLocation,
        onSetStartAddress: setStartAddress,
        onResetLastProcessedDistance: () => {
          lastProcessedDistanceRef.current = 0;
        },
        onResetManualPanFlag: () => {
          userManuallyPannedRef.current = false;
          if (manualPanTimeoutRef.current) {
            clearTimeout(manualPanTimeoutRef.current);
            manualPanTimeoutRef.current = null;
          }
        },
        onSetTripDataForModal: setTripDataForModal,
        onSetScreenMode: setScreenMode,
        });

        if (__DEV__) {
          console.log('[RouteSelection] ✅ Free drive tracking started successfully', {
            timestamp: new Date().toISOString(),
          });
        }
      } catch (error: any) {
        if (__DEV__) {
          console.error('[RouteSelection] ❌ Failed to start free drive tracking', {
            error: error.message,
            timestamp: new Date().toISOString(),
          });
        }
        throw error;
      }
    } else {
      // Stop tracking using utility
      if (__DEV__) {
        console.log('[RouteSelection] ⏹️ Stopping tracking', {
          distance: rideStats?.distance,
          duration: rideStats?.duration,
          timestamp: new Date().toISOString(),
        });
      }

      try {
        // PARENT HANDLES: Trip summary modal on FreeDrive stop
        // stopTrackingUtil creates trip data and calls onSetShowTripSummary(true)
        // TripSummaryModal is rendered here (lines 1644-1652)
        await stopTrackingUtil({
        selectedMotor,
        currentLocation: mapState.currentLocation,
        destination: mapState.destination,
        rideStats,
        routeCoordinates,
        snappedRouteCoordinates,
        startAddress,
        endAddress,
        tripMaintenanceActions,
        isBackgroundTracking: isBackgroundTracking.current,
        backgroundTrackingId: backgroundTrackingId.current,
        hasArrived: hasArrived, // Pass arrival status from useArrivalDetection
        onStopTracking: stopTracking,
        onResetTracking: resetTracking,
        onSetEndAddress: setEndAddress,
        onSetTripDataForModal: setTripDataForModal,
        onResetLastProcessedDistance: () => {
          lastProcessedDistanceRef.current = 0;
        },
        onSetScreenMode: setScreenMode,
        onSetShowTripSummary: setShowTripSummary, // Shows trip summary modal
        onCreateTripData: createTripDataForModal,
        });

        if (__DEV__) {
          console.log('[RouteSelection] ✅ Tracking stopped successfully', {
            timestamp: new Date().toISOString(),
          });
        }
      } catch (error: any) {
        if (__DEV__) {
          console.error('[RouteSelection] ❌ Failed to stop tracking', {
            error: error.message,
            timestamp: new Date().toISOString(),
          });
        }
        throw error;
      }
    }
  }, [
    isTracking,
    selectedMotor,
    mapState.currentLocation,
    mapState.destination,
    rideStats,
    routeCoordinates,
    snappedRouteCoordinates,
    startAddress,
    endAddress,
    tripMaintenanceActions,
    isDestinationFlowActive,
    startTracking,
    stopTracking,
    resetTracking,
    handleGetCurrentLocation,
    createTripDataForModal,
    hasArrived,
  ]);

  // REMOVED: Background tracking functions

  // REMOVED: Maintenance form management hook - moved earlier for use in useDestinationFlow

  const handleMotorSelectCallback = useCallback((motor: Motor) => {
    handleMotorSelect(motor);
    setShowMotorSelector(false);
    lastFuelWarningLevel.current = motor.currentFuelLevel; // Reset warning level
  }, [handleMotorSelect]);

  // Trip management functions are provided by useTripManagement hook
  
  // Toggle markers visibility - Hide all markers except user and destination markers
  // TAP: Toggles visibility (hides/shows all report and gas station markers)
  // LONG PRESS: Opens filter modal (handled by onLongPress in FreeDrive component)
  const toggleMarkersVisibility = useCallback(() => {
    setMapFilters(prev => {
      // Toggle showTrafficReports and showGasStations
      // When false, all report and gas station markers will be hidden
      // User marker and destination marker are always shown (controlled separately in OptimizedMapComponent)
      const newShowReports = !prev.showTrafficReports;
      const newShowGasStations = !prev.showGasStations;
      
      if (__DEV__) {
        console.log('[RouteSelection] 👁️ Toggling markers visibility', {
          showReports: newShowReports,
          showGasStations: newShowGasStations,
          timestamp: new Date().toISOString(),
        });
      }
      
      return {
        ...prev,
        showTrafficReports: newShowReports,
        showGasStations: newShowGasStations,
        // Keep user location and destination always visible
        showUserLocation: true,
        showDestination: true,
      };
    });
  }, []);

  // 3D navigation functionality has been removed

  // Handle filter changes - Force immediate update
  const handleFiltersChange = useCallback((newFilters: MapFilters) => {
    if (__DEV__) {
      console.log('[RouteSelection] 🔍 handleFiltersChange called', {
        newFilters,
        timestamp: new Date().toISOString(),
      });
    }

    // Update filters immediately
    setMapFilters(newFilters);

    // Force a re-render by updating a key or triggering state change
    // The OptimizedMapComponent will receive new mapFilters prop and re-render
    // The filteredGasStationMarkers and filteredReportMarkers will recalculate
    
    if (__DEV__) {
      console.log('[RouteSelection] ✅ Map filters updated, forcing marker refresh', {
        filters: newFilters,
        showOtherGasStations: newFilters.showOtherGasStations,
        showPetron: newFilters.showPetron,
        showShell: newFilters.showShell,
        showCaltex: newFilters.showCaltex,
        timestamp: new Date().toISOString(),
      });
    }
  }, []);

  // Fuel management hook - PARENT HANDLES: Fuel level modal logic
  // Manages fuel check flow, fuel confirmation, and backend updates
  // FuelCheckModal is rendered here (lines 1730-1746)
  const {
    showFuelCheckModal: showFuelCheckModalFromHook,
    showFuelUpdateModal: showFuelUpdateModalFromHook,
    fuelCheckStep,
    pendingFuelLevel,
    fuelUpdateValue,
    setShowFuelCheckModal: setShowFuelCheckModalFromHook,
    setShowFuelUpdateModal: setShowFuelUpdateModalFromHook,
    setFuelCheckStep,
    setPendingFuelLevel,
    setFuelUpdateValue,
    startFuelCheck,
    handleFuelConfirmation,
    handleLowFuelConfirmation,
    handleFuelUpdate,
    sliderTrackRef,
    sliderTrackLayoutRef,
    sliderPanResponder,
  } = useFuelManagement({
    selectedMotor,
    currentLocation: mapState.currentLocation,
    isTracking,
    isDestinationFlowActive,
    startTracking,
    handleGetCurrentLocation,
    setStartAddress,
    setTripDataForModal,
    setScreenMode,
    setSelectedMotor,
    lastProcessedDistanceRef,
    userManuallyPannedRef,
    manualPanTimeoutRef,
    onClearDestination: () => {
      // Clear destination for Free Drive to prevent "Find the best routes" modal
      setDestination(null);
    },
    onResetDestinationFlow: () => {
      // Reset destination flow state for Free Drive
      resetDestinationFlow();
    },
  });


  // memoizedRefreshData is provided by useReportChecking hook


  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <SafeAreaProvider>
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.container}>
              {/* WithDestination Component - Handles all destination navigation UI
              
              NOTE: Only render when in destination flow to prevent UI overlap with FreeDrive
              */}
              {isDestinationFlowActive && (
                <WithDestination
                selectedMotor={selectedMotor}
                currentLocation={mapState.currentLocation}
                destination={mapState.destination}
                selectedRoute={selectedRoute}
                alternativeRoutes={alternativeRoutes}
                isNavigating={navigationState.isNavigating}
                distanceRemaining={navigationState.distanceRemaining}
                timeElapsed={navigationState.timeElapsed}
                currentEta={(() => {
                  // Convert ETA string to seconds for WithDestination component
                  // WithDestination expects number (seconds) and uses formatTime()
                  if (typeof navigationState.currentEta === 'number') {
                    return navigationState.currentEta;
                  }
                  if (typeof navigationState.currentEta === 'string' && navigationState.currentEta) {
                    // Parse string like "5m" or "1h 30m" to seconds
                    const hoursMatch = navigationState.currentEta.match(/(\d+)h/);
                    const minutesMatch = navigationState.currentEta.match(/(\d+)m/);
                    const hours = hoursMatch ? parseInt(hoursMatch[1], 10) : 0;
                    const minutes = minutesMatch ? parseInt(minutesMatch[1], 10) : 0;
                    return (hours * 3600) + (minutes * 60);
                  }
                  return 0;
                })()}
                currentSpeed={navigationState.currentSpeed}
                distanceTraveled={distanceTraveled}
                onSelectMotor={handleMotorSelect}
                onSelectDestination={setDestination}
                onSelectRoute={(route: RouteData) => {
                  // Convert RouteData to ID and call handleRouteSelect
                  if (route?.id) {
                    handleRouteSelect(route.id);
                  }
                }}
                onSelectDestinationPress={() => {
                  // Open search modal for destination selection
                  handleRouteButtonPress();
                }}
                onSelectFromMapPress={() => {
                  // Activate destination flow if not already active
                  if (!isDestinationFlowActive) {
                    handleRouteButtonPress();
                  }
                  // CRITICAL: Use centralized startMapSelection function
                  // This ensures state is set synchronously for immediate access
                  startMapSelection();
                }}
                onCancel={() => {
                  // Cancel destination flow and return to original state
                  cancelDestinationFlow();
                }}
                currentFlowState={getCurrentFlowState()}
                onGetRoutes={() => fetchRoutes()}
                isRoutesLoading={destinationFlow?.destinationFlowState?.asyncLoading?.routes || false}
                isMapSelectionActive={isMapSelectionActive || mapSelectionState.isSelecting || uiState.isMapSelectionMode}
                onStartNavigation={() => {
                  if (selectedRoute) {
                    // Start navigation with selected route
                    setSelectedRoute(selectedRoute);
                    setSelectedRouteId(selectedRoute.id);
                    
                    // Set navigation state
                    setIsNavigating(true);
                    setNavigationStartTime(Date.now());
                    setIsFollowingUser(true);
                    
                    // Update destination flow state
                    startNavigationFlow();
                    
                    // Start destination-specific tracking (NOT free drive tracking)
                    startDestinationTracking();
                    
                    Toast.show({
                      type: 'success',
                      text1: 'Navigation Started',
                      text2: 'Following route to destination',
                    });
                  }
                }}
                onStopNavigation={async (hasArrivedFromComponent?: boolean) => {
                  // Stop tracking when navigation stops (for destination flow)
                  // hasArrivedFromComponent: true = user reached destination (automatic stop)
                  // hasArrivedFromComponent: false = user manually stopped (did not reach destination)
                  // hasArrivedFromComponent: undefined = fallback to useArrivalDetection hook value
                  
                  // Determine final arrival status
                  // Priority: 1. Component parameter, 2. useArrivalDetection hook value
                  const finalHasArrived = hasArrivedFromComponent !== undefined 
                    ? hasArrivedFromComponent 
                    : hasArrived;
                  
                  // Always create trip data and show modal, regardless of isTracking status
                  // This ensures trip summary appears on first stop and subsequent stops
                  try {
                    // If tracking is active, use stopTrackingUtil (handles full tracking stop)
                    if (isTracking) {
                      await stopTrackingUtil({
                        selectedMotor,
                        currentLocation: mapState.currentLocation,
                        destination: mapState.destination,
                        rideStats,
                        routeCoordinates,
                        snappedRouteCoordinates,
                        startAddress,
                        endAddress,
                        tripMaintenanceActions,
                        isBackgroundTracking: isBackgroundTracking.current,
                        backgroundTrackingId: backgroundTrackingId.current,
                        hasArrived: finalHasArrived, // Use final arrival status
                        onStopTracking: stopTracking,
                        onResetTracking: resetTracking,
                        onSetEndAddress: setEndAddress,
                        onSetTripDataForModal: setTripDataForModal,
                        onResetLastProcessedDistance: () => {
                          lastProcessedDistanceRef.current = 0;
                        },
                        onSetScreenMode: setScreenMode,
                        onSetShowTripSummary: setShowTripSummary,
                        onCreateTripData: createTripDataForModal,
                      });
                    } else {
                      // If not tracking, still create trip data for destination-based navigation
                      // This handles the case where navigation stops before tracking starts
                      console.log('[RouteSelection] Creating trip data for non-tracking navigation stop');
                      
                      // Get end address if not already set
                      let resolvedEndAddress = endAddress;
                      if (!endAddress && mapState.currentLocation) {
                        try {
                          const { reverseGeocodeLocation } = await import('../../utils/location');
                          const address = await reverseGeocodeLocation(mapState.currentLocation);
                          resolvedEndAddress = address;
                          setEndAddress(address);
                        } catch (error) {
                          console.warn('[RouteSelection] Failed to get end address:', error);
                          resolvedEndAddress = 'Unknown Location';
                          setEndAddress('Unknown Location');
                        }
                      }
                      
                      // Create trip data using the same function
                      // Pass the resolved end address directly to avoid React state timing issues
                      const tripEndTime = new Date();
                      const tripData = createTripDataForModal(tripEndTime, finalHasArrived, resolvedEndAddress);
                      setTripDataForModal(tripData);
                      
                      // Update screen mode and show trip summary
                      setScreenMode('summary');
                      setShowTripSummary(true);
                    }
                  } catch (error: any) {
                    console.error('[RouteSelection] Failed to stop tracking on navigation stop:', error);
                    
                    // Fallback: Create minimal trip data even if there's an error
                    try {
                      const tripEndTime = new Date();
                      const tripData = createTripDataForModal(tripEndTime, finalHasArrived);
                      setTripDataForModal(tripData);
                      setShowTripSummary(true);
                    } catch (fallbackError) {
                      console.error('[RouteSelection] Failed to create fallback trip data:', fallbackError);
                    }
                  }
                  
                  // Always update navigation state, regardless of tracking status
                  setIsNavigating(false);
                  setNavigationStartTime(null);
                  setIsFollowingUser(false);
                  completeNavigationFlow();
                  
                  // Reset arrival state
                  resetArrival();
                  
                  // Ensure trip summary modal is shown (backup in case stopTrackingUtil didn't show it)
                  if (!showTripSummary) {
                    updateUiState({ showTripSummary: true });
                  }
                }}
                onReroute={() => fetchRoutes()}
                onMaintenanceAction={handleMaintenanceAction}
                motorList={effectiveMotors as Motor[]}
                mapFilters={mapFilters}
                onToggleMarkersVisibility={toggleMarkersVisibility}
                onShowFilterModal={() => openFilterModal()}
              />
              )}

              {/* Flow State Indicator - Only show when user is in navigation flow */}
              {/* Flow State Indicator - Only show when in destination flow AND not tracking */}
              {!isTracking && isDestinationFlowActive && (() => {
                const flowStateProps = renderFlowStateIndicator(() => {
                  cancelDestinationFlow();
                  Toast.show({
                    type: 'info',
                    text1: 'Trip Cancelled',
                    text2: 'Destination selection cancelled',
                  });
                });
                return flowStateProps ? <FlowStateIndicator {...flowStateProps} /> : null;
              })()}

              {/* Loading Indicators */}
              {renderLoadingIndicators().map((indicator) => (
                <View key={indicator.key} style={styles.loadingOverlay}>
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#00ADB5" />
                    <Text style={styles.loadingText}>
                      {indicator.message}
                    </Text>
                  </View>
                </View>
              ))}

              {/* Error Handling */}
              {renderErrorHandling(() => fetchRoutes(), () => cancelDestinationFlow()).map((error) => (
                <View key={error.key} style={styles.errorOverlay}>
                  <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>{error.message}</Text>
                    <View style={styles.errorButtons}>
                      <TouchableOpacity style={styles.retryButton} onPress={error.onRetry}>
                        <Text style={styles.retryButtonText}>Retry</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.cancelButton} onPress={error.onCancel}>
                        <Text style={styles.cancelButtonText}>Cancel</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ))}

              {/* Destination Display - Only show when in destination flow AND not tracking */}
              {!isTracking && (() => {
                const props = renderDestinationDisplay(
                  mapState.destination,
                  () => { updateUiState({ showSearchModal: true }); },
                  () => fetchRoutes(),
                  false // isRoutesLoading
                );
                return props ? null : null; // Component will be rendered elsewhere if needed
              })()}

              {/* Route Selection Display */}
              {(() => {
                const props = renderRouteSelectionDisplay(
                  navigationState.isNavigating,
                  () => { updateUiState({ isMapSelectionMode: false }); }
                );
                return props ? null : null; // Component will be rendered elsewhere if needed
              })()}

              {/* Free Drive Component - PRESENTATION LAYER ONLY
              
              PARENT (RouteSelectionScreenOptimized) HANDLES ALL LOGIC:
              
              1. Fuel Level Modal Logic:
                 - onStartFuelCheck -> startFuelCheck() -> useFuelManagement hook
                 - FuelCheckModal rendered here (lines 1730-1746)
                 - Backend updates via handleFuelConfirmation -> fuelCheckUtils -> updateFuelLevel API
              
              2. Map Tilt on Start:
                 - Handled via mapPitch state (lines 920-931)
                 - Sets mapPitch to 45 degrees when isTracking && !isDestinationFlowActive
                 - Passed to OptimizedMapComponent as mapPitch prop
              
              3. Trip Summary Modal on Stop:
                 - onStopTracking -> handleTrackingToggle() -> stopTrackingUtil
                 - stopTrackingUtil calls onSetShowTripSummary(true) -> setShowTripSummary(true)
                 - TripSummaryModal rendered here (lines 1644-1652)
              
              4. Backend Updates for Maintenance Actions:
                 - onMaintenanceAction -> handleMaintenanceAction -> openMaintenanceForm
                 - useMaintenanceForm hook -> handleMaintenanceFormSave
                 - maintenanceUtils -> saveMaintenanceRecord -> Backend API
                 - Motor state updated via setSelectedMotor after refuel
              
              NOTE: Only render when NOT in destination flow to prevent UI overlap
              Hide when in destination flow to allow clear destination selection and route review
              */}
              {!isDestinationFlowActive && (
                <FreeDrive
                isTracking={isTracking}
                rideStats={rideStats}
                selectedMotor={selectedMotor}
                currentLocation={mapState.currentLocation}
                motorList={effectiveMotors as Motor[]}
                onShowMotorSelector={() => openMotorSelector()}
                onStartTracking={() => handleTrackingToggle()}
                onStopTracking={() => handleTrackingToggle()}
                onStatsUpdate={handleStatsUpdate}
                onFuelUpdate={(newFuelLevel) => {
                  // Update local motor state (backend update handled by fuel check confirmation)
                  if (selectedMotor) {
                    setSelectedMotor({ ...selectedMotor, currentFuelLevel: newFuelLevel });
                  }
                }}
                onMaintenanceAction={handleMaintenanceAction} // Opens maintenance form -> backend update via useMaintenanceForm
                onSelectMotor={handleMotorSelect}
                onStartFuelCheck={() => startFuelCheck()} // Opens fuel check modal -> backend update via useFuelManagement
                onShowReportModal={() => {
                  if (reportingRef.current) {
                    reportingRef.current.openReportModal();
                  }
                }}
                onShowRouteButton={() => {
                  // Navigate to route selection or show route modal
                  handleRouteButtonPress();
                }}
                onToggleMarkersVisibility={toggleMarkersVisibility}
                onShowFilterModal={() => openFilterModal()}
                showMarkers={mapFilters?.showTrafficReports ?? true}
                navigation={navigation}
                hideActionButtons={false} // Not needed since component is conditionally rendered
                hideFloatingButtons={false} // Not needed since component is conditionally rendered
              />
              )}
              
              {/* Development: Fuel Simulator Button */}
              {__DEV__ && !isDestinationFlowActive && (
                <TouchableOpacity
                  style={{
                    position: 'absolute',
                    top: 100,
                    right: 16,
                    backgroundColor: '#9C27B0',
                    width: 56,
                    height: 56,
                    borderRadius: 28,
                    justifyContent: 'center',
                    alignItems: 'center',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.25,
                    shadowRadius: 3.84,
                    elevation: 5,
                    zIndex: 2000,
                  }}
                  onPress={() => setShowFuelSimulator(true)}
                >
                  <MaterialIcons name="science" size={24} color="#FFF" />
                </TouchableOpacity>
              )}

              {/* Reporting Component - Handles traffic reports and gas stations */}
              <Reporting
                ref={reportingRef}
                user={user}
                currentLocation={mapState.currentLocation}
                showReports={mapFilters?.showTrafficReports ?? true}
                showGasStations={mapFilters?.showGasStations ?? true}
                reports={effectiveReports}
                gasStations={effectiveGasStations}
                onReportSubmit={memoizedRefreshData}
                onReportVote={(reportId: string, vote: 'up' | 'down') => {
                  // Handle report voting
                  console.log('[RouteSelection] Report vote:', reportId, vote);
                }}
                onGasStationSelect={(station: any) => {
                  // Handle gas station selection
                  console.log('[RouteSelection] Gas station selected:', station);
                }}
              />

              {/* Tracking Stats - Show at top when tracking in free drive mode */}
              {!isDestinationFlowActive && isTracking && (
                <TrackingStats
                  rideStats={rideStats}
                  isVisible={isTracking}
                  selectedMotor={selectedMotor}
                />
              )}

              {/* Optimized Map Component - Handles map rendering and interactions */}
              {/* CRITICAL: Only update when screen is focused - prevents updates when switching tabs */}
              {/* CRITICAL: Key prop forces re-render when filters change to apply filter changes immediately */}
              {isFocused && (
                <OptimizedMapComponent
                  key={`map-filters-${mapFilters?.showOtherGasStations}-${mapFilters?.showPetron}-${mapFilters?.showShell}-${mapFilters?.showCaltex}-${mapFilters?.showTrafficReports}`}
                  mapRef={mapRef}
                  region={mapState?.region ?? null}
                  mapStyle="standard"
                  currentLocation={mapState?.currentLocation ?? null}
                  destination={mapState?.destination ?? null}
                  userId={user?._id}
                  reportMarkers={effectiveReports}
                  gasStations={effectiveGasStations}
                  showReports={mapFilters?.showTrafficReports ?? true}
                  showGasStations={mapFilters?.showGasStations ?? true}
                  routeCoordinates={selectedRoute?.coordinates || []}
                  snappedRouteCoordinates={snappedRouteCoordinates}
                  alternativeRoutes={alternativeRoutes}
                  selectedRouteId={selectedRouteId}
                  onSelectRoute={handleRouteSelect}
                  isTracking={isTracking}
                  onReportVoted={memoizedRefreshData}
                  onMapPress={handleMapPress}
                  selectedMapLocation={mapSelectionState.selectedLocation}
                  isMapSelectionMode={isMapSelectionActive || mapSelectionState.isSelecting || uiState.isMapSelectionMode}
                  mapFilters={mapFilters}
                  onRegionChange={handleManualPan}
                  onRegionChangeComplete={handleManualPan}
                  isFocused={isFocused}
                  mapPitch={mapPitch}
                />
              )}
              {/* Fallback: Show empty view when not focused to maintain layout */}
              {!isFocused && <View style={{ flex: 1 }} />}

              {/* Motor Selector Modal */}
              <MotorSelector
                visible={showMotorSelector}
                motors={effectiveMotors as Motor[]}
                selectedMotor={selectedMotor}
                isTracking={isTracking}
                onSelectMotor={handleMotorSelectCallback}
                onClose={() => closeMotorSelector()}
              />

              {/* Trip Summary Modal */}
              <TripSummaryModal
                visible={showTripSummary}
                tripData={tripDataForModal}
                rideStats={rideStats}
                selectedMotor={selectedMotor}
                startAddress={startAddress}
                endAddress={endAddress}
                tripMaintenanceActions={tripMaintenanceActions}
                onClose={memoizedHandleTripClose}
                onSave={handleTripSave}
                onCancel={handleTripCancel}
              />

              {/* Trip Recovery Modal */}
              <TripRecoveryModal
                visible={showTripRecovery}
                tripData={currentTrip}
                onRecover={handleRecoverTrip}
                onDiscard={handleDiscardTrip}
                onClose={() => closeTripRecovery()}
              />

              {/* Search Modal */}
              <SearchModal
                visible={uiState.showSearchModal && !uiState.isMapSelectionMode}
                searchText={searchText}
                setSearchText={setSearchText}
                onClose={handleSearchModalClose}
                onDestinationSelect={handleDestinationSelect}
                searchRef={searchRef}
                isTyping={isTyping}
                setIsTyping={setIsTyping}
                animateToRegion={setRegion}
                selectedMotor={selectedMotor}
                onMotorSelect={handleMotorSelect}
                motorList={effectiveMotors as Motor[]}
                onPlaceSelectedCloseModal={handleSearchModalClose}
                userId={user?._id}
                onMapSelection={() => {
                  // Activate destination flow if not already active
                  if (!isDestinationFlowActive) {
                    handleRouteButtonPress();
                  }
                  // CRITICAL: Use centralized startMapSelection function
                  // This ensures state is set synchronously for immediate access
                  startMapSelection();
                }}
              />

              {/* Route Selection Modal */}
              <RouteSelectionModal
                visible={false}
                bestRoute={selectedRoute}
                alternatives={alternativeRoutes}
                selectedRouteId={selectedRouteId}
                onSelectRoute={handleRouteSelect}
                selectedMotor={selectedMotor}
                isNavigating={navigationState.isNavigating}
                onClose={() => {}}
              />

              {/* Maintenance Modal */}
              <MaintenanceModal
                visible={maintenanceFormVisibleFromHook}
                formData={maintenanceFormData}
                onChange={handleMaintenanceFormChange}
                onSave={handleMaintenanceFormSave}
                onClose={() => closeMaintenanceForm()}
              />

              {/* Trip Details Modal */}
              <TripDetailsModal
                visible={uiState.showTripDetails}
                currentSpeed={navigationState.currentSpeed}
                distanceRemaining={navigationState.distanceRemaining}
                timeElapsed={navigationState.timeElapsed}
                currentEta={navigationState.currentEta || null}
                currentFuel={selectedMotor?.currentFuelLevel || 0}
                currentFuelUsed={navigationState.currentFuelUsed}
                isOverSpeedLimit={navigationState.isOverSpeedLimit}
                selectedRoute={selectedRoute}
                selectedMotor={selectedMotor}
                distanceTraveled={distanceTraveled}
                onClose={() => updateUiState({ showTripDetails: false })}
              />

              {/* Map Filter Modal */}
              <MapFilterModal
                visible={showFilterModal}
                filters={mapFilters}
                onFiltersChange={handleFiltersChange}
                onClose={() => closeFilterModal()}
              />

              {/* Fuel Check Modal */}
              <FuelCheckModal
                visible={showFuelCheckModalFromHook}
                fuelCheckStep={fuelCheckStep === 'confirmation' ? 'confirmation' : fuelCheckStep === 'low_fuel' ? 'low_fuel' : null}
                pendingFuelLevel={pendingFuelLevel}
                currentFuelLevel={selectedMotor?.currentFuelLevel}
                onConfirm={(fuelLevel) => {
                  // Update pending fuel level if slider was changed
                  if (fuelLevel !== undefined && fuelLevel !== pendingFuelLevel) {
                    setPendingFuelLevel(fuelLevel);
                  }
                  // Pass the fuel level from slider to handleFuelConfirmation
                  handleFuelConfirmation(true, fuelLevel);
                }}
                onLowFuelContinue={() => handleLowFuelConfirmation(true)}
                onCancel={() => setShowFuelCheckModalFromHook(false)}
              />

              {/* Fuel Update Simulator Panel (Development Only) */}
              {__DEV__ && (
                <FuelUpdateSimulatorPanel
                  visible={showFuelSimulator}
                  onClose={() => setShowFuelSimulator(false)}
                  selectedMotor={selectedMotor}
                  currentLocation={mapState.currentLocation}
                  onFuelUpdate={(newFuelLevel, lowFuelWarning) => {
                    // Update motor fuel level from simulator
                    if (selectedMotor) {
                      setSelectedMotor({
                        ...selectedMotor,
                        currentFuelLevel: newFuelLevel,
                      });
                      
                      if (lowFuelWarning) {
                        Toast.show({
                          type: 'error',
                          text1: 'Low Fuel Warning',
                          text2: `Fuel level is at ${newFuelLevel.toFixed(1)}%. Please refuel soon.`,
                          visibilityTime: 5000,
                        });
                      }
                    }
                  }}
                />
              )}

              {/* Gas Price Update Modal */}
              <GasPriceUpdateModal
                visible={showGasPriceUpdateModal}
                station={selectedGasStationForPriceUpdate}
                onClose={() => {
                  setShowGasPriceUpdateModal(false);
                  setSelectedGasStationForPriceUpdate(null);
                }}
                onPriceUpdated={(updatedStation) => {
                  // Update gas station in local state if needed
                  if (updatedStation && setLocalGasStations) {
                    setLocalGasStations((prev: any[]) => {
                      return prev.map((station: any) =>
                        station._id === updatedStation._id ? updatedStation : station
                      );
                    });
                  }
                  // Close modal
                  setShowGasPriceUpdateModal(false);
                  setSelectedGasStationForPriceUpdate(null);
                }}
              />

              {/* Fuel Update Modal */}
              <FuelUpdateModal
                visible={showFuelUpdateModalFromHook}
                currentFuelLevel={selectedMotor?.currentFuelLevel || 0}
                fuelUpdateValue={fuelUpdateValue}
                sliderTrackRef={sliderTrackRef}
                sliderPanResponder={sliderPanResponder}
                sliderTrackLayoutRef={sliderTrackLayoutRef}
                onUpdate={handleFuelUpdate}
                onCancel={() => setShowFuelUpdateModalFromHook(false)}
              />

              {/* Map Selection Overlay */}
              <MapSelectionOverlay
                visible={isMapSelectionActive || mapSelectionState.isSelecting}
                selectedLocation={mapSelectionState.selectedLocation}
                onConfirm={confirmMapSelectionWithFlowUpdateWrapper}
                onCancel={stopMapSelection}
                onClear={() => {
                  setMapSelectionState({ selectedLocation: null, isSelecting: false });
                  setIsMapSelectionActive(false);
                }}
              />

              {/* Location Button - Get current location and zoom in */}
              {/* Hide when in destination flow to allow clear destination selection and route review */}
              {!isDestinationFlowActive && (
                <TouchableOpacity
                  style={[
                    styles.fabLocate,
                    (!locationPermissionGranted || isGettingLocation) && styles.fabLocateDisabled
                  ]}
                  onPress={() => {
                    handleGetCurrentLocation(true, true).then((location) => {
                      if (location && mapRef?.current) {
                        // Zoom in to current location
                        mapRef.current.animateToRegion({
                          latitude: location.latitude,
                          longitude: location.longitude,
                          latitudeDelta: 0.005, // Zoomed in view
                          longitudeDelta: 0.005,
                        }, 500);
                      }
                    }).catch((error) => {
                      if (__DEV__) {
                        console.error('[RouteSelection] Failed to get location:', error);
                      }
                    });
                  }}
                  disabled={isGettingLocation}
                >
                  <MaterialIcons 
                    name="my-location" 
                    size={24} 
                    color={isGettingLocation ? "#999" : "#00ADB5"} 
                  />
                </TouchableOpacity>
              )}
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  });

export default RouteSelectionScreen;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F2EEEE',
  },
  container: {
    flex: 1,
  },
  floatingButtonsContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
  },
  rightButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  motorButton: {
    height: height * 0.12,
    width: width * 0.28,
    borderRadius: 12,
    padding: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  motorButtonText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 4,
  },
  motorStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  motorStatsText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  playButton: {
    width: width * 0.2,
    height: width * 0.2,
    borderRadius: width * 0.1,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  smallButtonsContainer: {
    alignItems: 'center',
    gap: 8,
  },
  smallButtonsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  smallButton: {
    width: width * 0.12,
    height: width * 0.12,
    borderRadius: width * 0.06,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  reportButton: {
    backgroundColor: '#FF5722',
  },
  routeButton: {
    backgroundColor: '#FFF',
  },
  maintenanceButton: {
    backgroundColor: '#00ADB5',
  },
  // Maintenance Form Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  formModal: {
    width: '90%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    elevation: 5,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  notesInput: {
    height: 100,
    textAlignVertical: 'top',
  },
  formButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  formButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    marginHorizontal: 8,
  },
  saveButton: {
    backgroundColor: '#00ADB5',
  },
  saveButtonText: {
    color: '#fff',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  logoContainer: {
    alignItems: 'center',
  },
  logoText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#00ADB5',
  },
  
  // Input styles
  inputDisabled: {
    backgroundColor: '#f5f5f5',
    color: '#999',
  },
  calculatedQuantityContainer: {
    backgroundColor: '#E3F2FD',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2196F3',
  },
  calculatedQuantityText: {
    fontSize: 18,
    color: '#2196F3',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  calculatedQuantitySubtext: {
    fontSize: 12,
    color: '#1976D2',
    textAlign: 'center',
    marginTop: 4,
    fontStyle: 'italic',
  },
  fabNetwork: {
    position: 'absolute',
    left: 16,
    top: 60,
    height: 44,
    width: 44,
    borderRadius: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  fabNetworkTouchable: {
    height: 44,
    width: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  networkErrorIndicator: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#FF1744',
    borderRadius: 8,
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  fabLocate: {
    position: 'absolute',
    right: 16,
    bottom: 140,
    height: 44,
    width: 44,
    borderRadius: 22,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  fabLocateDisabled: {
    opacity: 0.6,
  },
  fabRefresh: {
    position: 'absolute',
    right: 16,
    bottom: 200,
    height: 40,
    width: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  speedometerContainer: {
    position: 'absolute',
    top: 160,
    right: 16,
    zIndex: 1000,
  },
  // Navigation flow styles
  destinationSelectionContainer: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
    zIndex: 100,
  },
  destinationSelectionButton: {
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  destinationSelectionGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  destinationSelectionText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 12,
    marginRight: 8,
  },
  destinationHeader: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  destinationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  destinationContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  destinationText: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    marginLeft: 8,
  },
  getRoutesButton: {
    marginTop: 12,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  getRoutesGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  getRoutesText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 8,
  },
  routeSelectionContainer: {
    position: 'absolute',
    bottom: 100,
    left: 16,
    right: 16,
    flexDirection: 'row',
    zIndex: 1000,
  },
  showRoutesButton: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  showRoutesGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  showRoutesText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  buttonSpacer: {
    width: 12,
  },
  navigationButton: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  navigationGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  navigationButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  // Loading and Error Styles
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  loadingContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  loadingSubtext: {
    marginTop: 8,
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  errorOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  errorContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    margin: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    minWidth: 300,
  },
  errorText: {
    marginTop: 12,
    marginBottom: 16,
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
  },
  errorButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    gap: 12,
  },
  retryButton: {
    backgroundColor: '#00ADB5',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    flex: 1,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  cancelButton: {
    backgroundColor: '#f5f5f5',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    flex: 1,
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  // Navigation start button styles
  navigationStartButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  navigationStartButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  filterIndicator: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#FF5722',
    borderRadius: 8,
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  // Destination arrival indicator styles
  arrivalIndicator: {
    position: 'absolute',
    top: 120,
    left: 16,
    right: 16,
    zIndex: 1000,
  },
  arrivalContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  arrivalText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  // Rerouting indicator styles
  reroutingIndicator: {
    position: 'absolute',
    top: 100,
    left: 16,
    right: 16,
    zIndex: 1000,
  },
  reroutingContainer: {
    backgroundColor: '#FF6B6B',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  reroutingText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  // Fuel check modal styles
  fuelCheckModal: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    margin: 20,
    minWidth: 300,
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  fuelCheckHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  fuelCheckTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 12,
  },
  fuelCheckText: {
    fontSize: 16,
    color: '#555',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 22,
  },
  fuelLevelText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FF9800',
    textAlign: 'center',
    marginBottom: 24,
  },
  fuelCheckButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  fuelCheckButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  fuelCheckButtonYes: {
    backgroundColor: '#4CAF50',
  },
  fuelCheckButtonNo: {
    backgroundColor: '#FF5722',
  },
  fuelCheckButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  // Fuel update modal styles
  fuelUpdateModal: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    margin: 20,
    minWidth: 300,
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  fuelUpdateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  fuelUpdateTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 12,
  },
  fuelUpdateText: {
    fontSize: 16,
    color: '#555',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22,
  },
  fuelUpdateInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    backgroundColor: '#f9f9f9',
  },
  fuelUpdateButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  fuelUpdateButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  fuelUpdateButtonSave: {
    backgroundColor: '#2196F3',
  },
  fuelUpdateButtonCancel: {
    backgroundColor: '#E0E0E0',
  },
  fuelUpdateButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  // Slider styles
  sliderContainer: {
    marginVertical: 24,
    paddingHorizontal: 8,
  },
  sliderTrack: {
    position: 'relative',
    width: '100%',
    height: 8,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    overflow: 'visible',
    marginBottom: 16,
  },
  sliderFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    height: '100%',
    borderRadius: 4,
    zIndex: 1,
  },
  sliderThumb: {
    position: 'absolute',
    top: -8,
    width: 24,
    height: 24,
    borderRadius: 12,
    zIndex: 2,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  sliderThumbInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#fff',
  },
  sliderValueContainer: {
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 16,
  },
  sliderValueText: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  
  // REMOVED: All 3D Navigation Control Panel Styles, Elevation Controls Styles, and Camera Controls Styles
});


