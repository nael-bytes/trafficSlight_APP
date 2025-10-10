import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createStackNavigator } from "@react-navigation/stack";
import { MaterialCommunityIcons } from "react-native-vector-icons";
import { useColorScheme, View } from 'react-native';

import ProfileScreen from "../Screens/loggedIn/ProfileScreen";

import RouteSelectionScreen from "../Screens/RouteSelectionScreen";
import MapScreenTry from "../Screens/loggedIn/MapScreenTry";


// import TrackingScreen from "../Screens/_notImportant/TrackingScreen";
import AddMotorScreen from "../Screens/account_tab/AddMotorScreen";
import HelpCenterScreen from "../Screens/account_tab/HelpCenterScreen";
import ReportBugScreen from "../Screens/account_tab/ReportBug";
import AccountSettingsScreen from "../Screens/account_tab/AccountSettingsScreen";
import NotificationSettingsScreen from "../Screens/account_tab/NotificationSettingsScreen";
// import SelectRouteScreen from "../Screens/_notImportant/SelectRouteScreen";

import Menu from "../Screens/_notImportant/may22/Menu";
import HomeScreen from "../Screens/loggedIn/HomeScreen";
import MotorDetailsScreen from "../Screens/loggedIn/MotorDetailsScreen";
import TripDetailsScreen from "../Screens/loggedIn/TripDetailsScreen";
import AlertDetailsScreen from "../Screens/loggedIn/AlertDetailsScreen";
import DestinationDetailsScreen from "../Screens/loggedIn/DestinationDetailsScreen";
import FuelLogDetailsScreen from "../Screens/loggedIn/FuelLogDetailsScreen.tsx";
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
// import TrackTripScreen from "../Screens/screens/TrackTripScreen";

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

function MainTabs() {
  const systemColorScheme = useColorScheme();
  const isDarkMode = systemColorScheme === 'dark';

  return (

    <Tab.Navigator
  initialRouteName="Map"
  screenOptions={({ route }) => ({
    headerShown: false,

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
    },
    // 👇 ito yung force render
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
  <Tab.Screen name="Motors" component={HomeScreen} />
  <Tab.Screen name="Map" component={RouteSelectionScreen} />
  <Tab.Screen name="Account" component={ProfileScreen} />
</Tab.Navigator>

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
    <Stack.Navigator 
      screenOptions={{ 
        headerShown: false,
        
        cardStyle: {
          backgroundColor: isDarkMode ? '#1A1A1A' : '#F2EEEE',
        },
        presentation: 'card',
      }}
    >
      <Stack.Group>
        <Stack.Screen name="MainTabs" component={MainTabs} />
        <Stack.Screen name="Home" component={MainTabs} />
        <Stack.Screen name="LicenseOCR" component={LicenseOCR} />
        <Stack.Screen name="RouteSelectionScreen" component={RouteSelectionScreen} />
        <Stack.Screen name="HelpCenterScreen" component={HelpCenterScreen} />
        <Stack.Screen name="ReportBugScreen" component={ReportBugScreen} />
        <Stack.Screen name="AccountSettingsScreen" component={AccountSettingsScreen} />
        <Stack.Screen name="MapScreenTry" component={MapScreenTry} />
        <Stack.Screen name="Menu" component={Menu} />
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
      </Stack.Group>
    </Stack.Navigator>
  );
}
