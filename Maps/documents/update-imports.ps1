# PowerShell script to update import paths in RouteSelectionScreenOptimized.tsx
# This script changes all '../' imports to '../../' since the file is now one level deeper

$filePath = "Maps\RouteSelectionScreenOptimized.tsx"

if (-not (Test-Path $filePath)) {
    Write-Host "Error: File not found at $filePath"
    Write-Host "Please copy Screens\RouteSelectionScreenOptimized.tsx to Maps\RouteSelectionScreenOptimized.tsx first"
    exit 1
}

Write-Host "Reading file..."
$content = Get-Content $filePath -Raw

Write-Host "Updating import paths..."

# Replace all '../' with '../../' in import statements
$content = $content -replace "from ['`"]\.\.\/([^'`"]+)['`"]", "from '../../$1'"

# Replace '../' with '../../' in type imports
$content = $content -replace "from ['`"]\.\.\/(types)['`"]", "from '../../$1'"

Write-Host "Adding new component imports..."

# Find the position after existing component imports
$componentsImportEnd = $content.IndexOf("import MapSelectionOverlay from")

if ($componentsImportEnd -eq -1) {
    Write-Host "Warning: Could not find component imports section"
    Write-Host "You may need to add new imports manually"
} else {
    # Find the end of the import line
    $insertPos = $content.IndexOf("`n", $componentsImportEnd)
    
    # New imports to add
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
    
    # Insert new imports
    $content = $content.Insert($insertPos + 1, $newImports)
}

Write-Host "Saving file..."
Set-Content -Path $filePath -Value $content -NoNewline

Write-Host "Done! Import paths updated."
Write-Host "Please review the file and make any additional changes as needed."

