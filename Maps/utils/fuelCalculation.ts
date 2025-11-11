/**
 * Fuel Calculation Utilities
 * 
 * Handles all fuel-related calculations including:
 * - Fuel consumption based on distance
 * - Remaining fuel percentage
 * - Distance possible with current fuel
 * - Fuel level updates after refueling
 */

import { calculateNewFuelLevel, calculateFuelLevelAfterRefuel } from '../../services/fuelService';
import { updateFuelLevel } from '../../utils/api';

export interface Motor {
  _id: string;
  currentFuelLevel: number;
  fuelTank: number;
  fuelEfficiency?: number;
  fuelConsumption?: number;
  nickname?: string;
}

/**
 * Calculate remaining fuel percentage based on distance traveled
 * Uses the formula:
 * distancePossible = fuelTankCapacity * fuelEfficiency
 * remainingFuelPercent = ((distancePossible - distanceTraveled) / distancePossible) * 100
 */
export const calculateRemainingFuelPercent = (
  fuelTankCapacity: number,
  fuelEfficiency: number,
  distanceTraveled: number
): number => {
  if (fuelTankCapacity <= 0 || fuelEfficiency <= 0) {
    return 0;
  }

  const distancePossible = fuelTankCapacity * fuelEfficiency;
  if (distancePossible <= 0) {
    return 0;
  }

  const remainingDistance = Math.max(0, distancePossible - distanceTraveled);
  const remainingFuelPercent = (remainingDistance / distancePossible) * 100;

  return Math.max(0, Math.min(100, remainingFuelPercent));
};

/**
 * Calculate new fuel level after traveling a certain distance
 * Uses backend API for accurate calculation
 */
export const calculateFuelAfterDistance = async (
  motor: Motor,
  distanceTraveled: number
): Promise<number> => {
  try {
    const newFuelLevel = await calculateNewFuelLevel(motor, distanceTraveled);
    return Math.max(0, Math.min(100, newFuelLevel));
  } catch (error) {
    console.error('[FuelCalculation] Error calculating fuel after distance:', error);
    // Fallback calculation
    const fuelConsumption = motor.fuelConsumption || motor.fuelEfficiency || 0;
    if (fuelConsumption <= 0) return motor.currentFuelLevel;

    const fuelUsed = distanceTraveled / fuelConsumption;
    const fuelTankCapacity = motor.fuelTank || 15;
    const fuelUsedPercent = (fuelUsed / fuelTankCapacity) * 100;
    const newFuelLevel = motor.currentFuelLevel - fuelUsedPercent;

    return Math.max(0, Math.min(100, newFuelLevel));
  }
};

/**
 * Calculate fuel level after refueling
 * Uses backend API for accurate calculation
 */
export const calculateFuelAfterRefuel = async (
  motor: Motor,
  refuelAmount: number,
  refuelCost: number
): Promise<number> => {
  try {
    const newFuelLevel = await calculateFuelLevelAfterRefuel(motor, refuelAmount, refuelCost);
    return Math.max(0, Math.min(100, newFuelLevel));
  } catch (error) {
    console.error('[FuelCalculation] Error calculating fuel after refuel:', error);
    // Fallback calculation
    const fuelTankCapacity = motor.fuelTank || 15;
    if (fuelTankCapacity <= 0) return motor.currentFuelLevel;

    const refuelPercent = (refuelAmount / fuelTankCapacity) * 100;
    const newFuelLevel = motor.currentFuelLevel + refuelPercent;

    return Math.max(0, Math.min(100, newFuelLevel));
  }
};

/**
 * Calculate distance possible with current fuel level
 */
export const calculateDistancePossible = (
  motor: Motor
): number => {
  const fuelLevel = motor.currentFuelLevel || 0;
  const fuelTankCapacity = motor.fuelTank || 15;
  const fuelEfficiency = motor.fuelEfficiency || motor.fuelConsumption || 0;

  if (fuelLevel <= 0 || fuelTankCapacity <= 0 || fuelEfficiency <= 0) {
    return 0;
  }

  const currentFuel = (fuelLevel / 100) * fuelTankCapacity;
  const distancePossible = currentFuel * fuelEfficiency;

  return Math.max(0, distancePossible);
};

/**
 * Check if fuel level is low (below threshold)
 */
export const isLowFuel = (
  fuelLevel: number,
  threshold: number = 20
): boolean => {
  return fuelLevel <= threshold;
};

/**
 * Check if fuel is critically low (below critical threshold)
 */
export const isCriticalFuel = (
  fuelLevel: number,
  threshold: number = 10
): boolean => {
  return fuelLevel <= threshold;
};

/**
 * Update fuel level in backend
 */
export const updateFuelLevelInBackend = async (
  motorId: string,
  newFuelLevel: number
): Promise<void> => {
  try {
    await updateFuelLevel(motorId, newFuelLevel);
  } catch (error) {
    console.error('[FuelCalculation] Error updating fuel level in backend:', error);
    throw error;
  }
};

/**
 * Validate fuel level (must be between 0 and 100)
 */
export const validateFuelLevel = (fuelLevel: number): boolean => {
  return fuelLevel >= 0 && fuelLevel <= 100 && !isNaN(fuelLevel) && isFinite(fuelLevel);
};

/**
 * Check if motor can reach destination with current fuel
 */
export const canReachDestination = (
  motor: Motor,
  distanceToDestination: number
): boolean => {
  const distancePossible = calculateDistancePossible(motor);
  return distancePossible >= distanceToDestination;
};

