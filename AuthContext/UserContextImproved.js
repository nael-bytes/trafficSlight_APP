// Improved UserContext with better error handling and data management

import React, { createContext, useState, useEffect, useContext, useCallback, useMemo } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const UserContext = createContext();

export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Global cached data (shared across screens)
  const [cachedReports, setCachedReports] = useState([]);
  const [cachedGasStations, setCachedGasStations] = useState([]);
  const [cachedMotors, setCachedMotors] = useState([]);

  // Load user data on app start
  useEffect(() => {
    const loadUser = async () => {
      try {
        setLoading(true);
        setError(null);
        
        console.log("[UserContext] Loading user from AsyncStorage...");
        const storedUser = await AsyncStorage.getItem("user");
        
        if (storedUser) {
          const parsedUser = JSON.parse(storedUser);
          console.log("[UserContext] User loaded:", parsedUser.email);
          
          // Load ALL data in parallel BEFORE setting user state
          const [reportsStr, gasStr, motorsStr] = await Promise.all([
            AsyncStorage.getItem('cachedReports'),
            AsyncStorage.getItem('cachedGasStations'),
            AsyncStorage.getItem(`cachedMotors_${parsedUser._id}`),
          ]);
          
          console.log("[UserContext] Cached data loaded:", {
            hasReports: !!reportsStr,
            hasGasStations: !!gasStr,
            hasMotors: !!motorsStr,
          });
          
          // Parse and set all caches
          try { 
            const reports = reportsStr ? JSON.parse(reportsStr) : [];
            console.log("[UserContext] Setting cached reports:", reports.length);
            setCachedReports(reports);
          } catch {}
          
          try { 
            const gasStations = gasStr ? JSON.parse(gasStr) : [];
            console.log("[UserContext] Setting cached gas stations:", gasStations.length);
            setCachedGasStations(gasStations);
          } catch {}
          
          try { 
            const motors = motorsStr ? JSON.parse(motorsStr) : [];
            console.log("[UserContext] Setting cached motors:", motors.length, "Raw:", motorsStr?.substring(0, 100));
            setCachedMotors(motors);
          } catch (e) {
            console.error("[UserContext] Error parsing motors:", e);
          }
          
          // Set user LAST after all caches are loaded
          console.log("[UserContext] Setting user state (all caches loaded)");
          setUser(parsedUser);
        } else {
          console.log("[UserContext] No user found in storage");
          setUser(null);
          setCachedMotors([]);
          setCachedReports([]);
          setCachedGasStations([]);
        }
      } catch (error) {
        console.error("[UserContext] Error loading user:", error);
        setError('Failed to load user data');
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, []);

  // Save user data with validation
  const saveUser = useCallback(async (userData) => {
    try {
      setError(null);
      
      if (!userData) {
        throw new Error('User data is required');
      }

      // Validate user data structure
      if (!userData._id || !userData.email) {
        throw new Error('Invalid user data structure');
      }

      await AsyncStorage.setItem("user", JSON.stringify(userData));
      setUser(userData);
      
      console.log("User saved successfully:", userData);
    } catch (error) {
      console.error("Failed to save user:", error);
      setError(error.message || 'Failed to save user data');
      throw error;
    }
  }, []);

  // Global cache updaters
  const updateCachedReports = useCallback(async (reports) => {
    try {
      setCachedReports(reports || []);
      await AsyncStorage.setItem('cachedReports', JSON.stringify(reports || []));
    } catch {}
  }, []);

  const updateCachedGasStations = useCallback(async (gasStations) => {
    try {
      setCachedGasStations(gasStations || []);
      await AsyncStorage.setItem('cachedGasStations', JSON.stringify(gasStations || []));
    } catch {}
  }, []);

  const updateCachedMotors = useCallback(async (motors) => {
    try {
      console.log("[UserContext] updateCachedMotors called:", {
        motorsCount: motors?.length || 0,
        userId: user?._id,
        isArray: Array.isArray(motors)
      });
      setCachedMotors(motors || []);
      if (user?._id) {
        await AsyncStorage.setItem(`cachedMotors_${user._id}`, JSON.stringify(motors || []));
        console.log("[UserContext] Motors saved to AsyncStorage:", motors?.length || 0);
      }
    } catch (e) {
      console.error("[UserContext] Error updating cached motors:", e);
    }
  }, [user?._id]);

  // Update user data (partial update)
  const updateUser = useCallback(async (updates) => {
    try {
      setError(null);
      
      if (!user) {
        throw new Error('No user data to update');
      }

      const updatedUser = { ...user, ...updates };
      await AsyncStorage.setItem("user", JSON.stringify(updatedUser));
      setUser(updatedUser);
      
      console.log("User updated successfully:", updatedUser);
    } catch (error) {
      console.error("Failed to update user:", error);
      setError(error.message || 'Failed to update user data');
      throw error;
    }
  }, [user]);

  // Clear user data (logout)
  const clearUser = useCallback(async () => {
    try {
      setError(null);
      
      await AsyncStorage.removeItem("user");
      setUser(null);
      
      console.log("User data cleared successfully");
    } catch (error) {
      console.error("Failed to clear user data:", error);
      setError('Failed to clear user data');
      // Still set user to null even if storage cleanup fails
      setUser(null);
    }
  }, []);

  // Clear error function
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Check if user is loaded
  const isUserLoaded = useCallback(() => {
    return !loading && user !== null;
  }, [loading, user]);

  // Get user property safely
  const getUserProperty = useCallback((property, defaultValue = null) => {
    if (!user) return defaultValue;
    return user[property] !== undefined ? user[property] : defaultValue;
  }, [user]);

  // Refresh user data (useful for pulling latest data from server)
  const refreshUser = useCallback(async (userData) => {
    if (userData) {
      await saveUser(userData);
    }
  }, [saveUser]);

  // Memoize context value to prevent unnecessary re-renders
  const value = useMemo(() => ({
    user,
    loading,
    error,
    saveUser,
    updateUser,
    clearUser,
    clearError,
    isUserLoaded,
    getUserProperty,
    refreshUser,
    // Expose global caches
    cachedReports,
    cachedGasStations,
    cachedMotors,
    updateCachedReports,
    updateCachedGasStations,
    updateCachedMotors,
  }), [
    user,
    loading,
    error,
    saveUser,
    updateUser,
    clearUser,
    clearError,
    isUserLoaded,
    getUserProperty,
    refreshUser,
    cachedReports,
    cachedGasStations,
    cachedMotors,
    updateCachedReports,
    updateCachedGasStations,
    updateCachedMotors,
  ]);

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
};

// Custom hook for easy access
export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};


