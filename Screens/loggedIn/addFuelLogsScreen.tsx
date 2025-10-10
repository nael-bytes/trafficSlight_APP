import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  Modal,
} from "react-native";
import DropDownPicker from "react-native-dropdown-picker";
import axios from "axios";
import { useUser } from "../../AuthContext/UserContext";
import { useNavigation } from "@react-navigation/native";
import { LOCALHOST_IP } from "@env";
import AsyncStorage from "@react-native-async-storage/async-storage";
const API_BASE = "https://ts-backend-1-jyit.onrender.com";

export default function AddFuelLogScreen() {
  const { user } = useUser();
  const navigation = useNavigation();

  const [motors, setMotors] = useState([]);
  const [selectedMotor, setSelectedMotor] = useState(null);
  const [liters, setLiters] = useState("");
  const [pricePerLiter, setPricePerLiter] = useState("");
  const [totalCost, setTotalCost] = useState("");
  const [computedField, setComputedField] = useState(null);

  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);

  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (user?._id) fetchMotors();
  }, [user]);

  const fetchMotors = async () => {
    try {
      // ✅ 1. Try loading cache first
      const cached = await AsyncStorage.getItem(`motors_${user._id}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        setMotors(parsed);
        setItems(
          parsed.map((motor) => ({
            label: motor.nickname || motor.name,
            value: motor._id,
          }))
        );
        console.log("Loaded motors from cache:", parsed);
      }

      // ✅ 2. Always fetch fresh data (to update cache)
      const res = await axios.get(`${API_BASE}/api/user-motors/user/${user._id}`);
      setMotors(res.data);
      setItems(
        res.data.map((motor) => ({
          label: motor.nickname || motor.name,
          value: motor._id,
        }))
      );

      // ✅ 3. Update cache with fresh data
      await AsyncStorage.setItem(`cachedMotors_${user._id}`, JSON.stringify(res.data));

      console.log("Fetched motors from API:", res.data);
    } catch (err) {
      console.error("Failed to fetch motors", err);
    }
  };

  const handleLitersChange = (value) => {
    setLiters(value);
    const l = parseFloat(value);
    const p = parseFloat(pricePerLiter);
    const t = parseFloat(totalCost);
    if (!isNaN(l) && !isNaN(p)) {
      setTotalCost((l * p).toFixed(2));
      setComputedField("totalCost");
    } else if (!isNaN(l) && !isNaN(t)) {
      setPricePerLiter((t / l).toFixed(2));
      setComputedField("pricePerLiter");
    } else {
      setComputedField(null);
    }
  };

  const handlePriceChange = (value) => {
    setPricePerLiter(value);
    const l = parseFloat(liters);
    const p = parseFloat(value);
    const t = parseFloat(totalCost);
    if (!isNaN(l) && !isNaN(p)) {
      setTotalCost((l * p).toFixed(2));
      setComputedField("totalCost");
    } else if (!isNaN(t) && !isNaN(p)) {
      setLiters((t / p).toFixed(2));
      setComputedField("liters");
    } else {
      setComputedField(null);
    }
  };

  const handleTotalCostChange = (value) => {
    setTotalCost(value);
    const l = parseFloat(liters);
    const p = parseFloat(pricePerLiter);
    const t = parseFloat(value);
    if (!isNaN(l) && !isNaN(t)) {
      setPricePerLiter((t / l).toFixed(2));
      setComputedField("pricePerLiter");
    } else if (!isNaN(p) && !isNaN(t)) {
      setLiters((t / p).toFixed(2));
      setComputedField("liters");
    } else {
      setComputedField(null);
    }
  };

  useEffect(() => {

    console.log("selectedMotor");
  });
  const handleConfirm = async () => {
    try {
      const payload = {
        userId: user._id,
        motorId: selectedMotor,
        liters: parseFloat(liters),
        pricePerLiter: parseFloat(pricePerLiter),
      };
      const newFuelLevel =
        (parseFloat(liters) / selectedMotor.motorcycleId.fuelTank) * 100;

        console.log(newFuelLevel);
        console.log(newFuelLevel);
      updateFuelLevel(selectedMotor._id, newFuelLevel);
      console.log(newFuelLevel);
      await axios.post(`${API_BASE}/api/fuel-logs`, payload);

      
      setShowModal(false);
      Alert.alert("Success", "Fuel log added successfully.");

      // ✅ Force refresh cache after new log
      fetchMotors();

      navigation.goBack();
    } catch (err) {
      console.error("Failed to add fuel log", err);
      Alert.alert("Error", "Something went wrong. Please try again.");
    }
  };

  const updateFuelLevel = async (motorId: string, newFuelLevel: number) => {
    try {
      const response = await fetch(`${LOCALHOST_IP}/api/user-motors/${motorId}/fuel`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentFuelLevel: newFuelLevel }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to update fuel level: ${response.status} ${errorText}`);
      }

      const updatedMotor = await response.json();
      console.log("✅ Fuel level updated:", updatedMotor);
    } catch (error: any) {
      console.error("❌ Error in updateFuelLevel:", error);
    }
  };

