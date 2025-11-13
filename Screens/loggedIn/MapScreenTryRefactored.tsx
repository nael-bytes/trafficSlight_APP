import React, { useState, useCallback, useEffect, useMemo, memo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import MaterialIcons from "react-native-vector-icons/MaterialIcons";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { LinearGradient } from 'expo-linear-gradient';
import Toast from 'react-native-toast-message';

import { useUser } from "../../AuthContext/UserContextImproved";
import { getCurrentLocationWithCache } from "../../utils/locationCache";
import { startBackgroundLocationTracking, stopBackgroundLocationTracking } from "../../utils/backgroundLocation";
import { backgroundStateManager } from "../../utils/backgroundStateManager";
import { apiRequest } from '../../utils/api';

// Import custom hooks
import { useMapState } from '../../hooks/useMapState-mapscreentry';
import { useRouteHandling } from '../../hooks/useRouteHandling-mapscreentry';
import { useMotorManagement } from '../../hooks/useMotorManagement-mapscreentry';

// Import components
import { OptimizedMapComponent } from '../../Maps/components/OptimizedMapComponent';
import { SearchModal } from '../../components/SearchModal-mapscreentry';
import { RouteSelectionModal } from '../../components/RouteSelectionModal-mapscreentry';
import { NavigationControls } from '../../components/NavigationControls-mapscreentry';
import { FlowStateIndicator } from '../../components/FlowStateIndicator-mapscreentry';
import { MaintenanceModal } from '../../components/MaintenanceModal-mapscreentry';
import { TripDetailsModal } from '../../components/TripDetailsModal-mapscreentry';
import { TripSummaryModal } from '../../components/TripSummaryModal-mapscreentry';

// Import optimized modules
import { useMapSelectionHandlers, reverseGeocodeLocation } from '../../utils/map-selection-handlers-mapscreentry';
import { useMaintenanceHandlers } from '../../utils/maintenance-handlers-mapscreentry';
import { isUserOffRoute, getTrafficLabel } from '../../utils/map-utils-mapscreentry';
import { fetchRoutesAsync, geocodeAddressAsync, reverseGeocodeAsync, createDebouncedRouteFetcher } from '../../utils/asyncMapOperations';
import { runAsyncOperation, scheduleUIUpdate } from '../../utils/asyncOperations';
import polyline from '@mapbox/polyline';

// Import types
import type { LocationCoords, RouteData, TripSummary, TrafficIncident } from '../../types';

// Utility function to calculate distance between two coordinates (in meters)
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c; // Distance in meters
};

type FlowState = 'initial' | 'searching' | 'destination_selected' | 'routes_found' | 'navigating' | 'completed';

