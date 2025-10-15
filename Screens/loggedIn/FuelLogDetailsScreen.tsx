import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Alert,
  Modal,
} from "react-native";
import tw from "twrnc";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { LinearGradient } from 'expo-linear-gradient';
import { StackNavigationProp } from '@react-navigation/stack';

import { useUser } from "../../AuthContext/UserContextImproved";

// Use the deployed backend URL
const API_BASE_URL = 'https://ts-backend-1-jyit.onrender.com';

const PAGE_SIZE = 5;

type RootStackParamList = {
  AddFuelLogScreen: undefined;
  FuelLogDetails: { item: any };
};

type NavigationProp = StackNavigationProp<RootStackParamList>;

type RouteParams = {
  item?: any;
  fullList?: any[];
};

type SortOption = {
  label: string;
  value: 'date' | 'liters' | 'cost' | 'odometer' | 'name';
  icon: keyof typeof Ionicons.glyphMap;
};

const sortOptions: SortOption[] = [
  { label: 'Date', value: 'date', icon: 'calendar-outline' },
  { label: 'Volume', value: 'liters', icon: 'water-outline' },
  { label: 'Cost', value: 'cost', icon: 'pricetag-outline' },
  { label: 'Odometer', value: 'odometer', icon: 'speedometer-outline' },
  { label: 'Name', value: 'name', icon: 'person-outline' },
];

