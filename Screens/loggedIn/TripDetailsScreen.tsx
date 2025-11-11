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
import { apiRequest } from "../../utils/api";
import { useUser } from "../../AuthContext/UserContextImproved";
import { LinearGradient } from "expo-linear-gradient";
const CACHE_KEY = "cachedTrips";
const CACHE_EXPIRY_KEY = "cachedTripsExpiry";
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

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
  const [filter, setFilter] = useState("all");
  const [motors, setMotors] = useState([]);
  const [selectedMotor, setSelectedMotor] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [cacheStatus, setCacheStatus] = useState('loading');

  // Fetch trip summary from API instead of calculating locally
  // Uses: GET /api/trips/analytics/summary
  const fetchTripSummary = useCallback(async (userId: string, filter?: string) => {
    try {
      const queryParams = new URLSearchParams({ userId });
      if (filter && filter !== 'all') {
        queryParams.append('period', filter); // map filter to period: today, week, month, year
      }
      
      const response = await apiRequest(`/api/trips/analytics/summary?${queryParams}`);
      
      if (response) {
        return {
          totalTrips: response.totalTrips || 0,
          totalDistance: response.totalDistance || 0,
          totalFuel: response.totalFuel || response.totalFuelUsed || 0,
          totalTime: response.totalDuration || response.totalTime || 0,
          totalExpense: response.totalExpense || response.totalCost || 0,
        };
      }
    } catch (error) {
      if (__DEV__) {
      console.warn('[TripDetails] Failed to fetch trip summary from API, calculating locally:', error);
      }
    }
    
    // Fallback to local calculation if API fails
    return null;
  }, []);

  // Fallback local calculation (only used if API fails)
  const calculateSummary = (tripsData) => {
    return {
      totalTrips: tripsData.length,
      totalDistance: tripsData.reduce((acc, t) => acc + (parseFloat(t.distance) || 0), 0),
      totalFuel: tripsData.reduce((acc, t) => acc + (parseFloat(t.fuelUsed) || 0), 0),
      totalTime: tripsData.reduce((acc, t) => acc + (parseFloat(t.duration) || 0), 0),
      totalExpense: tripsData.reduce((acc, t) => acc + ((parseFloat(t.fuelUsed) || 0) * 100), 0),
    };
  };

  // Cache management functions
  const isCacheValid = async () => {
    try {
      const expiryTime = await AsyncStorage.getItem(CACHE_EXPIRY_KEY);
      if (!expiryTime) return false;
      
      const now = Date.now();
      const expiry = parseInt(expiryTime);
      return now < expiry;
    } catch (error) {
      console.error('Error checking cache validity:', error);
      return false;
    }
  };

  const saveToCache = async (tripsData) => {
    try {
      const expiryTime = Date.now() + CACHE_DURATION;
      await Promise.all([
        AsyncStorage.setItem(CACHE_KEY, JSON.stringify(tripsData)),
        AsyncStorage.setItem(CACHE_EXPIRY_KEY, expiryTime.toString())
      ]);
      setCacheStatus('fresh');
      console.log('[TripDetails] Data cached successfully, expires at:', new Date(expiryTime).toLocaleString());
    } catch (error) {
      console.error('Error saving to cache:', error);
      setCacheStatus('error');
    }
  };

  const loadFromCache = async () => {
    try {
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (cached) {
        const cachedData = JSON.parse(cached);
        setCacheStatus('cached');
        console.log('[TripDetails] Loaded from cache:', cachedData.length, 'trips');
        return cachedData;
      }
    } catch (error) {
      console.error('Error loading from cache:', error);
      setCacheStatus('error');
    }
    return null;
  };

  const clearCache = async () => {
    try {
      await Promise.all([
        AsyncStorage.removeItem(CACHE_KEY),
        AsyncStorage.removeItem(CACHE_EXPIRY_KEY)
      ]);
      setCacheStatus('cleared');
      console.log('[TripDetails] Cache cleared');
    } catch (error) {
      console.error('Error clearing cache:', error);
      setCacheStatus('error');
    }
  };

  const fetchTrips = useCallback(async (forceRefresh = false) => {
    try {
      setLoading(true);

      // Check if we have valid cached data and don't need to force refresh
      if (!forceRefresh) {
        const cacheValid = await isCacheValid();
        if (cacheValid) {
          const cachedData = await loadFromCache();
          if (cachedData) {
            // Apply current filters to cached data
            const filtered = applyFilters(cachedData);
            setTrips(filtered);
            
            // Try to fetch summary from API, fallback to local calculation
            const summaryData = await fetchTripSummary(user._id, filter);
            if (summaryData) {
              setSummary(summaryData);
            } else {
              setSummary(calculateSummary(filtered));
            }
            console.log('[TripDetails] Using cached data');
            setLoading(false);
            setRefreshing(false);
            return;
          }
        }
      }

      // Load cached data immediately for better UX (even if expired)
      const cachedData = await loadFromCache();
      if (cachedData && !forceRefresh) {
        const filtered = applyFilters(cachedData);
        setTrips(filtered);
        
        // Try to fetch summary from API, fallback to local calculation
        const summaryData = await fetchTripSummary(user._id, filter);
        if (summaryData) {
          setSummary(summaryData);
        } else {
          setSummary(calculateSummary(filtered));
        }
        console.log('[TripDetails] Using expired cache while fetching fresh data');
      }

      // Fetch fresh data from API
      if (__DEV__) {
      console.log('[TripDetails] Fetching fresh data from API...');
      }
      const [tripsRes, summaryData] = await Promise.allSettled([
        apiRequest(`/api/trips/user/${user._id}`),
        fetchTripSummary(user._id, filter)
      ]);

      let data = tripsRes.status === 'fulfilled' ? (Array.isArray(tripsRes.value) ? tripsRes.value : tripsRes.value?.trips || tripsRes.value?.data || []) : [];
      
      // Apply filters to fresh data (if API doesn't handle filtering)
      const filtered = applyFilters(data);
      setTrips(filtered);
      
      // Use API summary if available, otherwise calculate locally
      if (summaryData.status === 'fulfilled' && summaryData.value) {
        setSummary(summaryData.value);
        console.log('[TripDetails] Using API trip summary');
      } else {
        setSummary(calculateSummary(filtered));
        console.log('[TripDetails] Using local trip summary calculation');
      }

      // Save fresh data to cache
      await saveToCache(data);
      console.log('[TripDetails] Fresh data fetched and cached');

    } catch (err) {
      console.error("Trip fetch error:", err);
      
      // If API fails, try to use cached data as fallback
      const cachedData = await loadFromCache();
      if (cachedData) {
        const filtered = applyFilters(cachedData);
        setTrips(filtered);
        setSummary(calculateSummary(filtered));
        console.log('[TripDetails] API failed, using cached data as fallback');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter, selectedMotor]);

  // Helper function to apply filters
  const applyFilters = (data) => {
    const now = new Date();
    return data.filter((trip) => {
      const created = new Date(trip.createdAt);
      if (selectedMotor && trip.motorId?._id !== selectedMotor) return false;

      if (filter === "all") {
        return true; // Show all trips regardless of time
      } else if (filter === "today") {
        return created.toDateString() === now.toDateString();
      } else if (filter === "week") {
        const diffMs = now.getTime() - created.getTime();
        const diffDays = diffMs / (1000 * 60 * 60 * 24);
        return diffDays <= 7;
      } else if (filter === "month") {
        return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear();
      } else {
        return created.getFullYear() === now.getFullYear();
      }
    });
  };

  useEffect(() => {
    fetchTrips();
  }, [fetchTrips]);

  useEffect(() => {
    if (!user?._id) return;
    
    apiRequest(`/api/user-motors/user/${user._id}`)
      .then((res: any) => {
        const motors = Array.isArray(res) ? res : res?.motors || res?.data || [];
        setMotors(motors);
      })
      .catch((err: any) => {
        if (__DEV__) {
          console.error("[TripDetails] Failed to fetch motors:", err);
        }
      });
  }, [user?._id]);

  const formatTime = (min: number) => {
    const hr = Math.floor(min / 60);
    const rem = min % 60;
    return hr > 0 ? `${hr}h ${rem}m` : `${rem} min`;
  };

  // Cache status helper functions
  const getCacheStatusColor = () => {
    switch (cacheStatus) {
      case 'fresh': return '#4CAF50'; // Green
      case 'cached': return '#FF9800'; // Orange
      case 'loading': return '#2196F3'; // Blue
      case 'error': return '#F44336'; // Red
      case 'cleared': return '#9E9E9E'; // Gray
      default: return '#9E9E9E';
    }
  };

  const getCacheStatusText = () => {
    switch (cacheStatus) {
      case 'fresh': return 'Fresh data';
      case 'cached': return 'Cached data';
      case 'loading': return 'Loading...';
      case 'error': return 'Cache error';
      case 'cleared': return 'Cache cleared';
      default: return 'Unknown';
    }
  };

  const TripCard = ({ trip }) => {
    // Format the trip date and time
    const formatTripDateTime = (trip) => {
      try {
        // Try to use tripStartTime first, then createdAt as fallback
        const dateTime = trip.tripStartTime || trip.createdAt;
        if (!dateTime) return "Date not available";
        
        const tripDate = new Date(dateTime);
        const now = new Date();
        const diffMs = now.getTime() - tripDate.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        
        // Format date
        const dateStr = tripDate.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: tripDate.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
        });
        
        // Format time
        const timeStr = tripDate.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        });
        
        // Add relative time
        let relativeTime = "";
        if (diffDays === 0) {
          relativeTime = " (Today)";
        } else if (diffDays === 1) {
          relativeTime = " (Yesterday)";
        } else if (diffDays < 7) {
          relativeTime = ` (${diffDays} days ago)`;
        } else if (diffDays < 30) {
          const weeks = Math.floor(diffDays / 7);
          relativeTime = ` (${weeks} week${weeks > 1 ? 's' : ''} ago)`;
        } else if (diffDays < 365) {
          const months = Math.floor(diffDays / 30);
          relativeTime = ` (${months} month${months > 1 ? 's' : ''} ago)`;
        } else {
          const years = Math.floor(diffDays / 365);
          relativeTime = ` (${years} year${years > 1 ? 's' : ''} ago)`;
        }
        
        return `${dateStr} at ${timeStr}${relativeTime}`;
      } catch (error) {
        console.error('Error formatting trip date:', error);
        return "Date not available";
      }
    };

    return (
      <View style={styles.tripCard}>
        <View style={styles.tripHeader}>
          <MaterialIcons name="two-wheeler" size={20} color="#00ADB5" />
          <Text style={styles.tripTitle}>{trip.motorId?.nickname || trip.motorId?.model || "Motor"}</Text>
        </View>

        <View style={styles.tripRow}>
          <Ionicons name="calendar-outline" size={20} color="#666" />
          <Text style={styles.tripText}>
            {formatTripDateTime(trip)}
          </Text>
        </View>

        <View style={styles.tripRow}>
          <Ionicons name="map-outline" size={20} color="#666" />
          <Text style={styles.tripText}>
            {trip.distance?.toFixed(1) || "0.0"} km
          </Text>
        </View>

        <View style={styles.tripRow}>
          <Ionicons name="time-outline" size={20} color="#666" />
          <Text style={styles.tripText}>
            ETA: {trip.eta || "N/A"} / Arrived: {trip.timeArrived || "N/A"}
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
            {trip.destination || "No destination"}
          </Text>
        </View>
      </View>
    );
  };
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
              <View style={styles.cacheStatusContainer}>
                <View style={[styles.cacheIndicator, { backgroundColor: getCacheStatusColor() }]} />
                <Text style={styles.cacheStatusText}>{getCacheStatusText()}</Text>
              </View>
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
              fetchTrips(true); // Force refresh when pulled down
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
            {/* <View style={styles.summaryBox}>
              <Ionicons name="water-outline" size={24} color="#00ADB5" />
              <Text style={styles.summaryValue}>{summary.totalFuel.toFixed(1)}</Text>
              <Text style={styles.summaryLabel}>Fuel (L)</Text>
            </View> */}
          {/* </View>
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
            </View> */}
          </View>
        </View>

        {/* Filter Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Filter by Time</Text>
          <View style={styles.filterRow}>
            {["all", "today", "week", "month", "year"].map((f) => (
              <TouchableOpacity
                key={f}
                style={[styles.filterBtn, filter === f && styles.filterActive]}
                onPress={() => setFilter(f)}
              >
                <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
                  {f === "all" ? "All Time" : f === "today" ? "Today" : f === "week" ? "Last 7d" : f === "month" ? "This Month" : "This Year"}
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
  cacheStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  cacheIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  cacheStatusText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '500',
  },
});
