import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, Alert } from "react-native";
import tw from "twrnc";
import axios from "axios";
import { useUser } from "../../AuthContext/UserContextImproved";

export default function ChangeEmailScreen({ navigation }) {
  const { user } = useUser();
  const [newEmail, setNewEmail] = useState("");

  const handleEmailChange = async () => {
    if (!newEmail.includes("@")) {
      return Alert.alert("Invalid Email", "Please enter a valid email.");
    }

    try {
      const res = await axios.put(`https://ts-backend-1-jyit.onrender.com/api/user/change-email`, {
        userId: user._id,
        newEmail,
      });

      Alert.alert("Success", "Email updated successfully.");
      navigation.goBack();
    } catch (error) {
      Alert.alert("Error", error.response?.data?.message || "Something went wrong.");
    }
  };

  return (
    <View style={tw`flex-1 bg-white p-6`}>
      <Text style={tw`text-xl font-bold mb-4`}>Change Email</Text>
      <TextInput
        style={tw`border border-gray-300 rounded-lg p-3 mb-4`}
        placeholder="Enter new email"
        value={newEmail}
        onChangeText={setNewEmail}
        keyboardType="email-address"
      />
      <TouchableOpacity onPress={handleEmailChange} style={tw`bg-blue-500 p-4 rounded-lg`}>
        <Text style={tw`text-white text-center font-semibold`}>Update Email</Text>
      </TouchableOpacity>
    </View>
  );
}
