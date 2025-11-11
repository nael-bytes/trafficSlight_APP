/**
 * useModalManagement Hook
 * 
 * Extracts all modal state management logic:
 * - Motor selector modal
 * - Report modal
 * - Trip summary modal
 * - Trip recovery modal
 * - Fuel check modal
 * - Fuel update modal
 * - Maintenance form modal
 * - Map filter modal
 * 
 * @module useModalManagement
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type { Motor } from '../../types';

interface UseModalManagementReturn {
  // Modal states
  showMotorSelector: boolean;
  showReportModal: boolean;
  showTripSummary: boolean;
  showTripRecovery: boolean;
  showFuelCheckModal: boolean;
  showFuelUpdateModal: boolean;
  showFilterModal: boolean;
  maintenanceFormVisible: boolean;

  // Modal setters
  setShowMotorSelector: (show: boolean) => void;
  setShowReportModal: (show: boolean) => void;
  setShowTripSummary: (show: boolean) => void;
  setShowTripRecovery: (show: boolean) => void;
  setShowFuelCheckModal: (show: boolean) => void;
  setShowFuelUpdateModal: (show: boolean) => void;
  setShowFilterModal: (show: boolean) => void;
  setMaintenanceFormVisible: (show: boolean) => void;

  // Modal handlers
  openMotorSelector: () => void;
  closeMotorSelector: () => void;
  openReportModal: () => void;
  closeReportModal: () => void;
  openTripSummary: () => void;
  closeTripSummary: () => void;
  openTripRecovery: () => void;
  closeTripRecovery: () => void;
  openFuelCheckModal: () => void;
  closeFuelCheckModal: () => void;
  openFuelUpdateModal: () => void;
  closeFuelUpdateModal: () => void;
  openFilterModal: () => void;
  closeFilterModal: () => void;
  openMaintenanceForm: () => void;
  closeMaintenanceForm: () => void;

  // Reporting ref for external control
  reportingRef: React.RefObject<{ openReportModal: () => void } | null>;
}

/**
 * Custom hook for managing all modal states
 */
export const useModalManagement = (): UseModalManagementReturn => {
  const [showMotorSelector, setShowMotorSelector] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showTripSummary, setShowTripSummary] = useState(false);
  const [showTripRecovery, setShowTripRecovery] = useState(false);
  const [showFuelCheckModal, setShowFuelCheckModal] = useState(false);
  const [showFuelUpdateModal, setShowFuelUpdateModal] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [maintenanceFormVisible, setMaintenanceFormVisible] = useState(false);

  const reportingRef = useRef<{ openReportModal: () => void } | null>(null);

  // Modal handlers
  const openMotorSelector = useCallback(() => setShowMotorSelector(true), []);
  const closeMotorSelector = useCallback(() => setShowMotorSelector(false), []);
  const openReportModal = useCallback(() => setShowReportModal(true), []);
  const closeReportModal = useCallback(() => setShowReportModal(false), []);
  const openTripSummary = useCallback(() => setShowTripSummary(true), []);
  const closeTripSummary = useCallback(() => setShowTripSummary(false), []);
  const openTripRecovery = useCallback(() => setShowTripRecovery(true), []);
  const closeTripRecovery = useCallback(() => setShowTripRecovery(false), []);
  const openFuelCheckModal = useCallback(() => setShowFuelCheckModal(true), []);
  const closeFuelCheckModal = useCallback(() => setShowFuelCheckModal(false), []);
  const openFuelUpdateModal = useCallback(() => setShowFuelUpdateModal(true), []);
  const closeFuelUpdateModal = useCallback(() => setShowFuelUpdateModal(false), []);
  const openFilterModal = useCallback(() => setShowFilterModal(true), []);
  const closeFilterModal = useCallback(() => setShowFilterModal(false), []);
  const openMaintenanceForm = useCallback(() => setMaintenanceFormVisible(true), []);
  const closeMaintenanceForm = useCallback(() => setMaintenanceFormVisible(false), []);

  // Open report modal when showReportModal state changes
  useEffect(() => {
    if (showReportModal && reportingRef.current) {
      reportingRef.current.openReportModal();
    }
  }, [showReportModal]);

  return {
    // Modal states
    showMotorSelector,
    showReportModal,
    showTripSummary,
    showTripRecovery,
    showFuelCheckModal,
    showFuelUpdateModal,
    showFilterModal,
    maintenanceFormVisible,

    // Modal setters
    setShowMotorSelector,
    setShowReportModal,
    setShowTripSummary,
    setShowTripRecovery,
    setShowFuelCheckModal,
    setShowFuelUpdateModal,
    setShowFilterModal,
    setMaintenanceFormVisible,

    // Modal handlers
    openMotorSelector,
    closeMotorSelector,
    openReportModal,
    closeReportModal,
    openTripSummary,
    closeTripSummary,
    openTripRecovery,
    closeTripRecovery,
    openFuelCheckModal,
    closeFuelCheckModal,
    openFuelUpdateModal,
    closeFuelUpdateModal,
    openFilterModal,
    closeFilterModal,
    openMaintenanceForm,
    closeMaintenanceForm,

    // Reporting ref
    reportingRef,
  };
};

