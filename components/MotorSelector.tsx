// Motor selector component

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  FlatList,
  StyleSheet,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import type { Motor } from '../types';

interface MotorSelectorProps {
  visible: boolean;
  motors: Motor[];
  selectedMotor: Motor | null;
  isTracking: boolean;
  onClose: () => void;
  onSelectMotor: (motor: Motor) => void;
  currentTripDistance?: number; // Add current trip distance
}

export const MotorSelector: React.FC<MotorSelectorProps> = ({
  visible,
  motors,
  selectedMotor,
  isTracking,
  onClose,
  onSelectMotor,
  currentTripDistance = 0,
}) => {
  const renderMotorItem = ({ item }: { item: Motor }) => (
    <TouchableOpacity
      style={styles.motorItem}
      onPress={() => {
        onSelectMotor(item);
        onClose();
      }}
    >
      <View style={styles.motorInfo}>
        <Text style={styles.motorName}>{item.nickname || item.name}</Text>
        <Text style={styles.motorDetails}>{item.name}</Text>
        <Text style={styles.motorDetails}>
          {item.engineDisplacement}cc • {item.fuelEfficiency} km/L
        </Text>
      </View>
      <View style={styles.fuelInfo}>
        <Text style={styles.fuelLevel}>{item.currentFuelLevel.toFixed(0)}%</Text>
        <MaterialIcons name="local-gas-station" size={40} color="#FF6B6B" />
      </View>
    </TouchableOpacity>
  );

  const renderTrackingView = () => (
    <View style={styles.trackingView}>
      <Text style={styles.title}>{selectedMotor?.nickname}</Text>
      
      <View style={styles.trackingStats}>
        <View style={styles.fuelRow}>
          <MaterialIcons name="local-gas-station" size={24} color="#FF6B6B" />
          <Text style={styles.fuelText}>
            FUEL LEVEL: {selectedMotor?.currentFuelLevel.toFixed(0)}%
          </Text>
        </View>

        <View style={styles.distanceRow}>
          <MaterialIcons name="moving" size={24} color="#4CAF50" />
          <Text style={styles.distanceText}>
            CURRENT TRIP: {currentTripDistance.toFixed(2)} km
          </Text>
        </View>

        <View style={styles.statsRow}>
          <MaterialIcons name="analytics" size={24} color="#2196F3" />
          <Text style={styles.statsText}>
            LIFETIME TOTAL: {(selectedMotor?.analytics.totalDistance + currentTripDistance).toFixed(2)} km
          </Text>
        </View>

        <View style={styles.statsRow}>
          <MaterialIcons name="flag" size={24} color="#FF9800" />
          <Text style={styles.statsText}>
            TRIPS COMPLETED: {selectedMotor?.analytics.tripsCompleted}
          </Text>
        </View>

        {/* Maintenance Indicator */}
        {selectedMotor?.analytics?.maintenanceAlerts && selectedMotor.analytics.maintenanceAlerts.length > 0 && (
          <View style={styles.maintenanceRow}>
            <MaterialIcons name="build" size={24} color="#E74C3C" />
            <Text style={styles.maintenanceText}>
              MAINTENANCE ALERTS: {selectedMotor.analytics.maintenanceAlerts.length}
            </Text>
          </View>
        )}

      </View>

      <TouchableOpacity style={styles.closeButton} onPress={onClose}>
        <Text style={styles.closeButtonText}>Close</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          {isTracking ? renderTrackingView() : (
            <View>
              <Text style={styles.title}>Select a Motor</Text>
              
              <FlatList
                data={motors}
                keyExtractor={(item) => item._id}
                renderItem={renderMotorItem}
                style={styles.motorList}
                showsVerticalScrollIndicator={false}
              />

              <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                <Text style={styles.closeButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modal: {
    width: '90%',
    maxHeight: '80%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
    color: '#333',
  },
  motorList: {
    maxHeight: 400,
  },
  motorItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  motorInfo: {
    flex: 1,
  },
  motorName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  motorDetails: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  fuelInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fuelLevel: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  trackingView: {
    alignItems: 'center',
  },
  trackingStats: {
    width: '100%',
    marginVertical: 20,
  },
  fuelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFF3E0',
    borderRadius: 8,
  },
  fuelText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
    color: '#333',
  },
  distanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#E8F5E8',
    borderRadius: 8,
  },
  distanceText: {
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 8,
    color: '#333',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#F5F5F5',
    borderRadius: 6,
    marginTop: 8,
  },
  statsText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
    color: '#666',
  },
  closeButton: {
    marginTop: 20,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: '#ddd',
    borderRadius: 8,
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  maintenanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFEBEE',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E74C3C',
    marginTop: 8,
  },
  maintenanceText: {
    color: '#E74C3C',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 8,
  },
});
