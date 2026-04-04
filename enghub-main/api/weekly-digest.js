const SURL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

// A7: Weekly AI digest — called by Vercel Cron every Monday 08:00 UTC
module.exports = async function handler(req, res) {
  // Allow Vercel Cron (GET) and manual trigger (POST)
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  if (!SURL || !SERVICE_KEY || !ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'Missing environment variables' });
  }

  const headers = {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json',
  };

  try {
    // Fetch all active projects
    const projectsRes = await fetch(`${SURL}/rest/v1/projects?status=eq.active&select=id,name,deadline`, { headers });
    const projects = await projectsRes.json();
    if (!Array.isArray(projects) || projects.length === 0) {
      return res.status(200).json({ ok: true, message: 'No active projects.' });
    }

    const now = new Date();
    const results = [];

    for (const project of projects) {
      try {
        const [tasksRes, reviewsRes] = await Promise.all([
          fetch(`${SURL}/rest/v1/tasks?project_id=eq.${project.id}&select=name,status,deadline`, { headers }),
          fetch(`${SURL}/rest/v1/reviews?project_id=eq.${project.id}&select=title,status,severity`, { headers }),
        ]);
        const tasks = await tasksRes.json();
        const reviews = await reviewsRes.json();

        const doneTasks = Array.isArray(tasks) ? tasks.filter(t => t.status === 'done').length : 0;
        const totalTasks = Array.isArray(tasks) ? tasks.length : 0;
        const overdueTasks = Array.isArray(tasks) ? tasks.filter(t => t.deadline && new Date(t.deadline) < now && t.status !== 'done').map(t => t.name) : [];
        const openReviews = Array.isArray(reviews) ? reviews.filter(r => r.status === 'open').length : 0;
        let daysLeft = project.deadline ? Math.ceil((new Date(project.deadline).getTime() - now.getTime()) / 86400000) : null;

        const ctx = {
          project: project.name,
          deadline: daysLeft !== null ? (daysLeft < 0 ? `просрочен на ${-daysLeft} дн.` : `через ${daysLeft} дн.`) : 'не задан',
          tasks: { total: totalTasks, done: doneTasks, overdue: overdueTasks.slice(0, 5) },
          open_reviews: openReviews,
        };

        const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 400,
            system: 'Ты составляешь краткий еженедельный дайджест для проектного института. Стиль деловой, лаконичный. Максимум 80 слов. По-русски.',
            messages: [{ role: 'user', content: `Данные:\n${JSON.stringify(ctx, null, 2)}` }],
          }),
        });
        const claudeData = await claudeRes.json();
        const digest = claudeData.content?.[0]?.text || 'Дайджест недоступен.';

        // Save digest as a notification for all GIPs in this project
        const gipsRes = await fetch(`${SURL}/rest/v1/app_users?role=eq.gip&select=id`, { headers });
        const gips = await gipsRes.json();
        if (Array.isArray(gips)) {
          for (const gip of gips) {
            await fetch(`${SURL}/rest/v1/notifications`, {
              method: 'POST',
              headers: { ...headers, Prefer: 'return=minimal' },
              body: JSON.stringify({
                user_id: gip.id,
                project_id: project.id,
                type: 'ai_digest',
                title: `Еженедельный дайджест: ${project.name}`,
                body: digest,
                read: false,
              }),
            });
          }
        }

        results.push({ project_id: project.id, project_name: project.name, ok: true });
      } catch (e) {
        results.push({ project_id: project.id, project_name: project.name, ok: false, error: e.message });
      }
    }

    return res.status(200).json({ ok: true, processed: results.length, results });
  } catch (err) {
    console.error('Weekly digest error:', err);
    return res.status(500).json({ error: 'Internal Server Error', details: err.message });
  }
};
