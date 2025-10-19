import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import MaterialIcons from "react-native-vector-icons/MaterialIcons";
import { LinearGradient } from 'expo-linear-gradient';
import type { TripCacheData } from '../utils/tripCacheManager';

interface TripRecoveryModalProps {
  visible: boolean;
  tripData: TripCacheData | null;
  onRecover: () => void;
  onDiscard: () => void;
  onClose: () => void;
}

export const TripRecoveryModal: React.FC<TripRecoveryModalProps> = ({
  visible,
  tripData,
  onRecover,
  onDiscard,
  onClose,
}) => {
  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDistance = (distance: number) => {
    return `${distance.toFixed(2)} km`;
  };

  const formatSpeed = (speed: number) => {
    return `${speed.toFixed(1)} km/h`;
  };

  if (!tripData) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <LinearGradient
            colors={['#FF6B6B', '#FF8E8E']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.headerGradient}
          >
            <View style={styles.headerContent}>
              <MaterialIcons name="warning" size={24} color="#fff" />
              <Text style={styles.headerTitle}>Trip Recovery</Text>
              <TouchableOpacity onPress={onClose}>
                <MaterialIcons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
          </LinearGradient>

          <ScrollView style={styles.content}>
            <View style={styles.messageContainer}>
              <Text style={styles.messageText}>
                We detected an incomplete trip from your previous session. Would you like to recover it?
              </Text>
            </View>

            <View style={styles.tripInfoContainer}>
              <Text style={styles.sectionTitle}>Trip Details</Text>
              
              <View style={styles.infoRow}>
                <MaterialIcons name="schedule" size={20} color="#666" />
                <View style={styles.infoTextContainer}>
                  <Text style={styles.infoLabel}>Started</Text>
                  <Text style={styles.infoValue}>
                    {formatTime(tripData.startTime)}
                  </Text>
                </View>
              </View>

              <View style={styles.infoRow}>
                <MaterialIcons name="update" size={20} color="#666" />
                <View style={styles.infoTextContainer}>
                  <Text style={styles.infoLabel}>Last Updated</Text>
                  <Text style={styles.infoValue}>
                    {formatTime(tripData.lastUpdateTime)}
                  </Text>
                </View>
              </View>

              <View style={styles.infoRow}>
                <MaterialIcons name="directions-bike" size={20} color="#666" />
                <View style={styles.infoTextContainer}>
                  <Text style={styles.infoLabel}>Motor</Text>
                  <Text style={styles.infoValue}>
                    {tripData.selectedMotor?.nickname || 'Unknown'}
                  </Text>
                </View>
              </View>

              <View style={styles.infoRow}>
                <MaterialIcons name="straighten" size={20} color="#666" />
                <View style={styles.infoTextContainer}>
                  <Text style={styles.infoLabel}>Distance</Text>
                  <Text style={styles.infoValue}>
                    {formatDistance(tripData.rideStats.distance)}
                  </Text>
                </View>
              </View>

              <View style={styles.infoRow}>
                <MaterialIcons name="timer" size={20} color="#666" />
                <View style={styles.infoTextContainer}>
                  <Text style={styles.infoLabel}>Duration</Text>
                  <Text style={styles.infoValue}>
                    {formatDuration(tripData.rideStats.duration)}
                  </Text>
                </View>
              </View>

              <View style={styles.infoRow}>
                <MaterialIcons name="speed" size={20} color="#666" />
                <View style={styles.infoTextContainer}>
                  <Text style={styles.infoLabel}>Average Speed</Text>
                  <Text style={styles.infoValue}>
                    {formatSpeed(tripData.rideStats.avgSpeed)}
                  </Text>
                </View>
              </View>

              {tripData.tripMaintenanceActions.length > 0 && (
                <View style={styles.infoRow}>
                  <MaterialIcons name="build" size={20} color="#666" />
                  <View style={styles.infoTextContainer}>
                    <Text style={styles.infoLabel}>Maintenance Actions</Text>
                    <Text style={styles.infoValue}>
                      {tripData.tripMaintenanceActions.length} recorded
                    </Text>
                  </View>
                </View>
              )}

              <View style={styles.infoRow}>
                <MaterialIcons name="place" size={20} color="#666" />
                <View style={styles.infoTextContainer}>
                  <Text style={styles.infoLabel}>Status</Text>
                  <Text style={[
                    styles.infoValue,
                    tripData.isTracking ? styles.trackingStatus : styles.stoppedStatus
                  ]}>
                    {tripData.isTracking ? 'In Progress' : 'Stopped'}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.warningContainer}>
              <MaterialIcons name="info" size={20} color="#FF6B6B" />
              <Text style={styles.warningText}>
                If you choose to recover, your trip will continue from where it left off. 
                If you choose to discard, all trip data will be lost.
              </Text>
            </View>
          </ScrollView>

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.discardButton]}
              onPress={onDiscard}
            >
              <MaterialIcons name="delete" size={20} color="#fff" />
              <Text style={styles.buttonText}>Discard Trip</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.recoverButton]}
              onPress={onRecover}
            >
              <MaterialIcons name="restore" size={20} color="#fff" />
              <Text style={styles.buttonText}>Recover Trip</Text>
            </TouchableOpacity>
          </View>
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
  modalContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    width: '90%',
    maxWidth: 400,
    maxHeight: '80%',
  },
  headerGradient: {
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
    textAlign: 'center',
  },
  content: {
    padding: 20,
  },
  messageContainer: {
    backgroundColor: '#FFF3CD',
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#FFC107',
  },
  messageText: {
    fontSize: 16,
    color: '#856404',
    lineHeight: 22,
  },
  tripInfoContainer: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    marginBottom: 8,
  },
  infoTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  infoLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  trackingStatus: {
    color: '#28a745',
  },
  stoppedStatus: {
    color: '#6c757d',
  },
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F8D7DA',
    padding: 16,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#DC3545',
  },
  warningText: {
    fontSize: 14,
    color: '#721C24',
    lineHeight: 20,
    marginLeft: 8,
    flex: 1,
  },
  buttonContainer: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 8,
  },
  discardButton: {
    backgroundColor: '#DC3545',
  },
  recoverButton: {
    backgroundColor: '#28a745',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
