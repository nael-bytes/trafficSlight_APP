import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import MaterialIcons from "react-native-vector-icons/MaterialIcons";

interface SpeedometerProps {
  speed: number;
  isOverSpeedLimit: boolean;
}

const Speedometer: React.FC<SpeedometerProps> = ({ speed, isOverSpeedLimit }) => {
  // Calculate the rotation angle based on speed (max speed 120 km/h = 180 degrees)
  const rotationAngle = Math.min((speed / 120) * 180, 180);
  
  return (
    <View style={styles.speedometerContainer}>
      <LinearGradient
        colors={isOverSpeedLimit ? ['#e74c3c', '#c0392b'] : ['#00ADB5', '#00858B']}
        style={styles.speedometerGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      >
        <View style={styles.speedDisplay}>
          <Text style={styles.speedValue}>
            {Math.round(speed)}
          </Text>
          <Text style={styles.speedUnit}>km/h</Text>
        </View>
        {isOverSpeedLimit && (
          <View style={styles.warningContainer}>
            <MaterialIcons name="warning" size={20} color="#fff" />
            <Text style={styles.warningText}>Speed Limit</Text>
          </View>
        )}
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  speedometerContainer: {
    position: 'absolute',
    bottom:  "75%",
    right: 16,
    width: 120,
    height: 80,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  speedometerGradient: {
    flex: 1,
    padding: 12,
    minWidth: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  speedDisplay: {
    alignItems: 'center',
  },
  speedValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  speedUnit: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.8,
    marginTop: -2,
  },
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(231, 76, 60, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginTop: 4,
  },
  warningText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
});

export default Speedometer; 