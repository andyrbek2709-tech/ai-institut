/**
 * API Configuration
 * Controls which backend is used: Vercel or Railway
 */

export type { ApiProvider } from '../lib/api-selection-updated';

export {
  selectApiProvider,
  getApiProvider,
  getApiSelectionReason,
  getRolloutPercentage,
  setApiProvider,
  clearApiProvider,
} from '../lib/api-selection-updated';

function getRailwayUrl(): string {
  if (process.env.REACT_APP_RAILWAY_API_URL) {
    return process.env.REACT_APP_RAILWAY_API_URL;
  }
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return 'http://localhost:3001';
  }
  // Production Railway URL
  return 'https://api-server-production-8157.up.railway.app';
}

export function getApiBaseUrl(provider?: string): string {
  const p = provider || 'railway';
  return p === 'railway' ? getRailwayUrl() : '';
}

export default {
  getRailwayUrl,
  getApiBaseUrl,
};
