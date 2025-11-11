# 🔴 Backend Authentication Issue - Documentation

## 📋 Problem Summary

The frontend is successfully logging in and receiving a JWT token, but when attempting to use that token for authenticated API requests, the backend is returning `401 Unauthorized` errors.

### Symptoms Observed:
- ✅ Login endpoint (`/api/auth/login`) returns token successfully
- ✅ Token is saved correctly on frontend (220 characters, JWT format)
- ✅ Token is sent correctly in `Authorization: Bearer <token>` header
- ❌ `/api/users/me` endpoint returns `401 Unauthorized`
- ❌ `/api/users/complete` endpoint returns `401 Unauthorized`
- ❌ Backend response: `{"success":false,"message":"Authentication required. Please login."}`

## 🔍 Root Cause Analysis

Based on the logs, the frontend is correctly:
1. Receiving the token from login
2. Saving it to AsyncStorage
3. Sending it in the `Authorization` header as `Bearer <token>`
4. Using the correct header format

**The issue is on the backend side** - the authentication middleware is not recognizing/validating the token properly.

## 📤 What the Frontend is Sending to Backend

This section details exactly what the frontend sends to the backend so you can verify what's being received.

### **1. Request Format**

The frontend sends HTTP requests using the `fetch` API with the following structure:

```typescript
// Location: utils/api.ts (lines 51-77)
const response = await fetch(`${LOCALHOST_IP}${endpoint}`, {
  headers: {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  },
  ...options,
});
```

### **2. Example Request to `/api/users/me`**

**Request Details:**
- **Method**: `GET`
- **URL**: `https://ts-backend-1-jyit.onrender.com/api/users/me`
- **Headers**:
  ```
  Content-Type: application/json
  Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2NzhmZjEyMzQ1Njc4OTAxIiwiaWF0IjoxNzM1MjM0NTY3LCJleHAiOjE3MzU4MzkzNjd9.abc123def456...
  ```

**Full Example Request (what backend receives):**
```http
GET /api/users/me HTTP/1.1
Host: ts-backend-1-jyit.onrender.com
Content-Type: application/json
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2NzhmZjEyMzQ1Njc4OTAxIiwiaWF0IjoxNzM1MjM0NTY3LCJleHAiOjE3MzU4MzkzNjd9.abc123def456...
User-Agent: ReactNative/0.76.9
Accept: */*
```

### **3. Example Request to `/api/users/complete`**

**Request Details:**
- **Method**: `GET`
- **URL**: `https://ts-backend-1-jyit.onrender.com/api/users/complete`
- **Headers**:
  ```
  Content-Type: application/json
  Authorization: Bearer <same-token-from-login>
  ```

### **4. Token Format Details**

**Token Structure:**
- **Format**: JWT (JSON Web Token)
- **Length**: ~220 characters
- **Structure**: `header.payload.signature`
- **Header**: Starts with `eyJhbGciOiJIUzI1NiIs` (base64 encoded `{"alg":"HS256","typ":"JWT"}`)

