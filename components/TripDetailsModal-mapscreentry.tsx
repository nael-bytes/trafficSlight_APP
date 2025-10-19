import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import MaterialIcons from "react-native-vector-icons/MaterialIcons";
import { LinearGradient } from 'expo-linear-gradient';
import type { RouteData, Motor } from '../types';

interface TripDetailsModalProps {
  visible: boolean;
  onClose: () => void;
  currentSpeed: number;
  distanceRemaining: number;
  timeElapsed: number;
  currentEta: string | null;
  currentFuel: number;
  currentFuelUsed: number;
  isOverSpeedLimit: boolean;
  selectedRoute: RouteData | null;
  selectedMotor: Motor | null;
  distanceTraveled: number;
}

export const TripDetailsModal: React.FC<TripDetailsModalProps> = ({
  visible,
  onClose,
  currentSpeed,
  distanceRemaining,
  timeElapsed,
  currentEta,
  currentFuel,
  currentFuelUsed,
  isOverSpeedLimit,
  selectedRoute,
  selectedMotor,
  distanceTraveled,
}) => {
  const [tick, setTick] = useState(0);

  // Timer to trigger re-render every second
  useEffect(() => {
    if (!visible) return;
    
    let animationFrameId: number;
    let lastTime = 0;
    
    const updateTick = (currentTime: number) => {
      if (currentTime - lastTime >= 1000) { // Update every 1 second
        setTick(prev => prev + 1);
        lastTime = currentTime;
      }
      animationFrameId = requestAnimationFrame(updateTick);
    };
    
    animationFrameId = requestAnimationFrame(updateTick);
    
    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [visible]);

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const lowFuel = currentFuel < 20;
  const needsOilChange = selectedMotor?.oilChangeDue ?? false;
  const needsMaintenance = selectedMotor?.maintenanceDue ?? false;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.tripDetailsModal}>
          <LinearGradient
            colors={['#00ADB5', '#00858B']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.tripDetailsHeader}
          >
            <Text style={styles.tripDetailsTitle}>Trip Details</Text>
            <TouchableOpacity onPress={onClose}>
              <MaterialIcons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </LinearGradient>

          <ScrollView
            style={styles.tripDetailsContent}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 20 }}
          >
            {/* Current Stats Section */}
            <View style={styles.detailsSection}>
              <Text style={styles.sectionTitle}>Current Stats</Text>

              {/* Fuel Level - Enhanced Display */}
              <View style={[styles.fuelItem, lowFuel && styles.fuelItemWarning]}>
                <MaterialIcons name="local-gas-station" size={24} color={lowFuel ? "#e74c3c" : "#FF9800"} />
                <View style={styles.fuelTextContainer}>
                  <Text style={styles.fuelLabel}>Fuel Level</Text>
                  <Text style={[styles.fuelValue, lowFuel && styles.fuelValueWarning]}>
                    {Math.round(currentFuel)}%
                    {lowFuel && " ⚠️ Low Fuel"}
                  </Text>
                </View>
              </View>

              {/* Distance Traveled */}
              <View style={styles.detailRow}>
                <MaterialIcons name="directions-bike" size={24} color="#00ADB5" />
                <View style={styles.detailTextContainer}>
                  <Text style={styles.detailLabel}>Distance Traveled</Text>
                  <Text style={styles.detailValue}>
                    {distanceTraveled.toFixed(2)} km
                  </Text>
                </View>
              </View>

              {/* Current Distance */}
              <View style={styles.detailRow}>
                <MaterialIcons name="straighten" size={24} color="#00ADB5" />
                <View style={styles.detailTextContainer}>
                  <Text style={styles.detailLabel}>Distance Remaining</Text>
                  <Text style={styles.detailValue}>{(distanceRemaining / 1000).toFixed(2)} km</Text>
                </View>
              </View>

              {/* Time */}
              <View style={styles.detailRow}>
                <MaterialIcons name="timer" size={24} color="#00ADB5" />
                <View style={styles.detailTextContainer}>
                  <Text style={styles.detailLabel}>Time Elapsed</Text>
                  <Text style={styles.detailValue}>{formatTime(timeElapsed)}</Text>
                </View>
              </View>

              {/* Current ETA */}
              <View style={styles.detailRow}>
                <MaterialIcons name="schedule" size={24} color="#00ADB5" />
                <View style={styles.detailTextContainer}>
                  <Text style={styles.detailLabel}>Current ETA</Text>
                  <Text style={styles.detailValue}>{currentEta || 'Calculating...'}</Text>
                </View>
              </View>
            </View>

            {/* Motor Analytics Section */}
            <View style={styles.detailsSection}>
              <Text style={styles.sectionTitle}>Motor Analytics</Text>

              {/* Oil Change */}
              <View style={[styles.detailRow, needsOilChange && styles.warningRow]}>
                <MaterialIcons name="build" size={24} color={needsOilChange ? "#e74c3c" : "#00ADB5"} />
                <View style={styles.detailTextContainer}>
                  <Text style={styles.detailLabel}>Oil Change</Text>
                  <Text style={[styles.detailValue, needsOilChange && styles.warningText]}>
                    {needsOilChange ? "Due" : "Up to Date"}
                    {needsOilChange && " ⚠️ Oil Change Due"}
                  </Text>
                </View>
              </View>

              {/* Maintenance */}
              <View style={[styles.detailRow, needsMaintenance && styles.warningRow]}>
                <MaterialIcons name="build" size={24} color={needsMaintenance ? "#e74c3c" : "#00ADB5"} />
                <View style={styles.detailTextContainer}>
                  <Text style={styles.detailLabel}>Maintenance</Text>
                  <Text style={[styles.detailValue, needsMaintenance && styles.warningText]}>
                    {needsMaintenance ? "Due" : "Up to Date"}
                    {needsMaintenance && " ⚠️ Maintenance Due"}
                  </Text>
                </View>
              </View>

              {/* Total Distance */}
              <View style={styles.detailRow}>
                <MaterialIcons name="directions-bike" size={24} color="#00ADB5" />
                <View style={styles.detailTextContainer}>
                  <Text style={styles.detailLabel}>Total Distance Traveled</Text>
                  <Text style={styles.detailValue}>
                    {selectedMotor ? (selectedMotor.totalDistance).toFixed(2) : '--'} km
                  </Text>
                </View>
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tripDetailsModal: {
    backgroundColor: '#fff',
    borderRadius: 12,
    width: '90%',
    maxWidth: 400,
    maxHeight: '80%',
  },
  tripDetailsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  tripDetailsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  tripDetailsContent: {
    padding: 20,
  },
  detailsSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    marginBottom: 8,
  },
  fuelItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    marginBottom: 8,
  },
  fuelItemWarning: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  fuelTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  fuelLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  fuelValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  fuelValueWarning: {
    color: '#e74c3c',
  },
  detailTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  warningRow: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  warningText: {
    color: '#e74c3c',
  },
});
