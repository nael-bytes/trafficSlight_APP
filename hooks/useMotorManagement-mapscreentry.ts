import { useState, useCallback, useEffect } from 'react';
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LOCALHOST_IP } from "@env";

import type { Motor } from '../types';

export const useMotorManagement = (userId: string | undefined) => {
  const [motorList, setMotorList] = useState<Motor[]>([]);
  const [selectedMotor, setSelectedMotor] = useState<Motor | null>(null);
  const [loading, setLoading] = useState(false);

  // Fetch motor analytics
  const fetchMotorAnalytics = useCallback(async (userId: string): Promise<Motor[]> => {
    try {
      const response = await fetch(`${LOCALHOST_IP}/api/motorcycles/analytics/${userId}`);
      if (response.ok) {
        const data = await response.json();
        return data.motorcycles || [];
      }
    } catch (error) {
      console.error("Failed to fetch motor analytics:", error);
    }
    return [];
  }, []);

  // Fetch motorcycle details
  const fetchMotorcycleDetails = useCallback(async (motorcycleId: string) => {
    try {
      const response = await fetch(`${LOCALHOST_IP}/api/motorcycles/${motorcycleId}`);
      if (response.ok) {
        const motorcycleData = await response.json();
        return motorcycleData.fuelTank || 15;
      }
    } catch (error) {
      console.warn('[MapScreen] Failed to fetch motorcycle details:', error);
    }
    return 15;
  }, []);

  // Load cached data
  const loadCachedData = useCallback(async () => {
    if (!userId) return;
    
    try {
      const cachedMotors = await AsyncStorage.getItem(`cachedMotors_${userId}`);
      if (cachedMotors) {
        setMotorList(JSON.parse(cachedMotors));
        const motorsWithAnalytics = await fetchMotorAnalytics(userId);
        if (motorsWithAnalytics.length > 0) {
          setMotorList(motorsWithAnalytics);
          setSelectedMotor(motorsWithAnalytics[0]);
        }
      }
    } catch (err) {
      console.warn("Failed to load cache:", err);
    }
  }, [userId, fetchMotorAnalytics]);

  // Fetch motors
  const fetchMotors = useCallback(async () => {
    if (!userId) return;
    
    setLoading(true);
    try {
      const motorsWithAnalytics = await fetchMotorAnalytics(userId);
      if (motorsWithAnalytics.length > 0) {
        setMotorList(motorsWithAnalytics);
        setSelectedMotor(motorsWithAnalytics[0]);
      }
    } catch (error) {
      console.error("Failed to fetch motors:", error);
    } finally {
      setLoading(false);
    }
  }, [userId, fetchMotorAnalytics]);

  // Handle motor selection
  const handleMotorSelect = useCallback((motor: Motor | null) => {
    setSelectedMotor(motor);
  }, []);

  // Load data on mount
  useEffect(() => {
    if (userId) {
      loadCachedData();
      fetchMotors();
    }
  }, [userId, loadCachedData, fetchMotors]);

  return {
    motorList,
    selectedMotor,
    loading,
    setMotorList,
    setSelectedMotor,
    handleMotorSelect,
    fetchMotorAnalytics,
    fetchMotorcycleDetails,
    loadCachedData,
    fetchMotors,
  };
};
