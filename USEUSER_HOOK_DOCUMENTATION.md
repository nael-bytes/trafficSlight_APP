# 📚 useUser Hook Documentation

## Overview

The `useUser` hook is a custom React hook that provides access to user data, authentication state, and cached data management throughout the app.

---

## 🔧 Hook Implementation

**Location:** `AuthContext/UserContextImproved.js` (Lines 345-351)

```javascript
export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};
```

**What it does:**
- Accesses the `UserContext` using React's `useContext` hook
- Throws an error if used outside of `UserProvider`
- Returns the complete context value with all user-related state and functions

---

## 📦 What useUser Provides

When you call `const { ... } = useUser()`, you get access to:

### **1. User State** 👤

#### `user` (object | null)
- **Type:** User object or null
- **Contains:** Current user's data
  - `_id`: MongoDB ObjectId
  - `id`: Custom user ID (e.g., "2505290001")
  - `name`: Full name (e.g., "Aristotle")
  - `email`: Email address
  - `firstName`, `lastName`: Individual name fields
  - `city`, `province`, `barangay`, `street`: Address fields
  - `isVerified`: Boolean
  - `role`: User role
  - And other user fields...

**Example:**
```javascript
const { user } = useUser();
console.log(user?.name); // "Aristotle"
console.log(user?.email); // "aristotle.lorenzo1114@gmail.com"
```

#### `loading` (boolean)
- **Type:** Boolean
- **Purpose:** Indicates if user data is being loaded
- **Usage:** Show loading spinner while `loading === true`

**Example:**
```javascript
const { loading } = useUser();
if (loading) return <LoadingScreen />;
```

#### `error` (string | null)
- **Type:** String or null
- **Purpose:** Error message if something went wrong
- **Usage:** Display error messages to user

**Example:**
```javascript
const { error } = useUser();
if (error) Alert.alert("Error", error);
```

---

### **2. User Management Functions** 🔄

#### `saveUser(userData)` - Save/Set User Data
- **Type:** `async (userData: object) => Promise<void>`
- **Purpose:** Save user data to AsyncStorage and update state
- **Validation:** Checks for `_id` and `email`
- **Location:** Lines 130-152

**Usage:**
```javascript
const { saveUser } = useUser();
await saveUser({
  _id: "...",
  id: "2505290001",
  name: "Aristotle",
  email: "aristotle@example.com"
});
```

**What it does:**
1. Validates user data structure
2. Saves to AsyncStorage
3. Updates `user` state
4. Logs success/error

---

#### `updateUser(updates)` - Update User Data (Partial)
- **Type:** `async (updates: object) => Promise<void>`
- **Purpose:** Partially update user data (merge with existing)
- **Location:** Lines 197-215

**Usage:**
```javascript
const { updateUser } = useUser();
await updateUser({ 
  city: "Manila",
  phone: "+1234567890"
});
```

**What it does:**
1. Merges updates with existing user data
2. Saves to AsyncStorage
3. Updates `user` state

---

#### `clearUser()` - Clear User Data (Logout)
- **Type:** `async () => Promise<void>`
- **Purpose:** Clear user data and all cached data (logout)
- **Location:** Lines 218-249

**Usage:**
```javascript
const { clearUser } = useUser();
await clearUser();
```

**What it does:**
1. Clears user-specific cache (reports, gas stations, motors)
2. Removes user data from AsyncStorage
3. Sets `user` to null
4. Clears all cached data from state

---

#### `refreshUser(userData)` - Refresh User Data
- **Type:** `async (userData?: object) => Promise<void>`
- **Purpose:** Refresh user data (calls `saveUser`)
- **Location:** Lines 268-272

**Usage:**
```javascript
const { refreshUser } = useUser();
await refreshUser(newUserData);
```

---

#### `clearError()` - Clear Error State
- **Type:** `() => void`
- **Purpose:** Clear error message
- **Location:** Lines 252-254

**Usage:**
```javascript
const { clearError } = useUser();
clearError();
```

---

### **3. Utility Functions** 🛠️

