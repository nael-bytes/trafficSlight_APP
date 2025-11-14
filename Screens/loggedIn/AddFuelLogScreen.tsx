import React, { useState, useEffect } from "react";
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
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useUser } from "../../AuthContext/UserContextImproved";
import { LOCALHOST_IP } from "@env";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiRequest, updateFuelLevelByLiters } from "../../utils/api";

export default function AddFuelLogScreen() {
  const navigation = useNavigation();
  const { user } = useUser();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [motors, setMotors] = useState<any[]>([]);
  const [selectedMotor, setSelectedMotor] = useState<any | null>(null);
  const [showMotorModal, setShowMotorModal] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const [formData, setFormData] = useState({
    date: new Date(),
    totalCost: "",
    pricePerLiter: "",
    odometer: "",
    notes: "",
  });

  useEffect(() => {
    if (user?._id) fetchUserMotors();
    
  }, [user]);

  const fetchUserMotors = async () => {
    if (!user?._id) return;
    const cacheKey = `cachedMotors_${user._id}`;

    try {
      // ✅ Load from cache first
      const cached = await AsyncStorage.getItem(cacheKey);
      if (cached) setMotors(JSON.parse(cached));

      // ✅ Fetch fresh data
      const res = await fetch(`${LOCALHOST_IP}/api/user-motors/user/${user._id}`);
      if (!res.ok) throw new Error("Failed to fetch motors from API");

      const data = await res.json();
      setMotors(data);

      // ✅ Update cache
      await AsyncStorage.setItem(cacheKey, JSON.stringify(data));
    } catch (err) {
      console.error("❌ fetchUserMotors error:", err);
      Alert.alert("Error", "Failed to load your motors. Please try again.");
    }
  };

  const handleFormChange = (field: string, value: string | Date) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const validateForm = () => {
    if (!selectedMotor) return "Please select a motor";
    if (!formData.totalCost || isNaN(Number(formData.totalCost)) || Number(formData.totalCost) <= 0)
      return "Enter a valid total cost";
    if (!formData.pricePerLiter || isNaN(Number(formData.pricePerLiter)) || Number(formData.pricePerLiter) <= 0)
      return "Enter a valid price per liter";
    // Odometer is now optional - only validate if provided
    if (formData.odometer && (isNaN(Number(formData.odometer)) || Number(formData.odometer) < 0))
      return "Enter a valid odometer reading";
    return null;
  };

  const handleSave = async () => {
    const errorMsg = validateForm();
    if (errorMsg || !user?._id) {
      if (errorMsg) Alert.alert("Error", errorMsg);
      return;
    }

    setIsSubmitting(true);
    try {
      // Calculate liters from total cost and price per liter
      const totalCost = Number(formData.totalCost);
      const pricePerLiter = Number(formData.pricePerLiter);
      const liters = totalCost / pricePerLiter;

      const payload: any = {
        userId: user._id,
        motorId: selectedMotor._id,
        date: formData.date,
        liters: liters,
        pricePerLiter: pricePerLiter,
        totalCost: totalCost,
        notes: formData.notes || "",
      };

      // Odometer is optional - only include if provided
      if (formData.odometer && !isNaN(Number(formData.odometer))) {
        payload.odometer = Number(formData.odometer);
      }

      // Use apiRequest utility for consistent authentication and error handling
      await apiRequest('/api/fuel-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      // Update fuel level using the liters endpoint (automatically converts to percentage)
      // This endpoint handles overflow, conversion, and calculates all derived values
      // Note: The endpoint sets fuel level TO the provided liters, so we need to calculate
      // the total liters (current + added) before calling it
      if (liters > 0 && selectedMotor.motorcycleId?.fuelTank) {
        try {
          // Calculate current fuel in liters
          const currentFuelPercentage = selectedMotor.currentFuelLevel || 0;
          const fuelTankCapacity = selectedMotor.motorcycleId.fuelTank;
          const currentFuelInLiters = (currentFuelPercentage / 100) * fuelTankCapacity;
          
          // Calculate total fuel after adding the refueled liters
          const totalFuelInLiters = currentFuelInLiters + liters;
          
          // Call the endpoint with total liters (it will clamp to tank capacity if overflow)
          const fuelUpdateResult = await updateFuelLevelByLiters(selectedMotor._id, totalFuelInLiters);
          if (__DEV__) {
            console.log('[AddFuelLog] Fuel level updated by liters:', {
              motorId: selectedMotor._id,
              litersAdded: liters,
              currentFuelInLiters: currentFuelInLiters.toFixed(2),
              totalFuelInLiters: totalFuelInLiters.toFixed(2),
              oldLevel: selectedMotor.currentFuelLevel,
              newLevel: fuelUpdateResult?.motor?.fuelLevel?.percentage,
              actualLiters: fuelUpdateResult?.motor?.fuelLevel?.liters,
              fuelTankCapacity: fuelUpdateResult?.motor?.fuelLevel?.fuelTankCapacity,
              overflow: fuelUpdateResult?.conversion?.overflow,
            });
          }
        } catch (fuelError: any) {
          // Log error but don't fail the entire operation
          // The fuel log was saved successfully, fuel level update is secondary
          console.warn('[AddFuelLog] Failed to update fuel level (fuel log was saved):', fuelError?.message || fuelError);
        }
      } else if (liters > 0 && !selectedMotor.motorcycleId?.fuelTank) {
        // Warn if fuel tank capacity is not set
        console.warn('[AddFuelLog] Cannot update fuel level: fuel tank capacity not set for motor');
      }

      await fetchUserMotors(); // refresh cache

      Alert.alert("✅ Success", "Fuel log added successfully!");
      navigation.goBack();
    } catch (err: any) {
      console.error("❌ handleSave error:", err);
      const errorMessage = err?.message || "Failed to save fuel log. Please try again.";
      Alert.alert("Error", errorMessage);
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
        <LinearGradient
          colors={["#00ADB5", "#00C2CC"]}
          style={styles.header}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        >
          <View style={styles.headerContent}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.backButton}
            >
              <Ionicons name="close" size={24} color="#FFF" />
            </TouchableOpacity>
            <View>
              <Text style={styles.headerTitle}>Add Fuel Log</Text>
              <Text style={styles.headerSubtitle}>
                Record your refueling details
              </Text>
            </View>
          </View>
        </LinearGradient>

        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView style={styles.content}>
            {/* Motor Selection */}
            <TouchableOpacity
              style={styles.selectButton}
              onPress={() => setShowMotorModal(true)}
            >
              <Text style={styles.selectButtonLabel}>
                {selectedMotor ? selectedMotor.nickname : "Select Motor"}
              </Text>
              <Ionicons name="chevron-down" size={20} color="#00ADB5" />
            </TouchableOpacity>

            {/* Date Picker */}
            <TouchableOpacity
              style={styles.selectButton}
              onPress={() => setShowDatePicker(true)}
            >
              <Text style={styles.selectButtonLabel}>
                {formData.date.toLocaleDateString("en-PH", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </Text>
              <Ionicons name="calendar" size={20} color="#00ADB5" />
            </TouchableOpacity>

            {/* Total Cost */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Total Cost (₱)</Text>
              <TextInput
                style={styles.input}
                value={formData.totalCost}
                onChangeText={(value) => handleFormChange("totalCost", value)}
                keyboardType="decimal-pad"
                placeholder="Enter total cost"
                placeholderTextColor="#999"
              />
            </View>

            {/* Price per Liter */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Price per Liter (₱)</Text>
              <TextInput
                style={styles.input}
                value={formData.pricePerLiter}
                onChangeText={(value) => handleFormChange("pricePerLiter", value)}
                keyboardType="decimal-pad"
                placeholder="Enter price per liter"
                placeholderTextColor="#999"
              />
              {(() => {
                const totalCostNum = Number(formData.totalCost);
                const pricePerLiterNum = Number(formData.pricePerLiter);
                const isValid = formData.totalCost && formData.pricePerLiter && 
                               !isNaN(totalCostNum) && 
                               !isNaN(pricePerLiterNum) && 
                               pricePerLiterNum > 0;
                return isValid ? (
                  <Text style={styles.calculatedText}>
                    Quantity: {(totalCostNum / pricePerLiterNum).toFixed(2)} L
                  </Text>
                ) : null;
              })()}
            </View>

            {/* Odometer Reading (Optional) */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Odometer Reading (Optional)</Text>
              <TextInput
                style={styles.input}
                value={formData.odometer}
                onChangeText={(value) => handleFormChange("odometer", value)}
                keyboardType="numeric"
                placeholder="Enter odometer reading (optional)"
                placeholderTextColor="#999"
              />
            </View>

            {/* Notes */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Notes (Optional)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={formData.notes}
                onChangeText={(value) => handleFormChange("notes", value)}
                placeholder="Add any notes about this refueling"
                placeholderTextColor="#999"
                multiline
                numberOfLines={3}
              />
            </View>

            {/* Save Button */}
            <TouchableOpacity
              style={[
                styles.saveButton,
                isSubmitting && styles.saveButtonDisabled,
              ]}
              onPress={handleSave}
              disabled={isSubmitting}
            >
              <LinearGradient
                colors={["#00ADB5", "#00C2CC"]}
                style={styles.saveButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#FFF" />
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
            display={Platform.OS === "ios" ? "spinner" : "default"}
            onChange={(event, selectedDate) => {
              setShowDatePicker(false);
              if (selectedDate) handleFormChange("date", selectedDate);
            }}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: { flex: 1, backgroundColor: "#F2EEEE" },
  header: { width: "100%" },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    paddingTop: Platform.OS === "android" ? 20 : 16,
  },
  backButton: { padding: 8, marginRight: 8 },
  headerTitle: { fontSize: 24, fontWeight: "600", color: "#FFF", marginBottom: 4 },
  headerSubtitle: { fontSize: 14, color: "rgba(255,255,255,0.8)" },
  content: { flex: 1, padding: 16 },
  selectButton: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#FFF",
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    elevation: 3,
  },
  selectButtonLabel: { fontSize: 16, color: "#333" },
  inputGroup: { marginBottom: 16 },
  label: { fontSize: 14, color: "#666", marginBottom: 8, fontWeight: "500" },
  input: {
    backgroundColor: "#FFF",
    padding: 16,
    borderRadius: 12,
    fontSize: 16,
    color: "#333",
    elevation: 3,
  },
  calculatedText: {
    fontSize: 12,
    color: "#00ADB5",
    marginTop: 4,
    fontStyle: "italic",
  },
  textArea: { height: 100, textAlignVertical: "top" },
  saveButton: {
    marginVertical: 24,
    borderRadius: 12,
    overflow: "hidden",
    elevation: 4,
  },
  saveButtonDisabled: { opacity: 0.7 },
  saveButtonGradient: { padding: 16, alignItems: "center" },
  saveButtonText: { color: "#FFF", fontSize: 16, fontWeight: "600" },
  motorModalContainer: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  motorModalContent: {
    backgroundColor: "#FFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 16,
    maxHeight: "80%",
  },
  motorModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#EEE",
    marginBottom: 16,
  },
  motorModalTitle: { fontSize: 20, fontWeight: "600", color: "#333" },
  motorOption: { padding: 16, borderBottomWidth: 1, borderBottomColor: "#EEE" },
  motorOptionText: { fontSize: 16, color: "#333", marginBottom: 4 },
  motorOptionSubtext: { fontSize: 14, color: "#666" },
});
