import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  StyleSheet, View, ActivityIndicator, KeyboardAvoidingView,
  TouchableWithoutFeedback, Keyboard, Platform, Image, Text,
  TouchableOpacity, Modal, Alert, TextInput, SafeAreaView, ImageStyle,
  Animated,
  FlatList,
  Button
} from "react-native";
import Toast from "react-native-toast-message";
import MapView, { Marker, PROVIDER_GOOGLE, Polyline } from "react-native-maps";
import MaterialIcons from "react-native-vector-icons/MaterialIcons";
import { Dimensions } from "react-native";
const { width, height } = Dimensions.get("window");
import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";
import DropDownPicker from "react-native-dropdown-picker";
import { useUser } from "../AuthContext/UserContext";
import { LOCALHOST_IP, GOOGLE_MAPS_API_KEY } from "@env";
import * as Linking from "expo-linking";
import { LinearGradient } from 'expo-linear-gradient';
import SearchBar from "./loggedIn/SearchBar";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Speedometer from "./loggedIn/Speedometer";

//SAVE SA BACKEND BOSS
import * as api from "./Backend";
import MapScreenTry from "./screens/MapScreenTry";
// Define types for our components
interface MapComponentProps {
  mapRef: React.RefObject<MapView>;
  region: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  };
  mapStyle: string;
  currentLocation: {
    latitude: number;
    longitude: number;
  } | null;
  reportMarkers: any[];
  gasStations: any[];
  showReports: boolean;
  showGasStations: boolean;
  routeCoordinates?: {
    latitude: number;
    longitude: number;
  }[];
  isTracking?: boolean;
}
// Screen modes
type ScreenMode = 'planning' | 'tracking' | 'summary';

type FuelConsumptionStats = {
  average: number;
  max: number;
  min: number;
};

type MotorAnalytics = {
  totalDistance: number;
  tripsCompleted: number;
  totalFuelUsed: number;
  maintenanceAlerts: string[];
};

type Motor = {
  _id: string;
  userId: string;
  motorcycleId: string;
  nickname: string;
  name: string;
  fuelEfficiency: number;
  engineDisplacement: number;
  plateNumber: string;
  registrationDate: string; // ISO or empty string
  dateAcquired: string;     // ISO or empty string
  odometerAtAcquisition: number;
  currentOdometer: number;
  age: number;
  currentFuelLevel: number;
  fuelConsumptionStats: FuelConsumptionStats;
  analytics: MotorAnalytics;
  totalDrivableDistance: number;
  totalDrivableDistanceWithCurrentGas: number;
  isLowFuel: boolean;
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
};

const FAB = ({ onPress, label, bottom }) => (
  <TouchableOpacity style={[styles.fab, { bottom }]} onPress={onPress}>
    <View style={styles.fabContent}>
      <MaterialIcons name="search" size={40} color="#000" />
      <Text style={styles.fabText}>{label}</Text>
    </View>
  </TouchableOpacity>
);

const MyLocationButton = ({ onPress, bottom, iconName, left, disabled }) => (
  <TouchableOpacity
    style={[styles.myLocationButton, { bottom, left }, disabled && styles.disabledBtn]}
    onPress={disabled ? () => Alert.alert("Location Denied", "Enable location in settings.") : onPress}
    activeOpacity={disabled ? 1 : 0.7}
  >
    <MaterialIcons name={iconName} size={40} color="#fff" />
  </TouchableOpacity>
);

//Icons REPORT
const getIcon = (type) => {
  switch (type) {
    case "Accident": return require("../assets/icons/ROAD INCIDENTS ICON/Road_Accident.png");
    case "Traffic Jam": return require("../assets/icons/ROAD INCIDENTS ICON/Traffic_Jam.png");
    case "Hazard": return require("../assets/icons/ROAD INCIDENTS ICON/Hazard.png");
    case "Road Closure": return require("../assets/icons/ROAD INCIDENTS ICON/Road_Closure.png");
    //GAS STATIONS
    case "Caltex": return require("../assets/icons/GAS_STATIONS/CALTEX.png");
    case "Cleanfuel": return require("../assets/icons/GAS_STATIONS/CLEANFUEL.png");
    case "Flying V": return require("../assets/icons/GAS_STATIONS/FLYINGV.png");
    case "Jetti": return require("../assets/icons/GAS_STATIONS/JETTI.png");
    case "Petro Gazz": return require("../assets/icons/GAS_STATIONS/PETROGAZZ.png");
    case "Petron": return require("../assets/icons/GAS_STATIONS/PETRON.png");
    case "Phoenix": return require("../assets/icons/GAS_STATIONS/PHOENIX.png");
    case "Rephil": return require("../assets/icons/GAS_STATIONS/REPHIL.png");
    case "Seaoil": return require("../assets/icons/GAS_STATIONS/SEAOIL.png");
    case "Shell": return require("../assets/icons/GAS_STATIONS/SHELL.png");
    case "Total": return require("../assets/icons/GAS_STATIONS/TOTAL.png");
    case "Unioil": return require("../assets/icons/GAS_STATIONS/UNIOIL.png");
    default: return require("../assets/icons/default.png");
  }
};

//pang tracking ata 'to
const haversineKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const R = 6371; // km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};


type Props = MapComponentProps;





