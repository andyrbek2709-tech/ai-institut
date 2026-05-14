import { getSupabaseAdmin } from '../config/supabase.js';
import { logger } from '../utils/logger.js';
import { createHash } from 'crypto';

export interface ReportData {
  projectId: number;
  discipline: string;
  content: string;
  userId: string;
  contextSnapshot?: {
    tzVersion: string;
    normativeReferences: string[];
  };
}

export class ReportLifecycleManager {
  /**
   * Генерация и сохранение отчета в таблицу reports
   */
  async generateReport(data: ReportData) {
    const sb = getSupabaseAdmin();
    
    // Stage 2: Normalization & Deterministic Hashing
    // Нормализуем данные: сортируем ссылки на нормативы, убираем лишние пробелы
    const normalizedContent = JSON.stringify({
      content: data.content.trim(),
      discipline: data.discipline,
      context: data.contextSnapshot ? {
        tz: data.contextSnapshot.tzVersion,
        refs: [...data.contextSnapshot.normativeReferences].sort()
      } : null
    });
    
    // Считаем хеш от нормализованного JSON для детерминизма
    const checksum = createHash('sha256').update(normalizedContent, 'utf8').digest('hex');
    
    const { data: report, error } = await sb.from('reports').insert({
      project_id: data.projectId,
      discipline: data.discipline,
      content: data.content,
      checksum: checksum,
      status: 'generated',
      created_by: data.userId
    }).select().single();

    if (error) {
      logger.error({ err: error.message }, 'ReportLifecycleManager: generateReport failed');
      throw error;
    }

    return report;
  }

  async signReport(reportId: string, userId: string) {
    const sb = getSupabaseAdmin();
    // Логика подписи: просто апдейт статуса (пока)
    return await sb.from('reports').update({ status: 'approved', signed_by: userId }).eq('id', reportId);
  }
}

export const reportManager = new ReportLifecycleManager();
