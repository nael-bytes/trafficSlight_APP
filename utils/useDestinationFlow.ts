import { useCallback, useMemo, useRef } from 'react';
import { useDestinationFlow as useDestinationFlowManager } from './destinationFlowManager';

export interface UseDestinationFlowProps {
  mapState: {
    currentLocation: any;
    destination: any;
    region: any;
  };
  navigationState: {
    isNavigating: boolean;
    currentSpeed: number;
    distanceRemaining: number;
    timeElapsed: number;
    currentEta: string | null;
    isOverSpeedLimit: boolean;
  };
  selectedMotor: any;
  user: any;
  navigation: any;
  // State setters
  setDestination: (destination: any) => void;
  setRegion: (region: any) => void;
  setSelectedRoute: (route: any) => void;
  setSelectedRouteId: (id: string | null) => void;
  setAlternativeRoutes: (routes: any[]) => void;
  setTripSummary: (summary: any) => void;
  updateUiState: (state: any) => void;
  // Additional state for flow management
  setSearchText: (text: string) => void;
  setIsTyping: (typing: boolean) => void;
  setAsyncLoading?: (loading: any) => void;
  setAsyncErrors: (errors: any) => void;
  // Navigation controls callbacks
  onEndNavigation: () => void;
  onShowDetails: () => void;
  onMaintenanceAction?: (type: 'refuel' | 'oil_change' | 'tune_up') => void;
  onReroute?: () => void;
  isRerouting?: boolean;
  onFuelLevelUpdate?: (newFuelLevel: number) => void;
}

