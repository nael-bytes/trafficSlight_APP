# FreeDrive Refuel Simulation - Complete Flow Verification

## Test Scenario: FreeDrive → Refuel (₱50, ₱55/L) → Verify Updates

### Simulation Flow:

#### 1. **User Starts FreeDrive Tracking**
   - Component: `FreeDrive.tsx`
   - Action: Press play button
   - Result: `onStartTracking()` → `handleTrackingToggle()` → tracking starts
   - State: `isTracking = true`

#### 2. **User Presses Maintenance Button**
   - Component: `FreeDrive.tsx` (line 221-244)
   - Action: `handleMaintenancePress()` → Shows Alert with options
   - User selects: "Refuel"
   - Flow: `onMaintenanceAction('refuel')` → `RouteSelectionScreenOptimized.handleMaintenanceAction()`

#### 3. **Maintenance Form Opens**
   - Hook: `useMaintenanceForm.ts` (line 271-280)
   - Action: `openMaintenanceForm('refuel')` called
   - Result: `maintenanceFormVisible = true`, form data initialized

#### 4. **User Fills Refuel Form**
   - Input: Cost = ₱50
   - Input: Cost per Liter = ₱55
   - Calculation: Quantity = 50 / 55 = **0.9091 liters** (automatically calculated)
   - Notes: Optional

#### 5. **User Saves Refuel Record**
   - Hook: `useMaintenanceForm.ts` (line 86-269)
   - Function: `handleMaintenanceFormSave()`
   - Validation: ✅ Cost > 0, CostPerLiter > 0
   - Calculation: `calculateRefuelQuantity(50, 55) = 0.9091L`

#### 6. **Refuel API Call**
   - Function: `maintenanceUtils.ts` → `handleRefuel()` (line 143-231)
   - Endpoint: `POST /api/maintenance-records/refuel`
   - Request Body:
     ```json
     {
       "userMotorId": "motor_id",
       "price": 50,
       "costPerLiter": 55,
       "location": {
         "lat": currentLatitude,
         "lng": currentLongitude
       },
       "notes": "optional notes"
     }
     ```
   - API Response:
     ```json
     {
       "quantity": 0.9091,
       "newFuelLevel": 85.5,  // Example: updated fuel level
       "refueledPercent": 5.5,
       "maintenanceRecord": {
         "_id": "record_id",
         "type": "refuel",
         "details": {
           "cost": 50,
           "quantity": 0.9091,
           "costPerLiter": 55
         }
       }
     }
     ```

#### 7. **Fuel Level Update**
   - Location: `useMaintenanceForm.ts` (line 166-180)
   - Action: `handleRefuel()` returns `newFuelLevel`
   - Update: `setSelectedMotor({ ...selectedMotor, currentFuelLevel: newFuelLevel })`
   - ✅ **Fuel level is updated in selectedMotor state**

#### 8. **Add to Trip Maintenance Actions**
   - Location: `useMaintenanceForm.ts` (line 182-190)
   - Action: `setTripMaintenanceActions(prev => [...prev, {...}])`
   - Added Object:
     ```javascript
     {
       type: 'refuel',
       timestamp: Date.now(),
       cost: 50,
       quantity: 0.9091,
       costPerLiter: 55,
       notes: "optional notes"
     }
     ```
   - ✅ **Refuel added to tripMaintenanceActions array**

#### 9. **User Stops Tracking**
   - Component: `FreeDrive.tsx` (line 186-192)
   - Action: Press stop button → `onStopTracking()`
   - Flow: `handleTrackingToggle()` → `stopTrackingUtil()`
   - Passes: `tripMaintenanceActions` array to `stopTrackingUtil`

#### 10. **Trip Summary Modal Shows**
   - Component: `TripSummaryModal.tsx` (line 110-491)
   - Props: `tripMaintenanceActions={tripMaintenanceActions}`
   - Display: Lines 411-453
   - ✅ **Refuel should appear in "Maintenance During Trip" section**
   - Format:
     ```
     REFUEL
     Cost: ₱50.00 • Quantity: 0.91L
     ```

---

## Verification Points:

### ✅ 1. Fuel Level Update
**Location**: `useMaintenanceForm.ts` line 166-180
- ✅ `handleRefuel()` called with cost=50, costPerLiter=55
- ✅ API returns `newFuelLevel`
- ✅ `setSelectedMotor()` updates motor with new fuel level
- ✅ Motor state updated immediately

**Check**: After refuel, `selectedMotor.currentFuelLevel` should reflect new value

### ✅ 2. Maintenance Record in Backend
**Location**: `maintenanceUtils.ts` line 143-231
- ✅ API call to `/api/maintenance-records/refuel`
- ✅ Record created with:
  - type: "refuel"
  - details.cost: 50
  - details.quantity: 0.9091
  - details.costPerLiter: 55
  - location: current GPS coordinates
  - timestamp: current time

