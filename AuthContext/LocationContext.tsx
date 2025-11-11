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

// DEV ONLY: Default location for development when no GPS is available
// Metro Manila area (Valenzuela City)
const DEV_DEFAULT_LOCATION: LocationCoords = {
  latitude: 14.7006,
  longitude: 120.9833,
  address: 'Valenzuela City, Metro Manila (DEV DEFAULT)',
  timestamp: Date.now(),
};

export const LocationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentLocation, setCurrentLocation] = useState<LocationCoords | null>(null);
  const [isLocationLoading, setIsLocationLoading] = useState(false);
  const [locationPermissionGranted, setLocationPermissionGranted] = useState(false);
  const [cachedLocation, setCachedLocation] = useState<LocationCoords | null>(null);
  const lastLocationUpdate = useRef<number>(0);
  const locationUpdateTimeout = useRef<NodeJS.Timeout | null>(null);
  const continuousLocationSub = useRef<Location.LocationSubscription | null>(null);
  const currentLocationRef = useRef<LocationCoords | null>(null);

  // Load cached location on mount
  useEffect(() => {
    loadCachedLocation().then((cached) => {
      // DEV ONLY: If no cached location and in dev mode, use default location
      if (__DEV__ && !cached && !currentLocation) {
        if (__DEV__) {
          console.log('[LocationContext] 🧪 DEV MODE: Using default location (no GPS available)', DEV_DEFAULT_LOCATION);
        }
        setCurrentLocation(DEV_DEFAULT_LOCATION);
        currentLocationRef.current = DEV_DEFAULT_LOCATION;
      }
    });
  }, []);

  // Update ref whenever currentLocation changes
  useEffect(() => {
    currentLocationRef.current = currentLocation;
  }, [currentLocation]);

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
        // DEV ONLY: If permission not granted in dev mode, use default location
        if (__DEV__) {
          console.warn('[LocationContext] 🧪 DEV MODE: Permission not granted, using default location');
          setCurrentLocation(DEV_DEFAULT_LOCATION);
          lastLocationUpdate.current = Date.now();
          setIsLocationLoading(false);
          return DEV_DEFAULT_LOCATION;
        }
        return null;
      }

      setLocationPermissionGranted(true);

      // Get current location with high accuracy
      let location;
      try {
        location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
          timeInterval: 1000,
          distanceInterval: 1,
        });
      } catch (locationError) {
        // DEV ONLY: If location fetch fails in dev mode, use default location
        if (__DEV__) {
          console.warn('[LocationContext] 🧪 DEV MODE: Location fetch failed, using default location:', locationError);
          setCurrentLocation(DEV_DEFAULT_LOCATION);
          lastLocationUpdate.current = Date.now();
          setIsLocationLoading(false);
          return DEV_DEFAULT_LOCATION;
        }
        throw locationError;
      }

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
      
      // DEV ONLY: If no location available in dev mode, use default location
      if (__DEV__) {
        console.warn('[LocationContext] 🧪 DEV MODE: No location available, using default location');
        setCurrentLocation(DEV_DEFAULT_LOCATION);
        lastLocationUpdate.current = Date.now();
        return DEV_DEFAULT_LOCATION;
      }
      
      return null;
    } finally {
      setIsLocationLoading(false);
    }
  }, [currentLocation, cachedLocation]);

  // Continuous location watch - ALWAYS active to keep location updated globally
  // This ensures location updates even when user is not on map screen
  useEffect(() => {
    const startContinuousLocationWatch = async () => {
      try {
        // Request location permissions
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setLocationPermissionGranted(false);
          if (__DEV__) {
            console.warn('[LocationContext] Location permission not granted for continuous tracking');
          }
          return;
        }

        setLocationPermissionGranted(true);

        // Start watching position - updates in real-time globally
        continuousLocationSub.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: 5000, // Update every 5 seconds for battery efficiency
            distanceInterval: 10, // Update every 10 meters for responsive tracking
          },
          (location) => {
            if (!location || !location.coords) return;

            const lat = location.coords.latitude;
            const lon = location.coords.longitude;

            // Validate coordinates
            if (typeof lat !== 'number' || typeof lon !== 'number' ||
                isNaN(lat) || isNaN(lon) ||
                lat < -90 || lat > 90 ||
                lon < -180 || lon > 180) {
              return;
            }

            const newLocation: LocationCoords = {
              latitude: lat,
              longitude: lon,
              timestamp: location.timestamp ?? Date.now(),
            };

            // Only update if location has changed significantly
            const currentLoc = currentLocationRef.current;
            if (!currentLoc ||
                Math.abs(currentLoc.latitude - newLocation.latitude) > 0.00001 ||
                Math.abs(currentLoc.longitude - newLocation.longitude) > 0.00001) {
              setCurrentLocation(newLocation);
              lastLocationUpdate.current = Date.now();
              
              if (__DEV__) {
                console.log('[LocationContext] 📍 Global location update:', newLocation);
              }
            }
          },
          (error) => {
            // DEV ONLY: If location watch fails in dev mode, use default location
            if (__DEV__) {
              console.warn('[LocationContext] 🧪 DEV MODE: Location watch error, using default location:', error);
              if (!currentLocationRef.current) {
                setCurrentLocation(DEV_DEFAULT_LOCATION);
                currentLocationRef.current = DEV_DEFAULT_LOCATION;
                lastLocationUpdate.current = Date.now();
              }
            }
          }
        );

        if (__DEV__) {
          console.log('[LocationContext] ✅ Started continuous global location watch');
        }
      } catch (error) {
        if (__DEV__) {
          console.error('[LocationContext] ❌ Failed to start continuous location watch:', error);
        }
      }
    };

    startContinuousLocationWatch();

    // Cleanup subscription on unmount
    return () => {
      if (continuousLocationSub.current) {
        continuousLocationSub.current.remove();
        continuousLocationSub.current = null;
        if (__DEV__) {
          console.log('[LocationContext] 🛑 Stopped continuous global location watch');
        }
      }
    };
  }, []); // Run once on mount

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
