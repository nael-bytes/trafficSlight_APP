import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Image,
  StatusBar,
  useColorScheme,
  SafeAreaView,
  RefreshControl,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { useUser } from "../../AuthContext/UserContextImproved";
import { fetchUserMotors, apiRequest } from "../../utils/api";
import { combineFuelData as combineFuelDataService } from "../../services/fuelService";
import { LOCALHOST_IP } from "@env";

const API_BASE = LOCALHOST_IP;
import { deepEqual } from '../../utils/objectUtils';

const HOME_CACHE_KEY = 'home_screen_data';
const FETCH_INTERVAL = 5000; // 5 seconds

type SectionDef = {
  title: string;
  subtitle?: string;
  text?: string;
  data: any[];
  navTarget?: string;
  onAdd?: () => void;
  showSeeAll?: boolean;
};

interface HomeDataCache {
  motors: any[];
  trips: any[];
  fuelLogs: any[];
  maintenanceRecords: any[];
  combinedFuelData: any[];
  timestamp: number;
}

// COMMENTED OUT: Complex data processing - replaced with simple fallback
// Helper function to combine fuel logs with maintenance refuels
// const combineFuelData = async (fuelLogs: any[], maintenanceRecords: any[]): Promise<any[]> => {
//   try {
//     const maintenanceRefuels = maintenanceRecords.filter((record: any) => record.type === 'refuel');
//     const transformedMaintenanceRefuels = maintenanceRefuels.map((record: any) => ({
//       _id: `maintenance_${record._id}`,
//       date: record.timestamp,
//       liters: record.details?.quantity,
//       pricePerLiter: record.details?.cost && record.details?.quantity 
//         ? record.details.cost / record.details.quantity 
//         : 0,
//       totalCost: record.details?.cost,
//       odometer: undefined,
//       notes: record.details?.notes,
//       motorId: record.motorId ? {
//         _id: record.motorId._id,
//         nickname: record.motorId.nickname,
//         motorcycleId: undefined
//       } : undefined,
//       location: record.location ? `${record.location.latitude}, ${record.location.longitude}` : undefined,
//       source: 'maintenance'
//     }));
//
//     const combined = [
//       ...fuelLogs.map((log: any) => ({ ...log, source: 'fuel_log' })), 
//       ...transformedMaintenanceRefuels
//     ];
//     
//     return combined.sort((a: any, b: any) => {
//       const dateA = new Date(a.date || 0).getTime();
//       const dateB = new Date(b.date || 0).getTime();
//       return dateB - dateA;
//     });
//   } catch (error) {
//     console.error('[HomeScreen] Error combining fuel data:', error);
//     return fuelLogs || [];
//   }
// };

// SIMPLE FALLBACK: Just return fuel logs as-is
const combineFuelData = async (fuelLogs: any[], maintenanceRecords: any[]): Promise<any[]> => {
  return fuelLogs || [];
};

