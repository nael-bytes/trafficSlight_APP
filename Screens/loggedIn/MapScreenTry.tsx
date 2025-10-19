import React, { useState, useRef, useEffect, useCallback, useMemo, Dispatch, SetStateAction } from "react";
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
  Animated,
  Image,
} from "react-native";
import MaterialIcons from "react-native-vector-icons/MaterialIcons";
import { SafeAreaProvider } from "react-native-safe-area-context";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import { LinearGradient } from 'expo-linear-gradient';
// useColorScheme removed - not used
import Toast from 'react-native-toast-message';

import * as Location from "expo-location";
import * as FileSystem from "expo-file-system";
import polyline from "@mapbox/polyline";
import { GOOGLE_MAPS_API_KEY, LOCALHOST_IP } from "@env";
import { useUser } from "../../AuthContext/UserContextImproved";
import { getCurrentLocationWithCache } from "../../utils/locationCache";
import { startBackgroundLocationTracking, stopBackgroundLocationTracking, resumeTrackingFromBackground, safeStopBackgroundLocation } from "../../utils/backgroundLocation";
import { backgroundStateManager } from "../../utils/backgroundStateManager";


import SearchBar from "./SearchBar";
// react-native-get-random-values removed - not used
import { usePredictiveAnalytics } from './usePredictiveAnalytics';
import Speedometer from "./Speedometer";
import { calculateTotalPathDistance, calcDistance } from '../screens/utils/mapUtils';
// lodash removed - not used
import AsyncStorage from "@react-native-async-storage/async-storage";
import { calculateFuelLevelAfterRefuel, calculateNewFuelLevel } from '../../utils/fuelCalculations';
import { useAppData } from '../../hooks/useAppData';
import { MapComponent } from '../../components/MapComponent';
import { TrafficReportModal } from '../../components/TrafficReportModal';

// Import optimized modules
import { useMapSelectionHandlers, reverseGeocodeLocation } from '../../utils/map-selection-handlers-mapscreentry';
// useRouteHandlers removed - not used yet
// useUIStateManager removed - not used yet
import { useMaintenanceHandlers } from '../../utils/maintenance-handlers-mapscreentry';
// useNavigationHandlers removed - not used yet
import { 
  isUserOffRoute, 
  getTrafficLabel
} from '../../utils/map-utils-mapscreentry';
// Import types from centralized types file
import type { LocationCoords, RouteData, TripSummary, TrafficIncident } from '../../types';

type MaintenanceAction = {
  type: 'oil_change' | 'refuel' | 'tune_up';
  timestamp: number;
  location: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  details: {
    cost: number;  // Change from optional to required
    quantity?: number;
    notes?: string;
  };
};

type MapRef = React.RefObject<MapView>;
type SearchRef = React.RefObject<any>;

type MaintenanceFormData = {
  type: '' | 'oil_change' | 'refuel' | 'tune_up';
  cost: string;
  quantity: string;
  notes: string;
};

type MaintenanceFormProps = {
  visible: boolean;
  formData: MaintenanceFormData;
  onClose: () => void;
  onSave: () => void;
  onChange: (field: string, value: string) => void;
};

// Add these types near the top with other type definitions
type MotorAnalytics = {
  totalDistance: number;
  tripsCompleted: number;
  totalFuelUsed: number;
};

// Update type definitions at the top of the file
type FuelType = 'Regular' | 'Diesel' | 'Premium';
type OilType = 'Mineral' | 'Semi-Synthetic' | 'Synthetic';

interface Motor {
  _id: string;
  name: string;
  fuelEfficiency: number;
  fuelType: FuelType;
  oilType: OilType;
  age: number;
  totalDistance: number;
  currentFuelLevel: number;
  fuelTank: number;
  lastMaintenanceDate?: string;
  lastOilChange?: string;
  lastRegisteredDate?: string;
  lastTripDate?: string;
  lastRefuelDate?: string;
  fuelLevel: number;
  oilChangeDue: boolean;
  maintenanceDue: boolean;
  analytics: MotorAnalytics;
  nickname?: string;
  engineDisplacement?: number;
  totalDrivableDistanceWithCurrentGas?: number;
  totalDrivableDistance?: number;
  motorcycleData?: {
    fuelTank: number;

  };
}


// ----------------------------------------------------------------
// Constants
// ----------------------------------------------------------------
const DEFAULT_TRAFFIC_RATE = 1;
const ARRIVAL_THRESHOLD = 50; // meters before declaring arrival
const MAX_RECENT_LOCATIONS = 10;
const OFFLINE_TILES_PATH = `${FileSystem.cacheDirectory}map_tiles/`;
const VOICE_NAV_DELAY = 3000;


// Helper functions are now imported from map-utils-mapscreentry.ts

// Calculate fuel range based on distance and efficiency
const calculateFuelRange = (distance: number, fuelEfficiency: number) => {
  const base = distance / fuelEfficiency;
  return {
    min: base * 0.9,
    max: base * 1.1,
    avg: base,
  };
};

// fetch routes



// ----------------------------------------------------------------
// Components
// ----------------------------------------------------------------
type RouteDetailsBottomSheetProps = {
  visible: boolean;
  bestRoute: RouteData | null;
  alternatives: RouteData[];
  onClose: () => void;
  selectedRouteId: string | null;
  onSelectRoute: (id: string) => void;
  selectedMotor: Motor | null;
  isNavigating: boolean;
};

// getTrafficLabel is now imported from map-utils-mapscreentry.ts