#### `isUserLoaded()` - Check if User is Loaded
- **Type:** `() => boolean`
- **Purpose:** Check if user data is fully loaded
- **Returns:** `true` if `!loading && user !== null`
- **Location:** Lines 257-259

**Usage:**
```javascript
const { isUserLoaded } = useUser();
if (isUserLoaded()) {
  // User is ready to use
}
```

---

#### `getUserProperty(property, defaultValue)` - Get User Property Safely
- **Type:** `(property: string, defaultValue?: any) => any`
- **Purpose:** Safely get a user property with fallback
- **Location:** Lines 262-265

**Usage:**
```javascript
const { getUserProperty } = useUser();
const userName = getUserProperty('name', 'Guest');
const userCity = getUserProperty('city', 'Unknown');
```

---

#### `resetPassword(email)` - Reset Password
- **Type:** `async (email: string) => Promise<{success: boolean, message?: string, error?: string}>`
- **Purpose:** Request password reset
- **Endpoint:** `POST /api/auth/reset-password`
- **Location:** Lines 275-295

**Usage:**
```javascript
const { resetPassword } = useUser();
const result = await resetPassword('user@example.com');
if (result.success) {
  Alert.alert('Success', result.message);
}
```

---

### **4. Global Cache State** 💾

#### `cachedReports` (array)
- **Type:** `TrafficReport[]`
- **Purpose:** Global cached traffic reports
- **Updated by:** `updateCachedReports`
- **Location:** Line 14, 311

#### `cachedGasStations` (array)
- **Type:** `GasStation[]`
- **Purpose:** Global cached gas stations
- **Updated by:** `updateCachedGasStations`
- **Location:** Line 15, 312

#### `cachedMotors` (array)
- **Type:** `Motor[]`
- **Purpose:** Global cached user motors
- **Updated by:** `updateCachedMotors`
- **Location:** Line 16, 313

---

### **5. Cache Update Functions** 🔄

#### `updateCachedReports(reports)` - Update Cached Reports
- **Type:** `async (reports: array) => Promise<void>`
- **Purpose:** Update cached reports in state and AsyncStorage
- **Location:** Lines 155-165

**Usage:**
```javascript
const { updateCachedReports } = useUser();
await updateCachedReports(newReports);
```

#### `updateCachedGasStations(gasStations)` - Update Cached Gas Stations
- **Type:** `async (gasStations: array) => Promise<void>`
- **Purpose:** Update cached gas stations in state and AsyncStorage
- **Location:** Lines 167-177

#### `updateCachedMotors(motors)` - Update Cached Motors
- **Type:** `async (motors: array) => Promise<void>`
- **Purpose:** Update cached motors in state and AsyncStorage
- **Location:** Lines 179-194

**Usage:**
```javascript
const { updateCachedMotors } = useUser();
await updateCachedMotors(newMotors);
```

---

## 🔄 Automatic Behavior

### **On App Start** (useEffect, Lines 19-127)

When the app starts, `UserProvider` automatically:

1. **Loads user from AsyncStorage**
   - Checks for stored user data
   - Parses and sets user state

2. **Loads cached data in parallel**
   - Reports
   - Gas stations
   - Motors
   - Token

3. **Fetches fresh profile if needed**
   - If `name` or `id` is missing
   - Fetches from `/api/users/me` in **background** (non-blocking)
   - Updates user data when complete
   - **Does NOT block app loading**

4. **Sets loading to false**
   - Allows app to continue

---

## 📝 Complete Usage Example

```javascript
import { useUser } from '../AuthContext/UserContextImproved';

function MyComponent() {
  // Get all user data and functions
  const {
    user,              // User object
    loading,           // Loading state
    error,             // Error message
    saveUser,          // Save user data
    updateUser,        // Update user data
    clearUser,         // Clear user (logout)
    isUserLoaded,      // Check if loaded
    getUserProperty,   // Get property safely
    cachedReports,     // Cached reports
    cachedMotors,      // Cached motors
    updateCachedMotors, // Update motors cache
  } = useUser();

  // Example: Display user info
  if (loading) return <Text>Loading...</Text>;
  if (!user) return <Text>Not logged in</Text>;

  return (
    <View>
      <Text>Name: {user.name}</Text>
      <Text>Email: {user.email}</Text>
      <Text>UID: {user.id}</Text>
    </View>
  );
}
```