export const useDestinationFlow = ({
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
  setAsyncLoading = () => {},
  setAsyncErrors,
  onEndNavigation,
  onShowDetails,
  onMaintenanceAction,
  onReroute,
  isRerouting,
  onFuelLevelUpdate,
}: UseDestinationFlowProps) => {
  // Create a ref to store the destinationFlow for setCurrentFlowState
  const destinationFlowRef = useRef<any>(null);

  // Destination flow management
  const destinationFlow = useDestinationFlowManager(
    mapState,
    selectedMotor,
    user,
    navigation,
    {
      setCurrentFlowState: (state) => destinationFlowRef.current?.updateDestinationFlowState({ currentFlowState: state }),
      setSearchText,
      setIsTyping,
      setAsyncLoading: (loading) => setAsyncLoading(prev => ({ ...prev, ...loading })),
      setAsyncErrors: (errors) => setAsyncErrors(prev => ({ ...prev, ...errors })),
      setDestination,
      setRegion,
      setSelectedRoute,
      setSelectedRouteId,
      setAlternativeRoutes,
      setTripSummary,
      updateUiState,
      flowStateManager: () => {} // Placeholder
    }
  );

  // Update the ref when destinationFlow changes
  destinationFlowRef.current = destinationFlow;

  // Flow state manager - moved from RouteSelectionScreenOptimized.tsx
  const flowStateManager = useCallback((newState: any, options?: {
    resetData?: boolean;
    closeModals?: boolean;
    openModal?: string;
  }) => {
    destinationFlow.updateDestinationFlowState({ currentFlowState: newState });
    
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
  }, [destinationFlow, setDestination, setSelectedRoute, setSelectedRouteId, setAlternativeRoutes, setTripSummary, updateUiState]);

  // Custom confirm map selection that also updates destination flow state
  // Only updates flow state if we're already in destination flow (route button was pressed)
  const confirmMapSelectionWithFlowUpdate = useCallback(async (confirmMapSelection: () => Promise<void>, destinationOverride?: any) => {
    await confirmMapSelection();
    
    // CRITICAL: Use destinationOverride if provided (from map selection), otherwise use mapState.destination
    // This ensures we have the destination immediately without waiting for state updates
    // This matches the behavior of handleDestinationSelect in destinationFlowManager
    const destination = destinationOverride || mapState.destination;
    
    // Only update destination flow state if we're already in destination flow
    // This ensures "Find the best routes" only shows when explicitly in destination flow
    const currentState = destinationFlow.destinationFlowState.currentFlowState;
    if (currentState === 'searching' || currentState === 'destination_selected' || currentState === 'routes_found') {
      // We're in destination flow, update state to destination_selected
      destinationFlow.updateDestinationFlowState({ currentFlowState: 'destination_selected' });
    } else {
      // If not in destination flow, activate it now since user selected a destination
      destinationFlow.updateDestinationFlowState({ currentFlowState: 'destination_selected' });
    }
    
    // CRITICAL: Automatically fetch routes after confirming map selection
    // Use the same pattern as handleDestinationSelect - pass destination directly to fetchRoutes
    // This ensures routes are fetched even if state hasn't fully updated yet
    if (destination && mapState.currentLocation && selectedMotor) {
      if (__DEV__) {
        console.log('[useDestinationFlow] 🚀 Fetching routes after map selection confirmation', {
          destination,
          currentLocation: mapState.currentLocation,
          selectedMotor: selectedMotor._id,
        });
      }
      // Fetch routes with destination parameter to bypass state update delay
      // This ensures routes are fetched immediately, same as when selecting from search/recent/saved
      await destinationFlow.fetchRoutes(destination);
    } else {
      // Fallback: Try again after state update in case immediate fetch failed
      setTimeout(async () => {
        const updatedDestination = mapState.destination;
        if (updatedDestination && mapState.currentLocation && selectedMotor) {
          if (__DEV__) {
            console.log('[useDestinationFlow] ✅ Retrying route fetch after state update', {
              destination: updatedDestination,
              currentLocation: mapState.currentLocation,
              selectedMotor: selectedMotor._id,
            });
          }
          await destinationFlow.fetchRoutes(updatedDestination);
        } else {
          if (__DEV__) {
            console.warn('[useDestinationFlow] ⚠️ Cannot auto-fetch routes - missing data:', {
              hasDestination: !!updatedDestination,
              hasCurrentLocation: !!mapState.currentLocation,
              hasSelectedMotor: !!selectedMotor,
            });
          }
        }
      }, 300); // Fallback timeout
    }
  }, [destinationFlow.updateDestinationFlowState, destinationFlow.destinationFlowState.currentFlowState, destinationFlow.fetchRoutes, mapState.destination, mapState.currentLocation, selectedMotor]);

  // Reset destination flow to initial state
  const resetDestinationFlow = useCallback(() => {
    destinationFlow.updateDestinationFlowState({ currentFlowState: 'initial' });
    setDestination(null);
    setSelectedRoute(null);
    setSelectedRouteId(null);
    setAlternativeRoutes([]);
    setTripSummary(null);
  }, [destinationFlow, setDestination, setSelectedRoute, setSelectedRouteId, setAlternativeRoutes, setTripSummary]);

  // Cancel destination flow - Reset everything to original state
  const cancelDestinationFlow = useCallback(() => {
    // Reset flow state to initial
    destinationFlow.updateDestinationFlowState({ currentFlowState: 'initial' });
    // Clear destination
    setDestination(null);
    // Clear routes
    setSelectedRoute(null);
    setSelectedRouteId(null);
    setAlternativeRoutes([]);
    setTripSummary(null);
    // Close all modals related to destination flow
    updateUiState({
      showSearchModal: false,
      showBottomSheet: false,
      isMapSelectionMode: false,
    });
  }, [destinationFlow, setDestination, setSelectedRoute, setSelectedRouteId, setAlternativeRoutes, setTripSummary, updateUiState]);

  // Start navigation flow
  const startNavigationFlow = useCallback(() => {
    destinationFlow.updateDestinationFlowState({ currentFlowState: 'navigating' });
  }, [destinationFlow]);

  // Complete navigation flow
  const completeNavigationFlow = useCallback(() => {
    destinationFlow.updateDestinationFlowState({ currentFlowState: 'completed' });
  }, [destinationFlow]);

  // Check if destination flow is active
  const isDestinationFlowActive = useMemo(() => {
    return destinationFlow.destinationFlowState.currentFlowState !== 'initial';
  }, [destinationFlow.destinationFlowState.currentFlowState]);

  // Check if in specific flow state
  const isInFlowState = useCallback((state: string) => {
    return destinationFlow.destinationFlowState.currentFlowState === state;
  }, [destinationFlow.destinationFlowState.currentFlowState]);

  // Get current flow state
  const getCurrentFlowState = useCallback(() => {
    return destinationFlow.destinationFlowState.currentFlowState;
  }, [destinationFlow.destinationFlowState.currentFlowState]);

  // Get navigation controls props when in destination flow and navigating
  const getNavigationControlsProps = useCallback(() => {
    if (!navigationState.isNavigating || !mapState.destination) {
      return null;
    }

    return {
      isNavigating: navigationState.isNavigating,
      currentSpeed: navigationState.currentSpeed,
      distanceRemaining: navigationState.distanceRemaining,
      timeElapsed: navigationState.timeElapsed,
      currentEta: navigationState.currentEta,
      isOverSpeedLimit: navigationState.isOverSpeedLimit,
      currentFuelLevel: selectedMotor?.currentFuelLevel || 0,
      selectedMotor: selectedMotor,
      currentLocation: mapState.currentLocation,
      user: user,
      onEndNavigation: onEndNavigation,
      onShowDetails: onShowDetails,
      onMaintenanceAction: onMaintenanceAction,
      onReroute: onReroute,
      isRerouting: isRerouting,
      onFuelLevelUpdate: onFuelLevelUpdate,
    };
  }, [
    navigationState.isNavigating,
    navigationState.currentSpeed,
    navigationState.distanceRemaining,
    navigationState.timeElapsed,
    navigationState.currentEta,
    navigationState.isOverSpeedLimit,
    mapState.destination,
    mapState.currentLocation,
    selectedMotor,
    user,
    onEndNavigation,
    onShowDetails,
    onMaintenanceAction,
    onReroute,
    isRerouting,
    onFuelLevelUpdate,
  ]);

  return useMemo(() => ({
    // Core destination flow
    destinationFlow,
    
    // Flow state management
    flowStateManager,
    resetDestinationFlow,
    cancelDestinationFlow,
    startNavigationFlow,
    completeNavigationFlow,
    
    // Flow state queries
    isDestinationFlowActive,
    isInFlowState,
    getCurrentFlowState,
    
    // Map selection with flow update
    confirmMapSelectionWithFlowUpdate,
    
    // Direct access to destination flow methods
    fetchRoutes: destinationFlow.fetchRoutes,
    searchAddress: destinationFlow.searchAddress,
    handleDestinationSelect: destinationFlow.handleDestinationSelect,
    handleSearchModalClose: destinationFlow.handleSearchModalClose,
    handleRouteButtonPress: destinationFlow.handleRouteButtonPress,
    
    // UI Rendering Functions
    renderFlowStateIndicator: destinationFlow.renderFlowStateIndicator,
    renderLoadingIndicators: destinationFlow.renderLoadingIndicators,
    renderErrorHandling: destinationFlow.renderErrorHandling,
    renderDestinationDisplay: destinationFlow.renderDestinationDisplay,
    renderRouteSelectionDisplay: destinationFlow.renderRouteSelectionDisplay,
    
    // Navigation controls props
    getNavigationControlsProps,
  }), [
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
    getNavigationControlsProps,
  ]);
};
