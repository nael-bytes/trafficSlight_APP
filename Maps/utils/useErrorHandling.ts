/**
 * Error handling hook
 * Manages error display and notifications
 */

import { useEffect } from 'react';
import Toast from 'react-native-toast-message';

interface UseErrorHandlingParams {
  error: string | null;
}

/**
 * Hook for handling errors with debounced display
 */
export const useErrorHandling = ({ error }: UseErrorHandlingParams): void => {
  // Effect: Handle errors (debounced)
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        Toast.show({
          type: 'error',
          text1: 'Data Loading Error',
          text2: error,
        });
      }, 500); // Debounce
      return () => clearTimeout(timer);
    }
  }, [error]);
};

