# MotorDetailsScreen Maintenance Analytics API Refactor

## Overview
Refactored the Maintenance Analytics section in `MotorDetailsScreen.tsx` to use the Maintenance API endpoints, especially the "GET ALL LAST" endpoint (`/api/maintenance-records/last/:userId`) and the oil change countdown endpoint.

---

## Changes Made

### 1. **Added Last Maintenance Records API Integration**

**Endpoint Used**: `GET /api/maintenance-records/last/:userId`

**Implementation**:
- Added a new `useEffect` hook (lines 163-222) that fetches the last refuel, oil change, and tune-up records for the user
- The API returns basic info (date and odometer), so we fetch full record details separately
- For each last record type, we fetch the most recent full record for the specific motor using:
  - `GET /api/maintenance-records/motor/:motorId?type={type}&limit=1&sortBy=timestamp&sortOrder=desc`
- Only updates analytics if the record belongs to the current motor

**Code**:
```typescript
useEffect(() => {
  const fetchLastMaintenanceRecords = async () => {
    if (!item?.userId) return;

    try {
      // Fetch last maintenance records using the API endpoint
      const lastRecords = await apiRequest(`/api/maintenance-records/last/${item.userId}`);
      
      // Fetch full details for each last record if they exist
      const fetchFullRecord = async (record: any, type: string) => {
        if (!record || !record.date) return null;
        
        // Get the most recent record of this type for this motor
        const records = await apiRequest(
          `/api/maintenance-records/motor/${item._id}?type=${type}&limit=1&sortBy=timestamp&sortOrder=desc`
        );
        
        if (records?.records && records.records.length > 0) {
          return records.records[0];
        } else if (Array.isArray(records) && records.length > 0) {
          return records[0];
        }
        return null;
      };

      // Fetch full details for last refuel, oil change, and tune-up
      const [lastRefuelFull, lastOilChangeFull, lastTuneUpFull] = await Promise.all([
        fetchFullRecord(lastRecords?.lastRefuel, 'refuel'),
        fetchFullRecord(lastRecords?.lastOilChange, 'oil_change'),
        fetchFullRecord(lastRecords?.lastTuneUp, 'tune_up'),
      ]);

      // Update analytics with last records (only for this motor)
      setAnalytics(prev => ({
        ...prev,
        lastRefuel: lastRefuelFull && lastRefuelFull.motorId?._id === item._id ? lastRefuelFull : prev.lastRefuel,
        lastOilChange: lastOilChangeFull && lastOilChangeFull.motorId?._id === item._id ? lastOilChangeFull : prev.lastOilChange,
        lastTuneUp: lastTuneUpFull && lastTuneUpFull.motorId?._id === item._id ? lastTuneUpFull : prev.lastTuneUp,
      }));
    } catch (error) {
      if (__DEV__) {
        console.warn('[MotorDetails] Failed to fetch last maintenance records from API:', error);
      }
    }
  };

  fetchLastMaintenanceRecords();
}, [item?._id, item?.userId]);
```

---

### 2. **Added Oil Change Countdown API Integration**

**Endpoint Used**: `GET /api/maintenance-records/oil-change/countdown/:motorId`

**Implementation**:
- Added a new `useEffect` hook (lines 224-252) that fetches oil change countdown data
- The API returns:
  - `kmSinceLastOilChange`: Kilometers traveled since last oil change
  - `daysSinceLastOilChange`: Days since last oil change
  - `needsOilChange`: Boolean indicating if oil change is needed
  - `remainingKm`: Remaining kilometers before oil change is needed
  - `remainingDays`: Remaining days before oil change is needed
  - `lastOilChangeDate`: Date of last oil change

**Code**:
```typescript
useEffect(() => {
  const fetchOilChangeCountdown = async () => {
    if (!item?._id) return;

    try {
      const countdownData = await apiRequest(`/api/maintenance-records/oil-change/countdown/${item._id}`);
      
      if (countdownData) {
        setAnalytics(prev => ({
          ...prev,
          kmSinceOilChange: countdownData.kmSinceLastOilChange || prev.kmSinceOilChange,
          daysSinceOilChange: countdownData.daysSinceLastOilChange || prev.daysSinceOilChange,
        }));
      }
    } catch (error) {
      if (__DEV__) {
        console.warn('[MotorDetails] Failed to fetch oil change countdown from API:', error);
      }
    }
  };

  fetchOilChangeCountdown();
}, [item?._id]);
```

---

### 3. **Refactored Analytics Fetching**

**Changes**:
- Updated the main analytics `useEffect` (lines 254-317) to focus on totals and performance metrics
- Removed dependency on `calculatedAnalytics` for last records (now fetched separately)
- Still uses `getMotorAnalytics` from `motorService` for:
  - Total counts (refuels, oil changes, tune-ups)
  - Average fuel efficiency
  - Total fuel consumed
  - Maintenance alerts
- Falls back to local calculations if API fails

