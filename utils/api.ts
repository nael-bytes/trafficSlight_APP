// API utility functions

import { LOCALHOST_IP } from '@env';
import AsyncStorage from '@react-native-async-storage/async-storage';

// FIXED: Consolidated token storage - single source of truth
// Pluggable auth token provider. Configure from App.js
// This can be a function that returns the token, or null to always read from AsyncStorage
let authTokenGetter: (() => string | null | undefined) | null = null;

export const configureApi = (getToken: () => string | null | undefined) => {
  authTokenGetter = getToken;
};

/**
 * Get authentication token - FIXED: Single source of truth
 * Priority: authTokenGetter (from AuthContext) > AsyncStorage
 * This ensures consistency - token is always read from the same source
 * @returns Promise with authentication token or null/undefined
 */
export const getAuthToken = async (): Promise<string | null | undefined> => {
  // FIXED: Single source of truth - always try authTokenGetter first (from AuthContext)
  // This ensures we use the same token source everywhere
  if (authTokenGetter) {
    try {
      const token = authTokenGetter();
      if (token) {
        // Verify token is also in AsyncStorage for consistency (async check, don't block)
        AsyncStorage.getItem('token').then(storedToken => {
          if (storedToken !== token && __DEV__) {
            console.warn('[api.ts] Token mismatch between AuthContext and AsyncStorage - using AuthContext token');
          }
        }).catch(() => {});
        return token;
      }
    } catch (error) {
      // Fall through to AsyncStorage if getter fails
      if (__DEV__) {
        console.warn('[api.ts] authTokenGetter failed, falling back to AsyncStorage:', error);
      }
    }
  }
  
  // Fallback to reading from AsyncStorage (always reads latest token)
  // This ensures we get the token even if configureApi wasn't called
  try {
    const token = await AsyncStorage.getItem('token');
    if (__DEV__ && token && !authTokenGetter) {
      // Warn if token exists but getter isn't configured (for debugging)
      console.warn('[api.ts] Token found in AsyncStorage but authTokenGetter not configured');
    }
    return token;
  } catch (error) {
    return null;
  }
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
    // Get token asynchronously (supports both sync and async getters)
    const token = await getAuthToken();
    
    // Log token details for debugging (only for auth endpoints or if __DEV__)
    if (__DEV__ && (endpoint.includes('/users/') || endpoint.includes('/auth/'))) {
      console.log('[api.ts] Making API request:', {
        endpoint,
        hasToken: !!token,
        tokenLength: token?.length || 0,
        tokenPreview: token ? `${token.substring(0, 20)}...` : 'NO TOKEN',
        tokenSource: token ? (authTokenGetter ? 'authTokenGetter' : 'AsyncStorage') : 'NONE',
      });
    }
    
    const response = await fetch(`${LOCALHOST_IP}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      // Read response as text first (can only be read once)
      const responseText = await response.text().catch(() => '');
      let errorData = {};
      let errorMessage = `HTTP error! status: ${response.status}`;
      
      // Try to parse as JSON if response is not empty
      if (responseText) {
        try {
          errorData = JSON.parse(responseText);
          errorMessage = errorData.message || errorData.msg || errorMessage;
        } catch (parseError) {
          // If not JSON, use the text as the error message
          errorMessage = responseText.substring(0, 200) || errorMessage;
        }
      }
      
      // Handle 401 Unauthorized - token expired or invalid
      if (response.status === 401 || errorMessage.includes('Authentication required')) {
        const token = await getAuthToken();
        
        // Check if this is a login-related endpoint (during login flow)
        // Don't clear token immediately if it's right after login - might be backend timing issue
        const isLoginFlow = endpoint.includes('/users/me') || endpoint.includes('/users/complete');
        
        console.error('[api.ts] ⚠️ AUTHENTICATION ERROR - API request failed:', {
          status: response.status,
          statusText: response.statusText,
          errorMessage,
          endpoint,
          hasToken: !!token,
          tokenLength: token?.length || 0,
          tokenPreview: token ? `${token.substring(0, 20)}...` : 'NO TOKEN',
          responseBody: responseText.substring(0, 500), // First 500 chars of response
          fullUrl: `${LOCALHOST_IP}${endpoint}`,
          requestHeaders: {
            'Content-Type': 'application/json',
            'Authorization': token ? `Bearer ${token.substring(0, 20)}...` : 'NO TOKEN',
          },
          isLoginFlow,
          willClearToken: !isLoginFlow, // Only clear if not in login flow
        });
        
        // Only clear token if it actually exists AND not in login flow
        // During login flow, the token might be valid but backend hasn't processed it yet
        if (token && !isLoginFlow) {
          try {
            await AsyncStorage.removeItem('token');
            await AsyncStorage.removeItem('user');
            console.error('[api.ts] 🔒 Cleared invalid token from storage - User will need to login again');
          } catch (storageError) {
            console.error('[api.ts] ❌ Failed to clear token from storage:', storageError);
          }
        } else if (token && isLoginFlow) {
          console.warn('[api.ts] ⚠️ Auth error during login flow - token might be valid but backend not ready yet');
          console.warn('[api.ts] ⚠️ Token will NOT be cleared - this might be a backend timing issue');
        } else {
          console.error('[api.ts] ⚠️ No token found - token may have been cleared already');
        }
        
        // Throw error with flag for auth error handling
        const authError = new Error(`Authentication required. Please login. (${response.status}: ${errorMessage})`);
        (authError as any).isAuthError = true;
        (authError as any).endpoint = endpoint;
        (authError as any).responseBody = responseText;
        throw authError;
      }
      
      throw new Error(errorMessage);
    }

    return await response.json();
  } catch (error) {
    // Log all errors except intentional aborts
    if ((error as any)?.name !== 'AbortError') {
      if ((error as any)?.isAuthError) {
        console.error('[api.ts] Authentication error:', {
          message: (error as Error).message,
          endpoint,
          error,
        });
      } else {
        console.error('[api.ts] API request failed:', {
          message: (error as Error).message,
          endpoint,
          error,
        });
      }
    }
    throw error;
  }
};

/**
 * Fetch reports from API with optional query parameters
 * @param options - Query parameters and options
 * @param options.signal - Abort signal for cancellation
 * @param options.includeArchived - Include archived reports (default: false)
 * @param options.includeInvalid - Include reports with invalid coordinates (default: false)
 * @param options.filters - Filter criteria (types, status)
 * @param options.viewport - Viewport bounds for filtering (north, south, east, west)
 * @returns Promise with reports array
 * 
 * API Response Format (from documentation):
 * {
 *   "success": true,
 *   "data": [...],
 *   "statistics": {...}
 * }
 */
export interface FetchReportsOptions {
  signal?: AbortSignal;
  includeArchived?: boolean;
  includeInvalid?: boolean;
  filters?: {
    types?: string[]; // ['Accident', 'Traffic Jam', 'Road Closure', 'Hazard']
    status?: string[]; // ['active', 'resolved']
  };
  viewport?: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
}

export const fetchReports = async (options?: FetchReportsOptions | AbortSignal) => {
  // Backward compatibility: if first argument is AbortSignal, treat it as signal
  let signal: AbortSignal | undefined;
  let includeArchived: boolean | undefined;
  let includeInvalid: boolean | undefined;
  let filters: { types?: string[]; status?: string[] } | undefined;
  let viewport: { north: number; south: number; east: number; west: number } | undefined;

  if (options instanceof AbortSignal) {
    // Old signature: fetchReports(signal)
    signal = options;
  } else if (options) {
    // New signature: fetchReports({ signal, includeArchived, ... })
    signal = options.signal;
    includeArchived = options.includeArchived;
    includeInvalid = options.includeInvalid;
    filters = options.filters;
    viewport = options.viewport;
  }

  // Build query parameters
  const queryParams = new URLSearchParams();
  if (includeArchived === true) {
    queryParams.append('includeArchived', 'true');
  }
  if (includeInvalid === true) {
    queryParams.append('includeInvalid', 'true');
  }
  if (filters) {
    queryParams.append('filters', JSON.stringify(filters));
  }
  if (viewport) {
    queryParams.append('viewport', JSON.stringify(viewport));
  }

  const url = `/api/reports${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
  
  if (__DEV__ && (filters || viewport || includeArchived || includeInvalid)) {
    console.log('[api.ts] Fetching reports with query parameters:', {
      includeArchived,
      includeInvalid,
      filters,
      viewport,
    });
  }

  const response = await apiRequest<{ success: boolean; data: any[]; statistics?: any }>(url, { signal });
  
  // CRITICAL: Handle documented response format { success: true, data: [...] }
  // If response has success and data fields, extract data array
  // Otherwise, assume response is already an array (backward compatibility)
  if (response && typeof response === 'object' && 'success' in response && 'data' in response) {
    return Array.isArray(response.data) ? response.data : [];
  }
  
  // Backward compatibility: if response is already an array, return it
  if (Array.isArray(response)) {
    return response;
  }
  
  // Fallback: return empty array if response format is unexpected
  if (__DEV__) {
    console.warn('[api.ts] Unexpected response format from /api/reports:', response);
  }
  return [];
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
 * Fetch current user profile from API
 * Uses: GET /api/users/me (updated backend endpoint)
 * This endpoint works whether authentication middleware is enabled or not
 * Checks if req.user is already a full user object or fetches from database
 * @param signal - Abort signal for cancellation
 * @returns Promise with user profile data
 */
export const fetchUserProfile = async (signal?: AbortSignal) => {
  return apiRequest('/api/users/me', { signal });
};

/**
 * Fetch complete user data from API (comprehensive endpoint)
 * Uses: GET /api/users/complete (new backend endpoint)
 * Returns all user data in one call including:
 * - User profile, motors, trips, fuel logs, maintenance, reports,
 *   notifications, saved destinations, achievements, routes,
 *   analytics, settings, logs, feedback, and statistics
 * @param userId - Optional user ID (for admins to access specific user data)
 * @param signal - Abort signal for cancellation
 * @returns Promise with complete user data
 */
export const fetchCompleteUserData = async (userId?: string, signal?: AbortSignal) => {
  const endpoint = userId ? `/api/users/complete/${userId}` : '/api/users/complete';
  return apiRequest(endpoint, { signal });
};

/**
 * Fetch complete user data (alias for fetchCompleteUserData)
 * Uses: GET /api/users/full-data
 * @param signal - Abort signal for cancellation
 * @returns Promise with complete user data
 */
export const fetchFullUserData = async (signal?: AbortSignal) => {
  return apiRequest('/api/users/full-data', { signal });
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
 * Update user profile
 * Uses: PUT /api/users/profile (as per FRONTEND_IMPLEMENTATION_GUIDE.md)
 * @param profileData - Profile data to update
 * @returns Promise with updated user data
 */
export const updateUserProfile = async (profileData: {
  firstName?: string;
  lastName?: string;
  phone?: string;
  city?: string;
  province?: string;
  barangay?: string;
  street?: string;
  location?: { lat: number; lng: number };
}) => {
  return apiRequest('/api/users/profile', {
    method: 'PUT',
    body: JSON.stringify(profileData),
  });
};

/**
 * Change user password (with current password)
 * Uses: PUT /api/users/change-password (as per FRONTEND_IMPLEMENTATION_GUIDE.md)
 * @param currentPassword - Current password
 * @param newPassword - New password
 * @returns Promise with response
 */
export const changeUserPassword = async (currentPassword: string, newPassword: string) => {
  return apiRequest('/api/users/change-password', {
    method: 'PUT',
    body: JSON.stringify({ currentPassword, newPassword }),
  });
};

/**
 * Get user preferences
 * Uses: GET /api/users/preferences (as per FRONTEND_IMPLEMENTATION_GUIDE.md)
 * @returns Promise with user preferences
 */
export const getUserPreferences = async (signal?: AbortSignal) => {
  return apiRequest('/api/users/preferences', { signal });
};

/**
 * Update user preferences
 * Uses: PUT /api/users/preferences (as per FRONTEND_IMPLEMENTATION_GUIDE.md)
 * @param preferences - Preferences data (units, language, notifications, theme)
 * @returns Promise with updated preferences
 */
export const updateUserPreferences = async (preferences: {
  units?: 'metric' | 'imperial';
  language?: string;
  notifications?: boolean;
  theme?: 'light' | 'dark' | 'auto';
}) => {
  return apiRequest('/api/users/preferences', {
    method: 'PUT',
    body: JSON.stringify(preferences),
  });
};

/**
 * Get user settings
 * Uses: GET /api/users/settings (as per FRONTEND_IMPLEMENTATION_GUIDE.md)
 * @returns Promise with user settings
 */
export const getUserSettings = async (signal?: AbortSignal) => {
  return apiRequest('/api/users/settings', { signal });
};

/**
 * Update user settings
 * Uses: PUT /api/users/settings (as per FRONTEND_IMPLEMENTATION_GUIDE.md)
 * @param settings - Settings data
 * @returns Promise with updated settings
 */
export const updateUserSettings = async (settings: Record<string, any>) => {
  return apiRequest('/api/users/settings', {
    method: 'PUT',
    body: JSON.stringify(settings),
  });
};

/**
 * Get user notifications
 * Uses: GET /api/users/notifications (as per FRONTEND_IMPLEMENTATION_GUIDE.md)
 * @returns Promise with user notifications
 */
export const getUserNotifications = async (signal?: AbortSignal) => {
  return apiRequest('/api/users/notifications', { signal });
};

/**
 * Mark notification as read
 * Uses: PUT /api/users/notifications/:notificationId/read (as per FRONTEND_IMPLEMENTATION_GUIDE.md)
 * @param notificationId - Notification ID
 * @returns Promise with response
 */
export const markNotificationAsRead = async (notificationId: string) => {
  return apiRequest(`/api/users/notifications/${notificationId}/read`, {
    method: 'PUT',
  });
};

/**
 * Get user statistics
 * Uses: GET /api/users/stats or GET /api/users/stats/:userId (as per FRONTEND_IMPLEMENTATION_GUIDE.md)
 * @param userId - Optional user ID
 * @returns Promise with user statistics
 */
export const getUserStats = async (userId?: string, signal?: AbortSignal) => {
  const endpoint = userId ? `/api/users/stats/${userId}` : '/api/users/stats';
  return apiRequest(endpoint, { signal });
};

/**
 * Get dashboard data
 * Uses: GET /api/users/dashboard or GET /api/users/dashboard/:userId (as per FRONTEND_IMPLEMENTATION_GUIDE.md)
 * @param userId - Optional user ID
 * @returns Promise with dashboard data
 */
export const getUserDashboard = async (userId?: string, signal?: AbortSignal) => {
  const endpoint = userId ? `/api/users/dashboard/${userId}` : '/api/users/dashboard';
  return apiRequest(endpoint, { signal });
};

/**
 * Export user data
 * Uses: GET /api/users/export (as per FRONTEND_IMPLEMENTATION_GUIDE.md)
 * @returns Promise with exportable user data
 */
export const exportUserData = async (signal?: AbortSignal) => {
  return apiRequest('/api/users/export', { signal });
};

/**
 * Deactivate user account
 * Uses: PUT /api/users/deactivate (as per FRONTEND_IMPLEMENTATION_GUIDE.md)
 * @returns Promise with response
 */
export const deactivateAccount = async () => {
  return apiRequest('/api/users/deactivate', {
    method: 'PUT',
  });
};

/**
 * Reactivate user account
 * Uses: PUT /api/users/reactivate (as per FRONTEND_IMPLEMENTATION_GUIDE.md)
 * @returns Promise with response
 */
export const reactivateAccount = async () => {
  return apiRequest('/api/users/reactivate', {
    method: 'PUT',
  });
};

/**
 * Delete user account
 * Uses: DELETE /api/users/delete (as per FRONTEND_IMPLEMENTATION_GUIDE.md)
 * @returns Promise with response
 */
export const deleteAccount = async () => {
  return apiRequest('/api/users/delete', {
    method: 'DELETE',
  });
};

/**
 * Get user activity log
 * Uses: GET /api/users/activity (as per USER_FRONTEND_IMPLEMENTATION_GUIDE.md)
 * @returns Promise with user activity log
 */
export const getUserActivity = async (signal?: AbortSignal) => {
  return apiRequest('/api/users/activity', { signal });
};

/**
 * Saved Destinations
 * Uses: GET /api/saved-destinations/:userId (as per USER_FRONTEND_IMPLEMENTATION_GUIDE.md)
 * @param userId - User ID
 * @param signal - Abort signal for cancellation
 * @returns Promise with saved destinations array
 */
export const getSavedDestinations = async (userId: string, signal?: AbortSignal) => {
  return apiRequest(`/api/saved-destinations/${userId}`, { signal });
};

/**
 * Add saved destination
 * Uses: POST /api/saved-destinations (as per USER_FRONTEND_IMPLEMENTATION_GUIDE.md)
 * @param destinationData - Destination data
 * @returns Promise with created destination
 */
export const addSavedDestination = async (destinationData: {
  userId: string;
  name: string;
  address: string;
  location: { lat: number; lng: number };
}) => {
  return apiRequest('/api/saved-destinations', {
    method: 'POST',
    body: JSON.stringify(destinationData),
  });
};

/**
 * Update saved destination
 * Uses: PUT /api/saved-destinations/:id (as per USER_FRONTEND_IMPLEMENTATION_GUIDE.md)
 * @param destinationId - Destination ID
 * @param destinationData - Updated destination data
 * @returns Promise with updated destination
 */
export const updateSavedDestination = async (
  destinationId: string,
  destinationData: {
    name?: string;
    address?: string;
    location?: { lat: number; lng: number };
  }
) => {
  return apiRequest(`/api/saved-destinations/${destinationId}`, {
    method: 'PUT',
    body: JSON.stringify(destinationData),
  });
};

/**
 * Delete saved destination
 * Uses: DELETE /api/saved-destinations/:id (as per USER_FRONTEND_IMPLEMENTATION_GUIDE.md)
 * @param destinationId - Destination ID
 * @returns Promise with response
 */
export const deleteSavedDestination = async (destinationId: string) => {
  return apiRequest(`/api/saved-destinations/${destinationId}`, {
    method: 'DELETE',
  });
};

/**
 * Notifications - Get user notifications by userId
 * Uses: GET /api/notifications/:userId (as per USER_FRONTEND_IMPLEMENTATION_GUIDE.md)
 * Alternative endpoint to /api/users/notifications
 * @param userId - User ID
 * @param signal - Abort signal for cancellation
 * @returns Promise with notifications array
 */
export const getNotificationsByUserId = async (userId: string, signal?: AbortSignal) => {
  return apiRequest(`/api/notifications/${userId}`, { signal });
};

/**
 * Create notification
 * Uses: POST /api/notifications (as per USER_FRONTEND_IMPLEMENTATION_GUIDE.md)
 * @param notificationData - Notification data
 * @returns Promise with created notification
 */
export const createNotification = async (notificationData: {
  userId: string;
  title: string;
  message: string;
  type: string;
}) => {
  return apiRequest('/api/notifications', {
    method: 'POST',
    body: JSON.stringify(notificationData),
  });
};

/**
 * Mark notification as read (alternative endpoint)
 * Uses: PUT /api/notifications/read/:id (as per USER_FRONTEND_IMPLEMENTATION_GUIDE.md)
 * Alternative endpoint to /api/users/notifications/:id/read
 * @param notificationId - Notification ID
 * @returns Promise with response
 */
export const markNotificationAsReadAlt = async (notificationId: string) => {
  return apiRequest(`/api/notifications/read/${notificationId}`, {
    method: 'PUT',
  });
};

/**
 * Delete notification
 * Uses: DELETE /api/notifications/:id (as per USER_FRONTEND_IMPLEMENTATION_GUIDE.md)
 * @param notificationId - Notification ID
 * @returns Promise with response
 */
export const deleteNotification = async (notificationId: string) => {
  return apiRequest(`/api/notifications/${notificationId}`, {
    method: 'DELETE',
  });
};

/**
 * Analytics - Generate daily analytics
 * Uses: GET /api/analytics/generate-daily (as per USER_FRONTEND_IMPLEMENTATION_GUIDE.md)
 * @returns Promise with response
 */
export const generateDailyAnalytics = async (signal?: AbortSignal) => {
  return apiRequest('/api/analytics/generate-daily', { signal });
};

/**
 * Get motor daily analytics history
 * Uses: GET /api/analytics/daily-history/:motorId (as per USER_FRONTEND_IMPLEMENTATION_GUIDE.md)
 * @param motorId - Motor ID
 * @param signal - Abort signal for cancellation
 * @returns Promise with daily analytics history
 */
export const getMotorDailyAnalyticsHistory = async (motorId: string, signal?: AbortSignal) => {
  return apiRequest(`/api/analytics/daily-history/${motorId}`, { signal });
};

/**
 * Update gas price for a gas station
 * Uses: PUT /api/gas-stations/:id/price (as per Gas Price Update API documentation)
 * @param stationId - Gas station ID
 * @param fuelType - Fuel type (gasoline, diesel, premium_gasoline, premium_diesel, lpg)
 * @param newPrice - New price per liter
 * @returns Promise with updated station data and price history
 */
export const updateGasPrice = async (
  stationId: string,
  fuelType: string,
  newPrice: number
) => {
  return apiRequest(`/api/gas-stations/${stationId}/price`, {
    method: 'PUT',
    body: JSON.stringify({
      fuelType,
      newPrice,
    }),
  });
};

/**
 * Get price history for a gas station
 * Uses: GET /api/gas-stations/:id/price-history (as per Gas Price Update API documentation)
 * @param stationId - Gas station ID
 * @param fuelType - Optional fuel type filter
 * @param limit - Maximum number of history entries (default: 50)
 * @param signal - Abort signal for cancellation
 * @returns Promise with price history data
 */
export const getPriceHistory = async (
  stationId: string,
  fuelType: string | null = null,
  limit: number = 50,
  signal?: AbortSignal
) => {
  const queryParams = new URLSearchParams();
  if (fuelType) queryParams.append('fuelType', fuelType);
  queryParams.append('limit', limit.toString());

  const endpoint = `/api/gas-stations/${stationId}/price-history?${queryParams.toString()}`;
  try {
    const response = await apiRequest<{ success: boolean; data: { history: any[] } }>(endpoint, {
      signal,
    });

    if (response.success && response.data && Array.isArray(response.data.history)) {
      return response.data.history;
    }
    return [];
  } catch (error) {
    if (__DEV__) {
      console.error('[api.ts] Error getting price history:', error);
    }
    return [];
  }
};

/**
 * Get user analytics timeline
 * Uses: GET /api/analytics/user-timeline/:userId (as per USER_FRONTEND_IMPLEMENTATION_GUIDE.md)
 * @param userId - User ID
 * @param signal - Abort signal for cancellation
 * @returns Promise with user analytics timeline
 */
export const getUserAnalyticsTimeline = async (userId: string, signal?: AbortSignal) => {
  return apiRequest(`/api/analytics/user-timeline/${userId}`, { signal });
};

/**
 * Get fuel log trend
 * Uses: GET /api/analytics/fuel-log-trend/:userId (as per USER_FRONTEND_IMPLEMENTATION_GUIDE.md)
 * @param userId - User ID
 * @param signal - Abort signal for cancellation
 * @returns Promise with fuel log trend data
 */
export const getFuelLogTrend = async (userId: string, signal?: AbortSignal) => {
  return apiRequest(`/api/analytics/fuel-log-trend/${userId}`, { signal });
};

/**
 * Update fuel level for a motor
 * @param motorId - Motor ID
 * @param fuelLevel - New fuel level
 * @returns Promise with response
 */
export const updateFuelLevel = async (motorId: string, fuelLevel: number) => {
  // Validate input parameters
  if (!motorId || typeof motorId !== 'string') {
    throw new Error('Invalid motor ID provided');
  }
  
  if (typeof fuelLevel !== 'number' || isNaN(fuelLevel) || fuelLevel < 0 || fuelLevel > 100) {
    throw new Error('Invalid fuel level: must be a number between 0 and 100');
  }

  try {
    const response = await apiRequest(`/api/user-motors/${motorId}`, {
      method: 'PUT',
      body: JSON.stringify({ currentFuelLevel: fuelLevel }),
    });
    
    console.log('[API] Fuel level updated successfully:', {
      motorId,
      fuelLevel,
      timestamp: new Date().toISOString()
    });
    
    return response;
  } catch (error) {
    console.error('[API] Failed to update fuel level:', {
      motorId,
      fuelLevel,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    throw error;
  }
};

/**
 * Update fuel level by liters for a motor
 * Uses: PUT /api/user-motors/:id/fuel/liters
 * @param motorId - Motor ID
 * @param liters - Amount of fuel in liters
 * @returns Promise with updated motor data including conversion details
 */
export const updateFuelLevelByLiters = async (motorId: string, liters: number) => {
  // Validate input parameters
  if (!motorId || typeof motorId !== 'string') {
    throw new Error('Invalid motor ID provided');
  }
  
  if (typeof liters !== 'number' || isNaN(liters)) {
    throw new Error('liters must be a number');
  }
  
  if (liters < 0) {
    throw new Error('liters cannot be negative');
  }

  try {
    const response = await apiRequest(`/api/user-motors/${motorId}/fuel/liters`, {
      method: 'PUT',
      body: JSON.stringify({ liters }),
    });
    
    if (__DEV__) {
      console.log('[API] Fuel level updated by liters successfully:', {
        motorId,
        liters,
        percentage: response?.motor?.fuelLevel?.percentage,
        actualLiters: response?.motor?.fuelLevel?.liters,
        timestamp: new Date().toISOString()
      });
    }
    
    return response;
  } catch (error) {
    console.error('[API] Failed to update fuel level by liters:', {
      motorId,
      liters,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    throw error;
  }
};

/**
 * Delete a user motor
 * Uses: DELETE /api/user-motors/:id (as per USER_FRONTEND_IMPLEMENTATION_GUIDE.md)
 * @param motorId - Motor ID to delete
 * @returns Promise with response
 */
export const deleteUserMotor = async (motorId: string) => {
  // Validate input parameters
  if (!motorId || typeof motorId !== 'string') {
    throw new Error('Invalid motor ID provided');
  }

  try {
    const response = await apiRequest(`/api/user-motors/${motorId}`, {
      method: 'DELETE',
    });
    
    console.log('[API] Motor deleted successfully:', {
      motorId,
      timestamp: new Date().toISOString()
    });
    
    return response;
  } catch (error) {
    console.error('[API] Failed to delete motor:', {
      motorId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    throw error;
  }
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
