/**
 * Fuel Update API Simulation Utility
 * 
 * Simulates GPS location updates and distance traveled for testing
 * the /api/trip/update-distance endpoint integration without actual travel.
 * 
 * Usage:
 * - Enable simulation mode in development
 * - Simulates location updates and distance traveled
 * - Tests API calls and fuel level updates
 * - Verifies low fuel warnings
 */

import { updateTripDistanceWithRetry, type TripDistanceUpdateResponse } from './tripDistanceUpdate';
import type { Motor, LocationCoords } from '../../types';

export interface SimulationConfig {
  userMotorId: string;
  selectedMotor: Motor;
  startLocation: LocationCoords;
  speedKmh?: number; // Simulated speed in km/h (default: 50 km/h)
  updateInterval?: number; // Interval between updates in ms (default: 5000ms = 5 seconds)
  totalDuration?: number; // Total simulation duration in seconds (default: 60 seconds)
  onFuelUpdate?: (fuelLevel: number, lowFuelWarning: boolean) => void;
  onDistanceUpdate?: (totalDistance: number, lastPosted: number) => void;
  onApiResponse?: (response: TripDistanceUpdateResponse | null) => void;
  onError?: (error: Error) => void;
}

export interface SimulationState {
  isRunning: boolean;
  totalDistanceTraveled: number;
  lastPostedDistance: number;
  currentFuelLevel: number;
  elapsedTime: number;
  currentLocation: LocationCoords;
  apiCallCount: number;
  successfulCalls: number;
  failedCalls: number;
  skippedCalls: number;
}

/**
 * Simulate fuel update API integration
 * 
 * This function simulates a trip by:
 * 1. Generating GPS location updates at regular intervals
 * 2. Calculating distance traveled based on speed
 * 3. Calling /api/trip/update-distance every 5 seconds
 * 4. Updating fuel level based on API responses
 * 5. Triggering low fuel warnings when appropriate
 */
export class FuelUpdateSimulator {
  private config: SimulationConfig;
  private state: SimulationState;
  private intervalRef: NodeJS.Timeout | null = null;
  private apiIntervalRef: NodeJS.Timeout | null = null;
  private startTime: number = 0;

  constructor(config: SimulationConfig) {
    this.config = {
      speedKmh: 50, // Default: 50 km/h
      updateInterval: 5000, // Default: 5 seconds
      totalDuration: 60, // Default: 60 seconds
      ...config,
    };

    this.state = {
      isRunning: false,
      totalDistanceTraveled: 0,
      lastPostedDistance: 0,
      currentFuelLevel: config.selectedMotor.currentFuelLevel || 100,
      elapsedTime: 0,
      currentLocation: config.startLocation,
      apiCallCount: 0,
      successfulCalls: 0,
      failedCalls: 0,
      skippedCalls: 0,
    };
  }

  /**
   * Start the simulation
   */
  start(): void {
    if (this.state.isRunning) {
      console.warn('[FuelUpdateSimulator] Simulation already running');
      return;
    }

    this.state.isRunning = true;
    this.startTime = Date.now();

    console.log('[FuelUpdateSimulator] 🚀 Starting simulation', {
      userMotorId: this.config.userMotorId,
      startFuelLevel: this.state.currentFuelLevel,
      speed: this.config.speedKmh,
      duration: this.config.totalDuration,
    });

    // Start API calls every 5 seconds (as per API documentation)
    this.apiIntervalRef = setInterval(() => {
      this.callUpdateDistanceAPI();
    }, 5000);

    // Start location simulation (updates every second for smooth simulation)
    this.intervalRef = setInterval(() => {
      this.simulateLocationUpdate();
    }, 1000);

    // Stop simulation after total duration
    setTimeout(() => {
      this.stop();
    }, (this.config.totalDuration || 60) * 1000);
  }

  /**
   * Stop the simulation
   */
  stop(): void {
    if (!this.state.isRunning) {
      return;
    }

    this.state.isRunning = false;

    if (this.intervalRef) {
      clearInterval(this.intervalRef);
      this.intervalRef = null;
    }

    if (this.apiIntervalRef) {
      clearInterval(this.apiIntervalRef);
      this.apiIntervalRef = null;
    }

    // Final API call to update remaining distance
    if (this.state.totalDistanceTraveled > this.state.lastPostedDistance) {
      this.callUpdateDistanceAPI();
    }

    console.log('[FuelUpdateSimulator] 🛑 Simulation stopped', {
      totalDistance: this.state.totalDistanceTraveled.toFixed(2),
      finalFuelLevel: this.state.currentFuelLevel.toFixed(2),
      apiCalls: this.state.apiCallCount,
      successful: this.state.successfulCalls,
      failed: this.state.failedCalls,
      skipped: this.state.skippedCalls,
    });
  }

