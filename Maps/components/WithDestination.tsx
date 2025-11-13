/**
 * WithDestination Component
 * 
 * Handles destination-based navigation:
 * - Works like Google Maps navigation
 * - Modal appears before starting: Select Motor, Select Destination
 * - After selection: Modal hides, Routes are drawn using polylines
 * - Routes can be filtered by: Traffic, Distance, Other conditions
 * - Confirmation dialog appears before navigation starts
 * - While driving: Map tilts slightly, Shows turn-by-turn instructions, Indicates proximity to destination
 * - Maintenance buttons remain accessible
 * 
 * @component
 * @example
 * ```tsx
 * <WithDestination
 *   selectedMotor={motor}
 *   currentLocation={location}
 *   destination={destination}
 *   selectedRoute={route}
 *   alternativeRoutes={routes}
 *   isNavigating={isNavigating}
 *   distanceRemaining={distance}
 *   timeElapsed={time}
 *   currentEta={eta}
 *   currentSpeed={speed}
 *   onSelectMotor={handleMotorSelect}
 *   onSelectDestination={handleDestinationSelect}
 *   onSelectRoute={handleRouteSelect}
 *   onStartNavigation={handleStartNavigation}
 *   onStopNavigation={handleStopNavigation}
 *   onReroute={handleReroute}
 *   onMaintenanceAction={handleMaintenance}
 *   motorList={motors}
 * />
 * ```
 */

import React, { useCallback, useEffect, useState, useRef } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, Modal, ActivityIndicator, ScrollView, Alert } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import Toast from 'react-native-toast-message';
import type { Motor, LocationCoords, RouteData } from '../../types';
import { canReachDestination, calculateDistancePossible } from '../utils/fuelCalculation';
import { PredictiveAnalytics } from './PredictiveAnalytics';
import { distanceToPolyline, haversineDistance, coordinatesToPolyline } from '../utils/geo';
import { RouteSelectionModal } from '../../components/RouteSelectionModal-mapscreentry';
// REMOVED: Separate fuel polling API - now uses fuel level from selectedMotor (updated by tracking hook)

// Fuel level data interface
interface FuelLevelData {
  percentage: number;
  liters: number;
  fuelTankCapacity: number;
  drivableDistance: number;
  isLowFuel: boolean;
}

/**
 * Props for WithDestination component
 * 
 * @interface WithDestinationProps
 * @property {Motor | null} selectedMotor - The currently selected motor
 * @property {LocationCoords | null} currentLocation - Current GPS location
 * @property {LocationCoords | null} destination - Destination location
 * @property {RouteData | null} selectedRoute - Currently selected route
 * @property {RouteData[]} alternativeRoutes - Alternative route options
 * @property {boolean} isNavigating - Whether navigation is currently active
 * @property {number} distanceRemaining - Distance remaining to destination (km)
 * @property {number} timeElapsed - Time elapsed since navigation started (seconds)
 * @property {number} currentEta - Current estimated time of arrival (seconds)
 * @property {number} currentSpeed - Current speed (km/h)
 * @property {number} [distanceTraveled=0] - Distance traveled during navigation (km)
 * @property {(motor: Motor) => void} onSelectMotor - Callback when motor is selected
 * @property {(destination: LocationCoords) => void} onSelectDestination - Callback when destination is selected
 * @property {(route: RouteData) => void} onSelectRoute - Callback when route is selected
 * @property {() => void} onStartNavigation - Callback when navigation starts
 * @property {() => void} onStopNavigation - Callback when navigation stops
 * @property {() => void} onReroute - Callback when route needs to be recalculated
 * @property {(actionType: 'refuel' | 'oil_change' | 'tune_up') => void} onMaintenanceAction - Callback for maintenance actions
 * @property {Motor[]} motorList - List of available motors
 */