**Check**: Record should be in database via API

### ✅ 3. Trip Maintenance Actions Array
**Location**: `useMaintenanceForm.ts` line 182-190
- ✅ Refuel added to `tripMaintenanceActions` array
- ✅ Contains: type, cost, quantity, costPerLiter, notes, timestamp

**Check**: `tripMaintenanceActions.length > 0` after refuel

### ✅ 4. Trip Summary Modal Display
**Location**: `TripSummaryModal.tsx` line 411-453
- ✅ Conditional: `{tripMaintenanceActions.length > 0 && (...)}`
- ✅ Maps through actions and displays each
- ✅ Shows: Type (REFUEL), Cost (₱50.00), Quantity (0.91L)
- ✅ Icon: `local-gas-station` for refuel

**Check**: Modal should show "Maintenance During Trip" section with refuel details

### ✅ 5. Maintenance Details Screen
**Location**: `MaintenanceDetails.tsx` line 409-484
- ✅ Fetches from: `GET /api/maintenance-records/user/:userId`
- ✅ Filters: All maintenance records (including refuel)
- ✅ Display: Shows in list with cost, quantity, timestamp

**Check**: Refuel record should appear in MaintenanceDetails screen

---

## Potential Issues to Check:

### ⚠️ Issue 1: Fuel Level Not Updating
**Possible Causes**:
- API not returning `newFuelLevel` correctly
- `setSelectedMotor` not triggering re-render
- Motor state not syncing with backend

**Fix**: Verify API response includes `newFuelLevel` and `setSelectedMotor` is called

### ⚠️ Issue 2: Maintenance Not in Trip Summary
**Possible Causes**:
- `tripMaintenanceActions` not passed to `stopTrackingUtil`
- Array not preserved when stopping tracking
- Modal not receiving `tripMaintenanceActions` prop

**Fix**: Verify `tripMaintenanceActions` is passed to `TripSummaryModal`

### ⚠️ Issue 3: Maintenance Not in MaintenanceDetails
**Possible Causes**:
- API not returning the record
- Record not saved to backend
- Filter excluding the record

**Fix**: Verify API call succeeds and record is in database

---

## Expected Results:

### After Refuel:
1. ✅ Fuel level updated: `selectedMotor.currentFuelLevel = newFuelLevel`
2. ✅ Maintenance record in backend: `/api/maintenance-records/user/:userId` includes refuel
3. ✅ Trip maintenance actions: `tripMaintenanceActions = [{ type: 'refuel', cost: 50, quantity: 0.9091, ... }]`

### After Stop:
4. ✅ Trip Summary Modal shows: "Maintenance During Trip" section with refuel details
   - Displays: Type (REFUEL), Cost (₱50.00), Quantity (0.91L), Price (₱55.00/L)
5. ✅ Maintenance Details screen shows: Refuel record in list
   - Displays: Type, Cost (₱50.00), Quantity (0.91L), Price per Liter (₱55.00)

---

## Code Flow Summary:

```
FreeDrive (Maintenance Button)
  ↓
handleMaintenanceAction('refuel')
  ↓
openMaintenanceForm('refuel')
  ↓
User fills: cost=50, costPerLiter=55
  ↓
handleMaintenanceFormSave()
  ↓
handleRefuel(motor, location, 50, 55, 0.9091, userId, token)
  ↓
POST /api/maintenance-records/refuel
  ↓
API returns: { newFuelLevel: 85.5, maintenanceRecord: {...} }
  ↓
setSelectedMotor({ ...selectedMotor, currentFuelLevel: 85.5 })
  ↓
setTripMaintenanceActions([...prev, { type: 'refuel', cost: 50, quantity: 0.9091, ... }])
  ↓
[User stops tracking]
  ↓
TripSummaryModal receives tripMaintenanceActions prop
  ↓
Displays: "Maintenance During Trip" section with refuel
```

---

## Test Checklist:

- [ ] Fuel level updates after refuel
- [ ] Maintenance record saved to backend
- [ ] Refuel appears in tripMaintenanceActions array
- [ ] Trip Summary Modal shows refuel in "Maintenance During Trip"
- [ ] Maintenance Details screen shows refuel record
- [ ] Quantity calculated correctly (50 / 55 = 0.9091L)
- [ ] Cost displayed correctly (₱50.00)
- [ ] Cost per liter stored correctly (₱55)
- [ ] Cost per liter displayed in Trip Summary Modal (₱55.00/L)
- [ ] Cost per liter displayed in Maintenance Details (₱55.00)

