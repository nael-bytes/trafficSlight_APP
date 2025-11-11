# Backend Data Processing Migration Guide

## Overview
This document explains all frontend data processing that should be moved to the backend to improve performance and reduce client-side computation.

---

## Current Frontend Processing

### 1. Data Filtering (`routeSelectionDataProcessor.ts`)

#### **Reports Filtering** (`filterReports`)
**Location:** `services/routeSelectionDataProcessor.ts:195-217`

**Current Logic:**
```typescript
export const filterReports = (reports: Report[]): Report[] => {
  return reports.filter(report => {
    // 1. Check if report has location
    if (!report?.location) return false;
    
    // 2. Filter out archived reports
    if (report.archived === true) return false;
    
    // 3. Filter out reports with invalid status
    if (report.status === 'archived' || report.status === 'deleted') return false;
    
    // 4. Validate coordinates
    return validateCoordinates(report.location);
  });
};
```

**What it does:**
- Removes reports without location data
- Removes archived reports (`archived === true`)
- Removes reports with status `'archived'` or `'deleted'`
- Validates coordinates (latitude: -90 to 90, longitude: -180 to 180)

**Coordinate Validation:**
```typescript
// From utils/location.ts
validateCoordinates(location: { latitude: number; longitude: number }): boolean {
  return (
    typeof location.latitude === 'number' &&
    typeof location.longitude === 'number' &&
    !isNaN(location.latitude) &&
    !isNaN(location.longitude) &&
    location.latitude >= -90 &&
    location.latitude <= 90 &&
    location.longitude >= -180 &&
    location.longitude <= 180
  );
}
```

---

#### **Gas Stations Filtering** (`filterGasStations`)
**Location:** `services/routeSelectionDataProcessor.ts:222-232`

**Current Logic:**
```typescript
export const filterGasStations = (stations: GasStation[]): GasStation[] => {
  return stations.filter(station => {
    const coords = station?.location?.coordinates;
    
    // 1. Check if coordinates array exists and has at least 2 elements
    if (!coords || !Array.isArray(coords) || coords.length < 2) return false;
    
    // 2. Validate coordinates (convert from [lng, lat] to {lat, lng})
    return validateCoordinates({
      latitude: Number(coords[1]),  // Second element is latitude
      longitude: Number(coords[0]), // First element is longitude
    });
  });
};
```

**What it does:**
- Removes gas stations without coordinates
- Validates coordinate format: `[longitude, latitude]` array
- Converts to `{latitude, longitude}` format for validation
- Validates coordinate ranges

---

### 2. Map Marker Preparation (`prepareMapMarkersAndPolylines`)
**Location:** `services/routeSelectionDataProcessor.ts:241-323`

**Current Logic:**
```typescript
export const prepareMapMarkersAndPolylines = (
  currentLocation?: { latitude: number; longitude: number },
  destination?: { latitude: number; longitude: number; address?: string },
  selectedRoute?: { coordinates: Array<{ latitude: number; longitude: number }> },
  alternativeRoutes?: Array<{ coordinates: Array<{ latitude: number; longitude: number }> }>,
  showReports: boolean = false,
  filteredReports: Report[] = [],
  showGasStations: boolean = false,
  filteredGasStations: GasStation[] = [],
  currentZoom?: number
): MapData => {
  const markers: MapMarker[] = [];
  const polylines: MapPolyline[] = [];

  // 1. Add current location marker
  if (currentLocation) {
    markers.push({
      id: 'current-location',
      coordinate: currentLocation,
      title: 'Current Location',
      description: 'Your current position',
      pinColor: '#00ADB5',
      type: 'current'
    });
  }

  // 2. Add destination marker
  if (destination) {
    markers.push({
      id: 'destination',
      coordinate: destination,
      title: 'Destination',
      description: destination.address || 'Selected destination',
      pinColor: '#e74c3c',
      type: 'destination'
    });
  }

  // 3. Add route polylines
  if (selectedRoute?.coordinates && selectedRoute.coordinates.length > 0) {
    polylines.push({
      id: 'selected-route',
      coordinates: selectedRoute.coordinates,
      strokeColor: '#1e3a8a', // Dark blue
      strokeWidth: 8,
      type: 'route'
    });
  }

  // 4. Add alternative routes
  alternativeRoutes?.forEach((route, index) => {
    if (route.coordinates && route.coordinates.length > 0) {
      polylines.push({
        id: `alternative-route-${index}`,
        coordinates: route.coordinates,
        strokeColor: '#3b82f6', // Lighter blue
        strokeWidth: 4,
        type: 'alternative'
      });
    }
  });

  // 5. Prepare reports and gas stations for clustering
  // (Clustering is done separately via backend API)
  
  return { markers, polylines };
};
```

