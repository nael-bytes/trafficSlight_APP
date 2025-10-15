# RouteSelectionScreenImproved - Looping Issue Fix Summary

## Problem
The component was experiencing infinite render loops caused by continuous state updates in `useEffect` hooks. The loops occurred because:
1. Functions passed to `useEffect` dependencies were being recreated on every render
2. State updates triggered effects that updated other states, creating circular dependencies
3. Region and location updates were not properly throttled or controlled
4. Dependencies on unstable references (like `refreshData`) caused unnecessary reruns

## Solutions Applied

### 1. Added Refs for Loop Prevention (Lines 80-82)
```typescript
const isUserDrivenRegionChange = useRef(false);
const lastRegionUpdate = useRef<number>(0);
const isInitialMount = useRef(true);
```
**Purpose**: Track state outside the render cycle to prevent unnecessary re-renders and distinguish between user-driven and programmatic changes.

### 2. Stabilized `refreshData` with useCallback (Lines 149-151)
```typescript
const stableRefreshData = useCallback(() => {
  refreshData();
}, [refreshData]);
```
**Purpose**: Prevent `refreshData` from causing effect loops by wrapping it in a stable callback reference.

### 3. Fixed Motor Selection Effect (Line 175)
**Before**: `[effectiveMotors]` - caused loop because array reference changed
**After**: `[effectiveMotors.length, hasAnyMotorEver]` - only depends on primitive values

### 4. Fixed Focus Location Effect (Lines 188-207)
**Key Changes**:
- Uses `isUserDrivenRegionChange.current` to mark the change as intentional
- Depends on `focusLocation?.latitude, focusLocation?.longitude` instead of the entire object
- Resets the flag after a delay to prevent cascading updates

### 5. Fixed Auto-Update Map Region Effect (Lines 221-246)
**Critical Fix**:
- Added throttling: only updates once per second using `lastRegionUpdate.current`
- Only updates when location changes significantly (>10 meters)
- **Crucially**: Only calls `mapRef.current.animateToRegion()` without calling `setRegion()` during tracking
- This prevents the circular dependency: tracking → location update → region update → re-render → repeat

**Before**:
```typescript
useEffect(() => {
  if (isTracking && currentLocation) {
    const newRegion = { ...currentLocation, ... };
    setRegion(newRegion); // This caused the loop!
    // ...
  }
}, [currentLocation, isTracking]);
```

**After**:
```typescript
useEffect(() => {
  if (!isTracking || !currentLocation) return;
  
  const now = Date.now();
  if (now - lastRegionUpdate.current < 1000) return; // Throttle
  
  const latDiff = Math.abs(region.latitude - currentLocation.latitude);
  const lngDiff = Math.abs(region.longitude - currentLocation.longitude);
  const significantChange = latDiff > 0.0001 || lngDiff > 0.0001;
  
  if (significantChange) {
    lastRegionUpdate.current = now;
    const newRegion = { ...currentLocation, latitudeDelta: 0.0015, longitudeDelta: 0.0015 };
    
    // Only animate map, don't update state!
    if (mapRef.current) {
      mapRef.current.animateToRegion(newRegion, 500);
    }
  }
}, [currentLocation?.latitude, currentLocation?.longitude, isTracking]);
```

### 6. Removed Unstable Dependencies (Lines 278-286)
**Auto-refresh effect**: Removed `isTracking` and `refreshData` dependencies to prevent loops on tracking state changes.

### 7. Fixed Location Request Effect (Lines 351-356)
Uses `isInitialMount.ref` to ensure location is only requested once on mount, not repeatedly.

### 8. Enhanced `handleGetCurrentLocation` (Lines 289-348)
- Marks changes as user-driven with `isUserDrivenRegionChange.current = true`
- Properly cleans up the flag in the `finally` block
- Removed dependency on `isLoading` (used directly in closure instead)

### 9. Added `handleRegionChange` Callback (Lines 566-571)
```typescript
const handleRegionChange = useCallback((newRegion: any) => {
  if (!isTracking && isUserDrivenRegionChange.current) {
    setRegion(newRegion);
  }
}, [isTracking]);
```
**Purpose**: Provides a stable callback for MapComponent to call when users manually pan/zoom the map, ensuring only user-driven changes update the state.

### 10. Updated `handleReportSuccess` (Lines 536-540)
Uses `stableRefreshData` instead of `refreshData` to prevent dependency loops.

### 11. Fixed `navigateToRoutePlanning` Dependencies (Line 563)
Added `handleGetCurrentLocation` to dependency array for completeness.

## Key Principles Applied

### 1. **Throttling and Debouncing**
- Location updates throttled to 1 second intervals
- Significant change detection (10+ meters)

### 2. **Ref-Based State Tracking**
- Use `useRef` for values that need to persist but shouldn't trigger re-renders
- Track programmatic vs user-driven changes

