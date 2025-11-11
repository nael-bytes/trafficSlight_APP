// Cache Analytics and Performance Monitoring System
// Tracks cache performance, hit rates, and optimization opportunities

import { cacheManager, CACHE_KEYS } from './cacheManager';

export interface CacheMetrics {
  totalRequests: number;
  cacheHits: number;
  cacheMisses: number;
  hitRate: number;
  averageResponseTime: number;
  totalCacheSize: number;
  expiredEntries: number;
  userSpecificEntries: number;
  globalEntries: number;
  lastCleanup: number;
  performanceScore: number;
}

export interface CacheAnalytics {
  metrics: CacheMetrics;
  topAccessedKeys: Array<{ key: string; accessCount: number; lastAccessed: number }>;
  performanceHistory: Array<{ timestamp: number; hitRate: number; responseTime: number }>;
  recommendations: string[];
  alerts: Array<{ type:   'error' | 'info'; message: string; timestamp: number }>;
}

export interface CachePerformanceData {
  key: string;
  accessCount: number;
  lastAccessed: number;
  averageResponseTime: number;
  hitRate: number;
  size: number;
  isExpired: boolean;
}

class CacheAnalyticsManager {
  private static instance: CacheAnalyticsManager;
  private metrics: CacheMetrics;
  private performanceHistory: Array<{ timestamp: number; hitRate: number; responseTime: number }>;
  private keyAccessCounts: Map<string, number>;
  private keyLastAccessed: Map<string, number>;
  private keyResponseTimes: Map<string, number[]>;
  private alerts: Array<{ type: 'error' | 'info'; message: string; timestamp: number }>;
  private startTime: number;

  constructor() {
    this.startTime = Date.now();
    this.metrics = {
      totalRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      hitRate: 0,
      averageResponseTime: 0,
      totalCacheSize: 0,
      expiredEntries: 0,
      userSpecificEntries: 0,
      globalEntries: 0,
      lastCleanup: 0,
      performanceScore: 0,
    };
    this.performanceHistory = [];
    this.keyAccessCounts = new Map();
    this.keyLastAccessed = new Map();
    this.keyResponseTimes = new Map();
    this.alerts = [];
  }

  static getInstance(): CacheAnalyticsManager {
    if (!CacheAnalyticsManager.instance) {
      CacheAnalyticsManager.instance = new CacheAnalyticsManager();
    }
    return CacheAnalyticsManager.instance;
  }

  // Track cache access
  async trackCacheAccess(key: string, hit: boolean, responseTime: number): Promise<void> {
    const now = Date.now();
    
    // Update basic metrics
    this.metrics.totalRequests++;
    if (hit) {
      this.metrics.cacheHits++;
    } else {
      this.metrics.cacheMisses++;
    }
    
    // Update hit rate
    this.metrics.hitRate = this.metrics.cacheHits / this.metrics.totalRequests;
    
    // Track key-specific metrics
    this.keyAccessCounts.set(key, (this.keyAccessCounts.get(key) || 0) + 1);
    this.keyLastAccessed.set(key, now);
    
    // Track response times
    if (!this.keyResponseTimes.has(key)) {
      this.keyResponseTimes.set(key, []);
    }
    this.keyResponseTimes.get(key)!.push(responseTime);
    
    // Keep only last 100 response times per key
    const times = this.keyResponseTimes.get(key)!;
    if (times.length > 100) {
      times.splice(0, times.length - 100);
    }
    
    // Update average response time
    const allTimes = Array.from(this.keyResponseTimes.values()).flat();
    this.metrics.averageResponseTime = allTimes.reduce((sum, time) => sum + time, 0) / allTimes.length;
    
    // Update performance score
    this.updatePerformanceScore();
    
    // Add to performance history (every 10 requests)
    if (this.metrics.totalRequests % 10 === 0) {
      this.performanceHistory.push({
        timestamp: now,
        hitRate: this.metrics.hitRate,
        responseTime: this.metrics.averageResponseTime,
      });
      
      // Keep only last 100 history entries
      if (this.performanceHistory.length > 100) {
        this.performanceHistory.splice(0, this.performanceHistory.length - 100);
      }
    }
    
    // Check for performance issues
    this.checkPerformanceIssues();
  }