**What it does:**
- Creates map markers for current location and destination
- Creates polylines for selected route and alternative routes
- Prepares data for clustering (but clustering is done via backend)

---

### 3. Report Comparison (`compareReports`)
**Location:** `services/routeSelectionDataProcessor.ts:343-433`

**Current Logic:**
```typescript
export const compareReports = (currentReports: Report[], freshReports: Report[]): boolean => {
  // 1. Quick length check
  if (currentReports.length !== freshReports.length) return true;

  // 2. Create maps for efficient comparison
  const currentMap = new Map<string, ReportData>();
  const freshMap = new Map<string, ReportData>();

  // 3. Build maps with report data
  currentReports.forEach(report => {
    if (report._id) {
      currentMap.set(report._id, {
        status: report.status || '',
        archived: report.archived || false,
        updatedAt: report.updatedAt,
        location: report.location
      });
    }
  });

  freshReports.forEach(report => {
    if (report._id) {
      freshMap.set(report._id, {
        status: report.status || '',
        archived: report.archived || false,
        updatedAt: report.updatedAt,
        location: report.location
      });
    }
  });

  // 4. Check for removed reports
  for (const [id, currentData] of currentMap) {
    const freshData = freshMap.get(id);
    if (!freshData) return true; // Report removed
  }

  // 5. Check for status/archived changes
  for (const [id, currentData] of currentMap) {
    const freshData = freshMap.get(id);
    if (currentData.status !== freshData.status || 
        currentData.archived !== freshData.archived) {
      return true; // Status changed
    }
  }

  // 6. Check for location changes (threshold: 0.0001 degrees)
  for (const [id, currentData] of currentMap) {
    const freshData = freshMap.get(id);
    if (currentData.location && freshData.location) {
      const latDiff = Math.abs(currentData.location.latitude - freshData.location.latitude);
      const lngDiff = Math.abs(currentData.location.longitude - freshData.location.longitude);
      if (latDiff > 0.0001 || lngDiff > 0.0001) {
        return true; // Location changed
      }
    }
  }

  // 7. Check for new reports
  for (const [id, freshData] of freshMap) {
    if (!currentMap.has(id)) return true; // New report added
  }

  return false; // No changes detected
};
```

**What it does:**
- Compares two report arrays to detect changes
- Checks for: removed reports, status changes, archived changes, location changes, new reports
- Returns `true` if changes detected, `false` if no changes

---

## Proposed Backend API Endpoints

### 1. **GET `/api/map/processed-data`** - Get Processed Map Data

**Purpose:** Replace all frontend filtering and marker preparation with a single backend call.

**Request:**
```typescript
GET /api/map/processed-data?userId={userId}&showReports={boolean}&showGasStations={boolean}&currentZoom={number}

// Query Parameters:
{
  userId: string;              // Required: User ID
  showReports?: boolean;       // Optional: Include reports (default: true)
  showGasStations?: boolean;   // Optional: Include gas stations (default: true)
  currentZoom?: number;        // Optional: Current map zoom level
  viewport?: {                 // Optional: Map viewport bounds
    north: number;
    south: number;
    east: number;
    west: number;
  };
  mapFilters?: {               // Optional: Map filters
    showTrafficReports?: boolean;
    showGasStations?: boolean;
    showAccidents?: boolean;
    showRoadwork?: boolean;
    showCongestion?: boolean;
    showHazards?: boolean;
  };
}
```

