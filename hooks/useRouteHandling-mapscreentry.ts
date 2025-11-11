import { useState, useCallback, useRef } from 'react';
import type { RouteData, LocationCoords } from '../../types';
import { processDirections as processDirectionsService, processTrafficAnalysis as processTrafficAnalysisService } from '../services/routeService';

export const useRouteHandling = () => {
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<RouteData | null>(null);
  const [alternativeRoutes, setAlternativeRoutes] = useState<RouteData[]>([]);
  const [tripSummary, setTripSummary] = useState<RouteData | null>(null);
  const [pathCoords, setPathCoords] = useState<LocationCoords[]>([]);
  const [finalPathCoords, setFinalPathCoords] = useState<LocationCoords[]>([]);
  const [distanceTraveled, setDistanceTraveled] = useState(0);
  const [x, setXValue] = useState(0);

  // Route selection
  // CRITICAL: When selecting a route, add the previous selectedRoute back to alternatives
  // This ensures all routes remain visible in the modal
  const handleRouteSelect = useCallback((id: string) => {
    setSelectedRouteId(id);
    
    // Find the route to select (could be in alternatives or currently selected)
    const routeToSelect = alternativeRoutes.find(r => r.id === id) || tripSummary;
    
    if (routeToSelect) {
      // If selecting a route from alternatives, add the current selectedRoute back to alternatives
      if (selectedRoute && selectedRoute.id !== id) {
        // Check if selectedRoute is already in alternatives (shouldn't be, but check anyway)
        const isAlreadyInAlternatives = alternativeRoutes.some(r => r.id === selectedRoute.id);
        if (!isAlreadyInAlternatives) {
          // Add previous selectedRoute back to alternatives
          setAlternativeRoutes(prev => [...prev, selectedRoute]);
        }
      }
      
      // Remove the selected route from alternatives (if it's there)
      setAlternativeRoutes(prev => prev.filter(r => r.id !== id));
      
      // Set the new selected route
      setSelectedRoute(routeToSelect);
    }
  }, [alternativeRoutes, tripSummary, selectedRoute]);

  // Route fetching using backend service for optimized performance
  const fetchRoutes = useCallback(async (
    currentLocation: LocationCoords | null,
    destination: LocationCoords | null,
    selectedMotor: any,
    setTripSummary: (route: RouteData) => void,
    setAlternativeRoutes: (routes: RouteData[]) => void,
    setSelectedRouteId: (id: string) => void,
    setSelectedRoute: (route: RouteData) => void,
    flowStateManager: (state: string, options?: any) => void,
    fetchTrafficReports: () => Promise<void>
  ) => {
    if (!currentLocation || !destination || !selectedMotor) {
      console.log("Missing required data for route fetching");
      return;
    }

    try {
      // Use backend service for route processing
      const response = await processDirectionsService({
        origin: currentLocation,
        destination: destination,
        motorData: {
          fuelEfficiency: selectedMotor.fuelEfficiency || selectedMotor.fuelConsumption,
          fuelTank: selectedMotor.fuelTank
        },
        options: {
          alternatives: true,
          trafficModel: 'best_guess',
          avoid: []
        }
      });

      if (response.routes.length === 0) {
        throw new Error("No routes found");
      }

      // Process routes from backend response
      const allRoutes = response.routes.map((route: any, i: number): RouteData => ({
        id: route.id || `route-${i}`,
        distance: route.distance,
        duration: route.duration,
        fuelEstimate: route.fuelEstimate,
        trafficRate: route.trafficRate,
        coordinates: route.coordinates,
        instructions: route.instructions || [],
      }));

      const mainRoute = allRoutes[0];
      const alternatives = allRoutes.slice(1);

      setTripSummary(mainRoute);
      setAlternativeRoutes(alternatives);
      setSelectedRouteId(mainRoute.id);
      setSelectedRoute(mainRoute);
      
      flowStateManager('routes_found', { openModal: 'showBottomSheet' });
      await fetchTrafficReports();

    } catch (error) {
      console.error("Route fetching failed:", error);
      // Fallback to original implementation if backend fails
      try {
        const url = buildDirectionsUrl({
          origin: currentLocation,
          destination: destination,
        });

        const res = await fetch(url);
        const data = await res.json();

        if (data.status !== "OK") {
          throw new Error(data.error_message || "Failed to fetch routes");
        }

        const allRoutes = data.routes.map((r: any, i: number): RouteData => {
          const leg = r.legs[0];
          const fuel = selectedMotor ? (leg.distance.value / 1000 / selectedMotor.fuelEfficiency) : 0;
          const trafficRate = getTrafficRateFromLeg(leg);

          return {
            id: `route-${i}`,
            distance: leg.distance.value,
            duration: leg.duration.value,
            fuelEstimate: fuel,
            trafficRate,
            coordinates: polyline.decode(r.overview_polyline.points).map(([lat, lng]) => ({
              latitude: lat,
              longitude: lng,
            })),
            instructions: leg.steps.map((step: any) =>
              step.html_instructions.replace(/<[^>]*>/g, "")
            ),
          };
        });

        if (allRoutes.length === 0) {
          throw new Error("No routes found");
        }

        const mainRoute = allRoutes[0];
        const alternatives = allRoutes.slice(1);

        setTripSummary(mainRoute);
        setAlternativeRoutes(alternatives);
        setSelectedRouteId(mainRoute.id);
        setSelectedRoute(mainRoute);
        
        flowStateManager('routes_found', { openModal: 'showBottomSheet' });
        await fetchTrafficReports();
      } catch (fallbackError) {
        console.error("Fallback route fetching also failed:", fallbackError);
      }
    }
  }, []);

  return {
    // State
    selectedRouteId,
    selectedRoute,
    alternativeRoutes,
    tripSummary,
    pathCoords,
    finalPathCoords,
    distanceTraveled,
    x,
    
    // Setters
    setSelectedRouteId,
    setSelectedRoute,
    setAlternativeRoutes,
    setTripSummary,
    setPathCoords,
    setFinalPathCoords,
    setDistanceTraveled,
    setXValue,
    
    // Actions
    handleRouteSelect,
    fetchRoutes,
  };
};

// Helper functions
const buildDirectionsUrl = ({ origin, destination }: { origin: LocationCoords; destination: LocationCoords }) => {
  const baseUrl = "https://maps.googleapis.com/maps/api/directions/json";
  const params = new URLSearchParams({
    origin: `${origin.latitude},${origin.longitude}`,
    destination: `${destination.latitude},${destination.longitude}`,
    key: process.env.GOOGLE_MAPS_API_KEY || '',
    alternatives: "true",
    traffic_model: "best_guess",
    departure_time: "now",
  });
  return `${baseUrl}?${params.toString()}`;
};

const getTrafficRateFromLeg = (leg: any): number => {
  if (!leg || !leg.duration || !leg.duration_in_traffic) return 1;
  
  const dur = leg.duration.value;
  const durTraffic = leg.duration_in_traffic.value;
  
  if (!dur || dur <= 0) return 1;
  
  const ratio = durTraffic / dur;
  
  if (ratio <= 1.2) return 1;
  else if (ratio <= 1.5) return 2;
  else if (ratio <= 2.0) return 3;
  else if (ratio <= 2.5) return 4;
  else return 5;
};