export default function RouteSelectionScreen({ navigation, route }) {
  const { focusLocation } = route.params || {};
  const { user, loading } = useUser();

  const mapRef = useRef(null);
  const locationSubscription = useRef(null);
  const [screenMode, setScreenMode] = useState<ScreenMode>('planning');

  // Existing states
  const [region, setRegion] = useState({ latitude: 14.7006, longitude: 120.9836, latitudeDelta: 0.005, longitudeDelta: 0.005 });
  const [currentLocation, setCurrentLocation] = useState(null);
  const [reportMarkers, setReportMarkers] = useState([]);
  const [gasStations, setGasStations] = useState([]);
  const [motors, setMotors] = useState([]);
  const [selectedMotor, setSelectedMotor] = useState<Motor | null>(useUser());

  const [trafficReportType, setTrafficReportType] = useState("Accident");
  const [description, setDescription] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showReports, setShowReports] = useState(true);
  const [showGasStations, setShowGasStations] = useState(true);
  const [mapStyle, setMapStyle] = useState("standard");
  const [locationPermissionGranted, setLocationPermissionGranted] = useState(true);
  const [open, setOpen] = useState(false);

  // MODALS
  const [isReportModalVisible, setIsReportModalVisible] = useState(false);
  const [selectMotorModalVisible, setSelectMotorModalVisible] = useState(false);



  // New states for tracking mode
  const [routeCoordinates, setRouteCoordinates] = useState([]);
  // add these near the top with your other refs/states
  const trackingLocationSub = useRef<Location.LocationSubscription | null>(null);
  const lastLocationRef = useRef<{ latitude: number; longitude: number; timestamp: number } | null>(null);
  const trackingStartTimeRef = useRef<number | null>(null);

  // rideStats now includes speed (current) and distance in km (you already have it)
  const [rideStats, setRideStats] = useState({
    duration: 0,        // seconds
    distance: 0,        // km
    fuelConsumed: 0,    // L
    avgSpeed: 0,        // km/h
    speed: 0,           // km/h current
    timeStarted: null,
    timeEnded: null,


  });

  const [isTracking, setIsTracking] = useState(false);
  const statsTimer = useRef(null);

  // Animation value for the stats panel
  const slideAnim = useRef(new Animated.Value(0)).current;

  const [image, setImage] = useState(null);

  const reportTypes = [
    { label: "Accident", value: "Accident" },
    { label: "Traffic Jam", value: "Traffic Jam" },
    { label: "Road Closure", value: "Road Closure" },
    { label: "Hazard", value: "Hazard" },

  ];
  const pickImage = async () => {
    // Ask permission
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      alert("Permission to access gallery is required!");
      return;
    }

    // Open picker
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 1,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#007bff" />
        <Text>Loading user...</Text>
      </View>
    );
  }
  const fetchData = useCallback(async (userId: string, signal?: AbortSignal) => {
    try {
      const endpoints = [
        fetch(`${LOCALHOST_IP}/api/reports`, { signal }),
        fetch(`${LOCALHOST_IP}/api/gas-stations`, { signal }),
        fetch(`${LOCALHOST_IP}/api/user-motors/user/${userId}`, { signal }),
      ];

      const results = await Promise.allSettled(endpoints);
      const processFetchResult = async (settled: PromiseSettledResult<Response>) => {
        if (settled.status !== "fulfilled") return { ok: false, error: settled.reason };
        const res = settled.value;
        if (!res.ok) return { ok: false, status: res.status, body: await res.text().catch(() => null) };
        return { ok: true, json: await res.json().catch((e) => ({ parseError: e })) };
      };

      const [reportsRes, gasRes, motorsRes] = await Promise.all(results.map(processFetchResult));

      if (reportsRes.ok && Array.isArray(reportsRes.json)) {
        setReportMarkers(reportsRes.json);
        await AsyncStorage.setItem("cachedReports", JSON.stringify(reportsRes.json));
      }
      if (gasRes.ok && Array.isArray(gasRes.json)) {
        setGasStations(gasRes.json);
        await AsyncStorage.setItem("cachedGasStations", JSON.stringify(gasRes.json));
      }
      if (motorsRes.ok && Array.isArray(motorsRes.json)) {
        setMotors(motorsRes.json);
        await AsyncStorage.setItem(`cachedMotors_${userId}`, JSON.stringify(motorsRes.json));
      }
    } catch (err: any) {
      if (err.name !== "AbortError") console.warn("fetchData error:", err);
    }
  }, []);

  useEffect(() => {
    if (!user?._id) return;
    let isMounted = true;
    const controller = new AbortController();

    const loadCachedData = async () => {
      try {
        const [cachedReports, cachedGas, cachedMotors] = await Promise.all([
          AsyncStorage.getItem("cachedReports"),
          AsyncStorage.getItem("cachedGasStations"),
          AsyncStorage.getItem(`cachedMotors_${user._id}`),
        ]);
        if (!isMounted) return;
        if (cachedReports) setReportMarkers(JSON.parse(cachedReports));
        if (cachedGas) setGasStations(JSON.parse(cachedGas));
        if (cachedMotors) {
          const parsed = JSON.parse(cachedMotors);
          if (Array.isArray(parsed)) {
            setMotors(parsed);
            if (parsed.length > 0) setSelectedMotor(parsed[0]);
          }
        }
      } catch (err) {
        console.warn("Failed to load cache:", err);
      }
    };

    (async () => {
      await loadCachedData();
      await fetchData(user._id, controller.signal);
    })();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [user?._id, fetchData]);

  useEffect(() => {
    if (!user?._id) return;
    const interval = setInterval(() => {
      console.log("⏳ Auto-refreshing data...");
      fetchData(user._id);
    }, 10000);
    return () => clearInterval(interval);
  }, [user?._id, fetchData]);

  // ✅ Conditional rendering comes AFTER hooks
  if (!user) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <Text>No user found. Please log in again.</Text>
      </View>
    );
  }


  const getCurrentLocation = useCallback(async () => {
    try {
      setIsLoading(true);
      const loc = await Location.getCurrentPositionAsync({});
      const coords = {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      };
      setCurrentLocation(coords);
      const newRegion = { ...coords, latitudeDelta: 0.0015, longitudeDelta: 0.0015 };
      setRegion(newRegion);
      mapRef.current?.animateToRegion(newRegion, 1000);
    } catch (error) {
      console.error("Location error:", error);
      // Alert.alert("Error", "Failed to fetch location.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchReports = useCallback(async () => {
    try {
      const res = await fetch(`${LOCALHOST_IP}/api/reports/`);
      const data = await res.json();
      setReportMarkers(data || []);
    } catch (err) {
      console.error("Reports fetch error:", err);
    }
  }, []);

  // const fetchValenzuelaGasStations = async () => {
  //   try {
  //     const res = await fetch(`${LOCALHOST_IP}/api/gas-stations`);
  //     const data = await res.json();
  //     setGasStations(data || []);
  //   } catch (err) {
  //     console.error("Gas fetch error:", err);
  //   }
  // };

  const submitTrafficReport = async () => {
    if (submitting || !description.trim()) {
      return Alert.alert("Required", "Enter description");
    }
    setSubmitting(true);
    try {
      const response = await fetch(`${LOCALHOST_IP}/api/reports/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportType: trafficReportType,
          location: currentLocation,
          description,
          userId: user?._id,
          image: image,
        }),
      });

      if (response.ok) {
        Toast.show({ type: "success", text1: "Report Submitted", text2: `Type: ${trafficReportType}` });
        setDescription("");
        setImage(null);
        fetchReports();
      } else {
        Alert.alert("Error", "Submit failed");
      }
    } catch (e) {
      console.error("Submit error:", e);
    } finally {
      setSubmitting(false);
      setIsReportModalVisible(false);
    }
  };

  const startTracking = useCallback(async () => {
    if (!selectedMotor) {
      Alert.alert("Select motor", "Please select a motor before starting tracking.");
      return;
    }

    // Reset route and stats
    setRouteCoordinates([]);
    const startTime = Date.now();
    setRideStats({
      duration: 0,
      distance: 0,
      fuelConsumed: 0,
      avgSpeed: 0,
      speed: 0,
      timeStarted: startTime,
      timeEnded: null,
    });

    trackingStartTimeRef.current = startTime;
    lastLocationRef.current = null;

    // Clear previous subscriptions / intervals
    trackingLocationSub.current?.remove();
    trackingLocationSub.current = null;
    if (statsTimer.current) {
      clearInterval(statsTimer.current);
      statsTimer.current = null;
    }

    // Duration timer (updates every second)
    statsTimer.current = setInterval(() => {
      setRideStats(prev => {
        const newDuration = prev.duration + 1;
        const avgSpeed = newDuration > 0 ? prev.distance / (newDuration / 3600) : 0;
        return { ...prev, duration: newDuration, avgSpeed };
      });
    }, 1000);

    try {
      trackingLocationSub.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Highest,
          timeInterval: 1000, // 1s
          distanceInterval: 1, // 1m
        },
        (loc) => {
          if (!loc?.coords) return;

          const { latitude: lat, longitude: lon, speed, timestamp = Date.now() } = loc.coords;

          // Update route
          setRouteCoordinates(prev => [...prev, { latitude: lat, longitude: lon }]);

          // Calculate distance delta
          const last = lastLocationRef.current;
          let distanceDeltaKm = 0;
          if (last) {
            distanceDeltaKm = haversineKm(last.latitude, last.longitude, lat, lon);
          }
          lastLocationRef.current = { latitude: lat, longitude: lon, timestamp };

          // Current speed
          let currentSpeedKmh = 0;
          if (typeof speed === "number" && !isNaN(speed)) {
            currentSpeedKmh = Math.max(0, speed) * 3.6; // m/s → km/h
          } else if (last && last.timestamp !== timestamp) {
            const dtHours = Math.max(0.001, (timestamp - last.timestamp) / 3600000); // ms → hours
            currentSpeedKmh = distanceDeltaKm / dtHours;
          }

          // Update ride stats
          setRideStats(prev => {
            const newDistance = prev.distance + distanceDeltaKm;
            const fuelEfficiency = selectedMotor?.fuelEfficiency ?? 0;
            const fuelDelta = fuelEfficiency > 0 ? distanceDeltaKm / fuelEfficiency : 0;
            const newFuelConsumed = prev.fuelConsumed + fuelDelta;

            const elapsedSeconds = Math.floor((Date.now() - trackingStartTimeRef.current) / 1000);
            const avgSpeed = elapsedSeconds > 0 ? newDistance / (elapsedSeconds / 3600) : prev.avgSpeed;

            // Update fuel level in backend
            if (selectedMotor) {
              const remainingGas = ((selectedMotor.totalDrivableDistanceWithCurrentGas - newDistance) / selectedMotor.totalDrivableDistance) * 100;
              api.updateFuelLevel(selectedMotor._id, remainingGas);
            }

            return {
              ...prev,
              distance: newDistance,
              fuelConsumed: newFuelConsumed,
              speed: currentSpeedKmh,
              avgSpeed,
            };
          });

          // Auto-center map
          mapRef.current?.animateToRegion({
            latitude: lat,
            longitude: lon,
            latitudeDelta: region.latitudeDelta ?? 0.01,
            longitudeDelta: region.longitudeDelta ?? 0.01,
          }, 500);
        }
      );

      setIsTracking(true);
    } catch (err) {
      console.error("Failed to start tracking location:", err);
      Alert.alert("Error", "Unable to start tracking location.");
    }
  }, [selectedMotor]);



  const tripData = {
    userId: user._id,
    motorId: selectedMotor._id,
    distance: rideStats.distance,                  // planned or estimated distance
    fuelUsedMin: 0,                                // optional, you can calculate
    fuelUsedMax: rideStats.fuelConsumed,           // actual fuel used
    timeArrived: new Date().toISOString(),         // arrival timestamp
    eta: new Date().toISOString(), // example ETA
    destination: "FREE RIDE",

    actualDistance: rideStats.distance,
    actualFuelUsedMin: 0,
    actualFuelUsedMax: rideStats.fuelConsumed,
    kmph: rideStats.avgSpeed,
    rerouteCount: 0,
    wasInBackground: false,
    showAnalyticsModal: true,
    analyticsNotes: "Smooth ride",
    trafficCondition: "moderate",
  };



  const stopTracking = useCallback(() => {
    // stop timers and subscriptions
    api.recordTrip(tripData);
    setIsTracking(false);
    setScreenMode('summary');

    console.log(statsTimer.current);
    if (statsTimer.current) {
      clearInterval(statsTimer.current);
      statsTimer.current = null;
    }
    if (trackingLocationSub.current) {
      trackingLocationSub.current.remove();
      trackingLocationSub.current = null;
    }

    // reset last refs
    lastLocationRef.current = null;
    trackingStartTimeRef.current = null;
  }, []);



  // Handle starting/stopping stats tracking
  // useEffect(() => {
  //   if (isTracking) {
  //     // Reset stats
  //     setRideStats({
  //       duration: 0,
  //       distance: 0,
  //       fuelConsumed: 0,
  //       avgSpeed: 0,
  //     });

  //     // Start stats timer
  //     statsTimer.current = setInterval(() => {
  //       setRideStats((prev) => ({
  //         ...prev,
  //         duration: prev.duration + 1,
  //         fuelConsumed: prev.fuelConsumed + Math.random() * 0.01, // Simulate
  //       }));
  //     }, 1000);

  //     // Animate panel slide up
  //     Animated.timing(slideAnim, {
  //       toValue: 1,
  //       duration: 300,
  //       useNativeDriver: true,
  //     }).start();
  //   } else {
  //     // Clear timer when stopped
  //     if (statsTimer.current) clearInterval(statsTimer.current);

  //     // Animate panel slide down
  //     Animated.timing(slideAnim, {
  //       toValue: 0,
  //       duration: 300,
  //       useNativeDriver: true,
  //     }).start();
  //   }

  //   // Cleanup when unmounting
  //   return () => {
  //     if (statsTimer.current) clearInterval(statsTimer.current);
  //   };
  // }, [isTracking]);

  // Pure render function
  const renderStatsPanel = () => {
    if (!isTracking) return null;

    return (
      <Animated.View
        style={[
          styles.statsPanel,
          {
            transform: [
              {
                translateY: slideAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 0], // slide up from hidden
                }),
              },
            ],
          },
        ]}
      >
        <View style={styles.statsGrid}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Duration</Text>
            <Text style={styles.statValue}>
              {Math.floor(rideStats.duration / 60)}:
              {(rideStats.duration % 60).toString().padStart(2, "0")}
            </Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Distance Traveled</Text>
            <Text style={styles.statValue}>
              {rideStats.distance.toFixed(2)} km
            </Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Avg Speed</Text>
            <Text style={styles.statValue}>
              {(rideStats.speed.toFixed(1))} km/h
            </Text>
          </View>
        </View>
      </Animated.View>
    );
  };


  return (
    <SafeAreaView style={styles.safeArea}>
      {/* <View style={styles.header}>
        <LinearGradient
          colors={['#00ADB5', '#00C2CC']}
          style={styles.headerGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        >
          <View style={styles.headerContent}>

            <View style={styles.headerTextContainer}>
              <Text style={styles.headerTitle}>Route Selection</Text>
              <Text style={styles.headerSubtitle}>Plan your journey and track fuel consumption</Text>
            </View>
          </View>
        </LinearGradient>
      </View> */}
      {/* <View style={[styles.fixedHeader && { backgroundColor: '#1A1A1A' }]}>
        <LinearGradient
          colors={['#00ADB5', '#00C2CC']}
          // style={styles.headerGradient}
        >

          <Image
            source={require("../assets/logo_trafficSlight_dark.png")}
            style={styles.logoImage as ImageStyle}
          />
        


        </LinearGradient>
      </View> */}
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.container}>
            {/* Search Bar - Waze Style */}
            {/* <TouchableOpacity 
              style={styles.searchBar}
              onPress={() => navigation.navigate("MapScreenTry", {
                currentLocation,
                mapStyle,
                fromRoute: true
              })}
            >
              
              <MaterialIcons name="search" size={24} color="#666" />
              <Text style={styles.searchText}>Where to?</Text>
            </TouchableOpacity> */}


            {screenMode === "summary" && (
              <Modal
                transparent
                animationType="fade"
                visible={true}
                onRequestClose={() => setScreenMode("planning")}
              >
                <View style={styles.modalOverlay}>
                  <View style={styles.modalContent}>
                    <Text style={styles.modalTitle}>Ride Summary</Text>

                    <Text style={[styles.modalText, { fontSize: 20, marginBottom: 1 }]}>
                      {selectedMotor.nickname}
                    </Text>
                    <Text style={[styles.modalText, { fontSize: 14, fontWeight: 400 }]}>
                      {selectedMotor.name}
                    </Text>
                    <Text style={styles.modalText}>
                      Duration: {(rideStats.duration / 60).toFixed(1)} min
                    </Text>
                    <Text style={styles.modalText}>
                      You traveled for a total of: {rideStats.distance.toFixed(2)} km
                    </Text>
                    <Text style={styles.modalText}>
                      Estimated Fuel Consumed: {rideStats.fuelConsumed.toFixed(2)} L
                    </Text>

                    <View style={styles.buttonRow}>
                      <TouchableOpacity
                        style={styles.doneButton}
                        onPress={() => {
                          setScreenMode("planning");
                          console.log("Saving ride stats:", rideStats, routeCoordinates);
                        }}
                      >
                        <Text style={styles.doneButtonText}>Done</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </Modal>
            )}

            <CustomMapViewComponent
              mapRef={mapRef}
              region={region}
              mapStyle={mapStyle}
              currentLocation={currentLocation}
              reportMarkers={reportMarkers}
              gasStations={gasStations}
              showReports={showReports}
              showGasStations={showGasStations}
              routeCoordinates={routeCoordinates}
              isTracking={isTracking}
            />

            {renderStatsPanel()}

            {
              (
                <>
                  {/* Floating Action Buttons - Waze Style */}
                  <View style={styles.floatingButtonsContainer}>
                    <>
                      {/* Left Side Buttons */}
                      {/* <View style={styles.leftButtons}> */}
                      {/* <TouchableOpacity 
                      style={[styles.floatingButton, styles.reportButton]}
                      onPress={() => setIsReportModalVisible(true)}
                    >
                      <MaterialIcons name="warning" size={24} color="#FFF" />
                    </TouchableOpacity> */}
                      {/* <TouchableOpacity 
                      style={[styles.floatingButton, { backgroundColor: showGasStations ? '#00ADB5' : '#FFF' }]}
                      onPress={() => {
                        setShowGasStations(!showGasStations);
                        setShowReports(!showReports);
                      }}
                      
                      
                    >
                      <MaterialIcons 
                        name="local-gas-station" 
                        size={24} 
                        color={showGasStations ? '#FFF' : '#666'} 
                      />
                    </TouchableOpacity> */}
                      {/* <TouchableOpacity 
                      style={[styles.floatingButton, { backgroundColor: showReports ? '#00ADB5' : '#FFF' }]}
                      onPress={() => 
                      setShowReports(!showReports);
                      setShowGasStations(!showGasStations);
                      }
                    >
                      <MaterialIcons 
                        name="report" 
                        size={24} 
                        color={showReports ? '#FFF' : '#666'} 
                      />
                    </TouchableOpacity> */}
                      {/* </View> */}
                    </>

                    {/* Right Side Buttons */}
                    <View style={[styles.rightButtons, { justifyContent: "space-between" }]}>

                      {/* BATMAN BUTTON */}
                      <TouchableOpacity
                        style={[
                          styles.floatingButton,
                          {
                            backgroundColor: "#2196F3",
                            height: height * 0.12,     // dati 85
                            width: width * 0.28,      // dati 125
                            borderRadius: 10,
                          },
                        ]}
                        onPress={() =>
                          setSelectMotorModalVisible(true)
                        }
                      >

                        <MaterialIcons name="two-wheeler" size={width * 0.23} color="#FFF" height={70} paddingTop={-100} style={{ top: -15 }} />
                        <Text style={{ marginTop: -15 }}>{selectedMotor.nickname}</Text>
                        <View style={{ flexDirection: "row", padding: 0 }}>
                          <MaterialIcons name="local-gas-station" size={width * 0.05} color="#FFF" />
                          <Text style={{ fontSize: width * 0.035, fontWeight: "900" }}>
                            {selectedMotor?.currentFuelLevel !== undefined
                              ? selectedMotor.currentFuelLevel.toFixed(0)
                              : "0"}
                          </Text>
                          <Text style={{ fontSize: width * 0.025, }}>%</Text>
                          <MaterialIcons name="gas-meter" size={width * 0.05} color="#FFF" />
                          <Text style={{ fontSize: width * 0.035, fontWeight: "900" }}>{selectedMotor.fuelEfficiency}</Text>
                          <View style={{ flexDirection: "column", alignItems: "center" }}>
                            <Text style={{ fontSize: width * 0.020 }}>km</Text>
                            {/* Fraction bar */}
                            <View style={{
                              height: 1,
                              backgroundColor: "black",
                              width: width * 0.02,
                              marginVertical: 0
                            }} />
                            <Text style={{ fontSize: width * 0.015 }}>L</Text>
                          </View>

                        </View>
                      </TouchableOpacity>
                      {/* PLAY BUTTON */}
                      <TouchableOpacity
                        style={[
                          styles.floatingButton,
                          {
                            backgroundColor: "#2196F3",
                            height: width * 0.25,    // dati 100
                            width: width * 0.25,     // para perfect circle
                            borderRadius: (width * 0.25) / 2,
                          },
                        ]}
                        onPress={() => { !isTracking ? startTracking() : stopTracking() }

                        }
                      >
                        <MaterialIcons name={isTracking ? "stop" : "play-arrow"} size={width * 0.15} color="#FFF" />
                      </TouchableOpacity>

                      {/* SMALL BUTTONS */}
                      <View>
                        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                          <TouchableOpacity
                            style={[styles.floatingButton, styles.reportButton, { height: width * 0.1, width: width * 0.1 }]}
                            onPress={() => setIsReportModalVisible(true)}
                          >
                            <MaterialIcons name="warning" size={width * 0.05} color="#FFF" />
                          </TouchableOpacity>


                          <TouchableOpacity
                            style={[styles.floatingButton, styles.locationButton, { height: width * 0.1, width: width * 0.1 }]}
                            onPress={() =>

                              navigation.navigate("MapScreenTry", {
                                currentLocation,
                                mapStyle,
                                fromRoute: true,
                              })

                            }

                          >
                            <MaterialIcons name="route" size={width * 0.05} color="#000" />
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={[
                              styles.floatingButton,
                              {
                                backgroundColor: showGasStations ? "#4CAF50" : "#9E9E9E",
                                height: width * 0.1,
                                width: width * 0.1,
                              },
                            ]}
                            onPress={() => {
                              setShowGasStations(!showGasStations);
                              setShowReports(!showReports);
                            }}
                          >
                            <MaterialIcons
                              name="visibility"
                              size={width * 0.05}
                              color={showGasStations ? "#FFF" : "#000"}
                            />
                          </TouchableOpacity>
                        </View>

                        <View style={{ width: width * 0.35, height: height * 0.06, marginTop: 0 }}>
                          <Image
                            source={require("../assets/logo_trafficSlight.png")}
                            style={{ width: width * 0.35, height: height * 0.08, resizeMode: "contain" }}
                          />
                        </View>
                        <TouchableOpacity
                          style={[styles.floatingButton, styles.locationButton, { height: width * 0.1, width: width * 0.1, position: "absolute", bottom: 120, right: 0 }]}
                          onPress={getCurrentLocation}
                          disabled={!locationPermissionGranted}
                        >
                          <MaterialIcons name="my-location" size={width * 0.05} color="#000" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                </>
              )
              // :
              // //kung false ang !isTracking
              // ("")

            }

            {selectMotorModalVisible && (

              <Modal
                visible={selectMotorModalVisible}
                animationType="slide"
                transparent
                onRequestClose={(() => setSelectMotorModalVisible(false))}
              >
                <View style={styles.overlay}>
                  <View style={styles.modal}>
                    {!isTracking && (
                      <View>
                        <Text style={styles.title}>Select a Motor</Text>

                        <FlatList
                          data={motors}
                          keyExtractor={(item) => item._id}
                          renderItem={({ item }) => (
                            <TouchableOpacity
                              style={[styles.motorItem, { flexDirection: "row", justifyContent: "space-between" }]}
                              onPress={() => {
                                setSelectedMotor(item);
                                setSelectMotorModalVisible(false)
                              }}
                            >
                              <View>


                                <Text style={styles.motorName}>
                                  {item.nickname || item.name}
                                </Text>
                                <Text style={styles.motorDetails}>
                                  {item.name || "N/A"}
                                </Text>
                                <Text style={styles.motorDetails}>
                                  {item.engineDisplacement}cc • {item.fuelEfficiency} km/L
                                </Text>
                              </View>
                              <View style={{ flexDirection: "row" }}>
                                <Text style={{ color: "black", fontSize: 40, fontWeight: "bold" }}> {item.currentFuelLevel.toFixed(0)}%</Text>
                                <MaterialIcons name="local-gas-station" size={50} color={"red"} />
                              </View>
                            </TouchableOpacity>
                          )}
                        />

                        <TouchableOpacity onPress={() => setSelectMotorModalVisible(false)} style={styles.closeBtn}>
                          <Text style={styles.closeText}>Cancel</Text>
                        </TouchableOpacity>

                      </View>
                    )}


                    {isTracking && (
                      <View >
                        <Text style={styles.title}>{selectedMotor.nickname}</Text>

                        <View style={{ flexDirection: "row" }}>
                          <MaterialIcons name="local-gas-station" size={25} color={"red"} />
                          <Text style={[styles.title, { alignSelf: "center", height: "100%", marginBottom: 0, fontWeight: "900" }]}>
                            FUEL LEVEL: {selectedMotor.currentFuelLevel.toFixed(0)}%
                          </Text>
                        </View>

                        <View style={{ flexDirection: "row", marginTop: 10 }}>
                          <MaterialIcons name="moving" size={25} />
                          <Text style={[styles.title, { alignSelf: "center", height: "100%", marginBottom: 0, fontWeight: "500" }]}>
                            DISTANCE {selectedMotor.analytics.totalDistance.toFixed(2)} km
                          </Text>
                        </View>



                        {/* <FlatList
                          data={motors}
                          keyExtractor={(item) => item._id}
                          renderItem={({ item }) => (
                            <TouchableOpacity
                              style={[styles.motorItem, { flexDirection: "row", justifyContent: "space-between" }]}
                              onPress={() => {
                                setSelectedMotor(item);
                                setSelectMotorModalVisible(false)
                              }}
                            >
                              <View>


                                <Text style={styles.motorName}>
                                  {item.nickname || item.name}
                                </Text>
                                <Text style={styles.motorDetails}>
                                  {item.name || "N/A"}
                                </Text>
                                <Text style={styles.motorDetails}>
                                  {item.engineDisplacement}cc • {item.fuelEfficiency} km/L
                                </Text>
                              </View>
                              <View style={{ flexDirection: "row" }}>
                                <Text style={{ color: "black", fontSize: 40, fontWeight: "bold" }}> {item.currentFuelLevel}%</Text>
                                <MaterialIcons name="local-gas-station" size={50} color={"red"} />
                              </View>
                            </TouchableOpacity>
                          )}
                        /> */}

                        <TouchableOpacity onPress={() => setSelectMotorModalVisible(false)} style={styles.closeBtn}>
                          <Text style={styles.closeText}>Cancel</Text>
                        </TouchableOpacity>

                      </View>


                    )
                    }
                  </View>
                </View>
              </Modal>
            )}






            <Modal transparent visible={isReportModalVisible} animationType="slide">
              <TouchableWithoutFeedback onPress={() => setIsReportModalVisible(false)}>
                <View style={styles.modalOverlay}>
                  <View style={styles.modalContent}>
                    <Text style={styles.menuHeader}>Add Traffic Report</Text>
                    <DropDownPicker
                      open={open}
                      value={trafficReportType}
                      items={reportTypes}
                      setOpen={setOpen}
                      setValue={setTrafficReportType}
                      setItems={() => { }}
                      style={{ borderColor: "#ccc", marginBottom: 20 }}
                    />
                    <TextInput
                      value={description}
                      onChangeText={(text) => setDescription(text)}
                      placeholder="Short description"
                      style={styles.input}
                      maxLength={20}
                    />
                    {/* Image Picker */}
                    <TouchableOpacity onPress={pickImage} style={[styles.closeButton, { backgroundColor: "#4caf50" }]}>
                      <Text style={styles.btnText}>{image ? "Change Image" : "Upload Image"}</Text>
                    </TouchableOpacity>

                    {/* Preview */}
                    {image && (
                      <Image
                        source={{ uri: image }}
                        style={{ width: 200, height: 200, marginVertical: 10, borderRadius: 8 }}
                        resizeMode="cover"
                      />
                    )}
                    <TouchableOpacity onPress={submitTrafficReport} disabled={submitting} style={styles.closeButton}>
                      <Text style={styles.btnText}>{submitting ? "Submitting..." : "Submit Report"}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setIsReportModalVisible(false)} style={[styles.closeButton, { backgroundColor: "#aaa" }]}>
                      <Text style={styles.btnText}>Cancel</Text>
                    </TouchableOpacity>
                  </View>

                </View>
              </TouchableWithoutFeedback>
            </Modal>




          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
      <Toast />
    </SafeAreaView>
  );
}


const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F2EEEE',
  },
  header: {
    width: '100%',
    backgroundColor: '#F2EEEE',
    zIndex: -0,
    overflow: 'hidden',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  // headerGradient: {
  //   padding: 24,
  //   paddingTop: 0,
  //   paddingBottom: 10,

  // },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    marginRight: 16,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '500',
  },
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  searchBar: {
    position: 'absolute',
    bottom: 70,
    left: 16,
    right: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 30,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  searchText: {
    marginLeft: 12,
    fontSize: 16,
    color: '#666',
  },
  floatingButtonsContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    shadowColor: '#000',
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    backgroundColor: 'rgba(255, 255, 255, 1)', // translucent black
    borderTopStartRadius: 20,
    borderTopEndRadius: 20
  },
  leftButtons: {
    // flexDirection: 'row',
    // alignItems: 'center',
    // gap: 12,

  },
  rightButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    margin: 8,
    // paddingVertical:40
    paddingTop: 10,
    // borderRadius:10

  },
  floatingButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  reportButton: {
    backgroundColor: '#FF5722',
  },
  locationButton: {
    backgroundColor: '#FFF',
  },
  fab: { position: 'absolute', right: 0, left: 0, padding: 15, backgroundColor: "#007AFF", zIndex: 999 },
  fabText: { color: "#000", fontSize: 16, marginLeft: 8 },
  fabContent: { flexDirection: 'row', alignItems: 'center', backgroundColor: "#fff", padding: 10, borderRadius: 50 },
  userMarker: {
    width: 40,
    height: 40,
    resizeMode: "contain",
  },
  iconMarker: {
    width: 35,
    height: 35,
    resizeMode: "contain",
  },
  myLocationButton: { position: "absolute", padding: 15, borderRadius: 50, zIndex: 300, backgroundColor: "#007AFF" },
  disabledBtn: { backgroundColor: "#aaa", opacity: 0.6 },
  loadingContainer: { position: "absolute", top: "50%", left: "50%", transform: [{ translateX: -50 }, { translateY: -50 }] },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", alignItems: "center" },
  modalContent: { backgroundColor: "#fff", padding: 20, borderRadius: 10, width: "80%" },
  menuHeader: { fontSize: 20, fontWeight: "bold", marginBottom: 10 },
  input: { borderWidth: 1, borderColor: "#ccc", padding: 10, borderRadius: 5, marginBottom: 10 },
  closeButton: { backgroundColor: "#3498db", padding: 10, borderRadius: 5, marginTop: 10 },
  btnText: { color: "#fff", textAlign: "center" },
  statsPanel: {
    position: 'absolute',
    bottom: 680,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 15,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    alignItems: 'center',
    padding: 10,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  trackingControls: {
    position: 'absolute',
    bottom: 30,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  controlButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  startButton: {
    backgroundColor: '#4CAF50',
  },
  stopButton: {
    backgroundColor: '#FF0000',
  },

  fixedHeader: {
    width: '100%',
    backgroundColor: '#F2EEEE',
    zIndex: 10,
    overflow: 'hidden',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  logoImage: {
    width: "70%",
    height: 69,
    alignSelf: 'center',
    resizeMode: "contain", // good for scaling
  },

  infoBox: {
    position: "absolute",
    bottom: 140,
    left: 20,
    right: 20,
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 5,
  },
  // title: { fontSize: 16, fontWeight: "bold" },
  desc: { fontSize: 14, marginTop: 4 },
  timestamp: { fontSize: 12, color: "gray", marginTop: 4 },
  voteRow: { flexDirection: "row", alignItems: "center", marginTop: 10 },
  voteButton: {
    padding: 8,
    backgroundColor: "#eee",
    borderRadius: 8,
    marginHorizontal: 5,
  },
  voteCount: { fontSize: 16, fontWeight: "bold" },
  // closeButton: {
  //   marginTop: 10,
  //   backgroundColor: "#333",
  //   paddingVertical: 8,
  //   borderRadius: 8,
  //   alignItems: "center",
  // }
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modal: {
    width: "85%",
    maxHeight: "70%",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 15,
    textAlign: "left",
  },
  motorItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: "#eee",
  },
  motorName: {
    fontSize: 16,
    fontWeight: "600",
  },
  motorDetails: {
    fontSize: 14,
    color: "#555",
  },
  closeBtn: {
    marginTop: 15,
    padding: 12,
    backgroundColor: "#ddd",
    borderRadius: 8,
    alignItems: "center",
  },
  closeText: {
    fontWeight: "bold",
  },

  // modalOverlay: {
  //   flex: 1,
  //   backgroundColor: "rgba(0,0,0,0.5)", // semi-transparent background
  //   justifyContent: "center",
  //   alignItems: "center",
  // },
  // modalContent: {
  //   width: "85%",
  //   backgroundColor: "#fff",
  //   borderRadius: 12,
  //   padding: 20,
  //   shadowColor: "#000",
  //   shadowOpacity: 0.2,
  //   shadowRadius: 6,
  //   elevation: 6,
  // },
  modalTitle: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 16,
    textAlign: "center",
    color: "#333",
  },
  modalText: {
    justifyContent: "space-between",
    textAlign: "justify",
    alignContent: "space-between",
    fontWeight: 700,
    fontSize: 16,
    color: "#444",
    marginBottom: 8,
  },
  buttonRow: {
    marginTop: 20,
    flexDirection: "row",
    justifyContent: "center",
  },
  doneButton: {
    backgroundColor: "#007BFF",
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
  },
  doneButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },


});



const CustomMapViewComponent: React.FC<Props> = ({
  mapRef, region, mapStyle, currentLocation, reportMarkers,
  gasStations, showReports, showGasStations, routeCoordinates, isTracking
}) => {
  const [selectedReport, setSelectedReport] = useState<any | null>(null
  );
  const [selectedGas, setSelectedGas] = useState<any | null>(null);
  // const [driving,isDriving] = useState(false);
  const { user } = useUser();


  // helper to validate coordinates
  const validCoords = (station: any) => {
    const coords = station?.location?.coordinates;
    if (!coords || !Array.isArray(coords) || coords.length < 2) return false;
    const lon = Number(coords[0]);
    const lat = Number(coords[1]);
    return Number.isFinite(lat) && Number.isFinite(lon);
  };

  // Filtered list with only valid coordinates
  const filteredGasStations = Array.isArray(gasStations) ? gasStations.filter(validCoords) : [];

  // debug helper — logs the station you clicked
  const onGasPress = (station: any) => {
    console.log("Gas marker pressed:", station);
    setSelectedGas(station);
  };

  const handleVote = async (id: string, type: "up" | "down") => {
    if (!user) return;

    const voteValue = type === "up" ? 1 : -1;

    try {
      const res = await fetch(`${LOCALHOST_IP}/api/reports/${id}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user._id, vote: voteValue }),
      });

      const data = await res.json();

      if (res.ok) {
        setSelectedReport(prev => ({ ...prev, ...data.report }));
        console.log("Nakavote na boss");
      } else {
        console.warn("⚠️ Vote failed:", data.msg);
      }
    } catch (err) {
      console.error("❌ Error voting report:", err);
    }
  };

  const userVote = user && selectedReport
    ? selectedReport.votes?.find((v: any) => v.userId === user._id)?.vote || 0
    : 0;

  return (
    <View style={{ flex: 1 }}>
      <MapView
        ref={mapRef}
        style={styles.map}
        region={region}
        customMapStyle={[]}
        showsTraffic
        showsMyLocationButton={false}
        followsUserLocation={isTracking}
        showsCompass={true}
        provider={PROVIDER_GOOGLE}
      >
        {currentLocation && (
          <Marker coordinate={currentLocation} title="Your Location">
            <Image source={require("../assets/icons/User-onTrack-MARKER.png")} style={styles.userMarker as any} />
          </Marker>
        )}

        {showReports && Array.isArray(reportMarkers) && reportMarkers.map((report, index) => (
          report?.location ? (
            <Marker
              key={`report-${report._id ?? index}`}
              coordinate={report.location}
              onPress={() => [
                setSelectedReport(report),
                setSelectedGas(null)]

              }
            >
              <Image source={getIcon(report.reportType)} style={styles.iconMarker as any} />
            </Marker>
          ) : null
        ))}

        {showGasStations && filteredGasStations.map((station, index) => {
          const lon = Number(station.location.coordinates[0]);
          const lat = Number(station.location.coordinates[1]);

          return (
            <Marker
              key={station._id ?? `gas-${index}`}
              coordinate={{ latitude: lat, longitude: lon }}
              onPress={() => [setSelectedGas(station),
              setSelectedReport(null)]
              }
            >
              <Image source={getIcon(station.brand)} style={styles.iconMarker as any} />
            </Marker>
          );
        })}

        {isTracking && routeCoordinates && routeCoordinates.length > 1 && (
          <Polyline coordinates={routeCoordinates} strokeColor="#FF0000" strokeWidth={3} />
        )}
      </MapView>

      {/* Selected report card */}
      {selectedReport && (
        <View style={styles.infoBox}>
          <View style={{ justifyContent: "space-between", flexDirection: "row", alignItems: "center" }}>
            <Text style={[styles.title]}>{selectedReport.reportType ?? "REPORT"}</Text>
            {selectedReport?.verified?.verifiedByAdmin > 0 && <MaterialIcons name={"verified"} size={32} color="blue" />}
          </View>

          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <Text style={styles.desc}>{selectedReport.description}</Text>
              <Text style={styles.desc}>{selectedReport.address}</Text>
              <Text style={styles.timestamp}>{new Date(selectedReport.timestamp).toLocaleString()}</Text>

              <View style={[styles.voteRow, { marginTop: 5 }]}>
                <TouchableOpacity style={styles.voteButton} onPress={() => handleVote(selectedReport._id, "up")}>
                  <Text style={{ fontSize: 16, color: userVote === 1 ? "green" : "black" }}>👍</Text>
                </TouchableOpacity>

                <Text style={styles.voteCount}>
                  {selectedReport.votes?.reduce((sum: any, v: any) => sum + v.vote, 0) || 0}
                </Text>

                <TouchableOpacity style={styles.voteButton} onPress={() => handleVote(selectedReport._id, "down")}>
                  <Text style={{ fontSize: 16, color: userVote === -1 ? "red" : "black" }}>👎</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={{ backgroundColor: "black", width: 70, height: 70, borderRadius: 6 }} />
          </View>

          <TouchableOpacity style={[styles.closeButton, { backgroundColor: "red" }]} onPress={() => setSelectedReport(null)}>
            <Text style={{ color: "#fff", alignSelf: "center" }}>Close</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Selected gas card — show only when selectedGas exists */}
      {selectedGas && (

        <View style={styles.infoBox}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <View style={{ maxWidth: "70%" }}>
              <Text style={styles.title}>{selectedGas?.name ?? "NO NAME"}</Text>
              {/* <Text style={styles.desc}>{selectedGas?.brand ?? "NO BRAND"}</Text> */}
              <Text style={styles.desc}>{selectedGas?.address?.street ?? "NO ADDRESS"}</Text>
            </View>
            <View>
              <Image source={getIcon(selectedGas?.brand)} style={{ height: 50, width: 50 }} />
            </View>
          </View>

          <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 8 }}>
            <View style={{ flex: 1, marginRight: 6, alignItems: "center", padding: 8, borderRadius: 8, backgroundColor: "green" }}>
              <Text style={{ fontWeight: "bold" }}>UNLEADED</Text>
              <Text style={{ fontSize: 28 }}>{selectedGas?.fuelPrices?.gasoline ?? "N/A"}</Text>
            </View>

            <View style={{ flex: 1, marginLeft: 6, alignItems: "center", padding: 8, borderRadius: 8, backgroundColor: "gold" }}>
              <Text style={{ fontWeight: "bold" }}>PREMIUM</Text>
              <Text style={{ fontSize: 28 }}>{selectedGas?.fuelPrices?.premium ?? "N/A"}</Text>
            </View>
          </View>

          <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 10 }}>
            {/* <TouchableOpacity style={[styles.closeButton, { flex: 1, marginRight: 6, backgroundColor: "#2196F3" }]} onPress={() => {
              // TODO: implement route logic
              console.log("GET ROUTE pressed for:", selectedGas);
            }}>
              <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>GET ROUTE</Text>
            </TouchableOpacity> */}

            <TouchableOpacity style={[styles.closeButton, { flex: 1, marginLeft: 6, backgroundColor: "#F44336" }]} onPress={() => setSelectedGas(null)}>
              <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>CLOSE</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};

