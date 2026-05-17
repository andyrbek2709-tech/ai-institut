#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('SUPABASE_URL and SUPABASE_SERVICE_KEY required');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

/**
 * Удаляет аудиофайлы совещаний старше 7 дней
 * Протоколы остаются в базе, только аудио удаляется из Storage
 */
async function cleanupOldMeetingAudio() {
  console.log('🧹 Starting meeting audio cleanup...');
  
  try {
    // Находим совещания, закончившиеся более 7 дней назад
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    const { data: oldMeetings, error: fetchError } = await supabase
      .from('video_meetings')
      .select('id, audio_url, title, ended_at')
      .lt('ended_at', sevenDaysAgo.toISOString())
      .not('audio_url', 'is', null);
    
    if (fetchError) {
      console.error('❌ Error fetching old meetings:', fetchError.message);
      process.exit(1);
    }
    
    if (!oldMeetings || oldMeetings.length === 0) {
      console.log('✅ No old meeting audio files to cleanup');
      return;
    }
    
    console.log(`\n📋 Found ${oldMeetings.length} meetings with old audio:\n`);
    
    let deletedCount = 0;
    let failedCount = 0;
    
    for (const meeting of oldMeetings) {
      console.log(`  • ${meeting.title} (${new Date(meeting.ended_at).toLocaleDateString('ru-RU')})`);
      
      if (!meeting.audio_url) {
        console.log(`    ⚠️  No audio_url, skipping`);
        continue;
      }
      
      try {
        // Удаляем файл из Storage
        const { error: deleteError } = await supabase.storage
          .from('project-files')
          .remove([meeting.audio_url]);
        
        if (deleteError) {
          console.log(`    ❌ Delete failed: ${deleteError.message}`);
          failedCount++;
          continue;
        }
        
        // Обновляем запись (убираем audio_url)
        const { error: updateError } = await supabase
          .from('video_meetings')
          .update({ audio_url: null })
          .eq('id', meeting.id);
        
        if (updateError) {
          console.log(`    ⚠️  Update failed: ${updateError.message}`);
        }
        
        console.log(`    ✅ Deleted`);
        deletedCount++;
        
      } catch (err) {
        console.log(`    ❌ Error: ${err instanceof Error ? err.message : 'Unknown'}`);
        failedCount++;
      }
    }
    
    console.log(`\n📊 Cleanup summary:`);
    console.log(`  ✅ Deleted: ${deletedCount}`);
    console.log(`  ❌ Failed:  ${failedCount}`);
    console.log(`  📦 Total:   ${oldMeetings.length}`);
    
    if (failedCount === 0) {
      console.log(`\n🎉 Cleanup completed successfully!`);
    } else {
      console.log(`\n⚠️  Some files failed to delete, check logs`);
    }
    
  } catch (err) {
    console.error('❌ Fatal error:', err);
    process.exit(1);
  }
}

// Запускаем
cleanupOldMeetingAudio()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Unhandled error:', err);
    process.exit(1);
  });
