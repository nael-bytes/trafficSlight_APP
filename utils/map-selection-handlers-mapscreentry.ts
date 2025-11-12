import { useCallback, useRef } from 'react';
import * as Location from 'expo-location';

export interface LocationCoords {
  latitude: number;
  longitude: number;
  address?: string;
}

export interface MapSelectionState {
  selectedLocation: LocationCoords | null;
  isSelecting: boolean;
}

export interface MapSelectionHandlers {
  startMapSelection: () => void;
  cancelMapSelection: () => void;
  handleMapPress: (event: any) => Promise<void>;
  confirmMapSelection: () => Promise<void>;
}

// Reverse geocoding function with better error handling
export const reverseGeocodeLocation = async (lat: number, lng: number): Promise<string> => {
  try {
    // Validate coordinates
    if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
      throw new Error('Invalid coordinates');
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      console.warn('Google Maps API key not found, using fallback address');
      return `Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
    }

    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`;
    console.log('🔄 Reverse geocoding URL:', url);
    
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    const data = await res.json();
    
    if (data.status === 'OK' && data.results && data.results.length > 0) {
      const address = data.results[0].formatted_address;
      console.log('✅ Reverse geocoding successful:', address);
      return address;
    } else {
      console.warn('⚠️ Reverse geocoding returned no results:', data.status);
      return `Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
    }
  } catch (err) {
    console.error("❌ Reverse geocoding failed:", err);
    return `Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
  }
};

// Map selection handlers hook
export const useMapSelectionHandlers = (
  uiState: { isMapSelectionMode: boolean },
  updateUiState: (updates: any) => void,
  mapSelectionState: MapSelectionState,
  setMapSelectionState: React.Dispatch<React.SetStateAction<MapSelectionState>>,
  setDestination: (location: LocationCoords | null) => void,
  currentLocation: LocationCoords | null,
  setCurrentLocation: (location: LocationCoords | null) => void,
  flowStateManager?: (state: string) => void // Optional - flow state is now handled by wrapper
): MapSelectionHandlers => {
  
  // CRITICAL: Guard refs to prevent double-selection crashes
  const isProcessingMapPressRef = useRef(false);
  const isConfirmingRef = useRef(false);
  
  const startMapSelection = useCallback(() => {
    if (__DEV__) {
      console.log("🚀 Starting map selection mode");
    }
    // CRITICAL: Update mapSelectionState first (synchronous) before uiState (asynchronous)
    // This ensures handleMapPress can detect selection mode immediately
    setMapSelectionState(prev => ({ ...prev, isSelecting: true, selectedLocation: null }));
    updateUiState({ 
      isMapSelectionMode: true, 
      showSearchModal: false // Close search modal when entering map selection
    });
    if (__DEV__) {
      console.log("✅ Map selection mode activated", {
        isSelecting: true,
        isMapSelectionMode: true,
      });
    }
  }, [updateUiState, setMapSelectionState]);

  const cancelMapSelection = useCallback(() => {
    if (__DEV__) {
      console.log("❌ Cancelling map selection");
    }
    // Reset processing flags
    isProcessingMapPressRef.current = false;
    isConfirmingRef.current = false;
    
    updateUiState({ 
      isMapSelectionMode: false, 
      showSearchModal: true // Return to search modal
    });
    setMapSelectionState(prev => ({ ...prev, isSelecting: false, selectedLocation: null }));
  }, [updateUiState, setMapSelectionState]);

  const handleMapPress = useCallback(async (event: any) => {
    if (__DEV__) {
      console.log("🗺️ Map pressed", {
        isMapSelectionMode: uiState.isMapSelectionMode,
        isSelecting: mapSelectionState.isSelecting,
        eventStructure: event ? 'exists' : 'null',
        hasNativeEvent: !!(event?.nativeEvent),
        hasCoordinate: !!(event?.nativeEvent?.coordinate || event?.coordinate),
      });
    }
    
    // Check both uiState and mapSelectionState to handle timing issues
    // mapSelectionState.isSelecting is updated synchronously, so it's more reliable
    if (!uiState.isMapSelectionMode && !mapSelectionState.isSelecting) {
      if (__DEV__) {
        console.log("❌ Not in map selection mode, ignoring press");
      }
      return;
    }
    
    if (__DEV__) {
      console.log("✅ Map selection mode active, processing press");
    }

    // CRITICAL: Allow multiple selections until user confirms
    // Only guard against concurrent processing (not multiple selections)
    // User can click multiple times to change selection, but we prevent rapid concurrent processing
    if (isProcessingMapPressRef.current) {
      if (__DEV__) {
        console.log("⚠️ Map press processing in progress, will process after delay...");
      }
      // Queue the press after a short delay to allow current processing to complete
      // Don't recursively call handleMapPress - just process the event after delay
      setTimeout(async () => {
        if (!uiState.isMapSelectionMode && !mapSelectionState.isSelecting) {
          return; // Selection mode ended
        }
        
        // Process the queued press directly
        isProcessingMapPressRef.current = true;
        try {
          // Extract and process coordinates
          let latitude, longitude;
          if (event?.nativeEvent?.coordinate) {
            latitude = event.nativeEvent.coordinate.latitude;
            longitude = event.nativeEvent.coordinate.longitude;
          } else if (event?.coordinate) {
            latitude = event.coordinate.latitude;
            longitude = event.coordinate.longitude;
          } else {
            isProcessingMapPressRef.current = false;
            return;
          }
          
          if (typeof latitude !== 'number' || typeof longitude !== 'number' ||
              isNaN(latitude) || isNaN(longitude) ||
              latitude < -90 || latitude > 90 ||
              longitude < -180 || longitude > 180) {
            isProcessingMapPressRef.current = false;
            return;
          }
          
          const newLocation = { latitude, longitude };
          setMapSelectionState(prev => ({ ...prev, selectedLocation: newLocation }));
          
          // Reverse geocode in background
          try {
            const address = await reverseGeocodeLocation(latitude, longitude);
            const locationWithAddress = { ...newLocation, address };
            setMapSelectionState(prev => {
              if (prev.selectedLocation?.latitude === latitude && 
                  prev.selectedLocation?.longitude === longitude) {
                return { ...prev, selectedLocation: locationWithAddress };
              }
              return prev;
            });
          } catch (error) {
            const locationWithFallback = { ...newLocation, address: "Selected Location" };
            setMapSelectionState(prev => {
              if (prev.selectedLocation?.latitude === latitude && 
                  prev.selectedLocation?.longitude === longitude) {
                return { ...prev, selectedLocation: locationWithFallback };
              }
              return prev;
            });
          }
        } catch (error) {
          console.error('❌ Error processing queued map press:', error);
        } finally {
          setTimeout(() => {
            isProcessingMapPressRef.current = false;
          }, 200);
        }
      }, 100); // Short delay to prevent concurrent processing
      return;
    }

    // Set processing flag to prevent concurrent processing (not multiple selections)
    isProcessingMapPressRef.current = true;

    try {
      // Handle different event structures with null checks
      let latitude, longitude;
      if (event?.nativeEvent?.coordinate) {
        latitude = event.nativeEvent.coordinate.latitude;
        longitude = event.nativeEvent.coordinate.longitude;
      } else if (event?.coordinate) {
        latitude = event.coordinate.latitude;
        longitude = event.coordinate.longitude;
      } else {
        console.error("❌ No coordinate found in event:", event);
        isProcessingMapPressRef.current = false;
        return;
      }
      
      // Validate coordinates
      if (typeof latitude !== 'number' || typeof longitude !== 'number' ||
          isNaN(latitude) || isNaN(longitude) ||
          latitude < -90 || latitude > 90 ||
          longitude < -180 || longitude > 180) {
        console.error("❌ Invalid coordinates:", latitude, longitude);
        isProcessingMapPressRef.current = false;
        return;
      }
      
      const newLocation = { latitude, longitude };
      if (__DEV__) {
        console.log("📍 Selected coordinates:", latitude, longitude);
      }
      
      // Immediately update state to show selection (allows multiple selections)
      setMapSelectionState(prev => ({ ...prev, selectedLocation: newLocation }));
      
      // Reverse geocode the selected location with better error handling
      // This runs in background and doesn't block next selection
      try {
        if (__DEV__) {
          console.log("🔄 Reverse geocoding location...");
        }
        const address = await reverseGeocodeLocation(latitude, longitude);
        const locationWithAddress = { ...newLocation, address };
        // Update with address (may overwrite if user selected another location)
        setMapSelectionState(prev => {
          // Only update if this is still the selected location (user hasn't selected another)
          if (prev.selectedLocation?.latitude === latitude && 
              prev.selectedLocation?.longitude === longitude) {
            return { ...prev, selectedLocation: locationWithAddress };
          }
          return prev; // User selected another location, keep current
        });
        if (__DEV__) {
          console.log("✅ Address found:", address);
        }
      } catch (error) {
        console.error('❌ Reverse geocoding failed:', error);
        // Keep the location without address but still allow selection
        const locationWithFallback = { ...newLocation, address: "Selected Location" };
        setMapSelectionState(prev => {
          // Only update if this is still the selected location
          if (prev.selectedLocation?.latitude === latitude && 
              prev.selectedLocation?.longitude === longitude) {
            return { ...prev, selectedLocation: locationWithFallback };
          }
          return prev;
        });
      }
    } catch (error) {
      console.error('❌ Error processing map press:', error);
    } finally {
      // Reset processing flag quickly to allow next selection
      // This allows user to click multiple times to change selection
      setTimeout(() => {
        isProcessingMapPressRef.current = false;
      }, 200); // Short delay (200ms) to allow async operations but enable multiple selections
    }
  }, [uiState.isMapSelectionMode, mapSelectionState.isSelecting, setMapSelectionState]);

  const confirmMapSelection = useCallback(async () => {
    // CRITICAL: Guard against double-confirmation crashes
    if (isConfirmingRef.current) {
      if (__DEV__) {
        console.log("⚠️ Confirmation already in progress, ignoring duplicate");
      }
      return;
    }
    
    if (!mapSelectionState.selectedLocation) {
      if (__DEV__) {
        console.log("❌ No location selected");
      }
      return;
    }

    // Set confirmation flag
    isConfirmingRef.current = true;
    
    const selectedLocation = mapSelectionState.selectedLocation;
    if (__DEV__) {
      console.log("✅ Confirming map selection:", selectedLocation);
    }
    
    try {
      // Set as destination
      setDestination(selectedLocation);
      
      // Close map selection mode
      updateUiState({ 
        isMapSelectionMode: false, 
        showSearchModal: false 
      });
      
      // Reset selection state
      setMapSelectionState(prev => ({ ...prev, isSelecting: false, selectedLocation: null }));
      
      // Ensure we have current location for route calculation
      if (!currentLocation) {
        if (__DEV__) {
          console.log("📍 Getting current location for route calculation...");
        }
        try {
          const loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
            maximumAge: 30000, // 30 seconds
          });
          const newLocation = {
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          };
          setCurrentLocation(newLocation);
        } catch (locationError) {
          console.error("❌ Failed to get current location:", locationError);
          // Continue without current location - it will be fetched later if needed
        }
      }
      
      // Don't automatically update flow state here
      // Flow state should only be updated when explicitly in destination flow
      // (when route button is pressed and destination is selected)
      // The confirmMapSelectionWithFlowUpdate wrapper will handle flow state update if needed
      
      if (__DEV__) {
        console.log("✅ Map selection confirmed successfully");
      }
    } catch (error) {
      console.error("❌ Error confirming map selection:", error);
    } finally {
      // Reset confirmation flag after a delay
      setTimeout(() => {
        isConfirmingRef.current = false;
      }, 1000); // 1 second debounce
    }
  }, [
    mapSelectionState.selectedLocation, 
    setDestination, 
    updateUiState, 
    currentLocation, 
    setCurrentLocation, 
    setMapSelectionState
  ]);

  return {
    startMapSelection,
    cancelMapSelection,
    handleMapPress,
    confirmMapSelection,
  };
};
