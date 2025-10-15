// Improved App.js with better error handling and loading states

import 'react-native-gesture-handler';
import React, { useContext, useEffect, useState } from "react";
import { View, ActivityIndicator, Alert, Text} from "react-native";
import * as Linking from 'expo-linking';
import { NavigationContainer } from "@react-navigation/native";
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider as PaperProvider } from "react-native-paper";
import Toast from 'react-native-toast-message';

// Import contexts
import { AuthContext, AuthProvider } from "./AuthContext/AuthContextImproved";
// import  UserContext, { UserProvider } from "./AuthContext/UserContextImproved";
import { UserContext, UserProvider, useUser } from "./AuthContext/UserContextImproved";


// Import navigation stacks
import SignedOutStack from "./Navigation/SignedOutStack";
import SignedInStack from "./Navigation/SignedInStack";

// Import components
import { ErrorBoundary } from "./components/ErrorBoundary";
import { LoadingScreen } from "./components/LoadingScreen";
import { configureApi } from "./utils/api";

// Deep linking configuration
const linking = {
  prefixes: ['trafficslight://'],
  config: {
    screens: {
      VerifyScreen: 'verify/:token',
      Login: 'login',
      RegisterScreen: 'register',
      ResetPassword: 'reset-password/:token',
    },
  },
};

// Main app component with error boundary
function MainApp() {
  const { userToken, authLoading } = useContext(AuthContext);
  // const { user, loading: userLoading } = useContext(UserContext);
  const { user, loading: userLoading } = useContext(UserContext);

  const [appReady, setAppReady] = useState(false);

  // Initialize app
  useEffect(() => {
    const initializeApp = async () => {
      try {

        // Any app initialization logic can go here
        // For example: checking for app updates, initializing analytics, etc.
        
        // Simulate initialization time (remove in production)
        // await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Configure API client with auth token getter
        configureApi(() => userToken);

        setAppReady(true);
      } catch (error) {
        console.error('App initialization failed:', error);
        Alert.alert(
          'Initialization Error',
          'Failed to initialize the app. Please restart the application.',
          [{ text: 'OK', onPress: () => setAppReady(true) }]
        );
      }
    };

    initializeApp();
  }, []);

  // Show loading screen while contexts are loading or app is initializing
  if (authLoading || userLoading || !appReady) {
    return (
      <LoadingScreen 
        message={authLoading ? "Checking authentication..." : 
                userLoading ? "Loading user data..." : 
                "Initializing app..."} 
      />
    );
  }

  // Error boundary for navigation
  const NavigationWrapper = () => (
    <NavigationContainer 
      linking={linking}
      onError={(error) => {
        console.error('Navigation error:', error);
        Toast.show({
          type: 'error',
          text1: 'Navigation Error',
          text2: 'An error occurred while navigating. Please try again.',
        });
      }}
    >
      {userToken ? <SignedInStack /> : <SignedOutStack />}
    </NavigationContainer>
  );

  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        console.error('App-level error:', error, errorInfo);
        // Here you could send error reports to a crash reporting service
      }}
      fallback={
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F2EEEE' }}>
          <ActivityIndicator size="large" color="#00ADB5" />
          <Text style={{ marginTop: 16, fontSize: 16, color: '#666' }}>
            Recovering from error...
          </Text>
        </View>
      }
    >
      <SafeAreaProvider>
        <PaperProvider>
          <NavigationWrapper />
          <Toast />
        </PaperProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

// Root app component with all providers
export default function App() {
  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        console.error('Critical app error:', error, errorInfo);
        // Critical error handling - could trigger app restart or crash reporting
      }}
    >
      <AuthProvider>
        <UserProvider>
          <MainApp />
        </UserProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
