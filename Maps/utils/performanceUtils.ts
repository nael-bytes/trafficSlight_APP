/**
 * Performance monitoring utilities
 * Provides functions for logging and monitoring performance metrics
 */

/**
 * Log map performance metrics
 * 
 * @param updateType - Type of map update (e.g., 'markers', 'polylines')
 * @param markersCount - Number of markers being rendered
 * @param polylinesCount - Number of polylines being rendered
 */
export const logMapPerformance = (
  updateType: string,
  markersCount: number,
  polylinesCount: number
): void => {
  if (__DEV__) {
    console.log(`[MapPerformance] ${updateType}:`, {
      markers: markersCount,
      polylines: polylinesCount,
      timestamp: Date.now(),
      memoryUsage: (performance as any).memory 
        ? Math.round((performance as any).memory.usedJSHeapSize / 1024 / 1024) 
        : 'N/A'
    });
  }
};

