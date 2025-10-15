// API utility functions

import { LOCALHOST_IP } from '@env';

// Pluggable auth token provider. Configure from App.js
let authTokenGetter: (() => string | null | undefined) | null = null;

export const configureApi = (getToken: () => string | null | undefined) => {
  authTokenGetter = getToken;
};

/**
 * Generic API request function with error handling
 * @param endpoint - API endpoint
 * @param options - Fetch options
 * @returns Promise with response data
 */
export const apiRequest = async <T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> => {
  try {
    const token = authTokenGetter ? authTokenGetter() : undefined;
    const response = await fetch(`${LOCALHOST_IP}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    // Suppress noise for intentional aborts
    if ((error as any)?.name !== 'AbortError') {
      console.error('API request failed:', error);
    }
    throw error;
  }
};

/**
 * Fetch reports from API
 * @param signal - Abort signal for cancellation
 * @returns Promise with reports array
 */
export const fetchReports = async (signal?: AbortSignal) => {
  return apiRequest('/api/reports', { signal });
};

/**
 * Fetch gas stations from API
 * @param signal - Abort signal for cancellation
 * @returns Promise with gas stations array
 */
export const fetchGasStations = async (signal?: AbortSignal) => {
  return apiRequest('/api/gas-stations', { signal });
};

/**
 * Fetch user motors from API
 * @param userId - User ID
 * @param signal - Abort signal for cancellation
 * @returns Promise with motors array
 */
export const fetchUserMotors = async (userId: string, signal?: AbortSignal) => {
  return apiRequest(`/api/user-motors/user/${userId}`, { signal });
};

/**
 * Submit traffic report
 * @param reportData - Report data
 * @returns Promise with response
 */
export const submitTrafficReport = async (reportData: {
  reportType: string;
  location: { latitude: number; longitude: number };
  address: string;
  description: string;
  userId: string;
  image?: string;
}) => {
  return apiRequest('/api/reports/', {
    method: 'POST',
    body: JSON.stringify(reportData),
  });
};

/**
 * Vote on a report
 * @param reportId - Report ID
 * @param userId - User ID
 * @param vote - Vote value (1 or -1)
 * @returns Promise with response
 */
export const voteOnReport = async (reportId: string, userId: string, vote: number) => {
  return apiRequest(`/api/reports/${reportId}/vote`, {
    method: 'POST',
    body: JSON.stringify({ userId, vote }),
  });
};

/**
 * Update fuel level for a motor
 * @param motorId - Motor ID
 * @param fuelLevel - New fuel level
 * @returns Promise with response
 */
export const updateFuelLevel = async (motorId: string, fuelLevel: number) => {
  return apiRequest(`/api/user-motors/${motorId}`, {
    method: 'PUT',
    body: JSON.stringify({ currentFuelLevel: fuelLevel }),
  });
};

/**
 * Fetch all data for a user (reports, gas stations, motors)
 * @param userId - User ID
 * @param signal - Abort signal for cancellation
 * @returns Promise with combined data
 */
export const fetchAllUserData = async (userId: string, signal?: AbortSignal) => {
  try {
    const [reports, gasStations, motors] = await Promise.allSettled([
      fetchReports(signal),
      fetchGasStations(signal),
      fetchUserMotors(userId, signal),
    ]);

    return {
      reports: reports.status === 'fulfilled' ? reports.value : [],
      gasStations: gasStations.status === 'fulfilled' ? gasStations.value : [],
      motors: motors.status === 'fulfilled' ? motors.value : [],
      errors: {
        reports: reports.status === 'rejected' ? reports.reason : null,
        gasStations: gasStations.status === 'rejected' ? gasStations.reason : null,
        motors: motors.status === 'rejected' ? motors.reason : null,
      },
    };
  } catch (error) {
    console.error('Failed to fetch user data:', error);
    throw error;
  }
};
