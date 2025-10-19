/**
 * Custom hook for managing location permissions
 * Centralizes permission logic and provides a single source of truth
 */
import { useState, useEffect, useCallback } from 'react';
import { locationPermissionManager, PermissionStatus } from '../utils/locationPermissionManager';

export const useLocationPermission = () => {
  const [permissionStatus, setPermissionStatus] = useState<PermissionStatus>('undetermined');
  const [isLoading, setIsLoading] = useState(false);

  // Load initial permission status
  useEffect(() => {
    const loadPermissionStatus = async () => {
      const status = locationPermissionManager.getPermissionStatus();
      setPermissionStatus(status);
    };

    loadPermissionStatus();
  }, []);

  // Request permission (only once)
  const requestPermission = useCallback(async (): Promise<PermissionStatus> => {
    setIsLoading(true);
    try {
      const status = await locationPermissionManager.requestPermission();
      setPermissionStatus(status);
      return status;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Check current permission status
  const checkPermissionStatus = useCallback(async (): Promise<PermissionStatus> => {
    setIsLoading(true);
    try {
      const status = await locationPermissionManager.checkPermissionStatus();
      setPermissionStatus(status);
      return status;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Check if permission is granted
  const isPermissionGranted = useCallback((): boolean => {
    return locationPermissionManager.isPermissionGranted();
  }, []);

  // Check if permission was already requested
  const wasPermissionRequested = useCallback(async (): Promise<boolean> => {
    return await locationPermissionManager.wasPermissionRequested();
  }, []);

  // Reset permission status (for testing)
  const resetPermissionStatus = useCallback(async (): Promise<void> => {
    await locationPermissionManager.resetPermissionStatus();
    setPermissionStatus('undetermined');
  }, []);

  return {
    permissionStatus,
    isLoading,
    requestPermission,
    checkPermissionStatus,
    isPermissionGranted,
    wasPermissionRequested,
    resetPermissionStatus,
  };
};
