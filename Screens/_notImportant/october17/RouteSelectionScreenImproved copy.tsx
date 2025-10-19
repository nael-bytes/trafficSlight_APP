import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  StyleSheet,
  View,
  ActivityIndicator,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
  Platform,
  Text,
  TouchableOpacity,
  SafeAreaView,
  Dimensions,
} from 'react-native';
import Toast from 'react-native-toast-message';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import * as Location from 'expo-location';
import { useFocusEffect } from '@react-navigation/native';
import {LOCALHOST_IP} from '@env';

// Import custom hooks and components
import { useUser } from '../AuthContext/UserContextImproved';
import { useAppData } from '../hooks/useAppData';
import { useTracking } from '../hooks/useTracking';
// import { getCurrentLocation } from '../utils/location'; // Not needed since we handle location in component

// Import components
import { MapComponent } from '../components/MapComponent';
import { TrackingStats } from '../components/TrackingStats';
import { MotorSelector } from '../components/MotorSelector';
import { TrafficReportModal } from '../components/TrafficReportModal';
import { TripSummaryModal } from '../components/TripSummaryModal';

// Import types
import type { ScreenMode, Motor, LocationCoords, TrafficReport, GasStation } from '../types';

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

  // Map and UI states
  const [showReports, setShowReports] = useState(true);
  const [showGasStations, setShowGasStations] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [initialDataResolved, setInitialDataResolved] = useState(false);
  const [hasAnyMotorEver, setHasAnyMotorEver] = useState(false);

  // Motor selection
  const [selectedMotor, setSelectedMotor] = useState<Motor | null>(null);

  // Refs
  const mapRef = useRef(null);
  const isUserDrivenRegionChange = useRef(false);
  const lastRegionUpdate = useRef<number>(0);
  const isInitialMount = useRef(true);

  // Custom hooks
  const { reports, gasStations, motors, loading, error, refreshData } = useAppData({
    user,
    isTracking: screenMode === 'tracking',
  });

  // Pull global caches to avoid UI flicker when user data hasn't loaded yet
  const {
    cachedReports,
    cachedGasStations,
    cachedMotors,
  } = useUser();

  // Choose effective data: prefer live data, fallback to cached
  const effectiveReports = reports && reports.length ? reports : (cachedReports || []);
  const effectiveGasStations = gasStations && gasStations.length ? gasStations : (cachedGasStations || []);
  const effectiveMotors = motors && motors.length ? motors : (cachedMotors || []);
  // Debug render summary (isTracking will be logged after hook init)
  console.log('[RouteSelection] render:pre-tracking', {
    loading,
    initialDataResolved,
    counts: {
      reports: reports?.length || 0,
      gasStations: gasStations?.length || 0,
      motors: motors?.length || 0,
      effectiveReports: effectiveReports?.length || 0,
      effectiveGasStations: effectiveGasStations?.length || 0,
      effectiveMotors: effectiveMotors?.length || 0,
    },
    screenMode,
  });

  // Memoize onStatsUpdate to prevent unnecessary re-renders in useTracking
  const handleStatsUpdate = useCallback((stats: any) => {
    // Update selected motor's fuel level based on distance traveled
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

  console.log('[RouteSelection] render:post-trackingssss', { isTracking });

  // Memoize refreshData to prevent unnecessary effect reruns
  const stableRefreshData = useCallback(() => {
    refreshData();
  }, [refreshData]);

  // Set selected motor when motors are loaded
 // Automatically select the first motor only when motors are first loaded
// useEffect(() => {
//     console.log('[RouteSelection] motors changed', {
//       motors: motors?.length || 0,
//       effectiveMotors: effectiveMotors?.length || 0,
//       selectedMotor: selectedMotor?._id,
//     });
//     if (effectiveMotors.length > 0 && !selectedMotor) {
//       console.log('[RouteSelection] auto-select first motor');
//       setSelectedMotor(effectiveMotors[0]);
//     }
//     if (effectiveMotors.length > 0 && !hasAnyMotorEver) {
//       console.log('[RouteSelection] mark hasAnyMotorEver = true');
//       setHasAnyMotorEver(true);
//     }
//   }, [effectiveMotors]); // only depend on effective motors array
useEffect(() => {
    if (!hasAnyMotorEver && effectiveMotors.length > 0) {
      setSelectedMotor((prev) => prev || effectiveMotors[0]);
      setHasAnyMotorEver(true);
    }
  }, [effectiveMotors.length, hasAnyMotorEver]);
  
  
//   useEffect(() => {
//     console.log("Effect running", { 
//       motorsLength: motors.length, 
//       selectedMotorId: selectedMotor?._id, 
//       isTracking 
//     });
//   }, [isTracking, motors, selectedMotor]);


  // Handle focus location from navigation params (only once when it changes)
  useEffect(() => {
    if (focusLocation) {
      isUserDrivenRegionChange.current = true;
      const newRegion = {
        ...focusLocation,
        latitudeDelta: 0.0015,
        longitudeDelta: 0.0015,
      };
      setRegion(newRegion);
      setCurrentLocation(focusLocation);
      
      if (mapRef.current) {
        mapRef.current.animateToRegion(newRegion, 1000);
      }
      // Reset flag after a short delay
      setTimeout(() => {
        isUserDrivenRegionChange.current = false;
      }, 100);
    }
  }, [focusLocation?.latitude, focusLocation?.longitude]);

  // Synchronize screen mode with tracking state
  useEffect(() => {
    if (isTracking && screenMode !== 'tracking') {
      setScreenMode('tracking');
    } else if (!isTracking && screenMode === 'tracking') {
      // Don't automatically change from tracking to planning
      // Let the user manually stop tracking
    }
  }, [isTracking, screenMode]);

  // Auto-update map region when tracking and location changes
  // Use ref to prevent loops - only update if tracking and location changed significantly
  useEffect(() => {
    if (!isTracking || !currentLocation) return;
    
    const now = Date.now();
    // Throttle updates to once per second to prevent rapid re-renders
    if (now - lastRegionUpdate.current < 1000) return;
    
    // Check if location changed significantly (more than 10 meters)
    const latDiff = Math.abs(region.latitude - currentLocation.latitude);
    const lngDiff = Math.abs(region.longitude - currentLocation.longitude);
    const significantChange = latDiff > 0.0001 || lngDiff > 0.0001;
    
    if (significantChange) {
      lastRegionUpdate.current = now;
      const newRegion = {
        ...currentLocation,
        latitudeDelta: 0.0015,
        longitudeDelta: 0.0015,
      };
      
      // Only animate map, don't update region state during tracking to prevent loops
      if (mapRef.current) {
        mapRef.current.animateToRegion(newRegion, 500);
      }
    }
  }, [currentLocation?.latitude, currentLocation?.longitude, isTracking]);

  // Handle data loading errors
  useEffect(() => {
    if (error) {
      Toast.show({
        type: 'error',
        text1: 'Data Loading Error',
        text2: error,
      });
    }
  }, [error]);

  // Handle low fuel warnings
  useEffect(() => {
    if (selectedMotor && selectedMotor.currentFuelLevel <= 20 && selectedMotor.currentFuelLevel > 10) {
      Toast.show({
        type: 'error',
        text1: 'Low Fuel Warning',
        text2: `Your ${selectedMotor.nickname} has ${selectedMotor.currentFuelLevel.toFixed(0)}% fuel remaining`,
      });
    } else if (selectedMotor && selectedMotor.currentFuelLevel <= 10) {
      Toast.show({
        type: 'error',
        text1: 'Critical Fuel Level',
        text2: `Your ${selectedMotor.nickname} has ${selectedMotor.currentFuelLevel.toFixed(0)}% fuel remaining!`,
      });
    }
  }, [selectedMotor?.currentFuelLevel]);

  // Auto-refresh data when returning from background or when tracking stops
  // Only run once on mount - don't track isTracking changes to prevent loops
  useEffect(() => {
    // console.log("LOCALip"+LOCALHOST_IP);
    // You can add AppState listener here if needed
    // AppState.addEventListener('change', handleAppStateChange);
    
    return () => {
      // AppState.removeEventListener('change', handleAppStateChange);
    };
  }, []);

  // Handle location permission and get current location
  const handleGetCurrentLocation = useCallback(async (showOverlay: boolean = true) => {
    try {
    //   console.log('[RouteSelection] getCurrentLocation:start', { showOverlay });
      // Mark as user-driven change
      isUserDrivenRegionChange.current = true;
      
      // Avoid overlapping spinners on rapid taps
      if (showOverlay) setIsLoading(true);
      
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.log('[RouteSelection] getCurrentLocation:permission-denied');
        setLocationPermissionGranted(false);
        Toast.show({
          type: 'error',
          text1: 'Location Permission Required',
          text2: 'Please enable location access in settings',
        });
        return;
      }

      setLocationPermissionGranted(true);
      const location = await Location.getCurrentPositionAsync({});
      console.log('[RouteSelection] getCurrentLocation:acquired', {
        lat: location?.coords?.latitude,
        lng: location?.coords?.longitude,
      });
      
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
      
      if (mapRef.current) {
        mapRef.current.animateToRegion({
          ...coords,
          latitudeDelta: 0.0015,
          longitudeDelta: 0.0015,
        }, 1000);
      }
    } catch (error) {
      console.error('Location error:', error);
      Toast.show({
        type: 'error',
        text1: 'Location Error',
        text2: 'Failed to get current location',
      });
    } finally {
      if (showOverlay) setIsLoading(false);
      isUserDrivenRegionChange.current = false;
      console.log('[RouteSelection] getCurrentLocation:done');
    }
  }, []);

  // Request current location automatically on screen mount
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      handleGetCurrentLocation(false);
    }
  }, [handleGetCurrentLocation]);
  
  

