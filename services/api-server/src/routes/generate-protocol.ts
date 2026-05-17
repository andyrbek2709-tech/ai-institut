import { Router, Request, Response } from 'express';
import OpenAI from 'openai';
import { getSupabaseAdmin } from '../config/supabase.js';
import { ApiError } from '../middleware/errorHandler.js';
import { logger } from '../utils/logger.js';

const router = Router();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const SYSTEM_PROMPT = `Ты — опытный секретарь-делопроизводитель проектного института. На основе транскрипта аудиозаписи составь официальный протокол технического совещания на русском языке.

Правила оформления:
- Деловой стиль, третье лицо («было решено», «участники обсудили», «поручено»)
- Повестка — нумерованные пункты (каждый с новой строки: "1. Текст")
- Решения/поручения — каждое с новой строки в формате: "• Поручить [кому] — [что] — срок: [когда или 'по согласованию']"
- Если ответственный не назван явно — пиши "ответственный: не определён"
- Участников извлекай из транскрипта (упомянутые имена/должности) + список организатора; без дублей
- Если информация не прозвучала — не придумывай, оставь поле пустым
- Верни ТОЛЬКО JSON без markdown-обёрток

Формат ответа:
{
  "title": "Краткое название",
  "agenda": ["Пункт 1", "Пункт 2"],
  "decisions": ["Решение 1", "Решение 2"],
  "participants_str": "Имя1, Имя2, Имя3",
  "summary": "Краткое резюме совещания"
}`;

/**
 * POST /api/generate-protocol
 * Generates meeting protocol using GPT-4o
 *
 * Body: {
 *   transcript: string,
 *   project_name: string,
 *   participants: string[],
 *   meeting_id: string,
 *   project_id: number
 * }
 *
 * Returns: {
 *   protocol: { title, agenda, decisions, participants_str, summary },
 *   protocol_id: number,
 *   docx_url: string
 * }
 */
router.post('/generate-protocol', async (req: Request, res: Response): Promise<void> => {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

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
    const {
      transcript,
      project_name = 'Не указан',
      participants = [],
      meeting_id,
      project_id,
    } = req.body;

    if (!transcript || transcript.trim().length < 10) {
      res.status(400).json({ error: 'transcript обязателен и не может быть пустым' });
      return;
    }

    if (!meeting_id || !project_id) {
      res.status(400).json({ error: 'meeting_id и project_id обязательны' });
      return;
    }

    logger.info('Generating protocol', { meeting_id, project_id });

    const today = new Date().toLocaleDateString('ru-RU');
    const participantsHint =
      Array.isArray(participants) && participants.length > 0
        ? `Список участников, переданный организатором: ${participants.join(', ')}.`
        : '';

    const userPrompt = `Проект: ${project_name}
Дата совещания: ${today}

${participantsHint}

ТРАНСКРИПТ АУДИОЗАПИСИ:
${transcript}

Верни JSON строго в формате:
{
  "title": "Название протокола",
  "agenda": ["Пункт 1", "Пункт 2"],
  "decisions": ["Решение 1", "Решение 2"],
  "participants_str": "Участник1, Участник2",
  "summary": "Резюме"
}`;

    logger.info('Calling OpenAI GPT-4o');

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    });

    const content = completion.choices[0].message.content;
    if (!content) {
      throw new Error('OpenAI returned empty content');
    }

    const protocol = JSON.parse(content);

    logger.info('Protocol generated', { title: protocol.title });

    // Save to database (meetings table)
    const supabase = getSupabaseAdmin();

    const { data: protocolData, error: insertError } = await supabase
      .from('meetings')
      .insert({
        project_id,
        meeting_date: new Date().toISOString(),
        title: protocol.title,
        agenda: protocol.agenda,
        decisions: protocol.decisions,
        participants: protocol.participants_str,
        transcript: transcript.substring(0, 10000), // First 10k chars
        summary: protocol.summary,
      })
      .select()
      .single();

    if (insertError) {
      logger.error('Database insert error', { error: insertError.message });
      throw new ApiError(500, `Database insert error: ${insertError.message}`);
    }

    logger.info('Protocol saved to database', { protocol_id: protocolData.id });

    // Update video_meetings with protocol_id
    const { error: updateError } = await supabase
      .from('video_meetings')
      .update({ protocol_id: protocolData.id })
      .eq('id', meeting_id);

    if (updateError) {
      logger.warn('Failed to update video_meetings protocol_id', { error: updateError.message });
    }

    // Generate DOCX
    const docxContent = await generateDocxContent(protocol, project_name, today);

    // Save DOCX to storage
    const docxPath = `projects/${project_id}/meetings/${meeting_id}/protocols/protocol_${protocolData.id}.docx`;
    const docxBuffer = Buffer.from(docxContent, 'utf-8');

    const { error: uploadError } = await supabase.storage
      .from('project-files')
      .upload(docxPath, docxBuffer, {
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        upsert: true,
      });

    if (uploadError) {
      logger.warn('Failed to upload DOCX', { error: uploadError.message });
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('project-files')
      .getPublicUrl(docxPath);

    logger.info('DOCX generated', { url: urlData.publicUrl });

    res.status(200).json({
      protocol,
      protocol_id: protocolData.id,
      docx_url: urlData.publicUrl,
    });
  } catch (err) {
    logger.error('Generate protocol error', err);
    res.status(500).json({
      error: 'Internal Server Error',
      details: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

// Simple DOCX generator (plain text)
async function generateDocxContent(
  protocol: any,
  projectName: string,
  date: string
): Promise<string> {
  let content = '';

  content += `ПРОТОКОЛ ТЕХНИЧЕСКОГО СОВЕЩАНИЯ
`;
  content += `${protocol.title}
`;
  content += `Проект: ${projectName}
`;
  content += `Дата: ${date}

`;

  content += `УЧАСТНИКИ:
${protocol.participants_str}

`;

  content += `ПОВЕСТКА:
`;
  if (Array.isArray(protocol.agenda)) {
    protocol.agenda.forEach((item: string, i: number) => {
      content += `${i + 1}. ${item}
`;
    });
  }

  content += `
РЕШЕНИЯ / ПОРУЧЕНИЯ:
`;
  if (Array.isArray(protocol.decisions)) {
    protocol.decisions.forEach((item: string) => {
      content += `• ${item}
`;
    });
  }

  if (protocol.summary) {
    content += `
РЕЗЮМЕ:
${protocol.summary}
`;
  }

  return content;
}

export default router;