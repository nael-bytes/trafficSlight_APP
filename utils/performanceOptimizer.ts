// Performance optimization utilities

import { InteractionManager } from 'react-native';

// Debounce utility for expensive operations
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

// Throttle utility for frequent operations
export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle: boolean;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
};

// Batch operations for better performance
export class BatchProcessor<T> {
  private queue: T[] = [];
  private processor: (items: T[]) => void;
  private batchSize: number;
  private timeout: number;
  private timeoutId: NodeJS.Timeout | null = null;

  constructor(
    processor: (items: T[]) => void,
    batchSize: number = 10,
    timeout: number = 100
  ) {
    this.processor = processor;
    this.batchSize = batchSize;
    this.timeout = timeout;
  }

  add(item: T): void {
    this.queue.push(item);
    
    if (this.queue.length >= this.batchSize) {
      this.flush();
    } else if (!this.timeoutId) {
      this.timeoutId = setTimeout(() => this.flush(), this.timeout);
    }
  }

  flush(): void {
    if (this.queue.length > 0) {
      this.processor([...this.queue]);
      this.queue = [];
    }
    
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }
}

// Memory-efficient object comparison
export const shallowEqual = (obj1: any, obj2: any): boolean => {
  if (obj1 === obj2) return true;
  
  if (obj1 == null || obj2 == null) return false;
  
  if (typeof obj1 !== 'object' || typeof obj2 !== 'object') return false;
  
  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);
  
  if (keys1.length !== keys2.length) return false;
  
  for (let key of keys1) {
    if (obj1[key] !== obj2[key]) return false;
  }
  
  return true;
};

// Performance monitoring
export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: Map<string, number[]> = new Map();
  private enabled: boolean = __DEV__;

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  startTiming(label: string): () => void {
    if (!this.enabled) return () => {};
    
    const start = performance.now();
    return () => {
      const duration = performance.now() - start;
      this.recordMetric(label, duration);
    };
  }

  recordMetric(label: string, value: number): void {
    if (!this.enabled) return;
    
    if (!this.metrics.has(label)) {
      this.metrics.set(label, []);
    }
    
    const values = this.metrics.get(label)!;
    values.push(value);
    
    // Keep only last 100 measurements
    if (values.length > 100) {
      values.shift();
    }
  }

  getAverageTime(label: string): number {
    const values = this.metrics.get(label);
    if (!values || values.length === 0) return 0;
    
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  getMetrics(): any {
    const result: any = {};
    
    for (const [label, values] of this.metrics.entries()) {
      if (values.length > 0) {
        result[label] = {
          average: this.getAverageTime(label),
          count: values.length,
          latest: values[values.length - 1]
        };
      }
    }
    
    return result;
  }

  logMetrics(): void {
    if (!this.enabled) return;
    
    console.log('[Performance] Metrics:', this.getMetrics());
  }
}

// Optimized array operations
export const arrayUtils = {
  // Efficient array filtering with early exit
  filterWithLimit: <T>(
    array: T[],
    predicate: (item: T, index: number) => boolean,
    limit: number = 1000
  ): T[] => {
    const result: T[] = [];
    for (let i = 0; i < array.length && result.length < limit; i++) {
      if (predicate(array[i], i)) {
        result.push(array[i]);
      }
    }
    return result;
  },

  // Efficient array mapping with early exit
  mapWithLimit: <T, U>(
    array: T[],
    mapper: (item: T, index: number) => U,
    limit: number = 1000
  ): U[] => {
    const result: U[] = [];
    for (let i = 0; i < array.length && result.length < limit; i++) {
      result.push(mapper(array[i], i));
    }
    return result;
  },

  // Chunk large arrays for processing
  chunk: <T>(array: T[], size: number): T[][] => {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
};

// Interaction-based scheduling
export const scheduleAfterInteractions = (callback: () => void): void => {
  InteractionManager.runAfterInteractions(callback);
};

// Memory cleanup utility
export const createCleanupManager = () => {
  const cleanupFunctions: (() => void)[] = [];
  
  return {
    add: (fn: () => void) => {
      cleanupFunctions.push(fn);
    },
    cleanup: () => {
      cleanupFunctions.forEach(fn => {
        try {
          fn();
        } catch (error) {
          console.warn('[Cleanup] Error during cleanup:', error);
        }
      });
      cleanupFunctions.length = 0;
    }
  };
};

// Export singleton instances
export const performanceMonitor = PerformanceMonitor.getInstance();
