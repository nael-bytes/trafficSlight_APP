// Predictive Caching System
// Analyzes user behavior patterns to preload frequently accessed data

import { cacheManager, CACHE_KEYS } from './cacheManager';
import { cacheAnalytics } from './cacheAnalytics';

export interface PredictivePattern {
  key: string;
  frequency: number;
  lastAccessed: number;
  averageInterval: number;
  nextPredictedAccess: number;
  confidence: number;
  dataType: 'motors' | 'reports' | 'gasStations' | 'trips' | 'destinations' | 'fuelLogs' | 'maintenance';
}

export interface PredictiveCacheConfig {
  enabled: boolean;
  preloadThreshold: number; // Minimum confidence to preload
  maxPreloadSize: number; // Maximum data size to preload (in MB)
  analysisWindow: number; // Time window for pattern analysis (in hours)
  updateInterval: number; // How often to update predictions (in minutes)
}

class PredictiveCacheManager {
  private static instance: PredictiveCacheManager;
  private patterns: Map<string, PredictivePattern>;
  private config: PredictiveCacheConfig;
  private lastAnalysis: number;
  private preloadQueue: string[];
  private isPreloading: boolean;

  constructor() {
    this.patterns = new Map();
    this.config = {
      enabled: true,
      preloadThreshold: 0.7, // 70% confidence
      maxPreloadSize: 10 * 1024 * 1024, // 10MB
      analysisWindow: 24, // 24 hours
      updateInterval: 30, // 30 minutes
    };
    this.lastAnalysis = 0;
    this.preloadQueue = [];
    this.isPreloading = false;
  }

  static getInstance(): PredictiveCacheManager {
    if (!PredictiveCacheManager.instance) {
      PredictiveCacheManager.instance = new PredictiveCacheManager();
    }
    return PredictiveCacheManager.instance;
  }

  // Analyze access patterns
  async analyzePatterns(): Promise<void> {
    if (!this.config.enabled) return;

    try {
      const analytics = await cacheAnalytics.getAnalytics();
      const now = Date.now();
      const analysisWindow = this.config.analysisWindow * 60 * 60 * 1000; // Convert to ms

      // Analyze each key's access pattern
      for (const keyData of analytics.topAccessedKeys) {
        const key = keyData.key;
        const accessCount = keyData.accessCount;
        const lastAccessed = keyData.lastAccessed;

        // Skip if not enough data or too old
        if (accessCount < 3 || (now - lastAccessed) > analysisWindow) {
          continue;
        }

        // Calculate pattern metrics
        const frequency = accessCount / (analysisWindow / (60 * 60 * 1000)); // Accesses per hour
        const averageInterval = analysisWindow / accessCount;
        const nextPredictedAccess = lastAccessed + averageInterval;
        const confidence = this.calculateConfidence(accessCount, frequency, lastAccessed);

        // Create or update pattern
        const pattern: PredictivePattern = {
          key,
          frequency,
          lastAccessed,
          averageInterval,
          nextPredictedAccess,
          confidence,
          dataType: this.getDataTypeFromKey(key),
        };

        this.patterns.set(key, pattern);
      }

      // Update preload queue
      this.updatePreloadQueue();
      this.lastAnalysis = now;

      console.log('[PredictiveCache] Pattern analysis completed:', {
        patternsAnalyzed: this.patterns.size,
        preloadQueueSize: this.preloadQueue.length,
      });
    } catch (error) {
      console.error('[PredictiveCache] Error analyzing patterns:', error);
    }
  }

  // Calculate confidence score for a pattern
  private calculateConfidence(accessCount: number, frequency: number, lastAccessed: number): number {
    const now = Date.now();
    const recency = Math.max(0, 1 - (now - lastAccessed) / (24 * 60 * 60 * 1000)); // Decay over 24 hours
    const frequencyScore = Math.min(1, frequency / 10); // Normalize frequency
    const accessScore = Math.min(1, accessCount / 20); // Normalize access count

    return (recency * 0.4 + frequencyScore * 0.4 + accessScore * 0.2);
  }

  // Get data type from cache key
  private getDataTypeFromKey(key: string): PredictivePattern['dataType'] {
    if (key.includes('motors')) return 'motors';
    if (key.includes('reports')) return 'reports';
    if (key.includes('gasStations')) return 'gasStations';
    if (key.includes('trips')) return 'trips';
    if (key.includes('destinations')) return 'destinations';
    if (key.includes('fuelLogs')) return 'fuelLogs';
    if (key.includes('maintenance')) return 'maintenance';
    return 'motors'; // Default
  }

