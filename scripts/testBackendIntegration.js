#!/usr/bin/env node

/**
 * Backend Integration Test Script
 * Tests all backend service integrations and measures performance
 */

const API_BASE = "https://ts-backend-1-jyit.onrender.com";

// Test data
const testData = {
  coordinates: [
    { lat1: 14.5995, lon1: 120.9842, lat2: 14.6000, lon2: 120.9850 },
    { lat1: 14.6000, lon1: 120.9850, lat2: 14.6005, lon2: 120.9860 }
  ],
  motorData: {
    fuelEfficiency: 25,
    fuelTank: 15,
    currentLevel: 80
  },
  reports: [
    {
      _id: '1',
      location: { latitude: 14.5995, longitude: 120.9842 },
      type: 'accident',
      severity: 'high',
      description: 'Test accident'
    }
  ],
  gasStations: [
    {
      _id: '1',
      location: { coordinates: [120.9842, 14.5995] },
      name: 'Test Station 1',
      address: 'Test Address 1'
    }
  ]
};

// Test functions
async function testDistanceCalculation() {
  console.log('🧮 Testing distance calculation...');
  const startTime = Date.now();
  
  try {
    const response = await fetch(`${API_BASE}/api/calculations/distance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ coordinates: testData.coordinates })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    console.log(`✅ Distance calculation: ${responseTime}ms`);
    console.log(`   - Distances: ${data.distances?.length || 0} calculated`);
    console.log(`   - Total distance: ${data.totalDistance || 0}m`);
    
    return { success: true, responseTime, data };
  } catch (error) {
    console.log(`❌ Distance calculation failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function testFuelCalculation() {
  console.log('⛽ Testing fuel calculation...');
  const startTime = Date.now();
  
  try {
    const response = await fetch(`${API_BASE}/api/fuel/calculate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        motorData: testData.motorData,
        distanceTraveled: 1000
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    console.log(`✅ Fuel calculation: ${responseTime}ms`);
    console.log(`   - New fuel level: ${data.newFuelLevel || 0}%`);
    console.log(`   - Fuel consumed: ${data.fuelConsumed || 0}L`);
    
    return { success: true, responseTime, data };
  } catch (error) {
    console.log(`❌ Fuel calculation failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function testMarkerClustering() {
  console.log('🗺️ Testing marker clustering...');
  const startTime = Date.now();
  
  try {
    const response = await fetch(`${API_BASE}/api/map/cluster-markers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reports: testData.reports,
        gasStations: testData.gasStations,
        currentZoom: 15,
        options: { radius: 100, minZoom: 10, maxZoom: 15 }
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    console.log(`✅ Marker clustering: ${responseTime}ms`);
    console.log(`   - Clusters: ${data.clusters?.length || 0} generated`);
    console.log(`   - Markers processed: ${data.performance?.markersProcessed || 0}`);
    
    return { success: true, responseTime, data };
  } catch (error) {
    console.log(`❌ Marker clustering failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function testRouteProcessing() {
  console.log('🛣️ Testing route processing...');
  const startTime = Date.now();
  
  try {
    const response = await fetch(`${API_BASE}/api/routes/process-directions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        origin: { latitude: 14.5995, longitude: 120.9842 },
        destination: { latitude: 14.6000, longitude: 120.9850 },
        motorData: testData.motorData,
        options: { alternatives: true, trafficModel: 'best_guess' }
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    console.log(`✅ Route processing: ${responseTime}ms`);
    console.log(`   - Routes: ${data.routes?.length || 0} processed`);
    console.log(`   - Main route: ${data.mainRoute ? 'Yes' : 'No'}`);
    
    return { success: true, responseTime, data };
  } catch (error) {
    console.log(`❌ Route processing failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function testDataAggregation() {
  console.log('📊 Testing data aggregation...');
  const startTime = Date.now();
  
  try {
    const response = await fetch(`${API_BASE}/api/data/aggregated-cached?userId=test-user&includeCache=true&forceRefresh=false`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    console.log(`✅ Data aggregation: ${responseTime}ms`);
    console.log(`   - Data sources: ${data.performance?.dataSources?.length || 0}`);
    console.log(`   - Cache hit rate: ${data.performance?.cacheHitRate || 0}%`);
    
    return { success: true, responseTime, data };
  } catch (error) {
    console.log(`❌ Data aggregation failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function testBackendHealth() {
  console.log('🏥 Testing backend health...');
  const startTime = Date.now();
  
  try {
    const response = await fetch(`${API_BASE}/api/health`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    console.log(`✅ Backend health: ${responseTime}ms`);
    console.log(`   - Status: ${data.status || 'OK'}`);
    console.log(`   - Timestamp: ${data.timestamp || 'N/A'}`);
    
    return { success: true, responseTime, data };
  } catch (error) {
    console.log(`❌ Backend health check failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// Main test runner
async function runAllTests() {
  console.log('🚀 Starting Backend Integration Tests...\n');
  
  const results = {
    health: await testBackendHealth(),
    distance: await testDistanceCalculation(),
    fuel: await testFuelCalculation(),
    clustering: await testMarkerClustering(),
    routes: await testRouteProcessing(),
    aggregation: await testDataAggregation()
  };
  
  console.log('\n📊 Test Results Summary:');
  console.log('========================');
  
  const successful = Object.values(results).filter(r => r.success).length;
  const total = Object.keys(results).length;
  
  Object.entries(results).forEach(([test, result]) => {
    const status = result.success ? '✅' : '❌';
    const time = result.responseTime ? `${result.responseTime}ms` : 'N/A';
    console.log(`${status} ${test}: ${time}`);
  });
  
  console.log(`\n🎯 Overall: ${successful}/${total} tests passed`);
  
  if (successful === total) {
    console.log('🎉 All backend services are working correctly!');
  } else {
    console.log('⚠️ Some backend services may be unavailable or experiencing issues.');
  }
  
  // Performance analysis
  const responseTimes = Object.values(results)
    .filter(r => r.success && r.responseTime)
    .map(r => r.responseTime);
  
  if (responseTimes.length > 0) {
    const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    const maxResponseTime = Math.max(...responseTimes);
    const minResponseTime = Math.min(...responseTimes);
    
    console.log('\n📈 Performance Analysis:');
    console.log(`   - Average response time: ${Math.round(avgResponseTime)}ms`);
    console.log(`   - Fastest response: ${minResponseTime}ms`);
    console.log(`   - Slowest response: ${maxResponseTime}ms`);
    
    if (avgResponseTime < 1000) {
      console.log('🚀 Excellent performance! All services responding quickly.');
    } else if (avgResponseTime < 3000) {
      console.log('⚡ Good performance. Services responding within acceptable limits.');
    } else {
      console.log('🐌 Performance could be improved. Consider backend optimization.');
    }
  }
}

// Run tests if this script is executed directly
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = {
  runAllTests,
  testDistanceCalculation,
  testFuelCalculation,
  testMarkerClustering,
  testRouteProcessing,
  testDataAggregation,
  testBackendHealth
};