**Example Token (format):**
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2NzhmZjEyMzQ1Njc4OTAxIiwiaWF0IjoxNzM1MjM0NTY3LCJleHAiOjE3MzU4MzkzNjd9.abc123def456ghi789jkl012mno345pqr678stu901vwx234yz
```

**Token Decoded (what should be in payload):**
```json
{
  "header": {
    "alg": "HS256",
    "typ": "JWT"
  },
  "payload": {
    "userId": "678ff12345678901",
    "iat": 1735234567,
    "exp": 1735839367
  },
  "signature": "abc123def456..."
}
```

### **5. How Token is Retrieved and Sent**

**Step 1: Token Retrieval** (`utils/api.ts:19-43`)
```typescript
// First tries authTokenGetter (from AuthContext)
// Falls back to AsyncStorage
const token = await getAuthToken();
```

**Step 2: Header Construction** (`utils/api.ts:70-77`)
```typescript
const response = await fetch(`${LOCALHOST_IP}${endpoint}`, {
  headers: {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),  // ← Token added here
    ...options.headers,
  },
  ...options,
});
```

**Important Notes:**
- Token is added **only if it exists** (conditional check)
- Token is prefixed with `Bearer ` (space after Bearer is required)
- Token is sent in the `Authorization` header (not `authorization` - case-sensitive in some systems)

### **6. Frontend Logs (What We See)**

When the frontend makes a request, it logs the following (in development mode):

```javascript
// Location: utils/api.ts:60-68
[api.ts] Making API request: {
  endpoint: '/api/users/me',
  hasToken: true,
  tokenLength: 220,
  tokenPreview: 'eyJhbGciOiJIUzI1NiIs...',
  tokenSource: 'authTokenGetter' // or 'AsyncStorage'
}
```

**When authentication fails:**
```javascript
// Location: utils/api.ts:104-120
[api.ts] ⚠️ AUTHENTICATION ERROR - API request failed: {
  status: 401,
  statusText: 'Unauthorized',
  errorMessage: 'Authentication required. Please login.',
  endpoint: '/api/users/me',
  hasToken: true,
  tokenLength: 220,
  tokenPreview: 'eyJhbGciOiJIUzI1NiIs...',
  responseBody: '{"success":false,"message":"Authentication required. Please login."}',
  fullUrl: 'https://ts-backend-1-jyit.onrender.com/api/users/me',
  requestHeaders: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIs...'
  },
  isLoginFlow: true,
  willClearToken: false
}
```

### **7. How to Verify What Backend Receives**

**Add this logging to your backend authentication middleware:**

```javascript
// Add at the very start of your authentication middleware
const authenticate = async (req, res, next) => {
  // Log ALL headers to see what's being received
  console.log('[Backend] === REQUEST RECEIVED ===');
  console.log('[Backend] Method:', req.method);
  console.log('[Backend] URL:', req.url);
  console.log('[Backend] Path:', req.path);
  console.log('[Backend] All Headers:', JSON.stringify(req.headers, null, 2));
  console.log('[Backend] Authorization Header:', req.headers.authorization);
  console.log('[Backend] Authorization Header Type:', typeof req.headers.authorization);
  console.log('[Backend] Authorization Header Length:', req.headers.authorization?.length);
  
  // Check if Authorization header exists
  if (!req.headers.authorization) {
    console.log('[Backend] ❌ NO Authorization header found');
    return res.status(401).json({
      success: false,
      message: 'Authentication required. Please login.'
    });
  }
  
  // Check if it starts with "Bearer "
  if (!req.headers.authorization.startsWith('Bearer ')) {
    console.log('[Backend] ❌ Authorization header does not start with "Bearer "');
    console.log('[Backend] Received:', req.headers.authorization);
    return res.status(401).json({
      success: false,
      message: 'Authentication required. Please login.'
    });
  }
  
  // Extract token
  const token = req.headers.authorization.substring(7); // Remove "Bearer " prefix
  console.log('[Backend] ✅ Token extracted');
  console.log('[Backend] Token length:', token.length);
  console.log('[Backend] Token preview:', token.substring(0, 20) + '...');
  
  // Try to verify token
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('[Backend] ✅ Token verified successfully');
    console.log('[Backend] Decoded payload:', decoded);
    
    // Find user
    const user = await User.findById(decoded.userId);
    if (!user) {
      console.log('[Backend] ❌ User not found for ID:', decoded.userId);
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please login.'
      });
    }
    
    console.log('[Backend] ✅ User found:', user.email);
    req.user = user;
    next();
  } catch (error) {
    console.log('[Backend] ❌ Token verification failed');
    console.log('[Backend] Error name:', error.name);
    console.log('[Backend] Error message:', error.message);
    console.log('[Backend] JWT_SECRET exists:', !!process.env.JWT_SECRET);
    console.log('[Backend] JWT_SECRET length:', process.env.JWT_SECRET?.length);
    
    return res.status(401).json({
      success: false,
      message: 'Authentication required. Please login.'
    });
  }
};
```

### **8. Common Issues to Check**

**Issue 1: Header Case Sensitivity**
- Frontend sends: `Authorization` (capital A)
- Backend might be checking: `authorization` (lowercase)
- **Fix**: Check `req.headers.authorization` (Express lowercases headers)

**Issue 2: Bearer Prefix**
- Frontend sends: `Bearer <token>` (with space after Bearer)
- Backend should extract: `token = authHeader.substring(7)` (removes "Bearer ")
- **Check**: Verify substring extraction is correct

**Issue 3: Token Extraction**
- Frontend sends: `Bearer eyJhbGciOiJIUzI1NiIs...`
- Backend should receive: `req.headers.authorization = "Bearer eyJhbGciOiJIUzI1NiIs..."`
- Backend should extract: `token = "eyJhbGciOiJIUzI1NiIs..."`
- **Check**: Verify token extraction removes "Bearer " prefix correctly

**Issue 4: CORS Headers**
- Frontend might be sending `Authorization` header, but CORS might be blocking it
- **Check**: Verify CORS configuration allows `Authorization` header:
  ```javascript
  app.use(cors({
    origin: '*',
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'], // ← Must include Authorization
    exposedHeaders: ['Authorization']
  }));
  ```

### **9. Test with cURL (Exact Replication)**

To test exactly what the frontend sends, use this cURL command:

```bash
# Replace YOUR_TOKEN_HERE with actual token from login response
curl -X GET "https://ts-backend-1-jyit.onrender.com/api/users/me" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -v
```

**Expected Response:**
- If working: `200 OK` with user data
- If failing: `401 Unauthorized` with error message

### **10. Debugging Checklist**

When checking backend logs, verify:

- [ ] **Authorization header is received**: `req.headers.authorization` exists
- [ ] **Header format is correct**: Starts with `Bearer `
- [ ] **Token extraction is correct**: Token is extracted after `Bearer ` prefix
- [ ] **Token length matches**: Should be ~220 characters
- [ ] **Token format is valid**: JWT format (3 parts separated by dots)
- [ ] **JWT_SECRET is set**: `process.env.JWT_SECRET` exists and matches login route
- [ ] **Token verification works**: `jwt.verify()` succeeds
- [ ] **User lookup works**: `User.findById()` finds the user
- [ ] **CORS allows Authorization**: CORS config includes `Authorization` in `allowedHeaders`

## 🐛 Potential Backend Issues

### 1. **JWT Token Validation Middleware Not Working**
   - **Problem**: The authentication middleware might not be properly extracting or validating the token from the `Authorization` header
   - **Symptoms**: 
     - Token is sent but rejected
     - 401 errors on all authenticated endpoints
   - **Check**:
     - Verify JWT secret/key matches between token generation and validation
     - Check if middleware is extracting token from `Authorization` header correctly
     - Verify token format parsing (should extract token after "Bearer " prefix)

### 2. **Token Secret Mismatch**
   - **Problem**: The JWT secret used to sign the token during login is different from the secret used to verify it in the middleware
   - **Symptoms**: Token is valid format but fails validation
   - **Check**: Compare `JWT_SECRET` in login route vs. auth middleware

### 3. **Authentication Middleware Not Applied to Routes**
   - **Problem**: The routes `/api/users/me` and `/api/users/complete` might not have the authentication middleware applied
   - **Symptoms**: Routes return 401 even with valid token
   - **Check**: Verify route definitions include authentication middleware

### 4. **Token Expiration Issue**
   - **Problem**: Token might be expiring immediately or expiration is set incorrectly
   - **Symptoms**: Token works briefly then fails
   - **Check**: Verify token expiration time in JWT payload

### 5. **CORS or Header Issues**
   - **Problem**: Backend might not be accepting `Authorization` header due to CORS configuration
   - **Symptoms**: Token is sent but not received by backend
   - **Check**: Verify CORS configuration allows `Authorization` header

### 6. **Token Format Issue**
   - **Problem**: Backend might expect different token format or header format
   - **Symptoms**: Token is rejected despite correct format
   - **Check**: Verify backend expects `Authorization: Bearer <token>` format

## 📝 Backend Verification Checklist

### ✅ Step 1: Verify Token Generation (Login Route)
```javascript
// In your login route (/api/auth/login)
// Verify:
1. Token is generated with JWT.sign()
2. JWT_SECRET is used correctly
3. Token payload includes user ID
4. Token expiration is set correctly (e.g., '7d', '24h')
5. Token is returned in response: { token: generatedToken }
```

### ✅ Step 2: Verify Authentication Middleware
```javascript
// In your authentication middleware
// Verify:
1. Middleware extracts token from req.headers.authorization
2. Token is extracted after "Bearer " prefix
3. Token is validated with jwt.verify() using same JWT_SECRET
4. User is attached to req.user after successful validation
5. Error handling returns 401 if token is invalid
```

### ✅ Step 3: Verify Route Protection
```javascript
// In your routes (/api/users/me, /api/users/complete)
// Verify:
1. Routes are protected with authentication middleware
2. Middleware is applied before route handlers
3. req.user is available in route handlers
```

### ✅ Step 4: Test Token Manually
```javascript
// Test script to verify token works
const jwt = require('jsonwebtoken');
const token = 'eyJhbGciOiJIUzI1NiIs...'; // Your token from login

