/**
 * FreeDrive Component
 * 
 * PRESENTATION + CONTROL LAYER ONLY
 * 
 * This component is designed as a pure presentation component that:
 * - Displays UI elements (buttons, stats, speedometer)
 * - Delegates ALL logic to parent via callbacks
 * - Does NOT handle:
 *   - Fuel level modal logic (handled by parent via onStartFuelCheck)
 *   - Map tilt on start (handled by parent via mapPitch state)
 *   - Trip summary modal on stop (handled by parent via onStopTracking)
 *   - Backend updates for maintenance (handled by parent via onMaintenanceAction)
 * 
 * Parent screen (RouteSelectionScreenOptimized.tsx) handles:
 * - Fuel level modal logic via useFuelManagement hook
 * - Map tilt on start via mapPitch state (45 degrees when isTracking && !isDestinationFlowActive)
 * - Trip summary modal on stop via stopTrackingUtil which calls onSetShowTripSummary(true)
 * - Backend updates for maintenance actions via handleMaintenanceAction -> useMaintenanceForm -> maintenanceUtils
 * 
 * @component
 * @example
 * ```tsx
 * <FreeDrive
 *   selectedMotor={motor}
 *   currentLocation={location}
 *   isTracking={isTracking}
 *   rideStats={stats}
 *   onStartTracking={handleStart}
 *   onStopTracking={handleStop}
 *   onStatsUpdate={handleStatsUpdate}
 *   onFuelUpdate={handleFuelUpdate}
 *   onMaintenanceAction={handleMaintenance}
 *   onStartFuelCheck={handleStartFuelCheck} // Parent handles fuel check modal
 * />
 * ```
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, Alert, Dimensions, Platform } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import type { Motor, LocationCoords, RideStats } from '../../types';
import { calculateFuelAfterDistance } from '../utils/fuelCalculation';
import { Speedometer } from '../../components/Speedometer';
// REMOVED: TrackingStats - now rendered in RouteSelectionScreenOptimized.tsx for better visibility

const { width, height } = Dimensions.get('window');

/**
 * Props for FreeDrive component
 * 
 * @interface FreeDriveProps
 * @property {Motor | null} selectedMotor - The currently selected motor
 * @property {LocationCoords | null} currentLocation - Current GPS location
 * @property {boolean} isTracking - Whether tracking is currently active
 * @property {RideStats} rideStats - Current ride statistics (distance, duration, speed)
 * @property {Motor[]} motorList - List of available motors
 * @property {() => void} onStartTracking - Callback when tracking starts
 * @property {() => void} onStopTracking - Callback when tracking stops
 * @property {(stats: RideStats) => void} onStatsUpdate - Callback when stats are updated
 * @property {(newFuelLevel: number) => void} onFuelUpdate - Callback when fuel level changes
 * @property {(actionType: 'refuel' | 'oil_change' | 'tune_up') => void} onMaintenanceAction - Callback for maintenance actions
 * @property {(motor: Motor) => void} onSelectMotor - Callback when motor is selected
 * @property {() => void} onShowMotorSelector - Callback to show motor selector modal
 * @property {() => void} onStartFuelCheck - Callback to start fuel check (before tracking)
 * @property {() => void} onShowReportModal - Callback to show report modal
 * @property {() => void} onShowRouteButton - Callback for route button (when not tracking)
 * @property {() => void} onToggleMarkersVisibility - Callback to toggle markers visibility
 * @property {() => void} onShowFilterModal - Callback to show filter modal
 * @property {boolean} showMarkers - Whether markers are currently visible
 * @property {any} navigation - Navigation object for navigation
 */
