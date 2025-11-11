/**
 * Map interaction hook
 * Handles map panning, zooming, and user interaction tracking
 */

import { useCallback, useRef } from 'react';

interface UseMapInteractionParams {
  isTracking: boolean;
  isFocused: boolean; // CRITICAL: Prevent updates when screen is not focused
  userManuallyPannedRef: React.MutableRefObject<boolean>;
  manualPanTimeoutRef: React.MutableRefObject<NodeJS.Timeout | null>;
}

interface Region {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

/**
 * Hook for managing map interactions (panning, zooming, etc.)
 * Tracks user manual panning to disable auto-follow when needed
 */
export const useMapInteraction = ({
  isTracking,
  isFocused,
  userManuallyPannedRef,
  manualPanTimeoutRef,
}: UseMapInteractionParams) => {
  // CRITICAL: Use ref to track focus state without causing re-renders
  const isFocusedRef = useRef(isFocused);
  isFocusedRef.current = isFocused;

  /**
   * Handle manual map panning - disable auto-follow when user pans
   * CRITICAL FIX: Do NOT update region state during manual pan - this causes map reloads
   * The MapView manages its own region internally during user interaction
   * We only track the pan via refs to disable auto-follow, NOT to update state
   * CRITICAL: Do NOT process updates when screen is not focused
   */
  const handleManualPan = useCallback((region: Region | null) => {
    // CRITICAL: Skip all updates if screen is not focused
    if (!isFocusedRef.current) {
      return; // Silent skip - no updates when screen is not focused
    }

    // Validate region (for safety, but we won't update state)
    if (!region || typeof region.latitude !== 'number' || typeof region.longitude !== 'number' ||
        isNaN(region.latitude) || isNaN(region.longitude) ||
        region.latitude < -90 || region.latitude > 90 ||
        region.longitude < -180 || region.longitude > 180) {
      if (__DEV__) {
        console.warn('[MapInteraction] ⚠️ Invalid region in handleManualPan, skipping', {
          region,
        });
      }
      return;
    }
    
    // ALWAYS set flag that user manually panned (disable auto-follow)
    // This takes priority over auto-follow animations
    userManuallyPannedRef.current = true;
    
    // Clear any existing timeout
    if (manualPanTimeoutRef.current) {
      clearTimeout(manualPanTimeoutRef.current);
    }
    
    // Re-enable auto-follow after 30 seconds of no manual panning (when tracking)
    // This allows auto-follow to resume after user finishes exploring the map
    if (isTracking) {
      manualPanTimeoutRef.current = setTimeout(() => {
        userManuallyPannedRef.current = false;
      }, 30000); // 30 seconds
    }
    
    // DO NOT update region state here - MapView handles its own region during user panning
    // Updating state causes the map to reload/reset, which is what causes the reload issue
    // The region prop should remain stable - MapView manages panning internally
    // We only use this callback to track user interaction for auto-follow control
  }, [isTracking, userManuallyPannedRef, manualPanTimeoutRef]);

  return {
    handleManualPan,
  };
};

