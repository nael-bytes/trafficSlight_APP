import React, { useState } from "react";
import { View, Alert, StyleSheet, Text } from "react-native";
import { TextInput, Button, HelperText } from "react-native-paper";
import { LOCALHOST_IP } from "@env";

export default function NewPasswordScreen({ navigation, route }) {
  const email = route.params?.email;
  const otp = route.params?.otp;

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  const validateStrongPassword = (password) => {
    const pattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!pattern.test(password)) {
      setPasswordError(
        "Password must be at least 8 characters, with upper/lowercase, number, and special character."
      );
      return false;
    }
    setPasswordError("");
    return true;
  };

  const handleResetPassword = async () => {
    if (!newPassword || !confirmPassword) {
      return Alert.alert("Missing", "Please fill in both password fields.");
    }
    if (!validateStrongPassword(newPassword)) return;
    if (newPassword !== confirmPassword) {
      return Alert.alert("Error", "Passwords do not match.");
    }

    setLoading(true);
    try {
      const res = await fetch(`${LOCALHOST_IP}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp, newPassword }),
      });

      const data = await res.json();
      if (res.ok) {
        Alert.alert("Success", "Password reset. You can now log in.", [
          {
            text: "Go to Login",
            onPress: () => navigation.navigate("Login"),
          },
        ]);
      } else {
        Alert.alert("Error", data?.msg || "Failed to reset password.");
      }
    } catch (err) {
      Alert.alert("Error", "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Set New Password</Text>

      <TextInput
        label="New Password"
        value={newPassword}
        secureTextEntry={!showPassword}
        onChangeText={(text) => {
          setNewPassword(text);
          if (passwordError) validateStrongPassword(text);
        }}
        onBlur={() => validateStrongPassword(newPassword)}
        style={styles.input}
        textColor="#fff"
        right={
          <TextInput.Icon
            icon={showPassword ? "eye-off" : "eye"}
            onPress={() => setShowPassword(!showPassword)}
            iconColor="#007AFF"
          />
        }
      />
      {passwordError ? (
        <HelperText type="error" visible={!!passwordError}>
          {passwordError}
        </HelperText>
      ) : null}

      <TextInput
        label="Confirm Password"
        value={confirmPassword}
        secureTextEntry={!showConfirm}
        onChangeText={setConfirmPassword}
        style={styles.input}
        textColor="#fff"
        right={
          <TextInput.Icon
            icon={showConfirm ? "eye-off" : "eye"}
            onPress={() => setShowConfirm(!showConfirm)}
            iconColor="#007AFF"
          />
        }
      />

      <Button mode="contained" onPress={handleResetPassword} loading={loading}>
        {loading ? "Resetting..." : "Reset Password"}
      </Button>
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
    marginBottom: 30,
    textAlign: "center",
  },
  input: {
    marginBottom: 12,
    backgroundColor: "#1c1c1e",
  },
});
