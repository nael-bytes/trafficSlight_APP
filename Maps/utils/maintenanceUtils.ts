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
// Note: calculateFuelAfterRefuel and updateFuelLevelInBackend are no longer needed
// The specialized refuel endpoint handles fuel level updates automatically

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
    // Format timestamp as ISO 8601 string or keep as milliseconds
    const timestamp = action.timestamp;

    // Build details object, only including defined values
    const details: any = {
      cost: action.cost,
      notes: action.notes || '',
    };

    // For refuel: include quantity and costPerLiter if available
    if (action.type === 'refuel') {
      // For refuel, either quantity or costPerLiter is required per API docs
      // We calculate quantity from cost/costPerLiter, so we should have both
      if (action.quantity !== undefined && action.quantity !== null && !isNaN(action.quantity) && action.quantity > 0) {
        details.quantity = action.quantity;
      }
      if (action.costPerLiter !== undefined && action.costPerLiter !== null && !isNaN(action.costPerLiter) && action.costPerLiter > 0) {
        details.costPerLiter = action.costPerLiter;
      }
      
      // Validate that we have at least one of quantity or costPerLiter for refuel
      if (!details.quantity && !details.costPerLiter) {
        throw new Error('For refuel type, either quantity or costPerLiter is required');
      }
    } else if (action.type === 'oil_change') {
      // For oil_change: quantity is required
      if (action.quantity !== undefined && action.quantity !== null && !isNaN(action.quantity) && action.quantity > 0) {
        details.quantity = action.quantity;
      } else {
        throw new Error('Quantity is required for oil change type');
      }
    }
    // For tune_up, repair, other: only cost is required (already included)

    const maintenanceData = {
      motorId,
      userId,
      type: action.type, // Changed from actionType to type per API docs
      location: {
        lat: action.location.latitude, // Use lat/lng format per API docs
        lng: action.location.longitude,
        latitude: action.location.latitude, // Also include latitude/longitude as alternative format
        longitude: action.location.longitude,
      },
      details,
      timestamp: timestamp,
    };

    // Log the request data for debugging
    if (__DEV__) {
      console.log('[MaintenanceUtils] 📤 Sending maintenance record request:', {
        type: maintenanceData.type,
        motorId: maintenanceData.motorId,
        userId: maintenanceData.userId,
        details: maintenanceData.details,
        hasLocation: !!maintenanceData.location,
        timestamp: maintenanceData.timestamp,
      });
    }

    const response = await fetch(`${API_BASE}/api/maintenance-records`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
      },
      body: JSON.stringify(maintenanceData),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error('[MaintenanceUtils] ❌ API Error Response:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText,
      });
      throw new Error(`Failed to save maintenance record: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log('[MaintenanceUtils] ✅ Maintenance record saved:', result);
  } catch (error: any) {
    console.error('[MaintenanceUtils] ❌ Error saving maintenance record:', error);
    throw error;
  }
};

/**
 * Handle refuel action using specialized refuel endpoint
 * The endpoint automatically calculates quantity, updates fuel level, and creates maintenance record
 */
export const handleRefuel = async (
  motor: Motor,
  location: LocationCoords,
  cost: number,
  costPerLiter: number,
  quantity: number, // Calculated quantity (for reference, endpoint recalculates it)
  userId: string,
  token?: string,
  notes?: string
): Promise<number> => {
  try {
    // Validate inputs
    if (cost <= 0) {
      throw new Error('Price must be a positive number');
    }
    if (costPerLiter <= 0) {
      throw new Error('Cost per liter must be a positive number');
    }

    // Build request body for specialized refuel endpoint
    const refuelData: any = {
      userMotorId: motor._id,
      price: cost,
      costPerLiter: costPerLiter,
    };

    // Add optional fields if provided
    if (location && (location.latitude !== 0 || location.longitude !== 0)) {
      refuelData.location = {
        lat: location.latitude,
        lng: location.longitude,
        ...(location.address && { address: location.address }),
      };
    }

    if (notes) {
      refuelData.notes = notes;
    }

    // Log request for debugging
    if (__DEV__) {
      console.log('[MaintenanceUtils] 📤 Sending refuel request to specialized endpoint:', {
        userMotorId: refuelData.userMotorId,
        price: refuelData.price,
        costPerLiter: refuelData.costPerLiter,
        hasLocation: !!refuelData.location,
        hasNotes: !!refuelData.notes,
      });
    }

    // Call specialized refuel endpoint
    const response = await fetch(`${API_BASE}/api/maintenance-records/refuel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
      },
      body: JSON.stringify(refuelData),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error('[MaintenanceUtils] ❌ Refuel API Error Response:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText,
      });
      throw new Error(`Failed to refuel: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    
    if (__DEV__) {
      console.log('[MaintenanceUtils] ✅ Refuel successful:', {
        quantity: result.quantity,
        newFuelLevel: result.newFuelLevel,
        refueledPercent: result.refueledPercent,
        maintenanceRecordId: result.maintenanceRecord?._id,
      });
    }

    // Return the new fuel level from the API response
    // The endpoint automatically updated the motor's fuel level
    return result.newFuelLevel;
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

