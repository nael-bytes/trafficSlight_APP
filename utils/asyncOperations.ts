// Async operations utility for non-blocking UI operations
// Prevents UI thread blocking during heavy operations and data fetching

import { InteractionManager } from 'react-native';

export interface AsyncOperationOptions {
  priority?: 'high' | 'normal' | 'low';
  timeout?: number;
  retries?: number;
  onProgress?: (progress: number) => void;
  onError?: (error: Error) => void;
}

export interface AsyncOperationResult<T> {
  data: T | null;
  error: Error | null;
  success: boolean;
  duration: number;
}

/**
 * Execute an async operation without blocking the UI thread
 * Uses InteractionManager to ensure UI remains responsive
 */
export const runAsyncOperation = async <T>(
  operation: () => Promise<T>,
  options: AsyncOperationOptions = {}
): Promise<AsyncOperationResult<T>> => {
  const startTime = Date.now();
  const { priority = 'normal', timeout = 30000, retries = 3, onProgress, onError } = options;
  
  return new Promise((resolve) => {
    // Use InteractionManager to run after interactions complete
    const runAfterInteractions = () => {
      executeWithRetry(operation, retries, timeout, onProgress, onError)
        .then((data) => {
          resolve({
            data,
            error: null,
            success: true,
            duration: Date.now() - startTime,
          });
        })
        .catch((error) => {
          resolve({
            data: null,
            error,
            success: false,
            duration: Date.now() - startTime,
          });
        });
    };

    // Run based on priority
    switch (priority) {
      case 'high':
        // Run immediately for high priority operations
        runAfterInteractions();
        break;
      case 'low':
        // Run after all interactions complete for low priority
        InteractionManager.runAfterInteractions(runAfterInteractions);
        break;
      default:
        // Normal priority - run after current interactions
        InteractionManager.runAfterInteractions(runAfterInteractions);
        break;
    }
  });
};

/**
 * Execute operation with retry logic
 */
const executeWithRetry = async <T>(
  operation: () => Promise<T>,
  retries: number,
  timeout: number,
  onProgress?: (progress: number) => void,
  onError?: (error: Error) => void
): Promise<T> => {
  let lastError: Error;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      onProgress?.(attempt / (retries + 1) * 100);
      
      const result = await Promise.race([
        operation(),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Operation timeout')), timeout)
        )
      ]);
      
      return result;
    } catch (error) {
      lastError = error as Error;
      onError?.(lastError);
      
      if (attempt < retries) {
        // Exponential backoff
        const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError!;
};

/**
 * Batch multiple async operations efficiently
 */
export const batchAsyncOperations = async <T>(
  operations: Array<() => Promise<T>>,
  options: AsyncOperationOptions = {}
): Promise<AsyncOperationResult<T[]>> => {
  const startTime = Date.now();
  
  return runAsyncOperation(async () => {
    const results = await Promise.allSettled(
      operations.map(op => op())
    );
    
    return results.map(result => 
      result.status === 'fulfilled' ? result.value : null
    ).filter(Boolean) as T[];
  }, options);
};

/**
 * Debounced async operation to prevent excessive calls
 */
export const createDebouncedAsyncOperation = <T>(
  operation: () => Promise<T>,
  delay: number = 300,
  options: AsyncOperationOptions = {}
) => {
  let timeoutId: NodeJS.Timeout;
  let lastCallTime = 0;
  
  return async (...args: any[]): Promise<AsyncOperationResult<T>> => {
    const now = Date.now();
    lastCallTime = now;
    
    return new Promise((resolve) => {
      clearTimeout(timeoutId);
      
      timeoutId = setTimeout(async () => {
        // Only execute if this is still the latest call
        if (lastCallTime === now) {
          const result = await runAsyncOperation(operation, options);
          resolve(result);
        }
      }, delay);
    });
  };
};

/**
 * Throttled async operation to limit execution frequency
 */
export const createThrottledAsyncOperation = <T>(
  operation: () => Promise<T>,
  interval: number = 1000,
  options: AsyncOperationOptions = {}
) => {
  let lastExecution = 0;
  let pendingExecution: Promise<AsyncOperationResult<T>> | null = null;
  
  return async (...args: any[]): Promise<AsyncOperationResult<T>> => {
    const now = Date.now();
    
    if (now - lastExecution >= interval) {
      lastExecution = now;
      pendingExecution = runAsyncOperation(operation, options);
      return pendingExecution;
    }
    
    // Return the pending execution if it exists
    if (pendingExecution) {
      return pendingExecution;
    }
    
    // Schedule execution for the next interval
    return new Promise((resolve) => {
      const delay = interval - (now - lastExecution);
      setTimeout(async () => {
        lastExecution = Date.now();
        const result = await runAsyncOperation(operation, options);
        resolve(result);
      }, delay);
    });
  };
};

/**
 * Background data fetching with caching
 */
export const createBackgroundDataFetcher = <T>(
  fetchFunction: () => Promise<T>,
  cacheKey: string,
  cacheDuration: number = 5 * 60 * 1000, // 5 minutes
  options: AsyncOperationOptions = {}
) => {
  let cache: { data: T; timestamp: number } | null = null;
  
  return async (): Promise<AsyncOperationResult<T>> => {
    const now = Date.now();
    
    // Return cached data if still valid
    if (cache && (now - cache.timestamp) < cacheDuration) {
      return {
        data: cache.data,
        error: null,
        success: true,
        duration: 0,
      };
    }
    
    // Fetch new data in background
    const result = await runAsyncOperation(fetchFunction, {
      ...options,
      priority: 'low',
    });
    
    // Update cache on success
    if (result.success && result.data) {
      cache = {
        data: result.data,
        timestamp: now,
      };
    }
    
    return result;
  };
};

/**
 * Progress tracking for long operations
 */
export class ProgressTracker {
  private progress: number = 0;
  private onProgress?: (progress: number) => void;
  
  constructor(onProgress?: (progress: number) => void) {
    this.onProgress = onProgress;
  }
  
  update(progress: number) {
    this.progress = Math.min(100, Math.max(0, progress));
    this.onProgress?.(this.progress);
  }
  
  increment(amount: number = 1) {
    this.update(this.progress + amount);
  }
  
  getProgress(): number {
    return this.progress;
  }
  
  reset() {
    this.progress = 0;
    this.onProgress?.(0);
  }
}

/**
 * Async queue for managing multiple operations
 */
export class AsyncQueue {
  private queue: Array<() => Promise<any>> = [];
  private running: boolean = false;
  private concurrency: number;
  
  constructor(concurrency: number = 3) {
    this.concurrency = concurrency;
  }
  
  async add<T>(operation: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await operation();
          resolve(result);
          return result;
        } catch (error) {
          reject(error);
          throw error;
        }
      });
      
      this.process();
    });
  }
  
  private async process() {
    if (this.running || this.queue.length === 0) return;
    
    this.running = true;
    
    while (this.queue.length > 0) {
      const batch = this.queue.splice(0, this.concurrency);
      await Promise.allSettled(batch.map(op => op()));
    }
    
    this.running = false;
  }
  
  clear() {
    this.queue = [];
  }
  
  get length(): number {
    return this.queue.length;
  }
}

