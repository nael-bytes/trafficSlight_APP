import React, { useState, useEffect, useContext } from "react";
import { 
  View, 
  Alert, 
  Text, 
  StyleSheet, 
  Image, 
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView 
} from "react-native";
import { TextInput, Button, HelperText } from "react-native-paper";
import * as Google from "expo-auth-session/providers/google";

import { GOOGLE_CLIENT_ID, LOCALHOST_IP } from "@env";
import { AuthContext } from "../../AuthContext/AuthContextImproved";
import { useUser } from "../../AuthContext/UserContextImproved";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { fetchGasStations, fetchReports, fetchUserMotors } from "../../utils/api";

const inputTheme = {
  colors: {
    text: "#fff",
    primary: "#007AFF",
    background: "#1c1c1e",
    placeholder: "#aaa",
    selectionColor: "#007AFF",
    underlineColor: "transparent",
  },
};

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [secureText, setSecureText] = useState(true);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [emailError, setEmailError] = useState("");

  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId: GOOGLE_CLIENT_ID,
    scopes: ["profile", "email"],
  });

  const { login } = useContext(AuthContext);
  const { saveUser } = useUser();

  const preloadUserData = async (userId) => {
    try {
      // Fetch in parallel, but don't block UI on failures
      const [reportsRes, gasRes, motorsRes] = await Promise.allSettled([
        fetchReports(),
        fetchGasStations(),
        fetchUserMotors(userId),
      ]);

      if (reportsRes.status === 'fulfilled') {
        await AsyncStorage.setItem('cachedReports', JSON.stringify(reportsRes.value || []));
      }
      if (gasRes.status === 'fulfilled') {
        await AsyncStorage.setItem('cachedGasStations', JSON.stringify(gasRes.value || []));
      }
      if (motorsRes.status === 'fulfilled') {
        await AsyncStorage.setItem(`cachedMotors_${userId}`, JSON.stringify(motorsRes.value || []));
      }
    } catch {}
  };

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

const handleLogin = async () => {
  if (loading) return;

  // Validate inputs
  const isEmailValid = validateEmail(email);
  
  if (!email || !password) {
    Alert.alert("Missing Information", "Please fill in both email and password");
    return;
  }

  if (!isEmailValid) return;

  setLoading(true);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 150000);

    const res = await fetch(`${LOCALHOST_IP}/api/auth/login`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({ 
        email: email.toLowerCase().trim(), 
        password 
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const data = await res.json();

    if (res.ok) {
      await login(data.token);
      if (data.user) {
        await saveUser(data.user);
        // Preload and cache user-related data (motors, plus shared data)
        preloadUserData(data.user._id);
      }

      setEmail("");
      setPassword("");

      // Alert.alert(
      //   "Welcome back! 👋",
      //   `Hello ${data.user?.name || "there"}!`,
      //   [
      //     {
      //       text: "Continue",
      //       // onPress: () => navigation.replace("Main"),
      //     },
      //   ]
      // );
    } else {
      setPassword("");

      // Email not verified → redirect to OTP screen
      if (data?.msg?.toLowerCase().includes("verify your email")) {
  Alert.alert(
    "Email Not Verified",
    "Please verify your email before logging in. Check your inbox for a verification link.",
    [
      {
        text: "Verify Now",
        onPress: () => navigation.navigate("VerifyOtp", { email }),
      },
      {
        text: "Cancel",
        style: "cancel",
      },
    ]
  );
  return;
}


      // Other error handling
      let errorMessage = "Login failed. Please try again.";
      if (data?.msg?.includes("Invalid") || data?.msg?.includes("password")) {
        errorMessage = "Invalid email or password. Please check your credentials.";
      } else if (data?.msg) {
        errorMessage = data.msg;
      }

      Alert.alert("Login Failed", errorMessage);
    }
  } catch (error) {
    console.error("Login Error:", error);

    if (error.name === "AbortError") {
      Alert.alert("Connection Timeout", "Request timed out. Please check your internet connection and try again.");
    } else {
      console.log(error.name);
      Alert.alert("Network Error", "Unable to connect to server. Please check your internet connection and try again.");
    }
  } finally {
    setLoading(false);
  }
};


  const handleGoogleLogin = async () => {
    if (!request || googleLoading) return;
    
    setGoogleLoading(true);
    try {
      await promptAsync();
    } catch (error) {
      console.error("Google prompt error:", error);
      Alert.alert("Error", "Failed to open Google sign-in. Please try again.");
      setGoogleLoading(false);
    }
  };

  useEffect(() => {
    const handleGoogleResponse = async () => {
      if (response?.type === "success") {
        const { authentication } = response;
        
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 15000);

          const res = await fetch(`${LOCALHOST_IP}/api/auth/google-login`, {
            method: "POST",
            headers: { 
              "Content-Type": "application/json",
              "Accept": "application/json",
            },
            body: JSON.stringify({
              token: authentication.idToken || authentication.accessToken,
            }),
            signal: controller.signal,
          });

          clearTimeout(timeoutId);
          const data = await res.json();

          if (res.ok && data.token) {
            await login(data.token);
            if (data.user) {
              await saveUser(data.user);
              preloadUserData(data.user._id);
            }
            
            Alert.alert(
              "Welcome! 🎉",
              `Signed in with Google as ${data.user?.name || data.user?.email}`,
              [
                {
                  text: "Continue",
                  onPress: () => navigation.replace("Main")
                }
              ]
            );
          } else {
            Alert.alert("Google Sign-In Failed", data.msg || "Unable to sign in with Google. Please try again.");
          }
        } catch (error) {
          console.error("Google login error:", error);
          
          if (error.name === 'AbortError') {
            Alert.alert("Connection Timeout", "Google sign-in timed out. Please try again.");
          } else {
            Alert.alert("Network Error", "Network error during Google sign-in. Please check your connection.");
          }
        }
      } else if (response?.type === "error") {
        Alert.alert("Google Sign-In Error", "An error occurred during Google sign-in. Please try again.");
      }
      // If response.type === "cancel", user cancelled - no need to show error
      
      setGoogleLoading(false);
    };

    if (response) {
      handleGoogleResponse();
    }
  }, [response]);

