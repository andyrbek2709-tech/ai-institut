// Railway API Server base URL
// In production: REACT_APP_RAILWAY_API_URL = https://api-server-production-8157.up.railway.app
// In localhost: empty string (CRA proxy or no API)

export function getApiBaseUrl(): string {
  return process.env.REACT_APP_RAILWAY_API_URL || '';
}

export default {
  getApiBaseUrl,
};
