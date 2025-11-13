// Improved AddMotorScreen with better error handling and UX

import React, { useState, useEffect, useCallback } from "react";
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
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { LOCALHOST_IP } from "@env";
import { useUser } from "../../AuthContext/UserContextImproved";
import { LinearGradient } from 'expo-linear-gradient';
import Toast from 'react-native-toast-message';
import { deleteUserMotor } from '../../utils/api';

// Constants
const API_ENDPOINTS = {
  MOTORCYCLES: '/api/motorcycles',
  USER_MOTORS: '/api/user-motors',
};

export default function AddMotorScreen({ navigation }) {
  const { user } = useUser();
  
  // State management
  const [motorItems, setMotorItems] = useState([]);
  const [motorIdMap, setMotorIdMap] = useState({});
  const [fuelMap, setFuelMap] = useState({});
  const [motorList, setMotorList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Modal states
  const [showModelModal, setShowModelModal] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showOdoModal, setShowOdoModal] = useState(false);
  
  // Form states
  const [modelSearchQuery, setModelSearchQuery] = useState("");
  const [customModelName, setCustomModelName] = useState("");
  const [odoStart, setOdoStart] = useState("");
  const [odoEnd, setOdoEnd] = useState("");
  const [litersAdded, setLitersAdded] = useState("");
  const [formInputs, setFormInputs] = useState({ motorName: "" });
  const [motorForm, setMotorForm] = useState({
    selectedMotor: null,
    fuelEfficiency: "",
    editingId: null,
  });

  // Error states
  const [errors, setErrors] = useState({});

  // Form handlers
  const handleFormChange = useCallback((field, value) => {
    setMotorForm((prev) => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  }, [errors]);

  const resetForm = useCallback(() => {
    setMotorForm({
      selectedMotor: null,
      fuelEfficiency: "",
      editingId: null,
    });
    setFormInputs({ motorName: "" });
    setErrors({});
  }, []);

  // Validation
  const validateForm = useCallback(() => {
    const newErrors = {};

    if (!motorForm.selectedMotor) {
      newErrors.selectedMotor = "Please select a motorcycle model";
    } else if (!motorIdMap[motorForm.selectedMotor]) {
      newErrors.selectedMotor = "Selected motorcycle model is invalid. Please select again.";
    }

    if (!formInputs.motorName.trim()) {
      newErrors.motorName = "Please enter a nickname for your motor";
    } else if (formInputs.motorName.trim().length < 2) {
      newErrors.motorName = "Nickname must be at least 2 characters";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [motorForm, formInputs, motorIdMap]);

  // API functions with improved error handling
  const fetchMotorModels = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`${LOCALHOST_IP}${API_ENDPOINTS.MOTORCYCLES}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (!Array.isArray(data)) {
        throw new Error('Invalid data format received');
      }

      const idMap = {};
      const fuelData = {};
      const options = [];

      data.forEach((motor) => {
        if (motor.model && motor._id) {
          idMap[motor.model] = motor._id;
          fuelData[motor.model] = motor.fuelConsumption || 0;
          options.push({ 
            label: motor.model, 
            value: motor.model,
            motorcycleData: motor // Store the full motorcycle data
          });
        }
      });

      setMotorItems(options);
      setMotorIdMap(idMap);
      setFuelMap(fuelData);
      
      console.log(`✅ Loaded ${data.length} motorcycle models`);
      console.log('[AddMotorScreenImproved] Sample motorcycle data:', data[0]);
    } catch (error) {
      console.error('Error fetching motor models:', error);
      Toast.show({
        type: 'error',
        text1: 'Failed to Load Models',
        text2: error.message || 'Unable to load motorcycle models. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchUserMotors = useCallback(async () => {
    if (!user?._id) return;
    
    try {
      setLoading(true);
      const response = await fetch(`${LOCALHOST_IP}${API_ENDPOINTS.USER_MOTORS}/user/${user._id}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (Array.isArray(data)) {
        console.log('[AddMotorScreenImproved] Fetched user motors:', data.length, 'motors');
        console.log('[AddMotorScreenImproved] Sample motor data:', data[0]);
        setMotorList(data);
      } else {
        throw new Error('Invalid data format received');
      }
    } catch (error) {
      console.error('Error fetching user motors:', error);
      Toast.show({
        type: 'error',
        text1: 'Failed to Load Motors',
        text2: error.message || 'Unable to load your motorcycles. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Auto-update fuel efficiency when motor is selected
  useEffect(() => {
    if (motorForm.selectedMotor && fuelMap[motorForm.selectedMotor]) {
      handleFormChange("fuelEfficiency", String(fuelMap[motorForm.selectedMotor]));
    } else {
      handleFormChange("fuelEfficiency", "");
    }
  }, [motorForm.selectedMotor, fuelMap, handleFormChange]);

  // Initial data loading
  useEffect(() => {
    fetchMotorModels();
  }, [fetchMotorModels]);

  useEffect(() => {
    if (user?._id) {
      fetchUserMotors();
    }
  }, [user, fetchUserMotors]);

  // Save motor function with improved error handling
  const handleSave = useCallback(async () => {
    if (!validateForm() || !user?._id) return;
    
    setIsSubmitting(true);
    try {
      const motorcycleId = motorIdMap[motorForm.selectedMotor];
      
      // Additional validation check
      if (!motorcycleId) {
        throw new Error('Invalid motorcycle model selected. Please select a valid model.');
      }

      const endpoint = motorForm.editingId
        ? `${LOCALHOST_IP}${API_ENDPOINTS.USER_MOTORS}/${motorForm.editingId}`
        : `${LOCALHOST_IP}${API_ENDPOINTS.USER_MOTORS}/`;
      const method = motorForm.editingId ? "PUT" : "POST";

      const requestBody = {
        userId: user._id,
        motorcycleId,
        nickname: formInputs.motorName.trim(),
      };

      console.log('[AddMotorScreenImproved] Submitting motor data:', {
        endpoint,
        method,
        requestBody,
        selectedMotor: motorForm.selectedMotor,
        motorcycleId,
        motorIdMapKeys: Object.keys(motorIdMap),
        motorIdMapSize: Object.keys(motorIdMap).length
      });

      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      // Check if response is ok before parsing
      if (!response.ok) {
        let errorMessage = `Request failed with status ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData?.msg || errorData?.message || errorMessage;
        } catch (parseError) {
          // If response is not JSON, use status text
          errorMessage = response.statusText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      const responseData = await response.json();

      console.log("✅ Motor saved successfully:", responseData);
      Toast.show({
        type: 'success',
        text1: motorForm.editingId ? 'Motor Updated!' : 'Motor Added!',
        text2: `${formInputs.motorName} has been ${motorForm.editingId ? 'updated' : 'added'} successfully`,
      });

      resetForm();
      setShowAddForm(false);
      
      // Refresh motors locally
      fetchUserMotors();
      
      // Refresh motors globally using useAppData
      try {
        // Import and use forceRefreshMotors from useAppData
        const { forceRefreshMotors } = require('../../hooks/useAppData');
        if (forceRefreshMotors && typeof forceRefreshMotors === 'function') {
          forceRefreshMotors(user._id);
          if (__DEV__) {
            console.log('[AddMotorScreen] Refreshed motors globally');
          }
        }
      } catch (error) {
        if (__DEV__) {
          console.warn('[AddMotorScreen] Failed to refresh motors globally:', error);
        }
      }
    } catch (error) {
      console.error('Save motor error:', error);
      Toast.show({
        type: 'error',
        text1: 'Save Failed',
        text2: error.message || 'Something went wrong while saving. Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [validateForm, user, motorIdMap, motorForm, formInputs, resetForm, fetchUserMotors]);

  // Delete motor with confirmation
  const handleDelete = useCallback((id, nickname) => {
    Alert.alert(
      "Delete Motorcycle",
      `Are you sure you want to delete "${nickname}"? This action cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              // Use centralized API function with proper endpoint: DELETE /api/user-motors/:id
              await deleteUserMotor(id);

              Toast.show({
                type: 'success',
                text1: 'Motor Deleted',
                text2: `${nickname} has been removed successfully`,
              });

              fetchUserMotors();
            } catch (error) {
              console.error('Delete motor error:', error);
              Toast.show({
                type: 'error',
                text1: 'Delete Failed',
                text2: error.message || 'Failed to delete motor. Please try again.',
              });
            }
          },
        },
      ]
    );
  }, [fetchUserMotors]);

  // Custom model creation with validation
  const handleCreateCustomModel = useCallback(async () => {
    const distance = parseFloat(odoEnd) - parseFloat(odoStart);
    const liters = parseFloat(litersAdded);

    // Validation
    if (!customModelName.trim()) {
      Alert.alert("Error", "Please enter a model name.");
      return;
    }
    if (distance <= 0) {
      Alert.alert("Error", "Final odometer reading must be greater than initial reading.");
      return;
    }
    if (liters <= 0) {
      Alert.alert("Error", "Please enter a valid amount of fuel added.");
      return;
    }

    const efficiency = distance / liters;

    try {
      const response = await fetch(`${LOCALHOST_IP}${API_ENDPOINTS.MOTORCYCLES}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: customModelName.trim(),
          fuelConsumption: parseFloat(efficiency.toFixed(2)),
          engineDisplacement: 110, // Default value
          power: "Custom",
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      Toast.show({
        type: 'success',
        text1: 'Model Created!',
        text2: `${customModelName} has been added successfully`,
      });

      await fetchMotorModels();
      handleFormChange("selectedMotor", customModelName);
      handleFormChange("fuelEfficiency", efficiency.toFixed(2));
      setShowOdoModal(false);
      
      // Reset custom model form
      setCustomModelName("");
      setOdoStart("");
      setOdoEnd("");
      setLitersAdded("");
    } catch (error) {
      console.error('Create custom model error:', error);
      Toast.show({
        type: 'error',
        text1: 'Creation Failed',
        text2: error.message || 'Failed to create model. Please try again.',
      });
    }
  }, [customModelName, odoStart, odoEnd, litersAdded, fetchMotorModels, handleFormChange]);

  // Render functions
  const renderMotorList = () => {
    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#00ADB5" />
          <Text style={styles.loadingText}>Loading your motorcycles...</Text>
        </View>
      );
    }

    if (motorList.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="bicycle-outline" size={64} color="#00ADB5" />
          <Text style={styles.emptyStateText}>No motorcycles added yet</Text>
          <Text style={styles.emptyStateSubtext}>
            Tap the + button below to add your first motorcycle
          </Text>
        </View>
      );
    }

    return motorList.map((item) => (
      <View key={item._id} style={styles.motorCard}>
        <TouchableOpacity
          style={styles.motorInfo}
          onPress={() => navigation.navigate("MotorDetails", { item })}
          activeOpacity={0.8}
        >
          <Text style={styles.motorName}>{item.nickname || "Unnamed Motor"}</Text>
          <Text style={styles.motorDetail}>Model: {item.motorcycleData?.name || item.name || "Unknown Model"}</Text>
          <Text style={styles.motorDetail}>
            Fuel Efficiency: {item.fuelEfficiency ? `${item.fuelEfficiency} km/L` : "N/A"}
          </Text>
          <View style={styles.fuelLevelContainer}>
            <Ionicons name="speedometer-outline" size={16} color="#FF6B6B" />
            <Text style={styles.fuelLevelText}>
              Current Fuel: {item.currentFuelLevel?.toFixed(0) || 0}%
            </Text>
          </View>
        </TouchableOpacity>

        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => {
              setMotorForm({
                selectedMotor: item.motorcycleData?.name || item.name || "Unknown Model",
                fuelEfficiency: String(item.fuelEfficiency || ""),
                editingId: item._id,
              });
              setFormInputs({ motorName: item.nickname });
              setShowAddForm(true);
            }}
          >
            <Ionicons name="create-outline" size={24} color="#00ADB5" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleDelete(item._id, item.nickname)}
            style={styles.deleteButton}
          >
            <Ionicons name="trash-outline" size={24} color="#FF6B6B" />
          </TouchableOpacity>
        </View>
      </View>
    ));
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
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
                <Text style={styles.headerTitle}>My Motors</Text>
                <Text style={styles.headerSubtitle}>View and manage your motorcycles</Text>
              </View>
            </View>
          </LinearGradient>
        </View>

        <ScrollView style={styles.container}>
          <View style={styles.section}>
            {renderMotorList()}
          </View>
        </ScrollView>

        {/* Add Motor FAB */}
        <TouchableOpacity 
          style={styles.fab}
          onPress={() => {
            resetForm();
            setShowAddForm(true);
          }}
        >
          <LinearGradient
            colors={['#00ADB5', '#00C2CC']}
            style={styles.fabGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Ionicons name="add" size={24} color="#FFFFFF" />
          </LinearGradient>
        </TouchableOpacity>

        {/* Add/Edit Motor Modal */}
        <Modal
          visible={showAddForm}
          animationType="slide"
          transparent={true}
          onRequestClose={() => {
            setShowAddForm(false);
            resetForm();
          }}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {motorForm.editingId ? 'Edit Motor' : 'Add New Motor'}
                </Text>
                <TouchableOpacity 
                  onPress={() => {
                    setShowAddForm(false);
                    resetForm();
                  }}
                  style={styles.closeButton}
                >
                  <Ionicons name="close" size={24} color="#333" />
                </TouchableOpacity>
              </View>

              <ScrollView>
                <View style={styles.formCard}>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Motor Nickname *</Text>
                    <TextInput
                      value={formInputs.motorName}
                      onChangeText={(v) => setFormInputs((prev) => ({ ...prev, motorName: v }))}
                      style={[styles.input, errors.motorName && styles.inputError]}
                      placeholder="Enter nickname"
                      placeholderTextColor="#999"
                      maxLength={50}
                    />
                    {errors.motorName && <Text style={styles.errorText}>{errors.motorName}</Text>}
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Motorcycle Model *</Text>
                    <TouchableOpacity
                      onPress={() => setShowModelModal(true)}
                      style={[styles.input, errors.selectedMotor && styles.inputError]}
                      disabled={!!motorForm.editingId}
                    >
                      <Text style={[
                        styles.selectText,
                        !motorForm.selectedMotor && styles.placeholderText
                      ]}>
                        {motorForm.selectedMotor || "Select model"}
                      </Text>
                      <Ionicons name="chevron-down" size={20} color="#666" />
                    </TouchableOpacity>
                    {errors.selectedMotor && <Text style={styles.errorText}>{errors.selectedMotor}</Text>}
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Fuel Efficiency (km/L)</Text>
                    <View style={[styles.input, styles.disabledInput]}>
                      <Text style={styles.efficiencyText}>
                        {motorForm.fuelEfficiency ? `${motorForm.fuelEfficiency} km/L` : "Not set"}
                      </Text>
                    </View>
                    {errors.fuelEfficiency && <Text style={styles.errorText}>{errors.fuelEfficiency}</Text>}
                  </View>

                  <TouchableOpacity
                    onPress={handleSave}
                    disabled={isSubmitting}
                    style={[styles.saveButton, isSubmitting && styles.saveButtonDisabled]}
                  >
                    <LinearGradient
                      colors={isSubmitting ? ['#B0B0B0', '#C0C0C0'] : ['#00ADB5', '#00C2CC']}
                      style={styles.saveButtonGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                    >
                      <Text style={styles.saveButtonText}>
                        {isSubmitting ? "Processing..." : motorForm.editingId ? "Update Motor" : "Save Motor"}
                      </Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* Model Selection Modal */}
        <Modal
          visible={showModelModal}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowModelModal(false)}
        >
          <TouchableWithoutFeedback onPress={() => setShowModelModal(false)}>
            <View style={styles.modalContainer}>
              <TouchableWithoutFeedback>
                <View style={[styles.modalContent, { maxHeight: '80%' }]}>
                  <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>Select Model</Text>
                    <TouchableOpacity 
                      onPress={() => setShowModelModal(false)}
                      style={styles.closeButton}
                    >
                      <Ionicons name="close" size={24} color="#333" />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.searchContainer}>
                    <TextInput
                      placeholder="Search models..."
                      value={modelSearchQuery}
                      onChangeText={setModelSearchQuery}
                      style={styles.searchInput}
                      placeholderTextColor="#999"
                      autoFocus
                    />
                  </View>

                  <ScrollView style={styles.modelList}>
                    {motorItems
                      .filter(item => 
                        item.label.toLowerCase().includes(modelSearchQuery.toLowerCase())
                      )
                      .map(item => (
                        <TouchableOpacity
                          key={item.value}
                          style={styles.modelItem}
                          onPress={() => {
                            handleFormChange("selectedMotor", item.value);
                            setShowModelModal(false);
                          }}
                        >
                          <Text style={styles.modelItemText}>{item.label}</Text>
                          <Text style={styles.modelEfficiency}>
                            {fuelMap[item.value] ? `${fuelMap[item.value]} km/L` : 'No efficiency data'}
                          </Text>
                        </TouchableOpacity>
                      ))
                    }
                  </ScrollView>

                  <TouchableOpacity
                    style={styles.addModelButton}
                    onPress={() => {
                      setShowModelModal(false);
                      setShowOdoModal(true);
                    }}
                  >
                    <LinearGradient
                      colors={['#00ADB5', '#00C2CC']}
                      style={styles.addModelGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                    >
                      <Text style={styles.addModelText}>+ Add New Model</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </Modal>

        {/* Custom Model Modal */}
        <Modal
          visible={showOdoModal}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowOdoModal(false)}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Add New Model</Text>
                <TouchableOpacity 
                  onPress={() => setShowOdoModal(false)}
                  style={styles.closeButton}
                >
                  <Ionicons name="close" size={24} color="#333" />
                </TouchableOpacity>
              </View>

              <ScrollView>
                <View style={styles.formCard}>
                  <Text style={styles.instructionText}>
                    Enter your odometer readings and fuel consumption to calculate fuel efficiency.
                  </Text>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Model Name *</Text>
                    <TextInput
                      value={customModelName}
                      onChangeText={setCustomModelName}
                      style={styles.input}
                      placeholder="Enter model name"
                      placeholderTextColor="#999"
                      maxLength={50}
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Initial Odometer Reading (km) *</Text>
                    <TextInput
                      value={odoStart}
                      onChangeText={setOdoStart}
                      style={styles.input}
                      placeholder="Enter initial reading"
                      keyboardType="numeric"
                      placeholderTextColor="#999"
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Final Odometer Reading (km) *</Text>
                    <TextInput
                      value={odoEnd}
                      onChangeText={setOdoEnd}
                      style={styles.input}
                      placeholder="Enter final reading"
                      keyboardType="numeric"
                      placeholderTextColor="#999"
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Fuel Added (Liters) *</Text>
                    <TextInput
                      value={litersAdded}
                      onChangeText={setLitersAdded}
                      style={styles.input}
                      placeholder="Enter liters added"
                      keyboardType="numeric"
                      placeholderTextColor="#999"
                    />
                  </View>

                  <TouchableOpacity
                    onPress={handleCreateCustomModel}
                    style={styles.saveButton}
                  >
                    <LinearGradient
                      colors={['#00ADB5', '#00C2CC']}
                      style={styles.saveButtonGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                    >
                      <Text style={styles.saveButtonText}>Create Model</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
        
        <Toast />
      </SafeAreaView>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F2EEEE',
  },
  header: {
    width: '100%',
    backgroundColor: '#F2EEEE',
    zIndex: 10,
    overflow: 'hidden',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerGradient: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 12 : 16,
    paddingBottom: 20,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    marginRight: 16,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '500',
  },
  container: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
  },
  motorCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  motorInfo: {
    flex: 1,
  },
  motorName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  motorDetail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  fuelLevelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  fuelLevelText: {
    fontSize: 14,
    color: '#FF6B6B',
    marginLeft: 4,
    fontWeight: '500',
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  editButton: {
    padding: 8,
    marginRight: 8,
  },
  deleteButton: {
    padding: 8,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    borderRadius: 28,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  fabGradient: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#F2EEEE',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
  },
  closeButton: {
    padding: 8,
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    margin: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
    fontSize: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inputError: {
    borderColor: '#FF6B6B',
    backgroundColor: '#FFF5F5',
  },
  errorText: {
    color: '#FF6B6B',
    fontSize: 14,
    marginTop: 4,
  },
  disabledInput: {
    backgroundColor: '#F5F5F5',
  },
  selectText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  placeholderText: {
    color: '#999',
  },
  efficiencyText: {
    fontSize: 16,
    color: '#666',
  },
  saveButton: {
    marginTop: 8,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#00ADB5',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  saveButtonDisabled: {
    opacity: 0.6,
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
  searchContainer: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  searchInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  modelList: {
    maxHeight: '50%',
  },
  modelItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
    backgroundColor: '#FFFFFF',
  },
  modelItemText: {
    fontSize: 16,
    color: '#333',
    marginBottom: 4,
  },
  modelEfficiency: {
    fontSize: 14,
    color: '#00ADB5',
  },
  addModelButton: {
    margin: 16,
    marginTop: 8,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#00ADB5',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  addModelGradient: {
    padding: 16,
    alignItems: 'center',
  },
  addModelText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  instructionText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    lineHeight: 20,
    textAlign: 'center',
  },
});