{/*
// const CustomMapViewComponent: React.FC<Props> = ({
//   mapRef, region, mapStyle, currentLocation, reportMarkers,
//   gasStations, showReports, showGasStations, routeCoordinates, isTracking
// }) => {
//   const [selectedReport, setSelectedReport] = useState<any | null>(null);
//   const [selectedGas, setSelectedGas] = useState<any | null>(null);
//   const { user } = useUser();

//   // console.log(gasStations);
//   const handleVote = async (id: string, type: "up" | "down") => {
//     if (!user) return;

//     const voteValue = type === "up" ? 1 : -1;

//     try {
//       const res = await fetch(`${LOCALHOST_IP}/api/reports/${id}/vote`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({ userId: user._id, vote: voteValue }),
//       });

//       const data = await res.json();

//       if (res.ok) {
//         // update selected report with backend response
//         setSelectedReport(prev => ({ ...prev, ...data.report }));
//       } else {
//         console.warn("⚠️ Vote failed:", data.msg);
//       }
//     } catch (err) {
//       console.error("❌ Error voting report:", err);
//     }
//   };

//   const userVote = user && selectedReport
//     ? selectedReport.votes?.find(v => v.userId === user._id)?.vote || 0
//     : 0;

//   const totalVotes = selectedReport
//     ? selectedReport.votes?.reduce((sum, v) => sum + v.vote, 0) || 0
//     : 0;

//   return (
//     <View style={{ flex: 1 }}>
//       <MapView
//         ref={mapRef}
//         style={styles.map}
//         region={region}
//         customMapStyle={[]} // FOR DARK MODES ETC.
//         showsTraffic
//         showsMyLocationButton={false}
//         followsUserLocation={isTracking}
//         showsCompass={true}   // 
//       >
//         {currentLocation && (
//           <Marker coordinate={currentLocation} title="Your Location">
//             <Image
//               source={require("../assets/icons/User-onTrack-MARKER.png")}
//               style={styles.userMarker as any}
//             />
//           </Marker>
//         )}

//         {showReports && reportMarkers.map((report, index) => (
//           <Marker
//             key={`report-${index}`}
//             coordinate={report.location}

//             onPress={() => setSelectedReport(report)}
//           >
//             <Image
//               source={getIcon(report.reportType)}
//               style={styles.iconMarker as any}
//             />
//           </Marker>
//         ))}

//         {showGasStations && gasStations.map((station, index) => (
//           <Marker
//             key={`gas-${index}`}
//             coordinate={{
//               latitude: station.location.coordinates[1],
//               longitude: station.location.coordinates[0],
//             }}
//             onPress={() => setSelectedGas(station)}

//           >
//             <Image
//               source={getIcon(station.brand)}
//               style={styles.iconMarker as any}
//             />
//           </Marker>
//         ))}

//         {isTracking && routeCoordinates && routeCoordinates.length > 1 && (
//           <Polyline
//             coordinates={routeCoordinates}
//             strokeColor="#FF0000"
//             strokeWidth={3}
//           />
//         )}
//       </MapView>

//       
//       <>
//         {/* {selectedReport && (
//         <View style={styles.infoBox}>
//           <Text style={styles.title}>{selectedReport.reportType}</Text>
//           <Text style={styles.desc}>{selectedReport.description}</Text>
//           <Text style={styles.timestamp}>
//             {new Date(selectedReport.timestamp).toLocaleString()}
//           </Text>

//           <View style={styles.voteRow}>
//             <TouchableOpacity
//               style={styles.voteButton}
//               onPress={() => handleVote(selectedReport._id || selectedReport.timestamp, "up")}
//             >
//               <Text style={{ fontSize: 16 }}>👍</Text>
//             </TouchableOpacity>
//             <Text style={styles.voteCount}>
//               {votes[selectedReport._id || selectedReport.timestamp] || 0}
//             </Text>
//             <TouchableOpacity
//               style={styles.voteButton}
//               onPress={() => handleVote(selectedReport._id || selectedReport.timestamp, "down")}
//             >
//               <Text style={{ fontSize: 16 }}>👎</Text>
//             </TouchableOpacity>
//           </View>

//           <TouchableOpacity
//             style={styles.closeButton}
//             onPress={() => setSelectedReport(null)}
//           >
//             <Text style={{ color: "#fff" }}>Close</Text>
//           </TouchableOpacity>
//         </View>
//       )} *
//       </>
//       {selectedReport && (
//         <View style={styles.infoBox}>
//           <View style={{ justifyContent: "space-between", flexDirection: "row", alignItems: "center" }}>
//             <Text style={[styles.title]}>ACCIDENT</Text>
//             {selectedReport.verified?.verifiedByAdmin > 0 && (
//               <MaterialIcons name={"verified"} size={32} color="blue" />
//             )}
//           </View>

//           <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
//             
//             <View style={{ flex: 1, marginRight: 10 }}>
//               <Text style={styles.desc}>{selectedReport.description}</Text>
//               <Text style={styles.desc}>{selectedReport.address}</Text>
//               <Text style={styles.timestamp}>
//                 {new Date(selectedReport.timestamp).toLocaleString()}
//               </Text>

//               <View style={[styles.voteRow, { marginTop: 5 }]}>
//                 <TouchableOpacity
//                   style={styles.voteButton}
//                   onPress={() => handleVote(selectedReport._id, "up")}
//                 >
//                   <Text style={{ fontSize: 16, color: userVote === 1 ? "green" : "black" }}>👍</Text>
//                 </TouchableOpacity>

//                 <Text style={styles.voteCount}>
//                 {selectedReport.votes?.reduce((sum, v) => sum + v.vote, 0) || 0}

//                 </Text>

//                 <TouchableOpacity
//                   style={styles.voteButton}
//                   onPress={() => handleVote(selectedReport._id, "down")}
//                 >
//                   <Text style={{ fontSize: 16, color: userVote === -1 ? "red" : "black" }}>👎</Text>
//                 </TouchableOpacity>
//               </View>
//             </View>

//             
//             <View style={{ backgroundColor: "black", width: 70, height: 70, borderRadius: 6 }} />
//           </View>

//           <TouchableOpacity
//             style={[styles.closeButton, { backgroundColor: "red" }]}
//             onPress={() => setSelectedReport(null)}
//           >
//             <Text style={{ color: "#fff", alignSelf: "center" }}>Close</Text>
//           </TouchableOpacity>
//         </View>

//       )}

//       {!selectedGas && (
//         <View style={styles.infoBox}>
//           <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
//             <View>
//     
//               <Text style={styles.title}>{selectedGas?.name ?? "NO NAME"}</Text>
//              
//               <Text style={styles.desc}>{selectedGas?.brand ?? "NO BRAND"}</Text>
//          
//               <Text style={styles.desc}>{selectedGas?.address ?? "NO ADDRESS"}</Text>

//             </View>
//             <View>
//               <Image source={getIcon(selectedGas?.brand)}
//                 style={{ height: 50, width: 80 }}
//               />
//             </View>
//           </View>

//           <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
//             <View
//               style={{
//                 flexDirection: "column",
//                 justifyContent: "center",   // para gitna vertical
//                 alignItems: "center",       // para gitna horizontal
//                 backgroundColor: "green",
//                 width: 150,
//                 padding: 10,                // optional, para may breathing space
//                 borderRadius: 8             // optional, para mas maganda
//               }}
//             >
//               <Text style={{ fontWeight: "bold" }}>UNLEADED</Text>
//              
//               <Text style={{ fontSize: 40 }}>{selectedGas?.fuelPrices?.gasoline ?? "NO GASOLINE"}</Text>
//             </View>

//             <View
//               style={{
//                 flexDirection: "column",
//                 justifyContent: "center",   // para gitna vertical
//                 alignItems: "center",       // para gitna horizontal
//                 backgroundColor: "gold",
//                 width: 150,
//                 padding: 10,                // optional, para may breathing space
//                 borderRadius: 8             // optional, para mas maganda
//               }}
//             >
//               <Text style={{ fontWeight: "bold" }}>PREMIUM</Text>
//           
//               <Text style={{ fontSize: 40 }}>{selectedGas?.fuelPrices?.premium ?? "NO PREMIUM"}</Text>
//             </View>

//           </View>
//           <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 10 }}>
//             <TouchableOpacity
//               style={[
//                 styles.closeButton,
//                 {
//                   maxWidth: 140,
//                   flex: 1,
//                   backgroundColor: "#2196F3", // blue
//                   paddingVertical: 12,
//                   borderRadius: 10,
//                   alignItems: "center",
//                   shadowColor: "#000",
//                   shadowOffset: { width: 0, height: 2 },
//                   shadowOpacity: 0.2,
//                   shadowRadius: 3,
//                   elevation: 3,
//                 },
//               ]}
//               onPress={() => setSelectedGas(null)}
//             >
//               <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>
//                 GET ROUTE
//               </Text>
//             </TouchableOpacity>

//             <TouchableOpacity
//               style={[
//                 styles.closeButton,
//                 {
//                   maxWidth: 140,
//                   flex: 1,
//                   backgroundColor: "#F44336", // red
//                   paddingVertical: 12,
//                   borderRadius: 10,
//                   alignItems: "center",
//                   shadowColor: "#000",
//                   shadowOffset: { width: 0, height: 2 },
//                   shadowOpacity: 0.2,
//                   shadowRadius: 3,
//                   elevation: 3,
//                 },
//               ]}
//               onPress={() => setSelectedGas(null)}
//             >
//               <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>
//                 CLOSE
//               </Text>
//             </TouchableOpacity>
//           </View>
//         </View>
//       )}
//     </View>
//   );
// };
*/}


