import React, { useState } from "react";
import { View, Alert, StyleSheet, Text } from "react-native";
import { TextInput, Button } from "react-native-paper";
import { LOCALHOST_IP } from "@env";



export default function ForgotPasswordScreen({ navigation }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);


  const handleRequestOtp = async () => {
    if (!email) return Alert.alert("Missing", "Please enter your email.");
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return Alert.alert("Invalid Email", "Please enter a valid email address.");
    }

    setLoading(true);
    try {
      // Uses: POST /api/auth/reset-password (as per API documentation)
      // Use API_BASE or LOCALHOST_IP depending on what's configured
      const API_BASE = LOCALHOST_IP || "https://ts-backend-1-jyit.onrender.com";
      const res = await fetch(`${API_BASE}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      // Check response status before parsing JSON
      let data;
      try {
        data = await res.json();
      } catch (parseError) {
        console.error('[ForgotPassword] Failed to parse response:', parseError);
        Alert.alert("Error", `Server returned invalid response (Status: ${res.status}). Please try again.`);
        return;
      }

      if (res.ok) {
        Alert.alert("Reset Code Sent", "Check your email for a reset code.");
        // Store the token if provided in response (for testing/dev)
        const resetToken = data.token || data.resetToken;
        if (resetToken) {
          navigation.navigate("ResetOtp", { email, token: resetToken });
        } else {
          navigation.navigate("ResetOtp", { email });
        }
      } else {
        // Show detailed error message from server
        const errorMsg = data?.message || data?.msg || data?.error || `Server error (Status: ${res.status})`;
        console.error('[ForgotPassword] Server error:', {
          status: res.status,
          statusText: res.statusText,
          data: data,
          email: email
        });
        Alert.alert("Error", errorMsg);
      }
    } catch (err) {
      console.error('[ForgotPassword] Network error:', err);
      Alert.alert("Error", err.message || "Failed to connect to server. Please check your internet connection.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Forgot Password</Text>
      <TextInput
        label="Email"
        value={email}
        onChangeText={setEmail}
        onBlur={() => {
          if (email && !email.includes('@')) {
            Alert.alert("Invalid Email", "Please enter a valid email address.");
          }
        }}
        keyboardType="email-address"
        autoCapitalize="none"
        style={styles.input}
        textColor="#fff"
      />
      <Button mode="contained" onPress={handleRequestOtp} loading={loading}>
        {loading ? "Sending..." : "Send OTP"}
      </Button>
    </View>
  );
}


const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "black", padding: 24, justifyContent: "center" },
  title: { color: "#fff", fontSize: 24, fontWeight: "bold", marginBottom: 30, textAlign: "center" },
  input: { marginBottom: 12, backgroundColor: "#1c1c1e",color:"#fff" },
});
