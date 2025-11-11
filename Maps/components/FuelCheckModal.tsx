/**
 * Fuel Check Modal Component
 * Displays fuel level confirmation with slider and low fuel warnings
 */

import React, { useState, useEffect, useRef } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import Slider from '@react-native-community/slider';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

const { width } = Dimensions.get('window');

interface FuelCheckModalProps {
  visible: boolean;
  fuelCheckStep: 'confirmation' | 'low_fuel' | null;
  pendingFuelLevel: number | null;
  currentFuelLevel?: number; // Current fuel level of selected motor
  onConfirm: (fuelLevel?: number) => void | Promise<void>;
  onLowFuelContinue: () => void | Promise<void>;
  onCancel: () => void;
}

export const FuelCheckModal: React.FC<FuelCheckModalProps> = ({
  visible,
  fuelCheckStep,
  pendingFuelLevel,
  currentFuelLevel,
  onConfirm,
  onLowFuelContinue,
  onCancel,
}) => {
  // Use currentFuelLevel if provided, otherwise fall back to pendingFuelLevel
  const initialFuelLevel = currentFuelLevel !== undefined ? currentFuelLevel : (pendingFuelLevel || 0);
  const [sliderValue, setSliderValue] = useState<number>(initialFuelLevel);
  const hasUserAdjustedRef = useRef<boolean>(false);

  // Reset slider to current fuel level ONLY when modal first opens (not on every visibility change)
  useEffect(() => {
    if (visible && fuelCheckStep === 'confirmation' && !hasUserAdjustedRef.current) {
      const fuelLevel = currentFuelLevel !== undefined ? currentFuelLevel : (pendingFuelLevel || 0);
      setSliderValue(fuelLevel);
    }
  }, [visible, fuelCheckStep, currentFuelLevel, pendingFuelLevel]);

  // Reset adjustment flag when modal closes
  useEffect(() => {
    if (!visible) {
      hasUserAdjustedRef.current = false;
    }
  }, [visible]);

  // Get color based on fuel level
  const getFuelColor = (level: number): string => {
    if (level <= 20) return '#FF5722'; // Red for low fuel
    if (level <= 50) return '#FF9800'; // Orange for medium fuel
    return '#4CAF50'; // Green for high fuel
  };

  // Get fuel level label
  const getFuelLabel = (level: number): string => {
    if (level <= 20) return 'Low';
    if (level <= 50) return 'Medium';
    return 'Full';
  };

  const handleConfirm = () => {
    onConfirm(sliderValue);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onCancel}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>
            {fuelCheckStep === 'confirmation' ? 'Confirm Fuel Level' : 'Low Fuel Warning'}
          </Text>
          
          {fuelCheckStep === 'confirmation' && (
            <View style={styles.fuelCheckContent}>
              {/* Gas Icon */}
              <View style={styles.iconContainer}>
                <MaterialIcons 
                  name="local-gas-station" 
                  size={64} 
                  color={getFuelColor(sliderValue)} 
                />
              </View>

              {/* Fuel Level Display */}
              <View style={styles.fuelLevelDisplay}>
                <Text style={[styles.fuelLevelValue, { color: getFuelColor(sliderValue) }]}>
                  {sliderValue.toFixed(0)}%
                </Text>
                <Text style={[styles.fuelLevelLabel, { color: getFuelColor(sliderValue) }]}>
                  {getFuelLabel(sliderValue)} Fuel
                </Text>
              </View>

              {/* Slider */}
              <View style={styles.sliderContainer}>
                <Slider
                  style={styles.slider}
                  minimumValue={0}
                  maximumValue={100}
                  value={sliderValue}
                  onValueChange={(value) => {
                    setSliderValue(value);
                    hasUserAdjustedRef.current = true; // Mark that user has adjusted the slider
                  }}
                  onSlidingComplete={(value) => {
                    // Smooth completion - ensure value is set
                    setSliderValue(value);
                    hasUserAdjustedRef.current = true; // Mark that user has adjusted the slider
                  }}
                  minimumTrackTintColor={getFuelColor(sliderValue)}
                  maximumTrackTintColor="#E0E0E0"
                  thumbTintColor={getFuelColor(sliderValue)}
                  step={0.5}
                  animateTransitions={true}
                />
                <View style={styles.sliderLabels}>
                  <Text style={styles.sliderLabel}>0%</Text>
                  <Text style={styles.sliderLabel}>50%</Text>
                  <Text style={styles.sliderLabel}>100%</Text>
                </View>
              </View>

              {/* Buttons */}
              <View style={styles.fuelCheckButtons}>
                <TouchableOpacity
                  style={[styles.fuelCheckButton, styles.fuelCheckButtonCancel]}
                  onPress={onCancel}
                >
                  <Text style={styles.fuelCheckButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.fuelCheckButton, { backgroundColor: getFuelColor(sliderValue) }]}
                  onPress={handleConfirm}
                >
                  <Text style={styles.fuelCheckButtonText}>Confirm</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          
          {fuelCheckStep === 'low_fuel' && (
            <View style={styles.fuelCheckContent}>
              {/* Gas Icon with Warning */}
              <View style={styles.iconContainer}>
                <MaterialIcons 
                  name="local-gas-station" 
                  size={64} 
                  color="#FF5722" 
                />
                <MaterialIcons 
                  name="warning" 
                  size={32} 
                  color="#FF9800" 
                  style={styles.warningIcon}
                />
              </View>

              <Text style={styles.lowFuelText}>
                Low fuel detected!
              </Text>
              <Text style={styles.lowFuelSubtext}>
                Current level: {pendingFuelLevel?.toFixed(1)}%
              </Text>
              <Text style={styles.lowFuelWarning}>
                Consider refueling before starting your trip.
              </Text>

              <View style={styles.fuelCheckButtons}>
                <TouchableOpacity
                  style={[styles.fuelCheckButton, styles.fuelCheckButtonCancel]}
                  onPress={onCancel}
                >
                  <Text style={styles.fuelCheckButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.fuelCheckButton, styles.fuelCheckButtonConfirm]}
                  onPress={onLowFuelContinue}
                >
                  <Text style={styles.fuelCheckButtonText}>Continue Anyway</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
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
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    width: '85%',
    maxWidth: 400,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 24,
    color: '#333',
  },
  fuelCheckContent: {
    width: '100%',
    alignItems: 'center',
  },
  iconContainer: {
    position: 'relative',
    marginBottom: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  warningIcon: {
    position: 'absolute',
    top: -8,
    right: -8,
  },
  fuelLevelDisplay: {
    alignItems: 'center',
    marginBottom: 24,
  },
  fuelLevelValue: {
    fontSize: 48,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  fuelLevelLabel: {
    fontSize: 18,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  sliderContainer: {
    width: '100%',
    marginBottom: 32,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 8,
  },
  sliderLabel: {
    fontSize: 12,
    color: '#666',
  },
  fuelCheckButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    gap: 12,
  },
  fuelCheckButton: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  fuelCheckButtonConfirm: {
    backgroundColor: '#00ADB5',
  },
  fuelCheckButtonCancel: {
    backgroundColor: '#ccc',
  },
  fuelCheckButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  lowFuelText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FF5722',
    marginBottom: 8,
    textAlign: 'center',
  },
  lowFuelSubtext: {
    fontSize: 18,
    color: '#666',
    marginBottom: 12,
    textAlign: 'center',
  },
  lowFuelWarning: {
    fontSize: 14,
    color: '#999',
    marginBottom: 24,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

