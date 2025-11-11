import { useState, useCallback, useEffect } from 'react';
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LOCALHOST_IP } from "@env";
import { apiRequest } from '../utils/api';

import type { Motor } from '../types';

export const useMotorManagement = (userId: string | undefined) => {
  const [motorList, setMotorList] = useState<Motor[]>([]);
  const [selectedMotor, setSelectedMotor] = useState<Motor | null>(null);
  const [loading, setLoading] = useState(false);

  // Fetch user motors - Updated to use correct API endpoint per API documentation
  // CRITICAL: Also fetches motorcycle model data to populate engineDisplacement
  const fetchMotorAnalytics = useCallback(async (userId: string): Promise<Motor[]> => {
    try {
      // Use correct endpoint: GET /api/user-motors/user/:id (per API documentation)
      // This endpoint returns user motors with analytics data
      const data = await apiRequest<Motor[]>(`/api/user-motors/user/${userId}`);
      
      // API returns array of motors directly, or wrapped in a property
      let motors = Array.isArray(data) ? data : (data.motors || data.data || []);
      
      if (motors.length > 0) {
        console.log(`[useMotorManagement] Successfully fetched ${motors.length} motors for user ${userId}`);
        
        // CRITICAL: Populate missing engineDisplacement, fuelTank, and model name from motorcycle model
        // Check if any motors are missing engineDisplacement, fuelTank, or model name
        const motorsNeedingDetails = motors.filter(m => 
          !m.engineDisplacement || m.engineDisplacement === 0 || 
          !m.fuelTank || m.fuelTank === 0 ||
          !m.name || m.name === ''
        );
        
        if (motorsNeedingDetails.length > 0) {
          console.log(`[useMotorManagement] ${motorsNeedingDetails.length} motors need motorcycle model details`);
          
          // Fetch motorcycle model details for motors that need it
          const motorsWithDetails = await Promise.all(
            motors.map(async (motor) => {
              // If motor already has all details, skip
              if (motor.engineDisplacement && motor.engineDisplacement > 0 && 
                  motor.fuelTank && motor.fuelTank > 0 &&
                  motor.name && motor.name !== '') {
                return motor;
              }
              
              // If motorcycleId is a string (ID), fetch the model
              if (motor.motorcycleId && typeof motor.motorcycleId === 'string') {
                try {
                  const response = await fetch(`${LOCALHOST_IP}/api/motorcycles/${motor.motorcycleId}`);
                  if (response.ok) {
                    const motorcycleData = await response.json();
                    return {
                      ...motor,
                      name: motor.name || motorcycleData.model || motor.nickname || 'Unknown Model', // CRITICAL: Get model name from motorcycle
                      engineDisplacement: motor.engineDisplacement || motorcycleData.engineDisplacement || 0,
                      fuelTank: motor.fuelTank || motorcycleData.fuelTank || 15,
                    } as Motor;
                  }
                } catch (error) {
                  console.warn(`[useMotorManagement] Failed to fetch motorcycle details for ${motor.motorcycleId}:`, error);
                }
              }
              
              // If motorcycleId is an object (populated), use it directly
              if (motor.motorcycleId && typeof motor.motorcycleId === 'object') {
                const motorcycleData = motor.motorcycleId as any;
                return {
                  ...motor,
                  name: motor.name || motorcycleData.model || motor.nickname || 'Unknown Model', // CRITICAL: Get model name from motorcycle
                  engineDisplacement: motor.engineDisplacement || motorcycleData.engineDisplacement || 0,
                  fuelTank: motor.fuelTank || motorcycleData.fuelTank || 15,
                } as Motor;
              }
              
              return motor;
            })
          );
          
          motors = motorsWithDetails;
          console.log(`[useMotorManagement] ✅ Populated motorcycle details for all motors`);
        }
      } else {
        console.warn(`[useMotorManagement] No motors found for user ${userId}`);
      }
      
      return motors;
    } catch (error) {
      console.error("[useMotorManagement] Failed to fetch user motors:", error);
      // Return empty array on error to prevent breaking the app
      return [];
    }
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
