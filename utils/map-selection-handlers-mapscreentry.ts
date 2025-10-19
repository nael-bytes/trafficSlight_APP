import { useCallback } from 'react';
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

// Reverse geocoding function
export const reverseGeocodeLocation = async (lat: number, lng: number): Promise<string> => {
  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${process.env.GOOGLE_MAPS_API_KEY}`
    );
    const data = await res.json();
    return data.results[0]?.formatted_address || "Unknown";
  } catch (err) {
    console.error("Reverse geocoding failed", err);
    return "Unknown";
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
  flowStateManager: (state: string) => void
): MapSelectionHandlers => {
  
  const startMapSelection = useCallback(() => {
    console.log("🚀 Starting map selection mode");
    updateUiState({ isMapSelectionMode: true });
    setMapSelectionState(prev => ({ ...prev, isSelecting: true, selectedLocation: null }));
    console.log("✅ Map selection mode activated");
  }, [updateUiState, setMapSelectionState]);

  const cancelMapSelection = useCallback(() => {
    console.log("❌ Cancelling map selection");
    updateUiState({ isMapSelectionMode: false });
    setMapSelectionState(prev => ({ ...prev, isSelecting: false, selectedLocation: null }));
  }, [updateUiState, setMapSelectionState]);

  const handleMapPress = useCallback(async (event: any) => {
    console.log("🗺️ Map pressed, isMapSelectionMode:", uiState.isMapSelectionMode);
    if (!uiState.isMapSelectionMode) return;

    const { latitude, longitude } = event.nativeEvent.coordinate;
    const newLocation = { latitude, longitude };
    console.log("📍 Selected coordinates:", latitude, longitude);
    
    setMapSelectionState(prev => ({ ...prev, selectedLocation: newLocation }));
    
    // Reverse geocode the selected location
    try {
      console.log("🔄 Reverse geocoding location...");
      const address = await reverseGeocodeLocation(latitude, longitude);
      const locationWithAddress = { ...newLocation, address };
      setMapSelectionState(prev => ({ ...prev, selectedLocation: locationWithAddress }));
      console.log("✅ Address found:", address);
    } catch (error) {
      console.error('❌ Reverse geocoding failed:', error);
      // Keep the location without address
    }
  }, [uiState.isMapSelectionMode, setMapSelectionState]);

  const confirmMapSelection = useCallback(async () => {
    if (!mapSelectionState.selectedLocation) return;

    const selectedLocation = mapSelectionState.selectedLocation;
    console.log("✅ Confirming map selection:", selectedLocation);
    
    // Set as destination and trigger route fetching
    setDestination(selectedLocation);
    updateUiState({ isMapSelectionMode: false, showSearchModal: false });
    setMapSelectionState(prev => ({ ...prev, isSelecting: false, selectedLocation: null }));
    
    // Trigger route fetching
    if (!currentLocation) {
      const loc = await Location.getCurrentPositionAsync({});
      const newLocation = {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      };
      setCurrentLocation(newLocation);
    }
    
    // Fetch routes will be triggered by the destination change
    flowStateManager('destination_selected');
  }, [mapSelectionState.selectedLocation, setDestination, updateUiState, currentLocation, setCurrentLocation, flowStateManager, setMapSelectionState]);

  return {
    startMapSelection,
    cancelMapSelection,
    handleMapPress,
    confirmMapSelection,
  };
};
