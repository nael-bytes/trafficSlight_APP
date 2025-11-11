import React, { useState, useEffect } from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createStackNavigator } from "@react-navigation/stack";
import { MaterialCommunityIcons } from "react-native-vector-icons";
import { useColorScheme, View, Text, StyleSheet, Platform, StatusBar } from 'react-native';
import NetInfo from '@react-native-community/netinfo';

import ProfileScreen from "../Screens/loggedIn/ProfileScreen";

import RouteSelectionScreen from "../Maps/RouteSelectionScreenOptimized";

// Wrapper component to fix SafeArea conflicts
const RouteSelectionWrapper = (props) => {
  return <RouteSelectionScreen {...props} />;
};
import MapScreenTry from "../Screens/loggedIn/MapScreenTryRefactored";


// import TrackingScreen from "../Screens/_notImportant/TrackingScreen";
import AddMotorScreen from "../Screens/account_tab/AddMotorScreenImproved";
import HelpCenterScreen from "../Screens/account_tab/HelpCenterScreen";
import ReportBugScreen from "../Screens/account_tab/ReportBug";
import AccountSettingsScreen from "../Screens/account_tab/AccountSettingsScreen";
import NotificationSettingsScreen from "../Screens/account_tab/NotificationSettingsScreen";
// import SelectRouteScreen from "../Screens/_notImportant/SelectRouteScreen";

// import Menu from "../_archive/_notImportant/may22/Menu";
import HomeScreen from "../Screens/loggedIn/HomeScreen";
import MotorListScreen from "../Screens/loggedIn/MotorListScreen";
import MotorDetailsScreen from "../Screens/loggedIn/MotorDetailsScreen";
import TripDetailsScreen from "../Screens/loggedIn/TripDetailsScreen";
import AlertDetailsScreen from "../Screens/loggedIn/AlertDetailsScreen";
import DestinationDetailsScreen from "../Screens/loggedIn/DestinationDetailsScreen";
import FuelLogDetailsScreen from "../Screens/loggedIn/FuelLogDetailsScreen";
import FuelCalculatorScreen from "../Screens/loggedIn/FuelCalculatorScreen";
import AddFuelLogScreen from "../Screens/loggedIn/AddFuelLogScreen";
import addSavedDestinationScreen from "../Screens/loggedIn/addSavedDestinationScreen";
import AllDestinationsMapScreen from "../Screens/loggedIn/allSavedDestination";
import ChangeEmailScreen from "../Screens/account_tab/ChangeEmailScreen";
import ChangePasswordScreen from "../Screens/account_tab/ChangePasswordScreen";
import PrivacySettingsScreen from "../Screens/account_tab/PrivacySettingsScreen";
import NotificationSettings from "../Screens/account_tab/NotificationSettingsScreen";
import LicenseOCR from "../Screens/loggedIn/LicenceScanner";
import allSavedDestinationScreen from "../Screens/loggedIn/allSavedDestination";
import GasStationsScreen from "../Screens/loggedIn/gasStationsDetails";
import MaintenanceScreen from "../Screens/loggedIn/MaintenanceDetails";
import AddMaintenanceScreen from "../Screens/loggedIn/AddMaintenanceScreen";
// import TrackTripScreen from "../Screens/screens/TrackTripScreen";

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

// Internet connectivity component
function InternetStatusBar({ isConnected }) {
  if (isConnected) return null;
  
  return (
    <View style={styles.internetStatusBar}>
      <MaterialCommunityIcons name="wifi-off" size={16} color="#fff" />
      <Text style={styles.internetStatusText}>No Internet Connection</Text>
    </View>
  );
}