try {
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  console.log('Token is valid:', decoded);
} catch (error) {
  console.log('Token validation failed:', error.message);
}
```

## 🔧 Solutions

### Solution 1: Fix JWT Secret Mismatch
```javascript
// Ensure JWT_SECRET is the same everywhere
// .env file
JWT_SECRET=your_secret_key_here

// Login route
const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
  expiresIn: '7d'
});

// Auth middleware
const decoded = jwt.verify(token, process.env.JWT_SECRET);
```

### Solution 2: Fix Authentication Middleware
```javascript
// Authentication middleware example
const authenticate = async (req, res, next) => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please login.'
      });
    }
    
    // Extract token (remove "Bearer " prefix)
    const token = authHeader.substring(7);
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please login.'
      });
    }
    
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Find user by ID from token
    const user = await User.findById(decoded.userId);
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please login.'
      });
    }
    
    // Attach user to request
    req.user = user;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(401).json({
      success: false,
      message: 'Authentication required. Please login.'
    });
  }
};
```

### Solution 3: Apply Middleware to Routes
```javascript
// Routes file
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth'); // Your auth middleware

// Apply middleware to protected routes
router.get('/me', authenticate, async (req, res) => {
  try {
    // req.user is available here
    res.json({
      success: true,
      data: req.user
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

router.get('/complete', authenticate, async (req, res) => {
  try {
    // req.user is available here
    // Fetch complete user data
    const userData = await fetchCompleteUserData(req.user._id);
    res.json({
      success: true,
      ...userData
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;
```

### Solution 4: Fix CORS Configuration
```javascript
// CORS configuration
const cors = require('cors');

app.use(cors({
  origin: '*', // Or your frontend URL
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Authorization']
}));
```

### Solution 5: Add Debug Logging
```javascript
// Add logging to auth middleware for debugging
const authenticate = async (req, res, next) => {
  try {
    console.log('[Auth Middleware] Request headers:', {
      authorization: req.headers.authorization,
      hasAuth: !!req.headers.authorization
    });
    
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('[Auth Middleware] No valid Authorization header');
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please login.'
      });
    }
    
    const token = authHeader.substring(7);
    console.log('[Auth Middleware] Token received:', {
      tokenLength: token.length,
      tokenPreview: token.substring(0, 20) + '...'
    });
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('[Auth Middleware] Token decoded:', {
      userId: decoded.userId,
      exp: decoded.exp
    });
    
    const user = await User.findById(decoded.userId);
    if (!user) {
      console.log('[Auth Middleware] User not found for ID:', decoded.userId);
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please login.'
      });
    }
    
    console.log('[Auth Middleware] Authentication successful for user:', user.email);
    req.user = user;
    next();
  } catch (error) {
    console.error('[Auth Middleware] Error:', {
      message: error.message,
      name: error.name
    });
    return res.status(401).json({
      success: false,
      message: 'Authentication required. Please login.'
    });
  }
};
```

## 🧪 Testing Steps

### Test 1: Verify Token Generation
1. Login via frontend or Postman
2. Copy the token from response
3. Decode token at https://jwt.io to verify:
   - Token structure is correct
   - Payload contains user ID
   - Expiration is set correctly

### Test 2: Test Token Manually
```bash
# Using curl
curl -X GET https://your-backend-url/api/users/me \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json"
```

### Test 3: Check Backend Logs
1. Enable debug logging in authentication middleware
2. Make request from frontend
3. Check backend logs to see:
   - Is token received?
   - Is token validated?
   - What error occurs?

## 📊 Frontend Logs Analysis

From the frontend logs, we can see:
- ✅ Token is 220 characters (valid JWT length)
- ✅ Token starts with `eyJhbGciOiJIUzI1NiIs` (valid JWT header)
- ✅ Token is sent in `Authorization: Bearer <token>` format
- ❌ Backend returns `{"success":false,"message":"Authentication required. Please login."}`

**This confirms the issue is on the backend** - the token format and sending is correct, but backend is not accepting it.

## 🎯 Priority Actions

1. **Immediate**: Check authentication middleware is correctly extracting token from `Authorization` header
2. **High**: Verify JWT_SECRET matches between login and middleware
3. **High**: Verify routes are protected with authentication middleware
4. **Medium**: Add debug logging to authentication middleware
5. **Medium**: Test token validation manually

## 📞 Next Steps

1. Backend team should review authentication middleware
2. Verify JWT_SECRET is consistent
3. Check route protection is applied
4. Add debug logging to identify exact failure point
5. Test token manually using curl/Postman

## 🔗 Related Files

- Frontend: `utils/api.ts` - API request function
- Frontend: `AuthContext/AuthContextImproved.js` - Token management
- Frontend: `Screens/ACCOUNT_AUTH/LoginScreen.js` - Login flow
- Backend: Authentication middleware (needs review)
- Backend: Login route (needs verification)
- Backend: User routes (needs middleware check)

