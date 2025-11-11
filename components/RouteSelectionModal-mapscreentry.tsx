import React, { useState, useMemo, useCallback } from 'react';
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
  onStartNavigation?: () => void;
  onViewRoute?: () => void;
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
  onStartNavigation,
  onViewRoute,
}) => {
  const [sortCriteria, setSortCriteria] = useState<'fuel' | 'traffic' | 'distance'>('fuel');

  const allRoutes = useMemo(() => {
    const routes: RouteData[] = [];
    const seenIds = new Set<string>();
    
    // Add best route if it exists
    if (bestRoute && bestRoute.id) {
      routes.push(bestRoute);
      seenIds.add(bestRoute.id);
    }
    
    // Add alternatives (filter out duplicates by ID)
    if (alternatives && alternatives.length > 0) {
      alternatives.forEach(route => {
        // Only add if it's not already in the list (by ID)
        if (route && route.id && !seenIds.has(route.id)) {
          routes.push(route);
          seenIds.add(route.id);
        }
      });
    }
    
    return routes;
  }, [bestRoute, alternatives]);
  
  // Calculate composite score for each route (fuel + traffic + distance)
  // Lower score = better route
  const calculateCompositeScore = useCallback((route: RouteData): number => {
    // Normalize values (lower is better for all)
    // Fuel: use as-is (already in liters, lower is better)
    const fuelScore = route.fuelEstimate || 0;
    
    // Traffic: 1-5 scale (1 is best, 5 is worst)
    const trafficScore = (route.trafficRate || 1) * 2; // Weight traffic more
    
    // Distance: normalize by average (use relative distance)
    // For simplicity, use distance in km directly (lower is better)
    const distanceScore = (route.distance || 0) * 0.5; // Weight distance less
    
    // Composite score: weighted sum
    return fuelScore + trafficScore + distanceScore;
  }, []);
  
  // Find the route with the best composite score (lowest score)
  const recommendedRouteId = useMemo(() => {
    if (allRoutes.length === 0) return null;
    
    // Calculate score for each route
    const routesWithScores = allRoutes.map(route => ({
      route,
      score: calculateCompositeScore(route),
    }));
    
    // Find route with lowest score (best route)
    const bestRoute = routesWithScores.reduce((best, current) => 
      current.score < best.score ? current : best
    );
    
    return bestRoute.route.id || null;
  }, [allRoutes, calculateCompositeScore]);

  const sortedRoutes = useMemo(() => {
    if (!allRoutes || allRoutes.length === 0) return [];
    
    return [...allRoutes].sort((a, b) => {
      switch (sortCriteria) {
        case 'fuel':
          return (a.fuelEstimate || 0) - (b.fuelEstimate || 0);
        case 'traffic':
          return (a.trafficRate || 0) - (b.trafficRate || 0);
        case 'distance':
          return (a.distance || 0) - (b.distance || 0);
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
      <TouchableOpacity 
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity 
          activeOpacity={1}
          onPress={(e) => e.stopPropagation()}
          style={styles.bottomSheetContainer}
        >
          <LinearGradient
            colors={['#00ADB5', '#00858B']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.bottomSheetHeader}
          >
            <Text style={styles.bottomSheetTitle}>Available Routes</Text>
            <TouchableOpacity 
              onPress={(e) => {
                e.stopPropagation();
                if (onClose) {
                  onClose();
                }
              }} 
              style={styles.closeButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
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
            {sortedRoutes.length === 0 ? (
              <View style={styles.emptyState}>
                <MaterialIcons name="route" size={48} color="#ccc" />
                <Text style={styles.emptyStateText}>No routes available</Text>
                <Text style={styles.emptyStateSubtext}>Please try selecting a different destination</Text>
              </View>
            ) : (
              sortedRoutes.map((route, index) => {
                const routeId = route.id || `route-${index}`;
                // CRITICAL: Recommended route is based on composite score (fuel + traffic + distance)
                // Not based on user selection or API order
                const isRecommended = routeId === recommendedRouteId;
                return (
                  <TouchableOpacity
                    key={routeId}
                    style={[styles.routeCard, selectedRouteId === routeId && styles.selectedRouteCard]}
                    onPress={() => {
                      if (routeId && onSelectRoute) {
                        onSelectRoute(routeId);
                      }
                    }}
                    disabled={isNavigating}
                  >
                {isRecommended && (
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
                        : `${Math.max(0.1, ((route.fuelEstimate || 0) - 0.03)).toFixed(2)}L – ${Math.max(
                          0.1,
                          ((route.fuelEstimate || 0) + 0.03)
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
                      {/* CRITICAL: Distance is already in kilometers from destinationFlowManager */}
                      {(route.distance || 0).toFixed(2)} km
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
                      {((route.duration || 0) / 60).toFixed(0)} minutes
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
                );
              })
            )}
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.actionButtonsContainer}>
            <TouchableOpacity
              style={[
                styles.actionButton, 
                styles.viewRouteButton,
                !selectedRouteId && styles.actionButtonDisabled
              ]}
              onPress={(e) => {
                e.stopPropagation();
                if (onViewRoute && selectedRouteId) {
                  onViewRoute();
                }
              }}
              disabled={!selectedRouteId}
              activeOpacity={selectedRouteId ? 0.7 : 1}
            >
              <MaterialIcons 
                name="visibility" 
                size={20} 
                color={selectedRouteId ? "#00ADB5" : "#ccc"} 
              />
              <Text style={[
                styles.actionButtonText,
                !selectedRouteId && styles.actionButtonTextDisabled
              ]}>
                View Route
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.actionButton, 
                styles.startNavigationButton,
                (!selectedRouteId || isNavigating) && styles.actionButtonDisabled
              ]}
              onPress={(e) => {
                e.stopPropagation();
                if (onStartNavigation && selectedRouteId && !isNavigating) {
                  onStartNavigation();
                }
              }}
              disabled={!selectedRouteId || isNavigating}
              activeOpacity={(!selectedRouteId || isNavigating) ? 1 : 0.7}
            >
              <MaterialIcons 
                name="navigation" 
                size={20} 
                color={(!selectedRouteId || isNavigating) ? "#ccc" : "#fff"} 
              />
              <Text style={[
                styles.actionButtonText, 
                styles.startNavigationText,
                (!selectedRouteId || isNavigating) && styles.actionButtonTextDisabled
              ]}>
                {isNavigating ? 'Navigating...' : 'Start Navigation'}
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
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
    zIndex: 1000,
    elevation: 5, // Android
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
  actionButtonsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#f8f9fa',
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
    zIndex: 1000,
    elevation: 5, // Android
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginHorizontal: 5,
    minHeight: 44, // Ensure minimum touch target size
  },
  viewRouteButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#00ADB5',
  },
  startNavigationButton: {
    backgroundColor: '#00ADB5',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
    color: '#00ADB5',
  },
  startNavigationText: {
    color: '#fff',
  },
  actionButtonDisabled: {
    opacity: 0.5,
    backgroundColor: '#e0e0e0',
  },
  actionButtonTextDisabled: {
    color: '#999',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
});
