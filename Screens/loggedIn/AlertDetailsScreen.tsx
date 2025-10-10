import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Platform,
  StyleSheet,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { LOCALHOST_IP, GOOGLE_MAPS_API_KEY } from "@env";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";

const CACHE_KEY = "cachedReports";

export default function TrafficReportsScreen({ navigation }) {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // ✅ Load cached data first
  const loadCachedReports = async () => {
    try {
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (cached) {
        setReports(JSON.parse(cached));
        setLoading(false); // show cached instantly
      }
    } catch (err) {
      console.warn("Failed to load cached reports:", err);
    }
  };

  // ✅ Save reports to cache
  const cacheReports = async (data: any[]) => {
    try {
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(data));
    } catch (err) {
      console.warn("Failed to cache reports:", err);
    }
  };

  const fetchReports = async () => {
    try {
      const response = await fetch(`${LOCALHOST_IP}/api/reports`);
      const data = await response.json();

      setReports(data);
      cacheReports(data); // ✅ cache the fresh reports
    } catch (error) {
      console.error("❌ Failed to fetch reports", error);
    } finally {
      setLoading(false);
    }
  };
  const updateReportAddress = async (reportId, address) => {
    try {
      // Build body dynamically
      const body = {};
      if (address && address.trim() !== "") {
        body.address = address;
      }
  
      await fetch(`${LOCALHOST_IP}/api/reports/${reportId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
  
      console.log(
        body.address
          ? `✅ Report ${reportId} updated with address: ${body.address}`
          : `⚠️ Report ${reportId} not updated (no address provided)`
      );
    } catch (err) {
      console.error("❌ Failed to update report address:", err);
    }
  };
  

  useEffect(() => {
    // 1. Load cached first
    loadCachedReports();
    // 2. Then fetch fresh from API
    fetchReports();
    // 3. update to backend
    
  }, []);

  const getAddressFromCoords = async (lat: number, lng: number) => {
    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_MAPS_API_KEY}`
      );
      const data = await response.json();
      return data.results.length > 0
        ? data.results[0].formatted_address
        : "Unknown address";
    } catch (error) {
      console.error("Reverse geocoding error:", error);
      return "Failed to fetch address";
    }
  };

  const ReportCard = ({ report }: any) => {
    const [address, setAddress] = useState(report.address || "Resolving...");

    useEffect(() => {
      
      if (!report.address || report.address == "Resolving...") {
        getAddressFromCoords(
          report.location.latitude,
          report.location.longitude
        ).then((addr) => {
          setAddress(addr);
          // optionally update server & cache
          report.address = addr;
          cacheReports([...reports]);
          updateReportAddress(report._id,address)
        });
      }
    }, []);

    return (
      <View style={styles.reportCard}>
        <View style={styles.reportHeader}>
          <Ionicons
            name="alert-circle"
            size={24}
            color="#00ADB5"
            style={styles.reportIcon}
          />
          <Text style={styles.reportTitle}>{report.reportType}</Text>
        </View>
        <Text style={styles.reportDescription}>{report.description}</Text>
        <Text style={styles.reportAddress}>{address}</Text>
      </View>
    );
  };

  const filtered = reports.filter(
    (r) =>
      r.reportType.toLowerCase().includes(search.toLowerCase()) ||
      r.description?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#00ADB5" />
      {/* ... your header code remains the same ... */}

      <View style={styles.container}>
        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <View style={styles.searchBox}>
            <Ionicons
              name="search-outline"
              size={20}
              color="#666"
              style={styles.searchIcon}
            />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search reports..."
              style={styles.searchInput}
              placeholderTextColor="#999"
            />
          </View>
        </View>

        {/* Reports List */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#00ADB5" />
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => item._id}
            renderItem={({ item }) => <ReportCard report={item} />}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons
                  name="alert-circle-outline"
                  size={48}
                  color="#00ADB5"
                />
                <Text style={styles.emptyStateText}>No reports found</Text>
              </View>
            }
            contentContainerStyle={styles.listContainer}
          />
        )}
      </View>
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
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '500',
  },
  container: {
    flex: 1,
    padding: 16,
  },
  searchContainer: {
    marginBottom: 16,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333333',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContainer: {
    paddingBottom: 20,
  },
  reportCard: {
    backgroundColor: '#FFFAFA',
    padding: 16,
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
  reportHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  reportIcon: {
    marginRight: 8,
  },
  reportTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
  },
  reportDescription: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 8,
  },
  reportAddress: {
    fontSize: 12,
    color: '#999999',
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
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    borderRadius: 28,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  fabGradient: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
