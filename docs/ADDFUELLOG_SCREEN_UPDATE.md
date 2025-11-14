# AddFuelLogScreen Update

## Overview
Updated `AddFuelLogScreen.tsx` to replace "Liters" field with "Total Cost", make odometer reading optional, and use the correct backend API endpoint with `apiRequest` utility.

---

## Changes Made

### 1. **Replaced "Liters" with "Total Cost"**

**Before**:
- Form had: `liters`, `pricePerLiter`, `odometer` (all required)
- Calculated: `totalCost = liters * pricePerLiter`

**After**:
- Form has: `totalCost`, `pricePerLiter`, `odometer` (optional)
- Calculated: `liters = totalCost / pricePerLiter`
- Shows calculated quantity in real-time below price per liter field

**Code Changes**:
```typescript
// Form state
const [formData, setFormData] = useState({
  date: new Date(),
  totalCost: "",        // Changed from liters
  pricePerLiter: "",
  odometer: "",
  notes: "",
});

// Calculate liters from total cost
const totalCost = Number(formData.totalCost);
const pricePerLiter = Number(formData.pricePerLiter);
const liters = totalCost / pricePerLiter;
```

---

### 2. **Made Odometer Optional**

**Before**:
- Odometer was required
- Validation: `if (!formData.odometer || isNaN(Number(formData.odometer)))`

**After**:
- Odometer is optional
- Validation: Only validates if provided
- Only included in payload if provided

**Code Changes**:
```typescript
// Validation - only validate if provided
if (formData.odometer && (isNaN(Number(formData.odometer)) || Number(formData.odometer) < 0))
  return "Enter a valid odometer reading";

// Payload - only include if provided
if (formData.odometer && !isNaN(Number(formData.odometer))) {
  payload.odometer = Number(formData.odometer);
}
```

---

### 3. **Updated API Endpoint**

**Before**:
- Used direct `fetch` call
- Endpoint: `${LOCALHOST_IP}/api/fuel-logs`
- No automatic authentication handling

**After**:
- Uses `apiRequest` utility from `utils/api.ts`
- Endpoint: `/api/fuel-logs` (relative path, handled by apiRequest)
- Automatic authentication via Bearer token
- Consistent error handling

**Code Changes**:
```typescript
// Before
const res = await fetch(`${LOCALHOST_IP}/api/fuel-logs`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(payload),
});

// After
await apiRequest('/api/fuel-logs', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
});
```

---

### 4. **Updated Fuel Level Update**

**Before**:
- Used custom `updateFuelLevel` function with direct fetch
- Endpoint: `${LOCALHOST_IP}/api/user-motors/${motorId}/fuel`

**After**:
- Uses `updateFuelLevelAPI` from `utils/api.ts`
- Endpoint: `/api/user-motors/${motorId}` (PUT method)
- Automatic authentication and error handling
- Fuel level capped at 100%

**Code Changes**:
```typescript
// Before
const updateFuelLevel = async (motorId: string, newFuelLevel: number) => {
  const response = await fetch(`${LOCALHOST_IP}/api/user-motors/${motorId}/fuel`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ currentFuelLevel: newFuelLevel }),
  });
  // ...
};

// After
import { updateFuelLevel as updateFuelLevelAPI } from "../../utils/api";

// In handleSave:
if (selectedMotor.motorcycleId?.fuelTank && liters > 0) {
  const newFuel = Math.min(100, selectedMotor.currentFuelLevel + ((liters / selectedMotor.motorcycleId.fuelTank) * 100));
  await updateFuelLevelAPI(selectedMotor._id, newFuel);
}
```

---

### 5. **UI Improvements**

**Added Real-time Quantity Calculation**:
- Shows calculated quantity (liters) below price per liter field
- Updates automatically as user types
- Format: "Quantity: X.XX L"

**Code**:
```typescript
{formData.totalCost && formData.pricePerLiter && 
 !isNaN(Number(formData.totalCost)) && 
 !isNaN(Number(formData.pricePerLiter)) && 
 Number(formData.pricePerLiter) > 0 && (
  <Text style={styles.calculatedText}>
    Quantity: {(Number(formData.totalCost) / Number(formData.pricePerLiter)).toFixed(2)} L
  </Text>
)}
```

**Updated Labels**:
- "Liters" → "Total Cost (₱)"
- "Price per Liter" → "Price per Liter (₱)"
- "Odometer Reading" → "Odometer Reading (Optional)"

---

## Form Fields

### Required Fields:
1. **Motor Selection** - Required
2. **Date** - Required (defaults to current date)
3. **Total Cost (₱)** - Required, must be > 0
4. **Price per Liter (₱)** - Required, must be > 0

### Optional Fields:
1. **Odometer Reading** - Optional (only validated if provided)
2. **Notes** - Optional

---

## API Payload Structure

**Endpoint**: `POST /api/fuel-logs`

**Request Body**:
```json
{
  "userId": "507f1f77bcf86cd799439012",
  "motorId": "507f1f77bcf86cd799439013",
  "date": "2024-01-15T10:30:00.000Z",
  "liters": 10.0,                    // Calculated: totalCost / pricePerLiter
  "pricePerLiter": 75.50,
  "totalCost": 755.00,
  "odometer": 15000,                  // Optional - only included if provided
  "notes": "Full tank refuel"         // Optional
}
```

**Note**: 
- `liters` is calculated from `totalCost / pricePerLiter`
- `odometer` is only included if user provides a value
- `notes` defaults to empty string if not provided

---

## Fuel Level Calculation

The fuel level is updated based on the calculated liters:

```typescript
const liters = totalCost / pricePerLiter;
const newFuel = Math.min(100, currentFuelLevel + ((liters / fuelTank) * 100));
```

- Fuel level is capped at 100%
- Only updates if fuel tank capacity is available
- Only updates if calculated liters > 0

---

## Validation Rules

1. **Motor Selection**: Must select a motor
2. **Total Cost**: 
   - Required
   - Must be a valid number
   - Must be > 0
3. **Price per Liter**: 
   - Required
   - Must be a valid number
   - Must be > 0
4. **Odometer**: 
   - Optional
   - If provided, must be a valid number ≥ 0

---

## Benefits

1. ✅ **Better UX**: Users enter total cost (what they actually paid) instead of liters
2. ✅ **Real-time Feedback**: Shows calculated quantity as user types
3. ✅ **Flexible**: Odometer is optional (not always available)
4. ✅ **Consistent API**: Uses `apiRequest` utility for authentication and error handling
5. ✅ **Correct Endpoint**: Uses proper API endpoint with authentication

---

## Testing

To verify the changes:

1. **Open Add Fuel Log Screen**
   - Verify "Total Cost" field appears instead of "Liters"
   - Verify "Odometer Reading" is marked as optional

2. **Enter Total Cost and Price per Liter**
   - Verify quantity is calculated and displayed in real-time
   - Verify calculation: Quantity = Total Cost / Price per Liter

3. **Submit with Odometer**
   - Enter all fields including odometer
   - Verify fuel log is saved successfully
   - Verify fuel level is updated

4. **Submit without Odometer**
   - Leave odometer blank
   - Verify fuel log is saved successfully
   - Verify odometer is not included in payload

5. **Check API Call**
   - Verify request uses `/api/fuel-logs` endpoint
   - Verify authentication token is included
   - Verify payload structure matches API requirements

---

## Files Modified

- `Screens/loggedIn/AddFuelLogScreen.tsx`

---

**Last Updated**: January 2024