const handleForgotPassword = () => {
  if (!email.trim()) {
    Alert.alert("Missing Email", "Please enter your email address first.");
    return;
  }

  const isEmailValid = validateEmail(email);
  if (!isEmailValid) {
    Alert.alert("Invalid Email", "Please enter a valid email address before resetting your password.");
    return;
  }

  // Navigate directly to ForgotPassword screen with the entered email
  navigation.navigate("ResetOtp", { email });
};

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Image source={require("../../assets/logo.png")} style={styles.logo} />

        <Text style={styles.title}>Welcome Back</Text>
        <Text style={styles.subtitle}>Sign in to your account</Text>

        <View style={styles.form}>
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
            autoComplete="email"
            style={styles.input}
            theme={inputTheme}
            textColor="#fff"
            error={!!emailError}
          />
          {emailError ? (
            <HelperText type="error" visible={!!emailError}>
              {emailError}
            </HelperText>
          ) : null}

          <TextInput
            label="Password"
            value={password}
            secureTextEntry={secureText}
            onChangeText={setPassword}
            mode="outlined"
            autoComplete="password"
            style={styles.input}
            theme={inputTheme}
            textColor="#fff"
            right={
              <TextInput.Icon
                icon={secureText ? "eye-off" : "eye"}
                onPress={() => setSecureText(!secureText)}
                iconColor="#007AFF"
              />
            }
          />

          <TouchableOpacity onPress={handleForgotPassword} style={styles.forgotPassword}>
            <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
          </TouchableOpacity>

          <Button
            mode="contained"
            onPress={handleLogin}
            loading={loading}
            disabled={loading || googleLoading}
            style={styles.button}
            labelStyle={styles.buttonText}
            contentStyle={styles.buttonContent}
          >
            {loading ? "Signing In..." : "Sign In"}
          </Button>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.dividerLine} />
          </View>



          <TouchableOpacity 
            onPress={() => navigation.navigate("Register")}
            style={styles.registerContainer}
          >
            <Text style={styles.registerText}>
              Don't have an account? <Text style={styles.registerLink}>Sign Up</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "black",
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 24,
  },
  logo: {
    width: 120,
    height: 120,
    marginBottom: 20,
    resizeMode: "contain",
    alignSelf: "center",
  },
  title: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    color: "#aaa",
    fontSize: 16,
    textAlign: "center",
    marginBottom: 40,
  },
  form: {
    width: "100%",
  },
  input: {
    marginBottom: 8,
    backgroundColor: "#1c1c1e",
  },
  forgotPassword: {
    alignSelf: "flex-end",
    marginBottom: 20,
    marginTop: 5,
  },
  forgotPasswordText: {
    color: "#007AFF",
    fontSize: 14,
    fontWeight: "500",
  },
  button: {
    backgroundColor: "#007AFF",
    borderRadius: 30,
    marginBottom: 20,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  buttonContent: {
    paddingVertical: 12,
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#333",
  },
  dividerText: {
    color: "#aaa",
    marginHorizontal: 15,
    fontSize: 14,
  },
  googleButton: {
    borderColor: "#007AFF",
    borderWidth: 1,
    borderRadius: 30,
    marginBottom: 30,
  },
  googleButtonText: {
    color: "#007AFF",
    fontSize: 16,
  },
  registerContainer: {
    alignItems: "center",
  },
  registerText: {
    color: "#aaa",
    textAlign: "center",
    fontSize: 16,
  },
  registerLink: {
    color: "#007AFF",
    fontWeight: "bold",
    textDecorationLine: "underline",
  },
});