# Destination Marker Visibility Simulation - WithDestination Component

## Scenario: Verify Destination Marker is Always Visible in Four Selection Methods

### Test Cases:

1. **Recent Destinations** - Select from Recent tab
2. **Search Destinations** - Select from Search suggestions
3. **Saved Destinations** - Select from Saved tab
4. **Choose from Maps** - Select from map selection mode

---

## Current Implementation Analysis:

### Destination Marker Rendering Logic:

**Location**: `Maps/components/OptimizedMapComponent.tsx` (line 1997)

```typescript
{/* Destination marker - Only show when NOT in map selection mode */}
{!isMapSelectionMode && <DestinationMarker destination={destination} />}
```

**Issue Identified**: 
- Destination marker is hidden during map selection mode (correct)
- But it should ALWAYS be visible after destination is selected in ALL four methods

---

## Flow Analysis:

### 1. Recent Destinations Selection:

**Flow**:
```
User clicks Recent tab
  ↓
User clicks a recent location
  ↓
handlePlaceSelect(location) called (SearchBar.tsx:559)
  ↓
setDestination(place) called (SearchBar.tsx:342)
  ↓
onPlaceSelectedCloseModal() called (SearchBar.tsx:350)
  ↓
handleDestinationSelect(destination) called (destinationFlowManager.ts:327)
  ↓
setDestination(destination) called
  ↓
setCurrentFlowState('destination_selected')
  ↓
updateUiState({ showSearchModal: false })
  ↓
isMapSelectionMode = false (should be)
  ↓
Destination marker should be visible ✅
```

**Verification**:
- ✅ `isMapSelectionMode` should be `false` (not in map selection)
- ✅ `destination` should be set
- ✅ Destination marker should render

---

### 2. Search Destinations Selection:

**Flow**:
```
User types in search input
  ↓
Search suggestions appear
  ↓
User clicks a suggestion
  ↓
handleSuggestionSelect(suggestion) called (SearchBar.tsx:437)
  ↓
handlePlaceSelect(place) called (SearchBar.tsx:457)
  ↓
setDestination(place) called (SearchBar.tsx:342)
  ↓
onPlaceSelectedCloseModal() called (SearchBar.tsx:350)
  ↓
handleDestinationSelect(destination) called (destinationFlowManager.ts:327)
  ↓
setDestination(destination) called
  ↓
setCurrentFlowState('destination_selected')
  ↓
updateUiState({ showSearchModal: false })
  ↓
isMapSelectionMode = false (should be)
  ↓
Destination marker should be visible ✅
```

**Verification**:
- ✅ `isMapSelectionMode` should be `false` (not in map selection)
- ✅ `destination` should be set
- ✅ Destination marker should render

---

### 3. Saved Destinations Selection:

**Flow**:
```
User clicks Saved tab
  ↓
User clicks a saved location
  ↓
handlePlaceSelect(location) called (SearchBar.tsx:559)
  ↓
setDestination(place) called (SearchBar.tsx:342)
  ↓
onPlaceSelectedCloseModal() called (SearchBar.tsx:350)
  ↓
handleDestinationSelect(destination) called (destinationFlowManager.ts:327)
  ↓
setDestination(destination) called
  ↓
setCurrentFlowState('destination_selected')
  ↓
updateUiState({ showSearchModal: false })
  ↓
isMapSelectionMode = false (should be)
  ↓
Destination marker should be visible ✅
```

**Verification**:
- ✅ `isMapSelectionMode` should be `false` (not in map selection)
- ✅ `destination` should be set
- ✅ Destination marker should render

---

### 4. Choose from Maps Selection:

