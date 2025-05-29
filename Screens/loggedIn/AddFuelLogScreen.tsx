import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  ScrollView,
  Keyboard,
  ActivityIndicator,
  TouchableWithoutFeedback,
  StyleSheet,
  Platform,
  StatusBar,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useUser } from '../../AuthContext/UserContext';
import { LOCALHOST_IP } from '@env';

export default function AddFuelLogScreen() {
  const navigation = useNavigation();
  const { user } = useUser();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [motors, setMotors] = useState([]);
  const [selectedMotor, setSelectedMotor] = useState(null);
  const [showMotorModal, setShowMotorModal] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  
  const [formData, setFormData] = useState({
    date: new Date(),
    liters: '',
    pricePerLiter: '',
    odometer: '',
    notes: '',
  });

  useEffect(() => {
    fetchUserMotors();
  }, [user]);

  const fetchUserMotors = async () => {
    if (!user?._id) return;
    try {
      const res = await fetch(`${LOCALHOST_IP}/api/user-motors/user/${user._id}`);
      const data = await res.json();
      setMotors(data);
    } catch (err) {
      Alert.alert('Error', 'Failed to load your motors.');
    }
  };

  const handleFormChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const validateForm = () => {
    if (!selectedMotor) {
      Alert.alert('Error', 'Please select a motor');
      return false;
    }
    if (!formData.liters || isNaN(Number(formData.liters))) {
      Alert.alert('Error', 'Please enter a valid number of liters');
      return false;
    }
    if (!formData.pricePerLiter || isNaN(Number(formData.pricePerLiter))) {
      Alert.alert('Error', 'Please enter a valid price per liter');
      return false;
    }
    if (!formData.odometer || isNaN(Number(formData.odometer))) {
      Alert.alert('Error', 'Please enter a valid odometer reading');
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (!validateForm() || !user?._id) return;
    
    setIsSubmitting(true);
    try {
      const payload = {
        userId: user._id,
        motorId: selectedMotor._id,
        date: formData.date,
        liters: Number(formData.liters),
        pricePerLiter: Number(formData.pricePerLiter),
        totalCost: Number(formData.liters) * Number(formData.pricePerLiter),
        odometer: Number(formData.odometer),
        notes: formData.notes,
      };

      const res = await fetch(`${LOCALHOST_IP}/api/fuel-logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error('Failed to save fuel log');
      }

      Alert.alert('Success', 'Fuel log added successfully!');
      navigation.goBack();
    } catch (err) {
      Alert.alert('Error', 'Failed to save fuel log. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={true}
      onRequestClose={() => navigation.goBack()}
    >
      <SafeAreaView style={styles.modalContainer}>
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
                <Ionicons name="close" size={24} color="#FFFFFF" />
              </TouchableOpacity>
              <View style={styles.headerTextContainer}>
                <Text style={styles.headerTitle}>Add Fuel Log</Text>
                <Text style={styles.headerSubtitle}>Record your refueling details</Text>
              </View>
            </View>
          </LinearGradient>
        </View>

        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView style={styles.content}>
            {/* Motor Selection */}
            <TouchableOpacity
              style={styles.selectButton}
              onPress={() => setShowMotorModal(true)}
            >
              <Text style={styles.selectButtonLabel}>
                {selectedMotor ? selectedMotor.nickname : 'Select Motor'}
              </Text>
              <Ionicons name="chevron-down" size={20} color="#00ADB5" />
            </TouchableOpacity>

            {/* Date Selection */}
            <TouchableOpacity
              style={styles.selectButton}
              onPress={() => setShowDatePicker(true)}
            >
              <Text style={styles.selectButtonLabel}>
                {formData.date.toLocaleDateString('en-PH', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </Text>
              <Ionicons name="calendar" size={20} color="#00ADB5" />
            </TouchableOpacity>

            {/* Form Fields */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Liters</Text>
              <TextInput
                style={styles.input}
                value={formData.liters}
                onChangeText={(value) => handleFormChange('liters', value)}
                keyboardType="decimal-pad"
                placeholder="Enter liters"
                placeholderTextColor="#999"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Price per Liter</Text>
              <TextInput
                style={styles.input}
                value={formData.pricePerLiter}
                onChangeText={(value) => handleFormChange('pricePerLiter', value)}
                keyboardType="decimal-pad"
                placeholder="Enter price per liter"
                placeholderTextColor="#999"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Odometer Reading</Text>
              <TextInput
                style={styles.input}
                value={formData.odometer}
                onChangeText={(value) => handleFormChange('odometer', value)}
                keyboardType="numeric"
                placeholder="Enter current odometer reading"
                placeholderTextColor="#999"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Notes (Optional)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={formData.notes}
                onChangeText={(value) => handleFormChange('notes', value)}
                placeholder="Add any notes about this refueling"
                placeholderTextColor="#999"
                multiline
                numberOfLines={3}
              />
            </View>

            {/* Save Button */}
            <TouchableOpacity
              style={[styles.saveButton, isSubmitting && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={isSubmitting}
            >
              <LinearGradient
                colors={['#00ADB5', '#00C2CC']}
                style={styles.saveButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveButtonText}>Save Fuel Log</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </ScrollView>
        </TouchableWithoutFeedback>

        {/* Motor Selection Modal */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={showMotorModal}
          onRequestClose={() => setShowMotorModal(false)}
        >
          <View style={styles.motorModalContainer}>
            <View style={styles.motorModalContent}>
              <View style={styles.motorModalHeader}>
                <Text style={styles.motorModalTitle}>Select Motor</Text>
                <TouchableOpacity onPress={() => setShowMotorModal(false)}>
                  <Ionicons name="close" size={24} color="#333" />
                </TouchableOpacity>
              </View>
              <ScrollView>
                {motors.map((motor) => (
                  <TouchableOpacity
                    key={motor._id}
                    style={styles.motorOption}
                    onPress={() => {
                      setSelectedMotor(motor);
                      setShowMotorModal(false);
                    }}
                  >
                    <Text style={styles.motorOptionText}>{motor.nickname}</Text>
                    <Text style={styles.motorOptionSubtext}>{motor.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* Date Picker */}
        {showDatePicker && (
          <DateTimePicker
            value={formData.date}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(event, selectedDate) => {
              setShowDatePicker(false);
              if (selectedDate) {
                handleFormChange('date', selectedDate);
              }
            }}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
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
  content: {
    flex: 1,
    padding: 16,
  },
  selectButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
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
  selectButtonLabel: {
    fontSize: 16,
    color: '#333',
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    fontWeight: '500',
  },
  input: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    fontSize: 16,
    color: '#333',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  saveButton: {
    marginVertical: 24,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonGradient: {
    padding: 16,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  motorModalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  motorModalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 16,
    maxHeight: '80%',
  },
  motorModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
    marginBottom: 16,
  },
  motorModalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
  },
  motorOption: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  motorOptionText: {
    fontSize: 16,
    color: '#333',
    marginBottom: 4,
  },
  motorOptionSubtext: {
    fontSize: 14,
    color: '#666',
  },
}); 