#!/bin/bash
# Bash script to update import paths in RouteSelectionScreenOptimized.tsx
# This script changes all '../' imports to '../../' since the file is now one level deeper

FILE_PATH="Maps/RouteSelectionScreenOptimized.tsx"

if [ ! -f "$FILE_PATH" ]; then
    echo "Error: File not found at $FILE_PATH"
    echo "Please copy Screens/RouteSelectionScreenOptimized.tsx to Maps/RouteSelectionScreenOptimized.tsx first"
    exit 1
fi

echo "Reading file..."
CONTENT=$(cat "$FILE_PATH")

echo "Updating import paths..."

# Replace all '../' with '../../' in import statements
CONTENT=$(echo "$CONTENT" | sed "s/from ['\"]\.\.\//from '..\/..\//g")

# Add new component imports after existing component imports
NEW_IMPORTS="
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

"

# Find the position after MapSelectionOverlay import
INSERT_POS=$(grep -n "import MapSelectionOverlay" "$FILE_PATH" | cut -d: -f1 | tail -1)

if [ -z "$INSERT_POS" ]; then
    echo "Warning: Could not find component imports section"
    echo "You may need to add new imports manually"
else
    # Insert new imports after the line
    awk -v line="$INSERT_POS" -v imports="$NEW_IMPORTS" '
        NR == line { print; print imports; next }
        { print }
    ' "$FILE_PATH" > "$FILE_PATH.tmp"
    mv "$FILE_PATH.tmp" "$FILE_PATH"
fi

echo "Saving file..."
echo "$CONTENT" > "$FILE_PATH"

echo "Done! Import paths updated."
echo "Please review the file and make any additional changes as needed."

