import React from 'react';
import { View, StyleSheet } from 'react-native';
import { MapComponent } from './MapComponent';
import type { LocationCoords, RouteData, TrafficIncident } from '../types';

interface MapContainerProps {
  mapRef: React.RefObject<any>;
  region: any;
  mapStyle: string;
  currentLocation: LocationCoords | null;
  destination: LocationCoords | null;
  userId: string | undefined;
  reportMarkers: TrafficIncident[];
  gasStations: any[];
  showReports: boolean;
  showGasStations: boolean;
  onMapPress?: (event: any) => void;
  selectedMapLocation?: LocationCoords | null;
  routeCoordinates?: LocationCoords[];
  snappedRouteCoordinates: LocationCoords[];
  isTracking: boolean;
  onReportVoted: () => void;
}

export const MapContainer: React.FC<MapContainerProps> = ({
  mapRef,
  region,
  mapStyle,
  currentLocation,
  destination,
  userId,
  reportMarkers,
  gasStations,
  showReports,
  showGasStations,
  onMapPress,
  selectedMapLocation,
  routeCoordinates,
  snappedRouteCoordinates,
  isTracking,
  onReportVoted,
}) => {
  return (
    <View style={styles.mapContainer}>
      <MapComponent
        mapRef={mapRef}
        region={region}
        mapStyle={mapStyle === "dark" ? "dark" : "standard"}
        currentLocation={currentLocation}
        destination={destination}
        userId={userId}
        reportMarkers={isTracking ? reportMarkers : []}
        gasStations={isTracking ? gasStations : []}
        showReports={isTracking ? showReports : false}
        showGasStations={isTracking ? showGasStations : false}
        onMapPress={onMapPress}
        selectedMapLocation={selectedMapLocation}
        routeCoordinates={routeCoordinates}
        snappedRouteCoordinates={snappedRouteCoordinates}
        isTracking={isTracking}
        onReportVoted={onReportVoted}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
});
