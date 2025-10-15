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
import { reverseGeocodeLocation } from '../utils/location';
import { updateFuelLevel } from '../utils/api';
import { startBackgroundLocationTracking, stopBackgroundLocationTracking, resumeTrackingFromBackground } from '../utils/backgroundLocation';
import { backgroundStateManager } from '../utils/backgroundStateManager';

// Import components
import { MapComponent } from '../components/MapComponent';
import { TrackingStats } from '../components/TrackingStats';
import { MotorSelector } from '../components/MotorSelector';
import { TrafficReportModal } from '../components/TrafficReportModal';
import { TripSummaryModal } from '../components/TripSummaryModal';
import { Speedometer } from '../components/Speedometer';

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
  const [startAddress, setStartAddress] = useState<string>('');
  const [endAddress, setEndAddress] = useState<string>('');

  // Map and UI states
  const [showReports, setShowReports] = useState(true);
  const [showGasStations, setShowGasStations] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  // Motor selection
  const [selectedMotor, setSelectedMotor] = useState<Motor | null>(null);

  // Refs for optimization
  const mapRef = useRef(null);
  const isUserDrivenRegionChange = useRef(false);
  const lastRegionUpdate = useRef<number>(0);
  const hasRequestedLocation = useRef(false);
  const hasShownLowFuelWarning = useRef(false);
  const lastFuelWarningLevel = useRef<number>(100);
  const isBackgroundTracking = useRef(false);
  const backgroundTrackingId = useRef<string | null>(null);

  // Local cache states (similar to HomeScreen)
  const [localMotors, setLocalMotors] = useState<Motor[]>([]);
  const [localReports, setLocalReports] = useState<any[]>([]);
  const [localGasStations, setLocalGasStations] = useState<any[]>([]);
  const [cacheLoading, setCacheLoading] = useState(false);

  // Custom hooks
  const { reports, gasStations, motors, loading, error } = useAppData({
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

  // Memoized effective data with local cache priority
  const effectiveReports = useMemo(() => {
    const result = reports?.length ? reports : (localReports?.length ? localReports : (cachedReports || []));
    console.log('[RouteSelection] Reports Data:', {
      apiReports: reports?.length || 0,
      localReports: localReports?.length || 0,
      globalCachedReports: cachedReports?.length || 0,
      effectiveReports: result?.length || 0,
      source: reports?.length ? 'API' : localReports?.length ? 'Local Cache' : cachedReports?.length ? 'Global Cache' : 'None'
    });
    return result;
  }, [reports, localReports, cachedReports]);

  const effectiveGasStations = useMemo(() => {
    const result = gasStations?.length ? gasStations : (localGasStations?.length ? localGasStations : (cachedGasStations || []));
    console.log('[RouteSelection] Gas Stations Data:', {
      apiGasStations: gasStations?.length || 0,
      localGasStations: localGasStations?.length || 0,
      globalCachedGasStations: cachedGasStations?.length || 0,
      effectiveGasStations: result?.length || 0,
      source: gasStations?.length ? 'API' : localGasStations?.length ? 'Local Cache' : cachedGasStations?.length ? 'Global Cache' : 'None'
    });
    return result;
  }, [gasStations, localGasStations, cachedGasStations]);

  const effectiveMotors = useMemo(() => {
    const result = motors?.length ? motors : (localMotors?.length ? localMotors : (cachedMotors || []));
    console.log('[RouteSelection] Motor Data:', {
      apiMotors: motors?.length || 0,
      localMotors: localMotors?.length || 0,
      globalCachedMotors: cachedMotors?.length || 0,
      effectiveMotors: result?.length || 0,
      source: motors?.length ? 'API' : localMotors?.length ? 'Local Cache' : cachedMotors?.length ? 'Global Cache' : 'None'
    });
    return result;
  }, [motors, localMotors, cachedMotors]);

  // Memoize stats update callback
  const handleStatsUpdate = useCallback((stats: any) => {
    if (stats.distance > 0) {
      setSelectedMotor(prev => {
        if (!prev) return null;
        
        const fuelUsed = stats.fuelConsumed;
        const fuelEfficiency = prev.fuelEfficiency;
        const newFuelLevel = Math.max(0, prev.currentFuelLevel - (fuelUsed / fuelEfficiency) * 100);
        
        return {
          ...prev,
          currentFuelLevel: newFuelLevel,
          analytics: {
            ...prev.analytics,
            totalDistance: prev.analytics.totalDistance + stats.distance,
            totalFuelUsed: prev.analytics.totalFuelUsed + fuelUsed,
          }
        };
      });
    }
  }, []);

  // Tracking hook
  const {
    isTracking,
    rideStats,
    routeCoordinates,
    startTracking,
    stopTracking,
    resetTracking,
  } = useTracking({
    selectedMotor,
    onStatsUpdate: handleStatsUpdate,
  });

  // ============================================================================
  // CONSOLIDATED EFFECTS - Optimized for performance
  // ============================================================================

  // Effect 1: Load cached data on mount (adapted from HomeScreen)
  useEffect(() => {
    if (!user?._id) return;
    loadCachedData();
  }, [user?._id, loadCachedData]);

  // Effect 2: Save data to cache when API data changes (adapted from HomeScreen)
  useEffect(() => {
    if (motors?.length) {
      saveCachedData(motors);
    }
  }, [motors, saveCachedData]);

  useEffect(() => {
    if (reports?.length) {
      saveCachedData(undefined, reports);
    }
  }, [reports, saveCachedData]);

  useEffect(() => {
    if (gasStations?.length) {
      saveCachedData(undefined, undefined, gasStations);
    }
  }, [gasStations, saveCachedData]);

  // Effect 3: Auto-select first motor (ONCE)
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
  }, [effectiveMotors.length, selectedMotor]); // Track both length and selectedMotor

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
    }
  }, [isTracking, screenMode]);

  // Effect 6: Auto-update map during tracking (throttled)
  useEffect(() => {
    if (!isTracking || !currentLocation) return;
    
    const now = Date.now();
    if (now - lastRegionUpdate.current < 1000) return;
    
    const latDiff = Math.abs(region.latitude - currentLocation.latitude);
    const lngDiff = Math.abs(region.longitude - currentLocation.longitude);
    
    if (latDiff > 0.0001 || lngDiff > 0.0001) {
      lastRegionUpdate.current = now;
      const newRegion = {
        ...currentLocation,
        latitudeDelta: 0.0015,
        longitudeDelta: 0.0015,
      };
      mapRef.current?.animateToRegion(newRegion, 500);
    }
  }, [currentLocation?.latitude, currentLocation?.longitude, isTracking]);

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

  // Effect 8: Low fuel warnings (OPTIMIZED - only show once per level)
  useEffect(() => {
    if (!selectedMotor) return;
    
    const fuelLevel = selectedMotor.currentFuelLevel;
    
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
  }, [selectedMotor?.currentFuelLevel, selectedMotor?.nickname]);

  // Effect 9: Request location on mount (ONCE)
  useEffect(() => {
    if (!hasRequestedLocation.current) {
      hasRequestedLocation.current = true;
      handleGetCurrentLocation(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Effect 11: Handle app state changes
  useEffect(() => {
    const handleAppStateChange = (appState: string) => {
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
      backgroundStateManager.removeListener(handleAppStateChange);
    };
  }, [isTracking]);

  // ============================================================================
  // CALLBACK FUNCTIONS
  // ============================================================================

  const handleGetCurrentLocation = useCallback(async (showOverlay: boolean = true) => {
    try {
      isUserDrivenRegionChange.current = true;
      if (showOverlay) setIsLoading(true);
      
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationPermissionGranted(false);
        Toast.show({
          type: 'error',
          text1: 'Location Permission Required',
          text2: 'Please enable location access',
        });
        return;
      }

      setLocationPermissionGranted(true);
      const location = await Location.getCurrentPositionAsync({});
      
      const coords = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
      
      setCurrentLocation(coords);
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
  }, []);

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
        await startTracking();
        setScreenMode('tracking');
        
        // Get start address
        if (currentLocation) {
          try {
            const address = await reverseGeocodeLocation(
              currentLocation.latitude,
              currentLocation.longitude
            );
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
          const address = await reverseGeocodeLocation(
            currentLocation.latitude,
            currentLocation.longitude
          );
          setEndAddress(address);
        } catch (error) {
          console.warn('Failed to get end address:', error);
          setEndAddress('Unknown Location');
        }
      } else {
        setEndAddress('Unknown Location');
      }
      
      // Stop both foreground and background tracking
      await stopBackgroundTracking();
      isBackgroundTracking.current = false;
      backgroundTrackingId.current = null;
      
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
          type: 'warning',
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
      const quantity = formData.quantity ? parseFloat(formData.quantity) : undefined;

      const newAction = {
        type: actionType,
        timestamp: Date.now(),
        location: currentLocation
          ? { latitude: currentLocation.latitude, longitude: currentLocation.longitude }
          : { latitude: 0, longitude: 0 },
        details: { cost, quantity, notes: formData.notes }
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

      // If it's a refuel, update the motor's fuel level
      if (actionType === 'refuel' && quantity) {
        const currentFuelLevel = selectedMotor.currentFuelLevel;
        const newFuelLevel = ((quantity/7) * 100) + currentFuelLevel;
        await updateFuelLevel(selectedMotor._id, newFuelLevel);
      }
      
      setMaintenanceFormVisible(false);
      setMaintenanceFormData({ type: '', cost: '', quantity: '', notes: '' });

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

  const handleTripCancel = useCallback(() => {
    // Reset tracking without saving
    resetTracking();
    setScreenMode('planning');
    setShowTripSummary(false);
    setStartAddress('');
    setEndAddress('');
    
    Toast.show({
      type: 'info',
      text1: 'Trip Cancelled',
      text2: 'Trip data discarded',
    });
  }, [resetTracking]);

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
      
      const tripData = {
        // Required fields
        userId: user._id,
        motorId: selectedMotor._id,
        destination: "Free Drive", // Since it's free drive without route planning
        
        // 🟡 Estimated (Planned) - Set to 0/null for free drive
        distance: 0, // No planned distance for free drive
        fuelUsedMin: 0, // No planned fuel for free drive
        fuelUsedMax: 0, // No planned fuel for free drive
        eta: null, // No ETA for free drive
        timeArrived: null, // No arrival time for free drive
        
        // 🟢 Actual (Tracked) - Real data from tracking
        tripStartTime: new Date(), // Current time as start
        tripEndTime: new Date(), // Current time as end
        actualDistance: rideStats.distance,
        actualFuelUsedMin: rideStats.fuelConsumed,
        actualFuelUsedMax: rideStats.fuelConsumed,
        duration: Math.round(rideStats.duration / 60), // Convert seconds to minutes
        kmph: rideStats.avgSpeed,
        
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

      const response = await fetch(`${LOCALHOST_IP}/api/trips`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token || ''}`,
        },
        body: JSON.stringify(tripData),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      // Update motor analytics
      setSelectedMotor(prev => prev ? {
        ...prev,
        analytics: {
          ...prev.analytics,
          totalDistance: prev.analytics.totalDistance + rideStats.distance,
          tripsCompleted: prev.analytics.tripsCompleted + 1,
          totalFuelUsed: prev.analytics.totalFuelUsed + rideStats.fuelConsumed,
        },
      } : null);

      resetTracking();
      setScreenMode('planning');
      setShowTripSummary(false);
      
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
    // Data will auto-refresh via useAppData
  }, []);

  const toggleMarkersVisibility = useCallback(() => {
    setShowReports(v => !v);
    setShowGasStations(v => !v);
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
              reportMarkers={effectiveReports}
              gasStations={effectiveGasStations}
              showReports={showReports && screenMode !== 'tracking'}
              showGasStations={showGasStations && screenMode !== 'tracking'}
              routeCoordinates={routeCoordinates}
              isTracking={isTracking}
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
                    <Text style={styles.inputLabel}>Cost (₱)</Text>
                    <TextInput
                      style={styles.input}
                      keyboardType="numeric"
                      value={maintenanceFormData.cost}
                      onChangeText={text => handleMaintenanceFormChange('cost', text)}
                      placeholder="Enter cost"
                    />
                  </View>

                  {/* Quantity (show for refuel or oil_change) */}
                  {['refuel', 'oil_change'].includes(maintenanceFormData.type) && (
                    <View style={styles.inputContainer}>
                      <Text style={styles.inputLabel}>
                        {maintenanceFormData.type === 'refuel' ? 'Fuel Quantity (L)' : 'Oil Quantity (L)'}
                      </Text>
                      <TextInput
                        style={styles.input}
                        keyboardType="numeric"
                        value={maintenanceFormData.quantity}
                        onChangeText={text => handleMaintenanceFormChange('quantity', text)}
                        placeholder="Enter quantity in liters"
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

