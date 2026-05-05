// Publish event to Redis Stream
// Called by frontend to emit domain events for the Orchestrator Service

const Redis = require('ioredis');

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const STREAM_NAME = 'task-events';

let redisClient = null;

function getRedisClient() {
  if (!redisClient) {
    redisClient = new Redis(REDIS_URL);
    redisClient.on('error', (err) => {
      console.error('Redis client error:', err);
    });
  }
  return redisClient;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const { event_type, task_id, project_id, user_id, review_id, metadata } = req.body;

    if (!event_type) {
      return res.status(400).json({ error: 'event_type is required' });
    }

    const client = getRedisClient();

    const messageId = await client.xadd(
      STREAM_NAME,
      '*',
      'event_type', event_type,
      'task_id', task_id || '',
      'project_id', project_id || '',
      'user_id', user_id || '',
      'review_id', review_id || '',
      'metadata', JSON.stringify(metadata || {}),
      'timestamp', Date.now().toString()
    );

    console.log(`[Events] Published ${event_type}:`, { messageId, task_id, project_id });

    return res.status(200).json({
      success: true,
      message_id: messageId,
      event_type,
    });
  } catch (err) {
    console.error('[Events] Failed to publish event:', err);
    return res.status(500).json({
      error: 'Failed to publish event',
      message: err.message,
    });
  }
};
