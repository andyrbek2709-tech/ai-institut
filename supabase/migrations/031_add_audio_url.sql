-- Migration: Add audio_url and protocol_id to video_meetings
-- Date: 2025-01-17

ALTER TABLE video_meetings
ADD COLUMN IF NOT EXISTS audio_url text;

ALTER TABLE video_meetings
ADD COLUMN IF NOT EXISTS protocol_id bigint REFERENCES meetings(id) ON DELETE SET NULL;

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS video_meetings_audio_url_idx ON video_meetings(audio_url);
CREATE INDEX IF NOT EXISTS video_meetings_protocol_id_idx ON video_meetings(protocol_id);

-- Comment
COMMENT ON COLUMN video_meetings.audio_url IS 'Storage path to audio recording (project-files bucket)';
COMMENT ON COLUMN video_meetings.protocol_id IS 'Link to generated protocol in meetings table';