**Code**:
```typescript
useEffect(() => {
  const fetchAnalytics = async () => {
    if (!item?._id || !item?.userId) return;

    try {
      // Import motor service for additional analytics
      const { getMotorAnalytics } = await import('../../services/motorService');
      const analyticsData = await getMotorAnalytics(item._id, item.userId);

      // Count totals from maintenance records
      const refuels = maintenanceRecords.filter(record => record.type === 'refuel');
      const oilChanges = maintenanceRecords.filter(record => record.type === 'oil_change');
      const tuneUps = maintenanceRecords.filter(record => record.type === 'tune_up');

      // Generate maintenance alerts from API data
      const alerts: string[] = [];
      const upcomingServices = analyticsData.maintenance?.upcomingServices || [];
      const now = new Date();
      
      upcomingServices.forEach((service: any) => {
        if (service.motorId === item._id) {
          const serviceDate = new Date(service.nextServiceDate);
          const daysUntilService = Math.floor((serviceDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          if (daysUntilService < 7) {
            alerts.push(`⚠️ ${service.type} due soon (${daysUntilService} days)`);
          }
        }
      });

      setAnalytics(prev => ({
        ...prev,
        totalRefuels: analyticsData.maintenance?.byType?.refuel || refuels.length,
        totalOilChanges: analyticsData.maintenance?.byType?.oil_change || oilChanges.length,
        totalTuneUps: analyticsData.maintenance?.byType?.tune_up || tuneUps.length,
        averageFuelEfficiency: analyticsData.overview?.averageEfficiency || analyticsData.fuelStats?.averageEfficiency || 0,
        totalFuelConsumed: analyticsData.overview?.totalFuelUsed || analyticsData.fuelStats?.totalLiters || 0,
        maintenanceAlerts: alerts,
      }));
    } catch (error) {
      // Fallback to local calculation if API fails
      const refuels = maintenanceRecords.filter(record => record.type === 'refuel');
      const oilChanges = maintenanceRecords.filter(record => record.type === 'oil_change');
      const tuneUps = maintenanceRecords.filter(record => record.type === 'tune_up');
      
      setAnalytics(prev => ({
        ...prev,
        totalRefuels: refuels.length,
        totalOilChanges: oilChanges.length,
        totalTuneUps: tuneUps.length,
        averageFuelEfficiency: prev.averageFuelEfficiency || 0,
        totalFuelConsumed: prev.totalFuelConsumed || 0,
        maintenanceAlerts: prev.maintenanceAlerts || [],
      }));
    }
  };

  fetchAnalytics();
}, [item?._id, item?.userId, maintenanceRecords]);
```

---

## API Endpoints Used

1. **`GET /api/maintenance-records/last/:userId`**
   - Returns last refuel, oil change, and tune-up records for a user
   - Response format:
     ```json
     {
       "lastRefuel": { "date": "...", "odometer": 12345 },
       "lastOilChange": { "date": "...", "odometer": 10000 },
       "lastTuneUp": { "date": "...", "odometer": 9500 }
     }
     ```

2. **`GET /api/maintenance-records/motor/:motorId?type={type}&limit=1&sortBy=timestamp&sortOrder=desc`**
   - Fetches the most recent full maintenance record of a specific type for a motor
   - Used to get full details after getting basic info from the "last" endpoint

3. **`GET /api/maintenance-records/oil-change/countdown/:motorId`**
   - Returns oil change countdown information
   - Response format:
     ```json
     {
       "motorId": "...",
       "kmSinceLastOilChange": 2750,
       "daysSinceLastOilChange": 65,
       "needsOilChange": false,
       "remainingKm": 250,
       "remainingDays": 25,
       "lastOilChangeDate": "2025-10-10T00:00:00.000Z"
     }
     ```

---

## Benefits

1. **✅ Uses Official API Endpoints**: Now uses the Maintenance API endpoints as specified in the documentation
2. **✅ Accurate Data**: Oil change countdown is calculated server-side using trip distances
3. **✅ Better Performance**: Server-side calculations are more efficient than client-side
4. **✅ Consistent Data**: All maintenance data comes from the same API source
5. **✅ Fallback Support**: Still falls back to local calculations if API fails

---

## Data Flow

1. **On Component Mount**:
   - Fetches last maintenance records from `/api/maintenance-records/last/:userId`
   - Fetches full details for each last record type
   - Fetches oil change countdown from `/api/maintenance-records/oil-change/countdown/:motorId`
   - Fetches analytics (totals, efficiency, etc.) from `getMotorAnalytics`

2. **Data Updates**:
   - Last records are updated when `item._id` or `item.userId` changes
   - Oil change countdown is updated when `item._id` changes
   - Analytics are updated when `item._id`, `item.userId`, or `maintenanceRecords` change

3. **Display**:
   - All maintenance analytics sections use the API-fetched data
   - Oil change countdown uses API-calculated values
   - Falls back to local calculations if API fails

---

## Testing

To verify the refactor works correctly:

1. **Check Last Maintenance Records**:
   - Open MotorDetailsScreen for a motor with maintenance records
   - Verify "Last Refuel", "Last Oil Change", and "Last Tune Up" sections display correct data
   - Check console logs for API responses

2. **Check Oil Change Countdown**:
   - Verify "Next Oil Change Countdown" section displays correct values
   - Check that `kmSinceOilChange` and `daysSinceOilChange` match API response
   - Verify progress bars and recommendations work correctly

3. **Check Fallback Behavior**:
   - Simulate API failure (e.g., network error)
   - Verify that local calculations are used as fallback
   - Check that UI still displays data (even if from local calculations)

---

## Notes

- The `calculatedAnalytics` useMemo is still present but is no longer the primary source for last records
- Local calculations are kept as a fallback for reliability
- All API calls use the `apiRequest` utility for consistent authentication and error handling
- The implementation maintains backward compatibility with existing display logic

---

**Last Updated**: January 2024  
**Refactor Date**: January 2024

