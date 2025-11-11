# Maintenance Log Flow - Frontend Implementation

This document outlines the complete flow for adding a maintenance log in the frontend application. Use this to verify backend implementation.

---

## 📋 Overview

The maintenance log system allows users to record three types of maintenance activities:
- **Refuel** - Record fuel refueling with cost, quantity, and cost per liter
- **Oil Change** - Record oil changes with quantity
- **Tune Up** - Record general tune-up maintenance

---

## 🔄 Complete Flow

### **1. User Entry Point**

**Screen:** `AddMaintenanceScreen.tsx`  
**Navigation:** User navigates to "Add Maintenance" screen from Profile or other screens

**Code Location:** `Screens/loggedIn/AddMaintenanceScreen.tsx`

---

### **2. Initial Data Loading**

When the screen loads, the following data is fetched:

#### **2.1 Load User Motors**
- **Endpoint:** `GET /api/user-motors/user/:userId`
- **Headers:** `Authorization: Bearer {token}`
- **Method:** Fetches list of motors for the user
- **Caching:** Results are cached in AsyncStorage with key `cachedMotors_{userId}`
- **Purpose:** Display available motors for selection

**Code:**
```typescript
// Line 58-95 in AddMaintenanceScreen.tsx
const fetchUserMotors = useCallback(async () => {
  // Try cache first, then fetch from API
  const response = await fetch(`${LOCALHOST_IP}/api/user-motors/user/${user._id}`, {
    headers: { 'Authorization': `Bearer ${user.token}` }
  });
});
```

#### **2.2 Get Current Location**
- **Purpose:** Capture GPS coordinates for the maintenance record
- **Permission:** Requests foreground location permission
- **Fallback:** If permission denied, uses `{ latitude: 0, longitude: 0 }`
- **Code:** Lines 98-129 in AddMaintenanceScreen.tsx

---

### **3. Form Data Collection**

The user fills out the following form fields:

#### **Required Fields:**
1. **Maintenance Type** (`type`)
   - Options: `'refuel'` | `'oil_change'` | `'tune_up'`
   - Selection: Radio buttons with icons

2. **Motor Selection** (`motorId`)
   - Selected from dropdown modal
   - Displays: nickname, fuel efficiency, current fuel level

3. **Total Cost** (`cost`)
   - Type: Numeric input
   - Format: Positive number (₱)
   - Required: Yes

4. **Date & Time** (`timestamp`)
   - Type: DateTime picker
   - Default: Current date/time
   - Format: Converted to timestamp (milliseconds) on submit

#### **Conditional Fields (Based on Type):**

**For Refuel (`type === 'refuel'`):**
- **Cost per Liter** (`costPerLiter`)
  - Type: Numeric input
  - Required: Yes
  - Purpose: Used to calculate quantity
- **Quantity** (`quantity`)
  - **Auto-calculated:** `quantity = cost / costPerLiter`
  - Displayed to user in real-time
  - Formula shown: `{cost} ÷ {costPerLiter} = {quantity}L`

**For Oil Change (`type === 'oil_change'`):**
- **Oil Quantity** (`quantity`)
  - Type: Numeric input
  - Required: Yes
  - Unit: Liters (L)

