/**
 * Fuel Check Utilities
 * 
 * Handles all fuel check-related operations including:
 * - Fuel confirmation
 * - Low fuel confirmation
 * - Fuel level updates
 * - Fuel validation
 */

import { Alert } from 'react-native';
import Toast from 'react-native-toast-message';
import { validateFuelLevel as validateFuelLevelUtil } from './fuelCalculation';
import { updateFuelLevel } from '../../utils/api';
import type { Motor } from '../../types';

export interface FuelCheckParams {
  selectedMotor: Motor | null;
  fuelLevel: number;
  isAccurate: boolean;
  onStartTracking: () => Promise<void>;
  onUpdateFuelLevel?: (motorId: string, fuelLevel: number) => Promise<void>;
  onUpdateMotor?: (motor: Motor) => void;
  onShowFuelUpdateModal: () => void;
  onHideFuelCheckModal: () => void;
  onSetFuelCheckStep: (step: 'confirmation' | 'low_fuel' | null) => void;
  onSetLowFuelStep?: () => void;
}

/**
 * Handle fuel confirmation
 */
export const handleFuelConfirmation = async (params: FuelCheckParams): Promise<void> => {
  const {
    selectedMotor,
    fuelLevel,
    isAccurate,
    onStartTracking,
    onUpdateFuelLevel,
    onUpdateMotor,
    onShowFuelUpdateModal,
    onHideFuelCheckModal,
    onSetFuelCheckStep,
    onSetLowFuelStep,
  } = params;

  if (!selectedMotor) {
    console.error('[FuelCheck] No motor selected for fuel confirmation');
    Toast.show({
      type: 'error',
      text1: 'No Motor Selected',
      text2: 'Please select a motor first',
    });
    return;
  }

  if (isAccurate) {
    // Fuel level is accurate, check if it's low fuel
    const currentFuelLevel = fuelLevel || selectedMotor.currentFuelLevel || 0;
    
    // Validate fuel level before proceeding
    if (!validateFuelLevelUtil(currentFuelLevel)) {
      console.error('[FuelCheck] Invalid fuel level detected:', currentFuelLevel);
      Toast.show({
        type: 'error',
        text1: 'Invalid Fuel Level',
        text2: 'Please update your fuel level',
      });
      onHideFuelCheckModal();
      onShowFuelUpdateModal();
      return;
    }

    console.log('[FuelCheck] Fuel confirmation completed:', {
      motorId: selectedMotor._id,
      fuelLevel: currentFuelLevel,
      timestamp: new Date().toISOString(),
    });

    // ALWAYS update fuel level in backend and local state after confirmation
    // This ensures the backend is always in sync with the confirmed fuel level
    if (onUpdateFuelLevel && onUpdateMotor && selectedMotor) {
      const currentMotorFuelLevel = selectedMotor.currentFuelLevel || 0;
      // Update if the confirmed fuel level is different from current (even by 0.1)
      if (Math.abs(currentFuelLevel - currentMotorFuelLevel) > 0.01) {
        console.log('[FuelCheck] 🔄 Updating fuel level in backend after confirmation:', {
          current: currentMotorFuelLevel,
          confirmed: currentFuelLevel,
          motorId: selectedMotor._id,
        });
        
        try {
          // Update fuel level in backend API
          await onUpdateFuelLevel(selectedMotor._id, currentFuelLevel);
          
          // Update local motor state
          const updatedMotor = {
            ...selectedMotor,
            currentFuelLevel: currentFuelLevel,
          };
          onUpdateMotor(updatedMotor);
          
          console.log('[FuelCheck] ✅ Fuel level updated successfully in backend');
        } catch (error: any) {
          console.error('[FuelCheck] ❌ Failed to update fuel level in backend:', error);
          Toast.show({
            type: 'error',
            text1: 'Update Failed',
            text2: 'Failed to update fuel level in backend. Starting tracking anyway...',
            visibilityTime: 3000,
          });
          // Continue with tracking even if update fails
        }
      } else {
        // Even if values match, ensure backend is updated (in case of sync issues)
        try {
          await onUpdateFuelLevel(selectedMotor._id, currentFuelLevel);
          console.log('[FuelCheck] ✅ Fuel level synced with backend (values match)');
        } catch (error: any) {
          console.warn('[FuelCheck] ⚠️ Failed to sync fuel level with backend:', error);
          // Non-critical, continue anyway
        }
      }
    } else {
      console.warn('[FuelCheck] ⚠️ Missing callbacks for fuel update:', {
        hasOnUpdateFuelLevel: !!onUpdateFuelLevel,
        hasOnUpdateMotor: !!onUpdateMotor,
        hasSelectedMotor: !!selectedMotor,
      });
    }

    if (currentFuelLevel <= 20) {
      // Fuel is low, proceed to low fuel check
      console.log('[FuelCheck] ⚠️ Low fuel detected, showing low fuel warning:', {
        fuelLevel: currentFuelLevel,
        hasOnSetLowFuelStep: !!onSetLowFuelStep,
        hasOnSetFuelCheckStep: !!onSetFuelCheckStep,
        timestamp: new Date().toISOString(),
      });
      
      // CRITICAL: Set the low fuel step immediately (don't wait for setTimeout)
      // This ensures the modal updates right away
      if (onSetLowFuelStep) {
        console.log('[FuelCheck] ✅ Calling onSetLowFuelStep immediately');
        onSetLowFuelStep();
      } else if (onSetFuelCheckStep) {
        console.log('[FuelCheck] ✅ Calling onSetFuelCheckStep with low_fuel immediately');
        onSetFuelCheckStep('low_fuel');
      } else {
        console.error('[FuelCheck] ❌ No callback available to set low fuel step');
        Toast.show({
          type: 'error',
          text1: 'Configuration Error',
          text2: 'Missing callback to show low fuel warning',
        });
      }
    } else {
      // Fuel is sufficient, proceed directly to travel
      // CRITICAL: Don't close modal until tracking starts successfully
      // Start the actual tracking first
      console.log('[FuelCheck] ✅ Fuel level confirmed, attempting to start tracking...');
      try {
        await onStartTracking();
        console.log('[FuelCheck] ✅ Tracking started successfully, closing modal');
        // Only close modal if tracking started successfully
        onHideFuelCheckModal();
        onSetFuelCheckStep(null);
      } catch (error: any) {
        console.error('[FuelCheck] ❌ Error starting tracking after fuel check:', error);
        console.error('[FuelCheck] Error details:', {
          message: error?.message,
          stack: error?.stack,
          error: error,
        });
        
        // Check if error is location-related
        const errorMessage = error?.message || '';
        const isLocationError = 
          errorMessage.includes('Location') || 
          errorMessage.includes('location') ||
          errorMessage.includes('GPS') ||
          errorMessage.includes('permission') ||
          errorMessage.includes('Permission');
        
        if (isLocationError) {
          // Show detailed location error
          Alert.alert(
            'Location Error',
            'Unable to start tracking due to location issues.\n\n' + (errorMessage || 'Location is required to start tracking.') + '\n\nPossible issues:\n• Location permission denied\n• GPS is disabled\n• Location services unavailable\n• Poor GPS signal\n\nPlease check your location settings and try again.\n\nYou can try again after fixing the location issue.',
            [
              {
                text: 'OK',
                style: 'default',
              },
            ]
          );
        } else {
          // Generic tracking error
          Alert.alert(
            'Tracking Error',
            'Failed to start tracking after fuel check.\n\n' + (errorMessage || 'Unknown error occurred') + '\n\nPlease try again.',
            [
              {
                text: 'OK',
                style: 'default',
              },
            ]
          );
        }
        // Don't close modal - keep it open so user can try again
        // Modal will stay visible so user can retry after fixing the issue
        console.log('[FuelCheck] Modal kept open - user can retry after fixing the issue');
      }
    }
  } else {
    // Fuel level needs updating
    onHideFuelCheckModal();
    onShowFuelUpdateModal();
  }
};

