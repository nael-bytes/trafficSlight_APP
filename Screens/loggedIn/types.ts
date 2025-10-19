export interface Motor {
  _id: string;
  name: string;
  nickname?: string;
  plateNumber?: string;
  fuelEfficiency: number;
  fuelType: 'Regular' | 'Diesel' | 'Premium';
  oilType: 'Mineral' | 'Semi-Synthetic' | 'Synthetic';
  age: number;
  totalDistance: number;
  currentFuelLevel: number;
  fuelTank: number;
  lastMaintenanceDate?: string;
  lastOilChange?: string;
  lastRegisteredDate?: string;
  lastTripDate?: string;
  lastRefuelDate?: string;
  motorcycleId?: string;
  maintenanceDue?: boolean;
  oilChangeDue?: boolean;
} 