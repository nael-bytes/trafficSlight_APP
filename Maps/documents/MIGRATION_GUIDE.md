# Migration Guide: RouteSelectionScreenOptimized to Maps Module

This guide explains how to migrate the `RouteSelectionScreenOptimized.tsx` file to the new `Maps` module structure and integrate the newly extracted components.

## Overview

The `RouteSelectionScreenOptimized.tsx` file has been modularized into:
- **Utility files** (`Maps/utils/`): Fuel calculations and maintenance operations
- **Component files** (`Maps/components/`): FreeDrive, WithDestination, Reporting, PredictiveAnalytics, ToggleButtons, MapMarkers
- **Main file** (`Maps/RouteSelectionScreenOptimized.tsx`): Refactored to use the new components

## Step 1: Copy File to Maps Directory

### Option A: Using PowerShell (Recommended)
```powershell
Copy-Item "Screens\RouteSelectionScreenOptimized.tsx" "Maps\RouteSelectionScreenOptimized.tsx"
```

### Option B: Using File Explorer
1. Navigate to `Screens/RouteSelectionScreenOptimized.tsx`
2. Copy the file
3. Paste it into `Maps/RouteSelectionScreenOptimized.tsx`

## Step 2: Update Import Paths

All imports from `../` need to be changed to `../../` since the file is now one level deeper.

### Import Path Updates

**Before:**
```typescript
import { useUser } from '../AuthContext/UserContextImproved';
import { useAppData } from '../hooks/useAppData';
import { OptimizedMapComponent } from '../components/OptimizedMapComponent';
import type { Motor } from '../types';
```

**After:**
```typescript
import { useUser } from '../../AuthContext/UserContextImproved';
import { useAppData } from '../../hooks/useAppData';
import { OptimizedMapComponent } from '../../components/OptimizedMapComponent';
import type { Motor } from '../../types';
```

### Complete List of Import Paths to Update

1. **AuthContext:**
   - `'../AuthContext/UserContextImproved'` → `'../../AuthContext/UserContextImproved'`

2. **Hooks:**
   - `'../hooks/useAppData'` → `'../../hooks/useAppData'`
   - `'../hooks/useTracking'` → `'../../hooks/useTracking'`
   - `'../hooks/useTripCache'` → `'../../hooks/useTripCache'`
   - `'../hooks/useMapState-mapscreentry'` → `'../../hooks/useMapState-mapscreentry'`
   - `'../hooks/useRouteHandling-mapscreentry'` → `'../../hooks/useRouteHandling-mapscreentry'`
   - `'../hooks/useMotorManagement-mapscreentry'` → `'../../hooks/useMotorManagement-mapscreentry'`

3. **Utils:**
   - `'../utils/location'` → `'../../utils/location'`
   - `'../utils/api'` → `'../../utils/api'`
   - `'../utils/asyncDataManager'` → `'../../utils/asyncDataManager'`
   - `'../utils/asyncOperations'` → `'../../utils/asyncOperations'`
   - `'../utils/performanceOptimizer'` → `'../../utils/performanceOptimizer'`
   - `'../utils/map-selection-handlers-mapscreentry'` → `'../../utils/map-selection-handlers-mapscreentry'`
   - `'../utils/map-utils-mapscreentry'` → `'../../utils/map-utils-mapscreentry'`
   - `'../utils/asyncMapOperations'` → `'../../utils/asyncMapOperations'`
   - `'../utils/useDestinationFlow'` → `'../../utils/useDestinationFlow'`
   - `'../utils/sharedDataManager'` → `'../../utils/sharedDataManager'`

4. **Services:**
   - `'../services/fuelService'` → `'../../services/fuelService'`
   - `'../services/calculationService'` → `'../../services/calculationService'`
   - `'../services/mapService'` → `'../../services/mapService'`
   - `'../services/routeService'` → `'../../services/routeService'`
   - `'../services/routeSelectionDataProcessor'` → `'../../services/routeSelectionDataProcessor'`

5. **Components:**
   - `'../components/OptimizedMapComponent'` → `'../../components/OptimizedMapComponent'`
   - `'../components/TrackingStats'` → `'../../components/TrackingStats'`
   - `'../components/MotorSelector'` → `'../../components/MotorSelector'`
   - `'../components/TrafficReportModal'` → `'../../components/TrafficReportModal'`
   - `'../components/TripSummaryModal'` → `'../../components/TripSummaryModal'`
   - `'../components/Speedometer'` → `'../../components/Speedometer'`
   - `'../components/TripRecoveryModal-mapscreentry'` → `'../../components/TripRecoveryModal-mapscreentry'`
   - `'../components/SearchModal-mapscreentry'` → `'../../components/SearchModal-mapscreentry'`
   - `'../components/RouteSelectionModal-mapscreentry'` → `'../../components/RouteSelectionModal-mapscreentry'`
   - `'../components/FlowStateIndicator-mapscreentry'` → `'../../components/FlowStateIndicator-mapscreentry'`
   - `'../components/NavigationControls-mapscreentry'` → `'../../components/NavigationControls-mapscreentry'`
   - `'../components/MaintenanceModal-mapscreentry'` → `'../../components/MaintenanceModal-mapscreentry'`
   - `'../components/TripDetailsModal-mapscreentry'` → `'../../components/TripDetailsModal-mapscreentry'`
   - `'../components/MapSelectionOverlay'` → `'../../components/MapSelectionOverlay'`
   - `'../components/MapFilterModal'` → `'../../components/MapFilterModal'`