/**
 * Memory-efficient data processing
 */
export const processDataInChunks = async <T, R>(
  data: T[],
  processor: (chunk: T[]) => Promise<R[]>,
  chunkSize: number = 100,
  options: AsyncOperationOptions = {}
): Promise<R[]> => {
  const chunks: T[][] = [];
  
  // Split data into chunks
  for (let i = 0; i < data.length; i += chunkSize) {
    chunks.push(data.slice(i, i + chunkSize));
  }
  
  // Process chunks asynchronously
  const results = await batchAsyncOperations(
    chunks.map(chunk => () => processor(chunk)),
    options
  );
  
  if (!results.success || !results.data) {
    throw new Error('Failed to process data chunks');
  }
  
  return results.data.flat();
};

/**
 * Non-blocking UI updates
 */
export const scheduleUIUpdate = (updateFunction: () => void) => {
  // Use requestAnimationFrame for smooth UI updates
  requestAnimationFrame(() => {
    InteractionManager.runAfterInteractions(updateFunction);
  });
};

/**
 * Async storage operations with error handling
 */
export const safeAsyncStorage = {
  async getItem(key: string): Promise<string | null> {
    try {
      const { getItem } = await import('@react-native-async-storage/async-storage');
      return await getItem(key);
    } catch (error) {
      console.warn(`[AsyncStorage] Failed to get item ${key}:`, error);
      return null;
    }
  },
  
  async setItem(key: string, value: string): Promise<boolean> {
    try {
      const { setItem } = await import('@react-native-async-storage/async-storage');
      await setItem(key, value);
      return true;
    } catch (error) {
      console.warn(`[AsyncStorage] Failed to set item ${key}:`, error);
      return false;
    }
  },
  
  async removeItem(key: string): Promise<boolean> {
    try {
      const { removeItem } = await import('@react-native-async-storage/async-storage');
      await removeItem(key);
      return true;
    } catch (error) {
      console.warn(`[AsyncStorage] Failed to remove item ${key}:`, error);
      return false;
    }
  },
};