const renderItemLabel = (item: any, type: string) => {
  switch (type) {
    case "Motors":
      return {
        line1: `${item.nickname || item.motorcycleData?.name || "Motorcycle"} • ${item.name || "Unknown Models"}`,
        line2: item.fuelEfficiency || item.fuelConsumption ? `${item.fuelEfficiency || item.fuelConsumption} km/L` : "Fuel Efficiency Unknown",
        line3: `Fuel: ${item.currentFuelLevel?.toFixed(0) || 0}% `,
      };
    case "Trips":
      const maintenanceText = item.maintenanceActions?.length
        ? `${item.maintenanceActions.length} maintenance action${item.maintenanceActions.length > 1 ? "s" : ""}`
        : "No maintenance";
      return {
        line1: `${item.startLocation?.address || "Start"} → ${item.destination || "End"}`,
        line2: `Distance: ${item.actualDistance?.toFixed(1) ?? item.distance?.toFixed(1) ?? "--"} km • ${maintenanceText}`,
        line3: `Duration: ${item.duration ?? "--"} min • Status: ${item.status ?? "--"}`,
      };
    case "Maintenance":
      const actionType = (item.type || "").replace("_", " ");
      const actionCost = item.details?.cost ? `₱${Number(item.details.cost).toFixed(2)}` : "No cost data";
      const actionQuantity = item.details?.quantity ? ` • ${item.details.quantity.toFixed(1)}L` : "";
      return {
        line1: (actionType || "MAINTENANCE").toUpperCase(),
        line2: `${actionCost}${actionQuantity}`,
        line3: item.timestamp ? new Date(item.timestamp).toLocaleString("en-PH", {
          hour: "2-digit", minute: "2-digit", hour12: true, month: "long", day: "numeric"
        }) : "",
      };
    case "Fuel Logs":
      const fuelLocation = item.location?.address ? ` at ${item.location.address}` : "";
      const isMaintenance = item.source === 'maintenance';
      const sourceIndicator = isMaintenance ? " (Maintenance)" : "";
      return {
        line1: `₱${typeof item.totalCost === "number" ? item.totalCost.toFixed(2) : (typeof item.cost === "number" ? item.cost.toFixed(2) : "--")}${sourceIndicator}`,
        line2: `${item.liters?.toFixed(1) ?? "--"} Liters${fuelLocation}`,
        line3: item.date ? new Date(item.date).toLocaleString("en-PH", {
          hour: "2-digit", minute: "2-digit", hour12: true, month: "long", day: "numeric"
        }) : "",
      };
    case "Destinations":
      return {
        line1: item.label || "Saved Place",
        line2: item.address || "No address",
        line3: "",
      };
    default:
      return {
        line1: item.name || "Item",
        line2: "",
        line3: "",
      };
  }
};

const getImageForSection = (title: string, description?: string, item?: any) => {
  switch (title) {
    case "Motors":
      return require("../../assets/icons/motor-silhouette.png");
    case "Fuel Logs":
      if (item?.source === 'maintenance') {
        return require("../../assets/icons/maintenance.png");
      }
      return require("../../assets/icons/gas_station-71.png");
    case "Maintenance":
      switch (description?.toLowerCase()) {
        case "refuel":
          return require("../../assets/icons/gas_station-71.png");
        case "oil_change":
          return require("../../assets/icons/oil-change.png");
        case "tune_up":
          return require("../../assets/icons/tune-up.png");
        default:
          return require("../../assets/icons/maintenance.png");
      }
    default:
      return require("../../assets/icons/default.png");
  }
};

/* ---------- Section component (header + horizontal items) ---------- */
const Section = ({
  title,
  subtitle,
  text,
  data,
  navTarget,
  onAdd,
  showSeeAll,
  isDarkMode,
}: SectionDef & { isDarkMode: boolean }) => {
  const navigation = useNavigation<any>();

  return (
    <View style={[styles.section, isDarkMode && styles.sectionDark]}>
      <View style={styles.sectionHeader}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.sectionTitle, isDarkMode && styles.sectionTitleDark]}>{title}</Text>
          {subtitle ? <Text style={[styles.sectionSubtitle, isDarkMode && styles.sectionSubtitleDark]}>{subtitle}</Text> : null}
          {text ? <Text style={[styles.sectionText, isDarkMode && styles.sectionTextDark]}>{text}</Text> : null}
        </View>

        <View style={styles.headerActions}>
          {(showSeeAll || data.length > 2) && (
            <TouchableOpacity
              onPress={() => {
                if (navTarget === "MotorDetails") {
                  navigation.navigate("AddMotorScreen");
                } else if (navTarget) {
                  navigation.navigate(navTarget, { fullList: data });
                }
              }}
              style={styles.seeAllButton}
            >
              <Text style={styles.seeAll}>See All</Text>
            </TouchableOpacity>
          )}
          {onAdd && (
            <TouchableOpacity
              onPress={onAdd}
              style={[styles.seeAllButton, { backgroundColor: "rgba(0, 173, 181, 0.2)" }]}
            >
              <Text style={[styles.seeAll, { color: "#00ADB5" }]}>Add</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {data.length === 0 ? (
        <Text style={styles.emptyText}>No {title.toLowerCase()} yet.</Text>
      ) : (
        <FlatList
          horizontal
          data={data.slice(0, 5)}
          keyExtractor={(item: any, index: number) => item._id || index.toString()}
          renderItem={({ item }) => {
            try {
              const label = renderItemLabel(item, title);
              
              return (
                <TouchableOpacity
                  style={[styles.item, isDarkMode && styles.itemDark]}
                  onPress={() => {
                    if (navTarget) {
                      if (title === "Maintenance") {
                        navigation.navigate(navTarget as any, { 
                          item, 
                          showSingleItem: true 
                        });
                      } else {
                        navigation.navigate(navTarget as any, { item });
                      }
                    }
                  }}
                >
                  <Image
                    source={getImageForSection(title, (item as any).type || (item as any).details?.type, item)}
                    style={[styles.itemImage, isDarkMode && styles.itemImageDark]}
                    onError={(error) => {
                      console.warn(`[HomeScreen] Image load error for ${title}:`, error);
                    }}
                  />
                  <Text style={[styles.itemText, isDarkMode && styles.itemTextDark]}>{label.line1}</Text>
                  {label.line2 ? <Text style={[styles.itemText, isDarkMode && styles.itemTextDark]}>{label.line2}</Text> : null}
                  {label.line3 ? <Text style={[styles.itemText, isDarkMode && styles.itemTextDark]}>{label.line3}</Text> : null}
                </TouchableOpacity>
              );
            } catch (error) {
              console.error(`[HomeScreen] Error rendering ${title} item:`, error, item);
              return (
                <View style={[styles.item, isDarkMode && styles.itemDark]}>
                  <Text style={[styles.itemText, isDarkMode && styles.itemTextDark]}>Error loading item</Text>
                </View>
              );
            }
          }}
          showsHorizontalScrollIndicator={false}
        />
      )}
    </View>
  );
};