6. **Types:**
   - `'../types'` → `'../../types'`

## Step 3: Add New Component Imports

Add these imports after the existing component imports:

```typescript
// Import new Maps module components
import { FreeDrive } from './components/FreeDrive';
import { WithDestination } from './components/WithDestination';
import { Reporting } from './components/Reporting';
import { PredictiveAnalytics } from './components/PredictiveAnalytics';
import { ToggleButtons } from './components/ToggleButtons';
import { MapMarkers } from './components/MapMarkers';

// Import new Maps module utilities
import {
  calculateRemainingFuelPercent,
  calculateFuelAfterDistance,
  calculateFuelAfterRefuel,
  calculateDistancePossible,
  isLowFuel,
  isCriticalFuel,
  canReachDestination,
  validateFuelLevel as validateFuelLevelUtil,
  updateFuelLevelInBackend,
} from './utils/fuelCalculation';
import {
  handleRefuel,
  handleOilChange,
  handleTuneUp,
  saveMaintenanceRecord,
  validateMaintenanceForm,
  calculateRefuelQuantity,
} from './utils/maintenanceUtils';
```

## Step 4: Replace Fuel Calculation Logic

### Replace `calculateNewFuelLevel` calls

**Before:**
```typescript
const newFuelLevel = await calculateNewFuelLevel(selectedMotor, incrementalDistance);
```

**After:**
```typescript
const newFuelLevel = await calculateFuelAfterDistance(selectedMotor, incrementalDistance);
```

### Replace `calculateFuelLevelAfterRefuel` calls

**Before:**
```typescript
const newFuelLevel = await calculateFuelLevelAfterRefuel(selectedMotor, quantity, cost);
```

**After:**
```typescript
const newFuelLevel = await calculateFuelAfterRefuel(selectedMotor, quantity, cost);
```

### Replace fuel validation

**Before:**
```typescript
if (!validateFuelLevel(newFuelLevel, selectedMotor._id)) {
  return;
}
```

**After:**
```typescript
if (!validateFuelLevelUtil(newFuelLevel)) {
  return;
}
```

## Step 5: Integrate PredictiveAnalytics Component

Add the `PredictiveAnalytics` component to your render:

```typescript
<PredictiveAnalytics
  selectedMotor={selectedMotor}
  currentLocation={mapState.currentLocation}
  destination={mapState.destination}
  selectedRoute={selectedRoute}
  distanceTraveled={distanceTraveled}
  onLowFuelWarning={(fuelLevel) => {
    console.log('Low fuel warning:', fuelLevel);
  }}
  onCriticalFuelWarning={(fuelLevel) => {
    console.log('Critical fuel warning:', fuelLevel);
  }}
  onDestinationUnreachable={(distancePossible, distanceRequired) => {
    console.log('Cannot reach destination:', { distancePossible, distanceRequired });
  }}
/>
```

## Step 6: Integrate FreeDrive Component

Replace free drive tracking logic with the component:

```typescript
<FreeDrive
  selectedMotor={selectedMotor}
  currentLocation={mapState.currentLocation}
  isTracking={isTracking && !mapState.destination}
  rideStats={rideStats}
  onStartTracking={handleTrackingToggle}
  onStopTracking={handleTrackingToggle}
  onStatsUpdate={handleStatsUpdate}
  onFuelUpdate={(newFuelLevel) => {
    setSelectedMotor(prev => prev ? { ...prev, currentFuelLevel: newFuelLevel } : null);
  }}
  onMaintenanceAction={handleMaintenanceAction}
/>
```

## Step 7: Integrate WithDestination Component

Replace destination navigation logic with the component:

```typescript
<WithDestination
  selectedMotor={selectedMotor}
  currentLocation={mapState.currentLocation}
  destination={mapState.destination}
  selectedRoute={selectedRoute}
  alternativeRoutes={alternativeRoutes}
  isNavigating={navigationState.isNavigating}
  distanceRemaining={navigationState.distanceRemaining}
  timeElapsed={navigationState.timeElapsed}
  currentEta={navigationState.currentEta}
  currentSpeed={navigationState.currentSpeed}
  onSelectMotor={handleMotorSelect}
  onSelectDestination={setDestination}
  onSelectRoute={handleRouteSelect}
  onStartNavigation={startDestinationTracking}
  onStopNavigation={() => {
    setIsNavigating(false);
    setNavigationStartTime(null);
  }}
  onReroute={fetchRoutes}
  onMaintenanceAction={handleMaintenanceAction}
  motorList={effectiveMotors}
/>
```