const MapScreenTryRefactored = memo(function MapScreenTryRefactored({ navigation }: { navigation: any }) {
  // Get user once to avoid multiple calls
  const { user } = useUser();
  
  // Mounted ref to prevent navigation after unmount
  const isMountedRef = useRef(true);
  
  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);
  
  // Custom hooks
  const {
    mapState,
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
  } = useMapState();

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
    loading,
    handleMotorSelect,
  } = useMotorManagement(user?._id);

  // Additional state for flow management
  const [currentFlowState, setCurrentFlowState] = useState<FlowState>('initial');

  // Async route fetching wrapper
  const fetchRoutes = useCallback(async () => {
    if (!mapState.currentLocation || !mapState.destination || !selectedMotor) {
      if (__DEV__) {
      console.log("Missing required data for route fetching:", {
        hasCurrentLocation: !!mapState.currentLocation,
        hasDestination: !!mapState.destination,
        hasSelectedMotor: !!selectedMotor
      });
      }
      return;
    }

    setAsyncLoading(prev => ({ ...prev, routes: true }));
    setAsyncErrors(prev => ({ ...prev, routes: null }));

    try {
      const result = await runAsyncOperation(async () => {
        return await fetchRoutesAsync(mapState.currentLocation!, mapState.destination!, {
          alternatives: true,
          departureTime: 'now',
          trafficModel: 'best_guess',
          avoid: ['tolls'],
        });
      }, {
        priority: 'high',
        timeout: 30000, // Increased to 30s to handle slow networks and Google Maps API delays
        retries: 2,
      });

      if (result.success && result.data) {
        const rawRoutes = result.data;
        
        // Process routes to match RouteData interface
        const processedRoutes = rawRoutes.map((route: any, index: number) => {
          try {
            const leg = route.legs?.[0];
            if (!leg) {
              if (__DEV__) {
              console.warn(`Route ${index} has no legs, skipping`);
              }
              return null;
            }

            const fuel = selectedMotor ? (leg.distance?.value / 1000 / selectedMotor.fuelEfficiency) : 0;
            
            // Calculate traffic rate
            const getTrafficRateFromLeg = (leg: any): number => {
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
            };
            
            // Safe polyline decoding
            let coordinates: LocationCoords[] = [];
            try {
              if (route.overview_polyline?.points) {
                coordinates = polyline.decode(route.overview_polyline.points).map(([lat, lng]: [number, number]) => ({
                  latitude: lat,
                  longitude: lng,
                }));
              }
            } catch (polylineError) {
              if (__DEV__) {
              console.warn(`Failed to decode polyline for route ${index}:`, polylineError);
              }
              coordinates = [];
            }
            
            return {
              id: `route-${index}`,
              distance: (leg.distance?.value || 0) / 1000, // Convert meters to kilometers
              duration: leg.duration?.value || 0,
              fuelEstimate: fuel,
              trafficRate: getTrafficRateFromLeg(leg),
              coordinates,
              instructions: leg.steps?.map((step: any) =>
                step.html_instructions?.replace(/<[^>]*>/g, "") || ""
              ) || [],
            };
          } catch (error) {
            if (__DEV__) {
            console.error(`Error processing route ${index}:`, error);
            }
            return null;
          }
        }).filter(Boolean); // Remove null routes
        
        // Update state asynchronously
        scheduleUIUpdate(() => {
          if (processedRoutes.length > 0) {
            const mainRoute = processedRoutes[0];
            const alternatives = processedRoutes.slice(1);
            
            // Set the main route as trip summary and selected route
            setTripSummary(mainRoute);
            setSelectedRoute(mainRoute);
            setSelectedRouteId(mainRoute.id);
            setAlternativeRoutes(alternatives);
            
            setCurrentFlowState('routes_found');
            // Open the bottom sheet to show routes
            updateUiState({ showBottomSheet: true });
          } else {
            if (__DEV__) {
            console.warn('No valid routes processed');
            }
            setAsyncErrors(prev => ({ ...prev, routes: 'No valid routes found' }));
          }
        });

        if (__DEV__) {
        console.log(`[MapScreen] Fetched ${processedRoutes.length} routes asynchronously`);
        console.log('[MapScreen] Processed routes data:', processedRoutes);
        console.log('[MapScreen] Main route:', processedRoutes[0]);
        console.log('[MapScreen] Alternatives:', processedRoutes.slice(1));
        }
      } else {
        throw new Error(result.error?.message || 'Failed to fetch routes');
      }
    } catch (error) {
      if (__DEV__) {
      console.error('[MapScreen] Route fetching failed:', error);
      }
      setAsyncErrors(prev => ({ ...prev, routes: error.message || 'Failed to fetch routes' }));
      
      Toast.show({
        type: 'error',
        text1: 'Route Error',
        text2: 'Failed to fetch routes. Please try again.',
      });
    } finally {
      setAsyncLoading(prev => ({ ...prev, routes: false }));
    }
  }, [mapState.currentLocation, mapState.destination, selectedMotor, setAlternativeRoutes, setSelectedRoute, setSelectedRouteId, setCurrentFlowState]);

  // Additional state
  const [searchText, setSearchText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [reports, setReports] = useState<TrafficIncident[]>([]);
  
  // Rerouting state
  const [wasRerouted, setWasRerouted] = useState(false);
  const [isRerouting, setIsRerouting] = useState(false);
  const [rerouteCount, setRerouteCount] = useState(0);
  
  // Destination arrival state
  const [hasArrived, setHasArrived] = useState(false);
  const [arrivalNotificationShown, setArrivalNotificationShown] = useState(false);
  
  // Async operation states
  const [asyncLoading, setAsyncLoading] = useState({
    routes: false,
    geocoding: false,
    location: false,
    data: false,
  });
  const [asyncErrors, setAsyncErrors] = useState<Record<string, string | null>>({});
  
  // Debounced route fetcher
  const debouncedRouteFetcher = useMemo(() => createDebouncedRouteFetcher(), []);
  const [gasStations, setGasStations] = useState<any[]>([]);
  const [showReports, setShowReports] = useState(false);
  const [showGasStations, setShowGasStations] = useState(false);
  const [startAddress, setStartAddress] = useState<string>('');
  const [fuelLevel, setFuelLevel] = useState<number>(0);
  
  const [maintenanceFormData, setMaintenanceFormData] = useState({
    type: '' as '' | 'oil_change' | 'refuel' | 'tune_up',
    cost: '',
    quantity: '',
    notes: ''
  });

  // Map selection state
  const [mapSelectionState, setMapSelectionState] = useState({
    selectedLocation: null as LocationCoords | null,
    isSelecting: false,
  });

  // Flow state manager
  const flowStateManager = useCallback((newState: FlowState, options?: {
    resetData?: boolean;
    closeModals?: boolean;
    openModal?: keyof typeof uiState;
  }) => {
    setCurrentFlowState(prev => prev === newState ? prev : newState);
    
    if (options?.resetData) {
      setDestination(null);
      setSelectedRoute(null);
      setSelectedRouteId(null);
      setAlternativeRoutes([]);
      setTripSummary(null);
    }
    
    if (options?.closeModals) {
      updateUiState({
        showSearchModal: false,
        showBottomSheet: false,
        showTripSummary: false,
        showTripDetails: false,
        showReportModal: false,
        showMaintenanceForm: false,
        showFuelModal: false,
        isMapSelectionMode: false,
      });
    }
    
    if (options?.openModal) {
      updateUiState({ [options.openModal]: true });
    }
  }, [setDestination, setSelectedRoute, setSelectedRouteId, setAlternativeRoutes, setTripSummary, updateUiState]);

  // Map selection handlers
  const {
    startMapSelection: originalStartMapSelection,
    cancelMapSelection,
    handleMapPress,
    confirmMapSelection,
  } = useMapSelectionHandlers(
    uiState,
    updateUiState,
    mapSelectionState,
    setMapSelectionState,
    setDestination,
    mapState.currentLocation,
    setCurrentLocation,
    flowStateManager
  );

  // Async address search
  const searchAddress = useCallback(async (address: string) => {
    if (!address.trim()) return;
    
    // Set flow state to searching when starting search
    setCurrentFlowState('searching');

    setAsyncLoading(prev => ({ ...prev, geocoding: true }));
    setAsyncErrors(prev => ({ ...prev, geocoding: null }));

    try {
      const result = await runAsyncOperation(async () => {
        return await geocodeAddressAsync(address);
      }, {
        priority: 'normal',
        timeout: 10000,
        retries: 2,
      });

      if (result.success && result.data && result.data.results.length > 0) {
        const firstResult = result.data.results[0];
        const location = {
          latitude: firstResult.geometry.location.lat,
          longitude: firstResult.geometry.location.lng,
          address: firstResult.formatted_address,
        };

        // Update state asynchronously
        scheduleUIUpdate(() => {
          setDestination(location);
          setCurrentFlowState('destination_selected');
          setSearchText(firstResult.formatted_address);
        });

        if (__DEV__) {
        console.log('[MapScreen] Address geocoded successfully:', firstResult.formatted_address);
        }
      } else {
        throw new Error('No results found for the given address');
      }
    } catch (error) {
      if (__DEV__) {
      console.error('[MapScreen] Address search failed:', error);
      }
      setAsyncErrors(prev => ({ ...prev, geocoding: error.message || 'Address search failed' }));
      
      Toast.show({
        type: 'error',
        text1: 'Search Error',
        text2: 'Address not found. Please try a different search term.',
      });
    } finally {
      setAsyncLoading(prev => ({ ...prev, geocoding: false }));
    }
  }, [setDestination, setCurrentFlowState, setSearchText]);

  // Maintenance handlers
  const { handleMaintenanceFormSave: originalHandleMaintenanceFormSave, handleMaintenanceFormChange, handleFuelLevelUpdate } = useMaintenanceHandlers(
    selectedMotor,
    mapState.currentLocation,
    user,
    (visible: boolean) => updateUiState({ showMaintenanceForm: visible }),
    (data: any) => setMaintenanceFormData(data)
  );

  // Wrap handleMaintenanceFormSave to match expected signature
  const handleMaintenanceFormSave = useCallback(async () => {
    try {
      await originalHandleMaintenanceFormSave(maintenanceFormData);
      
      // If it's a refuel action, update the local fuel level
      if (maintenanceFormData.type === 'refuel' && maintenanceFormData.quantity) {
        const refuelAmount = parseFloat(maintenanceFormData.quantity);
        if (!isNaN(refuelAmount) && selectedMotor) {
          const newFuelLevel = Math.min(100, (selectedMotor.currentFuelLevel || 0) + refuelAmount);
          setFuelLevel(newFuelLevel);
          if (__DEV__) {
          console.log('[MapScreen] Fuel level updated after refuel:', newFuelLevel);
          }
        }
      }
    } catch (error) {
      if (__DEV__) {
      console.error('[MapScreen] Maintenance form save error:', error);
      }
    }
  }, [originalHandleMaintenanceFormSave, maintenanceFormData, selectedMotor]);

  // Wrap startMapSelection with debugging
  const startMapSelection = useCallback(() => {
    if (__DEV__) {
    console.log("🚀 startMapSelection called from MapScreenTryRefactored");
    }
    originalStartMapSelection();
  }, [originalStartMapSelection]);

  // Load location on mount with retry mechanism
  useEffect(() => {
    const loadLocation = async (retryCount = 0) => {
      try {
        const cachedLoc = await getCurrentLocationWithCache(false);
        if (cachedLoc) {
          setCurrentLocation({
            latitude: cachedLoc.latitude,
            longitude: cachedLoc.longitude,
          });
          setRegion({
            latitude: cachedLoc.latitude,
            longitude: cachedLoc.longitude,
            latitudeDelta: 0.0015,
            longitudeDelta: 0.0015,
          });
        }
      } catch (error) {
        console.error('[MapScreen] Failed to load location:', error);
        
        // If permission denied and this is the first attempt, show retry dialog
        if (error.message?.includes('permission') && retryCount === 0) {
          Alert.alert(
            'Location Permission Required',
            'This app needs location access to show your current position. Would you like to grant permission?',
            [
              {
                text: 'Cancel',
                style: 'cancel',
                onPress: () => {
                  console.log('[MapScreen] User cancelled location permission request');
                }
              },
              {
                text: 'Grant Permission',
                onPress: () => {
                  // Retry loading location after a short delay
                  setTimeout(() => {
                    loadLocation(retryCount + 1);
                  }, 500);
                }
              }
            ]
          );
        }
      }
    };

    loadLocation();
  }, [setCurrentLocation, setRegion]);

  // Initialize fuel level when motor is selected
  useEffect(() => {
    if (selectedMotor?.currentFuelLevel !== undefined) {
      setFuelLevel(selectedMotor.currentFuelLevel);
      if (__DEV__) {
      console.log('[MapScreen] Fuel level initialized:', selectedMotor.currentFuelLevel);
      }
    }
  }, [selectedMotor?.currentFuelLevel]);

  // Off-route detection and automatic rerouting (Google Maps style)
  useEffect(() => {
    if (!navigationState.isNavigating || !selectedRoute || !mapState.currentLocation) return;

    // Only check for off-route after navigation has been running for at least 30 seconds
    const navigationDuration = Date.now() - (navigationState.navigationStartTime || 0);
    if (navigationDuration < 30000) return; // Wait 30 seconds before checking

    // Use a larger threshold for off-route detection (100 meters instead of 50)
    const userIsOffRoute = isUserOffRoute(mapState.currentLocation, selectedRoute.coordinates, 100);
    if (userIsOffRoute && !isRerouting) {
      if (__DEV__) {
      console.warn("🚨 Off-route detected. Rerouting...");
      }
      setIsRerouting(true);
      setWasRerouted(true);
      setRerouteCount(prev => prev + 1);
      
      // Show rerouting notification
      Toast.show({
        type: 'info',
        text1: 'Rerouting',
        text2: 'You have deviated from the route. Finding new route...',
        position: 'top',
        visibilityTime: 3000,
      });

      // Fetch new routes from current location
      fetchRoutes();
      
      // Close bottom sheet if open
      updateUiState({ showBottomSheet: false });
    }
  }, [mapState.currentLocation, navigationState.isNavigating, selectedRoute, isRerouting, fetchRoutes, updateUiState, navigationState.navigationStartTime]);

  // Reset rerouting state when new routes are loaded
  useEffect(() => {
    if (alternativeRoutes.length > 0 && isRerouting) {
      setIsRerouting(false);
      console.log("✅ Rerouting completed. New routes available.");
      
      Toast.show({
        type: 'success',
        text1: 'Route Updated',
        text2: 'New route found. You can select from alternatives.',
        position: 'top',
        visibilityTime: 3000,
      });
    }
  }, [alternativeRoutes.length, isRerouting]);

  // Navigation timer effect (like Google Maps)
  useEffect(() => {
    if (!navigationState.isNavigating || !navigationState.navigationStartTime) return;

    const timer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - navigationState.navigationStartTime) / 1000);
      setTimeElapsed(elapsed);
      
      // Update ETA (simplified calculation)
      if (selectedRoute && selectedRoute.duration) {
        const remainingTime = Math.max(0, selectedRoute.duration - elapsed);
        const hours = Math.floor(remainingTime / 3600);
        const minutes = Math.floor((remainingTime % 3600) / 60);
        setCurrentEta(hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [navigationState.isNavigating, navigationState.navigationStartTime, selectedRoute, setTimeElapsed, setCurrentEta]);

  // Handle destination selection (original flow - no auto-fetch)
  const handleDestinationSelect = useCallback((destination: LocationCoords) => {
    setDestination(destination);
    setRegion({
      latitude: destination.latitude,
      longitude: destination.longitude,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    });
    flowStateManager('destination_selected');
    updateUiState({ showSearchModal: false });
  }, [setDestination, setRegion, flowStateManager, updateUiState]);

  // Handle place selected close modal
  const handlePlaceSelectedCloseModal = useCallback(() => {
    updateUiState({ showSearchModal: false });
  }, [updateUiState]);

  // Handle route selection (original flow)
  const handleRouteSelection = useCallback((id: string) => {
    const route = id === tripSummary?.id ? tripSummary : alternativeRoutes.find(r => r.id === id);
    if (route) {
      setSelectedRouteId(id);
      setSelectedRoute(route);
      mapRef.current?.fitToCoordinates(route.coordinates, {
        edgePadding: { top: 100, right: 50, bottom: 300, left: 50 },
        animated: true,
      });
    }
    updateUiState({ showBottomSheet: false });
  }, [tripSummary, alternativeRoutes, mapRef, updateUiState]);

  // Handle bottom sheet close
  const handleBottomSheetClose = useCallback(() => {
    updateUiState({ showBottomSheet: false });
  }, [updateUiState]);

  // Handle maintenance action
  const handleMaintenanceAction = useCallback((type: 'refuel' | 'oil_change' | 'tune_up') => {
    updateUiState({ showMaintenanceForm: true });
  }, [updateUiState]);

  // Save trip to backend
  const saveTripToBackend = useCallback(async () => {
    if (!user?._id || !selectedMotor?._id || !tripSummary) {
      Toast.show({
        type: 'error',
        text1: 'Save Failed',
        text2: 'Missing trip data',
      });
      return;
    }

    try {
      const tripData = {
        userId: user._id,
        motorId: selectedMotor._id,
        startAddress: startAddress || 'Unknown',
        destination: mapState.destination?.address || 'Unknown',
        distance: tripSummary.distance,
        duration: Math.round(navigationState.timeElapsed / 60), // Convert to minutes
        fuelUsed: navigationState.currentFuelUsed,
        fuelUsedMin: tripSummary.fuelEstimate * 0.9, // Estimate min/max
        fuelUsedMax: tripSummary.fuelEstimate * 1.1,
        actualFuelUsedMin: navigationState.currentFuelUsed * 0.9,
        actualFuelUsedMax: navigationState.currentFuelUsed * 1.1,
        actualDistance: distanceTraveled,
        wasRerouted: false, // Could be tracked if needed
        isSuccessful: true,
        status: "completed",
        timeArrived: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        }),
        eta: navigationState.currentEta,
        trafficCondition: "moderate",
        kmph: navigationState.currentSpeed,
        rerouteCount: 0,
        wasInBackground: false,
        showAnalyticsModal: false,
        analyticsNotes: `Trip completed with ${selectedMotor.nickname}`,
      };

      if (__DEV__) {
      console.log('[MapScreen] Saving trip data:', tripData);
      }

      // Use apiRequest for consistency and automatic authentication with retry
      let responseData;
      let retries = 0;
      const maxRetries = 3;
      
      while (retries < maxRetries) {
        try {
          responseData = await apiRequest('/api/trips', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(tripData),
      });
          break; // Success, exit retry loop
        } catch (error: any) {
          retries++;
          
          // Only retry on network errors or 5xx errors
          const isRetryable = 
            error?.message?.includes('Network') ||
            error?.message?.includes('timeout') ||
            error?.message?.includes('ECONNREFUSED') ||
            error?.message?.includes('ETIMEDOUT');
          
          if (!isRetryable || retries >= maxRetries) {
            throw error; // Not retryable or max retries reached
          }
          
          // Exponential backoff: 1s, 2s, 4s
          const delay = 1000 * Math.pow(2, retries - 1);
          if (__DEV__) {
            console.log(`[MapScreen] Retrying trip save after ${delay}ms (attempt ${retries}/${maxRetries})`);
          }
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
      
      if (__DEV__) {
      console.log('[MapScreen] ✅ Trip saved successfully:', responseData);
      }

      // Only update state if component is still mounted
      if (!isMountedRef.current) {
        return; // Component unmounted, don't update state
      }

      Toast.show({
        type: 'success',
        text1: 'Trip Saved',
        text2: 'Your trip has been recorded successfully',
      });

      // Close trip summary modal
      updateUiState({ showTripSummary: false });
      
      // Reset navigation state
      setSelectedRoute(null);
      setTripSummary(null);
      setAlternativeRoutes([]);
      setDestination(null);
      setStartAddress('');
      flowStateManager('idle' as any);
      
      // Navigate to home screen (RouteSelectionScreenOptimized) - only if still mounted
      if (isMountedRef.current) {
      navigation.navigate('MainTabs', { screen: 'Map' });
      }

    } catch (error: any) {
      // Only show error if component is still mounted
      if (!isMountedRef.current) {
        return; // Component unmounted, don't show error
      }
      
      if (__DEV__) {
      console.error('[MapScreen] Failed to save trip:', error);
      }
      Toast.show({
        type: 'error',
        text1: 'Save Failed',
        text2: error.message || 'Failed to save trip',
      });
    }
  }, [user, selectedMotor, tripSummary, startAddress, mapState.destination, navigationState, distanceTraveled, updateUiState, flowStateManager]);

  // Handle end navigation
  const handleEndNavigation = useCallback(() => {
    setIsNavigating(false);
    setNavigationStartTime(null);
    setIsFollowingUser(false);
    flowStateManager('completed');
    
    // Reset arrival state
    setHasArrived(false);
    setArrivalNotificationShown(false);
    
    // Show trip summary modal after navigation ends
    updateUiState({ showTripSummary: true });
    
    if (__DEV__) {
    console.log('[MapScreen] Navigation ended, showing trip summary');
    }
  }, [setIsNavigating, setNavigationStartTime, setIsFollowingUser, flowStateManager, updateUiState]);

  // Destination arrival detection
  useEffect(() => {
    if (!navigationState.isNavigating || !mapState.destination || !mapState.currentLocation || hasArrived) {
      return;
    }

    // Calculate distance to destination
    const distanceToDestination = calculateDistance(
      mapState.currentLocation.latitude,
      mapState.currentLocation.longitude,
      mapState.destination.latitude,
      mapState.destination.longitude
    );

    console.log('[MapScreen] Distance to destination:', {
      distance: distanceToDestination,
      threshold: 50, // 50 meters threshold
      hasArrived,
      arrivalNotificationShown
    });

    // Check if user has arrived (within 50 meters of destination)
    if (distanceToDestination <= 50 && !arrivalNotificationShown) {
      setHasArrived(true);
      setArrivalNotificationShown(true);
      
      console.log('🎉 User has arrived at destination!');
      
      // Show arrival notification
      Toast.show({
        type: 'success',
        text1: 'You have arrived!',
        text2: `You are within 50m of your destination`,
        position: 'top',
        visibilityTime: 5000,
      });

      // Auto-end navigation after a short delay
      setTimeout(() => {
        handleEndNavigation();
      }, 3000); // Wait 3 seconds before auto-ending
    }
  }, [mapState.currentLocation, mapState.destination, navigationState.isNavigating, hasArrived, arrivalNotificationShown, handleEndNavigation]);

  // Handle show details
  const handleShowDetails = useCallback(() => {
    updateUiState({ showTripDetails: true });
  }, [updateUiState]);

  // Animate to region
  const animateToRegion = useCallback((newRegion: any) => {
    if (mapRef.current) {
      mapRef.current.animateToRegion(newRegion, 1000);
    }
  }, [mapRef]);

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safeArea}>
        {/* Flow State Indicator */}
        <FlowStateIndicator currentFlowState={currentFlowState as any} />

        {/* Loading Indicators */}
        {asyncLoading.routes && (
          <View style={styles.loadingOverlay}>
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#00ADB5" />
              <Text style={styles.loadingText}>
                {isRerouting ? 'Rerouting...' : 'Finding routes...'}
              </Text>
              {isRerouting && (
                <Text style={styles.loadingSubtext}>
                  Reroute #{rerouteCount} - Finding new route from current location
                </Text>
              )}
            </View>
          </View>
        )}

        {asyncLoading.geocoding && (
          <View style={styles.loadingOverlay}>
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#00ADB5" />
              <Text style={styles.loadingText}>Searching address...</Text>
            </View>
          </View>
        )}

        {/* Error Messages */}
        {asyncErrors.routes && (
          <View style={styles.errorOverlay}>
            <View style={styles.errorContainer}>
              <MaterialIcons name="error" size={24} color="#FF6B6B" />
              <Text style={styles.errorText}>{asyncErrors.routes}</Text>
              <View style={styles.errorButtons}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => {
                    setAsyncErrors(prev => ({ ...prev, routes: null }));
                  }}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.retryButton}
                  onPress={() => {
                    setAsyncErrors(prev => ({ ...prev, routes: null }));
                    fetchRoutes();
                  }}
                >
                  <Text style={styles.retryButtonText}>Retry</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {asyncErrors.geocoding && (
          <View style={styles.errorOverlay}>
            <View style={styles.errorContainer}>
              <MaterialIcons name="error" size={24} color="#FF6B6B" />
              <Text style={styles.errorText}>{asyncErrors.geocoding}</Text>
              <View style={styles.errorButtons}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => {
                    setAsyncErrors(prev => ({ ...prev, geocoding: null }));
                  }}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* Destination Selection Button - Always visible when no destination */}
        {!mapState.destination && currentFlowState === 'initial' && (
          <View style={styles.destinationSelectionContainer}>
            <TouchableOpacity
              onPress={() => updateUiState({ showSearchModal: true })}
              style={styles.destinationSelectionButton}
            >
              <LinearGradient
                colors={['#00ADB5', '#00858B']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.destinationSelectionGradient}
              >
                <MaterialIcons name="search" size={24} color="#fff" />
                <Text style={styles.destinationSelectionText}>Choose Destination</Text>
                <MaterialIcons name="arrow-forward" size={20} color="#fff" />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}

        {/* Destination Display */}
        {mapState.destination && currentFlowState === 'destination_selected' && (
          <View style={styles.destinationHeader}>
            <TouchableOpacity
              onPress={() => updateUiState({ showSearchModal: true })}
              style={styles.destinationContainer}
            >
              <View style={styles.destinationContent}>
                <MaterialIcons name="place" size={20} color="#00ADB5" />
                <Text style={styles.destinationText} numberOfLines={1}>
                  {mapState.destination.address || 'Selected destination'}
                </Text>
                <MaterialIcons name="edit" size={16} color="#666" />
              </View>
            </TouchableOpacity>
            
            {/* Get Routes Button */}
            <TouchableOpacity
              onPress={() => {
                console.log('[MapScreen] Get Routes button pressed');
                console.log('[MapScreen] Current state:', {
                  currentLocation: mapState.currentLocation,
                  destination: mapState.destination,
                  selectedMotor: selectedMotor,
                  currentFlowState
                });
                fetchRoutes();
              }}
              style={styles.getRoutesButton}
              disabled={asyncLoading.routes}
            >
              <LinearGradient
                colors={['#00ADB5', '#00858B']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.getRoutesGradient}
              >
                {asyncLoading.routes ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <MaterialIcons name="directions" size={20} color="#fff" />
                )}
                <Text style={styles.getRoutesText}>
                  {asyncLoading.routes ? 'Finding Routes...' : 'Get Routes'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}

        {/* Original Route Selection Flow - Shows when routes are found */}
        {currentFlowState === 'routes_found' && !navigationState.isNavigating && (
          <View style={styles.routeSelectionContainer}>
            <TouchableOpacity
              onPress={() => updateUiState({ showBottomSheet: true })}
              style={styles.showRoutesButton}
            >
              <LinearGradient
                colors={['#00ADB5', '#00858B']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.showRoutesGradient}
              >
                <MaterialIcons name="list" size={20} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.showRoutesText}>View Routes</Text>
              </LinearGradient>
            </TouchableOpacity>

            <View style={styles.buttonSpacer} />

            <TouchableOpacity
              onPress={() => {
                console.log('[MapScreen] Start Navigation button pressed');
                
                // Start navigation with proper state updates
                setIsNavigating(true);
                setNavigationStartTime(Date.now());
                setIsFollowingUser(true);
                setCurrentFlowState('navigating');
                
                // Reset arrival state for new navigation
                setHasArrived(false);
                setArrivalNotificationShown(false);
                
                // Reset navigation stats
                setTimeElapsed(0);
                setDistanceRemaining(selectedRoute?.distance || 0);
                setCurrentSpeed(0);
                setCurrentFuelUsed(0);
                
                // Initialize path with starting point
                if (mapState.currentLocation) {
                  setPathCoords([mapState.currentLocation]);
                }
                
                // Start background tracking
                const tripId = `trip_${Date.now()}`;
                const stats = {
                  distance: 0,
                  duration: 0,
                  avgSpeed: 0,
                  speed: 0,
                  fuelConsumed: 0,
                };
                startBackgroundLocationTracking(tripId, selectedMotor, stats);
                
                Toast.show({
                  type: 'success',
                  text1: 'Navigation Started',
                  text2: 'Follow the route to your destination',
                  position: 'top',
                });
              }}
              style={styles.navigationButton}
            >
              <LinearGradient
                colors={['#2ecc71', '#27ae60']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.navigationGradient}
              >
                <MaterialIcons name="navigation" size={20} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.navigationButtonText}>Start Navigation</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}

        {/* Search Modal */}
        <SearchModal
          visible={uiState.showSearchModal && !uiState.isMapSelectionMode}
          onClose={() => {
            if (mapState.destination && (selectedRoute || selectedRouteId)) {
              updateUiState({ showSearchModal: false });
            } else {
              setSearchText("");
              updateUiState({ showSearchModal: false });
              if (navigation?.canGoBack()) {
                navigation.goBack();
              } else {
                navigation.navigate("MainTabs", { screen: "Map" });
              }
            }
          }}
          searchRef={searchRef}
          searchText={searchText}
          setSearchText={setSearchText}
          isTyping={isTyping}
          setIsTyping={setIsTyping}
          onDestinationSelect={handleDestinationSelect}
          animateToRegion={animateToRegion}
          selectedMotor={selectedMotor}
          onMotorSelect={handleMotorSelect}
          motorList={motorList}
          onPlaceSelectedCloseModal={handlePlaceSelectedCloseModal}
          userId={user?._id}
          onMapSelection={startMapSelection}
        />

        {/* Optimized Map Component */}
        <OptimizedMapComponent
          mapRef={mapRef}
          region={mapState.region}
          mapStyle="standard"
          currentLocation={mapState.currentLocation}
          destination={mapState.destination}
          
          userId={user?._id}
          reportMarkers={reports}
          gasStations={gasStations}
          showReports={showReports}
          showGasStations={showGasStations}
          onMapPress={handleMapPress}
          selectedMapLocation={mapSelectionState.selectedLocation}
          routeCoordinates={selectedRoute?.coordinates}
          snappedRouteCoordinates={pathCoords}
          isTracking={navigationState.isNavigating}
          onReportVoted={() => {}}
        />

        {/* Route Selection Modal */}
        <RouteSelectionModal
          visible={uiState.showBottomSheet}
          onClose={handleBottomSheetClose}
          bestRoute={tripSummary}
          alternatives={alternativeRoutes}
          selectedRouteId={selectedRouteId}
          onSelectRoute={handleRouteSelection}
          selectedMotor={selectedMotor}
          isNavigating={navigationState.isNavigating}
        />

        {/* Rerouting Indicator */}
        {isRerouting && (
          <View style={styles.reroutingIndicator}>
            <View style={styles.reroutingContainer}>
              <ActivityIndicator size="small" color="#FF6B6B" />
              <Text style={styles.reroutingText}>
                Rerouting... (Attempt #{rerouteCount})
              </Text>
            </View>
          </View>
        )}

        {/* Destination Distance Indicator */}
        {navigationState.isNavigating && mapState.destination && mapState.currentLocation && !hasArrived && (
          <View style={styles.destinationDistanceIndicator}>
            <View style={styles.destinationDistanceContainer}>
              <MaterialIcons name="place" size={20} color="#00ADB5" />
              <Text style={styles.destinationDistanceText}>
                {Math.round(calculateDistance(
                  mapState.currentLocation.latitude,
                  mapState.currentLocation.longitude,
                  mapState.destination.latitude,
                  mapState.destination.longitude
                ))}m to destination
              </Text>
            </View>
          </View>
        )}

        {/* Navigation Controls - Only show when navigating with destination */}
        {navigationState.isNavigating && mapState.destination && (
          <NavigationControls
          isNavigating={navigationState.isNavigating}
          currentSpeed={navigationState.currentSpeed}
          distanceRemaining={navigationState.distanceRemaining}
          timeElapsed={navigationState.timeElapsed}
          currentEta={navigationState.currentEta}
          isOverSpeedLimit={navigationState.isOverSpeedLimit}
          currentFuelLevel={selectedMotor?.currentFuelLevel || 0}
          selectedMotor={selectedMotor}
          currentLocation={mapState.currentLocation}
          user={user}
          onEndNavigation={handleEndNavigation}
          onShowDetails={handleShowDetails}
          onMaintenanceAction={handleMaintenanceAction}
          onReroute={fetchRoutes}
          isRerouting={isRerouting}
          onFuelLevelUpdate={(newFuelLevel) => {
            console.log('[MapScreen] Fuel level updated from NavigationControls:', newFuelLevel);
          }}
          />
        )}

        {/* Map Selection Mode Indicator */}
        {uiState.isMapSelectionMode && (
          <View style={styles.mapSelectionIndicator}>
            <View style={styles.mapSelectionIndicatorContent}>
              <MaterialIcons name="place" size={24} color="#00ADB5" />
              <Text style={styles.mapSelectionIndicatorText}>
                Tap on the map to select your destination
              </Text>
              <TouchableOpacity
                style={styles.mapSelectionCancelButtonIndicator}
                onPress={cancelMapSelection}
              >
                <MaterialIcons name="close" size={20} color="#666" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Map Selection Confirmation Modal */}
        {uiState.isMapSelectionMode && mapSelectionState.selectedLocation && (
          <View style={styles.mapSelectionModalContainer}>
            <View style={styles.mapSelectionModal}>
              <View style={styles.mapSelectionHeader}>
                <MaterialIcons name="place" size={24} color="#00ADB5" />
                <Text style={styles.mapSelectionTitle}>Confirm Location</Text>
              </View>
              
              <View style={styles.mapSelectionContent}>
                <Text style={styles.mapSelectionAddress}>
                  {mapSelectionState.selectedLocation?.address || "Selected location"}
                </Text>
                <Text style={styles.mapSelectionCoordinates}>
                  {(mapSelectionState.selectedLocation?.latitude || 0).toFixed(6)}, {(mapSelectionState.selectedLocation?.longitude || 0).toFixed(6)}
                </Text>
              </View>

              <View style={styles.mapSelectionButtons}>
                <TouchableOpacity
                  style={styles.mapSelectionCancelButton}
                  onPress={cancelMapSelection}
                >
                  <Text style={styles.mapSelectionCancelText}>Cancel</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.mapSelectionConfirmButton}
                  onPress={confirmMapSelection}
                >
                  <LinearGradient
                    colors={['#00ADB5', '#00858B']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.mapSelectionConfirmGradient}
                  >
                    <Text style={styles.mapSelectionConfirmText}>Confirm</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* Maintenance Modal */}
        <MaintenanceModal
          visible={uiState.showMaintenanceForm}
          formData={maintenanceFormData}
          onClose={() => updateUiState({ showMaintenanceForm: false })}
          onSave={handleMaintenanceFormSave}
          onChange={(field, value) => setMaintenanceFormData(prev => ({ ...prev, [field]: value }))}
        />

        {/* Trip Details Modal */}
        <TripDetailsModal
          visible={uiState.showTripDetails}
          onClose={() => updateUiState({ showTripDetails: false })}
          currentSpeed={navigationState.currentSpeed}
          distanceRemaining={navigationState.distanceRemaining}
          timeElapsed={navigationState.timeElapsed}
          currentEta={navigationState.currentEta}
          currentFuel={fuelLevel}
          currentFuelUsed={navigationState.currentFuelUsed}
          isOverSpeedLimit={navigationState.isOverSpeedLimit}
          selectedRoute={selectedRoute}
          selectedMotor={selectedMotor}
          distanceTraveled={distanceTraveled}
        />

        {/* Trip Summary Modal */}
        <TripSummaryModal
          visible={uiState.showTripSummary}
          onClose={() => {
            updateUiState({ showTripSummary: false });
            // Navigate to home screen (RouteSelectionScreenOptimized) - only if still mounted
            if (isMountedRef.current) {
            navigation.navigate('MainTabs', { screen: 'Map' });
            }
          }}
          onSave={saveTripToBackend}
          onCancel={() => {
            updateUiState({ showTripSummary: false });
            // Reset navigation state without saving and navigate to home
            setSelectedRoute(null);
            setTripSummary(null);
            setAlternativeRoutes([]);
            setDestination(null);
            setStartAddress('');
            flowStateManager('idle' as any);
            // Navigate to home screen (RouteSelectionScreenOptimized) - only if still mounted
            if (isMountedRef.current) {
            navigation.navigate('MainTabs', { screen: 'Map' });
            }
          }}
          tripSummary={tripSummary}
          selectedMotor={selectedMotor}
          distanceTraveled={distanceTraveled}
          timeElapsed={navigationState.timeElapsed}
          fuelUsed={navigationState.currentFuelUsed}
          startAddress={startAddress}
          destinationAddress={mapState.destination?.address}
        />

        <Toast />
      </SafeAreaView>
    </SafeAreaProvider>
  );
});

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
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
  mapSelectionModalContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  mapSelectionModal: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    margin: 20,
    minWidth: 300,
  },
  mapSelectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  mapSelectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginLeft: 8,
  },
  mapSelectionContent: {
    marginBottom: 20,
  },
  mapSelectionAddress: {
    fontSize: 16,
    color: '#333',
    marginBottom: 8,
  },
  mapSelectionCoordinates: {
    fontSize: 14,
    color: '#666',
  },
  mapSelectionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  mapSelectionCancelButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginRight: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
  },
  mapSelectionCancelText: {
    fontSize: 16,
    color: '#666',
  },
  mapSelectionConfirmButton: {
    flex: 1,
    marginLeft: 8,
    borderRadius: 8,
    overflow: 'hidden',
  },
  mapSelectionConfirmGradient: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  mapSelectionConfirmText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
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
  // Rerouting styles
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
  loadingSubtext: {
    marginTop: 8,
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  // Map Selection Indicator styles
  mapSelectionIndicator: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
    zIndex: 1000,
  },
  mapSelectionIndicatorContent: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#00ADB5',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  mapSelectionIndicatorText: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 12,
  },
  mapSelectionCancelButtonIndicator: {
    padding: 4,
    marginLeft: 8,
  },
  // Get Routes Button styles
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
  // Original Route Selection Flow styles
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
  // Destination Distance Indicator styles
  destinationDistanceIndicator: {
    position: 'absolute',
    top: 100,
    left: 16,
    right: 16,
    zIndex: 1000,
  },
  destinationDistanceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    borderLeftWidth: 4,
    borderLeftColor: '#00ADB5',
  },
  destinationDistanceText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginLeft: 8,
  },
});

export default MapScreenTryRefactored;