**For Tune Up (`type === 'tune_up'):**
- **Quantity:** Not required (optional)

#### **Optional Fields:**
- **Notes** (`notes`)
  - Type: Multi-line text input
  - Optional: Yes

---

### **4. Form Validation**

**Validation Rules:** (Lines 173-200 in AddMaintenanceScreen.tsx)

1. **Motor Selection:** Must select a motor
2. **Maintenance Type:** Must select a type
3. **Cost:** Must be a positive number > 0
4. **Refuel-specific:**
   - `costPerLiter` must be a positive number > 0
5. **Oil Change-specific:**
   - `quantity` must be a positive number > 0

**Error Handling:**
- Errors displayed inline below each field
- Submit button disabled if validation fails
- Toast notification on validation error

---

### **5. Submit Request**

**When:** User clicks "Save Maintenance Record" button

**Process:**

#### **5.1 Data Preparation**

**Request Payload Structure:**
```typescript
{
  userId: string,              // From user._id
  motorId: string,             // From selectedMotor._id
  type: 'refuel' | 'oil_change' | 'tune_up',
  timestamp: number,           // formData.timestamp.getTime() (milliseconds)
  location: {
    latitude: number,          // From currentLocation or 0
    longitude: number          // From currentLocation or 0
  },
  details: {
    cost: number,              // Parsed from formData.cost
    quantity?: number,         // Calculated or from form
    costPerLiter?: number,     // Only for refuel type
    notes?: string             // Optional notes
  }
}
```

**Special Calculation for Refuel:**
```typescript
// Lines 229-237 in AddMaintenanceScreen.tsx
if (formData.type === 'refuel' && cost > 0 && costPerLiter > 0) {
  quantity = cost / costPerLiter;  // Auto-calculate quantity
}
```

#### **5.2 API Request**

**Endpoint:** `POST /api/maintenance-records`

**Headers:**
```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer {token}"
}
```

**Request Body:** (See structure above)

**Code:**
```typescript
// Lines 261-268 in AddMaintenanceScreen.tsx
const response = await fetch(`${LOCALHOST_IP}/api/maintenance-records`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${user.token}`,
  },
  body: JSON.stringify(maintenanceData),
});
```

---

### **6. Backend Response Handling**

#### **6.1 Success Response**

**Expected Response:**
- **Status:** `200 OK` or `201 Created`
- **Body:** Saved maintenance record object

**Frontend Actions:**
1. Log success message
2. Show success toast notification
3. **If type === 'refuel':** Update motor fuel level (see section 7)
4. Reset form
5. Navigate back after 1.5 seconds

#### **6.2 Error Response**

**Error Handling:**
- Check `response.ok`
- Parse error message from `response.json()`
- Display error toast notification
- Keep form data (user can retry)

**Code:**
```typescript
// Lines 270-273 in AddMaintenanceScreen.tsx
if (!response.ok) {
  const errorData = await response.json();
  throw new Error(errorData.message || 'Failed to save maintenance record');
}
```

---

### **7. Post-Submission: Fuel Level Update (Refuel Only)**

**Trigger:** Only when `type === 'refuel'` AND `quantity > 0`

**Process:**

#### **7.1 Calculate New Fuel Level**

**Calculation Function:** `calculateFuelLevelAfterRefuel()`  
**Location:** `utils/fuelCalculations.ts`

**Input:**
```typescript
{
  fuelConsumption: number,      // From motor (fuelConsumption or fuelEfficiency)
  fuelTank: number,              // From motor (fuelTank or default 15L)
  currentFuelLevel: number       // From motor (currentFuelLevel or 0)
}
```

**Calculation Logic:**
- Adds refueled quantity to current fuel level
- Caps at 100% (tank capacity)
- Returns percentage (0-100)

#### **7.2 Validate Fuel Level**

**Validation:**
- Must be between 0 and 100
- Must be a valid number
- **Code:** Lines 132-152 in AddMaintenanceScreen.tsx

#### **7.3 Update Motor Fuel Level**

**API Call:** `updateFuelLevel(motorId, newFuelLevel)`  
**Location:** `utils/api.ts`

**Expected Endpoint:** `PUT /api/user-motors/:motorId/fuel-level` or similar

**Request:**
```typescript
{
  currentFuelLevel: number  // New calculated fuel level (0-100)
}
```

**Code:**
```typescript
// Lines 302-303 in AddMaintenanceScreen.tsx
await updateFuelLevel(selectedMotor._id, newFuelLevel);
```

#### **7.4 Update Local State**

**Action:** Update cached motors list with new fuel level  
**Code:** Lines 315-319 in AddMaintenanceScreen.tsx

---

### **8. Alternative Entry Points**

The maintenance log can also be added from other screens:

#### **8.1 From RouteSelectionScreen**
- **Location:** `Screens/RouteSelectionScreenOptimized.tsx`
- **Function:** `saveMaintenanceRecord()` (Lines 2606-2758)
- **Same API:** `POST /api/maintenance-records`
- **Same payload structure**
- **Same fuel level update logic**

#### **8.2 From NavigationControls (Map Screen)**
- **Location:** `components/NavigationControls-mapscreentry.tsx`
- **Function:** `saveMaintenanceRecord()` (Lines 90-214)
- **Same API:** `POST /api/maintenance-records`
- **Same payload structure**

---

## 📊 Data Flow Summary

```
User Input
    ↓
Form Validation
    ↓
Data Preparation (with calculations)
    ↓
POST /api/maintenance-records
    ↓
Success Response
    ↓
[If refuel] Calculate New Fuel Level
    ↓
[If refuel] PUT /api/user-motors/:motorId/fuel-level
    ↓
Update Local State
    ↓
Show Success & Navigate Back
```

---

## 🔍 Backend Verification Checklist

Use this checklist to verify backend implementation:

### **Endpoint: `POST /api/maintenance-records`**

- [ ] **Authentication:** Requires Bearer token in Authorization header
- [ ] **Request Body Validation:**
  - [ ] `userId` (string, required)
  - [ ] `motorId` (string, required)
  - [ ] `type` (enum: 'refuel', 'oil_change', 'tune_up', required)
  - [ ] `timestamp` (number, milliseconds, required)
  - [ ] `location` (object with latitude, longitude, required)
  - [ ] `details` (object, required)
    - [ ] `cost` (number, required)
    - [ ] `quantity` (number, optional for tune_up, required for refuel/oil_change)
    - [ ] `costPerLiter` (number, optional, only for refuel)
    - [ ] `notes` (string, optional)
- [ ] **Response:** Returns saved maintenance record object
- [ ] **Status Code:** 200 or 201 on success
- [ ] **Error Handling:** Returns error message in JSON format

### **Additional Endpoints (for refuel):**

- [ ] **Endpoint:** `PUT /api/user-motors/:motorId/fuel-level` (or similar)
- [ ] **Purpose:** Update motor's current fuel level after refuel
- [ ] **Request Body:** `{ currentFuelLevel: number }` (0-100)
- [ ] **Validation:** Fuel level must be between 0 and 100

### **Data Persistence:**

- [ ] Maintenance record saved to database
- [ ] Motor fuel level updated (for refuel type)
- [ ] All fields properly stored

---

## 🧪 Testing Scenarios

### **Scenario 1: Refuel Record**
1. Select maintenance type: "Refuel"
2. Select a motor
3. Enter cost: 500
4. Enter cost per liter: 50
5. **Expected:** Quantity auto-calculated as 10L
6. Submit
7. **Expected:** 
   - Maintenance record created
   - Motor fuel level updated
   - Success message shown

### **Scenario 2: Oil Change**
1. Select maintenance type: "Oil Change"
2. Select a motor
3. Enter cost: 300
4. Enter quantity: 2
5. Submit
6. **Expected:** Maintenance record created (no fuel level update)

### **Scenario 3: Tune Up**
1. Select maintenance type: "Tune Up"
2. Select a motor
3. Enter cost: 1000
4. Submit
5. **Expected:** Maintenance record created (no fuel level update)

### **Scenario 4: Validation Errors**
1. Try to submit without selecting motor
2. **Expected:** Error message "Please select a motor"
3. Try to submit without cost
4. **Expected:** Error message "Cost must be a positive number"

---

## 📝 Notes

1. **Quantity Calculation:** For refuel, quantity is calculated automatically from cost and cost per liter. The backend should accept this calculated value.

2. **Location:** If location permission is denied, the frontend sends `{ latitude: 0, longitude: 0 }`. Backend should handle this gracefully.

3. **Fuel Level Update:** Only happens for refuel type. The calculation is done on the frontend, but the backend should verify the fuel level is within valid range (0-100).

4. **Token:** The authentication token is obtained from `user.token` or AsyncStorage. Backend should validate this token.

5. **Timestamp:** Frontend sends timestamp as milliseconds (from `Date.getTime()`). Backend should convert to appropriate date format.

---

## 🔗 Related Files

- **Main Screen:** `Screens/loggedIn/AddMaintenanceScreen.tsx`
- **API Utilities:** `utils/api.ts`
- **Fuel Calculations:** `utils/fuelCalculations.ts`
- **Alternative Entry:** `Screens/RouteSelectionScreenOptimized.tsx`
- **Alternative Entry:** `components/NavigationControls-mapscreentry.tsx`

---

**Last Updated:** Based on codebase analysis  
**Version:** 1.0




