import { useCallback } from 'react';
import { Alert } from 'react-native';
import { GOOGLE_MAPS_API_KEY } from '@env';
import polyline from '@mapbox/polyline';

export interface LocationCoords {
  latitude: number;
  longitude: number;
  address?: string;
}

export interface RouteData {
  id: string;
  distance: number;
  duration: number;
  fuelEstimate: number;
  trafficRate: number;
  coordinates: LocationCoords[];
  instructions?: string[];
}

export interface Motor {
  _id: string;
  name: string;
  fuelEfficiency: number;
  fuelType: 'Regular' | 'Diesel' | 'Premium';
  oilType: 'Mineral' | 'Semi-Synthetic' | 'Synthetic';
  age: number;
  totalDistance: number;
  currentFuelLevel: number;
  fuelTank: number;
}

// Calculate fuel range based on distance and efficiency
export const calculateFuelRange = (distance: number, fuelEfficiency: number) => {
  const base = distance / fuelEfficiency;
  return {
    min: base * 0.9,
    max: base * 1.1,
    avg: base,
  };
};

// Get traffic rate from route leg
export const getTrafficRateFromLeg = (leg: any): number => {
  if (!leg || !leg.duration_in_traffic || !leg.duration) return 1;
  return leg.duration_in_traffic.value / leg.duration.value;
};

// Fetch routes from Google Directions API
export const fetchRoutesFromAPI = async (
  origin: LocationCoords,
  destination: LocationCoords,
  selectedMotor: Motor | null
): Promise<{ mainRoute: RouteData; alternatives: RouteData[] }> => {
  if (!selectedMotor) {
    throw new Error('No motor selected');
  }

  const originStr = `${origin.latitude},${origin.longitude}`;
  const destStr = `${destination.latitude},${destination.longitude}`;
  
  const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${originStr}&destination=${destStr}&key=${GOOGLE_MAPS_API_KEY}&alternatives=true&traffic_model=best_guess&departure_time=now`;

  const response = await fetch(url);
  const data = await response.json();

  if (data.status !== 'OK' || !data.routes || data.routes.length === 0) {
    throw new Error('No routes found');
  }

  const routes = data.routes.map((route: any, index: number) => {
    const leg = route.legs[0];
    const distance = leg.distance.value / 1000; // Convert to km
    const duration = leg.duration.value; // in seconds
    const trafficRate = getTrafficRateFromLeg(leg);
    
    // Decode polyline to get coordinates
    const coordinates = polyline.decode(route.overview_polyline.points).map((coord: [number, number]) => ({
      latitude: coord[0],
      longitude: coord[1],
    }));

    // Calculate fuel estimate
    const fuelRange = calculateFuelRange(distance, selectedMotor.fuelEfficiency);
    const fuelEstimate = fuelRange.avg;

    return {
      id: `route_${index}`,
      distance,
      duration,
      fuelEstimate,
      trafficRate,
      coordinates,
      instructions: leg.steps?.map((step: any) => step.html_instructions?.replace(/<[^>]*>/g, '')) || [],
    };
  });

  const mainRoute = routes[0];
  const alternatives = routes.slice(1);

  return { mainRoute, alternatives };
};

// Route handlers hook
export const useRouteHandlers = (
  currentLocation: LocationCoords | null,
  destination: LocationCoords | null,
  selectedMotor: Motor | null,
  setTripSummary: (summary: any) => void,
  setAlternativeRoutes: (routes: RouteData[]) => void,
  setSelectedRouteId: (id: string | null) => void,
  setSelectedRoute: (route: RouteData | null) => void,
  flowStateManager: (state: string, options?: any) => void,
  fetchTrafficReports: () => Promise<void>
) => {
  
  const fetchRoutes = useCallback(async () => {
    if (!currentLocation || !destination || !selectedMotor) {
      console.log('❌ Missing required data for route fetching');
      return;
    }

    try {
      console.log('🛣️ Fetching routes...');
      const { mainRoute, alternatives } = await fetchRoutesFromAPI(
        currentLocation,
        destination,
        selectedMotor
      );

      // Create trip summary
      const tripSummary = {
        id: mainRoute.id,
        distance: mainRoute.distance,
        duration: mainRoute.duration,
        fuelEstimate: mainRoute.fuelEstimate,
        trafficRate: mainRoute.trafficRate,
        coordinates: mainRoute.coordinates,
        instructions: mainRoute.instructions,
      };

      setTripSummary(tripSummary);
      setAlternativeRoutes(alternatives);
      setSelectedRouteId(mainRoute.id);
      setSelectedRoute(mainRoute);
      
      // Update flow state to routes_found
      flowStateManager('routes_found', { openModal: 'showBottomSheet' });
      
      // Fetch traffic reports in background
      await fetchTrafficReports();

    } catch (error: any) {
      console.error("❌ Route Fetch Error:", error.message);
      Alert.alert("Error", "Failed to fetch routes. Please try again.");

      // Reset state on error
      flowStateManager('destination_selected', { 
        resetData: false,
        closeModals: true 
      });
      setTripSummary(null);
      setAlternativeRoutes([]);
      setSelectedRouteId(null);
      setSelectedRoute(null);
    }
  }, [currentLocation, destination, selectedMotor, fetchTrafficReports, setTripSummary, setAlternativeRoutes, setSelectedRouteId, setSelectedRoute, flowStateManager]);

  return {
    fetchRoutes,
  };
};
