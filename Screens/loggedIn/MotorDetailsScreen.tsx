import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  View, Text, TextInput, StyleSheet, ScrollView, TouchableOpacity, Alert
} from "react-native";
import { RouteProp, useNavigation } from "@react-navigation/native";
import Icon from "react-native-vector-icons/Ionicons";
import { apiRequest } from '../../utils/api';
import { getMotorAnalytics } from '../../services/motorService';

type RootStackParamList = {
  MotorDetails: { item: any };
  MotorList: { fullList: any[] };
};

type Props = {
  route: RouteProp<RootStackParamList, "MotorDetails">;
};

export default function MotorDetailsScreen({ route }: Props) {
  const { item } = route.params;
  const navigation = useNavigation();
  const [loading, setLoading] = useState(false);
  const [trips, setTrips] = useState<any[]>([]);
  const [maintenanceRecords, setMaintenanceRecords] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState({
    lastRefuel: null as any,
    lastOilChange: null as any,
    lastTuneUp: null as any,
    kmSinceOilChange: 0,
    kmSinceTuneUp: 0,
    daysSinceOilChange: 0,
    totalRefuels: 0,
    totalOilChanges: 0,
    totalTuneUps: 0,
    averageFuelEfficiency: 0,
    totalFuelConsumed: 0,
    maintenanceAlerts: [] as string[],
  });

  // Abort controller refs for cleanup (one per async operation)
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastRecordsAbortRef = useRef<AbortController | null>(null);
  const countdownAbortRef = useRef<AbortController | null>(null);
  const analyticsAbortRef = useRef<AbortController | null>(null);
  
  // Mounted ref to prevent state updates after unmount
  const isMountedRef = useRef(true);

  // Initialize mounted ref
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Fetch trips and maintenance data
  useEffect(() => {
    const fetchMotorData = async () => {
      if (!item?._id || !isMountedRef.current) return;

      // Abort previous request if still pending
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      abortControllerRef.current = new AbortController();
      const signal = abortControllerRef.current.signal;

      try {
        setLoading(true);

        // Fetch trips for this motor using apiRequest
        const tripsData = await apiRequest(`/api/trips?motorId=${item._id}`, { signal });
        if (Array.isArray(tripsData)) {
          setTrips(tripsData);
        } else if (tripsData?.trips) {
          setTrips(Array.isArray(tripsData.trips) ? tripsData.trips : []);
        } else if (tripsData?.data) {
          setTrips(Array.isArray(tripsData.data) ? tripsData.data : []);
        } else {
          setTrips([]);
        }

        // Fetch maintenance records for this motor using apiRequest
        const maintenanceData = await apiRequest(`/api/maintenance-records/motor/${item._id}`, { signal });

        // Verify data structure
        if (Array.isArray(maintenanceData)) {
          setMaintenanceRecords(maintenanceData);
        } else if (maintenanceData?.maintenanceRecords) {
          setMaintenanceRecords(Array.isArray(maintenanceData.maintenanceRecords) ? maintenanceData.maintenanceRecords : []);
        } else if (maintenanceData?.data) {
          setMaintenanceRecords(Array.isArray(maintenanceData.data) ? maintenanceData.data : []);
        } else {
          setMaintenanceRecords([]);
        }

      } catch (error: any) {
        // Ignore abort errors
        if (error?.name === 'AbortError' || !isMountedRef.current) {
          return;
        }

        if (__DEV__) {
          console.error('[MotorDetails] Error fetching motor data:', error);
        }

        // Only update state if component is still mounted
        if (isMountedRef.current) {
          setTrips([]);
          setMaintenanceRecords([]);
        }
      } finally {
        if (isMountedRef.current) {
          setLoading(false);
        }
      }
    };

    fetchMotorData();

    // Cleanup on unmount
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, [item?._id]);

  // Memoize heavy calculations for analytics
  const calculatedAnalytics = useMemo(() => {
    if (!maintenanceRecords.length && !trips.length) {
      return null;
    }

    const now = new Date();
    const refuels = maintenanceRecords.filter(record => record.type === 'refuel');
    const oilChanges = maintenanceRecords.filter(record => record.type === 'oil_change');
    const tuneUps = maintenanceRecords.filter(record => record.type === 'tune_up');

    // Sort once and reuse
    const sortedRefuels = [...refuels].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    const sortedOilChanges = [...oilChanges].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    const sortedTuneUps = [...tuneUps].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const lastRefuel = sortedRefuels[0] || null;
    const lastOilChange = sortedOilChanges[0] || null;
    const lastTuneUp = sortedTuneUps[0] || null;

    let kmSinceOilChange = 0;
    let kmSinceTuneUp = 0;
    let daysSinceOilChange = 0;

    if (lastOilChange) {
      const oilChangeDate = new Date(lastOilChange.timestamp);
      const tripsSinceOilChange = trips.filter(trip => new Date(trip.tripStartTime) > oilChangeDate);
      kmSinceOilChange = tripsSinceOilChange.reduce((total, trip) => total + (trip.actualDistance || 0), 0);
      daysSinceOilChange = Math.floor((now.getTime() - oilChangeDate.getTime()) / (1000 * 60 * 60 * 24));
    }

    if (lastTuneUp) {
      const tuneUpDate = new Date(lastTuneUp.timestamp);
      const tripsSinceTuneUp = trips.filter(trip => new Date(trip.tripStartTime) > tuneUpDate);
      kmSinceTuneUp = tripsSinceTuneUp.reduce((total, trip) => total + (trip.actualDistance || 0), 0);
    }

    return {
      lastRefuel,
      lastOilChange,
      lastTuneUp,
      kmSinceOilChange,
      kmSinceTuneUp,
      daysSinceOilChange,
      totalRefuels: refuels.length,
      totalOilChanges: oilChanges.length,
      totalTuneUps: tuneUps.length,
    };
  }, [maintenanceRecords, trips]);

  // Fetch last maintenance records from API
  // Uses: GET /api/maintenance-records/last/:userId
  useEffect(() => {
    // Abort previous request if still pending
    if (lastRecordsAbortRef.current) {
      lastRecordsAbortRef.current.abort();
    }

    lastRecordsAbortRef.current = new AbortController();
    const signal = lastRecordsAbortRef.current.signal;

    const fetchLastMaintenanceRecords = async () => {
      if (!item?.userId || !isMountedRef.current) return;

      try {
        // Fetch last maintenance records using the API endpoint
        const lastRecords = await apiRequest(`/api/maintenance-records/last/${item.userId}`, { signal });
        
        if (!isMountedRef.current) return;

        if (__DEV__) {
          console.log('[MotorDetails] Last maintenance records from API:', lastRecords);
        }

        // Fetch full details for each last record if they exist
        const fetchFullRecord = async (record: any, type: string) => {
          if (!record || !record.date || !isMountedRef.current) return null;
          
          // Get the most recent record of this type for this motor
          try {
            const records = await apiRequest(
              `/api/maintenance-records/motor/${item._id}?type=${type}&limit=1&sortBy=timestamp&sortOrder=desc`,
              { signal }
            );
            
            if (!isMountedRef.current) return null;
            
            if (records?.records && records.records.length > 0) {
              return records.records[0];
            } else if (Array.isArray(records) && records.length > 0) {
              return records[0];
            }
          } catch (error: any) {
            if (error?.name === 'AbortError' || !isMountedRef.current) return null;
            if (__DEV__) {
              console.warn(`[MotorDetails] Failed to fetch full ${type} record:`, error);
            }
          }
          return null;
        };

        // Fetch full details for last refuel, oil change, and tune-up
        const [lastRefuelFull, lastOilChangeFull, lastTuneUpFull] = await Promise.all([
          fetchFullRecord(lastRecords?.lastRefuel, 'refuel'),
          fetchFullRecord(lastRecords?.lastOilChange, 'oil_change'),
          fetchFullRecord(lastRecords?.lastTuneUp, 'tune_up'),
        ]);

        // Only update state if component is still mounted
        if (isMountedRef.current) {
          setAnalytics(prev => ({
            ...prev,
            lastRefuel: lastRefuelFull && lastRefuelFull.motorId?._id === item._id ? lastRefuelFull : prev.lastRefuel,
            lastOilChange: lastOilChangeFull && lastOilChangeFull.motorId?._id === item._id ? lastOilChangeFull : prev.lastOilChange,
            lastTuneUp: lastTuneUpFull && lastTuneUpFull.motorId?._id === item._id ? lastTuneUpFull : prev.lastTuneUp,
          }));
        }
      } catch (error: any) {
        if (error?.name === 'AbortError' || !isMountedRef.current) return;
        if (__DEV__) {
          console.warn('[MotorDetails] Failed to fetch last maintenance records from API:', error);
        }
      }
    };

    fetchLastMaintenanceRecords();

    // Cleanup on unmount or dependency change
    return () => {
      if (lastRecordsAbortRef.current) {
        lastRecordsAbortRef.current.abort();
        lastRecordsAbortRef.current = null;
      }
    };
  }, [item?._id, item?.userId]);

  // Fetch oil change countdown from API
  // Uses: GET /api/maintenance-records/oil-change/countdown/:motorId
  useEffect(() => {
    // Abort previous request if still pending
    if (countdownAbortRef.current) {
      countdownAbortRef.current.abort();
    }

    countdownAbortRef.current = new AbortController();
    const signal = countdownAbortRef.current.signal;

    const fetchOilChangeCountdown = async () => {
      if (!item?._id || !isMountedRef.current) return;

      try {
        const countdownData = await apiRequest(`/api/maintenance-records/oil-change/countdown/${item._id}`, { signal });
        
        if (!isMountedRef.current) return;

        if (__DEV__) {
          console.log('[MotorDetails] Oil change countdown from API:', countdownData);
        }

        if (countdownData && isMountedRef.current) {
          setAnalytics(prev => ({
            ...prev,
            kmSinceOilChange: countdownData.kmSinceLastOilChange || prev.kmSinceOilChange,
            daysSinceOilChange: countdownData.daysSinceLastOilChange || prev.daysSinceOilChange,
          }));
        }
      } catch (error: any) {
        if (error?.name === 'AbortError' || !isMountedRef.current) return;
        if (__DEV__) {
          console.warn('[MotorDetails] Failed to fetch oil change countdown from API:', error);
        }
      }
    };

    fetchOilChangeCountdown();

    // Cleanup on unmount or dependency change
    return () => {
      if (countdownAbortRef.current) {
        countdownAbortRef.current.abort();
        countdownAbortRef.current = null;
      }
    };
  }, [item?._id]);

  // Memoize maintenance record counts to prevent unnecessary re-fetches
  const maintenanceCounts = useMemo(() => {
    const refuels = maintenanceRecords.filter(record => record.type === 'refuel');
    const oilChanges = maintenanceRecords.filter(record => record.type === 'oil_change');
    const tuneUps = maintenanceRecords.filter(record => record.type === 'tune_up');
    return { refuels: refuels.length, oilChanges: oilChanges.length, tuneUps: tuneUps.length };
  }, [maintenanceRecords.length]); // Only recalculate when length changes

  // Fetch analytics from API for totals and performance metrics
  // Uses: GET /api/user-motors/motor-overview/:motorId, /api/fuel-stats/:motorId, /api/maintenance-records/analytics/summary
  useEffect(() => {
    // Abort previous request if still pending
    if (analyticsAbortRef.current) {
      analyticsAbortRef.current.abort();
    }

    analyticsAbortRef.current = new AbortController();
    const signal = analyticsAbortRef.current.signal;

    const fetchAnalytics = async () => {
      if (!item?._id || !item?.userId || !isMountedRef.current) return;

      try {
        // Get motor analytics for additional metrics
        const analyticsData = await getMotorAnalytics(item._id, item.userId);

        if (!isMountedRef.current) return;

        // Generate maintenance alerts from API data
        const alerts: string[] = [];
        const upcomingServices = analyticsData.maintenance?.upcomingServices || [];
        const now = new Date();
        
        upcomingServices.forEach((service: any) => {
          if (service.motorId === item._id) {
            const serviceDate = new Date(service.nextServiceDate);
            const daysUntilService = Math.floor((serviceDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            if (daysUntilService < 7) {
              alerts.push(`⚠️ ${service.type} due soon (${daysUntilService} days)`);
            }
          }
        });

        // Only update state if component is still mounted
        if (isMountedRef.current) {
          setAnalytics(prev => ({
            ...prev,
            totalRefuels: analyticsData.maintenance?.byType?.refuel || maintenanceCounts.refuels,
            totalOilChanges: analyticsData.maintenance?.byType?.oil_change || maintenanceCounts.oilChanges,
            totalTuneUps: analyticsData.maintenance?.byType?.tune_up || maintenanceCounts.tuneUps,
            averageFuelEfficiency: analyticsData.overview?.averageEfficiency || analyticsData.fuelStats?.averageEfficiency || 0,
            totalFuelConsumed: analyticsData.overview?.totalFuelUsed || analyticsData.fuelStats?.totalLiters || 0,
            maintenanceAlerts: alerts,
          }));
        }
      } catch (error: any) {
        if (error?.name === 'AbortError' || !isMountedRef.current) return;
        if (__DEV__) {
          console.warn('[MotorDetails] Failed to fetch analytics from API, using local calculations:', error);
        }
        
        // Fallback to local calculation if API fails
        if (isMountedRef.current) {
          setAnalytics(prev => ({
            ...prev,
            totalRefuels: maintenanceCounts.refuels,
            totalOilChanges: maintenanceCounts.oilChanges,
            totalTuneUps: maintenanceCounts.tuneUps,
            averageFuelEfficiency: prev.averageFuelEfficiency || 0,
            totalFuelConsumed: prev.totalFuelConsumed || 0,
            maintenanceAlerts: prev.maintenanceAlerts || [],
          }));
        }
      }
    };

    fetchAnalytics();

    // Cleanup on unmount or dependency change
    return () => {
      if (analyticsAbortRef.current) {
        analyticsAbortRef.current.abort();
        analyticsAbortRef.current = null;
      }
    };
  }, [item?._id, item?.userId, maintenanceCounts.refuels, maintenanceCounts.oilChanges, maintenanceCounts.tuneUps]);

  // Add safety check for item
  if (!item) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>No motor data available</Text>
      </View>
    );
  }

  // Initialize state with defaults for nested objects
  const [formData, setFormData] = useState({
    ...item,
    fuelConsumptionStats: {
      average: 0,
      max: 0,
      min: 0,
      ...(item.fuelConsumptionStats || {}),
    },
    analytics: {
      tripsCompleted: 0,
      totalDistance: 0,
      totalFuelUsed: 0,
      maintenanceAlerts: [],
      ...(item.analytics || {}),
    },
  });

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setLoading(true);

    try {
      // Remove virtual fields before sending
      const { totalDrivableDistance, totalDrivableDistanceWithCurrentGas, isLowFuel, ...rest } = formData;

      const payload = {
        ...rest,
        age: Number(rest.age) || 0,
        currentFuelLevel: Number(rest.currentFuelLevel) || 0,
        currentOdometer: Number(rest.currentOdometer) || 0,
        odometerAtAcquisition: Number(rest.odometerAtAcquisition) || 0,
        fuelConsumptionStats: {
          average: Number(rest.fuelConsumptionStats?.average) || 0,
          max: Number(rest.fuelConsumptionStats?.max) || 0,
          min: Number(rest.fuelConsumptionStats?.min) || 0,
        },
        analytics: {
          ...rest.analytics,
          tripsCompleted: Number(rest.analytics?.tripsCompleted) || 0,
          totalDistance: Number(rest.analytics?.totalDistance) || 0,
          totalFuelUsed: Number(rest.analytics?.totalFuelUsed) || 0,
          maintenanceAlerts: rest.analytics?.maintenanceAlerts || [],
        },
      };

      // Use apiRequest for consistency and automatic authentication with retry
      let updatedData;
      let retries = 0;
      const maxRetries = 3;
      
      while (retries < maxRetries) {
        try {
          updatedData = await apiRequest(`/api/user-motors/${rest._id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          });
          break; // Success, exit retry loop
        } catch (error: any) {
          retries++;
          
          // Only retry on network errors or 5xx errors
          const isRetryable = 
            error?.message?.includes('Network') ||
            error?.message?.includes('timeout') ||
            error?.message?.includes('ECONNREFUSED') ||
            error?.message?.includes('ETIMEDOUT');
          
          if (!isRetryable || retries >= maxRetries) {
            throw error; // Not retryable or max retries reached
          }
          
          // Exponential backoff: 1s, 2s, 4s
          const delay = 1000 * Math.pow(2, retries - 1);
          if (__DEV__) {
            console.log(`[MotorDetails] Retrying update after ${delay}ms (attempt ${retries}/${maxRetries})`);
          }
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }

      if (updatedData) {
        // Reapply nested defaults to avoid blank fields
        setFormData({
          ...updatedData,
          fuelConsumptionStats: {
            average: 0,
            max: 0,
            min: 0,
            ...updatedData.fuelConsumptionStats,
          },
          analytics: {
            tripsCompleted: 0,
            totalDistance: 0,
            totalFuelUsed: 0,
            maintenanceAlerts: [],
            ...updatedData.analytics,
          },
          // Keep virtual fields intact
          totalDrivableDistance: formData.totalDrivableDistance,
          totalDrivableDistanceWithCurrentGas: formData.totalDrivableDistanceWithCurrentGas,
          isLowFuel: formData.isLowFuel,
        });
      }

      Alert.alert("✅ Success", "Motor details updated successfully!");
      if (__DEV__) {
      console.log("Updated:", updatedData ?? payload);
      }
    } catch (error) {
      if (__DEV__) {
      console.error("Error updating motor:", error);
      }
      Alert.alert("❌ Error", "Failed to update motor details.");
    } finally {
      setLoading(false);

    }
  };
  {/* Timestamps */ }




  const fieldTitles: Record<string, string> = {
    motorcycleId: "Motorcycle ID",
    name: "Name",
    nickname: "Nickname ",
    fuelEfficiency: "Fuel Efficiency ",
    currentFuelLevel: "Current Fuel Level (%) ",
    totalDrivableDistance: "Total Drivable Distance (km)",
    totalDrivableDistanceWithCurrentGas: "Total Drivable Distance (Current Fuel)",
    tripsCompleted: "Trips Completed",
    totalDistance: "Total Distance (km)",
    totalFuelUsed: "Total Fuel Used (L)",
    createdAt: "Created At",
    updatedAt: "Updated At",
  };
  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Back Button */}
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Icon name="arrow-back" size={24} color="#333" />
        <Text style={styles.backText}>Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Motor Details</Text>

      {/* Loading Indicator */}
      {loading && (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading analytics data...</Text>
        </View>
      )}

      {/* Helper mapping for nice labels */}


      {/* Basic Info */}
      <Text style={styles.sectionTitle}>Basic Info</Text>
      {["motorcycleId", "name", "nickname", "fuelEfficiency"].map(field => {
        const isEditable = field === "nickname" || field === "fuelEfficiency";
        return (
          <View style={styles.section} key={field}>
            <Text style={styles.label}>{fieldTitles[field]}</Text>
            <TextInput
              style={[styles.input, !isEditable && { backgroundColor: "#EEE" }]}
              value={String(formData[field] ?? "")}
              onChangeText={isEditable ? (text => handleChange(field, text)) : undefined}
              keyboardType={["fuelEfficiency"].includes(field) ? "numeric" : "default"}
              editable={isEditable}
              placeholder={isEditable ? "Enter " + fieldTitles[field].replace(" ✏️", "") : undefined}
            />
            {!isEditable && (
              <Text style={styles.readOnlyText}>Read-only field</Text>
            )}
          </View>
        );
      })}

      {/* Fuel Tracking */}
      <Text style={styles.sectionTitle}>Fuel Tracking</Text>
      <View style={styles.section}>
        <Text style={styles.label}>{fieldTitles.currentFuelLevel}</Text>
        <TextInput
          style={styles.input}
          value={
            formData.currentFuelLevel !== undefined && formData.currentFuelLevel !== null
              ? Number(formData.currentFuelLevel).toFixed(0)
              : ""
          }
          onChangeText={text => handleChange("currentFuelLevel", text)}
          keyboardType="numeric"
          editable={true}
        />
      </View>

      {/* Virtual Fields */}
      <Text style={styles.sectionTitle}>Automatic Fields</Text>
      {["totalDrivableDistance", "totalDrivableDistanceWithCurrentGas"].map(vf => (
        <View style={styles.section} key={vf}>
          <Text style={styles.label}>{fieldTitles[vf]}</Text>
          <TextInput
            style={[styles.input, { backgroundColor: "#EEE" }]}
            value={
              formData[vf] !== undefined && formData[vf] !== null
                ? `${formData[vf].toFixed(2)} km`
                : ""
            }
            editable={false}
          />
        </View>
      ))}

      {/* Analytics
      <Text style={styles.sectionTitle}>Analytics</Text>
      {["tripsCompleted", "totalDistance", "totalFuelUsed"].map(stat => {
        let value = formData.analytics?.[stat];

        // Format numbers to 2 decimals for distance/fuel
        if (stat === "totalDistance" || stat === "totalFuelUsed") {
          value = value !== undefined && value !== null ? value.toFixed(2) : "";
        }

        // Append units
        let displayValue = value;
        if (stat === "totalDistance" && value !== "") displayValue = `${value}`;
        if (stat === "totalFuelUsed" && value !== "") displayValue = `${value}`;

        return (
          <View style={styles.section} key={stat}>
            <Text style={styles.label}>{fieldTitles[stat]}</Text>
            <TextInput
              style={styles.input}
              value={String(displayValue)}
              onChangeText={text =>
                setFormData(prev => ({
                  ...prev,
                  analytics: { ...prev.analytics, [stat]: text },
                }))
              }
              keyboardType="numeric"
            />
          </View>
        );
      })} */}


      {/* Maintenance Analytics */}
      <Text style={styles.sectionTitle}>🔧 Maintenance Analytics</Text>

      {/* Last Refuel */}
      <View style={styles.section}>
        <Text style={styles.label}>Last Refuel</Text>
        <TextInput
          style={[styles.input, { backgroundColor: "#EEE" }]}
          value={
            analytics.lastRefuel
              ? new Date(analytics.lastRefuel.timestamp).toLocaleDateString("en-US", {
                year: "numeric",
                month: "short",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })
              : "No refuel records"
          }
          editable={false}
        />
        <Text style={styles.subLabel}>
          Total Refuels: {analytics.totalRefuels} |
          Quantity: {typeof analytics.lastRefuel?.details?.quantity === "number" ? analytics.lastRefuel.details.quantity.toFixed(2) : "N/A"}L |
          Cost: ₱{analytics.lastRefuel?.details?.cost || "N/A"}
        </Text>
        
        {/* Additional Refuel Details from API Documentation */}
        {analytics.lastRefuel && (
          <View style={styles.detailsContainer}>
            {analytics.lastRefuel.details?.costPerLiter && (
              <Text style={styles.detailText}>
                💰 Cost per Liter: ₱{Number(analytics.lastRefuel.details.costPerLiter).toFixed(2)}
              </Text>
            )}
            {analytics.lastRefuel.details?.fuelTank && (
              <Text style={styles.detailText}>
                ⛽ Fuel Tank: {analytics.lastRefuel.details.fuelTank}L
              </Text>
            )}
            {analytics.lastRefuel.details?.refueledPercent && (
              <Text style={styles.detailText}>
                📊 Refueled: {analytics.lastRefuel.details.refueledPercent.toFixed(1)}%
              </Text>
            )}
            {analytics.lastRefuel.details?.fuelLevelBefore !== undefined && (
              <Text style={styles.detailText}>
                📉 Fuel Before: {analytics.lastRefuel.details.fuelLevelBefore.toFixed(0)}%
              </Text>
            )}
            {analytics.lastRefuel.details?.fuelLevelAfter !== undefined && (
              <Text style={styles.detailText}>
                📈 Fuel After: {analytics.lastRefuel.details.fuelLevelAfter.toFixed(0)}%
              </Text>
            )}
            {analytics.lastRefuel.odometer && (
              <Text style={styles.detailText}>
                🛣️ Odometer: {analytics.lastRefuel.odometer.toLocaleString()} km
              </Text>
            )}
            {analytics.lastRefuel.location?.address && (
              <Text style={styles.detailText}>
                📍 Location: {analytics.lastRefuel.location.address}
              </Text>
            )}
            {analytics.lastRefuel.details?.serviceProvider && (
              <Text style={styles.detailText}>
                🏪 Service Provider: {analytics.lastRefuel.details.serviceProvider}
              </Text>
            )}
            {analytics.lastRefuel.details?.notes && (
              <Text style={styles.detailText}>
                📝 Notes: {analytics.lastRefuel.details.notes}
              </Text>
            )}
          </View>
        )}
      </View>

      {/* Last Oil Change */}
      <View style={styles.section}>
        <Text style={styles.label}>Last Oil Change</Text>
        <TextInput
          style={[styles.input, { backgroundColor: "#EEE" }]}
          value={
            analytics.lastOilChange
              ? new Date(analytics.lastOilChange.timestamp).toLocaleDateString("en-US", {
                year: "numeric",
                month: "short",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })
              : "No oil change records"
          }
          editable={false}
        />
        <Text style={styles.subLabel}>
          Total Oil Changes: {analytics.totalOilChanges} |
          KM Since Last Change: {analytics.kmSinceOilChange.toFixed(0)}km |
          Quantity: {analytics.lastOilChange?.details?.quantity || "N/A"}L
        </Text>
        
        {/* Additional Oil Change Details from API Documentation */}
        {analytics.lastOilChange && (
          <View style={styles.detailsContainer}>
            {analytics.lastOilChange.details?.oilType && (
              <Text style={styles.detailText}>
                🛢️ Oil Type: {analytics.lastOilChange.details.oilType}
              </Text>
            )}
            {analytics.lastOilChange.details?.oilViscosity && (
              <Text style={styles.detailText}>
                📏 Oil Viscosity: {analytics.lastOilChange.details.oilViscosity}
              </Text>
            )}
            {analytics.lastOilChange.odometer && (
              <Text style={styles.detailText}>
                🛣️ Odometer: {analytics.lastOilChange.odometer.toLocaleString()} km
              </Text>
            )}
            {analytics.lastOilChange.location?.address && (
              <Text style={styles.detailText}>
                📍 Location: {analytics.lastOilChange.location.address}
              </Text>
            )}
            {analytics.lastOilChange.details?.serviceProvider && (
              <Text style={styles.detailText}>
                🏪 Service Provider: {analytics.lastOilChange.details.serviceProvider}
              </Text>
            )}
            {analytics.lastOilChange.details?.warranty !== undefined && (
              <Text style={styles.detailText}>
                🛡️ Warranty: {analytics.lastOilChange.details.warranty ? "Yes" : "No"}
              </Text>
            )}
            {analytics.lastOilChange.details?.nextServiceDate && (
              <Text style={styles.detailText}>
                📅 Next Service Date: {new Date(analytics.lastOilChange.details.nextServiceDate).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "short",
                  day: "2-digit",
                })}
              </Text>
            )}
            {analytics.lastOilChange.details?.nextServiceOdometer && (
              <Text style={styles.detailText}>
                🛣️ Next Service Odometer: {analytics.lastOilChange.details.nextServiceOdometer.toLocaleString()} km
              </Text>
            )}
            {analytics.lastOilChange.details?.notes && (
              <Text style={styles.detailText}>
                📝 Notes: {analytics.lastOilChange.details.notes}
              </Text>
            )}
          </View>
        )}
      </View>

      {/* Oil Change Countdown */}
      {analytics.lastOilChange && (
        <View style={styles.section}>
          <Text style={styles.label}>🕒 Next Oil Change Countdown</Text>
          
          {/* Distance-based countdown */}
          <View style={styles.countdownContainer}>
            <Text style={styles.countdownTitle}>Distance Remaining</Text>
            <View style={styles.countdownBox}>
              <Text style={[
                styles.countdownValue,
                { color: analytics.kmSinceOilChange >= 3000 ? '#FF6B6B' : '#4CAF50' }
              ]}>
                {Math.max(0, 3000 - analytics.kmSinceOilChange).toFixed(0)} km
              </Text>
              <Text style={styles.countdownSubtext}>
                {analytics.kmSinceOilChange >= 3000 ? 'OVERDUE' : 'remaining'}
              </Text>
            </View>
            <View style={styles.progressBar}>
              <View style={[
                styles.progressFill,
                {
                  width: `${Math.min(100, (analytics.kmSinceOilChange / 3000) * 100)}%`,
                  backgroundColor: analytics.kmSinceOilChange >= 3000 ? '#FF6B6B' : '#4CAF50'
                }
              ]} />
            </View>
          </View>

          {/* Time-based countdown */}
          <View style={styles.countdownContainer}>
            <Text style={styles.countdownTitle}>Time Remaining</Text>
            <View style={styles.countdownBox}>
              <Text style={[
                styles.countdownValue,
                { color: analytics.daysSinceOilChange >= 180 ? '#FF6B6B' : '#4CAF50' }
              ]}>
                {Math.max(0, 180 - analytics.daysSinceOilChange)} days
              </Text>
              <Text style={styles.countdownSubtext}>
                {analytics.daysSinceOilChange >= 180 ? 'OVERDUE' : 'remaining'}
              </Text>
            </View>
            <View style={styles.progressBar}>
              <View style={[
                styles.progressFill,
                {
                  width: `${Math.min(100, (analytics.daysSinceOilChange / 180) * 100)}%`,
                  backgroundColor: analytics.daysSinceOilChange >= 180 ? '#FF6B6B' : '#4CAF50'
                }
              ]} />
            </View>
          </View>

          {/* Recommendation */}
          <View style={[
            styles.recommendationBox,
            { backgroundColor: analytics.kmSinceOilChange >= 3000 || analytics.daysSinceOilChange >= 180 ? '#FFEBEE' : '#E8F5E8' }
          ]}>
            <Text style={[
              styles.recommendationText,
              { color: analytics.kmSinceOilChange >= 3000 || analytics.daysSinceOilChange >= 180 ? '#D32F2F' : '#2E7D32' }
            ]}>
              {analytics.kmSinceOilChange >= 3000 || analytics.daysSinceOilChange >= 180 
                ? '⚠️ Oil change is overdue! Schedule maintenance soon.'
                : '✅ Oil change is not due yet. Monitor distance and time.'}
            </Text>
          </View>
        </View>
      )}

      {/* Last Tune Up */}
      <View style={styles.section}>
        <Text style={styles.label}>Last Tune Up</Text>
        <TextInput
          style={[styles.input, { backgroundColor: "#EEE" }]}
          value={
            analytics.lastTuneUp
              ? new Date(analytics.lastTuneUp.timestamp).toLocaleDateString("en-US", {
                year: "numeric",
                month: "short",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })
              : "No tune-up records"
          }
          editable={false}
        />
        <Text style={styles.subLabel}>
          Total Tune Ups: {analytics.totalTuneUps} |
          KM Since Last Tune Up: {analytics.kmSinceTuneUp.toFixed(0)}km |
          Cost: ₱{analytics.lastTuneUp?.details?.cost || "N/A"}
        </Text>
        
        {/* Additional Tune Up Details from API Documentation */}
        {analytics.lastTuneUp && (
          <View style={styles.detailsContainer}>
            {analytics.lastTuneUp.odometer && (
              <Text style={styles.detailText}>
                🛣️ Odometer: {analytics.lastTuneUp.odometer.toLocaleString()} km
              </Text>
            )}
            {analytics.lastTuneUp.location?.address && (
              <Text style={styles.detailText}>
                📍 Location: {analytics.lastTuneUp.location.address}
              </Text>
            )}
            {analytics.lastTuneUp.details?.serviceProvider && (
              <Text style={styles.detailText}>
                🏪 Service Provider: {analytics.lastTuneUp.details.serviceProvider}
              </Text>
            )}
            {analytics.lastTuneUp.details?.warranty !== undefined && (
              <Text style={styles.detailText}>
                🛡️ Warranty: {analytics.lastTuneUp.details.warranty ? "Yes" : "No"}
              </Text>
            )}
            {analytics.lastTuneUp.details?.nextServiceDate && (
              <Text style={styles.detailText}>
                📅 Next Service Date: {new Date(analytics.lastTuneUp.details.nextServiceDate).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "short",
                  day: "2-digit",
                })}
              </Text>
            )}
            {analytics.lastTuneUp.details?.nextServiceOdometer && (
              <Text style={styles.detailText}>
                🛣️ Next Service Odometer: {analytics.lastTuneUp.details.nextServiceOdometer.toLocaleString()} km
              </Text>
            )}
            {analytics.lastTuneUp.details?.notes && (
              <Text style={styles.detailText}>
                📝 Notes: {analytics.lastTuneUp.details.notes}
              </Text>
            )}
          </View>
        )}
      </View>

      {/* Performance Analytics */}
      <Text style={styles.sectionTitle}>📊 Performance Analytics</Text>

      <View style={styles.section}>
        <Text style={styles.label}>Average Fuel Efficiency</Text>
        <TextInput
          style={[styles.input, { backgroundColor: "#EEE" }]}
          value={`${analytics.averageFuelEfficiency.toFixed(2)} km/L`}
          editable={false}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Total Fuel Consumed</Text>
        <TextInput
          style={[styles.input, { backgroundColor: "#EEE" }]}
          value={`${analytics.totalFuelConsumed.toFixed(2)} L`}
          editable={false}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Total Trips</Text>
        <TextInput
          style={[styles.input, { backgroundColor: "#EEE" }]}
          value={`${trips.length} trips`}
          editable={false}
        />
      </View>

      {/* Maintenance Alerts */}
      {analytics.maintenanceAlerts.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>⚠️ Maintenance Alerts</Text>
          {analytics.maintenanceAlerts.map((alert, index) => (
            <View key={index} style={[styles.section, styles.alertSection]}>
              <Text style={styles.alertText}>{alert}</Text>
            </View>
          ))}
        </>
      )}

      {/* Timestamps */}
      <Text style={styles.sectionTitle}>Timestamps</Text>
      {useMemo(() => {
        return ["createdAt", "updatedAt"].map(field => {
          const rawDate = formData[field];
          let formattedDate = "";
          if (rawDate) {
            const dateObj = new Date(rawDate);
            formattedDate = dateObj.toLocaleString("en-US", {
              year: "numeric",
              month: "short",
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
              hour12: true,
            });
          }

          return (
            <View style={styles.section} key={field}>
              <Text style={styles.label}>{fieldTitles[field]}</Text>
              <TextInput
                style={[styles.input, { backgroundColor: "#EEE" }]}
                value={formattedDate}
                editable={false}
              />
            </View>
          );
        });
      }, [formData.createdAt, formData.updatedAt])}


      {/* Save Button */}
      <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={loading}>
        <Text style={styles.saveText}>
          {loading ? "⏳ Saving..." : "💾 Save Changes"}
        </Text>
      </TouchableOpacity>
    </ScrollView>

  );
}

const styles = StyleSheet.create({
  container: { padding: 20, backgroundColor: "#F7F8FA" },
  backButton: { flexDirection: "row", alignItems: "center", marginBottom: 20 },
  backText: { marginLeft: 8, fontSize: 16, color: "#4A4A4A", fontWeight: "500" },
  title: { fontSize: 24, fontWeight: "700", color: "#1F1F1F", marginBottom: 20, textAlign: "center" },
  section: { backgroundColor: "#FFF", borderRadius: 12, padding: 16, marginBottom: 16, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 3 },
  sectionTitle: { fontSize: 18, fontWeight: "600", color: "#2F80ED", marginBottom: 12, borderBottomWidth: 1, borderBottomColor: "#E0E0E0", paddingBottom: 6 },
  label: { fontSize: 14, color: "#555", marginBottom: 6, fontWeight: "500" },
  input: { borderWidth: 1, borderColor: "#D1D5DB", borderRadius: 10, padding: 12, fontSize: 16, backgroundColor: "#FAFAFA" },
  saveButton: { backgroundColor: "#2F80ED", paddingVertical: 16, borderRadius: 12, marginTop: 20, alignItems: "center", shadowColor: "#2F80ED", shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 5 },
  saveText: { fontSize: 18, color: "#FFF", fontWeight: "700" },
  errorText: { fontSize: 16, color: "#FF6B6B", textAlign: "center", marginTop: 50 },
  subLabel: { fontSize: 12, color: "#666", marginTop: 4, fontStyle: "italic" },
  alertSection: { backgroundColor: "#FFF3CD", borderColor: "#FFEAA7", borderWidth: 1 },
  alertText: { fontSize: 14, color: "#856404", fontWeight: "500" },
  loadingContainer: { backgroundColor: "#E3F2FD", padding: 16, borderRadius: 8, marginBottom: 16, alignItems: "center" },
  loadingText: { fontSize: 14, color: "#1976D2", fontWeight: "500" },
  readOnlyText: { fontSize: 12, color: "#999", marginTop: 4, fontStyle: "italic" },
  countdownContainer: { marginBottom: 16 },
  countdownTitle: { fontSize: 14, color: "#666", marginBottom: 8, fontWeight: "600" },
  countdownBox: { 
    backgroundColor: "#F8F9FA", 
    borderRadius: 8, 
    padding: 12, 
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E9ECEF"
  },
  countdownValue: { fontSize: 24, fontWeight: "700", marginBottom: 4 },
  countdownSubtext: { fontSize: 12, color: "#666", fontWeight: "500" },
  progressBar: { 
    height: 6, 
    backgroundColor: "#E9ECEF", 
    borderRadius: 3, 
    marginTop: 8,
    overflow: "hidden"
  },
  progressFill: { 
    height: "100%", 
    borderRadius: 3
  },
  recommendationBox: { 
    marginTop: 12, 
    padding: 12, 
    borderRadius: 8, 
    borderWidth: 1,
    borderColor: "#E0E0E0"
  },
  recommendationText: { 
    fontSize: 14, 
    fontWeight: "600", 
    textAlign: "center" 
  },
  detailsContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#E0E0E0",
  },
  detailText: {
    fontSize: 13,
    color: "#666",
    marginBottom: 6,
    lineHeight: 20,
  },
});