interface WithDestinationProps {
  selectedMotor: Motor | null;
  currentLocation: LocationCoords | null;
  destination: LocationCoords | null;
  selectedRoute: RouteData | null;
  alternativeRoutes: RouteData[];
  isNavigating: boolean;
  distanceRemaining: number;
  timeElapsed: number;
  currentEta: number;
  currentSpeed: number;
  distanceTraveled?: number; // Optional: distance traveled during navigation
  onSelectMotor: (motor: Motor) => void;
  onSelectDestination: (destination: LocationCoords) => void;
  onSelectRoute: (route: RouteData) => void;
  onStartNavigation: () => void;
  onStopNavigation: (hasArrived?: boolean) => void; // Optional hasArrived parameter: true if arrived, false if manually stopped
  onReroute: () => void;
  onMaintenanceAction: (actionType: 'refuel' | 'oil_change' | 'tune_up') => void;
  motorList: Motor[];
  onSelectDestinationPress?: () => void; // Callback to open destination selection UI
  onSelectFromMapPress?: () => void; // Callback to directly activate map selection mode
  onCancel?: () => void; // Callback to cancel destination flow and return to original state
  currentFlowState?: 'initial' | 'searching' | 'destination_selected' | 'routes_found' | 'navigating' | 'completed'; // Current flow state
  onGetRoutes?: () => void; // Callback to fetch routes
  isRoutesLoading?: boolean; // Whether routes are being fetched
  isMapSelectionActive?: boolean; // Whether map selection is currently active
  mapFilters?: { showTrafficReports: boolean; showGasStations: boolean }; // Map filter state for marker visibility
  onToggleMarkersVisibility?: () => void; // Callback to toggle markers visibility
  onShowFilterModal?: () => void; // Callback to show filter modal (long press)
}

/**
 * Utility function to format time in seconds to MM:SS or HH:MM:SS
 */
const formatTime = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
};

/**
 * Utility function to format distance in km
 */
const formatDistance = (distance: number): string => {
  if (distance < 1) {
    return `${Math.round(distance * 1000)}m`;
  }
  return `${distance.toFixed(1)}km`;
};

/**
 * Utility function to format speed
 */
const formatSpeed = (speed: number): string => {
  return `${Math.round(speed)} km/h`;
};

/**
 * WithDestination component - Full UI component for destination-based navigation
 * 
 * This component handles:
 * - Destination reachability checking (with PredictiveAnalytics integration)
 * - Navigation confirmation flow
 * - Route selection logic
 * - Motor selection modal
 * - Destination selection UI
 * - Navigation UI with real-time stats
 * - Maintenance buttons
 * - Fuel warnings and maintenance reminders (via PredictiveAnalytics)
 */