//   useFocusEffect(
//     React.useCallback(() => {
//       // Refresh location on refocus if missing or stale
//       if (!currentLocation && !isLoading) {
//         console.log('[RouteSelection] focus -> request current location');
//         handleGetCurrentLocation(true);
//       }
//       return () => {};
//     }, [currentLocation, isLoading, handleGetCurrentLocation])
//   );

  // Mark initial data resolved once the first non-loading state is reached
  useEffect(() => {
    if (!initialDataResolved) {
      // resolve when either loading finished or we already have effective data from cache
      const hasData = effectiveReports.length > 0 || effectiveGasStations.length > 0 || effectiveMotors.length > 0;
      if (!loading || hasData) {
        console.log('[RouteSelection] initialDataResolved = true');
        setInitialDataResolved(true);
      }
    }
  }, [loading, initialDataResolved, effectiveReports.length, effectiveGasStations.length, effectiveMotors.length]);

  // Handle tracking start/stop
  const handleTrackingToggle = useCallback(async () => {
    if (!selectedMotor) {
      Toast.show({
        type: 'error',
        text1: 'No Motor Selected',
        text2: 'Please select a motor before starting tracking',
      });
      console.log('[RouteSelection] tracking:abort (no motor)');
      return;
    }

    if (!currentLocation) {
      Toast.show({
        type: 'error',
        text1: 'Location Required',
        text2: 'Please get your current location first',
      });
      console.log('[RouteSelection] tracking:abort (no location)');
      return;
    }

    if (!isTracking) {
      try {
        console.log('[RouteSelection] tracking:start');
        setIsLoading(true);
        await startTracking();
        setScreenMode('tracking');
        Toast.show({
          type: 'success',
          text1: 'Tracking Started',
          text2: 'Your trip is now being tracked',
        });
      } catch (error: any) {
        console.error('Tracking start error:', error);
        Toast.show({
          type: 'error',
          text1: 'Tracking Error',
          text2: error.message || 'Failed to start tracking',
        });
      } finally {
        setIsLoading(false);
      }
    } else {
      try {
        console.log('[RouteSelection] tracking:stop');
        stopTracking();
        setScreenMode('summary');
        setShowTripSummary(true);
        Toast.show({
          type: 'info',
          text1: 'Tracking Stopped',
          text2: 'Your trip has been completed',
        });
      } catch (error: any) {
        console.error('Tracking stop error:', error);
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Failed to stop tracking properly',
        });
      }
    }
  }, [selectedMotor, isTracking, startTracking, stopTracking, currentLocation]);

  // Handle motor selection
  const handleMotorSelect = useCallback((motor: Motor) => {
    setSelectedMotor(motor);
    setShowMotorSelector(false);
  }, []);

  // Handle trip summary save
  const handleTripSave = useCallback(async () => {
    if (!selectedMotor || !user) {
      Toast.show({
        type: 'error',
        text1: 'Save Failed',
        text2: 'Missing motor or user data',
      });
      return;
    }

    try {
      setIsLoading(true);
      
      // Prepare trip data
      const tripData = {
        userId: user._id,
        motorId: selectedMotor._id,
        distance: rideStats.distance,
        fuelUsed: rideStats.fuelConsumed,
        duration: rideStats.duration,
        avgSpeed: rideStats.avgSpeed,
        maxSpeed: rideStats.speed,
        startLocation: routeCoordinates[0] || currentLocation,
        endLocation: routeCoordinates[routeCoordinates.length - 1] || currentLocation,
        routeCoordinates: routeCoordinates,
        timestamp: new Date().toISOString(),
        fuelEfficiency: selectedMotor.fuelEfficiency,
      };

      // Save to backend (you'll need to implement this API endpoint)
      const response = await fetch(`${LOCALHOST_IP}/api/trips`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token || ''}`,
        },
        body: JSON.stringify(tripData),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const savedTrip = await response.json();
      console.log('Trip saved successfully:', savedTrip);

      // Update motor analytics
      if (selectedMotor) {
        const updatedMotor = {
          ...selectedMotor,
          analytics: {
            ...selectedMotor.analytics,
            totalDistance: selectedMotor.analytics.totalDistance + rideStats.distance,
            tripsCompleted: selectedMotor.analytics.tripsCompleted + 1,
            totalFuelUsed: selectedMotor.analytics.totalFuelUsed + rideStats.fuelConsumed,
          },
        };
        setSelectedMotor(updatedMotor);
      }

      resetTracking();
      setScreenMode('planning');
      setShowTripSummary(false);
      
      Toast.show({
        type: 'success',
        text1: 'Trip Saved',
        text2: 'Your trip data has been saved successfully',
      });
    } catch (error: any) {
      console.error('Trip save error:', error);
      Toast.show({
        type: 'error',
        text1: 'Save Failed',
        text2: error.message || 'Failed to save trip data',
      });
    } finally {
      setIsLoading(false);
    }
  }, [rideStats, routeCoordinates, resetTracking, selectedMotor, user, currentLocation]);

  // Handle report submission success
  const handleReportSuccess = useCallback(() => {
    console.log('[RouteSelection] report:success -> refresh');
    stableRefreshData();
    setShowReportModal(false);
  }, [stableRefreshData]);

  // Toggle markers visibility
  const toggleMarkersVisibility = useCallback(() => {
    // Do not flip both at once; toggle each independently to avoid rerender churn
    setShowReports((v) => !v);
    setShowGasStations((v) => !v);
  }, []);

  // Navigate to route planning
  const navigateToRoutePlanning = useCallback(() => {
    // If no location yet, request first (Google Maps-like behavior)
    if (!currentLocation) {
      console.log('[RouteSelection] navigateToRoutePlanning:no-location -> request');
      handleGetCurrentLocation(false);
      return;
    }
    console.log('[RouteSelection] navigateToRoutePlanning:proceed');
    navigation.navigate('MapScreenTry', {
      currentLocation,
      mapStyle: 'standard',
      fromRoute: true,
    });
  }, [navigation, currentLocation, handleGetCurrentLocation]);

  // Handle user-driven region changes from map interactions
  const handleRegionChange = useCallback((newRegion: any) => {
    // Only update region state if it's a user-driven change (not programmatic)
    if (!isTracking && isUserDrivenRegionChange.current) {
      setRegion(newRegion);
    }
  }, [isTracking]);

  // Always render the map; skip full-screen loading UI
  // Do not block map if no motors. We'll show an inline prompt later instead.

  // Show error state if no motors available and user is authenticated
//   if (user && motors.length === 0 && !loading && initialDataResolved) {
//     return (
//       <SafeAreaView style={styles.safeArea}>
//         <View style={styles.errorContainer}>
//           <MaterialIcons name="motorcycle" size={64} color="#FF6B6B" />
//           <Text style={styles.errorTitle}>No Motorcycles Found</Text>
//           <Text style={styles.errorMessage}>
//             You need to add a motorcycle before you can start tracking trips.
//           </Text>
//           <TouchableOpacity
//             style={styles.addMotorButton}
//             onPress={() => navigation.navigate('AddMotor')}
//           >
//             <Text style={styles.addMotorButtonText}>Add Motorcycle</Text>
//           </TouchableOpacity>
//         </View>
//       </SafeAreaView>
//     );
//   }

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

            {/* Tracking Stats */}
            <TrackingStats
              rideStats={rideStats}
              isVisible={isTracking}
            />

            {/* Floating My Location button (outside container, like Google Maps) */}
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

            {/* Control Buttons */}
            <View style={styles.floatingButtonsContainer}>
              <View style={styles.rightButtons}>
                {/* Motor Selection Button */}
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

                {/* Small Action Buttons */}
                <View style={styles.smallButtonsContainer}>
                  <View style={styles.smallButtonsRow}>
                    <TouchableOpacity
                      style={[styles.smallButton, styles.reportButton]}
                      onPress={() => setShowReportModal(true)}
                    >
                      <MaterialIcons name="warning" size={width * 0.04} color="#FFF" />
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.smallButton, styles.routeButton]}
                      onPress={navigateToRoutePlanning}
                    >
                      <MaterialIcons name="route" size={width * 0.04} color="#000" />
                    </TouchableOpacity>

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

                  {/* Logo */}
                  <View style={styles.logoContainer}>
                    <Text style={styles.logoText}>TrafficSlight</Text>
                  </View>

                </View>
              </View>
            </View>

            {/* Inline prompt if no motors but allow map usage */}
            {!loading && initialDataResolved && effectiveMotors.length === 0 && !hasAnyMotorEver && (
              <View style={styles.inlinePrompt}>
                <MaterialIcons name="motorcycle" size={18} color="#FF6B6B" />
                <Text style={styles.inlinePromptText}>No motorcycles found. You can still browse the map or</Text>
                <TouchableOpacity onPress={() => navigation.navigate('AddMotor')}>
                  <Text style={styles.inlinePromptLink}> add a motorcycle</Text>
                </TouchableOpacity>
                <Text style={styles.inlinePromptText}>.</Text>
              </View>
            )}

            {/* Modals */}
            <MotorSelector
              visible={showMotorSelector}
              motors={motors}
              selectedMotor={selectedMotor}
              isTracking={isTracking}
              onClose={() => setShowMotorSelector(false)}
              onSelectMotor={handleMotorSelect}
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
            />

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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F2EEEE',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
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
  locationButton: {
    backgroundColor: '#FFF',
  },
  logoContainer: {
    alignItems: 'center',
  },
  logoText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#00ADB5',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  addMotorButton: {
    backgroundColor: '#00ADB5',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  addMotorButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  inlinePrompt: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 180,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3.84,
    elevation: 4,
  },
  inlinePromptText: {
    color: '#333',
    fontSize: 13,
  },
  inlinePromptLink: {
    color: '#007AFF',
    fontSize: 13,
    fontWeight: '600',
  },
});
