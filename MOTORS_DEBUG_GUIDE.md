# 🔍 Motors Not Showing - Debug Guide

**Date**: October 14, 2025  
**Issue**: Motors still not displaying in RouteSelectionScreen  
**Status**: 🔧 **DEBUGGING IN PROGRESS**

---

## 🛠️ What I Added

### 1. Comprehensive Console Logging

**Motor Data Flow Logging:**
```typescript
// In RouteSelectionScreenOptimized.tsx
const effectiveMotors = useMemo(() => {
  const result = motors?.length ? motors : (cachedMotors || []);
  console.log('[RouteSelection] Motor Data:', {
    motorsFromAPI: motors?.length || 0,
    cachedMotors: cachedMotors?.length || 0,
    effectiveMotors: result?.length || 0,
    source: motors?.length ? 'API' : cachedMotors?.length ? 'Cache' : 'None'
  });
  return result;
}, [motors, cachedMotors]);
```

**Auto-Select Logging:**
```typescript
useEffect(() => {
  console.log('[RouteSelection] Auto-select check:', {
    effectiveMotorsCount: effectiveMotors.length,
    hasSelectedMotor: !!selectedMotor,
    willAutoSelect: effectiveMotors.length > 0 && !selectedMotor
  });
  
  if (effectiveMotors.length > 0 && !selectedMotor) {
    console.log('[RouteSelection] Auto-selecting motor:', effectiveMotors[0]?.nickname);
    setSelectedMotor(effectiveMotors[0]);
  }
}, [effectiveMotors.length, selectedMotor]);
```

**UserContext Logging:**
```typescript
// In UserContextImproved.js
const updateCachedMotors = useCallback(async (motors) => {
  console.log("[UserContext] updateCachedMotors called:", {
    motorsCount: motors?.length || 0,
    userId: user?._id,
    isArray: Array.isArray(motors)
  });
  // ...
}, [user?._id]);
```

### 2. Visual Debug Badge

Added a debug indicator at the top-left of the screen showing:
- **Total effective motors**
- **API motors count**
- **Cached motors count**

```
┌─────────────────────┐
│ Motors: 2           │
│ API: 2 | Cache: 0   │
└─────────────────────┘
```

---

## 🧪 How to Debug

### Step 1: Restart & Watch Console

```bash
npm start
```

### Step 2: Open RouteSelectionScreen

Navigate to the **Map tab**

### Step 3: Check Console Logs

Look for these log patterns:

#### ✅ SUCCESS Pattern
```
[UserContext] Setting cached motors: 2
[RouteSelection] Motor Data: {
  motorsFromAPI: 0,
  cachedMotors: 2,
  effectiveMotors: 2,
  source: 'Cache'
}
[RouteSelection] Auto-select check: {
  effectiveMotorsCount: 2,
  hasSelectedMotor: false,
  willAutoSelect: true
}
[RouteSelection] Auto-selecting motor: "My Bike"
```

#### ❌ PROBLEM Pattern 1: No Cached Motors
```
[UserContext] Setting cached motors: 0  // ⚠️ Empty!
[RouteSelection] Motor Data: {
  motorsFromAPI: 0,
  cachedMotors: 0,  // ⚠️ No cache!
  effectiveMotors: 0,
  source: 'None'
}
```

**Diagnosis**: Motors not cached in UserContext  
**Likely Cause**: AsyncStorage doesn't have motors OR UserContext not loading properly

#### ❌ PROBLEM Pattern 2: API Not Loading
```
[useAppData] Fetching motors from API for user: ...
[useAppData] API returned motors: 0  // ⚠️ API returned empty!
[UserContext] updateCachedMotors called: {
  motorsCount: 0,  // ⚠️ Saving empty array!
}
```

**Diagnosis**: API returning empty array  
**Likely Cause**: Backend issue OR user has no motors in database

#### ❌ PROBLEM Pattern 3: Not Updating
```
[RouteSelection] Motor Data: {
  motorsFromAPI: 0,
  cachedMotors: 0,
  effectiveMotors: 0,
  source: 'None'
}
[RouteSelection] Auto-select check: {
  effectiveMotorsCount: 0,
  hasSelectedMotor: false,
  willAutoSelect: false  // ⚠️ Won't auto-select!
}
```

**Diagnosis**: No motors available from any source  
**Likely Cause**: Need to check Motors tab & backend

### Step 4: Check Debug Badge

Look at the **top-left debug badge** on the screen:

| What You See | Meaning | Action |
|--------------|---------|--------|
| `Motors: 2`<br>`API: 2 \| Cache: 0` | ✅ API working | Good! |
| `Motors: 2`<br>`API: 0 \| Cache: 2` | ✅ Cache working | Good! |
| `Motors: 0`<br>`API: 0 \| Cache: 0` | ❌ No motors anywhere | Check Motors tab & backend |
| `Motors: 0`<br>`API: 0 \| Cache: 3` | 🐛 Cache not being used | Bug in effectiveMotors logic |

### Step 5: Compare with Motors Tab

1. Navigate to **Motors tab**
2. Check if motors show there
3. Go back to **Map tab**
4. Check console logs again

