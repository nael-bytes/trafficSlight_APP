/**
 * useMaintenanceForm Hook
 * 
 * Extracts maintenance form state and logic:
 * - Form data management
 * - Form field changes
 * - Form save logic
 * 
 * @module useMaintenanceForm
 */

import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import Toast from 'react-native-toast-message';
import type { Motor, LocationCoords } from '../../types';
import {
  handleRefuel,
  handleOilChange,
  handleTuneUp,
  validateMaintenanceForm,
  calculateRefuelQuantity,
} from './maintenanceUtils';

interface MaintenanceFormData {
  type: 'refuel' | 'oil_change' | 'tune_up' | '';
  cost: string;
  quantity: string;
  costPerLiter: string;
  notes: string;
}

interface UseMaintenanceFormParams {
  selectedMotor: Motor | null;
  currentLocation: LocationCoords | null;
  user: any;
  setSelectedMotor: (motor: Motor | null | ((prev: Motor | null) => Motor | null)) => void;
  setTripMaintenanceActions: React.Dispatch<React.SetStateAction<any[]>>;
  onClose?: () => void;
}

interface UseMaintenanceFormReturn {
  maintenanceFormData: MaintenanceFormData;
  maintenanceFormVisible: boolean;
  setMaintenanceFormData: React.Dispatch<React.SetStateAction<MaintenanceFormData>>;
  setMaintenanceFormVisible: (show: boolean) => void;
  handleMaintenanceFormChange: (field: keyof MaintenanceFormData, value: string) => void;
  handleMaintenanceFormSave: () => Promise<void>;
  openMaintenanceForm: (type: 'refuel' | 'oil_change' | 'tune_up') => void;
  closeMaintenanceForm: () => void;
}

/**
 * Custom hook for managing maintenance form
 */
