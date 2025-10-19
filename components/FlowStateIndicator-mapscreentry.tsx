import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

type FlowState = 'searching' | 'destination_selected' | 'routes_found' | 'navigating' | 'completed';

interface FlowStateIndicatorProps {
  currentFlowState: FlowState;
}

export const FlowStateIndicator: React.FC<FlowStateIndicatorProps> = ({
  currentFlowState,
}) => {
  if (currentFlowState === 'navigating') return null;

  const getStepStatus = (step: number) => {
    switch (step) {
      case 1:
        return ['destination_selected', 'routes_found', 'navigating', 'completed'].includes(currentFlowState);
      case 2:
        return ['routes_found', 'navigating', 'completed'].includes(currentFlowState);
      case 3:
        return ['navigating', 'completed'].includes(currentFlowState);
      default:
        return false;
    }
  };

  const getStepLabel = (step: number) => {
    switch (step) {
      case 1: return 'Choose destination';
      case 2: return 'Select route';
      case 3: return 'Navigate';
      default: return '';
    }
  };

  const getCurrentStateLabel = () => {
    switch (currentFlowState) {
      case 'searching': return 'Choose your destination';
      case 'destination_selected': return 'Find the best routes';
      case 'routes_found': return 'Select route and start navigation';
      case 'completed': return 'Trip completed successfully!';
      default: return '';
    }
  };

  return (
    <View style={styles.flowStateIndicator}>
      <View style={styles.stepIndicator}>
        {[1, 2, 3].map((step, index) => {
          const isCompleted = getStepStatus(step);
          const isActive = step === 1 && currentFlowState === 'searching' ||
                          step === 2 && currentFlowState === 'destination_selected' ||
                          step === 3 && currentFlowState === 'routes_found';
          
          return (
            <React.Fragment key={step}>
              <View style={[
                styles.step,
                isCompleted ? styles.stepCompleted : 
                isActive ? styles.stepActive : styles.stepInactive
              ]}>
                <Text style={[
                  styles.stepNumber,
                  isCompleted ? styles.stepNumberCompleted :
                  isActive ? styles.stepNumberActive : styles.stepNumberInactive
                ]}>
                  {step}
                </Text>
              </View>
              {index < 2 && (
                <View style={[
                  styles.stepLine,
                  isCompleted ? styles.stepLineCompleted : styles.stepLineInactive
                ]} />
              )}
            </React.Fragment>
          );
        })}
      </View>
      
      <View style={styles.stateLabelContainer}>
        <Text style={styles.stateLabel}>
          {getCurrentStateLabel()}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  flowStateIndicator: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  step: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
  },
  stepActive: {
    backgroundColor: '#00ADB5',
    borderColor: '#00ADB5',
  },
  stepCompleted: {
    backgroundColor: '#27ae60',
    borderColor: '#27ae60',
  },
  stepInactive: {
    backgroundColor: '#f0f0f0',
    borderColor: '#ddd',
  },
  stepNumber: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  stepNumberActive: {
    color: '#fff',
  },
  stepNumberCompleted: {
    color: '#fff',
  },
  stepNumberInactive: {
    color: '#999',
  },
  stepLine: {
    width: 40,
    height: 2,
    marginHorizontal: 8,
  },
  stepLineCompleted: {
    backgroundColor: '#27ae60',
  },
  stepLineInactive: {
    backgroundColor: '#ddd',
  },
  stateLabelContainer: {
    alignItems: 'center',
  },
  stateLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
});