## Step 8: Integrate Reporting Component

Replace reporting logic with the component:

```typescript
<Reporting
  currentLocation={mapState.currentLocation}
  reports={filteredReports}
  gasStations={filteredGasStations}
  showReports={showReports}
  showGasStations={showGasStations}
  onReportSubmit={(report) => {
    // Handle report submission
    console.log('Report submitted:', report);
  }}
  onReportVote={(reportId, vote) => {
    // Handle report voting
    console.log('Report voted:', { reportId, vote });
  }}
  onGasStationSelect={(station) => {
    // Handle gas station selection
    console.log('Gas station selected:', station);
  }}
  user={user}
/>
```

## Step 9: Update Maintenance Logic

Replace maintenance action handlers with utility functions:

**Before:**
```typescript
const handleMaintenanceFormSave = async (formData) => {
  // Complex maintenance saving logic
};
```

**After:**
```typescript
const handleMaintenanceFormSave = async (formData) => {
  if (!selectedMotor || !mapState.currentLocation || !user) return;
  
  const validation = validateMaintenanceForm(
    formData.type,
    formData.cost,
    formData.quantity,
    formData.costPerLiter
  );
  
  if (!validation.isValid) {
    Alert.alert('Validation Error', validation.error);
    return;
  }
  
  try {
    if (formData.type === 'refuel') {
      const quantity = calculateRefuelQuantity(
        parseFloat(formData.cost),
        parseFloat(formData.costPerLiter)
      );
      const newFuelLevel = await handleRefuel(
        selectedMotor,
        mapState.currentLocation,
        parseFloat(formData.cost),
        parseFloat(formData.costPerLiter),
        quantity,
        user._id,
        user.token,
        formData.notes
      );
      setSelectedMotor(prev => prev ? { ...prev, currentFuelLevel: newFuelLevel } : null);
    } else if (formData.type === 'oil_change') {
      await handleOilChange(
        selectedMotor,
        mapState.currentLocation,
        parseFloat(formData.cost),
        parseFloat(formData.quantity),
        user._id,
        user.token,
        formData.notes
      );
    } else if (formData.type === 'tune_up') {
      await handleTuneUp(
        selectedMotor,
        mapState.currentLocation,
        parseFloat(formData.cost),
        user._id,
        user.token,
        formData.notes
      );
    }
    
    setMaintenanceFormVisible(false);
    Toast.show({
      type: 'success',
      text1: 'Maintenance Record Saved',
    });
  } catch (error) {
    console.error('Maintenance save error:', error);
    Toast.show({
      type: 'error',
      text1: 'Save Failed',
      text2: error.message,
    });
  }
};
```

## Step 10: Update Navigation Screen Import

Update any files that import `RouteSelectionScreenOptimized`:

**Before:**
```typescript
import RouteSelectionScreen from '../Screens/RouteSelectionScreenOptimized';
```

**After:**
```typescript
import RouteSelectionScreen from '../Maps/RouteSelectionScreenOptimized';
```

## Step 11: Test the Migration

1. **Test Free Drive Mode:**
   - Select a motor
   - Start free drive tracking
   - Verify fuel calculations work
   - Test maintenance actions

2. **Test Destination Navigation:**
   - Select a destination
   - Verify route calculation
   - Test navigation flow
   - Verify fuel warnings

3. **Test Reporting:**
   - Submit a traffic report
   - Test gas station markers
   - Test report voting

4. **Test Predictive Analytics:**
   - Verify low fuel warnings
   - Test destination unreachable alerts
   - Test maintenance reminders

## Troubleshooting

### Import Errors
- Verify all import paths are updated from `../` to `../../`
- Check that all new component files exist in `Maps/components/`
- Check that all utility files exist in `Maps/utils/`

### Component Not Rendering
- Verify component props are correctly passed
- Check console for any errors
- Ensure all required dependencies are imported

### Fuel Calculation Issues
- Verify fuel utilities are imported correctly
- Check that motor data includes required fields (fuelTank, fuelEfficiency)
- Verify API endpoints are accessible

### Maintenance Actions Not Saving
- Verify user authentication token is available
- Check API endpoint configuration
- Verify form validation is working correctly

## Next Steps

After completing the migration:

1. Remove old fuel calculation logic from the main file
2. Remove old maintenance handling logic
3. Clean up unused imports
4. Add TypeScript types where needed
5. Add unit tests for new components
6. Update documentation

## Additional Resources

- See `Maps/README.md` for component documentation
- See component files in `Maps/components/` for implementation details
- See utility files in `Maps/utils/` for function documentation

