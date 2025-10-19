import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
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
} from 'react-native';
import Toast from 'react-native-toast-message';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {LOCALHOST_IP} from '@env';

// Import custom hooks and components
import { useUser } from '../AuthContext/UserContextImproved';
import { useAppData, forceRefreshMotors } from '../hooks/useAppData';
import { useTracking } from '../hooks/useTracking';
import { useLocationPermission } from '../hooks/useLocationPermission';
import { useTripCache } from '../hooks/useTripCache';
import { reverseGeocodeLocation } from '../utils/location';
import { updateFuelLevel } from '../utils/api';
import { calculateNewFuelLevel, calculateFuelLevelAfterRefuel } from '../utils/fuelCalculations';
import { cacheLocation, getCurrentLocationWithCache } from '../utils/locationCache';
import { startBackgroundLocationTracking, stopBackgroundLocationTracking, resumeTrackingFromBackground, safeStopBackgroundLocation } from '../utils/backgroundLocation';
import { backgroundStateManager } from '../utils/backgroundStateManager';

// Import components
import { MapComponent } from '../components/MapComponent';
import { TrackingStats } from '../components/TrackingStats';
import { MotorSelector } from '../components/MotorSelector';
import { TrafficReportModal } from '../components/TrafficReportModal';
import { TripSummaryModal } from '../components/TripSummaryModal';
import { Speedometer } from '../components/Speedometer';
import { TripRecoveryModal } from '../components/TripRecoveryModal-mapscreentry';

// Import types
import type { ScreenMode, Motor, LocationCoords } from '../types';

const { width, height } = Dimensions.get('window');

interface RouteSelectionScreenProps {
  navigation: any;
  route?: {
    params?: {
      focusLocation?: LocationCoords;
    };
  };
}

