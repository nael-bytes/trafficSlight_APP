/**
 * Fuel Update Simulator Panel
 * 
 * UI component for testing fuel update API integration in development mode.
 * Allows simulation of trips without actual travel.
 */

import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { FuelUpdateSimulator, type SimulationState } from '../utils/fuelUpdateSimulator';
import type { Motor, LocationCoords } from '../../types';

interface FuelUpdateSimulatorPanelProps {
  visible: boolean;
  onClose: () => void;
  selectedMotor: Motor | null;
  currentLocation: LocationCoords | null;
  onFuelUpdate?: (fuelLevel: number, lowFuelWarning: boolean) => void;
}

export const FuelUpdateSimulatorPanel: React.FC<FuelUpdateSimulatorPanelProps> = ({
  visible,
  onClose,
  selectedMotor,
  currentLocation,
  onFuelUpdate,
}) => {
  const [isRunning, setIsRunning] = useState(false);
  const [simulationState, setSimulationState] = useState<SimulationState | null>(null);
  const [speed, setSpeed] = useState('50'); // km/h
  const [duration, setDuration] = useState('60'); // seconds
  const simulatorRef = useRef<FuelUpdateSimulator | null>(null);

  const handleStart = useCallback(() => {
    if (!selectedMotor?._id || !currentLocation) {
      Alert.alert('Error', 'Motor and location are required for simulation');
      return;
    }

    const speedNum = parseFloat(speed) || 50;
    const durationNum = parseFloat(duration) || 60;

    if (speedNum <= 0 || speedNum > 200) {
      Alert.alert('Error', 'Speed must be between 1 and 200 km/h');
      return;
    }

    if (durationNum <= 0 || durationNum > 600) {
      Alert.alert('Error', 'Duration must be between 1 and 600 seconds');
      return;
    }

    const simulator = new FuelUpdateSimulator({
      userMotorId: selectedMotor._id,
      selectedMotor,
      startLocation: currentLocation,
      speedKmh: speedNum,
      totalDuration: durationNum,
      onFuelUpdate: (fuelLevel, lowFuelWarning) => {
        setSimulationState(simulator.getState());
        if (onFuelUpdate) {
          onFuelUpdate(fuelLevel, lowFuelWarning);
        }
      },
      onDistanceUpdate: () => {
        setSimulationState(simulator.getState());
      },
      onApiResponse: () => {
        setSimulationState(simulator.getState());
      },
      onError: (error) => {
        console.error('[Simulator] Error:', error);
        Alert.alert('Simulation Error', error.message);
      },
    });

    simulatorRef.current = simulator;
    simulator.start();
    setIsRunning(true);
  }, [selectedMotor, currentLocation, speed, duration, onFuelUpdate]);

  const handleStop = useCallback(() => {
    if (simulatorRef.current) {
      simulatorRef.current.stop();
      simulatorRef.current = null;
    }
    setIsRunning(false);
    setSimulationState(null);
  }, []);

  const handleReset = useCallback(() => {
    if (simulatorRef.current) {
      simulatorRef.current.reset();
      simulatorRef.current = null;
    }
    setIsRunning(false);
    setSimulationState(null);
  }, []);

  if (!__DEV__) {
    // Only show in development mode
    return null;
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>Fuel Update Simulator</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <MaterialIcons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content}>
            {!selectedMotor || !currentLocation ? (
              <Text style={styles.errorText}>
                Motor and location are required for simulation
              </Text>
            ) : (
              <>
                {/* Configuration */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Configuration</Text>
                  
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Speed (km/h):</Text>
                    <TextInput
                      style={styles.input}
                      value={speed}
                      onChangeText={setSpeed}
                      keyboardType="numeric"
                      editable={!isRunning}
                      placeholder="50"
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Duration (seconds):</Text>
                    <TextInput
                      style={styles.input}
                      value={duration}
                      onChangeText={setDuration}
                      keyboardType="numeric"
                      editable={!isRunning}
                      placeholder="60"
                    />
                  </View>

                  <View style={styles.infoRow}>
                    <MaterialIcons name="info" size={16} color="#666" />
                    <Text style={styles.infoText}>
                      Simulates a trip at {speed} km/h for {duration} seconds
                    </Text>
                  </View>
                </View>

                {/* Current State */}
                {simulationState && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Simulation State</Text>
                    
                    <View style={styles.stateRow}>
                      <Text style={styles.stateLabel}>Distance Traveled:</Text>
                      <Text style={styles.stateValue}>
                        {simulationState.totalDistanceTraveled.toFixed(4)} km
                      </Text>
                    </View>

                    <View style={styles.stateRow}>
                      <Text style={styles.stateLabel}>Last Posted Distance:</Text>
                      <Text style={styles.stateValue}>
                        {simulationState.lastPostedDistance.toFixed(4)} km
                      </Text>
                    </View>

                    <View style={styles.stateRow}>
                      <Text style={styles.stateLabel}>Current Fuel Level:</Text>
                      <Text style={[styles.stateValue, simulationState.currentFuelLevel <= 10 && styles.lowFuel]}>
                        {simulationState.currentFuelLevel.toFixed(2)}%
                      </Text>
                    </View>

                    <View style={styles.stateRow}>
                      <Text style={styles.stateLabel}>Elapsed Time:</Text>
                      <Text style={styles.stateValue}>
                        {Math.floor(simulationState.elapsedTime)}s
                      </Text>
                    </View>

                    <View style={styles.stateRow}>
                      <Text style={styles.stateLabel}>API Calls:</Text>
                      <Text style={styles.stateValue}>
                        {simulationState.apiCallCount} (✅ {simulationState.successfulCalls} | ❌ {simulationState.failedCalls} | ⏭️ {simulationState.skippedCalls})
                      </Text>
                    </View>
                  </View>
                )}

                {/* Motor Info */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Motor Information</Text>
                  
                  <View style={styles.stateRow}>
                    <Text style={styles.stateLabel}>Motor:</Text>
                    <Text style={styles.stateValue}>
                      {selectedMotor.nickname || selectedMotor.name || 'Unknown'}
                    </Text>
                  </View>

                  <View style={styles.stateRow}>
                    <Text style={styles.stateLabel}>Fuel Tank:</Text>
                    <Text style={styles.stateValue}>
                      {selectedMotor.fuelTank || 0}L
                    </Text>
                  </View>

                  <View style={styles.stateRow}>
                    <Text style={styles.stateLabel}>Fuel Efficiency:</Text>
                    <Text style={styles.stateValue}>
                      {selectedMotor.fuelEfficiency || selectedMotor.fuelConsumption || 0} km/L
                    </Text>
                  </View>

                  <View style={styles.stateRow}>
                    <Text style={styles.stateLabel}>Current Fuel Level:</Text>
                    <Text style={styles.stateValue}>
                      {selectedMotor.currentFuelLevel?.toFixed(2) || 0}%
                    </Text>
                  </View>
                </View>
              </>
            )}
          </ScrollView>

          {/* Controls */}
          <View style={styles.controls}>
            {!isRunning ? (
              <TouchableOpacity
                style={[styles.button, styles.startButton]}
                onPress={handleStart}
                disabled={!selectedMotor || !currentLocation}
              >
                <MaterialIcons name="play-arrow" size={20} color="#FFF" />
                <Text style={styles.buttonText}>Start Simulation</Text>
              </TouchableOpacity>
            ) : (
              <>
                <TouchableOpacity
                  style={[styles.button, styles.stopButton]}
                  onPress={handleStop}
                >
                  <MaterialIcons name="stop" size={20} color="#FFF" />
                  <Text style={styles.buttonText}>Stop</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.button, styles.resetButton]}
                  onPress={handleReset}
                >
                  <MaterialIcons name="refresh" size={20} color="#FFF" />
                  <Text style={styles.buttonText}>Reset</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 5,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  inputGroup: {
    marginBottom: 15,
  },
  label: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  input: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#F9F9F9',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 8,
  },
  infoText: {
    fontSize: 12,
    color: '#666',
    flex: 1,
  },
  stateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  stateLabel: {
    fontSize: 14,
    color: '#666',
  },
  stateValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  lowFuel: {
    color: '#FF9800',
    fontWeight: 'bold',
  },
  errorText: {
    color: '#F44336',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 20,
  },
  controls: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    gap: 10,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 10,
    gap: 8,
  },
  startButton: {
    backgroundColor: '#4CAF50',
  },
  stopButton: {
    backgroundColor: '#F44336',
  },
  resetButton: {
    backgroundColor: '#FF9800',
  },
  buttonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

