import { useCallback } from 'react';
import { Alert } from 'react-native';
import { LOCALHOST_IP } from '@env';

export interface LocationCoords {
  latitude: number;
  longitude: number;
  address?: string;
}

export interface MaintenanceAction {
  type: 'oil_change' | 'refuel' | 'tune_up';
  timestamp: number;
  location: LocationCoords;
  details: {
    cost: number;
    quantity?: number;
    notes?: string;
  };
}

export interface MaintenanceFormData {
  type: string;
  cost: string;
  quantity: string;
  notes: string;
}

// Save maintenance record to backend
export const saveMaintenanceRecord = async (
  actionType: MaintenanceAction['type'],
  formData: MaintenanceFormData,
  location: LocationCoords,
  motorId: string,
  userId: string
): Promise<void> => {
  try {
    const maintenanceData = {
      motorId,
      userId,
      type: actionType, // Changed from actionType to type per API docs
      location: {
        lat: location.latitude, // Use lat/lng format per API docs
        lng: location.longitude,
        latitude: location.latitude, // Also include latitude/longitude as alternative format
        longitude: location.longitude,
      },
      details: {
        cost: parseFloat(formData.cost) || 0,
        quantity: formData.quantity ? parseFloat(formData.quantity) : undefined,
        notes: formData.notes || '',
      },
      timestamp: Date.now(),
    };

    const response = await fetch(`${LOCALHOST_IP}/api/maintenance-records`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(maintenanceData),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error('❌ API Error Response:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText,
      });
      throw new Error(`Failed to save maintenance record: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log('✅ Maintenance record saved:', result);
    
    Alert.alert(
      'Success',
      'Maintenance record saved successfully!',
      [{ text: 'OK' }]
    );
  } catch (error: any) {
    console.error('❌ Error saving maintenance record:', error);
    Alert.alert('Error', error.message || 'Failed to save maintenance record');
    throw error;
  }
};

// Validate fuel level
export const validateFuelLevel = (fuelLevel: number, motorId: string): boolean => {
  if (fuelLevel < 0 || fuelLevel > 100) {
    Alert.alert('Invalid Input', 'Fuel level must be between 0 and 100');
    return false;
  }
  return true;
};

// Update fuel level in backend
export const updateFuelLevel = async (
  motorId: string,
  newFuelLevel: number,
  userId: string
): Promise<void> => {
  try {
    const response = await fetch(`${LOCALHOST_IP}/api/user-motors/${motorId}/updateFuelLevel`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fuelLevel: newFuelLevel,
        userId,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to update fuel level');
    }

    const result = await response.json();
    console.log('✅ Fuel level updated:', result);
    
    Alert.alert('Success', 'Fuel level updated successfully!');
  } catch (error: any) {
    console.error('❌ Error updating fuel level:', error);
    Alert.alert('Error', error.message || 'Failed to update fuel level');
    throw error;
  }
};

// Maintenance handlers hook
export const useMaintenanceHandlers = (
  selectedMotor: any,
  currentLocation: LocationCoords | null,
  user: any,
  setMaintenanceFormVisible: (visible: boolean) => void,
  setMaintenanceFormData: (data: MaintenanceFormData) => void
) => {
  
  const handleMaintenanceFormSave = useCallback(async (formData: MaintenanceFormData) => {
    if (!selectedMotor || !currentLocation || !user) {
      Alert.alert('Error', 'Missing required information');
      return;
    }

    try {
      const actionType = formData.type as MaintenanceAction['type'];
      
      // Save maintenance record
      await saveMaintenanceRecord(
        actionType,
        formData,
        currentLocation,
        selectedMotor._id,
        user._id
      );

      // Reset form and close modal
      setMaintenanceFormData({
        type: '',
        cost: '',
        quantity: '',
        notes: '',
      });
      setMaintenanceFormVisible(false);

    } catch (error) {
      console.error('❌ Maintenance form save error:', error);
    }
  }, [selectedMotor, currentLocation, user, setMaintenanceFormVisible, setMaintenanceFormData]);

  const handleMaintenanceFormChange = useCallback((field: string, value: string) => {
    setMaintenanceFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  }, [setMaintenanceFormData]);

  const handleFuelLevelUpdate = useCallback(async (newFuelLevel: number) => {
    if (!selectedMotor || !user) {
      Alert.alert('Error', 'No motor selected');
      return;
    }

    if (!validateFuelLevel(newFuelLevel, selectedMotor._id)) {
      return;
    }

    try {
      await updateFuelLevel(selectedMotor._id, newFuelLevel, user._id);
    } catch (error) {
      console.error('❌ Fuel level update error:', error);
    }
  }, [selectedMotor, user]);

  return {
    handleMaintenanceFormSave,
    handleMaintenanceFormChange,
    handleFuelLevelUpdate,
  };
};