interface FreeDriveProps {
  selectedMotor: Motor | null;
  currentLocation: LocationCoords | null;
  isTracking: boolean;
  rideStats: RideStats;
  motorList: Motor[];
  onStartTracking: () => void;
  onStopTracking: () => void;
  onPauseTracking?: () => void;
  onResumeTracking?: () => void;
  onStatsUpdate: (stats: RideStats) => void;
  onFuelUpdate: (newFuelLevel: number) => void;
  onMaintenanceAction: (actionType: 'refuel' | 'oil_change' | 'tune_up') => void;
  onSelectMotor: (motor: Motor) => void;
  onShowMotorSelector: () => void;
  onStartFuelCheck: () => void;
  onShowReportModal: () => void;
  onShowRouteButton?: () => void;
  onToggleMarkersVisibility: () => void;
  onShowFilterModal: () => void;
  showMarkers: boolean;
  navigation?: any;
  isPaused?: boolean;
  hideActionButtons?: boolean; // Hide action buttons when destination flow is active
  hideFloatingButtons?: boolean; // Hide entire floating buttons container when destination flow is active
}

/**
 * FreeDrive component - Full UI component for free drive mode
 * 
 * This component handles:
 * - Fuel calculation based on distance traveled
 * - Incremental distance tracking to avoid duplicate calculations
 * - Stats updates and fuel level management
 * - Speedometer display
 * - Tracking stats display
 * - Floating buttons container (motor, play/stop, action buttons)
 * 
 * @param {FreeDriveProps} props - Component props
 * @returns {JSX.Element} Full UI component for free drive mode
 */
