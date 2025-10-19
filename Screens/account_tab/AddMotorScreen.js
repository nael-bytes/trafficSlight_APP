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


export default function AddMotorScreen({ navigation }) {
  const { user } = useUser();
  const [motorItems, setMotorItems] = useState([]);
  const [motorIdMap, setMotorIdMap] = useState({});
  const [fuelMap, setFuelMap] = useState({});
  const [motorList, setMotorList] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showModelModal, setShowModelModal] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [modelSearchQuery, setModelSearchQuery] = useState("");
  const [showOdoModal, setShowOdoModal] = useState(false);
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

  const handleFormChange = (field, value) => {
    setMotorForm((prev) => ({ ...prev, [field]: value }));
  };

  const resetForm = () => {
    setMotorForm({
      selectedMotor: null,
      fuelEfficiency: "",
      editingId: null,
    });
    setFormInputs({ motorName: "" });
  };

  const fetchMotorModels = useCallback(async () => {
    try {
      const res = await fetch(`${LOCALHOST_IP}/api/motorcycles`);
      const data = await res.json();
      const idMap = {}, fuelData = {}, options = [];
      data.forEach((motor) => {
        idMap[motor.model] = motor._id;
        fuelData[motor.model] = motor.fuelConsumption;
        options.push({ 
          label: motor.model, 
          value: motor.model,
          motorcycleData: motor // Store the full motorcycle data
        });
      });
      setMotorItems(options);
      setMotorIdMap(idMap);
      setFuelMap(fuelData);
      console.log('[AddMotorScreen] Fetched motorcycle models:', data.length);
    } catch (error) {
      console.error('[AddMotorScreen] Error fetching motorcycle models:', error);
      Alert.alert("Error", "Failed to load motorcycle models.");
    }
  }, []);

  const fetchUserMotors = useCallback(async () => {
    if (!user?._id) return;
    setLoading(true);
    try {
      const res = await fetch(`${LOCALHOST_IP}/api/user-motors/user/${user._id}`);
      const data = await res.json();
      console.log('[AddMotorScreen] Fetched user motors:', data.length, 'motors');
      console.log('[AddMotorScreen] Sample motor data:', data[0]);
      setMotorList(data);
    } catch (error) {
      console.error('[AddMotorScreen] Error fetching user motors:', error);
      Alert.alert("Error", "Failed to load your motors.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchMotorModels(); }, [fetchMotorModels]);
  useEffect(() => { if (user?._id) fetchUserMotors(); }, [user, fetchUserMotors]);

  useEffect(() => {
    if (motorForm.selectedMotor && fuelMap[motorForm.selectedMotor]) {
      handleFormChange("fuelEfficiency", String(fuelMap[motorForm.selectedMotor]));
    } else {
      handleFormChange("fuelEfficiency", "");
    }
  }, [motorForm.selectedMotor, fuelMap]);

  const validateForm = () => {
    if (!motorForm.selectedMotor) return Alert.alert("Error", "Select a motorcycle model.");
    return true;
  };

  const handleSave = async () => {
    if (!validateForm() || !user?._id) return;
    setIsSubmitting(true);
    try {
      const motorcycleId = motorIdMap[motorForm.selectedMotor];
      const endpoint = motorForm.editingId
        ? `${LOCALHOST_IP}/api/user-motors/${motorForm.editingId}`
        : `${LOCALHOST_IP}/api/user-motors/`;
      const method = motorForm.editingId ? "PUT" : "POST";

      const requestData = {
        userId: user._id,
        motorcycleId,
        nickname: formInputs.motorName.trim(),
      };

      console.log('[AddMotorScreen] Submitting motor data:', {
        endpoint,
        method,
        requestData,
        selectedMotor: motorForm.selectedMotor,
        motorcycleId
      });

      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestData),
      });

      const resData = await res.json();

      if (!res.ok) {
        console.error("❌ Save failed response:", resData);
        throw new Error(resData?.msg || "Request failed.");
      }

      console.log("✅ Motor saved successfully:", resData);
      Alert.alert("Success", motorForm.editingId ? "Motor updated!" : "Motor added!");
      resetForm();
      setShowAddForm(false);
      fetchUserMotors();
    } catch (err) {
      console.error("❌ Save Error:", err.message);
      Alert.alert("Error", err.message || "Something went wrong while saving.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = (id, nickname) => {
    Alert.alert("Delete Motor", `Delete "${nickname}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            const res = await fetch(`${LOCALHOST_IP}/api/user-motors/user/${user._id}`, { method: "DELETE" });
            if (!res.ok) throw new Error();
            fetchUserMotors();
            Alert.alert("Deleted", "Motor removed.");
          } catch {
            Alert.alert("Error", "Failed to delete. Try again.");
          }
        },
      },
    ]);
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
  {/* My Motors List */}
  <View style={styles.section}>
    {loading ? (
      <ActivityIndicator size="large" color="#00ADB5" style={styles.loader} />
    ) : motorList.length === 0 ? (
      <View style={styles.emptyState}>
        <Ionicons name="bicycle-outline" size={48} color="#00ADB5" />
        <Text style={styles.emptyStateText}>No motors added yet</Text>
        <Text style={styles.emptyStateSubtext}>
          Tap the + button to add your first motorcycle
        </Text>
      </View>
    ) : (
      motorList.map((item) => (
        <View key={item._id} style={styles.motorCard}>
          {/* Card info clickable */}
          <TouchableOpacity
            style={{ flex: 1 }}
            onPress={() => navigation.navigate("MotorDetails", { item : item})}
            activeOpacity={0.8}
          >
            <View style={styles.motorInfo}>
              <Text style={styles.motorName}>{item.nickname || "Unnamed Motor"}</Text>
              <Text style={styles.motorDetail}>Model: {item.motorcycleData?.name || item.name || "Unknown Model"}</Text>
              <Text style={styles.motorDetail}>
                Fuel Efficiency: {item.fuelEfficiency ? `${item.fuelEfficiency} km/L` : "N/A"}
              </Text>
            </View>
          </TouchableOpacity>

          {/* Edit/Delete buttons */}
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
      ))
    )}
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
                    <Text style={styles.inputLabel}>Motor Nickname</Text>
                    <TextInput
                      value={formInputs.motorName}
                      onChangeText={(v) => setFormInputs((prev) => ({ ...prev, motorName: v }))}
                      style={styles.input}
                      placeholder="Enter nickname"
                      placeholderTextColor="#999"
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Motorcycle Model</Text>
                    <TouchableOpacity
                      onPress={() => setShowModelModal(true)}
                      style={styles.input}
                      disabled={!!motorForm.editingId}
                    >
                      <Text style={[
                        styles.selectText,
                        !motorForm.selectedMotor && styles.placeholderText
                      ]}>
                        {motorForm.selectedMotor || "Select model"}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Fuel Efficiency (km/L)</Text>
                    <View style={[styles.input, styles.disabledInput]}>
                      <Text style={styles.efficiencyText}>
                        {motorForm.fuelEfficiency ? `${motorForm.fuelEfficiency} km/L` : "Not set"}
                      </Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    onPress={handleSave}
                    disabled={isSubmitting}
                    style={styles.saveButton}
                  >
                    <LinearGradient
                      colors={['#00ADB5', '#00C2CC']}
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
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Model Name</Text>
                    <TextInput
                      value={customModelName}
                      onChangeText={setCustomModelName}
                      style={styles.input}
                      placeholder="Enter model name"
                      placeholderTextColor="#999"
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Initial Odometer Reading</Text>
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
                    <Text style={styles.inputLabel}>Final Odometer Reading</Text>
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
                    <Text style={styles.inputLabel}>Fuel Added (Liters)</Text>
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
                    onPress={async () => {
                      const distance = parseFloat(odoEnd) - parseFloat(odoStart);
                      const liters = parseFloat(litersAdded);
                      if (!customModelName || distance <= 0 || liters <= 0) {
                        return Alert.alert("Error", "Please fill all fields with valid values.");
                      }
                      const efficiency = distance / liters;
                      try {
                        const res = await fetch(`${LOCALHOST_IP}/api/motorcycles`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            model: customModelName,
                            fuelConsumption: parseFloat(efficiency.toFixed(2)),
                            engineDisplacement: 110,
                            power: "Custom",
                          }),
                        });
                        if (!res.ok) throw new Error();
                        await fetchMotorModels();
                        handleFormChange("selectedMotor", customModelName);
                        handleFormChange("fuelEfficiency", efficiency.toFixed(2));
                        setShowOdoModal(false);
                        setCustomModelName("");
                        setOdoStart("");
                        setOdoEnd("");
                        setLitersAdded("");
                      } catch {
                        Alert.alert("Error", "Failed to save model.");
                      }
                    }}
                    style={styles.saveButton}
                  >
                    <LinearGradient
                      colors={['#00ADB5', '#00C2CC']}
                      style={styles.saveButtonGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                    >
                      <Text style={styles.saveButtonText}>Save Model</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
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
  loader: {
    marginTop: 20,
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
  },
  disabledInput: {
    backgroundColor: '#F5F5F5',
  },
  selectText: {
    fontSize: 16,
    color: '#333',
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
});
