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
    // Automatically send OTP when screen opens
    const sendOtp = async () => {
      try {
        const res = await fetch(`${LOCALHOST_IP}/api/auth/request-reset`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });

        const data = await res.json();
        if (!res.ok) {
          Alert.alert("Error", data?.msg || "Failed to send OTP.");
          navigation.goBack();
        }
      } catch (err) {
        Alert.alert("Error", "Failed to connect to server.");
        navigation.goBack();
      }
    };

    if (email) {
      sendOtp();
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
    if (!otp) return Alert.alert("Missing", "Enter the OTP sent to your email.");

    setLoading(true);
    try {
      const res = await fetch(`${LOCALHOST_IP}/api/auth/verify-reset-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp }),
      });

      const data = await res.json();
      if (res.ok) {
        navigation.replace("NewPassword", { email, otp });
      } else {
        Alert.alert("Invalid OTP", data?.msg || "Incorrect or expired code.");
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
      const res = await fetch(`${LOCALHOST_IP}/api/auth/request-reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.msg || 'Failed to resend OTP');
      Alert.alert('OTP Resent', 'Please check your email for the new code.');
      setCooldown(60);
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to resend OTP');
    } finally {
      setResending(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Enter OTP</Text>
      <Text style={styles.subtitle}>We sent a code to: {email}</Text>

      <TextInput
        label="6-digit OTP"
        value={otp}
        onChangeText={setOtp}
        keyboardType="number-pad"
        maxLength={6}
        style={styles.input}
        textColor="#fff"
      />

      <Button mode="contained" onPress={handleVerifyOtp} loading={loading}>
        {loading ? "Verifying..." : "Verify OTP"}
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
