import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import MaterialIcons from "react-native-vector-icons/MaterialIcons";
import { LinearGradient } from 'expo-linear-gradient';
import Speedometer from '../Screens/loggedIn/Speedometer';

interface NavigationControlsProps {
  isNavigating: boolean;
  currentSpeed: number;
  distanceRemaining: number;
  timeElapsed: number;
  currentEta: string | null;
  isOverSpeedLimit: boolean;
  onEndNavigation: () => void;
  onShowDetails: () => void;
  onMaintenanceAction: (type: 'refuel' | 'oil_change' | 'tune_up') => void;
}

export const NavigationControls: React.FC<NavigationControlsProps> = ({
  isNavigating,
  currentSpeed,
  distanceRemaining,
  timeElapsed,
  currentEta,
  isOverSpeedLimit,
  onEndNavigation,
  onShowDetails,
  onMaintenanceAction,
}) => {
  if (!isNavigating) return null;

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const handleEndNavigation = () => {
    Alert.alert(
      "End Navigation",
      "Are you sure you want to end navigation?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "End", style: "destructive", onPress: onEndNavigation },
      ]
    );
  };

  return (
    <View style={styles.navigationControls}>
      {/* Speedometer */}
      <View style={styles.speedometerContainer}>
        <Speedometer speed={currentSpeed} isOverSpeedLimit={isOverSpeedLimit} />
      </View>

      {/* Navigation Info */}
      <View style={styles.navigationInfo}>
        <View style={styles.infoRow}>
          <View style={styles.infoItem}>
            <MaterialIcons name="straighten" size={20} color="#00ADB5" />
            <Text style={styles.infoLabel}>Distance</Text>
            <Text style={styles.infoValue}>{(distanceRemaining / 1000).toFixed(1)} km</Text>
          </View>
          
          <View style={styles.infoItem}>
            <MaterialIcons name="schedule" size={20} color="#00ADB5" />
            <Text style={styles.infoLabel}>Time</Text>
            <Text style={styles.infoValue}>{formatTime(timeElapsed)}</Text>
          </View>
          
          {currentEta && (
            <View style={styles.infoItem}>
              <MaterialIcons name="access-time" size={20} color="#00ADB5" />
              <Text style={styles.infoLabel}>ETA</Text>
              <Text style={styles.infoValue}>{currentEta}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Control Buttons */}
      <View style={styles.controlButtons}>
        <TouchableOpacity
          style={styles.controlButton}
          onPress={() => onMaintenanceAction('refuel')}
        >
          <MaterialIcons name="local-gas-station" size={24} color="#fff" />
          <Text style={styles.controlButtonText}>Refuel</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.controlButton}
          onPress={() => onMaintenanceAction('oil_change')}
        >
          <MaterialIcons name="oil-barrel" size={24} color="#fff" />
          <Text style={styles.controlButtonText}>Oil</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.controlButton}
          onPress={onShowDetails}
        >
          <MaterialIcons name="info" size={24} color="#fff" />
          <Text style={styles.controlButtonText}>Details</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlButton, styles.endButton]}
          onPress={handleEndNavigation}
        >
          <MaterialIcons name="stop" size={24} color="#fff" />
          <Text style={styles.controlButtonText}>End</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  navigationControls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  speedometerContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  navigationInfo: {
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  infoItem: {
    alignItems: 'center',
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginTop: 2,
  },
  controlButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  controlButton: {
    backgroundColor: '#00ADB5',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    minWidth: 60,
  },
  endButton: {
    backgroundColor: '#e74c3c',
  },
  controlButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
});
