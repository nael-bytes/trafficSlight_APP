# Backend Data Processing Migration - Quick Summary

## API Endpoints

### Map Processing Endpoints

**GET `/api/map/processed-data`**
- Query Parameters:
  - `userId` (string, required): User ID
  - `showReports` (boolean, optional): Include reports (default: true)
  - `showGasStations` (boolean, optional): Include gas stations (default: true)
  - `currentZoom` (number, optional): Current map zoom level
- Returns: Processed map data including filtered reports, gas stations, motors, and pre-generated markers

**POST `/api/map/prepare-markers`**
- Body: Marker preparation data (current location, destination, routes, reports, gas stations)
- Returns: Prepared map markers and polylines

**POST `/api/map/compare-reports`**
- Body: Current and fresh report arrays
- Returns: Comparison result indicating changes (added, removed, modified reports)

### Data Endpoints

**GET `/api/reports`**
- Query Parameters:
  - `includeArchived` (boolean, optional): Include archived reports (default: false)
  - `includeInvalid` (boolean, optional): Include invalid reports (default: false)
  - `filters` (json, optional): Filter criteria (types, status, etc.)
  - `viewport` (json, optional): Map viewport bounds (north, south, east, west)
- Returns: Filtered reports (archived/invalid filtered by default)

**GET `/api/gas-stations`**
- Query Parameters:
  - `includeInvalid` (boolean, optional): Include invalid gas stations (default: false)
  - `viewport` (json, optional): Map viewport bounds (north, south, east, west)
- Returns: Filtered gas stations (invalid filtered by default)

### Implementation Notes

- All endpoints follow the migration guide specifications
- The code handles cases where the `status` field may not exist in reports, using `reportType` as a fallback when needed
- All filtering (archived, invalid, coordinate validation) is handled on the backend
- Viewport filtering is optional and can be used to optimize data fetching

---

## What Needs to Move to Backend

### ✅ **1. Report Filtering**
**Current Location:** `services/routeSelectionDataProcessor.ts:195-217`

**What it does:**
- Removes reports without location
- Removes archived reports (`archived === true`)
- Removes reports with status `'archived'` or `'deleted'`
- Validates coordinates (lat: -90 to 90, lng: -180 to 180)

**Backend Action:** Update `GET /api/reports` to return only filtered reports

---

### ✅ **2. Gas Station Filtering**
**Current Location:** `services/routeSelectionDataProcessor.ts:222-232`

**What it does:**
- Removes gas stations without coordinates
- Validates coordinate format `[longitude, latitude]`
- Validates coordinate ranges

**Backend Action:** Update `GET /api/gas-stations` to return only filtered gas stations

---

### ✅ **3. Map Marker Generation**
**Current Location:** `services/routeSelectionDataProcessor.ts:241-323`

**What it does:**
- Creates markers for current location, destination, reports, gas stations
- Creates polylines for routes
- Prepares data for clustering

**Backend Action:** Create `POST /api/map/prepare-markers` endpoint

---

### ✅ **4. Report Comparison**
**Current Location:** `services/routeSelectionDataProcessor.ts:343-433`

**What it does:**
- Compares two report arrays to detect changes
- Checks for: removed reports, status changes, archived changes, location changes, new reports

**Backend Action:** Create `POST /api/map/compare-reports` endpoint

---

## Recommended New Endpoint

### **GET `/api/map/processed-data`**

**Single endpoint that returns all processed data:**
- ✅ Filtered reports (no archived/invalid)
- ✅ Filtered gas stations (no invalid)
- ✅ User motors
- ✅ Pre-generated map markers
- ✅ Pre-generated clusters (if needed)
- ✅ Statistics and performance metrics

**Benefits:**
- One API call instead of multiple
- All processing done on backend
- Reduced client-side computation
- Better performance

---

## Filtering Rules (Backend Must Implement)

### **Reports:**
```javascript
// Remove if:
- !report.location
- report.archived === true
- report.status === 'archived' || report.status === 'deleted'
- Invalid coordinates (lat: -90 to 90, lng: -180 to 180)
```

### **Gas Stations:**
```javascript
// Remove if:
- !station.location.coordinates
- !Array.isArray(coordinates) || coordinates.length < 2
- Invalid coordinates (lat: -90 to 90, lng: -180 to 180)
```

---

## Coordinate Validation

```javascript
function validateCoordinates(location) {
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

## Priority

1. **HIGH:** Update existing endpoints to filter data
2. **MEDIUM:** Create new `/api/map/processed-data` endpoint
3. **LOW:** Add viewport filtering and caching

---

## Full Documentation

See `BACKEND_DATA_PROCESSING_MIGRATION.md` for complete details.

