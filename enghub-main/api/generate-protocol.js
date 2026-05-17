const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// POST { transcript, projectName, participants, date, token }
// Returns { title, agenda, decisions, participants_str }
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  if (!OPENAI_API_KEY) {
    return res.status(500).json({ error: 'OPENAI_API_KEY не настроен' });
  }

  const { transcript, projectName, participants, date } = req.body;
  if (!transcript || transcript.trim().length < 10) {
    return res.status(400).json({ error: 'transcript обязателен и не может быть пустым' });
  }

  const today = date || new Date().toLocaleDateString('ru-RU');
  const participantsHint = Array.isArray(participants) && participants.length > 0
    ? `Участники совещания: ${participants.join(', ')}.`
    : '';

  const systemPrompt = `Ты — опытный секретарь-делопроизводитель проектного института. Твоя задача — на основе транскрипта аудиозаписи составить официальный протокол совещания на русском языке.

Правила:
- Используй деловой стиль, третье лицо («было решено», «участники обсудили», «поручено»)
- Выдели конкретные задачи с ответственными и сроками, если они упомянуты
- Структурируй информацию логично
- Если что-то не упомянуто — не придумывай, пропусти поле
- Верни ТОЛЬКО JSON без markdown-обёрток`;

  const userPrompt = `Проект: ${projectName || 'не указан'}
Дата: ${today}
${participantsHint}

ТРАНСКРИПТ:
${transcript}

Составь протокол совещания и верни JSON в формате:
{
  "title": "краткое название темы совещания (1 строка)",
  "agenda": "повестка дня — что обсуждалось, основные вопросы (2-5 пунктов)",
  "decisions": "решения и поручения — конкретные задачи, ответственные, сроки (если упомянуты)",
  "participants_str": "уточнённый список участников из транскрипта (если упоминались имена)"
}`;

  try {
    const gptRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.3,
        max_tokens: 1200,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
      }),
    });

    if (!gptRes.ok) {
      const errText = await gptRes.text();
      console.error('GPT error:', errText);
      return res.status(502).json({ error: 'GPT API ошибка', details: errText });
    }

    const gptData = await gptRes.json();
    const content = gptData.choices?.[0]?.message?.content;
    if (!content) return res.status(502).json({ error: 'Пустой ответ от GPT' });

    let protocol;
    try {
      protocol = JSON.parse(content);
    } catch {
      return res.status(502).json({ error: 'GPT вернул невалидный JSON', raw: content });
    }

    return res.status(200).json({
      title: protocol.title || 'Совещание',
      agenda: protocol.agenda || '',
      decisions: protocol.decisions || '',
      participants_str: protocol.participants_str || (Array.isArray(participants) ? participants.join(', ') : ''),
      success: true,
    });
  } catch (err) {
    console.error('generate-protocol error:', err);
    return res.status(500).json({ error: 'Internal Server Error', details: err.message });
  }
};
