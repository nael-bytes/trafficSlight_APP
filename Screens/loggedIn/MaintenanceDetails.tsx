import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  SafeAreaView,
  useColorScheme,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { useUser } from '../../AuthContext/UserContext';
import { LOCALHOST_IP } from '@env';

type MaintenanceAction = {
  _id: string;
  details: {
    cost: number;
    quantity: number;
    notes?: string;
  };
  userId: {
    _id: string;
    name: string;
    email: string;
  };
  motorId: {
    _id: string;
    nickname: string;
  };
  type: 'refuel' | 'oil_change' | 'tune_up';
  timestamp: string;
  location?: {
    latitude: number;
    longitude: number;
  };
  createdAt: string;
  updatedAt: string;
  __v: number;
};

type RouteParams = {
  item?: MaintenanceAction;
  fullList?: MaintenanceAction[];
};

export default function MaintenanceDetails() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<Record<string, RouteParams>, string>>();
  const { item, fullList } = route.params;
  const systemColorScheme = useColorScheme();
  const isDarkMode = systemColorScheme === 'dark';
  const { user } = useUser();

  const [fetchedList, setFetchedList] = useState<MaintenanceAction[]>([]);
  const [loading, setLoading] = useState(false);
  const [summaryStats, setSummaryStats] = useState({
    totalCost: 0,
    totalRefuels: 0,
    totalOilChanges: 0,
    totalTuneUps: 0
  });

  const calculateStats = (data: MaintenanceAction[]) => {
    if (!Array.isArray(data)) {
      console.error("❌ calculateStats received non-array data:", data);
      return {
        totalCost: 0,
        totalRefuels: 0,
        totalOilChanges: 0,
        totalTuneUps: 0
      };
    }

    console.log("📊 Starting stats calculation for", data.length, "records");
    
    const stats = data.reduce((acc, curr) => {
      console.log("📊 Processing record:", {
        type: curr.type,
        cost: curr.details?.cost,
        currentTotal: acc.totalCost
      });
      
      return {
        totalCost: acc.totalCost + (curr.details?.cost ? Number(curr.details.cost) : 0),
        totalRefuels: acc.totalRefuels + (curr.type === 'refuel' ? 1 : 0),
        totalOilChanges: acc.totalOilChanges + (curr.type === 'oil_change' ? 1 : 0),
        totalTuneUps: acc.totalTuneUps + (curr.type === 'tune_up' ? 1 : 0)
      };
    }, {
      totalCost: 0,
      totalRefuels: 0,
      totalOilChanges: 0,
      totalTuneUps: 0
    });

    console.log("📊 Final calculated stats:", stats);
    return stats;
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('en-PH', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getMaintenanceIcon = (type: string) => {
    switch (type) {
      case 'refuel':
        return 'local-gas-station';
      case 'oil_change':
        return 'opacity';
      case 'tune_up':
        return 'build';
      default:
        return 'error';
    }
  };

  const renderSummarySection = () => (
    <View style={[styles.summaryContainer, isDarkMode && styles.summaryContainerDark]}>
      <Text style={[styles.summaryTitle, isDarkMode && styles.summaryTitleDark]}>
        Maintenance Summary
      </Text>
      <View style={styles.statsGrid}>
        <View style={[styles.statCard, isDarkMode && styles.statCardDark]}>
          <MaterialIcons name="attach-money" size={24} color="#00ADB5" />
          <Text style={[styles.statValue, isDarkMode && styles.statValueDark]}>
            ₱{summaryStats.totalCost.toFixed(2)}
          </Text>
          <Text style={[styles.statLabel, isDarkMode && styles.statLabelDark]}>Total Cost</Text>
        </View>
        <View style={[styles.statCard, isDarkMode && styles.statCardDark]}>
          <MaterialIcons name="local-gas-station" size={24} color="#00ADB5" />
          <Text style={[styles.statValue, isDarkMode && styles.statValueDark]}>
            {summaryStats.totalRefuels}
          </Text>
          <Text style={[styles.statLabel, isDarkMode && styles.statLabelDark]}>Refuels</Text>
        </View>
        <View style={[styles.statCard, isDarkMode && styles.statCardDark]}>
          <MaterialIcons name="opacity" size={24} color="#00ADB5" />
          <Text style={[styles.statValue, isDarkMode && styles.statValueDark]}>
            {summaryStats.totalOilChanges}
          </Text>
          <Text style={[styles.statLabel, isDarkMode && styles.statLabelDark]}>Oil Changes</Text>
        </View>
        <View style={[styles.statCard, isDarkMode && styles.statCardDark]}>
          <MaterialIcons name="build" size={24} color="#00ADB5" />
          <Text style={[styles.statValue, isDarkMode && styles.statValueDark]}>
            {summaryStats.totalTuneUps}
          </Text>
          <Text style={[styles.statLabel, isDarkMode && styles.statLabelDark]}>Tune Ups</Text>
        </View>
      </View>
    </View>
  );

  const renderMaintenanceItem = (action: MaintenanceAction) => (
    <View style={[styles.actionCard, isDarkMode && styles.actionCardDark]}>
      <View style={styles.actionHeader}>
        <View style={styles.actionTypeContainer}>
          <MaterialIcons 
            name={getMaintenanceIcon(action.type)} 
            size={24} 
            color="#00ADB5" 
          />
          <Text style={[styles.actionType, isDarkMode && styles.actionTypeDark]}>
            {action.type.replace('_', ' ').toUpperCase()}
          </Text>
        </View>
        <Text style={[styles.timestamp, isDarkMode && styles.timestampDark]}>
          {new Date(action.timestamp).toLocaleString('en-PH', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
            month: 'long',
            day: 'numeric',
            year: 'numeric'
          })}
        </Text>
      </View>

      <View style={styles.detailsContainer}>
        {action.details?.cost !== undefined && (
          <View style={styles.detailRow}>
            <MaterialIcons name="attach-money" size={20} color="#00ADB5" />
            <Text style={[styles.detailText, isDarkMode && styles.detailTextDark]}>
              Cost: ₱{Number(action.details.cost).toFixed(2)}
            </Text>
          </View>
        )}
        
        {action.details?.quantity !== undefined && (
          <View style={styles.detailRow}>
            <MaterialIcons name="local-gas-station" size={20} color="#00ADB5" />
            <Text style={[styles.detailText, isDarkMode && styles.detailTextDark]}>
              Quantity: {Number(action.details.quantity).toFixed(2)} L
            </Text>
          </View>
        )}

        {action.location && (
          <View style={styles.detailRow}>
            <MaterialIcons name="location-on" size={20} color="#00ADB5" />
            <Text style={[styles.detailText, isDarkMode && styles.detailTextDark]}>
              Location: {action.location.latitude.toFixed(6)}, {action.location.longitude.toFixed(6)}
            </Text>
          </View>
        )}

        {action.details?.notes && (
          <View style={styles.detailRow}>
            <MaterialIcons name="notes" size={20} color="#00ADB5" />
            <Text style={[styles.detailText, isDarkMode && styles.detailTextDark]}>
              Notes: {action.details.notes}
            </Text>
          </View>
        )}

        <View style={styles.detailRow}>
          <MaterialIcons name="motorcycle" size={20} color="#00ADB5" />
          <Text style={[styles.detailText, isDarkMode && styles.detailTextDark]}>
            Motor: {action.motorId.nickname || 'Unnamed Motor'}
          </Text>
        </View>
      </View>
    </View>
  );

  useEffect(() => {
    const fetchMaintenance = async () => {
      console.log("🔍 Starting fetchMaintenance");
      console.log("🔍 User object:", user);
      
      if (!user?._id) {
        console.log("❌ No user ID available:", user);
        return;
      }

      // Check if we're using the correct user ID
      const expectedUserId = "6834b2b267d33949cc9e1c9d";
      console.log("🔍 Current user ID:", user._id);
      console.log("🔍 Expected user ID:", expectedUserId);
      console.log("🔍 Do they match?", user._id === expectedUserId);

      if (item || fullList) {
        const dataToProcess = item ? [item] : fullList || [];
        console.log("📊 Processing provided data:", JSON.stringify(dataToProcess, null, 2));
        const stats = calculateStats(dataToProcess);
        console.log("📊 Calculated stats from provided data:", stats);
        setSummaryStats(stats);
        return;
      }

      try {
        setLoading(true);
        const url = `https://ts-backend-1-jyit.onrender.com/api/maintenance-records/user/${user._id}`;
        console.log("🔍 Attempting to fetch from URL:", url);
        
        const response = await fetch(url).catch(networkError => {
          console.error("🌐 Network Error Details:", {
            name: networkError.name,
            message: networkError.message,
            cause: networkError.cause
          });
          throw networkError;
        });

        if (!response) {
          throw new Error("No response received from server");
        }

        console.log("🔍 Response status:", response.status);
        
        const responseText = await response.text();
        console.log("🔍 Raw response:", responseText);

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status} - ${responseText}`);
        }

        const data = responseText ? JSON.parse(responseText) : [];
        console.log("✅ Parsed maintenance data:", JSON.stringify(data, null, 2));
        
        // Verify data structure
        if (Array.isArray(data)) {
          console.log("✅ Data is an array with length:", data.length);
          console.log("✅ First item sample:", data[0] ? JSON.stringify(data[0], null, 2) : "No items");
        } else {
          console.log("❌ Data is not an array:", typeof data);
        }

        const stats = calculateStats(data);
        console.log("📊 Calculated stats from fetched data:", stats);
        
        setFetchedList(data);
        setSummaryStats(stats);
      } catch (err) {
        console.error('❌ Error type:', err.constructor.name);
        console.error('❌ Error message:', err.message);
        if (err.cause) console.error('❌ Error cause:', err.cause);
        setFetchedList([]);
        setSummaryStats({
          totalCost: 0,
          totalRefuels: 0,
          totalOilChanges: 0,
          totalTuneUps: 0
        });
      } finally {
        setLoading(false);
      }
    };

    fetchMaintenance();
  }, [user?._id]);

  return (
    <SafeAreaView style={[styles.safeArea, isDarkMode && styles.safeAreaDark]}>
      <LinearGradient
        colors={isDarkMode ? ['#00858B', '#006A6F'] : ['#00ADB5', '#00C2CC']}
        style={styles.header}
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <MaterialIcons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Maintenance Records</Text>
      </LinearGradient>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#00ADB5" />
          <Text style={[styles.loadingText, isDarkMode && styles.loadingTextDark]}>
            Loading maintenance records...
          </Text>
        </View>
      ) : (
        <FlatList
          data={fullList || (item ? [item] : fetchedList)}
          keyExtractor={(item, index) => item._id || index.toString()}
          ListHeaderComponent={renderSummarySection}
          renderItem={({ item }) => renderMaintenanceItem(item)}
          contentContainerStyle={styles.content}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialIcons name="build" size={48} color="#00ADB5" />
              <Text style={[styles.emptyText, isDarkMode && styles.emptyTextDark]}>
                No maintenance records found.
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F2EEEE',
  },
  safeAreaDark: {
    backgroundColor: '#1A1A1A',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingTop: Platform.OS === 'android' ? 20 : 16,
  },
  backButton: {
    padding: 8,
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
  },
  content: {
    padding: 16,
  },
  summaryContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  summaryContainerDark: {
    backgroundColor: '#2A2A2A',
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  summaryTitleDark: {
    color: '#fff',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statCard: {
    width: '48%',
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    alignItems: 'center',
  },
  statCardDark: {
    backgroundColor: '#3A3A3A',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginTop: 8,
  },
  statValueDark: {
    color: '#fff',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  statLabelDark: {
    color: '#aaa',
  },
  actionCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#00ADB5',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  actionCardDark: {
    backgroundColor: '#2A2A2A',
  },
  actionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  actionTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionType: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginLeft: 8,
  },
  actionTypeDark: {
    color: '#fff',
  },
  timestamp: {
    fontSize: 12,
    color: '#666',
  },
  timestampDark: {
    color: '#aaa',
  },
  detailsContainer: {
    marginTop: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
    flex: 1,
  },
  detailTextDark: {
    color: '#aaa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
  loadingTextDark: {
    color: '#aaa',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  emptyTextDark: {
    color: '#aaa',
  },
});
