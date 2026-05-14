import { getSupabaseAdmin } from '../config/supabase.js';
import { logger } from '../utils/logger.js';
import { createHash } from 'crypto';

export interface ReportData {
  projectId: string;
  discipline: string;
  content: string; // В перспективе — JSON-структура
  authorId: string;
}

export class ReportLifecycleManager {
  /**
   * Генерация и сохранение отчета в таблицу reports
   */
  async generateReport(data: ReportData) {
    const sb = getSupabaseAdmin();
    
    // Создаем хеш-сумму контента для обеспечения целостности (Stage 7)
    const checksum = createHash('sha256').update(data.content, 'utf8').digest('hex');
    
    const { data: report, error } = await sb.from('reports').insert({
      project_id: data.projectId,
      discipline: data.discipline,
      content: data.content,
      checksum: checksum,
      status: 'generated',
      created_by: data.authorId
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
