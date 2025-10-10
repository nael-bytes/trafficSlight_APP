// api.ts
import { LOCALHOST_IP } from "@env";

// ---- MOTOR ENDPOINTS ----
export const updateFuelLevel = async (motorId: string, newFuelLevel: number) => {
  try {
    const res = await fetch(`${LOCALHOST_IP}/api/user-motors/${motorId}/fuel`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentFuelLevel: newFuelLevel }),
    });

    if (!res.ok) throw new Error(await res.text());
    return await res.json(); // balik updated motor
  } catch (err) {
    console.error("❌ updateFuelLevel error:", err);
    throw err;
  }
};

// ---- USER ENDPOINTS ----
export const createTrip = async (userId: string) => {
  try {
    const res = await fetch(`${LOCALHOST_IP}/api/users/${userId}`);
    if (!res.ok) throw new Error(await res.text());
    return await res.json();
  } catch (err) {
    console.error("❌ getUserProfile error:", err);
    throw err;
  }
};

// ---- TRIP ENDPOINTS ----

export const recordTrip = async (tripData: {
  userId: string;
  motorId: string;
  distance: number;
  fuelUsedMin: number;
  fuelUsedMax: number;
  timeArrived: string;
  eta: string;
  destination: string;
  actualDistance?: number;
  actualFuelUsedMin?: number;
  actualFuelUsedMax?: number;
  kmph?: number;
  rerouteCount?: number;
  wasInBackground?: boolean;
  showAnalyticsModal?: boolean;
  analyticsNotes?: string;
  trafficCondition?: string;
}) => {
  try {
    const response = await fetch(`${LOCALHOST_IP}/api/trips`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(tripData),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.msg || "Failed to record trip");
    }

    console.log("Trip saved:", data.trip);
    
    return data.trip;
  } catch (err) {
    console.error("Error recording trip:", err);
    
  }
};
