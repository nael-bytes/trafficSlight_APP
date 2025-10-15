import { AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { startBackgroundLocationTracking, stopBackgroundLocationTracking, getTrackingState } from './backgroundLocation';

export class BackgroundStateManager {
  private static instance: BackgroundStateManager;
  private appState: AppStateStatus = 'active';
  private listeners: Array<(state: AppStateStatus) => void> = [];

  private constructor() {
    this.setupAppStateListener();
  }

  public static getInstance(): BackgroundStateManager {
    if (!BackgroundStateManager.instance) {
      BackgroundStateManager.instance = new BackgroundStateManager();
    }
    return BackgroundStateManager.instance;
  }

  private setupAppStateListener() {
    AppState.addEventListener('change', this.handleAppStateChange.bind(this));
  }

  private async handleAppStateChange(nextAppState: AppStateStatus) {
    const previousAppState = this.appState;
    this.appState = nextAppState;

    console.log('[BackgroundState] App state changed:', previousAppState, '->', nextAppState);

    // Notify listeners
    this.listeners.forEach(listener => listener(nextAppState));

    // Handle background/foreground transitions
    if (previousAppState === 'active' && nextAppState.match(/inactive|background/)) {
      await this.handleAppGoingToBackground();
    } else if (previousAppState.match(/inactive|background/) && nextAppState === 'active') {
      await this.handleAppComingToForeground();
    }
  }

  private async handleAppGoingToBackground() {
    try {
      console.log('[BackgroundState] App going to background');
      
      // Save current timestamp
      await AsyncStorage.setItem('appBackgroundTime', Date.now().toString());
      
      // Mark that app was in background
      const trackingState = await getTrackingState();
      if (trackingState && trackingState.isTracking) {
        await AsyncStorage.setItem('wasInBackground', 'true');
        console.log('[BackgroundState] Marked as background during tracking');
        
        // Notify that background tracking should start
        this.listeners.forEach(listener => {
          if (typeof listener === 'function') {
            listener('background');
          }
        });
      }
    } catch (error) {
      console.error('[BackgroundState] Error handling background transition:', error);
    }
  }

  private async handleAppComingToForeground() {
    try {
      console.log('[BackgroundState] App coming to foreground');
      
      const backgroundTime = await AsyncStorage.getItem('appBackgroundTime');
      const wasInBackground = await AsyncStorage.getItem('wasInBackground');
      
      if (backgroundTime) {
        const timeInBackground = Date.now() - parseInt(backgroundTime);
        console.log('[BackgroundState] Time in background:', Math.round(timeInBackground / 1000), 'seconds');
        
        // Update tracking state if it was tracking
        const trackingState = await getTrackingState();
        if (trackingState && trackingState.isTracking && wasInBackground === 'true') {
          // Update the tracking state to reflect background time
          const updatedState = {
            ...trackingState,
            wasInBackground: true,
            backgroundTime: timeInBackground,
          };
          
          await AsyncStorage.setItem('trackingState', JSON.stringify(updatedState));
          await AsyncStorage.removeItem('wasInBackground');
          await AsyncStorage.removeItem('appBackgroundTime');
          
          console.log('[BackgroundState] Updated tracking state with background info');
        }
      }
    } catch (error) {
      console.error('[BackgroundState] Error handling foreground transition:', error);
    }
  }

  // Add listener for app state changes
  public addListener(listener: (state: AppStateStatus) => void) {
    this.listeners.push(listener);
  }

  // Remove listener
  public removeListener(listener: (state: AppStateStatus) => void) {
    this.listeners = this.listeners.filter(l => l !== listener);
  }

  // Get current app state
  public getCurrentState(): AppStateStatus {
    return this.appState;
  }

  // Check if app is in background
  public isInBackground(): boolean {
    return this.appState !== 'active';
  }

  // Cleanup
  public cleanup() {
    this.listeners = [];
  }
}

// Export singleton instance
export const backgroundStateManager = BackgroundStateManager.getInstance();
