import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, Alert } from "react-native";
import tw from "twrnc";
import axios from "axios";
import { useUser } from "../../AuthContext/UserContextImproved";

export default function ChangePasswordScreen({ navigation }) {
  const { user } = useUser();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      return Alert.alert("Weak Password", "Password must be at least 6 characters.");
    }

    try {
      const res = await axios.put(`https://ts-backend-1-jyit.onrender.com/api/user/change-password`, {
        userId: user._id,
        currentPassword,
        newPassword,
      });

      Alert.alert("Success", "Password changed.");
      navigation.goBack();
    } catch (error) {
      Alert.alert("Error", error.response?.data?.message || "Something went wrong.");
    }
  };

  return (
    <View style={tw`flex-1 bg-white p-6`}>
      <Text style={tw`text-xl font-bold mb-4`}>Change Password</Text>
      <TextInput
        style={tw`border border-gray-300 rounded-lg p-3 mb-4`}
        placeholder="Current Password"
        secureTextEntry
        value={currentPassword}
        onChangeText={setCurrentPassword}
      />
      <TextInput
        style={tw`border border-gray-300 rounded-lg p-3 mb-4`}
        placeholder="New Password"
        secureTextEntry
        value={newPassword}
        onChangeText={setNewPassword}
      />
      <TouchableOpacity onPress={handleChangePassword} style={tw`bg-blue-500 p-4 rounded-lg`}>
        <Text style={tw`text-white text-center font-semibold`}>Update Password</Text>
      </TouchableOpacity>
    </View>
  );
}
