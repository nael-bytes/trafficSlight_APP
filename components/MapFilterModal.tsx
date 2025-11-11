// Map Filter Modal Component - Lightweight Version
// Allows users to customize what they want to see on the map

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Switch,
  Animated,
  Dimensions,
  Image,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

export interface MapFilters {
  // Traffic Reports
  showTrafficReports: boolean;
  showAccidents: boolean;
  showRoadwork: boolean;
  showCongestion: boolean;
  showHazards: boolean;
  
  // Gas Stations
  showGasStations: boolean;
  showPetron: boolean;
  showShell: boolean;
  showCaltex: boolean;
  showUnioil: boolean;
  showCleanfuel: boolean;
  showFlyingV: boolean;
  showJetti: boolean;
  showPetroGazz: boolean;
  showPhoenix: boolean;
  showRephil: boolean;
  showSeaoil: boolean;
  showTotal: boolean;
  showOtherGasStations: boolean;
  
  // Map Elements
  showUserLocation: boolean;
  showDestination: boolean;
  showClusters: boolean;
  showMaintenance: boolean;
  showImages: boolean;
  
  // Clustering
  enableClustering: boolean;
  clusterRadius: number;
  
  // Map Style
  mapStyle: 'standard' | 'satellite' | 'hybrid';
}

export const defaultMapFilters: MapFilters = {
  // Traffic Reports
  showTrafficReports: true,
  showAccidents: true,
  showRoadwork: true,
  showCongestion: true,
  showHazards: true,
  
  // Gas Stations
  showGasStations: true,
  showPetron: true,
  showShell: true,
  showCaltex: true,
  showUnioil: true,
  showCleanfuel: true,
  showFlyingV: true,
  showJetti: true,
  showPetroGazz: true,
  showPhoenix: true,
  showRephil: true,
  showSeaoil: true,
  showTotal: true,
  showOtherGasStations: true,
  
  // Map Elements
  showUserLocation: true,
  showDestination: true,
  showClusters: true,
  showMaintenance: true,
  showImages: true,
  
  // Clustering
  enableClustering: true,
  clusterRadius: 100,
  
  // Map Style
  mapStyle: 'standard',
};

interface MapFilterModalProps {
  visible: boolean;
  onClose: () => void;
  filters: MapFilters;
  onFiltersChange: (filters: MapFilters) => void;
}

