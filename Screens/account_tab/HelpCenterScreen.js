import React from "react";
import { 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Platform,
  Alert,
} from "react-native";
import tw from "twrnc";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from 'expo-linear-gradient';
import axios from "axios";
import { LOCALHOST_IP } from "@env"; // Replace with your actual IP or API base
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useUser } from "../../AuthContext/UserContext";

export default function HelpCenterScreen({ navigation }) {

  const {user} = useUser();
  // 🔄 Reset all cache for a specific user
const resetUserCache = async (userId) => {
  try {
    // AsyncStorage.clear();
    const keys = [
      `cachedMotors_${userId}`,
      `cachedTrips_${userId}`,
      `cachedDestinations_${userId}`,
      `cachedFuelLogs_${userId}`,
      `cachedMaintenance_${userId}`,
      `cachedGasStations_${userId}`,
    ];

    await AsyncStorage.multiRemove(keys);
    console.log(`🗑️ Cache cleared for user: ${userId}`);
  } catch (err) {
    console.error("Failed to reset cache:", err);
  }
};


  const handleRecalculateAnalytics = async () => {
    try {
      const res = await axios.put(`${LOCALHOST_IP}/api/user-motors/fix-motor-analytics`);
      Alert.alert("Success", res.data.msg || "Analytics updated successfully");
    } catch (error) {
      console.error("Recalculation failed", error);
      Alert.alert("Error", error.response?.data?.msg || "Failed to update analytics");
    }
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
              <Text style={tw`text-2xl font-semibold text-white mb-1`}>Help Center</Text>
              <Text style={tw`text-sm text-white opacity-80`}>Frequently Asked Questions</Text>
            </View>
          </View>
        </LinearGradient>
      </View>

      {/* Scrollable FAQ Section */}
      <ScrollView style={tw`p-4`} showsVerticalScrollIndicator={false}>
        <View style={tw`bg-white rounded-2xl p-5 shadow-sm`}>
          {/* Existing FAQ Items */}
          <View style={tw`mb-6 p-4 border border-gray-200 rounded-xl bg-[#F8F9FA]`}>
            <Text style={tw`font-semibold text-base text-gray-800`}>How do I add a motorcycle?</Text>
            <Text style={tw`text-gray-600 mt-2`}>
              Go to the "Add Motor" screen from the Account tab. Fill in the model, nickname, plate number, and select your motorcycle from the list.
            </Text>
          </View>

          <View style={tw`mb-6 p-4 border border-gray-200 rounded-xl bg-[#F8F9FA]`}>
            <Text style={tw`font-semibold text-base text-gray-800`}>How does fuel tracking work?</Text>
            <Text style={tw`text-gray-600 mt-2`}>
              After adding a motor, you can log fuel consumption by inputting liters, total cost, and other details. You'll find it under the Fuel Logs section.
            </Text>
          </View>

          <View style={tw`mb-6 p-4 border border-gray-200 rounded-xl bg-[#F8F9FA]`}>
            <Text style={tw`font-semibold text-base text-gray-800`}>How can I use the map and navigation?</Text>
            <Text style={tw`text-gray-600 mt-2`}>
              Select a destination from the map. The app will generate a route and provide fuel estimates based on your selected motorcycle's data.
            </Text>
          </View>

          <View style={tw`mb-6 p-4 border border-gray-200 rounded-xl bg-[#F8F9FA]`}>
            <Text style={tw`font-semibold text-base text-gray-800`}>How do I submit a traffic report?</Text>
            <Text style={tw`text-gray-600 mt-2`}>
              Tap the alert button on the main map screen to submit reports like accidents, road closures, or hazards. Your location will be auto-filled.
            </Text>
          </View>


          <TouchableOpacity
      style={tw`bg-[#00ADB5] py-3 rounded-xl items-center`}
      onPress={() => resetUserCache(user._id)}
    >
  <Text style={tw`text-white font-semibold text-lg`}>Reset Cache</Text>
</TouchableOpacity>

          {/* ✅ Added Button at Bottom */}
          <View style={tw`mt-8`}>
            <TouchableOpacity
              onPress={handleRecalculateAnalytics}
              style={tw`bg-[#00ADB5] py-3 rounded-xl items-center`}
            >
              <Text style={tw`text-white font-semibold text-lg`}>🔁 Recalculate All Analytics</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
