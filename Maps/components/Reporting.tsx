/**
 * Reporting Component
 * 
 * Handles traffic reports and gas stations:
 * - Users can report conditions: Traffic, Hazards, Accidents, Road closures
 * - Reports can be submitted while driving or stationary
 * - Reports and gas stations are displayed as map markers
 * - When tapped, a popup shows more details
 * - Users can upvote/downvote reports to verify accuracy
 * - Reports can be admin-verified
 * - Gas Station markers show: Current gas price, "Add Stop" or "Find Route" options
 * 
 * @component
 * @example
 * ```tsx
 * <Reporting
 *   currentLocation={location}
 *   reports={reports}
 *   gasStations={stations}
 *   showReports={showReports}
 *   showGasStations={showGasStations}
 *   onReportSubmit={handleReportSubmit}
 *   onReportVote={handleReportVote}
 *   onGasStationSelect={handleGasStationSelect}
 *   user={user}
 * />
 * ```
 */

import React, { useCallback, useState, useImperativeHandle, forwardRef } from 'react';
import { View, StyleSheet, Modal, TouchableOpacity, Text } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import type { LocationCoords, TrafficIncident } from '../../types';
import { TrafficReportModal } from '../../components/TrafficReportModal';

/**
 * Props for Reporting component
 * 
 * @interface ReportingProps
 * @property {LocationCoords | null} currentLocation - Current GPS location
 * @property {TrafficIncident[]} reports - List of traffic reports
 * @property {any[]} gasStations - List of gas stations
 * @property {boolean} showReports - Whether to show report markers on map
 * @property {boolean} showGasStations - Whether to show gas station markers on map
 * @property {(report: TrafficIncident) => void} onReportSubmit - Callback when report is submitted
 * @property {(reportId: string, vote: 'up' | 'down') => void} onReportVote - Callback when report is voted on
 * @property {(station: any) => void} onGasStationSelect - Callback when gas station is selected
 * @property {any} user - Current user object
 */
interface ReportingProps {
  currentLocation: LocationCoords | null;
  reports: TrafficIncident[];
  gasStations: any[];
  showReports: boolean;
  showGasStations: boolean;
  onReportSubmit: (report: TrafficIncident) => void;
  onReportVote: (reportId: string, vote: 'up' | 'down') => void;
  onGasStationSelect: (station: any) => void;
  user: any;
}

/**
 * Reporting component - Handles report submission UI
 * 
 * This component manages:
 * - Report modal visibility
 * - Report submission flow
 * 
 * Note: Map markers are rendered by OptimizedMapComponent, not this component.
 * 
 * @param {ReportingProps} props - Component props
 * @param {React.Ref<{ openReportModal: () => void }>} ref - Ref to expose openReportModal method
 * @returns {JSX.Element} TrafficReportModal component
 */
export const Reporting = forwardRef<any, ReportingProps>(({
  currentLocation,
  reports,
  gasStations,
  showReports,
  showGasStations,
  onReportSubmit,
  onReportVote,
  onGasStationSelect,
  user,
}, ref) => {
  const [showReportModal, setShowReportModal] = useState(false);

  /**
   * Expose method to open report modal from parent
   */
  useImperativeHandle(ref, () => ({
    openReportModal: () => {
      setShowReportModal(true);
    },
  }));

  /**
   * Handle successful report submission
   * 
   * Closes the report modal after successful submission.
   */
  const handleReportSuccess = useCallback(() => {
    setShowReportModal(false);
    onReportSubmit?.(null as any); // Call parent callback if provided
  }, [onReportSubmit]);

  // This component primarily handles reporting logic
  // The actual report submission UI is handled by TrafficReportModal
  // Map markers are handled by MapMarkers component
  return (
    <>
      <TrafficReportModal
        visible={showReportModal}
        user={user}
        currentLocation={currentLocation}
        onClose={() => setShowReportModal(false)}
        onSuccess={handleReportSuccess}
      />
    </>
  );
});

