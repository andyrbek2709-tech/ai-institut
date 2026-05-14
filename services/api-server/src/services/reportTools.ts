import { getSupabaseAdmin } from '../config/supabase.js';
import { logger } from '../utils/logger.js';

// ── TOOL: diff_reports ─────────────────────────────────────────────────────

export async function execDiffReports(args: { discipline: string }, projectId: string | number) {
  if (!projectId) {
    return { error: 'project_id не передан в сессии — сравнение невозможно' };
  }
  try {
    const sb = getSupabaseAdmin();
    const { data: report, error: reportError } = await sb.from('reports')
      .select('id')
      .eq('project_id', projectId)
      .eq('discipline', args.discipline)
      .maybeSingle();

    if (reportError || !report) {
      return { error: `Отчет по дисциплине "${args.discipline}" не найден.` };
    }

    const { data: revisions, error: revError } = await sb.from('report_revisions')
      .select('id, content, checksum, created_at, created_by')
      .eq('report_id', report.id)
      .order('created_at', { ascending: false })
      .limit(2);

    if (revError) {
      return { error: 'Не удалось получить ревизии: ' + revError.message };
    }

    if (!revisions || revisions.length < 2) {
      return { message: 'Доступна только одна версия отчета. Сравнивать не с чем.' };
    }

    const current = revisions[0];
    const previous = revisions[1];
    const diffLines = current.content.split('\n').length;
    const prevLines = previous.content.split('\n').length;
    const delta = diffLines - prevLines;

    return {
      current_revision_id: current.id,
      previous_revision_id: previous.id,
      current_checksum: current.checksum,
      previous_checksum: previous.checksum,
      current_lines: diffLines,
      previous_lines: prevLines,
      delta_lines: delta,
      message: `Текущая версия: ${diffLines} строк (checksum ${current.checksum}). Предыдущая: ${prevLines} строк (checksum ${previous.checksum}). Разница: ${delta} строк.`,
    };
  } catch (e: any) {
    logger.error({ err: e?.message }, 'diff_reports tool failed');
    return { error: 'Не удалось сравнить ревизии: ' + (e?.message || 'unknown') };
  }
}

// ── TOOL: approve_report ───────────────────────────────────────────────────

export async function execApproveReport(args: { discipline: string }, projectId: string | number, userId: string) {
  if (!projectId) {
    return { error: 'project_id не передан в сессии — утверждение невозможно' };
  }
  try {
    const sb = getSupabaseAdmin();
    const { data: report, error } = await sb.from('reports')
      .select('id, checksum')
      .eq('project_id', projectId)
      .eq('discipline', args.discipline)
      .maybeSingle();

    if (error || !report) {
      return { error: `Отчет по дисциплине "${args.discipline}" не найден.` };
    }

    await sb.from('reports').update({ status: 'approved', signed_by: userId }).eq('id', report.id);
    await sb.from('report_audit_log').insert({
      report_id: report.id,
      action: 'signed',
      signer_id: userId,
      signature_hash: report.checksum
    });

    return {
      success: true,
      report_id: report.id,
      status: 'approved',
      message: `Отчет #${report.id} по дисциплине "${args.discipline}" утвержден и подписан.`,
    };
  } catch (e: any) {
    logger.error({ err: e?.message }, 'approve_report tool failed');
    return { error: 'Не удалось утвердить отчет: ' + (e?.message || 'unknown') };
  }
}