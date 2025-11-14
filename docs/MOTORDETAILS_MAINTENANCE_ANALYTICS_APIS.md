# MotorDetailsScreen - Maintenance Analytics APIs Documentation

## Overview
This document details all API endpoints used in the **Maintenance Analytics** section of `MotorDetailsScreen.tsx`, including the variables and data retrieved from each endpoint.

---

## API Endpoints Used

### 1. Get Last Maintenance Records
**Endpoint:** `GET /api/maintenance-records/last/:userId`

**Location in Code:** Lines 182-266

**Purpose:** Fetches the last maintenance record of each type (refuel, oil_change, tune_up) for a user.

**Request Parameters:**
- `userId` (URL parameter) - The user ID

**Response Structure:**
```typescript
{
  lastRefuel: {
    date: string;        // Date of last refuel
    // ... other fields
  },
  lastOilChange: {
    date: string;        // Date of last oil change
    // ... other fields
  },
  lastTuneUp: {
    date: string;        // Date of last tune-up
    // ... other fields
  }
}
```

**Variables Retrieved:**
- `lastRecords.lastRefuel` - Last refuel record (summary)
- `lastRecords.lastOilChange` - Last oil change record (summary)
- `lastRecords.lastTuneUp` - Last tune-up record (summary)

**Usage:**
- Used to identify which maintenance records need full details
- Then calls endpoint #2 to fetch full details for each record

---

### 2. Get Full Maintenance Record Details
**Endpoint:** `GET /api/maintenance-records/motor/:motorId?type={type}&limit=1&sortBy=timestamp&sortOrder=desc`

**Location in Code:** Lines 207-231 (inside `fetchFullRecord` function)

**Purpose:** Fetches the most recent full maintenance record of a specific type for a motor.

**Request Parameters:**
- `motorId` (URL parameter) - The motor ID
- `type` (Query parameter) - Maintenance type: `'refuel'`, `'oil_change'`, or `'tune_up'`
- `limit` (Query parameter) - Number of records to return (always `1`)
- `sortBy` (Query parameter) - Field to sort by (always `'timestamp'`)
- `sortOrder` (Query parameter) - Sort order (always `'desc'`)

**Response Structure:**
```typescript
// Option 1: Array response
[
  {
    _id: string;
    motorId: {
      _id: string;
      // ... motor details
    };
    type: 'refuel' | 'oil_change' | 'tune_up';
    timestamp: string;
    date: string;
    odometer?: number;
    location?: {
      address?: string;
      latitude: number;
      longitude: number;
    };
    details: {
      // Refuel-specific fields
      cost?: number;
      costPerLiter?: number;
      quantity?: number;
      fuelTank?: number;
      refueledPercent?: number;
      fuelLevelBefore?: number;
      fuelLevelAfter?: number;
      serviceProvider?: string;
      notes?: string;
      
      // Oil change-specific fields
      oilType?: string;
      oilViscosity?: string;
      warranty?: boolean;
      nextServiceDate?: string;
      nextServiceOdometer?: number;
      
      // Tune-up-specific fields
      warranty?: boolean;
      nextServiceDate?: string;
      nextServiceOdometer?: number;
      serviceProvider?: string;
      notes?: string;
    };
  }
]

// Option 2: Wrapped response
{
  records: [
    // ... same structure as above
  ]
}
```

**Variables Retrieved:**
- `lastRefuelFull` - Full details of last refuel record
- `lastOilChangeFull` - Full details of last oil change record
- `lastTuneUpFull` - Full details of last tune-up record

**Stored in State:**
- `analytics.lastRefuel` - Full refuel record with all details
- `analytics.lastOilChange` - Full oil change record with all details
- `analytics.lastTuneUp` - Full tune-up record with all details

**Displayed Fields:**
- **Refuel:** Date, Total Refuels, Quantity, Cost, Cost per Liter, Fuel Tank, Refueled %, Fuel Before/After, Odometer, Location, Service Provider, Notes
- **Oil Change:** Date, Total Oil Changes, KM Since Last Change, Quantity, Oil Type, Oil Viscosity, Odometer, Location, Service Provider, Warranty, Next Service Date/Odometer, Notes
- **Tune Up:** Date, Total Tune Ups, KM Since Last Tune Up, Cost, Odometer, Location, Service Provider, Warranty, Next Service Date/Odometer, Notes

