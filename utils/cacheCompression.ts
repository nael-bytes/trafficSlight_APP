// Cache Compression System
// Reduces storage usage through intelligent compression and optimization

import { cacheManager, CACHE_KEYS } from './cacheManager';

export interface CompressionConfig {
  enabled: boolean;
  compressionThreshold: number; // Minimum size to compress (in bytes)
  compressionLevel: number; // 1-9, higher = better compression
  autoCompress: boolean; // Automatically compress large entries
  maxUncompressedSize: number; // Maximum size before forcing compression
}

export interface CompressionStats {
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  timeSaved: number; // Estimated time saved in ms
  spaceSaved: number; // Space saved in bytes
}

export interface CompressedEntry<T> {
  data: T;
  compressed: boolean;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  timestamp: number;
  version: string;
  expiry: number;
  userId?: string;
}

class CacheCompressionManager {
  private static instance: CacheCompressionManager;
  private config: CompressionConfig;
  private compressionStats: Map<string, CompressionStats>;
  private compressionQueue: string[];

  constructor() {
    this.config = {
      enabled: true,
      compressionThreshold: 1024, // 1KB
      compressionLevel: 6, // Balanced compression
      autoCompress: true,
      maxUncompressedSize: 10 * 1024, // 10KB
    };
    this.compressionStats = new Map();
    this.compressionQueue = [];
  }

  static getInstance(): CacheCompressionManager {
    if (!CacheCompressionManager.instance) {
      CacheCompressionManager.instance = new CacheCompressionManager();
    }
    return CacheCompressionManager.instance;
  }

  // Compress data using JSON string compression
  private compressData(data: any): { compressed: string; originalSize: number; compressedSize: number } {
    const jsonString = JSON.stringify(data);
    const originalSize = new Blob([jsonString]).size;
    
    // Simple compression using run-length encoding for repeated patterns
    const compressed = this.runLengthEncode(jsonString);
    const compressedSize = new Blob([compressed]).size;
    
    return {
      compressed,
      originalSize,
      compressedSize,
    };
  }

  // Decompress data
  private decompressData(compressed: string): any {
    const decompressed = this.runLengthDecode(compressed);
    return JSON.parse(decompressed);
  }

  // Simple run-length encoding for JSON strings
  private runLengthEncode(str: string): string {
    let result = '';
    let count = 1;
    
    for (let i = 0; i < str.length; i++) {
      if (str[i] === str[i + 1]) {
        count++;
      } else {
        if (count > 3) {
          result += `${count}${str[i]}`;
        } else {
          result += str[i].repeat(count);
        }
        count = 1;
      }
    }
    
    return result;
  }

  // Run-length decoding
  private runLengthDecode(str: string): string {
    let result = '';
    let i = 0;
    
    while (i < str.length) {
      if (/\d/.test(str[i])) {
        // Found a number, extract it
        let numStr = '';
        while (i < str.length && /\d/.test(str[i])) {
          numStr += str[i];
          i++;
        }
        
        if (i < str.length) {
          const count = parseInt(numStr);
          const char = str[i];
          result += char.repeat(count);
          i++;
        }
      } else {
        result += str[i];
        i++;
      }
    }
    
    return result;
  }

  // Check if data should be compressed
  private shouldCompress(data: any): boolean {
    if (!this.config.enabled) return false;
    
    const jsonString = JSON.stringify(data);
    const size = new Blob([jsonString]).size;
    
    return size >= this.config.compressionThreshold;
  }

  // Compress and store data
  async compressAndStore<T>(key: string, data: T, userId?: string): Promise<CompressionStats | null> {
    if (!this.shouldCompress(data)) {
      // Store uncompressed
      await cacheManager.set(key, data, userId);
      return null;
    }

    try {
      const { compressed, originalSize, compressedSize } = this.compressData(data);
      const compressionRatio = compressedSize / originalSize;
      
      const compressedEntry: CompressedEntry<T> = {
        data: compressed as any, // Store compressed string
        compressed: true,
        originalSize,
        compressedSize,
        compressionRatio,
        timestamp: Date.now(),
        version: '1.0.0',
        expiry: 5 * 60 * 1000, // 5 minutes
        userId,
      };

      await cacheManager.set(key, compressedEntry, userId);
      
      const stats: CompressionStats = {
        originalSize,
        compressedSize,
        compressionRatio,
        timeSaved: (originalSize - compressedSize) * 0.1, // Estimate
        spaceSaved: originalSize - compressedSize,
      };

      this.compressionStats.set(key, stats);
      console.log(`[CacheCompression] Compressed ${key}: ${originalSize} -> ${compressedSize} bytes (${(compressionRatio * 100).toFixed(1)}%)`);
      
      return stats;
    } catch (error) {
      console.error(`[CacheCompression] Failed to compress ${key}:`, error);
      // Fallback to uncompressed storage
      await cacheManager.set(key, data, userId);
      return null;
    }
  }

