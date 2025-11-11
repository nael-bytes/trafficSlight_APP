/**
 * useStatsUpdate Hook
 * 
 * Extracts stats update logic:
 * - handleStatsUpdate callback
 * - Fuel level updates based on distance traveled
 * - Motor analytics updates
 * 
 * @module useStatsUpdate
 */

import { useCallback } from 'react';
import type { Motor, RideStats } from '../../types';
import { calculateFuelAfterDistance } from './fuelCalculation';
import { validateFuelLevel as validateFuelLevelUtil } from './fuelCalculation';
import { updateFuelLevel } from '../../utils/api';

interface UseStatsUpdateParams {
  selectedMotor: Motor | null;
  setSelectedMotor: (motor: Motor | null | ((prev: Motor | null) => Motor | null)) => void;
  lastProcessedDistanceRef: React.RefObject<number>;
}

interface UseStatsUpdateReturn {
  handleStatsUpdate: (stats: RideStats) => Promise<void>;
}

/**
 * Custom hook for managing stats updates
 */
export const useStatsUpdate = ({
  selectedMotor,
  setSelectedMotor,
  lastProcessedDistanceRef,
}: UseStatsUpdateParams): UseStatsUpdateReturn => {
  // Memoize stats update callback with backend fuel calculation
  const handleStatsUpdate = useCallback(async (stats: RideStats) => {
    if (__DEV__) {
      console.log('[useStatsUpdate] 📊 handleStatsUpdate called', {
        distance: stats.distance,
        duration: stats.duration,
        speed: stats.speed,
        avgSpeed: stats.avgSpeed,
        timestamp: new Date().toISOString(),
      });
    }

    if (stats.distance > 0) {
      // Calculate incremental distance (new distance since last update)
      const incrementalDistance = stats.distance - (lastProcessedDistanceRef.current || 0);

      if (__DEV__) {
        console.log('[useStatsUpdate] 📏 Distance calculation', {
          totalDistance: stats.distance,
          lastProcessedDistance: lastProcessedDistanceRef.current || 0,
          incrementalDistance,
          willProcess: incrementalDistance > 0.01,
        });
      }

      // Only process fuel if there's significant new distance (at least 0.01km)
      if (incrementalDistance > 0.01) {
        if (selectedMotor) {
          if (__DEV__) {
            console.log('[useStatsUpdate] ⛽ Processing fuel update', {
              motorId: selectedMotor._id,
              currentFuelLevel: selectedMotor.currentFuelLevel,
              incrementalDistance,
            });
          }
          // Update fuel level using backend API (not local calculation)
          const motorData = {
            fuelConsumption: selectedMotor.fuelConsumption || selectedMotor.fuelEfficiency || 0,
            fuelTank: selectedMotor.fuelTank || 15, // Default tank size if not provided (15L)
            currentFuelLevel: selectedMotor.currentFuelLevel || 0
          };

          if (motorData.fuelConsumption > 0 && motorData.fuelTank > 0) {
            try {
              // Calculate new fuel level using new utility function
              const newFuelLevel = await calculateFuelAfterDistance(selectedMotor, incrementalDistance);

              // Validate fuel level before processing
              if (!validateFuelLevelUtil(newFuelLevel)) {
                return; // Don't update if validation fails
              }

              // Only update backend every 0.1km to reduce API calls
              if (incrementalDistance >= 0.1) {
                if (__DEV__) {
                  console.log('[useStatsUpdate] 🔄 Updating fuel level to backend', {
                    motorId: selectedMotor._id,
                    oldFuelLevel: selectedMotor.currentFuelLevel,
                    newFuelLevel,
                  });
                }
                updateFuelLevel(selectedMotor._id, newFuelLevel).catch((error: any) => {
                  console.warn('[useStatsUpdate] ❌ Fuel update failed:', error.message);
                });
              } else {
                if (__DEV__) {
                  console.log('[useStatsUpdate] ⏭️ Skipping backend fuel update (distance < 0.1km)', {
                    incrementalDistance,
                  });
                }
              }

              const updatedMotor = {
                ...selectedMotor,
                currentFuelLevel: newFuelLevel,
                analytics: {
                  ...selectedMotor.analytics,
                  totalDistance: selectedMotor.analytics.totalDistance + incrementalDistance,
                }
              };

              if (__DEV__) {
                console.log('[useStatsUpdate] ✅ Motor updated with new fuel level', {
                  motorId: updatedMotor._id,
                  newFuelLevel,
                  totalDistance: updatedMotor.analytics.totalDistance,
                });
              }

              setSelectedMotor(updatedMotor);
            } catch (error: any) {
              console.warn('[useStatsUpdate] Backend fuel calculation failed, skipping update:', error);
              // Continue without fuel level update if backend fails
              const updatedMotor = {
                ...selectedMotor,
                analytics: {
                  ...selectedMotor.analytics,
                  totalDistance: selectedMotor.analytics.totalDistance + incrementalDistance,
                }
              };
              setSelectedMotor(updatedMotor);
            }
          } else {
            // Update without fuel level if data is missing
            const updatedMotor = {
              ...selectedMotor,
              analytics: {
                ...selectedMotor.analytics,
                totalDistance: selectedMotor.analytics.totalDistance + incrementalDistance,
              }
            };
            setSelectedMotor(updatedMotor);
          }
        }

        // Update the last processed distance
        if (lastProcessedDistanceRef.current !== null) {
          lastProcessedDistanceRef.current = stats.distance;
        }
      }
    }
  }, [selectedMotor, setSelectedMotor, lastProcessedDistanceRef]);

  return {
    handleStatsUpdate,
  };
};

