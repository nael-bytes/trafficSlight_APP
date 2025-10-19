import React from 'react';
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

interface TripSummaryModalProps {
  visible: boolean;
  onClose: () => void;
  tripSummary: RouteData | null;
  selectedMotor: Motor | null;
  distanceTraveled: number;
  timeElapsed: number;
  fuelUsed: number;
  startAddress?: string;
  destinationAddress?: string;
}

export const TripSummaryModal: React.FC<TripSummaryModalProps> = ({
  visible,
  onClose,
  tripSummary,
  selectedMotor,
  distanceTraveled,
  timeElapsed,
  fuelUsed,
  startAddress,
  destinationAddress,
}) => {
  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Modal
      transparent
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.summaryModalContainer}>
        <View style={styles.summaryModal}>
          <LinearGradient
            colors={['#00ADB5', '#00858B']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.summaryHeaderGradient}
          >
            <Text style={styles.summaryTitle}>Trip Summary & Analytics</Text>
            <TouchableOpacity onPress={onClose}>
              <MaterialIcons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </LinearGradient>

          <ScrollView style={styles.summaryContent}>
            {/* Trip Overview */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Trip Overview</Text>
              
              <View style={styles.summaryRow}>
                <MaterialIcons name="place" size={20} color="#00ADB5" />
                <View style={styles.summaryTextContainer}>
                  <Text style={styles.summaryLabel}>From</Text>
                  <Text style={styles.summaryValue}>{startAddress || 'Starting point'}</Text>
                </View>
              </View>

              <View style={styles.summaryRow}>
                <MaterialIcons name="place" size={20} color="#00ADB5" />
                <View style={styles.summaryTextContainer}>
                  <Text style={styles.summaryLabel}>To</Text>
                  <Text style={styles.summaryValue}>{destinationAddress || 'Destination'}</Text>
                </View>
              </View>

              <View style={styles.summaryRow}>
                <MaterialIcons name="directions-bike" size={20} color="#00ADB5" />
                <View style={styles.summaryTextContainer}>
                  <Text style={styles.summaryLabel}>Distance Traveled</Text>
                  <Text style={styles.summaryValue}>{distanceTraveled.toFixed(2)} km</Text>
                </View>
              </View>

              <View style={styles.summaryRow}>
                <MaterialIcons name="timer" size={20} color="#00ADB5" />
                <View style={styles.summaryTextContainer}>
                  <Text style={styles.summaryLabel}>Total Time</Text>
                  <Text style={styles.summaryValue}>{formatTime(timeElapsed)}</Text>
                </View>
              </View>

              <View style={styles.summaryRow}>
                <MaterialIcons name="local-gas-station" size={20} color="#00ADB5" />
                <View style={styles.summaryTextContainer}>
                  <Text style={styles.summaryLabel}>Fuel Used</Text>
                  <Text style={styles.summaryValue}>{fuelUsed.toFixed(2)} L</Text>
                </View>
              </View>
            </View>

            {/* Route Comparison */}
            {tripSummary && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Route Comparison</Text>
                
                <View style={styles.comparisonContainer}>
                  <View style={styles.comparisonItem}>
                    <Text style={styles.comparisonLabel}>Planned Distance</Text>
                    <Text style={styles.comparisonValue}>
                      {(tripSummary.distance / 1000).toFixed(2)} km
                    </Text>
                  </View>
                  
                  <View style={styles.comparisonItem}>
                    <Text style={styles.comparisonLabel}>Actual Distance</Text>
                    <Text style={styles.comparisonValue}>
                      {distanceTraveled.toFixed(2)} km
                    </Text>
                  </View>
                  
                  <View style={styles.comparisonItem}>
                    <Text style={styles.comparisonLabel}>Efficiency</Text>
                    <Text style={[
                      styles.comparisonValue,
                      distanceTraveled <= (tripSummary.distance / 1000) ? styles.efficient : styles.inefficient
                    ]}>
                      {((tripSummary.distance / 1000) / distanceTraveled * 100).toFixed(1)}%
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* Motor Analytics */}
            {selectedMotor && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Motor Analytics</Text>
                
                <View style={styles.analyticsContainer}>
                  <View style={styles.analyticsItem}>
                    <Text style={styles.analyticsLabel}>Total Distance</Text>
                    <Text style={styles.analyticsValue}>
                      {selectedMotor.totalDistance.toFixed(2)} km
                    </Text>
                  </View>
                  
                  <View style={styles.analyticsItem}>
                    <Text style={styles.analyticsLabel}>Trips Completed</Text>
                    <Text style={styles.analyticsValue}>
                      {selectedMotor.analytics?.tripsCompleted || 0}
                    </Text>
                  </View>
                  
                  <View style={styles.analyticsItem}>
                    <Text style={styles.analyticsLabel}>Total Fuel Used</Text>
                    <Text style={styles.analyticsValue}>
                      {selectedMotor.analytics?.totalFuelUsed?.toFixed(2) || '0.00'} L
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* Action Buttons */}
            <View style={styles.actionButtons}>
              <TouchableOpacity style={styles.actionButton} onPress={onClose}>
                <MaterialIcons name="check" size={20} color="#fff" />
                <Text style={styles.actionButtonText}>Done</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  summaryModalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  summaryModal: {
    backgroundColor: '#fff',
    borderRadius: 12,
    width: '90%',
    maxWidth: 400,
    maxHeight: '80%',
  },
  summaryHeaderGradient: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  summaryContent: {
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    marginBottom: 8,
  },
  summaryTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  comparisonContainer: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 16,
  },
  comparisonItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  comparisonLabel: {
    fontSize: 14,
    color: '#666',
  },
  comparisonValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  efficient: {
    color: '#27ae60',
  },
  inefficient: {
    color: '#e74c3c',
  },
  analyticsContainer: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 16,
  },
  analyticsItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  analyticsLabel: {
    fontSize: 14,
    color: '#666',
  },
  analyticsValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },
  actionButton: {
    backgroundColor: '#00ADB5',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});
