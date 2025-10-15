import React, { useState, useContext } from "react";
import {
  View,
  Alert,
  Keyboard,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  Image,
} from "react-native";
import {
  TextInput,
  Button,
  Portal,
  Modal,
  List,
  HelperText,
} from "react-native-paper";
import { AuthContext } from "../../AuthContext/AuthContextImproved";
import { LOCALHOST_IP } from "@env";

// Sample barangay data for Valenzuela
const valenzuelaData =
  ["Arkong Bato",
    "Bagbaguin",
    "Bignay",
    "Bisig",
    "Canumay East",
    "Canumay West",
    "Coloong",
    "Dalandanan",
    "Gen. T. De Leon",
    "Karuhatan",
    "Lawang Bato",
    "Lingunan",
    "Malanday",
    "Mapulang Lupa",
    "Malinta",
    "Maysan",
    "Palasan",
    "Parada",
    "Paso de Blas",
    "Pasolo",
    "Polo",
  "Punturin",
  "Rincon",
  "Tagalag",
  "Ugong",
  "Veinte Reales",
  "Wawang Pulo",]
  // Add more barangays as needed
  ;

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

export default function RegisterScreen({ navigation }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [secureText, setSecureText] = useState(true);
  const [confirmSecureText, setConfirmSecureText] = useState(true);
  const [province, setProvince] = useState("Metro Manila");
  const [city, setCity] = useState("Valenzuela");
  const [barangay, setBarangay] = useState("");
  const [street, setStreet] = useState("");
  const [barangayModal, setBarangayModal] = useState(false);
  const [streetModal, setStreetModal] = useState(false);
  const [loading, setLoading] = useState(false);

  // Validation states
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [confirmPasswordError, setConfirmPasswordError] = useState("");

  const { login } = useContext(AuthContext);

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email) {
      setEmailError("Email is required");
      return false;
    }
    if (!emailRegex.test(email)) {
      setEmailError("Please enter a valid email address");
      return false;
    }
    setEmailError("");
    return true;
  };

  const validatePassword = (password) => {
    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*?&]{8,}$/;
    if (!password) {
      setPasswordError("Password is required");
      return false;
    }
    if (!passwordRegex.test(password)) {
      setPasswordError("Password must be at least 8 characters long and include both letters and numbers");
      return false;
    }
    setPasswordError("");
    return true;
  };

  const validateConfirmPassword = (confirmPassword) => {
    if (!confirmPassword) {
      setConfirmPasswordError("Please confirm your password");
      return false;
    }
    if (password !== confirmPassword) {
      setConfirmPasswordError("Passwords do not match");
      return false;
    }
    setConfirmPasswordError("");
    return true;
  };

  const handleRegister = async () => {
    if (loading) return;

    // Validate all fields
    const isEmailValid = validateEmail(email);
    const isPasswordValid = validatePassword(password);
    const isConfirmPasswordValid = validateConfirmPassword(confirmPassword);

    if (!name || !email || !password || !confirmPassword || !city || !province || !barangay || !street) {
      Alert.alert("Error", "Please fill out all fields");
      return;
    }

    if (!isEmailValid || !isPasswordValid || !isConfirmPasswordValid) {
      return;
    }

    setLoading(true);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(`${LOCALHOST_IP}/api/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify({
          name: name.trim(),
          email: email.toLowerCase().trim(),
          password,
          city,
          province,
          barangay,
          street: street.trim(),
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const data = await response.json();

      if (response.status === 201) {
        Alert.alert(
          "Registration Successful! 🎉",
          "Please check your email to enter a 6-digit OTP.",
          [
            {
              text: "OK",
              onPress: () => {
                // Clear form
                setName("");
                setEmail("");
                setPassword("");
                setConfirmPassword("");
                setBarangay("");
                setStreet("");

                // Navigate to login or a verification waiting screen
                navigation.navigate("VerifyOtp", { email });

              },
            },
          ]
        );
      } else {
        const errorMsg = data?.msg || data?.message || "Registration failed. Please try again.";
        Alert.alert("Registration Failed", errorMsg);
      }
    } catch (error) {
      console.error("Registration Error:", error);

      if (error.name === 'AbortError') {
        Alert.alert("Timeout", "Request timed out. Please check your connection and try again.");
      } else {
        Alert.alert("Error", "Something went wrong. Please try again later.");
      }
    } finally {
      setLoading(false);
    }
  };

  const getAvailableStreets = () => {
    return barangay && valenzuelaData[barangay] ? valenzuelaData[barangay] : [];
  };




  
  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.content}>
        <Image
          source={require("../../assets/logo.png")}
          style={{ width: 100, height: 100, alignSelf: "center", marginBottom: 20 }}
        />
        <Text style={styles.title}>Create a New Account</Text>

        <TextInput
          label="Full Name"
          value={name}
          onChangeText={setName}
          mode="outlined"
          style={styles.input}
          theme={inputTheme}
          autoCapitalize="words"
        />

        <TextInput
          label="Email Address"
          value={email}
          onChangeText={(text) => {
            setEmail(text.toLowerCase());
            if (emailError) validateEmail(text.toLowerCase());
          }}
          onBlur={() => validateEmail(email)}
          mode="outlined"
          keyboardType="email-address"
          autoCapitalize="none"
          style={styles.input}
          theme={inputTheme}
          error={!!emailError}
        />
        {emailError ? <HelperText type="error" visible={!!emailError}>{emailError}</HelperText> : null}

        <TextInput
          label="Password"
          value={password}
          onChangeText={(text) => {
            setPassword(text);
            if (passwordError) validatePassword(text);
            if (confirmPassword && confirmPasswordError) validateConfirmPassword(confirmPassword);
          }}
          onBlur={() => validatePassword(password)}
          secureTextEntry={secureText}
          mode="outlined"
          style={styles.input}
          theme={inputTheme}
          error={!!passwordError}
          right={
            <TextInput.Icon
              icon={secureText ? "eye-off" : "eye"}
              onPress={() => setSecureText(!secureText)}
              iconColor="#007AFF"
            />
          }
        />
        {passwordError ? <HelperText type="error" visible={!!passwordError}>{passwordError}</HelperText> : null}

        <TextInput
          label="Confirm Password"
          value={confirmPassword}
          onChangeText={(text) => {
            setConfirmPassword(text);
            if (confirmPasswordError) validateConfirmPassword(text);
          }}
          onBlur={() => validateConfirmPassword(confirmPassword)}
          secureTextEntry={confirmSecureText}
          mode="outlined"
          style={styles.input}
          theme={inputTheme}
          error={!!confirmPasswordError}
          right={
            <TextInput.Icon
              icon={confirmSecureText ? "eye-off" : "eye"}
              onPress={() => setConfirmSecureText(!confirmSecureText)}
              iconColor="#007AFF"
            />
          }
        />
        {confirmPasswordError ? <HelperText type="error" visible={!!confirmPasswordError}>{confirmPasswordError}</HelperText> : null}

        <TextInput
          label="Barangay"
          value={barangay}
          mode="outlined"
          onFocus={() => {
            setBarangayModal(true);
            Keyboard.dismiss();
          }}
          style={styles.input}
          theme={inputTheme}
          right={<TextInput.Icon icon="chevron-down" iconColor="#007AFF" />}
        />

        <TextInput
          label="Street"
          value={street}
          mode="outlined"
          onFocus={() => {
            if (barangay && getAvailableStreets().length > 0) {
              setStreetModal(true);
              Keyboard.dismiss();
            }
          }}
          onChangeText={setStreet}
          style={styles.input}
          theme={inputTheme}
          right={barangay && getAvailableStreets().length > 0 ?
            <TextInput.Icon icon="chevron-down" iconColor="#007AFF" /> : null
          }
        />

        {/* Barangay Modal */}
        <Portal>
          <Modal
            visible={barangayModal}
            onDismiss={() => setBarangayModal(false)}
            contentContainerStyle={styles.modal}
          >
            <Text style={styles.modalTitle}>Select Barangay</Text>
            <ScrollView style={styles.modalScroll}>
              {valenzuelaData.map((b) => (
                <List.Item
                  key={b}
                  title={b}
                  titleStyle={styles.listItem}
                  onPress={() => {
                    setBarangay(b);
                    setStreet("");
                    setBarangayModal(false);
                  }}
                />
              ))}
            </ScrollView>

          </Modal>
        </Portal>

        {/* Street Modal */}
        <Portal>
          <Modal
            visible={streetModal}
            onDismiss={() => setStreetModal(false)}
            contentContainerStyle={styles.modal}
          >
            <Text style={styles.modalTitle}>Select Street</Text>
            <ScrollView style={styles.modalScroll}>
              {getAvailableStreets().map((s, index) => (
                <List.Item
                  key={index}
                  title={s}
                  titleStyle={styles.listItem}
                  onPress={() => {
                    setStreet(s);
                    setStreetModal(false);
                  }}
                />
              ))}
              <List.Item
                title="Other (Type manually)"
                titleStyle={[styles.listItem, { fontStyle: 'italic' }]}
                onPress={() => {
                  setStreetModal(false);
                }}
              />
            </ScrollView>
          </Modal>
        </Portal>

        <Button
          mode="contained"
          onPress={handleRegister}
          style={styles.button}
          labelStyle={styles.buttonText}
          contentStyle={styles.buttonContent}
          loading={loading}
          disabled={loading}
        >
          {loading ? "Creating Account..." : "Register"}
        </Button>

        <TouchableOpacity onPress={() => navigation.navigate("Login")}>
          <Text style={styles.loginText}>
            Already have an account? <Text style={styles.loginLink}>Login</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "black",
  },
  content: {
    padding: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  title: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 30,
    textAlign: "center",
  },
  input: {
    marginBottom: 8,
    color: "#fff",
  },
  button: {
    backgroundColor: "#007AFF",
    borderRadius: 30,
    marginTop: 20,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  buttonContent: {
    paddingVertical: 12,
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
  modal: {
    backgroundColor: "#1c1c1e",
    padding: 20,
    marginHorizontal: 20,
    borderRadius: 15,
    maxHeight: "70%",
  },
  modalTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 15,
    textAlign: "center",
  },
  modalScroll: {
    maxHeight: 300,
  },
  listItem: {
    color: "#fff",
    fontSize: 16,
  },
});