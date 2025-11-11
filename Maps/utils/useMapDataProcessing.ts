/**
 * useMapDataProcessing Hook
 * 
 * Extracts all data processing logic for:
 * - Effective reports (API > Local > Global cache)
 * - Effective gas stations (API > Local > Global cache)
 * - Effective motors (API > Motor Management > Local > Global cache)
 * - Map markers and polylines preparation
 * 
 * @module useMapDataProcessing
 */

import { useMemo, useRef } from 'react';
import type { Motor, LocationCoords, RouteData, TrafficIncident } from '../../types';
import {
  getEffectiveReports,
  getEffectiveGasStations,
  getEffectiveMotors,
  filterReports,
  filterGasStations,
  prepareMapMarkersAndPolylines,
  type EffectiveDataState,
} from '../../services/routeSelectionDataProcessor';

interface UseMapDataProcessingParams {
  appReports?: TrafficReport[] | TrafficIncident[];
  localReports: TrafficReport[] | TrafficIncident[];
  cachedReports?: TrafficReport[] | TrafficIncident[];
  appGasStations?: any[];
  localGasStations: any[];
  cachedGasStations?: any[];
  appMotors?: Motor[];
  motorList: Motor[];
  localMotors: Motor[];
  cachedMotors?: Motor[];
  mapState: {
    currentLocation: LocationCoords | null;
    destination: LocationCoords | null;
    region?: { latitudeDelta?: number } | null;
  };
  selectedRoute?: RouteData | null;
  alternativeRoutes?: RouteData[];
  showReports: boolean;
  showGasStations: boolean;
}

interface UseMapDataProcessingReturn {
  effectiveReports: TrafficReport[] | TrafficIncident[];
  filteredReports: TrafficReport[] | TrafficIncident[];
  effectiveGasStations: any[];
  filteredGasStations: any[];
  effectiveMotors: Motor[];
  mapMarkersAndPolylines: {
    markers: any[];
    polylines: any[];
  };
}

/**
 * Custom hook for processing map data
 * 
 * Handles:
 * - Effective data computation (priority: API > Local > Global cache)
 * - Data filtering (removes invalid/archived items)
 * - Map markers and polylines preparation
 */
