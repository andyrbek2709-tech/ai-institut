const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// A5: Meeting transcription via OpenAI Whisper
// Accepts: POST { audio_base64: string, media_type: string, filename: string }
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  if (!OPENAI_API_KEY) {
    return res.status(500).json({ error: 'OPENAI_API_KEY not configured' });
  }

  try {
    const { audio_base64, media_type = 'audio/mpeg', filename = 'audio.mp3' } = req.body;
    if (!audio_base64) return res.status(400).json({ error: 'audio_base64 required' });

    const audioBuffer = Buffer.from(audio_base64, 'base64');

    // Build multipart/form-data manually
    const boundary = '----WhisperBoundary' + Date.now();
    const CRLF = '\r\n';

    const metaPart =
      `--${boundary}${CRLF}` +
      `Content-Disposition: form-data; name="model"${CRLF}${CRLF}` +
      `whisper-1${CRLF}`;

    const langPart =
      `--${boundary}${CRLF}` +
      `Content-Disposition: form-data; name="language"${CRLF}${CRLF}` +
      `ru${CRLF}`;

    const fileHeader =
      `--${boundary}${CRLF}` +
      `Content-Disposition: form-data; name="file"; filename="${filename}"${CRLF}` +
      `Content-Type: ${media_type}${CRLF}${CRLF}`;

    const footer = `${CRLF}--${boundary}--${CRLF}`;

    const body = Buffer.concat([
      Buffer.from(metaPart, 'utf8'),
      Buffer.from(langPart, 'utf8'),
      Buffer.from(fileHeader, 'utf8'),
      audioBuffer,
      Buffer.from(footer, 'utf8'),
    ]);

    const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length,
      },
      body,
    });

    if (!whisperRes.ok) {
      const errText = await whisperRes.text();
      console.error('Whisper error:', errText);
      return res.status(502).json({ error: 'Whisper API failed', details: errText });
    }

    const data = await whisperRes.json();
    return res.status(200).json({ text: data.text || '', success: true });
  } catch (err) {
    console.error('Transcribe error:', err);
    return res.status(500).json({ error: 'Internal Server Error', details: err.message });
  }
};
