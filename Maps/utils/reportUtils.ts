/**
 * Report Utilities
 * 
 * Handles all report-related operations including:
 * - Report updates checking
 * - Report comparison
 * - Report filtering
 */

import Toast from 'react-native-toast-message';
import { compareReports } from '../../services/routeSelectionDataProcessor';
import type { TrafficIncident } from '../../types';

const API_BASE = "https://ts-backend-1-jyit.onrender.com";

export interface CheckReportUpdatesParams {
  userId: string;
  token: string;
  currentReports: TrafficIncident[];
  lastUpdate: number;
  onUpdateReports: (reports: TrafficIncident[]) => void;
  onUpdateLastReportUpdate: (timestamp: number) => void;
}

/**
 * Check for report updates and update map markers
 */
export const checkReportUpdates = async (params: CheckReportUpdatesParams): Promise<void> => {
  const {
    userId,
    token,
    currentReports,
    lastUpdate,
    onUpdateReports,
    onUpdateLastReportUpdate,
  } = params;

  if (!userId) return;
  
  try {
    if (__DEV__) {
      console.log('[ReportUtils] Checking for report updates...');
    }
    
    if (!API_BASE) {
      if (__DEV__) {
        console.warn('[ReportUtils] API_BASE not configured, skipping report updates');
      }
      return;
    }
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch(`${API_BASE}/api/reports`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token || ''}`,
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const freshReports = await response.json();
    
    if (__DEV__) {
      console.log('[ReportUtils] Report comparison:', {
        freshReportsCount: freshReports.length,
        currentReportsCount: currentReports.length,
        lastUpdate
      });
    }

    const hasChanges = compareReports(currentReports, freshReports);
    
    if (hasChanges) {
      if (__DEV__) {
        console.log('[ReportUtils] ✅ Report changes detected, updating map markers only (no full map re-render)');
      }
      
      // Only update markers, not the entire map
      // The debounced update handler in RouteSelectionScreen will handle this
      onUpdateReports(freshReports);
      onUpdateLastReportUpdate(Date.now());
      
      // REMOVED: Toast notification to prevent unnecessary UI updates
      // Markers will update silently without disrupting the user experience
    }
    
  } catch (error: any) {
    if (__DEV__) {
      if (error.name === 'AbortError') {
        console.warn('[ReportUtils] Report update request timed out');
      } else if (error.message?.includes('Network request failed')) {
        console.warn('[ReportUtils] Network error - backend server may be down');
      } else {
        console.warn('[ReportUtils] Failed to check report updates:', error);
      }
    }
    throw error;
  }
};