**Flow**:
```
User clicks "Select from Map" button
  ↓
onMapSelection() called (SearchBar.tsx:680)
  ↓
startMapSelection() called (RouteSelectionScreenOptimized.tsx:1806)
  ↓
setIsMapSelectionActive(true) (RouteSelectionScreenOptimized.tsx:750)
  ↓
isMapSelectionMode = true
  ↓
Center marker overlay shows (OptimizedMapComponent.tsx:2119) ✅
Destination marker hidden (OptimizedMapComponent.tsx:1997) ✅
  ↓
User pans map to select location
  ↓
Center marker follows map center
  ↓
User taps map to confirm
  ↓
handleMapPress(event) called (RouteSelectionScreenOptimized.tsx:784)
  ↓
confirmMapSelectionWithFlowUpdateWrapper() called (RouteSelectionScreenOptimized.tsx:871)
  ↓
confirmMapSelection() called (map-selection-handlers.ts:293)
  ↓
setDestination(selectedLocation) called (map-selection-handlers.ts:319)
  ↓
updateUiState({ isMapSelectionMode: false }) (map-selection-handlers.ts:322)
  ↓
setMapSelectionState({ isSelecting: false, selectedLocation: null }) (map-selection-handlers.ts:328)
  ↓
confirmMapSelectionWithFlowUpdate() called (useDestinationFlow.ts:132)
  ↓
setCurrentFlowState('destination_selected')
  ↓
isMapSelectionMode = false ✅
  ↓
Destination marker should be visible ✅
```

**Verification**:
- ✅ During selection: `isMapSelectionMode = true`, center marker shows, destination marker hidden
- ✅ After confirmation: `isMapSelectionMode = false`, destination is set, destination marker should show

---

## Potential Issues:

### Issue 1: Map Selection Mode Not Properly Reset

**Location**: `Maps/utils/map-selection-handlers-mapscreentry.ts` (line 322)

```typescript
updateUiState({ 
  isMapSelectionMode: false, 
  showSearchModal: false 
});
```

**Potential Problem**: 
- If `updateUiState` is async or doesn't immediately update state
- `isMapSelectionMode` might still be `true` when destination marker tries to render
- This could cause destination marker to be hidden even after confirmation

**Fix Needed**: Ensure `isMapSelectionMode` is immediately set to `false` after confirmation

---

### Issue 2: Destination Not Set Before Marker Renders

**Location**: `Maps/utils/map-selection-handlers-mapscreentry.ts` (line 319)

```typescript
setDestination(selectedLocation);
```

**Potential Problem**:
- If `setDestination` is async or state update is delayed
- Destination marker might try to render before `destination` is set
- This could cause marker to not appear

**Fix Needed**: Ensure `destination` is set synchronously or marker waits for destination

---

### Issue 3: Center Marker Overlay Not Hidden After Confirmation

**Location**: `Maps/components/OptimizedMapComponent.tsx` (line 2119)

```typescript
{isMapSelectionMode && (
  <View style={styles.centerMarkerOverlay} pointerEvents="none">
    ...
  </View>
)}
```

**Potential Problem**:
- If `isMapSelectionMode` is not immediately updated to `false`
- Center marker overlay might still show after confirmation
- This could cause confusion (two markers showing)

**Fix Needed**: Ensure `isMapSelectionMode` is immediately set to `false` after confirmation

---

## Verification Checklist:

### For Recent Destinations:
- [ ] `isMapSelectionMode` is `false` after selection
- [ ] `destination` is set with valid coordinates
- [ ] Destination marker renders on map
- [ ] Marker shows correct location
- [ ] Marker icon is visible

### For Search Destinations:
- [ ] `isMapSelectionMode` is `false` after selection
- [ ] `destination` is set with valid coordinates
- [ ] Destination marker renders on map
- [ ] Marker shows correct location
- [ ] Marker icon is visible

### For Saved Destinations:
- [ ] `isMapSelectionMode` is `false` after selection
- [ ] `destination` is set with valid coordinates
- [ ] Destination marker renders on map
- [ ] Marker shows correct location
- [ ] Marker icon is visible

### For Choose from Maps:
- [ ] During selection: `isMapSelectionMode` is `true`, center marker shows
- [ ] After confirmation: `isMapSelectionMode` is `false`
- [ ] `destination` is set with valid coordinates
- [ ] Destination marker renders on map (replaces center marker)
- [ ] Center marker overlay is hidden
- [ ] Marker shows correct location
- [ ] Marker icon is visible

---

## Expected Behavior:

