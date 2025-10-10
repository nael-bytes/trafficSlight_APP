import React, { useContext } from "react";
import {
  View,
  Alert,
  TouchableOpacity,
  Text,
  Platform,
  StyleSheet,
  Image,
  StatusBar,
  ScrollView,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { AuthContext } from "../../AuthContext/AuthContext";
import { useUser } from "../../AuthContext/UserContext";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from 'expo-linear-gradient';

const iconSize = 24;

const ProfileScreen = ({ navigation }) => {
  const { user, clearUser } = useUser();
  const { logout } = useContext(AuthContext);

  if (!user) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  const handleLogout = () => {
    Alert.alert(
      "Confirm Logout",
      "Are you sure you want to log out?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Logout",
          onPress: async () => {
            await logout(); // clears token
            await clearUser(); // clears user info
          },
          style: "destructive",
        },
      ],
      { cancelable: true }
    );
  };

  const renderMenuItem = (icon, title, onPress, isDestructive = false) => (
    <TouchableOpacity
      style={styles.menuItem}
      onPress={onPress}
      accessible
      accessibilityLabel={title}
    >
      <View style={styles.menuItemContent}>
        <Ionicons
          name={icon}
          size={iconSize}
          color={isDestructive ? '#FF3B30' : '#333333'}
        />
        <Text style={[
          styles.menuItemText,
          isDestructive && styles.destructiveText
        ]}>
          {title}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={iconSize} color="#CCCCCC" />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#00ADB5" />
      
      {/* Profile Header */}
      <View style={styles.header}>
        <LinearGradient
          colors={['#00ADB5', '#00C2CC']}
          style={styles.headerGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        >
          <View style={styles.headerContent}>
            <View style={styles.headerLeft}>
              <Text style={styles.headerTitle}>Profile</Text>
              <Text style={styles.headerSubtitle}>Manage your account</Text>
            </View>
            <View style={styles.headerAvatar}>
              <TouchableOpacity>

              </TouchableOpacity>
              <Ionicons name="person-circle" size={48} color="#FFFFFF" />
            </View>
          </View>
        </LinearGradient>
      </View>

      <ScrollView style={styles.container}>
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <Text style={styles.welcomeText}>Welcome back,</Text>
          <Text style={styles.userName}>{user?.name}</Text>
          <Text style={styles.userEmail}>UID: {user?.id}</Text>
          <Text style={styles.userEmail}>{user?.email}</Text>
        </View>

        {/* Trips Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Trips</Text>
          <View style={styles.menuContainer}>
            {renderMenuItem(
              "flag-outline",
              "Trips",
              () => navigation.navigate("TripDetails")
            )}
          </View>
        </View>

        {/* Reports Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Reports</Text>
          <View style={styles.menuContainer}>
            {renderMenuItem(
              "warning-outline",
              "Traffic Reports",
              () => navigation.navigate("AlertDetails")
            )}
          </View>
        </View>

        {/* Account Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.menuContainer}>
            {renderMenuItem(
              "lock-closed-outline",
              "Account Settings",
              () => navigation.navigate("AccountSettingsScreen")
            )}
            {renderMenuItem(
              "log-out-outline",
              "Logout",
              handleLogout,
              true
            )}
          </View>
        </View>

        {/* 
         */}

        {/* Support Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Support</Text>
          <View style={styles.menuContainer}>
            {renderMenuItem(
              "help-circle-outline",
              "Help Center",
              () => navigation.navigate("HelpCenterScreen")
            )}
            {renderMenuItem(
              "shield-outline",
              "Privacy Policy",
              () => navigation.navigate("ReportBugScreen")
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F2EEEE',
  },
  container: {
    flex: 1,
  },
  header: {
    width: '100%',
    backgroundColor: '#F2EEEE',
    zIndex: 10,
    overflow: 'hidden',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerGradient: {
    padding: 24,
    paddingTop: Platform.OS === 'ios' ? 20 : 0,
    paddingBottom: 16,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '500',
  },
  headerAvatar: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileCard: {
    backgroundColor: '#FFFAFA',
    margin: 16,
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  welcomeText: {
    fontSize: 16,
    color: '#666666',
    marginBottom: 4,
  },
  userName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333333',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 16,
    color: '#666666',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  section: {
    marginHorizontal: 16,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333333',
    marginBottom: 12,
    marginLeft: 4,
  },
  menuContainer: {
    backgroundColor: '#FFFAFA',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  menuItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuItemText: {
    fontSize: 16,
    color: '#333333',
    marginLeft: 12,
    fontWeight: '500',
  },
  destructiveText: {
    color: '#FF3B30',
  },
});

export default ProfileScreen;
