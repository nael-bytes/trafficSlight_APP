// Trip summary modal component

import React from 'react';
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
}

export const TripSummaryModal: React.FC<TripSummaryModalProps> = ({
  visible,
  rideStats,
  onClose,
  onSave,
  onCancel,
  selectedMotor,
  startAddress,
  endAddress,
}) => {
  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
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

  // Show cancel button if trip distance is less than 1 km
  const showCancelButton = rideStats.distance < 1.0;

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={[styles.summaryModalContainer, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
        <View style={[styles.summaryModal, { margin: 20 }]}>
          <LinearGradient
            colors={['#00ADB5', '#00858B']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.summaryHeaderGradient}
          >
            <Text style={[styles.summaryTitle, { color: '#fff' }]}>Trip Summary & Analytics</Text>
          </LinearGradient>

          <ScrollView style={styles.summaryContent}>
            {/* Route Information */}
            <View style={styles.summarySection}>
              <Text style={styles.sectionTitle}>Route Information</Text>

              <View style={styles.summaryRow}>
                <MaterialIcons name="my-location" size={20} color="#34495e" />
                <Text style={styles.summaryText}>From: {startAddress || "Unknown"}</Text>
              </View>

              <View style={styles.summaryRow}>
                <MaterialIcons name="place" size={20} color="#e74c3c" />
                <Text style={styles.summaryText}>To: {endAddress || "Unknown Location"}</Text>
              </View>
            </View>

            {/* Distance Analytics */}
            <View style={styles.summarySection}>
              <Text style={styles.sectionTitle}>Distance Analytics</Text>

              <View style={styles.summaryRow}>
                <MaterialIcons name="straighten" size={20} color="#3498db" />
                <View style={styles.analyticsCompare}>
                  <Text style={styles.analyticsLabel}>Actual Distance:</Text>
                  <Text style={styles.analyticsValue}>{rideStats.distance.toFixed(2)} km</Text>
                  <Text style={styles.analyticsLabel}>Route Type:</Text>
                  <Text style={styles.analyticsValue}>Free Drive</Text>
                </View>
              </View>
            </View>

            {/* Fuel Analytics */}
            <View style={styles.summarySection}>
              <Text style={styles.sectionTitle}>Fuel Analytics</Text>

              <View style={styles.summaryRow}>
                <MaterialIcons name="local-gas-station" size={20} color="#2ecc71" />
                <View style={styles.analyticsCompare}>
                  <Text style={styles.analyticsLabel}>Fuel Consumed:</Text>
                  <Text style={styles.analyticsValue}>{rideStats.fuelConsumed.toFixed(2)} L</Text>
                  <Text style={styles.analyticsLabel}>Efficiency:</Text>
                  <Text style={styles.analyticsValue}>{selectedMotor?.fuelEfficiency || "--"} km/L</Text>
                </View>
              </View>
            </View>

            {/* Time Analytics */}
            <View style={styles.summarySection}>
              <Text style={styles.sectionTitle}>Time Analytics</Text>

              <View style={styles.summaryRow}>
                <MaterialIcons name="schedule" size={20} color="#9b59b6" />
                <View style={styles.analyticsCompare}>
                  <Text style={styles.analyticsLabel}>Duration:</Text>
                  <Text style={styles.analyticsValue}>{Math.round(rideStats.duration / 60)} minutes</Text>
                  <Text style={styles.analyticsLabel}>Avg Speed:</Text>
                  <Text style={styles.analyticsValue}>{rideStats.avgSpeed.toFixed(1)} km/h</Text>
                </View>
              </View>
            </View>

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
                    <Text style={styles.analyticsLabel}>Total Distance Traveled:</Text>
                    <Text style={styles.analyticsValue}>{selectedMotor.analytics?.totalDistance?.toFixed(2) || "--"} km</Text>
                  </View>
                </View>
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
};

const styles = StyleSheet.create({
  // Summary Modal Styles
  summaryModalContainer: {
    flex: 1,
    bottom: 0,
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
});
