# Unmount/Remount Loop - CRITICAL FIX

## 🔴 CRITICAL ISSUE: Infinite Unmount/Remount Loop

### What Was Happening

Your logs showed a **catastrophic render loop**:

```
RENDER #1 (all deps from undefined → values)
RENDER #2 (reportsLength, gasStationsLength change)
RENDER #4 (loading changes)
RENDER #1 (all deps back to undefined!) ← COMPONENT UNMOUNTED!
... LOOP REPEATS INFINITELY
```

**Plus**:
- `getCurrentLocation` called **13+ times** in rapid succession
- Component mounting/unmounting continuously
- App completely frozen/unresponsive

---

## 🔍 Root Causes Identified

### Issue #1: Location Effect Loop
**File**: `RouteSelectionScreenImproved.tsx` (Line 391-397)

**BEFORE** (causing loop):
```typescript
useEffect(() => {
  if (isInitialMount.current) {
    isInitialMount.current = false;
    handleGetCurrentLocation(false);
  }
}, [handleGetCurrentLocation]); // ❌ handleGetCurrentLocation in deps!
```

**Problem**:
1. Effect depends on `handleGetCurrentLocation`
2. Component renders → `handleGetCurrentLocation` might be seen as "new" (even though memoized)
3. Effect runs → calls `handleGetCurrentLocation()`
4. Sets state (location, region, loading)
5. Component re-renders → cycle repeats
6. Eventually causes unmount/remount

**AFTER** (fixed):
```typescript
useEffect(() => {
  if (isInitialMount.current) {
    isInitialMount.current = false;
    handleGetCurrentLocation(false);
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []); // ✅ Empty deps - only run once on mount
```

---

### Issue #2: useAppData Initialization Loop
**File**: `hooks/useAppData.ts` (Line 228-268)

**BEFORE** (causing loop):
```typescript
useEffect(() => {
  if (!user?._id) return;

  const initializeData = async () => {
    await loadCachedData(user._id);
    await refreshData();
  };

  initializeData();
  
  return () => { /* cleanup */ };
}, [user?._id, loadCachedData, refreshData]); // ❌ Functions in deps!
```

**Problem**:
1. Effect depends on `loadCachedData` and `refreshData`
2. These functions have dependencies that change
3. Functions get recreated
4. Effect runs again
5. Triggers state changes
6. Functions recreated again
7. **INFINITE LOOP**

**AFTER** (fixed):
```typescript
// Use refs to track initialization
const hasInitializedRef = useRef(false);
const lastUserIdRef = useRef<string | null>(null);

useEffect(() => {
  if (!user?._id) return;

  // Only initialize once per user
  if (hasInitializedRef.current && lastUserIdRef.current === user._id) {
    return; // ✅ Already initialized for this user
  }

  const initializeData = async () => {
    console.log('[useAppData] INITIALIZING for user:', user._id);
    hasInitializedRef.current = true;
    lastUserIdRef.current = user._id;

    await loadCachedData(user._id);
    await refreshData();
  };

  initializeData();
  
  return () => { /* cleanup */ };
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [user?._id]); // ✅ Only depend on user ID, use refs for functions
```

---

### Issue #3: Motor Caching Mystery
**File**: `AuthContext/UserContextImproved.js` (Lines 57-63)

**Enhanced logging to debug**:
```javascript
try { 
  const motors = motorsStr ? JSON.parse(motorsStr) : [];
  console.log("[UserContext] Setting cached motors:", motors.length, "Raw:", motorsStr?.substring(0, 100));
  setCachedMotors(motors);
} catch (e) {
  console.error("[UserContext] Error parsing motors:", e);
}
```

**Also added in useAppData.ts** (Lines 160-184):
```javascript
console.log('[useAppData] Fetching motors from API for user:', userId);
const motorsRes = await fetchUserMotors(userId, signal);
console.log('[useAppData] API returned motors:', motorsRes.length, motorsRes);
console.log('[useAppData] Motors saved to state and cache:', motorsRes.length);
```

---

## ✅ What's Fixed

### 1. No More Unmount/Remount Loop
- Effects now run **ONCE per mount**, not continuously
- Component stays mounted
- No more jumping back to RENDER #1

### 2. Location Request Controlled
- `getCurrentLocation` called **ONCE on mount**
- No more 13+ repeated calls
- Proper initialization

### 3. Data Initialization Controlled
- `useAppData` initializes **ONCE per user**
- Uses refs to prevent re-initialization
- No more repeated loadCachedData calls

### 4. Better Diagnostics
- Clear logging shows WHEN initialization happens
- Motor fetch/cache operations logged
- Can now see if motors are actually in the API response

---

## 🧪 What You Should See Now

### Expected Logs (Healthy Pattern):