const RouteDetailsBottomSheet = React.memo(
  ({
    visible,
    bestRoute,
    alternatives,
    onClose,
    selectedRouteId,
    onSelectRoute,
    selectedMotor,
    isNavigating,
  }: RouteDetailsBottomSheetProps) => {
    const [sortCriteria, setSortCriteria] = useState<"fuel" | "traffic" | "distance">("distance");
    const [showAnalyticsModal, setShowAnalyticsModal] = useState(false);

    const sortedRoutes = useMemo(() => {
      if (!bestRoute) return [];
      const all = [bestRoute, ...(alternatives || [])].filter(Boolean);
      return all.sort((a, b) => {
        if (!a || !b) return 0;
        if (sortCriteria === "fuel") return a.fuelEstimate - b.fuelEstimate;
        if (sortCriteria === "traffic") return a.trafficRate - b.trafficRate;
        return a.distance - b.distance;
      });
    }, [sortCriteria, bestRoute, alternatives]);

    // Don't show the bottom sheet if navigating or if not visible or no best route
    if (isNavigating || !visible || !bestRoute) return null;

    return (
      <View style={styles.bottomSheetContainer}>
        <LinearGradient
          colors={['#00ADB5', '#00858B']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.bottomSheetHeader}
        >
          <Text style={styles.bottomSheetTitle}>Available Routes</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <MaterialIcons name="close" size={24} color="#fff" />
          </TouchableOpacity>
        </LinearGradient>

        <View style={styles.sortContainer}>
          <Text style={styles.sortLabel}>Sort Routes By:</Text>
          <View style={styles.sortButtonsContainer}>
            <TouchableOpacity
              style={[styles.sortButton, sortCriteria === "fuel" && styles.sortButtonActive]}
              onPress={() => setSortCriteria("fuel")}
            >
              <Text style={[styles.sortButtonText, sortCriteria === "fuel" && styles.sortButtonTextActive]}>
                FUEL
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sortButton, sortCriteria === "traffic" && styles.sortButtonActive]}
              onPress={() => setSortCriteria("traffic")}
            >
              <Text style={[styles.sortButtonText, sortCriteria === "traffic" && styles.sortButtonTextActive]}>
                TRAFFIC
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sortButton, sortCriteria === "distance" && styles.sortButtonActive]}
              onPress={() => setSortCriteria("distance")}
            >
              <Text style={[styles.sortButtonText, sortCriteria === "distance" && styles.sortButtonTextActive]}>
                DISTANCE
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView style={styles.bottomSheetContent}>
          {sortedRoutes.map((route, index) => (
            <TouchableOpacity
              key={route.id}
              style={[styles.routeCard, selectedRouteId === route.id && styles.selectedRouteCard]}
              onPress={() => onSelectRoute(route.id)}
              disabled={isNavigating} // Disable route selection during navigation
            >
              {index === 0 && (
                <View style={styles.recommendedTag}>
                  <MaterialIcons name="star" size={20} color="#FFD700" />
                  <Text style={styles.recommendedText}>Recommended Route</Text>
                </View>
              )}

              <View style={styles.routeDetail}>
                <View style={styles.iconContainer}>
                  <MaterialIcons name="local-gas-station" size={24} color="#00ADB5" />
                </View>
                <View style={styles.detailContent}>
                  <Text style={styles.detailLabel}>Estimated Fuel </Text>
                  <Text style={styles.detailValue}>
                    {

                      route.fuelEstimate <= 0.02
                        ? "~0 L"
                        : `${Math.max(0.1, (route.fuelEstimate - 0.03)).toFixed(2)}L – ${Math.max(
                          0.1,
                          (route.fuelEstimate + 0.03)
                        ).toFixed(2)} L`}
                  </Text>

                </View>
              </View>

              <View style={styles.routeDetail}>
                <View style={styles.iconContainer}>
                  <MaterialIcons name="straighten" size={24} color="#00ADB5" />
                </View>
                <View style={styles.detailContent}>
                  <Text style={styles.detailLabel}>Total Distance</Text>
                  <Text style={styles.detailValue}>
                    {(route.distance / 1000).toFixed(2)} km
                  </Text>
                </View>
              </View>

              <View style={styles.routeDetail}>
                <View style={styles.iconContainer}>
                  <MaterialIcons name="schedule" size={24} color="#00ADB5" />
                </View>
                <View style={styles.detailContent}>
                  <Text style={styles.detailLabel}>Estimated Time</Text>
                  <Text style={styles.detailValue}>
                    {(route.duration / 60).toFixed(0)} minutes
                  </Text>
                </View>
              </View>

              <View style={styles.routeDetail}>
                <View style={styles.iconContainer}>
                  <MaterialIcons name="traffic" size={24} color="#00ADB5" />
                </View>
                <View style={styles.detailContent}>
                  <Text style={styles.detailLabel}>Traffic Condition</Text>
                  <Text style={styles.detailValue}>
                    {getTrafficLabel(route.trafficRate)}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  }
);


// NEED NA MAPALITAN OR MAILIPAT SA ROUTESELECTION LAHAT.
const TrafficIncidentMarker = ({ incident }: { incident: TrafficIncident }) => (
  <Marker coordinate={incident.location}>
    <View style={styles.incidentMarker}>
      <MaterialIcons
        name={
          incident.type === "Accident" ? "warning" :
            incident.type === "Hazard" ? "report-problem" :
              incident.type === "Road Closure" ? "block" :
                incident.type === "Traffic Jam" ? "traffic" :

                  "info"
        }
        size={24}
        color={incident.severity === "high" ? "#e74c3c" : "#f39c12"}
      />

    </View>
  </Marker>
);

const getIcon = (type) => {
  switch (type) {
    case "Accident": return require("../../assets/icons/ROAD INCIDENTS ICON/Road_Accident.png");

    case "Traffic Jam": return require("../../assets/icons/ROAD INCIDENTS ICON/Traffic_Jam.png");
    case "Hazard": return require("../../assets/icons/ROAD INCIDENTS ICON/Hazard.png");
    case "Road Closure": return require("../../assets/icons/ROAD INCIDENTS ICON/Road_Closure.png");
    //GAS STATIONS
    case "Caltex": return require("../../assets/icons/GAS_STATIONS/CALTEX.png");
    case "Cleanfuel": return require("../../assets/icons/GAS_STATIONS/CLEANFUEL.png");
    case "Flying V": return require("../../assets/icons/GAS_STATIONS/FLYINGV.png");
    case "Jetti": return require("../../assets/icons/GAS_STATIONS/JETTI.png");
    case "Petro Gazz": return require("../../assets/icons/GAS_STATIONS/PETROGAZZ.png");
    case "Petron": return require("../../assets/icons/GAS_STATIONS/PETRON.png");
    case "Phoenix": return require("../../assets/icons/GAS_STATIONS/PHOENIX.png");
    case "Rephil": return require("../../assets/icons/GAS_STATIONS/REPHIL.png");
    case "Seaoil": return require("../../assets/icons/GAS_STATIONS/SEAOIL.png");
    case "Shell": return require("../../assets/icons/GAS_STATIONS/SHELL.png");
    case "Total": return require("../../assets/icons/GAS_STATIONS/TOTAL.png");
    case "Unioil": return require("../../assets/icons/GAS_STATIONS/UNIOIL.png");
    default: return require("../../assets/icons/default.png");
  }
};

// const [showFuelModal, setShowFuelModal] = useState(false);
//   const [fuelLevelInput, setFuelLevelInput] = useState(0);

// Update backend
// const updateFuelLevel = async (motorID: [any], fuelLevel: [Number]) => {
//   try {
//     const response = await fetch(`https://ts-backend-1-jyit.onrender.com/api/user-motors/${motorID}`, {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify({

//         fuelLevel: Number(fuelLevel),
//       }),
//     });

//     if (!response.ok) throw new Error("Failed to update fuel level");

//     Alert.alert("Success", "Fuel level updated successfully!");
//     setFuelLevelInput(0);
//     setShowFuelModal(false);
//   } catch (error) {
//     Alert.alert("Error", error.message);
//   }
// };

// ----------------------------------------------------------------
// Main Component
// ----------------------------------------------------------------
export default function NavigationApp({ navigation }: { navigation: any }) {
  // Refs
  const mapRef = useRef<MapView>(null);
  const searchRef = useRef<any>(null);
  const voiceNavTimeout = useRef<NodeJS.Timeout>();
  const isBackgroundTracking = useRef(false);
  const backgroundTrackingId = useRef<string | null>(null);
  
  // Debouncing refs to prevent excessive API calls
  const apiCallTimeout = useRef<NodeJS.Timeout | null>(null);
  const lastApiCallTime = useRef<number>(0);
  const API_CALL_THROTTLE = 2000; // 2 seconds minimum between API calls

  // Authenticated user context
  const { user } = useUser();

  // Optimized: Load cached data only once on mount
  useEffect(() => {
    if (!user?._id) return;
    
    let isMounted = true;
    
    const loadCachedData = async () => {
      try {
        const cachedMotors = await AsyncStorage.getItem(`cachedMotors_${user._id}`);
        if (cachedMotors && isMounted) {
          setMotorList(JSON.parse(cachedMotors));
          const motorsWithAnalytics = await fetchMotorAnalytics(user._id);
          if (motorsWithAnalytics.length > 0 && isMounted) {
            setMotorList(motorsWithAnalytics);
            setSelectedMotor(motorsWithAnalytics[0]);
          }
        }
      } catch (err) {
        console.warn("Failed to load cache:", err);
      }
    };

    loadCachedData();
    
    return () => {
      isMounted = false;
    };
  }, [user?._id]); // Only depend on user._id

  // Function to fetch motorcycle details and populate fuelTank
  const fetchMotorcycleDetails = useCallback(async (motorcycleId: string) => {
    try {
      const response = await fetch(`${LOCALHOST_IP}/api/motorcycles/${motorcycleId}`);
      if (response.ok) {
        const motorcycleData = await response.json();
        return motorcycleData.fuelTank || 15; // Default to 15L if not provided
      }
    } catch (error) {
      console.warn('[MapScreen] Failed to fetch motorcycle details:', error);
    }
    return 15; // Default fallback
  }, []);

  const [showFuelModal, setShowFuelModal] = useState(false);
  const [fuelLevelInput, setFuelLevelInput] = useState(0);
  // Load cached location on mount
  useEffect(() => {
    const loadLocation = async () => {
      try {
        const cachedLoc = await getCurrentLocationWithCache(false);
        if (cachedLoc) {
          console.log('[MapScreen] Loaded cached location:', cachedLoc);
          setMapState(prev => ({
            ...prev,
            currentLocation: {
              latitude: cachedLoc.latitude,
              longitude: cachedLoc.longitude,
            },
            region: {
              latitude: cachedLoc.latitude,
              longitude: cachedLoc.longitude,
              latitudeDelta: 0.0015,
              longitudeDelta: 0.0015,
            } as any,
          }));
        } else {
          // If no cache, get fresh location
          const freshLoc = await getCurrentLocationWithCache(true);
          if (freshLoc) {
            setMapState(prev => ({
              ...prev,
              currentLocation: {
                latitude: freshLoc.latitude,
                longitude: freshLoc.longitude,
              },
              region: {
                latitude: freshLoc.latitude,
                longitude: freshLoc.longitude,
                latitudeDelta: 0.0015,
                longitudeDelta: 0.0015,
              } as any,
            }));
          }
        }
      } catch (error) {
        console.error('[MapScreen] Failed to load location:', error);
      }
    };

    loadLocation();
  }, []);

  // Optimized: Fetch motors only when user changes, with cleanup
  useEffect(() => {
    if (!user?._id) return;
    
    let isMounted = true;
    
    const fetchMotors = async () => {
      try {
        const motorsWithAnalytics = await fetchMotorAnalytics(user._id);
        if (motorsWithAnalytics.length > 0 && isMounted) {
          setMotorList(motorsWithAnalytics);
          setSelectedMotor(motorsWithAnalytics[0]);
        }
      } catch (error) {
        console.error("Failed to fetch motors:", error);
        if (isMounted) {
          Alert.alert(
            "Error",
            "Failed to fetch motor data. Please try again later.",
            [{ text: "OK" }]
          );
        }
      }
    };

    fetchMotors();
    
    return () => {
      isMounted = false;
    };
  }, [user?._id]); // Only depend on user._id, not entire user object


  const [x, setXValue] = useState(0);
  // Flow States - Clean organized flow
  type FlowState = 'searching' | 'destination_selected' | 'routes_found' | 'navigating' | 'completed';
  const [currentFlowState, setCurrentFlowState] = useState<FlowState>('searching');

  // Centralized UI State Management - Memoized to prevent unnecessary re-renders
  const [uiState, setUiState] = useState({
    showSearchModal: false,
    showBottomSheet: false,
    showTripSummary: false,
    showTripDetails: false,
    showReportModal: false,
    showMaintenanceForm: false,
    showFuelModal: false,
    isMapSelectionMode: false,
  });

  // Centralized state update function - Memoized with stable reference
  const updateUiState = useCallback((updates: Partial<typeof uiState>) => {
    setUiState(prev => {
      // Only update if there are actual changes
      const hasChanges = Object.keys(updates).some(key => 
        prev[key as keyof typeof prev] !== updates[key as keyof typeof updates]
      );
      return hasChanges ? { ...prev, ...updates } : prev;
    });
  }, []);

  // Flow State Manager - Centralized state transitions - Optimized with stable references
  const flowStateManager = useCallback((newState: FlowState, options?: {
    resetData?: boolean;
    closeModals?: boolean;
    openModal?: keyof typeof uiState;
  }) => {
    // Only update state if it's actually changing
    setCurrentFlowState(prev => prev === newState ? prev : newState);
    
    if (options?.resetData) {
      // Batch state updates to prevent multiple re-renders
      setDestination(null);
      setSelectedRoute(null);
      setSelectedRouteId(null);
      setTripSummary(null);
      setAlternativeRoutes([]);
      setPathCoords([]);
      setNavigationStartTime(null);
      setIsNavigating(false);
      setIsFollowingUser(false);
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
      });
    }
    
    if (options?.openModal) {
      updateUiState({ [options.openModal]: true });
    }
  }, [updateUiState]);

  // Consolidated UI State - Reduced from 20+ individual states to 3 objects
  const [searchState, setSearchState] = useState({
    text: "",
    isTyping: false,
    modalVisible: false,
  });

  const [mapState, setMapState] = useState({
    showReports: true,
    showGasStations: true,
    showReportModal: false,
    region: null,
    currentLocation: null as LocationCoords | null,
    destination: null as LocationCoords | null,
    isFollowingUser: false,
  });

  // Map Selection State
  const [mapSelectionState, setMapSelectionState] = useState({
    selectedLocation: null as LocationCoords | null,
    isSelecting: false,
  });

  const [navigationState, setNavigationState] = useState({
    isNavigating: false,
    currentSpeed: 0,
    distanceRemaining: 0,
    timeElapsed: 0,
    currentEta: null as string | null,
    currentFuelUsed: 0,
    isOverSpeedLimit: false,
  });

  // Extract values for backward compatibility
  const currentLocation = mapState.currentLocation;
  const destination = mapState.destination;
  const region = mapState.region;
  const showReports = mapState.showReports;
  const showGasStations = mapState.showGasStations;
  const isFollowingUser = mapState.isFollowingUser;
  
  const isNavigating = navigationState.isNavigating;
  const currentSpeed = navigationState.currentSpeed;
  const distanceRemaining = navigationState.distanceRemaining;
  const timeElapsed = navigationState.timeElapsed;
  const currentEta = navigationState.currentEta;
  const currentFuelUsed = navigationState.currentFuelUsed;
  const isOverSpeedLimit = navigationState.isOverSpeedLimit;
  
  const searchText = searchState.text;
  const isTyping = searchState.isTyping;
  const modalVisible = searchState.modalVisible;
  
  const showBottomSheet = uiState.showBottomSheet;
  const tripSummaryModalVisible = uiState.showTripSummary;
  
  // Helper setters for backward compatibility
  const setCurrentLocation = (loc: LocationCoords | null) => setMapState(prev => ({ ...prev, currentLocation: loc }));
  const setDestination = (dest: LocationCoords | null) => setMapState(prev => ({ ...prev, destination: dest }));
  const setRegion = (reg: any) => setMapState(prev => ({ ...prev, region: reg }));
  const setIsFollowingUser = (val: boolean) => setMapState(prev => ({ ...prev, isFollowingUser: val }));
  
  const setIsNavigating = (val: boolean) => setNavigationState(prev => ({ ...prev, isNavigating: val }));
  const setCurrentSpeed = (val: number) => setNavigationState(prev => ({ ...prev, currentSpeed: val }));
  const setDistanceRemaining = (val: number) => setNavigationState(prev => ({ ...prev, distanceRemaining: val }));
  const setTimeElapsed = (val: number) => setNavigationState(prev => ({ ...prev, timeElapsed: val }));
  const setCurrentEta = (val: string | null) => setNavigationState(prev => ({ ...prev, currentEta: val }));
  const setCurrentFuelUsed = (val: number) => setNavigationState(prev => ({ ...prev, currentFuelUsed: val }));
  const setIsOverSpeedLimit = (val: boolean) => setNavigationState(prev => ({ ...prev, isOverSpeedLimit: val }));
  
  const setSearchText = useCallback((text: string) => setSearchState(prev => ({ ...prev, text })), []);
  const setIsTyping = useCallback((typing: boolean) => setSearchState(prev => ({ ...prev, isTyping: typing })), []);
  const setModalVisible = useCallback((visible: boolean) => setSearchState(prev => ({ ...prev, modalVisible: visible })), []);
  
  const setShowBottomSheet = (show: boolean) => updateUiState({ showBottomSheet: show });
  const setTripSummaryModalVisible = (visible: boolean) => updateUiState({ showTripSummary: visible });

  // Memoized motor selection handler for SearchBar
  const handleMotorSelect = useCallback((motor: Motor | null) => {
    setSelectedMotor(motor);
  }, []);

  // Memoized callback for closing modal when place is selected
  const handlePlaceSelectedCloseModal = useCallback(() => {
    setModalVisible(false);
  }, []);


  // Optimized: Toggle markers visibility with stable reference
  const toggleMarkersVisibility = useCallback(() => {
    setMapState(prev => ({
      ...prev,
      showReports: !prev.showReports,
      showGasStations: !prev.showGasStations,
    }));
  }, []);

  // Use optimized map selection handlers
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
    currentLocation,
    setCurrentLocation,
    flowStateManager
  );

  // Wrap startMapSelection with debugging
  const startMapSelection = useCallback(() => {
    console.log("🚀 startMapSelection called from MapScreenTry");
    console.log("🚀 uiState.isMapSelectionMode before:", uiState.isMapSelectionMode);
    originalStartMapSelection();
    console.log("🚀 startMapSelection completed");
  }, [originalStartMapSelection, uiState.isMapSelectionMode]);
  const [mapStyle, setMapStyle] = useState<"light" | "dark">("light");
  const [isOffline, setIsOffline] = useState(false);
  const [navigationStartTime, setNavigationStartTime] = useState<number | null>(null);

  // Fetch reports and gas stations data with optimized tracking state
  const { reports, gasStations, loading: dataLoading, error: dataError, refreshData } = useAppData({
    user,
    isTracking: navigationState.isNavigating // Use consolidated state
  });

  // Routing and trip state
  const [pathCoords, setPathCoords] = useState<LocationCoords[]>([]);
  const [tripSummary, setTripSummary] = useState<RouteData | null>(null);
  const [alternativeRoutes, setAlternativeRoutes] = useState<RouteData[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [trafficIncidents, setTrafficIncidents] = useState<TrafficIncident[]>([]);
  const [wasRerouted, setWasRerouted] = useState(false);
  const [startAddress, setStartAddress] = useState("");

  //fuelLevel
  const [fuelLevel, setFuelLevel] = useState(0);

  //refresh



  // Motor selection state
  const [motorList, setMotorList] = useState<Motor[]>([]);
  const [selectedMotor, setSelectedMotor] = useState<Motor | null>(null);

  // Effect to populate fuelTank property if missing
  useEffect(() => {
    if (selectedMotor && !selectedMotor.fuelTank && selectedMotor.motorcycleData?.fuelTank) {
      console.log('[MapScreen] Using fuelTank from motorcycleData:', selectedMotor.nickname);
      setSelectedMotor(prev => {
        if (!prev) return null;
        return { ...prev, fuelTank: prev.motorcycleData?.fuelTank || 15 };
      });
    }
  }, [selectedMotor?.motorcycleData?.fuelTank]); // Only depend on the fuelTank property, not the entire selectedMotor

  // Selected route (memoized from state)
  const [selectedRoute, setSelectedRoute] = useState<RouteData | null>(null);


// MaintenanceAction type is already defined above

// State
const [maintenanceActions, setMaintenanceActions] = useState<MaintenanceAction[]>([]);
const [maintenanceFormVisible, setMaintenanceFormVisible] = useState(false);
const [maintenanceFormData, setMaintenanceFormData] = useState({
  type: '' as MaintenanceAction['type'] | '',
  cost: '',
  quantity: '',
  notes: ''
});

// handleMaintenanceFormChange is now imported from maintenance-handlers-mapscreentry.ts

// Use optimized maintenance handlers
const { handleMaintenanceFormSave: originalHandleMaintenanceFormSave, handleMaintenanceFormChange, handleFuelLevelUpdate } = useMaintenanceHandlers(
  selectedMotor,
  currentLocation,
  user,
  setMaintenanceFormVisible,
  (data: MaintenanceFormData) => setMaintenanceFormData(data)
);

// Wrap handleMaintenanceFormSave to match expected signature
const handleMaintenanceFormSave = useCallback(() => {
  originalHandleMaintenanceFormSave(maintenanceFormData);
}, [originalHandleMaintenanceFormSave, maintenanceFormData]);

// Maintenance form modal component
const MaintenanceFormModal = useMemo(() => {
  return ({
    visible,
    formData,
    onClose,
    onSave,
    onChange
  }: {
    visible: boolean;
    formData: typeof maintenanceFormData;
    onClose: () => void;
    onSave: () => void;
    onChange: (field: keyof typeof maintenanceFormData, value: string) => void;
  }) => (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.formModal}>
          <Text style={styles.formTitle}>
            {formData.type
              .split('_')
              .map(word => word.charAt(0).toUpperCase() + word.slice(1))
              .join(' ')}
          </Text>

          {/* Cost */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Cost (₱)</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={formData.cost}
              onChangeText={text => onChange('cost', text)}
              placeholder="Enter cost"
            />
          </View>

          {/* Quantity (show for refuel or oil_change) */}
          {['refuel', 'oil_change'].includes(formData.type) && (
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>
                {formData.type === 'refuel' ? 'Fuel Quantity (L)' : 'Oil Quantity (L)'}
              </Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                value={formData.quantity}
                onChangeText={text => onChange('quantity', text)}
                placeholder="Enter quantity in liters"
              />
            </View>
          )}

          {/* Notes */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Notes</Text>
            <TextInput
              style={[styles.input, styles.notesInput]}
              value={formData.notes}
              onChangeText={text => onChange('notes', text)}
              placeholder={`Add notes about the ${formData.type.replace('_', ' ')} (optional)`}
              multiline
            />
          </View>

          {/* Buttons */}
          <View style={styles.formButtons}>
            <TouchableOpacity onPress={onClose} style={[styles.formButton, styles.cancelButton]}>
              <Text style={styles.buttonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onSave} style={[styles.formButton, styles.saveButton]}>
              <Text style={[styles.buttonText, styles.saveButtonText]}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}, []);

// Open form for an action
const handleMaintenanceAction = useCallback(
  (actionType: MaintenanceAction['type']) => {
    if (!currentLocation || !selectedMotor) return;
    setMaintenanceFormData({ type: actionType, cost: '', quantity: '', notes: '' });
    updateUiState({ showMaintenanceForm: true });
  },
  [currentLocation, selectedMotor, updateUiState]
);

const saveMaintenanceRecord = async (
  actionType: MaintenanceAction['type'],
  formData: typeof maintenanceFormData
) => {
  try {
    if (!user?._id || !selectedMotor?._id) throw new Error('Missing user or motor data');
    // const fuelTank = selectedMotor.motorcycleData.fuelTank;
    const cost = parseFloat(formData.cost) || 0;
    const quantity = formData.quantity ? parseFloat(formData.quantity) : undefined;

    const newAction: MaintenanceAction = {
      type: actionType,
      timestamp: Date.now(),
      location: currentLocation
        ? { latitude: currentLocation.latitude, longitude: currentLocation.longitude, address: currentLocation.address }
        : { latitude: 0, longitude: 0 },
      details: { cost, quantity, notes: formData.notes }
    };

    const currentFuelLevel = selectedMotor.currentFuelLevel;
    // Save to backend
    const response = await fetch(`${LOCALHOST_IP}/api/maintenance-records`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: user._id,
        motorId: selectedMotor._id,
        type: actionType,
        timestamp: newAction.timestamp,
        location: newAction.location,
        details: newAction.details
      })
    });

    if (!response.ok) throw new Error('Failed to save maintenance record');
    const savedRecord = await response.json();
    console.log('✅ Maintenance record saved:', savedRecord);

    // If it's a refuel, update the motor's fuel level using proper calculation
    if (actionType === 'refuel' && quantity) {
      const motorData = {
        fuelConsumption: selectedMotor.fuelEfficiency || 0,
        fuelTank: selectedMotor.fuelTank || 15, // Default tank size if not provided
        currentFuelLevel: selectedMotor.currentFuelLevel || 0
      };
      
      if (motorData.fuelConsumption > 0 && motorData.fuelTank > 0) {
        const newFuelLevel = calculateFuelLevelAfterRefuel(motorData, quantity);
        
        console.log('[MapScreen] Refuel calculation:', {
          currentFuelLevel: motorData.currentFuelLevel,
          refuelAmount: quantity,
          newFuelLevel,
          fuelTank: motorData.fuelTank
        });
        
        // Update fuel level to backend first
        await updateFuelLevel(selectedMotor._id, newFuelLevel);
        
        // Update local state
        setFuelLevel(newFuelLevel);
        setFuelLevelInput(newFuelLevel);
        
        // Update selectedMotor state
        setSelectedMotor(prev => prev ? {
          ...prev,
          currentFuelLevel: newFuelLevel
        } : null);
        
        console.log('[MapScreen] ✅ Refuel completed successfully:', {
          motorId: selectedMotor._id,
          refuelAmount: quantity,
          newFuelLevel,
          totalCost: formData.cost,
          costPerLiter: formData.cost && quantity ? (parseFloat(formData.cost) / quantity).toFixed(2) : 'N/A'
        });
      } else {
        console.warn('[MapScreen] Missing required motor properties for refuel calculation:', {
          fuelConsumption: motorData.fuelConsumption,
          fuelTank: motorData.fuelTank,
          currentFuelLevel: motorData.currentFuelLevel
        });
      }
    }
    
    setMaintenanceActions(prev => [...prev, newAction]);
    updateUiState({ showMaintenanceForm: false });

    Toast.show({
      type: 'success',
      text1: 'Maintenance Recorded',
      text2: `${actionType.replace('_', ' ')} has been recorded successfully`,
      position: 'top',
      visibilityTime: 3000
    });
  } catch (error: any) {
    console.error('Error in saveMaintenanceRecord:', error);
    Alert.alert('Error', error.message || 'Failed to save maintenance record');
  }
};



  // Fuel level validation function
  const validateFuelLevel = (fuelLevel: number, motorId: string): boolean => {
    if (fuelLevel < 0 || fuelLevel > 100) {
      console.error('[MapScreen] ❌ Invalid fuel level:', {
        fuelLevel,
        motorId,
        message: 'Fuel level must be between 0 and 100'
      });
      return false;
    }
    
    if (isNaN(fuelLevel)) {
      console.error('[MapScreen] ❌ Invalid fuel level:', {
        fuelLevel,
        motorId,
        message: 'Fuel level must be a number'
      });
      return false;
    }
    
    return true;
  };

  // Optimized: Update fuel level on backend with proper error handling and logging
  const updateFuelLevel = async (motorId: string, newFuelLevel: number) => {
    try {
      // Validate fuel level before sending to backend
      if (!validateFuelLevel(newFuelLevel, motorId)) {
        throw new Error(`Invalid fuel level: ${newFuelLevel}. Must be between 0 and 100.`);
      }

      console.log('[MapScreen] Updating fuel level to backend:', {
        motorId,
        newFuelLevel,
        timestamp: new Date().toISOString()
      });

      // Use the standard API endpoint for consistency
      const response = await fetch(`${LOCALHOST_IP}/api/user-motors/${motorId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({
          currentFuelLevel: newFuelLevel,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const updatedMotor = await response.json();
      console.log('[MapScreen] ✅ Fuel level updated successfully:', {
        motorId,
        oldFuelLevel: selectedMotor?.currentFuelLevel,
        newFuelLevel,
        updatedMotor: updatedMotor.currentFuelLevel
      });

      // Update local selectedMotor state to reflect backend changes
      if (selectedMotor && selectedMotor._id === motorId) {
        setSelectedMotor(prev => prev ? {
          ...prev,
          currentFuelLevel: newFuelLevel
        } : null);
      }

      return updatedMotor;
    } catch (error: any) {
      console.error('[MapScreen] ❌ Error updating fuel level:', {
        motorId,
        newFuelLevel,
        error: error.message,
        timestamp: new Date().toISOString()
      });
      
      // Show user-friendly error message
      Toast.show({
        type: 'error',
        text1: 'Fuel Update Failed',
        text2: 'Could not sync fuel level with server',
        position: 'top',
        visibilityTime: 3000
      });
      
      throw error; // Re-throw for caller handling
    }
  };


  // Update the maintenance action item in the tto be clickable
  const renderMaintenanceAction = (action: MaintenanceAction, index: number) => (
    <TouchableOpacity
      key={index}
      style={styles.maintenanceActionItem}
      onPress={() => {
        Alert.alert(
          'Maintenance Details',
          `Type: ${action.type.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}\n` +
          `Time: ${new Date(action.timestamp).toLocaleString('en-PH')}\n` +
          `Cost: ₱${action.details.cost.toFixed(2)}\n` +
          (action.details.quantity ? `Quantity: ${action.details.quantity.toFixed(2)}L\n` : '') +
          (action.location?.address ? `Location: ${action.location.address}\n` : '') +
          (action.details.notes ? `Notes: ${action.details.notes}` : '')
        );
      }}
    >
      <MaterialIcons
        name={
          action.type === 'refuel' ? 'local-gas-station' :
            action.type === 'oil_change' ? 'opacity' :
              'build'
        }
        size={24}
        color={
          action.type === 'refuel' ? '#2ecc71' :
            action.type === 'oil_change' ? '#3498db' :
              '#e67e22'
        }
      />
      <View style={styles.maintenanceActionDetails}>
        <Text style={styles.maintenanceActionType}>
          {action.type.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
        </Text>
        <Text style={styles.maintenanceActionTime}>
          {new Date(action.timestamp).toLocaleString('en-PH', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
            month: 'long',
            day: 'numeric'
          })}
        </Text>
        <View style={styles.maintenanceActionInfo}>
          <Text style={styles.maintenanceActionCost}>
            Cost: ₱{action.details.cost.toFixed(2)}
          </Text>
          {action.details.quantity && (
            <Text style={styles.maintenanceActionQuantity}>
              Quantity: {action.details.quantity.toFixed(2)}L
            </Text>
          )}
          {action.location?.address && (
            <Text style={styles.maintenanceActionLocation}>
              Location: {action.location.address}
            </Text>
          )}
          {action.details.notes && (
            <Text style={styles.maintenanceActionNotes}>
              Notes: {action.details.notes}
            </Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  // Add maintenance button to navigation overlay
  const MaintenanceButton = () => (
    <View style={styles.maintenanceContainer}>
      <TouchableOpacity
        onPress={() => {
          Alert.alert(
            'Record Maintenance',
            'Select maintenance type:',
            [
              {
                text: 'Refuel',
                onPress: () => handleMaintenanceAction('refuel')
              },
              {
                text: 'Oil Change',
                onPress: () => handleMaintenanceAction('oil_change')
              },
              {
                text: 'Tune Up',
                onPress: () => handleMaintenanceAction('tune_up')
              },
              {
                text: 'Cancel',
                style: 'cancel'
              }
            ]
          );
        }}
        style={styles.maintenanceButton}
      >
        <LinearGradient
          colors={['#00ADB5', '#00858B']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.maintenanceGradient}
        >
          <MaterialIcons name="build" size={24} color="#fff" />
          <Text style={styles.maintenanceButtonText}>Record Maintenance</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );

  // Fetch traffic reports function
  const fetchTrafficReports = useCallback(async () => {
    try {
      if (!currentLocation) {
        console.log("No current location available");
        return;
      }

      const response = await fetch(`${LOCALHOST_IP}/api/reports`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      // Transform the data to match TrafficIncident type
      const formattedIncidents: TrafficIncident[] = data.map((report: any) => ({
        id: report._id || String(Math.random()),
        location: {
          latitude: report.latitude || 0,
          longitude: report.longitude || 0
        },
        type: report.reportType || 'Unknown',
        severity: report.reportType?.toLowerCase().includes('accident') ? 'high' : 'medium',
        description: report.description || ''
      }));

      setTrafficIncidents(formattedIncidents);
      console.log("✅ Traffic reports fetched successfully:", formattedIncidents.length);
    } catch (error) {
      console.error("🔥 Error fetching traffic reports:", error);
      // Set empty array but don't show error to user since this is not critical
      setTrafficIncidents([]);
    }
  }, [currentLocation]);


  // Add predictive analytics after selectedMotor state is declared
  const analyticsData = usePredictiveAnalytics({
    fuelType: selectedMotor?.fuelType || 'Regular',
    oilType: selectedMotor?.oilType || 'Mineral',
    lastRegisteredDate: selectedMotor?.lastRegisteredDate || new Date().toISOString(),
    motorAge: selectedMotor?.age || 0,
    distanceTraveled: selectedMotor?.totalDistance || 0,
    lastMaintenanceDate: selectedMotor?.lastMaintenanceDate,
    lastOilChange: selectedMotor?.lastOilChange,
    currentFuelLevel: selectedMotor?.currentFuelLevel,
    averageFuelConsumption: selectedMotor?.fuelEfficiency
  });

  // Real-time monitoring during navigation
  useEffect(() => {
    if (!isNavigating || !selectedMotor || !analyticsData) return;


    // Check conditions every minute during navigation
    const monitoringInterval = setInterval(() => {
      // Low fuel warning during navigation
      if (analyticsData.lowFuel) {
        Toast.show({
          type: 'error',
          text1: 'Low Fuel Warning',
          text2: 'Consider refueling soon. Finding nearby gas stations...',
          position: 'top',
          visibilityTime: 7000,
        });
        fetchTrafficReports(); // This will also update gas stations if implemented
      }

      // Maintenance warning during navigation
      if (analyticsData.maintenanceDue) {
        Toast.show({
          type: 'warning',
          text1: 'Maintenance Reminder',
          text2: 'Your motorcycle is due for maintenance. Plan a service visit soon.',
          position: 'top',
          visibilityTime: 4000,
        });
      }

      // Oil change warning during navigation
      if (analyticsData.needsOilChange) {
        Toast.show({
          type: 'warning',
          text1: 'Oil Change Due',
          text2: 'Your motorcycle needs an oil change. Visit a service center soon.',
          position: 'top',
          visibilityTime: 4000,
        });
      }
    }, 60000); // Check every minute

    return () => clearInterval(monitoringInterval);
  }, [isNavigating, selectedMotor, analyticsData, fetchTrafficReports]);

  // Route selection handler
  const handleRouteSelect = useCallback((id: string) => {
    const route = id === tripSummary?.id ? tripSummary : alternativeRoutes.find(r => r.id === id);
    if (route) {
      setSelectedRouteId(id);
      setSelectedRoute(route);
      mapRef.current?.fitToCoordinates(route.coordinates, {
        edgePadding: { top: 100, right: 50, bottom: 300, left: 50 },
        animated: true,
      });
    }
  }, [tripSummary, alternativeRoutes]);

  // Bottom sheet close handler
  const handleBottomSheetClose = useCallback(() => {
    setShowBottomSheet(false);
    // Don't change flow state here - let user decide what to do next
  }, []);


  useEffect(() => {
    if (!isNavigating) return;

    // Keep latest props in refs so effect doesn't restart unnecessarily
    const routeRef = { current: selectedRoute };
    const motorRef = { current: selectedMotor };
    const startTimeRef = { current: navigationStartTime };

    let subscription: Location.LocationSubscription;
    let timer: ReturnType<typeof setInterval>;

    // Throttle speed warning
    const lastWarningTime = { current: 0 };

    const startTracking = async () => {
      try {
        subscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            distanceInterval: 10, // Update every 10 meters
            timeInterval: 5000,   // Or every 5 seconds
          },
          (location) => {
            const newPoint = {
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
            };

            setPathCoords((prev) => {
              // Avoid duplicates
              const lastPoint = prev[prev.length - 1];
              if (
                lastPoint &&
                lastPoint.latitude === newPoint.latitude &&
                lastPoint.longitude === newPoint.longitude
              ) {
                return prev;
              }

              const updatedPath = [...prev, newPoint];

              // Calculate total distance
              const distanceTraveled = calculateTotalPathDistance(updatedPath);

              // Update speed
              const speedKmh = location.coords.speed
                ? location.coords.speed * 3.6
                : 0;
              setCurrentSpeed(speedKmh);
              setIsOverSpeedLimit(speedKmh > 80);

              // Throttled overspeed warning
              if (speedKmh > 80 && Date.now() - lastWarningTime.current > 10000) {
                lastWarningTime.current = Date.now();
                Toast.show({
                  type: "error",
                  text1: "Speed Warning",
                  text2: "You are exceeding the speed limit!",
                  position: "top",
                  visibilityTime: 5000,
                });
              }

              // ETA + fuel only if route exists
              if (routeRef.current) {
                const lastRoutePoint =
                  routeRef.current.coordinates[
                  routeRef.current.coordinates.length - 1
                  ];
                const remainingDist = calcDistance(newPoint, lastRoutePoint);
                setDistanceRemaining(remainingDist);

                // ETA
                const avgSpeed = Math.max(speedKmh, 30); // safer fallback than 60
                const remainingTimeHours = (remainingDist / 1000) / avgSpeed;
                const remainingTimeMs = remainingTimeHours * 3600000;

                const estimatedArrival = new Date(Date.now() + remainingTimeMs);
                const formattedETA = estimatedArrival.toLocaleTimeString("en-US", {
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: true,
                });
                setCurrentEta(formattedETA);

                // Fuel - using local calculation
                if (motorRef.current) {
                  const y = distanceTraveled - (x ?? 0);
                  setXValue(distanceTraveled);

                  const motor = motorRef.current;
                  const motorData = {
                    fuelConsumption: motor.fuelEfficiency || 0,
                    fuelTank: motor.fuelTank || 15, // Default tank size if not provided
                    currentFuelLevel: motor.currentFuelLevel || 0
                  };
                  
                  if (motorData.fuelConsumption > 0 && motorData.fuelTank > 0) {
                    const newFuelLevel = calculateNewFuelLevel(motorData, y);
                    
                    console.log('[MapScreen] Navigation fuel calculation:', {
                      distanceTraveled: y,
                      currentFuelLevel: motorData.currentFuelLevel,
                      newFuelLevel,
                      fuelTank: motorData.fuelTank
                    });
                    
                    setFuelLevel(newFuelLevel);
                    
                    // Update fuel level to backend with proper error handling
                    updateFuelLevel(motor._id, newFuelLevel).catch((error) => {
                      console.warn('[MapScreen] Fuel level update failed (non-critical):', error.message);
                    });
                  }
                }
              }

              return updatedPath;
            });
          }
        );
      } catch (error) {
        console.error("⚠️ Error tracking location:", error);
      }
    };

    startTracking();

    // Timer for elapsed time
    timer = setInterval(() => {
      if (startTimeRef.current) {
        setTimeElapsed(
          Math.floor((Date.now() - startTimeRef.current) / 1000)
        );
      }
    }, 1000);

    return () => {
      if (subscription) subscription.remove();
      if (timer) clearInterval(timer);
    };
  }, [isNavigating]); // 👈 only depends on navigating state





  const startNavigation = useCallback(async () => {
    if (!selectedRoute || !currentLocation || !selectedMotor) {
      Alert.alert("Error", "Please select a route and motor first");
      return;
    }

    // Initialize path with starting point
    setPathCoords([currentLocation]);

    // Pre-navigation analytics checks
    if (analyticsData) {
      Alert.alert(
        analyticsData.lowFuel ? "Low Fuel Warning" : "Check Fuel Level ",
        analyticsData.lowFuel ? "Your fuel level is low. Do you still want to start?" : "Is Fuel Level Accurate?",
        [
          {
            text: "Update Fuel Level",
            onPress: () => {
              updateUiState({ showFuelModal: true });
            },
          },
          {
            text: analyticsData.lowFuel ? "No" : "Cancel",
            style: "cancel",
          },
          {
            text: "Yes, Start",
            onPress: async () => {
              // Use flow state manager for navigation start
              flowStateManager('navigating', { closeModals: true });
              setIsNavigating(true);
              setNavigationStartTime(Date.now());
              setIsFollowingUser(true);
              
              // Start background tracking for navigation
              await startBackgroundNavigation();
            },
          },
        ]
      );
    } else {
      // Use flow state manager for navigation start
      flowStateManager('navigating', { closeModals: true });
      setIsNavigating(true);
      setNavigationStartTime(Date.now());
      setIsFollowingUser(true);
      
      // Start background tracking for navigation
      await startBackgroundNavigation();
    }

    // Get the start address
    const address = await reverseGeocodeLocation(
      currentLocation.latitude,
      currentLocation.longitude
    );
    setStartAddress(address);

    animateToRegion({
      ...currentLocation,
      latitudeDelta: 0.005,
      longitudeDelta: 0.005,
    });
  }, [selectedRoute, currentLocation, selectedMotor, analyticsData]);

 
  
  // Memory leak prevention: Cleanup timers and intervals
  useEffect(() => {
    return () => {
      // Clear any pending timeouts
      if (voiceNavTimeout.current) {
        clearTimeout(voiceNavTimeout.current);
      }
    };
  }, []);



  // 📡 Get current location and subscribe to updates
  useEffect(() => {
    let sub: Location.LocationSubscription;

    const getLocation = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          Alert.alert("Permission Denied", "Location access is required for navigation.");
          throw new Error("Permission denied");
        }


        const loc = await Location.getCurrentPositionAsync({});
        const initReg = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        };

        setCurrentLocation(initReg);
        setRegion(initReg);
        animateToRegion(initReg);
        downloadOfflineMap(initReg);

        sub = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, timeInterval: 5000, distanceInterval: 10 },
          (update) => {
            const newLocation = {
              latitude: update.coords.latitude,
              longitude: update.coords.longitude,
            };
            setCurrentLocation(newLocation);

            if (isFollowingUser || isNavigating) {
              animateToRegion({
                ...newLocation,
                latitudeDelta: 0.005,
                longitudeDelta: 0.005,
              });
            }
          }
        );
      } catch (error) {
        Alert.alert("Location Error", "Failed to get location");
      }
    };

    getLocation();
    return () => sub?.remove();
  }, [isFollowingUser, isNavigating]);


  // off-route detection and autorerouting
  useEffect(() => {
    if (!isNavigating || !selectedRoute || !currentLocation) return;

    const userIsOffRoute = isUserOffRoute(currentLocation, selectedRoute.coordinates, 50);
    if (userIsOffRoute) {
      //Alert.alert("Rerouting", "You have deviated from the route. Fetching a new route...");
      setWasRerouted(true);
      console.warn("🚨 Off-route detected. Rerouting...");
      setCurrentInstructionIndex(0);
      fetchRoutes();

      setShowBottomSheet(false);
    }
  }, [currentLocation, isNavigating, selectedRoute]);


  // 🧭 Detect arrival and handle navigation cleanup
  useEffect(() => {
    if (!isNavigating || !selectedRoute || !currentLocation) return;

    const lastCoord = selectedRoute.coordinates[selectedRoute.coordinates.length - 1];
    const distance = calcDistance(currentLocation, lastCoord);
    if (distance < ARRIVAL_THRESHOLD) endNavigation(true);

    return () => {
      if (voiceNavTimeout.current) clearTimeout(voiceNavTimeout.current);
    };
  }, [isNavigating, currentLocation, selectedRoute]);

  // 🚀 Animate camera to region
  const animateToRegion = useCallback((newRegion: any) => {
    mapRef.current?.animateToRegion(newRegion, 1000);
  }, []);

  // 🛣️ Fetch route and alternatives from Google Directions API - Memoized for performance
  const buildDirectionsUrl = useCallback(({
    origin,
    destination,
    alternatives = "true",
    departureTime = "now",
    trafficModel = "best_guess",
    avoid = "tolls",
    apiKey = GOOGLE_MAPS_API_KEY,
  }) => {
    const baseUrl = "https://maps.googleapis.com/maps/api/directions/json";
    const params = new URLSearchParams({
      origin: `${origin.latitude},${origin.longitude}`,
      destination: `${destination.latitude},${destination.longitude}`,
      alternatives: "true",
      mode: "driving",
      departure_time: departureTime,
      traffic_model: trafficModel,
      avoid: avoid,
      key: apiKey,
    });
    return `${baseUrl}?${params.toString()}`;
  }, []);

  const fetchRoutes = useCallback(async () => {
    if (!mapState.currentLocation || !mapState.destination || !selectedMotor) {
      console.log("Missing required data:", {
        hasCurrentLocation: !!mapState.currentLocation,
        hasDestination: !!mapState.destination,
        hasSelectedMotor: !!selectedMotor
      });
      return;
    }

    // Throttle API calls to prevent excessive requests
    const now = Date.now();
    if (now - lastApiCallTime.current < API_CALL_THROTTLE) {
      console.log("🛰️ API call throttled, skipping...");
      return;
    }
    lastApiCallTime.current = now;

    console.log("🛰️ Fetching routes...");
    
    // Set loading state - keep current state but show loading indicator
    // Don't change flow state during loading

    try {
      const url = buildDirectionsUrl({
        origin: mapState.currentLocation,
        destination: mapState.destination,
      });

      const res = await fetch(url);
      const data = await res.json();

      if (data.status !== "OK") {
        throw new Error(data.error_message || "Failed to fetch routes");
      }

      const allRoutes = data.routes.map((r: any, i: number): RouteData => {
        const leg = r.legs[0];
        console.log("leg ", leg.distance.value);
        // self-made (logical) formula by the coder itself :PP 
        const fuel = selectedMotor ? (leg.distance.value / 1000 / selectedMotor.fuelEfficiency) : 0;

        // helper — pure function
        const getTrafficRateFromLeg = (leg: any): number => {
          if (!leg || !leg.duration || !leg.duration_in_traffic) return 1; // fallback

          const dur = leg.duration.value; // seconds
          const durTraffic = leg.duration_in_traffic.value; // seconds

          if (!dur || dur <= 0) return 1;

          const ratio = durTraffic / dur;
          console.log("ratio: ", ratio);
          // non-overlapping thresholds (else-if)
          if (ratio <= 1.2) return 1;
          else if (ratio <= 1.5) return 2;
          else if (ratio <= 2.0) return 3;
          else if (ratio <= 2.5) return 4;
          else return 5;
        };

        const trafficRate = getTrafficRateFromLeg(leg);
        return {
          id: `route-${i}`,
          distance: leg.distance.value,
          duration: leg.duration.value,
          fuelEstimate: fuel,
          trafficRate,
          coordinates: polyline.decode(r.overview_polyline.points).map(([lat, lng]) => ({
            latitude: lat,
            longitude: lng,
          })),
          instructions: leg.steps.map((step: any) =>
            step.html_instructions.replace(/<[^>]*>/g, "")
          ),
        };
      });

      if (allRoutes.length === 0) {
        throw new Error("No routes found");
      }

      const mainRoute = allRoutes[0];
      const alternatives = allRoutes.slice(1);

      setTripSummary(mainRoute);
      setAlternativeRoutes(alternatives);

      // Always select the main route when fetching new routes
      setSelectedRouteId(mainRoute.id);
      setSelectedRoute(mainRoute);
      
      // Update flow state to routes_found using flow state manager
      flowStateManager('routes_found', { openModal: 'showBottomSheet' });
      
      // Fetch traffic reports in background
      await fetchTrafficReports();

    } catch (error: any) {
      console.error("❌ Route Fetch Error:", error.message);
      Alert.alert("Error", "Failed to fetch routes. Please try again.");

      // Reset state on error using flow state manager
      flowStateManager('destination_selected', { 
        resetData: false, // Don't reset destination, just routes
        closeModals: true 
      });
      setTripSummary(null);
      setAlternativeRoutes([]);
      setSelectedRouteId(null);
      setSelectedRoute(null);
    }
  }, [currentLocation, destination, selectedMotor, fetchTrafficReports]);

  // Memoized destination setter to prevent SearchBar re-renders
  const handleDestinationSelect = useCallback((dest: LocationCoords) => {
    setDestination(dest);
    updateUiState({ showSearchModal: false });
    flowStateManager('destination_selected');

    // If we don't have current location, get it first
    if (!currentLocation) {
      (async () => {
        const loc = await Location.getCurrentPositionAsync({});
        const newLocation = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        };
        setCurrentLocation(newLocation);
        fetchRoutes();
      })();
    } else {
      // If we have current location, fetch routes immediately
      fetchRoutes();
    }
  }, [currentLocation, fetchRoutes]);

  const [currentInstructionIndex, setCurrentInstructionIndex] = useState(0);
  const [durationInMinutes, setDurationInMinutes] = useState(0);

  const endNavigation = useCallback(async (arrived: boolean = false) => {
    // First, stop the navigation
    setIsNavigating(false);
    flowStateManager(arrived ? 'completed' : 'routes_found', { closeModals: true });
    setIsFollowingUser(false);
    setNavigationStartTime(null);

    // Stop background tracking
    await stopBackgroundNavigation();

    // Check for required data
    if (!user) {
      console.warn("⚠️ Cannot save trip summary: No user data");
      return;
    }

    if (!destination) {
      console.warn("⚠️ Cannot save trip summary: No destination data");
      return;
    }

    if (!selectedRoute) {
      console.warn("⚠️ Cannot save trip summary: No route data");
      return;
    }

    if (!selectedMotor) {
      console.warn("⚠️ Cannot save trip summary: No motor data");
      return;
    }

    // For same location trips, ensure we have at least 2 points
    let finalPathCoords = pathCoords;
    if (pathCoords.length < 2 && currentLocation) {
      // If start and end are the same, create a small circular path
      const radius = 0.0001; // Small radius around the point
      finalPathCoords = [
        currentLocation,
        {
          latitude: currentLocation.latitude + radius,
          longitude: currentLocation.longitude + radius
        },
        {
          latitude: currentLocation.latitude - radius,
          longitude: currentLocation.longitude - radius
        },
        currentLocation
      ];
    }

    // Calculate trip metrics
    const durationInMinutes = navigationStartTime
      ? Math.round((Date.now() - navigationStartTime) / 60000)
      : 1; // Minimum 1 minute for same-location trips

    const actualDistance = calculateTotalPathDistance(finalPathCoords);
    console.log("ACTUAL DISTANCE ", actualDistance);
    const estimatedFuel = calculateFuelRange(
      selectedRoute.distance / 1000,
      selectedMotor.fuelEfficiency
    );

    const actualFuel = calculateFuelRange(
      actualDistance,
      selectedMotor.fuelEfficiency
    );

    // Prepare trip summary
    const summary: TripSummary = {
      userId: user._id,
      motorId: selectedMotor._id,
      distance: Number((selectedRoute.distance / 1000).toFixed(2)),
      fuelUsed: Number(selectedRoute.fuelEstimate.toFixed(2)),
      eta: new Date(Date.now() + selectedRoute.duration * 1000).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      }),
      timeArrived: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      }),
      destination: destination.address || "Unknown",
      startAddress: startAddress || "Unknown"
    };

    try {
      // Save the trip summary with the modified path data
      await saveTripSummaryToBackend(summary, arrived, {
        startAddress,
        estimatedFuel,
        actualFuel,
        actualDistance,
        pathCoords: finalPathCoords,
        plannedCoords: selectedRoute.coordinates,
        wasRerouted,
        durationInMinutes,
      });

      console.log("✅ Trip summary saved successfully");

      // Show the trip summary modal
      setTripSummaryModalVisible(true);
    } catch (error) {
      console.error("🔥 Failed to save trip summary:", error);
      Alert.alert(
        "Error",
        "Failed to save trip summary. Your trip data might not be recorded.",
        [{ text: "OK" }]
      );
    }
  }, [
    user,
    destination,
    selectedRoute,
    selectedMotor,
    pathCoords,
    navigationStartTime,
    wasRerouted,
    startAddress,
    currentLocation
  ]);

  // Background navigation functions
  const startBackgroundNavigation = useCallback(async () => {
    if (!selectedMotor || !isNavigating) return;
    
    try {
      const tripId = `nav_${Date.now()}`;
      backgroundTrackingId.current = tripId;
      
      const success = await startBackgroundLocationTracking(
        tripId,
        selectedMotor,
        {
          distance: 0,
          fuelConsumed: 0,
          duration: 0,
          avgSpeed: 0,
          speed: 0,
        }
      );
      
      if (success) {
        isBackgroundTracking.current = true;
        console.log('[MapScreen] Background navigation started');
        
        // Toast.show({
        //   type: 'info',
        //   text1: 'Background Navigation',
        //   text2: 'Navigation will continue in background',
        //   visibilityTime: 3000,
        // });
      }
    } catch (error) {
      console.error('[MapScreen] Error starting background navigation:', error);
    }
  }, [selectedMotor, isNavigating]);

  const stopBackgroundNavigation = useCallback(async () => {
    try {
      await safeStopBackgroundLocation();
      isBackgroundTracking.current = false;
      backgroundTrackingId.current = null;
      console.log('[MapScreen] Background navigation stopped');
    } catch (error) {
      console.error('[MapScreen] Error stopping background navigation:', error);
    }
  }, []);

  // Handle app state changes for background navigation
  useEffect(() => {
    const handleAppStateChange = (appState: string) => {
      if (appState === 'background' && isNavigating) {
        console.log('[MapScreen] App going to background, starting background navigation');
        startBackgroundNavigation();
      } else if (appState === 'active' && isBackgroundTracking.current) {
        console.log('[MapScreen] App coming to foreground, stopping background navigation');
        stopBackgroundNavigation();
      }
    };

    backgroundStateManager.addListener(handleAppStateChange);
    
    return () => {
      backgroundStateManager.removeListener(handleAppStateChange);
    };
  }, [isNavigating, startBackgroundNavigation, stopBackgroundNavigation]);

  // Check for background tracking resume on mount
  useEffect(() => {
    const checkBackgroundTracking = async () => {
      try {
        const backgroundState = await resumeTrackingFromBackground();
        if (backgroundState && backgroundState.isTracking) {
          console.log('[MapScreen] Resuming background navigation');
          isBackgroundTracking.current = true;
          backgroundTrackingId.current = backgroundState.tripId;
          
          // Update UI to reflect navigation state
          setIsNavigating(true);
          
          Toast.show({
            type: 'info',
            text1: 'Navigation Resumed',
            text2: 'Your navigation was tracked in the background',
            visibilityTime: 3000,
          });
        }
      } catch (error) {
        console.error('[MapScreen] Error checking background tracking:', error);
      }
    };

    checkBackgroundTracking();
  }, []);

  // CRITICAL FIX: Cleanup effect to prevent memory leaks
  useEffect(() => {
    return () => {
      // Clear all timers and refs on unmount
      if (voiceNavTimeout.current) {
        clearTimeout(voiceNavTimeout.current);
      }
      if (apiCallTimeout.current) {
        clearTimeout(apiCallTimeout.current);
      }
      if (isBackgroundTracking.current) {
        isBackgroundTracking.current = false;
      }
      if (backgroundTrackingId.current) {
        backgroundTrackingId.current = null;
      }
      
      console.log('[MapScreen] Cleanup completed - all refs and timers cleared');
    };
  }, []);




  // Memoized calculations to prevent unnecessary recalculations
  const actualDistance = useMemo(() => {
    return selectedRoute ? calculateTotalPathDistance(pathCoords) : 0;
  }, [selectedRoute, pathCoords]);

  const estimatedFuel = useMemo(() => {
    return selectedRoute && selectedMotor
      ? calculateFuelRange(selectedRoute.distance / 1000, selectedMotor.fuelEfficiency)
      : { min: 0, max: 0, avg: 0 };
  }, [selectedRoute, selectedMotor]);
  const actualFuel = useMemo(() => {
    return selectedMotor
      ? calculateFuelRange(actualDistance, selectedMotor.fuelEfficiency)
      : { min: 0, max: 0, avg: 0 };
  }, [selectedMotor, actualDistance]);



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
        trafficCondition: "moderate",
        kmph: 0,
        rerouteCount: 0,
        wasInBackground: false,
        showAnalyticsModal: false
      };

      console.log('Saving trip data:', tripData);

      const tripResponse = await fetch(`${LOCALHOST_IP}/api/trips`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(tripData)
      });

      if (!tripResponse.ok) {
        throw new Error('Failed to save trip summary');
      }

      const savedTrip = await tripResponse.json();
      console.log('✅ Trip saved successfully:', savedTrip);

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
        "Failed to save trip data. Please try again.",
        [{ text: "OK" }]
      );
      throw error;
    }
  };

  // 🌐 Loading States
  if (!user) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3498db" />
        <Text style={styles.loadingText}>Loading user data...</Text>
      </View>
    );
  }



  // ✅ Continue with render (map, modals, UI controls, etc.)
  // The rest of the render JSX you've written (header, map view, modals, route sheets, etc.)
  // remains unchanged and is already well-structured.


  return (
    <SafeAreaProvider>
      <SafeAreaView style={[styles.safeArea]}>
        {/* Header */}
        {/* <LinearGradient
          colors={['#00ADB5', '#3498db']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.headerGradient}
        >
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <MaterialIcons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerText}>Traffic Slight</Text>
          
        </LinearGradient> */}


        {/* Flow State Indicator */}
        {currentFlowState !== 'navigating' && (
          <View style={styles.flowStateIndicator}>
            <View style={styles.stepIndicator}>
              <View style={[styles.step, ['destination_selected', 'routes_found', 'navigating', 'completed'].includes(currentFlowState) ? styles.stepCompleted : styles.stepActive]}>
                <Text style={[styles.stepNumber, ['destination_selected', 'routes_found', 'navigating', 'completed'].includes(currentFlowState) ? styles.stepNumberCompleted : styles.stepNumberActive]}>1</Text>
              </View>
              <View style={[styles.stepLine, ['destination_selected', 'routes_found', 'navigating', 'completed'].includes(currentFlowState) ? styles.stepLineCompleted : styles.stepLineInactive]} />
              <View style={[styles.step, ['routes_found', 'navigating', 'completed'].includes(currentFlowState) ? styles.stepCompleted : (currentFlowState === 'destination_selected' ? styles.stepActive : styles.stepInactive)]}>
                <Text style={[styles.stepNumber, ['routes_found', 'navigating', 'completed'].includes(currentFlowState) ? styles.stepNumberCompleted : (currentFlowState === 'destination_selected' ? styles.stepNumberActive : styles.stepNumberInactive)]}>2</Text>
              </View>
              <View style={[styles.stepLine, ['routes_found', 'navigating', 'completed'].includes(currentFlowState) ? styles.stepLineCompleted : styles.stepLineInactive]} />
              <View style={[styles.step, ['navigating', 'completed'].includes(currentFlowState) ? styles.stepCompleted : (currentFlowState === 'routes_found' ? styles.stepActive : styles.stepInactive)]}>
                <Text style={[styles.stepNumber, ['navigating', 'completed'].includes(currentFlowState) ? styles.stepNumberCompleted : (currentFlowState === 'routes_found' ? styles.stepNumberActive : styles.stepNumberInactive)]}>3</Text>
              </View>
            </View>
            
            {/* Current State Label */}
            <View style={styles.stateLabelContainer}>
              <Text style={styles.stateLabel}>
                {currentFlowState === 'searching' && 'Choose your destination'}
                {currentFlowState === 'destination_selected' && 'Find the best routes'}
                {currentFlowState === 'routes_found' && 'Select route and start navigation'}
                {currentFlowState === 'completed' && 'Trip completed successfully!'}
              </Text>
            </View>
          </View>
        )}

        {/* Destination Display */}
        {destination && currentFlowState === 'destination_selected' && (
          <View style={styles.destinationHeader}>
            <Pressable onPress={() => {
              // Allow changing destination by opening search modal
              updateUiState({ showSearchModal: true });
            }}>
              <View style={styles.destinationContent}>
                <MaterialIcons name="place" size={20} color="#00ADB5" />
                <Text style={styles.destinationText} numberOfLines={2}>
                  {destination.address}
                </Text>
                <MaterialIcons name="edit" size={16} color="#666" />
              </View>
            </Pressable>
          </View>
        )}

        {/* Search Modal */}
        <Modal
          animationType="slide"
          visible={uiState.showSearchModal}
          onRequestClose={() => {
            // If we have a destination and routes, just close the modal
            if (destination && (selectedRoute || selectedRouteId)) {
              updateUiState({ showSearchModal: false });
            } else {
              // Only navigate back if we don't have an active route
              setSearchText("");
              updateUiState({ showSearchModal: false });
              if (navigation?.canGoBack()) {
                navigation.goBack();
              } else {
                navigation.navigate("MainTabs", { screen: "Map" });
              }
            }
          }}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity
                onPress={() => {
                  // If we have a destination and routes, just close the modal
                  if (destination && (selectedRoute || selectedRouteId)) {
                    updateUiState({ showSearchModal: false });
                  } else {
                    // Only clear and navigate back if we don't have an active route
                    setSearchText("");
                    updateUiState({ showSearchModal: false });
                    if (navigation?.canGoBack()) {
                      // navigation.goBack();
                      updateUiState({ showSearchModal: false });
                    } else {
                      navigation.navigate("MainTabs", { screen: "Map" });
                    }
                  }
                }}
                style={styles.modalBackButton}
              >
                <MaterialIcons name="arrow-back" size={24} color="#333" />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Where to?</Text>
            </View>

            <SearchBar
              searchRef={searchRef}
              searchText={searchText}
              setSearchText={setSearchText}
              isTyping={isTyping}
              setIsTyping={setIsTyping}
              setDestination={handleDestinationSelect}
              animateToRegion={animateToRegion}
              selectedMotor={selectedMotor}
              setSelectedMotor={handleMotorSelect}
              motorList={motorList}
              onPlaceSelectedCloseModal={handlePlaceSelectedCloseModal}
              userId={user?._id}
              onMapSelection={startMapSelection}
            />
          </View>
        </Modal>



        {/* Map View */}
        <View style={styles.mapContainer}>
          <MapComponent
            mapRef={mapRef}
            region={region}
            mapStyle={mapStyle === "dark" ? "dark" : "standard"}
            currentLocation={currentLocation}
            destination={destination}
            userId={user?._id}
            reportMarkers={isNavigating ? (reports || []) : []}
            gasStations={isNavigating ? (gasStations || []) : []}
            showReports={isNavigating ? showReports : false}
            showGasStations={isNavigating ? showGasStations : false}
            onMapPress={handleMapPress}
            selectedMapLocation={mapSelectionState.selectedLocation}
            routeCoordinates={selectedRoute?.coordinates}
            snappedRouteCoordinates={pathCoords}
            isTracking={isNavigating}
            onReportVoted={refreshData}
          />


          {/* Navigation Status Header */}
          {isNavigating && currentFlowState === 'navigating' && (
            <View style={styles.navigationStatusHeader}>
              <LinearGradient
                colors={['#2ecc71', '#27ae60']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.navigationStatusGradient}
              >
                <MaterialIcons name="navigation" size={20} color="#fff" />
                <Text style={styles.navigationStatusText}>Navigating to {destination?.address || 'Destination'}</Text>

              </LinearGradient>
            </View>
          )}

          {/* Speedometer */}
          {isNavigating && currentFlowState === 'navigating' && (
            <Speedometer speed={currentSpeed} isOverSpeedLimit={isOverSpeedLimit} />
          )}

          {/* Map Control Buttons - Only show during navigation */}
          {isNavigating && currentFlowState === 'navigating' && (
            <View style={styles.mapControlsContainer}>
              <View style={styles.mapControlsRow}>

                <TouchableOpacity
                  style={[
                    styles.mapControlButton,
                    { backgroundColor: showGasStations ? '#4CAF50' : '#9E9E9E' }
                  ]}
                  onPress={toggleMarkersVisibility}
                >
                  <MaterialIcons
                    name="visibility"
                    size={20}
                    color={showGasStations ? '#FFF' : '#000'}
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.mapControlButton}
                  onPress={() => updateUiState({ showReportModal: true })}
                >
                  <MaterialIcons
                    name="report"
                    size={20}
                    color={'#e74c3c'}
                  />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Analytics Overlay */}
          {currentFlowState === 'navigating' && (
            <AnalyticsOverlay
              analyticsData={analyticsData}
              selectedMotor={selectedMotor}
              userId={user._id}
            />
          )}



          {/* Bottom Buttons Container - State-based flow */}
          {!uiState.showBottomSheet && currentFlowState !== 'navigating' && (
            <View style={styles.bottomButtonsContainer}>
              {/* State 1: Searching - Show search button */}
              {currentFlowState === 'searching' && (
                <TouchableOpacity
                  onPress={() => updateUiState({ showSearchModal: true })}
                  style={styles.showRoutesButton}
                >
                  <LinearGradient
                    colors={['#00ADB5', '#00858B']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.showRoutesGradient}
                  >
                    <MaterialIcons name="search" size={20} color="#fff" style={{ marginRight: 8 }} />
                    <Text style={styles.showRoutesText}>Choose Destination</Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}

              {/* State 2: Destination Selected - Show find routes button */}
              {currentFlowState === 'destination_selected' && (
                <TouchableOpacity
                  onPress={fetchRoutes}
                  style={styles.showRoutesButton}
                >
                  <LinearGradient
                    colors={['#00ADB5', '#00858B']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.showRoutesGradient}
                  >
                    <MaterialIcons name="route" size={20} color="#fff" style={{ marginRight: 8 }} />
                    <Text style={styles.showRoutesText}>Find Routes</Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}

              {/* State 3: Routes Found - Show route options and navigation */}
              {currentFlowState === 'routes_found' && (
                <>
                  <TouchableOpacity
                    onPress={() => updateUiState({ showBottomSheet: true })}
                    style={styles.showRoutesButton}
                  >
                    <LinearGradient
                      colors={['#00ADB5', '#00858B']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.showRoutesGradient}
                    >
                      <MaterialIcons name="list" size={20} color="#fff" style={{ marginRight: 8 }} />
                      <Text style={styles.showRoutesText}>View Routes</Text>
                    </LinearGradient>
                  </TouchableOpacity>

                  <View style={styles.buttonSpacer} />

                  <TouchableOpacity
                    onPress={startNavigation}
                    style={styles.navigationButton}
                  >
                    <LinearGradient
                      colors={['#2ecc71', '#27ae60']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.navigationGradient}
                    >
                      <MaterialIcons name="navigation" size={20} color="#fff" style={{ marginRight: 8 }} />
                      <Text style={styles.navigationButtonText}>Start Navigation</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </>
              )}

              {/* State 4: Completed - Show restart option */}
              {currentFlowState === 'completed' && (
                <TouchableOpacity
                  onPress={() => {
                    flowStateManager('searching', { resetData: true, closeModals: true });
                  }}
                  style={styles.showRoutesButton}
                >
                  <LinearGradient
                    colors={['#3498db', '#2980b9']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.showRoutesGradient}
                  >
                    <MaterialIcons name="refresh" size={20} color="#fff" style={{ marginRight: 8 }} />
                    <Text style={styles.showRoutesText}>Plan New Trip</Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}
            </View>
          )}

          <Modal visible={uiState.showFuelModal} transparent>
            <View
              style={{
                flex: 1,
                justifyContent: "center",
                alignItems: "center",
                backgroundColor: "rgba(0,0,0,0.5)",
              }}
            >
              <View
                style={{
                  width: "80%",
                  padding: 20,
                  backgroundColor: "white",
                  borderRadius: 12,
                }}
              >
                <Text style={{ fontSize: 18, fontWeight: "600", marginBottom: 10 }}>
                  Update Fuel Level
                </Text>

                {/* Text Input */}
                <TextInput
                  style={{
                    borderWidth: 1,
                    borderColor: "#ccc",
                    borderRadius: 8,
                    padding: 10,
                    marginBottom: 15,
                    textAlign: "center",
                    fontSize: 16,
                  }}
                  placeholder={`(${selectedMotor?.currentFuelLevel}%)`}
                  keyboardType="numeric"
                  maxLength={3} // prevent very long numbers
                  value={String(selectedMotor?.currentFuelLevel)}
                  onChangeText={(text) => {
                    
                    const num = Math.min(Number(text) || 0, 100); // clamp to 0–100
                    setFuelLevelInput(num);
                  }}
                />

                {/* Quick Select Buttons */}
                <View
                  style={{
                    flexDirection: "row",
                    flexWrap: "wrap",
                    justifyContent: "space-between",
                    marginBottom: 15,
                  }}
                >
                  {[10, 25, 50, 75, 90, 100].map((percent) => (
                    <TouchableOpacity
                      key={percent}
                      style={{
                        width: "30%",
                        padding: 10,
                        backgroundColor: "#2196f3",
                        borderRadius: 8,
                        marginVertical: 5,
                        alignItems: "center",
                      }}
                      onPress={async () => {
                        try {
                          // Update fuel level to backend first
                          await updateFuelLevel(selectedMotor._id, fuelLevelInput);
                          
                          // Update local state
                          setFuelLevel(fuelLevelInput);
                          setFuelLevelInput(fuelLevelInput);
                          
                          // Close modal
                          updateUiState({ showFuelModal: false });
                          
                          // Show success message
                          Toast.show({
                            type: 'success',
                            text1: 'Fuel Level Updated',
                            text2: `Updated to ${fuelLevelInput}%`,
                            position: 'top',
                            visibilityTime: 2000
                          });
                        } catch (error) {
                          console.error('[MapScreen] Failed to update fuel level:', error);
                          // Error handling is already done in updateFuelLevel function
                        }
                      }
                      }
                    >
                      <Text style={{ color: "white", fontWeight: "600" }}>
                        {percent}%
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Action Buttons */}
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <TouchableOpacity
                    style={{
                      flex: 1,
                      padding: 10,
                      backgroundColor: "#aaa",
                      borderRadius: 8,
                      marginRight: 5,
                      alignItems: "center",
                    }}
                    onPress={() => updateUiState({ showFuelModal: false })}
                  >
                    <Text style={{ color: "white", fontWeight: "600" }}>Cancel</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={{
                      flex: 1,
                      padding: 10,
                      backgroundColor: "#4caf50",
                      borderRadius: 8,
                      marginLeft: 5,
                      alignItems: "center",
                    }}
                    onPress={async () => {
                      try {
                        // Update fuel level to backend first
                        await updateFuelLevel(selectedMotor._id, fuelLevelInput);
                        
                        // Update local state
                        setFuelLevel(fuelLevelInput);
                        setFuelLevelInput(fuelLevelInput);
                        
                        // Close modal
                        updateUiState({ showFuelModal: false });
                        
                        // Show success message
                        Toast.show({
                          type: 'success',
                          text1: 'Fuel Level Updated',
                          text2: `Updated to ${fuelLevelInput}%`,
                          position: 'top',
                          visibilityTime: 2000
                        });
                      } catch (error) {
                        console.error('[MapScreen] Failed to update fuel level:', error);
                        // Error handling is already done in updateFuelLevel function
                      }
                    }
                    }
                  >
                    <Text style={{ color: "white", fontWeight: "600" }}>Update</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>



          {/* Navigation Controls - Only show during navigation state */}
          {currentFlowState === 'navigating' && (
            <NavigationControls
              onEndNavigation={() => endNavigation(false)}
              onShowDetails={() => updateUiState({ showTripDetails: true })}
              onMaintenanceAction={(type) => handleMaintenanceAction(type)}
              currentSpeed={currentSpeed}
              distanceRemaining={distanceRemaining}
              timeElapsed={timeElapsed}
              currentEta={currentEta}
              isOverSpeedLimit={isOverSpeedLimit}
            />
          )}

          {/* Trip Details Modal */}
          <TripDetailsModal
            visible={uiState.showTripDetails}
            onClose={() => updateUiState({ showTripDetails: false })}
            currentSpeed={currentSpeed}
            distanceRemaining={distanceRemaining}
            timeElapsed={timeElapsed}
            currentFuel={fuelLevel}
            currentEta={currentEta}
            currentFuelUsed={currentFuelUsed}
            isOverSpeedLimit={isOverSpeedLimit}
            selectedRoute={selectedRoute}
            selectedMotor={selectedMotor}
            distanceTraveled={calculateTotalPathDistance(pathCoords)}
          />

          {/* Traffic Report Modal */}
          <TrafficReportModal
            visible={uiState.showReportModal}
            onClose={() => updateUiState({ showReportModal: false })}
            user={user}
            currentLocation={currentLocation}
            onSuccess={() => {
              updateUiState({ showReportModal: false });
              // Refresh reports data to show the newly submitted report
              refreshData();
            }}
          />
        </View>




        {/* Trip Summary Modal */}
        <Modal
          transparent
          visible={tripSummaryModalVisible}
          
          onRequestClose={() => setTripSummaryModalVisible(false)}
        >
          <View style={[styles.summaryModalContainer, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
            <View style={[styles.summaryModal, { marginBottom: 10 }]}>
              <LinearGradient
                colors={['#00ADB5', '#00858B']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.summaryHeaderGradient}
              >
                <Text style={[styles.summaryTitle, { color: '#fff' }]}>Trip Summary & Analytics</Text>
                <TouchableOpacity
                  onPress={() => {
                    setTripSummaryModalVisible(false);
                    navigation.goBack();
                  }}
                  style={styles.closeSummaryButton}
                >
                  <LinearGradient
                    colors={['#00ADB5', '#00858B']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.closeSummaryGradient}
                  >
                    <Text style={styles.closeSummaryText}>Done</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </LinearGradient>

              <ScrollView style={styles.summaryContent}>
                {/* Route Information */}
                <View style={styles.summarySection}>
                  <Text style={styles.sectionTitle}>Route Information</Text>

                  <View style={styles.summaryRow}>
                    <MaterialIcons name="my-location" size={20} color="#34495e" />
                    <Text style={styles.summaryText}>From: {startAddress || "Unknown"}</Text>
                  </View>

                  <View style={styles.summaryRow}>
                    <MaterialIcons name="place" size={20} color="#e74c3c" />
                    <Text style={styles.summaryText}>To: {destination?.address || "Unknown"}</Text>
                  </View>
                </View>

                {/* Distance Analytics */}
                <View style={styles.summarySection}>
                  <Text style={styles.sectionTitle}>Distance Analytics</Text>

                  <View style={styles.summaryRow}>
                    <MaterialIcons name="straighten" size={20} color="#3498db" />
                    <View style={styles.analyticsCompare}>
                      <Text style={styles.analyticsLabel}>Planned Distance:</Text>
                      <Text style={styles.analyticsValue}>{selectedRoute ? (selectedRoute.distance / 1000).toFixed(2) : "--"} km</Text>
                      <Text style={styles.analyticsLabel}>Actual Distance:</Text>
                      <Text style={styles.analyticsValue}>{calculateTotalPathDistance(pathCoords).toFixed(2)} km</Text>
                      <Text style={styles.analyticsDiff}>
                        {wasRerouted ? "Route was recalculated during trip" : "Stayed on planned route"}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Fuel Analytics */}
                <View style={styles.summarySection}>
                  <Text style={styles.sectionTitle}>Fuel Analytics</Text>

                  <View style={styles.summaryRow}>
                    <MaterialIcons name="local-gas-station" size={20} color="#2ecc71" />
                    <View style={styles.analyticsCompare}>
                      <Text style={styles.analyticsLabel}>Estimated Consumption:</Text>
                      <Text style={styles.analyticsValue}>{selectedRoute ? selectedRoute.fuelEstimate.toFixed(2) : "--"} L</Text>
                      <Text style={styles.analyticsLabel}>Actual Consumption:</Text>
                      <Text style={styles.analyticsValue}>
                        {selectedRoute ? (selectedRoute.fuelEstimate * (wasRerouted ? 1.1 : 1.0)).toFixed(2) : "--"} L
                      </Text>
                      <Text style={styles.analyticsLabel}>Efficiency:</Text>
                      <Text style={styles.analyticsValue}>{selectedMotor?.fuelEfficiency || "--"} km/L</Text>
                    </View>
                  </View>
                </View>

                {/* Time Analytics */}
                <View style={styles.summarySection}>
                  <Text style={styles.sectionTitle}>Time Analytics</Text>

                  <View style={styles.summaryRow}>
                    <MaterialIcons name="schedule" size={20} color="#9b59b6" />
                    <View style={styles.analyticsCompare}>
                      <Text style={styles.analyticsLabel}>Start Time:</Text>
                      <Text style={styles.analyticsValue}>
                        {navigationStartTime ? new Date(navigationStartTime).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: true,
                        }) : "--"}
                      </Text>
                      <Text style={styles.analyticsLabel}>End Time:</Text>
                      <Text style={styles.analyticsValue}>
                        {new Date().toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: true,
                        })}
                      </Text>
                      <Text style={styles.analyticsLabel}>Total Duration:</Text>
                      <Text style={styles.analyticsValue}>{durationInMinutes} minutes</Text>
                    </View>
                  </View>
                </View>

                {/* Motor Information */}
                <View style={styles.summarySection}>
                  <Text style={styles.sectionTitle}>Motor Information</Text>

                  <View style={styles.summaryRow}>
                    <MaterialIcons name="two-wheeler" size={20} color="#1abc9c" />
                    <View style={styles.analyticsCompare}>
                      <Text style={styles.analyticsLabel}>Motor:</Text>
                      <Text style={styles.analyticsValue}>{selectedMotor?.name || "--"}</Text>
                      <Text style={styles.analyticsLabel}>Current Fuel Level:</Text>
                      <Text style={styles.analyticsValue}>{Math.round(selectedMotor?.currentFuelLevel) || "--"}%</Text>
                      <Text style={styles.analyticsLabel}>Total Distance Traveled:</Text>
                      <Text style={styles.analyticsValue}>{selectedMotor?.totalDistance || "--"} km</Text>
                    </View>
                  </View>
                </View>

                {/* Maintenance Actions */}
                <View style={styles.summarySection}>
                  <Text style={styles.sectionTitle}>Maintenance Actions</Text>
                  {maintenanceActions.length > 0 ? (
                    maintenanceActions.map((action, index) => renderMaintenanceAction(action, index))
                  ) : (
                    <Text style={styles.noMaintenanceText}>No maintenance actions recorded</Text>
                  )}
                </View>
              </ScrollView>

              <TouchableOpacity
                onPress={() => {
                  setTripSummaryModalVisible(false);
                  navigation.goBack();
                }}
                style={styles.closeSummaryButton}
              >
                <LinearGradient
                  colors={['#00ADB5', '#00858B']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.closeSummaryGradient}
                >
                  <Text style={styles.closeSummaryText}>Done</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Maintenance Form Modal */}
        <MaintenanceFormModal
          visible={uiState.showMaintenanceForm}
          formData={maintenanceFormData}
          onClose={() => updateUiState({ showMaintenanceForm: false })}
          onSave={handleMaintenanceFormSave}
          onChange={handleMaintenanceFormChange}
        />


        {/* Route Details Bottom Sheet - Single Instance */}
        <RouteDetailsBottomSheet
          visible={uiState.showBottomSheet}
          bestRoute={tripSummary}
          alternatives={alternativeRoutes}
          onClose={() => updateUiState({ showBottomSheet: false })}
          selectedRouteId={selectedRouteId}
          onSelectRoute={handleRouteSelect}
          selectedMotor={selectedMotor}
          isNavigating={isNavigating}
        />

        {/* Map Selection Confirmation Modal */}
        <Modal
          animationType="slide"
          visible={uiState.isMapSelectionMode && mapSelectionState.selectedLocation !== null}
          transparent={true}
          onRequestClose={cancelMapSelection}
        >
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
        </Modal>

      </SafeAreaView>

      {/* Add Toast at the end of SafeAreaView */}
      <Toast />

      {/* Add Maintenance Form Modal - Single Instance */}
      <MaintenanceFormModal
        visible={maintenanceFormVisible}
        formData={maintenanceFormData}
        onClose={() => setMaintenanceFormVisible(false)}
        onSave={handleMaintenanceFormSave}
        onChange={handleMaintenanceFormChange}
      />
    </SafeAreaProvider>
  );
}

// ----------------------------------------------------------------
// Styles
// ----------------------------------------------------------------
const darkMapStyle = [
  { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
];

const styles = StyleSheet.create({
  // Base Styles
  safeArea: {
    flex: 1,
    backgroundColor: '#00ADB5',
    zIndex: -5
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#7f8c8d',
  },

  // Map and Container Styles
  mapContainer: {
    flex: 1,
    position: 'relative',
    zIndex: -1
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },

  // Header Styles
  headerGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingTop: 10,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerText: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },

  // Destination Styles
  destinationHeader: {
    position: "absolute",
    zIndex: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
    padding: 16,
    top: Platform.OS === 'ios' ? 140 : 140,
    left: 20,
    right: 20,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: 'rgba(0, 173, 181, 0.3)',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  destinationContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  destinationText: {
    fontSize: 16,
    color: '#2c3e50',
    fontWeight: '700',
    flex: 1,
    marginLeft: 12,
    marginRight: 12,
    lineHeight: 20,
    textShadowColor: 'rgba(255, 255, 255, 0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },

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

  // Top Stats Container
  topStatsContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 100 : 80,
    left: 20,
    right: 20,
    alignItems: 'center',
  },

  speedometerContainer: {
    // top: 40,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 20,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 120,
  },

  speedLimitWarning: {
    backgroundColor: 'rgba(231, 76, 60, 0.85)',
  },

  speedValue: {
    color: '#fff',
    fontSize: 32,
    fontWeight: 'bold',
  },

  speedUnit: {
    color: '#fff',
    fontSize: 16,
    marginLeft: 4,
    opacity: 0.8,
  },

  warningIcon: {
    marginLeft: 8,
  },

  // Bottom Sheet Styles
  bottomSheetContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '50%',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    zIndex: 1001,
  },
  bottomSheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#00ADB5',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  bottomSheetTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  closeButton: {
    padding: 4,
  },
  bottomSheetContent: {
    padding: 16,
    backgroundColor: '#F2EEEE',
  },

  // Route Selection Styles
  sortContainer: {
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  sortLabel: {
    fontSize: 16,
    color: '#666',
    marginBottom: 12,
  },
  sortButtonsContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  sortButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 173, 181, 0.1)',
  },
  sortButtonActive: {
    backgroundColor: '#00ADB5',
  },
  sortButtonText: {
    color: '#00ADB5',
    fontWeight: '600',
    fontSize: 14,
  },
  sortButtonTextActive: {
    color: '#fff',
  },

  // Route Card Styles
  routeCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  selectedRouteCard: {
    backgroundColor: 'rgba(0, 173, 181, 0.05)',
    borderColor: '#00ADB5',
    borderWidth: 2,
  },
  recommendedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    padding: 8,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  recommendedText: {
    color: '#1A1A1A',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },

  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
    backgroundColor: '#FFFFFF',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  modalBackButton: {
    padding: 8,
    marginRight: 16,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#333333',
  },

  // Marker Styles
  markerBase: {
    backgroundColor: '#fff',
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  userMarker: {
    backgroundColor: '#fff',
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
    borderRadius: 20,
  },
  destinationMarker: {
    backgroundColor: '#fff',
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
    borderRadius: 20,
  },
  incidentMarker: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
    borderRadius: 15,
    padding: 5,
  },

  // Route Detail Styles
  routeDetail: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 173, 181, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  detailContent: {
    flex: 1,
  },

  // Form Styles
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

  // Maintenance Action Styles
  maintenanceActionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  maintenanceActionDetails: {
    marginLeft: 16,
    flex: 1,
  },
  maintenanceActionType: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 4,
  },
  maintenanceActionTime: {
    fontSize: 14,
    color: '#7f8c8d',
    marginBottom: 8,
  },
  maintenanceActionInfo: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    padding: 12,
    borderRadius: 8,
  },
  maintenanceActionCost: {
    fontSize: 16,
    color: '#2c3e50',
    fontWeight: '500',
    marginBottom: 4,
  },
  maintenanceActionQuantity: {
    fontSize: 14,
    color: '#27ae60',
    marginBottom: 4,
  },
  maintenanceActionLocation: {
    fontSize: 14,
    color: '#7f8c8d',
    marginBottom: 4,
  },
  maintenanceActionNotes: {
    fontSize: 14,
    color: '#34495e',
    fontStyle: 'italic',
    marginTop: 8,
  },

  // Maintenance Container Styles
  maintenanceContainer: {
    marginVertical: 12,
  },
  maintenanceButton: {
    backgroundColor: '#00ADB5',
  },


  // Bottom Buttons Container
  bottomButtonsContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
    zIndex: 998,
  },

  // Navigation Button Styles
  navigationButton: {
    margin: 16,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 5,
    shadowColor: '#2ecc71',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  navigationGradient: {
    padding: 12,
    alignItems: 'center',
  },
  navigationButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },

  // Route Button Styles
  showRoutesButton: {
    margin: 16,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 5,
    shadowColor: '#00ADB5',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  showRoutesGradient: {
    padding: 16,
    alignItems: 'center',
  },
  showRoutesText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonSpacer: {
    height: 12,
  },


  // Flow State Indicator Styles
  // Motor Selector Button Styles
  motorSelectorButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 10 : 10,
    left: 20,
    right: 20,
    zIndex: 1001,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  motorSelectorGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 20,
    gap: 8,
  },
  motorSelectorText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    flex: 1,
    marginLeft: 8,
  },

  flowStateIndicator: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 60,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 25,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    paddingVertical: 18,
    paddingHorizontal: 24,
    zIndex: 1000,
  },

  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },

  step: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },

  stepActive: {
    backgroundColor: '#00ADB5',
  },

  stepCompleted: {
    backgroundColor: '#2ecc71',
  },

  stepInactive: {
    backgroundColor: '#bdc3c7',
  },

  stepNumber: {
    fontSize: 14,
    fontWeight: 'bold',
  },

  stepNumberActive: {
    color: '#fff',
  },

  stepNumberCompleted: {
    color: '#fff',
  },

  stepNumberInactive: {
    color: '#7f8c8d',
  },

  stepLine: {
    height: 2,
    width: 40,
    marginHorizontal: 8,
  },

  stepLineCompleted: {
    backgroundColor: '#2ecc71',
  },

  stepLineInactive: {
    backgroundColor: '#bdc3c7',
  },

  // State Label Styles
  stateLabelContainer: {
    alignItems: 'center',
  },

  stateLabel: {
    fontSize: 14,
    color: '#2c3e50',
    fontWeight: '500',
    textAlign: 'center',
  },

  // Map Control Styles
  mapControlsContainer: {
    position: 'absolute',
    bottom: 120,
    right: 20,
    zIndex: 997,
  },

  mapControlsRow: {
    flexDirection: 'column',
    gap: 12,
  },

  mapControlButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#00ADB5',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
  },

  // Navigation Status Header Styles
  navigationStatusHeader: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    left: 20,
    right: 20,
    zIndex: 996,
  },

  navigationStatusGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 25,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },

  navigationStatusText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 8,
    marginRight: 12,
  },

  endNavigationButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Navigation Progress Indicator Styles
  navigationProgressContainer: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 200 : 180,
    left: 20,
    right: 20,
    zIndex: 995,
  },

  navigationProgressBar: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },

  navigationProgressFill: {
    height: '100%',
    backgroundColor: '#2ecc71',
    borderRadius: 3,
    width: '30%', // This would be calculated based on actual progress
  },

  navigationProgressText: {
    fontSize: 14,
    color: '#2c3e50',
    fontWeight: '600',
    textAlign: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 15,
  },

  // Summary Modal Styles
  summaryModalContainer: {
    flex: 1,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  summaryModal: {
    backgroundColor: '#fff',
    borderRadius: 20,
    width: '90%',
    maxHeight: '80%',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  summaryHeaderGradient: {
    padding: 16,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    alignItems: 'center',
  },
  summaryTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  summaryContent: {
    padding: 16,
  },
  summarySection: {
    marginBottom: 20,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  summaryText: {
    fontSize: 16,
    color: '#2c3e50',
    marginLeft: 12,
    flex: 1,
  },

  // Analytics styles
  analyticsOverlay: {
    position: 'absolute',
    top: 120,
    right: 20,
    borderRadius: 12,
    overflow: 'hidden',
    width: '50%',
    maxWidth: 300,
  },

  analyticsGradient: {
    padding: 16,
  },

  analyticsHeaderTouchable: {
    marginBottom: 8,
  },

  analyticsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },

  analyticsHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  analyticsTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
  },

  analyticsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    padding: 8,
    borderRadius: 8,
  },

  analyticsText: {
    color: '#fff',
    marginLeft: 8,
    fontSize: 14,
    flex: 1,
  },

  analyticsCompare: {
    marginLeft: 12,
    flex: 1,
  },

  analyticsLabel: {
    color: '#7f8c8d',
    fontSize: 12,
    marginBottom: 2,
  },

  analyticsValue: {
    color: '#2c3e50',
    fontSize: 14,
    fontWeight: '500',
  },

  analyticsDiff: {
    color: '#7f8c8d',
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 4,
  },

  warningText: {
    color: '#e74c3c',
    fontWeight: 'bold',
  },

  // Detail Styles
  detailLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },

  detailValue: {
    fontSize: 16,
    color: '#333',
    fontWeight: '600',
  },

  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },

  maintenanceGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },

  maintenanceButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },

  // ... keep all other existing styles unchanged ...

  // Trip Details styles
  tripDetailsModal: {
    backgroundColor: '#fff',
    bottom:0,
    borderRadius: 20,
    width: '90%',
    maxHeight: '80%',
    marginTop: 'auto',
    marginBottom: 'auto',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },

  tripDetailsHeader: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#00ADB5',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },

  tripDetailsTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
  },

  tripDetailsContent: {
    padding: 16,
  },

  detailsSection: {
    marginBottom: 24,
  },

  // Summary styles
  noMaintenanceText: {
    color: '#7f8c8d',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 12,
  },

  closeSummaryButton: {
    margin: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },

  closeSummaryGradient: {
    padding: 16,
    alignItems: 'center',
  },

  closeSummaryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },

  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },

  warningRow: {
    backgroundColor: 'rgba(231, 76, 60, 0.1)',
  },

  // Enhanced fuel level styles
  fuelItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    padding: 12,
    backgroundColor: '#FFF3E0',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#FF9800',
  },

  fuelItemWarning: {
    backgroundColor: '#FFEBEE',
    borderColor: '#E74C3C',
  },

  fuelTextContainer: {
    marginLeft: 12,
    flex: 1,
  },

  fuelLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },

  fuelValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FF5722',
  },

  fuelValueWarning: {
    color: '#E74C3C',
  },

  detailTextContainer: {
    marginLeft: 12,
    flex: 1,
  },

  detailSubtext: {
    color: '#7f8c8d',
    fontSize: 12,
    marginTop: 4,
    fontStyle: 'italic',
  },

  // Map Selection Modal Styles
  mapSelectionModalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  mapSelectionModal: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    paddingVertical: 24,
    paddingHorizontal: 20,
    maxHeight: '40%',
  },
  mapSelectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  mapSelectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2c3e50',
    marginLeft: 12,
  },
  mapSelectionContent: {
    marginBottom: 24,
  },
  mapSelectionAddress: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 8,
  },
  mapSelectionCoordinates: {
    fontSize: 14,
    color: '#7f8c8d',
  },
  mapSelectionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  mapSelectionCancelButton: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: '#E0E0E0',
    alignItems: 'center',
  },
  mapSelectionCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  mapSelectionConfirmButton: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  mapSelectionConfirmGradient: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  mapSelectionConfirmText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});



// reverseGeocodeLocation is now imported from map-selection-handlers-mapscreentry.ts



// Add this component before the NavigationApp component
const AnalyticsOverlay = ({ analyticsData, selectedMotor, userId }: {
  analyticsData: any,
  selectedMotor: Motor | null,
  userId: String
}) => {
  const [motorData, setMotorData] = useState(selectedMotor);

  useEffect(() => {
    const fetchData = async () => {
      const res = await fetch(`${LOCALHOST_IP}/user-motors/user/${userId}`);
      const data = await res.json();
      setMotorData(data);
    };
    fetchData();
  }, [userId]); // Only depend on userId, not selectedMotor
  const [isMinimized, setIsMinimized] = useState(true);
  const animatedValue = useRef(new Animated.Value(0)).current;

  const toggleMinimize = () => {
    Animated.spring(animatedValue, {
      toValue: isMinimized ? 1 : 0,
      useNativeDriver: false,
      friction: 8,
      tension: 40
    }).start();
    setIsMinimized(!isMinimized);
  };

  if (!selectedMotor) return null;
  // setIsMinimized(true);
  return (
    <View style={styles.analyticsOverlay}>
      <LinearGradient
        colors={['rgba(0,0,0,0.8)', 'rgba(0,0,0,0.6)']}
        style={styles.analyticsGradient}
      >
        <TouchableOpacity
          onPress={toggleMinimize}
          style={styles.analyticsHeaderTouchable}
        >
          <View style={styles.analyticsHeader}>
            <View style={styles.analyticsHeaderLeft}>
              <MaterialIcons name="analytics" size={24} color="#00ADB5" />
              <Text style={styles.analyticsTitle}>
                {selectedMotor.nickname || selectedMotor.name}
              </Text>
            </View>
            <MaterialIcons
              name={isMinimized ? "expand-more" : "expand-less"}
              size={24}
              color="#fff"
            />
          </View>
        </TouchableOpacity>

        {/* Basic Info - Always visible */}
        <View style={styles.analyticsRow}>
          <MaterialIcons
            name="local-gas-station"
            size={20}
            color={analyticsData.lowFuel ? '#e74c3c' : '#2ecc71'}
          />
          <Text style={[styles.analyticsText, analyticsData.lowFuel && styles.warningText]}>
            Fuel Level: {selectedMotor.currentFuelLevel.toFixed(0)}%
            {analyticsData.lowFuel && ' (Low)'}
          </Text>
        </View>

        <Animated.View style={{
          maxHeight: animatedValue.interpolate({
            outputRange: [0, 300],
            inputRange: [0, 1]

          }),
          opacity: animatedValue.interpolate({
            inputRange: [0, 1],
            outputRange: [0, 1]
          }),
          overflow: 'hidden'
        }}>
          {/* Motor Info */}
          <View style={styles.analyticsRow}>
            <MaterialIcons name="two-wheeler" size={20} color="#3498db" />
            <Text style={styles.analyticsText}>
              {selectedMotor.name} ({selectedMotor.engineDisplacement || 'N/A'}cc)
            </Text>
          </View>

          {/* Total Distance */}
          <View style={styles.analyticsRow}>
            <MaterialIcons name="straighten" size={20} color="#2ecc71" />
            <Text style={styles.analyticsText}>
              Total Distance: {selectedMotor.analytics.totalDistance.toFixed(2)} km
            </Text>
          </View>

          {/* Trips Completed */}
          <View style={styles.analyticsRow}>
            <MaterialIcons name="flag" size={20} color="#e67e22" />
            <Text style={styles.analyticsText}>
              Trips Completed: {selectedMotor.analytics.tripsCompleted}
            </Text>
          </View>

          {/* Total Fuel Used */}
          <View style={styles.analyticsRow}>
            <MaterialIcons name="opacity" size={20} color="#9b59b6" />
            <Text style={styles.analyticsText}>
              Total Fuel Used: {selectedMotor.analytics.totalFuelUsed.toFixed(2)} L
            </Text>
          </View>

          {/* Fuel Efficiency */}
          <View style={styles.analyticsRow}>
            <MaterialIcons name="speed" size={20} color="#f1c40f" />
            <Text style={styles.analyticsText}>
              Avg. Efficiency: {selectedMotor.fuelEfficiency.toFixed(1)} km/L
            </Text>
          </View>

          {/* Maintenance Status */}
          <View style={styles.analyticsRow}>
            <MaterialIcons
              name="build"
              size={20}
              color={analyticsData.maintenanceDue ? '#e74c3c' : '#2ecc71'}
            />
            <Text style={[styles.analyticsText, analyticsData.maintenanceDue && styles.warningText]}>
              Maintenance: {analyticsData.maintenanceDue ? 'Due' : 'Up to date'}
            </Text>
          </View>
        </Animated.View>
      </LinearGradient>
    </View>
  );
};

const TripDetailsModal = ({
  visible,
  onClose,
  currentSpeed,
  distanceRemaining,
  timeElapsed,
  currentEta,
  currentFuel,
  currentFuelUsed,
  isOverSpeedLimit,
  selectedRoute,
  selectedMotor,
  distanceTraveled,

}: {
  visible: boolean;
  onClose: () => void;
  currentSpeed: number;
  distanceRemaining: number;
  timeElapsed: number;
  currentEta: string | null;
  currentFuel:number;
  currentFuelUsed: number;
  isOverSpeedLimit: boolean;
  selectedRoute: RouteData | null;
  selectedMotor: Motor | null;
  distanceTraveled: number;
}) => {
  const [tick, setTick] = useState(0);

  // Timer to trigger re-render every second
  // Optimized: Use requestAnimationFrame instead of setInterval for better performance
  useEffect(() => {
    if (!visible) return;
    
    let animationFrameId: number;
    let lastTime = 0;
    
    const updateTick = (currentTime: number) => {
      if (currentTime - lastTime >= 1000) { // Update every 1 second
        setTick(prev => prev + 1);
        lastTime = currentTime;
      }
      animationFrameId = requestAnimationFrame(updateTick);
    };
    
    animationFrameId = requestAnimationFrame(updateTick);
    
    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [visible]);
  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Status checks with default values for optional properties
  const lowFuel = (selectedMotor?.currentFuelLevel ?? 70) < 20;
  const needsOilChange = selectedMotor?.oilChangeDue ?? false;
  const needsMaintenance = selectedMotor?.maintenanceDue ?? false;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.tripDetailsModal}>
          <View style={styles.tripDetailsHeader}>
            <Text style={styles.tripDetailsTitle}>Trip Details</Text>
            <TouchableOpacity onPress={onClose}>
              <MaterialIcons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.tripDetailsContent}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 20 }}
          >
            {/* Current Stats Section */}
            <View style={styles.detailsSection}>
              <Text style={styles.sectionTitle}>Current Stats</Text>

              {/* Speed
              <View style={[styles.detailRow, isOverSpeedLimit && styles.warningRow]}>
                <MaterialIcons name="speed" size={24} color={isOverSpeedLimit ? "#e74c3c" : "#00ADB5"} />
                <View style={styles.detailTextContainer}>
                  <Text style={styles.detailLabel}>Current Speed</Text>
                  <Text style={[styles.detailValue, isOverSpeedLimit && styles.warningText]}>
                    {currentSpeed.toFixed(1)} km/h
                    {isOverSpeedLimit && " ⚠️ Over Speed Limit"}
                  </Text>
                </View>
              </View> */}


              {/* Fuel Level - Enhanced Display */}
              <View style={[styles.fuelItem, lowFuel && styles.fuelItemWarning]}>
                <MaterialIcons name="local-gas-station" size={24} color={lowFuel ? "#e74c3c" : "#FF9800"} />
                <View style={styles.fuelTextContainer}>
                  <Text style={styles.fuelLabel}>Fuel Level</Text>
                  <Text style={[styles.fuelValue, lowFuel && styles.fuelValueWarning]}>
                    {Math.round(currentFuel)}%
                    {lowFuel && " ⚠️ Low Fuel"}
                  </Text>
                </View>
              </View>
              {/* Distance Traveled */}
              <View style={styles.detailRow}>
                <MaterialIcons name="directions-bike" size={24} color="#00ADB5" />
                <View style={styles.detailTextContainer}>
                  <Text style={styles.detailLabel}>Distance Traveled</Text>
                  <Text style={styles.detailValue}>
                    {distanceTraveled.toFixed(2)} km
                  </Text>
                </View>
              </View>

              {/* Current Distance */}
              <View style={styles.detailRow}>
                <MaterialIcons name="straighten" size={24} color="#00ADB5" />
                <View style={styles.detailTextContainer}>
                  <Text style={styles.detailLabel}>Distance Remaining</Text>
                  <Text style={styles.detailValue}>{(distanceRemaining / 1000).toFixed(2)} km</Text>
                </View>
              </View>

              {/* Time */}
              <View style={styles.detailRow}>
                <MaterialIcons name="timer" size={24} color="#00ADB5" />
                <View style={styles.detailTextContainer}>
                  <Text style={styles.detailLabel}>Time Elapsed</Text>
                  <Text style={styles.detailValue}>{formatTime(timeElapsed)}</Text>
                </View>
              </View>

              {/* Current ETA */}
              <View style={styles.detailRow}>
                <MaterialIcons name="schedule" size={24} color="#00ADB5" />
                <View style={styles.detailTextContainer}>
                  <Text style={styles.detailLabel}>Current ETA</Text>
                  <Text style={styles.detailValue}>{currentEta || 'Calculating...'}</Text>
                </View>
              </View>

              {/* Current Fuel */}
              {/* <View style={styles.detailRow}>
                <MaterialIcons name="local-gas-station" size={24} color="#00ADB5" />
                <View style={styles.detailTextContainer}>
                  <Text style={styles.detailLabel}>Fuel Used</Text>
                  <Text style={styles.detailValue}>{currentFuelUsed.toFixed(2)} L</Text>
                </View>
              </View> */}
            </View>

            {/* Estimated Stats Section */}
            {/* <View style={styles.detailsSection}>
              <Text style={styles.sectionTitle}>Route Estimates</Text>

              <View style={styles.detailRow}>
                <MaterialIcons name="map" size={24} color="#00ADB5" />
                <View style={styles.detailTextContainer}>
                  <Text style={styles.detailLabel}>Total Route Distance</Text>
                  <Text style={styles.detailValue}>
                    {selectedRoute ? (selectedRoute.distance / 1000).toFixed(2) : '--'} km
                  </Text>
                </View>
              </View>

       
              <View style={styles.detailRow}>
                <MaterialIcons name="access-time" size={24} color="#00ADB5" />
                <View style={styles.detailTextContainer}>
                  <Text style={styles.detailLabel}>Estimated Total Time</Text>
                  <Text style={styles.detailValue}>
                    {selectedRoute ? (selectedRoute.duration / 60).toFixed(0) : '--'} minutes
                  </Text>
                </View>
              </View>



            </View> */}
            {/* Motor Analytics Section */}
            <View style={styles.detailsSection}>
              <Text style={styles.sectionTitle}>Motor Analytics</Text>



              {/* Oil Change */}
              <View style={[styles.detailRow, needsOilChange && styles.warningRow]}>
                <MaterialIcons name="build" size={24} color={needsOilChange ? "#e74c3c" : "#00ADB5"} />
                <View style={styles.detailTextContainer}>
                  <Text style={styles.detailLabel}>Oil Change</Text>
                  <Text style={[styles.detailValue, needsOilChange && styles.warningText]}>
                    {needsOilChange ? "Due" : "Up to Date"}
                    {needsOilChange && " ⚠️ Oil Change Due"}
                  </Text>
                </View>
              </View>

              {/* Maintenance */}
              <View style={[styles.detailRow, needsMaintenance && styles.warningRow]}>
                <MaterialIcons name="build" size={24} color={needsMaintenance ? "#e74c3c" : "#00ADB5"} />
                <View style={styles.detailTextContainer}>
                  <Text style={styles.detailLabel}>Maintenance</Text>
                  <Text style={[styles.detailValue, needsMaintenance && styles.warningText]}>
                    {needsMaintenance ? "Due" : "Up to Date"}
                    {needsMaintenance && " ⚠️ Maintenance Due"}
                  </Text>
                </View>
              </View>

              {/* Total Distance */}
              <View style={styles.detailRow}>
                <MaterialIcons name="directions-bike" size={24} color="#00ADB5" />
                <View style={styles.detailTextContainer}>
                  <Text style={styles.detailLabel}>Total Distance Traveled</Text>
                  <Text style={styles.detailValue}>
                    {selectedMotor ? (selectedMotor.totalDistance).toFixed(2) : '--'} km
                  </Text>
                </View>
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const downloadOfflineMap = async (region: any) => {
  const zoomLevel = 12;
  const { latitude, longitude, latitudeDelta, longitudeDelta } = region;

  // Create directory if it doesn't exist
  await FileSystem.makeDirectoryAsync(OFFLINE_TILES_PATH, { intermediates: true });

  // Simple offline map implementation - in production you'd want a more robust solution
  console.log("Offline map data prepared for region:", region);
};

// Add this before the main NavigationApp component
const NavigationControls: React.FC<{
  onEndNavigation: () => void;
  onShowDetails: () => void;
  onMaintenanceAction: (type: 'refuel' | 'oil_change' | 'tune_up') => void;
  currentSpeed: number;
  distanceRemaining: number;
  timeElapsed: number;
  currentEta: string | null;
  isOverSpeedLimit: boolean;
}> = ({
  onEndNavigation,
  onShowDetails,
  onMaintenanceAction,
  currentSpeed,
  distanceRemaining,
  timeElapsed,
  currentEta,
  isOverSpeedLimit,
}) => {
    const formatTime = (seconds: number) => {
      const hrs = Math.floor(seconds / 3600);
      const mins = Math.floor((seconds % 3600) / 60);
      return `${hrs}h ${mins}m`;
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
                    onPress: () => onMaintenanceAction('refuel'),
                    style: 'default'
                  },
                  {
                    text: 'Oil Change',
                    onPress: () => onMaintenanceAction('oil_change'),
                    style: 'default'
                  },
                  {
                    text: 'Tune Up',
                    onPress: () => onMaintenanceAction('tune_up'),
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
      </View>
    );
  };

// Add this function before the NavigationApp component
const fetchMotorAnalytics = async (userId: string): Promise<Motor[]> => {
  try {
    const response = await fetch(`${LOCALHOST_IP}/api/user-motors/user/${userId}`);
    if (!response.ok) throw new Error("Failed to fetch motor analytics");

    const rawData = await response.json();

    const data: Motor[] = rawData.map((motor: any) => ({
      _id: motor._id,
      name: motor.name || "",
      nickname: motor.nickname || "",
      fuelEfficiency: motor.fuelEfficiency ?? 0,
      engineDisplacement: motor.engineDisplacement ?? 0,
      fuelType: motor.fuelType || "Regular",
      oilType: motor.oilType || "Mineral",
      age: motor.age ?? 0,
      totalDistance: motor.analytics?.totalDistance ?? 0,
      currentFuelLevel: motor.currentFuelLevel ?? 0,
      fuelTank: motor.fuelTank ?? 15,
      lastMaintenanceDate: motor.lastMaintenanceDate ?? null,
      lastOilChange: motor.lastOilChange ?? null,
      lastRegisteredDate: motor.lastRegisteredDate ?? null,
      lastTripDate: motor.lastTripDate ?? null,
      lastRefuelDate: motor.lastRefuelDate ?? null,
      fuelLevel: motor.currentFuelLevel ?? 0,
      oilChangeDue: motor.oilChangeDue ?? false,
      maintenanceDue: motor.maintenanceDue ?? false,
      analytics: {
        totalDistance: motor.analytics?.totalDistance ?? 0,
        tripsCompleted: motor.analytics?.tripsCompleted ?? 0,
        totalFuelUsed: motor.analytics?.totalFuelUsed ?? 0,
      },
      // ✅ Add virtuals
      totalDrivableDistance: motor.totalDrivableDistance ?? 0,
      totalDrivableDistanceWithCurrentGas: motor.totalDrivableDistanceWithCurrentGas ?? 0,
      isLowFuel: motor.isLowFuel ?? false,
    }));

    return data;
  } catch (error) {
    console.error("Error fetching motor analytics:", error);
    return [];
  }
};