/**
 * Handle low fuel confirmation
 */
export const handleLowFuelConfirmation = async (params: FuelCheckParams): Promise<void> => {
  const {
    selectedMotor,
    fuelLevel,
    isAccurate,
    onStartTracking,
    onUpdateFuelLevel,
    onUpdateMotor,
    onShowFuelUpdateModal,
    onHideFuelCheckModal,
    onSetFuelCheckStep,
  } = params;

  if (!selectedMotor) {
    console.error('[FuelCheck] No motor selected for low fuel confirmation');
    Toast.show({
      type: 'error',
      text1: 'No Motor Selected',
      text2: 'Please select a motor first',
    });
    return;
  }

  if (isAccurate) {
    // Low fuel is accurate, show warning and proceed
    const currentFuelLevel = fuelLevel || selectedMotor.currentFuelLevel || 0;
    
    // Validate fuel level before proceeding
    if (!validateFuelLevelUtil(currentFuelLevel)) {
      console.error('[FuelCheck] Invalid fuel level detected:', currentFuelLevel);
      Toast.show({
        type: 'error',
        text1: 'Invalid Fuel Level',
        text2: 'Please update your fuel level',
      });
      onHideFuelCheckModal();
      onShowFuelUpdateModal();
      return;
    }

    // ALWAYS update fuel level in backend and local state after confirmation (low fuel)
    // This ensures the backend is always in sync with the confirmed fuel level
    if (onUpdateFuelLevel && onUpdateMotor && selectedMotor) {
      const currentMotorFuelLevel = selectedMotor.currentFuelLevel || 0;
      // Update if the confirmed fuel level is different from current (even by 0.1)
      if (Math.abs(currentFuelLevel - currentMotorFuelLevel) > 0.01) {
        console.log('[FuelCheck] 🔄 Updating fuel level in backend after confirmation (low fuel):', {
          current: currentMotorFuelLevel,
          confirmed: currentFuelLevel,
          motorId: selectedMotor._id,
        });
        
        try {
          // Update fuel level in backend API
          await onUpdateFuelLevel(selectedMotor._id, currentFuelLevel);
          
          // Update local motor state
          const updatedMotor = {
            ...selectedMotor,
            currentFuelLevel: currentFuelLevel,
          };
          onUpdateMotor(updatedMotor);
          
          console.log('[FuelCheck] ✅ Fuel level updated successfully in backend (low fuel)');
        } catch (error: any) {
          console.error('[FuelCheck] ❌ Failed to update fuel level in backend (low fuel):', error);
          Toast.show({
            type: 'error',
            text1: 'Update Failed',
            text2: 'Failed to update fuel level in backend. Starting tracking anyway...',
            visibilityTime: 3000,
          });
          // Continue with tracking even if update fails
        }
      } else {
        // Even if values match, ensure backend is updated (in case of sync issues)
        try {
          await onUpdateFuelLevel(selectedMotor._id, currentFuelLevel);
          console.log('[FuelCheck] ✅ Fuel level synced with backend (low fuel, values match)');
        } catch (error: any) {
          console.warn('[FuelCheck] ⚠️ Failed to sync fuel level with backend (low fuel):', error);
          // Non-critical, continue anyway
        }
      }
    }

    // Show warning first
    Toast.show({
      type: 'error',
      text1: 'Low Fuel Warning',
      text2: `Fuel is at ${currentFuelLevel.toFixed(0)}%. Please refuel soon.`,
      position: 'top',
      visibilityTime: 4000,
    });
    
    // CRITICAL: Don't close modal until tracking starts successfully
    // Small delay to ensure toast is shown before starting tracking
    setTimeout(async () => {
      try {
        // Proceed with travel
        await onStartTracking();
        // Only close modal if tracking started successfully
        onHideFuelCheckModal();
        onSetFuelCheckStep(null);
      } catch (error: any) {
        console.error('[FuelCheck] ❌ Error proceeding with travel after low fuel confirmation:', error);
        console.error('[FuelCheck] Error details:', {
          message: error?.message,
          stack: error?.stack,
          error: error,
        });
        
        // Check if error is location-related
        const errorMessage = error?.message || '';
        const isLocationError = 
          errorMessage.includes('Location') || 
          errorMessage.includes('location') ||
          errorMessage.includes('GPS') ||
          errorMessage.includes('permission') ||
          errorMessage.includes('Permission');
        
        if (isLocationError) {
          // Show detailed location error
          Alert.alert(
            'Location Error',
            'Unable to start tracking due to location issues.\n\n' + (errorMessage || 'Location is required to start tracking.') + '\n\nPossible issues:\n• Location permission denied\n• GPS is disabled\n• Location services unavailable\n• Poor GPS signal\n\nPlease check your location settings and try again.\n\nYou can try again after fixing the location issue.',
            [
              {
                text: 'OK',
                style: 'default',
              },
            ]
          );
        } else {
          // Generic travel error
          Alert.alert(
            'Travel Error',
            'Failed to start travel after fuel check.\n\n' + (errorMessage || 'Unknown error occurred') + '\n\nPlease try again.',
            [
              {
                text: 'OK',
                style: 'default',
              },
            ]
          );
        }
        // Don't close modal - keep it open so user can try again
        // Modal will stay visible so user can retry after fixing the issue
        console.log('[FuelCheck] Modal kept open - user can retry after fixing the issue');
      }
    }, 100);
  } else {
    // Low fuel needs updating
    onHideFuelCheckModal();
    onShowFuelUpdateModal();
  }
};

