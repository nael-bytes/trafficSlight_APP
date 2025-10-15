// Importing required packages, components, utilities, and styles
import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  SafeAreaView,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  StyleSheet,
  Platform,
  ActivityIndicator,
} from "react-native";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import * as Location from "expo-location";
import MaterialIcons from "react-native-vector-icons/MaterialIcons";
import DropDownPicker from "react-native-dropdown-picker";
import Toast from "react-native-toast-message";

// Context and utility hooks
import { useUser } from "../../AuthContext/UserContextImproved";
import { useUserLocation } from "./hooks/useUserLocation";
import {
  formatETA,
  calculateTotalPathDistance,
  calculateFuelRange,
  reverseGeocodeLocation,
  decodePolyline,
} from "./utils/mapUtils";

// Reusable components
import CustomMapViewComponent from "./components/Map/CustomMapViewComponent";
import TrafficIncidentMarker from "./components/Map/TrafficIncidentMarker";
import FAB from "./components/Controls/FAB";
import MyLocationButton from "./components/Controls/MyLocationButton";
import TripSummaryModal from "./components/Overlays/TripSummaryModal";

import * as TaskManager from "expo-task-manager";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LOCATION_TASK } from "./services/backgroundLocationTask";
import { LOCALHOST_IP } from "@env";

const ARRIVAL_THRESHOLD = 50;

export default function TrackTripUnifiedScreen() {
  const { user } = useUser();
  const mapRef = useRef(null);

  // Hook to manage region and current location state
  const {
    region,
    currentLocation,
    setRegion,
    setCurrentLocation,
    getCurrentLocation,
    locationPermissionGranted,
  } = useUserLocation(mapRef);

  // Trip and POI-related states
  const [tracking, setTracking] = useState(false);
  const [tripPath, setTripPath] = useState([]);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [startAddress, setStartAddress] = useState("");
  const [tripSummaryVisible, setTripSummaryVisible] = useState(false);
  const [showGas, setShowGas] = useState(true);
  const [showReports, setShowReports] = useState(true);
  const [gasStations, setGasStations] = useState([]);
  const [reportMarkers, setReportMarkers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // 📡 Fetch Gas Stations and Reports from backend
  const fetchPOIData = useCallback(async () => {
    try {
      const [gasRes, reportRes] = await Promise.all([
        fetch(`${LOCALHOST_IP}/api/gas-stations`),
        fetch(`${LOCALHOST_IP}/api/reports`),
      ]);
      const gasData = await gasRes.json();
      const reportData = await reportRes.json();
      setGasStations(gasData || []);
      setReportMarkers(reportData || []);
    } catch (err) {
      console.error("Fetch POI error", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch POIs on mount
  useEffect(() => {
    fetchPOIData();
  }, [fetchPOIData]);

  // 🚀 Start the trip
  const handleStartTrip = async () => {
    const address = await reverseGeocodeLocation(currentLocation.latitude, currentLocation.longitude);
    setStartAddress(address);
    setTripPath([]);
    setTracking(true);
    setStartTime(Date.now());
  };

  // 🛑 Stop the trip and show summary
  const handleStopTrip = () => {
    setTracking(false);
    setTripSummaryVisible(true);
  };

  // 🎯 Continuously track user location when trip is active
  useEffect(() => {
    let sub;
    const track = async () => {
      const loc = await Location.getCurrentPositionAsync({});
      setCurrentLocation(loc.coords);
      setRegion({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      });
      mapRef.current?.animateToRegion(region);

      // 🛰️ Watch position updates
      sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, distanceInterval: 5 },
        (update) => {
          const coords = {
            latitude: update.coords.latitude,
            longitude: update.coords.longitude,
          };
          setCurrentLocation(coords);
          if (tracking) setTripPath((prev) => [...prev, coords]);
        }
      );
    };

    track();
    return () => sub?.remove(); // 🧹 Cleanup on unmount
  }, [tracking]);

  // 📊 Compute trip data
  const durationMins = startTime ? Math.round((Date.now() - startTime) / 60000) : 0;
  const distanceKm = calculateTotalPathDistance(tripPath);
  const fuelEst = calculateFuelRange(distanceKm, 30); // assumes 30 km/L

  return (
    <SafeAreaView style={styles.container}>
      {/* 🧭 Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Track & Navigate</Text>
      </View>

      {/* 🗺️ Main Map View */}
      <CustomMapViewComponent
        mapRef={mapRef}
        region={region}
        mapStyle="standard"
        currentLocation={currentLocation}
        reportMarkers={reportMarkers}
        gasStations={gasStations}
        showReports={showReports}
        showGasStations={showGas}
        polylinePath={tripPath}
      />

      {/* 🎚️ Toggle Reports & Gas Stations */}
      <View style={styles.toggleContainer}>
        {["Reports", "Gas"].map((label, idx) => (
          <TouchableOpacity
            key={label}
            onPress={() =>
              idx === 0 ? setShowReports(!showReports) : setShowGas(!showGas)
            }
            style={[
              styles.segmentButton,
              (idx === 0 ? showReports : showGas)
                ? styles.activeSegment
                : styles.inactiveSegment,
            ]}
          >
            <MaterialIcons
              name={idx === 0 ? "report" : "local-gas-station"}
              size={18}
              color="#000"
            />
            <Text style={styles.segmentText}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ⚙️ Main Controls */}
      <FAB
        onPress={tracking ? handleStopTrip : handleStartTrip}
        label={tracking ? "Stop Tracking" : "Start Trip"}
        bottom={20}
      />
      <MyLocationButton  onPress={getCurrentLocation} bottom={90} left={10}/>
      {isLoading && <ActivityIndicator style={styles.loader} />}

      {/* 📋 Trip Summary Overlay */}
      <TripSummaryModal
        visible={tripSummaryVisible}
        onClose={() => setTripSummaryVisible(false)}
        summary={{
          startAddress,
          distance: distanceKm,
          duration: durationMins,
          fuel: fuelEst,
          path: tripPath,
        }}
      />
      <Toast />
    </SafeAreaView>
  );
}

// 🎨 Styles
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: {
    padding: 16,
    backgroundColor: "#f7f7f7",
    alignItems: "center",
    borderBottomWidth: 1,
    borderColor: "#ddd",
  },
  title: { fontSize: 18, fontWeight: "bold" },
  toggleContainer: {
    position: "absolute",
    top: 100,
    right: 15,
    flexDirection: "row",
    zIndex: 10,
  },
  segmentButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#eee",
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginLeft: 8,
    borderRadius: 20,
    elevation: 3,
  },
  segmentText: {
    fontSize: 12,
    fontWeight: "bold",
    marginLeft: 4,
  },
  activeSegment: {
    backgroundColor: "#4caf50",
  },
  inactiveSegment: {
    backgroundColor: "#ccc",
  },
  loader: {
    position: "absolute",
    top: "50%",
    left: "50%",
    marginLeft: -18,
    marginTop: -18,
  },
});
