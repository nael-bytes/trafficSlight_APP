# Next Steps for Maps Module

## ✅ Completed Steps

### 1. File Migration
- ✅ File copied from `Screens/RouteSelectionScreenOptimized.tsx` to `Maps/RouteSelectionScreenOptimized.tsx`
- ✅ All import paths updated from `../` to `../../`

### 2. Component Extraction
- ✅ **FreeDrive.tsx** - Free drive mode functionality
- ✅ **WithDestination.tsx** - Destination-based navigation
- ✅ **Reporting.tsx** - Traffic reports and gas stations
- ✅ **PredictiveAnalytics.tsx** - Fuel warnings and maintenance reminders
- ✅ **ToggleButtons.tsx** - Mode switching UI
- ✅ **MapMarkers.tsx** - Map marker rendering

### 3. Utility Extraction
- ✅ **fuelCalculation.ts** - Fuel calculation functions
- ✅ **maintenanceUtils.ts** - Maintenance operations
- ✅ **tripUtils.ts** - Trip summary operations
- ✅ **fuelCheckUtils.ts** - Fuel check operations
- ✅ **reportUtils.ts** - Report checking operations
- ✅ **locationUtils.ts** - Location handling operations (NEW)
- ✅ **trackingUtils.ts** - Tracking logic operations (NEW)

### 4. Integration
- ✅ Updated main file to use new utilities
- ✅ Replaced `createTripDataForModal` with `createTripDataUtil`
- ✅ Replaced `handleTripSave` logic with `saveTripToBackend`
- ✅ Replaced `handleTripCancel` logic with `cancelTripUtil`
- ✅ Replaced `handleFuelConfirmation` with `handleFuelConfirmationUtil`
- ✅ Replaced `handleLowFuelConfirmation` with `handleLowFuelConfirmationUtil`
- ✅ Replaced `handleFuelUpdate` with `handleFuelUpdateUtil`
- ✅ Replaced `checkReportUpdates` with `checkReportUpdatesUtil`
- ✅ Replaced `handleGetCurrentLocation` with `getCurrentLocationUtil` (NEW)
- ✅ Replaced `handleTrackingToggle` with `startFreeDriveTracking` and `stopTrackingUtil` (NEW)
- ✅ Replaced `startDestinationTracking` with `startDestinationTrackingUtil` (NEW)

## 🔄 Remaining Tasks

### High Priority

#### ✅ 1. Extract Location Handling (`handleGetCurrentLocation`) - COMPLETED
**Location:** `Maps/utils/locationUtils.ts`
**Status:** ✅ Extracted and integrated

#### ✅ 2. Extract Tracking Logic (`handleTrackingToggle`, `startDestinationTracking`) - COMPLETED
**Location:** `Maps/utils/trackingUtils.ts`
**Status:** ✅ Extracted and integrated

### Medium Priority

#### 3. Further Component Integration
- **FreeDrive Component** - Currently skeleton, needs full implementation
- **WithDestination Component** - Currently skeleton, needs full implementation
- **Reporting Component** - Currently skeleton, needs full implementation
- **ToggleButtons Component** - Currently skeleton, needs full implementation
- **MapMarkers Component** - Currently skeleton, needs full implementation

#### ✅ 4. Optimize Imports - COMPLETED
- ✅ Reviewed and removed unused imports
- ✅ Consolidated duplicate imports
- ✅ Ensured all paths are correct
- ✅ Removed 15+ unused imports
- ✅ Added comments for removed imports for clarity

### Low Priority

#### 5. Documentation
- Update component documentation
- Add JSDoc comments to utilities
- Create usage examples

#### 6. Testing
- Test all extracted utilities
- Test component integration
- Test fuel calculations
- Test maintenance operations
- Test trip summary operations
- Test fuel check operations
- Test report checking

## 📋 Step-by-Step Guide

### ✅ Step 1: Extract Location Handling - COMPLETED

1. ✅ Created `Maps/utils/locationUtils.ts`
2. ✅ Moved `handleGetCurrentLocation` logic to utility
3. ✅ Updated main file to use new utility
4. ⏳ Test location functionality (pending)

### ✅ Step 2: Extract Tracking Logic - COMPLETED

1. ✅ Created `Maps/utils/trackingUtils.ts`
2. ✅ Moved `handleTrackingToggle` and `startDestinationTracking` to utility
3. ✅ Updated main file to use new utility
4. ⏳ Test tracking functionality (pending)

### Step 3: Integrate Components

1. Replace inline UI with FreeDrive component
2. Replace inline UI with WithDestination component
3. Replace inline UI with Reporting component
4. Replace inline UI with ToggleButtons component
5. Replace inline markers with MapMarkers component

### Step 4: Final Testing

1. Test all functionality
2. Fix any bugs
3. Optimize performance
4. Update documentation

## 🎯 Expected Outcome

After completing all steps:
- Main file should be ~2000-3000 lines (down from ~4900)
- All large functions extracted to utilities
- All UI components extracted to separate files
- Clean, maintainable, modular structure
- Easy to test and extend

## 📝 Notes

- External components (TripSummaryModal, OptimizedMapComponent, etc.) should remain where they are as they're shared across the app
- Small helper functions can stay in the main file if they're simple
- Focus on extracting large, reusable functions first

## 🚀 Current Status

**Migration Status: ~90% Complete**

- ✅ Core utilities extracted
- ✅ Trip summary utilities extracted
- ✅ Fuel check utilities extracted
- ✅ Report checking utilities extracted
- ✅ Location handling extracted (NEW)
- ✅ Tracking logic extracted (NEW)
- ⏳ Component integration pending