---

### 3. Get Oil Change Countdown
**Endpoint:** `GET /api/maintenance-records/oil-change/countdown/:motorId`

**Location in Code:** Lines 268-315

**Purpose:** Fetches countdown information for the next oil change (distance and days since last oil change).

**Request Parameters:**
- `motorId` (URL parameter) - The motor ID

**Response Structure:**
```typescript
{
  kmSinceLastOilChange: number;      // Kilometers traveled since last oil change
  daysSinceLastOilChange: number;    // Days since last oil change
}
```

**Variables Retrieved:**
- `countdownData.kmSinceLastOilChange` - Kilometers since last oil change
- `countdownData.daysSinceLastOilChange` - Days since last oil change

**Stored in State:**
- `analytics.kmSinceOilChange` - Used for distance-based countdown (3000 km threshold)
- `analytics.daysSinceOilChange` - Used for time-based countdown (180 days threshold)

**Displayed:**
- Distance remaining: `3000 - kmSinceOilChange` km
- Time remaining: `180 - daysSinceOilChange` days
- Progress bars showing countdown status
- Overdue warnings if thresholds exceeded

---

### 4. Get All Maintenance Records for Motor
**Endpoint:** `GET /api/maintenance-records/motor/:motorId`

**Location in Code:** Lines 85-97

**Purpose:** Fetches all maintenance records for a specific motor (used for local calculations).

**Request Parameters:**
- `motorId` (URL parameter) - The motor ID

**Response Structure:**
```typescript
// Option 1: Array response
[
  {
    _id: string;
    type: 'refuel' | 'oil_change' | 'tune_up' | 'tire_rotation' | 'brake_service' | 'other';
    timestamp: string;
    // ... other fields
  }
]

// Option 2: Wrapped response
{
  maintenanceRecords: [
    // ... array of records
  ]
}

// Option 3: Data wrapper
{
  data: [
    // ... array of records
  ]
}
```

**Variables Retrieved:**
- `maintenanceRecords` - Array of all maintenance records for the motor

**Stored in State:**
- `maintenanceRecords` - Used for local calculations and fallback counts

**Used For:**
- Local calculation of maintenance counts (refuels, oil changes, tune-ups)
- Fallback if API analytics fail
- Memoized count calculation: `maintenanceCounts` (refuels, oilChanges, tuneUps)

---

### 5. Get Motor Overview Analytics
**Endpoint:** `GET /api/user-motors/motor-overview/:motorId`

**Location in Code:** Lines 325-402 (via `getMotorAnalytics` → `getMotorOverview`)

**Purpose:** Fetches comprehensive motor overview statistics.

**Request Parameters:**
- `motorId` (URL parameter) - The motor ID

**Response Structure:**
```typescript
{
  motorId: string;
  totalMotors: number;
  totalDistance: number;           // Total distance traveled (km)
  totalFuelUsed: number;           // Total fuel consumed (L)
  averageEfficiency: number;       // Average fuel efficiency (km/L)
  trips: number;                  // Total number of trips
  maintenanceRecords: number;      // Total maintenance records
  fuelLogs: number;                // Total fuel logs
}
```

**Variables Retrieved:**
- `analyticsData.overview.averageEfficiency` - Average fuel efficiency
- `analyticsData.overview.totalFuelUsed` - Total fuel consumed

**Stored in State:**
- `analytics.averageFuelEfficiency` - Displayed as "Average Fuel Efficiency: X.XX km/L"
- `analytics.totalFuelConsumed` - Displayed as "Total Fuel Consumed: X.XX L"

**Fallback:**
- If API fails, uses `analyticsData.fuelStats.averageEfficiency` or `0`
- If API fails, uses `analyticsData.fuelStats.totalLiters` or `0`

---

### 6. Get Fuel Statistics
**Endpoint:** `GET /api/fuel-stats/:motorId`