/* ---------------------- Main screen ---------------------- */
export default function MotorPage() {
  const systemTheme = useColorScheme();
  const [isManualDark, setIsManualDark] = useState<boolean | null>(null);
  const isDarkMode = isManualDark ?? (systemTheme === "dark");
  const navigation = useNavigation<any>();
  const { user } = useUser();

  // State for all data types
  const [motors, setMotors] = useState<any[]>([]);
  const [trips, setTrips] = useState<any[]>([]);
  const [fuelLogs, setFuelLogs] = useState<any[]>([]);
  const [maintenanceRecords, setMaintenanceRecords] = useState<any[]>([]);
  const [combinedFuelData, setCombinedFuelData] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  
  // Refs
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isFetchingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);

  // Load cached data on mount (instant display)
  useEffect(() => {
    const loadCachedData = async () => {
      try {
        const cachedDataStr = await AsyncStorage.getItem(`${HOME_CACHE_KEY}_${user?._id}`);
        if (cachedDataStr) {
          const cachedData: HomeDataCache = JSON.parse(cachedDataStr);
          setMotors(cachedData.motors || []);
          setTrips(cachedData.trips || []);
          setFuelLogs(cachedData.fuelLogs || []);
          setMaintenanceRecords(cachedData.maintenanceRecords || []);
          setCombinedFuelData(cachedData.combinedFuelData || []);
          if (__DEV__) {
            console.log("[HomeScreen] Loaded cached data");
          }
        }
      } catch (error) {
        if (__DEV__) {
          console.warn("[HomeScreen] Failed to load cached data:", error);
        }
      }
    };

    if (user?._id) {
      loadCachedData();
    }
  }, [user?._id]);

  // COMMENTED OUT: Complex data processing - replaced with simple fallback
  // Fetch all data from backend
  // const fetchAllData = useCallback(async (isManualRefresh = false) => {
  //   ... (entire complex fetch logic commented out)
  // }, [user?._id]);

  // Fetch all data from backend API endpoints
  // Uses: GET /api/user-motors/user/:userId, GET /api/trips/user/:userId, GET /api/fuel-logs/:userId, GET /api/maintenance-records/user/:userId
  const fetchAllData = useCallback(async (isManualRefresh = false) => {
    if (!user?._id) return;
    
    // Prevent concurrent fetches
    if (isFetchingRef.current && !isManualRefresh) {
      if (__DEV__) {
        console.log("[HomeScreen] Fetch already in progress, skipping");
      }
      return;
    }
    
    isFetchingRef.current = true;
    
    try {
      // Abort previous request if still pending
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      
      abortControllerRef.current = new AbortController();
      const signal = abortControllerRef.current.signal;
      
      // Fetch all data concurrently from backend API endpoints
      // All data processing happens on backend, not locally
      const [motorsResult, tripsResult, fuelLogsResult, maintenanceResult] = await Promise.allSettled([
        // Fetch motors: GET /api/user-motors/user/:userId
        fetchUserMotors(user._id, signal).then(res => {
          // Handle different response formats
          if (Array.isArray(res)) return res;
          if (res?.motors) return res.motors;
          if (res?.data) return Array.isArray(res.data) ? res.data : [];
          return [];
        }),
        
        // Fetch trips: GET /api/trips/user/:userId
        apiRequest(`/api/trips/user/${user._id}`, { signal }).then(res => {
          if (Array.isArray(res)) return res;
          if (res?.trips) return res.trips;
          if (res?.data) return Array.isArray(res.data) ? res.data : [];
          return [];
        }),
        
        // Fetch fuel logs: GET /api/fuel-logs/:userId
        apiRequest(`/api/fuel-logs/${user._id}`, { signal }).then(res => {
          if (Array.isArray(res)) return res;
          if (res?.fuelLogs) return res.fuelLogs;
          if (res?.data) return Array.isArray(res.data) ? res.data : [];
          return [];
        }),
        
        // Fetch maintenance records: GET /api/maintenance-records/user/:userId
        apiRequest(`/api/maintenance-records/user/${user._id}`, { signal }).then(res => {
          if (Array.isArray(res)) return res;
          if (res?.maintenanceRecords) return res.maintenanceRecords;
          if (res?.data) return Array.isArray(res.data) ? res.data : [];
          return [];
        }),
      ]);
      
      // Extract successful results
      const motors = motorsResult.status === 'fulfilled' ? motorsResult.value : [];
      const trips = tripsResult.status === 'fulfilled' ? tripsResult.value : [];
      const fuelLogs = fuelLogsResult.status === 'fulfilled' ? fuelLogsResult.value : [];
      const maintenanceRecords = maintenanceResult.status === 'fulfilled' ? maintenanceResult.value : [];
      
      // Log errors for failed requests
      if (motorsResult.status === 'rejected') {
        if (__DEV__) {
          console.warn("[HomeScreen] Failed to fetch motors:", motorsResult.reason);
        }
      }
      if (tripsResult.status === 'rejected') {
        if (__DEV__) {
          console.warn("[HomeScreen] Failed to fetch trips:", tripsResult.reason);
        }
      }
      if (fuelLogsResult.status === 'rejected') {
        if (__DEV__) {
          console.warn("[HomeScreen] Failed to fetch fuel logs:", fuelLogsResult.reason);
        }
      }
      if (maintenanceResult.status === 'rejected') {
        if (__DEV__) {
          console.warn("[HomeScreen] Failed to fetch maintenance records:", maintenanceResult.reason);
        }
      }
      
      // Get combined fuel data from backend API
      // Uses: GET /api/fuel/combined?userId=user_id
      let combinedFuelData: any[] = [];
      try {
        const combinedResult = await combineFuelDataService(user._id);
        if (combinedResult?.combinedData) {
          combinedFuelData = combinedResult.combinedData;
        } else if (Array.isArray(combinedResult)) {
          combinedFuelData = combinedResult;
        } else {
          // Fallback: use fuel logs only if API fails
          combinedFuelData = fuelLogs;
        }
      } catch (error) {
        if (__DEV__) {
          console.warn("[HomeScreen] Failed to fetch combined fuel data, using fuel logs only:", error);
        }
        // Fallback to fuel logs if combined API fails
        combinedFuelData = fuelLogs;
      }
      
      // Update state with fetched data
      setMotors(motors);
      setTrips(trips);
      setFuelLogs(fuelLogs);
      setMaintenanceRecords(maintenanceRecords);
      setCombinedFuelData(combinedFuelData);
      
      // Cache the fetched data
      const cacheData: HomeDataCache = {
        motors,
        trips,
        fuelLogs,
        maintenanceRecords,
        combinedFuelData,
        timestamp: Date.now(),
      };
      
      try {
        await AsyncStorage.setItem(`${HOME_CACHE_KEY}_${user._id}`, JSON.stringify(cacheData));
        if (__DEV__) {
          console.log("[HomeScreen] ✅ Data fetched and cached from backend API");
        }
      } catch (cacheError) {
        if (__DEV__) {
          console.warn("[HomeScreen] Failed to cache data:", cacheError);
        }
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        if (__DEV__) {
          console.log("[HomeScreen] Request aborted");
        }
        return;
      }
      
      if (__DEV__) {
        console.error("[HomeScreen] Error fetching data:", error);
      }
      
      // Fallback to cached data on error
      try {
        const cachedDataStr = await AsyncStorage.getItem(`${HOME_CACHE_KEY}_${user._id}`);
        if (cachedDataStr) {
          const cachedData: HomeDataCache = JSON.parse(cachedDataStr);
          setMotors(cachedData.motors || []);
          setTrips(cachedData.trips || []);
          setFuelLogs(cachedData.fuelLogs || []);
          setMaintenanceRecords(cachedData.maintenanceRecords || []);
          setCombinedFuelData(cachedData.combinedFuelData || []);
          if (__DEV__) {
            console.log("[HomeScreen] Loaded cached data as fallback");
          }
        }
      } catch (cacheError) {
        if (__DEV__) {
          console.warn("[HomeScreen] Failed to load cached data:", cacheError);
        }
      }
    } finally {
      isFetchingRef.current = false;
      abortControllerRef.current = null;
    }
  }, [user?._id]);

  // Initial fetch on mount
  useEffect(() => {
    if (user?._id) {
      fetchAllData(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?._id]); // Only depend on user._id, not fetchAllData to prevent re-fetches

  // COMMENTED OUT: 5-second polling interval
  // Set up 5-second interval to fetch and compare
  // useEffect(() => {
  //   if (!user?._id) return;
  //   
  //   // Start interval
  //   intervalRef.current = setInterval(() => {
  //     fetchAllData(false);
  //   }, FETCH_INTERVAL);
  //
  //   // Cleanup on unmount
  //   return () => {
  //     if (intervalRef.current) {
  //       clearInterval(intervalRef.current);
  //       intervalRef.current = null;
  //     }
  //     if (abortControllerRef.current) {
  //       abortControllerRef.current.abort();
  //       abortControllerRef.current = null;
  //     }
  //   };
  // }, [user?._id, fetchAllData]);

  // Simple cleanup on unmount (fallback mode)
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, []);

  // Manual refresh handler
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchAllData(true).finally(() => {
      setRefreshing(false);
    });
  }, [fetchAllData]);

  // Memoized sections
  const sections: SectionDef[] = useMemo(() => [
    {
      title: "Motors",
      subtitle: "Registered Vehicles",
      text: "Your currently linked motorcycles.",
      data: motors,
      navTarget: "MotorDetails",
      onAdd: () => navigation.navigate("AddMotorScreen"),
      showSeeAll: true,
    },
    {
      title: "Fuel Logs",
      subtitle: "Refueling Activity",
      text: "Track fuel usage and costs (includes maintenance refuels).",
      data: combinedFuelData,
      navTarget: "FuelLogDetails",
      onAdd: () => navigation.navigate("AddFuelLogScreen"),
      showSeeAll: true,
    },
    {
      title: "Maintenance",
      subtitle: "Service History",
      text: "Track your motorcycle maintenance.",
      data: maintenanceRecords,
      navTarget: "MaintenanceDetails",
      onAdd: () => navigation.navigate("AddMaintenanceScreen"),
      showSeeAll: true,
    },
  ], [motors, combinedFuelData, maintenanceRecords, navigation]);

  return (
    <SafeAreaView style={[styles.safeArea, isDarkMode && styles.safeAreaDark]}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} backgroundColor={isDarkMode ? "#00858B" : "#00ADB5"} />

      <View style={[styles.fixedHeader, isDarkMode && { backgroundColor: "#1A1A1A" }]}>
        <LinearGradient colors={isDarkMode ? ["#00858B", "#006A6F"] : ["#00ADB5", "#00C2CC"]} style={styles.headerGradient}>
          <Image
            source={!isDarkMode ? require("../../assets/logo_trafficSlight_dark.png") : require("../../assets/logo_trafficSlight.png")}
            style={styles.logoImage}
          />
        </LinearGradient>
      </View>

        <FlatList
          data={sections}
          keyExtractor={(s) => s.title}
          renderItem={({ item }) => (
            <Section
              title={item.title}
              subtitle={item.subtitle}
              text={item.text}
              data={item.data}
              navTarget={item.navTarget}
              onAdd={item.onAdd}
              showSeeAll={item.showSeeAll}
              isDarkMode={isDarkMode}
            />
          )}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={isDarkMode ? "#00858B" : "#00ADB5"}
            colors={[isDarkMode ? "#00858B" : "#00ADB5"]}
          />
        }
          ListFooterComponent={
            <TouchableOpacity style={styles.calcBtn} onPress={() => navigation.navigate?.("FuelCalculator")}>
              <LinearGradient colors={isDarkMode ? ["#00858B", "#006A6F"] : ["#00ADB5", "#00C2CC"]} style={styles.calcBtnGradient}>
                <Text style={styles.calcBtnText}>Update Fuel Efficiency</Text>
              </LinearGradient>
            </TouchableOpacity>
          }
          contentContainerStyle={[styles.container, isDarkMode && styles.containerDark]}
        />
    </SafeAreaView>
  );
}

