const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// POST { transcript, projectName, participants, date, token }
// Returns { title, agenda, decisions, participants_str, success }
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
    ? `Список участников, переданный организатором: ${participants.join(', ')}.`
    : '';

  const systemPrompt = `Ты — опытный секретарь-делопроизводитель проектного института. На основе транскрипта аудиозаписи составь официальный протокол технического совещания на русском языке.

Правила оформления:
- Деловой стиль, третье лицо («было решено», «участники обсудили», «поручено»)
- Повестка — нумерованные пункты (каждый с новой строки: "1. Текст")
- Решения/поручения — каждое с новой строки в формате: "• Поручить [кому] — [что] — срок: [когда или 'по согласованию']"
- Если ответственный не назван явно — пиши "ответственный: не определён"
- Участников извлекай из транскрипта (упомянутые имена/должности) + список организатора; без дублей
- Если информация не прозвучала — не придумывай, оставь поле пустым
- Верни ТОЛЬКО JSON без markdown-обёрток`;

  const userPrompt = `Проект: ${projectName || 'не указан'}
Дата совещания: ${today}
${participantsHint}

ТРАНСКРИПТ АУДИОЗАПИСИ:
${transcript}

Верни JSON строго в формате:
{
  "title": "краткое название темы совещания (до 10 слов)",
  "agenda": "нумерованная повестка дня, каждый пункт с новой строки (формат: 1. Рассмотрение хода проекта\\n2. Обсуждение сроков выпуска документации)",
  "decisions": "решения и поручения, каждое с новой строки (формат: • Поручить Иванову И.И. — выпустить чертёж ОВ-001 — срок: 15.06.2025\\n• Поручить Петрову А.С. — согласовать ТЗ с заказчиком — срок: по согласованию)",
  "participants_str": "имена участников через запятую (из транскрипта и списка организатора, без дублей)"
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
        temperature: 0.2,
        max_tokens: 1600,
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
