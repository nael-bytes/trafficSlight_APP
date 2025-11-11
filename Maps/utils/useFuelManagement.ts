/**
 * useFuelManagement Hook
 * 
 * Extracts fuel management logic:
 * - Fuel check flow
 * - Fuel update
 * - Fuel confirmation
 * - Fuel update modal with slider
 * 
 * @module useFuelManagement
 */

import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { View, PanResponder } from 'react-native';
import Toast from 'react-native-toast-message';
import type { Motor } from '../../types';
import {
  handleFuelConfirmation as handleFuelConfirmationUtil,
  handleLowFuelConfirmation as handleLowFuelConfirmationUtil,
  handleFuelUpdate as handleFuelUpdateUtil,
} from './fuelCheckUtils';
import { updateFuelLevel } from '../../utils/api';
import { startFreeDriveTracking } from './trackingUtils';
import type { LocationCoords } from '../../types';

interface UseFuelManagementParams {
  selectedMotor: Motor | null;
  currentLocation: LocationCoords | null;
  isTracking: boolean;
  isDestinationFlowActive: boolean;
  startTracking: () => void | Promise<void>;
  handleGetCurrentLocation: (showOverlay?: boolean, forceRefresh?: boolean) => Promise<LocationCoords | null>;
  setStartAddress: (address: string) => void;
  setTripDataForModal: (data: any) => void;
  setScreenMode: (mode: 'planning' | 'tracking' | 'summary') => void;
  setSelectedMotor: (motor: Motor | null | ((prev: Motor | null) => Motor | null)) => void;
  lastProcessedDistanceRef: React.RefObject<number>;
  userManuallyPannedRef: React.RefObject<boolean>;
  manualPanTimeoutRef: React.RefObject<NodeJS.Timeout | null>;
  onClearDestination?: () => void; // Optional callback to clear destination for Free Drive
  onResetDestinationFlow?: () => void; // Optional callback to reset destination flow state
}

interface UseFuelManagementReturn {
  // Fuel check states
  showFuelCheckModal: boolean;
  showFuelUpdateModal: boolean;
  fuelCheckStep: 'confirmation' | 'low_fuel' | null;
  pendingFuelLevel: number | null;
  fuelUpdateValue: string;

  // Fuel check setters
  setShowFuelCheckModal: (show: boolean) => void;
  setShowFuelUpdateModal: (show: boolean) => void;
  setFuelCheckStep: (step: 'confirmation' | 'low_fuel' | null) => void;
  setPendingFuelLevel: (level: number | null) => void;
  setFuelUpdateValue: (value: string) => void;

  // Fuel check handlers
  startFuelCheck: () => void;
  handleFuelConfirmation: (isAccurate: boolean, fuelLevel?: number) => Promise<void>;
  handleLowFuelConfirmation: (isAccurate: boolean) => Promise<void>;
  handleFuelUpdate: () => Promise<void>;

  // Slider refs and handlers
  sliderTrackRef: React.RefObject<View>;
  sliderTrackLayoutRef: React.RefObject<{ x: number; width: number }>;
  sliderPanResponder: any;
}

/**
 * Custom hook for managing fuel check and update flow
 */
