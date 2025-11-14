/**
 * useTripManagement Hook
 * 
 * Extracts trip management logic:
 * - Trip save
 * - Trip cancel
 * - Trip recovery
 * - Trip discard
 * - createTripDataForModal
 * 
 * @module useTripManagement
 */

import { useCallback, useEffect, useRef } from 'react';
import Toast from 'react-native-toast-message';
import type { Motor, LocationCoords, RideStats } from '../../types';
import { createTripDataForModal as createTripDataUtil } from './tripUtils';
import { updateFuelLevel } from '../../utils/api';

// Use deployed backend instead of localhost
const API_BASE = "https://ts-backend-1-jyit.onrender.com";

interface UseTripManagementParams {
  selectedMotor: Motor | null;
  user: any;
  rideStats: RideStats;
  routeCoordinates: LocationCoords[] | null;
  snappedRouteCoordinates: LocationCoords[] | null;
  mapState: {
    currentLocation: LocationCoords | null;
    destination: LocationCoords | null;
    region: any;
  };
  startAddress: string;
  endAddress: string;
  tripDataForModal: any;
  tripMaintenanceActions: any[];
  screenMode: 'planning' | 'tracking' | 'summary';
  currentTrip: any;
  isTracking: boolean;
  isBackgroundTracking: React.RefObject<boolean>;
  backgroundTrackingId: React.RefObject<string | null>;
  hasCheckedRecovery: React.RefObject<boolean>;
  setSelectedMotor: (motor: Motor | null | ((prev: Motor | null) => Motor | null)) => void;
  setScreenMode: (mode: 'planning' | 'tracking' | 'summary') => void;
  setShowTripSummary: (show: boolean) => void;
  setStartAddress: (address: string) => void;
  setEndAddress: (address: string) => void;
  setTripMaintenanceActions: (actions: any[]) => void;
  setTripDataForModal: (data: any) => void;
  resetTracking: () => void;
  completeTrip: () => Promise<void>;
  clearTripData: () => Promise<void>;
  saveTripData: (tripData: any) => Promise<void>;
  checkRecoverableTrip: () => Promise<boolean>;
  clearCompletedTrips: () => Promise<void>;
  resetDestinationFlow: () => void;
  lastProcessedDistanceRef: React.RefObject<number>;
  setShowTripRecovery: (show: boolean) => void;
  // Callbacks for restoring trip state
  setCurrentLocation?: (location: LocationCoords | null) => void;
  setRegion?: (region: any) => void;
  setPathCoords?: (coords: LocationCoords[]) => void;
  setFinalPathCoords?: (coords: LocationCoords[]) => void;
  setDistanceTraveled?: (distance: number) => void;
  startTracking?: () => Promise<void> | void;
  setDestination?: (destination: LocationCoords | null) => void;
  setIsNavigating?: (isNavigating: boolean) => void;
  setNavigationStartTime?: (time: number | null) => void;
}

interface UseTripManagementReturn {
  createTripDataForModal: (tripEndTime: Date, hasArrived?: boolean) => any;
  handleTripSave: () => Promise<void>;
  handleTripCancel: () => Promise<void>;
  handleRecoverTrip: () => Promise<void>;
  handleDiscardTrip: () => Promise<void>;
}

/**
 * Custom hook for managing trip operations
 */