/* -------------------- styles -------------------- */
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F2EEEE",
  },
  safeAreaDark: {
    backgroundColor: "#1A1A1A",
  },
  container: {
    padding: 16,
    paddingTop: 8,
  },
  containerDark: {
    backgroundColor: "#1A1A1A",
  },
  fixedHeader: {
    width: "100%",
    backgroundColor: "#F2EEEE",
    zIndex: 10,
    overflow: "hidden",
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerGradient: {
    padding: 24,
    paddingTop: 0,
    paddingBottom: 16,
  },
  logoImage: {
    width: "70%",
    height: 69,
    alignSelf: "center",
    resizeMode: "contain",
  },
  calcBtn: {
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 32,
    borderRadius: 12,
    overflow: "hidden",
    elevation: 5,
    shadowColor: "#00ADB5",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  calcBtnGradient: {
    padding: 16,
    alignItems: "center",
  },
  calcBtnText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
  },
  section: {
    marginTop: 10,
    marginBottom: 24,
    backgroundColor: "#FFFAFA",
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
    marginHorizontal: 16,
  },
  sectionDark: {
    backgroundColor: "#2A2A2A",
    shadowColor: "#000",
    shadowOpacity: 0.3,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1A1A1A",
    marginBottom: 4,
  },
  sectionTitleDark: {
    color: "#FFFFFF",
  },
  seeAllButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: "rgba(0, 173, 181, 0.1)",
  },
  seeAll: {
    color: "#00ADB5",
    fontSize: 14,
    fontWeight: "600",
  },
  item: {
    backgroundColor: "#FFFAFA",
    padding: 16,
    borderRadius: 12,
    marginRight: 12,
    width: 160,
    minHeight: 180,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2.22,
    elevation: 3,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
  },
  itemDark: {
    backgroundColor: "#2A2A2A",
    borderColor: "rgba(255,255,255,0.1)",
  },
  itemText: {
    fontSize: 14,
    color: "#333",
    marginBottom: 4,
    textAlign: "center",
    fontWeight: "500",
  },
  itemTextDark: {
    color: "#FFFFFF",
  },
  itemImage: {
    width: 70,
    height: 70,
    borderRadius: 12,
    marginBottom: 12,
    alignSelf: "center",
  },
  itemImageDark: {
    borderColor: "rgba(255,255,255,0.1)",
  },
  emptyText: {
    fontSize: 14,
    color: "#666",
    paddingLeft: 10,
    fontStyle: "italic",
    textAlign: "center",
    marginTop: 8,
  },
  sectionSubtitle: {
    fontSize: 15,
    color: "#666",
    marginTop: 2,
    fontWeight: "500",
  },
  sectionSubtitleDark: {
    color: "#AAA",
  },
  sectionText: {
    fontSize: 13,
    color: "#888",
    marginTop: 2,
    fontStyle: "italic",
  },
  sectionTextDark: {
    color: "#777",
  },
});
