import { useState, useCallback, useRef } from 'react';
import type { LocationCoords } from '../types';

export interface MapState {
  currentLocation: LocationCoords | null;
  destination: LocationCoords | null;
  region: any;
  isFollowingUser: boolean;
}

export interface NavigationState {
  isNavigating: boolean;
  currentSpeed: number;
  distanceRemaining: number;
  timeElapsed: number;
  currentEta: string | null;
  currentFuelUsed: number;
  isOverSpeedLimit: boolean;
  navigationStartTime: number | null;
}

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

export const useMapState = () => {
  // Map State
  const [mapState, setMapState] = useState<MapState>({
    currentLocation: null,
    destination: null,
    region: null,
    isFollowingUser: false,
  });

  // Navigation State
  const [navigationState, setNavigationState] = useState<NavigationState>({
    isNavigating: false,
    currentSpeed: 0,
    distanceRemaining: 0,
    timeElapsed: 0,
    currentEta: null,
    currentFuelUsed: 0,
    isOverSpeedLimit: false,
    navigationStartTime: null,
  });

  // UI State
  const [uiState, setUiState] = useState<UIState>({
    showSearchModal: false,
    showBottomSheet: false,
    showTripSummary: false,
    showTripDetails: false,
    showReportModal: false,
    showMaintenanceForm: false,
    showFuelModal: false,
    isMapSelectionMode: false,
  });

  // Refs
  const mapRef = useRef<any>(null);
  const searchRef = useRef<any>(null);
  const voiceNavTimeout = useRef<NodeJS.Timeout>();
  const isBackgroundTracking = useRef(false);
  const backgroundTrackingId = useRef<string | null>(null);
  const apiCallTimeout = useRef<NodeJS.Timeout | null>(null);
  const lastApiCallTime = useRef<number>(0);

  // State setters
  const setCurrentLocation = useCallback((loc: LocationCoords | null) => 
    setMapState(prev => ({ ...prev, currentLocation: loc })), []);
  
  const setDestination = useCallback((dest: LocationCoords | null) => 
    setMapState(prev => ({ ...prev, destination: dest })), []);
  
  const setRegion = useCallback((reg: any) => {
    // Validate region before setting (prevent null/invalid region errors)
    if (reg && typeof reg.latitude === 'number' && typeof reg.longitude === 'number' &&
        !isNaN(reg.latitude) && !isNaN(reg.longitude) &&
        reg.latitude >= -90 && reg.latitude <= 90 &&
        reg.longitude >= -180 && reg.longitude <= 180) {
      setMapState(prev => ({ 
        ...prev, 
        region: {
          ...reg,
          latitudeDelta: reg.latitudeDelta || 0.05,
          longitudeDelta: reg.longitudeDelta || 0.05,
        }
      }));
    } else if (reg === null || reg === undefined) {
      // Allow null to be set (for clearing region)
      setMapState(prev => ({ ...prev, region: null }));
    } else {
      if (__DEV__) {
        console.warn('[useMapState] Invalid region value, skipping update:', reg);
      }
    }
  }, []);
  
  const setIsFollowingUser = useCallback((val: boolean) => 
    setMapState(prev => ({ ...prev, isFollowingUser: val })), []);

  const setIsNavigating = useCallback((val: boolean) => 
    setNavigationState(prev => ({ ...prev, isNavigating: val })), []);
  
  const setCurrentSpeed = useCallback((val: number) => 
    setNavigationState(prev => ({ ...prev, currentSpeed: val })), []);
  
  const setDistanceRemaining = useCallback((val: number) => 
    setNavigationState(prev => ({ ...prev, distanceRemaining: val })), []);
  
  const setTimeElapsed = useCallback((val: number) => 
    setNavigationState(prev => ({ ...prev, timeElapsed: val })), []);
  
  const setCurrentEta = useCallback((val: string | null) => 
    setNavigationState(prev => ({ ...prev, currentEta: val })), []);
  
  const setCurrentFuelUsed = useCallback((val: number) => 
    setNavigationState(prev => ({ ...prev, currentFuelUsed: val })), []);
  
  const setIsOverSpeedLimit = useCallback((val: boolean) => 
    setNavigationState(prev => ({ ...prev, isOverSpeedLimit: val })), []);

  const setNavigationStartTime = useCallback((val: number | null) => 
    setNavigationState(prev => ({ ...prev, navigationStartTime: val })), []);

  // UI State updater
  const updateUiState = useCallback((updates: Partial<UIState>) => {
    setUiState(prev => {
      const hasChanges = Object.keys(updates).some(key => 
        prev[key as keyof UIState] !== updates[key as keyof UIState]
      );
      return hasChanges ? { ...prev, ...updates } : prev;
    });
  }, []);

  return {
    // State
    mapState,
    navigationState,
    uiState,
    
    // Refs
    mapRef,
    searchRef,
    voiceNavTimeout,
    isBackgroundTracking,
    backgroundTrackingId,
    apiCallTimeout,
    lastApiCallTime,
    
    // Setters
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
  };
};
