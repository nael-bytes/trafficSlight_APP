import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  SafeAreaView,
  Modal,
  Pressable,
  StyleSheet,
  Platform,
  Alert,
  TextInput,
} from "react-native";
import MaterialIcons from "react-native-vector-icons/MaterialIcons";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GooglePlacesAutocomplete } from "react-native-google-places-autocomplete";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE, UrlTile } from "react-native-maps";
import * as Location from "expo-location";
import * as FileSystem from "expo-file-system";
import polyline from "@mapbox/polyline";
import { GOOGLE_MAPS_API_KEY, LOCALHOST_IP } from "@env";
import { useUser } from "../../AuthContext/UserContextImproved";
import Toast from 'react-native-toast-message';
import { LinearGradient } from 'expo-linear-gradient';
import type { Motor } from '../loggedIn/types';

// Types
type LocationCoords = {
  latitude: number;
  longitude: number;
  address?: string;
};

type TripSummary = {
  userId: string;
  motorId: string;
  distance: number;         // in kilometers
  fuelUsed: number;         // in liters
  timeArrived: string;      // in minutes since trip start (or epoch)
  eta: string;              // estimated time in minutes
  destination: string;
  startAddress?: string;
};

type MaintenanceAction = {
  type: 'oil_change' | 'refuel' | 'tune_up';
  timestamp: number;
  location: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  details: {
    cost: number;
    quantity?: number;
    notes?: string;
  };
};

type MaintenanceFormData = {
  type: MaintenanceAction['type'];
  cost: string;
  quantity: string;
  notes: string;
};

