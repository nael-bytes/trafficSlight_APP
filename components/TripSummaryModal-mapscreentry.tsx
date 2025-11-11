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
  onSave?: () => void;
  onCancel?: () => void;
  tripSummary: RouteData | null;
  selectedMotor: Motor | null;
  distanceTraveled: number;
  timeElapsed: number;
  fuelUsed: number;
  startAddress?: string;
  destinationAddress?: string;
  tripMaintenanceActions?: any[];
}

export const TripSummaryModal: React.FC<TripSummaryModalProps> = ({
  visible,
  onClose,
  onSave,
  onCancel,
  tripSummary,
  selectedMotor,
  distanceTraveled,
  timeElapsed,
  fuelUsed,
  startAddress,
  destinationAddress,
  tripMaintenanceActions = [],
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
                  <Text style={styles.summaryValue}>{(distanceTraveled || 0).toFixed(2)} km</Text>
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
                  <Text style={styles.summaryValue}>{(fuelUsed || 0).toFixed(2)} L</Text>
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
                      {((tripSummary?.distance || 0) / 1000).toFixed(2)} km
                    </Text>
                  </View>
                  
                  <View style={styles.comparisonItem}>
                    <Text style={styles.comparisonLabel}>Actual Distance</Text>
                    <Text style={styles.comparisonValue}>
                      {(distanceTraveled || 0).toFixed(2)} km
                    </Text>
                  </View>
                  
                  <View style={styles.comparisonItem}>
                    <Text style={styles.comparisonLabel}>Efficiency</Text>
                    <Text style={[
                      styles.comparisonValue,
                      distanceTraveled <= (tripSummary.distance / 1000) ? styles.efficient : styles.inefficient
                    ]}>
                      {(((tripSummary?.distance || 0) / 1000) / (distanceTraveled || 1) * 100).toFixed(1)}%
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
                      {(selectedMotor?.analytics?.totalDistance || 0).toFixed(2)} km
                    </Text>
                  </View>
                  
                  <View style={styles.analyticsItem}>
                    <Text style={styles.analyticsLabel}>Trips Completed</Text>
                    <Text style={styles.analyticsValue}>
                      {selectedMotor.analytics?.tripsCompleted || 0}
                    </Text>
                  </View>
                  
                  <View style={styles.analyticsItem}>
                    <Text style={styles.analyticsLabel}>Fuel Efficiency</Text>
                    <Text style={styles.analyticsValue}>
                      {(selectedMotor?.fuelEfficiency || 0).toFixed(2)} km/L
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* Maintenance Actions During Trip */}
            {tripMaintenanceActions.length > 0 && (
              <View style={styles.section}>
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

            {/* Action Buttons */}
            <View style={styles.actionButtons}>
              <TouchableOpacity 
                style={[styles.actionButton, styles.cancelButton]} 
                onPress={onCancel || onClose}
              >
                <MaterialIcons name="close" size={20} color="#fff" />
                <Text style={styles.actionButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.actionButton, styles.saveButton]} 
                onPress={onSave}
              >
                <MaterialIcons name="save" size={20} color="#fff" />
                <Text style={styles.actionButtonText}>Save Trip</Text>
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
    justifyContent: 'flex-start',
    alignItems: 'center',
    marginTop:10,
    paddingTop: 10,
  },
  summaryModal: {
    backgroundColor: '#fff',
    justifyContent: 'flex-start',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderRadius: 20,
    width: '90%',
    maxHeight: '80%',
    minHeight: '60%',
    
  },
  summaryHeaderGradient: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
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
    justifyContent: 'space-between',
    marginTop: 20,
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    flex: 1,
    justifyContent: 'center',
    marginHorizontal: 8,
    
  },
  cancelButton: {
    backgroundColor: '#e74c3c',
  },
  saveButton: {
    backgroundColor: '#00ADB5',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
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
