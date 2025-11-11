# Maps Module Structure

This folder contains the modularized RouteSelectionScreen and its related components.

## Structure

```
Maps/
├── RouteSelectionScreenOptimized.tsx  # Main screen component
├── components/
│   ├── FreeDrive.tsx                  # Free drive mode component
│   ├── WithDestination.tsx            # Destination-based navigation component
│   ├── Reporting.tsx                   # Traffic reports and gas stations component
│   ├── PredictiveAnalytics.tsx        # Fuel warnings and maintenance reminders
│   ├── ToggleButtons.tsx              # Mode switching component
│   └── MapMarkers.tsx                 # Map marker rendering component
└── utils/
    ├── fuelCalculation.ts             # Fuel calculation utilities
    └── maintenanceUtils.ts             # Maintenance operation utilities
```

## Components

### FreeDrive Component
- Handles free drive mode (Strava-like tracking without destination)
- Automatically selects last used motor (or first motor for new users)
- Tracks: Distance, Time, Fuel level
- Supports maintenance actions: Refuel, Oil change, Tune-up

### WithDestination Component
- Handles destination-based navigation (Google Maps-like)
- Modal for motor and destination selection
- Route filtering by traffic, distance, etc.
- Turn-by-turn instructions
- Navigation view with map tilt

### Reporting Component
- Traffic incident reporting
- Gas station markers and information
- Report voting (upvote/downvote)
- Admin verification

### PredictiveAnalytics Component
- Low fuel warnings
- "Won't reach destination" alerts
- Maintenance reminders

### ToggleButtons Component
- Mode switching between free drive and destination navigation

### MapMarkers Component
- Marker rendering for reports, gas stations, current location, destination

## Utilities

### fuelCalculation.ts
- `calculateRemainingFuelPercent()` - Calculate remaining fuel percentage
- `calculateFuelAfterDistance()` - Calculate fuel after traveling distance
- `calculateFuelAfterRefuel()` - Calculate fuel after refueling
- `calculateDistancePossible()` - Calculate distance possible with current fuel
- `isLowFuel()` - Check if fuel is low
- `isCriticalFuel()` - Check if fuel is critically low
- `canReachDestination()` - Check if destination is reachable

### maintenanceUtils.ts
- `handleRefuel()` - Handle refuel action
- `handleOilChange()` - Handle oil change action
- `handleTuneUp()` - Handle tune-up action
- `saveMaintenanceRecord()` - Save maintenance record to backend
- `validateMaintenanceForm()` - Validate maintenance form data

## Usage

Import the main screen:
```typescript
import RouteSelectionScreen from './Maps/RouteSelectionScreenOptimized';
```

Import individual components:
```typescript
import { FreeDrive } from './Maps/components/FreeDrive';
import { WithDestination } from './Maps/components/WithDestination';
import { PredictiveAnalytics } from './Maps/components/PredictiveAnalytics';
```

Import utilities:
```typescript
import { calculateRemainingFuelPercent, canReachDestination } from './Maps/utils/fuelCalculation';
import { handleRefuel, handleOilChange } from './Maps/utils/maintenanceUtils';
```

