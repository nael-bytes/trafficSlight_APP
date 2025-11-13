/**
 * Trip Distance Update Utility
 * 
 * Handles API calls to POST /api/trip/update-distance endpoint
 * for real-time fuel level updates based on distance traveled.
 */

import { getAuthToken } from '../../utils/api';
import { LOCALHOST_IP } from '@env';

// API Base URL
const API_BASE = LOCALHOST_IP || "https://ts-backend-1-jyit.onrender.com";

/**
 * Response from trip distance update API
 */
export interface TripDistanceUpdateResponse {
  success: boolean;
  userMotorId?: string;
  actualDistanceTraveled?: number;
  fuelUsedLiters?: number;
  fuelUsedPercent?: number;
  newFuelLevel?: number;
  lowFuelWarning?: boolean;
  totalDrivableDistanceWithCurrentGas?: number;
  status?: 'skipped';
  reason?: string;
}

/**
 * Update trip distance and fuel level via API
 * 
 * @param userMotorId - The MongoDB ObjectId of the UserMotor document
 * @param totalDistanceTraveled - Total distance traveled since trip start (in kilometers)
 * @param lastPostedDistance - The last posted distance value (in kilometers)
 * @returns Promise with API response or null if skipped
 * @throws Error if API call fails
 */
export const updateTripDistance = async (
  userMotorId: string,
  totalDistanceTraveled: number,
  lastPostedDistance: number
): Promise<TripDistanceUpdateResponse | null> => {
  try {
    // Validate inputs
    if (!userMotorId || typeof userMotorId !== 'string') {
      throw new Error('userMotorId is required and must be a string');
    }

    if (typeof totalDistanceTraveled !== 'number' || totalDistanceTraveled < 0) {
      throw new Error('totalDistanceTraveled must be a non-negative number');
    }

    if (typeof lastPostedDistance !== 'number' || lastPostedDistance < 0) {
      throw new Error('lastPostedDistance must be a non-negative number');
    }

    if (totalDistanceTraveled < lastPostedDistance) {
      throw new Error('totalDistanceTraveled must be greater than or equal to lastPostedDistance');
    }

    // Get authentication token
    const token = await getAuthToken();
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Make API call
    const response = await fetch(`${API_BASE}/api/trip/update-distance`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        userMotorId,
        totalDistanceTraveled,
        lastPostedDistance,
      }),
    });

    // Handle HTTP errors
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({
        message: `HTTP ${response.status}: ${response.statusText}`,
      }));

      // Handle specific error codes
      if (response.status === 400) {
        throw new Error(errorData.message || 'Invalid request parameters');
      } else if (response.status === 404) {
        throw new Error(errorData.message || 'UserMotor not found');
      } else if (response.status === 500) {
        throw new Error(errorData.message || 'Server error occurred');
      } else {
        throw new Error(errorData.message || `API request failed with status ${response.status}`);
      }
    }

    const data: TripDistanceUpdateResponse = await response.json();

    // Handle skipped updates (not an error, just return null)
    if (data.status === 'skipped') {
      if (__DEV__) {
        console.log('[tripDistanceUpdate] Update skipped:', data.reason || 'Distance too small');
      }
      return null;
    }

    // Validate successful response
    if (!data.success) {
      throw new Error(data.reason || 'API returned unsuccessful response');
    }

    if (__DEV__) {
      console.log('[tripDistanceUpdate] ✅ Distance updated successfully', {
        actualDistanceTraveled: data.actualDistanceTraveled,
        fuelUsedLiters: data.fuelUsedLiters,
        fuelUsedPercent: data.fuelUsedPercent,
        newFuelLevel: data.newFuelLevel,
        lowFuelWarning: data.lowFuelWarning,
      });
    }

    return data;
  } catch (error: any) {
    if (__DEV__) {
      console.error('[tripDistanceUpdate] ❌ Error updating trip distance:', {
        userMotorId,
        totalDistanceTraveled,
        lastPostedDistance,
        error: error.message,
      });
    }
    throw error;
  }
};

/**
 * Retry wrapper for updateTripDistance with exponential backoff
 * 
 * @param userMotorId - The MongoDB ObjectId of the UserMotor document
 * @param totalDistanceTraveled - Total distance traveled since trip start (in kilometers)
 * @param lastPostedDistance - The last posted distance value (in kilometers)
 * @param maxRetries - Maximum number of retry attempts (default: 3)
 * @param initialDelay - Initial delay in milliseconds (default: 1000)
 * @returns Promise with API response or null if skipped
 */
export const updateTripDistanceWithRetry = async (
  userMotorId: string,
  totalDistanceTraveled: number,
  lastPostedDistance: number,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<TripDistanceUpdateResponse | null> => {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await updateTripDistance(userMotorId, totalDistanceTraveled, lastPostedDistance);
    } catch (error: any) {
      lastError = error;

      // Don't retry on 400 (bad request) or 404 (not found) errors
      if (error.message.includes('400') || error.message.includes('404')) {
        throw error;
      }

      // Don't retry on last attempt
      if (attempt === maxRetries - 1) {
        break;
      }

      // Calculate exponential backoff delay
      const delay = initialDelay * Math.pow(2, attempt);
      
      if (__DEV__) {
        console.log(`[tripDistanceUpdate] Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms`);
      }

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  // All retries failed
  throw lastError || new Error('Failed to update trip distance after retries');
};