/**
 * Handle fuel level update
 */
export interface FuelUpdateParams {
  selectedMotor: Motor | null;
  fuelUpdateValue: string;
  fuelCheckStep: 'confirmation' | 'low_fuel' | null;
  onStartTracking: () => Promise<void>;
  onUpdateFuelLevel: (motorId: string, fuelLevel: number) => Promise<void>;
  onUpdateMotor: (motor: Motor) => void;
  onHideFuelUpdateModal: () => void;
  onSetFuelCheckStep: (step: 'confirmation' | 'low_fuel' | null) => void;
  onSetFuelUpdateValue: (value: string) => void;
  onShowFuelCheckModal?: () => void;
}

export const handleFuelUpdate = async (params: FuelUpdateParams): Promise<void> => {
  const {
    selectedMotor,
    fuelUpdateValue,
    fuelCheckStep,
    onStartTracking,
    onUpdateFuelLevel,
    onUpdateMotor,
    onHideFuelUpdateModal,
    onSetFuelCheckStep,
    onSetFuelUpdateValue,
  } = params;

  if (!selectedMotor || !fuelUpdateValue) {
    Toast.show({
      type: 'error',
      text1: 'Missing Information',
      text2: 'Please select a motor and enter a fuel level',
    });
    return;
  }

  const newFuelLevel = parseFloat(fuelUpdateValue);
  
  // Enhanced validation
  if (isNaN(newFuelLevel) || !isFinite(newFuelLevel)) {
    Toast.show({
      type: 'error',
      text1: 'Invalid Input',
      text2: 'Please enter a valid number',
    });
    return;
  }

  if (newFuelLevel < 0 || newFuelLevel > 100) {
    Toast.show({
      type: 'error',
      text1: 'Invalid Range',
      text2: 'Please enter a value between 0 and 100',
    });
    return;
  }

  // Validate fuel level using our enhanced validation function
  if (!validateFuelLevelUtil(newFuelLevel)) {
    Toast.show({
      type: 'error',
      text1: 'Invalid Fuel Level',
      text2: 'Please enter a valid fuel level',
    });
    return;
  }

  try {
    // Update fuel level in backend
    await onUpdateFuelLevel(selectedMotor._id, newFuelLevel);
    
    // Update local state
    const updatedMotor = {
      ...selectedMotor,
      currentFuelLevel: newFuelLevel,
    };
    onUpdateMotor(updatedMotor);

    Toast.show({
      type: 'success',
      text1: 'Fuel Level Updated',
      text2: `Updated to ${newFuelLevel.toFixed(0)}%`,
    });

    onHideFuelUpdateModal();
    onSetFuelUpdateValue('');

      // Continue with fuel check based on the step
      if (fuelCheckStep === 'confirmation') {
        // Check if the updated fuel level is low
        if (newFuelLevel <= 20) {
          onSetFuelCheckStep('low_fuel');
          // Show the fuel check modal again if callback provided
          if (params.onShowFuelCheckModal) {
            params.onShowFuelCheckModal();
          }
        } else {
          // Fuel is sufficient, proceed directly to travel
          onSetFuelCheckStep(null);
          try {
            await onStartTracking();
          } catch (error: any) {
            console.error('[FuelCheck] Error proceeding with travel after fuel update:', error);
            
            // Check if error is location-related
            const errorMessage = error?.message || '';
            const isLocationError = 
              errorMessage.includes('Location') || 
              errorMessage.includes('location') ||
              errorMessage.includes('GPS') ||
              errorMessage.includes('permission') ||
              errorMessage.includes('Permission');
            
            if (isLocationError) {
              // Show detailed location error
              Alert.alert(
                'Location Error',
                'Unable to start tracking due to location issues.\n\n' + (errorMessage || 'Location is required to start tracking.') + '\n\nPossible issues:\n• Location permission denied\n• GPS is disabled\n• Location services unavailable\n• Poor GPS signal\n\nPlease check your location settings and try again.',
                [
                  {
                    text: 'OK',
                    style: 'default',
                  },
                ]
              );
            } else {
              // Generic travel error
              Toast.show({
                type: 'error',
                text1: 'Travel Error',
                text2: errorMessage || 'Failed to start travel after fuel update',
                visibilityTime: 4000,
              });
            }
          }
        }
      } else {
        onSetFuelCheckStep(null);
        // Proceed with travel
        try {
          await onStartTracking();
        } catch (error: any) {
          console.error('[FuelCheck] Error proceeding with travel after fuel update:', error);
          
          // Check if error is location-related
          const errorMessage = error?.message || '';
          const isLocationError = 
            errorMessage.includes('Location') || 
            errorMessage.includes('location') ||
            errorMessage.includes('GPS') ||
            errorMessage.includes('permission') ||
            errorMessage.includes('Permission');
          
          if (isLocationError) {
            // Show detailed location error
            Alert.alert(
              'Location Error',
              'Unable to start tracking due to location issues.\n\n' + (errorMessage || 'Location is required to start tracking.') + '\n\nPossible issues:\n• Location permission denied\n• GPS is disabled\n• Location services unavailable\n• Poor GPS signal\n\nPlease check your location settings and try again.',
              [
                {
                  text: 'OK',
                  style: 'default',
                },
              ]
            );
          } else {
            // Generic travel error
            Toast.show({
              type: 'error',
              text1: 'Travel Error',
              text2: errorMessage || 'Failed to start travel after fuel update',
              visibilityTime: 4000,
            });
          }
        }
      }
  } catch (error: any) {
    console.error('[FuelCheck] Failed to update fuel level:', error);
    Toast.show({
      type: 'error',
      text1: 'Update Failed',
      text2: error instanceof Error ? error.message : 'Failed to update fuel level',
    });
  }
};

