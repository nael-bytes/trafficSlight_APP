import React, { useContext, useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Alert,
  TouchableOpacity,
  Text,
  Platform,
  StyleSheet,
  Image,
  StatusBar,
  ScrollView,
  RefreshControl,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { AuthContext } from "../../AuthContext/AuthContextImproved";
import { useUser } from "../../AuthContext/UserContextImproved";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from "@react-native-async-storage/async-storage";
import { fetchUserProfile, configureApi, apiRequest } from "../../utils/api";

import { deepEqual } from '../../utils/objectUtils';

const iconSize = 24;
const PROFILE_CACHE_KEY = 'profile_user_data';
const FETCH_INTERVAL = 5000; // 5 seconds

const ProfileScreen = ({ navigation }) => {
  const { user, clearUser, saveUser } = useUser();
  const { logout, getToken } = useContext(AuthContext);
  
  const [refreshing, setRefreshing] = useState(false);
  const [localUser, setLocalUser] = useState(null);
  const intervalRef = useRef(null);
  const isFetchingRef = useRef(false);
  const abortControllerRef = useRef(null);

  // Load cached profile data on mount (instant display)
  useEffect(() => {
    const loadCachedProfile = async () => {
      try {
        // Try to load from ProfileScreen cache first
        const cachedProfileStr = await AsyncStorage.getItem(PROFILE_CACHE_KEY);
        if (cachedProfileStr) {
          const cachedProfile = JSON.parse(cachedProfileStr);
          if (__DEV__) {
            console.log("[ProfileScreen] 📦 Cached Profile Data:", {
              hasName: !!cachedProfile?.name,
              name: cachedProfile?.name,
              hasId: !!cachedProfile?.id,
              id: cachedProfile?.id,
              hasEmail: !!cachedProfile?.email,
              email: cachedProfile?.email,
              allKeys: cachedProfile ? Object.keys(cachedProfile) : []
            });
            try {
              console.log("[ProfileScreen] Full cached profile:", JSON.stringify(cachedProfile, null, 2));
            } catch (e) {
              console.log("[ProfileScreen] Full cached profile (object):", cachedProfile);
            }
          }
          if (cachedProfile && (cachedProfile.name || cachedProfile.id || cachedProfile.email)) {
            setLocalUser(cachedProfile);
            if (__DEV__) {
              console.log("[ProfileScreen] Loaded cached profile data with name:", cachedProfile.name);
            }
            
            // If cached data is incomplete (missing name or id), trigger a fetch to refresh
            if (!cachedProfile.name || !cachedProfile.id) {
              if (__DEV__) {
                console.log("[ProfileScreen] ⚠️ Cached data incomplete, will fetch fresh data");
                console.log("[ProfileScreen] Missing name:", !cachedProfile.name);
                console.log("[ProfileScreen] Missing id:", !cachedProfile.id);
              }
              // Don't return early - let the fetch happen to update the incomplete cache
            } else {
              return; // Exit early - we have good complete cache data
            }
          }
        }
        
        // If no cache or cache is invalid, use user from context
        if (user && (user.name || user.id || user.email)) {
          setLocalUser(user);
          if (__DEV__) {
            console.log("[ProfileScreen] Using user from context with name:", user.name);
          }
        }
      } catch (error) {
        if (__DEV__) {
          console.warn("[ProfileScreen] Failed to load cached profile:", error);
        }
        // Fallback to user from context if cache fails
        if (user && (user.name || user.id || user.email)) {
          setLocalUser(user);
        }
      }
    };
    
    // Load cache immediately, regardless of user state
    loadCachedProfile();
  }, []);

  // Update localUser when user from context changes (especially after login)
  useEffect(() => {
    // If user from context has name/id and localUser doesn't, update it
    if (user && (user.name || user.id) && (!localUser || !localUser.name || !localUser.id)) {
      setLocalUser(user);
      // Also update cache
      AsyncStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(user)).catch(() => {});
      if (__DEV__) {
        console.log("[ProfileScreen] Updated localUser from context with name:", user.name);
      }
    }
  }, [user, localUser]);

  // COMMENTED OUT: Complex data processing - replaced with simple fallback
  // Fetch profile from backend and compare with cached data
  // const fetchAndCompareProfile = useCallback(async (isManualRefresh = false) => {
  //   ... (entire complex fetch logic commented out)
  // }, [user?._id, saveUser]);

  // Fetch profile from backend API endpoint
  // Uses: GET /api/users/me
  const fetchAndCompareProfile = useCallback(async (isManualRefresh = false) => {
    if (!user?._id && !user?.id) return;
    
    // Prevent concurrent fetches
    if (isFetchingRef.current && !isManualRefresh) {
      if (__DEV__) {
        console.log("[ProfileScreen] Fetch already in progress, skipping");
      }
      return;
    }
    
    isFetchingRef.current = true;
    
    try {
      // Ensure API is configured with token before making request
      // Get token from AuthContext or AsyncStorage
      let token = null;
      if (getToken && typeof getToken === 'function') {
        token = getToken();
      }
      
      // If no token from context, try AsyncStorage
      if (!token) {
        try {
          token = await AsyncStorage.getItem('token');
        } catch (err) {
          if (__DEV__) {
            console.warn("[ProfileScreen] Failed to get token from AsyncStorage:", err);
          }
        }
      }
      
      // Configure API with token if available
      if (token) {
        configureApi(() => token);
      } else {
        // No token available, skip API call and use cached/user data
        if (__DEV__) {
          console.warn("[ProfileScreen] No authentication token available, skipping API call");
        }
        // Use user from context or cached data
        if (user && (user.name || user.id || user.email)) {
          setLocalUser(user);
        }
        return;
      }
      
      // Abort previous request if still pending
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      
      abortControllerRef.current = new AbortController();
      const signal = abortControllerRef.current.signal;
      
      // Fetch profile from backend API
      // Uses: GET /api/users/me
      // Backend response format: { success: true, data: { _id, id, name, firstName, lastName, email, ... } }
      
      // DEBUG: Log API call details
      if (__DEV__) {
        // Note: API endpoint is defined in utils/api.ts
        // We log it here for debugging but don't need to import LOCALHOST_IP
        console.log("[ProfileScreen] 📡 API Call Details:");
        console.log("[ProfileScreen]   Endpoint: /api/users/me (from utils/api.ts)");
        console.log("[ProfileScreen]   Method: GET");
        console.log("[ProfileScreen]   Has Token:", !!token);
        console.log("[ProfileScreen]   Token Preview:", token ? token.substring(0, 30) + '...' : 'none');
        console.log("[ProfileScreen]   Token Length:", token ? token.length : 0);
        if (token) {
          try {
            // Try to decode JWT token (just for debugging - don't rely on this)
            const tokenParts = token.split('.');
            if (tokenParts.length === 3) {
              const payload = JSON.parse(atob(tokenParts[1]));
              console.log("[ProfileScreen]   Token Expiry:", payload.exp ? new Date(payload.exp * 1000).toISOString() : 'no expiry');
              console.log("[ProfileScreen]   Token Expired:", payload.exp ? Date.now() > payload.exp * 1000 : 'unknown');
            }
          } catch (e) {
            console.log("[ProfileScreen]   Token decode error (expected):", e.message);
          }
        }
      }
      
      let profileData;
      try {
        if (__DEV__) {
          console.log("[ProfileScreen] 🔄 Calling fetchUserProfile...");
        }
        profileData = await fetchUserProfile(signal);
        if (__DEV__) {
          console.log("[ProfileScreen] ✅ fetchUserProfile completed");
          console.log("[ProfileScreen] profileData type:", typeof profileData);
          console.log("[ProfileScreen] profileData is null:", profileData === null);
          console.log("[ProfileScreen] profileData is undefined:", profileData === undefined);
        }
      } catch (fetchError) {
        // Handle auth errors silently - they're expected when token is expired
        if (fetchError?.isAuthError || fetchError?.message?.includes('Authentication') || fetchError?.message?.includes('login')) {
          // Auth errors are expected - silently use cached data
          if (__DEV__) {
            console.log("[ProfileScreen] 🔐 Authentication failed - using cached data (token may be expired)");
          }
        } else {
          // Only log non-auth errors
          if (__DEV__) {
            console.warn("[ProfileScreen] ⚠️ fetchUserProfile failed:", fetchError?.message || fetchError);
          }
        }
        profileData = null;
      }
      
      // DEBUG: Log the raw API response to see what we're getting
      if (__DEV__) {
        if (profileData === null || profileData === undefined) {
          console.warn("[ProfileScreen] ⚠️ profileData is null or undefined!");
        } else {
          try {
            console.log("[ProfileScreen] 🔍 Raw API Response:", JSON.stringify(profileData, null, 2));
          } catch (stringifyError) {
            console.log("[ProfileScreen] 🔍 Raw API Response (could not stringify):", profileData);
            console.warn("[ProfileScreen] JSON.stringify error:", stringifyError);
          }
          try {
            console.log("[ProfileScreen] Response keys:", profileData ? Object.keys(profileData) : 'null');
            console.log("[ProfileScreen] Has success:", !!profileData?.success);
            console.log("[ProfileScreen] Has data:", !!profileData?.data);
            console.log("[ProfileScreen] Has user:", !!profileData?.user);
          } catch (e) {
            console.warn("[ProfileScreen] Error logging response details:", e);
          }
        }
      }
      
      // Handle response format: Priority order
      // 1. New format: { success: true, data: {...} }
      // 2. Wrapped format: { user: {...} }
      // 3. Alternative format: { data: {...} }
      // 4. Direct user object
      let fetchedProfile = profileData;
      if (profileData?.success && profileData?.data) {
        // New backend format: { success: true, data: {...} }
        fetchedProfile = profileData.data;
        if (__DEV__) {
          console.log("[ProfileScreen] ✅ Using new format (success.data)");
          console.log("[ProfileScreen] Fetched profile keys:", Object.keys(fetchedProfile));
          console.log("[ProfileScreen] Fetched profile - name:", fetchedProfile?.name);
          console.log("[ProfileScreen] Fetched profile - id:", fetchedProfile?.id);
          console.log("[ProfileScreen] Fetched profile - email:", fetchedProfile?.email);
        }
      } else if (profileData?.user) {
        // Backend format: { user: {...} }
        fetchedProfile = profileData.user;
        if (__DEV__) {
          console.log("[ProfileScreen] ✅ Using wrapped format (user)");
          console.log("[ProfileScreen] Fetched profile keys:", Object.keys(fetchedProfile));
          console.log("[ProfileScreen] Fetched profile - name:", fetchedProfile?.name);
          console.log("[ProfileScreen] Fetched profile - id:", fetchedProfile?.id);
          console.log("[ProfileScreen] Fetched profile - email:", fetchedProfile?.email);
          try {
            console.log("[ProfileScreen] Full fetched profile:", JSON.stringify(fetchedProfile, null, 2));
          } catch (e) {
            console.log("[ProfileScreen] Full fetched profile (object):", fetchedProfile);
          }
        }
      } else if (profileData?.data) {
        // Alternative format: { data: {...} }
        fetchedProfile = profileData.data;
        if (__DEV__) {
          console.log("[ProfileScreen] ✅ Using alternative format (data)");
          console.log("[ProfileScreen] Fetched profile keys:", Object.keys(fetchedProfile));
        }
      } else {
        // If profileData is already the user object directly, use it as-is
        if (__DEV__) {
          console.log("[ProfileScreen] ✅ Using direct format (no wrapper)");
          console.log("[ProfileScreen] Profile keys:", profileData ? Object.keys(profileData) : 'null');
        }
      }
      
      // DEBUG: Log what we extracted
      if (__DEV__) {
        console.log("[ProfileScreen] 📦 Extracted Profile Data:", {
          hasName: !!fetchedProfile?.name,
          name: fetchedProfile?.name,
          hasId: !!fetchedProfile?.id,
          id: fetchedProfile?.id,
          hasEmail: !!fetchedProfile?.email,
          email: fetchedProfile?.email,
          has_id: !!fetchedProfile?._id,
          _id: fetchedProfile?._id,
          allKeys: fetchedProfile ? Object.keys(fetchedProfile) : []
        });
      }
      
      // Update local user state
      if (fetchedProfile && (fetchedProfile.name || fetchedProfile.id || fetchedProfile._id || fetchedProfile.email)) {
        // DEBUG: Log what we're about to set
        if (__DEV__) {
          console.log("[ProfileScreen] 💾 Setting localUser with:", {
            name: fetchedProfile?.name,
            id: fetchedProfile?.id,
            email: fetchedProfile?.email,
            _id: fetchedProfile?._id,
            allKeys: Object.keys(fetchedProfile)
          });
        }
        
        setLocalUser(fetchedProfile);
        
        // Update cache
        try {
          await AsyncStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(fetchedProfile));
          if (__DEV__) {
            console.log("[ProfileScreen] ✅ Profile fetched and cached from backend API");
            console.log("[ProfileScreen] Cached profile includes:", {
              name: fetchedProfile?.name || 'MISSING',
              id: fetchedProfile?.id || 'MISSING',
              email: fetchedProfile?.email || 'MISSING'
            });
          }
        } catch (cacheError) {
          if (__DEV__) {
            console.warn("[ProfileScreen] Failed to cache profile:", cacheError);
          }
        }
        
        // Update user context if saveUser is available
        if (saveUser && typeof saveUser === 'function') {
          try {
            await saveUser(fetchedProfile);
            if (__DEV__) {
              console.log("[ProfileScreen] ✅ Saved to user context");
            }
          } catch (saveError) {
            if (__DEV__) {
              console.warn("[ProfileScreen] Failed to save to user context:", saveError);
            }
          }
        }
      } else {
        // DEBUG: Log why we didn't update
        if (__DEV__) {
          console.warn("[ProfileScreen] ⚠️ Not updating localUser - fetchedProfile validation failed:", {
            hasFetchedProfile: !!fetchedProfile,
            hasName: !!fetchedProfile?.name,
            hasId: !!fetchedProfile?.id,
            has_id: !!fetchedProfile?._id,
            hasEmail: !!fetchedProfile?.email,
            fetchedProfile: fetchedProfile
          });
        }
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        if (__DEV__) {
          console.log("[ProfileScreen] Request aborted");
        }
        return;
      }
      
      if (__DEV__) {
        console.warn("[ProfileScreen] Failed to fetch profile from API:", error);
      }
      
      // Fallback to cached data or user from context
      try {
        const cachedProfileStr = await AsyncStorage.getItem(PROFILE_CACHE_KEY);
        if (cachedProfileStr) {
          const cachedProfile = JSON.parse(cachedProfileStr);
          setLocalUser(cachedProfile);
          if (__DEV__) {
            console.log("[ProfileScreen] Loaded cached profile as fallback");
          }
        } else if (user && (user.name || user.id || user.email)) {
          // Final fallback: use user from context
          setLocalUser(user);
        }
      } catch (cacheError) {
        if (__DEV__) {
          console.warn("[ProfileScreen] Failed to load cached profile:", cacheError);
        }
        // Final fallback: use user from context
        if (user && (user.name || user.id || user.email)) {
          setLocalUser(user);
        }
      }
    } finally {
      isFetchingRef.current = false;
      abortControllerRef.current = null;
    }
  }, [user, saveUser]);

  // Initial fetch on mount - only once per user ID
  // FIXED: Removed fetchAndCompareProfile from dependencies to prevent infinite loops
  // FIXED: Use ref to track if we've already fetched to prevent re-fetching on refresh
  const hasFetchedRef = useRef(false);
  useEffect(() => {
    if (user?._id && !hasFetchedRef.current) {
      hasFetchedRef.current = true;
      // Load once on mount (fallback mode)
      fetchAndCompareProfile(false);
    }
    // Reset fetch flag when user changes
    if (!user?._id) {
      hasFetchedRef.current = false;
    }
  }, [user?._id]); // Only depend on user ID, not fetchAndCompareProfile

  // COMMENTED OUT: 5-second polling interval
  // Set up 5-second interval to fetch and compare
  // useEffect(() => {
  //   if (!user?._id) return;
  //
  //   // Start interval
  //   intervalRef.current = setInterval(() => {
  //     fetchAndCompareProfile(false);
  //   }, FETCH_INTERVAL);
  //
  //   // Cleanup on unmount
  //   return () => {
  //     if (intervalRef.current) {
  //       clearInterval(intervalRef.current);
  //       intervalRef.current = null;
  //     }
  //     if (abortControllerRef.current) {
  //       abortControllerRef.current.abort();
  //       abortControllerRef.current = null;
  //     }
  //   };
  // }, [user?._id, fetchAndCompareProfile]);

  // Simple cleanup on unmount (fallback mode)
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, []);

  // Manual refresh handler
  // FIXED: Removed fetchAndCompareProfile from dependencies to prevent navigation reset
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    // Use the ref to ensure we have the latest function without causing re-renders
    fetchAndCompareProfile(true).finally(() => {
      setRefreshing(false);
    });
  }, [user?._id, saveUser]); // Only depend on stable values

  // Use localUser for display (from cache or fetched data), fallback to user from context
  const displayUser = localUser || user;

  // Show loading only if we truly have no user data at all
  // Give it a moment for cache to load or user context to initialize
  if (!displayUser && !user) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  // If we still don't have displayUser but user exists, use user
  const finalDisplayUser = displayUser || user;

  // Debug logging in development (wrapped in try-catch to prevent crashes)
  if (__DEV__) {
    try {
      console.log("[ProfileScreen] Display user data:", {
        hasLocalUser: !!localUser,
        hasUser: !!user,
        localUserName: localUser?.name,
        userName: user?.name,
        localUserId: localUser?.id,
        userId: user?.id,
        finalName: finalDisplayUser?.name,
        finalId: finalDisplayUser?.id,
        finalEmail: finalDisplayUser?.email,
      });
      
      // Log full finalDisplayUser object to see all available fields
      if (finalDisplayUser) {
        try {
          console.log("[ProfileScreen] 📋 Full finalDisplayUser object:", JSON.stringify(finalDisplayUser, null, 2));
        } catch (e) {
          console.log("[ProfileScreen] 📋 Full finalDisplayUser object (could not stringify):", finalDisplayUser);
        }
        try {
          console.log("[ProfileScreen] 📋 finalDisplayUser keys:", Object.keys(finalDisplayUser));
          console.log("[ProfileScreen] 📋 finalDisplayUser.name:", finalDisplayUser?.name);
          console.log("[ProfileScreen] 📋 finalDisplayUser.id:", finalDisplayUser?.id);
          console.log("[ProfileScreen] 📋 finalDisplayUser.email:", finalDisplayUser?.email);
        } catch (e) {
          console.warn("[ProfileScreen] Error logging finalDisplayUser details:", e);
        }
      } else {
        console.warn("[ProfileScreen] ⚠️ finalDisplayUser is null/undefined!");
      }
    } catch (error) {
      // Don't crash the app if logging fails
      console.warn("[ProfileScreen] Error in debug logging:", error);
    }
  }

  const handleLogout = () => {
    Alert.alert(
      "Confirm Logout",
      "Are you sure you want to log out?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Logout",
          onPress: async () => {
            await logout(); // clears token
            await clearUser(); // clears user info
          },
          style: "destructive",
        },
      ],
      { cancelable: true }
    );
  };

  const renderMenuItem = (icon, title, onPress, isDestructive = false) => (
    <TouchableOpacity
      style={styles.menuItem}
      onPress={onPress}
      accessible
      accessibilityLabel={title}
    >
      <View style={styles.menuItemContent}>
        <Ionicons
          name={icon}
          size={iconSize}
          color={isDestructive ? '#FF3B30' : '#333333'}
        />
        <Text style={[
          styles.menuItemText,
          isDestructive && styles.destructiveText
        ]}>
          {title}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={iconSize} color="#CCCCCC" />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#00ADB5" />
      
      {/* Profile Header */}
      <View style={styles.header}>
        <LinearGradient
          colors={['#00ADB5', '#00C2CC']}
          style={styles.headerGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        >
          <View style={styles.headerContent}>
            <View style={styles.headerLeft}>
              <Text style={styles.headerTitle}>Profile</Text>
              <Text style={styles.headerSubtitle}>Manage your account</Text>
            </View>
            <View style={styles.headerAvatar}>
              <Ionicons name="person-circle" size={48} color="#FFFFFF" />
            </View>
          </View>
        </LinearGradient>
      </View>

      <ScrollView 
        style={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#00ADB5"
            colors={["#00ADB5"]}
          />
        }
      >
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <Text style={styles.welcomeText}>Welcome back,</Text>
          
          {/* Name */}
          <Text style={styles.userName}>
            {finalDisplayUser?.name 
              ? finalDisplayUser.name 
              : finalDisplayUser?.firstName && finalDisplayUser?.lastName 
              ? `${finalDisplayUser.firstName} ${finalDisplayUser.lastName}` 
              : finalDisplayUser?.firstName 
              ? finalDisplayUser.firstName 
              : finalDisplayUser?.lastName 
              ? finalDisplayUser.lastName 
              : 'User'}
          </Text>
          
          {/* User ID (id field, not _id) */}
          {finalDisplayUser?.id ? (
            <View style={styles.userInfoRow}>
              <Ionicons name="id-card-outline" size={16} color="#666666" />
              <Text style={styles.userInfoText}>ID: {finalDisplayUser.id}</Text>
            </View>
          ) : finalDisplayUser?._id ? (
            // Fallback: Show _id if id is not available (for debugging)
            <View style={styles.userInfoRow}>
              <Ionicons name="id-card-outline" size={16} color="#FF9800" />
              <Text style={[styles.userInfoText, { color: '#FF9800' }]}>
                _ID: {finalDisplayUser._id} (id field missing)
              </Text>
            </View>
          ) : null}
          
          {/* Email */}
          {finalDisplayUser?.email && (
            <View style={styles.userInfoRow}>
              <Ionicons name="mail-outline" size={16} color="#666666" />
              <Text style={styles.userInfoText}>{finalDisplayUser.email}</Text>
            </View>
          )}
          
          {/* DEBUG: Show what fields are available (only in dev mode) */}
          {__DEV__ && finalDisplayUser && (() => {
            let keys = 'none';
            try {
              if (finalDisplayUser && typeof finalDisplayUser === 'object') {
                keys = Object.keys(finalDisplayUser).join(', ');
              }
            } catch (e) {
              keys = 'error: ' + String(e.message);
            }
            
            const nameStr = finalDisplayUser?.name ? '✅ ' + String(finalDisplayUser.name || '') : '❌';
            const idStr = finalDisplayUser?.id ? '✅ ' + String(finalDisplayUser.id || '') : '❌';
            const _idStr = finalDisplayUser?._id ? '✅ ' + String(finalDisplayUser._id || '').substring(0, 20) : '❌';
            const emailStr = finalDisplayUser?.email ? '✅ ' + String(finalDisplayUser.email || '') : '❌';
            
            return (
              <View style={styles.debugInfo}>
                <Text style={styles.debugText}>🔍 Debug Info:</Text>
                <Text style={styles.debugText}>Has name: {nameStr}</Text>
                <Text style={styles.debugText}>Has id: {idStr}</Text>
                <Text style={styles.debugText}>Has _id: {_idStr}</Text>
                <Text style={styles.debugText}>Has email: {emailStr}</Text>
                <Text style={styles.debugText}>All keys: {keys}</Text>
              </View>
            );
          })()}
        </View>

        {/* Trips Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Trips</Text>
          <View style={styles.menuContainer}>
            {renderMenuItem(
              "flag-outline",
              "Trips",
              () => navigation.navigate("TripDetails")
            )}
          </View>
        </View>

        {/* Reports Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Reports</Text>
          <View style={styles.menuContainer}>
            {renderMenuItem(
              "warning-outline",
              "Traffic Reports",
              () => navigation.navigate("AlertDetails")
            )}
          </View>
        </View>

        {/* Account Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.menuContainer}>
            {renderMenuItem(
              "lock-closed-outline",
              "Account Settings",
              () => navigation.navigate("AccountSettingsScreen")
            )}
            {renderMenuItem(
              "log-out-outline",
              "Logout",
              handleLogout,
              true
            )}
          </View>
        </View>


        {/* Support Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Support</Text>
          <View style={styles.menuContainer}>
            {renderMenuItem(
              "help-circle-outline",
              "Help Center",
              () => navigation.navigate("HelpCenterScreen")
            )}
            {renderMenuItem(
              "shield-outline",
              "Privacy Policy",
              () => navigation.navigate("ReportBugScreen")
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F2EEEE',
  },
  container: {
    flex: 1,
  },
  header: {
    width: '100%',
    backgroundColor: '#F2EEEE',
    zIndex: 10,
    overflow: 'hidden',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerGradient: {
    padding: 24,
    paddingTop: Platform.OS === 'ios' ? 20 : 0,
    paddingBottom: 16,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '500',
  },
  headerAvatar: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileCard: {
    backgroundColor: '#FFFAFA',
    margin: 16,
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  welcomeText: {
    fontSize: 16,
    color: '#666666',
    marginBottom: 4,
  },
  userName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333333',
    marginBottom: 12,
  },
  userInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  userInfoText: {
    fontSize: 16,
    color: '#666666',
    marginLeft: 8,
  },
  userEmail: {
    fontSize: 16,
    color: '#666666',
  },
  debugInfo: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#FFF3CD',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFC107',
  },
  debugText: {
    fontSize: 12,
    color: '#856404',
    marginBottom: 4,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  section: {
    marginHorizontal: 16,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333333',
    marginBottom: 12,
    marginLeft: 4,
  },
  menuContainer: {
    backgroundColor: '#FFFAFA',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  menuItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuItemText: {
    fontSize: 16,
    color: '#333333',
    marginLeft: 12,
    fontWeight: '500',
  },
  destructiveText: {
    color: '#FF3B30',
  },
});

export default ProfileScreen;
