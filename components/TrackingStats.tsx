// Tracking statistics component

import React from 'react';
import { View, Text, StyleSheet, Platform, StatusBar } from 'react-native';
import type { RideStats } from '../types';

interface TrackingStatsProps {
  rideStats: RideStats;
  isVisible: boolean;
  selectedMotor?: any;
}

export const TrackingStats: React.FC<TrackingStatsProps> = ({ rideStats, isVisible, selectedMotor }) => {
  if (!isVisible) return null;

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <View style={styles.container}>
      <View style={styles.statsGrid}>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Elapsed Time</Text>
          <Text style={styles.statValue}>{formatTime(rideStats.duration || 0)}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Distance Traveled</Text>
          <Text style={styles.statValue}>{(rideStats.distance || 0).toFixed(2)} km</Text>
        </View>
        {selectedMotor && (
          <View style={[styles.statItem, styles.fuelItem]}>
            <Text style={styles.statLabel}>Fuel Level</Text>
            <Text style={[styles.statValue, styles.fuelValue]}>
              {selectedMotor.currentFuelLevel?.toFixed(0) || 0}%
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : StatusBar.currentHeight ? StatusBar.currentHeight + 10 : 10, // Position at the very top with status bar consideration
    left: 16,
    right: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 10, // Higher elevation for Android
    zIndex: 1000, // Ensure it's above other elements
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
    fontWeight: '500',
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  fuelItem: {
    backgroundColor: '#FFF3E0',
    borderRadius: 8,
    padding: 8,
    borderWidth: 2,
    borderColor: '#FF9800',
  },
  fuelValue: {
    color: '#FF5722',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