  /**
   * Simulate GPS location update
   * Moves the location forward based on speed
   */
  private simulateLocationUpdate(): void {
    if (!this.state.isRunning) return;

    const speedMs = (this.config.speedKmh || 50) / 3.6; // Convert km/h to m/s
    const timeDelta = 1; // 1 second
    const distanceDeltaM = speedMs * timeDelta;
    const distanceDeltaKm = distanceDeltaM / 1000;

    // Update total distance
    this.state.totalDistanceTraveled += distanceDeltaKm;

    // Simulate location movement (move north-east)
    // In real scenario, this would be actual GPS coordinates
    const latDelta = distanceDeltaKm / 111; // ~111 km per degree latitude
    const lngDelta = distanceDeltaKm / (111 * Math.cos(this.state.currentLocation.latitude * Math.PI / 180));

    this.state.currentLocation = {
      ...this.state.currentLocation,
      latitude: this.state.currentLocation.latitude + latDelta,
      longitude: this.state.currentLocation.longitude + lngDelta,
    };

    this.state.elapsedTime += timeDelta;

    // Notify distance update
    if (this.config.onDistanceUpdate) {
      this.config.onDistanceUpdate(
        this.state.totalDistanceTraveled,
        this.state.lastPostedDistance
      );
    }
  }

  /**
   * Call the update-distance API
   */
  private async callUpdateDistanceAPI(): Promise<void> {
    if (!this.state.isRunning) return;

    const totalDistance = this.state.totalDistanceTraveled;
    const lastPosted = this.state.lastPostedDistance;

    // Only call if there's new distance to report
    if (totalDistance <= lastPosted) {
      if (__DEV__) {
        console.log('[FuelUpdateSimulator] ⏭️ Skipping API call (no new distance)', {
          totalDistance,
          lastPosted,
        });
      }
      return;
    }

    this.state.apiCallCount++;

    try {
      console.log('[FuelUpdateSimulator] 📡 Calling API', {
        callNumber: this.state.apiCallCount,
        totalDistanceTraveled: totalDistance.toFixed(4),
        lastPostedDistance: lastPosted.toFixed(4),
        actualDistanceTraveled: (totalDistance - lastPosted).toFixed(4),
      });

      const response = await updateTripDistanceWithRetry(
        this.config.userMotorId,
        totalDistance,
        lastPosted
      );

      // Handle skipped updates
      if (response === null) {
        this.state.skippedCalls++;
        console.log('[FuelUpdateSimulator] ⏭️ Update skipped (distance too small)');
        
        if (this.config.onApiResponse) {
          this.config.onApiResponse(null);
        }
        return;
      }

      // Handle successful update
      if (response.success && response.newFuelLevel !== undefined) {
        this.state.successfulCalls++;
        this.state.lastPostedDistance = totalDistance;
        this.state.currentFuelLevel = response.newFuelLevel;

        console.log('[FuelUpdateSimulator] ✅ API call successful', {
          actualDistanceTraveled: response.actualDistanceTraveled?.toFixed(4),
          fuelUsedLiters: response.fuelUsedLiters?.toFixed(4),
          fuelUsedPercent: response.fuelUsedPercent?.toFixed(4),
          newFuelLevel: response.newFuelLevel.toFixed(2),
          lowFuelWarning: response.lowFuelWarning,
          remainingDistance: response.totalDrivableDistanceWithCurrentGas?.toFixed(2),
        });

        // Notify fuel update
        if (this.config.onFuelUpdate) {
          this.config.onFuelUpdate(
            response.newFuelLevel,
            response.lowFuelWarning || false
          );
        }

        // Notify API response
        if (this.config.onApiResponse) {
          this.config.onApiResponse(response);
        }

        // Show low fuel warning
        if (response.lowFuelWarning) {
          console.warn('[FuelUpdateSimulator] ⚠️ LOW FUEL WARNING!', {
            fuelLevel: response.newFuelLevel.toFixed(2),
            remainingDistance: response.totalDrivableDistanceWithCurrentGas?.toFixed(2),
          });
        }
      }
    } catch (error: any) {
      this.state.failedCalls++;
      console.error('[FuelUpdateSimulator] ❌ API call failed', {
        error: error.message,
        callNumber: this.state.apiCallCount,
      });

      if (this.config.onError) {
        this.config.onError(error);
      }
    }
  }

  /**
   * Get current simulation state
   */
  getState(): SimulationState {
    return { ...this.state };
  }

  /**
   * Reset simulation state
   */
  reset(): void {
    this.stop();
    this.state = {
      isRunning: false,
      totalDistanceTraveled: 0,
      lastPostedDistance: 0,
      currentFuelLevel: this.config.selectedMotor.currentFuelLevel || 100,
      elapsedTime: 0,
      currentLocation: this.config.startLocation,
      apiCallCount: 0,
      successfulCalls: 0,
      failedCalls: 0,
      skippedCalls: 0,
    };
  }
}

/**
 * Quick simulation function for testing
 */
export const simulateFuelUpdate = async (
  userMotorId: string,
  selectedMotor: Motor,
  startLocation: LocationCoords,
  options?: {
    speedKmh?: number;
    duration?: number;
    onFuelUpdate?: (fuelLevel: number, lowFuelWarning: boolean) => void;
  }
): Promise<FuelUpdateSimulator> => {
  const simulator = new FuelUpdateSimulator({
    userMotorId,
    selectedMotor,
    startLocation,
    speedKmh: options?.speedKmh || 50,
    totalDuration: options?.duration || 60,
    onFuelUpdate: options?.onFuelUpdate,
  });

  simulator.start();
  return simulator;
};