export const useFuelManagement = ({
  selectedMotor,
  currentLocation,
  isTracking,
  isDestinationFlowActive,
  startTracking,
  handleGetCurrentLocation,
  setStartAddress,
  setTripDataForModal,
  setScreenMode,
  setSelectedMotor,
  lastProcessedDistanceRef,
  userManuallyPannedRef,
  manualPanTimeoutRef,
  onClearDestination,
  onResetDestinationFlow,
}: UseFuelManagementParams): UseFuelManagementReturn => {
  // Ensure optional callbacks are defined
  const clearDestination = onClearDestination || (() => {
    if (__DEV__) {
      console.warn('[useFuelManagement] onClearDestination not provided');
    }
  });
  
  const resetDestinationFlow = onResetDestinationFlow || (() => {
    if (__DEV__) {
      console.warn('[useFuelManagement] onResetDestinationFlow not provided');
    }
  });
  const [showFuelCheckModal, setShowFuelCheckModal] = useState(false);
  const [showFuelUpdateModal, setShowFuelUpdateModal] = useState(false);
  const [fuelCheckStep, setFuelCheckStep] = useState<'confirmation' | 'low_fuel' | null>(null);
  const [pendingFuelLevel, setPendingFuelLevel] = useState<number | null>(null);
  const [fuelUpdateValue, setFuelUpdateValue] = useState<string>('');
  const sliderTrackRef = useRef<View>(null);
  const sliderTrackLayoutRef = useRef<{ x: number; width: number }>({ x: 0, width: 280 });

  // Initialize fuel update modal with current fuel level
  useEffect(() => {
    if (showFuelUpdateModal && selectedMotor) {
      const currentLevel = selectedMotor.currentFuelLevel || 0;
      setFuelUpdateValue(currentLevel.toString());
    }
  }, [showFuelUpdateModal, selectedMotor]);

  // PanResponder for slider drag functionality
  const sliderPanResponder = useMemo(() => {
    const updateValueFromPosition = (pageX: number) => {
      const trackLayout = sliderTrackLayoutRef.current;
      const relativeX = pageX - trackLayout.x;
      const percentage = Math.max(0, Math.min(100, (relativeX / trackLayout.width) * 100));
      setFuelUpdateValue(Math.round(percentage).toString());
    };

    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        updateValueFromPosition(evt.nativeEvent.pageX);
      },
      onPanResponderMove: (evt) => {
        updateValueFromPosition(evt.nativeEvent.pageX);
      },
      onPanResponderRelease: () => {
        // Handle end of drag
      },
    });
  }, []);

  // Start fuel check
  const startFuelCheck = useCallback(() => {
    if (__DEV__) {
      console.log('[useFuelManagement] ⛽ startFuelCheck called', {
        hasSelectedMotor: !!selectedMotor,
        motorId: selectedMotor?._id,
        motorNickname: selectedMotor?.nickname,
        currentFuelLevel: selectedMotor?.currentFuelLevel,
        timestamp: new Date().toISOString(),
      });
    }

    if (!selectedMotor) {
      if (__DEV__) {
        console.warn('[useFuelManagement] ❌ Cannot start fuel check - no motor selected');
      }

      Toast.show({
        type: 'error',
        text1: 'No Motor Selected',
        text2: 'Please select a motor first',
      });
      return;
    }

    // Set pending fuel level to current fuel level when modal opens
    const currentLevel = selectedMotor.currentFuelLevel || 0;
    setPendingFuelLevel(currentLevel);
    setFuelCheckStep('confirmation');
    setShowFuelCheckModal(true);

    if (__DEV__) {
      console.log('[useFuelManagement] ✅ Fuel check modal opened', {
        motorNickname: selectedMotor.nickname,
        fuelLevel: currentLevel,
        timestamp: new Date().toISOString(),
      });
    }
  }, [selectedMotor]);

  // Start tracking from fuel check
  const startTrackingFromFuelCheck = useCallback(async () => {
    if (__DEV__) {
      console.log('[useFuelManagement] 🚀 startTrackingFromFuelCheck called', {
        isTracking,
        hasSelectedMotor: !!selectedMotor,
        motorId: selectedMotor?._id,
        timestamp: new Date().toISOString(),
      });
    }

    if (isTracking) {
      if (__DEV__) {
        console.warn('[useFuelManagement] ⚠️ Already tracking, skipping start');
      }
      return;
    }

    if (__DEV__) {
      console.log('[useFuelManagement] ▶️ Starting free drive tracking from fuel check', {
        timestamp: new Date().toISOString(),
      });
    }

    try {
      await startFreeDriveTracking({
        selectedMotor,
        currentLocation,
        isDestinationFlowActive,
        onStartTracking: startTracking,
        onGetCurrentLocation: handleGetCurrentLocation,
        onSetStartAddress: setStartAddress,
        onResetLastProcessedDistance: () => {
          if (lastProcessedDistanceRef && lastProcessedDistanceRef.current !== null) {
            (lastProcessedDistanceRef as any).current = 0;
          }
        },
        onResetManualPanFlag: () => {
          if (userManuallyPannedRef && userManuallyPannedRef.current !== null) {
            (userManuallyPannedRef as any).current = false;
          }
          if (manualPanTimeoutRef && manualPanTimeoutRef.current) {
            clearTimeout(manualPanTimeoutRef.current);
            (manualPanTimeoutRef as any).current = null;
          }
        },
        onSetTripDataForModal: setTripDataForModal,
        onSetScreenMode: setScreenMode,
        onClearDestination: clearDestination,
        onResetDestinationFlow: resetDestinationFlow,
      });

      if (__DEV__) {
        console.log('[useFuelManagement] ✅ Free drive tracking started successfully from fuel check', {
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error: any) {
      if (__DEV__) {
        console.error('[useFuelManagement] ❌ Failed to start free drive tracking from fuel check', {
          error: error.message,
          timestamp: new Date().toISOString(),
        });
      }
      throw error;
    }
  }, [
    isTracking,
    selectedMotor,
    currentLocation,
    isDestinationFlowActive,
    startTracking,
    handleGetCurrentLocation,
    setStartAddress,
    setTripDataForModal,
    setScreenMode,
    lastProcessedDistanceRef,
    userManuallyPannedRef,
    manualPanTimeoutRef,
    onClearDestination,
    onResetDestinationFlow,
  ]);

  // Handle fuel confirmation
  const handleFuelConfirmation = useCallback(async (isAccurate: boolean, fuelLevel?: number) => {
    if (__DEV__) {
      console.log('[useFuelManagement] ⛽ handleFuelConfirmation called', {
        isAccurate,
        motorId: selectedMotor?._id,
        currentFuelLevel: selectedMotor?.currentFuelLevel,
        sliderFuelLevel: fuelLevel,
        timestamp: new Date().toISOString(),
      });
    }

    // Use slider fuel level if provided, otherwise use motor's current fuel level
    const confirmedFuelLevel = fuelLevel !== undefined ? fuelLevel : (selectedMotor?.currentFuelLevel || 0);

    try {
    await handleFuelConfirmationUtil({
      selectedMotor,
      fuelLevel: confirmedFuelLevel,
      isAccurate,
      onStartTracking: startTrackingFromFuelCheck,
      onUpdateFuelLevel: updateFuelLevel,
      onUpdateMotor: (motor: Motor) => setSelectedMotor(motor),
      onShowFuelUpdateModal: () => {
        setPendingFuelLevel(confirmedFuelLevel);
        setFuelUpdateValue(confirmedFuelLevel.toString());
        setShowFuelUpdateModal(true);
      },
        onHideFuelCheckModal: () => {
          console.log('[useFuelManagement] Hiding fuel check modal');
          setShowFuelCheckModal(false);
        },
        onSetFuelCheckStep: (step) => {
          console.log('[useFuelManagement] Setting fuel check step to:', step);
          setFuelCheckStep(step);
        },
        onSetLowFuelStep: () => {
          console.log('[useFuelManagement] Setting fuel check step to low_fuel');
          setFuelCheckStep('low_fuel');
        },
    });
      
      if (__DEV__) {
        console.log('[useFuelManagement] ✅ handleFuelConfirmationUtil completed');
      }
    } catch (error: any) {
      console.error('[useFuelManagement] ❌ Error in handleFuelConfirmation:', error);
      Toast.show({
        type: 'error',
        text1: 'Fuel Confirmation Error',
        text2: error?.message || 'An error occurred during fuel confirmation',
      });
    }
  }, [selectedMotor, startTrackingFromFuelCheck, updateFuelLevel, setSelectedMotor, setPendingFuelLevel, setFuelUpdateValue, setShowFuelUpdateModal, setShowFuelCheckModal, setFuelCheckStep]);

  // Handle low fuel confirmation
  const handleLowFuelConfirmation = useCallback(async (isAccurate: boolean) => {
    if (__DEV__) {
      console.log('[useFuelManagement] ⚠️ handleLowFuelConfirmation called', {
        isAccurate,
        motorId: selectedMotor?._id,
        currentFuelLevel: selectedMotor?.currentFuelLevel,
        timestamp: new Date().toISOString(),
      });
    }

    await handleLowFuelConfirmationUtil({
      selectedMotor,
      fuelLevel: selectedMotor?.currentFuelLevel || 0,
      isAccurate,
      onStartTracking: startTrackingFromFuelCheck,
      onUpdateFuelLevel: updateFuelLevel,
      onUpdateMotor: (motor: Motor) => setSelectedMotor(motor),
      onShowFuelUpdateModal: () => {
        setPendingFuelLevel(selectedMotor?.currentFuelLevel || 0);
        setFuelUpdateValue(selectedMotor?.currentFuelLevel?.toString() || '0');
        setShowFuelUpdateModal(true);
      },
      onHideFuelCheckModal: () => setShowFuelCheckModal(false),
      onSetFuelCheckStep: setFuelCheckStep,
    });
  }, [selectedMotor, startTrackingFromFuelCheck]);

  // Handle fuel update
  const handleFuelUpdate = useCallback(async () => {
    if (__DEV__) {
      console.log('[useFuelManagement] 🔄 handleFuelUpdate called', {
        fuelUpdateValue,
        fuelCheckStep,
        motorId: selectedMotor?._id,
        currentFuelLevel: selectedMotor?.currentFuelLevel,
        timestamp: new Date().toISOString(),
      });
    }

    await handleFuelUpdateUtil({
      selectedMotor,
      fuelUpdateValue,
      fuelCheckStep,
      onStartTracking: async () => {
        if (fuelCheckStep === 'confirmation' && parseFloat(fuelUpdateValue) <= 20) {
          setFuelCheckStep('low_fuel');
          setShowFuelCheckModal(true);
          return;
        }
        await startTrackingFromFuelCheck();
      },
      onUpdateFuelLevel: updateFuelLevel,
      onUpdateMotor: (motor: Motor) => setSelectedMotor(motor),
      onHideFuelUpdateModal: () => {
        setShowFuelUpdateModal(false);
        setFuelUpdateValue('');
      },
      onSetFuelCheckStep: setFuelCheckStep,
      onSetFuelUpdateValue: setFuelUpdateValue,
      onShowFuelCheckModal: () => setShowFuelCheckModal(true),
    });

    if (__DEV__) {
      console.log('[useFuelManagement] ✅ Fuel update handled', {
        newFuelLevel: fuelUpdateValue,
        timestamp: new Date().toISOString(),
      });
    }
  }, [selectedMotor, fuelUpdateValue, fuelCheckStep, startTrackingFromFuelCheck, setSelectedMotor]);

  return {
    // Fuel check states
    showFuelCheckModal,
    showFuelUpdateModal,
    fuelCheckStep,
    pendingFuelLevel,
    fuelUpdateValue,

    // Fuel check setters
    setShowFuelCheckModal,
    setShowFuelUpdateModal,
    setFuelCheckStep,
    setPendingFuelLevel,
    setFuelUpdateValue,

    // Fuel check handlers
    startFuelCheck,
    handleFuelConfirmation,
    handleLowFuelConfirmation,
    handleFuelUpdate,

    // Slider refs and handlers
    sliderTrackRef,
    sliderTrackLayoutRef,
    sliderPanResponder,
  };
};

