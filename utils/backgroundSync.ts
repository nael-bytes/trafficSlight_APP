// Background Cache Sync System
// Synchronizes cache with server in the background for optimal performance

import { cacheManager, CACHE_KEYS } from './cacheManager';
import { cacheAnalytics } from './cacheAnalytics';
import { predictiveCache } from './predictiveCache';

export interface SyncConfig {
  enabled: boolean;
  syncInterval: number; // How often to sync (in minutes)
  batchSize: number; // Maximum items to sync at once
  retryAttempts: number; // Number of retry attempts for failed syncs
  retryDelay: number; // Delay between retries (in ms)
  priorityKeys: string[]; // High priority keys to sync first
  offlineMode: boolean; // Continue syncing when offline
}

export interface SyncStatus {
  isRunning: boolean;
  lastSync: number;
  nextSync: number;
  pendingItems: number;
  failedItems: number;
  successRate: number;
  totalSynced: number;
}

export interface SyncItem {
  key: string;
  data: any;
  userId: string;
  priority: 'high' | 'medium' | 'low';
  lastModified: number;
  retryCount: number;
  maxRetries: number;
}

export interface SyncResult {
  success: boolean;
  item: SyncItem;
  error?: string;
  timestamp: number;
  duration: number;
}

class BackgroundSyncManager {
  private static instance: BackgroundSyncManager;
  private config: SyncConfig;
  private syncQueue: SyncItem[];
  private syncStatus: SyncStatus;
  private syncInterval: NodeJS.Timeout | null;
  private isRunning: boolean;
  private syncResults: SyncResult[];

  constructor() {
    this.config = {
      enabled: true,
      syncInterval: 5, // 5 minutes
      batchSize: 10,
      retryAttempts: 3,
      retryDelay: 5000, // 5 seconds
      priorityKeys: [
        'motors',
        'reports',
        'gasStations',
      ],
      offlineMode: true,
    };
    this.syncQueue = [];
    this.syncStatus = {
      isRunning: false,
      lastSync: 0,
      nextSync: 0,
      pendingItems: 0,
      failedItems: 0,
      successRate: 0,
      totalSynced: 0,
    };
    this.syncInterval = null;
    this.isRunning = false;
    this.syncResults = [];
  }

  static getInstance(): BackgroundSyncManager {
    if (!BackgroundSyncManager.instance) {
      BackgroundSyncManager.instance = new BackgroundSyncManager();
    }
    return BackgroundSyncManager.instance;
  }

  // Start background sync
  start(): void {
    if (!this.config.enabled || this.isRunning) return;

    this.isRunning = true;
    this.syncStatus.isRunning = true;
    
    // Start sync interval
    this.syncInterval = setInterval(() => {
      this.performSync();
    }, this.config.syncInterval * 60 * 1000);

    // Initial sync
    this.performSync();
    
    console.log('[BackgroundSync] Background sync started');
  }

  // Stop background sync
  stop(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    
    this.isRunning = false;
    this.syncStatus.isRunning = false;
    
    console.log('[BackgroundSync] Background sync stopped');
  }

  // Add item to sync queue
  addToSyncQueue(key: string, data: any, userId: string, priority: 'high' | 'medium' | 'low' = 'medium'): void {
    const existingIndex = this.syncQueue.findIndex(item => item.key === key && item.userId === userId);
    
    const syncItem: SyncItem = {
      key,
      data,
      userId,
      priority,
      lastModified: Date.now(),
      retryCount: 0,
      maxRetries: this.config.retryAttempts,
    };

    if (existingIndex >= 0) {
      // Update existing item
      this.syncQueue[existingIndex] = syncItem;
    } else {
      // Add new item
      this.syncQueue.push(syncItem);
    }

    this.updateSyncStatus();
    console.log(`[BackgroundSync] Added ${key} to sync queue (priority: ${priority})`);
  }

  // Perform sync operation
  private async performSync(): Promise<void> {
    if (!this.config.enabled || this.syncQueue.length === 0) return;

    console.log(`[BackgroundSync] Starting sync of ${this.syncQueue.length} items`);
    
    // Sort queue by priority
    this.sortSyncQueue();
    
    // Process items in batches
    const batches = this.createBatches();
    
    for (const batch of batches) {
      await this.syncBatch(batch);
    }

    this.syncStatus.lastSync = Date.now();
    this.syncStatus.nextSync = this.syncStatus.lastSync + (this.config.syncInterval * 60 * 1000);
    this.updateSyncStatus();
    
    console.log('[BackgroundSync] Sync completed');
  }