**Response:**
```typescript
{
  success: true;
  data: {
    // Filtered and validated reports (already filtered on backend)
    reports: Array<{
      _id: string;
      type: string;
      location: {
        latitude: number;
        longitude: number;
      };
      status: string;
      archived: boolean;
      votes: Array<{ userId: string; vote: number }>;
      createdAt: string;
      updatedAt: string;
      // ... other report fields
    }>;
    
    // Filtered and validated gas stations (already filtered on backend)
    gasStations: Array<{
      _id: string;
      name: string;
      brand: string;
      location: {
        coordinates: [number, number]; // [lng, lat]
      };
      address: {
        street: string;
        city: string;
        province: string;
      };
      // ... other gas station fields
    }>;
    
    // User motors (already filtered on backend)
    motors: Array<{
      _id: string;
      nickname: string;
      currentFuelLevel: number;
      fuelEfficiency: number;
      // ... other motor fields
    }>;
    
    // Pre-processed map markers (ready for rendering)
    markers: Array<{
      id: string;
      coordinate: {
        latitude: number;
        longitude: number;
      };
      title: string;
      description?: string;
      pinColor: string;
      type: 'report' | 'gasStation' | 'current' | 'destination' | 'cluster';
      report?: any;           // If type is 'report'
      gasStation?: any;       // If type is 'gasStation'
      count?: number;         // If type is 'cluster'
      markers?: any[];        // If type is 'cluster'
    }>;
    
    // Pre-processed clusters (if zoom level requires clustering)
    clusters: Array<{
      id: string;
      coordinate: {
        latitude: number;
        longitude: number;
      };
      count: number;
      markers: any[];
      type: 'report' | 'gasStation' | 'mixed';
    }>;
    
    // Statistics
    statistics: {
      totalReports: number;
      filteredReports: number;
      totalGasStations: number;
      filteredGasStations: number;
      totalMotors: number;
      markersGenerated: number;
      clustersGenerated: number;
    };
    
    // Performance metrics
    performance: {
      processingTime: number;  // milliseconds
      filteringTime: number;
      clusteringTime: number;
      markerGenerationTime: number;
    };
  };
}
```

**Backend Processing Required:**
1. ✅ **Filter Reports:**
   - Remove reports without location
   - Remove archived reports (`archived === true`)
   - Remove reports with status `'archived'` or `'deleted'`
   - Validate coordinates (latitude: -90 to 90, longitude: -180 to 180)

2. ✅ **Filter Gas Stations:**
   - Remove gas stations without coordinates
   - Validate coordinate format `[longitude, latitude]`
   - Validate coordinate ranges

3. ✅ **Apply Map Filters:**
   - Filter reports by type (accidents, roadwork, congestion, hazards)
   - Filter gas stations if `showGasStations === false`

4. ✅ **Generate Map Markers:**
   - Convert reports to marker format
   - Convert gas stations to marker format
   - Add current location marker (if provided)
   - Add destination marker (if provided)

5. ✅ **Cluster Markers (if needed):**
   - Cluster markers based on zoom level
   - Generate cluster markers with counts

---

### 2. **POST `/api/map/prepare-markers`** - Prepare Map Markers and Polylines

**Purpose:** Generate map markers and polylines from provided data.

**Request:**
```typescript
POST /api/map/prepare-markers

{
  currentLocation?: {
    latitude: number;
    longitude: number;
  };
  destination?: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  selectedRoute?: {
    id: string;
    coordinates: Array<{ latitude: number; longitude: number }>;
  };
  alternativeRoutes?: Array<{
    id: string;
    coordinates: Array<{ latitude: number; longitude: number }>;
  }>;
  reports?: any[];              // Already filtered reports
  gasStations?: any[];          // Already filtered gas stations
  showReports?: boolean;
  showGasStations?: boolean;
  currentZoom?: number;
}
```

**Response:**
```typescript
{
  success: true;
  data: {
    markers: Array<{
      id: string;
      coordinate: { latitude: number; longitude: number };
      title: string;
      description?: string;
      pinColor: string;
      type: 'current' | 'destination' | 'report' | 'gasStation' | 'cluster';
      report?: any;
      gasStation?: any;
      count?: number;
      markers?: any[];
    }>;
    
    polylines: Array<{
      id: string;
      coordinates: Array<{ latitude: number; longitude: number }>;
      strokeColor: string;
      strokeWidth: number;
      type: 'route' | 'alternative';
    }>;
    
    clusters: Array<{
      id: string;
      coordinate: { latitude: number; longitude: number };
      count: number;
      markers: any[];
      type: 'report' | 'gasStation' | 'mixed';
    }>;
  };
}
```

---

### 3. **POST `/api/map/compare-reports`** - Compare Reports for Changes

**Purpose:** Detect changes between current and fresh reports.

**Request:**
```typescript
POST /api/map/compare-reports

{
  currentReports: Array<{
    _id: string;
    status?: string;
    archived?: boolean;
    updatedAt?: string;
    location?: {
      latitude: number;
      longitude: number;
    };
  }>;
  freshReports: Array<{
    _id: string;
    status?: string;
    archived?: boolean;
    updatedAt?: string;
    location?: {
      latitude: number;
      longitude: number;
    };
  }>;
}
```

