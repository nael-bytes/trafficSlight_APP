// Improved AuthContext with better error handling

import React, { createContext, useState, useEffect, useCallback, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { configureApi } from '../utils/api';
import { Alert } from 'react-native';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [userToken, setUserToken] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Use ref to store token for configureApi (ensures it's always current)
  // This allows configureApi to access the latest token even before state updates
  const tokenRef = useRef(null);
  
  // CRITICAL FIX: Track if component is mounted to prevent state updates after unmount
  const isMountedRef = useRef(true);
  
  // Function to clear authentication (can be called from API errors)
  const clearAuth = useCallback(async () => {
    try {
      tokenRef.current = null;
      await AsyncStorage.multiRemove(["token", "user"]);
      setUserToken(null);
      configureApi(() => null);
      console.log('[AuthContext] Authentication cleared');
    } catch (error) {
      console.error('[AuthContext] Error clearing auth:', error);
      // Still clear state even if storage fails
      tokenRef.current = null;
      setUserToken(null);
      configureApi(() => null);
    }
  }, []);

  // Validate token by making a test API call
  const validateToken = async (token) => {
    try {
      const API_BASE = 'https://ts-backend-1-jyit.onrender.com';
      const response = await fetch(`${API_BASE}/api/users/me`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });
      
      // Token is valid if we get 200 OK
      if (response.ok) {
        return true;
      }
      
      // Token is invalid if we get 401 Unauthorized
      if (response.status === 401) {
        console.error('[AuthContext] ❌ TOKEN VALIDATION FAILED - 401 Unauthorized', {
          status: response.status,
          statusText: response.statusText,
          tokenPreview: token ? `${token.substring(0, 20)}...` : 'NO TOKEN',
          tokenLength: token?.length || 0,
        });
        return false;
      }
      
      // For other errors, log but assume token might be valid (network issues, etc.)
      // Don't log out user due to temporary network problems
      console.warn('[AuthContext] Token validation returned non-200 status (assuming valid):', {
        status: response.status,
        statusText: response.statusText,
      });
      return true;
    } catch (error) {
      // Network errors shouldn't log out user - assume token is valid
      console.warn('[AuthContext] Token validation error (assuming valid):', {
        message: error.message,
        error,
      });
      return true;
    }
  };

  // CRITICAL FIX: Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Load token on app start
  useEffect(() => {
    const loadToken = async () => {
      try {
        // CRITICAL FIX: Check if mounted before setting state
        if (!isMountedRef.current) return;
        setAuthLoading(true);
        setError(null);
        
        const token = await AsyncStorage.getItem("token");
        
        if (token) {
          // Store token in ref immediately (before state update)
          tokenRef.current = token;
          
          // Configure API with ref-based getter (always reads latest token)
          configureApi(() => tokenRef.current);
          
          // Validate token before setting it as authenticated
          const isValid = await validateToken(token);
          
          // CRITICAL FIX: Check if still mounted before setting state
          if (!isMountedRef.current) return;
          
          if (isValid) {
            // Set token in state (for UI updates)
            setUserToken(token);
            
            console.log('[AuthContext] ✅ Token loaded and validated, API configured');
          } else {
            // Token is invalid/expired - clear it
            console.error('[AuthContext] ❌ Token invalid/expired - clearing token and user data');
            console.error('[AuthContext] 🔒 User will be redirected to login screen');
            await AsyncStorage.removeItem("token");
            await AsyncStorage.removeItem("user");
            if (isMountedRef.current) {
              setUserToken(null);
            }
            tokenRef.current = null;
            configureApi(() => null);
          }
        } else {
          tokenRef.current = null;
          if (isMountedRef.current) {
            setUserToken(null);
          }
          // Clear API configuration if no token
          configureApi(() => null);
        }
      } catch (error) {
        console.error('Error loading token:', error);
        if (isMountedRef.current) {
          setError('Failed to load authentication token');
          setUserToken(null);
        }
        tokenRef.current = null;
        configureApi(() => null);
      } finally {
        // CRITICAL FIX: Check if mounted before setting loading state
        if (isMountedRef.current) {
          setAuthLoading(false);
        }
      }
    };

    loadToken();
  }, []);

  // Login function with error handling
  const login = useCallback(async (token, userData = null) => {
    try {
      setError(null);
      
      if (!token) {
        throw new Error('Token is required for login');
      }

      // Store token in ref immediately (before state update)
      tokenRef.current = token;
      
      // Configure API with ref-based getter (always reads latest token)
      configureApi(() => tokenRef.current);
      
      await AsyncStorage.setItem("token", token);
      setUserToken(token);
      
      console.log('[AuthContext] Token saved and API configured');
      
      // Optionally store user data
      if (userData) {
        await AsyncStorage.setItem("user", JSON.stringify(userData));
      }
      
      console.log('Login successful');
    } catch (error) {
      console.error('Login error:', error);
      setError(error.message || 'Login failed');
      throw error;
    }
  }, []);

  // Logout function with cleanup
  const logout = useCallback(async () => {
    try {
      setError(null);
      
      // Clear token ref immediately
      tokenRef.current = null;
      
      // Remove token and user data
      await AsyncStorage.multiRemove(["token", "user"]);
      setUserToken(null);
      
      // Clear API configuration on logout
      configureApi(() => null);
      
      console.log('[AuthContext] Token cleared, API configuration reset');
      console.log('[AuthContext] Logout successful');
    } catch (error) {
      console.error('Logout error:', error);
      setError('Logout failed');
      // Still set token to null even if storage cleanup fails
      setUserToken(null);
    }
  }, []);

  // Clear error function
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Check if user is authenticated
  const isAuthenticated = useCallback(() => {
    return !!userToken;
  }, [userToken]);

  // Get token function - returns current token from ref (always latest)
  const getToken = useCallback(() => {
    // Return from ref (always current, updated immediately on login/logout)
    return tokenRef.current || userToken;
  }, [userToken]);

  const value = {
    userToken,
    authLoading,
    error,
    login,
    logout,
    clearError,
    isAuthenticated,
    getToken,
    clearAuth, // Export clearAuth for use in API error handlers
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
