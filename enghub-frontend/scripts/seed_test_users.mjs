import fs from 'fs';

const SURL = 'https://jbdljdwlfimvmqybzynv.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpiZGxqZHdsZmltdm1xeWJ6eW52Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDgwMTg5OSwiZXhwIjoyMDkwMzc3ODk5fQ.1lMpCV8kiMmswYAlKSrFpsPGwPd_dXFZ5LUQktfVeeY';

const AdminH = {
  'apikey': SERVICE_KEY,
  'Authorization': `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
};

async function run() {
  console.log('Fetching departments...');
  let deptsRes = await fetch(`${SURL}/rest/v1/departments`, { headers: AdminH });
  let depts = await deptsRes.json();
  
  if (!depts || depts.length === 0) {
    console.log('No departments found. Creating default departments...');
    const defaultDepts = ['ТХ (Технология)', 'ТТ (Трубопроводы)', 'ЭО (Электрооборудование)', 'КЖ (Конструкции)', 'Генплан', 'АСУ ТП'];
    for (const d of defaultDepts) {
      await fetch(`${SURL}/rest/v1/departments`, {
        method: 'POST',
        headers: { ...AdminH, 'Prefer': 'return=representation' },
        body: JSON.stringify({ name: d })
      });
    }
    deptsRes = await fetch(`${SURL}/rest/v1/departments`, { headers: AdminH });
    depts = await deptsRes.json();
  }
  
  console.log(`Working with ${depts.length} departments.`);

  // 1. Fetch current users
  console.log('Fetching existing users from public.users...');
  const usersRes = await fetch(`${SURL}/rest/v1/users`, { headers: AdminH });
  const users = await usersRes.json();

  // We will leave real users alone, but we will create new standard test users.
  // GIP
  const gipEmail = `gip_test@enghub.local`;
  await createOrUpdateTestUser(gipEmail, "123456", "Тестовый ГИП", "gip", null);

  for (const dept of depts) {
      const deptCode = `dept${dept.id}`;
      
      // Lead
      const leadEmail = `lead_${deptCode}@enghub.local`;
      await createOrUpdateTestUser(leadEmail, "123456", `Руководитель ${dept.name}`, "lead", dept.id);
      
      // 2 Engineers per dept
      for(let i=1; i<=2; i++) {
        const engEmail = `eng${i}_${deptCode}@enghub.local`;
        await createOrUpdateTestUser(engEmail, "123456", `Инженер ${i} (${dept.name})`, "engineer", dept.id);
      }
  }
  
  console.log('============= SEEDING COMPLETE =============');
}

async function createOrUpdateTestUser(email, password, fullName, role, deptId) {
    console.log(`Processing ${email}...`);
    // 1. Create auth user
    let authRes = await fetch(`${SURL}/auth/v1/admin/users`, {
        method: 'POST',
        headers: AdminH,
        body: JSON.stringify({ email, password, email_confirm: true })
    });
    
    let authData = await authRes.json();
    let uid = authData.id;
    
    if (authData.code === 422 || authData.msg?.includes("already registered") || authData.code === 'user_already_exists') {
        // user exists, let's find them
        const searchRes = await fetch(`${SURL}/rest/v1/users?email=eq.${email}`, { headers: AdminH });
        const existingUsers = await searchRes.json();
        if (existingUsers && existingUsers.length > 0) {
            uid = existingUsers[0].id;
            console.log(`User ${email} already exists in public.users. Updating password...`);
            await fetch(`${SURL}/auth/v1/admin/users/${uid}`, {
                method: 'PUT',
                headers: AdminH,
                body: JSON.stringify({ password })
            });
        }
    }

    if (uid) {
        // Upsert into public.users
        await fetch(`${SURL}/rest/v1/users?id=eq.${uid}`, {
            method: 'PATCH',
            headers: AdminH,
            body: JSON.stringify({
                full_name: fullName,
                role: role,
                dept_id: deptId,
                email: email
            })
        });
        
        // If it didn't update (meaning it wasn't there yet, maybe trigger failed), try POST
        await fetch(`${SURL}/rest/v1/users`, {
            method: 'POST',
            headers: { ...AdminH, 'Prefer': 'resolution=ignore-duplicates' },
            body: JSON.stringify({
                id: uid,
                full_name: fullName,
                role: role,
                dept_id: deptId,
                email: email
            })
        });
        console.log(`✅ Synced ${email}`);
    } else {
        console.log(`❌ Failed to create auth user for ${email}`, authData);
    }
}

run().catch(console.error);