**Response:**
```typescript
{
  success: true;
  data: {
    hasChanges: boolean;
    changes: {
      added: string[];        // Array of report IDs that were added
      removed: string[];      // Array of report IDs that were removed
      modified: Array<{       // Array of reports that were modified
        id: string;
        changes: {
          status?: { from: string; to: string };
          archived?: { from: boolean; to: boolean };
          location?: { 
            from: { latitude: number; longitude: number };
            to: { latitude: number; longitude: number };
          };
        };
      }>;
    };
    statistics: {
      currentCount: number;
      freshCount: number;
      addedCount: number;
      removedCount: number;
      modifiedCount: number;
    };
  };
}
```

---

### 4. **Update Existing Endpoints**

#### **GET `/api/reports`** - Should return filtered data
**Current:** Returns all reports (including archived/invalid)
**Should:** Return only valid, non-archived reports with valid coordinates

**Query Parameters:**
```typescript
{
  includeArchived?: boolean;    // Default: false
  includeInvalid?: boolean;     // Default: false
  filters?: {                    // Optional filters
    types?: string[];            // ['accident', 'roadwork', 'congestion', 'hazard']
    status?: string[];           // ['active', 'resolved']
  };
  viewport?: {                   // Optional: Filter by viewport
    north: number;
    south: number;
    east: number;
    west: number;
  };
}
```

#### **GET `/api/gas-stations`** - Should return filtered data
**Current:** Returns all gas stations (including invalid)
**Should:** Return only gas stations with valid coordinates

**Query Parameters:**
```typescript
{
  includeInvalid?: boolean;     // Default: false
  viewport?: {                   // Optional: Filter by viewport
    north: number;
    south: number;
    east: number;
    west: number;
  };
}
```

#### **GET `/api/user-motors/user/:userId`** - Should return filtered data
**Current:** Returns all motors
**Should:** Return only valid motors (with required fields)

---

## Data Processing Rules

### **Report Filtering Rules:**
1. ✅ **Remove if:** `report.location` is missing or null
2. ✅ **Remove if:** `report.archived === true`
3. ✅ **Remove if:** `report.status === 'archived'` or `report.status === 'deleted'`
4. ✅ **Remove if:** Coordinates are invalid:
   - `latitude` not a number or NaN
   - `longitude` not a number or NaN
   - `latitude` < -90 or > 90
   - `longitude` < -180 or > 180

### **Gas Station Filtering Rules:**
1. ✅ **Remove if:** `station.location.coordinates` is missing or null
2. ✅ **Remove if:** `coordinates` is not an array
3. ✅ **Remove if:** `coordinates.length < 2`
4. ✅ **Remove if:** Coordinates are invalid:
   - `coordinates[0]` (longitude) not a number or NaN
   - `coordinates[1]` (latitude) not a number or NaN
   - `latitude` < -90 or > 90
   - `longitude` < -180 or > 180

### **Map Marker Generation Rules:**
1. **Current Location Marker:**
   - `id`: `'current-location'`
   - `type`: `'current'`
   - `pinColor`: `'#00ADB5'`
   - `title`: `'Current Location'`
   - `description`: `'Your current position'`

2. **Destination Marker:**
   - `id`: `'destination'`
   - `type`: `'destination'`
   - `pinColor`: `'#e74c3c'`
   - `title`: `'Destination'`
   - `description`: `destination.address || 'Selected destination'`

3. **Report Markers:**
   - `id`: `report._id`
   - `type`: `'report'`
   - `pinColor`: Based on report type (accident, roadwork, etc.)
   - `title`: Report type
   - `description`: Report description

4. **Gas Station Markers:**
   - `id`: `station._id`
   - `type`: `'gasStation'`
   - `pinColor`: Based on brand
   - `title`: Station name
   - `description`: Station address

### **Polyline Generation Rules:**
1. **Selected Route:**
   - `id`: `'selected-route'`
   - `type`: `'route'`
   - `strokeColor`: `'#1e3a8a'` (dark blue)
   - `strokeWidth`: `8`

2. **Alternative Routes:**
   - `id`: `'alternative-route-{index}'`
   - `type`: `'alternative'`
   - `strokeColor`: `'#3b82f6'` (lighter blue)
   - `strokeWidth`: `4`