export default function RouteSelectionScreen({ navigation, route }: RouteSelectionScreenProps) {
  const { user } = useUser();
  const { focusLocation } = route?.params || {};

  // Location permission hook
  const { 
    permissionStatus, 
    isPermissionGranted, 
    checkPermissionStatus 
  } = useLocationPermission();

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
  const [region, setRegion] = useState({
    latitude: 14.7006,
    longitude: 120.9836,
    latitudeDelta: 0.005,
    longitudeDelta: 0.005,
  });
  const [currentLocation, setCurrentLocation] = useState<LocationCoords | null>(null);
  const [locationPermissionGranted, setLocationPermissionGranted] = useState(true);

  // Modal states
  const [showMotorSelector, setShowMotorSelector] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showTripSummary, setShowTripSummary] = useState(false);
  const [showTripRecovery, setShowTripRecovery] = useState(false);
  const [startAddress, setStartAddress] = useState<string>('');
  const [endAddress, setEndAddress] = useState<string>('');

  // Map and UI states
  const [showReports, setShowReports] = useState(true);
  const [showGasStations, setShowGasStations] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  // Motor selection
  const [selectedMotor, setSelectedMotor] = useState<Motor | null>(null);

  // Track maintenance actions during current trip
  const [tripMaintenanceActions, setTripMaintenanceActions] = useState<any[]>([]);

  // Refs for optimization
  const mapRef = useRef(null);
  const isUserDrivenRegionChange = useRef(false);
  const lastRegionUpdate = useRef<number>(0);
  const hasRequestedLocation = useRef(false);
  const hasShownLowFuelWarning = useRef(false);
  const lastFuelWarningLevel = useRef<number>(100);
  const isBackgroundTracking = useRef(false);
  const backgroundTrackingId = useRef<string | null>(null);
  const lastEffectiveData = useRef<{reports: any[], gasStations: any[], motors: any[]}>({reports: [], gasStations: [], motors: []});
  const hasCheckedRecovery = useRef(false);

  // Local cache states (similar to HomeScreen)
  const [localMotors, setLocalMotors] = useState<Motor[]>([]);
  const [localReports, setLocalReports] = useState<any[]>([]);
  const [localGasStations, setLocalGasStations] = useState<any[]>([]);
  const [cacheLoading, setCacheLoading] = useState(false);

  // Custom hooks
  const { reports, gasStations, motors, loading, error, refreshData } = useAppData({
    user,
    isTracking: screenMode === 'tracking',
  });

  // Pull global caches
  const { cachedReports, cachedGasStations, cachedMotors } = useUser();

  // Cache loading function (adapted from HomeScreen)
  const loadCachedData = useCallback(async () => {
    if (!user?._id) return;
    
    setCacheLoading(true);
    try {
      const [
        cachedMotors,
        cachedReports,
        cachedGasStations,
      ] = await Promise.all([
        AsyncStorage.getItem(`cachedMotors_${user._id}`),
        AsyncStorage.getItem(`cachedReports_${user._id}`),
        AsyncStorage.getItem(`cachedGasStations_${user._id}`),
      ]);

      if (cachedMotors) {
        const parsedMotors = JSON.parse(cachedMotors);
        setLocalMotors(parsedMotors);
        console.log('[RouteSelection] Loaded cached motors:', parsedMotors.length);
      }
      if (cachedReports) {
        const parsedReports = JSON.parse(cachedReports);
        setLocalReports(parsedReports);
        console.log('[RouteSelection] Loaded cached reports:', parsedReports.length);
      }
      if (cachedGasStations) {
        const parsedGasStations = JSON.parse(cachedGasStations);
        setLocalGasStations(parsedGasStations);
        console.log('[RouteSelection] Loaded cached gas stations:', parsedGasStations.length);
      }

      console.log('✅ Cached data restored for user:', user._id);
    } catch (err) {
      console.warn('[RouteSelection] Failed to load cache:', err);
    } finally {
      setCacheLoading(false);
    }
  }, [user?._id]);

  // Cache saving function (adapted from HomeScreen)
  const saveCachedData = useCallback(async (motorsData?: Motor[], reportsData?: any[], gasStationsData?: any[]) => {
    if (!user?._id) return;

    try {
      const cachePromises = [];
      
      if (motorsData) {
        cachePromises.push(
          AsyncStorage.setItem(`cachedMotors_${user._id}`, JSON.stringify(motorsData))
        );
        setLocalMotors(motorsData);
      }
      
      if (reportsData) {
        cachePromises.push(
          AsyncStorage.setItem(`cachedReports_${user._id}`, JSON.stringify(reportsData))
        );
        setLocalReports(reportsData);
      }
      
      if (gasStationsData) {
        cachePromises.push(
          AsyncStorage.setItem(`cachedGasStations_${user._id}`, JSON.stringify(gasStationsData))
        );
        setLocalGasStations(gasStationsData);
      }

      await Promise.all(cachePromises);
      console.log('[RouteSelection] Data cached successfully');
    } catch (err) {
      console.warn('[RouteSelection] Failed to save cache:', err);
    }
  }, [user?._id]);

  // Memoized effective data with local cache priority (optimized logging)
  const effectiveReports = useMemo(() => {
    const result = reports?.length ? reports : (localReports?.length ? localReports : (cachedReports || []));
    // Only log when data actually changes
    if (result.length !== lastEffectiveData.current.reports.length) {
      console.log('[RouteSelection] Reports Data:', {
        apiReports: reports?.length || 0,
        localReports: localReports?.length || 0,
        globalCachedReports: cachedReports?.length || 0,
        effectiveReports: result?.length || 0,
        source: reports?.length ? 'API' : localReports?.length ? 'Local Cache' : cachedReports?.length ? 'Global Cache' : 'None'
      });
      lastEffectiveData.current.reports = result;
    }
    return result;
  }, [reports, localReports, cachedReports]);

  const effectiveGasStations = useMemo(() => {
    const result = gasStations?.length ? gasStations : (localGasStations?.length ? localGasStations : (cachedGasStations || []));
    // Only log when data actually changes
    if (result.length !== lastEffectiveData.current.gasStations.length) {
      console.log('[RouteSelection] Gas Stations Data:', {
        apiGasStations: gasStations?.length || 0,
        localGasStations: localGasStations?.length || 0,
        globalCachedGasStations: cachedGasStations?.length || 0,
        effectiveGasStations: result?.length || 0,
        source: gasStations?.length ? 'API' : localGasStations?.length ? 'Local Cache' : cachedGasStations?.length ? 'Global Cache' : 'None'
      });
      lastEffectiveData.current.gasStations = result;
    }
    return result;
  }, [gasStations, localGasStations, cachedGasStations]);

  const effectiveMotors = useMemo(() => {
    const result = motors?.length ? motors : (localMotors?.length ? localMotors : (cachedMotors || []));
    // Only log when data actually changes
    if (result.length !== lastEffectiveData.current.motors.length) {
      console.log('[RouteSelection] Motor Data:', {
        apiMotors: motors?.length || 0,
        localMotors: localMotors?.length || 0,
        globalCachedMotors: cachedMotors?.length || 0,
        effectiveMotors: result?.length || 0,
        source: motors?.length ? 'API' : localMotors?.length ? 'Local Cache' : cachedMotors?.length ? 'Global Cache' : 'None'
      });
      lastEffectiveData.current.motors = result;
    }
    return result;
  }, [motors, localMotors, cachedMotors]);

  // Function to fetch motorcycle details and populate fuelTank
  const fetchMotorcycleDetails = useCallback(async (motorcycleId: string) => {
    try {
      const response = await fetch(`${LOCALHOST_IP}/api/motorcycles/${motorcycleId}`);
      if (response.ok) {
        const motorcycleData = await response.json();
        return motorcycleData.fuelTank || 15; // Default to 15L if not provided
      }
    } catch (error) {
      console.warn('[RouteSelection] Failed to fetch motorcycle details:', error);
    }
    return 15; // Default fallback
  }, []);

  // Fuel level validation function
  const validateFuelLevel = (fuelLevel: number, motorId: string): boolean => {
    if (fuelLevel < 0 || fuelLevel > 100) {
      console.error('[RouteSelection] ❌ Invalid fuel level:', {
        fuelLevel,
        motorId,
        message: 'Fuel level must be between 0 and 100'
      });
      return false;
    }
    
    if (isNaN(fuelLevel)) {
      console.error('[RouteSelection] ❌ Invalid fuel level:', {
        fuelLevel,
        motorId,
        message: 'Fuel level must be a number'
      });
      return false;
    }
    
    return true;
  };

  // Track previous distance for incremental calculation
  const lastProcessedDistanceRef = useRef<number>(0);

  // Memoize stats update callback with optimized fuel calculation
  const handleStatsUpdate = useCallback((stats: any) => {
    if (stats.distance > 0) {
      // Calculate incremental distance (new distance since last update)
      const incrementalDistance = stats.distance - lastProcessedDistanceRef.current;

      // Only process fuel if there's significant new distance (at least 0.01km)
      if (incrementalDistance > 0.01) {
        setSelectedMotor(prev => {
          if (!prev) {
            return null;
          }
          
          // Update fuel level using local virtual property logic
          const motorData = {
            fuelConsumption: prev.fuelConsumption || prev.fuelEfficiency || 0,
            fuelTank: prev.fuelTank || 15, // Default tank size if not provided (15L)
            currentFuelLevel: prev.currentFuelLevel || 0
          };
          
          if (motorData.fuelConsumption > 0 && motorData.fuelTank > 0) {
            // Calculate new fuel level using INCREMENTAL distance only
            const newFuelLevel = calculateNewFuelLevel(motorData, incrementalDistance);
            
            // Validate fuel level before processing
            if (!validateFuelLevel(newFuelLevel, prev._id)) {
              return prev; // Return unchanged state
            }
            
            // Only update backend every 0.1km to reduce API calls
            if (incrementalDistance >= 0.1) {
              updateFuelLevel(prev._id, newFuelLevel).catch((error) => {
                console.warn('[RouteSelection] Fuel update failed:', error.message);
              });
            }
            
            const updatedMotor = {
              ...prev,
              currentFuelLevel: newFuelLevel,
              analytics: {
                ...prev.analytics,
                totalDistance: prev.analytics.totalDistance + incrementalDistance,
              }
            };
            
            return updatedMotor;
          } else {
            // Return without updating fuel level if data is missing
            return {
              ...prev,
              analytics: {
                ...prev.analytics,
                totalDistance: prev.analytics.totalDistance + incrementalDistance,
              }
            };
          }
        });

        // Update the last processed distance
        lastProcessedDistanceRef.current = stats.distance;
      }
    }
  }, []);

  // Handle road snapping failure
  const handleSnappingFailed = useCallback(() => {
    Toast.show({
      type: 'error',
      text1: 'Road Snapping Failed',
      text2: 'Unable to snap to roads. Please move closer to a road for better tracking accuracy.',
      position: 'top',
      visibilityTime: 4000,
    });
  }, []);

  // Tracking hook
  const {
    isTracking,
    rideStats,
    routeCoordinates,
    snappedRouteCoordinates,
    startTracking,
    stopTracking,
    resetTracking,
  } = useTracking({
    selectedMotor,
    onStatsUpdate: handleStatsUpdate,
    onSnappingFailed: handleSnappingFailed,
  });

  // ============================================================================
  // CALLBACK FUNCTIONS - Moved before effects to avoid hoisting issues
  // ============================================================================

  const handleGetCurrentLocation = useCallback(async (showOverlay: boolean = true, forceRefresh: boolean = false) => {
    try {
      isUserDrivenRegionChange.current = true;
      if (showOverlay) setIsLoading(true);
      
      // Check permission status first
      if (!isPermissionGranted()) {
        console.log('[RouteSelection] Permission not granted, checking status...');
        const currentStatus = await checkPermissionStatus();
        
        if (currentStatus !== 'granted') {
          setLocationPermissionGranted(false);
          Toast.show({
            type: 'error',
            text1: 'Location Permission Required',
            text2: 'Please enable location permission in settings',
          });
          return;
        }
      }

      setLocationPermissionGranted(true);
      
      // Use cached location utility (now uses centralized permission manager)
      const location = await getCurrentLocationWithCache(forceRefresh);
      
      if (!location) {
        setLocationPermissionGranted(false);
        Toast.show({
          type: 'error',
          text1: 'Location Error',
          text2: 'Failed to get location',
        });
        return;
      }
      
      const coords = {
        latitude: location.latitude,
        longitude: location.longitude,
      };
      
      setCurrentLocation(coords);
      
      // Cache location for other screens
      await cacheLocation({
        ...coords,
        timestamp: Date.now(),
      });
      
      setRegion({
        ...coords,
        latitudeDelta: 0.0015,
        longitudeDelta: 0.0015,
      });
      
      mapRef.current?.animateToRegion({
        ...coords,
        latitudeDelta: 0.0015,
        longitudeDelta: 0.0015,
      }, 1000);
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Location Error',
        text2: 'Failed to get location',
      });
    } finally {
      if (showOverlay) setIsLoading(false);
      isUserDrivenRegionChange.current = false;
    }
  }, [isPermissionGranted, checkPermissionStatus]);

  // ============================================================================
  // CONSOLIDATED EFFECTS - Optimized for performance
  // ============================================================================

  // Optimized: Load cached data only once on mount with cleanup
  useEffect(() => {
    if (!user?._id) return;
    
    let isMounted = true;
    
    const loadData = async () => {
      setCacheLoading(true);
      try {
        const [
          cachedMotors,
          cachedReports,
          cachedGasStations,
        ] = await Promise.all([
          AsyncStorage.getItem(`cachedMotors_${user._id}`),
          AsyncStorage.getItem(`cachedReports_${user._id}`),
          AsyncStorage.getItem(`cachedGasStations_${user._id}`),
        ]);

        if (isMounted) {
          if (cachedMotors) {
            const parsedMotors = JSON.parse(cachedMotors);
            setLocalMotors(parsedMotors);
            console.log('[RouteSelection] Loaded cached motors:', parsedMotors.length);
          }
          if (cachedReports) {
            const parsedReports = JSON.parse(cachedReports);
            setLocalReports(parsedReports);
            console.log('[RouteSelection] Loaded cached reports:', parsedReports.length);
          }
          if (cachedGasStations) {
            const parsedGasStations = JSON.parse(cachedGasStations);
            setLocalGasStations(parsedGasStations);
            console.log('[RouteSelection] Loaded cached gas stations:', parsedGasStations.length);
          }
          console.log('✅ Cached data restored for user:', user._id);
        }
      } catch (err) {
        console.warn('[RouteSelection] Failed to load cache:', err);
      } finally {
        if (isMounted) {
          setCacheLoading(false);
        }
      }
    };
    
    loadData();
    
    return () => {
      isMounted = false;
    };
  }, [user?._id]); // Remove loadCachedData dependency

  // Optimized: Batch cache saves with debouncing to prevent excessive saves
  useEffect(() => {
    if (!user?._id) return;
    
    const saveData = async () => {
      try {
        const cachePromises = [];
        
        if (motors?.length) {
          cachePromises.push(
            AsyncStorage.setItem(`cachedMotors_${user._id}`, JSON.stringify(motors))
          );
          setLocalMotors(motors);
        }
        
        if (reports?.length) {
          cachePromises.push(
            AsyncStorage.setItem(`cachedReports_${user._id}`, JSON.stringify(reports))
          );
          setLocalReports(reports);
        }
        
        if (gasStations?.length) {
          cachePromises.push(
            AsyncStorage.setItem(`cachedGasStations_${user._id}`, JSON.stringify(gasStations))
          );
          setLocalGasStations(gasStations);
        }

        if (cachePromises.length > 0) {
          await Promise.all(cachePromises);
          console.log('[RouteSelection] Data cached successfully');
        }
      } catch (err) {
        console.warn('[RouteSelection] Failed to save cache:', err);
      }
    };
    
    // Debounce cache saves to prevent excessive writes
    const timeoutId = setTimeout(saveData, 2000);
    return () => clearTimeout(timeoutId);
  }, [motors, reports, gasStations, user?._id]); // Batch all cache operations

  // Effect 3: Auto-select first motor (ONCE) - Fixed infinite loop
  useEffect(() => {
    console.log('[RouteSelection] Auto-select check:', {
      effectiveMotorsCount: effectiveMotors.length,
      hasSelectedMotor: !!selectedMotor,
      willAutoSelect: effectiveMotors.length > 0 && !selectedMotor
    });
    
    if (effectiveMotors.length > 0 && !selectedMotor) {
      console.log('[RouteSelection] Auto-selecting motor:', effectiveMotors[0]?.nickname);
      setSelectedMotor(effectiveMotors[0]);
    }
  }, [effectiveMotors.length]); // Only depend on length, not selectedMotor to prevent infinite loop

  // Effect 4: Handle focus location from navigation
  useEffect(() => {
    if (!focusLocation) return;
    
    isUserDrivenRegionChange.current = true;
    const newRegion = {
      ...focusLocation,
      latitudeDelta: 0.0015,
      longitudeDelta: 0.0015,
    };
    setRegion(newRegion);
    setCurrentLocation(focusLocation);
    
    mapRef.current?.animateToRegion(newRegion, 1000);
    
    setTimeout(() => {
      isUserDrivenRegionChange.current = false;
    }, 100);
  }, [focusLocation?.latitude, focusLocation?.longitude]);

  // Effect 5: Sync screen mode with tracking
  useEffect(() => {
    if (isTracking && screenMode !== 'tracking') {
      setScreenMode('tracking');
      // Start auto-cache when tracking starts
      startAutoCache();
    } else if (!isTracking && screenMode === 'tracking') {
      // Stop auto-cache when tracking stops
      stopAutoCache();
    }
  }, [isTracking, screenMode, startAutoCache, stopAutoCache]);

  // Optimized: Auto-update map during tracking with better throttling
  useEffect(() => {
    if (!isTracking || !currentLocation) return;
    
    const now = Date.now();
    if (now - lastRegionUpdate.current < 5000) return; // Increased throttle to 5 seconds
    
    const latDiff = Math.abs(region.latitude - currentLocation.latitude);
    const lngDiff = Math.abs(region.longitude - currentLocation.longitude);
    
    // Increased threshold to reduce unnecessary updates (10x more sensitive)
    if (latDiff > 0.005 || lngDiff > 0.005) {
      lastRegionUpdate.current = now;
      const newRegion = {
        ...currentLocation,
        latitudeDelta: 0.0015,
        longitudeDelta: 0.0015,
      };
      
      // Use requestAnimationFrame for smoother updates
      requestAnimationFrame(() => {
        mapRef.current?.animateToRegion(newRegion, 500); // Increased animation time for smoother transition
      });
    }
  }, [currentLocation?.latitude, currentLocation?.longitude, isTracking]); // Removed region dependencies to prevent loops

  // Effect 7: Handle errors (debounced)
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        Toast.show({
          type: 'error',
          text1: 'Data Loading Error',
          text2: error,
        });
      }, 500); // Debounce
      return () => clearTimeout(timer);
    }
  }, [error]);

  // Effect 7.5: Populate fuelTank property if missing
  useEffect(() => {
    if (selectedMotor && !selectedMotor.fuelTank) {
      console.log('[RouteSelection] Fetching fuelTank for motor:', selectedMotor.nickname);
      fetchMotorcycleDetails(selectedMotor.motorcycleId).then(fuelTank => {
        setSelectedMotor(prev => {
          if (!prev) return null;
          return { ...prev, fuelTank };
        });
      });
    }
  }, [selectedMotor, fetchMotorcycleDetails]);

  // Optimized: Low fuel warnings with debouncing to prevent spam
  useEffect(() => {
    if (!selectedMotor) return;

    const fuelLevel = selectedMotor.currentFuelLevel;
    const fuelTank = selectedMotor.fuelTank || 15;
    
    // Debounce fuel level changes to prevent excessive logging
    const timeoutId = setTimeout(() => {
      console.log('[RouteSelection] Motor fuel data:', {
        fuelLevel,
        fuelTank,
        fuelConsumption: selectedMotor.fuelConsumption || selectedMotor.fuelEfficiency,
        hasFuelTank: !!selectedMotor.fuelTank
      });
      
      // Only show warning if fuel level crossed a threshold
      if (fuelLevel <= 20 && fuelLevel > 10 && lastFuelWarningLevel.current > 20) {
        lastFuelWarningLevel.current = fuelLevel;
        Toast.show({
          type: 'error',
          text1: 'Low Fuel Warning',
          text2: `${selectedMotor.nickname}: ${fuelLevel.toFixed(0)}% fuel remaining`,
          visibilityTime: 3000,
        });
      } else if (fuelLevel <= 10 && lastFuelWarningLevel.current > 10) {
        lastFuelWarningLevel.current = fuelLevel;
        Toast.show({
          type: 'error',
          text1: 'Critical Fuel Level',
          text2: `${selectedMotor.nickname}: ${fuelLevel.toFixed(0)}% fuel remaining!`,
          visibilityTime: 4000,
        });
      } else if (fuelLevel > 20) {
        lastFuelWarningLevel.current = fuelLevel;
      }
    }, 1000); // Debounce by 1 second
    
    return () => clearTimeout(timeoutId);
  }, [selectedMotor?.currentFuelLevel, selectedMotor?.nickname]);

  // Effect 9: Sync permission status with local state
  useEffect(() => {
    setLocationPermissionGranted(isPermissionGranted());
  }, [permissionStatus, isPermissionGranted]);

  // Effect 10: Auto-save trip data when tracking
  useEffect(() => {
    if (isTracking && selectedMotor && currentLocation) {
      const tripData = {
        tripId: `trip_${Date.now()}`,
        startTime: Date.now(),
        isTracking,
        screenMode,
        currentLocation,
        startLocation: routeCoordinates[0] || currentLocation,
        endLocation: routeCoordinates[routeCoordinates.length - 1] || null,
        region,
        selectedMotor,
        rideStats: {
          ...rideStats,
          fuelConsumed: (rideStats as any).fuelConsumed || 0, // Add missing fuelConsumed property
        },
        routeCoordinates,
        snappedRouteCoordinates,
        startAddress,
        endAddress,
        tripMaintenanceActions: tripMaintenanceActions || [], // Use fallback for tripMaintenanceActions
        isBackgroundTracking: isBackgroundTracking.current,
        backgroundTrackingId: backgroundTrackingId.current,
      };

      // Auto-save trip data
      saveTripData(tripData).catch(error => {
        console.error('[RouteSelection] Failed to auto-save trip data:', error);
      });
    }
  }, [
    isTracking,
    selectedMotor,
    currentLocation,
    screenMode,
    region,
    rideStats,
    routeCoordinates,
    snappedRouteCoordinates,
    startAddress,
    endAddress,
    tripMaintenanceActions,
    saveTripData,
  ]);

  // Effect 11: Check for recoverable trip on mount (ONCE)
  useEffect(() => {
    if (hasCheckedRecovery.current) return;
    
    const checkForRecoverableTrip = async () => {
      try {
        hasCheckedRecovery.current = true;
        
        const hasTrip = await checkRecoverableTrip();
        if (hasTrip && currentTrip) {
          // Only show recovery if trip was actually tracking (not completed)
          if (currentTrip.isTracking || currentTrip.screenMode === 'tracking') {
            console.log('[RouteSelection] Recoverable trip found:', currentTrip.tripId);
            setShowTripRecovery(true);
          } else {
            console.log('[RouteSelection] Found completed trip, clearing cache');
            // Clear completed trips automatically
            await clearCompletedTrips();
          }
        }
      } catch (error) {
        console.error('[RouteSelection] Error checking for recoverable trip:', error);
      }
    };

    checkForRecoverableTrip();
  }, []); // Empty dependency array - only run once on mount

  // Effect 11: Request location on mount (ONCE)
  useEffect(() => {
    if (!hasRequestedLocation.current) {
      hasRequestedLocation.current = true;
      handleGetCurrentLocation(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      
      console.log('[RouteSelection] Cleanup completed - all refs and timers cleared');
    };
  }, []);

  // Effect 12: Auto-get location when screen is focused (every time)
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      console.log('[RouteSelection] Screen focused - getting current location');
      handleGetCurrentLocation(false);
    });

    return unsubscribe;
  }, [navigation, handleGetCurrentLocation]);

  // Effect 10: Handle background tracking resume
  useEffect(() => {
    const checkBackgroundTracking = async () => {
      try {
        const backgroundState = await resumeTrackingFromBackground();
        if (backgroundState && backgroundState.isTracking) {
          console.log('[RouteSelection] Resuming background tracking');
          isBackgroundTracking.current = true;
          backgroundTrackingId.current = backgroundState.tripId;
          
          // Update UI to reflect tracking state
          setScreenMode('tracking');
          
          // Show notification that tracking was resumed
          Toast.show({
            type: 'info',
            text1: 'Tracking Resumed',
            text2: 'Your trip was tracked in the background',
            visibilityTime: 3000,
          });
        }
      } catch (error) {
        console.error('[RouteSelection] Error checking background tracking:', error);
      }
    };

    checkBackgroundTracking();
  }, []);

  // Optimized: Handle app state changes with cleanup
  useEffect(() => {
    let isMounted = true;
    
    const handleAppStateChange = (appState: string) => {
      if (!isMounted) return;
      
      if (appState === 'background' && isTracking && !isBackgroundTracking.current) {
        console.log('[RouteSelection] App going to background, starting background tracking');
        startBackgroundTracking();
      } else if (appState === 'active' && isBackgroundTracking.current) {
        console.log('[RouteSelection] App coming to foreground, stopping background tracking');
        stopBackgroundTracking();
      }
    };

    backgroundStateManager.addListener(handleAppStateChange);
    
    return () => {
      isMounted = false;
      backgroundStateManager.removeListener(handleAppStateChange);
    };
  }, [isTracking]); // Remove function dependencies to prevent hoisting issues

  // ============================================================================
  // CALLBACK FUNCTIONS
  // ============================================================================

  const handleTrackingToggle = useCallback(async () => {
    if (!selectedMotor) {
      Toast.show({
        type: 'error',
        text1: 'No Motor Selected',
        text2: 'Please select a motor first',
      });
      return;
    }

    if (!currentLocation) {
      Toast.show({
        type: 'error',
        text1: 'Location Required',
        text2: 'Getting your location...',
      });
      handleGetCurrentLocation(false);
      return;
    }

    if (!isTracking) {
      try {
        setIsLoading(true);
        
        // Reset distance tracking for incremental calculation
        lastProcessedDistanceRef.current = 0;
        console.log('[RouteSelection] 🔄 Reset lastProcessedDistance to 0 for new tracking session');
        
        await startTracking();
        setScreenMode('tracking');
        
        // Get start address
        if (currentLocation) {
          try {
            const address = await reverseGeocodeLocation(currentLocation);
            setStartAddress(address);
          } catch (error) {
            console.warn('Failed to get start address:', error);
            setStartAddress('Unknown Location');
          }
        }
        
        // Start background tracking
        const tripId = `trip_${Date.now()}`;
        backgroundTrackingId.current = tripId;
        
        const success = await startBackgroundLocationTracking(
          tripId,
          selectedMotor,
          {
            distance: 0,
            fuelConsumed: 0,
            duration: 0,
            avgSpeed: 0,
            speed: 0,
          }
        );
        
        if (success) {
          isBackgroundTracking.current = true;
          Toast.show({
            type: 'success',
            text1: 'Tracking Started',
            text2: 'Will continue in background',
          });
        } else {
          Toast.show({
            type: 'error',
            text1: 'Tracking Started',
            text2: 'Background tracking unavailable',
          });
        }
      } catch (error: any) {
        Toast.show({
          type: 'error',
          text1: 'Tracking Error',
          text2: error.message || 'Failed to start',
        });
      } finally {
        setIsLoading(false);
      }
    } else {
      // Get end address before stopping
      if (currentLocation) {
        try {
          const address = await reverseGeocodeLocation(currentLocation);
          setEndAddress(address);
        } catch (error) {
          console.warn('Failed to get end address:', error);
          setEndAddress('Unknown Location');
        }
      } else {
        setEndAddress('Unknown Location');
      }
      
      // Stop both foreground and background tracking
      await safeStopBackgroundLocation();
      isBackgroundTracking.current = false;
      backgroundTrackingId.current = null;
      
      // Reset distance tracking
      lastProcessedDistanceRef.current = 0;
      console.log('[RouteSelection] 🔄 Reset lastProcessedDistance to 0 after stopping tracking');
      
      stopTracking();
      setScreenMode('summary');
      setShowTripSummary(true);
      Toast.show({
        type: 'info',
        text1: 'Tracking Stopped',
      });
    }
  }, [selectedMotor, isTracking, startTracking, stopTracking, currentLocation, handleGetCurrentLocation]);

  // Background tracking functions
  const startBackgroundTracking = useCallback(async () => {
    if (!selectedMotor || !isTracking || isBackgroundTracking.current) return;
    
    try {
      const tripId = backgroundTrackingId.current || `trip_${Date.now()}`;
      backgroundTrackingId.current = tripId;
      
      const success = await startBackgroundLocationTracking(
        tripId,
        selectedMotor,
        rideStats
      );
      
      if (success) {
        isBackgroundTracking.current = true;
        console.log('[RouteSelection] Background tracking started');
        
        Toast.show({
          type: 'info',
          text1: 'Background Tracking',
          text2: 'Will continue in background',
          visibilityTime: 2000,
        });
      } else {
        console.warn('[RouteSelection] Background tracking failed to start');
        Toast.show({
          type: 'error',
          text1: 'Background Tracking',
          text2: 'Limited functionality in background',
          visibilityTime: 2000,
        });
      }
    } catch (error) {
      console.error('[RouteSelection] Error starting background tracking:', error);
      Toast.show({
        type: 'error',
        text1: 'Background Tracking',
        text2: 'Failed to start',
        visibilityTime: 2000,
      });
    }
  }, [selectedMotor, isTracking, rideStats]);

  const stopBackgroundTracking = useCallback(async () => {
    try {
      await stopBackgroundLocationTracking();
      isBackgroundTracking.current = false;
      backgroundTrackingId.current = null;
      console.log('[RouteSelection] Background tracking stopped');
    } catch (error) {
      console.error('[RouteSelection] Error stopping background tracking:', error);
    }
  }, []);

  // Maintenance form state
  const [maintenanceFormVisible, setMaintenanceFormVisible] = useState(false);
  const [maintenanceFormData, setMaintenanceFormData] = useState({
    type: '' as 'refuel' | 'oil_change' | 'tune_up' | '',
    cost: '',
    quantity: '',
    costPerLiter: '',
    notes: ''
  });

  // Handle maintenance form changes
  const handleMaintenanceFormChange = useCallback((field: keyof typeof maintenanceFormData, value: string) => {
    setMaintenanceFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  // Handle maintenance form save
  const handleMaintenanceFormSave = useCallback(() => {
    if (!maintenanceFormData.type) return;
    saveMaintenanceRecord(maintenanceFormData.type, maintenanceFormData);
  }, [maintenanceFormData]);

  // Maintenance action handler - opens form modal
  const handleMaintenanceAction = useCallback((actionType: 'refuel' | 'oil_change' | 'tune_up') => {
    if (!currentLocation || !selectedMotor) {
      Alert.alert('Error', 'Location or motor data not available');
      return;
    }

    // Set form data and show modal
    setMaintenanceFormData({ 
      type: actionType, 
      cost: '', 
      quantity: '', 
      costPerLiter: '',
      notes: '' 
    });
    setMaintenanceFormVisible(true);
  }, [currentLocation, selectedMotor]);

  // Save maintenance record
  const saveMaintenanceRecord = async (
    actionType: 'refuel' | 'oil_change' | 'tune_up',
    formData: typeof maintenanceFormData
  ) => {
    try {
      if (!user?._id || !selectedMotor?._id) throw new Error('Missing user or motor data');
      
      const cost = parseFloat(formData.cost) || 0;
      const costPerLiter = parseFloat(formData.costPerLiter) || 0;
      let quantity = formData.quantity ? parseFloat(formData.quantity) : undefined;

      // Calculate quantity from cost and cost per liter for refuel actions
      if (actionType === 'refuel' && cost > 0 && costPerLiter > 0) {
        quantity = cost / costPerLiter;
        console.log('[RouteSelection] Calculated quantity from cost and cost per liter:', {
          cost,
          costPerLiter,
          calculatedQuantity: quantity
        });
      }

      const newAction = {
        type: actionType,
        timestamp: Date.now(),
        location: currentLocation
          ? { latitude: currentLocation.latitude, longitude: currentLocation.longitude }
          : { latitude: 0, longitude: 0 },
        details: { 
          cost, 
          quantity, 
          costPerLiter: actionType === 'refuel' ? costPerLiter : undefined,
          notes: formData.notes 
        }
      };

      // Save to backend
      const response = await fetch(`${LOCALHOST_IP}/api/maintenance-records`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user._id,
          motorId: selectedMotor._id,
          type: actionType,
          timestamp: newAction.timestamp,
          location: newAction.location,
          details: newAction.details
        })
      });

      if (!response.ok) throw new Error('Failed to save maintenance record');
      const savedRecord = await response.json();
      console.log('✅ Maintenance record saved:', savedRecord);

        // If it's a refuel, update the motor's fuel level using local calculation
        if (actionType === 'refuel' && quantity && quantity > 0) {
          const motorData = {
            fuelConsumption: selectedMotor.fuelConsumption || selectedMotor.fuelEfficiency || 0,
            fuelTank: selectedMotor.fuelTank || 15, // Default tank size if not provided
            currentFuelLevel: selectedMotor.currentFuelLevel || 0
          };
          
          if (motorData.fuelConsumption > 0 && motorData.fuelTank > 0) {
            const newFuelLevel = calculateFuelLevelAfterRefuel(motorData, quantity);
            
            // Validate fuel level before processing
            if (!validateFuelLevel(newFuelLevel, selectedMotor._id)) {
              throw new Error(`Invalid fuel level after refuel: ${newFuelLevel}. Must be between 0 and 100.`);
            }
            
            console.log('[RouteSelection] Refuel calculation:', {
              currentFuelLevel: motorData.currentFuelLevel,
              refuelAmount: quantity,
              newFuelLevel,
              costPerLiter,
              fuelTank: motorData.fuelTank
            });
            
            // Update fuel level to backend with comprehensive logging
            await updateFuelLevel(selectedMotor._id, newFuelLevel);
            
            console.log('[RouteSelection] ✅ Refuel fuel level updated to backend:', {
              motorId: selectedMotor._id,
              refuelAmount: quantity,
              costPerLiter,
              oldFuelLevel: motorData.currentFuelLevel,
              newFuelLevel,
              fuelTank: motorData.fuelTank
            });
            
            // Update local state immediately
            setSelectedMotor(prev => {
              if (!prev) return null;
              return { 
                ...prev, 
                currentFuelLevel: newFuelLevel,
                fuelTank: motorData.fuelTank // Ensure fuelTank is set
              };
            });
            
            console.log('[RouteSelection] ✅ Updated selectedMotor with new fuel level:', newFuelLevel);
          } else {
            console.warn('[RouteSelection] Cannot calculate refuel - missing motor data:', {
              fuelConsumption: motorData.fuelConsumption,
              fuelTank: motorData.fuelTank,
              currentFuelLevel: motorData.currentFuelLevel
            });
          }
        }
      
      setMaintenanceFormVisible(false);
      setMaintenanceFormData({ 
        type: '', 
        cost: '', 
        quantity: '', 
        costPerLiter: '',
        notes: '' 
      });
      
      // Add to trip maintenance actions
      setTripMaintenanceActions(prev => [...prev, {
        type: actionType,
        timestamp: newAction.timestamp,
        cost: cost,
        quantity: quantity,
        costPerLiter: actionType === 'refuel' ? costPerLiter : undefined,
        notes: formData.notes
      }]);

      Toast.show({
        type: 'success',
        text1: 'Maintenance Recorded',
        text2: `${actionType.replace('_', ' ')} recorded successfully`,
        position: 'top',
        visibilityTime: 3000
      });
    } catch (error: any) {
      console.error('Error in saveMaintenanceRecord:', error);
      Alert.alert('Error', error.message || 'Failed to save maintenance record');
    }
  };

  const handleMotorSelect = useCallback((motor: Motor) => {
    setSelectedMotor(motor);
    setShowMotorSelector(false);
    lastFuelWarningLevel.current = motor.currentFuelLevel; // Reset warning level
  }, []);

  const handleTripCancel = useCallback(async () => {
    // Update fuel level to backend even if trip is cancelled
    if (selectedMotor && rideStats.distance > 0) {
      try {
        console.log('[RouteSelection] Updating fuel level to backend after trip cancellation:', {
          motorId: selectedMotor._id,
          currentFuelLevel: selectedMotor.currentFuelLevel,
          distanceTraveled: rideStats.distance,
          timestamp: new Date().toISOString()
        });
        
        await updateFuelLevel(selectedMotor._id, selectedMotor.currentFuelLevel);
        console.log('[RouteSelection] ✅ Fuel level updated to backend after trip cancellation');
      } catch (error) {
        console.warn('[RouteSelection] ❌ Failed to update fuel level to backend after cancellation:', {
          motorId: selectedMotor._id,
          currentFuelLevel: selectedMotor.currentFuelLevel,
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    }

    // Clear trip cache
    await clearTripData();

    // Reset tracking without saving
    resetTracking();
    
    // Reset distance tracking
    lastProcessedDistanceRef.current = 0;
    console.log('[RouteSelection] 🔄 Reset lastProcessedDistance to 0 after trip cancellation');
    
    setScreenMode('planning');
    setShowTripSummary(false);
    setStartAddress('');
    setEndAddress('');
    setTripMaintenanceActions([]); // Reset maintenance actions
    
    Toast.show({
      type: 'info',
      text1: 'Trip Cancelled',
      text2: 'Trip data discarded',
    });
  }, [resetTracking, selectedMotor, rideStats.distance, clearTripData]);

  const handleTripSave = useCallback(async () => {
    if (!selectedMotor || !user) {
      Toast.show({
        type: 'error',
        text1: 'Save Failed',
        text2: 'Missing data',
      });
      return;
    }

    try {
      setIsLoading(true);
      
      // Save trip to history before clearing cache
      if (currentTrip) {
        await completeTrip();
      }
      
      // Get start and end coordinates
      const startCoords = routeCoordinates[0] || currentLocation;
      const endCoords = routeCoordinates[routeCoordinates.length - 1] || currentLocation;
      
      // Reverse geocode addresses (optional, with fallback)
      let startAddress = "Start Location";
      let endAddress = "End Location";
      
      try {
        if (startCoords) {
          startAddress = await reverseGeocodeLocation(startCoords);
        }
        if (endCoords) {
          endAddress = await reverseGeocodeLocation(endCoords);
        }
      } catch (error) {
        console.warn('[TripSave] Reverse geocoding failed, using default addresses');
      }
      
      console.log('[TripSave] Preparing trip data:', {
        userId: user._id,
        motorId: selectedMotor._id,
        actualDistance: rideStats.distance,
        duration: Math.round(rideStats.duration / 60),
        avgSpeed: rideStats.avgSpeed,
        routeCoordinatesLength: routeCoordinates.length,
        rideStatsFull: rideStats // Log full rideStats for debugging
      });

      // Validate required fields before sending
      if (!user._id) {
        throw new Error('User ID is required');
      }
      if (!selectedMotor._id) {
        throw new Error('Motor ID is required');
      }
      
      // For free drive, allow very small distances (even 0) as it's valid
      // Only reject if distance is negative or undefined
      if (rideStats.distance === undefined || rideStats.distance === null || rideStats.distance < 0) {
        throw new Error('Invalid distance data');
      }
      
      // Optional: Warn if distance is very small (less than 10 meters)
      if (rideStats.distance < 0.01) {
        console.warn('[TripSave] Very small distance detected:', rideStats.distance, 'km');
        // Show a warning to the user but still allow saving
        Toast.show({
          type: 'info',
          text1: 'Short Trip',
          text2: 'Distance is very small. Trip will still be saved.',
          position: 'top',
          visibilityTime: 3000
        });
      }
      
      // Ensure we have valid values for the trip data
      const actualDistance = rideStats.distance || 0;
      const actualDuration = Math.round((rideStats.duration || 0) / 60);
      const actualAvgSpeed = rideStats.avgSpeed || 0;
      
      console.log('[TripSave] Distance validation passed:', {
        originalDistance: rideStats.distance,
        actualDistance,
        duration: actualDuration,
        avgSpeed: actualAvgSpeed
      });
      
      const tripData = {
        // Required fields
        userId: user._id,
        motorId: selectedMotor._id,
        destination: "Free Drive", // Since it's free drive without route planning
        
        // 🟡 Estimated (Planned) - Required fields with default values for free drive
        distance: 0, // Required: No planned distance for free drive
        fuelUsedMin: 0, // Required: No planned fuel usage for free drive
        fuelUsedMax: 0, // Required: No planned fuel usage for free drive
        eta: null, // Optional: No ETA for free drive
        timeArrived: null, // Optional: No arrival time for free drive
        
        // 🟢 Actual (Tracked) - Real data from tracking
        tripStartTime: new Date(), // Current time as start
        tripEndTime: new Date(), // Current time as end
        actualDistance: actualDistance, // Use validated distance
        actualFuelUsedMin: 0, // Optional: Can be calculated if needed
        actualFuelUsedMax: 0, // Optional: Can be calculated if needed
        duration: actualDuration, // Use validated duration
        kmph: actualAvgSpeed, // Use validated speed
        
        // 📍 Location - Convert coordinates to required format
        startLocation: {
          address: startAddress,
          lat: startCoords?.latitude || 0,
          lng: startCoords?.longitude || 0,
        },
        endLocation: {
          address: endAddress,
          lat: endCoords?.latitude || 0,
          lng: endCoords?.longitude || 0,
        },
        
        // 🛣 Routing - Convert route coordinates to polyline
        plannedPolyline: null, // No planned route for free drive
        actualPolyline: routeCoordinates.length > 0 ? JSON.stringify(routeCoordinates) : null,
        wasRerouted: false, // Free drive doesn't have rerouting
        rerouteCount: 0,
        
        // 🔁 Background & Analytics
        wasInBackground: false, // Assume app was in foreground
        showAnalyticsModal: false,
        analyticsNotes: `Free drive completed with ${selectedMotor.nickname}`,
        trafficCondition: "moderate", // Default traffic condition
        
        // 🧭 Trip Summary
        isSuccessful: true,
        status: "completed",
      };

      console.log('[TripSave] Sending trip data to API:', {
        url: `${LOCALHOST_IP}/api/trips`,
        method: 'POST',
        hasToken: !!user.token,
        tripDataKeys: Object.keys(tripData)
      });

      const response = await fetch(`${LOCALHOST_IP}/api/trips`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token || ''}`,
        },
        body: JSON.stringify(tripData),
      });

      console.log('[TripSave] API Response:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[TripSave] API Error Response:', errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const responseData = await response.json();
      console.log('[TripSave] ✅ Trip saved successfully:', responseData);

      // Update motor analytics
      setSelectedMotor(prev => prev ? {
        ...prev,
        analytics: {
          ...prev.analytics,
          totalDistance: prev.analytics.totalDistance + rideStats.distance,
          tripsCompleted: prev.analytics.tripsCompleted + 1,
        },
      } : null);

      // Update fuel level to backend after trip completion
      if (selectedMotor && rideStats.distance > 0) {
        try {
          console.log('[RouteSelection] Updating fuel level to backend after trip save:', {
            motorId: selectedMotor._id,
            currentFuelLevel: selectedMotor.currentFuelLevel,
            distanceTraveled: rideStats.distance,
            duration: rideStats.duration,
            timestamp: new Date().toISOString()
          });
          
          await updateFuelLevel(selectedMotor._id, selectedMotor.currentFuelLevel);
          console.log('[RouteSelection] ✅ Fuel level updated to backend after trip save');
        } catch (error) {
          console.warn('[RouteSelection] ❌ Failed to update fuel level to backend after save:', {
            motorId: selectedMotor._id,
            currentFuelLevel: selectedMotor.currentFuelLevel,
            error: error.message,
            timestamp: new Date().toISOString()
          });
        }
      }

      resetTracking();
      setScreenMode('planning');
      setShowTripSummary(false);
      setTripMaintenanceActions([]); // Reset maintenance actions
      
      Toast.show({
        type: 'success',
        text1: 'Trip Saved',
      });
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Save Failed',
        text2: error.message || 'Unknown error',
      });
    } finally {
      setIsLoading(false);
    }
  }, [rideStats, routeCoordinates, resetTracking, selectedMotor, user, currentLocation]);

  const handleReportSuccess = useCallback(() => {
    setShowReportModal(false);
    // Refresh reports data to show the newly submitted report
    refreshData();
  }, [refreshData]);

  // Trip recovery handlers
  const handleRecoverTrip = useCallback(async () => {
    try {
      if (!currentTrip) return;

      console.log('[RouteSelection] Recovering trip:', currentTrip.tripId);

      // Restore trip state
      setScreenMode(currentTrip.screenMode);
      setCurrentLocation(currentTrip.currentLocation);
      setRegion(currentTrip.region);
      setSelectedMotor(currentTrip.selectedMotor);
      setStartAddress(currentTrip.startAddress);
      setEndAddress(currentTrip.endAddress);
      setTripMaintenanceActions(currentTrip.tripMaintenanceActions);

      // Restore tracking state if it was tracking
      if (currentTrip.isTracking) {
        // Note: You might need to restore tracking state here
        // This depends on your useTracking hook implementation
        console.log('[RouteSelection] Trip was tracking, restoring tracking state...');
      }

      // Close recovery modal
      setShowTripRecovery(false);

      Toast.show({
        type: 'success',
        text1: 'Trip Recovered',
        text2: 'Your trip has been restored successfully',
      });
    } catch (error) {
      console.error('[RouteSelection] Failed to recover trip:', error);
      Toast.show({
        type: 'error',
        text1: 'Recovery Failed',
        text2: 'Failed to recover trip data',
      });
    }
  }, [currentTrip]);

  const handleDiscardTrip = useCallback(async () => {
    try {
      await clearTripData();
      setShowTripRecovery(false);
      
      Toast.show({
        type: 'info',
        text1: 'Trip Discarded',
        text2: 'Trip data has been cleared',
      });
    } catch (error) {
      console.error('[RouteSelection] Failed to discard trip:', error);
      Toast.show({
        type: 'error',
        text1: 'Discard Failed',
        text2: 'Failed to clear trip data',
      });
    }
  }, [clearTripData]);

  // Optimized: Toggle markers visibility with stable reference
  const toggleMarkersVisibility = useCallback(() => {
    setShowReports(prev => !prev);
    setShowGasStations(prev => !prev);
  }, []);

  const navigateToRoutePlanning = useCallback(() => {
    if (!currentLocation) {
      handleGetCurrentLocation(false);
      return;
    }
    navigation.navigate('MapScreenTry', {
      currentLocation,
      mapStyle: 'standard',
      fromRoute: true,
    });
  }, [navigation, currentLocation, handleGetCurrentLocation]);

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.container}>
            {/* Map Component */}
            <MapComponent
              mapRef={mapRef}
              region={region}
              mapStyle="standard"
              currentLocation={currentLocation}
              userId={user?._id}
              reportMarkers={effectiveReports}
              gasStations={effectiveGasStations}
              showReports={showReports}
              showGasStations={showGasStations}
              routeCoordinates={routeCoordinates}
              snappedRouteCoordinates={snappedRouteCoordinates}
              isTracking={isTracking}
              onReportVoted={refreshData}
            />

            {/* Speedometer - Only show when tracking */}
            {isTracking && (
              <View style={styles.speedometerContainer}>
                <Speedometer
                  speed={rideStats.speed}
                  isTracking={isTracking}
                />
              </View>
            )}

            {/* Tracking Stats */}
            <TrackingStats
              rideStats={rideStats}
              isVisible={isTracking}
              selectedMotor={selectedMotor}
            />

            {/* My Location Button */}
            <TouchableOpacity
              style={styles.fabLocate}
              onPress={() => handleGetCurrentLocation(false)}
              disabled={!locationPermissionGranted}
              activeOpacity={0.8}
            >
              <MaterialIcons 
                name="my-location" 
                size={24} 
                color={locationPermissionGranted ? '#000' : '#999'} 
              />
            </TouchableOpacity>

            {/* DEBUG: Enhanced Cache Indicator */}
            {/* <View style={styles.debugBadge}>
              <TouchableOpacity
                style={styles.debugRefreshButton}
                onPress={() => user?._id && forceRefreshMotors(user._id)}
              >
                <MaterialIcons name="refresh" size={12} color="#FFF" />
              </TouchableOpacity>
              <Text style={styles.debugText}>
                Motors: {effectiveMotors.length}
              </Text>
              <Text style={styles.debugTextSmall}>
                API: {motors?.length || 0} | Local: {localMotors?.length || 0} | Global: {cachedMotors?.length || 0}
              </Text>
              <Text style={styles.debugTextSmall}>
                Reports: {effectiveReports.length} | Gas: {effectiveGasStations.length}
              </Text>
              <Text style={styles.debugTextSmall}>
                Cache: {cacheLoading ? 'Loading...' : 'Ready'}
              </Text>
              <Text style={styles.debugTextSmall}>
                Background: {isBackgroundTracking.current ? 'Active' : 'Inactive'}
              </Text>
              <Text style={styles.debugTextSmall}>
                Tracking: {isTracking ? 'ON' : 'OFF'}
              </Text>
            </View> */}

            {/* Control Buttons */}
            <View style={styles.floatingButtonsContainer}>
              <View style={styles.rightButtons}>
                {/* Motor Selection */}
                <TouchableOpacity
                  style={[styles.motorButton, { backgroundColor: '#2196F3' }]}
                  onPress={() => setShowMotorSelector(true)}
                >
                  <MaterialIcons name="two-wheeler" size={width * 0.08} color="#FFF" />
                  <Text style={styles.motorButtonText}>
                    {selectedMotor?.nickname || 'Select Motor'}
                  </Text>
                  <View style={styles.motorStats}>
                    <MaterialIcons name="local-gas-station" size={width * 0.03} color="#FFF" />
                    <Text style={styles.motorStatsText}>
                      {selectedMotor?.currentFuelLevel?.toFixed(0) || '0'}%
                    </Text>
                    <MaterialIcons name="speed" size={width * 0.03} color="#FFF" />
                    <Text style={styles.motorStatsText}>
                      {selectedMotor?.fuelEfficiency || '0'} km/L
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* Play/Stop Button */}
                <TouchableOpacity
                  style={[
                    styles.playButton,
                    { backgroundColor: isTracking ? '#FF5722' : '#4CAF50' }
                  ]}
                  onPress={handleTrackingToggle}
                >
                  <MaterialIcons
                    name={isTracking ? 'stop' : 'play-arrow'}
                    size={width * 0.08}
                    color="#FFF"
                  />
                </TouchableOpacity>

                {/* Action Buttons */}
                <View style={styles.smallButtonsContainer}>
                  <View style={styles.smallButtonsRow}>
                    <TouchableOpacity
                      style={[styles.smallButton, styles.reportButton]}
                      onPress={() => setShowReportModal(true)}
                    >
                      <MaterialIcons name="warning" size={width * 0.04} color="#FFF" />
                    </TouchableOpacity>

                    {isTracking ? (
                      <TouchableOpacity
                        style={[styles.smallButton, styles.maintenanceButton]}
                        onPress={() => {
                          Alert.alert(
                            'Record Maintenance',
                            'Select maintenance type:',
                            [
                              {
                                text: 'Refuel',
                                onPress: () => handleMaintenanceAction('refuel')
                              },
                              {
                                text: 'Oil Change',
                                onPress: () => handleMaintenanceAction('oil_change')
                              },
                              {
                                text: 'Tune Up',
                                onPress: () => handleMaintenanceAction('tune_up')
                              },
                              {
                                text: 'Cancel',
                                style: 'cancel'
                              }
                            ]
                          );
                        }}
                      >
                        <MaterialIcons name="build" size={width * 0.04} color="#FFF" />
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        style={[styles.smallButton, styles.routeButton]}
                        onPress={navigateToRoutePlanning}
                      >
                        <MaterialIcons name="route" size={width * 0.04} color="#000" />
                      </TouchableOpacity>
                    )}

                    <TouchableOpacity
                      style={[
                        styles.smallButton,
                        { backgroundColor: showGasStations ? '#4CAF50' : '#9E9E9E' }
                      ]}
                      onPress={toggleMarkersVisibility}
                    >
                      <MaterialIcons
                        name="visibility"
                        size={width * 0.04}
                        color={showGasStations ? '#FFF' : '#000'}
                      />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.logoContainer}>
                    <Text style={styles.logoText}>TrafficSlight</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Modals */}
            <MotorSelector
              visible={showMotorSelector}
              motors={effectiveMotors}
              selectedMotor={selectedMotor}
              isTracking={isTracking}
              onClose={() => setShowMotorSelector(false)}
              onSelectMotor={handleMotorSelect}
              currentTripDistance={rideStats.distance}
            />

            <TrafficReportModal
              visible={showReportModal}
              user={user}
              currentLocation={currentLocation}
              onClose={() => setShowReportModal(false)}
              onSuccess={handleReportSuccess}
            />

            <TripSummaryModal
              visible={showTripSummary}
              rideStats={rideStats}
              onClose={() => setShowTripSummary(false)}
              onSave={handleTripSave}
              onCancel={handleTripCancel}
              selectedMotor={selectedMotor}
              startAddress={startAddress}
              endAddress={endAddress}
              tripMaintenanceActions={tripMaintenanceActions}
            />

            <TripRecoveryModal
              visible={showTripRecovery}
              tripData={currentTrip}
              onRecover={handleRecoverTrip}
              onDiscard={handleDiscardTrip}
              onClose={() => setShowTripRecovery(false)}
            />

            {/* Maintenance Form Modal */}
            <Modal visible={maintenanceFormVisible} transparent animationType="slide" onRequestClose={() => setMaintenanceFormVisible(false)}>
              <View style={styles.modalOverlay}>
                <View style={styles.formModal}>
                  <Text style={styles.formTitle}>
                    {maintenanceFormData.type
                      .split('_')
                      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                      .join(' ')}
                  </Text>

                  {/* Cost */}
                  <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>Total Cost (₱)</Text>
                    <TextInput
                      style={styles.input}
                      keyboardType="numeric"
                      value={maintenanceFormData.cost}
                      onChangeText={text => handleMaintenanceFormChange('cost', text)}
                      placeholder="Enter total cost"
                    />
                  </View>

                  {/* Refuel-specific fields */}
                  {maintenanceFormData.type === 'refuel' && (
                    <>
                      {/* Cost per liter */}
                      <View style={styles.inputContainer}>
                        <Text style={styles.inputLabel}>Cost per Liter (₱)</Text>
                        <TextInput
                          style={styles.input}
                          keyboardType="numeric"
                          value={maintenanceFormData.costPerLiter}
                          onChangeText={text => handleMaintenanceFormChange('costPerLiter', text)}
                          placeholder="Enter cost per liter"
                        />
                      </View>

                      {/* Calculated quantity display */}
                      {maintenanceFormData.cost && maintenanceFormData.costPerLiter && (
                        <View style={styles.inputContainer}>
                          <Text style={styles.inputLabel}>Calculated Quantity (L)</Text>
                          <View style={styles.calculatedQuantityContainer}>
                            <Text style={styles.calculatedQuantityText}>
                              {(parseFloat(maintenanceFormData.cost) / parseFloat(maintenanceFormData.costPerLiter)).toFixed(2)}L
                            </Text>
                            <Text style={styles.calculatedQuantitySubtext}>
                              {maintenanceFormData.cost} ÷ {maintenanceFormData.costPerLiter} = {(parseFloat(maintenanceFormData.cost) / parseFloat(maintenanceFormData.costPerLiter)).toFixed(2)}L
                            </Text>
                          </View>
                        </View>
                      )}
                    </>
                  )}

                  {/* Quantity for oil change */}
                  {maintenanceFormData.type === 'oil_change' && (
                    <View style={styles.inputContainer}>
                      <Text style={styles.inputLabel}>Oil Quantity (L)</Text>
                      <TextInput
                        style={styles.input}
                        keyboardType="numeric"
                        value={maintenanceFormData.quantity}
                        onChangeText={text => handleMaintenanceFormChange('quantity', text)}
                        placeholder="Enter oil quantity in liters"
                      />
                    </View>
                  )}

                  {/* Notes */}
                  <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>Notes</Text>
                    <TextInput
                      style={[styles.input, styles.notesInput]}
                      value={maintenanceFormData.notes}
                      onChangeText={text => handleMaintenanceFormChange('notes', text)}
                      placeholder={`Add notes about the ${maintenanceFormData.type.replace('_', ' ')} (optional)`}
                      multiline
                    />
                  </View>

                  {/* Buttons */}
                  <View style={styles.formButtons}>
                    <TouchableOpacity onPress={() => setMaintenanceFormVisible(false)} style={[styles.formButton, styles.cancelButton]}>
                      <Text style={styles.buttonText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handleMaintenanceFormSave} style={[styles.formButton, styles.saveButton]}>
                      <Text style={[styles.buttonText, styles.saveButtonText]}>Save</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </Modal>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
      <Toast />
    </SafeAreaView>
  );
}

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
  cancelButton: {
    backgroundColor: '#e74c3c',
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
  debugBadge: {
    position: 'absolute',
    top: 60,
    left: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    padding: 8,
    borderRadius: 8,
    zIndex: 1000,
    minWidth: 200,
    maxWidth: 250,
  },
  debugText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  debugTextSmall: {
    color: '#AAA',
    fontSize: 10,
    marginTop: 2,
  },
  debugRefreshButton: {
    position: 'absolute',
    top: 2,
    right: 2,
    padding: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 12,
  },
  speedometerContainer: {
    position: 'absolute',
    top: 160,
    right: 16,
    zIndex: 1000,
  },
});

