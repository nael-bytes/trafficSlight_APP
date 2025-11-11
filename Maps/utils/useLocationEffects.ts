/**
 * useLocationEffects Hook
 * 
 * Extracts location-related effects:
 * - Auto-select first motor
 * - Handle focus location from navigation
 * - Sync screen mode with tracking
 * - Sync currentLocation with latest GPS location during tracking
 * - Auto-focus on user marker when location updates
 * - Initialize map region on mount
 * - Auto-get location when screen is focused
 * 
 * @module useLocationEffects
 */

import { useEffect, useRef } from 'react';
import * as Location from 'expo-location';
import type { Motor, LocationCoords } from '../../types';
import { validateCoordinates } from '../../utils/location';
import { useLocation } from '../../AuthContext/LocationContext';

interface UseLocationEffectsParams {
  isFocused: boolean;
  focusLocation?: LocationCoords | null;
  effectiveMotors: Motor[];
  selectedMotor: Motor | null;
  isTracking: boolean;
  screenMode: 'planning' | 'tracking' | 'summary';
  routeCoordinates: LocationCoords[] | null;
  snappedRouteCoordinates: LocationCoords[] | null;
  mapState: {
    currentLocation: LocationCoords | null;
    region: any;
    isFollowingUser: boolean;
  };
  isDestinationFlowActive: boolean;
  userManuallyPannedRef: React.RefObject<boolean>;
  isAutoFollowingRef: React.RefObject<boolean>;
  hasInitializedMapRegionRef: React.RefObject<boolean>;
  hasRequestedLocation: React.RefObject<boolean>;
  hasGottenLocationOnFocusRef: React.RefObject<boolean>;
  setSelectedMotor: (motor: Motor | null) => void;
  setCurrentLocation: (location: LocationCoords | null) => void;
  setRegion: (region: any) => void;
  setScreenMode: (mode: 'planning' | 'tracking' | 'summary') => void;
  startAutoCache: () => void;
  stopAutoCache: () => void;
  mapRef: React.RefObject<any>;
  handleGetCurrentLocation: (showOverlay?: boolean, forceRefresh?: boolean) => Promise<LocationCoords | null>;
}

/**
 * Custom hook for managing location-related effects
 */
