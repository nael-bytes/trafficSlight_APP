import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Modal,
} from 'react-native';
import MaterialIcons from "react-native-vector-icons/MaterialIcons";
import { LinearGradient } from 'expo-linear-gradient';
import type { RouteData, Motor } from '../types';

interface RouteSelectionModalProps {
  visible: boolean;
  onClose: () => void;
  bestRoute: RouteData | null;
  alternatives: RouteData[];
  selectedRouteId: string | null;
  onSelectRoute: (id: string) => void;
  selectedMotor: Motor | null;
  isNavigating: boolean;
}

export const RouteSelectionModal: React.FC<RouteSelectionModalProps> = ({
  visible,
  onClose,
  bestRoute,
  alternatives,
  selectedRouteId,
  onSelectRoute,
  selectedMotor,
  isNavigating,
}) => {
  const [sortCriteria, setSortCriteria] = useState<'fuel' | 'traffic' | 'distance'>('fuel');

  const allRoutes = useMemo(() => {
    if (!bestRoute) return alternatives;
    return [bestRoute, ...alternatives];
  }, [bestRoute, alternatives]);

  const sortedRoutes = useMemo(() => {
    return [...allRoutes].sort((a, b) => {
      switch (sortCriteria) {
        case 'fuel':
          return a.fuelEstimate - b.fuelEstimate;
        case 'traffic':
          return a.trafficRate - b.trafficRate;
        case 'distance':
          return a.distance - b.distance;
        default:
          return 0;
      }
    });
  }, [allRoutes, sortCriteria]);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.bottomSheetContainer}>
          <LinearGradient
            colors={['#00ADB5', '#00858B']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.bottomSheetHeader}
          >
            <Text style={styles.bottomSheetTitle}>Available Routes</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <MaterialIcons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </LinearGradient>

          <View style={styles.sortContainer}>
            <Text style={styles.sortLabel}>Sort Routes By:</Text>
            <View style={styles.sortButtonsContainer}>
              <TouchableOpacity
                style={[styles.sortButton, sortCriteria === "fuel" && styles.sortButtonActive]}
                onPress={() => setSortCriteria("fuel")}
              >
                <Text style={[styles.sortButtonText, sortCriteria === "fuel" && styles.sortButtonTextActive]}>
                  FUEL
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sortButton, sortCriteria === "traffic" && styles.sortButtonActive]}
                onPress={() => setSortCriteria("traffic")}
              >
                <Text style={[styles.sortButtonText, sortCriteria === "traffic" && styles.sortButtonTextActive]}>
                  TRAFFIC
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sortButton, sortCriteria === "distance" && styles.sortButtonActive]}
                onPress={() => setSortCriteria("distance")}
              >
                <Text style={[styles.sortButtonText, sortCriteria === "distance" && styles.sortButtonTextActive]}>
                  DISTANCE
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView style={styles.bottomSheetContent}>
            {sortedRoutes.map((route, index) => (
              <TouchableOpacity
                key={route.id}
                style={[styles.routeCard, selectedRouteId === route.id && styles.selectedRouteCard]}
                onPress={() => onSelectRoute(route.id)}
                disabled={isNavigating}
              >
                {index === 0 && (
                  <View style={styles.recommendedTag}>
                    <MaterialIcons name="star" size={20} color="#FFD700" />
                    <Text style={styles.recommendedText}>Recommended Route</Text>
                  </View>
                )}

                <View style={styles.routeDetail}>
                  <View style={styles.iconContainer}>
                    <MaterialIcons name="local-gas-station" size={24} color="#00ADB5" />
                  </View>
                  <View style={styles.detailContent}>
                    <Text style={styles.detailLabel}>Estimated Fuel </Text>
                    <Text style={styles.detailValue}>
                      {route.fuelEstimate <= 0.02
                        ? "~0 L"
                        : `${Math.max(0.1, (route.fuelEstimate - 0.03)).toFixed(2)}L – ${Math.max(
                          0.1,
                          (route.fuelEstimate + 0.03)
                        ).toFixed(2)} L`}
                    </Text>
                  </View>
                </View>

                <View style={styles.routeDetail}>
                  <View style={styles.iconContainer}>
                    <MaterialIcons name="straighten" size={24} color="#00ADB5" />
                  </View>
                  <View style={styles.detailContent}>
                    <Text style={styles.detailLabel}>Total Distance</Text>
                    <Text style={styles.detailValue}>
                      {(route.distance / 1000).toFixed(2)} km
                    </Text>
                  </View>
                </View>

                <View style={styles.routeDetail}>
                  <View style={styles.iconContainer}>
                    <MaterialIcons name="schedule" size={24} color="#00ADB5" />
                  </View>
                  <View style={styles.detailContent}>
                    <Text style={styles.detailLabel}>Estimated Time</Text>
                    <Text style={styles.detailValue}>
                      {(route.duration / 60).toFixed(0)} minutes
                    </Text>
                  </View>
                </View>

                <View style={styles.routeDetail}>
                  <View style={styles.iconContainer}>
                    <MaterialIcons name="traffic" size={24} color="#00ADB5" />
                  </View>
                  <View style={styles.detailContent}>
                    <Text style={styles.detailLabel}>Traffic Level</Text>
                    <Text style={styles.detailValue}>
                      {getTrafficLabel(route.trafficRate)}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const getTrafficLabel = (trafficRate: number): string => {
  switch (trafficRate) {
    case 1: return "Light";
    case 2: return "Moderate";
    case 3: return "Heavy";
    case 4: return "Very Heavy";
    case 5: return "Severe";
    default: return "Unknown";
  }
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  bottomSheetContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  bottomSheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  bottomSheetTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  closeButton: {
    padding: 4,
  },
  sortContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  sortLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  sortButtonsContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  sortButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
  },
  sortButtonActive: {
    backgroundColor: '#00ADB5',
  },
  sortButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  sortButtonTextActive: {
    color: '#fff',
  },
  bottomSheetContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  routeCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  selectedRouteCard: {
    borderColor: '#00ADB5',
    borderWidth: 2,
    backgroundColor: '#f0fdfd',
  },
  recommendedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff3cd',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  recommendedText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#856404',
    marginLeft: 4,
  },
  routeDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#e8f8f8',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  detailContent: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
});