export const FreeDrive: React.FC<FreeDriveProps> = ({
  selectedMotor,
  currentLocation,
  isTracking,
  rideStats,
  motorList,
  onStartTracking,
  onStopTracking,
  onPauseTracking,
  onResumeTracking,
  onStatsUpdate,
  onFuelUpdate,
  onMaintenanceAction,
  onSelectMotor,
  onShowMotorSelector,
  onStartFuelCheck,
  onShowReportModal,
  onShowRouteButton,
  onToggleMarkersVisibility,
  onShowFilterModal,
  showMarkers,
  navigation,
  isPaused = false,
  hideActionButtons = false,
  hideFloatingButtons = false,
}) => {
  const lastProcessedDistanceRef = useRef<number>(0);
  const [isPausedState, setIsPausedState] = useState(false);

  /**
   * Handle stats update - DELEGATES TO PARENT
   * 
   * NOTE: This component calculates fuel consumption for display purposes only.
   * The parent component (RouteSelectionScreenOptimized) handles:
   * - Backend updates for fuel level
   * - Motor state updates
   * - Analytics calculations
   * 
   * This is a presentation layer calculation for real-time UI updates.
   * 
   * @param {RideStats} stats - Current ride statistics
   */
  const handleStatsUpdate = useCallback(async (stats: RideStats) => {
    if (stats.distance > 0 && selectedMotor) {
      // Calculate incremental distance (new distance since last update)
      const incrementalDistance = stats.distance - lastProcessedDistanceRef.current;

      // Only process fuel if there's significant new distance (at least 0.01km)
      if (incrementalDistance > 0.01) {
        try {
          // Calculate new fuel level using utility function (for UI display only)
          const newFuelLevel = await calculateFuelAfterDistance(selectedMotor, incrementalDistance);
          
          // Notify parent of fuel level change (parent handles backend update)
          onFuelUpdate(newFuelLevel);
          
          // Notify parent of stats update (parent handles analytics and backend)
          onStatsUpdate(stats);
        } catch (error) {
          if (__DEV__) {
            console.error('[FreeDrive] Error calculating fuel after distance:', error);
          }
        }
      }

      // Update the last processed distance
      lastProcessedDistanceRef.current = stats.distance;
    }
  }, [selectedMotor, onFuelUpdate, onStatsUpdate]);

  // Reset distance tracking when tracking starts
  useEffect(() => {
    if (isTracking) {
      lastProcessedDistanceRef.current = 0;
    }
  }, [isTracking]);

  /**
   * Handle motor selection button press
   */
  const handleMotorSelect = useCallback(() => {
    // If no motors available, navigate to AddMotorScreen
    if (motorList.length === 0) {
      if (navigation) {
        navigation.navigate('AddMotorScreen');
      }
      return;
    }
    // Otherwise, show motor selector modal
    onShowMotorSelector();
  }, [motorList, onShowMotorSelector, navigation]);

  /**
   * Handle play/stop button press
   */
  const handlePlayStopPress = useCallback(() => {
    if (isTracking) {
      onStopTracking();
    } else {
      onStartFuelCheck();
    }
  }, [isTracking, onStopTracking, onStartFuelCheck]);

  /**
   * Handle pause/resume button press
   */
  const handlePauseResumePress = useCallback(() => {
    if (isPausedState || isPaused) {
      // Resume tracking
      setIsPausedState(false);
      if (onResumeTracking) {
        onResumeTracking();
      }
    } else {
      // Pause tracking
      setIsPausedState(true);
      if (onPauseTracking) {
        onPauseTracking();
      }
    }
  }, [isPausedState, isPaused, onPauseTracking, onResumeTracking]);

  /**
   * Handle maintenance action - DELEGATES TO PARENT
   * 
   * Parent (RouteSelectionScreenOptimized) handles:
   * - handleMaintenanceAction: Opens maintenance form modal via useMaintenanceForm hook
   * - Backend updates: useMaintenanceForm -> maintenanceUtils -> saveMaintenanceRecord
   * - Motor state updates: Updates selectedMotor with new fuel level after refuel
   */
  const handleMaintenancePress = useCallback(() => {
    Alert.alert(
      'Record Maintenance',
      'Select maintenance type:',
      [
        {
          text: 'Refuel',
          onPress: () => onMaintenanceAction('refuel') // Parent handles backend update
        },
        {
          text: 'Oil Change',
          onPress: () => onMaintenanceAction('oil_change') // Parent handles backend update
        },
        {
          text: 'Tune Up',
          onPress: () => onMaintenanceAction('tune_up') // Parent handles backend update
        },
        {
          text: 'Cancel',
          style: 'cancel'
        }
      ]
    );
  }, [onMaintenanceAction]);

  return (
    <View style={styles.container}>
      {/* Speedometer - Only show when tracking */}
      {isTracking && (
        <View style={styles.speedometerContainer}>
          <Speedometer
            speed={rideStats?.speed || 0}
            isTracking={isTracking}
          />
        </View>
      )}

      {/* Tracking Stats - REMOVED: Now rendered in RouteSelectionScreenOptimized.tsx for better visibility */}

      {/* Floating Buttons Container - Hide when destination flow is active */}
      {!hideFloatingButtons && (
        <View style={styles.floatingButtonsContainer}>
        <View style={styles.rightButtons}>
          {/* Motor Selection Button */}
          <TouchableOpacity
            style={[styles.motorButton, { backgroundColor: '#2196F3' }]}
            onPress={handleMotorSelect}
          >
            <MaterialIcons 
              name={motorList.length === 0 ? "add-circle-outline" : "two-wheeler"} 
              size={width * 0.08} 
              color="#FFF" 
            />
            <Text style={styles.motorButtonText}>
              {selectedMotor?.nickname || (motorList.length === 0 ? 'Add Motor' : 'Select Motor')}
            </Text>
            {selectedMotor && motorList.length > 0 ? (
              <View style={styles.motorStats}>
                <MaterialIcons name="local-gas-station" size={width * 0.03} color="#FFF" />
                <Text style={styles.motorStatsText}>
                  {selectedMotor?.currentFuelLevel?.toFixed(0) || '0'}%
                </Text>
                <MaterialIcons name="speed" size={width * 0.03} color="#FFF" />
                <Text style={styles.motorStatsText}>
                  {selectedMotor?.fuelEfficiency || '0'} km/L
                </Text>
              </View>
            ) : motorList.length === 0 ? (
              <View style={styles.motorStats}>
                <Text style={styles.motorStatsText}>
                  Tap to add
                </Text>
              </View>
            ) : null}
          </TouchableOpacity>

          {/* Play/Stop Button */}
          <TouchableOpacity
            style={[
              styles.playButton,
              { backgroundColor: isTracking ? '#FF5722' : '#4CAF50' }
            ]}
            onPress={handlePlayStopPress}
          >
            <MaterialIcons
              name={isTracking ? 'stop' : 'play-arrow'}
              size={width * 0.08}
              color="#FFF"
            />
          </TouchableOpacity>

          {/* Pause/Resume Button - Only show when tracking */}
          {isTracking && (onPauseTracking || onResumeTracking) && (
            <TouchableOpacity
              style={[
                styles.pauseButton,
                { backgroundColor: (isPausedState || isPaused) ? '#4CAF50' : '#FF9800' }
              ]}
              onPress={handlePauseResumePress}
            >
              <MaterialIcons
                name={(isPausedState || isPaused) ? 'play-arrow' : 'pause'}
                size={width * 0.06}
                color="#FFF"
              />
            </TouchableOpacity>
          )}

          {/* Action Buttons - Hide when destination flow is active */}
          {!hideActionButtons && (
            <View style={styles.smallButtonsContainer}>
              <View style={styles.smallButtonsRow}>
                {/* Report Button */}
                <TouchableOpacity
                  style={[styles.smallButton, styles.reportButton]}
                  onPress={onShowReportModal}
                >
                  <MaterialIcons name="warning" size={width * 0.04} color="#FFF" />
                </TouchableOpacity>

                {/* Maintenance/Route Button */}
                {isTracking ? (
                  <TouchableOpacity
                    style={[styles.smallButton, styles.maintenanceButton]}
                    onPress={handleMaintenancePress}
                  >
                    <MaterialIcons name="build" size={width * 0.04} color="#FFF" />
                  </TouchableOpacity>
                ) : (
                  onShowRouteButton && (
                    <TouchableOpacity
                      style={[styles.smallButton, styles.routeButton]}
                      onPress={onShowRouteButton}
                    >
                      <MaterialIcons name="route" size={width * 0.04} color="#000" />
                    </TouchableOpacity>
                  )
                )}

                {/* Visibility Toggle Button */}
                {/* TAP: Toggles visibility (hides/shows all markers except user and destination) */}
                {/* LONG PRESS: Opens filter modal */}
                <TouchableOpacity
                  style={[
                    styles.smallButton,
                    { backgroundColor: showMarkers ? '#4CAF50' : '#9E9E9E' }
                  ]}
                  onPress={onToggleMarkersVisibility}
                  onLongPress={onShowFilterModal}
                  delayLongPress={500}
                >
                  <MaterialIcons
                    name="visibility"
                    size={width * 0.04}
                    color={showMarkers ? '#FFF' : '#000'}
                  />
                </TouchableOpacity>
              </View>
              <View style={styles.logoContainer}>
                <Text style={styles.logoText}>TrafficSlight</Text>
              </View>
            </View>
          )}
        </View>
      </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
  },
  speedometerContainer: {
    position: 'absolute',
    top: 160,
    right: 16,
    zIndex: 1000,
  },
  floatingButtonsContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
  },
  rightButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  motorButton: {
    height: height * 0.12,
    width: width * 0.28,
    borderRadius: 12,
    padding: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  motorButtonText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 4,
  },
  motorStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  motorStatsText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  playButton: {
    width: width * 0.2,
    height: width * 0.2,
    borderRadius: width * 0.1,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  pauseButton: {
    width: width * 0.15,
    height: width * 0.15,
    borderRadius: width * 0.075,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  smallButtonsContainer: {
    alignItems: 'center',
    gap: 8,
    justifyContent: 'center',
  },
  smallButtonsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  smallButton: {
    width: width * 0.12,
    height: width * 0.12,
    borderRadius: width * 0.06,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  reportButton: {
    backgroundColor: '#FF5722',
  },
  routeButton: {
    backgroundColor: '#FFF',
  },
  maintenanceButton: {
    backgroundColor: '#00ADB5',
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  logoText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#00ADB5',
    textAlign: 'center',
  },
});

