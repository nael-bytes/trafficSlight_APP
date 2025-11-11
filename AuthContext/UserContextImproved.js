// Improved UserContext with better error handling and data management

import React, { createContext, useState, useEffect, useContext, useCallback, useMemo } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { fetchUserProfile, configureApi } from "../utils/api";

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
          if (__DEV__) {
            console.log("[UserContext] User loaded:", parsedUser.email);
          }
          
          // Load ALL data in parallel BEFORE setting user state
          const [reportsStr, gasStr, motorsStr, tokenStr] = await Promise.all([
            AsyncStorage.getItem(`reports_${parsedUser._id}`),
            AsyncStorage.getItem(`gasStations_${parsedUser._id}`),
            AsyncStorage.getItem(`motors_${parsedUser._id}`),
            AsyncStorage.getItem("token"),
          ]);
          
          if (__DEV__) {
            console.log("[UserContext] Cached data loaded:", {
              hasReports: !!reportsStr,
              hasGasStations: !!gasStr,
              hasMotors: !!motorsStr,
              hasToken: !!tokenStr,
            });
          }
          
          // CRITICAL: Configure API with cached token immediately so all API requests can use it
          // This ensures authentication is available from the start, not just when preloading
          if (tokenStr) {
            configureApi(() => tokenStr);
            if (__DEV__) {
              console.log("[UserContext] API configured with cached token on startup");
            }
          }
          
          // Set cached data in state with size limits to prevent memory issues
          // Limit cache arrays to prevent excessive memory usage
          const MAX_CACHE_SIZE = 500; // Limit to 500 items per cache type
          
          if (reportsStr) {
            const reports = JSON.parse(reportsStr);
            // Limit array size to prevent memory issues
            const limitedReports = Array.isArray(reports) ? reports.slice(0, MAX_CACHE_SIZE) : [];
            setCachedReports(limitedReports);
            if (__DEV__) {
              console.log("[UserContext] Setting cached reports:", limitedReports.length, `(limited from ${reports.length || 0})`);
            }
          }
          
          if (gasStr) {
            const gasStations = JSON.parse(gasStr);
            // Limit array size to prevent memory issues
            const limitedGasStations = Array.isArray(gasStations) ? gasStations.slice(0, MAX_CACHE_SIZE) : [];
            setCachedGasStations(limitedGasStations);
            if (__DEV__) {
              console.log("[UserContext] Setting cached gas stations:", limitedGasStations.length, `(limited from ${gasStations.length || 0})`);
            }
          }
          
          if (motorsStr) {
            const motors = JSON.parse(motorsStr);
            // Limit array size to prevent memory issues
            const limitedMotors = Array.isArray(motors) ? motors.slice(0, MAX_CACHE_SIZE) : [];
            setCachedMotors(limitedMotors);
            if (__DEV__) {
              console.log("[UserContext] Setting cached motors:", limitedMotors.length, `(limited from ${motors.length || 0})`);
            }
          }
          
          // Set user immediately with stored data (don't wait for profile fetch)
          // This prevents blocking the app loading
          if (__DEV__) {
            console.log("[UserContext] Setting user state (from cache)");
          }
          setUser(parsedUser);
          
          // IMPORTANT: If user data is missing name or id, fetch fresh profile data in BACKGROUND
          // Don't block app loading - fetch in background and update when done
          if ((!parsedUser.name || !parsedUser.id) && tokenStr) {
            // Store timeout ID for cleanup
            let profileFetchTimeoutId = null;
            
            // Fetch profile in background (non-blocking)
            const profileFetchPromise = (async () => {
              try {
                if (__DEV__) {
                  console.log("[UserContext] User data missing name/id, fetching fresh profile in background...");
                }
                
                // Configure API to use stored token
                configureApi(() => tokenStr);
                
                // Create abort controller for cleanup
                const abortController = new AbortController();
                
                // Fetch complete user profile with timeout (5 seconds max)
                const timeoutPromise = new Promise((_, reject) => {
                  profileFetchTimeoutId = setTimeout(() => {
                    abortController.abort();
                    reject(new Error('Profile fetch timeout'));
                  }, 5000);
                });
                
                const profileData = await Promise.race([
                  fetchUserProfile(abortController.signal),
                  timeoutPromise
                ]);
                
                // Clear timeout if fetch succeeded
                if (profileFetchTimeoutId) {
                  clearTimeout(profileFetchTimeoutId);
                  profileFetchTimeoutId = null;
                }
                
                let updatedUserData = parsedUser;
                // Handle response format: Priority order
                // 1. New format: { success: true, data: {...} }
                // 2. Wrapped format: { user: {...} }
                // 3. Direct user object
                if (profileData?.success && profileData?.data) {
                  // New backend format: { success: true, data: {...} }
                  updatedUserData = { ...parsedUser, ...profileData.data };
                } else if (profileData?.user) {
                  // Backend format: { user: {...} }
                  updatedUserData = { ...parsedUser, ...profileData.user };
                } else if (profileData && !profileData.user && (profileData.name || profileData.id)) {
                  // If profile returns user data directly (not wrapped in user property)
                  updatedUserData = { ...parsedUser, ...profileData };
                }
                
                // Only update if we got new data
                if (updatedUserData !== parsedUser && (updatedUserData.name || updatedUserData.id)) {
                  await AsyncStorage.setItem("user", JSON.stringify(updatedUserData));
                  setUser(updatedUserData);
                  if (__DEV__) {
                    console.log("[UserContext] User data refreshed with name and id (background)");
                  }
                }
              } catch (profileError) {
                // Clear timeout on error
                if (profileFetchTimeoutId) {
                  clearTimeout(profileFetchTimeoutId);
                  profileFetchTimeoutId = null;
                }
                
                // Only warn in development
                if (__DEV__ && profileError.name !== 'AbortError') {
                  console.warn("[UserContext] Background profile fetch failed, using stored data:", profileError.message);
                }
                // Continue with stored user data - app already loaded with it
              }
            })();
            
            // Cleanup on unmount (if component unmounts before fetch completes)
            // Note: This is handled by the IIFE, but we store it for potential cleanup
            profileFetchPromise.catch(() => {}); // Swallow errors - already handled
          }
          
          // Preload HomeScreen and ProfileScreen data in background after user is loaded
          // This ensures screens are ready when navigated to
          // Only preload if we have a user loaded and token
          if (parsedUser && parsedUser._id && tokenStr) {
            // Non-blocking preload - runs in background
            (async () => {
              try {
                if (__DEV__) {
                  console.log("[UserContext] Preloading HomeScreen and ProfileScreen data in background...");
                }
                
                // Configure API with token
                configureApi(() => tokenStr);
                
                // Preload HomeScreen data using sharedDataManager (non-blocking)
                // CRITICAL FIX: Wrap require in try-catch to prevent crashes if module doesn't exist
                try {
                  const sharedDataManagerModule = require('../utils/sharedDataManager');
                  if (sharedDataManagerModule && sharedDataManagerModule.sharedDataManager) {
                    await sharedDataManagerModule.sharedDataManager.fetchAllData(parsedUser._id, false).catch((error) => {
                      // Silently fail - data will load when screen opens
                      if (__DEV__ && error.message !== 'Authentication required. Please login.') {
                        console.warn("[UserContext] Background preload failed:", error.message);
                      }
                    });
                  } else {
                    if (__DEV__) {
                      console.warn("[UserContext] sharedDataManager not available, skipping preload");
                    }
                  }
                } catch (requireError) {
                  // Module might not exist or might have import errors
                  if (__DEV__) {
                    console.warn("[UserContext] Failed to load sharedDataManager module:", requireError.message);
                  }
                  // Continue without preloading - screens will load data when opened
                }
                
                if (__DEV__) {
                  console.log("[UserContext] Background preload completed");
                }
              } catch (preloadError) {
                // Silently fail - not critical, data will load when screen opens
                if (__DEV__ && preloadError.message !== 'Authentication required. Please login.') {
                  console.warn("[UserContext] Background preload error:", preloadError.message);
                }
              }
            })();
          }
        } else {
          if (__DEV__) {
            console.log("[UserContext] No user found in storage");
          }
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
    
    // Periodic cache cleanup (every 10 minutes) to prevent AsyncStorage from growing
    // This runs separately from loadUser to avoid scope issues
    const cleanupInterval = setInterval(async () => {
      try {
        const storedUser = await AsyncStorage.getItem("user");
        if (storedUser) {
          const parsedUser = JSON.parse(storedUser);
          if (parsedUser?._id) {
            // Clean up old cache entries periodically
            await cleanupOldCache(parsedUser._id);
          }
        }
      } catch (cleanupError) {
        if (__DEV__) {
          console.warn("[UserContext] Cache cleanup error:", cleanupError);
        }
      }
    }, 10 * 60 * 1000); // Every 10 minutes
    
    // Cleanup on unmount
    return () => {
      clearInterval(cleanupInterval);
    };
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
      
      if (__DEV__) {
        console.log("User saved successfully:", userData?.email || 'Unknown');
      }
    } catch (error) {
      console.error("Failed to save user:", error);
      setError(error.message || 'Failed to save user data');
      throw error;
    }
  }, []);

  // Helper function to limit array size and prevent memory issues
  const limitArraySize = useCallback((arr, maxSize = 500) => {
    if (!Array.isArray(arr)) return [];
    return arr.length > maxSize ? arr.slice(0, maxSize) : arr;
  }, []);

  // Helper function to cleanup old cache entries
  // Must be defined before useEffect to avoid hoisting issues
  const cleanupOldCache = async (userId) => {
    try {
      const MAX_CACHE_SIZE = 500; // Limit cache size
      const allKeys = await AsyncStorage.getAllKeys();
      const userCacheKeys = allKeys.filter(key => 
        key.startsWith(`reports_${userId}`) ||
        key.startsWith(`gasStations_${userId}`) ||
        key.startsWith(`motors_${userId}`) ||
        key.startsWith(`trips_${userId}`) ||
        key.startsWith(`destinations_${userId}`) ||
        key.startsWith(`fuelLogs_${userId}`) ||
        key.startsWith(`maintenance_${userId}`)
      );

      for (const key of userCacheKeys) {
        try {
          const cachedData = await AsyncStorage.getItem(key);
          if (cachedData) {
            const data = JSON.parse(cachedData);
            if (Array.isArray(data) && data.length > MAX_CACHE_SIZE) {
              // Limit array size to prevent memory issues
              const limitedData = data.slice(0, MAX_CACHE_SIZE);
              await AsyncStorage.setItem(key, JSON.stringify(limitedData));
              if (__DEV__) {
                console.log(`[UserContext] Cleaned cache ${key}: ${data.length} → ${limitedData.length}`);
              }
            }
          }
        } catch (error) {
          // If we can't parse, remove it
          await AsyncStorage.removeItem(key);
        }
      }
    } catch (error) {
      if (__DEV__) {
        console.warn("[UserContext] Cache cleanup error:", error);
      }
    }
  };

  // Global cache updaters using standardized cache manager
  const updateCachedReports = useCallback(async (reports) => {
    try {
      // Limit array size to prevent memory issues
      const limitedReports = limitArraySize(reports || [], 500);
      setCachedReports(limitedReports);
      if (user?._id) {
        await AsyncStorage.setItem(`reports_${user._id}`, JSON.stringify(limitedReports));
        if (__DEV__) {
          console.log("[UserContext] Reports saved to cache:", limitedReports.length);
        }
      }
    } catch (error) {
      console.error("[UserContext] Error updating cached reports:", error);
    }
  }, [user?._id, limitArraySize]);

  const updateCachedGasStations = useCallback(async (gasStations) => {
    try {
      // Limit array size to prevent memory issues
      const limitedGasStations = limitArraySize(gasStations || [], 500);
      setCachedGasStations(limitedGasStations);
      if (user?._id) {
        await AsyncStorage.setItem(`gasStations_${user._id}`, JSON.stringify(limitedGasStations));
        if (__DEV__) {
          console.log("[UserContext] Gas stations saved to cache:", limitedGasStations.length);
        }
      }
    } catch (error) {
      console.error("[UserContext] Error updating cached gas stations:", error);
    }
  }, [user?._id, limitArraySize]);

  const updateCachedMotors = useCallback(async (motors) => {
    try {
      // Limit array size to prevent memory issues
      const limitedMotors = limitArraySize(motors || [], 500);
      
      if (__DEV__) {
        console.log("[UserContext] updateCachedMotors called:", {
          motorsCount: limitedMotors.length,
          originalCount: motors?.length || 0,
          userId: user?._id,
          isArray: Array.isArray(motors)
        });
      }
      
      setCachedMotors(limitedMotors);
      if (user?._id) {
        await AsyncStorage.setItem(`motors_${user._id}`, JSON.stringify(limitedMotors));
        if (__DEV__) {
          console.log("[UserContext] Motors saved to cache:", limitedMotors.length);
        }
      }
    } catch (error) {
      console.error("[UserContext] Error updating cached motors:", error);
    }
  }, [user?._id, limitArraySize]);

  // FIXED: Added cache invalidation helper
  const invalidateCache = useCallback(async (cacheType = 'all') => {
    try {
      if (!user?._id) return;
      
      const cacheKeys = {
        all: [`reports_${user._id}`, `gasStations_${user._id}`, `motors_${user._id}`, `trips_${user._id}`, `destinations_${user._id}`, `fuelLogs_${user._id}`, `maintenance_${user._id}`, `sharedData_${user._id}`],
        reports: [`reports_${user._id}`],
        gasStations: [`gasStations_${user._id}`],
        motors: [`motors_${user._id}`, `cachedMotors_${user._id}`],
        trips: [`trips_${user._id}`],
        destinations: [`destinations_${user._id}`],
        fuelLogs: [`fuelLogs_${user._id}`],
        maintenance: [`maintenance_${user._id}`],
        sharedData: [`sharedData_${user._id}`],
      };
      
      const keysToInvalidate = cacheKeys[cacheType] || cacheKeys.all;
      
      for (const key of keysToInvalidate) {
        try {
          await AsyncStorage.removeItem(key);
        } catch (error) {
          if (__DEV__) {
            console.warn(`[UserContext] Failed to invalidate cache ${key}:`, error);
          }
        }
      }
      
      // Also clear in-memory cache
      if (cacheType === 'all' || cacheType === 'reports') {
        setCachedReports([]);
      }
      if (cacheType === 'all' || cacheType === 'gasStations') {
        setCachedGasStations([]);
      }
      if (cacheType === 'all' || cacheType === 'motors') {
        setCachedMotors([]);
      }
      
      // Invalidate SharedDataManager cache if available
      try {
        const { sharedDataManager } = require('../utils/sharedDataManager');
        if (sharedDataManager && typeof sharedDataManager.invalidateCache === 'function') {
          await sharedDataManager.invalidateCache(user._id);
        }
      } catch (error) {
        // SharedDataManager might not be available, ignore
      }
      
      if (__DEV__) {
        console.log(`[UserContext] Cache invalidated for type: ${cacheType}`);
      }
    } catch (error) {
      if (__DEV__) {
        console.warn("[UserContext] Error invalidating cache:", error);
      }
    }
  }, [user?._id]);

  // Update user data (partial update)
  // FIXED: Added cache invalidation on user update
  const updateUser = useCallback(async (updates) => {
    try {
      setError(null);
      
      if (!user) {
        throw new Error('No user data to update');
      }

      const updatedUser = { ...user, ...updates };
      await AsyncStorage.setItem("user", JSON.stringify(updatedUser));
      setUser(updatedUser);
      
      // Invalidate profile cache when user data changes
      await invalidateCache('sharedData');
      
      if (__DEV__) {
        console.log("User updated successfully:", updatedUser?.email || 'Unknown');
      }
    } catch (error) {
      console.error("Failed to update user:", error);
      setError(error.message || 'Failed to update user data');
      throw error;
    }
  }, [user, invalidateCache]);

  // Clear user data (logout) with cache cleanup
  const clearUser = useCallback(async () => {
    try {
      setError(null);
      
      // Clear user-specific cache
      if (user?._id) {
        // Clear user-specific cache
        await Promise.all([
          AsyncStorage.removeItem(`reports_${user._id}`),
          AsyncStorage.removeItem(`gasStations_${user._id}`),
          AsyncStorage.removeItem(`motors_${user._id}`),
          AsyncStorage.removeItem(`trips_${user._id}`),
          AsyncStorage.removeItem(`destinations_${user._id}`),
          AsyncStorage.removeItem(`fuelLogs_${user._id}`),
          AsyncStorage.removeItem(`maintenance_${user._id}`),
          AsyncStorage.removeItem(`sharedData_${user._id}`),
        ]);
        if (__DEV__) {
          console.log("[UserContext] Cleared cache for user:", user._id);
        }
      }
      
      // Clear user data
      await AsyncStorage.removeItem("user");
      setUser(null);
      
      // Clear global cache state
      setCachedReports([]);
      setCachedGasStations([]);
      setCachedMotors([]);
      
      if (__DEV__) {
        console.log("User data and cache cleared successfully");
      }
    } catch (error) {
      console.error("Failed to clear user data:", error);
      setError('Failed to clear user data');
      // Still set user to null even if storage cleanup fails
      setUser(null);
    }
  }, [user?._id]);

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

  // Reset password function
  const resetPassword = useCallback(async (email) => {
    try {
      const response = await fetch(`${process.env.LOCALHOST_IP || 'http://localhost:3000'}/api/auth/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      return { success: true, message: result.message };
    } catch (error) {
      console.error('Reset password error:', error);
      return { success: false, error: error.message };
    }
  }, []);

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
    resetPassword,
    invalidateCache, // FIXED: Expose cache invalidation
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
    resetPassword,
    invalidateCache, // FIXED: Include in dependencies
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


