import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  ScrollView,
  Keyboard,
  ActivityIndicator,
  TouchableWithoutFeedback,
  StyleSheet,
  Platform,
  StatusBar,
  Modal,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as Location from 'expo-location';
import { useUser } from "../../AuthContext/UserContextImproved";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Toast from 'react-native-toast-message';
import { updateFuelLevel, apiRequest } from "../../utils/api";
import { calculateFuelLevelAfterRefuel } from "../../utils/fuelCalculations";
import type { Motor, LocationCoords } from "../../types";

const { width, height } = Dimensions.get('window');

export default function AddMaintenanceScreen() {
  const navigation = useNavigation();
  const { user } = useUser();

  // Enhanced state management
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [motors, setMotors] = useState<Motor[]>([]);
  const [selectedMotor, setSelectedMotor] = useState<Motor | null>(null);
  const [showMotorModal, setShowMotorModal] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<LocationCoords | null>(null);
  const [locationPermissionGranted, setLocationPermissionGranted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState({
    type: '' as 'refuel' | 'oil_change' | 'tune_up' | '',
    cost: "",
    quantity: "",
    costPerLiter: "",
    notes: "",
    timestamp: new Date(),
  });

  // Enhanced data fetching with caching (similar to RouteSelectionScreen)
  const fetchUserMotors = useCallback(async () => {
    if (!user?._id) return;
    
    try {
      // Try to load from cache first
      const cachedMotors = await AsyncStorage.getItem(`cachedMotors_${user._id}`);
      if (cachedMotors) {
        const parsedMotors = JSON.parse(cachedMotors);
        setMotors(parsedMotors);
        if (__DEV__) {
        console.log('[AddMaintenance] Loaded cached motors:', parsedMotors.length);
      }
      }

      // Fetch fresh data from API using apiRequest
      try {
        const data = await apiRequest(`/api/user-motors/user/${user._id}`);
        const motorsList = Array.isArray(data) ? data : (data?.motors || data?.data || []);
        setMotors(motorsList);
        
        // Cache the fresh data
        await AsyncStorage.setItem(`cachedMotors_${user._id}`, JSON.stringify(motorsList));
        if (__DEV__) {
          console.log('[AddMaintenance] Fetched and cached motors:', motorsList.length);
        }
      } catch (error) {
        if (__DEV__) {
          console.warn('[AddMaintenance] Failed to fetch motors from API:', error);
        }
      }
    } catch (error) {
      console.error('[AddMaintenance] Error fetching motors:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to load motors. Using cached data.',
      });
    }
  }, [user?._id, user?.token]);

  // Get current location
  const getCurrentLocation = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationPermissionGranted(false);
        Toast.show({
          type: 'error',
          text1: 'Location Permission Required',
          text2: 'Please enable location access for accurate maintenance records',
        });
        return;
      }

      setLocationPermissionGranted(true);
      const location = await Location.getCurrentPositionAsync({});
      
      const coords = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
      
      setCurrentLocation(coords);
      console.log('[AddMaintenance] Current location obtained:', coords);
    } catch (error) {
      console.error('[AddMaintenance] Error getting location:', error);
      Toast.show({
        type: 'error',
        text1: 'Location Error',
        text2: 'Failed to get current location',
      });
    }
  }, []);

  // Fuel level validation function (from RouteSelectionScreen)
  const validateFuelLevel = useCallback((fuelLevel: number, motorId: string): boolean => {
    if (fuelLevel < 0 || fuelLevel > 100) {
      console.error('[AddMaintenance] ❌ Invalid fuel level:', {
        fuelLevel,
        motorId,
        message: 'Fuel level must be between 0 and 100'
      });
      return false;
    }
    
    if (isNaN(fuelLevel)) {
      console.error('[AddMaintenance] ❌ Invalid fuel level:', {
        fuelLevel,
        motorId,
        message: 'Fuel level must be a number'
      });
      return false;
    }
    
    return true;
  }, []);

  // Initialize data on mount
  useEffect(() => {
    if (user?._id) {
      fetchUserMotors();
      getCurrentLocation();
    }
  }, [user?._id, fetchUserMotors, getCurrentLocation]);

  // Enhanced form handling with validation
  const handleFormChange = useCallback((field: string, value: string | Date) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  }, [errors]);

  // Form validation
  const validateForm = useCallback(() => {
    const newErrors: Record<string, string> = {};

    if (!selectedMotor) {
      newErrors.motor = 'Please select a motor';
    }

    if (!formData.type) {
      newErrors.type = 'Please select a maintenance type';
    }

    if (!formData.cost || parseFloat(formData.cost) <= 0) {
      newErrors.cost = 'Cost must be a positive number';
    }

    if (formData.type === 'refuel') {
      if (!formData.costPerLiter || parseFloat(formData.costPerLiter) <= 0) {
        newErrors.costPerLiter = 'Cost per liter must be a positive number';
      }
    } else if (formData.type === 'oil_change') {
      if (!formData.quantity || parseFloat(formData.quantity) <= 0) {
        newErrors.quantity = 'Quantity must be a positive number';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [selectedMotor, formData]);

  // Enhanced submit function with fuel level updates (matching RouteSelectionScreen)
  const handleSubmit = useCallback(async () => {
    if (!validateForm()) {
      Toast.show({
        type: 'error',
        text1: 'Validation Error',
        text2: 'Please fill all required fields correctly',
      });
      return;
    }

    if (!user?._id || !selectedMotor?._id) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Missing user or motor data',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const cost = parseFloat(formData.cost);
      const costPerLiter = parseFloat(formData.costPerLiter);
      let quantity = formData.quantity ? parseFloat(formData.quantity) : undefined;

      // Calculate quantity from cost and cost per liter for refuel actions
      if (formData.type === 'refuel' && cost > 0 && costPerLiter > 0) {
        quantity = cost / costPerLiter;
        console.log('[AddMaintenance] Calculated quantity from cost and cost per liter:', {
          cost,
          costPerLiter,
          calculatedQuantity: quantity
        });
      }

      const maintenanceData = {
        userId: user._id,
        motorId: selectedMotor._id,
        type: formData.type,
        timestamp: formData.timestamp.getTime(),
        location: currentLocation ? {
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
        } : {
          latitude: 0,
          longitude: 0,
        },
        details: {
          cost,
          quantity,
          costPerLiter: formData.type === 'refuel' ? costPerLiter : undefined,
          notes: formData.notes,
        }
      };

      if (__DEV__) {
      console.log('[AddMaintenance] Submitting maintenance record:', maintenanceData);
      }

      // Use apiRequest for consistency and automatic authentication with retry
      let savedRecord;
      let retries = 0;
      const maxRetries = 3;
      
      while (retries < maxRetries) {
        try {
          savedRecord = await apiRequest('/api/maintenance-records', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(maintenanceData),
      });
          break; // Success, exit retry loop
        } catch (error: any) {
          retries++;
          
          // Only retry on network errors or 5xx errors
          const isRetryable = 
            error?.message?.includes('Network') ||
            error?.message?.includes('timeout') ||
            error?.message?.includes('ECONNREFUSED') ||
            error?.message?.includes('ETIMEDOUT');
          
          if (!isRetryable || retries >= maxRetries) {
            throw error; // Not retryable or max retries reached
          }
          
          // Exponential backoff: 1s, 2s, 4s
          const delay = 1000 * Math.pow(2, retries - 1);
          if (__DEV__) {
            console.log(`[AddMaintenance] Retrying save after ${delay}ms (attempt ${retries}/${maxRetries})`);
          }
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
      
      if (__DEV__) {
      console.log('[AddMaintenance] ✅ Maintenance record saved:', savedRecord);
      }

      // If it's a refuel, update the motor's fuel level using local calculation
      if (formData.type === 'refuel' && quantity && quantity > 0) {
        const motorData = {
          fuelConsumption: selectedMotor.fuelConsumption || selectedMotor.fuelEfficiency || 0,
          fuelTank: selectedMotor.fuelTank || 15, // Default tank size if not provided
          currentFuelLevel: selectedMotor.currentFuelLevel || 0
        };
        
        if (motorData.fuelConsumption > 0 && motorData.fuelTank > 0) {
          const newFuelLevel = calculateFuelLevelAfterRefuel(motorData, quantity);
          
          // Validate fuel level before processing
          if (!validateFuelLevel(newFuelLevel, selectedMotor._id)) {
            throw new Error(`Invalid fuel level after refuel: ${newFuelLevel}. Must be between 0 and 100.`);
          }
          
          console.log('[AddMaintenance] Refuel calculation:', {
            currentFuelLevel: motorData.currentFuelLevel,
            refuelAmount: quantity,
            newFuelLevel,
            costPerLiter,
            fuelTank: motorData.fuelTank
          });
          
          // Update fuel level to backend with comprehensive logging
          await updateFuelLevel(selectedMotor._id, newFuelLevel);
          
          console.log('[AddMaintenance] ✅ Refuel fuel level updated to backend:', {
            motorId: selectedMotor._id,
            refuelAmount: quantity,
            costPerLiter,
            oldFuelLevel: motorData.currentFuelLevel,
            newFuelLevel,
            fuelTank: motorData.fuelTank
          });
          
          // Update local motors list with new fuel level
          setMotors(prev => prev.map(motor => 
            motor._id === selectedMotor._id 
              ? { ...motor, currentFuelLevel: newFuelLevel }
              : motor
          ));
          
          console.log('[AddMaintenance] ✅ Updated local motors list with new fuel level');
        } else {
          console.warn('[AddMaintenance] Cannot calculate refuel - missing motor data:', {
            fuelConsumption: motorData.fuelConsumption,
            fuelTank: motorData.fuelTank,
            currentFuelLevel: motorData.currentFuelLevel
          });
        }
      }

      Toast.show({
        type: 'success',
        text1: 'Maintenance Recorded',
        text2: `${formData.type.replace('_', ' ')} recorded successfully`,
        position: 'top',
        visibilityTime: 3000
      });

      // Reset form
      setFormData({
        type: '',
        cost: "",
        quantity: "",
        costPerLiter: "",
        notes: "",
        timestamp: new Date(),
      });
      setSelectedMotor(null);
      setErrors({});

      // Navigate back after a short delay
      setTimeout(() => {
        navigation.goBack();
      }, 1500);

    } catch (error: any) {
      console.error('[AddMaintenance] Error saving maintenance record:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error.message || 'Failed to save maintenance record',
        position: 'top',
        visibilityTime: 4000
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [validateForm, user, selectedMotor, formData, currentLocation, validateFuelLevel]);

  // Enhanced maintenance type selection with icons
  const renderMaintenanceType = () => (
    <View style={styles.inputContainer}>
      <Text style={styles.label}>Maintenance Type *</Text>
      <View style={styles.typeButtons}>
        {[
          { key: 'refuel', label: 'Refuel', icon: 'water' },
          { key: 'oil_change', label: 'Oil Change', icon: 'color-fill' },
          { key: 'tune_up', label: 'Tune Up', icon: 'build' },
        ].map((type) => (
          <TouchableOpacity
            key={type.key}
            style={[
              styles.typeButton,
              formData.type === type.key && styles.typeButtonSelected
            ]}
            onPress={() => handleFormChange('type', type.key)}
          >
            <Ionicons 
              name={type.icon as any} 
              size={20} 
              color={formData.type === type.key ? '#fff' : '#00ADB5'} 
            />
            <Text style={[
              styles.typeButtonText,
              formData.type === type.key && styles.typeButtonTextSelected
            ]}>
              {type.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {errors.type && <Text style={styles.errorText}>{errors.type}</Text>}
    </View>
  );

  // Enhanced motor selection with better display
  const renderMotorSelection = () => (
    <View style={styles.inputContainer}>
      <Text style={styles.label}>Select Motor *</Text>
      <TouchableOpacity
        style={[styles.motorSelector, errors.motor && styles.inputError]}
        onPress={() => setShowMotorModal(true)}
      >
        <View style={styles.motorSelectorContent}>
          {selectedMotor ? (
            <View>
              <Text style={styles.motorSelectorText}>{selectedMotor.nickname}</Text>
              <Text style={styles.motorSelectorSubtext}>
                {selectedMotor.fuelEfficiency || selectedMotor.fuelConsumption || 'N/A'} km/L • {selectedMotor.currentFuelLevel?.toFixed(0) || '0'}% fuel
              </Text>
            </View>
          ) : (
            <Text style={[styles.motorSelectorText, styles.placeholderText]}>
              Tap to select a motor
            </Text>
          )}
        </View>
        <Ionicons name="chevron-down" size={20} color="#666" />
      </TouchableOpacity>
      {errors.motor && <Text style={styles.errorText}>{errors.motor}</Text>}
    </View>
  );

  // Enhanced calculated quantity display
  const renderCalculatedQuantity = () => {
    if (formData.type === 'refuel' && formData.cost && formData.costPerLiter) {
      const cost = parseFloat(formData.cost);
      const costPerLiter = parseFloat(formData.costPerLiter);
      const calculatedQuantity = cost / costPerLiter;
      
      return (
        <View style={styles.calculatedContainer}>
          <Text style={styles.calculatedLabel}>Calculated Quantity:</Text>
          <Text style={styles.calculatedValue}>
            {calculatedQuantity.toFixed(2)}L
          </Text>
          <Text style={styles.calculatedSubtext}>
            {formData.cost} ÷ {formData.costPerLiter} = {calculatedQuantity.toFixed(2)}L
          </Text>
        </View>
      );
    }
    return null;
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F2EEEE" />
      
      <LinearGradient colors={["#00ADB5", "#00C2CC"]} style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Maintenance</Text>
        <View style={styles.placeholder} />
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View>
            {renderMaintenanceType()}
            {renderMotorSelection()}

            {/* Date and Time */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Date & Time</Text>
              <TouchableOpacity
                style={styles.datePickerButton}
                onPress={() => setShowDatePicker(true)}
              >
                <Text style={styles.datePickerText}>
                  {formData.timestamp.toLocaleString()}
                </Text>
                <Ionicons name="calendar" size={20} color="#666" />
              </TouchableOpacity>
            </View>

            {/* Cost */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Total Cost (₱) *</Text>
              <TextInput
                style={[styles.input, errors.cost && styles.inputError]}
                value={formData.cost}
                onChangeText={(text) => handleFormChange('cost', text)}
                placeholder="Enter total cost"
                keyboardType="numeric"
              />
              {errors.cost && <Text style={styles.errorText}>{errors.cost}</Text>}
            </View>

            {/* Refuel-specific fields */}
            {formData.type === 'refuel' && (
              <>
                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Cost per Liter (₱) *</Text>
                  <TextInput
                    style={[styles.input, errors.costPerLiter && styles.inputError]}
                    value={formData.costPerLiter}
                    onChangeText={(text) => handleFormChange('costPerLiter', text)}
                    placeholder="Enter cost per liter"
                    keyboardType="numeric"
                  />
                  {errors.costPerLiter && <Text style={styles.errorText}>{errors.costPerLiter}</Text>}
                </View>

                {renderCalculatedQuantity()}
              </>
            )}

            {/* Oil Change specific fields */}
            {formData.type === 'oil_change' && (
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Oil Quantity (L) *</Text>
                <TextInput
                  style={[styles.input, errors.quantity && styles.inputError]}
                  value={formData.quantity}
                  onChangeText={(text) => handleFormChange('quantity', text)}
                  placeholder="Enter oil quantity in liters"
                  keyboardType="numeric"
                />
                {errors.quantity && <Text style={styles.errorText}>{errors.quantity}</Text>}
              </View>
            )}

            {/* Notes */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Notes</Text>
              <TextInput
                style={[styles.input, styles.notesInput]}
                value={formData.notes}
                onChangeText={(text) => handleFormChange('notes', text)}
                placeholder={`Add notes about the ${formData.type.replace('_', ' ')} (optional)`}
                multiline
                numberOfLines={3}
              />
            </View>

            {/* Location Status */}
            <View style={styles.locationStatus}>
              <Ionicons 
                name={locationPermissionGranted ? "location" : "location-outline"} 
                size={16} 
                color={locationPermissionGranted ? "#4CAF50" : "#FF9800"} 
              />
              <Text style={styles.locationStatusText}>
                {locationPermissionGranted 
                  ? "Location will be recorded with maintenance" 
                  : "Location permission required for accurate records"
                }
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={isSubmitting}
            >
              <LinearGradient colors={["#00ADB5", "#00C2CC"]} style={styles.submitGradient}>
                {isSubmitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.submitButtonText}>Save Maintenance Record</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </TouchableWithoutFeedback>
      </ScrollView>

      {/* Motor Selection Modal */}
      <Modal visible={showMotorModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Motor</Text>
              <TouchableOpacity onPress={() => setShowMotorModal(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.motorList}>
              {motors.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="bicycle" size={48} color="#ccc" />
                  <Text style={styles.emptyStateText}>No motors available</Text>
                  <Text style={styles.emptyStateSubtext}>Add a motor first to record maintenance</Text>
                </View>
              ) : (
                motors.map((motor) => (
                  <TouchableOpacity
                    key={motor._id}
                    style={styles.motorItem}
                    onPress={() => {
                      setSelectedMotor(motor);
                      setShowMotorModal(false);
                    }}
                  >
                    <View style={styles.motorItemContent}>
                      <Text style={styles.motorItemText}>{motor.nickname}</Text>
                      <Text style={styles.motorItemSubtext}>
                        {motor.fuelEfficiency || motor.fuelConsumption || 'N/A'} km/L • {motor.currentFuelLevel?.toFixed(0) || 0}% fuel
                      </Text>
                      {motor.fuelTank && (
                        <Text style={styles.motorItemTank}>
                          Tank: {motor.fuelTank}L
                        </Text>
                      )}
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#ccc" />
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Date Picker */}
      {showDatePicker && (
        <DateTimePicker
          value={formData.timestamp}
          mode="datetime"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={(event, selectedDate) => {
            const currentDate = selectedDate || formData.timestamp;
            setShowDatePicker(Platform.OS === "ios");
            handleFormChange("timestamp", currentDate);
          }}
        />
      )}

      <Toast />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2EEEE',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: Platform.OS === 'ios' ? 44 : 12,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  typeButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  typeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    marginHorizontal: 4,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#00ADB5',
    backgroundColor: '#fff',
  },
  typeButtonSelected: {
    backgroundColor: '#00ADB5',
  },
  typeButtonText: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: '500',
    color: '#00ADB5',
  },
  typeButtonTextSelected: {
    color: '#fff',
  },
  motorSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  motorSelectorContent: {
    flex: 1,
  },
  motorSelectorText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  motorSelectorSubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  placeholderText: {
    color: '#999',
  },
  inputError: {
    borderColor: '#FF5722',
    borderWidth: 2,
  },
  errorText: {
    color: '#FF5722',
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },
  datePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  datePickerText: {
    fontSize: 16,
    color: '#333',
  },
  locationStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    marginBottom: 20,
  },
  locationStatusText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
    flex: 1,
  },
  input: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    fontSize: 16,
  },
  notesInput: {
    height: 80,
    textAlignVertical: 'top',
  },
  calculatedContainer: {
    backgroundColor: '#E3F2FD',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2196F3',
    marginBottom: 20,
  },
  calculatedLabel: {
    fontSize: 14,
    color: '#1976D2',
    fontWeight: '500',
  },
  calculatedValue: {
    fontSize: 18,
    color: '#2196F3',
    fontWeight: 'bold',
    marginTop: 4,
  },
  calculatedSubtext: {
    fontSize: 12,
    color: '#1976D2',
    marginTop: 4,
    fontStyle: 'italic',
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#666',
    marginTop: 12,
    fontWeight: '500',
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 4,
    textAlign: 'center',
  },
  motorItemContent: {
    flex: 1,
  },
  motorItemTank: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  submitButton: {
    marginTop: 20,
    borderRadius: 8,
    overflow: 'hidden',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  motorList: {
    maxHeight: 300,
  },
  motorItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  motorItemText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  motorItemSubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
});