  // Sort sync queue by priority
  private sortSyncQueue(): void {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    
    this.syncQueue.sort((a, b) => {
      // First by priority
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      
      // Then by last modified (older first)
      return a.lastModified - b.lastModified;
    });
  }

  // Create batches for processing
  private createBatches(): SyncItem[][] {
    const batches: SyncItem[][] = [];
    
    for (let i = 0; i < this.syncQueue.length; i += this.config.batchSize) {
      batches.push(this.syncQueue.slice(i, i + this.config.batchSize));
    }
    
    return batches;
  }

  // Sync a batch of items
  private async syncBatch(batch: SyncItem[]): Promise<void> {
    const promises = batch.map(item => this.syncItem(item));
    await Promise.allSettled(promises);
  }

  // Sync individual item
  private async syncItem(item: SyncItem): Promise<SyncResult> {
    const startTime = Date.now();
    
    try {
      // Determine sync endpoint based on key
      const endpoint = this.getSyncEndpoint(item.key, item.userId);
      if (!endpoint) {
        throw new Error(`No sync endpoint for key: ${item.key}`);
      }

      // Perform sync request
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          data: item.data,
          userId: item.userId,
          key: item.key,
        }),
      });

      if (!response.ok) {
        throw new Error(`Sync failed: ${response.status} ${response.statusText}`);
      }

      // Remove from queue on success
      this.removeFromQueue(item.key, item.userId);
      
      const result: SyncResult = {
        success: true,
        item,
        timestamp: Date.now(),
        duration: Date.now() - startTime,
      };

      this.syncResults.push(result);
      this.syncStatus.totalSynced++;
      
      console.log(`[BackgroundSync] Successfully synced ${item.key}`);
      return result;

    } catch (error) {
      const result: SyncResult = {
        success: false,
        item,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now(),
        duration: Date.now() - startTime,
      };

      this.syncResults.push(result);
      
      // Handle retry logic
      if (item.retryCount < item.maxRetries) {
        item.retryCount++;
        console.log(`[BackgroundSync] Retrying ${item.key} (attempt ${item.retryCount}/${item.maxRetries})`);
        
        // Schedule retry
        setTimeout(() => {
          this.syncItem(item);
        }, this.config.retryDelay);
      } else {
        // Remove from queue after max retries
        this.removeFromQueue(item.key, item.userId);
        this.syncStatus.failedItems++;
        console.error(`[BackgroundSync] Failed to sync ${item.key} after ${item.maxRetries} attempts`);
      }

      return result;
    }
  }

  // Get sync endpoint for key
  private getSyncEndpoint(key: string, userId: string): string | null {
    const baseUrl = process.env.LOCALHOST_IP || 'http://localhost:3000';
    
    if (key.includes('motors')) {
      return `${baseUrl}/api/user-motors/user/${userId}`;
    }
    if (key.includes('reports')) {
      return `${baseUrl}/api/reports`;
    }
    if (key.includes('gasStations')) {
      return `${baseUrl}/api/gas-stations`;
    }
    if (key.includes('trips')) {
      return `${baseUrl}/api/trips/user/${userId}`;
    }
    if (key.includes('destinations')) {
      return `${baseUrl}/api/saved-destinations/${userId}`;
    }
    if (key.includes('fuelLogs')) {
      return `${baseUrl}/api/fuel-logs/${userId}`;
    }
    if (key.includes('maintenance')) {
      return `${baseUrl}/api/maintenance-records/user/${userId}`;
    }
    
    return null;
  }

  // Remove item from queue
  private removeFromQueue(key: string, userId: string): void {
    const index = this.syncQueue.findIndex(item => item.key === key && item.userId === userId);
    if (index >= 0) {
      this.syncQueue.splice(index, 1);
    }
  }

  // Update sync status
  private updateSyncStatus(): void {
    this.syncStatus.pendingItems = this.syncQueue.length;
    this.syncStatus.failedItems = this.syncResults.filter(r => !r.success).length;
    
    const totalResults = this.syncResults.length;
    if (totalResults > 0) {
      this.syncStatus.successRate = this.syncResults.filter(r => r.success).length / totalResults;
    }
  }

  // Get sync status
  getSyncStatus(): SyncStatus {
    return { ...this.syncStatus };
  }

  // Get sync results
  getSyncResults(): SyncResult[] {
    return [...this.syncResults];
  }

  // Get recent sync results
  getRecentSyncResults(limit: number = 50): SyncResult[] {
    return this.syncResults
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  // Clear sync queue
  clearQueue(): void {
    this.syncQueue = [];
    this.updateSyncStatus();
    console.log('[BackgroundSync] Sync queue cleared');
  }

  // Clear sync results
  clearResults(): void {
    this.syncResults = [];
    this.syncStatus.failedItems = 0;
    this.syncStatus.totalSynced = 0;
    console.log('[BackgroundSync] Sync results cleared');
  }

  // Update configuration
  updateConfig(newConfig: Partial<SyncConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Restart sync if interval changed
    if (this.isRunning && newConfig.syncInterval) {
      this.stop();
      this.start();
    }
    
    console.log('[BackgroundSync] Configuration updated:', this.config);
  }

  // Get current configuration
  getConfig(): SyncConfig {
    return { ...this.config };
  }

  // Force sync of specific items
  async forceSync(keys: string[], userId: string): Promise<SyncResult[]> {
    const results: SyncResult[] = [];
    
    for (const key of keys) {
      const item = this.syncQueue.find(i => i.key === key && i.userId === userId);
      if (item) {
        const result = await this.syncItem(item);
        results.push(result);
      }
    }
    
    return results;
  }

  // Get sync statistics
  getSyncStatistics(): {
    totalItems: number;
    pendingItems: number;
    successfulItems: number;
    failedItems: number;
    successRate: number;
    averageSyncTime: number;
    lastSyncTime: number;
  } {
    const totalItems = this.syncResults.length;
    const successfulItems = this.syncResults.filter(r => r.success).length;
    const failedItems = this.syncResults.filter(r => !r.success).length;
    const successRate = totalItems > 0 ? successfulItems / totalItems : 0;
    const averageSyncTime = totalItems > 0 
      ? this.syncResults.reduce((sum, r) => sum + r.duration, 0) / totalItems 
      : 0;

    return {
      totalItems,
      pendingItems: this.syncStatus.pendingItems,
      successfulItems,
      failedItems,
      successRate,
      averageSyncTime,
      lastSyncTime: this.syncStatus.lastSync,
    };
  }
}

