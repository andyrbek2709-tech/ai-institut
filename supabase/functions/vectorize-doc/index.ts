// Supabase Edge Function: vectorize-doc (v2)
// Читает файл из Storage, извлекает текст (DOCX/PDF/TXT),
// разбивает на чанки, создаёт эмбеддинги через OpenAI,
// сохраняет векторы в normative_chunks для RAG-поиска.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')!;

const CHUNK_SIZE = 800;
const CHUNK_OVERLAP = 80;
const MAX_TEXT = 40000;

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
};

// ─────────────────────────────────────────────
// DOCX text extraction via JSZip (npm)
// ─────────────────────────────────────────────
async function extractDocxText(buffer: ArrayBuffer): Promise<string> {
  try {
    // JSZip is available via npm: imports in Supabase Edge Functions
    const JSZip = (await import('npm:jszip@3.10.1')).default;
    const zip = await JSZip.loadAsync(buffer);

    // word/document.xml contains the main body text
    const docFile = zip.file('word/document.xml');
    if (!docFile) {
      console.log('DOCX: word/document.xml not found');
      return '';
    }

    const xml = await docFile.async('string');

    // Convert paragraph/line breaks to newlines, then strip all tags
    const text = xml
      .replace(/<\/w:p>/gi, '\n')
      .replace(/<w:br[^>]*\/?>/gi, '\n')
      .replace(/<\/w:tr>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    console.log(`DOCX: extracted ${text.length} chars`);
    return text;
  } catch (e) {
    console.error('DOCX extraction error:', e);
    return '';
  }
}

// ─────────────────────────────────────────────
// PDF text extraction (text-layer PDFs only)
// ─────────────────────────────────────────────
async function extractPdfText(bytes: Uint8Array): Promise<string> {
  try {
    // In Deno, we can use Buffer from node:buffer
    const { Buffer } = await import('node:buffer');
    const pdf = (await import('npm:pdf-parse@1.1.1')).default;
    const data = await pdf(Buffer.from(bytes));
    const result = data.text.replace(/\s+/g, ' ').trim();
    console.log(`PDF: extracted ${result.length} chars using pdf-parse`);
    return result;
  } catch (e) {
    console.error('PDF extraction error (pdf-parse):', e);
    
    // Fallback: simple text scanner (limited)
    const parts: string[] = [];
    const raw = new TextDecoder('latin1').decode(bytes);
    const btBlocks = raw.match(/BT\b[\s\S]{1,5000}?\bET\b/g) || [];
    for (const blk of btBlocks) {
      for (const m of blk.matchAll(/\(([^)\\]*(?:\\.[^)\\]*)*)\)\s*Tj/g)) {
        parts.push(m[1].replace(/\\(\d{3})/g, (_, o) => String.fromCharCode(parseInt(o, 8))).replace(/\\\\/g, '\\'));
      }
    }
    const result = parts.join(' ').replace(/\s+/g, ' ').trim();
    console.log(`PDF Fallback: extracted ${result.length} chars`);
    return result;
  }
}

// ─────────────────────────────────────────────
// Split text into overlapping chunks
// ─────────────────────────────────────────────
function makeChunks(text: string): string[] {
  const chunks: string[] = [];
  let start = 0;
  
  // Cleaner text for chunking
  const cleanText = text.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
  
  while (start < cleanText.length) {
    let end = start + CHUNK_SIZE;
    
    // Try to find the end of a sentence for cleaner chunks
    if (end < cleanText.length) {
      const lastDot = cleanText.lastIndexOf('. ', end);
      if (lastDot > start + (CHUNK_SIZE * 0.7)) { // Only if the dot is reasonably far
        end = lastDot + 1;
      }
    } else {
      end = cleanText.length;
    }

    const chunk = cleanText.slice(start, end).trim();
    if (chunk.length > 50) chunks.push(chunk);
    
    if (end >= cleanText.length) break;
    start = end - CHUNK_OVERLAP;
  }
  return chunks;
}

// ─────────────────────────────────────────────
// Supabase REST helpers
// ─────────────────────────────────────────────
async function sbPatch(table: string, id: string, data: object) {
  await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
    method: 'PATCH',
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(data),
  });
}

async function sbDelete(table: string, docId: string) {
  await fetch(`${SUPABASE_URL}/rest/v1/${table}?doc_id=eq.${docId}`, {
    method: 'DELETE',
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      Prefer: 'return=minimal',
    },
  });
}

