# Render Loop Prevention Checklist

## Quick Reference Guide for Preventing React Native Render Loops

### 🔍 Symptoms of Render Loops
- [ ] Excessive console logs showing repeated renders
- [ ] App becomes unresponsive or sluggish
- [ ] Battery drains quickly
- [ ] High CPU usage
- [ ] Map stuttering or flickering
- [ ] Data fetching happens too frequently

---

## ✅ Prevention Checklist

### 1. useCallback & useMemo
- [ ] All callbacks passed as props are wrapped in `useCallback`
- [ ] All callbacks passed to custom hooks are wrapped in `useCallback`
- [ ] Expensive computations are wrapped in `useMemo`
- [ ] Dependency arrays are complete and accurate

```typescript
// ✅ Good
const handleClick = useCallback(() => {
  doSomething();
}, [dependency1, dependency2]);

// ❌ Bad
const handleClick = () => {
  doSomething();
}; // Recreated on every render
```

### 2. useEffect Dependencies
- [ ] Dependency arrays include ALL used variables
- [ ] Depend on primitive values (`.length`, `.id`) instead of objects/arrays
- [ ] Effects don't update state that they depend on
- [ ] No circular dependencies between effects

```typescript
// ✅ Good
useEffect(() => {
  // ...
}, [array.length, object.id]);

// ❌ Bad
useEffect(() => {
  // ...
}, [array, object]); // New reference every time
```

### 3. Functional setState
- [ ] Use functional setState when new state depends on old state
- [ ] Use functional setState to avoid dependencies in callbacks
- [ ] Don't read state in useEffect if you can use functional setState instead

```typescript
// ✅ Good
setCount(prev => prev + 1);
setItem(prev => ({ ...prev, updated: true }));

// ❌ Bad
setCount(count + 1); // Depends on count
```

### 4. useRef for Non-Render Values
- [ ] Use `useRef` for values that don't need to trigger re-renders
- [ ] Use `useRef` for tracking programmatic vs user-driven changes
- [ ] Use `useRef` for throttling/debouncing timers
- [ ] Use `useRef` for storing previous values

```typescript
// ✅ Good
const lastUpdateTime = useRef(0);
const isUserDriven = useRef(false);

// ❌ Bad
const [lastUpdateTime, setLastUpdateTime] = useState(0); // Unnecessary re-render
```

### 5. Throttling & Debouncing
- [ ] Frequent updates (location, scroll) are throttled
- [ ] Search inputs are debounced
- [ ] Map region changes are throttled
- [ ] Stats updates are throttled

```typescript
// ✅ Good
const now = Date.now();
if (now - lastUpdate.current < 1000) return; // Throttle
lastUpdate.current = now;

// ❌ Bad
// Update on every change without throttling
```

### 6. Map Components
- [ ] Only animate map, don't update region state during tracking
- [ ] Region updates are user-driven, not programmatic loops
- [ ] Use refs to track programmatic vs user changes
- [ ] Throttle region change handlers

```typescript
// ✅ Good - Only animate, don't update state
if (mapRef.current) {
  mapRef.current.animateToRegion(newRegion, 500);
}

// ❌ Bad - Updates state which triggers re-render
setRegion(newRegion);
if (mapRef.current) {
  mapRef.current.animateToRegion(newRegion, 500);
}
```

### 7. Custom Hooks
- [ ] `refreshData` and similar functions are stable (memoized)
- [ ] Hook callbacks don't depend on state they update
- [ ] Use functional setState inside hooks
- [ ] Return stable references

```typescript
// ✅ Good
const fetchData = useCallback(async () => {
  setData(await fetch());
}, [fetchDependency]); // Stable dependencies

// ❌ Bad
const fetchData = async () => {
  setData(await fetch());
}; // New function every render
```

### 8. Navigation & Focus Effects
- [ ] `useFocusEffect` doesn't cause data refresh loops
- [ ] Navigation params are handled once, not continuously
- [ ] Screen focus doesn't trigger multiple API calls
- [ ] Use refs to track if initial load is complete

