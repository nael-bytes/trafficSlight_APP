import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  View, Text, TextInput, StyleSheet, ScrollView, TouchableOpacity, Alert
} from "react-native";
import { RouteProp, useNavigation } from "@react-navigation/native";
import Icon from "react-native-vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiRequest } from '../../utils/api';
import { getMotorAnalytics } from '../../services/motorService';

type RootStackParamList = {
  MotorDetails: { item: any };
  MotorList: { fullList: any[] };
};

type Props = {
  route: RouteProp<RootStackParamList, "MotorDetails">;
};

// Cache configuration
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes
const getCacheKey = (motorId: string, type: string) => `motorDetails_${motorId}_${type}`;
const getCacheExpiryKey = (motorId: string, type: string) => `motorDetails_${motorId}_${type}_expiry`;
const getLastRecordsCacheKey = (userId: string) => `motorDetails_lastRecords_${userId}`;
const getLastRecordsExpiryKey = (userId: string) => `motorDetails_lastRecords_${userId}_expiry`;

// Validation function to ensure data is real and valid
const isValidMaintenanceRecord = (record: any): boolean => {
  if (!record) return false;
  // Must have at least an ID or timestamp/date
  if (!record._id && !record.timestamp && !record.date && !record.createdAt) return false;
  // Must have a type
  if (!record.type || !['refuel', 'oil_change', 'tune_up', 'repair', 'other'].includes(record.type)) return false;
  return true;
};

