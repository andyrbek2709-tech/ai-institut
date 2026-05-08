import { getSupabaseAdmin } from './src/services/supabase.js';
import { logger } from './src/utils/logger.js';

async function finalize() {
  const sb = getSupabaseAdmin();

  console.log('Finalizing ingestion...\n');

  // Get all standards still in processing
  const { data: standards } = await sb
    .from('agsk_standards')
    .select('id, standard_code, status')
    .eq('status', 'processing');

  for (const std of standards || []) {
    // Count chunks for this standard
    const { count: chunkCount } = await sb
      .from('agsk_chunks')
      .select('*', { count: 'exact', head: true })
      .eq('standard_id', std.id);

    // Update status to ready if chunks exist
    if (chunkCount && chunkCount > 0) {
      const { error: updateErr } = await sb
        .from('agsk_standards')
        .update({ status: 'ready', chunks_count: chunkCount })
        .eq('id', std.id);

      if (updateErr) {
        logger.error({ err: updateErr }, `Failed to update ${std.standard_code}`);
      } else {
        logger.info({ standard_code: std.standard_code, chunks: chunkCount }, `✅ Finalized ${std.standard_code}`);
      }
    } else {
      // No chunks, mark as failed
      const { error: updateErr } = await sb
        .from('agsk_standards')
        .update({ status: 'failed', error_message: 'No chunks ingested' })
        .eq('id', std.id);
      if (!updateErr) {
        logger.info({ standard_code: std.standard_code }, `⚠️ Marked ${std.standard_code} as failed (no chunks)`);
      }
    }
  }

  // Remove duplicates (keep only latest per standard)
  const { data: allStds } = await sb
    .from('agsk_standards')
    .select('id, standard_code, created_at')
    .order('created_at', { ascending: false });

  const seen = new Set<string>();
  for (const std of allStds || []) {
    if (seen.has(std.standard_code)) {
      // This is a duplicate, delete it
      await sb.from('agsk_standards').delete().eq('id', std.id);
      logger.debug({ standard_code: std.standard_code, id: std.id }, 'Deleted duplicate');
    } else {
      seen.add(std.standard_code);
    }
  }

  logger.info('\n✅ Finalization complete');
}

finalize().catch(err => {
  logger.error({ err }, 'Finalization failed');
  process.exit(1);
});
