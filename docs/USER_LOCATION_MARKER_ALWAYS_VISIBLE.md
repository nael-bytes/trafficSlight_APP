# User Location Marker Always Visible Fix

## Overview
Ensured the user location marker is always visible when location is available, even when the user is idle or AFK. The app continuously watches user location, so the marker should always be displayed.

---

## Changes Made

### 1. **Updated UserLocationMarker Component**

**File**: `Maps/components/OptimizedMapComponent.tsx`

**Changes**:
- Added comment clarifying that marker should always show when location is available (even when idle/AFK)
- Added `zIndex={1000}` to ensure user marker is always on top of other markers
- Marker already shows when `currentLocation` is available - no conditional hiding

**Code**:
```typescript
const UserLocationMarker = React.memo<{
  currentLocation: LocationCoords;
  snappedRouteCoordinates: LocationCoords[];
}>(({ currentLocation, snappedRouteCoordinates }) => {
  // CRITICAL: Always show marker when location is available (even when idle/AFK)
  // App always watches user location, so marker should always be visible
  if (!currentLocation || !validateCoordinates(currentLocation)) return null;
  
  // ... rest of component
  
  return (
    <Marker 
      coordinate={coordinate} 
      title="Your Location"
      tracksViewChanges={false}
      anchor={{ x: 0.5, y: 1 }}
      // CRITICAL: Always visible when location is available
      zIndex={1000} // Ensure user marker is always on top
    >
      {/* ... */}
    </Marker>
  );
});
```

---

### 2. **Updated Marker Rendering Comment**

**File**: `Maps/components/OptimizedMapComponent.tsx`

**Changes**:
- Added comment clarifying that user marker should always be visible when location is available
- Emphasized that app always watches user location

**Code**:
```typescript
{/* User location marker - ALWAYS show when location is available (even when idle/AFK) */}
{/* CRITICAL: App always watches user location, so marker should always be visible */}
{currentLocation && 
 typeof currentLocation.latitude === 'number' && 
 // ... validation checks ...
 && (
  <UserLocationMarker
    currentLocation={currentLocation}
    snappedRouteCoordinates={snappedRouteCoordinates || []}
  />
)}
```

---

## How It Works

### Location Watching

The app continuously watches user location via:

1. **Continuous GPS Watch** (`useLocationEffects.ts` - Effect 5.4):
   - Uses `Location.watchPositionAsync` when screen is focused
   - Updates every 3 seconds or 5 meters
   - Works even when not tracking (idle/AFK state)
   - Updates `currentLocation` state

2. **Global Location Context Sync** (`useLocationEffects.ts` - Effect 2.5):
   - Syncs global LocationContext with map's local state
   - Ensures location updates are reflected on the map
   - Works even when user is not on map screen

3. **Tracking Location Sync** (`useLocationEffects.ts` - Effect 5.5):
   - Syncs location during active tracking
   - Uses snapped route coordinates for accuracy

### Marker Display

The marker is displayed when:
- ✅ `currentLocation` exists
- ✅ Coordinates are valid (latitude/longitude are numbers, within valid ranges)
- ✅ Screen is focused (location watching is active)

The marker is **NOT** hidden based on:
- ❌ Tracking state (shows even when not tracking)
- ❌ Idle/AFK state (shows even when idle)
- ❌ Navigation state (shows even when not navigating)

---

## Verification

To verify the marker is always visible:

1. **Open the Maps tab**
   - User location marker should appear immediately when location is obtained
   - Marker should remain visible even when idle

2. **Go idle/AFK**
   - Marker should still be visible
   - Marker should update position as location changes (every 3 seconds or 5 meters)

3. **Switch tabs and return**
   - Marker should reappear when returning to Maps tab
   - Location watching resumes when screen is focused

4. **Check location updates**
   - Marker position should update smoothly
   - No flickering or disappearing

---

## Technical Details

### Location Update Frequency

- **When focused**: Updates every 3 seconds or 5 meters (via `watchPositionAsync`)
- **When tracking**: Updates more frequently with snapped coordinates
- **When idle**: Still updates every 3 seconds or 5 meters

### Marker Z-Index

- User marker: `zIndex={1000}` (always on top)
- Other markers: Default z-index (below user marker)

### Performance

- Marker uses `tracksViewChanges={false}` for optimal performance
- Memoized component to prevent unnecessary re-renders
- Only re-renders when coordinates actually change

---

## Notes

- The marker will only show when location permission is granted
- The marker requires valid GPS coordinates
- If location is unavailable, marker will not display (expected behavior)
- Location watching is paused when screen is not focused (to save battery)

---

**Last Updated**: January 2024