// ─────────────────────────────────────────────
// Main handler
// ─────────────────────────────────────────────
serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { doc_id } = await req.json();
    if (!doc_id) {
      return new Response(JSON.stringify({ error: 'doc_id required' }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    // 1. Fetch document metadata
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
      return new Response(JSON.stringify({ error: 'Document not found' }), {
        status: 404,
        headers: corsHeaders,
      });
    }
    const doc = docs[0];

    // 2. Set status → processing
    await sbPatch('normative_docs', doc_id, { status: 'processing' });

    // 3. Download file from Storage
    const fileUrl = `${SUPABASE_URL}/storage/v1/object/normative-docs/${doc.file_path}`;
    const fileRes = await fetch(fileUrl, {
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        apikey: SUPABASE_SERVICE_KEY,
      },
    });
    if (!fileRes.ok) {
      throw new Error(`Storage download failed: ${fileRes.status} ${await fileRes.text()}`);
    }

    const fileBuffer = await fileRes.arrayBuffer();
    const fileBytes = new Uint8Array(fileBuffer);
    const rawName = ((doc.file_path as string) || '').split('/').pop() || doc.name || '';
    const nameLower = rawName.toLowerCase();

    // 4. Extract text
    let text = '';
    if (nameLower.endsWith('.docx')) {
      text = await extractDocxText(fileBuffer);
    } else if (nameLower.endsWith('.pdf')) {
      text = await extractPdfText(fileBytes);
    } else if (nameLower.endsWith('.txt')) {
      text = new TextDecoder('utf-8', { fatal: false }).decode(fileBytes);
    } else if (nameLower.endsWith('.doc')) {
      // Legacy Word (binary) — scan for Cyrillic sequences
      const raw = new TextDecoder('utf-8', { fatal: false }).decode(fileBytes);
      const cyrillic = raw.match(/[а-яА-ЯёЁ][а-яА-ЯёЁ\s\d,.:;()\-–«»"'/]{15,}/g) || [];
      text = cyrillic.join(' ').trim();
    } else {
      text = new TextDecoder('utf-8', { fatal: false }).decode(fileBytes);
      text = text.replace(/[^\x20-\x7E\u0400-\u04FF\s]/g, ' ');
    }

    text = text.replace(/\s+/g, ' ').trim();
    if (text.length > MAX_TEXT) text = text.slice(0, MAX_TEXT);

    // If we couldn't get any text — mark as error and exit
    if (!text || text.length < 30) {
      await sbPatch('normative_docs', doc_id, {
        status: 'error',
        content: 'Текст не удалось извлечь. Возможно, файл является сканом без текстового слоя.',
      });
      return new Response(
        JSON.stringify({ success: false, chunks: 0, warning: 'No text extracted' }),
        { headers: corsHeaders }
      );
    }

    // 5. Split into chunks
    const chunks = makeChunks(text);
    console.log(`Chunked into ${chunks.length} chunks`);

    // 6. Delete old chunks for this doc (re-vectorize cleanly)
    await sbDelete('normative_chunks', doc_id);

    // 7. Build embeddings and prepare rows
    const insertRows = [];
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const embRes = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ model: 'text-embedding-3-small', input: chunk }),
      });
      if (!embRes.ok) {
        throw new Error(`OpenAI embeddings error: ${embRes.status}`);
      }
      const embData = await embRes.json();
      insertRows.push({
        doc_id,
        doc_name: doc.name || rawName,
        chunk_index: i,
        content: chunk,
        embedding: JSON.stringify(embData.data[0].embedding),
        status: 'ready',
      });
    }

    // 8. Insert chunks
    if (insertRows.length > 0) {
      const insRes = await fetch(`${SUPABASE_URL}/rest/v1/normative_chunks`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify(insertRows),
      });
      if (!insRes.ok) {
        const errBody = await insRes.text();
        throw new Error(`normative_chunks insert failed: ${insRes.status} ${errBody}`);
      }
    }

    // 9. Mark document as ready
    await sbPatch('normative_docs', doc_id, {
      status: 'ready',
      content: text.slice(0, 500),
    });

    return new Response(
      JSON.stringify({ success: true, chunks: insertRows.length }),
      { headers: corsHeaders }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('vectorize-doc error:', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
