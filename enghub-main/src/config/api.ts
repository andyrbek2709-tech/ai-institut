/**
 * API Configuration
 * Controls which backend is used: Vercel or Railway
 *
 * Selection logic:
 * 1. Check overrides (localStorage, query param, force flag)
 * 2. Use stable hash distribution based on rollout percentage
 * 3. Return provider + reason for logging/monitoring
 */

export type ApiProvider = 'vercel' | 'railway';

export interface ApiConfig {
  provider: ApiProvider;
  baseUrl: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  reason: string; // Why this provider was selected
}

// Import selection logic
import { selectApiProvider, logApiSelection, type SelectionContext } from '../lib/api-selection';

function getRailwayUrl(): string {
  // Allow override via environment variable
  if (process.env.REACT_APP_RAILWAY_API_URL) {
    return process.env.REACT_APP_RAILWAY_API_URL;
  }

  // Default to localhost for development
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return 'http://localhost:3001';
  }

  // Production Railway URL (will be set via environment)
  return 'https://api.railway.app'; // Placeholder
}

/**
 * Get current user ID from localStorage
 * Used for stable hash distribution
 */
function getCurrentUserId(): number | undefined {
  if (typeof localStorage === 'undefined') return undefined;

  try {
    const stored = localStorage.getItem('CURRENT_USER_ID');
    if (stored) return parseInt(stored, 10);
  } catch {
    // Ignore errors
  }

  return undefined;
}

/**
 * Initialize API config based on rollout strategy
 */
function initApiConfig(): ApiConfig {
  const userId = getCurrentUserId();
  const context: SelectionContext = { userId };

  const selection = selectApiProvider(context);
  logApiSelection(userId, selection);

  const baseUrl = selection.provider === 'railway' ? getRailwayUrl() : '';

  return {
    provider: selection.provider,
    baseUrl,
    supabaseUrl: process.env.REACT_APP_SUPABASE_URL || '',
    supabaseAnonKey: process.env.REACT_APP_SUPABASE_ANON_KEY || '',
    reason: selection.reason,
  };
}

export const API_CONFIG = initApiConfig();

/**
 * Get the current API provider
 */
export function getApiProvider(): ApiProvider {
  return API_CONFIG.provider;
}

/**
 * Get the reason why this provider was selected
 */
export function getApiSelectionReason(): string {
  return API_CONFIG.reason;
}

/**
 * Get the base URL for the current API provider
 */
export function getApiBaseUrl(): string {
  return API_CONFIG.baseUrl;
}

export default API_CONFIG;
