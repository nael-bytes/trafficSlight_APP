import { useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import Toast from 'react-native-toast-message';
import * as Location from 'expo-location';

interface PredictiveInput {
  fuelType: 'Diesel' | 'Regular' | 'Premium';
  oilType: 'Mineral' | 'Semi-Synthetic' | 'Synthetic';
  lastRegisteredDate: string;
  motorAge: number;
  distanceTraveled: number;
  lastMaintenanceDate?: string;
  lastOilChange?: string;
  currentFuelLevel?: number;
  averageFuelConsumption?: number;
}

export const usePredictiveAnalytics = (input: PredictiveInput) => {
  const idleTimer = useRef<NodeJS.Timeout | null>(null);
  const lastMovement = useRef<number>(Date.now());

  // 🆕 For Achievements
  const [distanceMilestonesReached, setMilestones] = useState<number[]>([]);
  const milestoneStep = 0.1; // 0.1 km = 100m

  // 🆕 Speed tracker (optional for future)
  const [speedRecords, setSpeedRecords] = useState<number[]>([]);
  const [idleEvents, setIdleEvents] = useState<number[]>([]);

  const showToast = (text1: string, text2?: string) => {
    Toast.show({
      type: 'info',
      text1,
      text2,
      position: 'top',

      visibilityTime: 5000,
    });
  };

  // 🆕 Achievement tracker
  const checkDistanceAchievements = () => {
    const milestone = Math.floor(input.distanceTraveled / milestoneStep) * milestoneStep;

    if (!distanceMilestonesReached.includes(milestone) && milestone > 0) {
      setMilestones((prev) => [...prev, milestone]);
      const km = milestone.toFixed(1);
      showToast(`🏁 Achievement`, `You've traveled ${km} km`);
    }
  };

  // 🕒 Check Idle Time
  const startIdleCheck = () => {
    // console.log('idle checking...');
    idleTimer.current = setInterval(() => {
      const now = Date.now();
      if (now - lastMovement.current > 30_000) {
        showToast('Idle Alert', "Your motorcycle has been idle for 30 seconds.");
        lastMovement.current = now;
        setIdleEvents((prev) => [...prev, now]);
      }
    }, 10_000);
  };

  // ⛽ Fuel Check + dito yung sa may ttatanungin kung magpapagas ba sya or what.
  const checkFuelStatus = () => {
    if (input.currentFuelLevel && input.currentFuelLevel <= 20) {
      showToast('Fuel Alert', 'Fuel level is low (20% or less). Consider refueling soon.');
    }

    if (input.averageFuelConsumption && input.currentFuelLevel) {
      const estimatedRange = (input.currentFuelLevel / 100) * input.averageFuelConsumption * 15;
      if (estimatedRange < 50) {
        showToast('Range Warning', `Estimated range: ${Math.round(estimatedRange)}km`);
      }
    }
  };

  // 🛢️ Oil Check
  const checkOilStatus = () => {
    if (input.lastOilChange) {
      const lastOilChange = new Date(input.lastOilChange);
      const now = new Date();
      const months = (now.getTime() - lastOilChange.getTime()) / (1000 * 60 * 60 * 24 * 30);

      let interval = 3;
      if (input.oilType === 'Mineral') interval = 2;
      if (input.oilType === 'Synthetic') interval = 4;

      if (months >= interval) {
        showToast('Oil Change Due', `It's been ${Math.round(months)} months since your last oil change.`);
      }
    }
  };

  // 🧰 Maintenance Check
  const checkMaintenanceNeeds = () => {
    let threshold = input.motorAge > 5 ? 2000 : 3000;

    if (input.distanceTraveled >= threshold) {
      showToast('Maintenance Reminder', `You've traveled ${input.distanceTraveled}km. Consider a general check-up.`);
    }

    if (input.lastMaintenanceDate) {
      const last = new Date(input.lastMaintenanceDate);
      const now = new Date();
      const months = (now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24 * 30);
      if (months >= 3) {
        showToast('Time-based Maintenance', 'It has been 3+ months since last maintenance.');
      }
    }
  };

  // 📅 Registration Check
  const checkRegistration = () => {
    const last = new Date(input.lastRegisteredDate);
    const now = new Date();
    const diffMonths = (now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24 * 30);

    if (diffMonths >= 6) {
      showToast('Registration Reminder', "It's been over 6 months since last registration.");
    } else if (diffMonths >= 5) {
      showToast('Registration Notice', 'Registration renewal due in less than 30 days.');
    }
  };

  // 🔍 Custom Predictive Checks
  const checkCustomInsights = () => {
    // Aggressive rider (speeding) flag logic (future use)
    const highSpeed = speedRecords.filter((s) => s > 60).length;
    if (highSpeed >= 5) {
      showToast('Aggressive Riding Detected', 'You’ve had frequent high-speed bursts recently.');
      setSpeedRecords([]); // reset after toast
    }

    // Too many idle events in short span
    // const now = Date.now();
    // const recentIdles = idleEvents.filter((t) => now - t < 5 * 60 * 1000); // last 5 mins
    // if (recentIdles.length >= 3) {
    //   showToast('Frequent Stops', 'You’ve stopped frequently in a short time.');
    //   setIdleEvents([]);
    // }
  };

  useEffect(() => {
    checkMaintenanceNeeds();
    checkRegistration();
    checkFuelStatus();
    checkOilStatus();
    checkDistanceAchievements();
    checkCustomInsights();
    startIdleCheck();

    return () => {
      if (idleTimer.current) clearInterval(idleTimer.current);
    };
  }, [input]);

  return {
    needsOilChange: input.lastOilChange
      ? new Date(input.lastOilChange).getTime() < Date.now() - 90 * 24 * 60 * 60 * 1000
      : false,
    lowFuel: input.currentFuelLevel ? input.currentFuelLevel <= 20 : false,
    maintenanceDue: input.distanceTraveled >= (input.motorAge > 5 ? 2000 : 3000),
  };
};
