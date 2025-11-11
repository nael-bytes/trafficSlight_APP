/**
 * ToggleButtons Component
 * 
 * Handles mode switching between free drive and destination-based navigation.
 * Provides a visual toggle UI with icons and labels.
 * 
 * @component
 * @example
 * ```tsx
 * <ToggleButtons
 *   mode="free_drive"
 *   onModeChange={handleModeChange}
 *   disabled={false}
 * />
 * ```
 */

import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Dimensions } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

const { width } = Dimensions.get('window');

/**
 * Props for ToggleButtons component
 * 
 * @interface ToggleButtonsProps
 * @property {'free_drive' | 'destination'} mode - Current selected mode
 * @property {(mode: 'free_drive' | 'destination') => void} onModeChange - Callback when mode changes
 * @property {boolean} [disabled=false] - Whether the buttons are disabled
 */
interface ToggleButtonsProps {
  mode: 'free_drive' | 'destination';
  onModeChange: (mode: 'free_drive' | 'destination') => void;
  disabled?: boolean;
}

/**
 * ToggleButtons component - UI component for mode switching
 * 
 * Renders two buttons (Free Drive and Destination) with icons and labels.
 * The active button is highlighted with a different background color.
 * 
 * @param {ToggleButtonsProps} props - Component props
 * @returns {JSX.Element} Toggle buttons UI
 */
export const ToggleButtons: React.FC<ToggleButtonsProps> = ({
  mode,
  onModeChange,
  disabled = false,
}) => {
  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[
          styles.button,
          mode === 'free_drive' && styles.buttonActive,
          disabled && styles.buttonDisabled,
        ]}
        onPress={() => !disabled && onModeChange('free_drive')}
        disabled={disabled}
      >
        <MaterialIcons
          name="directions-bike"
          size={20}
          color={mode === 'free_drive' ? '#FFF' : '#666'}
        />
        <Text
          style={[
            styles.buttonText,
            mode === 'free_drive' && styles.buttonTextActive,
          ]}
        >
          Free Drive
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.button,
          mode === 'destination' && styles.buttonActive,
          disabled && styles.buttonDisabled,
        ]}
        onPress={() => !disabled && onModeChange('destination')}
        disabled={disabled}
      >
        <MaterialIcons
          name="place"
          size={20}
          color={mode === 'destination' ? '#FFF' : '#666'}
        />
        <Text
          style={[
            styles.buttonText,
            mode === 'destination' && styles.buttonTextActive,
          ]}
        >
          Destination
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 4,
    marginHorizontal: 16,
    marginVertical: 8,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: 'transparent',
  },
  buttonActive: {
    backgroundColor: '#00ADB5',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  buttonTextActive: {
    color: '#FFF',
  },
});