**Location in Code:** Lines 325-402 (via `getMotorAnalytics` → `getFuelStats`)

**Purpose:** Fetches fuel-related statistics for a motor.

**Request Parameters:**
- `motorId` (URL parameter) - The motor ID

**Response Structure:**
```typescript
{
  motorId: string;
  totalLiters: number;             // Total fuel consumed (L)
  totalCost: number;               // Total fuel cost
  averagePrice: number;            // Average price per liter
  averageEfficiency: number;       // Average fuel efficiency (km/L)
  totalDistance: number;           // Total distance traveled (km)
}
```

**Variables Retrieved:**
- `analyticsData.fuelStats.averageEfficiency` - Average fuel efficiency (fallback)
- `analyticsData.fuelStats.totalLiters` - Total fuel consumed (fallback)

**Stored in State:**
- Used as fallback if `overview` data is not available
- `analytics.averageFuelEfficiency` - Falls back to `fuelStats.averageEfficiency`
- `analytics.totalFuelConsumed` - Falls back to `fuelStats.totalLiters`

---

### 7. Get Maintenance Analytics Summary
**Endpoint:** `GET /api/maintenance-records/analytics/summary?userId={userId}&motorId={motorId}`

**Location in Code:** Lines 325-402 (via `getMotorAnalytics` → `getMaintenanceAnalytics`)

**Purpose:** Fetches maintenance analytics summary including counts by type and upcoming services.

**Request Parameters:**
- `userId` (Query parameter) - The user ID (required)
- `motorId` (Query parameter) - The motor ID (optional, but provided in this case)

**Response Structure:**
```typescript
{
  totalRecords: number;
  totalCost: number;
  byType: {
    oil_change: number;      // Count of oil changes
    tire_rotation: number;   // Count of tire rotations
    brake_service: number;   // Count of brake services
    refuel: number;          // Count of refuels
    tune_up: number;         // Count of tune-ups
    other: number;           // Count of other maintenance
  };
  upcomingServices: Array<{
    motorId: string;
    nextServiceDate: string;  // ISO date string
    type: string;             // Service type
  }>;
}
```

**Variables Retrieved:**
- `analyticsData.maintenance.byType.refuel` - Total refuels count
- `analyticsData.maintenance.byType.oil_change` - Total oil changes count
- `analyticsData.maintenance.byType.tune_up` - Total tune-ups count
- `analyticsData.maintenance.upcomingServices` - Array of upcoming services

**Stored in State:**
- `analytics.totalRefuels` - Displayed as "Total Refuels: X"
- `analytics.totalOilChanges` - Displayed as "Total Oil Changes: X"
- `analytics.totalTuneUps` - Displayed as "Total Tune Ups: X"
- `analytics.maintenanceAlerts` - Array of alert strings generated from `upcomingServices`

**Maintenance Alerts Logic:**
- Filters `upcomingServices` where `motorId === item._id`
- Calculates days until service: `(serviceDate - now) / (1000 * 60 * 60 * 24)`
- If `daysUntilService < 7`, adds alert: `"⚠️ {type} due soon ({days} days)"`

**Fallback:**
- If API fails, uses local `maintenanceCounts` (calculated from `maintenanceRecords` array)

---

### 8. Get Trips for Motor
**Endpoint:** `GET /api/trips?motorId={motorId}`

**Location in Code:** Lines 57-130

**Purpose:** Fetches all trips for a specific motor (used for local calculations).

**Request Parameters:**
- `motorId` (Query parameter) - The motor ID

**Response Structure:**
```typescript
// Option 1: Array response
[
  {
    _id: string;
    motorId: string;
    tripStartTime: string;      // ISO date string
    actualDistance: number;      // Distance in km
    // ... other trip fields
  }
]

// Option 2: Wrapped response
{
  trips: [
    // ... array of trips
  ]
}

// Option 3: Data wrapper
{
  data: [
    // ... array of trips
  ]
}
```

**Variables Retrieved:**
- `trips` - Array of all trips for the motor

**Stored in State:**
- `trips` - Used for local calculations