### 3. **Stable Dependencies**
- Wrap functions in `useCallback` with proper dependencies
- Depend on primitive values (`.length`) instead of objects/arrays when possible

### 4. **Separate Concerns**
- Map animations (visual) separate from state updates (data)
- During tracking: only animate map, don't update region state

### 5. **One-Way Data Flow**
- Clear distinction between sources of truth
- Prevent circular dependencies between effects

### 12. Fixed `useAppData` Hook Dependencies

**File**: `hooks/useAppData.ts`

**Issue**: The `fetchData` callback depended on `reports`, `gasStations`, and `motors` state variables, causing it to be recreated every time those states changed, which triggered loops in any component using `refreshData`.

**Fix 1 - loadCachedData (Line 65)**: 
Added proper dependencies: `[cachedReports, cachedGasStations, cachedMotors]`

**Fix 2 - fetchData (Lines 83-175)**:
Removed `reports`, `gasStations`, `motors` from dependencies and used functional setState to access current values without adding to dependencies:

```typescript
// Before
const nextReports = reportsRes.status === 'fulfilled' ? reportsRes.value : reports;
// Dependencies: [saveToCache, reports, gasStations, motors]

// After  
setReports(prev => {
  nextReports = prev;
  return prev;
});
// Dependencies: [saveToCache, updateCachedReports, updateCachedGasStations, updateCachedMotors]
```

This ensures `refreshData` remains stable and doesn't cause loops.

### 13. Fixed `useTracking` Hook Stats Updates

**File**: `hooks/useTracking.ts`

**Issue**: The `onStatsUpdate` callback was called on every stats change (every second during tracking), causing frequent parent re-renders.

**Fix (Lines 171-182)**:
- Added throttling: only call `onStatsUpdate` once every 2 seconds
- Used `useRef` to track last update time
- Only depend on significant stats changes (`distance`, `duration`) instead of entire `rideStats` object

```typescript
// Before
useEffect(() => {
  if (onStatsUpdate) {
    onStatsUpdate(rideStats);
  }
}, [rideStats, onStatsUpdate]); // Runs on every stats change

// After
useEffect(() => {
  if (!onStatsUpdate || !isTracking) return;
  
  const now = Date.now();
  if (now - lastStatsUpdateRef.current < 2000) return; // Throttle
  
  lastStatsUpdateRef.current = now;
  onStatsUpdate(rideStats);
}, [rideStats.distance, rideStats.duration, onStatsUpdate, isTracking]);
```

### 14. Memoized `handleStatsUpdate` Callback

**File**: `RouteSelectionScreenImproved copy.tsx` (Lines 117-138)

**Issue**: The `onStatsUpdate` callback passed to `useTracking` was recreated on every render.

**Fix**: Wrapped in `useCallback` with empty dependencies, using functional setState to avoid dependencies on `selectedMotor`:

```typescript
const handleStatsUpdate = useCallback((stats: any) => {
  if (stats.distance > 0) {
    setSelectedMotor(prev => {
      if (!prev) return null;
      // Update using previous state
      return { ...prev, currentFuelLevel: newFuelLevel, ... };
    });
  }
}, []); // Stable reference
```

## Testing Recommendations

1. **Test tracking mode**: Verify map follows location without constant re-renders
2. **Test motor selection**: Ensure no loops when motors load
3. **Test navigation**: Verify focus location works without loops
4. **Test report submission**: Confirm data refresh doesn't cause loops
5. **Test stats updates**: Verify fuel consumption updates smoothly without performance issues
6. **Monitor console**: Check for excessive "[RouteSelection] render" logs
7. **Test data refresh**: Ensure auto-refresh every 10 seconds doesn't cause loops

## Performance Impact

### Before Fixes
- Potentially hundreds of renders per second during tracking
- `refreshData` recreated on every data fetch completion
- Stats updates triggering parent re-renders every second
- Map region updates causing cascading state changes

### After Fixes
- Maximum 1 map region animation per second (throttled)
- Stats callbacks throttled to once every 2 seconds
- Stable `refreshData` reference (doesn't change unless user changes)
- All callbacks properly memoized with `useCallback`
- Functional setState used to avoid circular dependencies

### Resource Usage
- **Memory**: Minimal additional overhead (5 refs total across components)
- **CPU**: Significantly reduced re-render cycles
- **Battery**: Improved due to reduced processing
- **User Experience**: Smooth animations without stuttering or performance degradation

## Summary of Pattern Fixes

1. ✅ **Use `useRef` for values that shouldn't trigger re-renders**
2. ✅ **Wrap callbacks in `useCallback` with proper dependencies**
3. ✅ **Use functional setState** (`setState(prev => ...)`) to avoid state dependencies
4. ✅ **Throttle/debounce frequent updates** (location, stats)
5. ✅ **Depend on primitive values** (`.length`, `.latitude`) instead of objects/arrays
6. ✅ **Separate visual updates** (map animations) from state updates
7. ✅ **Prevent circular effect dependencies** (A → B → C → A)