const MapScreenTry = () => {
  const { user } = useUser();
  const [selectedMotor, setSelectedMotor] = useState<Motor | null>(null);
  const [currentLocation, setCurrentLocation] = useState<LocationCoords | null>(null);
  const [maintenanceFormVisible, setMaintenanceFormVisible] = useState(false);
  const [tripSummaryModalVisible, setTripSummaryModalVisible] = useState(false);
  const [maintenanceFormData, setMaintenanceFormData] = useState<MaintenanceFormData>({
    type: 'refuel',
    cost: '',
    quantity: '',
    notes: ''
  });
  const [maintenanceActions, setMaintenanceActions] = useState<(MaintenanceAction & { _id: string })[]>([]);

  // Helper function for reverse geocoding
  const reverseGeocodeLocation = async (lat: number, lng: number): Promise<string> => {
    try {
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_MAPS_API_KEY}`
      );
      const data = await res.json();
      return data.results[0]?.formatted_address || "Unknown";
    } catch (err) {
      console.error("Reverse geocoding failed", err);
      return "Unknown";
    }
  };

  // Helper function to save maintenance record
  const saveMaintenanceRecord = async (actionType: MaintenanceAction['type'], formData: MaintenanceFormData) => {
    try {
      if (!user?._id || !selectedMotor?._id || !currentLocation) {
        throw new Error('Missing required data (user, motor, or location)');
      }

      // Parse numeric values
      const cost = parseFloat(formData.cost);
      const quantity = formData.quantity ? parseFloat(formData.quantity) : undefined;

      if (isNaN(cost) || cost <= 0) {
        throw new Error('Please enter a valid cost');
      }

      if (actionType === 'refuel' && (!quantity || isNaN(quantity) || quantity <= 0)) {
        throw new Error('Please enter a valid quantity for refueling');
      }

      // Get address for the location
      let address;
      try {
        address = await reverseGeocodeLocation(currentLocation.latitude, currentLocation.longitude);
      } catch (err) {
        console.warn('Failed to get address:', err);
        address = 'Unknown location';
      }

      // Create the maintenance action with proper structure
      const newAction: MaintenanceAction = {
        type: actionType,
        timestamp: Date.now(),
        location: {
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
          address: address
        },
        details: {
          cost: cost,
          quantity: quantity,
          notes: formData.notes || ''
        }
      };

      console.log('Sending maintenance record:', JSON.stringify(newAction, null, 2));

      // Save maintenance record
      const maintenanceResponse = await fetch(`${LOCALHOST_IP}/api/maintenance-records`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: user._id,
          motorId: selectedMotor._id,
          ...newAction
        })
      });

      const responseData = await maintenanceResponse.json();

      if (!maintenanceResponse.ok) {
        console.error('Server error response:', responseData);
        throw new Error(responseData.message || 'Failed to save maintenance record');
      }

      console.log('✅ Maintenance record saved:', responseData);

      // Update local state
      setMaintenanceActions(prev => [...prev, { ...newAction, _id: responseData._id }]);

      // Show success toast
      Toast.show({
        type: 'success',
        text1: 'Maintenance Recorded',
        text2: `${actionType.replace('_', ' ')} has been recorded successfully`,
        position: 'top',
        visibilityTime: 3000,
      });

      // Close the form modal
      setMaintenanceFormVisible(false);

    } catch (error) {
      console.error('Error in saveMaintenanceRecord:', error);
      Alert.alert(
        'Error',
        error.message || 'Failed to save maintenance record. Please try again.'
      );
    }
  };

  // Add maintenance action handler
  const handleMaintenanceAction = useCallback((actionType: MaintenanceAction['type']) => {
    if (!currentLocation || !selectedMotor) {
      Alert.alert('Error', 'Please ensure location services are enabled and a motor is selected');
      return;
    }

    setMaintenanceFormData({
      type: actionType,
      cost: '',
      quantity: '',
      notes: ''
    });
    setMaintenanceFormVisible(true);
  }, [currentLocation, selectedMotor]);

  // Handle form changes
  const handleMaintenanceFormChange = useCallback((field: string, value: string) => {
    setMaintenanceFormData(prev => ({
      ...prev,
      [field]: value
    }));
  }, []);

  // Handle form save
  const handleMaintenanceFormSave = useCallback(() => {
    if (!maintenanceFormData.type) {
      Alert.alert('Error', 'Please select a maintenance type');
      return;
    }

    if (!maintenanceFormData.cost || isNaN(parseFloat(maintenanceFormData.cost))) {
      Alert.alert('Error', 'Please enter a valid cost');
      return;
    }

    if (maintenanceFormData.type === 'refuel' && (!maintenanceFormData.quantity || isNaN(parseFloat(maintenanceFormData.quantity)))) {
      Alert.alert('Error', 'Please enter a valid quantity for refueling');
      return;
    }

    saveMaintenanceRecord(maintenanceFormData.type, maintenanceFormData);
  }, [maintenanceFormData]);

  // 💾 Save trip summary to backend
  const saveTripSummaryToBackend = async (
    summary: TripSummary,
    arrived: boolean,
    extras: {
      startAddress?: string;
      estimatedFuel: { min: number; max: number; avg: number };
      actualFuel: { min: number; max: number; avg: number };
      actualDistance: number;
      pathCoords: LocationCoords[];
      plannedCoords: LocationCoords[];
      wasRerouted: boolean;
      durationInMinutes: number;
    }
  ) => {
    try {
      if (!user?._id || !selectedMotor?._id) {
        throw new Error('Missing user or motor data');
      }

      // Save the trip summary
      const tripData = {
        userId: user._id,
        motorId: selectedMotor._id,
        startAddress: extras.startAddress || 'Unknown',
        destination: summary.destination,
        distance: summary.distance,
        duration: extras.durationInMinutes,
        fuelUsed: summary.fuelUsed,
        fuelUsedMin: extras.estimatedFuel.min,
        fuelUsedMax: extras.estimatedFuel.max,
        actualFuelUsedMin: extras.actualFuel.min,
        actualFuelUsedMax: extras.actualFuel.max,
        actualDistance: extras.actualDistance,
        wasRerouted: extras.wasRerouted,
        isSuccessful: arrived,
        status: arrived ? "completed" : "cancelled",
        timeArrived: summary.timeArrived,
        eta: summary.eta,
        path: extras.pathCoords,
        plannedPath: extras.plannedCoords,
        trafficCondition: "moderate",
        kmph: 0,
        rerouteCount: 0,
        wasInBackground: false,
        showAnalyticsModal: false
      };

      console.log('Saving trip data:', JSON.stringify(tripData, null, 2));

      const tripResponse = await fetch(`${LOCALHOST_IP}/api/trips`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(tripData)
      });

      const responseData = await tripResponse.json();

      if (!tripResponse.ok) {
        console.error('Server error response:', responseData);
        throw new Error(responseData.message || 'Failed to save trip summary');
      }

      console.log('✅ Trip saved successfully:', responseData);

      // Show success toast
      Toast.show({
        type: 'success',
        text1: 'Trip Saved',
        text2: 'Your trip has been recorded successfully',
        position: 'top',
        visibilityTime: 3000,
      });

      // Set trip summary modal visible
      setTripSummaryModalVisible(true);

    } catch (error) {
      console.error('🔥 Error saving trip data:', error);
      Alert.alert(
        "Error",
        error.message || "Failed to save trip data. Please try again.",
        [{ text: "OK" }]
      );
      throw error;
    }
  };

  return (
    <SafeAreaProvider>
      <View style={{ flex: 1 }}>
        {/* Component content will go here */}
      </View>
    </SafeAreaProvider>
  );
};

export default MapScreenTry;