**Used For:**
- Local calculation of `kmSinceOilChange` (sum of `actualDistance` for trips after last oil change)
- Local calculation of `kmSinceTuneUp` (sum of `actualDistance` for trips after last tune-up)
- Displayed as "Total Trips: X trips"

---

## Data Flow Summary

### Initial Load (Component Mount)
1. **Fetch trips and maintenance records** (Endpoint #4, #8)
   - Gets all maintenance records and trips for local calculations
   
2. **Fetch last maintenance records** (Endpoint #1)
   - Gets summary of last refuel, oil change, tune-up
   
3. **Fetch full maintenance record details** (Endpoint #2)
   - Gets complete details for each last maintenance record
   
4. **Fetch oil change countdown** (Endpoint #3)
   - Gets distance and days since last oil change
   
5. **Fetch comprehensive analytics** (Endpoints #5, #6, #7 via `getMotorAnalytics`)
   - Gets motor overview, fuel stats, and maintenance analytics

### State Updates
All data is stored in the `analytics` state object:
```typescript
{
  lastRefuel: MaintenanceRecord | null;
  lastOilChange: MaintenanceRecord | null;
  lastTuneUp: MaintenanceRecord | null;
  kmSinceOilChange: number;
  kmSinceTuneUp: number;
  daysSinceOilChange: number;
  totalRefuels: number;
  totalOilChanges: number;
  totalTuneUps: number;
  averageFuelEfficiency: number;
  totalFuelConsumed: number;
  maintenanceAlerts: string[];
}
```

---

## Error Handling

### Abort Controllers
Each API call uses an `AbortController` to cancel requests when:
- Component unmounts
- Dependencies change (motor ID, user ID)
- New request is initiated

### Fallback Mechanisms
1. **Maintenance Counts:** If API analytics fail, uses local `maintenanceCounts` calculated from `maintenanceRecords` array
2. **Fuel Efficiency:** Falls back to `fuelStats.averageEfficiency` if `overview.averageEfficiency` is not available
3. **Fuel Consumed:** Falls back to `fuelStats.totalLiters` if `overview.totalFuelUsed` is not available

### Error Logging
- All errors are logged in `__DEV__` mode
- Abort errors are silently ignored
- State updates are only performed if component is still mounted (`isMountedRef.current`)

---

## Performance Optimizations

1. **Memoized Calculations:** `maintenanceCounts` is memoized and only recalculates when `maintenanceRecords.length` changes
2. **Parallel API Calls:** `getMotorAnalytics` uses `Promise.allSettled` to fetch overview, fuel stats, and maintenance analytics in parallel
3. **Abort Controllers:** Prevents memory leaks and unnecessary API calls
4. **Mounted Checks:** Prevents state updates on unmounted components

---

## Display Sections

### 1. Last Refuel
- Date, Total Refuels, Quantity, Cost
- Additional details: Cost per Liter, Fuel Tank, Refueled %, Fuel Before/After, Odometer, Location, Service Provider, Notes

### 2. Last Oil Change
- Date, Total Oil Changes, KM Since Last Change, Quantity
- Additional details: Oil Type, Oil Viscosity, Odometer, Location, Service Provider, Warranty, Next Service Date/Odometer, Notes
- **Oil Change Countdown:** Distance remaining (3000 km), Time remaining (180 days), Progress bars, Recommendations

### 3. Last Tune Up
- Date, Total Tune Ups, KM Since Last Tune Up, Cost
- Additional details: Odometer, Location, Service Provider, Warranty, Next Service Date/Odometer, Notes

### 4. Performance Analytics
- Average Fuel Efficiency (km/L)
- Total Fuel Consumed (L)
- Total Trips

### 5. Maintenance Alerts
- Warnings for services due within 7 days

---

## Notes

- All API calls use the `apiRequest` utility from `utils/api.ts` for consistent authentication and error handling
- The `getMotorAnalytics` function combines three endpoints (#5, #6, #7) into a single call
- Local calculations are used as fallbacks and for additional metrics (kmSinceOilChange, kmSinceTuneUp)
- The component handles multiple response formats (array, wrapped object, data wrapper) for maximum compatibility