export const useMapDataProcessing = ({
  appReports,
  localReports,
  cachedReports,
  appGasStations,
  localGasStations,
  cachedGasStations,
  appMotors,
  motorList,
  localMotors,
  cachedMotors,
  mapState,
  selectedRoute,
  alternativeRoutes,
  showReports,
  showGasStations,
}: UseMapDataProcessingParams): UseMapDataProcessingReturn => {
  const lastEffectiveData = useRef<EffectiveDataState>({ reports: 0, gasStations: 0, motors: 0 });

  // Get effective reports with priority: API > Local > Global cache
  const effectiveReports = useMemo(() => {
    if (__DEV__) {
      console.log('[useMapDataProcessing] 📊 Computing effectiveReports', {
        appReportsCount: appReports?.length || 0,
        localReportsCount: localReports?.length || 0,
        cachedReportsCount: cachedReports?.length || 0,
        timestamp: new Date().toISOString(),
      });
    }

    const { data, hasChanged } = getEffectiveReports(
      appReports as any,
      localReports as any,
      cachedReports as any,
      lastEffectiveData.current
    );

    if (hasChanged) {
      lastEffectiveData.current = {
        ...lastEffectiveData.current,
        reports: data.length
      };

      if (__DEV__) {
        console.log('[useMapDataProcessing] ✅ Effective reports updated', {
          count: data.length,
          timestamp: new Date().toISOString(),
        });
      }
    }

    return data as TrafficReport[] | TrafficIncident[];
  }, [
    appReports?.length,
    localReports?.length,
    cachedReports?.length,
    appReports,
    localReports,
    cachedReports
  ]);

  // Filter reports to remove invalid/archived ones
  const filteredReports = useMemo(() => {
    return filterReports(effectiveReports);
  }, [effectiveReports]);

  // Get effective gas stations with priority: API > Local > Global cache
  const effectiveGasStations = useMemo(() => {
    if (__DEV__) {
      console.log('[useMapDataProcessing] ⛽ Computing effectiveGasStations', {
        appGasStationsCount: appGasStations?.length || 0,
        localGasStationsCount: localGasStations?.length || 0,
        cachedGasStationsCount: cachedGasStations?.length || 0,
        timestamp: new Date().toISOString(),
      });
    }

    const { data, hasChanged } = getEffectiveGasStations(
      appGasStations,
      localGasStations,
      cachedGasStations,
      lastEffectiveData.current
    );

    if (hasChanged) {
      lastEffectiveData.current = {
        ...lastEffectiveData.current,
        gasStations: data.length
      };

      if (__DEV__) {
        console.log('[useMapDataProcessing] ✅ Effective gas stations updated', {
          count: data.length,
          timestamp: new Date().toISOString(),
        });
      }
    }

    return data;
  }, [
    appGasStations?.length,
    localGasStations?.length,
    cachedGasStations?.length,
    appGasStations,
    localGasStations,
    cachedGasStations
  ]);

  // Filter gas stations to remove invalid ones
  const filteredGasStations = useMemo(() => {
    return filterGasStations(effectiveGasStations);
  }, [effectiveGasStations]);

  // Get effective motors with priority: API > Motor Management > Local > Global cache
  const effectiveMotors = useMemo(() => {
    if (__DEV__) {
      console.log('[useMapDataProcessing] 🏍️ Computing effectiveMotors', {
        appMotorsCount: appMotors?.length || 0,
        motorListCount: motorList?.length || 0,
        localMotorsCount: localMotors?.length || 0,
        cachedMotorsCount: cachedMotors?.length || 0,
        timestamp: new Date().toISOString(),
      });
    }

    const { data, hasChanged } = getEffectiveMotors(
      appMotors,
      motorList,
      localMotors,
      cachedMotors,
      lastEffectiveData.current
    );

    if (hasChanged) {
      lastEffectiveData.current = {
        ...lastEffectiveData.current,
        motors: data.length
      };

      if (__DEV__) {
        console.log('[useMapDataProcessing] ✅ Effective motors updated', {
          count: data.length,
          motorIds: data.map(m => m._id),
          timestamp: new Date().toISOString(),
        });
      }
    }

    return data;
  }, [
    appMotors?.length,
    motorList?.length,
    localMotors?.length,
    cachedMotors?.length,
    appMotors,
    motorList,
    localMotors,
    cachedMotors
  ]);

  // Prepare map markers and polylines using centralized processor
  const mapMarkersAndPolylines = useMemo(() => {
    if (__DEV__) {
      console.log('[useMapDataProcessing] 🗺️ Computing mapMarkersAndPolylines', {
        reportsCount: filteredReports.length,
        gasStationsCount: filteredGasStations.length,
        hasRoute: !!selectedRoute,
        alternativeRoutesCount: alternativeRoutes?.length || 0,
        showReports,
        showGasStations,
        timestamp: new Date().toISOString(),
      });
    }

    const result = prepareMapMarkersAndPolylines(
      mapState.currentLocation,
      mapState.destination,
      selectedRoute,
      alternativeRoutes,
      showReports,
      filteredReports,
      showGasStations,
      filteredGasStations,
      mapState.region?.latitudeDelta
    );

    if (__DEV__) {
      console.log('[useMapDataProcessing] ✅ Map markers and polylines computed', {
        markersCount: result.markers?.length || 0,
        polylinesCount: result.polylines?.length || 0,
        timestamp: new Date().toISOString(),
      });
    }

    return result;
  }, [
    mapState.currentLocation?.latitude,
    mapState.currentLocation?.longitude,
    mapState.destination?.latitude,
    mapState.destination?.longitude,
    selectedRoute?.id,
    alternativeRoutes?.length,
    showReports,
    showGasStations,
    filteredReports.length,
    filteredGasStations.length,
    mapState.region?.latitudeDelta
  ]);

  return {
    effectiveReports,
    filteredReports,
    effectiveGasStations,
    filteredGasStations,
    effectiveMotors,
    mapMarkersAndPolylines,
  };
};

