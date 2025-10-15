// Loading screen component

import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface LoadingScreenProps {
  message?: string;
  showLogo?: boolean;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({ 
  message = 'Loading...', 
  showLogo = true 
}) => {
  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#00ADB5', '#00C2CC']}
        style={styles.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.content}>
          {showLogo && (
            <View style={styles.logoContainer}>
              <Text style={styles.logoText}>TrafficSlight</Text>
            </View>
          )}
          
          <ActivityIndicator size="large" color="#FFFFFF" />
          
          <Text style={styles.message}>{message}</Text>
        </View>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
  },
  logoContainer: {
    marginBottom: 40,
  },
  logoText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  message: {
    fontSize: 16,
    color: '#FFFFFF',
    marginTop: 20,
    textAlign: 'center',
  },
});
