import { logger } from '../utils/logger.js';
import { env } from '../config/environment.js';
import { ApiError } from '../middleware/errorHandler.js';

export interface ProxyRequestOptions {
  path: string;
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  data?: any;
  token?: string;
  headers?: Record<string, string>;
}

export interface ProxyResponse<T = any> {
  data: T;
  status: number;
  headers: Record<string, string>;
}

const supabaseUrl = env.SUPABASE_URL;
const anonKey = env.SUPABASE_ANON_KEY;

const defaultHeaders = (token?: string): Record<string, string> => ({
  'apikey': anonKey,
  'Authorization': `Bearer ${token || anonKey}`,
  'Content-Type': 'application/json',
});

/**
 * Proxy requests to Supabase PostgREST API
 * Handles auth, error handling, and response parsing
 */
export async function proxyRequest<T = any>(
  options: ProxyRequestOptions,
): Promise<ProxyResponse<T>> {
  const { path, method, data, token, headers = {} } = options;

  try {
    const url = `${supabaseUrl}/rest/v1/${path}`;

    const fetchOptions: RequestInit = {
      method,
      headers: { ...defaultHeaders(token), ...headers },
      signal: AbortSignal.timeout(10000),
    };

    // Add body for non-GET requests
    if (method !== 'GET' && data) {
      fetchOptions.body = JSON.stringify(data);
    }

    // Add Prefer header for POST/PATCH to return representation
    if ((method === 'POST' || method === 'PATCH') && !headers['Prefer']) {
      fetchOptions.headers = {
        ...fetchOptions.headers,
        'Prefer': 'return=representation',
      };
    }

    logger.debug(`Proxying ${method} ${path}`, { url });

    const response = await fetch(url, fetchOptions);
    const responseHeaders = Object.fromEntries(response.headers);

    // Parse response
    let responseData: T;
    const contentType = response.headers.get('content-type');

    if (contentType?.includes('application/json')) {
      responseData = await response.json() as T;
    } else {
      responseData = (await response.text()) as T;
    }

    // Handle errors
    if (!response.ok) {
      logger.error(`Supabase error: ${method} ${path}`, {
        status: response.status,
        statusText: response.statusText,
        data: responseData,
      });

      // Map Supabase error codes to HTTP error codes
      if (response.status === 401) {
        throw new ApiError(401, 'Unauthorized');
      }
      if (response.status === 403) {
        throw new ApiError(403, 'Forbidden');
      }
      if (response.status === 404) {
        throw new ApiError(404, 'Not found');
      }
      if (response.status === 409) {
        throw new ApiError(409, 'Conflict');
      }

      const errorMessage =
        (responseData as any)?.message ||
        (responseData as any)?.error ||
        `HTTP ${response.status}: ${response.statusText}`;

      throw new ApiError(response.status, errorMessage);
    }

    logger.debug(`Supabase response: ${method} ${path}`, {
      status: response.status,
      dataType: Array.isArray(responseData) ? 'array' : typeof responseData,
    });

    return {
      data: responseData,
      status: response.status,
      headers: responseHeaders,
    };
  } catch (err) {
    if (err instanceof ApiError) throw err;

    logger.error(`Proxy request failed: ${method} ${path}`, {
      error: (err as Error).message,
      code: (err as any).code,
    });

    throw new ApiError(500, 'Proxy request failed', {
      message: (err as Error).message,
    });
  }
}

/**
 * List records from a table with optional filters
 */
export async function listRecords<T>(
  tableName: string,
  options?: {
    filters?: Record<string, string>;
    order?: string;
    limit?: number;
    token?: string;
    select?: string;
  }
): Promise<T[]> {
  const { filters = {}, order = 'id.desc', limit = 500, token, select } = options || {};

  // Build query string
  const params = new URLSearchParams();

  // Select specific columns to reduce data transfer
  if (select) {
    params.append('select', select);
  }

  Object.entries(filters).forEach(([key, value]) => {
    params.append(key, value);
  });

  if (order) {
    params.append('order', order);
  }
  if (limit) {
    params.append('limit', limit.toString());
  }

  const path = `${tableName}?${params.toString()}`;
  const response = await proxyRequest<T[]>({ path, method: 'GET', token });

  return Array.isArray(response.data) ? response.data : [];
}

/**
 * Create a record
 */
export async function createRecord<T>(
  tableName: string,
  data: any,
  token?: string,
): Promise<T> {
  const response = await proxyRequest<T[]>(
    { path: tableName, method: 'POST', data, token }
  );

  const records = Array.isArray(response.data) ? response.data : [response.data];
  return records[0] as T;
}

/**
 * Update a record by ID
 */
export async function updateRecord<T>(
  tableName: string,
  id: string | number,
  data: any,
  token?: string,
): Promise<T> {
  const path = `${tableName}?id=eq.${id}`;
  const response = await proxyRequest<T[]>(
    { path, method: 'PATCH', data, token }
  );

  const records = Array.isArray(response.data) ? response.data : [response.data];
  return records[0] as T;
}

/**
 * Delete a record by ID
 */
export async function deleteRecord(
  tableName: string,
  id: string | number,
  token?: string,
): Promise<void> {
  const path = `${tableName}?id=eq.${id}`;
  await proxyRequest({ path, method: 'DELETE', token });
}
