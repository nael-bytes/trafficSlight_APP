// Improved map component

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { voteOnReport } from '../utils/api';
import { validateCoordinates } from '../utils/location';
import type { MapComponentProps, TrafficReport, GasStation, LocationCoords } from '../types';

// Icon mapping function
const getIcon = (type: string) => {
  const iconMap: Record<string, any> = {
    // Traffic incidents
    'Accident': require('../assets/icons/ROAD INCIDENTS ICON/Road_Accident.png'),
    'Traffic Jam': require('../assets/icons/ROAD INCIDENTS ICON/Traffic_Jam.png'),
    'Hazard': require('../assets/icons/ROAD INCIDENTS ICON/Hazard.png'),
    'Road Closure': require('../assets/icons/ROAD INCIDENTS ICON/Road_Closure.png'),
    
    // Gas stations
    'Caltex': require('../assets/icons/GAS_STATIONS/CALTEX.png'),
    'Cleanfuel': require('../assets/icons/GAS_STATIONS/CLEANFUEL.png'),
    'Flying V': require('../assets/icons/GAS_STATIONS/FLYINGV.png'),
    'Jetti': require('../assets/icons/GAS_STATIONS/JETTI.png'),
    'Petro Gazz': require('../assets/icons/GAS_STATIONS/PETROGAZZ.png'),
    'Petron': require('../assets/icons/GAS_STATIONS/PETRON.png'),
    'Phoenix': require('../assets/icons/GAS_STATIONS/PHOENIX.png'),
    'Rephil': require('../assets/icons/GAS_STATIONS/REPHIL.png'),
    'Seaoil': require('../assets/icons/GAS_STATIONS/SEAOIL.png'),
    'Shell': require('../assets/icons/GAS_STATIONS/SHELL.png'),
    'Total': require('../assets/icons/GAS_STATIONS/TOTAL.png'),
    'Unioil': require('../assets/icons/GAS_STATIONS/UNIOIL.png'),
  };
  
  return iconMap[type] || require('../assets/icons/default.png');
};

interface MapComponentState {
  selectedReport: TrafficReport | null;
  selectedGasStation: GasStation | null;
}

export const MapComponent: React.FC<MapComponentProps> = ({
  mapRef,
  region,
  mapStyle,
  currentLocation,
  reportMarkers,
  gasStations,
  showReports,
  showGasStations,
  routeCoordinates,
  isTracking,
}) => {
  const [state, setState] = useState<MapComponentState>({
    selectedReport: null,
    selectedGasStation: null,
  });

  const handleReportPress = useCallback((report: TrafficReport) => {
    setState(prev => ({
      ...prev,
      selectedReport: report,
      selectedGasStation: null,
    }));
  }, []);

  const handleGasStationPress = useCallback((station: GasStation) => {
    setState(prev => ({
      ...prev,
      selectedGasStation: station,
      selectedReport: null,
    }));
  }, []);

  const handleVote = useCallback(async (reportId: string, userId: string, vote: number) => {
    try {
      const response = await voteOnReport(reportId, userId, vote);
      setState(prev => ({
        ...prev,
        selectedReport: prev.selectedReport ? {
          ...prev.selectedReport,
          ...response
        } : null,
      }));
    } catch (error) {
      console.error('Vote failed:', error);
    }
  }, []);

  const closeSelection = useCallback(() => {
    setState({
      selectedReport: null,
      selectedGasStation: null,
    });
  }, []);

  const validGasStations = gasStations.filter(station => {
    const coords = station?.location?.coordinates;
    if (!coords || !Array.isArray(coords) || coords.length < 2) return false;
    return validateCoordinates({
      latitude: Number(coords[1]),
      longitude: Number(coords[0]),
    });
  });

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        region={region}
        customMapStyle={[]}
        showsTraffic
        showsMyLocationButton={false}
        followsUserLocation={isTracking}
        showsCompass={true}
        provider={PROVIDER_GOOGLE}
      >
        {/* Current location marker */}
        {currentLocation && validateCoordinates(currentLocation) && (
          <Marker coordinate={currentLocation} title="Your Location">
            <Image 
              source={require('../assets/icons/User-onTrack-MARKER.png')} 
              style={styles.userMarker} 
            />
          </Marker>
        )}

        {/* Traffic report markers */}
        {showReports && reportMarkers.map((report, index) => {
          if (!report?.location || !validateCoordinates(report.location)) return null;
          
          return (
            <Marker
              key={`report-${report._id || index}`}
              coordinate={report.location}
              onPress={() => handleReportPress(report)}
            >
              <Image source={getIcon(report.reportType)} style={styles.iconMarker} />
            </Marker>
          );
        })}

        {/* Gas station markers */}
        {showGasStations && validGasStations.map((station, index) => {
          const coords = station.location.coordinates;
          const coordinate = {
            latitude: Number(coords[1]),
            longitude: Number(coords[0]),
          };

          return (
            <Marker
              key={station._id || `gas-${index}`}
              coordinate={coordinate}
              onPress={() => handleGasStationPress(station)}
            >
              <Image source={getIcon(station.brand)} style={styles.iconMarker} />
            </Marker>
          );
        })}

        {/* Route polyline */}
        {isTracking && routeCoordinates && routeCoordinates.length > 1 && (
          <Polyline
            coordinates={routeCoordinates}
            strokeColor="#FF0000"
            strokeWidth={4}
            lineCap="round"
            lineJoin="round"
          />
        )}
      </MapView>

      {/* Selected report card */}
      {state.selectedReport && (
        <ReportCard 
          report={state.selectedReport} 
          onClose={closeSelection}
          onVote={handleVote}
        />
      )}

      {/* Selected gas station card */}
      {state.selectedGasStation && (
        <GasStationCard 
          station={state.selectedGasStation} 
          onClose={closeSelection}
        />
      )}
    </View>
  );
};

