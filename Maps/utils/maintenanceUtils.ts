/**
 * Maintenance Utilities
 * 
 * Handles all maintenance-related operations including:
 * - Refueling
 * - Oil changes
 * - Tune-ups
 * - Maintenance record creation
 */

import { Alert } from 'react-native';
import { calculateFuelAfterRefuel } from './fuelCalculation';
import { updateFuelLevelInBackend } from './fuelCalculation';

export interface LocationCoords {
  latitude: number;
  longitude: number;
  address?: string;
}

export interface MaintenanceAction {
  type: 'refuel' | 'oil_change' | 'tune_up';
  timestamp: number;
  location: LocationCoords;
  cost: number;
  quantity?: number;
  costPerLiter?: number;
  notes?: string;
}

export interface Motor {
  _id: string;
  currentFuelLevel: number;
  fuelTank: number;
  fuelEfficiency?: number;
  fuelConsumption?: number;
  nickname?: string;
}

const API_BASE = "https://ts-backend-1-jyit.onrender.com";

/**
 * Save maintenance record to backend
 */
export const saveMaintenanceRecord = async (
  action: MaintenanceAction,
  motorId: string,
  userId: string,
  token?: string
): Promise<void> => {
  try {
    const maintenanceData = {
      motorId,
      userId,
      actionType: action.type,
      location: {
        latitude: action.location.latitude,
        longitude: action.location.longitude,
        address: action.location.address || 'Unknown location',
      },
      details: {
        cost: action.cost,
        quantity: action.quantity,
        costPerLiter: action.costPerLiter,
        notes: action.notes || '',
      },
      timestamp: action.timestamp,
    };

    const response = await fetch(`${API_BASE}/api/maintenance`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
      },
      body: JSON.stringify(maintenanceData),
    });

    if (!response.ok) {
      throw new Error(`Failed to save maintenance record: ${response.status}`);
    }

    const result = await response.json();
    console.log('[MaintenanceUtils] ✅ Maintenance record saved:', result);
  } catch (error: any) {
    console.error('[MaintenanceUtils] ❌ Error saving maintenance record:', error);
    throw error;
  }
};

/**
 * Handle refuel action
 * Calculates new fuel level and saves maintenance record
 */
export const handleRefuel = async (
  motor: Motor,
  location: LocationCoords,
  cost: number,
  costPerLiter: number,
  quantity: number,
  userId: string,
  token?: string,
  notes?: string
): Promise<number> => {
  try {
    // Calculate new fuel level after refuel
    const newFuelLevel = await calculateFuelAfterRefuel(motor, quantity, cost);

    // Update fuel level in backend
    await updateFuelLevelInBackend(motor._id, newFuelLevel);

    // Save maintenance record
    const maintenanceAction: MaintenanceAction = {
      type: 'refuel',
      timestamp: Date.now(),
      location,
      cost,
      quantity,
      costPerLiter,
      notes,
    };

    await saveMaintenanceRecord(maintenanceAction, motor._id, userId, token);

    return newFuelLevel;
  } catch (error: any) {
    console.error('[MaintenanceUtils] ❌ Error handling refuel:', error);
    throw error;
  }
};

/**
 * Handle oil change action
 */
export const handleOilChange = async (
  motor: Motor,
  location: LocationCoords,
  cost: number,
  quantity: number,
  userId: string,
  token?: string,
  notes?: string
): Promise<void> => {
  try {
    const maintenanceAction: MaintenanceAction = {
      type: 'oil_change',
      timestamp: Date.now(),
      location,
      cost,
      quantity,
      notes,
    };

    await saveMaintenanceRecord(maintenanceAction, motor._id, userId, token);
  } catch (error: any) {
    console.error('[MaintenanceUtils] ❌ Error handling oil change:', error);
    throw error;
  }
};

/**
 * Handle tune-up action
 */
export const handleTuneUp = async (
  motor: Motor,
  location: LocationCoords,
  cost: number,
  userId: string,
  token?: string,
  notes?: string
): Promise<void> => {
  try {
    const maintenanceAction: MaintenanceAction = {
      type: 'tune_up',
      timestamp: Date.now(),
      location,
      cost,
      notes,
    };

    await saveMaintenanceRecord(maintenanceAction, motor._id, userId, token);
  } catch (error: any) {
    console.error('[MaintenanceUtils] ❌ Error handling tune-up:', error);
    throw error;
  }
};

/**
 * Calculate refuel quantity from cost and cost per liter
 */
export const calculateRefuelQuantity = (
  cost: number,
  costPerLiter: number
): number => {
  if (costPerLiter <= 0) {
    return 0;
  }
  return cost / costPerLiter;
};

/**
 * Validate maintenance form data
 */
export const validateMaintenanceForm = (
  type: string,
  cost: string,
  quantity?: string,
  costPerLiter?: string
): { isValid: boolean; error?: string } => {
  const costValue = parseFloat(cost);
  
  if (isNaN(costValue) || costValue <= 0) {
    return { isValid: false, error: 'Cost must be a positive number' };
  }

  if (type === 'refuel') {
    const costPerLiterValue = costPerLiter ? parseFloat(costPerLiter) : 0;
    if (!costPerLiter || isNaN(costPerLiterValue) || costPerLiterValue <= 0) {
      return { isValid: false, error: 'Cost per liter must be a positive number' };
    }
  }

  if (type === 'oil_change' && quantity) {
    const quantityValue = parseFloat(quantity);
    if (isNaN(quantityValue) || quantityValue <= 0) {
      return { isValid: false, error: 'Quantity must be a positive number' };
    }
  }

  return { isValid: true };
};

