import { useCallback, useState } from 'react';

export interface UIState {
  showSearchModal: boolean;
  showBottomSheet: boolean;
  showTripSummary: boolean;
  showTripDetails: boolean;
  showReportModal: boolean;
  showMaintenanceForm: boolean;
  showFuelModal: boolean;
  isMapSelectionMode: boolean;
}

export type FlowState = 'searching' | 'destination_selected' | 'routes_found' | 'navigating' | 'completed';

export interface UIStateManager {
  uiState: UIState;
  updateUiState: (updates: Partial<UIState>) => void;
  currentFlowState: FlowState;
  setCurrentFlowState: (state: FlowState) => void;
  flowStateManager: (newState: FlowState, options?: {
    resetData?: boolean;
    closeModals?: boolean;
    openModal?: keyof UIState;
  }) => void;
}

// Initial UI state
const initialUIState: UIState = {
  showSearchModal: false,
  showBottomSheet: false,
  showTripSummary: false,
  showTripDetails: false,
  showReportModal: false,
  showMaintenanceForm: false,
  showFuelModal: false,
  isMapSelectionMode: false,
};

// UI State Manager hook
export const useUIStateManager = (
  setDestination: (location: any) => void,
  setSelectedRoute: (route: any) => void,
  setSelectedRouteId: (id: string | null) => void,
  setTripSummary: (summary: any) => void,
  setAlternativeRoutes: (routes: any[]) => void,
  setPathCoords: (coords: any[]) => void,
  setNavigationStartTime: (time: number | null) => void,
  setIsNavigating: (navigating: boolean) => void,
  updateUiState: (updates: Partial<UIState>) => void
): UIStateManager => {
  
  const [uiState, setUiState] = useState<UIState>(initialUIState);
  const [currentFlowState, setCurrentFlowState] = useState<FlowState>('searching');

  // Centralized state update function - Memoized with stable reference
  const updateUiStateCallback = useCallback((updates: Partial<UIState>) => {
    setUiState(prev => {
      // Only update if there are actual changes
      const hasChanges = Object.keys(updates).some(key => 
        prev[key as keyof UIState] !== updates[key as keyof UIState]
      );
      return hasChanges ? { ...prev, ...updates } : prev;
    });
  }, []);

  // Flow State Manager - Centralized state transitions
  const flowStateManager = useCallback((newState: FlowState, options?: {
    resetData?: boolean;
    closeModals?: boolean;
    openModal?: keyof UIState;
  }) => {
    // Only update state if it's actually changing
    setCurrentFlowState(prev => prev === newState ? prev : newState);
    
    if (options?.resetData) {
      // Batch state updates to prevent multiple re-renders
      setDestination(null);
      setSelectedRoute(null);
      setSelectedRouteId(null);
      setTripSummary(null);
      setAlternativeRoutes([]);
      setPathCoords([]);
      setNavigationStartTime(null);
      setIsNavigating(false);
    }
    
    if (options?.closeModals) {
      updateUiStateCallback({
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
      updateUiStateCallback({ [options.openModal]: true });
    }
  }, [setDestination, setSelectedRoute, setSelectedRouteId, setTripSummary, setAlternativeRoutes, setPathCoords, setNavigationStartTime, setIsNavigating, updateUiStateCallback]);

  return {
    uiState,
    updateUiState: updateUiStateCallback,
    currentFlowState,
    setCurrentFlowState,
    flowStateManager,
  };
};
