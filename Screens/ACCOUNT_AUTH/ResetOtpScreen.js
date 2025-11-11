import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Alert, StyleSheet, Text, TouchableOpacity } from "react-native";
import { TextInput, Button } from "react-native-paper";
import { LOCALHOST_IP } from "@env";

export default function ResetOtpScreen({ navigation, route }) {
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(60); // seconds
  const email = route.params?.email;

  useEffect(() => {
    // Automatically send reset token when screen opens
    const sendResetToken = async () => {
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
          console.error('[ResetOtpScreen] Failed to parse response:', parseError);
          Alert.alert("Error", `Server returned invalid response (Status: ${res.status}). Please try again.`);
          navigation.goBack();
          return;
        }

        if (!res.ok) {
          const errorMsg = data?.message || data?.msg || data?.error || `Server error (Status: ${res.status})`;
          console.error('[ResetOtpScreen] Server error:', {
            status: res.status,
            statusText: res.statusText,
            data: data,
            email: email
          });
          Alert.alert("Error", errorMsg);
          navigation.goBack();
          return;
        }
        // Success - OTP sent (silently, user will see the screen)
        if (__DEV__) {
          console.log('[ResetOtpScreen] OTP sent successfully');
        }
      } catch (err) {
        console.error('[ResetOtpScreen] Error sending OTP:', err);
        Alert.alert("Error", err.message || "Failed to connect to server. Please check your internet connection.");
        navigation.goBack();
      }
    };

    if (email) {
      sendResetToken();
      setCooldown(60);
    } else navigation.goBack();
  }, []);

  // cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const handleVerifyOtp = async () => {
    if (!otp) return Alert.alert("Missing", "Enter the reset code sent to your email.");

    setLoading(true);
    try {
      // Uses: POST /api/auth/verify-reset (as per USER_FRONTEND_IMPLEMENTATION_GUIDE.md)
      // Parameters: email, otpCode (not token)
      // Use API_BASE or LOCALHOST_IP depending on what's configured
      const API_BASE = LOCALHOST_IP || "https://ts-backend-1-jyit.onrender.com";
      const res = await fetch(`${API_BASE}/api/auth/verify-reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otpCode: otp }),
      });

      const data = await res.json();
      if (res.ok) {
        // Token verified successfully, navigate to change password screen
        navigation.replace("NewPassword", { email, token: otp });
      } else {
        Alert.alert("Invalid Code", data?.message || data?.msg || "Incorrect or expired code.");
      }
    } catch (err) {
      Alert.alert("Error", "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || resending) return;
    setResending(true);
    try {
      // Uses: POST /api/auth/reset-password (as per API documentation)
      // Use API_BASE or LOCALHOST_IP depending on what's configured
      const API_BASE = LOCALHOST_IP || "https://ts-backend-1-jyit.onrender.com";
      const res = await fetch(`${API_BASE}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        const errorMsg = data?.message || data?.msg || data?.error || 'Failed to resend reset code';
        console.error('[ResetOtpScreen] Resend error:', data);
        throw new Error(errorMsg);
      }
      Alert.alert('Reset Code Resent', 'Please check your email for the new code.');
      setCooldown(60);
    } catch (err) {
      console.error('[ResetOtpScreen] Resend network error:', err);
      Alert.alert('Error', err.message || 'Failed to resend reset code. Please check your internet connection.');
    } finally {
      setResending(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Enter OTP</Text>
      <Text style={styles.subtitle}>We sent a reset code to: {email}</Text>

      <TextInput
        label="Reset Code"
        value={otp}
        onChangeText={setOtp}
        keyboardType="default"
        style={styles.input}
        textColor="#fff"
      />

      <Button mode="contained" onPress={handleVerifyOtp} loading={loading}>
        {loading ? "Verifying..." : "Verify Code"}
      </Button>

      <View style={{ marginTop: 12, alignItems: 'center' }}>
        {cooldown > 0 ? (
          <Text style={{ color: '#aaa' }}>Resend available in {cooldown}s</Text>
        ) : (
          <TouchableOpacity onPress={handleResend} disabled={resending}>
            <Text style={{ color: '#4dabf7', fontWeight: '600' }}>{resending ? 'Resending...' : 'Resend code'}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "black",
    padding: 24,
    justifyContent: "center",
  },
  title: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 10,
    textAlign: "center",
  },
  subtitle: {
    color: "#aaa",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 20,
  },
  input: {
    marginBottom: 16,
    backgroundColor: "#1c1c1e",
  },
});
