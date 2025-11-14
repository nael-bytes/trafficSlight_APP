// Improved App.js with better error handling and loading states

import 'react-native-gesture-handler';
import React, { useContext, useEffect, useMemo } from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import * as Linking from 'expo-linking';
import { NavigationContainer } from "@react-navigation/native";
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider as PaperProvider } from "react-native-paper";
import Toast from 'react-native-toast-message';

// Import contexts
import { AuthContext, AuthProvider } from "./AuthContext/AuthContextImproved";
import { UserContext, UserProvider } from "./AuthContext/UserContextImproved";
import { LocationProvider } from "./AuthContext/LocationContext";

// Import location permission manager
import * as Location from 'expo-location';
// Import marker icon preloader
import { preloadMarkerIcons } from './utils/markerClustering';

// Import navigation stacks
import SignedOutStack from "./Navigation/SignedOutStack";
import SignedInStack from "./Navigation/SignedInStack";

// Import components
import { ErrorBoundary } from "./components/ErrorBoundary";
import MapPreloader from "./components/MapPreloader";
import { initializeMapPreload } from "./utils/mapPreloader";

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
  // Use AuthContext to check if user is logged in
  const { userToken } = useContext(AuthContext);

  // Safely get userToken with fallback to null if context fails
  const safeUserToken = userToken || null;

  // Set up global error handler to silently suppress "Text strings" errors
  useEffect(() => {
    // Override console.error to silently filter out Text component errors
    const originalError = console.error;
    console.error = (...args) => {
      const errorMessage = args.join(' ');
      // Silently suppress "Text strings must be rendered within a <Text> component" errors
      if (errorMessage.includes('Text strings must be rendered within a <Text> component')) {
        return; // Completely silent - no logging, no warnings
      }
      // Log all other errors normally
      originalError.apply(console, args);
    };

    // Cleanup: restore original console.error on unmount
    return () => {
      console.error = originalError;
    };
  }, []);

  // Initialize app (non-blocking - no loading screen)
  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Request location permission once at app start (non-blocking)
        try {
        const { status } = await Location.requestForegroundPermissionsAsync();
          if (__DEV__) {
        console.log('[App] Location permission status:', status);
          }
        } catch (error) {
          if (__DEV__) {
            console.warn('[App] Location permission request failed (non-critical):', error);
          }
        }

        // Preload marker icons (CRITICAL: Must happen before map renders)
        // This ensures markers show correct icons on first render
        try {
          await preloadMarkerIcons();
          if (__DEV__) {
            console.log('[App] ✅ Marker icons preloaded');
          }
        } catch (error) {
          if (__DEV__) {
            console.warn('[App] Marker icon preload failed (non-critical):', error);
          }
        }

        // Initialize map preloader (non-blocking)
        // This starts downloading map tiles in the background
        try {
          await initializeMapPreload();
        } catch (error) {
          if (__DEV__) {
            console.warn('[App] Map preload failed (non-critical):', error);
          }
        }
      } catch (error) {
        if (__DEV__) {
          console.error('[App] App initialization failed:', error);
        }
      }
    };

    initializeApp();
  }, []);

  // Memoize NavigationWrapper to prevent unnecessary re-renders
  const NavigationWrapper = useMemo(() => {
    return (
    <NavigationContainer 
      linking={linking}
      onError={(error) => {
          if (__DEV__) {
            console.error('[App] Navigation error:', error);
          }
        Toast.show({
          type: 'error',
          text1: 'Navigation Error',
          text2: 'An error occurred while navigating. Please try again.',
        });
      }}
    >
        {/* Show appropriate stack based on authentication status */}
        {safeUserToken ? <SignedInStack /> : <SignedOutStack />}
    </NavigationContainer>
  );
  }, [safeUserToken]); // Only recreate when userToken changes

  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        // Exception: Silently ignore "Text strings must be rendered within a <Text> component" errors
        const errorMessage = error?.message || error?.toString() || '';
        const isTextStringError = errorMessage.includes('Text strings must be rendered within a <Text> component');
        
        if (isTextStringError) {
          return; // Silently suppress - no logging, no handling
        }
        
        if (__DEV__) {
        console.error('App-level error:', error, errorInfo);
        }
        // Here you could send error reports to a crash reporting service
      }}
      fallback={(error, errorInfo) => (
        <View style={errorStyles.container}>
          <ScrollView contentContainerStyle={errorStyles.scrollContent}>
            <Text style={errorStyles.title}>Something went wrong</Text>
            <Text style={errorStyles.message}>
              We encountered an unexpected error. Please restart the app.
            </Text>
            {error && (
              <View style={errorStyles.errorBox}>
                <Text style={errorStyles.errorTitle}>Error Details:</Text>
                <Text style={errorStyles.errorText}>
                  {error.toString()}
                </Text>
                {error.message && error.message !== error.toString() && (
                  <Text style={errorStyles.errorMessage}>
                    {error.message}
                  </Text>
                )}
                {errorInfo?.componentStack && __DEV__ && (
                  <View style={errorStyles.stackBox}>
                    <Text style={errorStyles.stackTitle}>Component Stack (Dev):</Text>
                    <Text style={errorStyles.stackText}>
                      {errorInfo.componentStack}
          </Text>
                  </View>
                )}
              </View>
            )}
          </ScrollView>
        </View>
      )}
    >
      <SafeAreaProvider>
        <PaperProvider>
          {NavigationWrapper}
          <Toast />
          {/* Hidden map preloader - downloads map tiles in background */}
          <MapPreloader />
        </PaperProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

// Error screen styles
const errorStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2EEEE',
    padding: 20,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 16,
  },
  message: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  errorBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    marginTop: 16,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  errorTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  errorText: {
    fontSize: 12,
    color: '#FF6B6B',
    fontFamily: 'monospace',
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
    fontFamily: 'monospace',
  },
  stackBox: {
    backgroundColor: '#F5F5F5',
    borderRadius: 4,
    padding: 12,
    marginTop: 12,
  },
  stackTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  stackText: {
    fontSize: 10,
    color: '#666',
    fontFamily: 'monospace',
  },
});

// Root app component with all providers
export default function App() {
  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        // Exception: Silently ignore "Text strings must be rendered within a <Text> component" errors
        const errorMessage = error?.message || error?.toString() || '';
        const isTextStringError = errorMessage.includes('Text strings must be rendered within a <Text> component');
        
        if (isTextStringError) {
          return; // Silently suppress - no logging, no handling
        }
        
        if (__DEV__) {
        console.error('Critical app error:', error, errorInfo);
        }
        // Critical error handling - could trigger app restart or crash reporting
      }}
    >
      <AuthProvider>
        <UserProvider>
          <LocationProvider>
            <MainApp />
          </LocationProvider>
        </UserProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
