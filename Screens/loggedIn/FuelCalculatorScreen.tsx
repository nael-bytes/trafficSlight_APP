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
} from 'react-native';
import { useUser } from '../../AuthContext/UserContext';
import axios from 'axios';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';

const API_BASE = 'https://ts-backend-1-jyit.onrender.com';

export default function FuelCalculatorScreen() {
  const navigation = useNavigation();
  const { user } = useUser();
  const [distance, setDistance] = useState('');
  const [fuelPrice, setFuelPrice] = useState('');
  const [motorList, setMotorList] = useState([]);
  const [selectedMotor, setSelectedMotor] = useState(null);
  const [manualEfficiency, setManualEfficiency] = useState('');
  const [fuelNeeded, setFuelNeeded] = useState(0);
  const [costEstimate, setCostEstimate] = useState(0);

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

  const calculate = () => {
    const km = parseFloat(distance);
    const price = parseFloat(fuelPrice);
    const efficiency = selectedMotor?.fuelEfficiency || parseFloat(manualEfficiency);

    if (!km || !price || !efficiency) return;

    const estimatedFuel = km / efficiency;
    const totalCost = estimatedFuel * price;

    setFuelNeeded(estimatedFuel);
    setCostEstimate(totalCost);
  };

  const isButtonDisabled = () => {
    const hasMotor = !!selectedMotor;
    const manualEffOk = !hasMotor && parseFloat(manualEfficiency) > 0;
    const filled = distance && fuelPrice && (hasMotor || manualEffOk);
    return !filled;
  };

//Fuel efficiency calculator
// Add new states
const [prevOdo, setPrevOdo] = useState('');
const [currOdo, setCurrOdo] = useState('');
const [fuelConsumed, setFuelConsumed] = useState('');
const [calculatedEfficiency, setCalculatedEfficiency] = useState(null);

// Function to calculate efficiency from odometer
const calculateEfficiencyFromOdo = () => {
  const prev = parseFloat(prevOdo);
  const curr = parseFloat(currOdo);
  const fuel = parseFloat(fuelConsumed);

  if (isNaN(prev) || isNaN(curr) || isNaN(fuel) || curr <= prev || fuel <= 0) {
    return;
  }

  const efficiency = (curr - prev) / fuel;
  setCalculatedEfficiency(efficiency);
  setManualEfficiency(efficiency.toFixed(2)); // auto-fill manual efficiency field
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
              <Text style={styles.headerTitle}>Fuel Calculator</Text>
              <Text style={styles.headerSubtitle}>Estimate your fuel costs</Text>
            </View>
          </View>
        </LinearGradient>
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        <View style={styles.card}>
        <Text style={styles.label}>Old Motorcycle Efficiency (via Odometer)</Text>

<TextInput
  style={styles.input}
  value={prevOdo}
  onChangeText={setPrevOdo}
  keyboardType="numeric"
  placeholder="Previous Odometer (km)"
  placeholderTextColor="#999"
/>

<TextInput
  style={styles.input}
  value={currOdo}
  onChangeText={setCurrOdo}
  keyboardType="numeric"
  placeholder="Current Odometer (km)"
  placeholderTextColor="#999"
/>

<TextInput
  style={styles.input}
  value={fuelConsumed}
  onChangeText={setFuelConsumed}
  keyboardType="numeric"
  placeholder="Fuel Consumed (L)"
  placeholderTextColor="#999"
/>

<TouchableOpacity
  style={styles.button}
  onPress={calculateEfficiencyFromOdo}
>
  <LinearGradient
    colors={['#00ADB5', '#00C2CC']}
    style={styles.buttonGradient}
    start={{ x: 0, y: 0 }}
    end={{ x: 1, y: 0 }}
  >
    <Text style={styles.buttonText}>Calculate Efficiency</Text>
  </LinearGradient>
</TouchableOpacity>

{calculatedEfficiency && (
  <Text style={{ marginTop: 8, fontSize: 16, color: '#00ADB5' }}>
    Calculated Efficiency: {calculatedEfficiency.toFixed(2)} km/L
  </Text>
)}

          <Text style={styles.label}>Distance (km)</Text>
          <TextInput
            style={styles.input}
            value={distance}
            onChangeText={setDistance}
            keyboardType="numeric"
            placeholder="e.g. 50"
            placeholderTextColor="#999"
          />

          <Text style={styles.label}>Fuel Price (₱ per liter)</Text>
          <TextInput
            style={styles.input}
            value={fuelPrice}
            onChangeText={setFuelPrice}
            keyboardType="numeric"
            placeholder="e.g. 65"
            placeholderTextColor="#999"
          />

          <Text style={styles.label}>Select Motor</Text>
          {motorList.length === 0 && (
            <Text style={styles.warningText}>No motors found. Enter fuel efficiency manually below.</Text>
          )}
          {motorList.map((motor, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.motorItem,
                selectedMotor?.model === motor.model ? styles.motorItemSelected : null,
              ]}
              onPress={() => setSelectedMotor(motor)}
            >
              <Text style={[
                styles.motorText,
                selectedMotor?.model === motor.model ? styles.motorTextSelected : null,
              ]}>
                {motor.name || motor.model} - {motor.fuelEfficiency} km/L
              </Text>
            </TouchableOpacity>
          ))}

          {selectedMotor ? (
            <>
              <Text style={styles.label}>Fuel Efficiency</Text>
              <Text style={styles.readOnlyInput}>{selectedMotor.fuelEfficiency} km/L</Text>
            </>
          ) : (
            <>
              <Text style={styles.label}>Manual Fuel Efficiency (km/L)</Text>
              <TextInput
                style={styles.input}
                value={manualEfficiency}
                onChangeText={setManualEfficiency}
                keyboardType="numeric"
                placeholder="e.g. 35"
                placeholderTextColor="#999"
              />
            </>
          )}

          <TouchableOpacity
            style={[styles.button, isButtonDisabled() && styles.buttonDisabled]}
            onPress={calculate}
            disabled={isButtonDisabled()}
          >
            <LinearGradient
              colors={isButtonDisabled() ? ['#CCC', '#DDD'] : ['#00ADB5', '#00C2CC']}
              style={styles.buttonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Text style={styles.buttonText}>Calculate</Text>
            </LinearGradient>
          </TouchableOpacity>

          {fuelNeeded > 0 && (
            <View style={styles.resultBox}>
              <View style={styles.resultItem}>
                <Text style={styles.resultLabel}>Estimated Fuel</Text>
                <Text style={styles.resultValue}>{fuelNeeded.toFixed(2)} L</Text>
              </View>
              <View style={styles.resultDivider} />
              <View style={styles.resultItem}>
                <Text style={styles.resultLabel}>Estimated Cost</Text>
                <Text style={styles.resultValue}>₱{costEstimate.toFixed(2)}</Text>
              </View>
            </View>
          )}
        </View>
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
  readOnlyInput: {
    fontSize: 16,
    padding: 12,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    color: '#333333',
    borderWidth: 1,
    borderColor: '#E1E1E1',
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
  button: {
    borderRadius: 12,
    marginTop: 24,
    overflow: 'hidden',
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
  resultBox: {
    marginTop: 24,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
  },
  resultItem: {
    flex: 1,
    alignItems: 'center',
  },
  resultDivider: {
    width: 1,
    backgroundColor: '#E1E1E1',
    marginHorizontal: 16,
  },
  resultLabel: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 4,
  },
  resultValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#00ADB5',
  },
});
