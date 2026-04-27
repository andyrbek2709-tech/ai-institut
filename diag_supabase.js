
const SURL = 'https://jbdljdwlfimvmqybzynv.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpiZGxqZHdsZmltdm1xeWJ6eW52Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4MDE4OTksImV4cCI6MjA5MDM3Nzg5OX0.HYn_-qGrRwwrkkKWE-xXlVGKpb2kTSCCgmbGmrV-lt0';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpiZGxqZHdsZmltdm1xeWJ6eW52Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDgwMTg5OSwiZXhwIjoyMDkwMzc3ODk5fQ.1lMpCV8kiMmswYAlKSrFpsPGwPd_dXFZ5LUQktfVeeY';

async function test() {
  console.log("--- Supabase Diagnostic ---");
  
  // 1. Test Service Key access
  try {
    const res = await fetch(`${SURL}/rest/v1/app_users?limit=5`, {
      headers: { 'apikey': KEY, 'Authorization': `Bearer ${SERVICE_KEY}` }
    });
    const data = await res.json();
    console.log("Service Key Access (app_users):", res.status, res.statusText);
    if (res.ok) {
      console.log("Data sample:", JSON.stringify(data, null, 2));
    } else {
      console.log("Error data:", data);
    }
  } catch (e) {
    console.error("Fetch failed:", e);
  }

  // 2. Test Anon Key access
  try {
    const res = await fetch(`${SURL}/rest/v1/projects?limit=1`, {
      headers: { 'apikey': KEY, 'Authorization': `Bearer ${KEY}` }
    });
    console.log("\nAnon Key Access (projects):", res.status, res.statusText);
  } catch (e) {
    console.error("Anon Fetch failed:", e);
  }
}

test();