  // Update cache size metrics
  async updateCacheSizeMetrics(): Promise<void> {
    try {
      const stats = await cacheManager.getCacheStats();
      this.metrics.totalCacheSize = stats.totalSize;
      this.metrics.expiredEntries = stats.expiredKeys;
      this.metrics.userSpecificEntries = stats.userKeys;
      this.metrics.globalEntries = stats.totalKeys - stats.userKeys;
    } catch (error) {
      console.error('[CacheAnalytics] Error updating cache size metrics:', error);
    }
  }

  // Update performance score
  private updatePerformanceScore(): void {
    const hitRateScore = this.metrics.hitRate * 40; // 40% weight
    const responseTimeScore = Math.max(0, 30 - (this.metrics.averageResponseTime / 10)); // 30% weight
    const sizeScore = Math.max(0, 20 - (this.metrics.totalCacheSize / (1024 * 1024))); // 20% weight
    const consistencyScore = this.metrics.totalRequests > 0 ? 10 : 0; // 10% weight
    
    this.metrics.performanceScore = Math.min(100, hitRateScore + responseTimeScore + sizeScore + consistencyScore);
  }

  // Check for performance issues
  private checkPerformanceIssues(): void {
    const now = Date.now();
    
    // Low hit rate warning
    if (this.metrics.totalRequests > 10 && this.metrics.hitRate < 0.3) {
      this.addAlert('error', `Low cache hit rate: ${(this.metrics.hitRate * 100).toFixed(1)}%`);
    }
    
    // High response time warning
    if (this.metrics.averageResponseTime > 100) {
      this.addAlert('error', `High cache response time: ${this.metrics.averageResponseTime.toFixed(1)}ms`);
    }
    
    // Large cache size warning
    if (this.metrics.totalCacheSize > 50 * 1024 * 1024) { // 50MB
      this.addAlert('error', `Large cache size: ${(this.metrics.totalCacheSize / (1024 * 1024)).toFixed(1)}MB`);
    }
    
    // Many expired entries warning
    if (this.metrics.expiredEntries > 50) {
      this.addAlert('info', `${this.metrics.expiredEntries} expired cache entries need cleanup`);
    }
  }

  // Add alert
  private addAlert(type: 'error' | 'info', message: string): void {
    const alert = {
      type,
      message,
      timestamp: Date.now(),
    };
    
    // Avoid duplicate alerts
    const existingAlert = this.alerts.find(a => a.message === message && (Date.now() - a.timestamp) < 60000);
    if (!existingAlert) {
      this.alerts.push(alert);
      
      // Keep only last 50 alerts
      if (this.alerts.length > 50) {
        this.alerts.splice(0, this.alerts.length - 50);
      }
    }
  }

  // Get top accessed keys
  private getTopAccessedKeys(): Array<{ key: string; accessCount: number; lastAccessed: number }> {
    return Array.from(this.keyAccessCounts.entries())
      .map(([key, count]) => ({
        key,
        accessCount: count,
        lastAccessed: this.keyLastAccessed.get(key) || 0,
      }))
      .sort((a, b) => b.accessCount - a.accessCount)
      .slice(0, 10);
  }

  // Generate recommendations
  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    
    // Hit rate recommendations
    if (this.metrics.hitRate < 0.5) {
      recommendations.push('Consider increasing cache expiry time for frequently accessed data');
    }
    
    // Response time recommendations
    if (this.metrics.averageResponseTime > 50) {
      recommendations.push('Consider implementing cache warming for critical data');
    }
    
