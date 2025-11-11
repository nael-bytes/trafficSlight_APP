/**
 * useReportChecking Hook
 * 
 * Extracts report checking logic:
 * - checkReportUpdates callback
 * - memoizedRefreshData callback
 * - Debounced report updates
 * 
 * @module useReportChecking
 */

import { useCallback, useRef, useMemo, useEffect } from 'react';
import { debounce } from '../../utils/performanceOptimizer';
import { checkReportUpdates as checkReportUpdatesUtil } from './reportUtils';

interface UseReportCheckingParams {
  user: any;
  isFocused: boolean;
  effectiveReports: any[];
  lastReportUpdate: number;
  isCheckingReports: boolean;
  setLocalReports: (reports: any[]) => void;
  setLastReportUpdate: (update: number) => void;
  setIsCheckingReports: (checking: boolean) => void;
}

interface UseReportCheckingReturn {
  checkReportUpdates: () => Promise<void>;
  memoizedRefreshData: () => Promise<void>;
}

/**
 * Custom hook for managing report checking
 */
export const useReportChecking = ({
  user,
  isFocused,
  effectiveReports,
  lastReportUpdate,
  isCheckingReports,
  setLocalReports,
  setLastReportUpdate,
  setIsCheckingReports,
}: UseReportCheckingParams): UseReportCheckingReturn => {
  // Debounced report update function - only updates markers, not the entire map
  const debouncedUpdateReports = useMemo(
    () => debounce((newReports: any[]) => {
      // Only update local reports state (which triggers marker update only)
      // This doesn't trigger full map re-render because OptimizedMapComponent
      // uses React.memo and only re-renders when marker props change
      setLocalReports(newReports);
      
      // SILENT UPDATE: No log - updates happen silently in background
    }, 500), // 500ms debounce to prevent excessive updates
    [setLocalReports]
  );

  // Function to check for report updates and update map markers (using new utility)
  // CRITICAL: Add isFocused check to prevent running when screen is not focused
  // OPTIMIZED: Only updates markers, not the entire map
  // PERFORMANCE: Use refs for stable values to prevent unnecessary re-creation
  const effectiveReportsRef = useRef(effectiveReports);
  const lastReportUpdateRef = useRef(lastReportUpdate);
  const isFocusedForReportsRef = useRef(isFocused);

  // Update refs
  useEffect(() => {
    effectiveReportsRef.current = effectiveReports;
    lastReportUpdateRef.current = lastReportUpdate;
    isFocusedForReportsRef.current = isFocused;
  }, [effectiveReports, lastReportUpdate, isFocused]);

  const checkReportUpdates = useCallback(async () => {
    // CRITICAL: Don't check reports if screen is not focused
    if (!isFocusedForReportsRef.current) {
      // SILENT UPDATE: No log - silent skip
      return;
    }

    if (!user?._id || isCheckingReports) return;

    setIsCheckingReports(true);

    try {
      // Use custom update handler that only updates markers
      await checkReportUpdatesUtil({
        userId: user._id,
        token: user.token || '',
        currentReports: effectiveReportsRef.current as any, // Use ref to avoid dependency
        lastUpdate: lastReportUpdateRef.current, // Use ref to avoid dependency
        onUpdateReports: debouncedUpdateReports, // Use debounced update
        onUpdateLastReportUpdate: setLastReportUpdate,
      });
    } catch (error) {
      // Error handling - KEEP ERROR LOGS for debugging
      if (__DEV__) {
        console.warn('[useReportChecking] ❌ Report update check failed:', error);
      }
    } finally {
      setIsCheckingReports(false);
    }
  }, [user?._id, user?.token, isCheckingReports, debouncedUpdateReports, setLastReportUpdate, setIsCheckingReports]);

  // Optimized refresh function - only updates markers, not the entire map
  // This is called when a report is voted on, but we only want to update markers
  // SILENT UPDATE: Refreshes happen silently in background - no logs unless errors
  const memoizedRefreshData = useCallback(async () => {
    // Only refresh reports (markers), not the entire map
    // This prevents full map re-renders when voting on reports
    // The OptimizedMapComponent will handle marker updates internally via React.memo
    if (isFocused && user?._id && !isCheckingReports) {
      // Trigger a report check (debounced) to update markers only
      // This will update markers without causing full map re-render
      // Updates happen silently in background

      // Use debounced check to prevent excessive updates
      // The checkReportUpdates function will use debouncedUpdateReports internally
      // Use a ref to access the latest checkReportUpdates function
      const checkUpdates = checkReportUpdates;
      setTimeout(() => {
        if (isFocused && checkUpdates) {
          checkUpdates().catch((error) => {
            // KEEP ERROR LOGS: Only log if update fails
            if (__DEV__) {
              console.warn('[useReportChecking] ❌ Silent refresh failed:', error);
            }
          });
        }
      }, 1000); // 1 second delay to batch updates
    }
  }, [isFocused, user?._id, isCheckingReports, checkReportUpdates]);

  return {
    checkReportUpdates,
    memoizedRefreshData,
  };
};

