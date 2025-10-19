import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface LocationCoords {
  latitude: number;
  longitude: number;
  address?: string;
  timestamp?: number;
}

interface LocationContextType {
  currentLocation: LocationCoords | null;
  setCurrentLocation: (location: LocationCoords | null) => void;
  getCurrentLocation: (forceRefresh?: boolean) => Promise<LocationCoords | null>;
  isLocationLoading: boolean;
  locationPermissionGranted: boolean;
  lastLocationUpdate: number;
  cachedLocation: LocationCoords | null;
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);

const LOCATION_CACHE_KEY = 'cached_user_location';
const LOCATION_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const LOCATION_ACCURACY_THRESHOLD = 100; // 100 meters

export const LocationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentLocation, setCurrentLocation] = useState<LocationCoords | null>(null);
  const [isLocationLoading, setIsLocationLoading] = useState(false);
  const [locationPermissionGranted, setLocationPermissionGranted] = useState(false);
  const [cachedLocation, setCachedLocation] = useState<LocationCoords | null>(null);
  const lastLocationUpdate = useRef<number>(0);
  const locationUpdateTimeout = useRef<NodeJS.Timeout | null>(null);

  // Load cached location on mount
  useEffect(() => {
    loadCachedLocation();
  }, []);

  // Save location to cache whenever it changes
  useEffect(() => {
    if (currentLocation) {
      saveLocationToCache(currentLocation);
    }
  }, [currentLocation]);

  const loadCachedLocation = useCallback(async () => {
    try {
      const cached = await AsyncStorage.getItem(LOCATION_CACHE_KEY);
      if (cached) {
        const locationData = JSON.parse(cached);
        const now = Date.now();
        
        // Check if cache is still valid (less than 5 minutes old)
        if (now - locationData.timestamp < LOCATION_CACHE_DURATION) {
          setCachedLocation(locationData);
          setCurrentLocation(locationData);
          console.log('[LocationContext] Loaded cached location:', locationData);
          return locationData;
        } else {
          console.log('[LocationContext] Cached location expired, clearing cache');
          await AsyncStorage.removeItem(LOCATION_CACHE_KEY);
        }
      }
    } catch (error) {
      console.error('[LocationContext] Error loading cached location:', error);
    }
    return null;
  }, []);

  const saveLocationToCache = useCallback(async (location: LocationCoords) => {
    try {
      const locationWithTimestamp = {
        ...location,
        timestamp: Date.now(),
      };
      await AsyncStorage.setItem(LOCATION_CACHE_KEY, JSON.stringify(locationWithTimestamp));
      setCachedLocation(locationWithTimestamp);
      console.log('[LocationContext] Saved location to cache:', locationWithTimestamp);
    } catch (error) {
      console.error('[LocationContext] Error saving location to cache:', error);
    }
  }, []);

  const getCurrentLocation = useCallback(async (forceRefresh: boolean = false): Promise<LocationCoords | null> => {
    // If we have a recent location and not forcing refresh, return cached
    if (!forceRefresh && currentLocation && (Date.now() - lastLocationUpdate.current < 30000)) {
      console.log('[LocationContext] Using recent location, no refresh needed');
      return currentLocation;
    }

    // If we have cached location and not forcing refresh, return cached
    if (!forceRefresh && cachedLocation && (Date.now() - cachedLocation.timestamp! < LOCATION_CACHE_DURATION)) {
      console.log('[LocationContext] Using cached location');
      setCurrentLocation(cachedLocation);
      return cachedLocation;
    }

    setIsLocationLoading(true);

    try {
      // Request location permissions
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationPermissionGranted(false);
        console.warn('[LocationContext] Location permission not granted');
        return null;
      }

      setLocationPermissionGranted(true);

      // Get current location with high accuracy
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
        timeInterval: 1000,
        distanceInterval: 1,
      });

      const newLocation: LocationCoords = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        timestamp: Date.now(),
      };

      // Check if new location is significantly different from current
      if (currentLocation) {
        const distance = calculateDistance(
          currentLocation.latitude,
          currentLocation.longitude,
          newLocation.latitude,
          newLocation.longitude
        );

        if (distance < LOCATION_ACCURACY_THRESHOLD) {
          console.log('[LocationContext] New location too close to current, using current');
          setIsLocationLoading(false);
          return currentLocation;
        }
      }

      // Reverse geocode for address
      try {
        const addresses = await Location.reverseGeocodeAsync({
          latitude: newLocation.latitude,
          longitude: newLocation.longitude,
        });

        if (addresses.length > 0) {
          const address = addresses[0];
          newLocation.address = `${address.street || ''} ${address.city || ''} ${address.region || ''}`.trim();
        }
      } catch (geocodeError) {
        console.warn('[LocationContext] Reverse geocoding failed:', geocodeError);
      }

      setCurrentLocation(newLocation);
      lastLocationUpdate.current = Date.now();
      
      console.log('[LocationContext] Got new location:', newLocation);
      return newLocation;

    } catch (error) {
      console.error('[LocationContext] Error getting location:', error);
      
      // Fallback to cached location if available
      if (cachedLocation) {
        console.log('[LocationContext] Falling back to cached location');
        setCurrentLocation(cachedLocation);
        return cachedLocation;
      }
      
      return null;
    } finally {
      setIsLocationLoading(false);
    }
  }, [currentLocation, cachedLocation]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (locationUpdateTimeout.current) {
        clearTimeout(locationUpdateTimeout.current);
      }
    };
  }, []);

  const value: LocationContextType = {
    currentLocation,
    setCurrentLocation,
    getCurrentLocation,
    isLocationLoading,
    locationPermissionGranted,
    lastLocationUpdate: lastLocationUpdate.current,
    cachedLocation,
  };

  return (
    <LocationContext.Provider value={value}>
      {children}
    </LocationContext.Provider>
  );
};

export const useLocation = (): LocationContextType => {
  const context = useContext(LocationContext);
  if (context === undefined) {
    throw new Error('useLocation must be used within a LocationProvider');
  }
  return context;
};

// Helper function to calculate distance between two coordinates
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c; // Distance in meters
}
