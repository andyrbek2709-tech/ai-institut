// Supabase Edge Function: vectorize-doc
// Запускается после загрузки PDF/DOCX в normative_docs.
// Читает файл из Storage, разбивает на чанки, создаёт эмбеддинги через OpenAI,
// сохраняет векторы в normative_docs для RAG-поиска.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')!;

const CHUNK_SIZE = 500; // символов на чанк
const CHUNK_OVERLAP = 50;

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, content-type',
      },
    });
  }

  try {
    const { doc_id } = await req.json();
    if (!doc_id) {
      return new Response(JSON.stringify({ error: 'doc_id required' }), { status: 400 });
    }

    // 1. Получить метаданные документа
    const docRes = await fetch(
      `${SUPABASE_URL}/rest/v1/normative_docs?id=eq.${doc_id}&select=*`,
      {
        headers: {
          apikey: SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        },
      }
    );
    const docs = await docRes.json();
    if (!docs || docs.length === 0) {
      return new Response(JSON.stringify({ error: 'Document not found' }), { status: 404 });
    }
    const doc = docs[0];

    // 2. Обновить статус на "processing"
    await fetch(`${SUPABASE_URL}/rest/v1/normative_docs?id=eq.${doc_id}`, {
      method: 'PATCH',
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ status: 'processing' }),
    });

    // 3. Скачать файл из Supabase Storage
    const fileUrl = `${SUPABASE_URL}/storage/v1/object/normative-docs/${doc.file_path}`;
    const fileRes = await fetch(fileUrl, {
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        apikey: SUPABASE_SERVICE_KEY,
      },
    });

    if (!fileRes.ok) {
      throw new Error(`Failed to download file: ${fileRes.status}`);
    }

    const fileBuffer = await fileRes.arrayBuffer();
    const fileBytes = new Uint8Array(fileBuffer);

    // 4. Извлечь текст из файла
    // Для PDF используем простое извлечение текста через декодирование
    // В production рекомендуется использовать специализированную библиотеку
    let text = '';
    const fileName = doc.file_name || doc.name || '';

    if (fileName.toLowerCase().endsWith('.pdf')) {
      // Извлечение текста из PDF через базовый парсинг (BT...ET блоки)
      const pdfStr = new TextDecoder('latin1').decode(fileBytes);
      const textMatches = pdfStr.match(/BT[\s\S]*?ET/g) || [];
      const extractedParts: string[] = [];
      for (const block of textMatches) {
        const tjMatches = block.match(/\(([^)]+)\)\s*Tj/g) || [];
        for (const tj of tjMatches) {
          const content = tj.replace(/^\(/, '').replace(/\)\s*Tj$/, '');
          extractedParts.push(content);
        }
      }
      text = extractedParts.join(' ').replace(/\s+/g, ' ').trim();
    } else {
      // Для DOCX/TXT — декодируем как UTF-8
      text = new TextDecoder('utf-8', { fatal: false }).decode(fileBytes);
      // Убираем бинарные символы
      text = text.replace(/[^\x20-\x7E\u0400-\u04FF\s]/g, ' ').replace(/\s+/g, ' ').trim();
    }

    // Ограничиваем текст для соблюдения лимита Edge Function (60 сек)
    const MAX_TEXT = 25000;
    if (text.length > MAX_TEXT) text = text.slice(0, MAX_TEXT);

    if (!text || text.length < 50) {
      // Если текст не извлечён — помечаем как ready с пустым содержимым
      await fetch(`${SUPABASE_URL}/rest/v1/normative_docs?id=eq.${doc_id}`, {
        method: 'PATCH',
        headers: {
          apikey: SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({ status: 'ready', content: 'Текст не удалось извлечь' }),
      });
      return new Response(JSON.stringify({ success: true, chunks: 0, warning: 'No text extracted' }));
    }

    // 5. Разбить текст на чанки
    const chunks: string[] = [];
    let start = 0;
    while (start < text.length) {
      const end = Math.min(start + CHUNK_SIZE, text.length);
      chunks.push(text.slice(start, end));
      start += CHUNK_SIZE - CHUNK_OVERLAP;
    }

    // 6. Создать эмбеддинги через OpenAI для каждого чанка
    const insertRows = [];
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      if (!chunk.trim()) continue;

      const embRes = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          input: chunk,
        }),
      });

      if (!embRes.ok) {
        throw new Error(`OpenAI embeddings error: ${embRes.status}`);
      }

      const embData = await embRes.json();
      const embedding = embData.data[0].embedding;

      insertRows.push({
        doc_id,
        doc_name: doc.name || fileName,
        chunk_index: i,
        content: chunk,
        embedding: JSON.stringify(embedding),
        status: 'ready',
      });
    }

    // 7. Сохранить чанки в таблицу normative_chunks
    if (insertRows.length > 0) {
      await fetch(`${SUPABASE_URL}/rest/v1/normative_chunks`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify(insertRows),
      });
    }

    // 8. Обновить статус документа на "ready"
    await fetch(`${SUPABASE_URL}/rest/v1/normative_docs?id=eq.${doc_id}`, {
      method: 'PATCH',
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        status: 'ready',
        content: text.slice(0, 500), // превью первых 500 символов
      }),
    });

    const corsHeaders = {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, content-type',
    };
    return new Response(
      JSON.stringify({ success: true, chunks: insertRows.length }),
      { headers: corsHeaders }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('vectorize-doc error:', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
});
