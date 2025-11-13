import React, { useEffect, useState, useMemo } from 'react';
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
  Modal,
  TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { useUser } from '../../AuthContext/UserContextImproved';
import { LOCALHOST_IP } from '@env';
import DateTimePicker from '@react-native-community/datetimepicker';
import { apiRequest } from '../../utils/api';

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
  showSingleItem?: boolean;
};

export default function MaintenanceDetails() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<Record<string, RouteParams>, string>>();
  const { item, fullList, showSingleItem } = route.params;
  const systemColorScheme = useColorScheme();
  const isDarkMode = systemColorScheme === 'dark';
  const { user } = useUser();
  
  // Add error handling for undefined user
  if (!user) {
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
        <View style={styles.loadingContainer}>
          <MaterialIcons name="error" size={48} color="#FF6B6B" />
          <Text style={[styles.loadingText, isDarkMode && styles.loadingTextDark]}>
            User not authenticated. Please log in again.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const [fetchedList, setFetchedList] = useState<MaintenanceAction[]>([]);
  const [loading, setLoading] = useState(false);
  const [summaryStats, setSummaryStats] = useState({
    totalCost: 0,
    totalRefuels: 0,
    totalOilChanges: 0,
    totalTuneUps: 0
  });

  // Filter and sort state
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [filters, setFilters] = useState({
    selectedMotor: 'all',
    selectedType: 'all',
    startDate: null as Date | null,
    endDate: null as Date | null,
    sortBy: 'date' as 'date' | 'cost' | 'type',
    sortOrder: 'desc' as 'asc' | 'desc',
  });
  const [showDatePicker, setShowDatePicker] = useState<'start' | 'end' | null>(null);
  const [availableMotors, setAvailableMotors] = useState<string[]>([]);

  // Fetch maintenance analytics from API instead of calculating locally
  // Uses: GET /api/maintenance-records/analytics/summary?userId=user_id
  const fetchMaintenanceStats = async (userId: string, motorId?: string) => {
    try {
      const { getMaintenanceAnalytics } = await import('../../services/motorService');
      const analytics = await getMaintenanceAnalytics(userId, motorId);
      
      return {
        totalCost: analytics.totalCost || 0,
        totalRefuels: analytics.byType?.refuel || 0,
        totalOilChanges: analytics.byType?.oil_change || 0,
        totalTuneUps: analytics.byType?.tune_up || 0
      };
    } catch (error) {
      console.warn('[MaintenanceDetails] Failed to fetch stats from API, calculating locally:', error);
      return null;
    }
  };

  // Fallback local calculation (only used if API fails)
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

  // Filter and sort the data
  const filteredAndSortedData = useMemo(() => {
    let filtered = [...fetchedList];

    // Filter by motor
    if (filters.selectedMotor !== 'all') {
      filtered = filtered.filter(item => item.motorId._id === filters.selectedMotor);
    }

    // Filter by type
    if (filters.selectedType !== 'all') {
      filtered = filtered.filter(item => item.type === filters.selectedType);
    }

    // Filter by date range
    if (filters.startDate) {
      filtered = filtered.filter(item => new Date(item.timestamp) >= filters.startDate!);
    }
    if (filters.endDate) {
      filtered = filtered.filter(item => new Date(item.timestamp) <= filters.endDate!);
    }

    // Sort the data
    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (filters.sortBy) {
        case 'date':
          comparison = new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
          break;
        case 'cost':
          comparison = (a.details?.cost || 0) - (b.details?.cost || 0);
          break;
        case 'type':
          comparison = a.type.localeCompare(b.type);
          break;
      }

      return filters.sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [fetchedList, filters]);

  // Calculate stats for filtered data
  const filteredStats = useMemo(() => {
    return calculateStats(filteredAndSortedData);
  }, [filteredAndSortedData]);

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

  // Filter functions
  const clearFilters = () => {
    setFilters({
      selectedMotor: 'all',
      selectedType: 'all',
      startDate: null,
      endDate: null,
      sortBy: 'date',
      sortOrder: 'desc',
    });
  };

  const applyFilters = () => {
    setShowFilterModal(false);
  };

  const hasActiveFilters = () => {
    return filters.selectedMotor !== 'all' || 
           filters.selectedType !== 'all' || 
           filters.startDate !== null || 
           filters.endDate !== null;
  };

  const formatDateForDisplay = (date: Date | null) => {
    if (!date) return 'Select Date';
    return date.toLocaleDateString('en-PH', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const renderSummarySection = () => (
    <View style={[styles.summaryContainer, isDarkMode && styles.summaryContainerDark]}>
      <View style={styles.summaryHeader}>
        <Text style={[styles.summaryTitle, isDarkMode && styles.summaryTitleDark]}>
          Maintenance Summary
          {hasActiveFilters() && (
            <Text style={[styles.filteredIndicator, isDarkMode && styles.filteredIndicatorDark]}>
              {' '}(Filtered)
            </Text>
          )}
        </Text>
        <TouchableOpacity
          onPress={() => setShowFilterModal(true)}
          style={[styles.filterButton, isDarkMode && styles.filterButtonDark]}
        >
          <MaterialIcons 
            name="filter-list" 
            size={20} 
            color={hasActiveFilters() ? "#00ADB5" : "#666"} 
          />
          <Text style={[
            styles.filterButtonText, 
            isDarkMode && styles.filterButtonTextDark,
            hasActiveFilters() && styles.filterButtonTextActive
          ]}>
            Filter
          </Text>
        </TouchableOpacity>
      </View>
      <View style={styles.statsGrid}>
        <View style={[styles.statCard, isDarkMode && styles.statCardDark]}>
          <Text style={[styles.statValue, isDarkMode && styles.statValueDark, {fontSize: 24}]}>
            ₱{filteredStats.totalCost.toFixed(2)}
          </Text>
          <Text style={[styles.statLabel, isDarkMode && styles.statLabelDark]}>Total Cost</Text>
        </View>
        <View style={[styles.statCard, isDarkMode && styles.statCardDark]}>
          <MaterialIcons name="local-gas-station" size={24} color="#00ADB5" />
          <Text style={[styles.statValue, isDarkMode && styles.statValueDark]}>
            {filteredStats.totalRefuels}
          </Text>
          <Text style={[styles.statLabel, isDarkMode && styles.statLabelDark]}>Refuels</Text>
        </View>
        <View style={[styles.statCard, isDarkMode && styles.statCardDark]}>
          <MaterialIcons name="opacity" size={24} color="#00ADB5" />
          <Text style={[styles.statValue, isDarkMode && styles.statValueDark]}>
            {filteredStats.totalOilChanges}
          </Text>
          <Text style={[styles.statLabel, isDarkMode && styles.statLabelDark]}>Oil Changes</Text>
        </View>
        <View style={[styles.statCard, isDarkMode && styles.statCardDark]}>
          <MaterialIcons name="build" size={24} color="#00ADB5" />
          <Text style={[styles.statValue, isDarkMode && styles.statValueDark]}>
            {filteredStats.totalTuneUps}
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

        {action.details?.costPerLiter !== undefined && action.type === 'refuel' && (
          <View style={styles.detailRow}>
            <MaterialIcons name="attach-money" size={20} color="#00ADB5" />
            <Text style={[styles.detailText, isDarkMode && styles.detailTextDark]}>
              Price per Liter: ₱{Number(action.details.costPerLiter).toFixed(2)}
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
        setFetchedList(dataToProcess); // Set the data to display
        return;
      }

      try {
        setLoading(true);
        console.log("🔍 Fetching maintenance records for user:", user._id);
        
        // Use apiRequest utility for consistent authentication and error handling
        const maintenanceData = await apiRequest(`/api/maintenance-records/user/${user._id}`);
        
        // Handle different response formats (array, wrapped in object, etc.)
        let data: MaintenanceAction[] = [];
        if (Array.isArray(maintenanceData)) {
          data = maintenanceData;
        } else if (maintenanceData?.maintenanceRecords) {
          data = Array.isArray(maintenanceData.maintenanceRecords) ? maintenanceData.maintenanceRecords : [];
        } else if (maintenanceData?.data) {
          data = Array.isArray(maintenanceData.data) ? maintenanceData.data : [];
        }
        
        console.log("✅ Parsed maintenance data:", JSON.stringify(data, null, 2));
        console.log("✅ Data is an array with length:", data.length);
        if (data.length > 0) {
          console.log("✅ First item sample:", JSON.stringify(data[0], null, 2));
        }

        const stats = calculateStats(data);
        console.log("📊 Calculated stats from fetched data:", stats);
        
        // Extract unique motors for filter dropdown
        const motors = [...new Set(data.map(item => item.motorId?._id).filter(Boolean))] as string[];
        setAvailableMotors(motors);
        
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
        <Text style={styles.headerTitle}>
          {showSingleItem ? 'Maintenance Details' : 'Maintenance Records'}
        </Text>
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
          data={filteredAndSortedData}
          keyExtractor={(item, index) => item._id || index.toString()}
          ListHeaderComponent={showSingleItem ? null : renderSummarySection}
          renderItem={({ item }) => renderMaintenanceItem(item)}
          contentContainerStyle={styles.content}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialIcons name="build" size={48} color="#00ADB5" />
              <Text style={[styles.emptyText, isDarkMode && styles.emptyTextDark]}>
                {hasActiveFilters() ? 'No records match your filters.' : 'No maintenance records found.'}
              </Text>
              {hasActiveFilters() && (
                <TouchableOpacity onPress={clearFilters} style={styles.clearFiltersButton}>
                  <Text style={styles.clearFiltersText}>Clear Filters</Text>
                </TouchableOpacity>
              )}
            </View>
          }
        />
      )}

      {/* Filter Modal */}
      <Modal
        visible={showFilterModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowFilterModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, isDarkMode && styles.modalContainerDark]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, isDarkMode && styles.modalTitleDark]}>
                Filter & Sort
              </Text>
              <TouchableOpacity
                onPress={() => setShowFilterModal(false)}
                style={styles.closeButton}
              >
                <MaterialIcons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent}>
              {/* Motor Filter */}
              <View style={styles.filterSection}>
                <Text style={[styles.filterLabel, isDarkMode && styles.filterLabelDark]}>
                  Motor
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <TouchableOpacity
                    style={[
                      styles.filterChip,
                      filters.selectedMotor === 'all' && styles.filterChipActive,
                      isDarkMode && styles.filterChipDark
                    ]}
                    onPress={() => setFilters(prev => ({ ...prev, selectedMotor: 'all' }))}
                  >
                    <Text style={[
                      styles.filterChipText,
                      filters.selectedMotor === 'all' && styles.filterChipTextActive,
                      isDarkMode && styles.filterChipTextDark
                    ]}>
                      All Motors
                    </Text>
                  </TouchableOpacity>
                  {availableMotors.map((motorId) => {
                    const motor = fetchedList.find(item => item.motorId._id === motorId)?.motorId;
                    return (
                      <TouchableOpacity
                        key={motorId}
                        style={[
                          styles.filterChip,
                          filters.selectedMotor === motorId && styles.filterChipActive,
                          isDarkMode && styles.filterChipDark
                        ]}
                        onPress={() => setFilters(prev => ({ ...prev, selectedMotor: motorId }))}
                      >
                        <Text style={[
                          styles.filterChipText,
                          filters.selectedMotor === motorId && styles.filterChipTextActive,
                          isDarkMode && styles.filterChipTextDark
                        ]}>
                          {motor?.nickname || 'Unnamed Motor'}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Type Filter */}
              <View style={styles.filterSection}>
                <Text style={[styles.filterLabel, isDarkMode && styles.filterLabelDark]}>
                  Maintenance Type
                </Text>
                <View style={styles.filterRow}>
                  {['all', 'refuel', 'oil_change', 'tune_up'].map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.filterChip,
                        filters.selectedType === type && styles.filterChipActive,
                        isDarkMode && styles.filterChipDark
                      ]}
                      onPress={() => setFilters(prev => ({ ...prev, selectedType: type as any }))}
                    >
                      <Text style={[
                        styles.filterChipText,
                        filters.selectedType === type && styles.filterChipTextActive,
                        isDarkMode && styles.filterChipTextDark
                      ]}>
                        {type === 'all' ? 'All Types' : type.replace('_', ' ').toUpperCase()}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Date Range Filter */}
              <View style={styles.filterSection}>
                <Text style={[styles.filterLabel, isDarkMode && styles.filterLabelDark]}>
                  Date Range
                </Text>
                <View style={styles.dateRow}>
                  <TouchableOpacity
                    style={[styles.dateButton, isDarkMode && styles.dateButtonDark]}
                    onPress={() => setShowDatePicker('start')}
                  >
                    <MaterialIcons name="date-range" size={20} color="#00ADB5" />
                    <Text style={[styles.dateButtonText, isDarkMode && styles.dateButtonTextDark]}>
                      {formatDateForDisplay(filters.startDate)}
                    </Text>
                  </TouchableOpacity>
                  <Text style={[styles.dateSeparator, isDarkMode && styles.dateSeparatorDark]}>to</Text>
                  <TouchableOpacity
                    style={[styles.dateButton, isDarkMode && styles.dateButtonDark]}
                    onPress={() => setShowDatePicker('end')}
                  >
                    <MaterialIcons name="date-range" size={20} color="#00ADB5" />
                    <Text style={[styles.dateButtonText, isDarkMode && styles.dateButtonTextDark]}>
                      {formatDateForDisplay(filters.endDate)}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Sort Options */}
              <View style={styles.filterSection}>
                <Text style={[styles.filterLabel, isDarkMode && styles.filterLabelDark]}>
                  Sort By
                </Text>
                <View style={styles.sortRow}>
                  <View style={styles.sortByContainer}>
                    <Text style={[styles.sortLabel, isDarkMode && styles.sortLabelDark]}>Sort by:</Text>
                    <View style={styles.sortButtons}>
                      {['date', 'cost', 'type'].map((sortBy) => (
                        <TouchableOpacity
                          key={sortBy}
                          style={[
                            styles.sortButton,
                            filters.sortBy === sortBy && styles.sortButtonActive,
                            isDarkMode && styles.sortButtonDark
                          ]}
                          onPress={() => setFilters(prev => ({ ...prev, sortBy: sortBy as any }))}
                        >
                          <Text style={[
                            styles.sortButtonText,
                            filters.sortBy === sortBy && styles.sortButtonTextActive,
                            isDarkMode && styles.sortButtonTextDark
                          ]}>
                            {sortBy.charAt(0).toUpperCase() + sortBy.slice(1)}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                  <View style={styles.sortOrderContainer}>
                    <Text style={[styles.sortLabel, isDarkMode && styles.sortLabelDark]}>Order:</Text>
                    <View style={styles.sortButtons}>
                      <TouchableOpacity
                        style={[
                          styles.sortButton,
                          filters.sortOrder === 'asc' && styles.sortButtonActive,
                          isDarkMode && styles.sortButtonDark
                        ]}
                        onPress={() => setFilters(prev => ({ ...prev, sortOrder: 'asc' }))}
                      >
                        <Text style={[
                          styles.sortButtonText,
                          filters.sortOrder === 'asc' && styles.sortButtonTextActive,
                          isDarkMode && styles.sortButtonTextDark
                        ]}>
                          Asc
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.sortButton,
                          filters.sortOrder === 'desc' && styles.sortButtonActive,
                          isDarkMode && styles.sortButtonDark
                        ]}
                        onPress={() => setFilters(prev => ({ ...prev, sortOrder: 'desc' }))}
                      >
                        <Text style={[
                          styles.sortButtonText,
                          filters.sortOrder === 'desc' && styles.sortButtonTextActive,
                          isDarkMode && styles.sortButtonTextDark
                        ]}>
                          Desc
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.modalButton, styles.clearButton]}
                onPress={clearFilters}
              >
                <Text style={styles.clearButtonText}>Clear All</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.applyButton]}
                onPress={applyFilters}
              >
                <Text style={styles.applyButtonText}>Apply Filters</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Date Picker */}
      {showDatePicker && (
        <DateTimePicker
          value={showDatePicker === 'start' ? (filters.startDate || new Date()) : (filters.endDate || new Date())}
          mode="date"
          display="default"
          onChange={(event, selectedDate) => {
            setShowDatePicker(null);
            if (selectedDate) {
              setFilters(prev => ({
                ...prev,
                [showDatePicker === 'start' ? 'startDate' : 'endDate']: selectedDate
              }));
            }
          }}
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
  // Filter styles
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  filteredIndicator: {
    fontSize: 14,
    color: '#00ADB5',
    fontWeight: '500',
  },
  filteredIndicatorDark: {
    color: '#00ADB5',
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  filterButtonDark: {
    borderColor: '#555',
  },
  filterButtonText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 4,
  },
  filterButtonTextDark: {
    color: '#aaa',
  },
  filterButtonTextActive: {
    color: '#00ADB5',
    fontWeight: '600',
  },
  clearFiltersButton: {
    marginTop: 16,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#00ADB5',
    borderRadius: 8,
  },
  clearFiltersText: {
    color: '#fff',
    fontWeight: '600',
    textAlign: 'center',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalContainerDark: {
    backgroundColor: '#2A2A2A',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
  },
  modalTitleDark: {
    color: '#fff',
  },
  closeButton: {
    padding: 4,
  },
  modalContent: {
    padding: 20,
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  clearButton: {
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  applyButton: {
    backgroundColor: '#00ADB5',
  },
  clearButtonText: {
    color: '#666',
    fontWeight: '600',
  },
  applyButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  // Filter section styles
  filterSection: {
    marginBottom: 24,
  },
  filterLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  filterLabelDark: {
    color: '#fff',
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#f8f9fa',
  },
  filterChipDark: {
    borderColor: '#555',
    backgroundColor: '#3A3A3A',
  },
  filterChipActive: {
    backgroundColor: '#00ADB5',
    borderColor: '#00ADB5',
  },
  filterChipText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  filterChipTextDark: {
    color: '#aaa',
  },
  filterChipTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  // Date filter styles
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dateButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#f8f9fa',
  },
  dateButtonDark: {
    borderColor: '#555',
    backgroundColor: '#3A3A3A',
  },
  dateButtonText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  dateButtonTextDark: {
    color: '#aaa',
  },
  dateSeparator: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  dateSeparatorDark: {
    color: '#aaa',
  },
  // Sort styles
  sortRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
  },
  sortByContainer: {
    flex: 1,
  },
  sortOrderContainer: {
    flex: 1,
  },
  sortLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  sortLabelDark: {
    color: '#aaa',
  },
  sortButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  sortButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#f8f9fa',
    alignItems: 'center',
  },
  sortButtonDark: {
    borderColor: '#555',
    backgroundColor: '#3A3A3A',
  },
  sortButtonActive: {
    backgroundColor: '#00ADB5',
    borderColor: '#00ADB5',
  },
  sortButtonText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  sortButtonTextDark: {
    color: '#aaa',
  },
  sortButtonTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
});