    // Size recommendations
    if (this.metrics.totalCacheSize > 30 * 1024 * 1024) { // 30MB
      recommendations.push('Consider implementing cache compression or cleanup');
    }
    
    // Expired entries recommendations
    if (this.metrics.expiredEntries > 20) {
      recommendations.push('Schedule regular cache cleanup to remove expired entries');
    }
    
    // Performance score recommendations
    if (this.metrics.performanceScore < 70) {
      recommendations.push('Overall cache performance needs optimization');
    }
    
    return recommendations;
  }

  // Get comprehensive analytics
  async getAnalytics(): Promise<CacheAnalytics> {
    await this.updateCacheSizeMetrics();
    
    return {
      metrics: { ...this.metrics },
      topAccessedKeys: this.getTopAccessedKeys(),
      performanceHistory: [...this.performanceHistory],
      recommendations: this.generateRecommendations(),
      alerts: [...this.alerts],
    };
  }

  // Get performance data for specific key
  getKeyPerformance(key: string): CachePerformanceData | null {
    const accessCount = this.keyAccessCounts.get(key) || 0;
    const lastAccessed = this.keyLastAccessed.get(key) || 0;
    const responseTimes = this.keyResponseTimes.get(key) || [];
    const averageResponseTime = responseTimes.length > 0 
      ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length 
      : 0;
    
    if (accessCount === 0) return null;
    
    return {
      key,
      accessCount,
      lastAccessed,
      averageResponseTime,
      hitRate: this.metrics.hitRate,
      size: 0, // Would need to calculate from cache
      isExpired: false, // Would need to check cache expiry
    };
  }

  // Reset analytics
  reset(): void {
    this.metrics = {
      totalRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      hitRate: 0,
      averageResponseTime: 0,
      totalCacheSize: 0,
      expiredEntries: 0,
      userSpecificEntries: 0,
      globalEntries: 0,
      lastCleanup: 0,
      performanceScore: 0,
    };
    this.performanceHistory = [];
    this.keyAccessCounts.clear();
    this.keyLastAccessed.clear();
    this.keyResponseTimes.clear();
    this.alerts = [];
    this.startTime = Date.now();
  }

  // Get cache health status
  getHealthStatus(): 'excellent' | 'good' | 'fair' | 'poor' {
    if (this.metrics.performanceScore >= 90) return 'excellent';
    if (this.metrics.performanceScore >= 75) return 'good';
    if (this.metrics.performanceScore >= 60) return 'fair';
    return 'poor';
  }

  // Get uptime
  getUptime(): number {
    return Date.now() - this.startTime;
  }
}

// Export singleton instance
export const cacheAnalytics = CacheAnalyticsManager.getInstance();

// Utility functions for cache analytics
export const analyticsUtils = {
  // Format cache size
  formatCacheSize: (bytes: number): string => {
    const sizes = ['B', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  },

  // Format response time
  formatResponseTime: (ms: number): string => {
    if (ms < 1) return `${(ms * 1000).toFixed(1)}μs`;
    if (ms < 1000) return `${ms.toFixed(1)}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  },

  // Format hit rate
  formatHitRate: (hitRate: number): string => {
    return `${(hitRate * 100).toFixed(1)}%`;
  },

  // Get performance color
  getPerformanceColor: (score: number): string => {
    if (score >= 90) return '#4CAF50'; // Green
    if (score >= 75) return '#8BC34A'; // Light Green
    if (score >= 60) return '#FFC107'; // Yellow
    if (score >= 40) return '#FF9800'; // Orange
    return '#F44336'; // Red
  },

  // Get health status color
  getHealthColor: (status: 'excellent' | 'good' | 'fair' | 'poor'): string => {
    const colors = {
      excellent: '#4CAF50',
      good: '#8BC34A',
      fair: '#FFC107',
      poor: '#F44336',
    };
    return colors[status];
  },
};
