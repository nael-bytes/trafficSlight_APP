// Centralized type definitions for the TrafficSlight app

// Location and coordinate types
export interface LocationCoords {
  latitude: number;
  longitude: number;
  address?: string;
}

// Route and navigation types
export interface RouteData {
  id: string;
  distance: number;
  duration: number;
  fuelEstimate: number;
  trafficRate: number;
  coordinates: LocationCoords[];
  instructions?: string[];
}

// Trip and tracking types
export interface TripSummary {
  userId: string;
  motorId: string;
  distance: number;         // in kilometers
  fuelUsed: number;         // in liters
  timeArrived: string;      // in minutes since trip start (or epoch)
  eta: string;              // estimated time in minutes
  destination: string;
  startAddress?: string;
}

// Traffic incident types
export interface TrafficIncident {
  id: string;
  location: LocationCoords;
  type: string;
  severity: string;
  description: string;
}

// Maintenance types
export interface MaintenanceAction {
  type: 'oil_change' | 'refuel' | 'tune_up';
  timestamp: number;
  location: LocationCoords;
  details: {
    cost: number;
    quantity?: number;
    notes?: string;
  };
}

// Fuel and efficiency types
export type FuelType = 'Regular' | 'Diesel' | 'Premium';
export type OilType = 'Mineral' | 'Semi-Synthetic' | 'Synthetic';

export interface FuelConsumptionStats {
  average: number;
  max: number;
  min: number;
}

export interface MotorAnalytics {
  totalDistance: number;
  tripsCompleted: number;
  maintenanceAlerts: string[];
}

// Motor/Motorcycle types
export interface Motor {
  _id: string;
  userId: string;
  motorcycleId: string;
  nickname: string;
  name: string;
  fuelEfficiency: number;
  fuelConsumption: number; // km/L - same as fuelEfficiency but more explicit
  fuelTank: number; // Total tank capacity in liters
  engineDisplacement: number;
  plateNumber: string;
  registrationDate: string; // ISO or empty string
  dateAcquired: string;     // ISO or empty string
  odometerAtAcquisition: number;
  currentOdometer: number;
  age: number;
  currentFuelLevel: number;
  fuelConsumptionStats: FuelConsumptionStats;
  analytics: MotorAnalytics;
  totalDrivableDistance: number;
  totalDrivableDistanceWithCurrentGas: number;
  isLowFuel: boolean;
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
}

// User types
export interface User {
  _id: string;
  email: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

// Screen mode types
export type ScreenMode = 'planning' | 'tracking' | 'summary';

// Map component props
export interface MapComponentProps {
  mapRef: React.RefObject<any>;
  region: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  };
  mapStyle: string;
  currentLocation: LocationCoords | null;
  destination?: LocationCoords | null; // Add destination prop
  userId?: string; // Add userId prop for voting
  reportMarkers: any[]; // More flexible to accept different report types
  gasStations: any[]; // More flexible to accept different gas station types
  showReports: boolean;
  showGasStations: boolean;
  routeCoordinates?: LocationCoords[];
  snappedRouteCoordinates?: LocationCoords[];
  isTracking?: boolean;
  onReportVoted?: () => void; // Callback to refresh reports data after vote
  onMapPress?: (event: any) => void; // Callback for map press events
  selectedMapLocation?: LocationCoords | null; // Selected location for map selection
}

// Gas station types
export interface GasStation {
  _id: string;
  name: string;
  brand: string;
  location: {
    coordinates: [number, number]; // [longitude, latitude]
  };
  address: {
    street: string;
    city: string;
    province: string;
  };
  fuelPrices: {
    gasoline?: number;
    premium?: number;
    diesel?: number;
  };
}

// Ride statistics
export interface RideStats {
  duration: number;        // seconds
  distance: number;        // km
  avgSpeed: number;        // km/h
  speed: number;           // km/h current
}

// Report types
export interface TrafficReport {
  _id: string;
  reportType: string;
  location: LocationCoords;
  description: string;
  userId: string;
  image?: string;
  timestamp: string;
  address?: string;
  verified?: {
    verifiedByAdmin: number;
  };
  votes?: Array<{
    userId: string;
    vote: number;
  }>;
}

// Form data types
export interface MaintenanceFormData {
  type: string;
  cost: string;
  quantity: string;
  notes: string;
}

export interface MaintenanceFormProps {
  visible: boolean;
  formData: MaintenanceFormData;
  onClose: () => void;
  onSave: () => void;
  onChange: (field: string, value: string) => void;
}

// API response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Navigation types
export interface NavigationProps {
  navigation: any;
  route?: {
    params?: any;
  };
}

// Component ref types
export type MapRef = React.RefObject<any>;
export type SearchRef = React.RefObject<any>;
