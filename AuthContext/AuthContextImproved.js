// Improved AuthContext with better error handling

import React, { createContext, useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Alert } from 'react-native';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [userToken, setUserToken] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load token on app start
  useEffect(() => {
    const loadToken = async () => {
      try {
        setAuthLoading(true);
        setError(null);
        
        const token = await AsyncStorage.getItem("token");
        
        if (token) {
          // Optionally validate token here
          // const isValid = await validateToken(token);
          // if (!isValid) {
          //   await AsyncStorage.removeItem("token");
          //   setUserToken(null);
          // } else {
            setUserToken(token);
          // }
        } else {
          setUserToken(null);
        }
      } catch (error) {
        console.error('Error loading token:', error);
        setError('Failed to load authentication token');
        setUserToken(null);
      } finally {
        setAuthLoading(false);
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

      await AsyncStorage.setItem("token", token);
      setUserToken(token);
      
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
      
      // Remove token and user data
      await AsyncStorage.multiRemove(["token", "user"]);
      setUserToken(null);
      
      console.log('Logout successful');
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

  // Get token function
  const getToken = useCallback(() => {
    return userToken;
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
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
