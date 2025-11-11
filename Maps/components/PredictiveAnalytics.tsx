/**
 * PredictiveAnalytics Component
 * 
 * Provides data-driven insights such as:
 * - Low fuel warnings
 * - "Won't reach destination" alerts (based on current fuel)
 * - Maintenance reminders (change oil, tune-up)
 */

import React, { useEffect, useRef, useCallback } from 'react';
import Toast from 'react-native-toast-message';
import { isLowFuel, isCriticalFuel, canReachDestination, calculateDistancePossible } from '../utils/fuelCalculation';
import type { Motor, LocationCoords, RouteData } from '../../types';

interface PredictiveAnalyticsProps {
  selectedMotor: Motor | null;
  currentLocation: LocationCoords | null;
  destination?: LocationCoords | null;
  selectedRoute?: RouteData | null;
  distanceTraveled: number;
  onLowFuelWarning?: (fuelLevel: number) => void;
  onCriticalFuelWarning?: (fuelLevel: number) => void;
  onDestinationUnreachable?: (distancePossible: number, distanceRequired: number) => void;
}

export const PredictiveAnalytics: React.FC<PredictiveAnalyticsProps> = ({
  selectedMotor,
  currentLocation,
  destination,
  selectedRoute,
  distanceTraveled,
  onLowFuelWarning,
  onCriticalFuelWarning,
  onDestinationUnreachable,
}) => {
  const hasShownLowFuelWarning = useRef(false);
  const hasShownCriticalFuelWarning = useRef(false);
  const lastFuelWarningLevel = useRef<number>(100);

  // Check fuel level and show warnings
  useEffect(() => {
    if (!selectedMotor) return;

    const fuelLevel = selectedMotor.currentFuelLevel || 0;
    const fuelTank = selectedMotor.fuelTank || 15;

    // Debounce fuel level changes to prevent excessive logging
    const timeoutId = setTimeout(() => {
      // Only show warning if fuel level crossed a threshold
      if (fuelLevel <= 20 && fuelLevel > 10 && lastFuelWarningLevel.current > 20) {
        lastFuelWarningLevel.current = fuelLevel;
        hasShownLowFuelWarning.current = true;

        Toast.show({
          type: 'error',
          text1: 'Low Fuel Warning',
          text2: `${selectedMotor.nickname || 'Motor'}: ${fuelLevel.toFixed(0)}% fuel remaining`,
          visibilityTime: 3000,
        });

        onLowFuelWarning?.(fuelLevel);
      } else if (fuelLevel <= 10 && lastFuelWarningLevel.current > 10) {
        lastFuelWarningLevel.current = fuelLevel;
        hasShownCriticalFuelWarning.current = true;

        Toast.show({
          type: 'error',
          text1: 'Critical Fuel Level',
          text2: `${selectedMotor.nickname || 'Motor'}: ${fuelLevel.toFixed(0)}% fuel remaining!`,
          visibilityTime: 4000,
        });

        onCriticalFuelWarning?.(fuelLevel);
      } else if (fuelLevel > 20) {
        lastFuelWarningLevel.current = fuelLevel;
        // Reset warnings when fuel level increases above threshold
        if (fuelLevel > 20) {
          hasShownLowFuelWarning.current = false;
        }
        if (fuelLevel > 10) {
          hasShownCriticalFuelWarning.current = false;
        }
      }
    }, 1000); // Debounce by 1 second

    return () => clearTimeout(timeoutId);
  }, [selectedMotor?.currentFuelLevel, selectedMotor?.nickname, onLowFuelWarning, onCriticalFuelWarning]);

  // Check if destination is reachable with current fuel
  useEffect(() => {
    if (!selectedMotor || !destination || !selectedRoute) return;

    const distancePossible = calculateDistancePossible(selectedMotor);
    const distanceToDestination = selectedRoute.distance || 0;

    if (distanceToDestination > 0 && !canReachDestination(selectedMotor, distanceToDestination)) {
      const remainingDistance = distancePossible;
      const requiredDistance = distanceToDestination;

      Toast.show({
        type: 'error',
        text1: 'Insufficient Fuel',
        text2: `Cannot reach destination. Need ${requiredDistance.toFixed(1)}km but only have fuel for ${remainingDistance.toFixed(1)}km`,
        visibilityTime: 5000,
      });

      onDestinationUnreachable?.(remainingDistance, requiredDistance);
    }
  }, [selectedMotor, destination, selectedRoute, onDestinationUnreachable]);

  // Check maintenance reminders (oil change, tune-up)
  useEffect(() => {
    if (!selectedMotor) return;

    // Check if maintenance is due based on distance traveled
    const totalDistance = selectedMotor.analytics?.totalDistance || 0;
    const oilChangeInterval = 5000; // km
    const tuneUpInterval = 10000; // km

    if (totalDistance > 0 && totalDistance % oilChangeInterval === 0) {
      Toast.show({
        type: 'info',
        text1: 'Maintenance Reminder',
        text2: 'Consider changing oil soon',
        visibilityTime: 3000,
      });
    }

    if (totalDistance > 0 && totalDistance % tuneUpInterval === 0) {
      Toast.show({
        type: 'info',
        text1: 'Maintenance Reminder',
        text2: 'Consider a tune-up soon',
        visibilityTime: 3000,
      });
    }
  }, [selectedMotor?.analytics?.totalDistance]);

  // This component doesn't render anything visible
  // It only provides analytics and warnings
  return null;
};

