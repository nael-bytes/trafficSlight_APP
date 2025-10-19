import React, { useState } from "react";
import {
  View, Text, TextInput, StyleSheet, ScrollView, TouchableOpacity, Alert
} from "react-native";
import { RouteProp, useNavigation } from "@react-navigation/native";
import Icon from "react-native-vector-icons/Ionicons";

type RootStackParamList = {
  MotorDetails: { item: any };
  MotorList: { fullList: any[] };
};

type Props = {
  route: RouteProp<RootStackParamList, "MotorDetails">;
};

export default function MotorDetailsScreen({ route }: Props) {
  const { item } = route.params;
  const navigation = useNavigation();
  const [loading, setLoading] = useState(false);

  // Add safety check for item
  if (!item) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>No motor data available</Text>
      </View>
    );
  }

  // Initialize state with defaults for nested objects
  const [formData, setFormData] = useState({
    ...item,
    fuelConsumptionStats: {
      average: 0,
      max: 0,
      min: 0,
      ...(item.fuelConsumptionStats || {}),
    },
    analytics: {
      tripsCompleted: 0,
      totalDistance: 0,
      totalFuelUsed: 0,
      maintenanceAlerts: [],
      ...(item.analytics || {}),
    },
  });

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setLoading(true);

    try {
      // Remove virtual fields before sending
      const { totalDrivableDistance, totalDrivableDistanceWithCurrentGas, isLowFuel, ...rest } = formData;

      const payload = {
        ...rest,
        age: Number(rest.age) || 0,
        currentFuelLevel: Number(rest.currentFuelLevel) || 0,
        currentOdometer: Number(rest.currentOdometer) || 0,
        odometerAtAcquisition: Number(rest.odometerAtAcquisition) || 0,
        fuelConsumptionStats: {
          average: Number(rest.fuelConsumptionStats?.average) || 0,
          max: Number(rest.fuelConsumptionStats?.max) || 0,
          min: Number(rest.fuelConsumptionStats?.min) || 0,
        },
        analytics: {
          ...rest.analytics,
          tripsCompleted: Number(rest.analytics?.tripsCompleted) || 0,
          totalDistance: Number(rest.analytics?.totalDistance) || 0,
          totalFuelUsed: Number(rest.analytics?.totalFuelUsed) || 0,
          maintenanceAlerts: rest.analytics?.maintenanceAlerts || [],
        },
      };

      const response = await fetch(
        `https://ts-backend-1-jyit.onrender.com/api/user-motors/${rest._id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) throw new Error(`Failed to update motor details: ${response.status}`);

      // Safely parse JSON response
      let updatedData: any = null;
      try {
        updatedData = await response.json();
      } catch {
        console.log("PUT response is not JSON, keeping previous state");
      }

      if (updatedData) {
        // Reapply nested defaults to avoid blank fields
        setFormData({
          ...updatedData,
          fuelConsumptionStats: {
            average: 0,
            max: 0,
            min: 0,
            ...updatedData.fuelConsumptionStats,
          },
          analytics: {
            tripsCompleted: 0,
            totalDistance: 0,
            totalFuelUsed: 0,
            maintenanceAlerts: [],
            ...updatedData.analytics,
          },
          // Keep virtual fields intact
          totalDrivableDistance: formData.totalDrivableDistance,
          totalDrivableDistanceWithCurrentGas: formData.totalDrivableDistanceWithCurrentGas,
          isLowFuel: formData.isLowFuel,
        });
      }

      Alert.alert("✅ Success", "Motor details updated successfully!");
      console.log("Updated:", updatedData ?? payload);
    } catch (error) {
      console.error("Error updating motor:", error);
      Alert.alert("❌ Error", "Failed to update motor details.");
    } finally {
      setLoading(false);

    }
  };
  {/* Timestamps */ }




  const fieldTitles: Record<string, string> = {
    motorcycleId: "Motorcycle ID",
    name: "Name",
    nickname: "Nickname",
    fuelEfficiency: "Fuel Efficiency",
    currentFuelLevel: "Current Fuel Level (%)",
    totalDrivableDistance: "Total Drivable Distance (km)",
    totalDrivableDistanceWithCurrentGas: "Total Drivable Distance (Current Fuel)",
    tripsCompleted: "Trips Completed",
    totalDistance: "Total Distance (km)",
    totalFuelUsed: "Total Fuel Used (L)",
    createdAt: "Created At",
    updatedAt: "Updated At",
  };
  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Back Button */}
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Icon name="arrow-back" size={24} color="#333" />
        <Text style={styles.backText}>Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Motor Details</Text>

      {/* Helper mapping for nice labels */}


      {/* Basic Info */}
      <Text style={styles.sectionTitle}>Basic Info</Text>
      {["motorcycleId", "name", "nickname", "fuelEfficiency"].map(field => (
        <View style={styles.section} key={field}>
          <Text style={styles.label}>{fieldTitles[field]}</Text>
          <TextInput
            style={styles.input}
            value={String(formData[field] ?? "")}
            onChangeText={text => handleChange(field, text)}
            keyboardType={["fuelEfficiency"].includes(field) ? "numeric" : "default"}
          />
        </View>
      ))}

      {/* Fuel Tracking */}
      <Text style={styles.sectionTitle}>Fuel Tracking</Text>
      <View style={styles.section}>
        <Text style={styles.label}>{fieldTitles.currentFuelLevel}</Text>
        <TextInput
  style={styles.input}
  value={
    formData.currentFuelLevel !== undefined && formData.currentFuelLevel !== null
      ? Number(formData.currentFuelLevel).toFixed(0)
      : ""
  }
  onChangeText={text => handleChange("currentFuelLevel", text)}
  keyboardType="numeric"
/>

      </View>

      {/* Virtual Fields */}
      <Text style={styles.sectionTitle}>Automatic Fields</Text>
      {["totalDrivableDistance", "totalDrivableDistanceWithCurrentGas"].map(vf => (
        <View style={styles.section} key={vf}>
          <Text style={styles.label}>{fieldTitles[vf]}</Text>
          <TextInput
            style={[styles.input, { backgroundColor: "#EEE" }]}
            value={
              formData[vf] !== undefined && formData[vf] !== null
                ? `${formData[vf].toFixed(2)} km`
                : ""
            }
            editable={false}
          />
        </View>
      ))}

      {/* Analytics */}
      <Text style={styles.sectionTitle}>Analytics</Text>
      {["tripsCompleted", "totalDistance", "totalFuelUsed"].map(stat => {
        let value = formData.analytics?.[stat];

        // Format numbers to 2 decimals for distance/fuel
        if (stat === "totalDistance" || stat === "totalFuelUsed") {
          value = value !== undefined && value !== null ? value.toFixed(2) : "";
        }

        // Append units
        let displayValue = value;
        if (stat === "totalDistance" && value !== "") displayValue = `${value}`;
        if (stat === "totalFuelUsed" && value !== "") displayValue = `${value}`;

        return (
          <View style={styles.section} key={stat}>
            <Text style={styles.label}>{fieldTitles[stat]}</Text>
            <TextInput
              style={styles.input}
              value={String(displayValue)}
              onChangeText={text =>
                setFormData(prev => ({
                  ...prev,
                  analytics: { ...prev.analytics, [stat]: text },
                }))
              }
              keyboardType="numeric"
            />
          </View>
        );
      })}
      {/* Timestamps */}
      <Text style={styles.sectionTitle}>Timestamps</Text>
      {["createdAt", "updatedAt"].map(field => {
        const rawDate = formData[field];
        let formattedDate = "";
        if (rawDate) {
          const dateObj = new Date(rawDate);
          formattedDate = dateObj.toLocaleString("en-US", {
            year: "numeric",
            month: "short",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: true,
          });
        }

        return (
          <View style={styles.section} key={field}>
            <Text style={styles.label}>{fieldTitles[field]}</Text>
            <TextInput
              style={[styles.input, { backgroundColor: "#EEE" }]}
              value={formattedDate}
              editable={false}
            />
          </View>
        );
      })}


      {/* Save Button */}
      <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={loading}>
        <Text style={styles.saveText}>
          {loading ? "⏳ Saving..." : "💾 Save Changes"}
        </Text>
      </TouchableOpacity>
    </ScrollView>

  );
}

const styles = StyleSheet.create({
  container: { padding: 20, backgroundColor: "#F7F8FA" },
  backButton: { flexDirection: "row", alignItems: "center", marginBottom: 20 },
  backText: { marginLeft: 8, fontSize: 16, color: "#4A4A4A", fontWeight: "500" },
  title: { fontSize: 24, fontWeight: "700", color: "#1F1F1F", marginBottom: 20, textAlign: "center" },
  section: { backgroundColor: "#FFF", borderRadius: 12, padding: 16, marginBottom: 16, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 3 },
  sectionTitle: { fontSize: 18, fontWeight: "600", color: "#2F80ED", marginBottom: 12, borderBottomWidth: 1, borderBottomColor: "#E0E0E0", paddingBottom: 6 },
  label: { fontSize: 14, color: "#555", marginBottom: 6, fontWeight: "500" },
  input: { borderWidth: 1, borderColor: "#D1D5DB", borderRadius: 10, padding: 12, fontSize: 16, backgroundColor: "#FAFAFA" },
  saveButton: { backgroundColor: "#2F80ED", paddingVertical: 16, borderRadius: 12, marginTop: 20, alignItems: "center", shadowColor: "#2F80ED", shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 5 },
  saveText: { fontSize: 18, color: "#FFF", fontWeight: "700" },
  errorText: { fontSize: 16, color: "#FF6B6B", textAlign: "center", marginTop: 50 },
});