export default function FuelLogDetailsScreen() {
  const { user } = useUser();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute();
  const { item, fullList } = route.params as RouteParams;
  const [logs, setLogs] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [fromDateStr, setFromDateStr] = useState("");
  const [toDateStr, setToDateStr] = useState("");
  const [sortBy, setSortBy] = useState("date");
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);
  const [showSortModal, setShowSortModal] = useState(false);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    if (user?._id) fetchLogs();
  }, [user]);

  const fetchLogs = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/fuel-logs/${user._id}`);
      const data = await res.json();
      const sorted = [...data].reverse();
      setLogs(sorted);
      setFiltered(sorted);
    } catch {
      // alert("Failed to fetch fuel logs.");
      console.log("Failed to fetch fuel logs.");
    } finally {
      setLoading(false);
    }
  };

  const deleteFuelLog = async (logId: string) => {
    Alert.alert(
      "Delete Fuel Log",
      "Are you sure you want to delete this fuel log? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              console.log('Attempting to delete fuel log:', logId);
              
              const response = await fetch(`${API_BASE_URL}/api/fuel-logs/${logId}`, {
                method: 'DELETE',
                headers: {
                  'Content-Type': 'application/json',
                  'Accept': 'application/json',
                },
              });

              console.log('Delete response status:', response.status);
              console.log('Delete response headers:', response.headers);

              // Try to get the raw response text first
              const responseText = await response.text();
              console.log('Raw response:', responseText);

              // Check if response is empty
              if (!responseText.trim()) {
                if (response.ok) {
                  // If response is empty but status is OK (common for DELETE operations)
                  setLogs(prevLogs => prevLogs.filter(log => log._id !== logId));
                  setFiltered(prevFiltered => prevFiltered.filter(log => log._id !== logId));
                  Alert.alert("Success", "Fuel log deleted successfully");
                  return;
                } else {
                  throw new Error('Empty response from server');
                }
              }

              // Try to parse JSON only if we have a response
              let data;
              try {
                data = JSON.parse(responseText);
              } catch (e) {
                console.error('Failed to parse response as JSON:', e);
                if (response.ok) {
                  // If status is OK but response isn't JSON, still treat as success
                  setLogs(prevLogs => prevLogs.filter(log => log._id !== logId));
                  setFiltered(prevFiltered => prevFiltered.filter(log => log._id !== logId));
                  Alert.alert("Success", "Fuel log deleted successfully");
                  return;
                } else {
                  throw new Error('Invalid JSON response from server');
                }
              }

              if (response.ok) {
                setLogs(prevLogs => prevLogs.filter(log => log._id !== logId));
                setFiltered(prevFiltered => prevFiltered.filter(log => log._id !== logId));
                Alert.alert(
                  "Success",
                  data?.message || "Fuel log deleted successfully"
                );
              } else {
                throw new Error(data?.message || data?.error || 'Failed to delete fuel log');
              }
            } catch (error) {
              console.error('Delete operation failed:', {
                error,
                message: error.message,
                stack: error.stack
              });
              
              Alert.alert(
                "Error",
                "Failed to delete fuel log. Please try again later. " +
                (error.message || "Unknown error occurred")
              );
            }
          },
        },
      ]
    );
  };

  useEffect(() => {
    let temp = [...logs];

    if (search.trim()) {
      const term = search.toLowerCase();
      temp = temp.filter((log) => {
        const nickname = log.motorId?.nickname?.toLowerCase() || "";
        const model = log.motorId?.motorcycleId?.model?.toLowerCase() || "";
        const date = new Date(log.date).toLocaleString("en-PH").toLowerCase();
        const liters = String(log.liters || "").toLowerCase();
        const price = String(log.pricePerLiter?.toFixed(2) || "").toLowerCase();
        const totalCost = String(log.totalCost?.toFixed(2) || "").toLowerCase();
        const notes = log.notes?.toLowerCase() || "";

        return (
          nickname.includes(term) ||
          model.includes(term) ||
          date.includes(term) ||
          liters.includes(term) ||
          price.includes(term) ||
          totalCost.includes(term) ||
          notes.includes(term)
        );
      });
    }

    if (fromDateStr && toDateStr) {
      const from = new Date(fromDateStr);
      const to = new Date(toDateStr);
      temp = temp.filter((log) => {
        const logDate = new Date(log.date);
        return logDate >= from && logDate <= to;
      });
    }

    const sortFunction = (a: any, b: any) => {
      let comparison = 0;
      switch (sortBy) {
        case 'date':
          comparison = new Date(b.date).getTime() - new Date(a.date).getTime();
          break;
        case 'liters':
          comparison = (b.liters || 0) - (a.liters || 0);
          break;
        case 'cost':
          comparison = (b.totalCost || 0) - (a.totalCost || 0);
          break;
        case 'odometer':
          comparison = (b.odometer || 0) - (a.odometer || 0);
          break;
      }
      return sortOrder === 'desc' ? comparison : -comparison;
    };

    temp.sort(sortFunction);
    setFiltered(temp);
    setPage(1);
  }, [search, fromDateStr, toDateStr, sortBy, sortOrder, logs]);

  const paginated = filtered.slice(0, page * PAGE_SIZE);
  const loadMore = () => {
    if (page * PAGE_SIZE < filtered.length) setPage((p) => p + 1);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-PH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatOdometer = (value: number | undefined) => {
    if (value === undefined || value === null) return '--';
    return value.toLocaleString() + ' km';
  };

  const toggleExpand = (logId: string) => {
    setExpandedLogId(expandedLogId === logId ? null : logId);
  };

  const renderSortModal = () => (
    <Modal
      visible={showSortModal}
      transparent
      animationType="slide"
      onRequestClose={() => setShowSortModal(false)}
    >
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={() => setShowSortModal(false)}
      >
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Sort By</Text>
          {sortOptions.map((option) => (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.sortOption,
                sortBy === option.value && styles.sortOptionSelected,
              ]}
              onPress={() => {
                if (sortBy === option.value) {
                  setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                } else {
                  setSortBy(option.value);
                  setSortOrder('desc');
                }
                setShowSortModal(false);
              }}
            >
              <View style={styles.sortOptionContent}>
                <Ionicons name={option.icon} size={20} color={sortBy === option.value ? '#00ADB5' : '#666666'} />
                <Text style={[
                  styles.sortOptionText,
                  sortBy === option.value && styles.sortOptionTextSelected
                ]}>
                  {option.label}
                </Text>
              </View>
              {sortBy === option.value && (
                <Ionicons
                  name={sortOrder === 'desc' ? 'arrow-down' : 'arrow-up'}
                  size={20}
                  color="#00ADB5"
                />
              )}
            </TouchableOpacity>
          ))}
        </View>
      </TouchableOpacity>
    </Modal>
  );

  const renderFuelLog = ({ item }) => {
    const isExpanded = expandedLogId === item._id;

    return (
      <TouchableOpacity 
        style={[styles.logCard, isExpanded && styles.logCardExpanded]}
        onPress={() => toggleExpand(item._id)}
        activeOpacity={0.7}
      >
        <View style={styles.logHeader}>
          <View style={styles.logHeaderLeft}>
            <Text style={styles.dateText}>{formatDate(item.date)}</Text>
            <Text style={styles.motorName}>{item.motorId?.nickname ?? 'Unknown Motor'}</Text>
          </View>
          <View style={styles.headerActions}>
            <View style={styles.priceContainer}>
              <Text style={styles.totalPrice}>₱{item.totalCost?.toFixed(2) || '--'}</Text>
            </View>
            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation();
                deleteFuelLog(item._id);
              }}
              style={styles.deleteButton}
            >
              <Ionicons name="trash-outline" size={20} color="#FF6B6B" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.logDetails}>
          <View style={styles.detailRow}>
            <View style={styles.detailItem}>
              <Ionicons name="water-outline" size={20} color="#00ADB5" />
              <Text style={styles.detailLabel}>Volume</Text>
              <Text style={styles.detailValue}>{item.liters?.toFixed(1) || '--'} L</Text>
            </View>
            <View style={styles.detailItem}>
              <Ionicons name="pricetag-outline" size={20} color="#00ADB5" />
              <Text style={styles.detailLabel}>Price/L</Text>
              <Text style={styles.detailValue}>₱{item.pricePerLiter?.toFixed(2) || '--'}</Text>
            </View>
            <View style={styles.detailItem}>
              <Ionicons name="speedometer-outline" size={20} color="#00ADB5" />
              <Text style={styles.detailLabel}>Odometer</Text>
              <Text style={styles.detailValue}>{formatOdometer(item.odometer)}</Text>
            </View>
          </View>
          {isExpanded && (
            <View style={styles.expandedContent}>
              {item.notes && (
                <View style={styles.notesContainer}>
                  <Text style={styles.notesLabel}>Notes</Text>
                  <Text style={styles.notes}>{item.notes}</Text>
                </View>
              )}
              <View style={styles.additionalDetails}>
                <Text style={styles.additionalDetailsLabel}>Additional Details</Text>
                <View style={styles.additionalDetailsGrid}>
                  {item.motorId?.motorcycleId?.model && (
                    <View style={styles.gridItem}>
                      <Text style={styles.gridLabel}>Model</Text>
                      <Text style={styles.gridValue}>{item.motorId.motorcycleId.model}</Text>
                    </View>
                  )}
                  {item.location && (
                    <View style={styles.gridItem}>
                      <Text style={styles.gridLabel}>Location</Text>
                      <Text style={styles.gridValue}>{item.location}</Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  if (fullList) {
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
                <Text style={styles.headerTitle}>Fuel Logs</Text>
                <Text style={styles.headerSubtitle}>Track your refueling history</Text>
              </View>
              <TouchableOpacity 
                style={styles.sortButton}
                onPress={() => setShowSortModal(true)}
              >
                <Ionicons name="funnel-outline" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </View>

        <FlatList
          data={paginated}
          renderItem={renderFuelLog}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContainer}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="water-outline" size={48} color="#00ADB5" />
              <Text style={styles.emptyStateText}>No fuel logs yet</Text>
              <Text style={styles.emptyStateSubtext}>
                Add your first fuel log to start tracking
              </Text>
            </View>
          }
        />

        <TouchableOpacity 
          style={styles.fab}
          onPress={() => navigation.navigate('AddFuelLogScreen')}
        >
          <LinearGradient
            colors={['#00ADB5', '#00C2CC']}
            style={styles.fabGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Ionicons name="add" size={24} color="#FFFFFF" />
          </LinearGradient>
        </TouchableOpacity>

        {renderSortModal()}
      </SafeAreaView>
    );
  }

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
              <Text style={styles.headerTitle}>Fuel Log Details</Text>
              <Text style={styles.headerSubtitle}>{formatDate(item?.date)}</Text>
            </View>
          </View>
        </LinearGradient>
      </View>

      <View style={styles.detailsContainer}>
        {renderFuelLog({ item })}
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
    backgroundColor: '#00ADB5',
  },
  headerGradient: {
    width: '100%',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingTop: Platform.OS === 'android' ? 20 : 16,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 8,
  },
  sortButton: {
    padding: 8,
  },
  listContainer: {
    padding: 16,
  },
  detailsContainer: {
    padding: 16,
  },
  logCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  logCardExpanded: {
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 8,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  logHeaderLeft: {
    flex: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateText: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 4,
  },
  motorName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
  },
  priceContainer: {
    backgroundColor: '#F8F9FA',
    padding: 8,
    borderRadius: 8,
    marginRight: 8,
  },
  totalPrice: {
    fontSize: 18,
    fontWeight: '700',
    color: '#00ADB5',
  },
  deleteButton: {
    padding: 8,
  },
  logDetails: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  detailItem: {
    flex: 1,
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 12,
    color: '#666666',
    marginTop: 4,
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333333',
  },
  expandedContent: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E9ECEF',
  },
  notesContainer: {
    marginBottom: 16,
  },
  notesLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 8,
  },
  notes: {
    fontSize: 14,
    color: '#666666',
    lineHeight: 20,
  },
  additionalDetails: {
    marginTop: 8,
  },
  additionalDetailsLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 12,
  },
  additionalDetailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -8,
  },
  gridItem: {
    width: '50%',
    paddingHorizontal: 8,
    marginBottom: 12,
  },
  gridLabel: {
    fontSize: 12,
    color: '#666666',
    marginBottom: 4,
  },
  gridValue: {
    fontSize: 14,
    color: '#333333',
    fontWeight: '500',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
    marginTop: 16,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#666666',
    marginTop: 8,
    textAlign: 'center',
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    borderRadius: 28,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.30,
    shadowRadius: 4.65,
  },
  fabGradient: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 16,
  },
  sortOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  sortOptionSelected: {
    backgroundColor: '#F8F9FA',
  },
  sortOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sortOptionText: {
    fontSize: 16,
    color: '#666666',
    marginLeft: 12,
  },
  sortOptionTextSelected: {
    color: '#00ADB5',
    fontWeight: '500',
  },
});
