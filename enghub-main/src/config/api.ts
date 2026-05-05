/**
 * API Configuration
 * Controls which backend is used: Vercel (default) or Railway
 */

export type ApiProvider = 'vercel' | 'railway';

interface ApiConfig {
  provider: ApiProvider;
  baseUrl: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
}

// Detect API provider from environment or URL
function detectApiProvider(): ApiProvider {
  // Allow override via localStorage for testing
  const stored = typeof localStorage !== 'undefined' ? localStorage.getItem('API_PROVIDER') : null;
  if (stored === 'railway' || stored === 'vercel') return stored;

  // Check if we're running locally
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return 'railway'; // Default to railway in development
  }

  // Production: use Vercel by default
  return 'vercel';
}

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

export const API_CONFIG: ApiConfig = {
  provider: detectApiProvider(),
  baseUrl: detectApiProvider() === 'railway' ? getRailwayUrl() : '',
  supabaseUrl: process.env.REACT_APP_SUPABASE_URL || '',
  supabaseAnonKey: process.env.REACT_APP_SUPABASE_ANON_KEY || '',
};

/**
 * Get the current API provider
 */
export function getApiProvider(): ApiProvider {
  if (typeof localStorage !== 'undefined') {
    const stored = localStorage.getItem('API_PROVIDER');
    if (stored === 'railway' || stored === 'vercel') {
      return stored;
    }
  }
  return API_CONFIG.provider;
}

/**
 * Set the API provider (for testing)
 */
export function setApiProvider(provider: ApiProvider) {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('API_PROVIDER', provider);
  }
}

/**
 * Get the base URL for the current API provider
 */
export function getApiBaseUrl(): string {
  const provider = getApiProvider();
  if (provider === 'railway') {
    return getRailwayUrl();
  }
  return ''; // Vercel uses relative URLs
}

export default API_CONFIG;
