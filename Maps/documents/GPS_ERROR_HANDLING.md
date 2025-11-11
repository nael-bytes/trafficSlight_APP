# GPS Error Handling Enhancement

## Overview
Enhanced GPS error handling has been added to provide users with clear, actionable error messages when location issues occur during fuel check and tracking start.

## Features Added

### 1. GPS Error Type Detection
- **Location:** `Maps/utils/locationUtils.ts`
- **Function:** `getGPSErrorInfo()`
- **Purpose:** Analyzes GPS errors and categorizes them into specific types:
  - `DISABLED` - GPS is disabled on device
  - `PERMISSION_DENIED` - Location permission not granted
  - `TIMEOUT` - GPS signal timed out
  - `WEAK_SIGNAL` - GPS signal is weak or acquiring
  - `INVALID_DATA` - Invalid GPS data received
  - `HARDWARE_UNAVAILABLE` - GPS hardware not available
  - `UNKNOWN` - Unknown error

### 2. Enhanced Error Messages
All GPS errors now show:
- **Clear error description** - What the problem is
- **Specific guidance** - How to fix it
- **Actionable steps** - What the user needs to do

### 3. GPS Hardware Check
- Checks if GPS hardware is available on the device
- Falls back to network location if GPS hardware unavailable
- Shows warning if GPS hardware is not available

### 4. Error Handling Integration

#### Fuel Check Flow
- **Location:** `Maps/utils/fuelCheckUtils.ts`
- When starting tracking after fuel check fails due to location:
  - Detects location-related errors
  - Shows detailed Alert dialog with specific GPS error
  - Provides guidance on how to fix the issue

#### Tracking Start Flow
- **Location:** `Maps/utils/trackingUtils.ts`
- When starting free drive or destination tracking:
  - Checks if location is available
  - If location fails, shows detailed GPS error
  - Prevents tracking from starting without location
  - Provides specific guidance based on error type

#### Location Utility
- **Location:** `Maps/utils/locationUtils.ts`
- Enhanced error handling in `getCurrentLocation()`:
  - Categorizes GPS errors by type
  - Provides specific error messages
  - Shows detailed Alert dialogs with guidance
  - Includes retry button for retryable errors

## Error Messages by Type

### GPS Disabled
```
GPS Location Error
GPS is disabled on your device. Please enable location services in your device settings.

To fix this:
• Open your device Settings
• Go to Location/GPS settings
• Enable Location Services
• Make sure GPS is turned on
• Then return to the app and try again
```

### Permission Denied
```
GPS Location Error
Location permission not granted. Please grant location permission in app settings.

To fix this:
• Open your device Settings
• Go to App Settings
• Find this app and select it
• Enable Location permission
• Then return to the app and try again
```

### Timeout / Weak Signal
```
GPS Location Error
GPS signal timed out. You may be in an area with poor GPS signal. Please move to an open area.

Tips to improve GPS signal:
• Move to an open area (away from buildings)
• Go outside or near a window
• Wait 10-30 seconds for GPS to acquire signal
• Make sure you're not in a basement or underground
• Try again in a few moments
```

### Invalid Data
```
GPS Location Error
Invalid GPS data received. This may indicate GPS signal is too weak. Please try again or move to an area with better signal.

This usually means:
• GPS signal is too weak
• Location services are having issues
• Please move to an area with better signal
• Wait a moment and try again
```

## Integration Points

### 1. Fuel Check → Tracking Start
- When user completes fuel check and tries to start tracking
- If location fails, shows detailed GPS error
- Prevents tracking from starting without location

### 2. Free Drive Tracking
- When user tries to start free drive tracking
- Checks location before starting
- Shows GPS error if location unavailable

### 3. Destination Navigation
- When user tries to start destination navigation
- Checks location before starting
- Shows GPS error if location unavailable

### 4. Manual Location Request
- When user manually requests location (via button)
- Shows detailed GPS error if location fails
- Provides guidance on how to fix

## Benefits

1. **Clear Communication** - Users know exactly what the problem is
2. **Actionable Guidance** - Users know how to fix the issue
3. **Better UX** - No more generic "Failed to get location" messages
4. **Prevents Confusion** - Specific error messages reduce user frustration
5. **Debugging** - Detailed error logging helps identify issues

## Usage

The GPS error handler is automatically used in:
- `Maps/utils/locationUtils.ts` - Location fetching
- `Maps/utils/trackingUtils.ts` - Tracking start
- `Maps/utils/fuelCheckUtils.ts` - Fuel check → tracking flow

All location-related errors are automatically categorized and shown with appropriate guidance.

## Error Flow

```
User Action → Location Request → GPS Check → Error?
                                           ↓
                                    Categorize Error
                                           ↓
                                    Show Detailed Alert
                                           ↓
                                    Provide Guidance
```

## Testing Scenarios

1. **GPS Disabled** - Turn off GPS, try to start tracking
2. **Permission Denied** - Deny location permission, try to start tracking
3. **Poor Signal** - Test indoors/basement, try to start tracking
4. **Timeout** - Wait for GPS timeout, verify error message
5. **Invalid Data** - Simulate invalid GPS data, verify error handling

## Future Enhancements

- Add "Open Settings" button that deep links to location settings
- Add retry mechanism with exponential backoff
- Add GPS signal strength indicator
- Add location accuracy display
- Add GPS status indicator in UI

