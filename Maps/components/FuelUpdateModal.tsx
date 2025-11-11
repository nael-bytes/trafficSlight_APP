/**
 * Fuel Update Modal Component
 * Allows users to update their fuel level using a slider
 */

import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, PanResponder } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface FuelUpdateModalProps {
  visible: boolean;
  currentFuelLevel: number;
  fuelUpdateValue: string;
  sliderTrackRef: React.RefObject<View>;
  sliderPanResponder: PanResponder.PanResponderInstance;
  sliderTrackLayoutRef: React.RefObject<{ x: number; width: number }>;
  onUpdate: () => void;
  onCancel: () => void;
}

export const FuelUpdateModal: React.FC<FuelUpdateModalProps> = ({
  visible,
  currentFuelLevel,
  fuelUpdateValue,
  sliderTrackRef,
  sliderPanResponder,
  sliderTrackLayoutRef,
  onUpdate,
  onCancel,
}) => {
  const fuelLevel = Math.min(100, Math.max(0, parseFloat(fuelUpdateValue) || 0));
  
  // Determine color based on fuel level
  let fillColor = '#4CAF50'; // Green (high fuel)
  let thumbColor = '#4CAF50';
  let valueColor = '#4CAF50';
  
  if (fuelLevel <= 20) {
    // Low fuel - Red (warning)
    fillColor = '#F44336';
    thumbColor = '#F44336';
    valueColor = '#F44336';
  } else if (fuelLevel <= 50) {
    // Medium fuel - Orange/Yellow (caution)
    fillColor = '#FF9800';
    thumbColor = '#FF9800';
    valueColor = '#FF9800';
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onCancel}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Update Fuel Level</Text>
          
          <View style={styles.fuelUpdateContent}>
            <Text style={styles.fuelUpdateText}>
              Current: {currentFuelLevel.toFixed(1)}%
            </Text>
            
            {/* Slider Container */}
            <View
              ref={sliderTrackRef}
              style={styles.sliderTrack}
              onLayout={(event) => {
                const { width } = event.nativeEvent.layout;
                // Get absolute position using measureInWindow
                sliderTrackRef.current?.measureInWindow((x, y, width, height) => {
                  if (sliderTrackLayoutRef.current) {
                    sliderTrackLayoutRef.current.x = x;
                    sliderTrackLayoutRef.current.width = width;
                  }
                });
              }}
            >
              <LinearGradient
                colors={fillColor === '#4CAF50' 
                  ? ['#66BB6A', '#4CAF50'] 
                  : fillColor === '#FF9800'
                  ? ['#FFB74D', '#FF9800']
                  : ['#EF5350', '#F44336']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[
                  styles.sliderFill,
                  { 
                    width: `${fuelLevel}%`,
                  }
                ]}
              />
              <View
                style={[
                  styles.sliderThumb,
                  {
                    left: `${fuelLevel}%`,
                    marginLeft: -12,
                    backgroundColor: thumbColor,
                  }
                ]}
                {...sliderPanResponder.panHandlers}
              >
                <View style={styles.sliderThumbInner} />
              </View>
            </View>
            
            {/* Value Display */}
            <View style={styles.sliderValueContainer}>
              <Text style={[styles.sliderValueText, { color: valueColor }]}>
                {Math.round(fuelLevel)}%
              </Text>
            </View>
            
            <View style={styles.fuelUpdateButtons}>
              <TouchableOpacity
                style={[styles.fuelUpdateButton, styles.fuelUpdateButtonCancel]}
                onPress={onCancel}
              >
                <Text style={styles.fuelUpdateButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.fuelUpdateButton, styles.fuelUpdateButtonSave]}
                onPress={onUpdate}
              >
                <Text style={styles.fuelUpdateButtonText}>Update</Text>
              </TouchableOpacity>
            </View>
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
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    width: '85%',
    maxWidth: 400,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#333',
  },
  fuelUpdateContent: {
    width: '100%',
    alignItems: 'center',
  },
  fuelUpdateText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 24,
  },
  sliderTrack: {
    width: '100%',
    height: 8,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    position: 'relative',
    marginBottom: 16,
  },
  sliderFill: {
    height: '100%',
    borderRadius: 4,
    position: 'absolute',
    left: 0,
    top: 0,
  },
  sliderThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#4CAF50',
    position: 'absolute',
    top: -8,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  sliderThumbInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#fff',
  },
  sliderValueContainer: {
    marginBottom: 24,
  },
  sliderValueText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  fuelUpdateButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    gap: 12,
  },
  fuelUpdateButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fuelUpdateButtonSave: {
    backgroundColor: '#00ADB5',
  },
  fuelUpdateButtonCancel: {
    backgroundColor: '#ccc',
  },
  fuelUpdateButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