  // Update preload queue based on patterns
  private updatePreloadQueue(): void {
    const now = Date.now();
    const predictions = Array.from(this.patterns.values())
      .filter(pattern => 
        pattern.confidence >= this.config.preloadThreshold &&
        pattern.nextPredictedAccess <= now + (30 * 60 * 1000) // Next 30 minutes
      )
      .sort((a, b) => b.confidence - a.confidence);

    this.preloadQueue = predictions.map(p => p.key);
  }

  // Execute predictive preloading
  async executePreloading(userId: string): Promise<void> {
    if (!this.config.enabled || this.isPreloading || this.preloadQueue.length === 0) {
      return;
    }

    this.isPreloading = true;
    console.log('[PredictiveCache] Starting predictive preloading...');

    try {
      const preloadPromises = this.preloadQueue.map(async (key) => {
        try {
          // Check if data is already cached and fresh
          const cached = await cacheManager.get(key);
          if (cached) {
            console.log(`[PredictiveCache] ${key} already cached, skipping`);
            return;
          }

          // Preload based on data type
          await this.preloadDataByType(key, userId);
        } catch (error) {
          console.warn(`[PredictiveCache] Failed to preload ${key}:`, error);
        }
      });

      await Promise.allSettled(preloadPromises);
      console.log('[PredictiveCache] Predictive preloading completed');
    } catch (error) {
      console.error('[PredictiveCache] Error during preloading:', error);
    } finally {
      this.isPreloading = false;
    }
  }

  // Preload data based on type
  private async preloadDataByType(key: string, userId: string): Promise<void> {
    const pattern = this.patterns.get(key);
    if (!pattern) return;

    console.log(`[PredictiveCache] Preloading ${pattern.dataType} for user ${userId}`);

    switch (pattern.dataType) {
      case 'motors':
        await this.preloadMotors(userId);
        break;
      case 'reports':
        await this.preloadReports(userId);
        break;
      case 'gasStations':
        await this.preloadGasStations(userId);
        break;
      case 'trips':
        await this.preloadTrips(userId);
        break;
      case 'destinations':
        await this.preloadDestinations(userId);
        break;
      case 'fuelLogs':
        await this.preloadFuelLogs(userId);
        break;
      case 'maintenance':
        await this.preloadMaintenance(userId);
        break;
    }
  }

  // Preload motors data
  private async preloadMotors(userId: string): Promise<void> {
    try {
      const response = await fetch(`${process.env.LOCALHOST_IP || 'http://localhost:3000'}/api/user-motors/user/${userId}`);
      if (response.ok) {
        const motors = await response.json();
        await cacheManager.set(CACHE_KEYS.MOTORS(userId), motors, userId);
        console.log(`[PredictiveCache] Preloaded ${motors.length} motors`);
      }
    } catch (error) {
      console.warn('[PredictiveCache] Failed to preload motors:', error);
    }
  }

  // Preload reports data
  private async preloadReports(userId: string): Promise<void> {
    try {
      const response = await fetch(`${process.env.LOCALHOST_IP || 'http://localhost:3000'}/api/reports`);
      if (response.ok) {
        const reports = await response.json();
        await cacheManager.set(CACHE_KEYS.REPORTS(userId), reports, userId);
        console.log(`[PredictiveCache] Preloaded ${reports.length} reports`);
      }
    } catch (error) {
      console.warn('[PredictiveCache] Failed to preload reports:', error);
    }
  }

  // Preload gas stations data
  private async preloadGasStations(userId: string): Promise<void> {
    try {
      const response = await fetch(`${process.env.LOCALHOST_IP || 'http://localhost:3000'}/api/gas-stations`);
      if (response.ok) {
        const gasStations = await response.json();
        await cacheManager.set(CACHE_KEYS.GAS_STATIONS(userId), gasStations, userId);
        console.log(`[PredictiveCache] Preloaded ${gasStations.length} gas stations`);
      }
    } catch (error) {
      console.warn('[PredictiveCache] Failed to preload gas stations:', error);
    }
  }

  // Preload trips data
  private async preloadTrips(userId: string): Promise<void> {
    try {
      const response = await fetch(`${process.env.LOCALHOST_IP || 'http://localhost:3000'}/api/trips/user/${userId}`);
      if (response.ok) {
        const trips = await response.json();
        await cacheManager.set(CACHE_KEYS.TRIPS(userId), trips, userId);
        console.log(`[PredictiveCache] Preloaded ${trips.length} trips`);
      }
    } catch (error) {
      console.warn('[PredictiveCache] Failed to preload trips:', error);
    }
  }

  // Preload destinations data
  private async preloadDestinations(userId: string): Promise<void> {
    try {
      const response = await fetch(`${process.env.LOCALHOST_IP || 'http://localhost:3000'}/api/saved-destinations/${userId}`);
      if (response.ok) {
        const destinations = await response.json();
        await cacheManager.set(CACHE_KEYS.DESTINATIONS(userId), destinations, userId);
        console.log(`[PredictiveCache] Preloaded ${destinations.length} destinations`);
      }
    } catch (error) {
      console.warn('[PredictiveCache] Failed to preload destinations:', error);
    }
  }