```typescript
// ✅ Good
const isInitialMount = useRef(true);
useEffect(() => {
  if (isInitialMount.current) {
    isInitialMount.current = false;
    loadData();
  }
}, [loadData]);

// ❌ Bad
useEffect(() => {
  loadData();
}, [loadData]); // Runs every time loadData changes
```

### 9. Context & Global State
- [ ] Context values are memoized
- [ ] Context updates don't trigger unnecessary re-renders
- [ ] Context callbacks are wrapped in `useCallback`

```typescript
// ✅ Good
const contextValue = useMemo(() => ({
  data,
  updateData: useCallback(() => {...}, []),
}), [data]);

// ❌ Bad
const contextValue = {
  data,
  updateData: () => {...},
}; // New object every render
```

### 10. Avoid Common Pitfalls
- [ ] Don't update state in `onRegionChange` that affects region prop
- [ ] Don't trigger data refresh in effects that depend on the data
- [ ] Don't create callbacks inside render without `useCallback`
- [ ] Don't pass inline functions to `useEffect` dependencies

---

## 🐛 Debugging Loops

### Step 1: Identify the Source
```javascript
// Add console logs to track renders
console.log('[ComponentName] render', { relevantState });

// Use React DevTools Profiler to see render frequency
```

### Step 2: Check useEffect Dependencies
```javascript
// Use exhaustive-deps ESLint rule
// Check each effect for circular dependencies
useEffect(() => {
  console.log('[Effect] Running because:', dependencies);
}, [dependencies]);
```

### Step 3: Verify Callbacks
```javascript
// Ensure all callbacks are memoized
const callback = useCallback(() => {...}, [deps]);

// Check if dependencies are stable
console.log('Callback deps:', deps);
```

### Step 4: Throttle Updates
```javascript
// Add throttling to frequent updates
const lastUpdate = useRef(0);
const now = Date.now();
if (now - lastUpdate.current < MIN_INTERVAL) return;
lastUpdate.current = now;
```

---

## 📚 Key Patterns Applied in This Project

1. **Map Region Updates**: Only animate map during tracking, don't update state
2. **Location Updates**: Throttled to 1 second, check for significant changes
3. **Stats Updates**: Throttled to 2 seconds, use functional setState
4. **Data Refresh**: Wrapped in stable `useCallback`, no circular dependencies
5. **Motor Selection**: Depend on `.length` instead of array reference
6. **Focus Location**: Depend on `.latitude`, `.longitude` instead of object

---

## 🎯 Files Fixed in This Project

- ✅ `Screens/RouteSelectionScreenImproved copy.tsx` - Main component with 11 fixes
- ✅ `hooks/useAppData.ts` - Stabilized `refreshData` and dependencies
- ✅ `hooks/useTracking.ts` - Throttled stats updates
- ✅ `components/MapComponent.tsx` - Already optimized (no changes needed)

---

## 💡 Pro Tips

1. **Use React DevTools Profiler** to identify components that render too frequently
2. **Enable "Highlight updates when components render"** in React DevTools
3. **Use `why-did-you-render`** library for detailed re-render reasons
4. **Always prefer functional setState** when in doubt
5. **When debugging, comment out one useEffect at a time** to isolate the issue
6. **Use TypeScript** to catch dependency issues at compile time
7. **Keep dependency arrays as small as possible** without violating rules
8. **Separate concerns**: Visual updates ≠ State updates

---

## 🚀 Quick Fix Template

```typescript
// Step 1: Add refs for tracking
const lastUpdate = useRef(0);
const isUserDriven = useRef(false);

// Step 2: Memoize callbacks
const handleSomething = useCallback(() => {
  // Use functional setState
  setState(prev => ({...prev, updated: true}));
}, [stableDependencies]);

// Step 3: Throttle frequent updates
useEffect(() => {
  const now = Date.now();
  if (now - lastUpdate.current < 1000) return;
  lastUpdate.current = now;
  
  // Do update
}, [dependency1, dependency2.id]); // Primitive dependencies

// Step 4: Stabilize data fetchers
const refreshData = useCallback(() => {
  fetchData();
}, [fetchData]); // fetchData should also be stable
```

