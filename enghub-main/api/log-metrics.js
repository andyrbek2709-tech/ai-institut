/**
 * Vercel Metrics Logging
 * Logs Vercel API metrics to the central metrics database
 */

import { createClient } from '@supabase/supabase-js';
import ioredis from 'ioredis';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
const redisUrl = process.env.REDIS_URL;

// Initialize clients
const supabase = createClient(supabaseUrl, supabaseServiceKey);
const redis = redisUrl ? new ioredis(redisUrl) : null;

/**
 * Record metric in Supabase
 */
async function recordMetric(metric) {
  try {
    const { error } = await supabase
      .from('api_metrics')
      .insert([
        {
          timestamp: metric.timestamp || new Date().toISOString(),
          provider: 'vercel',
          endpoint: metric.endpoint,
          status_code: metric.status_code,
          response_time: metric.response_time,
          error: metric.error,
          user_id: metric.user_id,
        },
      ]);

    if (error) {
      console.error('Failed to record metric:', error);
    }
  } catch (err) {
    console.error('Error recording metric:', err);
  }
}

/**
 * Publish metric to Redis for real-time monitoring
 */
async function publishToRedis(metric) {
  if (!redis) return;

  try {
    await redis.xadd(
      'api-metrics-events',
      '*',
      'provider',
      'vercel',
      'endpoint',
      metric.endpoint,
      'status_code',
      metric.status_code,
      'response_time',
      metric.response_time,
      'error',
      metric.error || 'none',
      'timestamp',
      new Date().toISOString()
    );
  } catch (err) {
    console.error('Error publishing to Redis:', err);
  }
}

/**
 * Main handler - logs metrics for incoming API requests
 */
export default async function handler(req, res) {
  // Only accept POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { endpoint, status_code, response_time, error, user_id } = req.body;

  // Validate required fields
  if (!endpoint || status_code === undefined || response_time === undefined) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const metric = {
    endpoint,
    status_code: parseInt(status_code, 10),
    response_time: parseInt(response_time, 10),
    error: error || null,
    user_id: user_id || null,
  };

  // Record metric
  await recordMetric(metric);

  // Publish to Redis
  if (redis) {
    await publishToRedis(metric);
  }

  res.json({
    success: true,
    message: 'Metric recorded',
    timestamp: new Date().toISOString(),
  });
}
