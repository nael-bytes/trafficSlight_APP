/**
 * Network connectivity utilities
 * Provides functions for checking network status and connectivity
 */

const API_BASE = "https://ts-backend-1-jyit.onrender.com";

/**
 * Check network connectivity by pinging the backend health endpoint
 * 
 * @returns Promise<boolean> - true if network is available, false otherwise
 */
export const checkNetworkConnectivity = async (): Promise<boolean> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(`${API_BASE}/api/health`, {
      method: 'HEAD',
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    return response.ok;
  } catch (error) {
    console.warn('[NetworkUtils] Network connectivity check failed:', error);
    return false;
  }
};