export const WithDestination: React.FC<WithDestinationProps> = ({
  selectedMotor,
  currentLocation,
  destination,
  selectedRoute,
  alternativeRoutes,
  isNavigating,
  distanceRemaining,
  timeElapsed,
  currentEta,
  currentSpeed,
  distanceTraveled = 0,
  onSelectMotor,
  onSelectDestination,
  onSelectRoute,
  onStartNavigation,
  onStopNavigation,
  onReroute,
  onMaintenanceAction,
  motorList,
  onSelectDestinationPress,
  onSelectFromMapPress,
  onCancel,
  currentFlowState = 'initial',
  onGetRoutes,
  isRoutesLoading = false,
  isMapSelectionActive = false,
  mapFilters,
  onToggleMarkersVisibility,
  onShowFilterModal,
}) => {
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [showMotorSelectionModal, setShowMotorSelectionModal] = useState(false);
  const [showRouteSelectionModal, setShowRouteSelectionModal] = useState(false);
  const [routeModalManuallyClosed, setRouteModalManuallyClosed] = useState(false); // Track manual close
  const [canReachDestinationState, setCanReachDestinationState] = useState(true);
  const [fuelWarning, setFuelWarning] = useState<string | null>(null);
  
  // Fuel level state - Now derived from selectedMotor (updated by tracking hook via API)
  // No need for separate polling since tracking hook updates fuel every 5 seconds via /api/trip/update-distance
  // The tracking hook calls /api/trip/update-distance and updates selectedMotor.currentFuelLevel via parent
  const fuelLevelData: FuelLevelData | null = React.useMemo(() => {
    if (!selectedMotor) return null;
    
    const percentage = selectedMotor.currentFuelLevel ?? 0;
    const fuelTank = selectedMotor.fuelTank || 0;
    const fuelEfficiency = selectedMotor.fuelEfficiency || selectedMotor.fuelConsumption || 0;
    
    return {
      percentage,
      liters: fuelTank > 0 ? (percentage / 100) * fuelTank : 0,
      fuelTankCapacity: fuelTank,
      drivableDistance: fuelEfficiency > 0 && fuelTank > 0 && percentage > 0
        ? (fuelEfficiency * fuelTank * (percentage / 100))
        : 0,
      isLowFuel: percentage <= 10,
    };
  }, [selectedMotor?.currentFuelLevel, selectedMotor?.fuelTank, selectedMotor?.fuelEfficiency, selectedMotor?.fuelConsumption]);
  
  // Auto-show route selection modal when routes are found (unless manually closed)
  useEffect(() => {
    if (currentFlowState === 'routes_found' && (selectedRoute || alternativeRoutes.length > 0) && !isNavigating && !routeModalManuallyClosed) {
      setShowRouteSelectionModal(true);
    } else if (isNavigating || currentFlowState === 'navigating') {
      setShowRouteSelectionModal(false);
      setRouteModalManuallyClosed(false); // Reset on navigation start
    }
  }, [currentFlowState, selectedRoute, alternativeRoutes, isNavigating, routeModalManuallyClosed]);
  
  // Reset manual close flag when new routes are fetched
  useEffect(() => {
    if (currentFlowState === 'routes_found' && (selectedRoute || alternativeRoutes.length > 0)) {
      // Reset manual close flag when routes change (new routes fetched)
      // This allows modal to show again for new routes
      setRouteModalManuallyClosed(false);
    }
  }, [selectedRoute?.id, alternativeRoutes.length, currentFlowState]);
  
  // Deviation detection and rerouting states
  const [rerouting, setRerouting] = useState(false);
  const [offRouteCount, setOffRouteCount] = useState(0);
  const [routeHistory, setRouteHistory] = useState<Array<{ timestamp: number; reason: string }>>([]);
  const [arrivalProximity, setArrivalProximity] = useState<number | null>(null);
  const lastRerouteTime = useRef<number>(0);
  const rerouteCooldown = 5000; // 5 seconds cooldown between reroutes
  const hasShownProximity500 = useRef(false);
  const hasShownProximity200 = useRef(false);
  const hasShownProximity50 = useRef(false);

  /**
   * Close all modals related to WithDestination
   */
  const closeAllModals = useCallback(() => {
    setShowMotorSelectionModal(false);
    setShowRouteSelectionModal(false);
    setShowConfirmationModal(false);
  }, []);
  
  /**
   * Close route selection modal and keep routes visible on map
   */
  const handleCloseRouteModal = useCallback(() => {
    setShowRouteSelectionModal(false);
    setRouteModalManuallyClosed(true); // Mark as manually closed to prevent auto-show
    if (__DEV__) {
      console.log('[WithDestination] Route selection modal closed, routes remain visible on map');
    }
  }, []);

  /**
   * Check if destination is reachable with current fuel
   */
  useEffect(() => {
    if (selectedMotor && selectedRoute && destination) {
      const canReach = canReachDestination(selectedMotor, selectedRoute.distance);
      setCanReachDestinationState(canReach);
      
      if (!canReach) {
        const distancePossible = calculateDistancePossible(selectedMotor);
        setFuelWarning(
          `Warning: Cannot reach destination. You can only travel ${formatDistance(distancePossible)} with current fuel.`
        );
      } else {
        setFuelWarning(null);
      }
    }
  }, [selectedMotor, selectedRoute, destination]);

  /**
   * Deviation detection and automatic rerouting
   * Detects when user goes off-route and triggers rerouting
   */
  useEffect(() => {
    if (!isNavigating || !selectedRoute || !currentLocation) {
      setOffRouteCount(0);
      return;
    }

    const polyline = coordinatesToPolyline(selectedRoute.coordinates || []);
    if (!polyline || polyline.length === 0) {
      return;
    }

    // Calculate distance from current location to route polyline
    const distMeters = distanceToPolyline(currentLocation, polyline);

    // Dynamic threshold based on speed (30m urban, up to 100m highway)
    const baseThreshold = 30; // meters
    const speedFactor = Math.min(1 + (currentSpeed / 60), 2); // Scale up to 2x at 60+ km/h
    const threshold = baseThreshold * speedFactor;

    const deviated = distMeters > threshold;

    // Update off-route count and check if reroute should be triggered
    setOffRouteCount((prevCount) => {
      if (deviated) {
        const newCount = prevCount + 1;
        
        // Trigger reroute if deviated for multiple consecutive updates (at least 2) and not already rerouting
        const now = Date.now();
        const canReroute = !rerouting && 
                          newCount >= 2 && 
                          (now - lastRerouteTime.current) > rerouteCooldown;

        if (canReroute) {
          // Use setTimeout to avoid state update conflicts
          setTimeout(() => {
            setRerouting(true);
            lastRerouteTime.current = now;

            // Show toast notification
            Toast.show({
              type: 'info',
              text1: 'Off Route Detected',
              text2: 'Rerouting to destination...',
              visibilityTime: 3000,
            });

            // Record reroute in history
            setRouteHistory((prev) => [
              ...prev,
              {
                timestamp: now,
                reason: `Deviation detected: ${Math.round(distMeters)}m off route`,
              },
            ]);

            // Trigger reroute
            try {
              onReroute();
              // Reset rerouting state after a delay (allows parent to update route)
              setTimeout(() => {
                setRerouting(false);
                setOffRouteCount(0);
              }, 1000);
            } catch (e) {
              console.warn('[WithDestination] Reroute failed:', e);
              Toast.show({
                type: 'error',
                text1: 'Reroute Failed',
                text2: 'Could not calculate new route. Please try again.',
                visibilityTime: 3000,
              });
              setTimeout(() => {
                setRerouting(false);
                setOffRouteCount(0);
              }, 1000);
            }
          }, 0);
        }
        
        return newCount;
      } else {
        return 0; // Reset if back on route
      }
    });
  }, [currentLocation, isNavigating, selectedRoute, currentSpeed, rerouting, onReroute]);

  /**
   * Arrival detection with proximity prompts
   * Shows prompts at 500m, 200m, 50m and stops navigation at 30m
   */
  useEffect(() => {
    if (!isNavigating || !selectedRoute || !currentLocation || !destination) {
      setArrivalProximity(null);
      return;
    }

    const distToDest = haversineDistance(
      [currentLocation.longitude, currentLocation.latitude],
      [destination.longitude, destination.latitude]
    );

    setArrivalProximity(distToDest);

    // Proximity prompts
    if (distToDest <= 500 && !hasShownProximity500.current) {
      hasShownProximity500.current = true;
      Toast.show({
        type: 'info',
        text1: 'Approaching Destination',
        text2: 'You are 500m away from your destination',
        visibilityTime: 3000,
      });
    }

    if (distToDest <= 200 && !hasShownProximity200.current) {
      hasShownProximity200.current = true;
      Toast.show({
        type: 'info',
        text1: 'Almost There',
        text2: 'You are 200m away from your destination',
        visibilityTime: 3000,
      });
    }

    if (distToDest <= 50 && !hasShownProximity50.current) {
      hasShownProximity50.current = true;
      Toast.show({
        type: 'success',
        text1: 'Arriving Soon',
        text2: 'You are 50m away from your destination',
        visibilityTime: 3000,
      });
    }

    // Stop navigation when close enough (30m threshold) - AUTOMATIC ARRIVAL
    if (distToDest <= 30) {
      // Pass hasArrived=true to indicate user reached destination
      onStopNavigation(true);
      Toast.show({
        type: 'success',
        text1: 'Trip Complete',
        text2: 'You have arrived at your destination',
        visibilityTime: 4000,
      });

      // Reset proximity flags for next trip
      hasShownProximity500.current = false;
      hasShownProximity200.current = false;
      hasShownProximity50.current = false;
    }
  }, [currentLocation, isNavigating, selectedRoute, destination, onStopNavigation]);

  /**
   * Reset proximity flags and internal state when navigation stops
   */
  useEffect(() => {
    if (!isNavigating) {
      // Reset proximity flags
      hasShownProximity500.current = false;
      hasShownProximity200.current = false;
      hasShownProximity50.current = false;
      
      // Reset navigation-related state
      setArrivalProximity(null);
      setOffRouteCount(0);
      setRerouting(false);
      
      // Fuel level data is now derived from selectedMotor, no cleanup needed
      
      // Reset modals to ensure clean state for next trip
      setShowConfirmationModal(false);
      setShowMotorSelectionModal(false);
      setShowRouteSelectionModal(false);
      setRouteModalManuallyClosed(false);
    }
  }, [isNavigating]);

  /**
   * Fuel level is now updated automatically by the tracking hook via /api/trip/update-distance
   * The tracking hook calls the API every 5 seconds and updates selectedMotor.currentFuelLevel
   * No need for separate polling - fuel level is derived from selectedMotor prop
   */

  /**
   * Handle navigation start with confirmation
   */
  const handleStartNavigationClick = useCallback(() => {
    if (!selectedMotor || !destination || !selectedRoute) {
      Alert.alert(
        'Missing Information',
        'Please select a motor, destination, and route before starting navigation.',
        [{ text: 'OK' }]
      );
      return;
    }

    // Check fuel again before showing confirmation
    const canReach = canReachDestination(selectedMotor, selectedRoute.distance);
    if (!canReach) {
      Alert.alert(
        'Insufficient Fuel',
        'You may not have enough fuel to reach your destination. Please refuel before starting navigation.',
        [{ text: 'OK' }]
      );
      return;
    }

    // Show confirmation dialog
    setShowConfirmationModal(true);
  }, [selectedMotor, destination, selectedRoute]);

  /**
   * Confirm navigation start
   */
  const confirmStartNavigation = useCallback(() => {
    setShowConfirmationModal(false);
    onStartNavigation();
  }, [onStartNavigation]);

  /**
   * Handle motor selection
   */
  const handleMotorSelect = useCallback((motor: Motor) => {
    onSelectMotor(motor);
    setShowMotorSelectionModal(false);
  }, [onSelectMotor]);

  /**
   * Handle route selection
   */
  const handleRouteSelect = useCallback((route: RouteData) => {
    onSelectRoute(route);
    setShowRouteSelectionModal(false);
  }, [onSelectRoute]);

  /**
   * Handle stop navigation with confirmation
   */
  const handleStopNavigation = useCallback(() => {
    Alert.alert(
      'Stop Navigation',
      'Are you sure you want to stop navigation? This will mark the trip as incomplete.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Stop', 
          style: 'destructive',
          onPress: () => {
            // MANUAL STOP: Pass hasArrived=false to indicate user did not reach destination
            onStopNavigation(false);
          }
        },
      ]
    );
  }, [onStopNavigation]);

  return (
    <View style={styles.container}>
      {/* Predictive Analytics Component - Provides fuel warnings and maintenance reminders */}
      <PredictiveAnalytics
        selectedMotor={selectedMotor}
        currentLocation={currentLocation}
        destination={destination}
        selectedRoute={selectedRoute}
        distanceTraveled={distanceTraveled}
        onDestinationUnreachable={(distancePossible, distanceRequired) => {
          // This callback is already handled by our local fuel warning state
          console.warn('[WithDestination] Destination unreachable:', {
            distancePossible,
            distanceRequired,
          });
        }}
      />
      
      {/* Motor Selection Modal */}
      <Modal
        visible={showMotorSelectionModal}
        animationType="slide"
        transparent={true}
        onRequestClose={closeAllModals}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Motor</Text>
              <TouchableOpacity
                onPress={closeAllModals}
                style={styles.closeButton}
              >
                <MaterialIcons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScrollView}>
              {motorList.length === 0 ? (
                <Text style={styles.emptyText}>No motors available</Text>
              ) : (
                motorList.map((motor) => (
                  <TouchableOpacity
                    key={motor._id}
                    style={[
                      styles.motorItem,
                      selectedMotor?._id === motor._id && styles.motorItemSelected
                    ]}
                    onPress={() => handleMotorSelect(motor)}
                  >
                    <MaterialIcons 
                      name={selectedMotor?._id === motor._id ? "radio-button-checked" : "radio-button-unchecked"} 
                      size={24} 
                      color={selectedMotor?._id === motor._id ? "#4CAF50" : "#999"} 
                    />
                    <View style={styles.motorItemInfo}>
                      <Text style={styles.motorItemName}>
                        {motor.nickname || `Motor ${motor._id.slice(-4)}`}
                      </Text>
                      <View style={styles.motorItemDetailsContainer}>
                        <View style={styles.motorItemDetailRow}>
                          <MaterialIcons name="local-gas-station" size={16} color="#666" />
                          <Text style={styles.motorItemDetails}>
                            Fuel: <Text style={styles.motorItemDetailValue}>{motor.currentFuelLevel?.toFixed(1) || 0}%</Text>
                          </Text>
                        </View>
                        <View style={styles.motorItemDetailRow}>
                          <MaterialIcons name="oil-barrel" size={16} color="#666" />
                          <Text style={styles.motorItemDetails}>
                            Tank: <Text style={styles.motorItemDetailValue}>{motor.fuelTank || 0}L</Text>
                          </Text>
                        </View>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Route Selection Modal - Use proper RouteSelectionModal component */}
      {/* CRITICAL: When X is pressed, close modal but keep routes visible on map */}
      <RouteSelectionModal
        visible={showRouteSelectionModal || (currentFlowState === 'routes_found' && !isNavigating && !routeModalManuallyClosed)}
        onClose={handleCloseRouteModal}
        bestRoute={selectedRoute}
        alternatives={alternativeRoutes}
        selectedRouteId={selectedRoute?.id || null}
        onSelectRoute={(routeId: string) => {
          // Find the route by ID and select it
          const routeToSelect = selectedRoute?.id === routeId 
            ? selectedRoute 
            : alternativeRoutes.find(r => r.id === routeId);
          if (routeToSelect) {
            handleRouteSelect(routeToSelect);
          }
        }}
        selectedMotor={selectedMotor}
        isNavigating={isNavigating}
        onStartNavigation={handleStartNavigationClick}
        onViewRoute={() => {
          // Close modal and show route on map
          // The route is already visible on the map, just close the modal
          if (__DEV__) {
            console.log('[WithDestination] View Route pressed, closing modal');
          }
          handleCloseRouteModal();
        }}
      />

      {/* Confirmation Modal */}
      <Modal
        visible={showConfirmationModal}
        animationType="fade"
        transparent={true}
        onRequestClose={closeAllModals}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confirmationModalContent}>
            <MaterialIcons name="navigation" size={48} color="#4CAF50" style={styles.confirmationIcon} />
            <Text style={styles.confirmationTitle}>Start Navigation?</Text>
            {selectedRoute && (
              <View style={styles.confirmationDetails}>
                <View style={styles.confirmationDetailRow}>
                  <MaterialIcons name="straighten" size={20} color="#666" />
                  <Text style={styles.confirmationDetailText}>
                    Distance: {formatDistance(selectedRoute.distance)}
                  </Text>
                </View>
                <View style={styles.confirmationDetailRow}>
                  <MaterialIcons name="schedule" size={20} color="#666" />
                  <Text style={styles.confirmationDetailText}>
                    Estimated Time: {formatTime(selectedRoute.duration || 0)}
                  </Text>
                </View>
                {selectedMotor && (
                  <View style={styles.confirmationDetailRow}>
                    <MaterialIcons name="local-gas-station" size={20} color="#666" />
                    <Text style={styles.confirmationDetailText}>
                      Fuel: {selectedMotor.currentFuelLevel?.toFixed(1) || 0}%
                    </Text>
                  </View>
                )}
              </View>
            )}
            {fuelWarning && (
              <View style={styles.warningContainer}>
                <MaterialIcons name="warning" size={20} color="#FF9800" />
                <Text style={styles.warningText}>{fuelWarning}</Text>
              </View>
            )}
            <View style={styles.confirmationButtons}>
              {/* View Route Details Button - Replaces Cancel button */}
              <TouchableOpacity
                style={[styles.confirmationButton, styles.viewRouteDetailsButton]}
                onPress={() => {
                  // Close confirmation modal and show route details modal again
                  setShowConfirmationModal(false);
                  setShowRouteSelectionModal(true);
                  setRouteModalManuallyClosed(false); // Allow modal to show again
                  if (__DEV__) {
                    console.log('[WithDestination] View Route Details pressed, reopening route selection modal');
                  }
                }}
                activeOpacity={0.7}
              >
                <MaterialIcons name="visibility" size={20} color="#00ADB5" style={{ marginRight: 8 }} />
                <Text style={styles.viewRouteDetailsButtonText}>View Route Details</Text>
              </TouchableOpacity>
              {/* Start Navigation Button - Green */}
              <TouchableOpacity
                style={[styles.confirmationButton, styles.startButton]}
                onPress={confirmStartNavigation}
                activeOpacity={0.7}
              >
                <MaterialIcons name="navigation" size={20} color="#FFF" style={{ marginRight: 8 }} />
                <Text style={styles.startButtonText}>Start Navigation</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Pre-Navigation Controls */}
      {!isNavigating && (
        <View style={styles.preNavigationControls}>

          {/* Start Navigation Button */}
          {selectedMotor && destination && selectedRoute && (
            <TouchableOpacity
              style={[
                styles.startNavigationButton,
                !canReachDestinationState && styles.startNavigationButtonDisabled
              ]}
              onPress={handleStartNavigationClick}
              disabled={!canReachDestinationState}
            >
              <MaterialIcons name="navigation" size={24} color="#FFF" />
              <Text style={styles.startNavigationButtonText}>Start Navigation</Text>
            </TouchableOpacity>
          )}

          {/* Fuel Warning */}
          {fuelWarning && (
            <View style={styles.fuelWarningBanner}>
              <MaterialIcons name="warning" size={20} color="#FF9800" />
              <Text style={styles.fuelWarningText}>{fuelWarning}</Text>
            </View>
          )}

          {/* View Route Details Button - Reopens route selection modal if user pressed X */}
          {/* Hide when map selection is active */}
          {(destination || selectedRoute) && !isMapSelectionActive && (
            <TouchableOpacity
              style={styles.viewRouteDetailsFlowButton}
              onPress={() => {
                // Reopen route selection modal so user can view routes again
                setShowRouteSelectionModal(true);
                setRouteModalManuallyClosed(false); // Allow modal to show
                if (__DEV__) {
                  console.log('[WithDestination] View Route Details pressed from pre-navigation controls, reopening route selection modal');
                }
              }}
              activeOpacity={0.7}
            >
              <MaterialIcons name="visibility" size={20} color="#00ADB5" />
              <Text style={styles.viewRouteDetailsFlowButtonText}>View Route Details</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Rerouting Overlay - Shows during automatic rerouting */}
      {rerouting && isNavigating && (
        <View style={styles.reroutingOverlay}>
          <ActivityIndicator size="small" color="#FFF" />
          <Text style={styles.reroutingText}>Rerouting…</Text>
        </View>
      )}

      {/* Navigation UI - Active Navigation */}
      {isNavigating && (
        <View style={styles.navigationContainer}>
          {/* Navigation Stats */}
          <View style={styles.navigationStats}>
            <View style={styles.statItem}>
              <MaterialIcons name="straighten" size={20} color="#FFF" />
              <Text style={styles.statValue}>{formatDistance(distanceRemaining)}</Text>
              <Text style={styles.statLabel}>Remaining</Text>
            </View>
            <View style={styles.statItem}>
              <MaterialIcons 
                name={fuelLevelData?.isLowFuel ? "warning" : "local-gas-station"} 
                size={20} 
                color={fuelLevelData?.isLowFuel ? "#FF9800" : "#FFF"} 
              />
              {fuelLevelData ? (
                <>
                  <Text style={[
                    styles.statValue,
                    fuelLevelData.isLowFuel && styles.lowFuelText
                  ]}>
                    {fuelLevelData.percentage.toFixed(0)}%
                  </Text>
                  {fuelLevelData.liters > 0 && (
                    <Text style={styles.statSubValue}>
                      {fuelLevelData.liters.toFixed(1)}L
                    </Text>
                  )}
                </>
              ) : (
                <Text style={styles.statValue}>--</Text>
              )}
              <Text style={styles.statLabel}>
                {fuelLevelData?.isLowFuel ? 'Low Fuel' : 'Fuel'}
              </Text>
            </View>
            <View style={styles.statItem}>
              <MaterialIcons name="speed" size={20} color="#FFF" />
              <Text style={styles.statValue}>{formatSpeed(currentSpeed)}</Text>
              <Text style={styles.statLabel}>Speed</Text>
            </View>
            <View style={styles.statItem}>
              <MaterialIcons name="timer" size={20} color="#FFF" />
              <Text style={styles.statValue}>{formatTime(timeElapsed)}</Text>
              <Text style={styles.statLabel}>Time</Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.navigationActions}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => onReroute()}
            >
              <MaterialIcons name="refresh" size={20} color="#333" />
              <Text style={styles.actionButtonText}>Reroute</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => onMaintenanceAction('refuel')}
            >
              <MaterialIcons name="local-gas-station" size={20} color="#333" />
              <Text style={styles.actionButtonText}>Refuel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => onMaintenanceAction('oil_change')}
            >
              <MaterialIcons name="build" size={20} color="#333" />
              <Text style={styles.actionButtonText}>Oil</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.stopButton]}
              onPress={handleStopNavigation}
            >
              <MaterialIcons name="stop" size={20} color="#FFF" />
              <Text style={[styles.actionButtonText, styles.stopButtonText]}>Stop</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Floating Action Button - Eye Button for Toggling Markers Visibility */}
      {/* TAP: Toggles visibility (hides/shows all markers except user and destination) */}
      {/* LONG PRESS: Opens filter modal */}
      {onToggleMarkersVisibility && (
        <TouchableOpacity
          style={[
            styles.eyeFAB,
            {
              backgroundColor: mapFilters?.showTrafficReports && mapFilters?.showGasStations
                ? '#4CAF50'
                : '#9E9E9E',
            },
          ]}
          onPress={onToggleMarkersVisibility}
          onLongPress={onShowFilterModal}
          delayLongPress={500}
          activeOpacity={0.7}
        >
          <MaterialIcons
            name="visibility"
            size={24}
            color={mapFilters?.showTrafficReports && mapFilters?.showGasStations ? '#FFF' : '#000'}
          />
        </TouchableOpacity>
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
  
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 5,
  },
  modalScrollView: {
    flex: 1,
    paddingHorizontal: 20,
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    marginTop: 40,
    fontSize: 16,
  },
  
  // Motor Selection Styles
  motorItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    marginVertical: 5,
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
  },
  motorItemSelected: {
    backgroundColor: '#E8F5E9',
    borderWidth: 2,
    borderColor: '#4CAF50',
  },
  motorItemInfo: {
    marginLeft: 15,
    flex: 1,
  },
  motorItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 5,
  },
  motorItemDetailsContainer: {
    marginTop: 8,
    gap: 6,
  },
  motorItemDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  motorItemDetails: {
    fontSize: 14,
    color: '#666',
  },
  motorItemDetailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#00ADB5',
  },
  
  // Route Selection Styles
  routeItemContainer: {
    marginVertical: 10,
  },
  routeSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  routeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    marginVertical: 5,
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
  },
  routeItemSelected: {
    backgroundColor: '#E8F5E9',
    borderWidth: 2,
    borderColor: '#4CAF50',
  },
  routeItemInfo: {
    marginLeft: 15,
    flex: 1,
  },
  routeItemDistance: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 5,
  },
  routeItemDuration: {
    fontSize: 14,
    color: '#666',
  },
  rerouteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
    padding: 15,
    borderRadius: 10,
    marginTop: 10,
    marginBottom: 20,
  },
  rerouteButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 10,
  },
  
  // Confirmation Modal Styles
  confirmationModalContent: {
    backgroundColor: '#FFF',
    margin: 20,
    borderRadius: 20,
    padding: 25,
    alignItems: 'center',
  },
  confirmationIcon: {
    marginBottom: 15,
  },
  confirmationTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
  },
  confirmationDetails: {
    width: '100%',
    marginBottom: 20,
  },
  confirmationDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
  },
  confirmationDetailText: {
    fontSize: 16,
    color: '#666',
    marginLeft: 10,
  },
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
    width: '100%',
  },
  warningText: {
    fontSize: 14,
    color: '#FF9800',
    marginLeft: 10,
    flex: 1,
  },
  confirmationButtons: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
  },
  confirmationButton: {
    flex: 1,
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  cancelButton: {
    backgroundColor: '#E0E0E0',
  },
  cancelButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
  },
  viewRouteDetailsButton: {
    backgroundColor: '#FFF',
    borderWidth: 2,
    borderColor: '#00ADB5',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#00ADB5',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  viewRouteDetailsButtonText: {
    color: '#00ADB5',
    fontSize: 16,
    fontWeight: '600',
  },
  startButton: {
    backgroundColor: '#4CAF50',
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  startButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  
  // Pre-Navigation Controls
  preNavigationControls: {
    backgroundColor: '#FFF',
    padding: 15,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  controlButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    padding: 12,
    borderRadius: 10,
    marginBottom: 10,
  },
  destinationButtonContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  destinationButton: {
    flex: 1,
    marginBottom: 0,
  },
  mapSelectButton: {
    width: 50,
    marginBottom: 0,
    justifyContent: 'center',
    padding: 12,
  },
  getRoutesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00ADB5',
    padding: 12,
    borderRadius: 10,
    marginBottom: 10,
  },
  controlButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 10,
  },
  startNavigationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
    padding: 15,
    borderRadius: 10,
    marginTop: 10,
  },
  startNavigationButtonDisabled: {
    backgroundColor: '#9E9E9E',
    opacity: 0.6,
  },
  startNavigationButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  fuelWarningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    padding: 12,
    borderRadius: 8,
    marginTop: 10,
  },
  fuelWarningText: {
    fontSize: 14,
    color: '#FF9800',
    marginLeft: 10,
    flex: 1,
  },
  cancelFlowButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F44336',
    padding: 12,
    borderRadius: 10,
    marginTop: 10,
  },
  cancelFlowButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  viewRouteDetailsFlowButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF',
    borderWidth: 2,
    borderColor: '#00ADB5',
    padding: 12,
    borderRadius: 10,
    marginTop: 10,
    shadowColor: '#00ADB5',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  viewRouteDetailsFlowButtonText: {
    color: '#00ADB5',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  
  // Navigation UI Styles
  navigationContainer: {
    backgroundColor: '#FFF',
    padding: 15,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  navigationStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#333',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
    marginTop: 5,
    marginBottom: 3,
  },
  statSubValue: {
    fontSize: 12,
    color: '#BBB',
    marginTop: -2,
  },
  statLabel: {
    fontSize: 12,
    color: '#BBB',
    textTransform: 'uppercase',
  },
  lowFuelText: {
    color: '#FF9800',
  },
  errorText: {
    color: '#F44336',
    fontSize: 14,
  },
  navigationActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F5F5',
    padding: 12,
    borderRadius: 10,
    marginHorizontal: 5,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  stopButton: {
    backgroundColor: '#F44336',
  },
  stopButtonText: {
    color: '#FFF',
  },
  // Eye FAB (Floating Action Button) Styles
  // Positioned on the right side of the screen, similar to location button
  eyeFAB: {
    position: 'absolute',
    right: 16,
    bottom: 200, // Position above the pre-navigation controls and other bottom elements
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    zIndex: 2000,
  },
  // Rerouting Overlay Styles
  reroutingOverlay: {
    position: 'absolute',
    top: 10,
    left: '50%',
    transform: [{ translateX: -60 }],
    padding: 12,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  reroutingText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
});

