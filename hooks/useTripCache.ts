/**
 * Custom hook for trip cache management
 * Provides easy access to trip caching functionality
 */
import { useState, useEffect, useCallback } from 'react';
import { tripCacheManager, TripCacheData } from '../utils/tripCacheManager';

export const useTripCache = () => {
  const [currentTrip, setCurrentTrip] = useState<TripCacheData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasRecoverableTrip, setHasRecoverableTrip] = useState(false);

  // Load current trip on mount
  useEffect(() => {
    const loadCurrentTrip = async () => {
      setIsLoading(true);
      try {
        const trip = await tripCacheManager.getCurrentTrip();
        setCurrentTrip(trip);
        setHasRecoverableTrip(!!trip);
      } catch (error) {
        console.error('[useTripCache] Failed to load current trip:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadCurrentTrip();
  }, []);

  // Save trip data
  const saveTripData = useCallback(async (tripData: Partial<TripCacheData>): Promise<void> => {
    try {
      await tripCacheManager.saveTripData(tripData);
      
      // Update local state
      const updatedTrip = await tripCacheManager.getCurrentTrip();
      setCurrentTrip(updatedTrip);
      setHasRecoverableTrip(!!updatedTrip);
    } catch (error) {
      console.error('[useTripCache] Failed to save trip data:', error);
      throw error;
    }
  }, []);

  // Recover trip data
  const recoverTrip = useCallback(async (): Promise<TripCacheData | null> => {
    setIsLoading(true);
    try {
      const trip = await tripCacheManager.recoverTrip();
      setCurrentTrip(trip);
      setHasRecoverableTrip(!!trip);
      return trip;
    } catch (error) {
      console.error('[useTripCache] Failed to recover trip:', error);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Clear trip data
  const clearTripData = useCallback(async (): Promise<void> => {
    try {
      await tripCacheManager.clearTripData();
      setCurrentTrip(null);
      setHasRecoverableTrip(false);
    } catch (error) {
      console.error('[useTripCache] Failed to clear trip data:', error);
      throw error;
    }
  }, []);

  // Save to history and clear
  const completeTrip = useCallback(async (): Promise<void> => {
    try {
      if (currentTrip) {
        await tripCacheManager.saveToHistory(currentTrip);
      }
      await tripCacheManager.clearTripData();
      setCurrentTrip(null);
      setHasRecoverableTrip(false);
    } catch (error) {
      console.error('[useTripCache] Failed to complete trip:', error);
      throw error;
    }
  }, [currentTrip]);

  // Start auto-cache
  const startAutoCache = useCallback(() => {
    tripCacheManager.startAutoCache();
  }, []);

  // Stop auto-cache
  const stopAutoCache = useCallback(() => {
    tripCacheManager.stopAutoCache();
  }, []);

  // Get cache statistics
  const getCacheStats = useCallback(async () => {
    try {
      return await tripCacheManager.getCacheStats();
    } catch (error) {
      console.error('[useTripCache] Failed to get cache stats:', error);
      return {
        hasCurrentTrip: false,
        hasBackup: false,
      };
    }
  }, []);

  // Check if trip is recoverable
  const checkRecoverableTrip = useCallback(async (): Promise<boolean> => {
    try {
      const hasTrip = await tripCacheManager.hasRecoverableTrip();
      setHasRecoverableTrip(hasTrip);
      return hasTrip;
    } catch (error) {
      console.error('[useTripCache] Failed to check recoverable trip:', error);
      return false;
    }
  }, []);

  // Clear completed trips
  const clearCompletedTrips = useCallback(async (): Promise<void> => {
    try {
      await tripCacheManager.clearCompletedTrips();
      setCurrentTrip(null);
      setHasRecoverableTrip(false);
    } catch (error) {
      console.error('[useTripCache] Failed to clear completed trips:', error);
      throw error;
    }
  }, []);

  return {
    currentTrip,
    isLoading,
    hasRecoverableTrip,
    saveTripData,
    recoverTrip,
    clearTripData,
    completeTrip,
    startAutoCache,
    stopAutoCache,
    getCacheStats,
    checkRecoverableTrip,
    clearCompletedTrips,
  };
};
