// Supabase Edge Function: search-normative
// Принимает текстовый запрос, генерирует эмбеддинг через OpenAI,
// вызывает search_normative() через Supabase RPC и возвращает результаты.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')!;

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { query, match_count = 15 } = await req.json();
    if (!query || !query.trim()) {
      return new Response(JSON.stringify({ error: 'query required' }), { status: 400, headers: corsHeaders });
    }

    // 1. Сгенерировать эмбеддинг для запроса через OpenAI
    const embRes = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: query.trim(),
      }),
    });

    if (!embRes.ok) {
      throw new Error(`OpenAI embeddings error: ${embRes.status}`);
    }

    const embData = await embRes.json();
    const embedding = embData.data[0].embedding;

    // 2. Вызвать search_normative() через Supabase RPC
    const rpcRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/search_normative`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query_embedding: embedding,
        match_count,
      }),
    });

    if (!rpcRes.ok) {
      throw new Error(`search_normative RPC error: ${rpcRes.status}`);
    }

    const results = await rpcRes.json();
    return new Response(JSON.stringify(results), { headers: corsHeaders });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('search-normative error:', message);
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: corsHeaders });
  }
});