// Export singleton instance
export const backgroundSync = BackgroundSyncManager.getInstance();

// Utility functions for background sync
export const syncUtils = {
  // Format sync status
  formatSyncStatus: (status: SyncStatus): string => {
    if (!status.isRunning) return 'Stopped';
    if (status.pendingItems === 0) return 'Idle';
    return `Syncing ${status.pendingItems} items`;
  },

  // Format success rate
  formatSuccessRate: (rate: number): string => {
    return `${(rate * 100).toFixed(1)}%`;
  },

  // Format sync time
  formatSyncTime: (timestamp: number): string => {
    const now = Date.now();
    const diff = now - timestamp;
    
    if (diff < 60000) return `${Math.round(diff / 1000)}s ago`;
    if (diff < 3600000) return `${Math.round(diff / 60000)}m ago`;
    return `${Math.round(diff / 3600000)}h ago`;
  },

  // Get status color
  getStatusColor: (status: SyncStatus): string => {
    if (!status.isRunning) return '#9E9E9E'; // Gray
    if (status.pendingItems === 0) return '#4CAF50'; // Green
    if (status.successRate >= 0.8) return '#8BC34A'; // Light Green
    if (status.successRate >= 0.6) return '#FFC107'; // Yellow
    return '#F44336'; // Red
  },

  // Get priority color
  getPriorityColor: (priority: 'high' | 'medium' | 'low'): string => {
    const colors = {
      high: '#F44336', // Red
      medium: '#FF9800', // Orange
      low: '#4CAF50', // Green
    };
    return colors[priority];
  },
};
