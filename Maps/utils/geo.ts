/**
 * Geographic utility functions for navigation
 * Provides distance calculations and route deviation detection
 */

/**
 * Calculate the distance between two points using the Haversine formula
 * @param point1 - First point as [longitude, latitude]
 * @param point2 - Second point as [longitude, latitude]
 * @returns Distance in meters
 */
export function haversineDistance(
  [lng1, lat1]: [number, number],
  [lng2, lat2]: [number, number]
): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

/**
 * Calculate the distance from a point to the nearest segment of a polyline
 * Uses point-to-segment distance calculation for accurate deviation detection
 * @param point - Current location as {latitude, longitude}
 * @param polyline - Array of [longitude, latitude] coordinates representing the route
 * @returns Distance in meters to the nearest point on the polyline
 */
export function distanceToPolyline(
  point: { latitude: number; longitude: number },
  polyline: [number, number][]
): number {
  if (!polyline || polyline.length === 0) {
    return Infinity;
  }

  if (polyline.length === 1) {
    return haversineDistance(
      [point.longitude, point.latitude],
      [polyline[0][0], polyline[0][1]]
    );
  }

  let minDistance = Infinity;

  // Check distance to each segment of the polyline
  for (let i = 0; i < polyline.length - 1; i++) {
    const segmentStart = polyline[i];
    const segmentEnd = polyline[i + 1];

    // Calculate distance from point to this segment
    const distance = pointToSegmentDistance(
      [point.longitude, point.latitude],
      segmentStart,
      segmentEnd
    );

    if (distance < minDistance) {
      minDistance = distance;
    }
  }

  return minDistance;
}

/**
 * Calculate the distance from a point to a line segment
 * Uses the perpendicular distance if the perpendicular point is on the segment,
 * otherwise uses the distance to the nearest endpoint
 * @param point - Point as [longitude, latitude]
 * @param segmentStart - Start of segment as [longitude, latitude]
 * @param segmentEnd - End of segment as [longitude, latitude]
 * @returns Distance in meters
 */
function pointToSegmentDistance(
  point: [number, number],
  segmentStart: [number, number],
  segmentEnd: [number, number]
): number {
  // Convert to radians for calculations
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const toDeg = (rad: number) => (rad * 180) / Math.PI;

  const [px, py] = [toRad(point[0]), toRad(point[1])];
  const [sx, sy] = [toRad(segmentStart[0]), toRad(segmentStart[1])];
  const [ex, ey] = [toRad(segmentEnd[0]), toRad(segmentEnd[1])];

  // Calculate bearing from segmentStart to segmentEnd
  const dLon = ex - sx;
  const y = Math.sin(dLon) * Math.cos(ey);
  const x =
    Math.cos(sy) * Math.sin(ey) -
    Math.sin(sy) * Math.cos(ey) * Math.cos(dLon);
  const bearing = Math.atan2(y, x);

  // Calculate bearing from segmentStart to point
  const dLon2 = px - sx;
  const y2 = Math.sin(dLon2) * Math.cos(py);
  const x2 =
    Math.cos(sy) * Math.sin(py) -
    Math.sin(sy) * Math.cos(py) * Math.cos(dLon2);
  const bearing2 = Math.atan2(y2, x2);

  // Calculate distance from segmentStart to point
  const distToPoint = haversineDistance(segmentStart, point);

  // Calculate distance from segmentStart to segmentEnd
  const segmentLength = haversineDistance(segmentStart, segmentEnd);

  // Calculate the angle between the segment and the line to the point
  const angleDiff = Math.abs(bearing2 - bearing);
  const angleDiffNormalized = Math.min(angleDiff, 2 * Math.PI - angleDiff);

  // Project point onto segment
  const projectionDistance = distToPoint * Math.cos(angleDiffNormalized);

  // Check if projection is within segment bounds
  if (projectionDistance < 0) {
    // Point is before segment start, return distance to start
    return haversineDistance(segmentStart, point);
  } else if (projectionDistance > segmentLength) {
    // Point is after segment end, return distance to end
    return haversineDistance(segmentEnd, point);
  } else {
    // Projection is on segment, calculate perpendicular distance
    const perpendicularDistance = distToPoint * Math.sin(angleDiffNormalized);
    return perpendicularDistance;
  }
}

/**
 * Convert RouteData coordinates to polyline format [longitude, latitude][]
 * @param coordinates - Array of LocationCoords
 * @returns Array of [longitude, latitude] tuples
 */
export function coordinatesToPolyline(
  coordinates: { latitude: number; longitude: number }[]
): [number, number][] {
  if (!coordinates || coordinates.length === 0) {
    return [];
  }
  return coordinates.map((coord) => [coord.longitude, coord.latitude]);
}

