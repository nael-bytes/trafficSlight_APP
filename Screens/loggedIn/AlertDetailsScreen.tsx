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
import { GOOGLE_MAPS_API_KEY } from "@env";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { fetchReports as fetchReportsAPI, apiRequest } from "../../utils/api";

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
        const parsedData = JSON.parse(cached);
        // CRITICAL: Ensure parsed data is always an array
        const reportsArray = Array.isArray(parsedData) ? parsedData : [];
        setReports(reportsArray);
        setLoading(false); // show cached instantly
      }
    } catch (err) {
      console.warn("Failed to load cached reports:", err);
      // Set empty array on error to prevent undefined state
      setReports([]);
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
      // CRITICAL: Use centralized API function for consistency with rest of app
      // This ensures we use the same base URL and authentication as other API calls
      const data = await fetchReportsAPI();

      // CRITICAL: Ensure data is always an array
      const reportsArray = Array.isArray(data) ? data : [];
      setReports(reportsArray);
      cacheReports(reportsArray); // ✅ cache the fresh reports
    } catch (error) {
      console.error("❌ Failed to fetch reports", error);
      // Set empty array on error to prevent undefined state
      setReports([]);
    } finally {
      setLoading(false);
    }
  };
  const updateReportAddress = async (reportId: string, address: string) => {
    try {
      // Build body dynamically
      const body: { address?: string } = {};
      if (address && address.trim() !== "") {
        body.address = address;
      }
  
      // CRITICAL: Use centralized API function for consistency
      // This ensures we use the same base URL and authentication as other API calls
      await apiRequest(`/api/reports/${reportId}`, {
        method: "PUT",
        body: JSON.stringify(body),
      });
  
      if (__DEV__) {
        console.log(
          body.address
            ? `✅ Report ${reportId} updated with address: ${body.address}`
            : `⚠️ Report ${reportId} not updated (no address provided)`
        );
      }
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
          // CRITICAL: Ensure reports is an array before spreading
          if (Array.isArray(reports)) {
            cacheReports([...reports]);
          }
          updateReportAddress(report._id, address);
        });
      }
    }, []);

    // Get vote counts and verification status
    // CRITICAL: API returns votes as an array: [{ userId, vote: 1 or -1 }]
    // Calculate upvotes (vote === 1) and downvotes (vote === -1) from the votes array
    const votesArray = report.votes || [];
    const upvotes = votesArray.filter((v: any) => v.vote === 1).length;
    const downvotes = votesArray.filter((v: any) => v.vote === -1).length;
    const totalVotes = upvotes + downvotes;
    // Alternative: Calculate totalVotes as sum of all votes (net votes)
    // const totalVotes = votesArray.reduce((sum: number, v: any) => sum + (v.vote || 0), 0);
    
    // Check verification status - API uses verified.verifiedByAdmin or verified.verifiedByUser
    const isVerified = (report.verified?.verifiedByAdmin > 0) || (report.verified?.verifiedByUser > 0) || false;
    const voteRatio = totalVotes > 0 ? (upvotes / totalVotes) * 100 : 0;

    return (
      <View style={styles.reportCard}>
        <View style={styles.reportHeader}>
          <Ionicons
            name="alert-circle"
            size={24}
            color="#00ADB5"
            style={styles.reportIcon}
          />
          <View style={styles.reportTitleContainer}>
            <Text style={styles.reportTitle}>{report.reportType}</Text>
            {isVerified && (
              <View style={styles.verifiedBadge}>
                <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
                <Text style={styles.verifiedText}>Verified</Text>
              </View>
            )}
          </View>
        </View>
        <Text style={styles.reportDescription}>{report.description}</Text>
        <Text style={styles.reportAddress}>{address}</Text>
        
        {/* Vote Counts Section */}
        <View style={styles.voteSection}>
          <View style={styles.voteContainer}>
            <Ionicons name="thumbs-up" size={16} color="#4CAF50" />
            <Text style={styles.voteText}>{upvotes}</Text>
          </View>
          <View style={styles.voteContainer}>
            <Ionicons name="thumbs-down" size={16} color="#F44336" />
            <Text style={styles.voteText}>{downvotes}</Text>
          </View>
          <View style={styles.voteRatioContainer}>
            <Text style={styles.voteRatioText}>
              {voteRatio.toFixed(0)}% positive
            </Text>
          </View>
        </View>
      </View>
    );
  };

  // CRITICAL: Ensure reports is always an array before filtering
  const filtered = (reports || []).filter(
    (r) =>
      r?.reportType?.toLowerCase().includes(search.toLowerCase()) ||
      r?.description?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#00ADB5" />
      
      {/* Header */}
      <View style={styles.header}>
        <LinearGradient
          colors={['#00ADB5', '#007A80']}
          style={styles.headerGradient}
        >
          <View style={styles.headerContent}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.backButton}
            >
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <View style={styles.headerTextContainer}>
              <Text style={styles.headerTitle}>Traffic Reports</Text>
              <Text style={styles.headerSubtitle}>Community reported incidents</Text>
            </View>
          </View>
        </LinearGradient>
      </View>

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
  reportTitleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  reportTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
    flex: 1,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  verifiedText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4CAF50',
    marginLeft: 4,
  },
  reportDescription: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 8,
  },
  reportAddress: {
    fontSize: 12,
    color: '#999999',
    marginBottom: 12,
  },
  voteSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
  },
  voteContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginRight: 8,
  },
  voteText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333333',
    marginLeft: 4,
  },
  voteRatioContainer: {
    flex: 1,
    alignItems: 'flex-end',
  },
  voteRatioText: {
    fontSize: 11,
    color: '#666666',
    fontWeight: '500',
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
