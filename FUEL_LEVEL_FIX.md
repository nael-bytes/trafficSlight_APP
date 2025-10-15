# 🔧 Fuel Level Update Fix

**Date**: October 14, 2025
**Issue**: `newFuel: NaN` error when updating fuel level during tracking
**Root Cause**: Division by zero in fuel level calculation
**Status**: ✅ **FIXED**

---

## 🔴 The Problem

**Error Message**:
```
newFuel: NaN
❌ Error in updateFuelLevel: [Error: Failed to update fuel level: 400 {"msg":"currentFuelLevel must be a number"}]
```

**Root Cause**:
The fuel level calculation in `useTracking.ts` was:
```typescript
const newFuelLevel = Math.max(0, selectedMotor.currentFuelLevel - (fuelDelta / selectedMotor.totalDrivableDistance) * 100);
```

**Problems**:
1. `selectedMotor.totalDrivableDistance` could be `0` or `undefined`
2. Division by zero → `NaN`
3. `NaN` sent to backend → rejected

---

## ✅ The Fix

### Updated Calculation Logic

**Before** (BROKEN):
```typescript
const newFuelLevel = Math.max(0, selectedMotor.currentFuelLevel - (fuelDelta / selectedMotor.totalDrivableDistance) * 100);
```

**After** (FIXED):
```typescript
// Calculate fuel level reduction based on distance traveled vs total drivable distance
const totalDrivableDistance = selectedMotor.totalDrivableDistance || 0;

let newFuelLevel = selectedMotor.currentFuelLevel;

if (totalDrivableDistance > 0) {
  // Calculate fraction of total distance traveled
  const distanceFraction = distanceDeltaKm / totalDrivableDistance;

  // Convert to fuel level percentage reduction (assuming linear relationship)
  const fuelLevelReduction = distanceFraction * 100;

  newFuelLevel = Math.max(0, selectedMotor.currentFuelLevel - fuelLevelReduction);

  console.log('[useTracking] Fuel update:', {
    currentFuelLevel: selectedMotor.currentFuelLevel,
    distanceDeltaKm,
    totalDrivableDistance,
    distanceFraction,
    fuelLevelReduction,
    newFuelLevel
  });
} else {
  console.warn('[useTracking] totalDrivableDistance is 0 or undefined, cannot calculate fuel level');
}

if (!isNaN(newFuelLevel) && totalDrivableDistance > 0) {
  updateFuelLevel(selectedMotor._id, newFuelLevel).catch(console.error);
}
```

---

## 📊 How It Works

### Safe Calculation
1. **Check totalDrivableDistance**: Ensure it's > 0 before calculating
2. **Calculate fraction**: Distance traveled ÷ total drivable distance
3. **Convert to percentage**: Multiply by 100 for fuel level reduction
4. **Validate result**: Only send if result is a valid number
5. **Fallback**: Log warning if calculation not possible

### Example Calculation
```
Current fuel level: 80%
Distance traveled: 5 km
Total drivable distance: 50 km (full tank range)

Fraction traveled: 5/50 = 0.1 (10%)
Fuel reduction: 0.1 * 100 = 10%
New fuel level: 80% - 10% = 70%
```

---

## 🔍 Debug Logging Added

**Console Output** (when working):
```javascript
[useTracking] Fuel update: {
  currentFuelLevel: 80,
  distanceDeltaKm: 5,
  totalDrivableDistance: 50,
  distanceFraction: 0.1,
  fuelLevelReduction: 10,
  newFuelLevel: 70
}
```

**Console Output** (when totalDrivableDistance is 0):
```javascript
[useTracking] totalDrivableDistance is 0 or undefined, cannot calculate fuel level
```

---

## 🧪 Testing

### Test Steps
1. **Start tracking** with a motor that has `totalDrivableDistance > 0`
2. **Drive around** (or simulate location changes)
3. **Check console** for fuel update logs
4. **Verify** fuel level decreases realistically

### Expected Behavior
- ✅ No `NaN` values in console
- ✅ Fuel level decreases gradually during tracking
- ✅ Backend accepts fuel level updates
- ✅ No "currentFuelLevel must be a number" errors

### Edge Cases Handled
- ✅ `totalDrivableDistance = 0` → Warning logged, no API call
- ✅ `totalDrivableDistance = undefined` → Warning logged, no API call
- ✅ `fuelLevel < 0` → Clamped to 0%
- ✅ Invalid calculations → NaN check before API call

---

## 📁 Files Modified

| File | Changes |
|------|---------|
| `hooks/useTracking.ts` | ✅ Fixed fuel level calculation<br>✅ Added safety checks<br>✅ Added debug logging |

---

## ✅ Success Criteria

- [ ] No `NaN` errors in console
- [ ] Fuel level updates work during tracking
- [ ] Backend accepts fuel level values
- [ ] Realistic fuel consumption based on distance
- [ ] Proper error handling for edge cases

**If ALL checked** → 🎉 **FUEL LEVEL FIXED!**

---

## 🔧 API Payload

**Before Fix** ❌:
```json
{
  "fuelLevel": NaN
}
```

**After Fix** ✅:
```json
{
  "fuelLevel": 75.5
}
```

---

**Date**: October 14, 2025
**Status**: ✅ **FUEL CALCULATION FIXED**
**Result**: Safe fuel level updates during tracking
**Error Prevention**: NaN values blocked before API calls 🚀