function MainTabs() {
  const systemColorScheme = useColorScheme();
  const isDarkMode = systemColorScheme === 'dark';
  const [isConnected, setIsConnected] = useState(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsConnected(state.isConnected);
    });

    return () => unsubscribe();
  }, []);

  return (
    <View style={styles.tabContainer}>
      <InternetStatusBar isConnected={isConnected} />
      <Tab.Navigator
        initialRouteName="Map"
        lazy={false}
        detachInactiveScreens={false}
        screenOptions={({ route }) => ({
          headerShown: false,
          unmountOnBlur: false, // CRITICAL: Keep screens mounted when switching tabs
          tabBarIcon: ({ color, size }) => {
            let iconName;
            if (route.name === "Map") {
              iconName = "map";
            } else if (route.name === "Motors") {
              iconName = "motorbike";
            } else if (route.name === "Account") {
              iconName = "account";
            }
            return <MaterialCommunityIcons name={iconName} size={size} color={color} />;
          },
          tabBarActiveTintColor: "#00ADB5",
          tabBarInactiveTintColor: isDarkMode ? "#777" : "#666",
          tabBarStyle: {
            backgroundColor: isDarkMode ? '#2A2A2A' : '#FFFAFA',
            borderTopColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
            borderTopWidth: 1,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: isDarkMode ? 0.3 : 0.1,
            shadowRadius: 3.84,
            elevation: 5,
            height: Platform.OS === 'ios' ? 90 : 70,
            paddingBottom: Platform.OS === 'ios' ? 20 : 10,
          },
          tabBarBackground: () => (
            <View
              style={{
                flex: 1,
                backgroundColor: isDarkMode ? '#2A2A2A' : '#FFFAFA',
                borderTopColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                borderTopWidth: 1,
              }}
            />
          ),
        })}
      >
        <Tab.Screen 
          name="Motors" 
          component={HomeScreen}
          options={{
            tabBarLabel: 'Motors',
            tabBarLabelStyle: {
              fontSize: 12,
              fontWeight: '500',
            },
          }}
        />
        <Tab.Screen 
          name="Map" 
          component={RouteSelectionWrapper}
          options={{
            tabBarLabel: 'Map',
            tabBarLabelStyle: {
              fontSize: 12,
              fontWeight: '500',
            },
            unmountOnBlur: false, // CRITICAL: Prevent map from unmounting when switching tabs
            freezeOnBlur: false, // CRITICAL: Don't freeze the map screen when it loses focus
          }}
        />
        <Tab.Screen 
          name="Account" 
          component={ProfileScreen}
          options={{
            tabBarLabel: 'Account',
            tabBarLabelStyle: {
              fontSize: 12,
              fontWeight: '500',
            },
          }}
        />
      </Tab.Navigator>
    </View>

    // <Tab.Navigator
    //   initialRouteName="Map" //kung saan gusto mo na magstart
    //   screenOptions={({ route }) => ({
    //     headerShown: false,
    //     tabBarIcon: ({ color, size }) => {
    //       let iconName;
          
    //       if (route.name === "Map") {
    //         iconName = "map";
    //       } else if (route.name === "Motors") {
    //         iconName = "motorbike";
    //       } else if (route.name === "Account") {
    //         iconName = "account";
    //       }

    //       return <MaterialCommunityIcons name={iconName} size={size} color={color} />;
    //     },
    //     tabBarActiveTintColor: "#00ADB5",
    //     tabBarInactiveTintColor: isDarkMode ? "#777" : "#666",
    //     tabBarStyle: {
    //       backgroundColor: isDarkMode ? '#2A2A2A' : '#FFFAFA',
    //       borderTopColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
    //       borderTopWidth: 1,
    //       shadowColor: '#000',
    //       shadowOffset: {
    //         width: 0,
    //         height: -2,
    //       },
    //       shadowOpacity: isDarkMode ? 0.3 : 0.1,
    //       shadowRadius: 3.84,
    //       elevation: 5,
    //     },
    //   })}
    // >
      
    //   <Tab.Screen name="Motors" component={HomeScreen} />
    //   <Tab.Screen name="Map" component={RouteSelectionScreen}  />
    //   <Tab.Screen name="Account" component={ProfileScreen} />
    // </Tab.Navigator>
  );
}

