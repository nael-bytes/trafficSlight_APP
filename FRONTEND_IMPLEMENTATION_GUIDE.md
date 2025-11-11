# 🚀 Frontend Implementation Guide

Complete guide for integrating with the TrafficSlight Backend API.

---

## 📋 Table of Contents

1. [Getting Started](#getting-started)
2. [API Configuration](#api-configuration)
3. [Authentication](#authentication)
4. [API Endpoints](#api-endpoints)
5. [Data Models](#data-models)
6. [Error Handling](#error-handling)
7. [Code Examples](#code-examples)
8. [Best Practices](#best-practices)

---

## 🚦 Getting Started

### Base URL Configuration

```javascript
// Environment Configuration
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
// OR
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
    return data;
  }
  throw new Error(data.message);
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

### 5. Reset Password

**Endpoint:** `POST /api/auth/reset-password`

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

### 6. Change Password

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

### 7. Logout

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

### Get All Users (Admin)

**Endpoint:** `GET /api/users` or `GET /api/users/all`

### Get Complete User Data

**Endpoint:** `GET /api/users/complete` or `GET /api/users/complete/:userId`

Returns user with all related data (trips, fuel logs, maintenance, etc.)

### Update Profile

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

### Get User Statistics

**Endpoint:** `GET /api/users/stats` or `GET /api/users/stats/:userId`

### Get Dashboard Data

**Endpoint:** `GET /api/users/dashboard` or `GET /api/users/dashboard/:userId`

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

### Change Password (User Endpoint)

**Endpoint:** `PUT /api/users/change-password`

**Request Body:**
```json
{
  "currentPassword": "oldpassword",
  "newPassword": "newpassword"
}
```

### Get User Settings

**Endpoint:** `GET /api/users/settings`

### Update User Settings

**Endpoint:** `PUT /api/users/settings`

### Get User Notifications

**Endpoint:** `GET /api/users/notifications`

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

## 🏍️ Motorcycle Management

### Get All Motorcycles

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

### Get Motorcycle Count

**Endpoint:** `GET /api/motorcycles/count`

### Create Motorcycle (Admin)

**Endpoint:** `POST /api/motorcycles`

**Request Body:**
```json
{
  "model": "Honda CBR150R",
  "engineDisplacement": 150,
  "power": "17.1 HP",
  "torque": "14.4 Nm",
  "fuelTank": 12,
  "fuelConsumption": 50
}
```

### Update Motorcycle

**Endpoint:** `PUT /api/motorcycles/:id`

### Delete Motorcycle (Soft Delete)

**Endpoint:** `DELETE /api/motorcycles/:id`

### Restore Motorcycle

**Endpoint:** `PUT /api/motorcycles/restore/:id`

---

## 🚗 User Motor Management

### Get All User Motors

**Endpoint:** `GET /api/user-motors`

### Get User Motors by User ID

**Endpoint:** `GET /api/user-motors/user/:id`

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

### Update Fuel Efficiency

**Endpoint:** `PUT /api/user-motors/:id/updateEfficiency`

**Request Body:**
```json
{
  "currentFuelEfficiency": 55
}
```

### Log Oil Change

**Endpoint:** `POST /api/user-motors/:id/oil-change`

### Log Tune Up

**Endpoint:** `POST /api/user-motors/:id/tune-up`

### Get User Overview Analytics

**Endpoint:** `GET /api/user-motors/user-overview/:userId`

### Get Motor Overview Analytics

**Endpoint:** `GET /api/user-motors/motor-overview/:motorId`

### Get User Motor Count

**Endpoint:** `GET /api/user-motors/count`

---

## 🗺️ Trip Management

### Get User Trips

**Endpoint:** `GET /api/trips/user/:userId`

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

### Get All Trips (Admin)

**Endpoint:** `GET /api/trips`

### Get Trip Analytics Summary

**Endpoint:** `GET /api/trips/analytics/summary`

### Get Monthly Trip Summary

**Endpoint:** `GET /api/trips/analytics/monthly`

### Get Top Users by Trip Count

**Endpoint:** `GET /api/trips/insights/top-users`

### Get Most Used Motors

**Endpoint:** `GET /api/trips/insights/top-motors`

### Delete Trip

**Endpoint:** `DELETE /api/trips/:id`

### Get Trips by Date Range

**Endpoint:** `GET /api/trips/filter/date?startDate=2024-01-01&endDate=2024-01-31`

### Get Paginated Trips

**Endpoint:** `GET /api/trips/paginate?page=1&limit=10`

---

## ⛽ Fuel Log Management

### Get All Fuel Logs

**Endpoint:** `GET /api/fuel-logs`

### Get Fuel Logs by User

**Endpoint:** `GET /api/fuel-logs/:userId`

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

### Get Fuel Log Overview (Admin)

**Endpoint:** `GET /api/fuel-logs/admin/overview`

**Response:**
```json
{
  "totalLogs": 100,
  "totalLiters": 500,
  "totalSpent": 32750.00
}
```

### Get Average Fuel by Motor (Admin)

**Endpoint:** `GET /api/fuel-logs/admin/avg-per-motor`

### Get Top Fuel Spenders (Admin)

**Endpoint:** `GET /api/fuel-logs/admin/top-spenders`

### Get Monthly Fuel Usage (Admin)

**Endpoint:** `GET /api/fuel-logs/admin/monthly-usage`

---

## 🔧 Maintenance Management

### Get All Maintenance Records

**Endpoint:** `GET /api/maintenance-records`

### Get Maintenance Records by User

**Endpoint:** `GET /api/maintenance-records/user/:userId`

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
- `oil_change`
- `tune_up`
- `refuel`
- `repair`
- `other`

### Get Maintenance Record by ID

**Endpoint:** `GET /api/maintenance-records/:id`

### Update Maintenance Record

**Endpoint:** `PUT /api/maintenance-records/:id`

### Delete Maintenance Record

**Endpoint:** `DELETE /api/maintenance-records/:id`

### Get Maintenance by Motor

**Endpoint:** `GET /api/maintenance-records/motor/:motorId`

### Get Maintenance Analytics Summary

**Endpoint:** `GET /api/maintenance-records/analytics/summary`

---

## 🗺️ Gas Station Management

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

### Get Nearby Gas Stations

**Endpoint:** `GET /api/gas-stations/nearby?lat=14.5995&lng=120.9842&radius=5000`

**Query Parameters:**
- `lat` (required): Latitude
- `lng` (required): Longitude
- `radius` (optional): Radius in meters (default: 5000)

### Get Gas Station by ID

**Endpoint:** `GET /api/gas-stations/:id`

### Create Gas Station (Admin)

**Endpoint:** `POST /api/gas-stations`

**Request Body:**
```json
{
  "name": "Shell Station",
  "address": "Makati Avenue, Makati",
  "location": {
    "lat": 14.5547,
    "lng": 121.0244
  },
  "phoneNumber": "+6321234567",
  "isOpen24Hours": true,
  "currentPrice": 65.50
}
```

### Update Gas Station (Admin)

**Endpoint:** `PUT /api/gas-stations/:id`

### Delete Gas Station (Admin)

**Endpoint:** `DELETE /api/gas-stations/:id`

### Get Gas Station Analytics (Admin)

**Endpoint:** `GET /api/gas-stations/analytics`

### Get Price History by Station

**Endpoint:** `GET /api/gas-stations/history/:id`

### Import Gas Stations from Google (Admin)

**Endpoint:** `GET /api/gas-stations/import`

---

## 📍 Saved Destinations

### Get User Destinations

**Endpoint:** `GET /api/saved-destinations/:userId`

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

### Delete Saved Destination

**Endpoint:** `DELETE /api/saved-destinations/:id`

---

## 🔔 Notifications

### Get All Notifications

**Endpoint:** `GET /api/notifications`

### Get User Notifications

**Endpoint:** `GET /api/notifications/:userId`

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

### Delete Notification

**Endpoint:** `DELETE /api/notifications/:id`

---

## 📊 Analytics

### Generate Daily Analytics

**Endpoint:** `GET /api/analytics/generate-daily`

### Get Motor Daily Analytics History

**Endpoint:** `GET /api/analytics/daily-history/:motorId`

### Get User Analytics Timeline

**Endpoint:** `GET /api/analytics/user-timeline/:userId`

### Get User Fuel Log Trend

**Endpoint:** `GET /api/analytics/fuel-log-trend/:userId`

---

## 📈 General Analytics

### Create or Update Analytics

**Endpoint:** `POST /api/general-analytics`

**Request Body:**
```json
{
  "key": "user_growth",
  "value": {
    "totalUsers": 1000,
    "newUsersThisMonth": 50
  }
}
```

### Get All Analytics

**Endpoint:** `GET /api/general-analytics`

### Get Analytics by Key

**Endpoint:** `GET /api/general-analytics/:key`

---

## ⛽ Fuel Statistics

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

---

## 📊 Dashboard

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

## 📍 Tracking Routes

### Get Tracking Data

**Endpoint:** `GET /api/tracking`

### Create/Update Tracking Data

**Endpoint:** `POST /api/tracking`

---

## 🔍 Search

### Search Endpoint

**Endpoint:** `GET /api/search?q=query&type=users|trips|motors`

---

## 📤 Export

### Export Data

**Endpoint:** `GET /api/export?type=trips|fuel-logs|maintenance&format=json|csv`

---

## 🗺️ Map Routes

### Get Map Data

**Endpoint:** `GET /api/map`

---

## ⚙️ Settings

### Get Settings

**Endpoint:** `GET /api/settings`

### Update Settings

**Endpoint:** `PUT /api/settings`

---

## 📤 Upload

### Upload File

**Endpoint:** `POST /api/upload`

**Request:** Multipart form data

---

## 📊 Data Models

### User Model

```typescript
interface User {
  _id: string;
  email: string;
  password?: string; // Never returned in responses
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
  isDeleted: boolean;
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
  // Estimated (Planned)
  distance: number; // km
  fuelUsedMin: number; // liters
  fuelUsedMax: number; // liters
  eta?: string;
  timeArrived?: string;
  // Actual (Tracked)
  tripStartTime: Date;
  tripEndTime?: Date;
  actualDistance?: number; // km
  actualFuelUsedMin?: number; // liters
  actualFuelUsedMax?: number; // liters
  duration?: number; // minutes
  kmph?: number; // km/h
  // Location
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
  // Routing
  plannedPolyline?: string;
  actualPolyline?: string;
  wasRerouted: boolean;
  rerouteCount: number;
  // Analytics
  wasInBackground: boolean;
  showAnalyticsModal: boolean;
  analyticsNotes?: string;
  trafficCondition: 'light' | 'moderate' | 'heavy';
  // Summary
  destination: string;
  isSuccessful: boolean;
  status: 'planned' | 'in-progress' | 'completed' | 'cancelled';
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
class ApiService {
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
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData)
    });
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
  async getUserMotors(userId) {
    return this.request(`/user-motors/user/${userId}`);
  }

  async createUserMotor(motorData) {
    return this.request('/user-motors', {
      method: 'POST',
      body: JSON.stringify(motorData)
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
}

// Export singleton instance
export const apiService = new ApiService(process.env.REACT_APP_API_URL || 'http://localhost:5000/api');
```

### React Hook Example

```javascript
import { useState, useEffect } from 'react';
import { apiService } from './services/apiService';

export const useTrips = (userId) => {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchTrips = async () => {
      try {
        setLoading(true);
        const data = await apiService.getUserTrips(userId);
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
      const newTrip = await apiService.createTrip(tripData);
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

### React Component Example

```javascript
import React, { useState } from 'react';
import { apiService } from './services/apiService';

function TripForm({ userId, motorId, onTripCreated }) {
  const [formData, setFormData] = useState({
    destination: '',
    distance: '',
    fuelUsedMin: '',
    fuelUsedMax: '',
    startLocation: { lat: null, lng: null },
    endLocation: { lat: null, lng: null }
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const tripData = {
        userId,
        motorId,
        ...formData,
        distance: parseFloat(formData.distance),
        fuelUsedMin: parseFloat(formData.fuelUsedMin),
        fuelUsedMax: parseFloat(formData.fuelUsedMax),
        status: 'planned'
      };

      const newTrip = await apiService.createTrip(tripData);
      onTripCreated(newTrip);
      // Reset form
      setFormData({
        destination: '',
        distance: '',
        fuelUsedMin: '',
        fuelUsedMax: '',
        startLocation: { lat: null, lng: null },
        endLocation: { lat: null, lng: null }
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {error && <div className="error">{error}</div>}
      <input
        type="text"
        placeholder="Destination"
        value={formData.destination}
        onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
        required
      />
      <input
        type="number"
        placeholder="Distance (km)"
        value={formData.distance}
        onChange={(e) => setFormData({ ...formData, distance: e.target.value })}
        required
      />
      <input
        type="number"
        placeholder="Min Fuel (liters)"
        value={formData.fuelUsedMin}
        onChange={(e) => setFormData({ ...formData, fuelUsedMin: e.target.value })}
        required
      />
      <input
        type="number"
        placeholder="Max Fuel (liters)"
        value={formData.fuelUsedMax}
        onChange={(e) => setFormData({ ...formData, fuelUsedMax: e.target.value })}
        required
      />
      <button type="submit" disabled={loading}>
        {loading ? 'Creating...' : 'Create Trip'}
      </button>
    </form>
  );
}

export default TripForm;
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
    await apiService.request('/auth/verify-token');
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
  const data = await apiService.getUserTrips(userId);
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
    const data = await apiService.getData();
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
  userCache = await apiService.getCurrentUser();
  cacheTime = Date.now();
  return userCache;
};
```

### 5. Request Interceptors

```javascript
// Add request interceptor for automatic token refresh
const originalRequest = apiService.request.bind(apiService);

apiService.request = async (endpoint, options) => {
  try {
    return await originalRequest(endpoint, options);
  } catch (error) {
    if (error.message.includes('401')) {
      // Try to refresh token or redirect to login
      // Implementation depends on your auth strategy
    }
    throw error;
  }
};
```

### 6. TypeScript Support

```typescript
// api.types.ts
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Usage
const response: ApiResponse<Trip[]> = await apiService.getUserTrips(userId);
```

---

## 🔄 State Management

### Context API Example

```javascript
import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiService } from './services/apiService';

const AppContext = createContext();

export const AppProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [trips, setTrips] = useState([]);
  const [motors, setMotors] = useState([]);

  useEffect(() => {
    const init = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const userData = await apiService.getCurrentUser();
          setUser(userData);
          
          // Load user data
          const [tripsData, motorsData] = await Promise.all([
            apiService.getUserTrips(userData._id),
            apiService.getUserMotors(userData._id)
          ]);
          
          setTrips(tripsData);
          setMotors(motorsData);
        } catch (error) {
          localStorage.removeItem('token');
        }
      }
      setLoading(false);
    };
    init();
  }, []);

  const login = async (email, password) => {
    const data = await apiService.login(email, password);
    setUser(data.user);
    return data;
  };

  const logout = async () => {
    await apiService.logout();
    setUser(null);
    setTrips([]);
    setMotors([]);
  };

  return (
    <AppContext.Provider value={{
      user,
      trips,
      motors,
      loading,
      login,
      logout,
      setTrips,
      setMotors
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => useContext(AppContext);
```

---

## 📝 Additional Notes

### CORS Configuration

The backend has CORS enabled. Ensure your frontend URL is allowed in production.

### Rate Limiting

Some endpoints may have rate limiting. Handle 429 status codes appropriately:

```javascript
if (response.status === 429) {
  const retryAfter = response.headers.get('Retry-After');
  console.log(`Rate limited. Retry after ${retryAfter} seconds`);
}
```

### File Uploads

For file uploads, use `FormData`:

```javascript
const uploadFile = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await fetch(`${API_BASE_URL}/upload`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
      // Don't set Content-Type for FormData
    },
    body: formData
  });
  
  return response.json();
};
```

### Real-time Updates

Currently, the API doesn't support WebSocket connections. Use polling or implement your own WebSocket server if needed.

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

### Common Endpoints
- Login: `POST /api/auth/login`
- Get Current User: `GET /api/users/me`
- Get User Trips: `GET /api/trips/user/:userId`
- Create Trip: `POST /api/trips`
- Get Fuel Logs: `GET /api/fuel-logs/:userId`
- Create Fuel Log: `POST /api/fuel-logs`
- Get User Motors: `GET /api/user-motors/user/:userId`

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