---

## 🔍 Where useUser is Used

### **1. ProfileScreen** (`Screens/loggedIn/ProfileScreen.js`)
```javascript
const { user, clearUser, saveUser } = useUser();
// Displays user info, handles logout
```

### **2. LoginScreen** (`Screens/ACCOUNT_AUTH/LoginScreen.js`)
```javascript
const { saveUser } = useUser();
// Saves user data after login
```

### **3. HomeScreen** (`Screens/loggedIn/HomeScreen.tsx`)
```javascript
const { user } = useUser();
// Gets user ID for fetching data
```

### **4. RouteSelectionScreen** (`Screens/RouteSelectionScreenOptimized.tsx`)
```javascript
const { user, cachedMotors } = useUser();
// Uses user ID and cached motors
```

---

## ⚙️ Context Provider

The `useUser` hook works because the app is wrapped in `UserProvider`:

**Location:** `App.js`

```javascript
import { UserProvider } from "./AuthContext/UserContextImproved";

export default function App() {
  return (
    <UserProvider>
      {/* App content */}
    </UserProvider>
  );
}
```

---

## 🎯 Key Features

### ✅ **Automatic Loading**
- Loads user data on app start
- Loads cached data in parallel
- Fetches fresh profile if needed (background)

### ✅ **Non-Blocking**
- Profile fetch happens in background
- App loads immediately
- User data updates when ready

### ✅ **Global Cache**
- Reports, gas stations, motors cached globally
- Shared across all screens
- Persisted to AsyncStorage

### ✅ **Error Handling**
- Validates user data structure
- Handles API failures gracefully
- Provides error messages

### ✅ **Performance Optimized**
- Memoized context value (prevents unnecessary re-renders)
- Parallel data loading
- Background profile fetch

---

## 🚨 Error Handling

### **Missing UserProvider Error**
```javascript
// ❌ This will throw an error
function MyComponent() {
  const { user } = useUser(); // Error: useUser must be used within a UserProvider
}
```

**Solution:** Wrap your app with `UserProvider`

### **Invalid User Data Error**
```javascript
// ❌ This will throw an error
await saveUser({ email: "test@example.com" }); 
// Error: Invalid user data structure (missing _id)
```

**Solution:** Ensure user data has `_id` and `email`

---

## 📊 State Flow Diagram

```
App Starts
    ↓
UserProvider loads
    ↓
Load user from AsyncStorage
    ↓
Load cached data (parallel)
    ↓
Set user state (immediately)
    ↓
Set loading = false
    ↓
App continues loading
    ↓
[Background] Fetch profile if needed
    ↓
[Background] Update user when ready
```

---

## 🔐 Security Notes

- ✅ Token is stored separately (in AuthContext, not UserContext)
- ✅ User data is validated before saving
- ✅ Cache is user-specific (includes `_id` in keys)
- ✅ Errors are logged but don't expose sensitive data

---

## 📝 Summary

**`useUser()` hook provides:**

1. **User State:** `user`, `loading`, `error`
2. **User Functions:** `saveUser`, `updateUser`, `clearUser`, `refreshUser`
3. **Utility Functions:** `isUserLoaded`, `getUserProperty`, `resetPassword`
4. **Cache State:** `cachedReports`, `cachedGasStations`, `cachedMotors`
5. **Cache Functions:** `updateCachedReports`, `updateCachedGasStations`, `updateCachedMotors`

**Automatic Features:**
- ✅ Loads user data on app start
- ✅ Loads cached data in parallel
- ✅ Fetches fresh profile in background if needed
- ✅ Non-blocking (app loads immediately)

**Usage:**
```javascript
const { user, loading, saveUser, clearUser } = useUser();
```

---

**Last Updated:** January 2025
**File:** `AuthContext/UserContextImproved.js`

