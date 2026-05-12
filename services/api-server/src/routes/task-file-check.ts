import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { getSupabaseAdmin } from '../config/supabase.js';
import { ApiError } from '../middleware/errorHandler.js';
import { env } from '../config/environment.js';
import OpenAI from 'openai';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';

const router = Router();

let _openai: OpenAI | null = null;
const getOpenAI = () => {
  if (!_openai) _openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  return _openai;
};

router.post('/task-file-check', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { task_id, project_id } = req.body;
    if (!task_id || !project_id) throw new ApiError(400, 'task_id and project_id required');
    const sb = getSupabaseAdmin();

    // Get task attachments
    const { data: attachments } = await sb
      .from('task_attachments')
      .select('id, name, storage_path, mime_type')
      .eq('task_id', task_id)
      .limit(3);

    if (!attachments?.length) {
      return res.json({ result: 'К задаче не прикреплено файлов.' });
    }

    // Get project ТЗ
    const { data: assignment } = await sb
      .from('project_assignments')
      .select('file_name, full_text')
      .eq('project_id', Number(project_id))
      .eq('is_current', true)
      .maybeSingle();

    // Extract text from first attachment
    const att = attachments[0];
    const { data: fileData, error: dlErr } = await sb.storage
      .from('project-files')
      .download(att.storage_path);

    if (dlErr || !fileData) {
      return res.json({ result: `Не удалось скачать файл: ${dlErr?.message}` });
    }

    const buf = Buffer.from(await fileData.arrayBuffer());
    let fileText = '';
    try {
      if ((att.mime_type || '').includes('pdf') || att.name.endsWith('.pdf')) {
        fileText = (await pdfParse(buf)).text;
      } else if (att.name.endsWith('.docx')) {
        fileText = (await mammoth.extractRawText({ buffer: buf })).value;
      } else {
        fileText = buf.toString('utf-8').slice(0, 4000);
      }
    } catch {
      fileText = buf.toString('utf-8').slice(0, 4000);
    }

    // Build ТЗ context
    let tzContext = 'ТЗ для проекта не загружено.';
    if (assignment?.full_text) {
      tzContext = `ТЗ: "${assignment.file_name || ''}"
${(assignment.full_text as string).slice(0, 2000)}`;
    }

    // Ask GPT-4o to compare
    const completion = await getOpenAI().chat.completions.create({
      model: 'gpt-4o',
      temperature: 0.2,
      max_tokens: 800,
      messages: [
        {
          role: 'system',
          content: 'Ты — инженер-контролёр. Сравни прикреплённый документ с техническим заданием проекта. Найди расхождения, нарушения и пропущенные требования. Будь конкретен. Отвечай по-русски.',
        },
        {
          role: 'user',
          content: `ТЕХНИЧЕСКОЕ ЗАДАНИЕ:\n${tzContext}\n\nДОКУМЕНТ (${att.name}):\n${fileText.slice(0, 3000)}\n\nНайди расхождения или подтверди соответствие.`,
        },
      ],
    });

    const result = completion.choices[0]?.message?.content || 'Нет ответа от AI';

    // ШАГ 9: Notify GIP if deviation detected
    const hasIssues = /расхождени|нарушени|не соответствует|отступлени/i.test(result);
    if (hasIssues) {
      const { data: project } = await sb
        .from('projects')
        .select('created_by')
        .eq('id', Number(project_id))
        .maybeSingle();
      if ((project as any)?.created_by) {
        await sb.from('notifications').insert({
          user_id: (project as any).created_by,
          project_id: Number(project_id),
          type: 'tz_deviation',
          title: 'Расхождение с ТЗ',
          body: `Файл "${att.name}" по задаче #${task_id}: AI обнаружил расхождения с ТЗ.`,
          entity_type: 'task',
          entity_id: String(task_id),
        });
      }
    }

    return res.json({ result, file_name: att.name, has_issues: hasIssues });
  } catch (e) {
    next(e);
  }
});

export default router;
