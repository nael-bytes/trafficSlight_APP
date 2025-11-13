# Route Fetching Timeout Issue - Backend Documentation

## Issue Summary

Route fetching operations are experiencing timeout errors when calling the Google Maps Directions API. This document outlines the issue, potential causes, and recommendations for backend optimization.

---

## Error Messages

```
[AsyncMapOperations] Route fetch error: Error: Request timeout.
[DestinationFlow] Route fetching failed: Error: Operation timeout
```

---

## Root Cause Analysis

### 1. **External API Dependency**
- The application relies on **Google Maps Directions API** for route calculation
- This is an external service that can have variable response times
- Network latency, API load, and geographic complexity can affect response times

### 2. **Timeout Configuration**
- **Previous timeout**: 10 seconds
- **Updated timeout**: 30 seconds (frontend fix)
- Google Maps API can take 5-20+ seconds for complex routes or during high load

### 3. **Potential Causes**

#### Frontend Issues (Fixed)
- ✅ **Double timeout mechanism** - Removed duplicate timeout in `fetchRoutesAsync`
- ✅ **Too short timeout** - Increased from 10s to 30s
- ✅ **Insufficient retries** - Increased retries from 1 to 2

#### Backend/API Issues (If Applicable)
- ⚠️ **Google Maps API rate limiting** - May need quota increase
- ⚠️ **API key restrictions** - Check if API key has proper permissions
- ⚠️ **Network infrastructure** - Server location may affect API response times
- ⚠️ **Route complexity** - Long distances or complex routes take longer to calculate

---

## Frontend Fixes Applied

### 1. Removed Double Timeout
**File**: `utils/asyncMapOperations.ts`
- Removed internal timeout from `fetchRoutesAsync`
- Let `runAsyncOperation` wrapper handle timeout and retries
- Prevents race conditions between nested timeouts

### 2. Increased Timeout Values
**Files**: 
- `utils/destinationFlowManager.ts` - 10s → 30s
- `Screens/loggedIn/MapScreenTryRefactored.tsx` - 15s → 30s

### 3. Improved Error Handling
- Better error messages with context
- Proper error propagation
- Retry logic with exponential backoff

---

## Backend Recommendations

### 1. **Route Caching Strategy**

If routes are frequently requested for the same origin/destination pairs, consider implementing caching:

```javascript
// Example: Cache routes for 5 minutes
const routeCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

async function getCachedRoute(origin, destination) {
  const cacheKey = `${origin.lat},${origin.lng}-${destination.lat},${destination.lng}`;
  const cached = routeCache.get(cacheKey);
  
  if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
    return cached.data;
  }
  
  // Fetch from Google Maps API
  const route = await fetchRouteFromGoogleMaps(origin, destination);
  routeCache.set(cacheKey, { data: route, timestamp: Date.now() });
  return route;
}
```

### 2. **Backend Route Proxy**

Consider creating a backend endpoint that:
- Proxies requests to Google Maps API
- Implements caching
- Handles rate limiting
- Provides fallback routes
- Logs API usage for monitoring

**Endpoint Structure:**
```
POST /api/routes/calculate
{
  "origin": { "lat": 14.5995, "lng": 120.9842 },
  "destination": { "lat": 14.6042, "lng": 120.9822 },
  "options": {
    "alternatives": true,
    "avoid": ["tolls"]
  }
}
```

**Benefits:**
- Centralized error handling
- Rate limit management
- Response caching
- Analytics and monitoring
- Fallback strategies

### 3. **Alternative Route Providers**

Consider implementing fallback route providers:
- **Primary**: Google Maps Directions API
- **Fallback 1**: Mapbox Directions API
- **Fallback 2**: OpenRouteService (free alternative)

### 4. **Optimize API Calls**

- **Batch requests** when possible
- **Simplify route options** (fewer alternatives = faster response)
- **Use waypoints sparingly** (each waypoint adds processing time)
- **Monitor API quota** and usage patterns

### 5. **Response Time Monitoring**

Implement monitoring to track:
- Average response times
- Timeout frequency
- API error rates
- Geographic patterns (some regions may be slower)

---

## Google Maps API Considerations

### Rate Limits
- **Standard API**: 40 requests per second
- **Premium API**: Higher limits available
- Check current quota in Google Cloud Console

### Response Time Factors
1. **Distance**: Longer routes take more time
2. **Traffic data**: Real-time traffic adds processing time
3. **Alternatives**: Requesting multiple routes increases time
4. **Region**: Some regions have slower API response times
5. **API load**: Peak times may have slower responses

### Best Practices
- Use `departure_time: 'now'` for real-time traffic
- Request alternatives only when needed
- Cache frequently requested routes
- Monitor API usage and errors

---

## Testing Recommendations

### 1. **Load Testing**
Test route fetching under various conditions:
- High traffic times
- Long distance routes
- Multiple simultaneous requests
- Network latency simulation

### 2. **Timeout Testing**
Verify behavior with:
- Slow network conditions (3G simulation)
- API response delays
- Network interruptions

### 3. **Error Scenarios**
Test handling of:
- API quota exceeded
- Invalid API key
- Network failures
- Malformed responses

---

## Monitoring & Alerts

### Metrics to Track
- Route fetch success rate
- Average response time
- Timeout frequency
- API error rate
- Cache hit rate (if implemented)

### Alert Thresholds
- **Warning**: Response time > 20 seconds
- **Critical**: Timeout rate > 10%
- **Critical**: API error rate > 5%

---

## Implementation Priority

### High Priority (Immediate)
1. ✅ Frontend timeout fixes (completed)
2. ⚠️ Monitor timeout frequency
3. ⚠️ Check Google Maps API quota and usage

### Medium Priority (Short-term)
1. Implement route caching
2. Add backend route proxy endpoint
3. Improve error logging and monitoring

### Low Priority (Long-term)
1. Implement fallback route providers
2. Optimize API call patterns
3. Advanced caching strategies

---

## Related Files

### Frontend
- `utils/asyncMapOperations.ts` - Route fetching logic
- `utils/destinationFlowManager.ts` - Destination flow with route fetching
- `utils/asyncOperations.ts` - Async operation wrapper with timeout
- `Screens/loggedIn/MapScreenTryRefactored.tsx` - Route fetching in map screen

### Backend (If Implemented)
- Route proxy endpoint
- Route caching service
- API monitoring/logging

---

## Notes

- This is primarily a **frontend timeout configuration issue** that has been fixed
- The Google Maps API is an **external service** - response times are not fully controllable
- If timeouts persist after frontend fixes, consider backend optimizations listed above
- Monitor API usage to identify if quota limits are being reached

---

**Last Updated**: November 2024  
**Status**: Frontend fixes applied, backend optimizations recommended

