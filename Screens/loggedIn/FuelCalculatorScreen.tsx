import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Platform,
  Alert,
} from 'react-native';
import { useUser } from '../../AuthContext/UserContextImproved';
import axios from 'axios';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';

const API_BASE = 'https://ts-backend-1-jyit.onrender.com';

export default function FuelCalculatorScreen() {
  const navigation = useNavigation();
  const { user } = useUser();
  
  // Full Tank Method States
  const [prevOdometer, setPrevOdometer] = useState('');
  const [currOdometer, setCurrOdometer] = useState('');
  const [fuelAdded, setFuelAdded] = useState('');
  const [fuelPrice, setFuelPrice] = useState('');
  const [calculatedEfficiency, setCalculatedEfficiency] = useState(null);
  const [distanceTraveled, setDistanceTraveled] = useState(0);
  const [fuelCost, setFuelCost] = useState(0);
  const [costPerKm, setCostPerKm] = useState(0);
  
  // Motor selection for tracking
  const [motorList, setMotorList] = useState([]);
  const [selectedMotor, setSelectedMotor] = useState(null);
  const [isCalculated, setIsCalculated] = useState(false);

  useEffect(() => {
    const fetchMotors = async () => {
      try {
        const res = await axios.get(`${API_BASE}/api/user-motors/user/${user._id}`);
        setMotorList(res.data);
      } catch (err) {
        console.error('Failed to fetch motor list:', err.message);
      }
    };
    fetchMotors();
  }, [user]);

  // Full Tank Method Calculation
  const calculateFullTankEfficiency = () => {
    const prevOdo = parseFloat(prevOdometer);
    const currOdo = parseFloat(currOdometer);
    const fuel = parseFloat(fuelAdded);
    const price = parseFloat(fuelPrice);

    // Validation
    if (isNaN(prevOdo) || isNaN(currOdo) || isNaN(fuel) || isNaN(price)) {
      Alert.alert('Invalid Input', 'Please enter valid numbers for all fields.');
      return;
    }

    if (currOdo <= prevOdo) {
      Alert.alert('Invalid Odometer', 'Current odometer must be greater than previous odometer.');
      return;
    }

    if (fuel <= 0 || price <= 0) {
      Alert.alert('Invalid Values', 'Fuel added and price must be greater than zero.');
      return;
    }

    // Calculate distance traveled
    const distance = currOdo - prevOdo;
    setDistanceTraveled(distance);

    // Calculate fuel efficiency (km/L)
    const efficiency = distance / fuel;
    setCalculatedEfficiency(efficiency);

    // Calculate costs
    const totalCost = fuel * price;
    setFuelCost(totalCost);
    setCostPerKm(totalCost / distance);

    setIsCalculated(true);
  };

  // Reset calculation
  const resetCalculation = () => {
    setPrevOdometer('');
    setCurrOdometer('');
    setFuelAdded('');
    setFuelPrice('');
    setCalculatedEfficiency(null);
    setDistanceTraveled(0);
    setFuelCost(0);
    setCostPerKm(0);
    setIsCalculated(false);
  };

  // Check if all required fields are filled
  const isCalculationReady = () => {
    return prevOdometer && currOdometer && fuelAdded && fuelPrice;
  };

  // Update selected motor's fuel efficiency
  const updateMotorEfficiency = async () => {
    if (!selectedMotor || !calculatedEfficiency) {
      Alert.alert('No Motor Selected', 'Please select a motorcycle to update its efficiency.');
      return;
    }

    try {
      // Prepare the new efficiency record
      const newEfficiencyRecord = {
        date: new Date(),
        efficiency: calculatedEfficiency
      };

      // Get existing efficiency records or initialize empty array
      const existingRecords = selectedMotor.fuelEfficiencyRecords || [];
      
      // Add the new record to the existing records
      const updatedRecords = [...existingRecords, newEfficiencyRecord];

      console.log('[FuelCalculator] Updating motor efficiency:', {
        motorId: selectedMotor._id,
        newEfficiency: calculatedEfficiency,
        recordsCount: updatedRecords.length
      });

      const response = await axios.put(`${API_BASE}/api/user-motors/${selectedMotor._id}/updateEfficiency`, {
        fuelEfficiencyRecords: updatedRecords,
        currentFuelEfficiency: calculatedEfficiency
      });

      console.log('[FuelCalculator] API response:', {
        status: response.status,
        data: response.data
      });

      if (response.status === 200) {
        Alert.alert(
          'Success', 
          `Updated ${selectedMotor.nickname || selectedMotor.motorcycleData?.name || 'Motor'} efficiency to ${calculatedEfficiency.toFixed(2)} km/L`,
          [{ text: 'OK' }]
        );
        
        // Update local motor list with new efficiency data
        setMotorList(prev => 
          prev.map(motor => 
            motor._id === selectedMotor._id 
              ? { 
                  ...motor, 
                  fuelEfficiency: calculatedEfficiency,
                  currentFuelEfficiency: calculatedEfficiency,
                  fuelEfficiencyRecords: updatedRecords
                }
              : motor
          )
        );

        // Update the selected motor state as well
        setSelectedMotor(prev => ({
          ...prev,
          fuelEfficiency: calculatedEfficiency,
          currentFuelEfficiency: calculatedEfficiency,
          fuelEfficiencyRecords: updatedRecords
        }));
      }
    } catch (error) {
      console.error('Failed to update motor efficiency:', error);
      Alert.alert('Error', 'Failed to update motor efficiency. Please try again.');
    }
  };




  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#00ADB5" />
      
      {/* Header */}
      <View style={styles.header}>
        <LinearGradient
          colors={['#00ADB5', '#00C2CC']}
          style={styles.headerGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        >
          <View style={styles.headerContent}>
            <TouchableOpacity 
              onPress={() => navigation.goBack()}
              style={styles.backButton}
            >
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <View style={styles.headerTextContainer}>
              <Text style={styles.headerTitle}>Full Tank Method</Text>
              <Text style={styles.headerSubtitle}>Calculate real fuel efficiency</Text>
            </View>
          </View>
        </LinearGradient>
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        {/* Instructions Card */}
        <View style={styles.instructionCard}>
          <View style={styles.instructionHeader}>
            <Ionicons name="information-circle" size={24} color="#00ADB5" />
            <Text style={styles.instructionTitle}>How to Use Full Tank Method</Text>
          </View>
          <Text style={styles.instructionText}>
            1. Fill your tank completely and note the odometer reading{'\n'}
            2. Drive normally until you need to refuel{'\n'}
            3. Fill the tank completely again and note the new odometer reading{'\n'}
            4. Enter the data below to calculate your actual fuel efficiency
          </Text>
        </View>

        {/* Motor Selection */}
        <View style={styles.card}>
          <Text style={styles.label}>Select Motorcycle (Optional)</Text>
          {motorList.length === 0 && (
            <Text style={styles.warningText}>No motorcycles found. You can still calculate efficiency without selecting one.</Text>
          )}
          {motorList.map((motor, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.motorItem,
                selectedMotor?._id === motor._id ? styles.motorItemSelected : null,
              ]}
              onPress={() => setSelectedMotor(motor)}
            >
              <Text style={[
                styles.motorText,
                selectedMotor?._id === motor._id ? styles.motorTextSelected : null,
              ]}>
                {motor.nickname || motor.motorcycleData?.name || 'Unnamed Motor'} - {motor.currentFuelEfficiency || motor.fuelEfficiency || motor.fuelConsumption} km/L
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Full Tank Method Inputs */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Full Tank Method Data</Text>
          
          <Text style={styles.label}>Previous Odometer Reading (km)</Text>
          <TextInput
            style={styles.input}
            value={prevOdometer}
            onChangeText={setPrevOdometer}
            keyboardType="numeric"
            placeholder="e.g. 15000"
            placeholderTextColor="#999"
          />

          <Text style={styles.label}>Current Odometer Reading (km)</Text>
          <TextInput
            style={styles.input}
            value={currOdometer}
            onChangeText={setCurrOdometer}
            keyboardType="numeric"
            placeholder="e.g. 15250"
            placeholderTextColor="#999"
          />

          <Text style={styles.label}>Fuel Added (Liters)</Text>
          <TextInput
            style={styles.input}
            value={fuelAdded}
            onChangeText={setFuelAdded}
            keyboardType="numeric"
            placeholder="e.g. 5.5"
            placeholderTextColor="#999"
          />

          <Text style={styles.label}>Fuel Price per Liter (₱)</Text>
          <TextInput
            style={styles.input}
            value={fuelPrice}
            onChangeText={setFuelPrice}
            keyboardType="numeric"
            placeholder="e.g. 65.50"
            placeholderTextColor="#999"
          />

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, !isCalculationReady() && styles.buttonDisabled]}
              onPress={calculateFullTankEfficiency}
              disabled={!isCalculationReady()}
            >
              <LinearGradient
                colors={!isCalculationReady() ? ['#CCC', '#DDD'] : ['#00ADB5', '#00C2CC']}
                style={styles.buttonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Text style={styles.buttonText}>Calculate Efficiency</Text>
              </LinearGradient>
            </TouchableOpacity>

            {isCalculated && (
              <TouchableOpacity
                style={styles.resetButton}
                onPress={resetCalculation}
              >
                <Text style={styles.resetButtonText}>Reset</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Results */}
        {isCalculated && calculatedEfficiency && (
          <View style={styles.resultsCard}>
            <Text style={styles.resultsTitle}>Fuel Efficiency Results</Text>
            
            <View style={styles.resultRow}>
              <View style={styles.resultItem}>
                <Ionicons name="speedometer" size={20} color="#00ADB5" />
                <Text style={styles.resultLabel}>Fuel Efficiency</Text>
                <Text style={styles.resultValue}>{calculatedEfficiency.toFixed(2)} km/L</Text>
              </View>
            </View>

            <View style={styles.resultRow}>
              <View style={styles.resultItem}>
                <Ionicons name="location" size={20} color="#00ADB5" />
                <Text style={styles.resultLabel}>Distance Traveled</Text>
                <Text style={styles.resultValue}>{distanceTraveled.toFixed(0)} km</Text>
              </View>
            </View>

            <View style={styles.resultRow}>
              <View style={styles.resultItem}>
                <Text style={styles.currencyIcon}>₱</Text>
                <Text style={styles.resultLabel}>Total Fuel Cost</Text>
                <Text style={styles.resultValue}>₱{fuelCost.toFixed(2)}</Text>
              </View>
            </View>

            <View style={styles.resultRow}>
              <View style={styles.resultItem}>
                <Ionicons name="trending-up" size={20} color="#00ADB5" />
                <Text style={styles.resultLabel}>Cost per Kilometer</Text>
                <Text style={styles.resultValue}>₱{costPerKm.toFixed(2)}</Text>
              </View>
            </View>

            {/* Efficiency Rating */}
            <View style={styles.ratingContainer}>
              <Text style={styles.ratingLabel}>Efficiency Rating</Text>
              <View style={styles.ratingBar}>
                <View 
                  style={[
                    styles.ratingFill, 
                    { 
                      width: `${Math.min((calculatedEfficiency / 50) * 100, 100)}%`,
                      backgroundColor: calculatedEfficiency >= 40 ? '#4CAF50' : 
                                     calculatedEfficiency >= 30 ? '#FF9800' : '#F44336'
                    }
                  ]} 
                />
              </View>
              <Text style={styles.ratingText}>
                {calculatedEfficiency >= 40 ? 'Excellent' : 
                 calculatedEfficiency >= 30 ? 'Good' : 
                 calculatedEfficiency >= 20 ? 'Fair' : 'Poor'}
              </Text>
            </View>

            {/* Update Motor Button */}
            {selectedMotor && (
              <TouchableOpacity
                style={styles.updateMotorButton}
                onPress={updateMotorEfficiency}
              >
                <LinearGradient
                  colors={['#4CAF50', '#45A049']}
                  style={styles.updateMotorButtonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Ionicons name="save" size={20} color="#FFFFFF" />
                  <Text style={styles.updateMotorButtonText}>
                    Update {selectedMotor.nickname || selectedMotor.motorcycleData?.name || 'Motor'} Efficiency
                    {selectedMotor.fuelEfficiencyRecords && selectedMotor.fuelEfficiencyRecords.length > 0 && 
                      ` (${selectedMotor.fuelEfficiencyRecords.length + 1} records)`
                    }
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F2EEEE',
  },
  header: {
    width: '100%',
    backgroundColor: '#00ADB5',
  },
  headerGradient: {
    width: '100%',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingTop: Platform.OS === 'android' ? 20 : 16,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  container: {
    flex: 1,
    backgroundColor: '#F2EEEE',
  },
  contentContainer: {
    padding: 16,
  },
  instructionCard: {
    backgroundColor: '#E3F2FD',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#00ADB5',
  },
  instructionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  instructionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#00ADB5',
    marginLeft: 8,
  },
  instructionText: {
    fontSize: 14,
    color: '#333333',
    lineHeight: 20,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 16,
    textAlign: 'center',
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
    marginTop: 16,
    color: '#333333',
    fontWeight: '500',
  },
  input: {
    borderWidth: 1,
    borderColor: '#E1E1E1',
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#F8F9FA',
    color: '#333333',
  },
  warningText: {
    fontSize: 14,
    color: '#FF6B6B',
    marginBottom: 8,
    fontStyle: 'italic',
  },
  motorItem: {
    padding: 12,
    borderWidth: 1,
    borderColor: '#E1E1E1',
    borderRadius: 12,
    marginTop: 8,
    backgroundColor: '#F8F9FA',
  },
  motorItemSelected: {
    borderColor: '#00ADB5',
    backgroundColor: 'rgba(0, 173, 181, 0.1)',
  },
  motorText: {
    fontSize: 15,
    color: '#333333',
  },
  motorTextSelected: {
    color: '#00ADB5',
    fontWeight: '500',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 24,
  },
  button: {
    borderRadius: 12,
    overflow: 'hidden',
    flex: 1,
    marginRight: 12,
  },
  buttonGradient: {
    padding: 16,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  resetButton: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#00ADB5',
    backgroundColor: 'transparent',
  },
  resetButtonText: {
    color: '#00ADB5',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  resultsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  resultsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 16,
    textAlign: 'center',
  },
  resultRow: {
    marginBottom: 16,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
  },
  currencyIcon: {
    fontSize: 20,
    color: '#00ADB5',
    fontWeight: 'bold',
    marginRight: 8,
  },
  resultLabel: {
    fontSize: 14,
    color: '#666666',
    marginLeft: 12,
    flex: 1,
  },
  resultValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#00ADB5',
  },
  ratingContainer: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
  },
  ratingLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 8,
    textAlign: 'center',
  },
  ratingBar: {
    height: 8,
    backgroundColor: '#E1E1E1',
    borderRadius: 4,
    marginBottom: 8,
  },
  ratingFill: {
    height: '100%',
    borderRadius: 4,
  },
  ratingText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    color: '#333333',
  },
  updateMotorButton: {
    marginTop: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  updateMotorButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  updateMotorButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});
