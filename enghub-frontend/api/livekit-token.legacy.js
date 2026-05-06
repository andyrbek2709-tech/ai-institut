// ⚠️ DEPRECATED (2026-04-27): ЗАМЕНЕНО НА api/meeting-token.js
// Старый эндпоинт без проверки авторизации, room=`project-{projectId}`.
// Не используется фронтендом. Удалить после успешного перехода.

const { AccessToken } = require('livekit-server-sdk');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const livekitUrl = process.env.LIVEKIT_URL || process.env.REACT_APP_LIVEKIT_URL;
    if (!apiKey || !apiSecret || !livekitUrl) {
      return res.status(500).json({ error: 'LiveKit env is not configured' });
    }

    const { projectId, userId, userName } = req.body || {};
    if (!projectId || !userId) {
      return res.status(400).json({ error: 'projectId and userId are required' });
    }

    const roomName = `project-${String(projectId)}`;
    const identity = String(userId);
    const token = new AccessToken(apiKey, apiSecret, {
      identity,
      name: userName || identity,
      ttl: '2h',
      metadata: JSON.stringify({ projectId: String(projectId), userId: identity })
    });

    token.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true
    });

    const jwt = await token.toJwt();
    return res.status(200).json({
      token: jwt,
      url: livekitUrl,
      roomName
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to create token', details: err.message });
  }
};