export const useLocationEffects = ({
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
}: UseLocationEffectsParams): void => {
  // Get global location from LocationContext
  const { currentLocation: globalLocation } = useLocation();

  const isFocusedRef = useRef(isFocused);
  useEffect(() => {
    isFocusedRef.current = isFocused;
  }, [isFocused]);

  const isTrackingRef = useRef(isTracking);
  useEffect(() => {
    isTrackingRef.current = isTracking;
  }, [isTracking]);

  // Ref for continuous location subscription
  const continuousLocationSub = useRef<Location.LocationSubscription | null>(null);

  // Effect 2.5: Sync global LocationContext with map's local state
  // This ensures location updates from global context are reflected on the map
  // Works even when user is not on map screen or not tracking
  useEffect(() => {
    if (!isFocused) return; // Only sync when screen is focused

    // Skip if tracking is active - tracking watch will handle it with snapped coordinates
    if (isTracking) return;

    // Skip if we don't have a global location
    if (!globalLocation || !validateCoordinates(globalLocation)) return;

    // Only update if location has changed significantly
    const currentLoc = mapState.currentLocation;
    if (!currentLoc ||
        Math.abs(currentLoc.latitude - globalLocation.latitude) > 0.00001 ||
        Math.abs(currentLoc.longitude - globalLocation.longitude) > 0.00001) {
      setCurrentLocation(globalLocation);
      if (__DEV__) {
        console.log('[useLocationEffects] 🔄 Synced map location with global LocationContext:', globalLocation);
      }
    }
  }, [isFocused, isTracking, globalLocation, mapState.currentLocation, setCurrentLocation]);

  // Effect 3: Auto-select first motor (ONCE) - Fixed infinite loop
  // CRITICAL: Only run when screen is focused to prevent running when on other tabs
  useEffect(() => {
    if (__DEV__) {
      console.log('[useLocationEffects] 🔍 Effect 3: Auto-select motor check', {
        isFocused,
        effectiveMotorsCount: effectiveMotors.length,
        hasSelectedMotor: !!selectedMotor,
        selectedMotorId: selectedMotor?._id,
        willAutoSelect: effectiveMotors.length > 0 && !selectedMotor,
        timestamp: new Date().toISOString(),
      });
    }

    // Don't auto-select if screen is not focused
    if (!isFocused) return;

    if (effectiveMotors.length > 0 && !selectedMotor) {
      if (__DEV__) {
        console.log('[useLocationEffects] ✅ Auto-selecting first motor', {
          motorId: effectiveMotors[0]?._id,
          nickname: effectiveMotors[0]?.nickname,
          timestamp: new Date().toISOString(),
        });
      }
      setSelectedMotor(effectiveMotors[0] as Motor); // Type cast - motors from processor are compatible
    }
  }, [effectiveMotors.length, isFocused, selectedMotor, setSelectedMotor]);

  // Effect 4: Handle focus location from navigation
  // CRITICAL: Only update map when screen is focused
  useEffect(() => {
    if (!focusLocation || !isFocused) return;

    userManuallyPannedRef.current = true;
    const newRegion = {
      ...focusLocation,
      latitudeDelta: 0.0015,
      longitudeDelta: 0.0015,
    };
    setRegion(newRegion);
    setCurrentLocation(focusLocation);

    mapRef.current?.animateToRegion(newRegion, 1000);

    setTimeout(() => {
      userManuallyPannedRef.current = false;
    }, 100);
  }, [focusLocation?.latitude, focusLocation?.longitude, isFocused, setRegion, setCurrentLocation, mapRef, userManuallyPannedRef]);

  // Effect 5: Sync screen mode with tracking
  useEffect(() => {
    if (__DEV__) {
      console.log('[useLocationEffects] 🔄 Effect 5: Screen mode sync', {
        isTracking,
        screenMode,
        willChange: (isTracking && screenMode !== 'tracking') || (!isTracking && screenMode === 'tracking'),
        timestamp: new Date().toISOString(),
      });
    }

    if (isTracking && screenMode !== 'tracking') {
      if (__DEV__) {
        console.log('[useLocationEffects] ▶️ Switching to tracking mode', {
          timestamp: new Date().toISOString(),
        });
      }

      setScreenMode('tracking');
      // Start auto-cache when tracking starts
      startAutoCache();
    } else if (!isTracking && screenMode === 'tracking') {
      if (__DEV__) {
        console.log('[useLocationEffects] ⏹️ Switching from tracking mode', {
          timestamp: new Date().toISOString(),
        });
      }

      // Stop auto-cache when tracking stops
      stopAutoCache();
    }
  }, [isTracking, screenMode, setScreenMode, startAutoCache, stopAutoCache]);

  // Effect 5.4: Continuous GPS location watch - ALWAYS active when screen is focused
  // This ensures the user marker always moves in real-time, regardless of tracking state
  // Works for both free drive and destination navigation modes
  useEffect(() => {
    // Only run when screen is focused
    if (!isFocused) {
      // Cleanup subscription when screen loses focus
      if (continuousLocationSub.current) {
        continuousLocationSub.current.remove();
        continuousLocationSub.current = null;
      }
      return;
    }

    // Start continuous location watch
    const startContinuousLocationWatch = async () => {
      try {
        // Request location permissions
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          if (__DEV__) {
            console.warn('[useLocationEffects] Location permission not granted for continuous tracking');
          }
          return;
        }

        // Start watching position - updates in real-time
        continuousLocationSub.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: 3000, // Update every 3 seconds for smooth movement
            distanceInterval: 5, // Update every 5 meters for responsive tracking
          },
          (location) => {
            if (!location || !location.coords) return;

            // Skip update if tracking is active - tracking watch will handle it with snapped coordinates
            // This prevents conflicts and ensures we use the more accurate snapped coordinates when tracking
            if (isTrackingRef.current) {
              return;
            }

            const lat = location.coords.latitude;
            const lon = location.coords.longitude;

            // Validate coordinates
            if (typeof lat !== 'number' || typeof lon !== 'number' ||
                isNaN(lat) || isNaN(lon) ||
                lat < -90 || lat > 90 ||
                lon < -180 || lon > 180) {
              return;
            }

            const newLocation: LocationCoords = {
              latitude: lat,
              longitude: lon,
              timestamp: location.timestamp ?? Date.now(),
            };

            // Only update if location has changed significantly
            const currentLoc = mapState.currentLocation;
            if (!currentLoc ||
                Math.abs(currentLoc.latitude - newLocation.latitude) > 0.00001 ||
                Math.abs(currentLoc.longitude - newLocation.longitude) > 0.00001) {
              setCurrentLocation(newLocation);
              if (__DEV__) {
                console.log('[useLocationEffects] 📍 Continuous location update (not tracking):', newLocation);
              }
            }
          }
        );

        if (__DEV__) {
          console.log('[useLocationEffects] ✅ Started continuous location watch');
        }
      } catch (error) {
        if (__DEV__) {
          console.error('[useLocationEffects] ❌ Failed to start continuous location watch:', error);
        }
      }
    };

    startContinuousLocationWatch();

    // Cleanup subscription when screen loses focus or component unmounts
    return () => {
      if (continuousLocationSub.current) {
        continuousLocationSub.current.remove();
        continuousLocationSub.current = null;
        if (__DEV__) {
          console.log('[useLocationEffects] 🛑 Stopped continuous location watch');
        }
      }
    };
  }, [isFocused, isTracking, mapState.currentLocation, setCurrentLocation]);

  // Effect 5.5: Sync currentLocation with latest GPS location during tracking
  // CRITICAL FIX: Only run when screen is focused and tracking is active
  // This prevents crashes when screen is not visible (e.g., on ProfileScreen)
  // NOTE: This is in addition to continuous location watch - uses snapped coordinates when tracking
  useEffect(() => {
    if (!isTracking || !isFocused) return; // CRITICAL: Only run when focused

    // Function to sync currentLocation with latest GPS position (from tracking)
    const syncLocation = () => {
      // CRITICAL: Check if still focused before updating state (use ref to get latest value)
      if (!isFocusedRef.current) return;

      // Use snapped coordinates if available (more accurate), otherwise use raw route coordinates
      const latestLocation = snappedRouteCoordinates && snappedRouteCoordinates.length > 0
        ? snappedRouteCoordinates[snappedRouteCoordinates.length - 1]
        : routeCoordinates && routeCoordinates.length > 0
        ? routeCoordinates[routeCoordinates.length - 1]
        : null;

      if (latestLocation && validateCoordinates(latestLocation)) {
        // Only update if the location has changed (to avoid unnecessary re-renders)
        const currentLoc = mapState.currentLocation;
        if (!currentLoc ||
            Math.abs(currentLoc.latitude - latestLocation.latitude) > 0.00001 ||
            Math.abs(currentLoc.longitude - latestLocation.longitude) > 0.00001) {
          setCurrentLocation(latestLocation);
          if (__DEV__) {
            console.log('[useLocationEffects] Synced currentLocation with latest GPS (tracking):', latestLocation);
          }
        }
      }
    };

    // Sync immediately on mount or when tracking starts
    syncLocation();

    // Set up interval to check for updates every 2 seconds
    const intervalId = setInterval(syncLocation, 2000); // Update every 2 seconds

    // Cleanup interval when tracking stops, component unmounts, or screen loses focus
    return () => {
      clearInterval(intervalId);
    };
  }, [isTracking, isFocused, routeCoordinates, snappedRouteCoordinates, mapState.currentLocation, setCurrentLocation]);

  // CRITICAL FIX: Auto-focus on user marker when location updates
  // This centers the map on the user's location when:
  // 1. Location is first obtained
  // 2. Location updates during tracking (if not manually panned)
  // 3. User hasn't disabled following
  // IMPORTANT: Only auto-focus when screen is focused (Map tab is active)
  useEffect(() => {
    // CRITICAL: Don't auto-focus when user is on other tabs (Motors, Account)
    if (!isFocused) return;

    if (!mapState.currentLocation || !mapRef.current) return;

    // Don't auto-focus if user manually panned recently
    if (userManuallyPannedRef.current && !mapState.isFollowingUser) {
      return;
    }

    // Validate coordinates
    const { latitude, longitude } = mapState.currentLocation;
    if (!latitude || !longitude ||
        isNaN(latitude) || isNaN(longitude) ||
        latitude < -90 || latitude > 90 ||
        longitude < -180 || longitude > 180) {
      return;
    }

    // Only auto-focus if:
    // 1. User is following (isFollowingUser is true), OR
    // 2. This is the first location (hasn't initialized region yet), OR
    // 3. User is tracking and hasn't manually panned
    const shouldAutoFocus = mapState.isFollowingUser ||
                           !mapState.region ||
                           (isTracking && !userManuallyPannedRef.current);

    if (shouldAutoFocus && !isAutoFollowingRef.current) {
      // Mark as auto-following to prevent manual pan detection
      isAutoFollowingRef.current = true;

      const newRegion = {
        latitude,
        longitude,
        latitudeDelta: isTracking ? 0.002 : 0.0015, // Slightly zoomed out during tracking
        longitudeDelta: isTracking ? 0.002 : 0.0015,
      };

      // Animate to user location smoothly
      mapRef.current?.animateToRegion(newRegion, 1000);

      // Update region state if not tracking (to maintain state)
      if (!isTracking) {
        setRegion(newRegion);
      }

      // Reset auto-following flag after animation completes
      setTimeout(() => {
        isAutoFollowingRef.current = false;
      }, 1100); // Slightly longer than animation duration
    }
  }, [mapState.currentLocation?.latitude, mapState.currentLocation?.longitude, mapState.isFollowingUser, isTracking, mapState.region, setRegion, isFocused, mapRef, userManuallyPannedRef, isAutoFollowingRef]);

  // Effect 11: Initialize map region on mount - ensure map is always interactive even without GPS
  // CRITICAL: Only run when screen is focused to prevent running when on other tabs
  useEffect(() => {
    if (__DEV__) {
      console.log('[useLocationEffects] 🗺️ Effect 11: Initialize map region', {
        isFocused,
        hasRegion: !!mapState.region,
        hasInitialized: hasInitializedMapRegionRef.current,
        hasRequestedLocation: hasRequestedLocation.current,
        timestamp: new Date().toISOString(),
      });
    }

    // Don't initialize if screen is not focused
    if (!isFocused) return;

    // Set default region if map region is not initialized
    // This ensures the map is interactive even without GPS/location services
    if (!mapState.region && !hasInitializedMapRegionRef.current) {
      // Default to Valenzuela City, Philippines
      const defaultRegion = {
        latitude: 14.7006,
        longitude: 120.9830,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      };

      if (__DEV__) {
        console.log('[useLocationEffects] ✅ Map region initialized with default', {
          region: defaultRegion,
          timestamp: new Date().toISOString(),
        });
      }

      setRegion(defaultRegion);
      hasInitializedMapRegionRef.current = true;
    }

    // Request location on mount (non-blocking - map is already interactive)
    if (!hasRequestedLocation.current) {
      hasRequestedLocation.current = true;

      if (__DEV__) {
        console.log('[useLocationEffects] 📍 Requesting location on mount', {
          timestamp: new Date().toISOString(),
        });
      }

      // Try to get location but don't block map interaction if it fails
      handleGetCurrentLocation(false).catch((error: any) => {
        // Silently fail - map is already interactive with default region
        if (__DEV__) {
          console.warn('[useLocationEffects] ⚠️ Location request failed, map still interactive', {
            error: error.message,
            timestamp: new Date().toISOString(),
          });
        }
      });
    }
  }, [isFocused, mapState.region, hasInitializedMapRegionRef, hasRequestedLocation, setRegion, handleGetCurrentLocation]);

  // Effect 12: Auto-get location when screen is focused (throttled to prevent excessive refreshes)
  // CRITICAL: Only run when screen is focused to prevent running when on other tabs
  useEffect(() => {
    if (__DEV__) {
      console.log('[useLocationEffects] 📍 Effect 12: Auto-get location on focus', {
        isFocused,
        hasGottenLocation: hasGottenLocationOnFocusRef.current,
        willGetLocation: isFocused && !hasGottenLocationOnFocusRef.current,
        timestamp: new Date().toISOString(),
      });
    }

    // Don't get location if screen is not focused
    if (!isFocused) return;

    // Only get location once per session, not on every focus
    if (!hasGottenLocationOnFocusRef.current) {
      hasGottenLocationOnFocusRef.current = true;

      if (__DEV__) {
        console.log('[useLocationEffects] 📍 Getting location on first focus', {
          timestamp: new Date().toISOString(),
        });
      }

      // Get location once when screen first loads
      handleGetCurrentLocation(false);
    }
  }, [isFocused, hasGottenLocationOnFocusRef, handleGetCurrentLocation]);
};