---

## Implementation Priority

### **Phase 1: High Priority (Immediate Impact)**
1. ✅ **Update `/api/reports`** - Filter archived/invalid reports
2. ✅ **Update `/api/gas-stations`** - Filter invalid gas stations
3. ✅ **Create `/api/map/processed-data`** - Single endpoint for all processed data

### **Phase 2: Medium Priority (Performance Improvement)**
4. ✅ **Create `/api/map/prepare-markers`** - Marker and polyline generation
5. ✅ **Create `/api/map/compare-reports`** - Report comparison

### **Phase 3: Low Priority (Optimization)**
6. ✅ **Viewport filtering** - Filter data by map viewport bounds
7. ✅ **Caching** - Cache processed data on backend

---

## Example Backend Implementation

### **Node.js/Express Example:**

```javascript
// GET /api/map/processed-data
router.get('/processed-data', async (req, res) => {
  try {
    const { userId, showReports = true, showGasStations = true, currentZoom, viewport, mapFilters } = req.query;
    
    // 1. Fetch raw data
    const [rawReports, rawGasStations, rawMotors] = await Promise.all([
      showReports ? Report.find({ /* query */ }) : [],
      showGasStations ? GasStation.find({ /* query */ }) : [],
      Motor.find({ userId })
    ]);
    
    // 2. Filter reports
    const filteredReports = rawReports.filter(report => {
      if (!report.location) return false;
      if (report.archived === true) return false;
      if (report.status === 'archived' || report.status === 'deleted') return false;
      if (!validateCoordinates(report.location)) return false;
      if (mapFilters && !matchesFilters(report, mapFilters)) return false;
      return true;
    });
    
    // 3. Filter gas stations
    const filteredGasStations = rawGasStations.filter(station => {
      const coords = station?.location?.coordinates;
      if (!coords || !Array.isArray(coords) || coords.length < 2) return false;
      return validateCoordinates({
        latitude: Number(coords[1]),
        longitude: Number(coords[0])
      });
    });
    
    // 4. Generate markers
    const markers = generateMarkers(filteredReports, filteredGasStations);
    
    // 5. Cluster markers (if needed)
    const clusters = currentZoom < 15 
      ? await clusterMarkers(markers, currentZoom)
      : [];
    
    // 6. Return processed data
    res.json({
      success: true,
      data: {
        reports: filteredReports,
        gasStations: filteredGasStations,
        motors: rawMotors,
        markers,
        clusters,
        statistics: {
          totalReports: rawReports.length,
          filteredReports: filteredReports.length,
          totalGasStations: rawGasStations.length,
          filteredGasStations: filteredGasStations.length,
          totalMotors: rawMotors.length,
          markersGenerated: markers.length,
          clustersGenerated: clusters.length
        },
        performance: {
          processingTime: Date.now() - startTime
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
```

---

## Benefits of Backend Processing

1. ✅ **Performance:** Reduces client-side computation
2. ✅ **Consistency:** Single source of truth for filtering rules
3. ✅ **Scalability:** Backend can handle heavy processing
4. ✅ **Caching:** Backend can cache processed data
5. ✅ **Bandwidth:** Only send filtered/processed data to client
6. ✅ **Maintainability:** Easier to update filtering rules

---

## Migration Checklist

- [ ] Update `/api/reports` to filter archived/invalid reports
- [ ] Update `/api/gas-stations` to filter invalid stations
- [ ] Create `/api/map/processed-data` endpoint
- [ ] Create `/api/map/prepare-markers` endpoint
- [ ] Create `/api/map/compare-reports` endpoint
- [ ] Add viewport filtering support
- [ ] Add map filter support
- [ ] Add caching for processed data
- [ ] Update frontend to use new endpoints
- [ ] Remove frontend processing code

---

## Questions for Backend Team

1. **Coordinate Validation:** Should we use a library for coordinate validation, or implement custom validation?
2. **Clustering Algorithm:** Which clustering algorithm should we use? (K-means, DBSCAN, etc.)
3. **Caching Strategy:** How should we cache processed data? (Redis, in-memory, etc.)
4. **Viewport Filtering:** Should we use MongoDB geospatial queries for viewport filtering?
5. **Performance Targets:** What are the performance targets? (e.g., < 200ms response time)

---

## Contact

For questions or clarifications, please refer to this document or contact the frontend team.

