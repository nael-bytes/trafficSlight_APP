// Custom hook for tracking functionality

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import * as Location from 'expo-location';
import { calculateDistance, checkGPSServiceStatus, GPSServiceStatus } from '../utils/location';
import { updateFuelLevel } from '../utils/api';
import { snapToRoads, snapSinglePoint } from '../utils/roadSnapping';
import { calculateNewFuelLevel, calculateFuelLevelAfterRefuel } from '../utils/fuelCalculations';
import { updateTripDistanceWithRetry, type TripDistanceUpdateResponse } from '../Maps/utils/tripDistanceUpdate';
import type { RideStats, LocationCoords, Motor } from '../types';

interface UseTrackingProps {
  selectedMotor: Motor | null;
  onStatsUpdate?: (stats: RideStats) => void;
  onSnappingFailed?: () => void;
}

interface UseTrackingReturn {
  isTracking: boolean;
  rideStats: RideStats;
  routeCoordinates: LocationCoords[];
  snappedRouteCoordinates: LocationCoords[];
  startTracking: () => Promise<void>;
  stopTracking: () => void;
  resetTracking: () => void;
  totalDistanceTraveled: number;
  lastPostedDistance: number;
}

export const useTracking = ({ selectedMotor, onStatsUpdate, onSnappingFailed, onFuelLevelUpdate }: UseTrackingProps): UseTrackingReturn => {
  const [isTracking, setIsTracking] = useState(false);
  const [rideStats, setRideStats] = useState<RideStats>({
    duration: 0,
    distance: 0,
    avgSpeed: 0,
    speed: 0,
  });
  const [routeCoordinates, setRouteCoordinates] = useState<LocationCoords[]>([]);
  const [snappedRouteCoordinates, setSnappedRouteCoordinates] = useState<LocationCoords[]>([]);

  // Refs for tracking data
  const trackingLocationSub = useRef<Location.LocationSubscription | null>(null);
  const lastLocationRef = useRef<{ latitude: number; longitude: number; timestamp: number } | null>(null);
  const lastSnappedLocationRef = useRef<{ latitude: number; longitude: number; timestamp: number } | null>(null);
  const trackingStartTimeRef = useRef<number | null>(null);
  const statsTimer = useRef<NodeJS.Timeout | null>(null);
  const snapBatchRef = useRef<LocationCoords[]>([]);
  const snapTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Refs for trip distance API tracking
  const totalDistanceTraveledRef = useRef<number>(0); // Cumulative distance since trip start
  const lastPostedDistanceRef = useRef<number>(0); // Last successfully posted distance
  const tripDistanceUpdateIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isPausedRef = useRef<boolean>(false);

  // FIXED: Clear route coordinates on reset to prevent memory leaks
  const resetTracking = useCallback(() => {
    // CRITICAL: Clear stats timer first to prevent it from running after reset
    if (statsTimer.current) {
      clearInterval(statsTimer.current);
      statsTimer.current = null;
      if (__DEV__) {
        console.log('[useTracking] Stats timer cleared in resetTracking');
      }
    }
    
    // Clear trip distance update interval
    if (tripDistanceUpdateIntervalRef.current) {
      clearInterval(tripDistanceUpdateIntervalRef.current);
      tripDistanceUpdateIntervalRef.current = null;
      if (__DEV__) {
        console.log('[useTracking] Trip distance update interval cleared');
      }
    }
    
    // Clear route coordinates to prevent memory accumulation
    setRouteCoordinates([]);
    setSnappedRouteCoordinates([]);
    setRideStats({
      duration: 0,
      distance: 0,
      avgSpeed: 0,
      speed: 0,
    });
    lastLocationRef.current = null;
    lastSnappedLocationRef.current = null;
    trackingStartTimeRef.current = null;
    snapBatchRef.current = [];
    
    // Reset trip distance tracking
    totalDistanceTraveledRef.current = 0;
    lastPostedDistanceRef.current = 0;
    isPausedRef.current = false;
    
    // Clear snap timer
    if (snapTimerRef.current) {
      clearTimeout(snapTimerRef.current);
      snapTimerRef.current = null;
    }
  }, []);

  const startTracking = useCallback(async () => {
    if (!selectedMotor) {
      throw new Error('No motor selected');
    }

    // Reset tracking data
    resetTracking();
    
    // CRITICAL: Set tracking start time BEFORE starting timer
    trackingStartTimeRef.current = Date.now();
    
    if (__DEV__) {
      console.log('[useTracking] ⏱️ Starting duration timer', {
        startTime: trackingStartTimeRef.current,
        timestamp: new Date().toISOString(),
      });
    }

    // Start duration timer - updates every second
    statsTimer.current = setInterval(() => {
      if (!trackingStartTimeRef.current) {
        if (__DEV__) {
          console.warn('[useTracking] ⚠️ Timer running but trackingStartTimeRef is null');
        }
        return;
      }
      
      setRideStats(prev => {
        const elapsedSeconds = Math.floor((Date.now() - trackingStartTimeRef.current!) / 1000);
        const avgSpeed = elapsedSeconds > 0 ? (prev.distance / (elapsedSeconds / 3600)) : 0;
        
        if (__DEV__ && elapsedSeconds % 10 === 0) {
          // Log every 10 seconds to avoid spam
          console.log('[useTracking] ⏱️ Duration update', {
            elapsedSeconds,
            distance: prev.distance,
            avgSpeed,
          });
        }
        
        return { ...prev, duration: elapsedSeconds, avgSpeed };
      });
    }, 1000);

    // Start location tracking with optimized settings
    try {
      // CRITICAL: Check GPS service status with retry mechanism and better error handling
      const gpsCheck = await checkGPSServiceStatus(3, 2000, 5000);
      
      if (!gpsCheck.isAvailable && !gpsCheck.canAttemptLocation) {
        // GPS is disabled - cannot proceed
        throw new Error(gpsCheck.message);
      }
      
      // If GPS is acquiring signal but we can still attempt, show a warning but proceed
      if (gpsCheck.status === GPSServiceStatus.ACQUIRING) {
        console.warn('[useTracking] GPS is acquiring signal:', gpsCheck.message);
        // Continue anyway - might work with longer timeout
      }

      trackingLocationSub.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced, // Reduced from Highest to save battery
          timeInterval: 5000, // Increased to 5 seconds to reduce frequency
          distanceInterval: 10, // Increased to 10 meters to reduce frequency
        },
        async (location) => {
          if (!location || !location.coords) {
            if (__DEV__) {
              console.warn('[useTracking] Invalid location data received:', location);
            }
            return;
          }

          // Validate coordinates before using them
          const lat = location.coords.latitude;
          const lon = location.coords.longitude;
          
          // Sanity check: Validate coordinates are valid numbers within valid ranges
          if (typeof lat !== 'number' || typeof lon !== 'number' ||
              isNaN(lat) || isNaN(lon) ||
              lat < -90 || lat > 90 ||
              lon < -180 || lon > 180) {
            if (__DEV__) {
              console.warn('[useTracking] Invalid GPS coordinates received:', { lat, lon });
            }
            return; // Skip this update if coordinates are invalid
          }

          const timestamp = location.timestamp ?? Date.now();

          // CRITICAL FIX: Limit route coordinates to prevent memory leak
          // FIXED: Reduced limit from 1000 to 500 points to reduce memory usage
          setRouteCoordinates(prev => {
            const newCoords = [...prev, { latitude: lat, longitude: lon }];
            // Keep only last 500 points to prevent memory overflow (reduced from 1000)
            return newCoords.length > 500 ? newCoords.slice(-500) : newCoords;
          });

          // Add to snap batch for road-snapping
          snapBatchRef.current.push({ latitude: lat, longitude: lon });

          // Process road-snapping in larger batches (every 10 points or 30 seconds)
          if (snapBatchRef.current.length >= 10 || !snapTimerRef.current) {
            if (snapTimerRef.current) {
              clearTimeout(snapTimerRef.current);
            }
            
            snapTimerRef.current = setTimeout(async () => {
              try {
                const batchToSnap = [...snapBatchRef.current];
                snapBatchRef.current = [];
                
                if (batchToSnap.length > 0) {
                  const snapResult = await snapToRoads(batchToSnap);
                  
                  if (snapResult.hasSnapped && snapResult.snappedCoordinates.length > 0) {
                    setSnappedRouteCoordinates(prev => {
                      const newSnapped = [...prev, ...snapResult.snappedCoordinates];
                      // FIXED: Reduced limit from 1000 to 500 points to reduce memory usage
                      return newSnapped.length > 500 ? newSnapped.slice(-500) : newSnapped;
                    });
                    
                    // Use the last snapped point for distance calculation
                    const lastSnapped = snapResult.snappedCoordinates[snapResult.snappedCoordinates.length - 1];
                    lastSnappedLocationRef.current = { 
                      latitude: lastSnapped.latitude, 
                      longitude: lastSnapped.longitude, 
                      timestamp 
                    };
                  } else {
                    // No snapped points returned - user might be too far from roads
                    console.warn('[useTracking] No snapped points returned - user might be too far from roads');
                    if (onSnappingFailed) {
                      onSnappingFailed();
                    }
                  }
                }
              } catch (error) {
                console.warn('[useTracking] Road snapping failed:', error);
                // Fallback to original coordinates
                setSnappedRouteCoordinates(prev => {
                  const newCoords = [...prev, ...snapBatchRef.current];
                  return newCoords.length > 1000 ? newCoords.slice(-1000) : newCoords;
                });
                snapBatchRef.current = [];
                
                // Notify parent component about snapping failure
                if (onSnappingFailed) {
                  onSnappingFailed();
                }
              }
            }, 30000); // Increased to 30 seconds to reduce API calls
          }

          // Calculate distance delta using snapped coordinates if available
          // CRITICAL FIX: Always use the most recent valid location for distance calculation
          // Use snapped coordinates if available (more accurate), otherwise use raw coordinates
          const last = lastSnappedLocationRef.current || lastLocationRef.current;
          let distanceDeltaKm = 0;
          if (last) {
            // Use Haversine formula for accurate distance calculation
            distanceDeltaKm = calculateDistance(last.latitude, last.longitude, lat, lon);
            
            // Sanity check: If distance seems too large (e.g., > 10km between updates), 
            // it might be GPS error - cap it to prevent inaccurate readings
            const MAX_REASONABLE_DISTANCE_KM = 1.0; // 1 km per update (at 5000ms = 720 km/h max speed)
            if (distanceDeltaKm > MAX_REASONABLE_DISTANCE_KM) {
              if (__DEV__) {
                console.warn('[useTracking] Suspiciously large distance detected:', distanceDeltaKm, 'km. Possible GPS error. Capping to', MAX_REASONABLE_DISTANCE_KM);
              }
              distanceDeltaKm = 0; // Ignore this update to prevent inaccurate distance
            }
          }
          lastLocationRef.current = { latitude: lat, longitude: lon, timestamp };

          // Calculate current speed
          let currentSpeedKmh = 0;
          if (typeof location.coords.speed === 'number' && !isNaN(location.coords.speed)) {
            currentSpeedKmh = Math.max(0, location.coords.speed) * 3.6; // m/s to km/h
          } else if (last && timestamp && last.timestamp !== timestamp) {
            const dtSeconds = Math.max(0.001, (timestamp - last.timestamp) / 1000);
            currentSpeedKmh = (distanceDeltaKm / (dtSeconds / 3600));
          }

          // Update stats with distance tracking only
          setRideStats(prev => {
            const newDistance = prev.distance + distanceDeltaKm;

            // Update total distance traveled for API (only if not paused)
            if (!isPausedRef.current) {
              totalDistanceTraveledRef.current = newDistance;
            }

            const elapsedSeconds = trackingStartTimeRef.current 
              ? Math.floor((Date.now() - trackingStartTimeRef.current) / 1000) 
              : prev.duration;
            const avgSpeed = elapsedSeconds > 0 ? (newDistance / (elapsedSeconds / 3600)) : prev.avgSpeed;

            const newStats = {
              ...prev,
              distance: newDistance,
              duration: elapsedSeconds, // Ensure duration is always calculated from start time
              speed: currentSpeedKmh,
              avgSpeed,
            };

        // Note: Fuel level calculation is handled via /api/trip/update-distance endpoint
        // which is called periodically every 5 seconds. The parent component receives stats updates via onStatsUpdate callback.

            return newStats;
          });
        }
      );

      setIsTracking(true);
      
      // Start periodic trip distance updates (every 5 seconds)
      if (selectedMotor?._id) {
        startTripDistanceUpdates(selectedMotor._id);
      }
    } catch (error) {
      console.error('Failed to start tracking:', error);
      throw error;
    }
  }, [selectedMotor, resetTracking]);
  
  /**
   * Start periodic trip distance updates to API
   * Calls /api/trip/update-distance every 5 seconds
   */
  const startTripDistanceUpdates = useCallback((userMotorId: string) => {
    // Clear any existing interval
    if (tripDistanceUpdateIntervalRef.current) {
      clearInterval(tripDistanceUpdateIntervalRef.current);
    }
    
    // Reset distance tracking when starting
    totalDistanceTraveledRef.current = 0;
    lastPostedDistanceRef.current = 0;
    isPausedRef.current = false;
    
    if (__DEV__) {
      console.log('[useTracking] Starting periodic trip distance updates', {
        userMotorId,
        interval: '5 seconds',
      });
    }
    
    // Call API every 5 seconds
    tripDistanceUpdateIntervalRef.current = setInterval(async () => {
      // Skip if paused
      if (isPausedRef.current) {
        if (__DEV__) {
          console.log('[useTracking] Skipping trip distance update (paused)');
        }
        return;
      }
      
      const totalDistance = totalDistanceTraveledRef.current;
      const lastPosted = lastPostedDistanceRef.current;
      
      // Only call API if there's new distance to report
      if (totalDistance <= lastPosted) {
        if (__DEV__) {
          console.log('[useTracking] No new distance to report', {
            totalDistance,
            lastPosted,
          });
        }
        return;
      }
      
      try {
        if (__DEV__) {
          console.log('[useTracking] Calling trip distance update API', {
            userMotorId,
            totalDistanceTraveled: totalDistance,
            lastPostedDistance: lastPosted,
          });
        }
        
        const response = await updateTripDistanceWithRetry(
          userMotorId,
          totalDistance,
          lastPosted
        );
        
        // Handle skipped updates (not an error)
        if (response === null) {
          if (__DEV__) {
            console.log('[useTracking] Trip distance update skipped (distance too small)');
          }
          return;
        }
        
        // Update last posted distance on success
        if (response.success && response.newFuelLevel !== undefined) {
          lastPostedDistanceRef.current = totalDistance;
          
          if (__DEV__) {
            console.log('[useTracking] ✅ Trip distance updated successfully', {
              actualDistanceTraveled: response.actualDistanceTraveled,
              newFuelLevel: response.newFuelLevel,
              lowFuelWarning: response.lowFuelWarning,
            });
          }
          
          // Notify parent component about fuel level update
          if (onFuelLevelUpdate && response.newFuelLevel !== undefined) {
            onFuelLevelUpdate(
              response.newFuelLevel,
              response.lowFuelWarning || false
            );
          }
        }
      } catch (error: any) {
        // Log error but don't stop the interval
        // The retry logic in updateTripDistanceWithRetry handles transient errors
        console.warn('[useTracking] ❌ Failed to update trip distance:', error.message);
        
        // Don't update lastPostedDistanceRef on error - will retry on next interval
      }
    }, 5000); // 5 seconds as per API documentation
  }, [onFuelLevelUpdate]);

  const stopTracking = useCallback(() => {
    console.log('[useTracking] Starting stop tracking process...');
    
    try {
      // First, set tracking to false to prevent new location updates
      setIsTracking(false);
      
      // Clear trip distance update interval
      try {
        if (tripDistanceUpdateIntervalRef.current) {
          clearInterval(tripDistanceUpdateIntervalRef.current);
          tripDistanceUpdateIntervalRef.current = null;
          console.log('[useTracking] Trip distance update interval cleared');
        }
      } catch (error) {
        console.warn('[useTracking] Error clearing trip distance update interval:', error);
      }

      // Clear timers and subscriptions with individual error handling
      try {
        if (statsTimer.current) {
          clearInterval(statsTimer.current);
          statsTimer.current = null;
          console.log('[useTracking] Stats timer cleared');
        }
      } catch (error) {
        console.warn('[useTracking] Error clearing stats timer:', error);
      }

      try {
        if (trackingLocationSub.current) {
          trackingLocationSub.current.remove();
          trackingLocationSub.current = null;
          console.log('[useTracking] Location subscription removed');
        }
      } catch (error) {
        console.warn('[useTracking] Error removing location subscription:', error);
      }

      try {
        if (snapTimerRef.current) {
          clearTimeout(snapTimerRef.current);
          snapTimerRef.current = null;
          console.log('[useTracking] Snap timer cleared');
        }
      } catch (error) {
        console.warn('[useTracking] Error clearing snap timer:', error);
      }

      // Reset refs safely
      try {
        lastLocationRef.current = null;
        lastSnappedLocationRef.current = null;
        trackingStartTimeRef.current = null;
        snapBatchRef.current = [];
        console.log('[useTracking] Refs reset successfully');
      } catch (error) {
        console.warn('[useTracking] Error resetting refs:', error);
      }
      
      console.log('[useTracking] ✅ Tracking stopped successfully');
    } catch (error) {
      console.error('[useTracking] ❌ Error stopping tracking:', error);
      // Force reset even if there's an error
      try {
        setIsTracking(false);
        console.log('[useTracking] Force reset tracking state');
      } catch (resetError) {
        console.error('[useTracking] ❌ Error in force reset:', resetError);
      }
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (statsTimer.current) clearInterval(statsTimer.current);
      if (tripDistanceUpdateIntervalRef.current) clearInterval(tripDistanceUpdateIntervalRef.current);
      if (trackingLocationSub.current) trackingLocationSub.current.remove();
      if (snapTimerRef.current) clearTimeout(snapTimerRef.current);
    };
  }, []);

  // Memoized stats to prevent unnecessary updates
  const memoizedStats = useMemo(() => ({
    duration: rideStats.duration,
    distance: rideStats.distance,
    avgSpeed: rideStats.avgSpeed,
    speed: rideStats.speed,
  }), [rideStats.duration, rideStats.distance, rideStats.avgSpeed, rideStats.speed]);

  // Call onStatsUpdate when stats change (throttled to prevent excessive updates)
  const lastStatsUpdateRef = useRef<number>(0);
  useEffect(() => {
    if (!onStatsUpdate || !isTracking) return;
    
    // CRITICAL FIX: Increased throttle to 5 seconds to reduce parent re-renders
    const now = Date.now();
    if (now - lastStatsUpdateRef.current < 5000) return;
    
    lastStatsUpdateRef.current = now;
    onStatsUpdate(memoizedStats);
  }, [memoizedStats, onStatsUpdate, isTracking]);

  return {
    isTracking,
    rideStats,
    routeCoordinates,
    snappedRouteCoordinates,
    startTracking,
    stopTracking,
    resetTracking,
    totalDistanceTraveled: totalDistanceTraveledRef.current,
    lastPostedDistance: lastPostedDistanceRef.current,
  };
};
