const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
}

const supabase = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { endpoint, status_code, response_time, error, user_id } = req.body;

    // Validate required fields
    if (!endpoint || status_code === undefined || !response_time) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Record metric in Supabase (non-blocking)
    if (supabase) {
      supabase
        .from('api_metrics')
        .insert([
          {
            timestamp: new Date().toISOString(),
            provider: 'vercel',
            endpoint,
            status_code: parseInt(status_code),
            response_time: parseInt(response_time),
            error: error || null,
            user_id: user_id || null,
          },
        ])
        .catch(err => {
          console.error('Failed to record Vercel metric:', err);
        });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Error in log-metrics:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
