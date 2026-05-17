import { Router, Request, Response } from 'express';
import { getSupabaseAdmin } from '../config/supabase.js';
import { ApiError } from '../middleware/errorHandler.js';
import { logger } from '../utils/logger.js';

const router = Router();

/**
 * POST /api/meetings/upload-audio
 * Uploads meeting audio to Supabase Storage
 *
 * Body: {
 *   meeting_id: string (uuid),
 *   audio_base64: string (base64 encoded),
 *   filename: string,
 *   project_id: number
 * }
 *
 * Returns: {
 *   path: string,
 *   url: string,
 *   audio_url: string
 * }
 */
router.post('/meetings/upload-audio', async (req: Request, res: Response): Promise<void> => {
  try {
    const { meeting_id, audio_base64, filename, project_id } = req.body;

    if (!meeting_id || !audio_base64 || !filename) {
      res.status(400).json({ error: 'meeting_id, audio_base64, filename required' });
      return;
    }

    logger.info('Meeting audio upload', { meeting_id, filename, project_id });

    const supabase = getSupabaseAdmin();

    // Convert base64 to buffer
    const audioBuffer = Buffer.from(audio_base64, 'base64');

    // Storage path: projects/{project_id}/meetings/{meeting_id}/audio/{filename}
    const storagePath = `projects/${project_id}/meetings/${meeting_id}/audio/${filename}`;

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('project-files')
      .upload(storagePath, audioBuffer, {
        contentType: 'audio/mpeg',
        upsert: true,
      });

    if (uploadError) {
      logger.error('Storage upload error', { error: uploadError.message });
      throw new ApiError(500, `Storage upload error: ${uploadError.message}`);
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('project-files')
      .getPublicUrl(storagePath);

    // Update video_meetings table with audio_url
    const { error: updateError } = await supabase
      .from('video_meetings')
      .update({ audio_url: storagePath })
      .eq('id', meeting_id);

    if (updateError) {
      logger.warn('Failed to update video_meetings audio_url', { error: updateError.message });
      // Don't fail - audio is uploaded
    }

    logger.info('Audio uploaded successfully', { path: storagePath });

    res.status(200).json({
      path: storagePath,
      url: urlData.publicUrl,
      audio_url: storagePath,
    });
  } catch (err) {
    logger.error('Meeting audio upload error', err);
    res.status(500).json({
      error: 'Internal Server Error',
      details: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/meetings/:id/download-audio
 * Returns signed URL for downloading meeting audio
 */
router.get('/meetings/:id/download-audio', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const supabase = getSupabaseAdmin();

    // Get meeting audio_url
    const { data: meeting, error: meetingError } = await supabase
      .from('video_meetings')
      .select('audio_url')
      .eq('id', id)
      .single();

    if (meetingError || !meeting) {
      res.status(404).json({ error: 'Meeting not found' });
      return;
    }

    if (!meeting.audio_url) {
      res.status(404).json({ error: 'Audio not found for this meeting' });
      return;
    }

    // Create signed URL (valid for 1 hour)
    const { data: signedUrlData, error: signError } = await supabase.storage
      .from('project-files')
      .createSignedUrl(meeting.audio_url, 3600);

    if (signError) {
      throw new ApiError(500, `Signed URL error: ${signError.message}`);
    }

    res.json({
      signed_url: signedUrlData.signedUrl,
      expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
    });
  } catch (err) {
    logger.error('Download audio error', err);
    res.status(500).json({
      error: 'Internal Server Error',
      details: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

export default router;