# Migration script for RouteSelectionScreenOptimized.tsx
# This script copies the file and updates all import paths

$sourceFile = "Screens\RouteSelectionScreenOptimized.tsx"
$destFile = "Maps\RouteSelectionScreenOptimized.tsx"

# Check if source file exists
if (-not (Test-Path $sourceFile)) {
    Write-Host "Error: Source file not found at $sourceFile"
    exit 1
}

Write-Host "Copying file from $sourceFile to $destFile..."
Copy-Item $sourceFile $destFile -Force

Write-Host "Reading file..."
$content = Get-Content $destFile -Raw

Write-Host "Updating import paths..."

# Replace all '../' with '../../' in import statements (but not in './' imports)
$content = $content -replace "from ['`"]\.\.\/([^'`"]+)['`"]", "from '../../$1'"

# Add new component imports after existing component imports
$newImports = @"

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

"@

# Find the position after MapSelectionOverlay import
$insertPattern = "import MapSelectionOverlay from"
$insertPos = $content.IndexOf($insertPattern)

if ($insertPos -ne -1) {
    # Find the end of that line
    $lineEnd = $content.IndexOf("`n", $insertPos)
    if ($lineEnd -eq -1) { $lineEnd = $content.Length }
    
    # Insert new imports after the line
    $content = $content.Insert($lineEnd + 1, $newImports)
    Write-Host "Added new component imports"
} else {
    Write-Host "Warning: Could not find MapSelectionOverlay import. Please add new imports manually."
}

Write-Host "Saving file..."
Set-Content -Path $destFile -Value $content -NoNewline

Write-Host "Done! File migrated successfully."
Write-Host "Next steps:"
Write-Host "1. Review the file for any remaining '../' imports that need updating"
Write-Host "2. Integrate the new components as described in MIGRATION_GUIDE.md"
Write-Host "3. Test the application to ensure everything works correctly"