export const useMaintenanceForm = ({
  selectedMotor,
  currentLocation,
  user,
  setSelectedMotor,
  setTripMaintenanceActions,
  onClose,
}: UseMaintenanceFormParams): UseMaintenanceFormReturn => {
  const [maintenanceFormVisible, setMaintenanceFormVisible] = useState(false);
  const [maintenanceFormData, setMaintenanceFormData] = useState<MaintenanceFormData>({
    type: '',
    cost: '',
    quantity: '',
    costPerLiter: '',
    notes: ''
  });

  // Handle maintenance form changes
  const handleMaintenanceFormChange = useCallback((field: keyof MaintenanceFormData, value: string) => {
    if (__DEV__) {
      console.log('[useMaintenanceForm] 📝 Maintenance form field changed', {
        field,
        value,
        timestamp: new Date().toISOString(),
      });
    }

    setMaintenanceFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  // Handle maintenance form save
  const handleMaintenanceFormSave = useCallback(async () => {
    if (__DEV__) {
      console.log('[useMaintenanceForm] 💾 handleMaintenanceFormSave called', {
        type: maintenanceFormData.type,
        cost: maintenanceFormData.cost,
        quantity: maintenanceFormData.quantity,
        hasSelectedMotor: !!selectedMotor,
        hasCurrentLocation: !!currentLocation,
        hasUser: !!user,
        timestamp: new Date().toISOString(),
      });
    }

    if (!maintenanceFormData.type || !selectedMotor || !currentLocation || !user) {
      if (__DEV__) {
        console.warn('[useMaintenanceForm] ❌ Cannot save maintenance - missing data', {
          hasType: !!maintenanceFormData.type,
          hasSelectedMotor: !!selectedMotor,
          hasCurrentLocation: !!currentLocation,
          hasUser: !!user,
        });
      }

      Alert.alert('Error', 'Missing required information');
      return;
    }

    if (__DEV__) {
      console.log('[useMaintenanceForm] 🔄 Saving maintenance record', {
        type: maintenanceFormData.type,
        motorId: selectedMotor._id,
        timestamp: new Date().toISOString(),
      });
    }

    try {
      const validation = validateMaintenanceForm(
        maintenanceFormData.type,
        maintenanceFormData.cost,
        maintenanceFormData.quantity,
        maintenanceFormData.costPerLiter
      );

      if (!validation.isValid) {
        Alert.alert('Validation Error', validation.error || 'Invalid form data');
        return;
      }

      const cost = parseFloat(maintenanceFormData.cost) || 0;
      const location: LocationCoords = {
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
      };

      if (maintenanceFormData.type === 'refuel') {
        const costPerLiter = parseFloat(maintenanceFormData.costPerLiter) || 0;
        
        // Validate cost and costPerLiter before calculating quantity
        if (cost <= 0) {
          throw new Error('Cost must be greater than 0');
        }
        if (costPerLiter <= 0) {
          throw new Error('Cost per liter must be greater than 0');
        }
        
        const quantity = calculateRefuelQuantity(cost, costPerLiter);
        
        // Validate calculated quantity
        if (!quantity || isNaN(quantity) || quantity <= 0) {
          throw new Error(`Invalid quantity calculated: ${quantity}. Cost: ${cost}, Cost per liter: ${costPerLiter}`);
        }

        if (__DEV__) {
          console.log('[useMaintenanceForm] 🔧 Refuel calculation:', {
            cost,
            costPerLiter,
            calculatedQuantity: quantity,
          });
        }

        const newFuelLevel = await handleRefuel(
          selectedMotor,
          location,
          cost,
          costPerLiter,
          quantity,
          user._id,
          user.token,
          maintenanceFormData.notes
        );

        if (selectedMotor) {
          const updatedMotor = { ...selectedMotor, currentFuelLevel: newFuelLevel } as Motor;
          setSelectedMotor(updatedMotor);
        }

        // Add to trip maintenance actions
        setTripMaintenanceActions(prev => [...prev, {
          type: 'refuel',
          timestamp: Date.now(),
          cost: cost,
          quantity: quantity,
          costPerLiter: costPerLiter,
          notes: maintenanceFormData.notes
        }]);
      } else if (maintenanceFormData.type === 'oil_change') {
        const quantity = parseFloat(maintenanceFormData.quantity) || 0;
        await handleOilChange(
          selectedMotor,
          location,
          cost,
          quantity,
          user._id,
          user.token,
          maintenanceFormData.notes
        );

        // Add to trip maintenance actions
        setTripMaintenanceActions(prev => [...prev, {
          type: 'oil_change',
          timestamp: Date.now(),
          cost: cost,
          quantity: quantity,
          notes: maintenanceFormData.notes
        }]);
      } else if (maintenanceFormData.type === 'tune_up') {
        await handleTuneUp(
          selectedMotor,
          location,
          cost,
          user._id,
          user.token,
          maintenanceFormData.notes
        );

        // Add to trip maintenance actions
        setTripMaintenanceActions(prev => [...prev, {
          type: 'tune_up',
          timestamp: Date.now(),
          cost: cost,
          notes: maintenanceFormData.notes
        }]);
      }

      // Reset form and close modal
      setMaintenanceFormData({
        type: '',
        cost: '',
        quantity: '',
        costPerLiter: '',
        notes: ''
      });
      setMaintenanceFormVisible(false);
      onClose?.();

      if (__DEV__) {
        console.log('[useMaintenanceForm] ✅ Maintenance record saved successfully', {
          type: maintenanceFormData.type,
          motorId: selectedMotor._id,
          timestamp: new Date().toISOString(),
        });
      }

      Toast.show({
        type: 'success',
        text1: 'Maintenance Record Saved',
      });
    } catch (error: any) {
      if (__DEV__) {
        console.error('[useMaintenanceForm] ❌ Maintenance save error:', {
          error: error.message,
          type: maintenanceFormData.type,
          motorId: selectedMotor._id,
          timestamp: new Date().toISOString(),
        });
      }

      Toast.show({
        type: 'error',
        text1: 'Save Failed',
        text2: error.message || 'Failed to save maintenance record',
      });
    }
  }, [maintenanceFormData, selectedMotor, currentLocation, user, setSelectedMotor, setTripMaintenanceActions, onClose]);

  const openMaintenanceForm = useCallback((type: 'refuel' | 'oil_change' | 'tune_up') => {
    setMaintenanceFormData({
      type,
      cost: '',
      quantity: '',
      costPerLiter: '',
      notes: ''
    });
    setMaintenanceFormVisible(true);
  }, []);

  const closeMaintenanceForm = useCallback(() => {
    setMaintenanceFormVisible(false);
    setMaintenanceFormData({
      type: '',
      cost: '',
      quantity: '',
      costPerLiter: '',
      notes: ''
    });
  }, []);

  return {
    maintenanceFormData,
    maintenanceFormVisible,
    setMaintenanceFormData,
    setMaintenanceFormVisible,
    handleMaintenanceFormChange,
    handleMaintenanceFormSave,
    openMaintenanceForm,
    closeMaintenanceForm,
  };
};

