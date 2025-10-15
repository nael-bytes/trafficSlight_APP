import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';

const { width } = Dimensions.get('window');

interface SpeedometerProps {
  speed: number;
  isTracking: boolean;
}

export const Speedometer: React.FC<SpeedometerProps> = ({ speed, isTracking }) => {
  // Speed limit thresholds (km/h)
  const SPEED_LIMITS = {
    SLOW: 20,      // Green - Safe speed
    MODERATE: 40,  // Yellow - Moderate speed
    FAST: 60,      // Orange - Fast speed
    DANGEROUS: 80, // Red - Dangerous speed
  };

  // Get speed color based on current speed
  const getSpeedColor = (currentSpeed: number) => {
    if (currentSpeed <= SPEED_LIMITS.SLOW) return '#4CAF50';      // Green
    if (currentSpeed <= SPEED_LIMITS.MODERATE) return '#FFC107';  // Yellow
    if (currentSpeed <= SPEED_LIMITS.FAST) return '#FF9800';      // Orange
    return '#F44336'; // Red - Dangerous
  };

  const speedColor = getSpeedColor(speed);

  return (
    <View style={styles.container}>
      <View style={[styles.speedometer, { borderColor: speedColor }]}>
        <Text style={[styles.speedText, { color: speedColor }]}>
          {speed.toFixed(0)}
        </Text>
        <Text style={styles.speedUnit}>km/h</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  speedometer: {
    width: width * 0.2,
    height: width * 0.2,
    borderRadius: width * 0.1,
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  speedText: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  speedUnit: {
    fontSize: 10,
    color: '#666',
    fontWeight: '500',
  },
});
