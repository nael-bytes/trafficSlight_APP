# Marker Reload on App Open - Simulation & Implementation

## Scenario: User Already Logged In → Opens App → Markers Not Fully Loaded → Auto Reload

### Test Flow:

1. **User is already logged in**
   - User has valid token in AsyncStorage
   - User data is cached
   - Previous session markers may be cached

2. **User opens the app**
   - App loads from background or cold start
   - UserContext loads cached user data
   - RouteSelectionScreenOptimized mounts
   - Screen becomes focused (`isFocused = true`)

3. **Initial marker load**
   - Cached markers loaded from AsyncStorage
   - `useAppData` hook initializes
   - `effectiveReports` and `effectiveGasStations` computed
   - Markers displayed on map

4. **Marker load check (NEW)**
   - After 2 seconds of screen focus
   - Check if markers are fully loaded
   - If total markers < 5, trigger reload

5. **Auto reload if needed**
   - Call `refreshAppData()` to fetch fresh markers
   - Update markers on map
   - Log reload action (dev mode only)

---

## Implementation Details:

### Location: `Maps/RouteSelectionScreenOptimized.tsx`

**Added Code (Lines 1090-1132):**

```typescript
// Check if markers are fully loaded when screen focuses and reload if needed
useEffect(() => {
  // Only check when screen is focused and user is logged in
  if (!isFocused || !user?._id) return;

  // Wait a bit for initial data to load
  const checkTimeout = setTimeout(() => {
    // Check if markers are not fully loaded
    const reportsCount = effectiveReports?.length || 0;
    const gasStationsCount = effectiveGasStations?.length || 0;
    const totalMarkers = reportsCount + gasStationsCount;

    // Threshold: If total markers is less than 5, consider it not fully loaded
    const MIN_EXPECTED_MARKERS = 5;
    const isMarkersNotFullyLoaded = totalMarkers < MIN_EXPECTED_MARKERS;

    if (isMarkersNotFullyLoaded && refreshAppData) {
      if (__DEV__) {
        console.log('[RouteSelection] ⚠️ Markers not fully loaded, reloading...', {
          reportsCount,
          gasStationsCount,
          totalMarkers,
          timestamp: new Date().toISOString(),
        });
      }

      // Reload markers
      refreshAppData().catch((error) => {
        if (__DEV__) {
          console.warn('[RouteSelection] Failed to reload markers:', error);
        }
      });
    }
  }, 2000); // Wait 2 seconds after focus to allow initial load

  return () => {
    clearTimeout(checkTimeout);
  };
}, [isFocused, user?._id, effectiveReports?.length, effectiveGasStations?.length, refreshAppData]);
```

### Key Features:

1. **Focus-Based Check**
   - Only runs when screen is focused (`isFocused = true`)
   - Prevents unnecessary checks when user is on other tabs

2. **User Authentication Check**
   - Only runs when user is logged in (`user?._id` exists)
   - Prevents checks for unauthenticated users

3. **Delayed Check**
   - Waits 2 seconds after focus to allow initial data load
   - Prevents false positives from race conditions

4. **Smart Threshold**
   - Minimum expected markers: 5
   - Accounts for areas with genuinely few markers
   - Only triggers reload if markers are suspiciously low

5. **Automatic Reload**
   - Calls `refreshAppData()` from `useAppData` hook
   - Fetches fresh markers from API
   - Updates map automatically

6. **Error Handling**
   - Catches and logs errors (dev mode only)
   - Doesn't crash app if reload fails

---

## Marker Count Logic:

### What Counts as "Not Fully Loaded":

- **Total markers < 5**: Triggers reload
  - This threshold accounts for:
    - Areas with genuinely few markers
    - Initial load delays
    - Network issues during first load

### What Counts as "Fully Loaded":

- **Total markers >= 5**: No reload needed
  - Assumes markers are properly loaded
  - Even if some markers are missing, 5+ indicates successful load

---

## Flow Diagram:

```
App Opens
  ↓
UserContext loads cached user
  ↓
RouteSelectionScreenOptimized mounts
  ↓
Screen becomes focused (isFocused = true)
  ↓
useAppData initializes
  ↓
Cached markers loaded
  ↓
effectiveReports & effectiveGasStations computed
  ↓
[Wait 2 seconds]
  ↓
Check marker count
  ↓
Total markers < 5?
  ├─ YES → Call refreshAppData() → Reload markers
  └─ NO  → Markers fully loaded, no action
```

---

## Testing Scenarios:

### Scenario 1: Markers Not Fully Loaded
- **Initial state**: 0 reports, 0 gas stations
- **After 2 seconds**: Check detects < 5 markers
- **Action**: `refreshAppData()` called
- **Result**: Fresh markers fetched and displayed

### Scenario 2: Markers Fully Loaded
- **Initial state**: 10 reports, 15 gas stations
- **After 2 seconds**: Check detects >= 5 markers
- **Action**: No reload needed
- **Result**: Markers remain as loaded

### Scenario 3: Partial Load
- **Initial state**: 2 reports, 1 gas station (total: 3)
- **After 2 seconds**: Check detects < 5 markers
- **Action**: `refreshAppData()` called
- **Result**: Additional markers fetched

### Scenario 4: User Not Logged In
- **Initial state**: No user
- **Check**: Skipped (no `user?._id`)
- **Result**: No reload attempted

### Scenario 5: Screen Not Focused
- **Initial state**: User on different tab
- **Check**: Skipped (`isFocused = false`)
- **Result**: No reload attempted

---

## Benefits:

1. **Automatic Recovery**
   - Detects incomplete marker loads
   - Automatically reloads without user intervention

2. **User Experience**
   - Users see markers even if initial load failed
   - No need to manually refresh

3. **Performance**
   - Only checks when screen is focused
   - 2-second delay prevents false positives
   - Smart threshold prevents unnecessary reloads

4. **Reliability**
   - Handles network errors gracefully
   - Doesn't crash app on reload failure
   - Logs actions for debugging (dev mode)

---

## Configuration:

### Adjustable Parameters:

1. **Check Delay**: `2000` milliseconds (2 seconds)
   - Increase for slower networks
   - Decrease for faster response

2. **Minimum Expected Markers**: `5`
   - Increase for areas with more markers
   - Decrease for rural areas

3. **Dependencies**: `[isFocused, user?._id, effectiveReports?.length, effectiveGasStations?.length, refreshAppData]`
   - Effect re-runs when these change
   - Ensures check happens on relevant state changes

---

## Logs (Dev Mode Only):

### When Markers Not Fully Loaded:
```
[RouteSelection] ⚠️ Markers not fully loaded, reloading...
{
  reportsCount: 0,
  gasStationsCount: 0,
  totalMarkers: 0,
  timestamp: "2024-01-01T12:00:00.000Z"
}
```

### When Reload Fails:
```
[RouteSelection] Failed to reload markers: [error details]
```

---

## Files Modified:

- `Maps/RouteSelectionScreenOptimized.tsx`
  - Added `refreshData` from `useAppData` hook
  - Added marker reload check effect
  - Added marker count validation logic

---

## Future Enhancements:

1. **Retry Logic**: Add retry mechanism if reload fails
2. **User Notification**: Show toast when markers are reloaded
3. **Configurable Threshold**: Allow users to adjust minimum marker count
4. **Network-Aware**: Skip reload if device is offline
5. **Time-Based Check**: Only reload if markers haven't updated recently

