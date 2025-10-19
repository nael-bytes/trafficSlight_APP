import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  StyleSheet,
  Alert,
} from 'react-native';
import MaterialIcons from "react-native-vector-icons/MaterialIcons";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { LinearGradient } from 'expo-linear-gradient';
import Toast from 'react-native-toast-message';

import { useUser } from "../../AuthContext/UserContextImproved";
import { getCurrentLocationWithCache } from "../../utils/locationCache";
import { startBackgroundLocationTracking, stopBackgroundLocationTracking } from "../../utils/backgroundLocation";
import { backgroundStateManager } from "../../utils/backgroundStateManager";

// Import custom hooks
import { useMapState } from '../../hooks/useMapState-mapscreentry';
import { useRouteHandling } from '../../hooks/useRouteHandling-mapscreentry';
import { useMotorManagement } from '../../hooks/useMotorManagement-mapscreentry';

// Import components
import { MapContainer } from '../../components/MapContainer-mapscreentry';
import { SearchModal } from '../../components/SearchModal-mapscreentry';
import { RouteSelectionModal } from '../../components/RouteSelectionModal-mapscreentry';
import { NavigationControls } from '../../components/NavigationControls-mapscreentry';
import { FlowStateIndicator } from '../../components/FlowStateIndicator-mapscreentry';
import { MaintenanceModal } from '../../components/MaintenanceModal-mapscreentry';
import { TripDetailsModal } from '../../components/TripDetailsModal-mapscreentry';
import { TripSummaryModal } from '../../components/TripSummaryModal-mapscreentry';

// Import optimized modules
import { useMapSelectionHandlers, reverseGeocodeLocation } from '../../utils/map-selection-handlers-mapscreentry';
import { useMaintenanceHandlers } from '../../utils/maintenance-handlers-mapscreentry';
import { isUserOffRoute, getTrafficLabel } from '../../utils/map-utils-mapscreentry';

// Import types
import type { LocationCoords, RouteData, TripSummary, TrafficIncident } from '../../types';

type FlowState = 'searching' | 'destination_selected' | 'routes_found' | 'navigating' | 'completed';

