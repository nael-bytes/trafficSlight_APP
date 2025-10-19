/**
 * Fuel calculation utilities that mirror the backend virtual properties
 * This reduces API calls by calculating locally instead of fetching virtuals
 */

export interface MotorData {
  fuelConsumption: number; // km/L
  fuelTank: number; // Total tank capacity in liters
  currentFuelLevel: number; // Percentage (0-100)
}

/**
 * Calculate total drivable distance with full tank
 * Equivalent to: fuelConsumption * fuelTank
 */
export const calculateTotalDrivableDistance = (motor: MotorData): number => {
  return motor.fuelConsumption * motor.fuelTank;
};

/**
 * Calculate total drivable distance with current fuel level
 * Equivalent to: fuelConsumption * fuelTank * (currentFuelLevel / 100)
 */
export const calculateTotalDrivableDistanceWithCurrentGas = (motor: MotorData): number => {
  return motor.fuelConsumption * motor.fuelTank * (motor.currentFuelLevel / 100);
};

/**
 * Calculate new fuel level after traveling a distance
 * @param motor - Current motor data
 * @param distanceTraveled - Distance traveled in km
 * @returns New fuel level percentage
 */
export const calculateNewFuelLevel = (motor: MotorData, distanceTraveled: number): number => {
  // Reduced logging to prevent console spam during tracking
  const totalDrivableDistance = calculateTotalDrivableDistance(motor);
  const totalDrivableDistanceWithCurrentGas = calculateTotalDrivableDistanceWithCurrentGas(motor);
  
  if (totalDrivableDistance <= 0) {
    console.warn('[FuelCalculation] ❌ Invalid total drivable distance:', totalDrivableDistance);
    return motor.currentFuelLevel;
  }
  
  // Calculate new drivable distance after subtracting distance traveled
  const newTotalDrivableDistanceWithCurrentGas = Math.max(0, totalDrivableDistanceWithCurrentGas - distanceTraveled);
  
  // Convert back to fuel level percentage
  const newFuelLevel = (newTotalDrivableDistanceWithCurrentGas / totalDrivableDistance) * 100;
  
  const finalFuelLevel = Math.max(0, Math.min(100, newFuelLevel)); // Clamp between 0-100%
  
  // Only log significant fuel changes to reduce console spam
  const fuelConsumed = motor.currentFuelLevel - finalFuelLevel;
  if (Math.abs(fuelConsumed) > 0.5) { // Only log if fuel changed by more than 0.5%
    console.log('[FuelCalculation] Fuel update:', {
      distanceTraveled: distanceTraveled.toFixed(3),
      fuelConsumed: fuelConsumed.toFixed(2),
      newFuelLevel: finalFuelLevel.toFixed(1)
    });
  }
  
  return finalFuelLevel;
};

/**
 * Calculate fuel level after refueling
 * @param motor - Current motor data
 * @param refuelAmount - Amount of fuel added in liters
 * @returns New fuel level percentage
 */
export const calculateFuelLevelAfterRefuel = (motor: MotorData, refuelAmount: number): number => {
  const currentFuelInTank = (motor.currentFuelLevel / 100) * motor.fuelTank;
  const newFuelInTank = Math.min(motor.fuelTank, currentFuelInTank + refuelAmount);
  const newFuelLevel = (newFuelInTank / motor.fuelTank) * 100;
  
  console.log('[FuelCalculation] Refuel calculation:', {
    currentFuelLevel: motor.currentFuelLevel,
    currentFuelInTank,
    refuelAmount,
    newFuelInTank,
    newFuelLevel
  });
  
  return Math.min(100, newFuelLevel); // Cap at 100%
};
