// Road snapping utility using Google Roads API
// Snaps GPS coordinates to actual roads for realistic motorcycle tracking

import { GOOGLE_MAPS_API_KEY } from '@env';

export interface SnappedPoint {
  latitude: number;
  longitude: number;
  originalIndex: number;
  placeId?: string;
}

export interface RoadSnappingResult {
  snappedPoints: SnappedPoint[];
  snappedCoordinates: { latitude: number; longitude: number }[];
  hasSnapped: boolean;
}

/**
 * Snaps GPS coordinates to roads using Google Roads API
 * @param coordinates Array of GPS coordinates to snap
 * @returns Snapped coordinates and metadata
 */
export const snapToRoads = async (
  coordinates: { latitude: number; longitude: number }[]
): Promise<RoadSnappingResult> => {
  if (!coordinates || coordinates.length === 0) {
    return {
      snappedPoints: [],
      snappedCoordinates: [],
      hasSnapped: false,
    };
  }

  try {
    // Convert coordinates to the format expected by Google Roads API
    const path = coordinates
      .map(coord => `${coord.latitude},${coord.longitude}`)
      .join('|');

    const url = `https://roads.googleapis.com/v1/snapToRoads?path=${encodeURIComponent(path)}&interpolate=true&key=${GOOGLE_MAPS_API_KEY}`;

    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Roads API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.snappedPoints || data.snappedPoints.length === 0) {
      console.warn('[RoadSnapping] No snapped points returned from API');
      return {
        snappedPoints: [],
        snappedCoordinates: coordinates, // Fallback to original coordinates
        hasSnapped: false,
      };
    }

    // Process snapped points
    const snappedPoints: SnappedPoint[] = data.snappedPoints.map((point: any, index: number) => ({
      latitude: point.location.latitude,
      longitude: point.location.longitude,
      originalIndex: point.originalIndex || index,
      placeId: point.placeId,
    }));

    const snappedCoordinates = snappedPoints.map(point => ({
      latitude: point.latitude,
      longitude: point.longitude,
    }));

    console.log('[RoadSnapping] Successfully snapped', {
      originalCount: coordinates.length,
      snappedCount: snappedPoints.length,
      hasSnapped: true,
    });

    return {
      snappedPoints,
      snappedCoordinates,
      hasSnapped: true,
    };
  } catch (error) {
    console.error('[RoadSnapping] Error snapping to roads:', error);
    
    // Fallback to original coordinates if snapping fails
    return {
      snappedPoints: coordinates.map((coord, index) => ({
        latitude: coord.latitude,
        longitude: coord.longitude,
        originalIndex: index,
      })),
      snappedCoordinates: coordinates,
      hasSnapped: false,
    };
  }
};

/**
 * Snaps a single coordinate to the nearest road
 * @param coordinate Single coordinate to snap
 * @returns Snapped coordinate
 */
export const snapSinglePoint = async (
  coordinate: { latitude: number; longitude: number }
): Promise<{ latitude: number; longitude: number }> => {
  const result = await snapToRoads([coordinate]);
  return result.snappedCoordinates[0] || coordinate;
};

/**
 * Batch snap coordinates with rate limiting
 * @param coordinates Array of coordinates to snap
 * @param batchSize Number of coordinates to process at once (default: 100)
 * @param delayMs Delay between batches in milliseconds (default: 1000)
 * @returns Snapped coordinates
 */
export const batchSnapToRoads = async (
  coordinates: { latitude: number; longitude: number }[],
  batchSize: number = 100,
  delayMs: number = 1000
): Promise<RoadSnappingResult> => {
  if (coordinates.length <= batchSize) {
    return snapToRoads(coordinates);
  }

  const batches: { latitude: number; longitude: number }[][] = [];
  for (let i = 0; i < coordinates.length; i += batchSize) {
    batches.push(coordinates.slice(i, i + batchSize));
  }

  const results: RoadSnappingResult[] = [];
  
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const result = await snapToRoads(batch);
    results.push(result);
    
    // Add delay between batches to respect rate limits
    if (i < batches.length - 1) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  // Combine all results
  const allSnappedPoints: SnappedPoint[] = [];
  const allSnappedCoordinates: { latitude: number; longitude: number }[] = [];
  
  results.forEach(result => {
    allSnappedPoints.push(...result.snappedPoints);
    allSnappedCoordinates.push(...result.snappedCoordinates);
  });

  return {
    snappedPoints: allSnappedPoints,
    snappedCoordinates: allSnappedCoordinates,
    hasSnapped: results.some(r => r.hasSnapped),
  };
};
