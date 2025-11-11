/**
 * useMotorDetails Hook
 * 
 * Extracts motor details fetching logic:
 * - fetchMotorcycleDetails function
 * - Effect to populate fuelTank, engineDisplacement, and model name
 * 
 * @module useMotorDetails
 */

import { useCallback, useEffect, useRef } from 'react';
import type { Motor } from '../../types';

// Use deployed backend instead of localhost
const API_BASE = "https://ts-backend-1-jyit.onrender.com";

interface UseMotorDetailsParams {
  selectedMotor: Motor | null;
  user: any;
  setSelectedMotor: (motor: Motor | null | ((prev: Motor | null) => Motor | null)) => void;
}

interface UseMotorDetailsReturn {
  fetchMotorcycleDetails: (motorcycleId: string) => Promise<{
    fuelTank: number;
    engineDisplacement: number | null;
    model: string | null;
  }>;
}

/**
 * Custom hook for managing motor details fetching
 */
export const useMotorDetails = ({
  selectedMotor,
  user,
  setSelectedMotor,
}: UseMotorDetailsParams): UseMotorDetailsReturn => {
  // Function to fetch motorcycle details and populate fuelTank and engineDisplacement
  const fetchMotorcycleDetails = useCallback(async (motorcycleId: string) => {
    if (__DEV__) {
      console.log('[useMotorDetails] 🔍 fetchMotorcycleDetails called', {
        motorcycleId,
        timestamp: new Date().toISOString(),
      });
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      if (__DEV__) {
        console.log('[useMotorDetails] 📡 Fetching motorcycle details from API', {
          url: `${API_BASE}/api/motorcycles/${motorcycleId}`,
          timestamp: new Date().toISOString(),
        });
      }

      const response = await fetch(`${API_BASE}/api/motorcycles/${motorcycleId}`, {
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user?.token || ''}`,
        },
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const motorcycleData = await response.json();

        if (__DEV__) {
          console.log('[useMotorDetails] ✅ Motorcycle details fetched successfully', {
            motorcycleId,
            model: motorcycleData.model,
            fuelTank: motorcycleData.fuelTank,
            engineDisplacement: motorcycleData.engineDisplacement,
            timestamp: new Date().toISOString(),
          });
        }

        // Return fuelTank, engineDisplacement, and model name
        return {
          fuelTank: motorcycleData.fuelTank || 15, // Default to 15L if not provided
          engineDisplacement: motorcycleData.engineDisplacement || null, // Return null if not provided
          model: motorcycleData.model || null, // CRITICAL: Get model name from motorcycle
        };
      } else {
        console.warn('[useMotorDetails] ❌ Failed to fetch motorcycle details:', {
          status: response.status,
          statusText: response.statusText,
          motorcycleId,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.warn('[useMotorDetails] ⏱️ Motorcycle details request timed out', {
          motorcycleId,
          timestamp: new Date().toISOString(),
        });
      } else {
        console.warn('[useMotorDetails] ❌ Failed to fetch motorcycle details:', {
          error: error.message,
          motorcycleId,
          timestamp: new Date().toISOString(),
        });
      }
    }

    // Default fallback
    if (__DEV__) {
      console.log('[useMotorDetails] 🔄 Returning default motorcycle details', {
        motorcycleId,
        timestamp: new Date().toISOString(),
      });
    }

    return {
      fuelTank: 15,
      engineDisplacement: null,
      model: null,
    };
  }, [user?.token]);

  // Effect 7.5: Populate fuelTank, engineDisplacement, and model name if missing
  // CRITICAL FIX: Extract motorcycleId as string and prevent infinite loops
  const hasFetchedRef = useRef<Set<string>>(new Set());
  
  useEffect(() => {
    if (!selectedMotor || !selectedMotor.motorcycleId) return;
    
    // Extract motorcycleId as string (handle both string and object cases)
    let motorcycleIdStr: string;
    if (typeof selectedMotor.motorcycleId === 'string') {
      motorcycleIdStr = selectedMotor.motorcycleId;
    } else if (selectedMotor.motorcycleId && typeof selectedMotor.motorcycleId === 'object') {
      // If it's an object, extract the _id
      motorcycleIdStr = (selectedMotor.motorcycleId as any)?._id || (selectedMotor.motorcycleId as any)?.id || '';
    } else {
      if (__DEV__) {
        console.warn('[useMotorDetails] Invalid motorcycleId type:', typeof selectedMotor.motorcycleId);
      }
      return;
    }
    
    if (!motorcycleIdStr) {
      if (__DEV__) {
        console.warn('[useMotorDetails] No valid motorcycleId found');
      }
      return;
    }
    
    // Prevent infinite loops - check if we've already fetched for this motor
    const fetchKey = `${motorcycleIdStr}-${selectedMotor.fuelTank || 0}-${selectedMotor.engineDisplacement || 0}-${selectedMotor.name || ''}`;
    if (hasFetchedRef.current.has(fetchKey)) {
      return; // Already fetched for this combination
    }
    
    // Check if we need to fetch details (missing fuelTank, engineDisplacement, or model name)
    const needsFuelTank = !selectedMotor.fuelTank || selectedMotor.fuelTank === 0;
    const needsEngineDisplacement = !selectedMotor.engineDisplacement || selectedMotor.engineDisplacement === 0;
    const needsModelName = !selectedMotor.name || selectedMotor.name === '';

    if (needsFuelTank || needsEngineDisplacement || needsModelName) {
      // Mark as fetching to prevent duplicate calls
      hasFetchedRef.current.add(fetchKey);
      
      if (__DEV__) {
        console.log('[useMotorDetails] Fetching motorcycle details for:', selectedMotor.nickname, {
          motorcycleId: motorcycleIdStr,
          needsFuelTank,
          needsEngineDisplacement,
          needsModelName
        });
      }
      
      fetchMotorcycleDetails(motorcycleIdStr).then(details => {
        // Only update if motor is still selected and we got valid details
        if (selectedMotor && (details.fuelTank || details.engineDisplacement || details.model)) {
          const updatedMotor = {
            ...selectedMotor,
            ...(needsFuelTank && details.fuelTank ? { fuelTank: details.fuelTank } : {}),
            ...(needsEngineDisplacement && details.engineDisplacement ? { engineDisplacement: details.engineDisplacement } : {}),
            ...(needsModelName && details.model ? { name: details.model } : {}), // CRITICAL: Update model name
          } as Motor;
          setSelectedMotor(updatedMotor);
          if (__DEV__) {
            console.log('[useMotorDetails] ✅ Updated motor details:', {
              fuelTank: updatedMotor.fuelTank,
              engineDisplacement: updatedMotor.engineDisplacement,
              model: updatedMotor.name
            });
          }
        }
      }).catch(() => {
        // Remove from fetched set on error so it can retry
        hasFetchedRef.current.delete(fetchKey);
        // Silently fail - will use default values
      });
    }
    
    // Cleanup: Remove old fetch keys to prevent memory leak
    if (hasFetchedRef.current.size > 100) {
      hasFetchedRef.current.clear();
    }
  }, [selectedMotor?.motorcycleId, selectedMotor?.fuelTank, selectedMotor?.engineDisplacement, selectedMotor?.name, fetchMotorcycleDetails, setSelectedMotor]);

  return {
    fetchMotorcycleDetails,
  };
};