export default function MapScreenTryRefactored({ navigation }: { navigation: any }) {
  // Custom hooks
  const {
    mapState,
    navigationState,
    uiState,
    mapRef,
    searchRef,
    setCurrentLocation,
    setDestination,
    setRegion,
    setIsFollowingUser,
    setIsNavigating,
    setCurrentSpeed,
    setDistanceRemaining,
    setTimeElapsed,
    setCurrentEta,
    setCurrentFuelUsed,
    setIsOverSpeedLimit,
    setNavigationStartTime,
    updateUiState,
  } = useMapState();

  const {
    selectedRouteId,
    selectedRoute,
    alternativeRoutes,
    tripSummary,
    pathCoords,
    finalPathCoords,
    distanceTraveled,
    x,
    setSelectedRouteId,
    setSelectedRoute,
    setAlternativeRoutes,
    setTripSummary,
    setPathCoords,
    setFinalPathCoords,
    setDistanceTraveled,
    setXValue,
    handleRouteSelect,
    fetchRoutes,
  } = useRouteHandling();

  const {
    motorList,
    selectedMotor,
    loading,
    handleMotorSelect,
  } = useMotorManagement(useUser().user?._id);

  // Additional state
  const [currentFlowState, setCurrentFlowState] = useState<FlowState>('searching');
  const [searchText, setSearchText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [reports, setReports] = useState<TrafficIncident[]>([]);
  const [gasStations, setGasStations] = useState<any[]>([]);
  const [showReports, setShowReports] = useState(false);
  const [showGasStations, setShowGasStations] = useState(false);
  const [startAddress, setStartAddress] = useState<string>('');
  const [fuelLevel, setFuelLevel] = useState<number>(0);
  const [maintenanceFormData, setMaintenanceFormData] = useState({
    type: '' as '' | 'oil_change' | 'refuel' | 'tune_up',
    cost: '',
    quantity: '',
    notes: ''
  });

  // Map selection state
  const [mapSelectionState, setMapSelectionState] = useState({
    selectedLocation: null as LocationCoords | null,
    isSelecting: false,
  });

  // Flow state manager
  const flowStateManager = useCallback((newState: FlowState, options?: {
    resetData?: boolean;
    closeModals?: boolean;
    openModal?: keyof typeof uiState;
  }) => {
    setCurrentFlowState(prev => prev === newState ? prev : newState);
    
    if (options?.resetData) {
      setDestination(null);
      setSelectedRoute(null);
      setSelectedRouteId(null);
      setAlternativeRoutes([]);
      setTripSummary(null);
    }
    
    if (options?.closeModals) {
      updateUiState({
        showSearchModal: false,
        showBottomSheet: false,
        showTripSummary: false,
        showTripDetails: false,
        showReportModal: false,
        showMaintenanceForm: false,
        showFuelModal: false,
        isMapSelectionMode: false,
      });
    }
    
    if (options?.openModal) {
      updateUiState({ [options.openModal]: true });
    }
  }, [setDestination, setSelectedRoute, setSelectedRouteId, setAlternativeRoutes, setTripSummary, updateUiState]);

  // Map selection handlers
  const {
    startMapSelection: originalStartMapSelection,
    cancelMapSelection,
    handleMapPress,
    confirmMapSelection,
  } = useMapSelectionHandlers(
    uiState,
    updateUiState,
    mapSelectionState,
    setMapSelectionState,
    setDestination,
    mapState.currentLocation,
    setCurrentLocation,
    flowStateManager
  );

  // Maintenance handlers
  const { handleMaintenanceFormSave: originalHandleMaintenanceFormSave, handleMaintenanceFormChange, handleFuelLevelUpdate } = useMaintenanceHandlers(
    selectedMotor,
    mapState.currentLocation,
    useUser().user,
    (visible: boolean) => updateUiState({ showMaintenanceForm: visible }),
    (data: any) => setMaintenanceFormData(data)
  );

  // Wrap handleMaintenanceFormSave to match expected signature
  const handleMaintenanceFormSave = useCallback(() => {
    originalHandleMaintenanceFormSave(maintenanceFormData);
  }, [originalHandleMaintenanceFormSave, maintenanceFormData]);

  // Wrap startMapSelection with debugging
  const startMapSelection = useCallback(() => {
    console.log("🚀 startMapSelection called from MapScreenTryRefactored");
    originalStartMapSelection();
  }, [originalStartMapSelection]);

  // Load location on mount
  useEffect(() => {
    const loadLocation = async () => {
      try {
        const cachedLoc = await getCurrentLocationWithCache(false);
        if (cachedLoc) {
          setCurrentLocation({
            latitude: cachedLoc.latitude,
            longitude: cachedLoc.longitude,
          });
          setRegion({
            latitude: cachedLoc.latitude,
            longitude: cachedLoc.longitude,
            latitudeDelta: 0.0015,
            longitudeDelta: 0.0015,
          });
        }
      } catch (error) {
        console.error('[MapScreen] Failed to load location:', error);
      }
    };

    loadLocation();
  }, [setCurrentLocation, setRegion]);

  // Handle destination selection
  const handleDestinationSelect = useCallback((destination: LocationCoords) => {
    setDestination(destination);
    setRegion({
      latitude: destination.latitude,
      longitude: destination.longitude,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    });
    flowStateManager('destination_selected');
    updateUiState({ showSearchModal: false });
  }, [setDestination, setRegion, flowStateManager, updateUiState]);

  // Handle place selected close modal
  const handlePlaceSelectedCloseModal = useCallback(() => {
    updateUiState({ showSearchModal: false });
  }, [updateUiState]);

  // Handle route selection
  const handleRouteSelection = useCallback((id: string) => {
    handleRouteSelect(id);
    updateUiState({ showBottomSheet: false });
  }, [handleRouteSelect, updateUiState]);

  // Handle bottom sheet close
  const handleBottomSheetClose = useCallback(() => {
    updateUiState({ showBottomSheet: false });
  }, [updateUiState]);

  // Handle maintenance action
  const handleMaintenanceAction = useCallback((type: 'refuel' | 'oil_change' | 'tune_up') => {
    updateUiState({ showMaintenanceForm: true });
  }, [updateUiState]);

  // Handle end navigation
  const handleEndNavigation = useCallback(() => {
    setIsNavigating(false);
    setNavigationStartTime(null);
    setIsFollowingUser(false);
    flowStateManager('completed');
  }, [setIsNavigating, setNavigationStartTime, setIsFollowingUser, flowStateManager]);

  // Handle show details
  const handleShowDetails = useCallback(() => {
    updateUiState({ showTripDetails: true });
  }, [updateUiState]);

  // Animate to region
  const animateToRegion = useCallback((newRegion: any) => {
    if (mapRef.current) {
      mapRef.current.animateToRegion(newRegion, 1000);
    }
  }, [mapRef]);

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safeArea}>
        {/* Flow State Indicator */}
        <FlowStateIndicator currentFlowState={currentFlowState} />

        {/* Destination Selection Button - Always visible when no destination */}
        {!mapState.destination && currentFlowState === 'searching' && (
          <View style={styles.destinationSelectionContainer}>
            <TouchableOpacity
              onPress={() => updateUiState({ showSearchModal: true })}
              style={styles.destinationSelectionButton}
            >
              <LinearGradient
                colors={['#00ADB5', '#00858B']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.destinationSelectionGradient}
              >
                <MaterialIcons name="search" size={24} color="#fff" />
                <Text style={styles.destinationSelectionText}>Choose Destination</Text>
                <MaterialIcons name="arrow-forward" size={20} color="#fff" />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}

        {/* Destination Display */}
        {mapState.destination && currentFlowState === 'destination_selected' && (
          <View style={styles.destinationHeader}>
            <TouchableOpacity
              onPress={() => updateUiState({ showSearchModal: true })}
              style={styles.destinationContainer}
            >
              <View style={styles.destinationContent}>
                <MaterialIcons name="place" size={20} color="#00ADB5" />
                <Text style={styles.destinationText} numberOfLines={1}>
                  {mapState.destination.address || 'Selected destination'}
                </Text>
                <MaterialIcons name="edit" size={16} color="#666" />
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* Search Modal */}
        <SearchModal
          visible={uiState.showSearchModal}
          onClose={() => {
            if (mapState.destination && (selectedRoute || selectedRouteId)) {
              updateUiState({ showSearchModal: false });
            } else {
              setSearchText("");
              updateUiState({ showSearchModal: false });
              if (navigation?.canGoBack()) {
                navigation.goBack();
              } else {
                navigation.navigate("MainTabs", { screen: "Map" });
              }
            }
          }}
          searchRef={searchRef}
          searchText={searchText}
          setSearchText={setSearchText}
          isTyping={isTyping}
          setIsTyping={setIsTyping}
          onDestinationSelect={handleDestinationSelect}
          animateToRegion={animateToRegion}
          selectedMotor={selectedMotor}
          onMotorSelect={handleMotorSelect}
          motorList={motorList}
          onPlaceSelectedCloseModal={handlePlaceSelectedCloseModal}
          userId={useUser().user?._id}
          onMapSelection={startMapSelection}
        />

        {/* Map Container */}
        <MapContainer
          mapRef={mapRef}
          region={mapState.region}
          mapStyle="standard"
          currentLocation={mapState.currentLocation}
          destination={mapState.destination}
          userId={useUser().user?._id}
          reportMarkers={reports}
          gasStations={gasStations}
          showReports={showReports}
          showGasStations={showGasStations}
          onMapPress={handleMapPress}
          selectedMapLocation={mapSelectionState.selectedLocation}
          routeCoordinates={selectedRoute?.coordinates}
          snappedRouteCoordinates={pathCoords}
          isTracking={navigationState.isNavigating}
          onReportVoted={() => {}}
        />

        {/* Route Selection Modal */}
        <RouteSelectionModal
          visible={uiState.showBottomSheet}
          onClose={handleBottomSheetClose}
          bestRoute={tripSummary}
          alternatives={alternativeRoutes}
          selectedRouteId={selectedRouteId}
          onSelectRoute={handleRouteSelection}
          selectedMotor={selectedMotor}
          isNavigating={navigationState.isNavigating}
        />

        {/* Navigation Controls */}
        <NavigationControls
          isNavigating={navigationState.isNavigating}
          currentSpeed={navigationState.currentSpeed}
          distanceRemaining={navigationState.distanceRemaining}
          timeElapsed={navigationState.timeElapsed}
          currentEta={navigationState.currentEta}
          isOverSpeedLimit={navigationState.isOverSpeedLimit}
          onEndNavigation={handleEndNavigation}
          onShowDetails={handleShowDetails}
          onMaintenanceAction={handleMaintenanceAction}
        />

        {/* Map Selection Confirmation Modal */}
        {uiState.isMapSelectionMode && mapSelectionState.selectedLocation && (
          <View style={styles.mapSelectionModalContainer}>
            <View style={styles.mapSelectionModal}>
              <View style={styles.mapSelectionHeader}>
                <MaterialIcons name="place" size={24} color="#00ADB5" />
                <Text style={styles.mapSelectionTitle}>Confirm Location</Text>
              </View>
              
              <View style={styles.mapSelectionContent}>
                <Text style={styles.mapSelectionAddress}>
                  {mapSelectionState.selectedLocation?.address || "Selected location"}
                </Text>
                <Text style={styles.mapSelectionCoordinates}>
                  {mapSelectionState.selectedLocation?.latitude.toFixed(6)}, {mapSelectionState.selectedLocation?.longitude.toFixed(6)}
                </Text>
              </View>

              <View style={styles.mapSelectionButtons}>
                <TouchableOpacity
                  style={styles.mapSelectionCancelButton}
                  onPress={cancelMapSelection}
                >
                  <Text style={styles.mapSelectionCancelText}>Cancel</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.mapSelectionConfirmButton}
                  onPress={confirmMapSelection}
                >
                  <LinearGradient
                    colors={['#00ADB5', '#00858B']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.mapSelectionConfirmGradient}
                  >
                    <Text style={styles.mapSelectionConfirmText}>Confirm</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* Maintenance Modal */}
        <MaintenanceModal
          visible={uiState.showMaintenanceForm}
          formData={maintenanceFormData}
          onClose={() => updateUiState({ showMaintenanceForm: false })}
          onSave={handleMaintenanceFormSave}
          onChange={(field, value) => setMaintenanceFormData(prev => ({ ...prev, [field]: value }))}
        />

        {/* Trip Details Modal */}
        <TripDetailsModal
          visible={uiState.showTripDetails}
          onClose={() => updateUiState({ showTripDetails: false })}
          currentSpeed={navigationState.currentSpeed}
          distanceRemaining={navigationState.distanceRemaining}
          timeElapsed={navigationState.timeElapsed}
          currentEta={navigationState.currentEta}
          currentFuel={fuelLevel}
          currentFuelUsed={navigationState.currentFuelUsed}
          isOverSpeedLimit={navigationState.isOverSpeedLimit}
          selectedRoute={selectedRoute}
          selectedMotor={selectedMotor}
          distanceTraveled={distanceTraveled}
        />

        {/* Trip Summary Modal */}
        <TripSummaryModal
          visible={uiState.showTripSummary}
          onClose={() => updateUiState({ showTripSummary: false })}
          tripSummary={tripSummary}
          selectedMotor={selectedMotor}
          distanceTraveled={distanceTraveled}
          timeElapsed={navigationState.timeElapsed}
          fuelUsed={navigationState.currentFuelUsed}
          startAddress={startAddress}
          destinationAddress={mapState.destination?.address}
        />

        <Toast />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  destinationSelectionContainer: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
    zIndex: 100,
  },
  destinationSelectionButton: {
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  destinationSelectionGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  destinationSelectionText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 12,
    marginRight: 8,
  },
  destinationHeader: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  destinationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  destinationContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  destinationText: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    marginLeft: 8,
  },
  mapSelectionModalContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  mapSelectionModal: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    margin: 20,
    minWidth: 300,
  },
  mapSelectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  mapSelectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginLeft: 8,
  },
  mapSelectionContent: {
    marginBottom: 20,
  },
  mapSelectionAddress: {
    fontSize: 16,
    color: '#333',
    marginBottom: 8,
  },
  mapSelectionCoordinates: {
    fontSize: 14,
    color: '#666',
  },
  mapSelectionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  mapSelectionCancelButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginRight: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
  },
  mapSelectionCancelText: {
    fontSize: 16,
    color: '#666',
  },
  mapSelectionConfirmButton: {
    flex: 1,
    marginLeft: 8,
    borderRadius: 8,
    overflow: 'hidden',
  },
  mapSelectionConfirmGradient: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  mapSelectionConfirmText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
});
