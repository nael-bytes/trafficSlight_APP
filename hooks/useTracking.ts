// Custom hook for tracking functionality

import { useState, useRef, useCallback, useEffect } from 'react';
import * as Location from 'expo-location';
import { calculateDistance } from '../utils/location';
import { updateFuelLevel } from '../utils/api';
import type { RideStats, LocationCoords, Motor } from '../types';

interface UseTrackingProps {
  selectedMotor: Motor | null;
  onStatsUpdate?: (stats: RideStats) => void;
}

interface UseTrackingReturn {
  isTracking: boolean;
  rideStats: RideStats;
  routeCoordinates: LocationCoords[];
  startTracking: () => Promise<void>;
  stopTracking: () => void;
  resetTracking: () => void;
}

export const useTracking = ({ selectedMotor, onStatsUpdate }: UseTrackingProps): UseTrackingReturn => {
  const [isTracking, setIsTracking] = useState(false);
  const [rideStats, setRideStats] = useState<RideStats>({
    duration: 0,
    distance: 0,
    fuelConsumed: 0,
    avgSpeed: 0,
    speed: 0,
  });
  const [routeCoordinates, setRouteCoordinates] = useState<LocationCoords[]>([]);

  // Refs for tracking data
  const trackingLocationSub = useRef<Location.LocationSubscription | null>(null);
  const lastLocationRef = useRef<{ latitude: number; longitude: number; timestamp: number } | null>(null);
  const trackingStartTimeRef = useRef<number | null>(null);
  const statsTimer = useRef<NodeJS.Timeout | null>(null);

  const resetTracking = useCallback(() => {
    setRouteCoordinates([]);
    setRideStats({
      duration: 0,
      distance: 0,
      fuelConsumed: 0,
      avgSpeed: 0,
      speed: 0,
    });
    lastLocationRef.current = null;
    trackingStartTimeRef.current = null;
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

    // Start location tracking
    try {
      trackingLocationSub.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Highest,
          timeInterval: 1000, // 1 second
          distanceInterval: 1, // 1 meter
        },
        (location) => {
          if (!location || !location.coords) return;

          const lat = location.coords.latitude;
          const lon = location.coords.longitude;
          const timestamp = location.timestamp ?? Date.now();

          // Add to route coordinates
          setRouteCoordinates(prev => [...prev, { latitude: lat, longitude: lon }]);

          // Calculate distance delta
          const last = lastLocationRef.current;
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

          // Update stats
          setRideStats(prev => {
            const newDistance = prev.distance + distanceDeltaKm;
            const fuelEfficiency = selectedMotor?.fuelEfficiency ?? 0;
            const fuelDelta = fuelEfficiency > 0 ? (distanceDeltaKm / fuelEfficiency) : 0;
            const newFuel = prev.fuelConsumed + fuelDelta;

            const elapsedSeconds = trackingStartTimeRef.current 
              ? Math.floor((Date.now() - trackingStartTimeRef.current) / 1000) 
              : prev.duration;
            const avgSpeed = elapsedSeconds > 0 ? (newDistance / (elapsedSeconds / 3600)) : prev.avgSpeed;

            const newStats = {
              ...prev,
              distance: newDistance,
              fuelConsumed: newFuel,
              speed: currentSpeedKmh,
              avgSpeed,
            };

            // Update fuel level in backend
            if (selectedMotor && distanceDeltaKm > 0) {
              // Calculate fuel level reduction based on distance traveled vs total drivable distance
              const totalDrivableDistance = selectedMotor.totalDrivableDistance || 0;

              let newFuelLevel = selectedMotor.currentFuelLevel;

              if (totalDrivableDistance > 0) {
                // Calculate fraction of total distance traveled
                const distanceFraction = distanceDeltaKm / totalDrivableDistance;

                // Convert to fuel level percentage reduction (assuming linear relationship)
                const fuelLevelReduction = distanceFraction * 100;

                newFuelLevel = Math.max(0, selectedMotor.currentFuelLevel - fuelLevelReduction);

                console.log('[useTracking] Fuel update:', {
                  currentFuelLevel: selectedMotor.currentFuelLevel,
                  distanceDeltaKm,
                  totalDrivableDistance,
                  distanceFraction,
                  fuelLevelReduction,
                  newFuelLevel
                });
              } else {
                console.warn('[useTracking] totalDrivableDistance is 0 or undefined, cannot calculate fuel level');
              }

              if (!isNaN(newFuelLevel) && totalDrivableDistance > 0) {
                updateFuelLevel(selectedMotor._id, newFuelLevel).catch((error) => {
                  console.warn('[useTracking] Fuel level update failed (non-critical):', error.message);
                  // Don't throw error - fuel tracking continues locally
                });
              }
            }

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

    // Reset refs
    lastLocationRef.current = null;
    trackingStartTimeRef.current = null;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (statsTimer.current) clearInterval(statsTimer.current);
      if (trackingLocationSub.current) trackingLocationSub.current.remove();
    };
  }, []);

  // Call onStatsUpdate when stats change (throttled to prevent excessive updates)
  const lastStatsUpdateRef = useRef<number>(0);
  useEffect(() => {
    if (!onStatsUpdate || !isTracking) return;
    
    // Throttle updates to once every 2 seconds to prevent excessive parent re-renders
    const now = Date.now();
    if (now - lastStatsUpdateRef.current < 2000) return;
    
    lastStatsUpdateRef.current = now;
    onStatsUpdate(rideStats);
  }, [rideStats.distance, rideStats.duration, onStatsUpdate, isTracking]);

  return {
    isTracking,
    rideStats,
    routeCoordinates,
    startTracking,
    stopTracking,
    resetTracking,
  };
};
