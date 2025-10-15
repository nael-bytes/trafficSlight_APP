import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  TextInput,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Platform,
} from "react-native";
import { Portal, Modal, List } from "react-native-paper";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from 'expo-linear-gradient';
import tw from "twrnc";
import axios from "axios";
import { useUser } from "../../AuthContext/UserContextImproved";
import { LOCALHOST_IP } from "@env";

const API_BASE = 'https://ts-backend-1-jyit.onrender.com';

const barangays = [
  "Arkong Bato", "Bagbaguin", "Bignay", "Bisig", "Canumay East", "Canumay West", "Coloong",
  "Dalandanan", "Gen. T. De Leon", "Karuhatan", "Lawang Bato", "Lingunan", "Malanday",
  "Mapulang Lupa", "Malinta", "Maysan", "Palasan", "Parada", "Paso de Blas", "Pasolo", "Polo",
  "Punturin", "Rincon", "Tagalag", "Ugong", "Veinte Reales", "Wawang Pulo",
];

export default function AccountSettingsScreen({ navigation }) {
  const { user, saveUser, clearUser } = useUser();
  const [barangayModal, setBarangayModal] = useState(false);

  const [form, setForm] = useState({
    name: "",
    email: "",
    city: "",
    province: "",
    barangay: "",
    street: "",
  });

  useEffect(() => {
    if (user) {
      setForm({
        id: user._id, // 👈 Include this
        name: user.name,
        email: user.email,
        city: user.city,
        province: user.province,
        barangay: user.barangay,
        street: user.street,
      });
    }
  }, [user]);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    try {
      const res = await axios.put(`${LOCALHOST_IP}/api/auth/update-profile`, form, {
        headers: {
          Authorization: `Bearer ${user?.token}`,
        },
      });

      Alert.alert("Success", "Profile updated successfully");
      saveUser({ ...user, ...res.data.user });
    } catch (err) {
      console.error("Update error:", err);
      Alert.alert("Error", err?.response?.data?.msg || "Update failed");
    }
  };

  const handleLogout = () => {
    Alert.alert(
      "Confirm Logout",
      "Are you sure you want to log out?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Logout",
          onPress: () => {
            clearUser();
            navigation.replace("Login");
          },
          style: "destructive",
        },
      ],
      { cancelable: true }
    );
  };

  return (
    <SafeAreaView style={tw`flex-1 bg-[#F2EEEE]`}>
      <StatusBar barStyle="light-content" backgroundColor="#00ADB5" />
      
      {/* Header */}
      <View style={tw`w-full bg-[#00ADB5]`}>
        <LinearGradient
          colors={['#00ADB5', '#00C2CC']}
          style={tw`w-full`}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        >
          <View style={tw`flex-row items-center p-4 pt-${Platform.OS === 'android' ? '6' : '4'}`}>
            <TouchableOpacity 
              onPress={() => navigation.goBack()}
              style={tw`p-2 mr-2`}
            >
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <View style={tw`flex-1`}>
              <Text style={tw`text-2xl font-semibold text-white mb-1`}>Account Settings</Text>
              <Text style={tw`text-sm text-white opacity-80`}>Manage your profile information</Text>
            </View>
          </View>
        </LinearGradient>
      </View>

      {/* Form */}
      <ScrollView style={tw`p-4`}>
        <View style={tw`bg-white rounded-2xl p-5 shadow-sm mb-4`}>
          {[
            { label: "Name", key: "name" },
            { label: "Email", key: "email" },
            { label: "City", key: "city" },
            { label: "Province", key: "province" },
          ].map(({ label, key }) => (
            <View key={key} style={tw`mb-4`}>
              <Text style={tw`text-sm font-medium text-gray-700 mb-1`}>{label}</Text>
              <TextInput
                value={form[key]}
                onChangeText={(value) => handleChange(key, value)}
                editable={key !== "email" && key !== "city" && key !== "province"}
                style={tw.style(
                  'border border-gray-200 rounded-xl px-4 py-3 bg-[#F8F9FA]',
                  key === "email" || key === "city" || key === "province" ? 'text-gray-400' : 'text-gray-800'
                )}
                placeholder={`Enter ${label.toLowerCase()}`}
              />
            </View>
          ))}

          {/* Barangay before Street */}
          <View style={tw`mb-4`}>
            <Text style={tw`text-sm font-medium text-gray-700 mb-1`}>Barangay</Text>
            <TouchableOpacity
              style={tw`border border-gray-200 rounded-xl px-4 py-3 bg-[#F8F9FA]`}
              onPress={() => setBarangayModal(true)}
            >
              <Text style={tw`${form.barangay ? "text-gray-800" : "text-gray-400"}`}>
                {form.barangay || "Select Barangay"}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={tw`mb-4`}>
            <Text style={tw`text-sm font-medium text-gray-700 mb-1`}>Street</Text>
            <TextInput
              value={form["street"]}
              onChangeText={(value) => handleChange("street", value)}
              style={tw`border border-gray-200 rounded-xl px-4 py-3 bg-[#F8F9FA] text-gray-800`}
              placeholder="Enter street"
            />
          </View>

          {/* Save Button */}
          <TouchableOpacity
            onPress={handleSave}
            style={tw`mt-6 overflow-hidden rounded-xl`}
          >
            <LinearGradient
              colors={['#00ADB5', '#00C2CC']}
              style={tw`p-4 items-center`}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Text style={tw`text-white font-semibold text-base`}>Save Changes</Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* Logout Button */}
          <TouchableOpacity
            style={tw`mt-4 bg-red-500 p-4 rounded-xl flex-row items-center justify-center`}
            onPress={handleLogout}
          >
            <Ionicons name="log-out-outline" size={22} color="white" />
            <Text style={tw`ml-3 text-white text-base font-semibold`}>Log Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Barangay Modal */}
      <Portal>
        <Modal
          visible={barangayModal}
          onDismiss={() => setBarangayModal(false)}
          contentContainerStyle={{
            backgroundColor: "white",
            margin: 20,
            padding: 20,
            borderRadius: 16,
            maxHeight: "80%",
          }}
        >
          <Text style={tw`text-xl font-semibold mb-4`}>
            Select Your Barangay
          </Text>
          <ScrollView>
            {barangays.map((b) => (
              <List.Item
                key={b}
                title={b}
                onPress={() => {
                  handleChange("barangay", b);
                  setBarangayModal(false);
                }}
                style={tw`rounded-xl`}
              />
            ))}
          </ScrollView>
        </Modal>
      </Portal>
    </SafeAreaView>
  );
}
