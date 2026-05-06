// api/meeting-token.js
// Выдаёт LiveKit Access Token для входа в комнату конкретной видеовстречи.
// Авторизация: Bearer token Supabase (как в spec-export). Перед выдачей токена
// проверяется, что пользователь есть в app_users и состоит в video_meeting_participants
// данной встречи (либо является её организатором / admin / gip).

const { AccessToken } = require('livekit-server-sdk');
const { extractBearer, verifyUserAndProfile } = require('./_spec_helpers');

const SURL = process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL || '';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.REACT_APP_SUPABASE_SERVICE_KEY || '';

const LIVEKIT_URL = process.env.LIVEKIT_URL || process.env.REACT_APP_LIVEKIT_URL || '';
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || '';
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || '';

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

async function fetchMeeting(meetingId, adminHeaders) {
  const url =
    `${SURL}/rest/v1/video_meetings?id=eq.${encodeURIComponent(meetingId)}` +
    `&select=id,project_id,title,started_at,ended_at,created_by&limit=1`;
  const r = await fetch(url, { headers: adminHeaders });
  const arr = await r.json().catch(() => []);
  return Array.isArray(arr) && arr[0] ? arr[0] : null;
}

async function fetchParticipantRow(meetingId, userId, adminHeaders) {
  const url =
    `${SURL}/rest/v1/video_meeting_participants` +
    `?meeting_id=eq.${encodeURIComponent(meetingId)}` +
    `&user_id=eq.${encodeURIComponent(userId)}&select=id,role&limit=1`;
  const r = await fetch(url, { headers: adminHeaders });
  const arr = await r.json().catch(() => []);
  return Array.isArray(arr) && arr[0] ? arr[0] : null;
}

async function upsertParticipant(meetingId, userId, role, adminHeaders) {
  // Идемпотентный апсёрт: один (meeting_id,user_id) — одна строка участника.
  const url = `${SURL}/rest/v1/video_meeting_participants?on_conflict=meeting_id,user_id`;
  await fetch(url, {
    method: 'POST',
    headers: {
      ...adminHeaders,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify([{
      meeting_id: meetingId,
      user_id: userId,
      role: role || 'participant',
      joined_at: new Date().toISOString(),
    }]),
  });
}

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
      return res.status(500).json({ error: 'LiveKit env (LIVEKIT_URL/API_KEY/API_SECRET) не сконфигурирован' });
    }
    if (!SURL || !SERVICE_KEY) {
      return res.status(500).json({ error: 'Supabase env не сконфигурирован' });
    }

    const bearer = extractBearer(req);
    const auth = await verifyUserAndProfile(bearer);
    if (!auth.ok) return res.status(auth.status || 401).json({ error: auth.error });
    const { user, adminHeaders } = auth;

    const body = req.body || {};
    const meetingId = body.meetingId || body.meeting_id;
    if (!meetingId) return res.status(400).json({ error: 'meetingId is required' });

    const meeting = await fetchMeeting(meetingId, adminHeaders);
    if (!meeting) return res.status(404).json({ error: 'Встреча не найдена' });

    if (meeting.ended_at) {
      return res.status(410).json({ error: 'Встреча уже завершена' });
    }

    // Доступ: admin / gip / организатор / уже добавленный участник.
    const role = String(user.role || '').toLowerCase();
    const isPrivileged = role === 'admin' || role.includes('gip') || role.includes('гип');
    const isOwner = String(meeting.created_by || '') === String(user.id || '');
    let participant = null;
    if (!isPrivileged && !isOwner) {
      participant = await fetchParticipantRow(meeting.id, user.id, adminHeaders);
      if (!participant) {
        return res.status(403).json({ error: 'Вы не приглашены на эту встречу' });
      }
    }

    // Гарантируем, что есть строка участника — обновится joined_at.
    const lkRole = isOwner ? 'host' : (participant && participant.role) || 'participant';
    await upsertParticipant(meeting.id, user.id, lkRole, adminHeaders);

    const roomName = `meeting-${meeting.id}`;
    const identity = String(user.id);
    const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity,
      name: user.full_name || user.email || `user-${identity}`,
      ttl: '2h',
      metadata: JSON.stringify({
        meetingId: String(meeting.id),
        userId: identity,
        role: lkRole,
      }),
    });
    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    const jwt = await at.toJwt();

    return res.status(200).json({
      url: LIVEKIT_URL,
      token: jwt,
      roomName,
      meetingId: meeting.id,
      meetingTitle: meeting.title || '',
      startedAt: meeting.started_at,
      role: lkRole,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to create meeting token', details: String(err && err.message || err) });
  }
};