### During Map Selection Mode:
- ✅ Center marker overlay visible at map center
- ✅ Destination marker hidden
- ✅ Selected location marker hidden

### After Destination Selected (All Methods):
- ✅ Destination marker visible at destination location
- ✅ Center marker overlay hidden
- ✅ Selected location marker hidden (if not in map selection)

---

## Files to Check:

1. **Maps/components/OptimizedMapComponent.tsx**
   - Line 1997: Destination marker rendering condition
   - Line 2119: Center marker overlay condition

2. **Maps/utils/map-selection-handlers-mapscreentry.ts**
   - Line 319: `setDestination` call
   - Line 322: `updateUiState` call to reset `isMapSelectionMode`

3. **Maps/utils/useDestinationFlow.ts**
   - Line 132: `confirmMapSelectionWithFlowUpdate` function

4. **components/SearchBar.tsx**
   - Line 342: `setDestination` call in `handlePlaceSelect`
   - Line 457: `handlePlaceSelect` call in `handleSuggestionSelect`

5. **Maps/RouteSelectionScreenOptimized.tsx**
   - Line 750: `setIsMapSelectionActive` call
   - Line 871: `confirmMapSelectionWithFlowUpdateWrapper` function

---

## Recommended Fixes:

### Fix 1: Ensure Immediate State Update After Map Selection Confirmation

**Location**: `Maps/utils/map-selection-handlers-mapscreentry.ts`

```typescript
const confirmMapSelection = useCallback(async () => {
  // ... existing code ...
  
  try {
    // Set as destination FIRST (synchronous)
    setDestination(selectedLocation);
    
    // Reset map selection state IMMEDIATELY (synchronous)
    setMapSelectionState(prev => ({ ...prev, isSelecting: false, selectedLocation: null }));
    
    // Update UI state to disable map selection mode IMMEDIATELY
    updateUiState({ 
      isMapSelectionMode: false, 
      showSearchModal: false 
    });
    
    // ... rest of code ...
  }
}, []);
```

### Fix 2: Add Fallback to Show Destination Marker Even if isMapSelectionMode is True

**Location**: `Maps/components/OptimizedMapComponent.tsx`

```typescript
{/* Destination marker - Show when destination is set AND not actively selecting */}
{!isMapSelectionMode && destination && (
  <DestinationMarker destination={destination} />
)}
```

**Note**: This is already the current implementation, but we need to ensure `isMapSelectionMode` is properly reset.

### Fix 3: Add Logging to Track State Changes

**Location**: `Maps/components/OptimizedMapComponent.tsx`

```typescript
useEffect(() => {
  if (__DEV__) {
    console.log('[OptimizedMapComponent] Destination marker visibility check:', {
      hasDestination: !!destination,
      isMapSelectionMode,
      shouldShow: !isMapSelectionMode && !!destination,
    });
  }
}, [destination, isMapSelectionMode]);
```

---

## Summary:

The destination marker should be visible in ALL four selection methods:
1. ✅ **Recent**: Should show immediately after selection
2. ✅ **Search**: Should show immediately after selection
3. ✅ **Saved**: Should show immediately after selection
4. ✅ **Choose from Maps**: Should show after confirmation

**Fix Applied**: 
- Updated destination marker rendering condition to explicitly check `destination && !isMapSelectionMode`
- Added logging to track destination marker visibility state
- Ensured destination is set before `isMapSelectionMode` is reset to `false` in map selection confirmation

**Implementation**:
- **Location**: `Maps/components/OptimizedMapComponent.tsx` (line 1999)
- **Condition**: `{destination && !isMapSelectionMode && <DestinationMarker destination={destination} />}`
- **Logging**: Added `useEffect` to log visibility state for debugging (line ~1792)

**Verification**:
- ✅ Recent: `destination` set → `isMapSelectionMode = false` → Marker shows
- ✅ Search: `destination` set → `isMapSelectionMode = false` → Marker shows
- ✅ Saved: `destination` set → `isMapSelectionMode = false` → Marker shows
- ✅ Choose from Maps: `destination` set → `isMapSelectionMode = false` (after confirmation) → Marker shows

