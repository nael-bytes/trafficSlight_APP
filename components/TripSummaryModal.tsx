// Trip summary modal component

import React, { memo, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import type { RideStats } from '../types';

interface TripSummaryModalProps {
  visible: boolean;
  rideStats: RideStats;
  onClose: () => void;
  onSave: () => void;
  onCancel?: () => void;
  selectedMotor?: any;
  startAddress?: string;
  endAddress?: string;
  tripMaintenanceActions?: any[];
  // Additional trip data from Trip model
  tripData?: {
    // Estimated (Planned)
    distance?: number;
    fuelUsedMin?: number;
    fuelUsedMax?: number;
    eta?: string;
    timeArrived?: string;
    
    // Actual (Tracked)
    tripStartTime?: Date;
    tripEndTime?: Date;
    actualDistance?: number;
    actualFuelUsedMin?: number;
    actualFuelUsedMax?: number;
    duration?: number; // in minutes
    kmph?: number;
    
    // Location
    startLocation?: {
      address?: string;
      lat?: number;
      lng?: number;
    };
    endLocation?: {
      address?: string;
      lat?: number;
      lng?: number;
    };
    
    // Routing
    plannedPolyline?: string;
    actualPolyline?: string;
    wasRerouted?: boolean;
    rerouteCount?: number;
    
    // Background & Analytics
    wasInBackground?: boolean;
    showAnalyticsModal?: boolean;
    analyticsNotes?: string;
    trafficCondition?: "light" | "moderate" | "heavy";
    
    // Trip Summary
    destination?: string;
    isSuccessful?: boolean;
    status?: "planned" | "in-progress" | "completed" | "cancelled";
  };
}

// Custom comparison function for memo to prevent unnecessary re-renders
const areTripSummaryPropsEqual = (prevProps: TripSummaryModalProps, nextProps: TripSummaryModalProps): boolean => {
  // If visible changed, we need to re-render (for animation)
  if (prevProps.visible !== nextProps.visible) return false;
  
  // If not visible, don't re-render even if other props change
  if (!nextProps.visible) return true;
  
  // Compare rideStats by value (not reference)
  if (prevProps.rideStats?.distance !== nextProps.rideStats?.distance ||
      prevProps.rideStats?.duration !== nextProps.rideStats?.duration ||
      prevProps.rideStats?.avgSpeed !== nextProps.rideStats?.avgSpeed ||
      prevProps.rideStats?.speed !== nextProps.rideStats?.speed) {
    return false;
  }
  
  // Compare other props
  if (prevProps.selectedMotor?._id !== nextProps.selectedMotor?._id) return false;
  if (prevProps.startAddress !== nextProps.startAddress) return false;
  if (prevProps.endAddress !== nextProps.endAddress) return false;
  if (prevProps.tripMaintenanceActions?.length !== nextProps.tripMaintenanceActions?.length) return false;
  
  // Compare tripData by key fields
  if (prevProps.tripData?.distance !== nextProps.tripData?.distance ||
      prevProps.tripData?.duration !== nextProps.tripData?.duration ||
      prevProps.tripData?.fuelUsedMin !== nextProps.tripData?.fuelUsedMin ||
      prevProps.tripData?.fuelUsedMax !== nextProps.tripData?.fuelUsedMax) {
    return false;
  }
  
  // Callbacks should be stable (memoized), so we can skip checking them
  // If they were different, it would have already re-rendered
  return true;
};

export const TripSummaryModal: React.FC<TripSummaryModalProps> = memo(({
  visible,
  rideStats,
  onClose,
  onSave,
  onCancel,
  selectedMotor,
  startAddress,
  endAddress,
  tripMaintenanceActions = [],
  tripData,
}) => {
  // Debug duration values
  console.log('[TripSummaryModal] Component props debug:', {
    rideStatsDuration: rideStats.duration,
    rideStatsDurationType: typeof rideStats.duration,
    tripDataDuration: tripData?.duration,
    tripDataDurationType: typeof tripData?.duration,
    calculatedDuration: rideStats.duration && rideStats.duration > 0 ? Math.round(rideStats.duration / 60) : undefined,
    rideStatsFull: rideStats,
    tripDataFull: tripData
  });
  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const formatDateTime = (date: Date | string | undefined): string => {
    if (!date) return 'N/A';
    const d = new Date(date);
    return d.toLocaleString();
  };

  const formatDuration = (minutes: number | undefined): string => {
    console.log('[TripSummaryModal] formatDuration called with:', {
      minutes,
      minutesType: typeof minutes,
      isNaN: isNaN(minutes as number),
      isFalsy: !minutes,
      isZero: minutes === 0
    });
    
    if (minutes === undefined || minutes === null || isNaN(minutes as number)) {
      console.log('[TripSummaryModal] Duration is undefined/null/NaN, returning N/A');
      return 'N/A';
    }
    
    if (minutes <= 0) {
      console.log('[TripSummaryModal] Duration is zero or negative, returning 0m');
      return '0m';
    }
    
    const hours = Math.floor(minutes / 60);
    const mins = Math.floor(minutes % 60);
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const getTrafficConditionColor = (condition: string | undefined): string => {
    switch (condition) {
      case 'light': return '#27ae60';
      case 'moderate': return '#f39c12';
      case 'heavy': return '#e74c3c';
      default: return '#95a5a6';
    }
  };

  const getStatusColor = (status: string | undefined): string => {
    switch (status) {
      case 'completed': return '#27ae60';
      case 'in-progress': return '#3498db';
      case 'cancelled': return '#e74c3c';
      case 'planned': return '#f39c12';
      default: return '#95a5a6';
    }
  };

  const handleSave = () => {
    onSave();
    onClose();
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    }
    onClose();
  };

  // Memoized computed values
  const showCancelButton = useMemo(() => rideStats.distance < 1.0, [rideStats.distance]);
  
  const memoizedTripData = useMemo(() => tripData, [tripData]);
  const memoizedRideStats = useMemo(() => rideStats, [rideStats]);

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={[styles.summaryModalContainer, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
        <View style={[styles.summaryModal, { margin: 10 }]}>
          <LinearGradient
            colors={['#00ADB5', '#00858B']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.summaryHeaderGradient}
          >
            <Text style={[styles.summaryTitle, { color: '#fff' }]}>Trip Summary & Analytics</Text>
          </LinearGradient>

          <ScrollView style={styles.summaryContent}>
            {/* Trip Overview */}
            <View style={styles.summarySection}>
              <Text style={styles.sectionTitle}>Trip Overview</Text>

              <View style={styles.summaryRow}>
                <MaterialIcons name="place" size={20} color="#00ADB5" />
                <View style={styles.analyticsCompare}>
                  <Text style={styles.analyticsLabel}>Destination:</Text>
                  <Text style={styles.analyticsValue}>{tripData?.destination || "Free Drive"}</Text>
                  <Text style={styles.analyticsLabel}>Status:</Text>
                  <Text style={[styles.analyticsValue, { color: getStatusColor(tripData?.status) }]}>
                    {tripData?.status?.toUpperCase() || "COMPLETED"}
                  </Text>
                </View>
              </View>

              <View style={styles.summaryRow}>
                <MaterialIcons name="my-location" size={20} color="#34495e" />
                <Text style={styles.summaryText}>From: {tripData?.startLocation?.address || startAddress || "Unknown"}</Text>
              </View>

              <View style={styles.summaryRow}>
                <MaterialIcons name="place" size={20} color="#e74c3c" />
                <Text style={styles.summaryText}>To: {tripData?.endLocation?.address || endAddress || "Unknown Location"}</Text>
              </View>
            </View>

            {/* Distance & Fuel Analytics */}
            <View style={styles.summarySection}>
              <Text style={styles.sectionTitle}>Distance & Fuel Analytics</Text>

              <View style={styles.summaryRow}>
                <MaterialIcons name="straighten" size={20} color="#3498db" />
                <View style={styles.analyticsCompare}>
                  <Text style={styles.analyticsLabel}>Planned Distance:</Text>
                  <Text style={styles.analyticsValue}>{((tripData?.distance || 0) / 1000).toFixed(2)} km</Text>
                  <Text style={styles.analyticsLabel}>Actual Distance:</Text>
                  <Text style={styles.analyticsValue}>{(tripData?.actualDistance || rideStats.distance).toFixed(2)} km</Text>
                </View>
              </View>

              <View style={styles.summaryRow}>
                <MaterialIcons name="local-gas-station" size={20} color="#f39c12" />
                <View style={styles.analyticsCompare}>
                  <Text style={styles.analyticsLabel}>Fuel Used (Min):</Text>
                  <Text style={styles.analyticsValue}>{(tripData?.actualFuelUsedMin || tripData?.fuelUsedMin || 0).toFixed(2)} L</Text>
                  <Text style={styles.analyticsLabel}>Fuel Used (Max):</Text>
                  <Text style={styles.analyticsValue}>{(tripData?.actualFuelUsedMax || tripData?.fuelUsedMax || 0).toFixed(2)} L</Text>
                </View>
              </View>
            </View>


            {/* Time Analytics */}
            <View style={styles.summarySection}>
              <Text style={styles.sectionTitle}>Time Analytics</Text>

              <View style={styles.summaryRow}>
                <MaterialIcons name="schedule" size={20} color="#9b59b6" />
                <View style={styles.analyticsCompare}>
                  <Text style={styles.analyticsLabel}>Trip Start:</Text>
                  <Text style={styles.analyticsValue}>{formatDateTime(tripData?.tripStartTime)}</Text>
                  <Text style={styles.analyticsLabel}>Trip End:</Text>
                  <Text style={styles.analyticsValue}>{formatDateTime(tripData?.tripEndTime)}</Text>
                </View>
              </View>

              <View style={styles.summaryRow}>
                <MaterialIcons name="timer" size={20} color="#8e44ad" />
                <View style={styles.analyticsCompare}>
                  <Text style={styles.analyticsLabel}>Duration:</Text>
                  <Text style={styles.analyticsValue}>{formatDuration(
                    tripData?.duration || 
                    (rideStats.duration && rideStats.duration > 0 ? Math.round(rideStats.duration / 60) : undefined)
                  )}</Text>
                 
                </View>
              </View>

              <View style={styles.summaryRow}>
                <MaterialIcons name="speed" size={20} color="#e67e22" />
                <View style={styles.analyticsCompare}>
                  <Text style={styles.analyticsLabel}>Avg Speed:</Text>
                  <Text style={styles.analyticsValue}>{(tripData?.kmph || rideStats.avgSpeed).toFixed(1)} km/h</Text>
                  <Text style={styles.analyticsLabel}>Traffic:</Text>
                  <Text style={[styles.analyticsValue, { color: getTrafficConditionColor(tripData?.trafficCondition) }]}>
                    {tripData?.trafficCondition ? tripData.trafficCondition.toUpperCase() : 'N/A'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Routing Information */}
            {(tripData?.wasRerouted || tripData?.rerouteCount) && (
              <View style={styles.summarySection}>
                <Text style={styles.sectionTitle}>Routing Information</Text>

                <View style={styles.summaryRow}>
                  <MaterialIcons name="route" size={20} color="#e74c3c" />
                  <View style={styles.analyticsCompare}>
                    <Text style={styles.analyticsLabel}>Was Rerouted:</Text>
                    <Text style={[styles.analyticsValue, { color: tripData?.wasRerouted ? '#e74c3c' : '#27ae60' }]}>
                      {tripData?.wasRerouted ? 'YES' : 'NO'}
                    </Text>
                    <Text style={styles.analyticsLabel}>Reroute Count:</Text>
                    <Text style={styles.analyticsValue}>{tripData?.rerouteCount || 0}</Text>
                  </View>
                </View>

                <View style={styles.summaryRow}>
                  <MaterialIcons name="background" size={20} color="#95a5a6" />
                  <View style={styles.analyticsCompare}>
                    <Text style={styles.analyticsLabel}>Background Tracking:</Text>
                    <Text style={[styles.analyticsValue, { color: tripData?.wasInBackground ? '#f39c12' : '#27ae60' }]}>
                      {tripData?.wasInBackground ? 'YES' : 'NO'}
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* Motor Information */}
            {selectedMotor && (
              <View style={styles.summarySection}>
                <Text style={styles.sectionTitle}>Motor Information</Text>

                <View style={styles.summaryRow}>
                  <MaterialIcons name="two-wheeler" size={20} color="#1abc9c" />
                  <View style={styles.analyticsCompare}>
                    <Text style={styles.analyticsLabel}>Motor:</Text>
                    <Text style={styles.analyticsValue}>{selectedMotor.nickname || selectedMotor.name || "--"}</Text>
                    <Text style={styles.analyticsLabel}>Current Fuel Level:</Text>
                    <Text style={styles.analyticsValue}>{Math.round(selectedMotor.currentFuelLevel) || "--"}%</Text>
                    
                  </View>
                </View>
              </View>
            )}

            {/* Analytics Notes */}
            {tripData?.analyticsNotes && (
              <View style={styles.summarySection}>
                <Text style={styles.sectionTitle}>Analytics Notes</Text>
                <View style={styles.summaryRow}>
                  <MaterialIcons name="note" size={20} color="#9b59b6" />
                  <Text style={styles.summaryText}>{tripData.analyticsNotes}</Text>
                </View>
              </View>
            )}

            {/* Maintenance Actions During Trip */}
            {tripMaintenanceActions.length > 0 && (
              <View style={styles.summarySection}>
                <Text style={styles.sectionTitle}>Maintenance During Trip</Text>
                
                {tripMaintenanceActions.map((action, index) => (
                  <View key={index} style={styles.maintenanceRow}>
                    <MaterialIcons 
                      name={action.type === 'refuel' ? 'local-gas-station' : action.type === 'oil_change' ? 'opacity' : 'build'} 
                      size={20} 
                      color="#FF9800" 
                    />
                    <View style={styles.maintenanceDetails}>
                      <Text style={styles.maintenanceType}>
                        {action.type.replace('_', ' ').toUpperCase()}
                      </Text>
                      <Text style={styles.maintenanceInfo}>
                        Cost: ₱{action.cost} 
                        {action.quantity && ` • Quantity: ${action.quantity.toFixed(2)}L`}
                        {action.notes && ` • Notes: ${action.notes}`}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              onPress={handleSave}
              style={[styles.closeSummaryButton, showCancelButton && styles.buttonWithCancel]}
            >
              <LinearGradient
                colors={['#00ADB5', '#00858B']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.closeSummaryGradient}
              >
                <Text style={styles.closeSummaryText}>Save Trip</Text>
              </LinearGradient>
            </TouchableOpacity>

            {showCancelButton && (
              <TouchableOpacity
                onPress={handleCancel}
                style={[styles.cancelButton, styles.buttonWithCancel]}
              >
                <LinearGradient
                  colors={['#e74c3c', '#c0392b']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.cancelGradient}
                >
                  <Text style={styles.cancelText}>Cancel Trip</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}, areTripSummaryPropsEqual);

const styles = StyleSheet.create({
  // Summary Modal Styles
  summaryModalContainer: {
    flex: 1,
    bottom: 10,
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

  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },

  buttonContainer: {
    flexDirection: 'row',
    margin: 16,
    gap: 12,
  },
  closeSummaryButton: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  buttonWithCancel: {
    flex: 1,
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
  cancelButton: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  cancelGradient: {
    padding: 16,
    alignItems: 'center',
  },
  cancelText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  
  // Maintenance styles
  maintenanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF8E1',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
  },
  maintenanceDetails: {
    marginLeft: 12,
    flex: 1,
  },
  maintenanceType: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FF9800',
    textTransform: 'uppercase',
  },
  maintenanceInfo: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
});

TripSummaryModal.displayName = 'TripSummaryModal';
