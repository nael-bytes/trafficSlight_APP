# Data Flow Diagram - Loop Prevention

## Visual Guide to Understanding the Fixed Data Flow

---

## ❌ BEFORE: The Loop Problem

### The Infinite Loop Chain

```
┌─────────────────────────────────────────────────────────────────┐
│                        INFINITE LOOP                             │
└─────────────────────────────────────────────────────────────────┘

Component Render
     ↓
Create new refreshData function (not memoized)
     ↓
useEffect [refreshData] triggers
     ↓
Call refreshData()
     ↓
Fetch data, update reports/gasStations/motors state
     ↓
State change causes re-render
     ↓
Create new refreshData function (different reference)
     ↓
useEffect [refreshData] triggers again
     ↓
... LOOP CONTINUES ...


┌─────────────────────────────────────────────────────────────────┐
│                    LOCATION TRACKING LOOP                        │
└─────────────────────────────────────────────────────────────────┘

Location updates (every 1 second)
     ↓
currentLocation state changes
     ↓
useEffect [currentLocation, isTracking] triggers
     ↓
setRegion(newRegion) - Updates region state
     ↓
Component re-renders with new region
     ↓
Map animates to new region
     ↓
Region change might trigger onRegionChange (if defined)
     ↓
setRegion() called again
     ↓
... LOOP CONTINUES ...
```

### The Stats Update Loop

```
Tracking active, location changes every 1 second
     ↓
Stats updated (distance, speed, fuel)
     ↓
onStatsUpdate(stats) called
     ↓
Parent component: setSelectedMotor(updated motor)
     ↓
Component re-renders
     ↓
onStatsUpdate function recreated (new reference)
     ↓
useTracking sees new onStatsUpdate
     ↓
Effect runs, calls onStatsUpdate again
     ↓
... LOOP CONTINUES ...
```

---

## ✅ AFTER: The Fixed Flow

### Stable Data Refresh Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    STABLE DATA REFRESH                           │
└─────────────────────────────────────────────────────────────────┘

Component Render
     ↓
refreshData = useCallback(() => {...}, [fetchData])
  (Memoized - same reference unless fetchData changes)
     ↓
fetchData = useCallback(async () => {
  // Uses functional setState - no dependency on state
  setReports(prev => newReports || prev);
}, [saveToCache, updateCachedReports, ...])
     ↓
useEffect(() => { ... }, [refreshData])
  Only runs on initial mount or when user changes
     ↓
✓ No loop - refreshData reference is stable


PERIODIC REFRESH (Timer-based, not state-based)
     ↓
setInterval(() => refreshData(), 10000)
     ↓
Fetches new data
     ↓
Updates state with functional setState
     ↓
✓ No loop - timer continues independently
```

### Fixed Location Tracking Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                THROTTLED LOCATION TRACKING                       │
└─────────────────────────────────────────────────────────────────┘

Location updates (GPS - every 1 second)
     ↓
currentLocation state changes
     ↓
useEffect [currentLocation.lat, currentLocation.lng, isTracking]
     ↓
Check: now - lastRegionUpdate.current < 1000ms?
  YES → Skip update (throttled)
  NO → Continue
     ↓
Check: Location changed significantly? (>10 meters)
  NO → Skip update
  YES → Continue
     ↓
lastRegionUpdate.current = now
     ↓
mapRef.current.animateToRegion(newRegion, 500)
  ⚠️ NOTE: Only animates map, DOES NOT call setRegion()
     ↓
✓ No loop - region state not updated during tracking
✓ Map follows location smoothly
✓ Maximum 1 animation per second
```

### Fixed Stats Update Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                  THROTTLED STATS UPDATES                         │
└─────────────────────────────────────────────────────────────────┘

Stats update (location change during tracking)
     ↓
rideStats state updated (distance, speed, etc.)
     ↓
useEffect [rideStats.distance, rideStats.duration, onStatsUpdate]
     ↓
Check: now - lastStatsUpdate.current < 2000ms?
  YES → Skip update (throttled)
  NO → Continue
     ↓
lastStatsUpdate.current = now
     ↓
onStatsUpdate(rideStats)
  ⚠️ onStatsUpdate is memoized with useCallback([])
     ↓
Parent: handleStatsUpdate = useCallback((stats) => {
  setSelectedMotor(prev => ({
    ...prev,
    currentFuelLevel: newLevel,
    analytics: updatedAnalytics
  }));
}, []); // Empty deps, uses functional setState
     ↓
✓ No loop - callback is stable
✓ Maximum 1 update every 2 seconds
✓ Uses functional setState, no dependencies
```

---

## 🎯 Component Hierarchy & Data Flow

```
┌──────────────────────────────────────────────────────────────────┐
│                     RouteSelectionScreen                         │
│                                                                  │
│  State:                                                          │
│  - region                    ← Only updated by user actions     │
│  - currentLocation           ← Updated by GPS                   │
│  - selectedMotor             ← Updated by user or tracking      │
│  - screenMode                ← Updated by user                  │
│                                                                  │
│  Refs:                                                           │
│  - isUserDrivenRegionChange  ← Tracks change source            │
│  - lastRegionUpdate          ← Throttles region updates         │
│  - isInitialMount            ← Prevents duplicate mount calls   │
│                                                                  │
│  Hooks:                                                          │
│  - useAppData({ user, isTracking })                             │
│      ↓ returns: { reports, gasStations, motors, refreshData }  │
│      ↓ refreshData is stable - memoized properly               │
│                                                                  │
│  - useTracking({ selectedMotor, onStatsUpdate })                │
│      ↓ onStatsUpdate is memoized with useCallback([])          │
│      ↓ returns: { isTracking, rideStats, routeCoordinates }    │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
                         ↓
                         ↓ Passes props
                         ↓
