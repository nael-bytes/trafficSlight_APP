import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform,
  Modal,
  TextInput,
} from 'react-native';
import MaterialIcons from "react-native-vector-icons/MaterialIcons";
import { LinearGradient } from 'expo-linear-gradient';
import Toast from 'react-native-toast-message';
import { LOCALHOST_IP } from '@env';
import { updateFuelLevel } from '../utils/api';
import { calculateFuelLevelAfterRefuel } from '../utils/fuelCalculations';

interface NavigationControlsProps {
  isNavigating: boolean;
  currentSpeed: number;
  distanceRemaining: number;
  timeElapsed: number;
  currentEta: string | null;
  isOverSpeedLimit: boolean;
  currentFuelLevel?: number;
  selectedMotor?: any;
  currentLocation?: any;
  user?: any;
  onEndNavigation: () => void;
  onShowDetails: () => void;
  onMaintenanceAction?: (type: 'refuel' | 'oil_change' | 'tune_up') => void;
  onReroute?: () => void;
  isRerouting?: boolean;
  onFuelLevelUpdate?: (newFuelLevel: number) => void;
}

export const NavigationControls: React.FC<NavigationControlsProps> = ({
  isNavigating,
  currentSpeed,
  distanceRemaining,
  timeElapsed,
  currentEta,
  isOverSpeedLimit,
  currentFuelLevel = 0,
  selectedMotor,
  currentLocation,
  user,
  onEndNavigation,
  onShowDetails,
  onMaintenanceAction,
  onReroute,
  isRerouting = false,
  onFuelLevelUpdate,
}) => {
  // Maintenance form state
  const [maintenanceFormVisible, setMaintenanceFormVisible] = useState(false);
  const [maintenanceFormData, setMaintenanceFormData] = useState({
    type: '' as 'refuel' | 'oil_change' | 'tune_up' | '',
    cost: '',
    quantity: '',
    costPerLiter: '',
    notes: ''
  });

  // All hooks must be called before any early returns
  const handleMaintenanceFormChange = useCallback((field: keyof typeof maintenanceFormData, value: string) => {
    setMaintenanceFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  // Handle maintenance action - opens form modal
  const handleMaintenanceActionInternal = useCallback((actionType: 'refuel' | 'oil_change' | 'tune_up') => {
    if (!currentLocation || !selectedMotor) {
      Alert.alert('Error', 'Location or motor data not available');
      return;
    }

    // Set form data and show modal
    setMaintenanceFormData({ 
      type: actionType, 
      cost: '', 
      quantity: '', 
      costPerLiter: '',
      notes: '' 
    });
    setMaintenanceFormVisible(true);
  }, [currentLocation, selectedMotor]);

  // Save maintenance record
  const saveMaintenanceRecord = useCallback(async (
    actionType: 'refuel' | 'oil_change' | 'tune_up',
    formData: typeof maintenanceFormData
  ) => {
    try {
      if (!user?._id || !selectedMotor?._id) throw new Error('Missing user or motor data');
      
      const cost = parseFloat(formData.cost) || 0;
      const costPerLiter = parseFloat(formData.costPerLiter) || 0;
      let quantity = formData.quantity ? parseFloat(formData.quantity) : undefined;

      // Calculate quantity from cost and cost per liter for refuel actions
      if (actionType === 'refuel' && cost > 0 && costPerLiter > 0) {
        quantity = cost / costPerLiter;
        console.log('[NavigationControls] Calculated quantity from cost and cost per liter:', {
          cost,
          costPerLiter,
          calculatedQuantity: quantity
        });
      }

      const newAction = {
        type: actionType,
        timestamp: Date.now(),
        location: currentLocation
          ? { latitude: currentLocation.latitude, longitude: currentLocation.longitude }
          : { latitude: 0, longitude: 0 },
        details: { 
          cost, 
          quantity, 
          costPerLiter: actionType === 'refuel' ? costPerLiter : undefined,
          notes: formData.notes 
        }
      };

      // Save to backend
      const response = await fetch(`${LOCALHOST_IP}/api/maintenance-records`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user._id,
          motorId: selectedMotor._id,
          type: actionType,
          timestamp: newAction.timestamp,
          location: {
            lat: newAction.location.latitude, // Use lat/lng format per API docs
            lng: newAction.location.longitude,
            latitude: newAction.location.latitude, // Also include latitude/longitude as alternative format
            longitude: newAction.location.longitude,
          },
          details: newAction.details
        })
      });

      if (!response.ok) throw new Error('Failed to save maintenance record');
      const savedRecord = await response.json();
      console.log('✅ Maintenance record saved:', savedRecord);

      // If it's a refuel, update the motor's fuel level using local calculation
      if (actionType === 'refuel' && quantity && quantity > 0) {
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
          
          console.log('[NavigationControls] Refuel calculation:', {
            currentFuelLevel: motorData.currentFuelLevel,
            refuelAmount: quantity,
            newFuelLevel,
            costPerLiter,
            fuelTank: motorData.fuelTank
          });
          
          // Update fuel level to backend with comprehensive logging
          await updateFuelLevel(selectedMotor._id, newFuelLevel);
          
          console.log('[NavigationControls] ✅ Refuel fuel level updated to backend:', {
            motorId: selectedMotor._id,
            refuelAmount: quantity,
            costPerLiter,
            oldFuelLevel: motorData.currentFuelLevel,
            newFuelLevel,
            fuelTank: motorData.fuelTank
          });
          
          // Notify parent component of fuel level update
          if (onFuelLevelUpdate) {
            onFuelLevelUpdate(newFuelLevel);
          }
          
          console.log('[NavigationControls] ✅ Updated fuel level:', newFuelLevel);
        } else {
          console.warn('[NavigationControls] Cannot calculate refuel - missing motor data:', {
            fuelConsumption: motorData.fuelConsumption,
            fuelTank: motorData.fuelTank,
            currentFuelLevel: motorData.currentFuelLevel
          });
        }
      }
      
      setMaintenanceFormVisible(false);
      setMaintenanceFormData({ 
        type: '', 
        cost: '', 
        quantity: '', 
        costPerLiter: '',
        notes: '' 
      });

      Toast.show({
        type: 'success',
        text1: 'Maintenance Recorded',
        text2: `${actionType.replace('_', ' ')} recorded successfully`,
        position: 'top',
        visibilityTime: 3000
      });
    } catch (error: any) {
      console.error('Error in saveMaintenanceRecord:', error);
      Alert.alert('Error', error.message || 'Failed to save maintenance record');
    }
  }, [user, selectedMotor, currentLocation, onFuelLevelUpdate]);

  // Handle maintenance form save
  const handleMaintenanceFormSave = useCallback(() => {
    if (!maintenanceFormData.type) return;
    saveMaintenanceRecord(maintenanceFormData.type, maintenanceFormData);
  }, [maintenanceFormData, saveMaintenanceRecord]);

  // Early return after all hooks
  if (!isNavigating) return null;

  // Helper functions (not hooks)
  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hrs > 0) {
      return `${hrs} hr ${mins} min`;
    } else if (mins > 0) {
      return `${mins} min ${secs} sec`;
    } else {
      return `${secs} sec`;
    }
  };

  // Fuel level validation function
  const validateFuelLevel = (fuelLevel: number, motorId: string): boolean => {
    if (fuelLevel < 0 || fuelLevel > 100) {
      console.error('[NavigationControls] ❌ Invalid fuel level:', {
        fuelLevel,
        motorId,
        message: 'Fuel level must be between 0 and 100'
      });
      return false;
    }
    
    if (isNaN(fuelLevel)) {
      console.error('[NavigationControls] ❌ Invalid fuel level:', {
        fuelLevel,
        motorId,
        message: 'Fuel level must be a number'
      });
      return false;
    }
    
    return true;
  };

  return (
    <View style={styles.navigationControlsContainer}>
      {/* Quick Stats Row */}
      <View style={styles.navigationStatsBar}>
        <View style={styles.navigationStat}>
          <MaterialIcons name="straighten" size={20} color="#fff" />
          <View>
            <Text style={styles.navigationStatValue}>{(distanceRemaining / 1000).toFixed(1)} km</Text>
            <Text style={styles.navigationStatLabel}>Remaining</Text>
          </View>
        </View>

        <View style={styles.navigationStat}>
          <MaterialIcons name="timer" size={20} color="#fff" />
          <View>
            <Text style={styles.navigationStatValue}>{formatTime(timeElapsed)}</Text>
            <Text style={styles.navigationStatLabel}>Duration</Text>
          </View>
        </View>

        <View style={styles.navigationStat}>
          <MaterialIcons name="local-gas-station" size={20} color="#fff" />
          <View>
            <Text style={styles.navigationStatValue}>{currentFuelLevel.toFixed(0)}%</Text>
            <Text style={styles.navigationStatLabel}>Fuel</Text>
          </View>
        </View>

        <View style={styles.navigationStat}>
          <MaterialIcons name="schedule" size={20} color="#fff" />
          <View>
            <Text style={styles.navigationStatValue}>{currentEta || '--'}</Text>
            <Text style={styles.navigationStatLabel}>ETA</Text>
          </View>
        </View>
      </View>

      {/* Control Buttons */}
      <View style={styles.navigationButtonsContainer}>
        <TouchableOpacity
          onPress={() => {
            Alert.alert(
              'Record Maintenance',
              'What type of maintenance would you like to record?',
              [
                {
                  text: 'Refuel',
                  onPress: () => handleMaintenanceActionInternal('refuel'),
                  style: 'default'
                },
                {
                  text: 'Oil Change',
                  onPress: () => handleMaintenanceActionInternal('oil_change'),
                  style: 'default'
                },
                {
                  text: 'Tune Up',
                  onPress: () => handleMaintenanceActionInternal('tune_up'),
                  style: 'default'
                },
                {
                  text: 'Cancel',
                  style: 'cancel'
                }
              ],
              { cancelable: true }
            );
          }}
          style={styles.navigationControlButton}
        >
          <LinearGradient
            colors={['#00ADB5', '#00858B']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.navigationControlGradient}
          >
            <MaterialIcons name="build" size={24} color="#fff" />
          </LinearGradient>
          <Text style={styles.navigationControlLabel}>Maintenance</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onShowDetails}
          style={styles.navigationControlButton}
        >
          <LinearGradient
            colors={['#3498db', '#2980b9']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.navigationControlGradient}
          >
            <MaterialIcons name="analytics" size={24} color="#fff" />
          </LinearGradient>
          <Text style={styles.navigationControlLabel}>Details</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onEndNavigation}
          style={styles.navigationControlButton}
        >
          <LinearGradient
            colors={['#e74c3c', '#c0392b']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.navigationControlGradient}
          >
            <MaterialIcons name="stop" size={24} color="#fff" />
          </LinearGradient>
          <Text style={styles.navigationControlLabel}>End</Text>
        </TouchableOpacity>
      </View>

      {/* Maintenance Form Modal */}
      <Modal visible={maintenanceFormVisible} transparent animationType="slide" onRequestClose={() => setMaintenanceFormVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.formModal}>
            <Text style={styles.formTitle}>
              {maintenanceFormData.type
                .split('_')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ')}
            </Text>

            {/* Cost */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Total Cost (₱)</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                value={maintenanceFormData.cost}
                onChangeText={text => handleMaintenanceFormChange('cost', text)}
                placeholder="Enter total cost"
              />
            </View>

            {/* Refuel-specific fields */}
            {maintenanceFormData.type === 'refuel' && (
              <>
                {/* Cost per liter */}
                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>Cost per Liter (₱)</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    value={maintenanceFormData.costPerLiter}
                    onChangeText={text => handleMaintenanceFormChange('costPerLiter', text)}
                    placeholder="Enter cost per liter"
                  />
                </View>

                {/* Calculated quantity display */}
                {maintenanceFormData.cost && maintenanceFormData.costPerLiter && (
                  <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>Calculated Quantity (L)</Text>
                    <View style={styles.calculatedQuantityContainer}>
                      <Text style={styles.calculatedQuantityText}>
                        {(parseFloat(maintenanceFormData.cost) / parseFloat(maintenanceFormData.costPerLiter)).toFixed(2)}L
                      </Text>
                      <Text style={styles.calculatedQuantitySubtext}>
                        {maintenanceFormData.cost} ÷ {maintenanceFormData.costPerLiter} = {(parseFloat(maintenanceFormData.cost) / parseFloat(maintenanceFormData.costPerLiter)).toFixed(2)}L
                      </Text>
                    </View>
                  </View>
                )}
              </>
            )}

            {/* Quantity for oil change */}
            {maintenanceFormData.type === 'oil_change' && (
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Oil Quantity (L)</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  value={maintenanceFormData.quantity}
                  onChangeText={text => handleMaintenanceFormChange('quantity', text)}
                  placeholder="Enter oil quantity in liters"
                />
              </View>
            )}

            {/* Notes */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Notes</Text>
              <TextInput
                style={[styles.input, styles.notesInput]}
                value={maintenanceFormData.notes}
                onChangeText={text => handleMaintenanceFormChange('notes', text)}
                placeholder={`Add notes about the ${maintenanceFormData.type.replace('_', ' ')} (optional)`}
                multiline
              />
            </View>

            {/* Buttons */}
            <View style={styles.formButtons}>
              <TouchableOpacity onPress={() => setMaintenanceFormVisible(false)} style={[styles.formButton, styles.cancelButton]}>
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleMaintenanceFormSave} style={[styles.formButton, styles.saveButton]}>
                <Text style={[styles.buttonText, styles.saveButtonText]}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  // Navigation Controls Container
  navigationControlsContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.85)',
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    zIndex: 1002,
    elevation: 15,
  },

  // Stats Bar
  navigationStatsBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },

  navigationStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  navigationStatValue: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },

  navigationStatLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
  },

  navigationStatText: {
    color: '#fff',
    marginLeft: 4,
    fontSize: 14,
    fontWeight: '600',
  },

  // Control Buttons
  navigationButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 16,
    paddingHorizontal: 20,
  },

  navigationControlButton: {
    alignItems: 'center',
    width: 80,
  },

  navigationControlGradient: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },

  navigationControlLabel: {
    color: '#fff',
    fontSize: 12,
    marginTop: 4,
    opacity: 0.8,
  },

  navigationControlText: {
    color: '#fff',
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '600',
  },

  // Maintenance Form Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  formModal: {
    width: '90%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    elevation: 5,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  notesInput: {
    height: 100,
    textAlignVertical: 'top',
  },
  formButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  formButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    marginHorizontal: 8,
  },
  cancelButton: {
    backgroundColor: '#e74c3c',
  },
  saveButton: {
    backgroundColor: '#00ADB5',
  },
  saveButtonText: {
    color: '#fff',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  calculatedQuantityContainer: {
    backgroundColor: '#E3F2FD',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2196F3',
  },
  calculatedQuantityText: {
    fontSize: 18,
    color: '#2196F3',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  calculatedQuantitySubtext: {
    fontSize: 12,
    color: '#1976D2',
    textAlign: 'center',
    marginTop: 4,
    fontStyle: 'italic',
  },
});