  // Retrieve and decompress data
  async retrieveAndDecompress<T>(key: string): Promise<T | null> {
    try {
      const entry = await cacheManager.get(key);
      if (!entry) return null;

      // Check if it's a compressed entry
      if (entry && typeof entry === 'object' && 'compressed' in entry) {
        const compressedEntry = entry as CompressedEntry<T>;
        
        if (compressedEntry.compressed) {
          // Decompress the data
          const decompressed = this.decompressData(compressedEntry.data as any);
          console.log(`[CacheCompression] Decompressed ${key}: ${compressedEntry.compressedSize} -> ${compressedEntry.originalSize} bytes`);
          return decompressed;
        } else {
          return compressedEntry.data;
        }
      }

      // Regular uncompressed data
      return entry as T;
    } catch (error) {
      console.error(`[CacheCompression] Failed to decompress ${key}:`, error);
      return null;
    }
  }

  // Batch compress multiple entries
  async batchCompress(entries: Array<{ key: string; data: any; userId?: string }>): Promise<CompressionStats[]> {
    const results: CompressionStats[] = [];
    
    for (const entry of entries) {
      try {
        const stats = await this.compressAndStore(entry.key, entry.data, entry.userId);
        if (stats) {
          results.push(stats);
        }
      } catch (error) {
        console.warn(`[CacheCompression] Failed to compress ${entry.key}:`, error);
      }
    }
    
    return results;
  }

  // Get compression statistics
  getCompressionStats(): Map<string, CompressionStats> {
    return new Map(this.compressionStats);
  }

  // Get overall compression statistics
  getOverallStats(): {
    totalOriginalSize: number;
    totalCompressedSize: number;
    totalSpaceSaved: number;
    averageCompressionRatio: number;
    compressionCount: number;
  } {
    const stats = Array.from(this.compressionStats.values());
    
    if (stats.length === 0) {
      return {
        totalOriginalSize: 0,
        totalCompressedSize: 0,
        totalSpaceSaved: 0,
        averageCompressionRatio: 0,
        compressionCount: 0,
      };
    }

    const totalOriginalSize = stats.reduce((sum, stat) => sum + stat.originalSize, 0);
    const totalCompressedSize = stats.reduce((sum, stat) => sum + stat.compressedSize, 0);
    const totalSpaceSaved = totalOriginalSize - totalCompressedSize;
    const averageCompressionRatio = stats.reduce((sum, stat) => sum + stat.compressionRatio, 0) / stats.length;

    return {
      totalOriginalSize,
      totalCompressedSize,
      totalSpaceSaved,
      averageCompressionRatio,
      compressionCount: stats.length,
    };
  }

  // Update configuration
  updateConfig(newConfig: Partial<CompressionConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('[CacheCompression] Configuration updated:', this.config);
  }

  // Get current configuration
  getConfig(): CompressionConfig {
    return { ...this.config };
  }

  // Clear compression statistics
  clearStats(): void {
    this.compressionStats.clear();
    console.log('[CacheCompression] Statistics cleared');
  }

  // Check if compression is beneficial
  isCompressionBeneficial(data: any): boolean {
    const jsonString = JSON.stringify(data);
    const size = new Blob([jsonString]).size;
    
    // Estimate compression ratio (rough approximation)
    const estimatedCompressedSize = size * 0.7; // Assume 30% compression
    const spaceSaved = size - estimatedCompressedSize;
    
    return spaceSaved > this.config.compressionThreshold;
  }

  // Get compression recommendations
  getRecommendations(): string[] {
    const recommendations: string[] = [];
    const stats = this.getOverallStats();
    
    if (stats.compressionCount === 0) {
      recommendations.push('No compression data available. Enable compression for large datasets.');
      return recommendations;
    }

    if (stats.averageCompressionRatio > 0.8) {
      recommendations.push('Low compression ratio. Consider optimizing data structure or increasing compression level.');
    }

    if (stats.totalSpaceSaved < 1024 * 1024) { // Less than 1MB saved
      recommendations.push('Minimal space savings. Compression may not be beneficial for current data.');
    }

    if (stats.totalOriginalSize > 50 * 1024 * 1024) { // More than 50MB
      recommendations.push('Large dataset detected. Consider implementing data pagination or archiving.');
    }

    return recommendations;
  }
}

// Export singleton instance
export const cacheCompression = CacheCompressionManager.getInstance();

// Utility functions for cache compression
export const compressionUtils = {
  // Format file size
  formatSize: (bytes: number): string => {
    const sizes = ['B', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  },

  // Format compression ratio
  formatCompressionRatio: (ratio: number): string => {
    return `${(ratio * 100).toFixed(1)}%`;
  },

  // Get compression color
  getCompressionColor: (ratio: number): string => {
    if (ratio <= 0.3) return '#4CAF50'; // Green - excellent compression
    if (ratio <= 0.5) return '#8BC34A'; // Light Green - good compression
    if (ratio <= 0.7) return '#FFC107'; // Yellow - moderate compression
    if (ratio <= 0.9) return '#FF9800'; // Orange - poor compression
    return '#F44336'; // Red - no compression
  },

  // Calculate space savings percentage
  calculateSpaceSavings: (originalSize: number, compressedSize: number): number => {
    return ((originalSize - compressedSize) / originalSize) * 100;
  },

  // Estimate compression potential
  estimateCompressionPotential: (data: any): number => {
    const jsonString = JSON.stringify(data);
    const size = new Blob([jsonString]).size;
    
    // Simple heuristic based on data characteristics
    const repeatedPatterns = (jsonString.match(/(.{2,})\1+/g) || []).length;
    const compressionPotential = Math.min(0.8, repeatedPatterns / 100);
    
    return compressionPotential;
  },
};
