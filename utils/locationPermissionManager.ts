/**
 * Centralized Location Permission Manager
 * Handles location permissions once at app start to avoid multiple permission requests
 */
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PERMISSION_STATUS_KEY = 'location_permission_status';
const PERMISSION_REQUESTED_KEY = 'location_permission_requested';

export type PermissionStatus = 'granted' | 'denied' | 'undetermined' | 'requesting';

class LocationPermissionManager {
  private static instance: LocationPermissionManager;
  private permissionStatus: PermissionStatus = 'undetermined';
  private isRequesting: boolean = false;

  private constructor() {
    this.loadPermissionStatus();
  }

  public static getInstance(): LocationPermissionManager {
    if (!LocationPermissionManager.instance) {
      LocationPermissionManager.instance = new LocationPermissionManager();
    }
    return LocationPermissionManager.instance;
  }

  /**
   * Load permission status from storage
   */
  private async loadPermissionStatus(): Promise<void> {
    try {
      const [status, requested] = await Promise.all([
        AsyncStorage.getItem(PERMISSION_STATUS_KEY),
        AsyncStorage.getItem(PERMISSION_REQUESTED_KEY)
      ]);

      if (status) {
        this.permissionStatus = status as PermissionStatus;
      }

      // If permission was already requested and denied, don't ask again
      if (requested === 'true' && this.permissionStatus === 'denied') {
        console.log('[LocationPermissionManager] Permission already denied, not requesting again');
      }
    } catch (error) {
      console.error('[LocationPermissionManager] Failed to load permission status:', error);
    }
  }

  /**
   * Save permission status to storage
   */
  private async savePermissionStatus(status: PermissionStatus): Promise<void> {
    try {
      await AsyncStorage.setItem(PERMISSION_STATUS_KEY, status);
      if (status !== 'undetermined') {
        await AsyncStorage.setItem(PERMISSION_REQUESTED_KEY, 'true');
      }
    } catch (error) {
      console.error('[LocationPermissionManager] Failed to save permission status:', error);
    }
  }

  /**
   * Get current permission status
   */
  public getPermissionStatus(): PermissionStatus {
    return this.permissionStatus;
  }

  /**
   * Check if permission is granted
   */
  public isPermissionGranted(): boolean {
    return this.permissionStatus === 'granted';
  }

  /**
   * Check if permission was already requested
   */
  public async wasPermissionRequested(): Promise<boolean> {
    try {
      const requested = await AsyncStorage.getItem(PERMISSION_REQUESTED_KEY);
      return requested === 'true';
    } catch (error) {
      console.error('[LocationPermissionManager] Failed to check if permission was requested:', error);
      return false;
    }
  }

  /**
   * Request location permission (only once)
   */
  public async requestPermission(): Promise<PermissionStatus> {
    // If already requesting, wait for it to complete
    if (this.isRequesting) {
      console.log('[LocationPermissionManager] Permission request already in progress, waiting...');
      while (this.isRequesting) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return this.permissionStatus;
    }

    // If already granted, return immediately
    if (this.permissionStatus === 'granted') {
      console.log('[LocationPermissionManager] Permission already granted');
      return this.permissionStatus;
    }

    // If already denied and was requested before, don't ask again
    if (this.permissionStatus === 'denied' && await this.wasPermissionRequested()) {
      console.log('[LocationPermissionManager] Permission already denied, not requesting again');
      return this.permissionStatus;
    }

    this.isRequesting = true;
    this.permissionStatus = 'requesting';

    try {
      console.log('[LocationPermissionManager] Requesting location permission...');
      
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      this.permissionStatus = status as PermissionStatus;
      await this.savePermissionStatus(this.permissionStatus);

      console.log('[LocationPermissionManager] Permission request completed:', this.permissionStatus);
      
      return this.permissionStatus;
    } catch (error) {
      console.error('[LocationPermissionManager] Failed to request permission:', error);
      this.permissionStatus = 'denied';
      await this.savePermissionStatus(this.permissionStatus);
      return this.permissionStatus;
    } finally {
      this.isRequesting = false;
    }
  }

  /**
   * Check current permission status from system
   */
  public async checkPermissionStatus(): Promise<PermissionStatus> {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      this.permissionStatus = status as PermissionStatus;
      await this.savePermissionStatus(this.permissionStatus);
      return this.permissionStatus;
    } catch (error) {
      console.error('[LocationPermissionManager] Failed to check permission status:', error);
      return this.permissionStatus;
    }
  }

  /**
   * Reset permission status (for testing or if user changes settings)
   */
  public async resetPermissionStatus(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([PERMISSION_STATUS_KEY, PERMISSION_REQUESTED_KEY]);
      this.permissionStatus = 'undetermined';
      this.isRequesting = false;
      console.log('[LocationPermissionManager] Permission status reset');
    } catch (error) {
      console.error('[LocationPermissionManager] Failed to reset permission status:', error);
    }
  }
}

// Export singleton instance
export const locationPermissionManager = LocationPermissionManager.getInstance();

// Export types
export type { PermissionStatus };
