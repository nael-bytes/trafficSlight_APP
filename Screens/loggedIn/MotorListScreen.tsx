import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "react-native";

type RootStackParamList = {
  MotorList: { fullList: any[] };
  MotorDetails: { item: any };
};

type Props = {
  route: RouteProp<RootStackParamList, "MotorList">;
};

export default function MotorListScreen({ route }: Props) {
  const navigation = useNavigation();
  const { fullList } = route.params;
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = () => {
    setRefreshing(true);
    // Simulate refresh
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  };

  const renderMotorItem = ({ item }: { item: any }) => {
    return (
      <TouchableOpacity
        style={styles.motorItem}
        onPress={() => navigation.navigate("MotorDetails", { item })}
      >
        <View style={styles.motorImageContainer}>
          <Image
            source={require("../../assets/icons/motor-silhouette.png")}
            style={styles.motorImage}
          />
        </View>
        
        <View style={styles.motorInfo}>
          <Text style={styles.motorName}>
            {item.nickname || item.motorcycleData?.name || "Motorcycle"}
          </Text>
          <Text style={styles.motorModel}>
            {item.motorcycleData?.name || item.name || "Unknown Model"}
          </Text>
          <Text style={styles.motorDetails}>
            Fuel Efficiency: {item.fuelEfficiency || item.fuelConsumption || "N/A"} km/L
          </Text>
          <Text style={styles.motorDetails}>
            Current Fuel: {item.currentFuelLevel?.toFixed(0) || 0}%
          </Text>
          {item.plateNumber && (
            <Text style={styles.motorDetails}>
              Plate: {item.plateNumber}
            </Text>
          )}
        </View>

        <View style={styles.arrowContainer}>
          <Ionicons name="chevron-forward" size={20} color="#00ADB5" />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#00ADB5" />
      
      <LinearGradient colors={["#00ADB5", "#00C2CC"]} style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Motors</Text>
        <View style={styles.placeholder} />
      </LinearGradient>

      <View style={styles.content}>
        {fullList && fullList.length > 0 ? (
          <FlatList
            data={fullList}
            keyExtractor={(item, index) => item._id || index.toString()}
            renderItem={renderMotorItem}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor="#00ADB5"
                colors={["#00ADB5"]}
              />
            }
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContainer}
          />
        ) : (
          <View style={styles.emptyContainer}>
            <Ionicons name="bicycle" size={64} color="#ccc" />
            <Text style={styles.emptyText}>No motors found</Text>
            <Text style={styles.emptySubtext}>
              Add a motor to get started
            </Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F2EEEE",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 44,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: "600",
    color: "#fff",
    textAlign: "center",
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  listContainer: {
    paddingBottom: 20,
  },
  motorItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 16,
    marginBottom: 12,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  motorImageContainer: {
    marginRight: 16,
  },
  motorImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
  },
  motorInfo: {
    flex: 1,
  },
  motorName: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    marginBottom: 4,
  },
  motorModel: {
    fontSize: 14,
    color: "#666",
    marginBottom: 4,
  },
  motorDetails: {
    fontSize: 12,
    color: "#888",
    marginBottom: 2,
  },
  arrowContainer: {
    marginLeft: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#666",
    marginTop: 16,
    textAlign: "center",
  },
  emptySubtext: {
    fontSize: 14,
    color: "#999",
    marginTop: 8,
    textAlign: "center",
  },
});