  // Preload fuel logs data
  private async preloadFuelLogs(userId: string): Promise<void> {
    try {
      const response = await fetch(`${process.env.LOCALHOST_IP || 'http://localhost:3000'}/api/fuel-logs/${userId}`);
      if (response.ok) {
        const fuelLogs = await response.json();
        await cacheManager.set(CACHE_KEYS.FUEL_LOGS(userId), fuelLogs, userId);
        console.log(`[PredictiveCache] Preloaded ${fuelLogs.length} fuel logs`);
      }
    } catch (error) {
      console.warn('[PredictiveCache] Failed to preload fuel logs:', error);
    }
  }

  // Preload maintenance data
  private async preloadMaintenance(userId: string): Promise<void> {
    try {
      const response = await fetch(`${process.env.LOCALHOST_IP || 'http://localhost:3000'}/api/maintenance-records/user/${userId}`);
      if (response.ok) {
        const maintenance = await response.json();
        await cacheManager.set(CACHE_KEYS.MAINTENANCE(userId), maintenance, userId);
        console.log(`[PredictiveCache] Preloaded ${maintenance.length} maintenance records`);
      }
    } catch (error) {
      console.warn('[PredictiveCache] Failed to preload maintenance:', error);
    }
  }

  // Get predictions for a specific time window
  getPredictions(timeWindow: number = 60 * 60 * 1000): PredictivePattern[] {
    const now = Date.now();
    return Array.from(this.patterns.values())
      .filter(pattern => 
        pattern.nextPredictedAccess <= now + timeWindow &&
        pattern.confidence >= this.config.preloadThreshold
      )
      .sort((a, b) => a.nextPredictedAccess - b.nextPredictedAccess);
  }

  // Get pattern for specific key
  getPattern(key: string): PredictivePattern | null {
    return this.patterns.get(key) || null;
  }

  // Update configuration
  updateConfig(newConfig: Partial<PredictiveCacheConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('[PredictiveCache] Configuration updated:', this.config);
  }

  // Get current configuration
  getConfig(): PredictiveCacheConfig {
    return { ...this.config };
  }

  // Check if analysis is needed
  shouldAnalyze(): boolean {
    const now = Date.now();
    return (now - this.lastAnalysis) > (this.config.updateInterval * 60 * 1000);
  }

  // Get preload queue status
  getPreloadStatus(): { queueSize: number; isPreloading: boolean; nextPrediction: number | null } {
    const nextPrediction = this.preloadQueue.length > 0 
      ? Math.min(...this.preloadQueue.map(key => this.patterns.get(key)?.nextPredictedAccess || Infinity))
      : null;

    return {
      queueSize: this.preloadQueue.length,
      isPreloading: this.isPreloading,
      nextPrediction,
    };
  }

  // Reset predictions
  reset(): void {
    this.patterns.clear();
    this.preloadQueue = [];
    this.isPreloading = false;
    this.lastAnalysis = 0;
    console.log('[PredictiveCache] Predictions reset');
  }
}

// Export singleton instance
export const predictiveCache = PredictiveCacheManager.getInstance();

// Utility functions for predictive caching
export const predictiveUtils = {
  // Format confidence score
  formatConfidence: (confidence: number): string => {
    return `${(confidence * 100).toFixed(1)}%`;
  },

  // Format time until next access
  formatTimeUntilAccess: (nextAccess: number): string => {
    const now = Date.now();
    const diff = nextAccess - now;
    
    if (diff <= 0) return 'Now';
    if (diff < 60000) return `${Math.round(diff / 1000)}s`;
    if (diff < 3600000) return `${Math.round(diff / 60000)}m`;
    return `${Math.round(diff / 3600000)}h`;
  },

  // Get confidence color
  getConfidenceColor: (confidence: number): string => {
    if (confidence >= 0.8) return '#4CAF50'; // Green
    if (confidence >= 0.6) return '#8BC34A'; // Light Green
    if (confidence >= 0.4) return '#FFC107'; // Yellow
    if (confidence >= 0.2) return '#FF9800'; // Orange
    return '#F44336'; // Red
  },

  // Get data type icon
  getDataTypeIcon: (dataType: PredictivePattern['dataType']): string => {
    const icons = {
      motors: 'motorcycle',
      reports: 'report',
      gasStations: 'local-gas-station',
      trips: 'trip-origin',
      destinations: 'place',
      fuelLogs: 'local-gas-station',
      maintenance: 'build',
    };
    return icons[dataType];
  },
};