export const useTripManagement = ({
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
    setCurrentLocation,
    setRegion,
    setPathCoords,
    setFinalPathCoords,
    setDistanceTraveled,
    startTracking,
    setDestination,
    setIsNavigating,
    setNavigationStartTime,
}: UseTripManagementParams): UseTripManagementReturn => {
  // Create trip data for modal display
  const createTripDataForModal = useCallback((tripEndTime: Date, hasArrived: boolean = false, endAddressOverride?: string) => {
    if (__DEV__) {
      console.log('[useTripManagement] 📝 createTripDataForModal called', {
        tripEndTime: tripEndTime.toISOString(),
        distance: rideStats?.distance,
        duration: rideStats?.duration,
        hasRouteCoordinates: !!routeCoordinates,
        routeCoordinatesCount: routeCoordinates?.length || 0,
        hasArrived,
        hasDestination: !!mapState.destination,
        endAddressOverride,
        currentEndAddress: endAddress,
        timestamp: new Date().toISOString(),
      });
    }

    // Use override address if provided, otherwise use state value
    const finalEndAddress = endAddressOverride || endAddress;

    const tripData = createTripDataUtil({
      tripEndTime,
      rideStats,
      routeCoordinates,
      currentLocation: mapState.currentLocation,
      destination: mapState.destination,
      startAddress,
      endAddress: finalEndAddress,
      selectedMotor,
      isBackgroundTracking: isBackgroundTracking.current,
      hasArrived,
    });

    if (__DEV__) {
      console.log('[useTripManagement] ✅ Trip data created', {
        destination: tripData.destination,
        distance: tripData.distance,
        duration: tripData.duration,
        timestamp: new Date().toISOString(),
      });
    }

    return tripData;
  }, [routeCoordinates, mapState.currentLocation, mapState.destination, rideStats, startAddress, endAddress, selectedMotor, isBackgroundTracking]);

  // Handle trip save
  const handleTripSave = useCallback(async () => {
    if (__DEV__) {
      console.log('[useTripManagement] 💾 handleTripSave called', {
        hasSelectedMotor: !!selectedMotor,
        hasUser: !!user,
        hasTripDataForModal: !!tripDataForModal,
        timestamp: new Date().toISOString(),
      });
    }

    if (!selectedMotor || !user) {
      if (__DEV__) {
        console.warn('[useTripManagement] ❌ Cannot save trip - missing data', {
          hasSelectedMotor: !!selectedMotor,
          hasUser: !!user,
        });
      }

      Toast.show({
        type: 'error',
        text1: 'Save Failed',
        text2: 'Missing data',
      });
      return;
    }

    if (!tripDataForModal) {
      if (__DEV__) {
        console.warn('[useTripManagement] ❌ Cannot save trip - trip data not available');
      }

      Toast.show({
        type: 'error',
        text1: 'Save Failed',
        text2: 'Trip data not available',
      });
      return;
    }

    if (__DEV__) {
      console.log('[useTripManagement] 📤 Preparing trip save', {
        userId: user._id,
        motorId: selectedMotor._id,
        tripData: tripDataForModal,
        timestamp: new Date().toISOString(),
      });
    }

    try {
      // Save trip to history before clearing cache
      if (currentTrip) {
        await completeTrip();
      }

      console.log('[TripSave] Preparing trip data from stored modal data:', {
        userId: user._id,
        motorId: selectedMotor._id,
        tripData: tripDataForModal,
        rideStats: rideStats || { duration: 0, distance: 0, avgSpeed: 0, speed: 0 },
        durationDebug: {
          tripDataDuration: tripDataForModal?.duration,
          rideStatsDuration: (rideStats || {}).duration,
          calculatedDuration: Math.round(((rideStats || {}).duration || 0) / 60),
          tripDataDurationType: typeof tripDataForModal?.duration,
          rideStatsDurationType: typeof (rideStats || {}).duration
        }
      });

      // Validate required fields before sending
      if (!user._id) {
        throw new Error('User ID is required');
      }
      if (!selectedMotor._id) {
        throw new Error('Motor ID is required');
      }

      // Ensure rideStats is defined with safe defaults before validation
      const safeRideStats = rideStats || {
        duration: 0,
        distance: 0,
        avgSpeed: 0,
        speed: 0,
      };

      // For free drive, allow very small distances (even 0) as it's valid
      // Only reject if distance is negative or undefined
      if (safeRideStats.distance === undefined || safeRideStats.distance === null || safeRideStats.distance < 0) {
        throw new Error('Invalid distance data');
      }

      // Optional: Warn if distance is very small (less than 10 meters)
      if (safeRideStats.distance < 0.01) {
        console.warn('[TripSave] Very small distance detected:', safeRideStats.distance, 'km');
        // Show a warning to the user but still allow saving
        Toast.show({
          type: 'info',
          text1: 'Short Trip',
          text2: 'Distance is very small. Trip will still be saved.',
          position: 'top',
          visibilityTime: 3000
        });
      }

      // Use the stored trip data from modal (with fixed timestamps)
      // Ensure routeCoordinates is always an array
      const safeRouteCoordinatesForSave = Array.isArray(routeCoordinates) ? routeCoordinates : [];

      const tripData = {
        // Required fields
        userId: user._id,
        motorId: selectedMotor._id,
        destination: tripDataForModal.destination || "Free Drive",

        // 🟡 Estimated (Planned) - Use data from stored trip data
        distance: tripDataForModal.distance || 0,
        fuelUsedMin: tripDataForModal.fuelUsedMin || 0,
        fuelUsedMax: tripDataForModal.fuelUsedMax || 0,
        eta: tripDataForModal.eta || null,
        timeArrived: tripDataForModal.timeArrived || null,

        // 🟢 Actual (Tracked) - Use fixed timestamps from stored trip data
        tripStartTime: tripDataForModal.tripStartTime || new Date(),
        tripEndTime: tripDataForModal.tripEndTime || new Date(),
        actualDistance: tripDataForModal.actualDistance || safeRideStats.distance || 0,
        actualFuelUsedMin: tripDataForModal.actualFuelUsedMin || 0,
        actualFuelUsedMax: tripDataForModal.actualFuelUsedMax || 0,
        duration: tripDataForModal.duration || Math.round((safeRideStats.duration || 0) / 60),
        kmph: tripDataForModal.kmph || safeRideStats.avgSpeed || 0,

        // 📍 Location - Use stored location data
        startLocation: tripDataForModal.startLocation || {
          address: startAddress || "Start Location",
          lat: safeRouteCoordinatesForSave[0]?.latitude || mapState.currentLocation?.latitude || 0,
          lng: safeRouteCoordinatesForSave[0]?.longitude || mapState.currentLocation?.longitude || 0,
        },
        endLocation: tripDataForModal.endLocation || {
          address: endAddress || "End Location",
          lat: safeRouteCoordinatesForSave[safeRouteCoordinatesForSave.length - 1]?.latitude || mapState.currentLocation?.latitude || 0,
          lng: safeRouteCoordinatesForSave[safeRouteCoordinatesForSave.length - 1]?.longitude || mapState.currentLocation?.longitude || 0,
        },

        // 🛣 Routing - Use stored routing data
        plannedPolyline: tripDataForModal.plannedPolyline || null,
        actualPolyline: tripDataForModal.actualPolyline || (safeRouteCoordinatesForSave.length > 0 ? JSON.stringify(safeRouteCoordinatesForSave) : null),
        wasRerouted: tripDataForModal.wasRerouted || false,
        rerouteCount: tripDataForModal.rerouteCount || 0,

        // 🔁 Background & Analytics - Use stored analytics data
        wasInBackground: tripDataForModal.wasInBackground || false,
        showAnalyticsModal: tripDataForModal.showAnalyticsModal || false,
        analyticsNotes: tripDataForModal.analyticsNotes || `Free drive completed with ${selectedMotor.nickname}`,
        trafficCondition: tripDataForModal.trafficCondition || "moderate",

        // 🧭 Trip Summary - Use stored trip summary data
        isSuccessful: tripDataForModal.isSuccessful || true,
        status: tripDataForModal.status || "completed",
      };

      console.log('[TripSave] Sending trip data to API:', {
        url: `${API_BASE}/api/trips`,
        method: 'POST',
        hasToken: !!user.token,
        tripDataKeys: Object.keys(tripData)
      });

      const response = await fetch(`${API_BASE}/api/trips`, {
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
      if (selectedMotor) {
        setSelectedMotor({
          ...selectedMotor,
          analytics: {
            ...selectedMotor.analytics,
            totalDistance: selectedMotor.analytics.totalDistance + safeRideStats.distance,
            tripsCompleted: selectedMotor.analytics.tripsCompleted + 1,
          },
        });
      }

      // Update fuel level to backend after trip completion
      if (selectedMotor && safeRideStats.distance > 0) {
        try {
          console.log('[useTripManagement] Updating fuel level to backend after trip save:', {
            motorId: selectedMotor._id,
            currentFuelLevel: selectedMotor.currentFuelLevel,
            distanceTraveled: safeRideStats.distance,
            duration: safeRideStats.duration,
            timestamp: new Date().toISOString()
          });

          await updateFuelLevel(selectedMotor._id, selectedMotor.currentFuelLevel);
          console.log('[useTripManagement] ✅ Fuel level updated to backend after trip save');
        } catch (error: any) {
          console.warn('[useTripManagement] ❌ Failed to update fuel level to backend after save:', {
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
      setTripDataForModal(null); // Clear trip data after saving
      setStartAddress(''); // Clear start address
      setEndAddress(''); // Clear end address
      
      // Reset destination flow state to initial state
      resetDestinationFlow();

      Toast.show({
        type: 'success',
        text1: 'Trip Saved',
        text2: 'Trip data saved successfully',
      });
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Save Failed',
        text2: error.message || 'Unknown error',
      });
    }
  }, [rideStats, routeCoordinates, resetTracking, selectedMotor, user, mapState.currentLocation, tripDataForModal, startAddress, endAddress, completeTrip, updateFuelLevel, setSelectedMotor, setScreenMode, setShowTripSummary, setTripMaintenanceActions, setTripDataForModal, setStartAddress, setEndAddress, resetDestinationFlow, currentTrip]);

  // Handle trip cancel
  const handleTripCancel = useCallback(async () => {
    if (__DEV__) {
      console.log('[useTripManagement] 🚫 handleTripCancel called', {
        distance: rideStats?.distance,
        duration: rideStats?.duration,
        hasSelectedMotor: !!selectedMotor,
        timestamp: new Date().toISOString(),
      });
    }

    // Update fuel level to backend even if trip is cancelled
    // Ensure rideStats is defined before accessing
    const safeRideStats = rideStats || { duration: 0, distance: 0, avgSpeed: 0, speed: 0 };
    if (selectedMotor && safeRideStats.distance > 0) {
      if (__DEV__) {
        console.log('[useTripManagement] 🔄 Updating fuel level before trip cancellation', {
          motorId: selectedMotor._id,
          currentFuelLevel: selectedMotor.currentFuelLevel,
          distanceTraveled: safeRideStats.distance,
        });
      }
      try {
        console.log('[useTripManagement] Updating fuel level to backend after trip cancellation:', {
          motorId: selectedMotor._id,
          currentFuelLevel: selectedMotor.currentFuelLevel,
          distanceTraveled: safeRideStats.distance,
          timestamp: new Date().toISOString()
        });

        await updateFuelLevel(selectedMotor._id, selectedMotor.currentFuelLevel);
        console.log('[useTripManagement] ✅ Fuel level updated to backend after trip cancellation');
      } catch (error: any) {
        console.warn('[useTripManagement] ❌ Failed to update fuel level to backend after cancellation:', {
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
    if (lastProcessedDistanceRef.current !== null) {
      lastProcessedDistanceRef.current = 0;
    }
    console.log('[useTripManagement] 🔄 Reset lastProcessedDistance to 0 after trip cancellation');

    // Clear trip data for modal
    setTripDataForModal(null);

    setScreenMode('planning');
    setShowTripSummary(false);
    setStartAddress('');
    setEndAddress('');
    setTripMaintenanceActions([]); // Reset maintenance actions

    // Reset destination flow state to show ActionButtons
    resetDestinationFlow();

    Toast.show({
      type: 'info',
      text1: 'Trip Cancelled',
      text2: 'Trip data discarded',
    });
  }, [resetTracking, selectedMotor, rideStats?.distance || 0, clearTripData, resetDestinationFlow, setTripDataForModal, setScreenMode, setShowTripSummary, setStartAddress, setEndAddress, setTripMaintenanceActions, lastProcessedDistanceRef]);

  // Handle trip recovery
  const handleRecoverTrip = useCallback(async () => {
    if (__DEV__) {
      console.log('[useTripManagement] 🔄 handleRecoverTrip called', {
        hasCurrentTrip: !!currentTrip,
        tripId: currentTrip?.tripId,
        timestamp: new Date().toISOString(),
      });
    }

    try {
      if (!currentTrip) {
        if (__DEV__) {
          console.warn('[useTripManagement] ❌ Cannot recover trip - no trip data');
        }
        return;
      }

      if (__DEV__) {
        console.log('[useTripManagement] 🔄 Recovering trip:', {
          tripId: currentTrip.tripId,
          isTracking: currentTrip.isTracking,
          screenMode: currentTrip.screenMode,
          timestamp: new Date().toISOString(),
        });
      }

      // CRITICAL: Restore all trip state
      // 1. Restore screen mode
      setScreenMode(currentTrip.screenMode);

      // 2. Restore location and region
      if (setCurrentLocation && currentTrip.currentLocation) {
        setCurrentLocation(currentTrip.currentLocation);
        if (__DEV__) {
          console.log('[useTripManagement] ✅ Restored current location:', currentTrip.currentLocation);
        }
      }

      if (setRegion && currentTrip.region) {
        setRegion(currentTrip.region);
        if (__DEV__) {
          console.log('[useTripManagement] ✅ Restored region:', currentTrip.region);
        }
      }

      // 3. Restore destination if it exists
      if (setDestination && currentTrip.endLocation) {
        const destination: LocationCoords = {
          latitude: currentTrip.endLocation.latitude || currentTrip.endLocation.lat,
          longitude: currentTrip.endLocation.longitude || currentTrip.endLocation.lng,
          address: currentTrip.endAddress || 'Recovered Destination',
        };
        setDestination(destination);
        if (__DEV__) {
          console.log('[useTripManagement] ✅ Restored destination:', destination);
        }
      }

      // 4. Restore motor
      if (currentTrip.selectedMotor) {
        setSelectedMotor(currentTrip.selectedMotor);
        if (__DEV__) {
          console.log('[useTripManagement] ✅ Restored motor:', currentTrip.selectedMotor.nickname);
        }
      }

      // 5. Restore addresses
      if (currentTrip.startAddress) {
        setStartAddress(currentTrip.startAddress);
      }
      if (currentTrip.endAddress) {
        setEndAddress(currentTrip.endAddress);
      }

      // 6. Restore maintenance actions
      if (currentTrip.tripMaintenanceActions && Array.isArray(currentTrip.tripMaintenanceActions)) {
        setTripMaintenanceActions(currentTrip.tripMaintenanceActions);
      }

      // 7. Restore route coordinates
      if (setPathCoords && currentTrip.routeCoordinates && Array.isArray(currentTrip.routeCoordinates)) {
        setPathCoords(currentTrip.routeCoordinates);
        if (__DEV__) {
          console.log('[useTripManagement] ✅ Restored route coordinates:', currentTrip.routeCoordinates.length);
        }
      }

      if (setFinalPathCoords && currentTrip.snappedRouteCoordinates && Array.isArray(currentTrip.snappedRouteCoordinates)) {
        setFinalPathCoords(currentTrip.snappedRouteCoordinates);
        if (__DEV__) {
          console.log('[useTripManagement] ✅ Restored snapped route coordinates:', currentTrip.snappedRouteCoordinates.length);
        }
      }

      // 8. Restore distance traveled
      if (setDistanceTraveled && currentTrip.rideStats?.distance) {
        setDistanceTraveled(currentTrip.rideStats.distance);
        if (__DEV__) {
          console.log('[useTripManagement] ✅ Restored distance traveled:', currentTrip.rideStats.distance);
        }
      }

      // 9. Restore last processed distance ref
      if (lastProcessedDistanceRef.current !== undefined && currentTrip.rideStats?.distance) {
        lastProcessedDistanceRef.current = currentTrip.rideStats.distance;
        if (__DEV__) {
          console.log('[useTripManagement] ✅ Restored last processed distance:', lastProcessedDistanceRef.current);
        }
      }

      // 10. Restore tracking state if it was tracking
      if (currentTrip.isTracking) {
        if (__DEV__) {
          console.log('[useTripManagement] 🔄 Trip was tracking, restoring tracking state...');
        }

        // Reset tracking first to clear any existing state
        resetTracking();

        // Restore navigation state
        if (setIsNavigating) {
          setIsNavigating(true);
        }

        if (setNavigationStartTime && currentTrip.startTime) {
          // Use original start time, not current time, to preserve elapsed time
          setNavigationStartTime(currentTrip.startTime);
          if (__DEV__) {
            console.log('[useTripManagement] ✅ Restored navigation start time:', new Date(currentTrip.startTime).toISOString());
          }
        }

        // Restore background tracking state if applicable
        if (isBackgroundTracking && currentTrip.isBackgroundTracking !== undefined) {
          isBackgroundTracking.current = currentTrip.isBackgroundTracking;
        }

        if (backgroundTrackingId && currentTrip.backgroundTrackingId) {
          backgroundTrackingId.current = currentTrip.backgroundTrackingId;
        }

        // Restart tracking with restored state
        if (startTracking) {
          try {
            await startTracking();
            if (__DEV__) {
              console.log('[useTripManagement] ✅ Tracking restarted successfully');
            }
          } catch (error) {
            if (__DEV__) {
              console.error('[useTripManagement] ❌ Failed to restart tracking:', error);
            }
            Toast.show({
              type: 'error',
              text1: 'Tracking Restart Failed',
              text2: 'Trip recovered but tracking could not be restarted. Please start manually.',
            });
          }
        } else {
          if (__DEV__) {
            console.warn('[useTripManagement] ⚠️ startTracking callback not provided, cannot restart tracking');
          }
        }
      } else {
        // Trip was not tracking, just restore state
        if (__DEV__) {
          console.log('[useTripManagement] ℹ️ Trip was not tracking, state restored');
        }
      }

      // Close recovery modal
      setShowTripRecovery(false);

      if (__DEV__) {
        console.log('[useTripManagement] ✅ Trip recovered successfully', {
          tripId: currentTrip.tripId,
          timestamp: new Date().toISOString(),
        });
      }

      Toast.show({
        type: 'success',
        text1: 'Trip Recovered',
        text2: 'Your trip has been restored successfully',
      });
    } catch (error: any) {
      if (__DEV__) {
        console.error('[useTripManagement] ❌ Failed to recover trip:', {
          error: error instanceof Error ? error.message : String(error),
          tripId: currentTrip?.tripId,
          timestamp: new Date().toISOString(),
        });
      }

      Toast.show({
        type: 'error',
        text1: 'Recovery Failed',
        text2: 'Failed to recover trip data',
      });
    }
  }, [
    currentTrip,
    setScreenMode,
    setSelectedMotor,
    setStartAddress,
    setEndAddress,
    setTripMaintenanceActions,
    setShowTripRecovery,
    setCurrentLocation,
    setRegion,
    setPathCoords,
    setFinalPathCoords,
    setDistanceTraveled,
    startTracking,
    setDestination,
    setIsNavigating,
    setNavigationStartTime,
    resetTracking,
    isBackgroundTracking,
    backgroundTrackingId,
    lastProcessedDistanceRef,
  ]);

  // Handle trip discard
  const handleDiscardTrip = useCallback(async () => {
    if (__DEV__) {
      console.log('[useTripManagement] 🗑️ handleDiscardTrip called', {
        hasCurrentTrip: !!currentTrip,
        tripId: currentTrip?.tripId,
        timestamp: new Date().toISOString(),
      });
    }

    try {
      await clearTripData();
      setShowTripRecovery(false);

      if (__DEV__) {
        console.log('[useTripManagement] ✅ Trip discarded successfully', {
          tripId: currentTrip?.tripId,
          timestamp: new Date().toISOString(),
        });
      }

      Toast.show({
        type: 'info',
        text1: 'Trip Discarded',
        text2: 'Trip data has been cleared',
      });
    } catch (error: any) {
      if (__DEV__) {
        console.error('[useTripManagement] ❌ Failed to discard trip:', {
          error: error instanceof Error ? error.message : String(error),
          tripId: currentTrip?.tripId,
          timestamp: new Date().toISOString(),
        });
      }

      Toast.show({
        type: 'error',
        text1: 'Discard Failed',
        text2: 'Failed to clear trip data',
      });
    }
  }, [clearTripData, currentTrip, setShowTripRecovery]);

  // Effect 10: Auto-save trip data when tracking (throttled to prevent excessive saves)
  useEffect(() => {
    if (!isTracking || !selectedMotor || !mapState.currentLocation) {
      if (__DEV__ && isTracking) {
        console.log('[useTripManagement] ⏭️ Skipping auto-save trip data', {
          isTracking,
          hasSelectedMotor: !!selectedMotor,
          hasCurrentLocation: !!mapState.currentLocation,
          timestamp: new Date().toISOString(),
        });
      }
      return;
    }

    if (__DEV__) {
      console.log('[useTripManagement] 💾 Effect 10: Auto-save trip data scheduled', {
        timestamp: new Date().toISOString(),
      });
    }

    // Throttle auto-saves to every 5 seconds to prevent excessive writes
    const timeoutId = setTimeout(() => {
      if (__DEV__) {
        console.log('[useTripManagement] 💾 Auto-saving trip data', {
          distance: rideStats?.distance,
          duration: rideStats?.duration,
          timestamp: new Date().toISOString(),
        });
      }

      const tripData = {
        tripId: `trip_${Date.now()}`,
        startTime: Date.now(),
        isTracking,
        screenMode,
        currentLocation: mapState.currentLocation,
        startLocation: (Array.isArray(routeCoordinates) && routeCoordinates[0]) || mapState.currentLocation || null,
        endLocation: (Array.isArray(routeCoordinates) && routeCoordinates[routeCoordinates.length - 1]) || null,
        region: mapState.region,
        selectedMotor,
        rideStats: {
          ...rideStats,
          fuelConsumed: (rideStats as any).fuelConsumed || 0,
        },
        routeCoordinates,
        snappedRouteCoordinates,
        startAddress,
        endAddress,
        tripMaintenanceActions: tripMaintenanceActions || [],
        isBackgroundTracking: isBackgroundTracking.current,
        backgroundTrackingId: backgroundTrackingId.current,
      };

      saveTripData(tripData).then(() => {
        if (__DEV__) {
          console.log('[useTripManagement] ✅ Trip data auto-saved successfully', {
            timestamp: new Date().toISOString(),
          });
        }
      }).catch(error => {
        if (__DEV__) {
          console.error('[useTripManagement] ❌ Failed to auto-save trip data:', {
            error: error.message,
            timestamp: new Date().toISOString(),
          });
        }
      });
    }, 5000); // Throttle to 5 seconds

    return () => {
      clearTimeout(timeoutId);
      if (__DEV__) {
        console.log('[useTripManagement] 🧹 Auto-save timeout cleared', {
          timestamp: new Date().toISOString(),
        });
      }
    };
  }, [
    isTracking,
    selectedMotor?._id,
    mapState.currentLocation?.latitude,
    mapState.currentLocation?.longitude,
    screenMode,
    rideStats.distance,
    routeCoordinates?.length,
    startAddress,
    endAddress,
    tripMaintenanceActions?.length,
    saveTripData,
  ]);

  // Effect 11: Check for recoverable trip on mount (ONCE)
  useEffect(() => {
    if (__DEV__) {
      console.log('[useTripManagement] 🔍 Effect 11: Checking for recoverable trip', {
        hasCheckedRecovery: hasCheckedRecovery.current,
        timestamp: new Date().toISOString(),
      });
    }

    if (hasCheckedRecovery.current) return;
    
    const checkForRecoverableTrip = async () => {
      try {
        hasCheckedRecovery.current = true;
        
        if (__DEV__) {
          console.log('[useTripManagement] 🔄 Checking recoverable trip...', {
            timestamp: new Date().toISOString(),
          });
        }

        const hasTrip = await checkRecoverableTrip();
        
        if (__DEV__) {
          console.log('[useTripManagement] 📋 Recoverable trip check result', {
            hasTrip,
            hasCurrentTrip: !!currentTrip,
            timestamp: new Date().toISOString(),
          });
        }

        if (hasTrip && currentTrip) {
          // Only show recovery if trip was actually tracking (not completed)
          if (currentTrip.isTracking || currentTrip.screenMode === 'tracking') {
            if (__DEV__) {
              console.log('[useTripManagement] ✅ Recoverable trip found', {
                tripId: currentTrip.tripId,
                isTracking: currentTrip.isTracking,
                screenMode: currentTrip.screenMode,
                timestamp: new Date().toISOString(),
              });
            }
            setShowTripRecovery(true);
          } else {
            if (__DEV__) {
              console.log('[useTripManagement] 🗑️ Found completed trip, clearing cache', {
                tripId: currentTrip.tripId,
                timestamp: new Date().toISOString(),
              });
            }
            // Clear completed trips automatically
            await clearCompletedTrips();
          }
        } else {
          if (__DEV__) {
            console.log('[useTripManagement] ℹ️ No recoverable trip found', {
              timestamp: new Date().toISOString(),
            });
          }
        }
      } catch (error) {
        if (__DEV__) {
          console.error('[useTripManagement] ❌ Error checking for recoverable trip:', {
            error: error instanceof Error ? error.message : String(error),
            timestamp: new Date().toISOString(),
          });
        }
      }
    };

    checkForRecoverableTrip();
  }, []); // Empty dependency array - only run once on mount

  return {
    createTripDataForModal,
    handleTripSave,
    handleTripCancel,
    handleRecoverTrip,
    handleDiscardTrip,
  };
};