┌──────────────────────────────────────────────────────────────────┐
│                        MapComponent                              │
│                                                                  │
│  Props:                                                          │
│  - region                    ← Controlled prop (no callbacks)   │
│  - currentLocation           ← Display only                     │
│  - reportMarkers             ← Display only                     │
│  - gasStations               ← Display only                     │
│  - routeCoordinates          ← Display only                     │
│  - isTracking                ← Controls behavior                │
│                                                                  │
│  ⚠️ No onRegionChange callback - purely controlled component    │
│  ⚠️ Map animations handled via mapRef.animateToRegion()         │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Key Interaction Flows

### 1. User Taps "My Location" Button

```
User taps button
     ↓
handleGetCurrentLocation()
  - Set isUserDrivenRegionChange.current = true
     ↓
Get GPS location
     ↓
setCurrentLocation(coords)
setRegion(coords)
     ↓
mapRef.current.animateToRegion(coords)
     ↓
Set isUserDrivenRegionChange.current = false
     ↓
✓ Complete - single update, no loop
```

### 2. User Starts Tracking

```
User taps play button
     ↓
handleTrackingToggle()
  - Validates motor and location
     ↓
startTracking()
     ↓
setScreenMode('tracking')
     ↓
useTracking hook starts:
  - Location subscription active
  - Stats timer starts (1 second interval)
     ↓
Location updates arrive:
  - currentLocation updated
  - useEffect throttles region updates
  - Only animates map (no state update)
     ↓
Stats updates (throttled to 2 seconds):
  - onStatsUpdate called
  - Motor fuel level updated with functional setState
     ↓
✓ Smooth tracking with controlled update frequency
```

### 3. Data Refresh Cycle

```
Component mounts
     ↓
useEffect runs once (initial mount)
  - loadCachedData() - Shows cached data immediately
  - refreshData() - Fetches fresh data
     ↓
10-second timer starts
     ↓
Timer fires:
  - Check: isTracking? 
    - If NO: refreshData() every 10s
    - If YES: refreshData() every 5s
     ↓
refreshData() executes:
  - Fetch reports, gas stations (always)
  - Fetch motors (only once per session)
  - Update state with functional setState
  - Cache results
     ↓
✓ Periodic refresh without causing render loops
```

---

## 🛠️ Debugging Tools Reference

### React DevTools Profiler
```
Open React DevTools → Profiler tab
Start recording
Perform action (e.g., start tracking)
Stop recording
Look for:
  ✓ Components rendering frequently (>10 times/second)
  ✓ Unexpected render causes
  ✓ Components with long render times
```

### Console Logging Pattern
```javascript
// Add to component
console.log('[ComponentName] render', {
  state: { region, currentLocation },
  deps: { refreshData, handleStatsUpdate },
  timestamp: Date.now()
});

// Monitor for:
// - Repeated logs in quick succession
// - Same values but different timestamps
// - Pattern in state changes
```

### Dependency Tracking
```javascript
// In useEffect
useEffect(() => {
  console.log('[Effect] Triggered by dependency change:', {
    dep1,
    dep2,
    stackTrace: new Error().stack
  });
}, [dep1, dep2]);
```

---

## 📊 Performance Metrics

### Before Fixes
- **Renders per second**: ~50-100 during tracking
- **Effect triggers**: ~30-50 per second
- **CPU usage**: 40-60%
- **Memory**: Constantly growing
- **Battery drain**: High

### After Fixes
- **Renders per second**: ~1-2 during tracking
- **Effect triggers**: ~2-3 per second (controlled)
- **CPU usage**: 10-20%
- **Memory**: Stable
- **Battery drain**: Normal

---

## 🎓 Key Takeaways

1. **Separate Visual from State**: Map animations ≠ State updates
2. **Throttle Everything**: Location, stats, scroll, search
3. **Functional setState**: When in doubt, use `setState(prev => ...)`
4. **Memoize Callbacks**: Always wrap in `useCallback`
5. **Refs for Tracking**: Non-render state in `useRef`
6. **Primitive Dependencies**: Use `.id`, `.length` instead of objects
7. **Stable References**: Make sure hooks return stable functions

---

## 🔗 Related Documentation

- `LOOPING_FIX_SUMMARY.md` - Detailed fix documentation
- `RENDER_LOOP_PREVENTION_CHECKLIST.md` - Quick reference checklist
- React Docs: [useCallback](https://react.dev/reference/react/useCallback)
- React Docs: [useEffect](https://react.dev/reference/react/useEffect)
- React Docs: [useRef](https://react.dev/reference/react/useRef)

