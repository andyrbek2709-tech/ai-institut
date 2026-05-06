// Скрипт для регистрации существующих пользователей в Supabase Auth
// Запуск: node fix_users.js

const SURL = 'https://jbdljdwlfimvmqybzynv.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpiZGxqZHdsZmltdm1xeWJ6eW52Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4MDE4OTksImV4cCI6MjA5MDM3Nzg5OX0.HYn_-qGrRwwrkkKWE-xXlVGKpb2kTSCCgmbGmrV-lt0';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpiZGxqZHdsZmltdm1xeWJ6eW52Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDgwMTg5OSwiZXhwIjoyMDkwMzc3ODk5fQ.1lMpCV8kiMmswYAlKSrFpsPGwPd_dXFZ5LUQktfVeeY';
const PASSWORD = '123456';

async function main() {
  console.log('=== Регистрация пользователей в Supabase Auth ===\n');

  // 1. Получаем всех пользователей из app_users
  const res = await fetch(`${SURL}/rest/v1/app_users?order=id`, {
    headers: { 'apikey': KEY, 'Authorization': `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' }
  });
  const users = await res.json();

  if (!Array.isArray(users)) {
    console.log('Ошибка загрузки пользователей:', users);
    return;
  }

  console.log(`Найдено ${users.length} пользователей в app_users\n`);

  for (const user of users) {
    if (user.email === 'admin@enghub.com') {
      console.log(`⏭  ${user.full_name} (${user.email}) — пропуск (admin)`);
      continue;
    }

    console.log(`\n👤 ${user.full_name} (${user.email})`);

    // Создаём в Supabase Auth
    const authRes = await fetch(`${SURL}/auth/v1/admin/users`, {
      method: 'POST',
      headers: { 'apikey': KEY, 'Authorization': `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: user.email, password: PASSWORD, email_confirm: true })
    });
    const authData = await authRes.json();

    if (authData.id) {
      console.log(`   ✅ Зарегистрирован в Auth (uid: ${authData.id.slice(0, 8)}...)`);

      // Обновляем supabase_uid в app_users
      const updateRes = await fetch(`${SURL}/rest/v1/app_users?id=eq.${user.id}`, {
        method: 'PATCH',
        headers: { 'apikey': KEY, 'Authorization': `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
        body: JSON.stringify({ supabase_uid: authData.id })
      });
      console.log(`   ✅ supabase_uid обновлён`);
    } else if (authData.msg?.includes('already') || authData.message?.includes('already') || authData.error_description?.includes('already')) {
      console.log(`   ⚠️  Уже зарегистрирован в Auth — обновляем пароль`);
      
      // Ищем uid через список пользователей Auth
      const listRes = await fetch(`${SURL}/auth/v1/admin/users?page=1&per_page=1000`, {
        headers: { 'apikey': KEY, 'Authorization': `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' }
      });
      const listData = await listRes.json();
      const authUser = (listData.users || []).find(u => u.email === user.email);
      
      if (authUser) {
        // Обновляем пароль
        await fetch(`${SURL}/auth/v1/admin/users/${authUser.id}`, {
          method: 'PUT',
          headers: { 'apikey': KEY, 'Authorization': `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: PASSWORD })
        });
        console.log(`   ✅ Пароль обновлён`);

        // Обновляем supabase_uid
        await fetch(`${SURL}/rest/v1/app_users?id=eq.${user.id}`, {
          method: 'PATCH',
          headers: { 'apikey': KEY, 'Authorization': `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
          body: JSON.stringify({ supabase_uid: authUser.id })
        });
        console.log(`   ✅ supabase_uid обновлён`);
      }
    } else {
      console.log(`   ❌ Ошибка:`, JSON.stringify(authData));
    }
  }

  console.log('\n=== Готово! Все пользователи могут войти с паролем:', PASSWORD, '===');
}

main().catch(console.error);