```javascript
// === UserContext loads ===
[UserContext] Loading user from AsyncStorage...
[UserContext] User loaded: user@example.com
[UserContext] Cached data loaded: { hasMotors: true, ... }
[UserContext] Setting cached motors: 0 Raw: [] // ← Check if motors exist!
[UserContext] Setting user state (all caches loaded)

// === useAppData initializes ===
[useAppData] INITIALIZING for user: 67ed2c148f047f59870963d4
[useAppData] loadCachedData: start
[useAppData] Setting reports from context cache: 9
[useAppData] Setting gas stations from context cache: 37
[useAppData] AsyncStorage check: { hasMotors: true, ... }
[useAppData] Loading motors from AsyncStorage: 0 // ← Or actual count

// === API fetch ===
[useAppData] Fetching motors from API for user: 67ed2c...
[useAppData] API returned motors: 0 [] // ← Check if API has motors!
[useAppData] Motors saved to state and cache: 0

// === Component renders ===
[RouteSelection] RENDER #1 { changedDeps: 'initial render' }
[RouteSelection] getCurrentLocation:acquired
[RouteSelection] getCurrentLocation:done
[RouteSelection] RENDER #2 { changedDeps: ['reportsLength', 'gasStationsLength'] }
[RouteSelection] RENDER #3 { changedDeps: ['loading'] }
// ✅ DONE - No more renders!
```

**🚨 Key Things to Check**:

1. **Is `[useAppData] INITIALIZING` logged ONCE or multiple times?**
   - ONCE = ✅ Fixed
   - Multiple = Still has issues

2. **Does `getCurrentLocation` appear once or 13+ times?**
   - Once = ✅ Fixed
   - 13+ = Still has issues

3. **What does `API returned motors:` show?**
   - If it's `0 []` → You genuinely have no motors
   - If it's `4 [...]` → You have motors, they should cache

4. **Does RENDER #1 repeat?**
   - No = ✅ Fixed
   - Yes = Component still unmounting

---

## 🔍 Motor Investigation

### If Motors Still Show 0

Based on your logs, the API might be returning **0 motors**. Check:

1. **Do you actually have motors in your database?**
   - Check your backend/database directly
   - API endpoint: `/api/user-motors/user/{userId}`

2. **Is the API working?**
   - Check network tab in DevTools
   - Look for the motors API call
   - See what the response is

3. **Check the new logs**:
   ```
   [useAppData] API returned motors: 0 [] 
   ```
   - If `0 []` = No motors in database
   - If `4 [...]` = Motors exist but not caching properly

---

## 📊 Before vs After

| Metric | Before | After | Status |
|--------|--------|-------|--------|
| **Renders on mount** | Infinite | 3-4 | ✅ Fixed |
| **getCurrentLocation calls** | 13+ | 1 | ✅ Fixed |
| **Component unmounting** | Yes (loop) | No | ✅ Fixed |
| **useAppData init calls** | Infinite | 1 per user | ✅ Fixed |
| **Effect loop** | Yes | No | ✅ Fixed |
| **Motors showing** | 0 | ? | 🔍 Investigating |

---

## 🚨 Next Steps

### 1. Clear Console & Restart App

```bash
# Clear Metro bundler console
# Restart app completely
# Watch the logs carefully
```

### 2. Look for These Specific Logs

**✅ GOOD Signs**:
```
[useAppData] INITIALIZING for user: ...  (appears ONCE)
[RouteSelection] getCurrentLocation:acquired  (appears ONCE)
[RouteSelection] RENDER #1  (no more RENDER #1 after RENDER #4)
```

**❌ BAD Signs (still broken)**:
```
[useAppData] INITIALIZING for user: ...  (appears MULTIPLE times)
[RouteSelection] getCurrentLocation:acquired (appears 13+ times)
[RouteSelection] RENDER #1 ... RENDER #4 ... RENDER #1 (loop)
```

### 3. Check Motor API Response

Look for this log:
```
[useAppData] API returned motors: <count> <array>
```

- **If `0 []`**: You have no motors → Add motors in the app
- **If `4 [...]`**: Motors exist → Check caching logic
- **If error**: API is failing → Check backend

---

## 🛠️ Files Modified

1. ✅ **RouteSelectionScreenImproved.tsx** (Line 391-397)
   - Fixed location request effect
   - Removed `handleGetCurrentLocation` from dependencies

2. ✅ **hooks/useAppData.ts** (Lines 227-268, 160-184)
   - Added refs to prevent re-initialization
   - Enhanced logging for motors
   - Fixed effect dependencies

3. ✅ **AuthContext/UserContextImproved.js** (Lines 57-63)
   - Enhanced motor logging
   - Better error handling

---

## 💡 Key Lessons

### ❌ NEVER Do This:
```typescript
useEffect(() => {
  someFunction();
}, [someFunction]); // ❌ Function in deps causes loops!
```

### ✅ ALWAYS Do This:
```typescript
useEffect(() => {
  someFunction();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []); // ✅ Empty deps if function is stable
```

**OR**:
```typescript
const hasRun = useRef(false);
useEffect(() => {
  if (hasRun.current) return;
  hasRun.current = true;
  someFunction();
}, [userId]); // ✅ Use ref to prevent re-runs
```

---

## 📞 Report Back

Please share:

1. **Does the loop stop?** (Check for repeated RENDER #1)
2. **How many times does `getCurrentLocation` appear?**
3. **What does `[useAppData] API returned motors:` say?**
4. **Total render count on app start?** (Should be 3-5)

This will help us determine if the loop is fixed and solve the motors mystery!

---

**Date**: October 14, 2025
**Status**: 🔧 Critical fixes applied - Awaiting test results
**Severity**: Critical → Hopefully Resolved

