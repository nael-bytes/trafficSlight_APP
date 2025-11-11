import React, { useState, useEffect } from "react";
import {
  View,
  Alert,
  Keyboard,
  StyleSheet,
  Text,
  TouchableOpacity,
  Image,
} from "react-native";
import { TextInput, Button, HelperText } from "react-native-paper";
import { LOCALHOST_IP } from "@env";

const inputTheme = {
  colors: {
    text: "#fff",
    primary: "#007AFF",
    background: "#fff",
    placeholder: "#aaa",
    selectionColor: "#007AFF",
    underlineColor: "transparent",
  },
};

export default function VerifyOtpScreen({ navigation, route }) {
const [email, setEmail] = useState(route.params?.email || "");

  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);

  // Countdown timer
  useEffect(() => {
    let interval = null;
    if (resendCooldown > 0) {
      interval = setInterval(() => {
        setResendCooldown((prev) => prev - 1);
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [resendCooldown]);

  const handleVerify = async () => {
    if (!email || !otp) {
      Alert.alert("Error", "Please enter both email and OTP.");
      return;
    }

    setLoading(true);
    Keyboard.dismiss();

    try {
      const response = await fetch(`${LOCALHOST_IP}/api/auth/verify/${otp}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok) {
        Alert.alert("Verified 🎉", "Your email has been successfully verified.", [
          {
            text: "OK",
            onPress: () => navigation.navigate("Login"),
          },
        ]);
      } else {
        setErrorMsg(data?.msg || "OTP verification failed.");
      }
    } catch (err) {
      console.error("OTP Verify Error:", err);
      Alert.alert("Error", "Failed to verify. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const resendOtp = async () => {
    if (!email) {
      Alert.alert("Missing Email", "Please enter your email first.");
      return;
    }

    try {
      const response = await fetch(`${LOCALHOST_IP}/api/auth/resend-verification`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok) {
        Alert.alert("OTP Sent", "A new OTP has been sent to your email.");
        setResendCooldown(60); // 60 seconds cooldown
      } else {
        Alert.alert("Failed", data?.msg || "Could not resend OTP.");
      }
    } catch (error) {
      console.error("Resend OTP Error:", error);
      Alert.alert("Error", "Failed to resend OTP.");
    }
  };

  return (
    <View style={styles.container}>
      <Image
        source={require("../../assets/logo.png")}
        style={{ width: 100, height: 100, alignSelf: "center", marginBottom: 20 }}
      />
      <Text style={styles.title}>Verify your Email</Text>

      {/* <TextInput
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        style={styles.input}
        theme={inputTheme}
      /> */}

      <TextInput
        label="OTP Code"
        value={otp}
        onChangeText={setOtp}
        keyboardType="number-pad"
        maxLength={6}
        style={styles.input}
        theme={inputTheme}
      />

      {errorMsg ? (
        <HelperText type="error" visible={!!errorMsg}>
          {errorMsg}
        </HelperText>
      ) : null}

      <Button
        mode="contained"
        onPress={handleVerify}
        style={styles.button}
        labelStyle={styles.buttonText}
        loading={loading}
        disabled={loading}
      >
        {loading ? "Verifying..." : "Verify Email"}
      </Button>

      <TouchableOpacity
        onPress={resendOtp}
        disabled={resendCooldown > 0}
        style={{ marginTop: 20, alignSelf: "center" }}
      >
        <Text style={{ color: resendCooldown > 0 ? "#aaa" : "#007AFF" }}>
          {resendCooldown > 0
            ? `Resend OTP in ${resendCooldown}s`
            : "Resend OTP"}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.navigate("Login")}>
        <Text style={styles.loginText}>
          Back to <Text style={styles.loginLink}>Login</Text>
        </Text>
      </TouchableOpacity>
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
  },
  button: {
    backgroundColor: "#007AFF",
    borderRadius: 30,
    marginTop: 10,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  loginText: {
    marginTop: 30,
    color: "#aaa",
    textAlign: "center",
    fontSize: 16,
  },
  loginLink: {
    color: "#007AFF",
    fontWeight: "bold",
    textDecorationLine: "underline",
  },
});
