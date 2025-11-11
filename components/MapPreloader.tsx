// Hidden MapView component for preloading map tiles
// This component is rendered off-screen to cache map tiles

import React, { useEffect, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import MapView, { PROVIDER_GOOGLE } from 'react-native-maps';
import { getPreloadRegion } from '../utils/mapPreloader';

interface MapPreloaderProps {
  onPreloadComplete?: () => void;
}

/**
 * Hidden MapView component that preloads map tiles
 * This runs in the background when app starts to cache map tiles
 */
const MapPreloader: React.FC<MapPreloaderProps> = ({ onPreloadComplete }) => {
  const mapRef = useRef<MapView>(null);
  const [region, setRegion] = React.useState<any>(null);
  const [preloadComplete, setPreloadComplete] = React.useState(false);

  useEffect(() => {
    const loadPreloadRegion = async () => {
      try {
        const preloadRegion = await getPreloadRegion();
        if (preloadRegion) {
          setRegion(preloadRegion);
          
          // Wait a bit for map to load, then mark as complete
          setTimeout(() => {
            setPreloadComplete(true);
            if (onPreloadComplete) {
              onPreloadComplete();
            }
            if (__DEV__) {
              console.log('[MapPreloader] Map tiles preloaded successfully');
            }
          }, 3000); // Give map 3 seconds to load tiles
        }
      } catch (error) {
        console.warn('[MapPreloader] Failed to load preload region:', error);
      }
    };

    loadPreloadRegion();
  }, [onPreloadComplete]);

  // Don't render if no region or already complete
  if (!region || preloadComplete) {
    return null;
  }

  // Render hidden map (off-screen) to cache tiles
  return (
    <View style={styles.hiddenContainer}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.hiddenMap}
        region={region}
        liteMode={false}
        cacheEnabled={true}
        // Enable all map features to preload tiles
        showsTraffic={false}
        showsBuildings={false}
        showsIndoors={false}
        showsPointsOfInterest={false}
        toolbarEnabled={false}
        onMapReady={() => {
          if (__DEV__) {
            console.log('[MapPreloader] Map ready, tiles are being cached');
          }
        }}
        onRegionChangeComplete={() => {
          // Tiles are being loaded
          if (!preloadComplete) {
            setPreloadComplete(true);
            if (onPreloadComplete) {
              onPreloadComplete();
            }
            if (__DEV__) {
              console.log('[MapPreloader] Map region loaded, tiles cached');
            }
          }
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  hiddenContainer: {
    position: 'absolute',
    top: -10000, // Off-screen
    left: -10000,
    width: 1,
    height: 1,
    opacity: 0, // Invisible
  },
  hiddenMap: {
    width: 1,
    height: 1,
  },
});

export default MapPreloader;
