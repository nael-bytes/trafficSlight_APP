import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  LayoutAnimation,
  RefreshControl,
  Image,
  StatusBar,
  useColorScheme,
  SafeAreaView,
} from "react-native";
import axios from "axios";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import { useUser } from "../../AuthContext/UserContextImproved";

// ====== Replace this with your real auth user (useUser) ======

// ============================================================


const API_BASE = "https://ts-backend-1-jyit.onrender.com";

type SectionDef = {
  title: string;
  subtitle?: string;
  text?: string;
  data: any[];
  navTarget?: string;
  onAdd?: () => void;
  showSeeAll?: boolean;
};

const renderItemLabel = (item: any, type: string) => {
  switch (type) {
    case "Motors":
      return {
        line1: item.nickname || item.motorcycleData?.name || "Motorcycle",
        line2: item.fuelEfficiency || item.fuelConsumption ? `${item.fuelEfficiency || item.fuelConsumption} km/L` : "Fuel Efficiency Unknown",
        line3: `Fuel: ${item.currentFuelLevel?.toFixed(0) || 0}% • ${item.motorcycleData?.name || "Unknown Model"}`,
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
        line1: `₱${(item.totalCost ?? "--").toFixed?.() ?? (typeof item.cost === "number" ? item.cost.toFixed(2) : "--")}${sourceIndicator}`,
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
      // Use maintenance icon for maintenance refuels, gas station for regular fuel logs
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

const getCurrentLocation = async () => {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      console.warn("Location permission denied");
      return null;
    }
    const loc = await Location.getCurrentPositionAsync({});
    return loc.coords;
  } catch (err) {
    console.warn("Failed to get location:", err);
    return null;
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
              console.log(`[HomeScreen] Rendering ${title} item:`, {
                itemKeys: Object.keys(item),
                label,
                hasImage: !!getImageForSection(title, (item as any).type || (item as any).details?.type)
              });
              
              return (
                <TouchableOpacity
                  style={[styles.item, isDarkMode && styles.itemDark]}
                  onPress={() => {
                    if (navTarget) {
                      // For maintenance items, pass the item for detailed view
                      if (title === "Maintenance") {
                        navigation.navigate(navTarget as any, { 
                          item, 
                          showSingleItem: true 
                        });
                      } else {
                        // For other sections, pass the item normally
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


  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [motors, setMotors] = useState<any[]>([]);
  const [trips, setTrips] = useState<any[]>([]);
  const [destinations, setDestinations] = useState<any[]>([]);
  const [fuelLogs, setFuelLogs] = useState<any[]>([]);
  const [maintenanceRecords, setMaintenanceRecords] = useState<any[]>([]);
  const [gasStations, setGasStations] = useState<any[]>([]);
  const [combinedFuelData, setCombinedFuelData] = useState<any[]>([]);
  const navigation = useNavigation<any>();
  const { user } = useUser();

  // Function to combine fuel logs with maintenance refuels only
  const combineFuelData = (fuelLogs: any[], maintenanceRecords: any[]) => {
    // Filter maintenance records for refuel type only
    const maintenanceRefuels = maintenanceRecords.filter((record: any) => record.type === 'refuel');
    
    // Transform maintenance refuels to match fuel log format
    const transformedMaintenanceRefuels = maintenanceRefuels.map((record: any) => ({
      _id: `maintenance_${record._id}`,
      date: record.timestamp,
      liters: record.details.quantity,
      pricePerLiter: record.details.cost / record.details.quantity,
      totalCost: record.details.cost,
      odometer: undefined, // Maintenance records don't have odometer
      notes: record.details.notes,
      motorId: {
        _id: record.motorId._id,
        nickname: record.motorId.nickname,
        motorcycleId: undefined
      },
      location: record.location ? `${record.location.latitude}, ${record.location.longitude}` : undefined,
      source: 'maintenance'
    }));

    // Combine both data sources
    const combined = [
      ...fuelLogs.map((log: any) => ({ ...log, source: 'fuel_log' })), 
      ...transformedMaintenanceRefuels
    ];
    
    // Sort by date (newest first)
    return combined.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

  // load cached
  useEffect(() => {
    if (!user || !user._id) return;
  
    const loadCached = async () => {
      try {
        const [
          cachedMotors,
          cachedTrips,
          cachedDestinations,
          cachedFuelLogs,
          cachedMaintenance,
          cachedGas,
        ] = await Promise.all([
          AsyncStorage.getItem(`cachedMotors_${user._id}`),
          AsyncStorage.getItem(`cachedTrips_${user._id}`),
          AsyncStorage.getItem(`cachedDestinations_${user._id}`),
          AsyncStorage.getItem(`cachedFuelLogs_${user._id}`),
          AsyncStorage.getItem(`cachedMaintenance_${user._id}`),
          AsyncStorage.getItem(`cachedGasStations_${user._id}`),
        ]);
  
        if (cachedMotors) setMotors(JSON.parse(cachedMotors));
        if (cachedTrips)
          setTrips(JSON.parse(cachedTrips).sort(
            (a: any, b: any) => new Date(b.tripStartTime || b.date || 0).getTime() - new Date(a.tripStartTime || a.date || 0).getTime()
          ));
        if (cachedDestinations) setDestinations(JSON.parse(cachedDestinations));
        
        let fuelLogsData = [];
        let maintenanceData = [];
        
        if (cachedFuelLogs) {
          fuelLogsData = JSON.parse(cachedFuelLogs).sort(
            (a: any, b: any) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()
          );
          setFuelLogs(fuelLogsData);
        }
        
        if (cachedMaintenance) {
          maintenanceData = JSON.parse(cachedMaintenance).sort(
            (a: any, b: any) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime()
          );
          setMaintenanceRecords(maintenanceData);
        }
        
        // Combine fuel logs with maintenance refuels only
        const combined = combineFuelData(fuelLogsData, maintenanceData);
        setCombinedFuelData(combined);
        
        if (cachedGas) setGasStations(JSON.parse(cachedGas));
  
        console.log("✅ Cached data restored for user:", user._id);
      } catch (err) {
        console.warn("Failed to load cache:", err);
      } finally {
        setLoading(false);
      }
    };
  
    loadCached();
  }, [user?._id]);
  

  // fetch all
  const fetchAllData = async () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setLoading(true);
    
    
    try {
      const coords = await getCurrentLocation();
      // you can use coords to call nearby gasstations endpoint if you have it
      const [motorsRes, tripsRes, destinationsRes, logsRes, maintenanceRes, gasRes] =
        await Promise.all([
          axios.get(`${API_BASE}/api/user-motors/user/${user._id}`).catch(() => ({ data: [] })),
          axios.get(`${API_BASE}/api/trips/user/${user._id}`).catch(() => ({ data: [] })),
          axios.get(`${API_BASE}/api/saved-destinations/${user._id}`).catch(() => ({ data: [] })),
          axios.get(`${API_BASE}/api/fuel-logs/${user._id}`).catch(() => ({ data: [] })),
          axios.get(`${API_BASE}/api/maintenance-records/user/${user._id}`).catch(() => ({ data: [] })),
          axios.get(`${API_BASE}/api/gas-stations`).catch(() => ({ data: [] })),
        ]);
    
      // 🔹 Update state with logging
      console.log('[HomeScreen] Fetched data:', {
        motors: motorsRes.data?.length || 0,
        trips: tripsRes.data?.length || 0,
        destinations: destinationsRes.data?.length || 0,
        fuelLogs: logsRes.data?.length || 0,
        maintenance: maintenanceRes.data?.length || 0,
        gasStations: gasRes.data?.length || 0
      });

      setMotors(motorsRes.data || []);
      setTrips(
        (tripsRes.data || []).sort(
          (a: any, b: any) => new Date(b.tripStartTime || b.date || 0).getTime() - new Date(a.tripStartTime || a.date || 0).getTime()
        )
      );
      setDestinations(destinationsRes.data || []);
      setFuelLogs(
        (logsRes.data || []).sort(
          (a: any, b: any) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()
        )
      );
      const maintenanceData = (maintenanceRes.data || []).sort(
        (a: any, b: any) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime()
      );
      setMaintenanceRecords(maintenanceData);
      setGasStations(gasRes.data || []);

      // Combine fuel logs with maintenance refuels only
      const combined = combineFuelData(logsRes.data || [], maintenanceData);
      setCombinedFuelData(combined);
    
      // 🔹 Cache everything
      await AsyncStorage.multiSet([
        [`cachedMotors_${user._id}`, JSON.stringify(motorsRes.data || [])],
        [`cachedTrips_${user._id}`, JSON.stringify(tripsRes.data || [])],
        [`cachedDestinations_${user._id}`, JSON.stringify(destinationsRes.data || [])],
        [`cachedFuelLogs_${user._id}`, JSON.stringify(logsRes.data || [])],
        [`cachedMaintenance_${user._id}`, JSON.stringify(maintenanceRes.data || [])],
        [`cachedGasStations_${user._id}`, JSON.stringify(gasRes.data || [])],
      ]);
    } catch (err) {
      console.error("🔥 Unexpected Fetch Error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // silent fetch on focus
  useFocusEffect(
    useCallback(() => {
      if (user && user._id) {
        fetchAllData();
      }
    }, [user])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchAllData();
  };

  const sections: SectionDef[] = [
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
      onAdd: () => navigation.navigate("AddMaintenanceScreen"), // Fixed: Added onAdd function
      showSeeAll: true,
    },
  ];

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

      { (
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
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={isDarkMode ? "#00858B" : "#00ADB5"} colors={[isDarkMode ? "#00858B" : "#00ADB5"]} />}
          ListFooterComponent={
            <TouchableOpacity style={styles.calcBtn} onPress={() => navigation.navigate?.("FuelCalculator")}>
              <LinearGradient colors={isDarkMode ? ["#00858B", "#006A6F"] : ["#00ADB5", "#00C2CC"]} style={styles.calcBtnGradient}>
                <Text style={styles.calcBtnText}>Update Fuel Efficiency</Text>
              </LinearGradient>
            </TouchableOpacity>
          }
          contentContainerStyle={[styles.container, isDarkMode && styles.containerDark]}
        />
      )}
    </SafeAreaView>
  );
}

/* -------------------- styles (your original styles restored) -------------------- */
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
  scrollableHeader: {
    paddingVertical: 16,
    alignItems: "center",
  },
  greeting: {
    fontSize: 28,
    fontWeight: "700",
    color: "#333333",
    textShadowColor: "rgba(0, 0, 0, 0.05)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
    textAlign: "center",
  },
  greetingDark: {
    color: "#FFFFFF",
    textShadowColor: "rgba(0, 0, 0, 0.2)",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#666",
    fontWeight: "500",
  },
  loadingTextDark: {
    color: "#AAA",
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
