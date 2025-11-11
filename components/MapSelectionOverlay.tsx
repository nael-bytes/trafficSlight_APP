import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Alert,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

interface MapSelectionOverlayProps {
  visible: boolean;
  selectedLocation: {
    latitude: number;
    longitude: number;
    address?: string;
  } | null;
  onConfirm: () => void;
  onCancel: () => void;
  onClear: () => void;
}

const MapSelectionOverlay: React.FC<MapSelectionOverlayProps> = ({
  visible,
  selectedLocation,
  onConfirm,
  onCancel,
  onClear,
}) => {
  if (!visible) return null;

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      {/* Instructions */}
      <View style={styles.instructionsContainer} pointerEvents="box-none">
        <View style={styles.instructionsContent} pointerEvents="auto">
          <MaterialIcons name="touch-app" size={24} color="#00ADB5" />
          <Text style={styles.instructionsText}>
            Tap anywhere on the map to select a destination
          </Text>
        </View>
      </View>

      {/* Selected Location Info */}
      {selectedLocation && (
        <View style={styles.selectedLocationContainer} pointerEvents="box-none">
          <View style={styles.selectedLocationContent} pointerEvents="auto">
            <MaterialIcons name="place" size={20} color="#00ADB5" />
            <View style={styles.locationInfo}>
              <Text style={styles.locationAddress} numberOfLines={2}>
                {selectedLocation.address || 'Selected Location'}
              </Text>
              <Text style={styles.locationCoordinates}>
                {selectedLocation.latitude.toFixed(6)}, {selectedLocation.longitude.toFixed(6)}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.clearButton}
              onPress={onClear}
            >
              <MaterialIcons name="clear" size={20} color="#666" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Action Buttons */}
      <View style={styles.actionButtonsContainer} pointerEvents="box-none">
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={onCancel}
        >
          <MaterialIcons name="close" size={20} color="#666" />
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.confirmButton, !selectedLocation && styles.confirmButtonDisabled]}
          onPress={selectedLocation ? onConfirm : undefined}
          disabled={!selectedLocation}
        >
          <LinearGradient
            colors={selectedLocation ? ['#00ADB5', '#00858B'] : ['#ccc', '#999']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.confirmButtonGradient}
          >
            <MaterialIcons 
              name="check" 
              size={20} 
              color={selectedLocation ? "#fff" : "#666"} 
            />
            <Text style={[
              styles.confirmButtonText,
              !selectedLocation && styles.confirmButtonTextDisabled
            ]}>
              Confirm Location
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
    zIndex: 1000,
    justifyContent: 'space-between',
  },
  instructionsContainer: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
    zIndex: 1001,
  },
  instructionsContent: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  instructionsText: {
    marginLeft: 12,
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  selectedLocationContainer: {
    position: 'absolute',
    top: 120,
    left: 16,
    right: 16,
    zIndex: 1001,
  },
  selectedLocationContent: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  locationInfo: {
    flex: 1,
    marginLeft: 12,
  },
  locationAddress: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  locationCoordinates: {
    fontSize: 12,
    color: '#666',
  },
  clearButton: {
    padding: 4,
    marginLeft: 8,
  },
  actionButtonsContainer: {
    position: 'absolute',
    bottom: 100,
    left: 16,
    right: 16,
    flexDirection: 'row',
    gap: 12,
    zIndex: 1001,
  },
  cancelButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f5f5',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  cancelButtonText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  confirmButton: {
    flex: 2,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  confirmButtonDisabled: {
    elevation: 0,
    shadowOpacity: 0,
  },
  confirmButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  confirmButtonText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  confirmButtonTextDisabled: {
    color: '#666',
  },
});

export default MapSelectionOverlay;
