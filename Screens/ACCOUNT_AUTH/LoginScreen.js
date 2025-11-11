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
import { fetchGasStations, fetchReports, fetchUserMotors, fetchUserProfile, configureApi, fetchCompleteUserData, getAuthToken } from "../../utils/api";

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

  const { login, getToken } = useContext(AuthContext);
  const { saveUser } = useUser();

  const preloadUserData = async (userId) => {
    try {
      // Get token to ensure we have authentication
      const token = await getToken();
      if (!token) {
        if (__DEV__) {
          console.warn('[LoginScreen] No token available for preload, skipping');
        }
        return;
      }

      // Use sharedDataManager to preload all HomeScreen and ProfileScreen data
      // This fetches motors, trips, destinations, fuel logs, maintenance, gas stations
      // and caches it properly for immediate use
      try {
        if (__DEV__) {
          console.log('[LoginScreen] Preloading HomeScreen and ProfileScreen data...');
        }
        
        // Preload using sharedDataManager which handles caching automatically
        await sharedDataManager.fetchAllData(userId, false);
        
        if (__DEV__) {
          console.log('[LoginScreen] Successfully preloaded HomeScreen data');
        }
      } catch (sharedDataError) {
        // Only warn in development, don't throw
        if (__DEV__ && sharedDataError.message !== 'Authentication required. Please login.') {
          console.warn('[LoginScreen] SharedDataManager preload failed, trying comprehensive endpoint:', sharedDataError.message);
        }
        
        // Fallback to comprehensive endpoint if sharedDataManager fails
        try {
          const completeData = await fetchCompleteUserData();
          
          if (completeData) {
            // Cache all the data from the comprehensive response
            const dataToCache = {
              reports: completeData.reports || [],
              gasStations: completeData.gasStations || [],
              motors: completeData.motors || [],
              trips: completeData.trips || [],
              fuelLogs: completeData.fuelLogs || [],
              maintenance: completeData.maintenance || [],
              destinations: completeData.savedDestinations || completeData.destinations || [],
              notifications: completeData.notifications || [],
              achievements: completeData.achievements || [],
              routes: completeData.routes || [],
              analytics: completeData.analytics || [],
            };

            // Cache each data type separately for HomeScreen
            await Promise.allSettled([
              AsyncStorage.setItem(`reports_${userId}`, JSON.stringify(dataToCache.reports)),
              AsyncStorage.setItem(`motors_${userId}`, JSON.stringify(dataToCache.motors)),
              AsyncStorage.setItem(`cachedMotors_${userId}`, JSON.stringify(dataToCache.motors)),
              AsyncStorage.setItem(`trips_${userId}`, JSON.stringify(dataToCache.trips)),
              AsyncStorage.setItem(`fuelLogs_${userId}`, JSON.stringify(dataToCache.fuelLogs)),
              AsyncStorage.setItem(`maintenance_${userId}`, JSON.stringify(dataToCache.maintenance)),
              AsyncStorage.setItem(`destinations_${userId}`, JSON.stringify(dataToCache.destinations)),
              AsyncStorage.setItem(`gasStations_${userId}`, JSON.stringify(dataToCache.gasStations)),
            ]);

            // Also cache sharedData cache format for HomeScreen
            const sharedDataCache = {
              motors: dataToCache.motors,
              trips: dataToCache.trips,
              destinations: dataToCache.destinations,
              fuelLogs: dataToCache.fuelLogs,
              maintenanceRecords: dataToCache.maintenance,
              gasStations: dataToCache.gasStations,
              combinedFuelData: [],
              timestamp: Date.now()
            };
            await AsyncStorage.setItem(`sharedData_${userId}`, JSON.stringify(sharedDataCache));

            // Also cache to global cache keys (for backward compatibility)
            await AsyncStorage.setItem(`reports_${userId}`, JSON.stringify(dataToCache.reports));
            await AsyncStorage.setItem(`gasStations_${userId}`, JSON.stringify(dataToCache.gasStations));
            
            if (__DEV__) {
              console.log('[LoginScreen] Preloaded complete user data:', {
                motors: dataToCache.motors.length,
                trips: dataToCache.trips.length,
                reports: dataToCache.reports.length,
                fuelLogs: dataToCache.fuelLogs.length,
                maintenance: dataToCache.maintenance.length,
              });
            }
          }
        } catch (completeDataError) {
          // Silently fail - data will be fetched when screen loads
          if (__DEV__ && completeDataError.message !== 'Authentication required. Please login.') {
            console.warn('[LoginScreen] Comprehensive endpoint preload failed:', completeDataError.message);
          }
        }
      }
    } catch (error) {
      // Silently fail - data will be fetched when screen loads
      if (__DEV__ && error.message !== 'Authentication required. Please login.') {
        console.warn('[LoginScreen] Preload failed, data will load on screen focus:', error.message);
      }
      
      // Fallback to individual API calls if comprehensive endpoint fails
      try {
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
      } catch (fallbackError) {
        console.error('[LoginScreen] Fallback preload also failed:', fallbackError);
      }
    }
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
      // Save token first (this also configures API with tokenRef)
      await login(data.token);
      
      // Wait a bit to ensure token is fully saved and backend has processed it
      // Sometimes backend needs a moment to register the token
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Fetch complete user profile after login to get name and id fields
      // The login response might not include all fields (like name and id)
      let fullUserData = data.user || {};
      
      try {
        // Verify token is available before making API call
        const currentToken = await getAuthToken();
        if (!currentToken) {
          console.error('[LoginScreen] ❌ No token available for profile fetch - token may have been cleared');
          console.error('[LoginScreen] Token from login:', data.token ? `${data.token.substring(0, 20)}...` : 'NO TOKEN');
          throw new Error('No authentication token available');
        }
        
        console.log('[LoginScreen] Fetching user profile with token:', {
          hasToken: !!currentToken,
          tokenLength: currentToken.length,
          tokenPreview: `${currentToken.substring(0, 20)}...`,
        });
        
        // Fetch full user profile to get name and id
        const profileData = await fetchUserProfile();
        
        console.log('[LoginScreen] Profile fetch response:', {
          hasData: !!profileData,
          hasSuccess: !!profileData?.success,
          hasUser: !!profileData?.user,
          hasName: !!profileData?.name,
          hasId: !!profileData?.id,
        });
        
        // Handle response format: Priority order
        // 1. New format: { success: true, data: {...} }
        // 2. Wrapped format: { user: {...} }
        // 3. Direct user object
        if (profileData?.success && profileData?.data) {
          // New backend format: { success: true, data: {...} }
          fullUserData = { ...fullUserData, ...profileData.data };
        } else if (profileData?.user) {
          // Backend format: { user: {...} }
          fullUserData = { ...fullUserData, ...profileData.user };
        } else if (profileData && !profileData.user && (profileData.name || profileData.id)) {
          // If profile returns user data directly (not wrapped in user property)
          fullUserData = { ...fullUserData, ...profileData };
        }
      } catch (profileError) {
        console.error('[LoginScreen] ❌ Failed to fetch user profile:', {
          message: profileError.message,
          isAuthError: profileError.isAuthError,
          endpoint: profileError.endpoint,
          responseBody: profileError.responseBody,
          error: profileError,
        });
        // Continue with login response user data if profile fetch fails
      }
      
      // Ensure we have the essential fields
      if (fullUserData && fullUserData._id) {
        // Make sure we merge properly with login response - prioritize fetched data
        const completeUserData = {
          ...data.user, // Base user data from login
          ...fullUserData, // Override with fetched profile data (includes name/id)
          // Ensure token is not saved in user object
        };
        
        // Log what we're saving for debugging
        console.log('[LoginScreen] Saving user data:', {
          hasName: !!completeUserData.name,
          hasId: !!completeUserData.id,
          hasEmail: !!completeUserData.email,
          name: completeUserData.name || 'MISSING',
          id: completeUserData.id || 'MISSING',
          email: completeUserData.email || 'MISSING',
        });
        
        // Save user data
        await saveUser(completeUserData);
        
        // Also save to ProfileScreen cache immediately
        await AsyncStorage.setItem('profile_user_data', JSON.stringify(completeUserData));
        
        console.log('[LoginScreen] User data saved to cache and context');
        
        // Preload and cache user-related data (motors, plus shared data)
        preloadUserData(completeUserData._id);
      } else {
        console.warn('[LoginScreen] No user data to save - fullUserData:', !!fullUserData, 'has _id:', !!fullUserData?._id);
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
            
            // Fetch complete user profile after Google login to get name and id fields
            let fullUserData = data.user;
            try {
              // Configure API to use the token we just received
              if (data.token) {
                configureApi(() => data.token);
                
                // Fetch full user profile to get name and id
                const profileData = await fetchUserProfile();
                // Handle response format: Priority order
                // 1. New format: { success: true, data: {...} }
                // 2. Wrapped format: { user: {...} }
                // 3. Direct user object
                if (profileData?.success && profileData?.data) {
                  // New backend format: { success: true, data: {...} }
                  fullUserData = profileData.data;
                } else if (profileData?.user) {
                  // Backend format: { user: {...} }
                  fullUserData = profileData.user;
                } else if (profileData && !profileData.user && (profileData.name || profileData.id)) {
                  // If profile returns user data directly (not wrapped in user property)
                  fullUserData = profileData;
                }
              }
            } catch (profileError) {
              console.warn('[LoginScreen] Failed to fetch user profile after Google login, using login response:', profileError);
              // Continue with login response user data if profile fetch fails
            }
            
            if (fullUserData) {
              await saveUser(fullUserData);
              preloadUserData(fullUserData._id);
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