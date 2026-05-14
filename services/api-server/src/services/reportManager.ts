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
    const normalizedContent = JSON.stringify({
      content: data.content.trim(),
      discipline: data.discipline,
      context: data.contextSnapshot ? {
        tz: data.contextSnapshot.tzVersion,
        refs: [...data.contextSnapshot.normativeReferences].sort()
      } : null
    });
    
    const checksum = createHash('sha256').update(normalizedContent, 'utf8').digest('hex');
    
    // Проверяем, есть ли уже отчет по этой дисциплине в проекте
    const { data: existing } = await sb.from('reports')
      .select('id')
      .eq('project_id', data.projectId)
      .eq('discipline', data.discipline)
      .maybeSingle();

    if (existing) {
      // Stage 3: Если отчет уже есть — создаем ревизию
      return await this.createRevision(existing.id, data);
    }

    // Иначе создаем новый отчет
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

  async createRevision(reportId: string, data: ReportData) {
    const sb = getSupabaseAdmin();
    const normalizedContent = JSON.stringify({
      content: data.content.trim(),
      discipline: data.discipline,
      context: data.contextSnapshot ? {
        tz: data.contextSnapshot.tzVersion,
        refs: [...data.contextSnapshot.normativeReferences].sort()
      } : null
    });
    const checksum = createHash('sha256').update(normalizedContent, 'utf8').digest('hex');

    const { data: rev, error } = await sb.from('report_revisions').insert({
      report_id: reportId,
      content: data.content,
      checksum,
      created_by: data.userId
    }).select().single();

    if (error) throw error;
    
    // Обновляем основной статус отчета
    await sb.from('reports').update({ status: 'updated', updated_at: new Date() }).eq('id', reportId);
    
    return rev;
  }

  async signReport(reportId: string, userId: string, signatureHash: string) {
    const sb = getSupabaseAdmin();
    // 1. Ставим подпись
    await sb.from('reports').update({ status: 'approved', signed_by: userId }).eq('id', reportId);
    // 2. Логируем
    await sb.from('report_audit_log').insert({ report_id: reportId, action: 'signed', signer_id: userId, signature_hash: signatureHash });
  }

}

export const reportManager = new ReportLifecycleManager();
