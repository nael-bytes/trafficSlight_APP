import { useState, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { runAsyncOperation, scheduleUIUpdate } from './asyncOperations';
import { fetchRoutesAsync, geocodeAddressAsync } from './asyncMapOperations';
import { updateFuelLevel } from './api';
import { calculateNewFuelLevel } from './fuelCalculations';
import polyline from '@mapbox/polyline';
import Toast from 'react-native-toast-message';

// Types
export type FlowState = 'initial' | 'searching' | 'destination_selected' | 'routes_found' | 'navigating' | 'completed';

export interface DestinationFlowState {
  currentFlowState: FlowState;
  searchText: string;
  isTyping: boolean;
  asyncLoading: {
    routes: boolean;
    geocoding: boolean;
  };
  asyncErrors: Record<string, string | null>;
}

export interface DestinationFlowActions {
  setCurrentFlowState: (state: FlowState) => void;
  setSearchText: (text: string) => void;
  setIsTyping: (typing: boolean) => void;
  setAsyncLoading: (loading: Partial<DestinationFlowState['asyncLoading']>) => void;
  setAsyncErrors: (errors: Partial<DestinationFlowState['asyncErrors']>) => void;
  setDestination: (destination: any) => void;
  setRegion: (region: any) => void;
  setSelectedRoute: (route: any) => void;
  setSelectedRouteId: (id: string | null) => void;
  setAlternativeRoutes: (routes: any[]) => void;
  setTripSummary: (summary: any) => void;
  updateUiState: (state: any) => void;
  flowStateManager: (state: FlowState, options?: any) => void;
}

export interface DestinationFlowProps {
  mapState: {
    currentLocation: any;
    destination: any;
    region: any;
  };
  selectedMotor: any;
  user: any;
  navigation: any;
}

// Custom hook for destination flow management
export const useDestinationFlow = (
  mapState: DestinationFlowProps['mapState'],
  selectedMotor: DestinationFlowProps['selectedMotor'],
  user: DestinationFlowProps['user'],
  navigation: DestinationFlowProps['navigation'],
  actions: DestinationFlowActions
) => {
  const {
    setCurrentFlowState,
    setSearchText,
    setIsTyping,
    setAsyncLoading,
    setAsyncErrors,
    setDestination,
    setRegion,
    setSelectedRoute,
    setSelectedRouteId,
    setAlternativeRoutes,
    setTripSummary,
    updateUiState,
    flowStateManager
  } = actions;

  // State for destination flow
  const [destinationFlowState, setDestinationFlowState] = useState<DestinationFlowState>({
    currentFlowState: 'initial',
    searchText: '',
    isTyping: false,
    asyncLoading: {
      routes: false,
      geocoding: false,
    },
    asyncErrors: {}
  });

  // Update local state when props change
  const updateDestinationFlowState = useCallback((updates: Partial<DestinationFlowState>) => {
    setDestinationFlowState(prev => ({ ...prev, ...updates }));
  }, []);

  // Route button press handler
  const handleRouteButtonPress = useCallback(() => {
    // Start destination selection flow
    setCurrentFlowState('searching');
    // Ensure map selection mode is off when opening search modal
    updateUiState({ 
      showSearchModal: true,
      isMapSelectionMode: false // Ensure map selection mode is disabled
    });
  }, [setCurrentFlowState, updateUiState]);

  // Async route fetching
  // Accepts optional destination parameter to handle cases where state hasn't updated yet
  const fetchRoutes = useCallback(async (destinationOverride?: any) => {
    // Use destinationOverride if provided, otherwise use mapState.destination
    const destination = destinationOverride || mapState.destination;
    
    if (!mapState.currentLocation || !destination || !selectedMotor) {
      if (__DEV__) {
        console.log("Missing required data for route fetching:", {
          hasCurrentLocation: !!mapState.currentLocation,
          hasDestination: !!destination,
          hasSelectedMotor: !!selectedMotor,
          usingOverride: !!destinationOverride,
        });
      }
      return;
    }

    updateDestinationFlowState({ 
      asyncLoading: { ...destinationFlowState.asyncLoading, routes: true },
      asyncErrors: { ...destinationFlowState.asyncErrors, routes: null }
    });

    try {
      // CRITICAL OPTIMIZATION: Use direct API call with single retry for faster response
      // Reduced timeout and retries for better user experience
      const result = await runAsyncOperation(async () => {
        return await fetchRoutesAsync(mapState.currentLocation!, destination, {
          alternatives: true,
          departureTime: 'now',
          trafficModel: 'best_guess',
          avoid: ['tolls'],
        });
      }, {
        priority: 'high', // High priority = runs immediately, no InteractionManager delay
        timeout: 10000, // Reduced from 15s to 10s for faster failure detection
        retries: 1, // Reduced from 2 to 1 for faster response (still allows one retry)
      });

      if (result.success && result.data) {
        const rawRoutes = result.data;
        
        // Process routes to match RouteData interface
        const processedRoutes = rawRoutes.map((route: any, index: number) => {
          try {
            const leg = route.legs?.[0];
            if (!leg) {
              console.warn(`Route ${index} has no legs, skipping`);
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
            let coordinates: any[] = [];
            try {
              if (route.overview_polyline?.points) {
                coordinates = polyline.decode(route.overview_polyline.points).map(([lat, lng]: [number, number]) => ({
                  latitude: lat,
                  longitude: lng,
                }));
              }
            } catch (polylineError) {
              console.warn(`Failed to decode polyline for route ${index}:`, polylineError);
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
            console.error(`Error processing route ${index}:`, error);
            return null;
          }
        }).filter(Boolean); // Remove null routes
        
        // CRITICAL OPTIMIZATION: Update state immediately instead of using scheduleUIUpdate
        // scheduleUIUpdate adds delay via requestAnimationFrame + InteractionManager
        // For route results, we want immediate UI update for better UX
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
          console.warn('No valid routes processed');
          updateDestinationFlowState({ 
            asyncErrors: { ...destinationFlowState.asyncErrors, routes: 'No valid routes found' }
          });
        }

        console.log(`[DestinationFlow] Fetched ${processedRoutes.length} routes asynchronously`);
        console.log('[DestinationFlow] Processed routes data:', processedRoutes);
        console.log('[DestinationFlow] Main route:', processedRoutes[0]);
        console.log('[DestinationFlow] Alternatives:', processedRoutes.slice(1));
      } else {
        throw new Error(result.error?.message || 'Failed to fetch routes');
      }
    } catch (error) {
      console.error('[DestinationFlow] Route fetching failed:', error);
      updateDestinationFlowState({ 
        asyncErrors: { ...destinationFlowState.asyncErrors, routes: error.message || 'Failed to fetch routes' }
      });
      
      Toast.show({
        type: 'error',
        text1: 'Route Error',
        text2: 'Failed to fetch routes. Please try again.',
      });
    } finally {
      updateDestinationFlowState({ 
        asyncLoading: { ...destinationFlowState.asyncLoading, routes: false }
      });
    }
  }, [
    mapState.currentLocation, 
    mapState.destination, 
    selectedMotor, 
    setAlternativeRoutes, 
    setSelectedRoute, 
    setSelectedRouteId, 
    setCurrentFlowState,
    setTripSummary,
    updateUiState,
    destinationFlowState.asyncLoading,
    destinationFlowState.asyncErrors,
    updateDestinationFlowState
  ]);

  // Async address search
  const searchAddress = useCallback(async (address: string) => {
    if (!address.trim()) return;

    updateDestinationFlowState({ 
      asyncLoading: { ...destinationFlowState.asyncLoading, geocoding: true },
      asyncErrors: { ...destinationFlowState.asyncErrors, geocoding: null }
    });

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

        console.log('[DestinationFlow] Address geocoded successfully:', firstResult.formatted_address);
      } else {
        throw new Error('No results found for the given address');
      }
    } catch (error) {
      console.error('[DestinationFlow] Address search failed:', error);
      updateDestinationFlowState({ 
        asyncErrors: { ...destinationFlowState.asyncErrors, geocoding: error.message || 'Address search failed' }
      });
      
      Toast.show({
        type: 'error',
        text1: 'Search Error',
        text2: 'Address not found. Please try a different search term.',
      });
    } finally {
      updateDestinationFlowState({ 
        asyncLoading: { ...destinationFlowState.asyncLoading, geocoding: false }
      });
    }
  }, [
    setDestination, 
    setCurrentFlowState, 
    setSearchText,
    destinationFlowState.asyncLoading,
    destinationFlowState.asyncErrors,
    updateDestinationFlowState
  ]);

  // Handle destination selection
  const handleDestinationSelect = useCallback((destination: any) => {
    if (__DEV__) {
      console.log('[destinationFlowManager] 🎯 handleDestinationSelect called', {
        destination,
        hasCurrentLocation: !!mapState.currentLocation,
        hasSelectedMotor: !!selectedMotor,
      });
    }
    
    setDestination(destination);
    setRegion({
      latitude: destination.latitude,
      longitude: destination.longitude,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    });
    setCurrentFlowState('destination_selected');
    updateUiState({ showSearchModal: false });
    
    // CRITICAL FIX: Automatically fetch routes after selecting destination from search
    // This ensures routes are processed immediately after selecting an address
    // Fetch routes immediately with destination parameter to bypass state update delay
    if (fetchRoutes && mapState.currentLocation && destination && selectedMotor) {
      if (__DEV__) {
        console.log('[destinationFlowManager] 🚀 Fetching routes immediately with destination parameter', {
          destination,
          currentLocation: mapState.currentLocation,
          selectedMotor: selectedMotor._id,
        });
      }
      // Fetch routes with destination parameter to bypass state update delay
      // This ensures routes are fetched even if mapState.destination hasn't updated yet
      fetchRoutes(destination);
    } else {
      // Fallback: Try again after state update in case immediate fetch failed
      setTimeout(() => {
        if (fetchRoutes && mapState.currentLocation && destination && selectedMotor) {
          if (__DEV__) {
            console.log('[destinationFlowManager] ✅ Retrying route fetch after state update', {
              destination,
              currentLocation: mapState.currentLocation,
              selectedMotor: selectedMotor._id,
            });
          }
          fetchRoutes(destination);
        } else {
          if (__DEV__) {
            console.warn('[destinationFlowManager] ⚠️ Cannot auto-fetch routes - missing data:', {
              hasFetchRoutes: !!fetchRoutes,
              hasCurrentLocation: !!mapState.currentLocation,
              hasDestination: !!destination,
              hasSelectedMotor: !!selectedMotor,
            });
          }
        }
      }, 300); // Fallback timeout
    }
  }, [setDestination, setRegion, setCurrentFlowState, updateUiState, fetchRoutes, mapState.currentLocation, selectedMotor]);

  // Handle search modal close
  const handleSearchModalClose = useCallback(() => {
    setSearchText("");
    updateUiState({ showSearchModal: false });
    // Reset flow state to initial if no destination is set
    // This ensures we return to original state when canceling destination selection
    if (!mapState.destination) {
      setCurrentFlowState('initial');
    }
  }, [setSearchText, updateUiState, mapState.destination, setCurrentFlowState]);

  // UI Rendering Functions
  const renderFlowStateIndicator = useCallback((onCancel: () => void) => {
    if (destinationFlowState.currentFlowState === 'initial') return null;
    
    return {
      currentFlowState: destinationFlowState.currentFlowState,
      onCancel,
    };
  }, [destinationFlowState.currentFlowState]);

  const renderLoadingIndicators = useCallback(() => {
    const indicators = [];
    
    if (destinationFlowState.asyncLoading.routes) {
      indicators.push({
        key: 'routes',
        text: 'Finding routes...',
        visible: true,
      });
    }
    
    if (destinationFlowState.asyncLoading.geocoding) {
      indicators.push({
        key: 'geocoding',
        text: 'Searching location...',
        visible: true,
      });
    }
    
    return indicators;
  }, [destinationFlowState.asyncLoading]);

  const renderErrorHandling = useCallback((onRetry: () => void, onCancel: () => void) => {
    const errors = [];
    
    if (destinationFlowState.asyncErrors.routes) {
      errors.push({
        key: 'routes',
        message: destinationFlowState.asyncErrors.routes,
        onRetry,
        onCancel,
      });
    }
    
    if (destinationFlowState.asyncErrors.geocoding) {
      errors.push({
        key: 'geocoding',
        message: destinationFlowState.asyncErrors.geocoding,
        onRetry: () => {}, // Geocoding errors don't have retry
        onCancel,
      });
    }
    
    return errors;
  }, [destinationFlowState.asyncErrors]);

  const renderDestinationDisplay = useCallback((destination: any, onEditDestination: () => void, onGetRoutes: () => void, isRoutesLoading: boolean) => {
    // Only show destination display when:
    // 1. Flow state is 'destination_selected'
    // 2. There's a destination
    // 3. We're NOT tracking (Free Drive mode)
    // This ensures it only shows for destination flow, not free drive
    if (destinationFlowState.currentFlowState !== 'destination_selected' || !destination) {
      return null;
    }
    
    return {
      destination,
      onEditDestination,
      onGetRoutes,
      isRoutesLoading,
    };
  }, [destinationFlowState.currentFlowState]);

  const renderRouteSelectionDisplay = useCallback((isNavigating: boolean, onViewRoutes: () => void) => {
    if (destinationFlowState.currentFlowState !== 'routes_found' || isNavigating) {
      return null;
    }
    
    return {
      onViewRoutes,
    };
  }, [destinationFlowState.currentFlowState]);

  // Memoized return object
  return useMemo(() => ({
    // State
    destinationFlowState,
    
    // Actions
    handleRouteButtonPress,
    fetchRoutes,
    searchAddress,
    handleDestinationSelect,
    handleSearchModalClose,
    updateDestinationFlowState,
    
    // UI Rendering Functions
    renderFlowStateIndicator,
    renderLoadingIndicators,
    renderErrorHandling,
    renderDestinationDisplay,
    renderRouteSelectionDisplay,
    
    // Computed values
    isDestinationFlowActive: destinationFlowState.currentFlowState !== 'initial',
    showFlowIndicator: destinationFlowState.currentFlowState !== 'initial',
  }), [
    destinationFlowState,
    handleRouteButtonPress,
    fetchRoutes,
    searchAddress,
    handleDestinationSelect,
    handleSearchModalClose,
    updateDestinationFlowState,
    renderFlowStateIndicator,
    renderLoadingIndicators,
    renderErrorHandling,
    renderDestinationDisplay,
    renderRouteSelectionDisplay,
  ]);
};