const handleSubmit = () => {
  if (!selectedMotor || !liters || !pricePerLiter || !totalCost) {
    return Alert.alert("Missing Fields", "Please complete at least two values.");
  }
  setShowModal(true);
};



return (
  <ScrollView contentContainerStyle={styles.container}>
    <Text style={styles.title}>Add Fuel Log</Text>

    <Text style={styles.label}>Select Motor</Text>
    <DropDownPicker
      open={open}
      value={selectedMotor}
      items={items}
      setOpen={setOpen}
      setValue={setSelectedMotor}
      setItems={setItems}
      placeholder="Select your motor"
      style={styles.dropdown}
      listMode="SCROLLVIEW" // <- avoid FlatList warning
    />

    <Text style={styles.label}>Liters Fueled</Text>
    <TextInput
      keyboardType="numeric"
      value={liters}
      onChangeText={handleLitersChange}
      style={[styles.input, computedField === "liters" && styles.highlightInput]}
      placeholder="e.g., 4.5"
    />

    <Text style={styles.label}>Price per Liter</Text>
    <TextInput
      keyboardType="numeric"
      value={pricePerLiter}
      onChangeText={handlePriceChange}
      style={[styles.input, computedField === "pricePerLiter" && styles.highlightInput]}
      placeholder="e.g., 65.00"
    />

    <Text style={styles.label}>Total Amount Paid</Text>
    <TextInput
      keyboardType="numeric"
      value={totalCost}
      onChangeText={handleTotalCostChange}
      style={[styles.input, computedField === "totalCost" && styles.highlightInput]}
      placeholder="e.g., 250"
    />

    <TouchableOpacity style={styles.button} onPress={handleSubmit}>
      <Text style={styles.buttonText}>Submit</Text>
    </TouchableOpacity>

    <Modal visible={showModal} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <Text style={styles.modalTitle}>Confirm Fuel Log</Text>
          <Text style={styles.modalText}>Liters: {liters}</Text>
          <Text style={styles.modalText}>Price per Liter: ₱{pricePerLiter}</Text>
          <Text style={styles.modalText}>Total: ₱{totalCost}</Text>
          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowModal(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm}>
              <Text style={styles.confirmText}>Confirm</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  </ScrollView>
);

}

const styles = StyleSheet.create({
  container: {
    paddingTop: 50,
    padding: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: "#fff",
  },
  highlightInput: {
    backgroundColor: "#fff9c4", // light yellow
    borderColor: "#fbc02d",
  },
  dropdown: {
    borderColor: "#ccc",
    marginBottom: 10,
  },
  button: {
    backgroundColor: "#007AFF",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 20,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContainer: {
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 10,
    width: "80%",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 10,
    textAlign: "center",
  },
  modalText: {
    fontSize: 16,
    marginVertical: 4,
    textAlign: "center",
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 20,
  },
  cancelBtn: {
    padding: 10,
    backgroundColor: "#ccc",
    borderRadius: 8,
    flex: 1,
    marginRight: 10,
  },
  confirmBtn: {
    padding: 10,
    backgroundColor: "#007AFF",
    borderRadius: 8,
    flex: 1,
  },
  cancelText: {
    color: "#333",
    textAlign: "center",
    fontWeight: "bold",
  },
  confirmText: {
    color: "#fff",
    textAlign: "center",
    fontWeight: "bold",
  },
});
