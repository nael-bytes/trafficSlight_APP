// Custom hook for tracking functionality

import { useState, useRef, useCallback, useEffect } from 'react';
import * as Location from 'expo-location';
import { calculateDistance } from '../utils/location';
import { updateFuelLevel } from '../utils/api';
import { snapToRoads, snapSinglePoint } from '../utils/roadSnapping';
import { calculateNewFuelLevel, calculateFuelLevelAfterRefuel } from '../utils/fuelCalculations';
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
}

export const useTracking = ({ selectedMotor, onStatsUpdate, onSnappingFailed }: UseTrackingProps): UseTrackingReturn => {
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

  const resetTracking = useCallback(() => {
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
    trackingStartTimeRef.current = Date.now();

    // Start duration timer
    statsTimer.current = setInterval(() => {
      setRideStats(prev => {
        const newDuration = prev.duration + 1;
        const avgSpeed = newDuration > 0 ? (prev.distance / (newDuration / 3600)) : 0;
        return { ...prev, duration: newDuration, avgSpeed };
      });
    }, 1000);

    // Start location tracking with optimized settings
    try {
      trackingLocationSub.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced, // Reduced from Highest to save battery
          timeInterval: 5000, // Increased to 5 seconds to reduce frequency
          distanceInterval: 10, // Increased to 10 meters to reduce frequency
        },
        async (location) => {
          if (!location || !location.coords) return;

          const lat = location.coords.latitude;
          const lon = location.coords.longitude;
          const timestamp = location.timestamp ?? Date.now();

          // CRITICAL FIX: Limit route coordinates to prevent memory leak
          setRouteCoordinates(prev => {
            const newCoords = [...prev, { latitude: lat, longitude: lon }];
            // Keep only last 1000 points to prevent memory overflow
            return newCoords.length > 1000 ? newCoords.slice(-1000) : newCoords;
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
                      // Keep only last 1000 points to prevent memory overflow
                      return newSnapped.length > 1000 ? newSnapped.slice(-1000) : newSnapped;
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
          const last = lastSnappedLocationRef.current || lastLocationRef.current;
          let distanceDeltaKm = 0;
          if (last) {
            distanceDeltaKm = calculateDistance(last.latitude, last.longitude, lat, lon);
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

            const elapsedSeconds = trackingStartTimeRef.current 
              ? Math.floor((Date.now() - trackingStartTimeRef.current) / 1000) 
              : prev.duration;
            const avgSpeed = elapsedSeconds > 0 ? (newDistance / (elapsedSeconds / 3600)) : prev.avgSpeed;

            const newStats = {
              ...prev,
              distance: newDistance,
              speed: currentSpeedKmh,
              avgSpeed,
            };

        // Note: Fuel level calculation is handled in the parent component (RouteSelectionScreenOptimized)
        // to avoid double fuel consumption. The parent component receives stats updates via onStatsUpdate callback.

            return newStats;
          });
        }
      );

      setIsTracking(true);
    } catch (error) {
      console.error('Failed to start tracking:', error);
      throw error;
    }
  }, [selectedMotor, resetTracking]);

  const stopTracking = useCallback(() => {
    setIsTracking(false);

    // Clear timers and subscriptions
    if (statsTimer.current) {
      clearInterval(statsTimer.current);
      statsTimer.current = null;
    }

    if (trackingLocationSub.current) {
      trackingLocationSub.current.remove();
      trackingLocationSub.current = null;
    }

    if (snapTimerRef.current) {
      clearTimeout(snapTimerRef.current);
      snapTimerRef.current = null;
    }

    // Reset refs
    lastLocationRef.current = null;
    lastSnappedLocationRef.current = null;
    trackingStartTimeRef.current = null;
    snapBatchRef.current = [];
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (statsTimer.current) clearInterval(statsTimer.current);
      if (trackingLocationSub.current) trackingLocationSub.current.remove();
      if (snapTimerRef.current) clearTimeout(snapTimerRef.current);
    };
  }, []);

  // Call onStatsUpdate when stats change (throttled to prevent excessive updates)
  const lastStatsUpdateRef = useRef<number>(0);
  useEffect(() => {
    if (!onStatsUpdate || !isTracking) return;
    
    // CRITICAL FIX: Increased throttle to 5 seconds to reduce parent re-renders
    const now = Date.now();
    if (now - lastStatsUpdateRef.current < 5000) return;
    
    lastStatsUpdateRef.current = now;
    onStatsUpdate(rideStats);
  }, [rideStats.distance, rideStats.duration, onStatsUpdate, isTracking]);

  return {
    isTracking,
    rideStats,
    routeCoordinates,
    snappedRouteCoordinates,
    startTracking,
    stopTracking,
    resetTracking,
  };
};