// Report card component
interface ReportCardProps {
  report: TrafficReport;
  onClose: () => void;
  onVote: (reportId: string, userId: string, vote: number) => void;
}

const ReportCard: React.FC<ReportCardProps> = ({ report, onClose, onVote }) => {
  const totalVotes = report.votes?.reduce((sum, vote) => sum + vote.vote, 0) || 0;

  return (
    <View style={styles.infoBox}>
      <View style={styles.reportHeader}>
        <Text style={styles.reportTitle}>{report.reportType}</Text>
        {report.verified?.verifiedByAdmin > 0 && (
          <MaterialIcons name="verified" size={24} color="#2196F3" />
        )}
      </View>

      <Text style={styles.reportDescription}>{report.description}</Text>
      {report.address && <Text style={styles.reportAddress}>{report.address}</Text>}
      <Text style={styles.reportTimestamp}>
        {new Date(report.timestamp).toLocaleString()}
      </Text>

      <View style={styles.voteSection}>
        <TouchableOpacity 
          style={styles.voteButton}
          onPress={() => onVote(report._id, 'current-user-id', 1)}
        >
          <Text style={styles.voteButtonText}>👍</Text>
        </TouchableOpacity>

        <Text style={styles.voteCount}>{totalVotes}</Text>

        <TouchableOpacity 
          style={styles.voteButton}
          onPress={() => onVote(report._id, 'current-user-id', -1)}
        >
          <Text style={styles.voteButtonText}>👎</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.closeButton} onPress={onClose}>
        <Text style={styles.closeButtonText}>Close</Text>
      </TouchableOpacity>
    </View>
  );
};

// Gas station card component
interface GasStationCardProps {
  station: GasStation;
  onClose: () => void;
}

const GasStationCard: React.FC<GasStationCardProps> = ({ station, onClose }) => {
  return (
    <View style={styles.infoBox}>
      <View style={styles.gasStationHeader}>
        <View style={styles.gasStationInfo}>
          <Text style={styles.gasStationName}>{station.name}</Text>
          <Text style={styles.gasStationAddress}>
            {station.address?.street || 'Address not available'}
          </Text>
        </View>
        <Image source={getIcon(station.brand)} style={styles.gasStationLogo} />
      </View>

      <View style={styles.fuelPricesContainer}>
        <View style={[styles.fuelPriceBox, { backgroundColor: '#4CAF50' }]}>
          <Text style={styles.fuelPriceLabel}>UNLEADED</Text>
          <Text style={styles.fuelPriceValue}>
            ₱{station.fuelPrices?.gasoline || 'N/A'}
          </Text>
        </View>

        <View style={[styles.fuelPriceBox, { backgroundColor: '#FFC107' }]}>
          <Text style={styles.fuelPriceLabel}>PREMIUM</Text>
          <Text style={styles.fuelPriceValue}>
            ₱{station.fuelPrices?.premium || 'N/A'}
          </Text>
        </View>
      </View>

      <TouchableOpacity style={styles.closeButton} onPress={onClose}>
        <Text style={styles.closeButtonText}>Close</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  userMarker: {
    width: 40,
    height: 40,
    resizeMode: 'contain',
  },
  iconMarker: {
    width: 35,
    height: 35,
    resizeMode: 'contain',
  },
  infoBox: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  reportTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  reportDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  reportAddress: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  reportTimestamp: {
    fontSize: 12,
    color: '#999',
    marginBottom: 12,
  },
  voteSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  voteButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    marginHorizontal: 8,
  },
  voteButtonText: {
    fontSize: 16,
  },
  voteCount: {
    fontSize: 18,
    fontWeight: 'bold',
    marginHorizontal: 12,
    color: '#333',
  },
  gasStationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  gasStationInfo: {
    flex: 1,
  },
  gasStationName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  gasStationAddress: {
    fontSize: 14,
    color: '#666',
  },
  gasStationLogo: {
    width: 50,
    height: 50,
    resizeMode: 'contain',
  },
  fuelPricesContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  fuelPriceBox: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  fuelPriceLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  fuelPriceValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  closeButton: {
    backgroundColor: '#FF5722',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
