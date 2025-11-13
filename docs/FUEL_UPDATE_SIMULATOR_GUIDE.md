# Fuel Update API Simulator Guide

## Overview

The Fuel Update Simulator allows you to test the `/api/trip/update-distance` endpoint integration without actually traveling. This is perfect for debugging on an emulator or when you can't travel.

## Features

- ✅ Simulates GPS location updates
- ✅ Calculates distance traveled based on speed
- ✅ Calls `/api/trip/update-distance` every 5 seconds (as per API)
- ✅ Updates fuel level based on API responses
- ✅ Triggers low fuel warnings when appropriate
- ✅ Shows real-time simulation state
- ✅ Tracks API call statistics

## How to Use

### 1. Access the Simulator

The simulator is only available in **development mode** (`__DEV__ === true`).

1. Open the app in development mode
2. Navigate to the map screen
3. Look for a **purple science icon button** in the top-right corner (when not in destination flow)
4. Tap the button to open the simulator panel

### 2. Configure Simulation

Before starting, configure:

- **Speed (km/h)**: Simulated travel speed (default: 50 km/h)
  - Range: 1-200 km/h
  - Higher speed = more distance traveled = more fuel consumed

- **Duration (seconds)**: How long to run the simulation (default: 60 seconds)
  - Range: 1-600 seconds
  - Longer duration = more API calls = more fuel consumed

### 3. Start Simulation

1. Make sure you have:
   - A motor selected
   - Current location available
   
2. Tap **"Start Simulation"** button

3. The simulator will:
   - Generate GPS location updates every second
   - Calculate distance traveled based on speed
   - Call `/api/trip/update-distance` every 5 seconds
   - Update fuel level from API responses
   - Show real-time statistics

### 4. Monitor Progress

Watch the **Simulation State** section:

- **Distance Traveled**: Total distance in km
- **Last Posted Distance**: Last distance sent to API
- **Current Fuel Level**: Updated from API responses
- **Elapsed Time**: How long simulation has been running
- **API Calls**: Statistics (successful, failed, skipped)

### 5. Stop or Reset

- **Stop**: Pauses the simulation (can resume)
- **Reset**: Stops and resets all state to initial values

## What Gets Tested

### ✅ API Integration
- Correct endpoint: `/api/trip/update-distance`
- Correct parameters: `userMotorId`, `totalDistanceTraveled`, `lastPostedDistance`
- Correct frequency: Every 5 seconds
- Correct condition: Only when `totalDistanceTraveled > lastPostedDistance`

### ✅ Fuel Calculation
- Fuel level updates from API response `newFuelLevel`
- Fuel consumption calculated by backend
- Fuel level decreases as distance increases

### ✅ Low Fuel Warning
- Triggers when fuel ≤ 10% (from API `lowFuelWarning` field)
- Shows warning in simulator
- Updates UI in main app

### ✅ Error Handling
- Retry logic with exponential backoff
- Handles skipped updates (distance < 0.01 km)
- Logs errors for debugging

### ✅ State Management
- `totalDistanceTraveled` tracks cumulative distance
- `lastPostedDistance` tracks last posted distance
- Fuel level updates propagate to main app

## Example Scenarios

### Scenario 1: Quick Test (10 seconds, 30 km/h)
- **Speed**: 30 km/h
- **Duration**: 10 seconds
- **Expected**: ~0.083 km traveled, 1-2 API calls
- **Use Case**: Quick verification that API is working

### Scenario 2: Normal Trip (60 seconds, 50 km/h)
- **Speed**: 50 km/h
- **Duration**: 60 seconds
- **Expected**: ~0.833 km traveled, ~12 API calls
- **Use Case**: Standard testing scenario

### Scenario 3: Long Trip (300 seconds, 60 km/h)
- **Speed**: 60 km/h
- **Duration**: 300 seconds (5 minutes)
- **Expected**: ~5 km traveled, ~60 API calls
- **Use Case**: Testing fuel consumption over longer distance

### Scenario 4: Low Fuel Test (60 seconds, 80 km/h, start with low fuel)
- **Speed**: 80 km/h
- **Duration**: 60 seconds
- **Start Fuel**: Set motor fuel to 15% before starting
- **Expected**: Fuel drops below 10%, triggers low fuel warning
- **Use Case**: Testing low fuel warning functionality

## Troubleshooting

### Simulator Button Not Showing
- ✅ Make sure you're in **development mode** (`__DEV__ === true`)
- ✅ Make sure you're **not in destination flow** (button only shows in free drive mode)
- ✅ Check that the app is running in debug mode

### API Calls Not Happening
- ✅ Check that motor is selected
- ✅ Check that current location is available
- ✅ Check network connection
- ✅ Check console logs for errors

### Fuel Level Not Updating
- ✅ Check API responses in console logs
- ✅ Verify `onFuelUpdate` callback is being called
- ✅ Check that motor state is updating in parent component

### Low Fuel Warning Not Triggering
- ✅ Start with low fuel level (≤ 15%)
- ✅ Run simulation long enough to consume fuel
- ✅ Check API response for `lowFuelWarning: true`
- ✅ Verify fuel level drops below 10%

## Console Logs

The simulator logs detailed information:

```
[FuelUpdateSimulator] 🚀 Starting simulation
[FuelUpdateSimulator] 📡 Calling API
[FuelUpdateSimulator] ✅ API call successful
[FuelUpdateSimulator] ⚠️ LOW FUEL WARNING!
[FuelUpdateSimulator] 🛑 Simulation stopped
```

Watch the console for:
- API call details
- Fuel level updates
- Low fuel warnings
- Errors and retries

## Integration with Main App

The simulator integrates seamlessly:

1. **Fuel Updates**: Updates `selectedMotor.currentFuelLevel` in main app
2. **Low Fuel Warnings**: Shows Toast notifications in main app
3. **UI Updates**: FreeDrive and WithDestination components show updated fuel
4. **State Persistence**: Fuel level persists after simulation ends

## Best Practices

1. **Start Small**: Test with short durations first
2. **Monitor Logs**: Watch console for API responses
3. **Check State**: Verify fuel level updates in main app
4. **Test Edge Cases**: Try different speeds and durations
5. **Test Low Fuel**: Start with low fuel to test warnings

## Notes

- The simulator only works in **development mode**
- It simulates GPS updates but doesn't actually move the map
- API calls are real - make sure backend is running
- Fuel consumption depends on motor's `fuelEfficiency` or `fuelConsumption`
- Distance calculation is approximate (for testing purposes)

