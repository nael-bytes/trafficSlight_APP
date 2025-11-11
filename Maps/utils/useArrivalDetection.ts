/**
 * Arrival detection hook
 * Manages destination arrival detection and notifications
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import Toast from 'react-native-toast-message';

interface LocationCoords {
  latitude: number;
  longitude: number;
}

interface UseArrivalDetectionParams {
  destination: LocationCoords | null;
  currentLocation: LocationCoords | null;
  isNavigating: boolean;
  calculateDistance: (lat1: number, lon1: number, lat2: number, lon2: number) => Promise<number>;
}

/**
 * Hook for detecting when user arrives at destination
 */
export const useArrivalDetection = ({
  destination,
  currentLocation,
  isNavigating,
  calculateDistance,
}: UseArrivalDetectionParams) => {
  const [hasArrived, setHasArrived] = useState(false);
  const [arrivalNotificationShown, setArrivalNotificationShown] = useState(false);
  const [arrivalDistance, setArrivalDistance] = useState<number | null>(null);
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Check if user has arrived at destination
   */
  const checkArrival = useCallback(async () => {
    if (!destination || !currentLocation || !isNavigating) {
      return;
    }

    try {
      const distance = await calculateDistance(
        currentLocation.latitude,
        currentLocation.longitude,
        destination.latitude,
        destination.longitude
      );

      setArrivalDistance(distance);

      // Consider arrived if within 50 meters
      const ARRIVAL_THRESHOLD = 50;
      if (distance <= ARRIVAL_THRESHOLD && !hasArrived) {
        setHasArrived(true);
        
        if (!arrivalNotificationShown) {
          Toast.show({
            type: 'success',
            text1: 'Destination Reached!',
            text2: 'You have arrived at your destination',
            position: 'top',
            visibilityTime: 5000,
          });
          setArrivalNotificationShown(true);
        }
      }
    } catch (error) {
      console.error('[ArrivalDetection] Error checking arrival:', error);
    }
  }, [destination, currentLocation, isNavigating, hasArrived, arrivalNotificationShown, calculateDistance]);

  // Check arrival periodically when navigating
  useEffect(() => {
    if (isNavigating && destination && currentLocation) {
      // Check immediately
      checkArrival();
      
      // Then check every 5 seconds
      checkIntervalRef.current = setInterval(checkArrival, 5000);
    } else {
      // Reset arrival state when not navigating
      setHasArrived(false);
      setArrivalNotificationShown(false);
      setArrivalDistance(null);
    }

    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
    };
  }, [isNavigating, destination, currentLocation, checkArrival]);

  /**
   * Reset arrival state
   */
  const resetArrival = useCallback(() => {
    setHasArrived(false);
    setArrivalNotificationShown(false);
    setArrivalDistance(null);
  }, []);

  return {
    hasArrived,
    arrivalNotificationShown,
    arrivalDistance,
    resetArrival,
  };
};