**Expected**:
- Motors tab shows motors ✅
- Map tab console shows: `cachedMotors: X` (where X > 0)
- Debug badge shows: `Cache: X`

---

## 🔍 Diagnostic Questions

Based on the logs, answer these:

### Q1: Does UserContext have cached motors?
**Log to check**:
```
[UserContext] Setting cached motors: X
```

- If `X > 0` → ✅ UserContext has motors
- If `X = 0` → ❌ Problem in UserContext loading

### Q2: Is useAppData receiving cached motors?
**Log to check**:
```
[RouteSelection] Motor Data: { cachedMotors: X }
```

- If `X > 0` → ✅ Receiving cache
- If `X = 0` → ❌ Not receiving from UserContext

### Q3: Is the API returning motors?
**Log to check**:
```
[useAppData] API returned motors: X
[UserContext] updateCachedMotors called: { motorsCount: X }
```

- If `X > 0` → ✅ API working
- If `X = 0` → ❌ Check backend/database

### Q4: Is effectiveMotors computed correctly?
**Log to check**:
```
[RouteSelection] Motor Data: {
  motorsFromAPI: A,
  cachedMotors: B,
  effectiveMotors: C,
  source: S
}
```

**Expected logic**:
- If `A > 0` → `C = A` and `S = 'API'`
- Else if `B > 0` → `C = B` and `S = 'Cache'`
- Else → `C = 0` and `S = 'None'`

If this logic doesn't match, there's a bug in the memoization.

### Q5: Is auto-select working?
**Log to check**:
```
[RouteSelection] Auto-select check: {
  effectiveMotorsCount: X,
  willAutoSelect: Y
}
```

- If `X > 0` and `Y = true` → Should auto-select
- If `X > 0` and `Y = false` → Already has selected motor
- If `X = 0` → Can't auto-select (no motors)

---

## 🚨 Common Issues & Fixes

### Issue 1: UserContext Returns Empty Array

**Symptom**:
```
[UserContext] Setting cached motors: 0
```

**Possible Causes**:
1. No motors in AsyncStorage
2. AsyncStorage key mismatch
3. JSON parse error

**Fix**:
```bash
# Check AsyncStorage manually
# Add this temporarily in UserContext loadUser:
console.log("[DEBUG] Raw motorsStr:", motorsStr);
```

### Issue 2: API Not Called

**Symptom**: No `[useAppData] Fetching motors` log

**Possible Causes**:
1. `globalHasLoadedMotors` already true
2. `user._id` missing
3. useAppData initialization skipped

**Fix**: Check useAppData logs for:
```
[useAppData] Already initialized - skipping
```

### Issue 3: effectiveMotors Always 0

**Symptom**: Debug badge shows `Motors: 0` but cache has data

**Possible Causes**:
1. Memoization not re-running
2. Reference equality issue
3. Wrong dependency array

**Fix**: Check if `motors` or `cachedMotors` is actually changing

---

## 📋 What to Share

When you see the issue, copy and paste:

### 1. Console Logs
```
[Paste all logs starting with [UserContext], [useAppData], [RouteSelection]]
```

### 2. Debug Badge Reading
```
Motors: ?
API: ? | Cache: ?
```

### 3. Motors Tab Status
```
- Motors tab shows: X motors
- Can see motor names: [list them]
```

### 4. Behavior
```
- Does motor selector show motors when tapped? Yes/No
- Does auto-select work? Yes/No
- Does the motor button show "Select Motor" or a motor name?
```

---

## 🎯 Expected Flow (When Working)

### On App Start
```
1. [UserContext] Loading user...
2. [UserContext] Cached data loaded: { hasMotors: true }
3. [UserContext] Setting cached motors: 2
4. [UserContext] Setting user state (all caches loaded)
5. [useAppData] INITIALIZING for user: ...
6. [RouteSelection] Motor Data: {
     motorsFromAPI: 0,
     cachedMotors: 2,
     effectiveMotors: 2,
     source: 'Cache'
   }
7. [RouteSelection] Auto-select check: {
     effectiveMotorsCount: 2,
     willAutoSelect: true
   }
8. [RouteSelection] Auto-selecting motor: "My Bike"
9. [useAppData] Fetching motors from API for user: ...
10. [useAppData] API returned motors: 2
11. [UserContext] updateCachedMotors called: { motorsCount: 2 }
12. [RouteSelection] Motor Data: {
      motorsFromAPI: 2,
      cachedMotors: 2,
      effectiveMotors: 2,
      source: 'API'
    }
```

**Result**: Motors show immediately from cache, then refresh from API ✅

---

## 🔧 Next Steps

1. **Test with debug badge visible**
2. **Copy console logs**
3. **Share findings**:
   - What do the logs show?
   - What does debug badge show?
   - Does Motors tab have motors?

Based on the logs, we'll identify the exact problem! 🎯

---

**Debug Badge Location**: Top-left corner of Map screen  
**Remove Later**: After finding issue, remove debug badge (lines 508-515 & styles)  
**Status**: Awaiting test results 🔍

