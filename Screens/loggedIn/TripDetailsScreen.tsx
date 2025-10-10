import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  StatusBar,
  SafeAreaView,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { MaterialIcons, Ionicons } from "@expo/vector-icons";
import axios from "axios";
import { useUser } from "../../AuthContext/UserContext";
import { LinearGradient } from "expo-linear-gradient";

const API_BASE = "https://ts-backend-1-jyit.onrender.com";
const CACHE_KEY = "cachedTrips";

export default function TripScreen({ navigation }) {
  const { user } = useUser();
  const [trips, setTrips] = useState([]);
  const [summary, setSummary] = useState({
    totalTrips: 0,
    totalDistance: 0,
    totalFuel: 0,
    totalTime: 0,
    totalExpense: 0,
  });
  const [filter, setFilter] = useState("month");
  const [motors, setMotors] = useState([]);
  const [selectedMotor, setSelectedMotor] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const calculateSummary = (tripsData) => {
    return {
      totalTrips: tripsData.length,
      totalDistance: tripsData.reduce((acc, t) => acc + (parseFloat(t.distance) || 0), 0),
      totalFuel: tripsData.reduce((acc, t) => acc + (parseFloat(t.fuelUsed) || 0), 0),
      totalTime: tripsData.reduce((acc, t) => acc + (parseFloat(t.duration) || 0), 0),
      totalExpense: tripsData.reduce((acc, t) => acc + ((parseFloat(t.fuelUsed) || 0) * 100), 0),
    };
  };

  const fetchTrips = useCallback(async () => {
    try {
      setLoading(true);

      // Load cached trips first
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (cached) {
        const cachedData = JSON.parse(cached);
        setTrips(cachedData);
        setSummary(calculateSummary(cachedData));
      }

      // Fetch from API
      const res = await axios.get(`${API_BASE}/api/trips/user/${user._id}`);
      let data = res.data;

      // Filter based on motor & time
      const now = new Date();
      const filtered = data.filter((trip) => {
        const created = new Date(trip.createdAt);
        if (selectedMotor && trip.motorId?._id !== selectedMotor) return false;

        if (filter === "today") {
          return created.toDateString() === now.toDateString();
        } else if (filter === "week") {
          const diff = (now - created) / (1000 * 60 * 60 * 24);
          return diff <= 7;
        } else if (filter === "month") {
          return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear();
        } else {
          return created.getFullYear() === now.getFullYear();
        }
      });

      setTrips(filtered);
      setSummary(calculateSummary(filtered));

      // Cache trips
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(filtered));
    } catch (err) {
      console.error("Trip fetch error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter, selectedMotor]);

  useEffect(() => {
    fetchTrips();
  }, [fetchTrips]);

  useEffect(() => {
    axios.get(`${API_BASE}/api/user-motors/user/${user._id}`)
      .then(res => setMotors(res.data))
      .catch(err => console.error("Failed to fetch motors:", err));
  }, []);

  const formatTime = (min: number) => {
    const hr = Math.floor(min / 60);
    const rem = min % 60;
    return hr > 0 ? `${hr}h ${rem}m` : `${rem} min`;
  };

  const TripCard = ({ trip }) => (
    <View style={styles.tripCard}>
      <View style={styles.tripHeader}>
        <MaterialIcons name="two-wheeler" size={20} color="#00ADB5" />
        <Text style={styles.tripTitle}>{trip.motorId?.nickname || trip.motorId?.model || "Motor"}</Text>
      </View>

      <View style={styles.tripRow}>
        <Ionicons name="map-outline" size={20} color="#666" />
        <Text style={styles.tripText}>
          {trip.distance.toFixed(1)} km
        </Text>
      </View>

      <View style={styles.tripRow}>
        <Ionicons name="time-outline" size={20} color="#666" />
        <Text style={styles.tripText}>
          ETA: { trip.eta || "N/A"} / Arrived: {trip.timeArrived || "N/A"}
        </Text>
      </View>

      <View style={styles.tripRow}>
        <Ionicons name="timer-outline" size={20} color="#666" />
        <Text style={styles.tripText}>
          Duration: {trip.duration ? `${trip.duration} min` : "N/A"}
        </Text>
      </View>

      <View style={styles.tripRow}>
        <Ionicons name="location-outline" size={20} color="#666" />
        <Text style={styles.tripText}>
          {trip.destination}
        </Text>
      </View>
    </View>
  );
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#00ADB5" />
      
      {/* Header */}
      <View style={styles.header}>
        <LinearGradient
          colors={['#00ADB5', '#00C2CC']}
          style={styles.headerGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        >
          <View style={styles.headerContent}>
            <TouchableOpacity 
              onPress={() => navigation.goBack()}
              style={styles.backButton}
            >
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <View style={styles.headerTextContainer}>
              <Text style={styles.headerTitle}>Trip Details</Text>
              <Text style={styles.headerSubtitle}>View your travel history</Text>
            </View>
          </View>
        </LinearGradient>
      </View>

      <ScrollView
        style={styles.container}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={() => {
              setRefreshing(true);
              fetchTrips();
            }}
            colors={['#00ADB5']}
            tintColor="#00ADB5"
          />
        }
      >
        {/* Summary Section */}
        <View style={styles.summaryCard}>
          <Text style={styles.sectionTitle}>Trip Summary</Text>
          <View style={styles.summaryRow}>
            <View style={styles.summaryBox}>
              <Ionicons name="speedometer-outline" size={24} color="#00ADB5" />
              <Text style={styles.summaryValue}>{summary.totalTrips}</Text>
              <Text style={styles.summaryLabel}>Total Trips</Text>
            </View>
            <View style={styles.summaryBox}>
              <Ionicons name="map-outline" size={24} color="#00ADB5" />
              <Text style={styles.summaryValue}>{summary.totalDistance.toFixed(1)}</Text>
              <Text style={styles.summaryLabel}>Total KM</Text>
            </View>
            <View style={styles.summaryBox}>
              <Ionicons name="water-outline" size={24} color="#00ADB5" />
              <Text style={styles.summaryValue}>{summary.totalFuel.toFixed(1)}</Text>
              <Text style={styles.summaryLabel}>Fuel (L)</Text>
            </View>
          </View>
          <View style={styles.summaryRow}>
            <View style={[styles.summaryBox, styles.summaryBoxWide]}>
              <Ionicons name="time-outline" size={24} color="#00ADB5" />
              <Text style={styles.summaryValue}>{formatTime(summary.totalTime)}</Text>
              <Text style={styles.summaryLabel}>Total Time</Text>
            </View>
            <View style={[styles.summaryBox, styles.summaryBoxWide]}>
              <Ionicons name="cash-outline" size={24} color="#00ADB5" />
              <Text style={styles.summaryValue}>₱{summary.totalExpense.toFixed(2)}</Text>
              <Text style={styles.summaryLabel}>Total Cost</Text>
            </View>
          </View>
        </View>

        {/* Filter Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Filter by Time</Text>
          <View style={styles.filterRow}>
            {["today", "week", "month", "year"].map((f) => (
              <TouchableOpacity
                key={f}
                style={[styles.filterBtn, filter === f && styles.filterActive]}
                onPress={() => setFilter(f)}
              >
                <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
                  {f === "today" ? "Today" : f === "week" ? "Last 7d" : f === "month" ? "This Month" : "This Year"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Motor Filter Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Filter by Motor</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.motorFilters}>
            <TouchableOpacity
              style={[styles.motorFilterBtn, selectedMotor === null && styles.motorFilterActive]}
              onPress={() => setSelectedMotor(null)}
            >
              <Text style={[styles.motorFilterText, selectedMotor === null && styles.motorFilterTextActive]}>
                All Motors
              </Text>
            </TouchableOpacity>
            {motors.map((m) => (
              <TouchableOpacity
                key={m._id}
                style={[styles.motorFilterBtn, selectedMotor === m._id && styles.motorFilterActive]}
                onPress={() => setSelectedMotor(m._id)}
              >
                <Text style={[styles.motorFilterText, selectedMotor === m._id && styles.motorFilterTextActive]}>
                  {m.nickname || m.motorcycleId?.model}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Trips List */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Trip History</Text>
          {loading ? (
            <ActivityIndicator size="large" color="#00ADB5" style={styles.loader} /> 
          ) : trips.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="document-text-outline" size={48} color="#00ADB5" />
              <Text style={styles.emptyStateText}>No trips found</Text>
            </View>
          ) : (
            trips.map((trip) => <TripCard key={trip._id} trip={trip} />)
          )}
        </View>
      </ScrollView>
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
    zIndex: 10,
    overflow: 'hidden',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerGradient: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 12 : 16,
    paddingBottom: 20,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
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
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '500',
  },
  container: {
    flex: 1,
    padding: 16,
  },
  summaryCard: {
    backgroundColor: '#FFFAFA',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333333',
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  summaryBox: {
    flex: 1,
    marginHorizontal: 4,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  summaryBoxWide: {
    flex: 2,
    marginHorizontal: 4,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
    marginTop: 4,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#666666',
    marginTop: 2,
  },
  filterRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  filterBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  filterActive: {
    backgroundColor: '#00ADB5',
  },
  filterText: {
    color: '#333333',
    fontWeight: '500',
  },
  filterTextActive: {
    color: '#FFFFFF',
  },
  motorFilters: {
    marginBottom: 8,
  },
  motorFilterBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  motorFilterActive: {
    backgroundColor: '#00ADB5',
  },
  motorFilterText: {
    color: '#333333',
    fontWeight: '500',
  },
  motorFilterTextActive: {
    color: '#FFFFFF',
  },
  tripCard: {
    backgroundColor: '#FFFAFA',
    padding: 10,
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  tripHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  tripTitle: {
    marginLeft: 8,
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
  },
  tripRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  
  tripText: {
    fontSize: 16,
    color: '#666666',
    marginLeft: 4, // spacing between icon and text
  },
  
  loader: {
    marginTop: 20,
  },
  emptyState: {
    alignItems: 'center',
    padding: 32,
  },
  emptyStateText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
  },
  backButton: {
    marginRight: 16,
  },
});
