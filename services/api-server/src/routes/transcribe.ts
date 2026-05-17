import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger.js';

const router = Router();

router.post('/transcribe', async (req: Request, res: Response): Promise<void> => {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (!OPENAI_API_KEY) {
    logger.error('OPENAI_API_KEY not configured');
    res.status(500).json({ error: 'OPENAI_API_KEY not configured' });
    return;
  }

  try {
    const { audio_base64, media_type = 'audio/mpeg', filename = 'audio.mp3' } = req.body;

    if (!audio_base64) {
      res.status(400).json({ error: 'audio_base64 required' });
      return;
    }

    logger.info('Transcription request', { filename, media_type });
    const audioBuffer = Buffer.from(audio_base64, 'base64');

    const boundary = `----WhisperBoundary${Date.now()}`;
    const CRLF = '\r\n';
    const metaPart = `--${boundary}${CRLF}Content-Disposition: form-data; name="model"${CRLF}${CRLF}whisper-1${CRLF}`;
    const langPart = `--${boundary}${CRLF}Content-Disposition: form-data; name="language"${CRLF}${CRLF}ru${CRLF}`;
    const fileHeader = `--${boundary}${CRLF}Content-Disposition: form-data; name="file"; filename="${filename}"${CRLF}Content-Type: ${media_type}${CRLF}${CRLF}`;
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
        'Content-Length': body.length.toString(),
      },
      body,
    });

    if (!whisperRes.ok) {
      const errText = await whisperRes.text();
      logger.error('Whisper API error', { status: whisperRes.status, error: errText });
      res.status(502).json({ error: 'Whisper API failed', details: errText });
      return;
    }

    const data = await whisperRes.json();
    const text = data.text || '';
    logger.info('Transcription successful', { length: text.length });
    res.status(200).json({ text, success: true });
  } catch (err) {
    logger.error('Transcription error', err);
    res.status(500).json({
      error: 'Internal Server Error',
      details: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

export default router;