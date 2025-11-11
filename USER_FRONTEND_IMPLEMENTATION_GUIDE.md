# 🚀 User Frontend Implementation Guide

Complete guide for integrating the **user-facing** features with the TrafficSlight Backend API.

> **Note:** This guide is for **regular users only**. Admin features are excluded from this documentation.

---

## 📋 Table of Contents

1. [Getting Started](#getting-started)
2. [API Configuration](#api-configuration)
3. [Authentication](#authentication)
4. [User Management](#user-management)
5. [Motorcycle & Vehicle Management](#motorcycle--vehicle-management)
6. [Trip Management](#trip-management)
7. [Fuel Logging](#fuel-logging)
8. [Maintenance Records](#maintenance-records)
9. [Gas Stations](#gas-stations)
10. [Saved Destinations](#saved-destinations)
11. [Notifications](#notifications)
12. [User Analytics & Statistics](#user-analytics--statistics)
13. [Data Models](#data-models)
14. [Error Handling](#error-handling)
15. [Code Examples](#code-examples)
16. [Best Practices](#best-practices)

---

## 🚦 Getting Started

### Base URL Configuration

```javascript
// Environment Configuration
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
// Production
const API_BASE_URL = 'https://your-production-domain.com/api';
```

### Required Headers

```javascript
const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${token}` // For authenticated requests
};
```

---

## ⚙️ API Configuration

### Environment Variables

Create a `.env` file in your frontend project:

```env
REACT_APP_API_URL=http://localhost:5000/api
REACT_APP_BASE_URL=http://localhost:5000
REACT_APP_GOOGLE_MAPS_API_KEY=your_google_maps_api_key
```

---

## 🔐 Authentication

All authentication endpoints are user-facing and do not require authentication (except for protected operations).

### 1. Register User

**Endpoint:** `POST /api/auth/register`

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "firstName": "John",
  "lastName": "Doe",
  "phone": "+1234567890"
}
```

**Response:**
```json
{
  "message": "User created successfully",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "_id": "507f1f77bcf86cd799439011",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "phone": "+1234567890"
  }
}
```

**JavaScript Example:**
```javascript
const register = async (userData) => {
  const response = await fetch(`${API_BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(userData)
  });
  const data = await response.json();
  if (response.ok) {
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    return data;
  }
  throw new Error(data.message || 'Registration failed');
};
```

### 2. Login

**Endpoint:** `POST /api/auth/login`

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "_id": "507f1f77bcf86cd799439011",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "phone": "+1234567890",
    "preferences": {
      "units": "metric",
      "language": "en",
      "notifications": true,
      "theme": "auto"
    }
  }
}
```

**JavaScript Example:**
```javascript
const login = async (email, password) => {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const data = await response.json();
  if (response.ok) {
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    return data;
  }
  throw new Error(data.message || 'Login failed');
};
```

### 3. Verify Token

**Endpoint:** `GET /api/auth/verify-token`

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "valid": true,
  "user": {
    "_id": "507f1f77bcf86cd799439011",
    "email": "user@example.com"
  }
}
```

### 4. Get Profile

**Endpoint:** `GET /api/auth/profile`

**Headers:**
```
Authorization: Bearer <token>
```

### 5. Request Password Reset OTP

**Endpoint:** `POST /api/auth/reset-password`

**Note:** This endpoint does NOT require authentication. Users who forgot their password can request an OTP.

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

**Response:**
```json
{
  "message": "OTP code has been sent to your email",
  "success": true
}
```

**JavaScript Example:**
```javascript
const requestPasswordResetOTP = async (email) => {
  const response = await fetch(`${API_BASE_URL}/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email })
  });
  const data = await response.json();
  if (response.ok) {
    return data;
  }
  throw new Error(data.message || 'Failed to send OTP');
};
```

**Note:** 
- OTP code expires in 10 minutes
- In development, check console logs for the OTP code
- In production, OTP will be sent via email/SMS

### 6. Verify OTP Code

**Endpoint:** `POST /api/auth/verify-reset`

**Note:** This endpoint does NOT require authentication. Used to verify the OTP code before resetting password.

**Request Body:**
```json
{
  "email": "user@example.com",
  "otpCode": "123456"
}
```

**Response:**
```json
{
  "message": "OTP code verified successfully",
  "success": true,
  "verified": true
}
```

**JavaScript Example:**
```javascript
const verifyOTP = async (email, otpCode) => {
  const response = await fetch(`${API_BASE_URL}/auth/verify-reset`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, otpCode })
  });
  const data = await response.json();
  if (response.ok && data.verified) {
    return data;
  }
  throw new Error(data.message || 'Invalid OTP code');
};
```

### 7. Reset Password with OTP

**Endpoint:** `POST /api/auth/reset-password-with-otp`

**Note:** This endpoint does NOT require authentication. Users can reset their password using a verified OTP code.

**Request Body:**
```json
{
  "email": "user@example.com",
  "otpCode": "123456",
  "newPassword": "newpassword123"
}
```

**Response:**
```json
{
  "message": "Password reset successfully",
  "success": true
}
```

**JavaScript Example:**
```javascript
const resetPasswordWithOTP = async (email, otpCode, newPassword) => {
  const response = await fetch(`${API_BASE_URL}/auth/reset-password-with-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, otpCode, newPassword })
  });
  const data = await response.json();
  if (response.ok) {
    return data;
  }
  throw new Error(data.message || 'Failed to reset password');
};
```

**Complete Password Reset Flow:**
```javascript
// Step 1: Request OTP
const step1 = await requestPasswordResetOTP('user@example.com');
// OTP sent to email (or check console in development)

// Step 2: User enters OTP and verify it
const step2 = await verifyOTP('user@example.com', '123456');

// Step 3: Reset password with verified OTP
const step3 = await resetPasswordWithOTP('user@example.com', '123456', 'newpassword123');
```

### 8. Change Password (When Logged In)

**Endpoint:** `POST /api/auth/change-password`

**Request Body:**
```json
{
  "currentPassword": "oldpassword",
  "newPassword": "newpassword"
}
```

**Headers:**
```
Authorization: Bearer <token>
```

### 9. Logout

**Endpoint:** `POST /api/auth/logout`

**Headers:**
```
Authorization: Bearer <token>
```

---

## 👤 User Management

### Get Current User

**Endpoint:** `GET /api/users/me` or `GET /api/users/current`

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "_id": "507f1f77bcf86cd799439011",
  "email": "user@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "name": "John Doe",
  "phone": "+1234567890",
  "city": "Manila",
  "province": "Metro Manila",
  "barangay": "Makati",
  "street": "Main Street",
  "location": {
    "lat": 14.5995,
    "lng": 120.9842
  },
  "preferences": {
    "units": "metric",
    "language": "en",
    "notifications": true,
    "theme": "auto"
  },
  "role": "user",
  "isActive": true,
  "isVerified": false,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

### Get Complete User Data

**Endpoint:** `GET /api/users/complete` or `GET /api/users/full-data`

Returns user with all related data (trips, fuel logs, maintenance, motors, etc.)

**Response:**
```json
{
  "user": {
    "_id": "507f1f77bcf86cd799439011",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe"
  },
  "trips": [...],
  "fuelLogs": [...],
  "maintenanceRecords": [...],
  "motors": [...],
  "statistics": {
    "totalTrips": 50,
    "totalDistance": 1500,
    "totalFuelUsed": 30
  }
}
```

### Get User Profile

**Endpoint:** `GET /api/users/profile`

### Update User Profile

**Endpoint:** `PUT /api/users/profile`

**Request Body:**
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "phone": "+1234567890",
  "city": "Manila",
  "province": "Metro Manila",
  "barangay": "Makati",
  "street": "Main Street",
  "location": {
    "lat": 14.5995,
    "lng": 120.9842
  }
}
```

### Get User Preferences

**Endpoint:** `GET /api/users/preferences`

### Update User Preferences

**Endpoint:** `PUT /api/users/preferences`

**Request Body:**
```json
{
  "units": "metric",
  "language": "en",
  "notifications": true,
  "theme": "dark"
}
```

**Preference Options:**
- `units`: `"metric"` | `"imperial"`
- `language`: String (e.g., `"en"`, `"es"`, `"fr"`)
- `notifications`: Boolean
- `theme`: `"light"` | `"dark"` | `"auto"`

### Change Password (User Endpoint)

**Endpoint:** `PUT /api/users/change-password`

**Request Body:**
```json
{
  "currentPassword": "oldpassword",
  "newPassword": "newpassword"
}
```

### Get User Statistics

**Endpoint:** `GET /api/users/stats`

**Response:**
```json
{
  "totalTrips": 50,
  "totalDistance": 1500,
  "totalFuelSpent": 1950.00,
  "totalFuelUsed": 30,
  "averageFuelEfficiency": 55,
  "averageCostPerTrip": 39.00,
  "favoriteMotor": {
    "_id": "507f1f77bcf86cd799439013",
    "nickname": "My Bike",
    "tripCount": 30
  }
}
```

### Get Dashboard Data

**Endpoint:** `GET /api/users/dashboard` or `GET /api/dashboard/overview`

**Response:**
```json
{
  "user": {
    "_id": "507f1f77bcf86cd799439011",
    "name": "John Doe"
  },
  "statistics": {
    "totalTrips": 50,
    "totalDistance": 1500,
    "totalFuelUsed": 30,
    "totalCost": 1950.00
  },
  "recentTrips": [...],
  "recentFuelLogs": [...],
  "maintenanceAlerts": [...],
  "fuelLevel": 75
}
```

### Get User Settings

**Endpoint:** `GET /api/users/settings`

### Update User Settings

**Endpoint:** `PUT /api/users/settings`

### Get User Notifications

**Endpoint:** `GET /api/users/notifications`

**Response:**
```json
[
  {
    "_id": "507f1f77bcf86cd799439011",
    "title": "Maintenance Due",
    "message": "Your bike needs an oil change",
    "type": "maintenance",
    "isRead": false,
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
]
```

### Mark Notification as Read

**Endpoint:** `PUT /api/users/notifications/:notificationId/read`

### Get User Activity Log

**Endpoint:** `GET /api/users/activity`

### Export User Data

**Endpoint:** `GET /api/users/export`

Returns user data in exportable format (JSON/CSV)

### Deactivate Account

**Endpoint:** `PUT /api/users/deactivate`

### Reactivate Account

**Endpoint:** `PUT /api/users/reactivate`

### Delete Account

**Endpoint:** `DELETE /api/users/delete`

---

## 🏍️ Motorcycle & Vehicle Management

### Get All Motorcycles (Available Models)

**Endpoint:** `GET /api/motorcycles`

**Response:**
```json
[
  {
    "_id": "507f1f77bcf86cd799439011",
    "model": "Honda CBR150R",
    "engineDisplacement": 150,
    "power": "17.1 HP",
    "torque": "14.4 Nm",
    "fuelTank": 12,
    "fuelConsumption": 50,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
]
```

**Note:** This endpoint returns all available motorcycle models. Users cannot create new motorcycle models.

### Get Motorcycle Count

**Endpoint:** `GET /api/motorcycles/count`

**Response:**
```json
{
  "count": 50
}
```

---

## 🚗 User Motor Management

### Get User Motors

**Endpoint:** `GET /api/user-motors/user/:userId`

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
[
  {
    "_id": "507f1f77bcf86cd799439011",
    "userId": "507f1f77bcf86cd799439012",
    "motorcycleId": {
      "_id": "507f1f77bcf86cd799439013",
      "model": "Honda CBR150R",
      "fuelConsumption": 50,
      "fuelTank": 12
    },
    "nickname": "My Bike",
    "plateNumber": "ABC-1234",
    "registrationDate": "2024-01-01T00:00:00.000Z",
    "dateAcquired": "2024-01-01T00:00:00.000Z",
    "odometerAtAcquisition": 0,
    "currentOdometer": 1500,
    "age": 1,
    "currentFuelLevel": 75,
    "currentFuelEfficiency": 55,
    "analytics": {
      "tripsCompleted": 50,
      "totalDistance": 1500,
      "totalFuelUsed": 30,
      "maintenanceAlerts": []
    },
    "fuelConsumptionStats": {
      "average": 55,
      "max": 60,
      "min": 50
    }
  }
]
```

### Create User Motor

**Endpoint:** `POST /api/user-motors`

**Request Body:**
```json
{
  "userId": "507f1f77bcf86cd799439012",
  "motorcycleId": "507f1f77bcf86cd799439013",
  "nickname": "My Bike",
  "plateNumber": "ABC-1234",
  "registrationDate": "2024-01-01",
  "dateAcquired": "2024-01-01",
  "odometerAtAcquisition": 0
}
```

### Update User Motor

**Endpoint:** `PUT /api/user-motors/:id`

**Request Body:**
```json
{
  "nickname": "Updated Bike Name",
  "plateNumber": "XYZ-5678",
  "currentOdometer": 2000
}
```

### Delete User Motor

**Endpoint:** `DELETE /api/user-motors/:id`

### Update Fuel Level

**Endpoint:** `PUT /api/user-motors/:id/fuel`

**Request Body:**
```json
{
  "currentFuelLevel": 75
}
```

**Note:** `currentFuelLevel` is a percentage (0-100)

### Update Fuel Efficiency

**Endpoint:** `PUT /api/user-motors/:id/updateEfficiency`

**Request Body:**
```json
{
  "currentFuelEfficiency": 55
}
```

**Note:** `currentFuelEfficiency` is in km/L

### Log Oil Change

**Endpoint:** `POST /api/user-motors/:id/oil-change`

**Response:**
```json
{
  "success": true,
  "message": "Oil change logged successfully",
  "motor": {
    "_id": "507f1f77bcf86cd799439011",
    "changeOilHistory": [
      {
        "date": "2024-01-01T10:00:00.000Z"
      }
    ]
  }
}
```

### Log Tune Up

**Endpoint:** `POST /api/user-motors/:id/tune-up`

### Get User Overview Analytics

**Endpoint:** `GET /api/user-motors/user-overview/:userId`

**Response:**
```json
{
  "userId": "507f1f77bcf86cd799439012",
  "totalMotors": 2,
  "totalTrips": 100,
  "totalDistance": 3000,
  "totalFuelUsed": 60,
  "motors": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "nickname": "My Bike",
      "tripsCompleted": 50,
      "totalDistance": 1500
    }
  ]
}
```

### Get Motor Overview Analytics

**Endpoint:** `GET /api/user-motors/motor-overview/:motorId`

**Response:**
```json
{
  "motorId": "507f1f77bcf86cd799439011",
  "nickname": "My Bike",
  "tripsCompleted": 50,
  "totalDistance": 1500,
  "totalFuelUsed": 30,
  "averageFuelEfficiency": 55,
  "maintenanceCount": 5,
  "lastMaintenance": "2024-01-01T10:00:00.000Z"
}
```

### Get User Motor Count

**Endpoint:** `GET /api/user-motors/count`

---

## 🗺️ Trip Management

### Get User Trips

**Endpoint:** `GET /api/trips/user/:userId`

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
[
  {
    "_id": "507f1f77bcf86cd799439011",
    "userId": {
      "_id": "507f1f77bcf86cd799439012",
      "name": "John Doe",
      "email": "john@example.com"
    },
    "motorId": {
      "_id": "507f1f77bcf86cd799439013",
      "nickname": "My Bike",
      "motorcycleId": {
        "model": "Honda CBR150R",
        "engineDisplacement": 150
      }
    },
    "distance": 25.5,
    "fuelUsedMin": 0.5,
    "fuelUsedMax": 0.6,
    "eta": "14:30",
    "timeArrived": "14:35",
    "tripStartTime": "2024-01-01T14:00:00.000Z",
    "tripEndTime": "2024-01-01T14:35:00.000Z",
    "actualDistance": 26.0,
    "actualFuelUsedMin": 0.52,
    "actualFuelUsedMax": 0.60,
    "duration": 35,
    "kmph": 45,
    "startLocation": {
      "address": "Manila, Philippines",
      "lat": 14.5995,
      "lng": 120.9842
    },
    "endLocation": {
      "address": "Makati, Philippines",
      "lat": 14.5547,
      "lng": 121.0244
    },
    "destination": "Makati City",
    "status": "completed",
    "isSuccessful": true,
    "trafficCondition": "moderate",
    "createdAt": "2024-01-01T14:00:00.000Z",
    "updatedAt": "2024-01-01T14:35:00.000Z"
  }
]
```

### Create Trip

**Endpoint:** `POST /api/trips`

**Request Body:**
```json
{
  "userId": "507f1f77bcf86cd799439012",
  "motorId": "507f1f77bcf86cd799439013",
  "distance": 25.5,
  "fuelUsedMin": 0.5,
  "fuelUsedMax": 0.6,
  "eta": "14:30",
  "destination": "Makati City",
  "startLocation": {
    "address": "Manila, Philippines",
    "lat": 14.5995,
    "lng": 120.9842
  },
  "endLocation": {
    "address": "Makati, Philippines",
    "lat": 14.5547,
    "lng": 121.0244
  },
  "status": "planned"
}
```

**Trip Status Options:**
- `"planned"` - Trip is planned but not started
- `"in-progress"` - Trip is currently in progress
- `"completed"` - Trip is completed
- `"cancelled"` - Trip was cancelled

**JavaScript Example:**
```javascript
const createTrip = async (tripData, token) => {
  const response = await fetch(`${API_BASE_URL}/trips`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(tripData)
  });
  const data = await response.json();
  if (response.ok) {
    return data;
  }
  throw new Error(data.message || 'Failed to create trip');
};
```

### Get Trip Analytics Summary

**Endpoint:** `GET /api/trips/analytics/summary`

**Response:**
```json
{
  "totalTrips": 50,
  "completedTrips": 45,
  "cancelledTrips": 5,
  "totalDistance": 1500,
  "averageDistance": 30,
  "totalFuelUsed": 30,
  "averageFuelPerTrip": 0.6
}
```

### Get Monthly Trip Summary

**Endpoint:** `GET /api/trips/analytics/monthly`

**Response:**
```json
[
  {
    "month": "2024-01",
    "tripCount": 15,
    "totalDistance": 450,
    "totalFuelUsed": 9
  },
  {
    "month": "2024-02",
    "tripCount": 18,
    "totalDistance": 540,
    "totalFuelUsed": 10.8
  }
]
```

### Get Top Users by Trip Count

**Endpoint:** `GET /api/trips/insights/top-users`

**Note:** This endpoint shows top users in the system. Use with discretion.

### Get Most Used Motors

**Endpoint:** `GET /api/trips/insights/top-motors`

**Response:**
```json
[
  {
    "motorId": "507f1f77bcf86cd799439013",
    "model": "Honda CBR150R",
    "tripCount": 30,
    "totalDistance": 900
  }
]
```

---

## ⛽ Fuel Logging

### Get Fuel Logs by User

**Endpoint:** `GET /api/fuel-logs/:userId`

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
[
  {
    "_id": "507f1f77bcf86cd799439011",
    "userId": "507f1f77bcf86cd799439012",
    "motorId": {
      "_id": "507f1f77bcf86cd799439013",
      "nickname": "My Bike",
      "motorcycleId": {
        "model": "Honda CBR150R",
        "fuelConsumption": 50
      }
    },
    "liters": 10,
    "pricePerLiter": 65.50,
    "totalCost": 655.00,
    "odometer": 1500,
    "fuelType": "gasoline",
    "location": {
      "lat": 14.5995,
      "lng": 120.9842
    },
    "notes": "Full tank",
    "date": "2024-01-01T10:00:00.000Z",
    "createdAt": "2024-01-01T10:00:00.000Z",
    "updatedAt": "2024-01-01T10:00:00.000Z"
  }
]
```

### Create Fuel Log

**Endpoint:** `POST /api/fuel-logs`

**Request Body:**
```json
{
  "userId": "507f1f77bcf86cd799439012",
  "motorId": "507f1f77bcf86cd799439013",
  "liters": 10,
  "pricePerLiter": 65.50,
  "odometer": 1500,
  "fuelType": "gasoline",
  "location": {
    "lat": 14.5995,
    "lng": 120.9842
  },
  "notes": "Full tank"
}
```

**Note:** `totalCost` is automatically calculated as `liters * pricePerLiter`

**Fuel Type Options:**
- `"gasoline"`
- `"diesel"`
- `"premium"`
- `"unleaded"`

**JavaScript Example:**
```javascript
const createFuelLog = async (fuelLogData, token) => {
  const response = await fetch(`${API_BASE_URL}/fuel-logs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(fuelLogData)
  });
  const data = await response.json();
  if (response.ok) {
    return data;
  }
  throw new Error(data.message || 'Failed to create fuel log');
};
```

### Update Fuel Log

**Endpoint:** `PUT /api/fuel-logs/:id`

**Request Body:**
```json
{
  "liters": 12,
  "pricePerLiter": 66.00,
  "notes": "Updated entry"
}
```

### Delete Fuel Log

**Endpoint:** `DELETE /api/fuel-logs/:id`

### Get Fuel Log Count

**Endpoint:** `GET /api/fuel-logs/count`

**Response:**
```json
{
  "count": 100
}
```

---

## 🔧 Maintenance Records

### Get Maintenance Records by User

**Endpoint:** `GET /api/maintenance-records/user/:userId`

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
[
  {
    "_id": "507f1f77bcf86cd799439011",
    "userId": "507f1f77bcf86cd799439012",
    "motorId": "507f1f77bcf86cd799439013",
    "type": "oil_change",
    "timestamp": "2024-01-01T10:00:00.000Z",
    "location": {
      "lat": 14.5995,
      "lng": 120.9842
    },
    "details": {
      "cost": 500,
      "quantity": 1,
      "notes": "Regular oil change"
    },
    "createdAt": "2024-01-01T10:00:00.000Z",
    "updatedAt": "2024-01-01T10:00:00.000Z"
  }
]
```

### Create Maintenance Record

**Endpoint:** `POST /api/maintenance-records`

**Request Body:**
```json
{
  "userId": "507f1f77bcf86cd799439012",
  "motorId": "507f1f77bcf86cd799439013",
  "type": "oil_change",
  "location": {
    "lat": 14.5995,
    "lng": 120.9842
  },
  "details": {
    "cost": 500,
    "quantity": 1,
    "notes": "Regular oil change"
  }
}
```

**Maintenance Types:**
- `"oil_change"`
- `"tune_up"`
- `"refuel"`
- `"repair"`
- `"other"`

### Get Maintenance Record by ID

**Endpoint:** `GET /api/maintenance-records/:id`

### Update Maintenance Record

**Endpoint:** `PUT /api/maintenance-records/:id`

### Delete Maintenance Record

**Endpoint:** `DELETE /api/maintenance-records/:id`

### Get Maintenance by Motor

**Endpoint:** `GET /api/maintenance-records/motor/:motorId`

---

## 🗺️ Gas Stations

### Get Nearby Gas Stations

**Endpoint:** `GET /api/gas-stations/nearby?lat=14.5995&lng=120.9842&radius=5000`

**Query Parameters:**
- `lat` (required): Latitude
- `lng` (required): Longitude
- `radius` (optional): Radius in meters (default: 5000)

**Response:**
```json
[
  {
    "_id": "507f1f77bcf86cd799439011",
    "name": "Shell Station",
    "address": "Makati Avenue, Makati",
    "location": {
      "lat": 14.5547,
      "lng": 121.0244
    },
    "phoneNumber": "+6321234567",
    "isOpen24Hours": true,
    "currentPrice": 65.50,
    "distance": 2500
  }
]
```

**JavaScript Example:**
```javascript
const getNearbyGasStations = async (lat, lng, radius = 5000) => {
  const response = await fetch(
    `${API_BASE_URL}/gas-stations/nearby?lat=${lat}&lng=${lng}&radius=${radius}`,
    {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    }
  );
  return response.json();
};
```

### Get All Gas Stations

**Endpoint:** `GET /api/gas-stations`

**Response:**
```json
[
  {
    "_id": "507f1f77bcf86cd799439011",
    "name": "Shell Station",
    "address": "Makati Avenue, Makati",
    "location": {
      "lat": 14.5547,
      "lng": 121.0244
    },
    "phoneNumber": "+6321234567",
    "isOpen24Hours": true,
    "currentPrice": 65.50,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
]
```

### Get Gas Station by ID

**Endpoint:** `GET /api/gas-stations/:id`

### Get Price History by Station

**Endpoint:** `GET /api/gas-stations/history/:id`

**Response:**
```json
[
  {
    "date": "2024-01-01T00:00:00.000Z",
    "price": 65.50
  },
  {
    "date": "2024-01-15T00:00:00.000Z",
    "price": 66.00
  }
]
```

---

## 📍 Saved Destinations

### Get User Destinations

**Endpoint:** `GET /api/saved-destinations/:userId`

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
[
  {
    "_id": "507f1f77bcf86cd799439011",
    "userId": "507f1f77bcf86cd799439012",
    "name": "Home",
    "address": "Manila, Philippines",
    "location": {
      "lat": 14.5995,
      "lng": 120.9842
    },
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
]
```

### Add Saved Destination

**Endpoint:** `POST /api/saved-destinations`

**Request Body:**
```json
{
  "userId": "507f1f77bcf86cd799439012",
  "name": "Home",
  "address": "Manila, Philippines",
  "location": {
    "lat": 14.5995,
    "lng": 120.9842
  }
}
```

### Update Saved Destination

**Endpoint:** `PUT /api/saved-destinations/:id`

**Request Body:**
```json
{
  "name": "Updated Home",
  "address": "Updated Address",
  "location": {
    "lat": 14.5995,
    "lng": 120.9842
  }
}
```

### Delete Saved Destination

**Endpoint:** `DELETE /api/saved-destinations/:id`

---

## 🔔 Notifications

### Get User Notifications

**Endpoint:** `GET /api/notifications/:userId`

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
[
  {
    "_id": "507f1f77bcf86cd799439011",
    "userId": "507f1f77bcf86cd799439012",
    "title": "Maintenance Due",
    "message": "Your bike needs an oil change",
    "type": "maintenance",
    "isRead": false,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
]
```

### Create Notification

**Endpoint:** `POST /api/notifications`

**Request Body:**
```json
{
  "userId": "507f1f77bcf86cd799439012",
  "title": "Maintenance Due",
  "message": "Your bike needs an oil change",
  "type": "maintenance"
}
```

### Mark Notification as Read

**Endpoint:** `PUT /api/notifications/read/:id`

**Response:**
```json
{
  "success": true,
  "message": "Notification marked as read",
  "notification": {
    "_id": "507f1f77bcf86cd799439011",
    "isRead": true
  }
}
```

### Delete Notification

**Endpoint:** `DELETE /api/notifications/:id`

---

## 📊 User Analytics & Statistics

### Generate Daily Analytics

**Endpoint:** `GET /api/analytics/generate-daily`

### Get Motor Daily Analytics History

**Endpoint:** `GET /api/analytics/daily-history/:motorId`

**Response:**
```json
[
  {
    "date": "2024-01-01",
    "motorId": "507f1f77bcf86cd799439013",
    "distance": 50,
    "fuelUsed": 1,
    "averageSpeed": 45,
    "tripCount": 2
  }
]
```

### Get User Analytics Timeline

**Endpoint:** `GET /api/analytics/user-timeline/:userId`

**Response:**
```json
{
  "userId": "507f1f77bcf86cd799439012",
  "timeline": [
    {
      "date": "2024-01-01",
      "trips": 5,
      "distance": 150,
      "fuelUsed": 3
    }
  ],
  "summary": {
    "totalTrips": 50,
    "totalDistance": 1500,
    "totalFuelUsed": 30
  }
}
```

### Get User Fuel Log Trend

**Endpoint:** `GET /api/analytics/fuel-log-trend/:userId`

**Response:**
```json
{
  "userId": "507f1f77bcf86cd799439012",
  "trends": [
    {
      "date": "2024-01-01",
      "totalLiters": 10,
      "totalCost": 655.00,
      "averagePrice": 65.50
    }
  ],
  "statistics": {
    "averageLitersPerRefuel": 10,
    "averageCostPerRefuel": 655.00,
    "totalRefuels": 10
  }
}
```

### Get Fuel Stats by Motor

**Endpoint:** `GET /api/fuel-stats/:motorId`

**Response:**
```json
{
  "motorId": "507f1f77bcf86cd799439013",
  "totalLiters": 100,
  "totalCost": 6550.00,
  "averagePricePerLiter": 65.50,
  "averageFuelEfficiency": 55,
  "lastFuelLog": {
    "_id": "507f1f77bcf86cd799439011",
    "date": "2024-01-01T10:00:00.000Z",
    "liters": 10,
    "pricePerLiter": 65.50
  }
}
```

### Get Dashboard Overview

**Endpoint:** `GET /api/dashboard/overview`

**Headers:**
```
Authorization: Bearer <token>
```

### Get Dashboard Stats

**Endpoint:** `GET /api/dashboard/stats`

### Get Dashboard Analytics

**Endpoint:** `GET /api/dashboard/analytics`

---

## 📝 Data Models

### User Model

```typescript
interface User {
  _id: string;
  email: string;
  firstName: string;
  lastName: string;
  name: string;
  phone?: string;
  city: string;
  province: string;
  barangay: string;
  street: string;
  location?: {
    lat: number;
    lng: number;
  };
  preferences: {
    units: 'metric' | 'imperial';
    language: string;
    notifications: boolean;
    theme: 'light' | 'dark' | 'auto';
  };
  role: 'user' | 'admin';
  isActive: boolean;
  isVerified: boolean;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}
```

### Motorcycle Model

```typescript
interface Motorcycle {
  _id: string;
  model: string;
  engineDisplacement?: number;
  power?: string;
  torque?: string;
  fuelTank?: number;
  fuelConsumption: number; // km/L
  createdAt: Date;
  updatedAt: Date;
}
```

### UserMotor Model

```typescript
interface UserMotor {
  _id: string;
  userId: string;
  motorcycleId: string;
  nickname?: string;
  plateNumber?: string;
  registrationDate?: Date;
  dateAcquired?: Date;
  odometerAtAcquisition?: number;
  currentOdometer: number;
  age?: number;
  currentFuelLevel: number; // Percentage 0-100
  currentFuelEfficiency: number; // km/L
  fuelConsumptionStats: {
    average: number;
    max: number;
    min: number;
  };
  analytics: {
    tripsCompleted: number;
    totalDistance: number;
    totalFuelUsed: number;
    maintenanceAlerts: string[];
  };
  createdAt: Date;
  updatedAt: Date;
}
```

### Trip Model

```typescript
interface Trip {
  _id: string;
  userId: string;
  motorId: string;
  distance: number; // km
  fuelUsedMin: number; // liters
  fuelUsedMax: number; // liters
  eta?: string;
  timeArrived?: string;
  tripStartTime: Date;
  tripEndTime?: Date;
  actualDistance?: number; // km
  actualFuelUsedMin?: number; // liters
  actualFuelUsedMax?: number; // liters
  duration?: number; // minutes
  kmph?: number; // km/h
  startLocation?: {
    address: string;
    lat: number;
    lng: number;
  };
  endLocation?: {
    address: string;
    lat: number;
    lng: number;
  };
  destination: string;
  isSuccessful: boolean;
  status: 'planned' | 'in-progress' | 'completed' | 'cancelled';
  trafficCondition: 'light' | 'moderate' | 'heavy';
  createdAt: Date;
  updatedAt: Date;
}
```

### FuelLog Model

```typescript
interface FuelLog {
  _id: string;
  userId: string;
  motorId: string;
  liters: number;
  pricePerLiter: number;
  totalCost: number; // Auto-calculated
  odometer?: number;
  fuelType: 'gasoline' | 'diesel' | 'premium' | 'unleaded';
  location?: {
    lat: number;
    lng: number;
  };
  notes?: string;
  date: Date;
  createdAt: Date;
  updatedAt: Date;
}
```

### MaintenanceRecord Model

```typescript
interface MaintenanceRecord {
  _id: string;
  userId: string;
  motorId: string;
  type: 'oil_change' | 'tune_up' | 'refuel' | 'repair' | 'other';
  timestamp: Date;
  location?: {
    lat: number;
    lng: number;
  };
  details: {
    cost?: number;
    quantity?: number;
    notes?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}
```

### GasStation Model

```typescript
interface GasStation {
  _id: string;
  name: string;
  address: string;
  location: {
    lat: number;
    lng: number;
  };
  phoneNumber?: string;
  isOpen24Hours: boolean;
  currentPrice?: number;
  createdAt: Date;
  updatedAt: Date;
}
```

### SavedDestination Model

```typescript
interface SavedDestination {
  _id: string;
  userId: string;
  name: string;
  address: string;
  location: {
    lat: number;
    lng: number;
  };
  createdAt: Date;
  updatedAt: Date;
}
```

### Notification Model

```typescript
interface Notification {
  _id: string;
  userId: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

---

## ⚠️ Error Handling

### Standard Error Response Format

```json
{
  "success": false,
  "message": "Error message",
  "error": "Detailed error description"
}
```

### HTTP Status Codes

- `200 OK` - Success
- `201 Created` - Resource created successfully
- `400 Bad Request` - Invalid request data
- `401 Unauthorized` - Authentication required or token invalid
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Resource not found
- `500 Internal Server Error` - Server error

### Error Handling Example

```javascript
const handleApiError = async (response) => {
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || `HTTP error! status: ${response.status}`);
  }
  return response.json();
};

// Usage
try {
  const data = await fetch(`${API_BASE_URL}/trips`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  }).then(handleApiError);
} catch (error) {
  console.error('API Error:', error.message);
  // Handle error in UI
}
```

---

## 💻 Code Examples

### API Service Class

```javascript
class UserApiService {
  constructor(baseURL) {
    this.baseURL = baseURL;
    this.token = localStorage.getItem('token');
  }

  setToken(token) {
    this.token = token;
    localStorage.setItem('token', token);
  }

  getHeaders() {
    const headers = {
      'Content-Type': 'application/json'
    };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    return headers;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      ...options,
      headers: {
        ...this.getHeaders(),
        ...options.headers
      }
    };

    try {
      const response = await fetch(url, config);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || `HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('API Request Error:', error);
      throw error;
    }
  }

  // Auth methods
  async register(userData) {
    const data = await this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData)
    });
    if (data.token) {
      this.setToken(data.token);
    }
    return data;
  }

  async login(email, password) {
    const data = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    if (data.token) {
      this.setToken(data.token);
    }
    return data;
  }

  async logout() {
    await this.request('/auth/logout', { method: 'POST' });
    this.token = null;
    localStorage.removeItem('token');
  }

  // Password Reset Methods (No Auth Required)
  async requestPasswordResetOTP(email) {
    return this.request('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ email })
    });
  }

  async verifyOTP(email, otpCode) {
    return this.request('/auth/verify-reset', {
      method: 'POST',
      body: JSON.stringify({ email, otpCode })
    });
  }

  async resetPasswordWithOTP(email, otpCode, newPassword) {
    return this.request('/auth/reset-password-with-otp', {
      method: 'POST',
      body: JSON.stringify({ email, otpCode, newPassword })
    });
  }

  // User methods
  async getCurrentUser() {
    return this.request('/users/me');
  }

  async updateProfile(profileData) {
    return this.request('/users/profile', {
      method: 'PUT',
      body: JSON.stringify(profileData)
    });
  }

  async getUserStats(userId) {
    return this.request(`/users/stats/${userId}`);
  }

  async getDashboardData(userId) {
    return this.request(`/users/dashboard/${userId}`);
  }

  // Trip methods
  async getUserTrips(userId) {
    return this.request(`/trips/user/${userId}`);
  }

  async createTrip(tripData) {
    return this.request('/trips', {
      method: 'POST',
      body: JSON.stringify(tripData)
    });
  }

  // Fuel Log methods
  async getFuelLogs(userId) {
    return this.request(`/fuel-logs/${userId}`);
  }

  async createFuelLog(fuelLogData) {
    return this.request('/fuel-logs', {
      method: 'POST',
      body: JSON.stringify(fuelLogData)
    });
  }

  // Motor methods
  async getMotorcycles() {
    return this.request('/motorcycles');
  }

  async getUserMotors(userId) {
    return this.request(`/user-motors/user/${userId}`);
  }

  async createUserMotor(motorData) {
    return this.request('/user-motors', {
      method: 'POST',
      body: JSON.stringify(motorData)
    });
  }

  async updateFuelLevel(motorId, fuelLevel) {
    return this.request(`/user-motors/${motorId}/fuel`, {
      method: 'PUT',
      body: JSON.stringify({ currentFuelLevel: fuelLevel })
    });
  }

  // Maintenance methods
  async getMaintenanceRecords(userId) {
    return this.request(`/maintenance-records/user/${userId}`);
  }

  async createMaintenanceRecord(recordData) {
    return this.request('/maintenance-records', {
      method: 'POST',
      body: JSON.stringify(recordData)
    });
  }

  // Gas Station methods
  async getNearbyGasStations(lat, lng, radius = 5000) {
    return this.request(`/gas-stations/nearby?lat=${lat}&lng=${lng}&radius=${radius}`);
  }

  // Saved Destinations
  async getSavedDestinations(userId) {
    return this.request(`/saved-destinations/${userId}`);
  }

  async addSavedDestination(destinationData) {
    return this.request('/saved-destinations', {
      method: 'POST',
      body: JSON.stringify(destinationData)
    });
  }

  // Notifications
  async getUserNotifications(userId) {
    return this.request(`/notifications/${userId}`);
  }

  async markNotificationRead(notificationId) {
    return this.request(`/notifications/read/${notificationId}`, {
      method: 'PUT'
    });
  }

  // Analytics
  async getUserAnalyticsTimeline(userId) {
    return this.request(`/analytics/user-timeline/${userId}`);
  }

  async getFuelStats(motorId) {
    return this.request(`/fuel-stats/${motorId}`);
  }
}

// Export singleton instance
export const userApiService = new UserApiService(
  process.env.REACT_APP_API_URL || 'http://localhost:5000/api'
);
```

### React Hook Example

```javascript
import { useState, useEffect } from 'react';
import { userApiService } from './services/userApiService';

export const useTrips = (userId) => {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchTrips = async () => {
      try {
        setLoading(true);
        const data = await userApiService.getUserTrips(userId);
        setTrips(data);
        setError(null);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (userId) {
      fetchTrips();
    }
  }, [userId]);

  const createTrip = async (tripData) => {
    try {
      const newTrip = await userApiService.createTrip(tripData);
      setTrips([newTrip, ...trips]);
      return newTrip;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  return { trips, loading, error, createTrip };
};
```

### React Context Example

```javascript
import React, { createContext, useContext, useState, useEffect } from 'react';
import { userApiService } from './services/userApiService';

const UserContext = createContext();

export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [trips, setTrips] = useState([]);
  const [motors, setMotors] = useState([]);
  const [fuelLogs, setFuelLogs] = useState([]);

  useEffect(() => {
    const init = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const userData = await userApiService.getCurrentUser();
          setUser(userData);

          // Load user data
          const [tripsData, motorsData, fuelLogsData] = await Promise.all([
            userApiService.getUserTrips(userData._id),
            userApiService.getUserMotors(userData._id),
            userApiService.getFuelLogs(userData._id)
          ]);

          setTrips(tripsData);
          setMotors(motorsData);
          setFuelLogs(fuelLogsData);
        } catch (error) {
          localStorage.removeItem('token');
          console.error('Failed to initialize user:', error);
        }
      }
      setLoading(false);
    };
    init();
  }, []);

  const login = async (email, password) => {
    const data = await userApiService.login(email, password);
    setUser(data.user);
    return data;
  };

  const logout = async () => {
    await userApiService.logout();
    setUser(null);
    setTrips([]);
    setMotors([]);
    setFuelLogs([]);
  };

  return (
    <UserContext.Provider value={{
      user,
      trips,
      motors,
      fuelLogs,
      loading,
      login,
      logout,
      setTrips,
      setMotors,
      setFuelLogs
    }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => useContext(UserContext);
```

---

## ✅ Best Practices

### 1. Token Management

```javascript
// Store token securely
localStorage.setItem('token', token);

// Include token in all authenticated requests
headers: {
  'Authorization': `Bearer ${token}`
}

// Check token expiration
const verifyToken = async () => {
  try {
    await userApiService.request('/auth/verify-token');
  } catch (error) {
    // Token invalid, redirect to login
    localStorage.removeItem('token');
    window.location.href = '/login';
  }
};
```

### 2. Error Handling

```javascript
try {
  const data = await userApiService.getUserTrips(userId);
} catch (error) {
  if (error.message.includes('401')) {
    // Unauthorized - redirect to login
    router.push('/login');
  } else if (error.message.includes('404')) {
    // Not found - show appropriate message
    showNotification('Resource not found', 'error');
  } else {
    // Generic error handling
    showNotification(error.message, 'error');
  }
}
```

### 3. Loading States

```javascript
const [loading, setLoading] = useState(false);

const fetchData = async () => {
  setLoading(true);
  try {
    const data = await userApiService.getData();
    return data;
  } finally {
    setLoading(false);
  }
};
```

### 4. Data Caching

```javascript
// Cache user data to reduce API calls
let userCache = null;
let cacheTime = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

const getCachedUser = async () => {
  if (userCache && cacheTime && Date.now() - cacheTime < CACHE_DURATION) {
    return userCache;
  }
  userCache = await userApiService.getCurrentUser();
  cacheTime = Date.now();
  return userCache;
};
```

---

## 🎯 Quick Reference

### Base URL
```
Development: http://localhost:5000/api
Production: https://your-domain.com/api
```

### Authentication Header
```
Authorization: Bearer <token>
```

### Common User Endpoints
- **Login:** `POST /api/auth/login`
- **Register:** `POST /api/auth/register`
- **Request Password Reset OTP:** `POST /api/auth/reset-password` (No auth required)
- **Verify OTP:** `POST /api/auth/verify-reset` (No auth required)
- **Reset Password with OTP:** `POST /api/auth/reset-password-with-otp` (No auth required)
- **Get Current User:** `GET /api/users/me`
- **Get User Trips:** `GET /api/trips/user/:userId`
- **Create Trip:** `POST /api/trips`
- **Get Fuel Logs:** `GET /api/fuel-logs/:userId`
- **Create Fuel Log:** `POST /api/fuel-logs`
- **Get User Motors:** `GET /api/user-motors/user/:userId`
- **Create User Motor:** `POST /api/user-motors`
- **Get Nearby Gas Stations:** `GET /api/gas-stations/nearby?lat=...&lng=...`
- **Get Maintenance Records:** `GET /api/maintenance-records/user/:userId`
- **Get Saved Destinations:** `GET /api/saved-destinations/:userId`
- **Get Notifications:** `GET /api/notifications/:userId`

---

## 📞 Support

For issues or questions:
- Check the API documentation
- Review error messages carefully
- Ensure token is valid and included in headers
- Verify request body matches expected format

---

**Last Updated:** 2024
**API Version:** 1.0.0
**Target Audience:** Regular Users Only