const isValidLastRecord = (record: any): boolean => {
  if (!record) return false;
  // Must have at least a date or timestamp
  if (!record.date && !record.timestamp && !record._id) return false;
  return true;
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

  // Cache management functions
  const loadFromCache = async (key: string, expiryKey: string): Promise<any> => {
    try {
      const [cachedData, expiryTime] = await Promise.all([
        AsyncStorage.getItem(key),
        AsyncStorage.getItem(expiryKey),
      ]);

      if (!cachedData || !expiryTime) return null;

      const expiry = parseInt(expiryTime);
      if (Date.now() > expiry) {
        if (__DEV__) {
          console.log(`[MotorDetails] Cache expired for ${key}`);
        }
        // Clear expired cache
        await Promise.all([
          AsyncStorage.removeItem(key),
          AsyncStorage.removeItem(expiryKey),
        ]);
        return null;
      }

      const parsed = JSON.parse(cachedData);
      if (__DEV__) {
        console.log(`[MotorDetails] ✅ Loaded from cache: ${key}`, {
          isArray: Array.isArray(parsed),
          count: Array.isArray(parsed) ? parsed.length : 'N/A',
        });
      }
      return parsed;
    } catch (error) {
      if (__DEV__) {
        console.warn(`[MotorDetails] Failed to load cache for ${key}:`, error);
      }
      return null;
    }
  };

  const saveToCache = async (key: string, expiryKey: string, data: any): Promise<void> => {
    try {
      const expiry = Date.now() + CACHE_DURATION;
      await Promise.all([
        AsyncStorage.setItem(key, JSON.stringify(data)),
        AsyncStorage.setItem(expiryKey, expiry.toString()),
      ]);
      if (__DEV__) {
        console.log(`[MotorDetails] 💾 Cached data: ${key}`, {
          expiresAt: new Date(expiry).toLocaleString(),
        });
      }
    } catch (error) {
      if (__DEV__) {
        console.warn(`[MotorDetails] Failed to save cache for ${key}:`, error);
      }
    }
  };

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

        // ✅ Load maintenance records from cache first
        const cacheKey = getCacheKey(item._id, 'maintenanceRecords');
        const cacheExpiryKey = getCacheExpiryKey(item._id, 'maintenanceRecords');
        const cachedRecords = await loadFromCache(cacheKey, cacheExpiryKey);

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

        if (__DEV__) {
          console.log('[MotorDetails] 📥 Maintenance records fetched:', {
            isArray: Array.isArray(maintenanceData),
            hasMaintenanceRecords: !!maintenanceData?.maintenanceRecords,
            hasData: !!maintenanceData?.data,
            hasRecords: !!maintenanceData?.records,
            count: Array.isArray(maintenanceData) ? maintenanceData.length : 
                   (maintenanceData?.maintenanceRecords?.length || maintenanceData?.data?.length || maintenanceData?.records?.length || 0),
            refuels: (Array.isArray(maintenanceData) ? maintenanceData : 
                     (maintenanceData?.maintenanceRecords || maintenanceData?.data || maintenanceData?.records || [])).filter((r: any) => r.type === 'refuel').length,
            oilChanges: (Array.isArray(maintenanceData) ? maintenanceData : 
                        (maintenanceData?.maintenanceRecords || maintenanceData?.data || maintenanceData?.records || [])).filter((r: any) => r.type === 'oil_change').length,
            tuneUps: (Array.isArray(maintenanceData) ? maintenanceData : 
                     (maintenanceData?.maintenanceRecords || maintenanceData?.data || maintenanceData?.records || [])).filter((r: any) => r.type === 'tune_up').length,
          });
        }

        // Verify data structure
        let records: any[] = [];
        if (Array.isArray(maintenanceData)) {
          records = maintenanceData;
        } else if (maintenanceData?.maintenanceRecords) {
          records = Array.isArray(maintenanceData.maintenanceRecords) ? maintenanceData.maintenanceRecords : [];
        } else if (maintenanceData?.data) {
          records = Array.isArray(maintenanceData.data) ? maintenanceData.data : [];
        } else if (maintenanceData?.records) {
          records = Array.isArray(maintenanceData.records) ? maintenanceData.records : [];
        }
        
        // Validate records - ensure they're real data
        const validRecords = records.filter(isValidMaintenanceRecord);
        setMaintenanceRecords(validRecords);
        
        // ✅ Save valid records to cache
        if (validRecords.length > 0) {
          await saveToCache(cacheKey, cacheExpiryKey, validRecords);
        }
        
        // FALLBACK: If API last records failed or returned no data, use these records as fallback
        // This ensures we always show the last records even if the /last/:userId endpoint fails
        if (validRecords.length > 0 && isMountedRef.current) {
          const refuels = validRecords.filter(record => record.type === 'refuel');
          const oilChanges = validRecords.filter(record => record.type === 'oil_change');
          const tuneUps = validRecords.filter(record => record.type === 'tune_up');
          
          const sortedRefuels = [...refuels].sort((a, b) => {
            const dateA = a.timestamp || a.date || a.createdAt;
            const dateB = b.timestamp || b.date || b.createdAt;
            return new Date(dateB).getTime() - new Date(dateA).getTime();
          });
          const sortedOilChanges = [...oilChanges].sort((a, b) => {
            const dateA = a.timestamp || a.date || a.createdAt;
            const dateB = b.timestamp || b.date || b.createdAt;
            return new Date(dateB).getTime() - new Date(dateA).getTime();
          });
          const sortedTuneUps = [...tuneUps].sort((a, b) => {
            const dateA = a.timestamp || a.date || a.createdAt;
            const dateB = b.timestamp || b.date || b.createdAt;
            return new Date(dateB).getTime() - new Date(dateA).getTime();
          });
          
          // Only set if analytics don't already have values (to avoid overwriting API data)
          // CRITICAL: Validate records before setting - ensure they're real data
          setAnalytics(prev => ({
            ...prev,
            lastRefuel: prev.lastRefuel || (sortedRefuels[0] && isValidMaintenanceRecord(sortedRefuels[0]) ? sortedRefuels[0] : null),
            lastOilChange: prev.lastOilChange || (sortedOilChanges[0] && isValidMaintenanceRecord(sortedOilChanges[0]) ? sortedOilChanges[0] : null),
            lastTuneUp: prev.lastTuneUp || (sortedTuneUps[0] && isValidMaintenanceRecord(sortedTuneUps[0]) ? sortedTuneUps[0] : null),
          }));
          
          if (__DEV__) {
            console.log('[MotorDetails] ✅ Set fallback last records from maintenanceRecords:', {
              hasLastRefuel: !!(sortedRefuels[0] && isValidMaintenanceRecord(sortedRefuels[0])),
              hasLastOilChange: !!(sortedOilChanges[0] && isValidMaintenanceRecord(sortedOilChanges[0])),
              hasLastTuneUp: !!(sortedTuneUps[0] && isValidMaintenanceRecord(sortedTuneUps[0])),
            });
          }
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
  // FALLBACK: If API fails or returns no data, use local maintenanceRecords
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
        if (__DEV__) {
          console.log('[MotorDetails] 🔄 Fetching last maintenance records for userId:', item.userId);
        }
        
        // ✅ Load from cache first
        const lastRecordsCacheKey = getLastRecordsCacheKey(item.userId);
        const lastRecordsExpiryKey = getLastRecordsExpiryKey(item.userId);
        const cachedLastRecords = await loadFromCache(lastRecordsCacheKey, lastRecordsExpiryKey);
        
        if (cachedLastRecords && isMountedRef.current) {
          // Validate cached last records
          const validLastRecords = {
            lastRefuel: cachedLastRecords.lastRefuel && isValidLastRecord(cachedLastRecords.lastRefuel) ? cachedLastRecords.lastRefuel : null,
            lastOilChange: cachedLastRecords.lastOilChange && isValidLastRecord(cachedLastRecords.lastOilChange) ? cachedLastRecords.lastOilChange : null,
            lastTuneUp: cachedLastRecords.lastTuneUp && isValidLastRecord(cachedLastRecords.lastTuneUp) ? cachedLastRecords.lastTuneUp : null,
          };
          
          if (__DEV__) {
            console.log('[MotorDetails] ✅ Using cached last records:', {
              hasLastRefuel: !!validLastRecords.lastRefuel,
              hasLastOilChange: !!validLastRecords.lastOilChange,
              hasLastTuneUp: !!validLastRecords.lastTuneUp,
            });
          }
          
          // Use cached data to fetch full records
          if (validLastRecords.lastRefuel || validLastRecords.lastOilChange || validLastRecords.lastTuneUp) {
            // Continue to fetch full records using cached summary
            // (We still need to fetch full details, but we have the summary from cache)
          }
        }
        
        // Fetch last maintenance records using the API endpoint
        const lastRecords = await apiRequest(`/api/maintenance-records/last/${item.userId}`, { signal });
        
        if (!isMountedRef.current) return;

        // Validate API response
        const validLastRecords = {
          lastRefuel: lastRecords?.lastRefuel && isValidLastRecord(lastRecords.lastRefuel) ? lastRecords.lastRefuel : null,
          lastOilChange: lastRecords?.lastOilChange && isValidLastRecord(lastRecords.lastOilChange) ? lastRecords.lastOilChange : null,
          lastTuneUp: lastRecords?.lastTuneUp && isValidLastRecord(lastRecords.lastTuneUp) ? lastRecords.lastTuneUp : null,
        };

        // ✅ Save valid last records to cache
        if (validLastRecords.lastRefuel || validLastRecords.lastOilChange || validLastRecords.lastTuneUp) {
          await saveToCache(lastRecordsCacheKey, lastRecordsExpiryKey, validLastRecords);
        }

        if (__DEV__) {
          console.log('[MotorDetails] 📥 Last maintenance records from API:', {
            hasLastRefuel: !!validLastRecords.lastRefuel,
            hasLastOilChange: !!validLastRecords.lastOilChange,
            hasLastTuneUp: !!validLastRecords.lastTuneUp,
            lastRefuel: validLastRecords.lastRefuel,
            lastOilChange: validLastRecords.lastOilChange,
            lastTuneUp: validLastRecords.lastTuneUp,
          });
        }

        // Fetch full details for each last record if they exist
        const fetchFullRecord = async (record: any, type: string) => {
          // Check if record exists - it might have date, timestamp, or just be an object
          if (!record || (!record.date && !record.timestamp && !record._id) || !isMountedRef.current) {
            if (__DEV__) {
              console.log(`[MotorDetails] No ${type} record from last endpoint:`, record);
            }
            return null;
          }
          
          // Get the most recent record of this type for this motor
          try {
            if (__DEV__) {
              console.log(`[MotorDetails] Fetching full ${type} record for motor ${item._id}`);
            }
            
            const records = await apiRequest(
              `/api/maintenance-records/motor/${item._id}?type=${type}&limit=1&sortBy=timestamp&sortOrder=desc`,
              { signal }
            );
            
            if (!isMountedRef.current) return null;
            
            if (__DEV__) {
              console.log(`[MotorDetails] Full ${type} records response:`, records);
            }
            
            let fullRecord = null;
            if (records?.records && records.records.length > 0) {
              fullRecord = records.records[0];
            } else if (Array.isArray(records) && records.length > 0) {
              fullRecord = records[0];
            } else if (records?.data && Array.isArray(records.data) && records.data.length > 0) {
              fullRecord = records.data[0];
            }
            
            if (fullRecord) {
              if (__DEV__) {
                console.log(`[MotorDetails] Found full ${type} record:`, {
                  id: fullRecord._id,
                  motorId: fullRecord.motorId?._id || fullRecord.motorId,
                  type: fullRecord.type,
                  timestamp: fullRecord.timestamp,
                });
              }
            } else {
              if (__DEV__) {
                console.warn(`[MotorDetails] No full ${type} record found in response`);
              }
            }
            
            return fullRecord;
          } catch (error: any) {
            if (error?.name === 'AbortError' || !isMountedRef.current) return null;
            if (__DEV__) {
              console.error(`[MotorDetails] Failed to fetch full ${type} record:`, error);
            }
          }
          return null;
        };

        // Fetch full details for last refuel, oil change, and tune-up
        // Use validated records
        const [lastRefuelFull, lastOilChangeFull, lastTuneUpFull] = await Promise.all([
          fetchFullRecord(validLastRecords.lastRefuel, 'refuel'),
          fetchFullRecord(validLastRecords.lastOilChange, 'oil_change'),
          fetchFullRecord(validLastRecords.lastTuneUp, 'tune_up'),
        ]);

        // Helper function to check if record belongs to current motor
        const belongsToMotor = (record: any) => {
          if (!record) return false;
          // Check various possible motorId structures
          const motorId = record.motorId?._id || record.motorId || record.motorIdId;
          return motorId === item._id || motorId === item._id?.toString();
        };

        // Only update state if component is still mounted
        // CRITICAL: Validate records before setting - ensure they're real data
        if (isMountedRef.current) {
          const validLastRefuel = lastRefuelFull && belongsToMotor(lastRefuelFull) && isValidMaintenanceRecord(lastRefuelFull) ? lastRefuelFull : null;
          const validLastOilChange = lastOilChangeFull && belongsToMotor(lastOilChangeFull) && isValidMaintenanceRecord(lastOilChangeFull) ? lastOilChangeFull : null;
          const validLastTuneUp = lastTuneUpFull && belongsToMotor(lastTuneUpFull) && isValidMaintenanceRecord(lastTuneUpFull) ? lastTuneUpFull : null;
          
          setAnalytics(prev => ({
            ...prev,
            lastRefuel: validLastRefuel || prev.lastRefuel || null,
            lastOilChange: validLastOilChange || prev.lastOilChange || null,
            lastTuneUp: validLastTuneUp || prev.lastTuneUp || null,
          }));
          
          // ✅ Cache the full records if valid
          if (validLastRefuel || validLastOilChange || validLastTuneUp) {
            const fullRecordsCache = {
              lastRefuel: validLastRefuel,
              lastOilChange: validLastOilChange,
              lastTuneUp: validLastTuneUp,
            };
            await saveToCache(
              getCacheKey(item._id, 'lastFullRecords'),
              getCacheExpiryKey(item._id, 'lastFullRecords'),
              fullRecordsCache
            );
          }
          
          if (__DEV__) {
            console.log('[MotorDetails] Updated analytics with last records:', {
              hasLastRefuel: !!validLastRefuel,
              hasLastOilChange: !!validLastOilChange,
              hasLastTuneUp: !!validLastTuneUp,
            });
          }
        }
      } catch (error: any) {
        if (error?.name === 'AbortError' || !isMountedRef.current) return;
        if (__DEV__) {
          console.error('[MotorDetails] ❌ Failed to fetch last maintenance records from API:', {
            error: error,
            message: error?.message,
            userId: item?.userId,
          });
        }
        
        // FALLBACK: Use local maintenanceRecords if API fails
        // CRITICAL: Only use real, validated data
        if (isMountedRef.current && maintenanceRecords.length > 0) {
          if (__DEV__) {
            console.log('[MotorDetails] 🔄 Using fallback: local maintenanceRecords');
          }
          
          // Validate maintenance records - ensure they're real data
          const validRecords = maintenanceRecords.filter(isValidMaintenanceRecord);
          
          if (validRecords.length === 0) {
            if (__DEV__) {
              console.warn('[MotorDetails] ⚠️ No valid maintenance records for fallback');
            }
            return;
          }
          
          const refuels = validRecords.filter(record => record.type === 'refuel');
          const oilChanges = validRecords.filter(record => record.type === 'oil_change');
          const tuneUps = validRecords.filter(record => record.type === 'tune_up');
          
          const sortedRefuels = [...refuels].sort((a, b) => {
            const dateA = a.timestamp || a.date || a.createdAt;
            const dateB = b.timestamp || b.date || b.createdAt;
            return new Date(dateB).getTime() - new Date(dateA).getTime();
          });
          const sortedOilChanges = [...oilChanges].sort((a, b) => {
            const dateA = a.timestamp || a.date || a.createdAt;
            const dateB = b.timestamp || b.date || b.createdAt;
            return new Date(dateB).getTime() - new Date(dateA).getTime();
          });
          const sortedTuneUps = [...tuneUps].sort((a, b) => {
            const dateA = a.timestamp || a.date || a.createdAt;
            const dateB = b.timestamp || b.date || b.createdAt;
            return new Date(dateB).getTime() - new Date(dateA).getTime();
          });
          
          // CRITICAL: Validate each record before setting - ensure they're real data
          const validLastRefuel = sortedRefuels[0] && isValidMaintenanceRecord(sortedRefuels[0]) ? sortedRefuels[0] : null;
          const validLastOilChange = sortedOilChanges[0] && isValidMaintenanceRecord(sortedOilChanges[0]) ? sortedOilChanges[0] : null;
          const validLastTuneUp = sortedTuneUps[0] && isValidMaintenanceRecord(sortedTuneUps[0]) ? sortedTuneUps[0] : null;
          
          setAnalytics(prev => ({
            ...prev,
            lastRefuel: validLastRefuel || prev.lastRefuel || null,
            lastOilChange: validLastOilChange || prev.lastOilChange || null,
            lastTuneUp: validLastTuneUp || prev.lastTuneUp || null,
          }));
          
          if (__DEV__) {
            console.log('[MotorDetails] ✅ Set fallback last records (validated):', {
              hasLastRefuel: !!validLastRefuel,
              hasLastOilChange: !!validLastOilChange,
              hasLastTuneUp: !!validLastTuneUp,
            });
          }
        }
        
        // ✅ Also try loading from full records cache as last resort
        if (isMountedRef.current) {
          const fullRecordsCacheKey = getCacheKey(item._id, 'lastFullRecords');
          const fullRecordsExpiryKey = getCacheExpiryKey(item._id, 'lastFullRecords');
          const cachedFullRecords = await loadFromCache(fullRecordsCacheKey, fullRecordsExpiryKey);
          
          if (cachedFullRecords) {
            const validCachedRefuel = cachedFullRecords.lastRefuel && isValidMaintenanceRecord(cachedFullRecords.lastRefuel) ? cachedFullRecords.lastRefuel : null;
            const validCachedOilChange = cachedFullRecords.lastOilChange && isValidMaintenanceRecord(cachedFullRecords.lastOilChange) ? cachedFullRecords.lastOilChange : null;
            const validCachedTuneUp = cachedFullRecords.lastTuneUp && isValidMaintenanceRecord(cachedFullRecords.lastTuneUp) ? cachedFullRecords.lastTuneUp : null;
            
            setAnalytics(prev => ({
              ...prev,
              lastRefuel: prev.lastRefuel || validCachedRefuel,
              lastOilChange: prev.lastOilChange || validCachedOilChange,
              lastTuneUp: prev.lastTuneUp || validCachedTuneUp,
            }));
            
            if (__DEV__) {
              console.log('[MotorDetails] ✅ Loaded from full records cache:', {
                hasLastRefuel: !!validCachedRefuel,
                hasLastOilChange: !!validCachedOilChange,
                hasLastTuneUp: !!validCachedTuneUp,
              });
            }
          }
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
  }, [item?._id, item?.userId, maintenanceRecords]);

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

      {/* Last Refuel - Beautiful Card */}
      <View style={styles.maintenanceCard}>
        <LinearGradient
          colors={["#00ADB5", "#00C2CC"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.cardHeader}
        >
          <View style={styles.cardHeaderContent}>
            <Icon name="car" size={24} color="#FFF" style={{ marginRight: 12 }} />
            <Text style={styles.cardTitle}>Last Refuel</Text>
          </View>
          {analytics.lastRefuel && (
            <Text style={styles.cardDate}>
              {new Date(analytics.lastRefuel.timestamp).toLocaleDateString("en-US", {
                year: "numeric",
                month: "short",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })}
        </Text>
          )}
        </LinearGradient>

        <View style={styles.cardBody}>
          {!analytics.lastRefuel ? (
            <View style={styles.emptyState}>
              <Icon name="alert-circle-outline" size={32} color="#999" />
              <Text style={styles.emptyStateText}>No refuel records</Text>
            </View>
          ) : (
            <>
              {/* Quick Stats */}
              <View style={styles.quickStats}>
                <View style={styles.statItem}>
                  <Icon name="stats-chart" size={20} color="#00ADB5" />
                  <Text style={styles.statLabel}>Total Refuels</Text>
                  <Text style={styles.statValue}>{analytics.totalRefuels}</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Icon name="water" size={20} color="#00ADB5" />
                  <Text style={styles.statLabel}>Quantity</Text>
                  <Text style={styles.statValue}>
                    {typeof analytics.lastRefuel?.details?.quantity === "number" 
                      ? `${analytics.lastRefuel.details.quantity.toFixed(2)}L` 
                      : "N/A"}
                  </Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Icon name="cash" size={20} color="#00ADB5" />
                  <Text style={styles.statLabel}>Cost</Text>
                  <Text style={styles.statValue}>
                    ₱{analytics.lastRefuel?.details?.cost ? Number(analytics.lastRefuel.details.cost).toFixed(2) : "N/A"}
                  </Text>
                </View>
      </View>

              {/* Additional Details */}
              {analytics.lastRefuel && (
                <View style={styles.detailsGrid}>
                  {analytics.lastRefuel.details?.costPerLiter && (
                    <View style={styles.detailItem}>
                      <View style={styles.detailItemHeader}>
                        <Icon name="pricetag" size={16} color="#666" />
                        <Text style={styles.detailLabel}>Cost per Liter</Text>
                      </View>
                      <Text style={styles.detailValue}>₱{Number(analytics.lastRefuel.details.costPerLiter).toFixed(2)}</Text>
                    </View>
                  )}
                  {analytics.lastRefuel.details?.fuelTank && (
                    <View style={styles.detailItem}>
                      <View style={styles.detailItemHeader}>
                        <Icon name="car-sport" size={16} color="#666" />
                        <Text style={styles.detailLabel}>Fuel Tank</Text>
                      </View>
                      <Text style={styles.detailValue}>{analytics.lastRefuel.details.fuelTank}L</Text>
                    </View>
                  )}
                  {analytics.lastRefuel.details?.refueledPercent && (
                    <View style={styles.detailItem}>
                      <View style={styles.detailItemHeader}>
                        <Icon name="trending-up" size={16} color="#666" />
                        <Text style={styles.detailLabel}>Refueled</Text>
                      </View>
                      <Text style={styles.detailValue}>{analytics.lastRefuel.details.refueledPercent.toFixed(1)}%</Text>
                    </View>
                  )}
                  {analytics.lastRefuel.details?.fuelLevelBefore !== undefined && (
                    <View style={styles.detailItem}>
                      <View style={styles.detailItemHeader}>
                        <Icon name="arrow-down" size={16} color="#FF6B6B" />
                        <Text style={styles.detailLabel}>Fuel Before</Text>
                      </View>
                      <Text style={styles.detailValue}>{analytics.lastRefuel.details.fuelLevelBefore.toFixed(0)}%</Text>
                    </View>
                  )}
                  {analytics.lastRefuel.details?.fuelLevelAfter !== undefined && (
                    <View style={styles.detailItem}>
                      <View style={styles.detailItemHeader}>
                        <Icon name="arrow-up" size={16} color="#4CAF50" />
                        <Text style={styles.detailLabel}>Fuel After</Text>
                      </View>
                      <Text style={styles.detailValue}>{analytics.lastRefuel.details.fuelLevelAfter.toFixed(0)}%</Text>
                    </View>
                  )}
                  {analytics.lastRefuel.odometer && (
                    <View style={styles.detailItem}>
                      <View style={styles.detailItemHeader}>
                        <Icon name="speedometer" size={16} color="#666" />
                        <Text style={styles.detailLabel}>Odometer</Text>
                      </View>
                      <Text style={styles.detailValue}>{analytics.lastRefuel.odometer.toLocaleString()} km</Text>
                    </View>
                  )}
                  {analytics.lastRefuel.location?.address && (
                    <View style={[styles.detailItem, styles.detailItemFull]}>
                      <View style={styles.detailItemHeader}>
                        <Icon name="location" size={16} color="#666" />
                        <Text style={styles.detailLabel}>Location</Text>
                      </View>
                      <Text style={styles.detailValue}>{analytics.lastRefuel.location.address}</Text>
                    </View>
                  )}
                  {analytics.lastRefuel.details?.serviceProvider && (
                    <View style={[styles.detailItem, styles.detailItemFull]}>
                      <View style={styles.detailItemHeader}>
                        <Icon name="storefront" size={16} color="#666" />
                        <Text style={styles.detailLabel}>Service Provider</Text>
                      </View>
                      <Text style={styles.detailValue}>{analytics.lastRefuel.details.serviceProvider}</Text>
                    </View>
                  )}
                  {analytics.lastRefuel.details?.notes && (
                    <View style={[styles.detailItem, styles.detailItemFull]}>
                      <View style={styles.detailItemHeader}>
                        <Icon name="document-text" size={16} color="#666" />
                        <Text style={styles.detailLabel}>Notes</Text>
                      </View>
                      <Text style={styles.detailValue}>{analytics.lastRefuel.details.notes}</Text>
                    </View>
                  )}
                </View>
              )}
            </>
          )}
        </View>
      </View>

      {/* Last Oil Change - Beautiful Card */}
      <View style={styles.maintenanceCard}>
        <LinearGradient
          colors={["#FF9800", "#FFB74D"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.cardHeader}
        >
          <View style={styles.cardHeaderContent}>
            <Icon name="water" size={24} color="#FFF" style={{ marginRight: 12 }} />
            <Text style={styles.cardTitle}>Last Oil Change</Text>
          </View>
          {analytics.lastOilChange && (
            <Text style={styles.cardDate}>
              {new Date(analytics.lastOilChange.timestamp).toLocaleDateString("en-US", {
                year: "numeric",
                month: "short",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })}
        </Text>
          )}
        </LinearGradient>

        <View style={styles.cardBody}>
          {!analytics.lastOilChange ? (
            <View style={styles.emptyState}>
              <Icon name="alert-circle-outline" size={32} color="#999" />
              <Text style={styles.emptyStateText}>No oil change records</Text>
            </View>
          ) : (
            <>
              {/* Quick Stats */}
              <View style={styles.quickStats}>
                <View style={styles.statItem}>
                  <Icon name="stats-chart" size={20} color="#FF9800" />
                  <Text style={styles.statLabel}>Total Changes</Text>
                  <Text style={styles.statValue}>{analytics.totalOilChanges}</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Icon name="speedometer" size={20} color="#FF9800" />
                  <Text style={styles.statLabel}>KM Since</Text>
                  <Text style={styles.statValue}>{analytics.kmSinceOilChange.toFixed(0)} km</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Icon name="flask" size={20} color="#FF9800" />
                  <Text style={styles.statLabel}>Quantity</Text>
                  <Text style={styles.statValue}>
                    {analytics.lastOilChange?.details?.quantity ? `${analytics.lastOilChange.details.quantity}L` : "N/A"}
                  </Text>
                </View>
      </View>

              {/* Additional Details */}
              <View style={styles.detailsGrid}>
                {analytics.lastOilChange.details?.oilType && (
                  <View style={styles.detailItem}>
                    <View style={styles.detailItemHeader}>
                      <Icon name="flask" size={16} color="#666" />
                      <Text style={styles.detailLabel}>Oil Type</Text>
                    </View>
                    <Text style={styles.detailValue}>{analytics.lastOilChange.details.oilType}</Text>
                  </View>
                )}
                {analytics.lastOilChange.details?.oilViscosity && (
                  <View style={styles.detailItem}>
                    <View style={styles.detailItemHeader}>
                      <Icon name="resize-outline" size={16} color="#666" />
                      <Text style={styles.detailLabel}>Viscosity</Text>
                    </View>
                    <Text style={styles.detailValue}>{analytics.lastOilChange.details.oilViscosity}</Text>
                  </View>
                )}
                {analytics.lastOilChange.odometer && (
                  <View style={styles.detailItem}>
                    <View style={styles.detailItemHeader}>
                      <Icon name="speedometer" size={16} color="#666" />
                      <Text style={styles.detailLabel}>Odometer</Text>
                    </View>
                    <Text style={styles.detailValue}>{analytics.lastOilChange.odometer.toLocaleString()} km</Text>
                  </View>
                )}
                {analytics.lastOilChange.details?.warranty !== undefined && (
                  <View style={styles.detailItem}>
                    <View style={styles.detailItemHeader}>
                      <Icon name={analytics.lastOilChange.details.warranty ? "shield-checkmark" : "shield-outline"} size={16} color={analytics.lastOilChange.details.warranty ? "#4CAF50" : "#666"} />
                      <Text style={styles.detailLabel}>Warranty</Text>
                    </View>
                    <Text style={[styles.detailValue, { color: analytics.lastOilChange.details.warranty ? "#4CAF50" : "#666" }]}>
                      {analytics.lastOilChange.details.warranty ? "Yes" : "No"}
                    </Text>
                  </View>
                )}
                {analytics.lastOilChange.location?.address && (
                  <View style={[styles.detailItem, styles.detailItemFull]}>
                    <View style={styles.detailItemHeader}>
                      <Icon name="location" size={16} color="#666" />
                      <Text style={styles.detailLabel}>Location</Text>
                    </View>
                    <Text style={styles.detailValue}>{analytics.lastOilChange.location.address}</Text>
                  </View>
                )}
                {analytics.lastOilChange.details?.serviceProvider && (
                  <View style={[styles.detailItem, styles.detailItemFull]}>
                    <View style={styles.detailItemHeader}>
                      <Icon name="storefront" size={16} color="#666" />
                      <Text style={styles.detailLabel}>Service Provider</Text>
                    </View>
                    <Text style={styles.detailValue}>{analytics.lastOilChange.details.serviceProvider}</Text>
                  </View>
                )}
                {analytics.lastOilChange.details?.nextServiceDate && (
                  <View style={styles.detailItem}>
                    <View style={styles.detailItemHeader}>
                      <Icon name="calendar" size={16} color="#666" />
                      <Text style={styles.detailLabel}>Next Service</Text>
                    </View>
                    <Text style={styles.detailValue}>
                      {new Date(analytics.lastOilChange.details.nextServiceDate).toLocaleDateString("en-US", {
                        month: "short",
                        day: "2-digit",
                        year: "numeric",
                      })}
                    </Text>
                  </View>
                )}
                {analytics.lastOilChange.details?.nextServiceOdometer && (
                  <View style={styles.detailItem}>
                    <View style={styles.detailItemHeader}>
                      <Icon name="speedometer" size={16} color="#666" />
                      <Text style={styles.detailLabel}>Next Odometer</Text>
                    </View>
                    <Text style={styles.detailValue}>{analytics.lastOilChange.details.nextServiceOdometer.toLocaleString()} km</Text>
                  </View>
                )}
                {analytics.lastOilChange.details?.notes && (
                  <View style={[styles.detailItem, styles.detailItemFull]}>
                    <View style={styles.detailItemHeader}>
                      <Icon name="document-text" size={16} color="#666" />
                      <Text style={styles.detailLabel}>Notes</Text>
                    </View>
                    <Text style={styles.detailValue}>{analytics.lastOilChange.details.notes}</Text>
                  </View>
                )}
              </View>
            </>
          )}
        </View>
      </View>

      {/* Oil Change Countdown - Beautiful Card */}
      {analytics.lastOilChange && (
        <View style={styles.maintenanceCard}>
          <LinearGradient
            colors={["#FF9800", "#FFB74D"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.cardHeader}
          >
            <View style={styles.cardHeaderContent}>
              <Icon name="time" size={24} color="#FFF" style={{ marginRight: 12 }} />
              <Text style={styles.cardTitle}>Next Oil Change Countdown</Text>
            </View>
          </LinearGradient>

          <View style={styles.cardBody}>
          {/* Distance-based countdown */}
            <View style={styles.countdownCard}>
              <View style={styles.countdownHeader}>
                <Icon name="speedometer" size={20} color="#FF9800" />
            <Text style={styles.countdownTitle}>Distance Remaining</Text>
              </View>
              <View style={[
                styles.countdownBox,
                { backgroundColor: analytics.kmSinceOilChange >= 3000 ? '#FFEBEE' : '#E8F5E9' }
              ]}>
              <Text style={[
                styles.countdownValue,
                { color: analytics.kmSinceOilChange >= 3000 ? '#FF6B6B' : '#4CAF50' }
              ]}>
                  {Math.max(0, 3000 - analytics.kmSinceOilChange).toFixed(0)}
              </Text>
                <Text style={styles.countdownUnit}>km</Text>
                <Text style={[
                  styles.countdownSubtext,
                  { color: analytics.kmSinceOilChange >= 3000 ? '#FF6B6B' : '#4CAF50' }
                ]}>
                  {analytics.kmSinceOilChange >= 3000 ? '⚠️ OVERDUE' : 'remaining'}
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
              <Text style={styles.progressLabel}>
                {analytics.kmSinceOilChange.toFixed(0)} / 3000 km traveled
              </Text>
          </View>

          {/* Time-based countdown */}
            <View style={styles.countdownCard}>
              <View style={styles.countdownHeader}>
                <Icon name="calendar" size={20} color="#FF9800" />
            <Text style={styles.countdownTitle}>Time Remaining</Text>
              </View>
              <View style={[
                styles.countdownBox,
                { backgroundColor: analytics.daysSinceOilChange >= 180 ? '#FFEBEE' : '#E8F5E9' }
              ]}>
              <Text style={[
                styles.countdownValue,
                { color: analytics.daysSinceOilChange >= 180 ? '#FF6B6B' : '#4CAF50' }
              ]}>
                  {Math.max(0, 180 - analytics.daysSinceOilChange)}
              </Text>
                <Text style={styles.countdownUnit}>days</Text>
                <Text style={[
                  styles.countdownSubtext,
                  { color: analytics.daysSinceOilChange >= 180 ? '#FF6B6B' : '#4CAF50' }
                ]}>
                  {analytics.daysSinceOilChange >= 180 ? '⚠️ OVERDUE' : 'remaining'}
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
              <Text style={styles.progressLabel}>
                {analytics.daysSinceOilChange} / 180 days elapsed
              </Text>
          </View>

          {/* Recommendation */}
          <View style={[
            styles.recommendationBox,
              { 
                backgroundColor: analytics.kmSinceOilChange >= 3000 || analytics.daysSinceOilChange >= 180 ? '#FFEBEE' : '#E8F5E9',
                borderColor: analytics.kmSinceOilChange >= 3000 || analytics.daysSinceOilChange >= 180 ? '#FF6B6B' : '#4CAF50'
              }
            ]}>
              <Icon 
                name={analytics.kmSinceOilChange >= 3000 || analytics.daysSinceOilChange >= 180 ? "warning" : "checkmark-circle"} 
                size={24} 
                color={analytics.kmSinceOilChange >= 3000 || analytics.daysSinceOilChange >= 180 ? '#D32F2F' : '#2E7D32'}
                style={{ marginBottom: 8 }}
              />
            <Text style={[
              styles.recommendationText,
              { color: analytics.kmSinceOilChange >= 3000 || analytics.daysSinceOilChange >= 180 ? '#D32F2F' : '#2E7D32' }
            ]}>
              {analytics.kmSinceOilChange >= 3000 || analytics.daysSinceOilChange >= 180 
                  ? 'Oil change is overdue! Schedule maintenance soon.'
                  : 'Oil change is not due yet. Monitor distance and time.'}
            </Text>
            </View>
          </View>
        </View>
      )}

      {/* Last Tune Up - Beautiful Card */}
      <View style={styles.maintenanceCard}>
        <LinearGradient
          colors={["#9C27B0", "#BA68C8"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.cardHeader}
        >
          <View style={styles.cardHeaderContent}>
            <Icon name="construct" size={24} color="#FFF" style={{ marginRight: 12 }} />
            <Text style={styles.cardTitle}>Last Tune Up</Text>
          </View>
          {analytics.lastTuneUp && (
            <Text style={styles.cardDate}>
              {new Date(analytics.lastTuneUp.timestamp).toLocaleDateString("en-US", {
                year: "numeric",
                month: "short",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })}
        </Text>
          )}
        </LinearGradient>

        <View style={styles.cardBody}>
          {!analytics.lastTuneUp ? (
            <View style={styles.emptyState}>
              <Icon name="alert-circle-outline" size={32} color="#999" />
              <Text style={styles.emptyStateText}>No tune-up records</Text>
            </View>
          ) : (
            <>
              {/* Quick Stats */}
              <View style={styles.quickStats}>
                <View style={styles.statItem}>
                  <Icon name="stats-chart" size={20} color="#9C27B0" />
                  <Text style={styles.statLabel}>Total Tune Ups</Text>
                  <Text style={styles.statValue}>{analytics.totalTuneUps}</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Icon name="speedometer" size={20} color="#9C27B0" />
                  <Text style={styles.statLabel}>KM Since</Text>
                  <Text style={styles.statValue}>{analytics.kmSinceTuneUp.toFixed(0)} km</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Icon name="cash" size={20} color="#9C27B0" />
                  <Text style={styles.statLabel}>Cost</Text>
                  <Text style={styles.statValue}>
                    ₱{analytics.lastTuneUp?.details?.cost ? Number(analytics.lastTuneUp.details.cost).toFixed(2) : "N/A"}
                  </Text>
                </View>
      </View>

              {/* Additional Details */}
              <View style={styles.detailsGrid}>
                {analytics.lastTuneUp.odometer && (
                  <View style={styles.detailItem}>
                    <View style={styles.detailItemHeader}>
                      <Icon name="speedometer" size={16} color="#666" />
                      <Text style={styles.detailLabel}>Odometer</Text>
                    </View>
                    <Text style={styles.detailValue}>{analytics.lastTuneUp.odometer.toLocaleString()} km</Text>
                  </View>
                )}
                {analytics.lastTuneUp.details?.warranty !== undefined && (
                  <View style={styles.detailItem}>
                    <View style={styles.detailItemHeader}>
                      <Icon name={analytics.lastTuneUp.details.warranty ? "shield-checkmark" : "shield-outline"} size={16} color={analytics.lastTuneUp.details.warranty ? "#4CAF50" : "#666"} />
                      <Text style={styles.detailLabel}>Warranty</Text>
                    </View>
                    <Text style={[styles.detailValue, { color: analytics.lastTuneUp.details.warranty ? "#4CAF50" : "#666" }]}>
                      {analytics.lastTuneUp.details.warranty ? "Yes" : "No"}
                    </Text>
                  </View>
                )}
                {analytics.lastTuneUp.location?.address && (
                  <View style={[styles.detailItem, styles.detailItemFull]}>
                    <View style={styles.detailItemHeader}>
                      <Icon name="location" size={16} color="#666" />
                      <Text style={styles.detailLabel}>Location</Text>
                    </View>
                    <Text style={styles.detailValue}>{analytics.lastTuneUp.location.address}</Text>
                  </View>
                )}
                {analytics.lastTuneUp.details?.serviceProvider && (
                  <View style={[styles.detailItem, styles.detailItemFull]}>
                    <View style={styles.detailItemHeader}>
                      <Icon name="storefront" size={16} color="#666" />
                      <Text style={styles.detailLabel}>Service Provider</Text>
                    </View>
                    <Text style={styles.detailValue}>{analytics.lastTuneUp.details.serviceProvider}</Text>
                  </View>
                )}
                {analytics.lastTuneUp.details?.nextServiceDate && (
                  <View style={styles.detailItem}>
                    <View style={styles.detailItemHeader}>
                      <Icon name="calendar" size={16} color="#666" />
                      <Text style={styles.detailLabel}>Next Service</Text>
                    </View>
                    <Text style={styles.detailValue}>
                      {new Date(analytics.lastTuneUp.details.nextServiceDate).toLocaleDateString("en-US", {
                        month: "short",
                        day: "2-digit",
                        year: "numeric",
                      })}
                    </Text>
                  </View>
                )}
                {analytics.lastTuneUp.details?.nextServiceOdometer && (
                  <View style={styles.detailItem}>
                    <View style={styles.detailItemHeader}>
                      <Icon name="speedometer" size={16} color="#666" />
                      <Text style={styles.detailLabel}>Next Odometer</Text>
                    </View>
                    <Text style={styles.detailValue}>{analytics.lastTuneUp.details.nextServiceOdometer.toLocaleString()} km</Text>
                  </View>
                )}
                {analytics.lastTuneUp.details?.notes && (
                  <View style={[styles.detailItem, styles.detailItemFull]}>
                    <View style={styles.detailItemHeader}>
                      <Icon name="document-text" size={16} color="#666" />
                      <Text style={styles.detailLabel}>Notes</Text>
                    </View>
                    <Text style={styles.detailValue}>{analytics.lastTuneUp.details.notes}</Text>
                  </View>
                )}
              </View>
            </>
          )}
        </View>
      </View>

      {/* Performance Analytics - Hidden */}
      {/* <Text style={styles.sectionTitle}>📊 Performance Analytics</Text>

      <View style={styles.performanceGrid}>
        <View style={styles.performanceCard}>
          <LinearGradient
            colors={["#4CAF50", "#66BB6A"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.performanceCardGradient}
          >
            <Icon name="speedometer" size={32} color="#FFF" />
            <Text style={styles.performanceValue}>{analytics.averageFuelEfficiency.toFixed(2)}</Text>
            <Text style={styles.performanceLabel}>km/L</Text>
            <Text style={styles.performanceSubLabel}>Average Fuel Efficiency</Text>
          </LinearGradient>
        </View>

        <View style={styles.performanceCard}>
          <LinearGradient
            colors={["#2196F3", "#42A5F5"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.performanceCardGradient}
          >
            <Icon name="water" size={32} color="#FFF" />
            <Text style={styles.performanceValue}>{analytics.totalFuelConsumed.toFixed(2)}</Text>
            <Text style={styles.performanceLabel}>L</Text>
            <Text style={styles.performanceSubLabel}>Total Fuel Consumed</Text>
          </LinearGradient>
        </View>

        <View style={styles.performanceCard}>
          <LinearGradient
            colors={["#FF5722", "#FF7043"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.performanceCardGradient}
          >
            <Icon name="map" size={32} color="#FFF" />
            <Text style={styles.performanceValue}>{trips.length}</Text>
            <Text style={styles.performanceLabel}>trips</Text>
            <Text style={styles.performanceSubLabel}>Total Trips</Text>
          </LinearGradient>
        </View>
      </View> */}

      {/* Maintenance Alerts - Beautiful Cards */}
      {analytics.maintenanceAlerts.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>⚠️ Maintenance Alerts</Text>
          {analytics.maintenanceAlerts.map((alert, index) => (
            <View key={index} style={styles.alertCard}>
              <LinearGradient
                colors={["#FF6B6B", "#FF8E8E"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.alertCardGradient}
              >
                <Icon name="warning" size={24} color="#FFF" style={{ marginRight: 12 }} />
                <Text style={styles.alertCardText}>{alert}</Text>
              </LinearGradient>
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
  countdownCard: { 
    marginBottom: 20,
    padding: 16,
    backgroundColor: "#F8F9FA", 
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E9ECEF"
  },
  countdownHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  countdownTitle: { 
    fontSize: 14, 
    color: "#333", 
    marginLeft: 8,
    fontWeight: "600" 
  },
  countdownBox: { 
    borderRadius: 12, 
    padding: 20, 
    alignItems: "center",
    borderWidth: 2,
    borderStyle: "dashed",
    marginBottom: 12,
  },
  countdownValue: { 
    fontSize: 36, 
    fontWeight: "700",
    lineHeight: 42,
  },
  countdownUnit: {
    fontSize: 16,
    color: "#666",
    fontWeight: "600",
    marginTop: 4,
  },
  countdownSubtext: { 
    fontSize: 12, 
    fontWeight: "600",
    marginTop: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  progressBar: { 
    height: 8, 
    backgroundColor: "#E9ECEF", 
    borderRadius: 4, 
    marginTop: 8,
    overflow: "hidden"
  },
  progressFill: { 
    height: "100%", 
    borderRadius: 4
  },
  progressLabel: {
    fontSize: 11,
    color: "#666",
    marginTop: 6,
    textAlign: "center",
    fontWeight: "500",
  },
  recommendationBox: { 
    marginTop: 8, 
    padding: 16, 
    borderRadius: 12, 
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  recommendationText: { 
    fontSize: 14, 
    fontWeight: "600", 
    textAlign: "center",
    lineHeight: 20,
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
  // New beautiful styles for maintenance cards
  maintenanceCard: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
    overflow: "hidden",
  },
  cardHeader: {
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardHeaderContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFF",
  },
  cardDate: {
    fontSize: 12,
    color: "#FFF",
    opacity: 0.9,
    fontWeight: "500",
  },
  cardBody: {
    padding: 16,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 32,
  },
  emptyStateText: {
    fontSize: 14,
    color: "#999",
    marginTop: 8,
    fontWeight: "500",
  },
  quickStats: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 16,
    backgroundColor: "#F8F9FA",
    borderRadius: 12,
    marginBottom: 16,
  },
  statItem: {
    alignItems: "center",
    flex: 1,
  },
  statDivider: {
    width: 1,
    backgroundColor: "#E0E0E0",
    marginHorizontal: 8,
  },
  statLabel: {
    fontSize: 11,
    color: "#666",
    marginTop: 4,
    fontWeight: "500",
  },
  statValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#333",
    marginTop: 4,
  },
  detailsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -6,
  },
  detailItem: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: "#F8F9FA",
    padding: 12, 
    borderRadius: 8, 
    borderWidth: 1,
    borderColor: "#E9ECEF",
    margin: 6,
  },
  detailItemFull: {
    minWidth: "100%",
    flexBasis: "100%",
  },
  detailItemHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  detailLabel: {
    fontSize: 11,
    color: "#666",
    marginLeft: 6,
    fontWeight: "500",
  },
  detailValue: {
    fontSize: 14, 
    color: "#333",
    fontWeight: "600", 
  },
  // Performance analytics styles
  performanceGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -6,
    marginBottom: 16,
  },
  performanceCard: {
    flex: 1,
    minWidth: "30%",
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
    margin: 6,
  },
  performanceCardGradient: {
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 140,
  },
  performanceValue: {
    fontSize: 28,
    fontWeight: "700",
    color: "#FFF",
    marginTop: 8,
  },
  performanceLabel: {
    fontSize: 14,
    color: "#FFF",
    opacity: 0.9,
    fontWeight: "600",
    marginTop: 4,
  },
  performanceSubLabel: {
    fontSize: 11,
    color: "#FFF",
    opacity: 0.8,
    marginTop: 8,
    textAlign: "center",
    fontWeight: "500",
  },
  // Alert card styles
  alertCard: {
    borderRadius: 12,
    marginBottom: 12,
    overflow: "hidden",
    shadowColor: "#FF6B6B",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  alertCardGradient: {
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
  },
  alertCardText: {
    flex: 1,
    fontSize: 14,
    color: "#FFF",
    fontWeight: "600",
  },
});
