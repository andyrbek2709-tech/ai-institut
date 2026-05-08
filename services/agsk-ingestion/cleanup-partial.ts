import { getSupabaseAdmin } from './src/services/supabase.js';
import { logger } from './src/utils/logger.js';

async function cleanup() {
  const sb = getSupabaseAdmin();

  // Get all standards
  const { data: standards } = await sb.from('agsk_standards').select('id, standard_code, status');
  
  for (const std of standards || []) {
    if (std.standard_code === 'AGSK 1') {
      logger.info({ standard_id: std.id }, '✅ Keeping AGSK-1 (successful)');
      continue;
    }
    
    if (std.status === 'failed' || std.standard_code.match(/AGSK-[23]/)) {
      // Delete chunks for this standard
      const { error: delErr } = await sb.from('agsk_chunks').delete().eq('standard_id', std.id);
      if (delErr) {
        logger.error({ err: delErr }, `Failed to delete chunks for ${std.standard_code}`);
      } else {
        logger.info({ standard_code: std.standard_code }, `Deleted chunks for ${std.standard_code}`);
      }
      
      // Delete standard record
      const { error: stdErr } = await sb.from('agsk_standards').delete().eq('id', std.id);
      if (stdErr) {
        logger.error({ err: stdErr }, `Failed to delete standard ${std.standard_code}`);
      } else {
        logger.info({ standard_code: std.standard_code }, `Deleted standard ${std.standard_code}`);
      }
    }
  }

  logger.info('Cleanup complete. Ready to re-ingest AGSK-2 and AGSK-3');
}

cleanup().catch(err => {
  logger.error({ err }, 'Cleanup failed');
  process.exit(1);
});
