/**
 * Rerouting hook
 * Manages rerouting state and logic for navigation
 */

import { useState, useCallback } from 'react';

interface UseReroutingParams {
  onReroute?: () => void;
}

/**
 * Hook for managing rerouting state and logic
 */
export const useRerouting = ({ onReroute }: UseReroutingParams = {}) => {
  const [wasRerouted, setWasRerouted] = useState(false);
  const [isRerouting, setIsRerouting] = useState(false);
  const [rerouteCount, setRerouteCount] = useState(0);

  /**
   * Trigger a reroute
   */
  const triggerReroute = useCallback(() => {
    setIsRerouting(true);
    setRerouteCount(prev => prev + 1);
    setWasRerouted(true);
    
    if (onReroute) {
      onReroute();
    }
  }, [onReroute]);

  /**
   * Complete rerouting
   */
  const completeReroute = useCallback(() => {
    setIsRerouting(false);
  }, []);

  /**
   * Reset rerouting state
   */
  const resetRerouting = useCallback(() => {
    setIsRerouting(false);
    setRerouteCount(0);
    setWasRerouted(false);
  }, []);

  return {
    wasRerouted,
    isRerouting,
    rerouteCount,
    triggerReroute,
    completeReroute,
    resetRerouting,
  };
};