export default function SignedInStack() {
  const systemColorScheme = useColorScheme();
  const isDarkMode = systemColorScheme === 'dark';

  return (
    <View style={styles.stackContainer}>
      <StatusBar 
        barStyle={isDarkMode ? 'light-content' : 'dark-content'} 
        backgroundColor={isDarkMode ? '#1A1A1A' : '#F2EEEE'}
      />
      <Stack.Navigator 
        screenOptions={{ 
          headerShown: false,
          cardStyle: {
            backgroundColor: isDarkMode ? '#1A1A1A' : '#F2EEEE',
          },
          presentation: 'card',
          gestureEnabled: true,
          gestureDirection: 'horizontal',
          cardStyleInterpolator: ({ current, layouts }) => {
            return {
              cardStyle: {
                transform: [
                  {
                    translateX: current.progress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [layouts.screen.width, 0],
                    }),
                  },
                ],
              },
            };
          },
        }}
      >
      <Stack.Group>
        <Stack.Screen name="MainTabs" component={MainTabs} />
        <Stack.Screen name="Home" component={MainTabs} />
        <Stack.Screen name="LicenseOCR" component={LicenseOCR} />
        {/* Keep RouteSelectionScreen for navigation from other screens (it's a separate instance) */}
        <Stack.Screen name="RouteSelectionScreen" component={RouteSelectionWrapper} />
        <Stack.Screen name="HelpCenterScreen" component={HelpCenterScreen} />
        <Stack.Screen name="ReportBugScreen" component={ReportBugScreen} />
        <Stack.Screen name="AccountSettingsScreen" component={AccountSettingsScreen} />
        <Stack.Screen name="MapScreenTry" component={MapScreenTry} />
        {/* <Stack.Screen name="Menu" component={Menu} /> */}
        <Stack.Screen name="MotorList" component={MotorListScreen} />
        <Stack.Screen name="MotorDetails" component={MotorDetailsScreen} />
        <Stack.Screen name="TripDetails" component={TripDetailsScreen} />
        <Stack.Screen name="AlertDetails" component={AlertDetailsScreen} />
        <Stack.Screen name="DestinationDetails" component={DestinationDetailsScreen} />
        <Stack.Screen name="FuelLogDetails" component={FuelLogDetailsScreen} />
        <Stack.Screen name="FuelCalculator" component={FuelCalculatorScreen} />
        <Stack.Screen name="GasStations" component={GasStationsScreen} />
        <Stack.Screen name="AddSavedDestinationScreen" component={addSavedDestinationScreen} />
        <Stack.Screen name="AllDestinationsMapScreen" component={AllDestinationsMapScreen} />
        <Stack.Screen name="AllSavedDestinationScreen" component={allSavedDestinationScreen} />
        <Stack.Screen name="ChangeEmail" component={ChangeEmailScreen} />
        <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
        <Stack.Screen name="PrivacySettings" component={PrivacySettingsScreen} />
        <Stack.Screen name="NotificationSettings" component={NotificationSettingsScreen} />
        <Stack.Screen name="MaintenanceDetails" component={MaintenanceScreen} />
      </Stack.Group>

      {/* Modal Screens */}
      <Stack.Group screenOptions={{ presentation: 'modal' }}>
        <Stack.Screen name="AddMotorScreen" component={AddMotorScreen} />
        <Stack.Screen name="AddFuelLogScreen" component={AddFuelLogScreen} />
        <Stack.Screen name="AddMaintenanceScreen" component={AddMaintenanceScreen} />
      </Stack.Group>
      </Stack.Navigator>
    </View>
  );
}

// Styles for the navigation components
const styles = StyleSheet.create({
  stackContainer: {
    flex: 1,
    backgroundColor: '#F2EEEE',
  },
  tabContainer: {
    flex: 1,
    backgroundColor: '#F2EEEE',
  },
  internetStatusBar: {
    backgroundColor: '#FF6B6B',
    paddingVertical: 8,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  internetStatusText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
});
