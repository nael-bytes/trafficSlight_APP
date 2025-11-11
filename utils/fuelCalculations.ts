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
  // Validate input parameters
  if (!motor || typeof distanceTraveled !== 'number' || distanceTraveled < 0) {
    console.warn('[FuelCalculation] ❌ Invalid input parameters:', { motor, distanceTraveled });
    return motor?.currentFuelLevel || 0;
  }

  // Validate motor properties
  if (!motor.fuelConsumption || !motor.fuelTank || motor.fuelConsumption <= 0 || motor.fuelTank <= 0) {
    console.warn('[FuelCalculation] ❌ Invalid motor fuel data:', {
      fuelConsumption: motor.fuelConsumption,
      fuelTank: motor.fuelTank
    });
    return motor.currentFuelLevel;
  }

  // Calculate total drivable distance with safety checks
  const totalDrivableDistance = calculateTotalDrivableDistance(motor);
  const totalDrivableDistanceWithCurrentGas = calculateTotalDrivableDistanceWithCurrentGas(motor);
  
  if (totalDrivableDistance <= 0 || isNaN(totalDrivableDistance)) {
    console.warn('[FuelCalculation] ❌ Invalid total drivable distance:', totalDrivableDistance);
    return motor.currentFuelLevel;
  }
  
  if (totalDrivableDistanceWithCurrentGas <= 0 || isNaN(totalDrivableDistanceWithCurrentGas)) {
    console.warn('[FuelCalculation] ❌ Invalid current gas drivable distance:', totalDrivableDistanceWithCurrentGas);
    return motor.currentFuelLevel;
  }
  
  // Calculate new drivable distance after subtracting distance traveled
  const newTotalDrivableDistanceWithCurrentGas = Math.max(0, totalDrivableDistanceWithCurrentGas - distanceTraveled);
  
  // Convert back to fuel level percentage with safety checks
  const newFuelLevel = (newTotalDrivableDistanceWithCurrentGas / totalDrivableDistance) * 100;
  
  // Validate the calculated fuel level
  if (isNaN(newFuelLevel) || !isFinite(newFuelLevel)) {
    console.warn('[FuelCalculation] ❌ Calculated fuel level is invalid:', newFuelLevel);
    return motor.currentFuelLevel;
  }
  
  const finalFuelLevel = Math.max(0, Math.min(100, newFuelLevel)); // Clamp between 0-100%
  
  // Only log significant fuel changes to reduce console spam
  const fuelConsumed = motor.currentFuelLevel - finalFuelLevel;
  if (Math.abs(fuelConsumed) > 0.5) { // Only log if fuel changed by more than 0.5%
    console.log('[FuelCalculation] Fuel update:', {
      distanceTraveled: distanceTraveled.toFixed(3),
      fuelConsumed: fuelConsumed.toFixed(2),
      newFuelLevel: finalFuelLevel.toFixed(1),
      totalDrivableDistance: totalDrivableDistance.toFixed(2),
      totalDrivableDistanceWithCurrentGas: totalDrivableDistanceWithCurrentGas.toFixed(2)
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
  // Validate input parameters
  if (!motor || typeof refuelAmount !== 'number' || refuelAmount < 0) {
    console.warn('[FuelCalculation] ❌ Invalid refuel parameters:', { motor, refuelAmount });
    return motor?.currentFuelLevel || 0;
  }

  // Validate motor properties
  if (!motor.fuelTank || motor.fuelTank <= 0) {
    console.warn('[FuelCalculation] ❌ Invalid fuel tank capacity:', motor.fuelTank);
    return motor.currentFuelLevel;
  }

  // Validate current fuel level
  if (motor.currentFuelLevel < 0 || motor.currentFuelLevel > 100) {
    console.warn('[FuelCalculation] ❌ Invalid current fuel level:', motor.currentFuelLevel);
    return motor.currentFuelLevel;
  }

  const currentFuelInTank = (motor.currentFuelLevel / 100) * motor.fuelTank;
  const newFuelInTank = Math.min(motor.fuelTank, currentFuelInTank + refuelAmount);
  const newFuelLevel = (newFuelInTank / motor.fuelTank) * 100;
  
  // Validate calculated fuel level
  if (isNaN(newFuelLevel) || !isFinite(newFuelLevel)) {
    console.warn('[FuelCalculation] ❌ Calculated refuel level is invalid:', newFuelLevel);
    return motor.currentFuelLevel;
  }
  
  const finalFuelLevel = Math.min(100, Math.max(0, newFuelLevel)); // Cap between 0-100%
  
  console.log('[FuelCalculation] Refuel calculation:', {
    currentFuelLevel: motor.currentFuelLevel,
    currentFuelInTank: currentFuelInTank.toFixed(2),
    refuelAmount: refuelAmount.toFixed(2),
    newFuelInTank: newFuelInTank.toFixed(2),
    newFuelLevel: finalFuelLevel.toFixed(1)
  });
  
  return finalFuelLevel;
};
