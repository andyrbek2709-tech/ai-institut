/**
 * API Configuration
 * All API calls go through Vercel API functions (/api/*)
 * Tasks and main data come directly from Supabase
 */

export function getApiBaseUrl(): string {
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return '';  // API functions also available on localhost:3000
  }
  return '';  // Production uses same origin (/api/*)
}

export default {
  getApiBaseUrl,
};