export const MapFilterModal: React.FC<MapFilterModalProps> = ({
  visible,
  onClose,
  filters,
  onFiltersChange,
}) => {
  const [localFilters, setLocalFilters] = useState<MapFilters>(filters);
  const [slideAnim] = useState(new Animated.Value(height));

  useEffect(() => {
    if (visible) {
      setLocalFilters(filters);
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: height,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, slideAnim]);

  const handleFilterChange = (key: keyof MapFilters, value: boolean | number | string) => {
    const newFilters = { ...localFilters, [key]: value };
    setLocalFilters(newFilters);
  };

  const handleApplyFilters = () => {
    onFiltersChange(localFilters);
    onClose();
  };

  const handleResetFilters = () => {
    setLocalFilters(defaultMapFilters);
    onFiltersChange(defaultMapFilters);
  };

  const FilterSection = ({ title, children, icon, iconColor }: { title: string; children: React.ReactNode; icon?: string; iconColor?: string }) => (
    <View style={styles.filterSection}>
      <View style={styles.sectionTitleContainer}>
        {icon && (
          <MaterialIcons 
            name={icon} 
            size={20} 
            color={iconColor || '#333'} 
            style={styles.sectionIcon}
          />
        )}
      <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );

  const FilterItem = ({ 
    label, 
    value, 
    onValueChange, 
    icon, 
    iconSource,
    color = '#2196F3'
  }: { 
    label: string; 
    value: boolean; 
    onValueChange: (value: boolean) => void; 
    icon?: string;
    iconSource?: any; // For require() image sources
    color?: string;
  }) => (
    <View style={styles.filterItem}>
      <View style={styles.filterItemLeft}>
        {iconSource ? (
          <View style={styles.iconContainer}>
            <Image 
              source={iconSource} 
              style={styles.filterIconImage}
              resizeMode="contain"
            />
          </View>
        ) : icon ? (
          <MaterialIcons 
            name={icon} 
            size={20} 
            color={color} 
            style={styles.iconContainer}
          />
        ) : null}
        <Text style={styles.filterLabel}>
          {label}
        </Text>
      </View>
      <View style={styles.switchContainer}>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: '#E0E0E0', true: '#4CAF50' }}
        thumbColor={value ? '#FFF' : '#FFF'}
      />
      </View>
    </View>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <Animated.View style={[styles.modalContainer, { transform: [{ translateY: slideAnim }] }]}>
          <LinearGradient
            colors={['#f8f9fa', '#e9ecef']}
            style={styles.modalContent}
          >
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.headerTitle}>Map Filters</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <MaterialIcons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
              {/* Traffic Reports */}
              <FilterSection title="Traffic Reports">
                <FilterItem
                  label="All Reports"
                  value={localFilters.showTrafficReports}
                  onValueChange={(value) => handleFilterChange('showTrafficReports', value)}
                  icon="warning"
                  color="#FF5722"
                />
                <FilterItem
                  label="Accidents"
                  value={localFilters.showAccidents}
                  onValueChange={(value) => handleFilterChange('showAccidents', value)}
                  icon="error"
                  color="#F44336"
                />
                <FilterItem
                  label="Roadwork"
                  value={localFilters.showRoadwork}
                  onValueChange={(value) => handleFilterChange('showRoadwork', value)}
                  icon="construction"
                  color="#FF9800"
                />
                <FilterItem
                  label="Congestion"
                  value={localFilters.showCongestion}
                  onValueChange={(value) => handleFilterChange('showCongestion', value)}
                  icon="traffic"
                  color="#FFC107"
                />
                <FilterItem
                  label="Hazards"
                  value={localFilters.showHazards}
                  onValueChange={(value) => handleFilterChange('showHazards', value)}
                  icon="dangerous"
                  color="#9C27B0"
                />
              </FilterSection>

              {/* Gas Stations */}
              <FilterSection title="Gas Stations" icon="local-gas-station" iconColor="#4CAF50">
                <FilterItem
                  label="All Gas Stations"
                  value={localFilters.showGasStations}
                  onValueChange={(value) => handleFilterChange('showGasStations', value)}
                  icon="local-gas-station"
                  color="#4CAF50"
                />
                <View style={styles.rowContainer}>
                  <FilterItem
                    label="Petron"
                    value={localFilters.showPetron}
                    onValueChange={(value) => handleFilterChange('showPetron', value)}
                    iconSource={require('../assets/icons/GAS_STATIONS/PETRON.png')}
                    color="#E91E63"
                  />
                  <FilterItem
                    label="Shell"
                    value={localFilters.showShell}
                    onValueChange={(value) => handleFilterChange('showShell', value)}
                    iconSource={require('../assets/icons/GAS_STATIONS/SHELL.png')}
                    color="#FFC107"
                  />
                  <FilterItem
                    label="Caltex"
                    value={localFilters.showCaltex}
                    onValueChange={(value) => handleFilterChange('showCaltex', value)}
                    iconSource={require('../assets/icons/GAS_STATIONS/CALTEX.png')}
                    color="#2196F3"
                  />
                </View>
                <FilterItem
                  label="Other Stations"
                  value={localFilters.showOtherGasStations}
                  onValueChange={(value) => handleFilterChange('showOtherGasStations', value)}
                  icon="local-gas-station"
                  color="#9E9E9E"
                />
              </FilterSection>

              {/* Map Elements */}
              <FilterSection title="Map Elements">
                <FilterItem
                  label="User Location"
                  value={localFilters.showUserLocation}
                  onValueChange={(value) => handleFilterChange('showUserLocation', value)}
                  icon="my-location"
                  color="#00ADB5"
                />
                <FilterItem
                  label="Destination"
                  value={localFilters.showDestination}
                  onValueChange={(value) => handleFilterChange('showDestination', value)}
                  icon="place"
                  color="#e74c3c"
                />
                <FilterItem
                  label="Clusters"
                  value={localFilters.showClusters}
                  onValueChange={(value) => handleFilterChange('showClusters', value)}
                  icon="group-work"
                  color="#9C27B0"
                />
                <FilterItem
                  label="Maintenance"
                  value={localFilters.showMaintenance}
                  onValueChange={(value) => handleFilterChange('showMaintenance', value)}
                  icon="build"
                  color="#FF9800"
                />
                <FilterItem
                  label="Images"
                  value={localFilters.showImages}
                  onValueChange={(value) => handleFilterChange('showImages', value)}
                  icon="image"
                  color="#607D8B"
                />
              </FilterSection>

              {/* Clustering */}
              <FilterSection title="Clustering">
                <FilterItem
                  label="Enable Clustering"
                  value={localFilters.enableClustering}
                  onValueChange={(value) => handleFilterChange('enableClustering', value)}
                  icon="group-work"
                  color="#4CAF50"
                />
              </FilterSection>

              {/* Map Style */}
              <FilterSection title="Map Style">
                <FilterItem
                  label="Standard"
                  value={localFilters.mapStyle === 'standard'}
                  onValueChange={(value) => {
                    if (value) {
                      handleFilterChange('mapStyle', 'standard');
                    }
                  }}
                  icon="map"
                  color="#2196F3"
                />
                <FilterItem
                  label="Satellite"
                  value={localFilters.mapStyle === 'satellite'}
                  onValueChange={(value) => {
                    if (value) {
                      handleFilterChange('mapStyle', 'satellite');
                    }
                  }}
                  icon="satellite"
                  color="#4CAF50"
                />
                <FilterItem
                  label="Hybrid"
                  value={localFilters.mapStyle === 'hybrid'}
                  onValueChange={(value) => {
                    if (value) {
                      handleFilterChange('mapStyle', 'hybrid');
                    }
                  }}
                  icon="layers"
                  color="#FF9800"
                />
              </FilterSection>
            </ScrollView>

            {/* Footer */}
            <View style={styles.footer}>
              <TouchableOpacity onPress={handleResetFilters} style={styles.resetButton}>
                <Text style={styles.resetButtonText}>Reset</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleApplyFilters} style={styles.applyButton}>
                <LinearGradient
                  colors={['#00ADB5', '#00858B']}
                  style={styles.applyGradient}
                >
                  <Text style={styles.applyButtonText}>Apply Filters</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    height: height * 0.8,
  },
  modalContent: {
    flex: 1,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    backgroundColor: '#fff',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
  },
  closeButton: {
    padding: 4,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 20,
  },
  filterSection: {
    marginVertical: 16,
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionIcon: {
    marginRight: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  filterItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    borderRadius: 8,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    minHeight: 48, // Ensure consistent height
  },
  filterItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  iconContainer: {
    width: 20,
    height: 20,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterIcon: {
    marginRight: 12,
  },
  filterIconImage: {
    width: 20,
    height: 20,
  },
  filterLabel: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
    flex: 1,
  },
  switchContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  rowContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    gap: 8,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    backgroundColor: '#fff',
  },
  resetButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginRight: 8,
    alignItems: 'center',
  },
  resetButtonText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
  },
  applyButton: {
    flex: 1,
    borderRadius: 8,
    overflow: 'hidden',
    marginLeft: 8,
  },
  applyGradient: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  applyButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
});

export default MapFilterModal;