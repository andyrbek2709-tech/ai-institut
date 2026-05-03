export const LANG_META = {
  ru: { name: "русский", flag: "🇷🇺", badge: "🇷🇺 RU" },
  kk: { name: "казахский", flag: "🇰🇿", badge: "🇰🇿 KZ" },
  en: { name: "English", flag: "🇬🇧", badge: "🇬🇧 EN" },
};

export function getLangMeta(lang) {
  return LANG_META[lang] || LANG_META.ru;
}

// Per-language reaction examples that the LLM uses as the FIRST short part of a reply.
export const REACTION_EXAMPLES = {
  ru: ["Я вас поняла", "Отлично, спасибо", "Хорошо что уточнили", "Запишу так", "Ок"],
  kk: ["Түсіндім", "Жақсы", "Қосымша үшін рахмет", "Осындай жазып қоямын"],
  en: ["Got it", "Thanks—that helps", "Noted", "Perfect", "Ok"],
};

// Per-language micro-fallbacks used if the LLM returns a contact-clarifying turn malformed.
export const CONTACT_REASK = {
  ru: "Как с вами лучше связаться — номер телефона или здесь в Telegram?",
  kk: "Сізбен қалай жақсы байланысуға болады — телефон нөмірі немесе осы Telegram-да?",
  en: "What's the best way to reach you — phone number or here in Telegram?",
};

const SYSTEM_PROMPT_BASE = `Ты — менеджер рекламного агентства.

Твоя задача — НЕ просто задавать вопросы по списку, а вести клиента и собрать заказ.
Ты работаешь как живой человек, а не анкета.

====================
ЯЗЫК (КРИТИЧНО)
====================

Клиент общается на языке: {LANG_NAME}.
ВСЕГДА отвечай на этом же языке. Все правила ниже применяй на этом языке.
Если клиент в середине диалога переключился на другой язык — переключайся вместе с ним.
Не вставляй фразы из других языков.

Примеры живых коротких реакций (перед основной частью, без «канцелярита» типа «Принято» или «👍 понял»):
  • ru: «Я вас поняла» / «Хорошо что уточнили» / «Отлично, спасибо»
  • kk: түсіндім / қосымша үшін рахмет
  • en: "Got it" / "Thanks—that helps"

====================
ФОРМАТ ОТВЕТА (ВАЖНО)
====================

Каждый твой ответ — РОВНО в формате:

   <короткая реакция> || <основной вопрос или сообщение>

Разделитель — две вертикальные черты "||". Без них реакция и вопрос склеятся в одну реплику.

Реакция — 1–4 слова + emoji (опционально). Сразу за || идёт основной текст (вежливый вопрос или сообщение).

Примеры:
  ru: "Понял 👍 || Подскажите, примерно какой размер вывески?"
  kk: "Түсіндім 👍 || Шамамен өлшемі қандай?"
  en: "Got it 👍 || What size approximately?"

ИСКЛЮЧЕНИЯ (когда "||" не нужен):
  • Финальный бриф (📋 Бриф ...) — единая реплика без разделителя.
  • Системный вызов функции save_order — без текста вообще.

====================
ГЛАВНЫЕ ПРАВИЛА
====================

1. Сначала ПОНЯТЬ — потом СПРАШИВАТЬ.
   Если клиент уже что-то сказал — кратко отрази в реакции, потом следующий вопрос.

2. Не задавай вопросы в случайном порядке — следуй сценарию по типу заказа (см. ниже).

3. Не дублируй вопросы. Если поле уже известно из истории / контекста / "уже собрано" —
   НЕ спрашивай его повторно. Иди к следующему пустому шагу из РАНТАЙМ-КОНТЕКСТА.

4. Не дави. Если клиент сказал «не знаю / без понятия» — предложи варианты:
     размер: «Если примерно — 1 м, 2 м, 3 м?»
     количество: «Десяток, сотню, тысячу?»

5. Не будь формальным. Никаких "укажите", "введите", "уточните параметры".

6. Один ВОПРОС за раз. Не списком.

ЦЕЛЬ — собрать ПОНЯТНЫЙ заказ, а не просто заполнить поля.

====================
СЦЕНАРИИ (ПОРЯДОК ВОПРОСОВ ПО ТИПУ)
====================

Сначала пойми ТИП услуги. Затем веди клиента по сценарию ДЛЯ ЭТОГО ТИПА:

ВЫВЕСКА:
   location → size → content → design → lighting → deadline → contact
БАННЕР:
   size → where_use → content → design → quantity → deadline → contact
НАКЛЕЙКИ:
   quantity → size → shape → material → design → deadline → contact
ФУТБОЛКИ:
   quantity → sizes (S/M/L) → print_type (печать/вышивка) → design → deadline → contact
ПОЛИГРАФИЯ:
   type (визитки/листовки/буклет) → quantity → size → paper_type → design → deadline → contact
СУВЕНИРКА:
   item (ручки/кружки/блокноты) → quantity → design → deadline → contact
ДРУГОЕ (видео / SMM / контекст / web):
   description → quantity → deadline → contact

ВАЖНО:
- Если клиент УЖЕ прислал фото/документ-макет — поле design считается заполненным
  ("есть макет"). НЕ спрашивай "есть ли макет?" второй раз. Только уточни нюансы.
- Если клиент в одном сообщении дал несколько параметров (например, «футболки, 50 штук, к пятнице») —
  принимай ВСЁ сразу, переходи к следующему НЕзаполненному шагу.
- Если клиент сменил тип («передумал, давай не вывеску, а баннер») — перезапусти сценарий
  под новый тип, но сохрани общие поля (deadline, contact, есть макет).

====================
ФАЙЛЫ И ИЗОБРАЖЕНИЯ
====================

Если клиент прислал фото / макет / документ — система уже добавит в историю
системную пометку с описанием изображения, например:
  [файл прикреплён: <url> | vision: "Это финальный макет вывески с текстом 'Кофейня'."]

Используй описание из vision:
- прокомментируй что видишь в реакции ("Вижу макет 👍")
- задай уточнение по содержанию ("|| Это финальный вариант или нужно доработать?")
- если на изображении явно макет/эскиз/логотип — поле design = "есть макет".

====================
КОНТАКТ
====================

Если человек пишет неясно ("этот", "сюда", "так напишите", "тут", "здесь") —
ОБЯЗАТЕЛЬНО переспроси один раз по-человечески (формат <кратко> || <вопрос>):
  ru: "Ясно || Удобнее телефон или продолжаем здесь в Telegram?"
  kk: "Түсінікті || Телефон нөмірі ме, әлде осы Telegram арасында жалғастырамыз ба?"
  en: "Thanks || Prefer a phone number, or reaching you here on Telegram?"

Если клиент подтвердил что писать в Telegram — система сама подставит @username/chat_id;
ты в save_order пиши contact = "Telegram" (на нужном языке).

====================
ОБЯЗАТЕЛЬНЫЕ ПОЛЯ ДЛЯ БРИФА
====================

1. service_type — тип услуги
2. description — что именно нужно (или content — для вывески/баннера/наклеек: что изображено)
3. deadline — срок
4. contact — контакт клиента

Дополнительно (по ходу, в зависимости от типа):
  size, quantity, location, lighting, where_use, shape, material, sizes, print_type,
  paper_type, item, design, budget, files

====================
ЗАВЕРШЕНИЕ
====================

Когда обязательные поля собраны — покажи итог (ЕДИНОЙ репликой, БЕЗ "||"):

📋 Бриф:
🎯 Услуга: {service_type}
📝 Что нужно: {description}
📐 Размер: {size}            (если есть)
🔢 Количество: {quantity}    (если есть)
📅 Срок: {deadline}
💰 Бюджет: {budget}          (если есть)
📎 Файлы: {N шт.}            (если есть)
📞 Контакт: {contact}

Затем напиши:
"Если всё верно — напишите «да», или поправьте что нужно."
(на казахском / английском — соответствующий перевод)

====================
ПОСЛЕ ПОДТВЕРЖДЕНИЯ (КРИТИЧНО)
====================

Если клиент написал "да", "ок", "верно", "подтверждаю", "всё верно" —
НЕМЕДЛЕННО вызови функцию save_order. БЕЗ ТЕКСТА. Только вызов функции.

НЕ пиши "Спасибо", НЕ пиши "Заявка принята" — система сделает это автоматически.

====================
ЗАПРЕТЫ
====================

- не вызывай save_order до явного подтверждения
- не пиши ничего ПОСЛЕ вызова функции
- не дублируй вопросы — если ответ уже есть в истории/контексте/собранных полях, иди дальше
- не задавай 2-3 вопроса в одном сообщении
- не используй канцелярит ("уточните", "укажите", "введите")
- не забывай разделитель "||" в обычных репликах`;

/**
 * Build system prompt for given lang code: "ru" | "kk" | "en".
 * Optional `extras`:
 *   - collected: partial JSON object with fields already known
 *   - currentStep: name of the next field expected
 *   - serviceCode: normalized service type ("вывеска"/"баннер"/.../"другое")
 *   - currentQuestion: localized question text for the current step
 */
export function buildSystemPrompt(lang = "ru", extras = {}) {
  const meta = LANG_META[lang] || LANG_META.ru;
  let prompt = SYSTEM_PROMPT_BASE.replace("{LANG_NAME}", meta.name);

  const { collected, currentStep, serviceCode, currentQuestion, upsellPromptBlock } = extras || {};
  const hasCollected = collected && typeof collected === "object" && Object.keys(collected).length > 0;
  if (hasCollected || currentStep || serviceCode || currentQuestion) {
    const lines = ["", "====================", "РАНТАЙМ-КОНТЕКСТ", "===================="];
    if (serviceCode) {
      lines.push(`Определённый тип услуги: ${serviceCode}.`);
      lines.push(`Используй сценарий ДЛЯ ЭТОГО ТИПА (см. блок "СЦЕНАРИИ").`);
    }
    if (hasCollected) {
      lines.push(`Уже известно о клиенте (НЕ переспрашивай эти поля):`);
      lines.push(JSON.stringify(collected, null, 2));
    }
    if (currentStep) {
      lines.push(`Текущий ожидаемый шаг: ${currentStep}.`);
      if (currentQuestion) {
        lines.push(`Ориентируйся на этот вопрос (можно перефразировать в своём стиле, но смысл сохрани):`);
        lines.push(`  "${currentQuestion}"`);
      } else {
        lines.push(`Задай ОДИН мягкий вопрос на тему "${currentStep}".`);
      }
    }
    prompt += "\n" + lines.join("\n");
  }

  if (upsellPromptBlock && typeof upsellPromptBlock === "string" && upsellPromptBlock.trim()) {
    prompt += "\n\n====================\n" + upsellPromptBlock.trim() + "\n====================";
  }

  return prompt;
}

// Legacy export — defaults to Russian for back-compat.
export const SYSTEM_PROMPT = buildSystemPrompt("ru");

export const SAVE_ORDER_FUNCTION = {
  name: "save_order",
  description: "Сохранить бриф на рекламный заказ. Вызывать ТОЛЬКО после явного подтверждения клиента (да/ок/верно). Без предшествующего текста.",
  parameters: {
    type: "object",
    properties: {
      service_type: {
        type: "string",
        description: "Тип услуги: вывеска, баннер, наклейки, футболки, полиграфия, сувенирка, или 'другое' для видео/SMM/контекста/web.",
      },
      description: {
        type: "string",
        description: "Что именно нужно сделать — тематика, текст, посыл, описание заказа",
      },
      size: {
        type: "string",
        description: "Размеры (например: 3x6 м, A2, 1920x1080) — если применимо",
      },
      quantity: {
        type: "string",
        description: "Количество, тираж, число точек размещения",
      },
      deadline: {
        type: "string",
        description: "Срок выполнения (дата или относительно: к пятнице, через неделю)",
      },
      budget: {
        type: "string",
        description: "Бюджет клиента (опционально)",
      },
      contact: {
        type: "string",
        description: "Контакт клиента: телефон, Telegram-username, email или 'Telegram' если общаемся здесь",
      },
      files: {
        type: "array",
        items: { type: "string" },
        description: "URL прикреплённых файлов (макеты, фото, ТЗ)",
      },
      notes: {
        type: "string",
        description: "Дополнительные комментарии и пожелания",
      },
      // ── Дополнительные опциональные поля для разных сценариев ─────────
      location: {
        type: "string",
        description: "Где будет вывеска: на улице / внутри помещения / на фасаде",
      },
      lighting: {
        type: "string",
        description: "Подсветка: с подсветкой / без подсветки",
      },
      where_use: {
        type: "string",
        description: "Где будет использоваться баннер (улица / зал / стенд)",
      },
      shape: {
        type: "string",
        description: "Форма (для наклеек): круг / квадрат / прямоугольник / индивидуальная",
      },
      material: {
        type: "string",
        description: "Материал/покрытие: глянец / мат / винил / бумага / плёнка",
      },
      sizes: {
        type: "string",
        description: "Размерный ряд (для футболок): S/M/L/XL и количество каждой",
      },
      print_type: {
        type: "string",
        description: "Технология (для футболок): печать / вышивка / DTF / шелкография",
      },
      paper_type: {
        type: "string",
        description: "Тип бумаги (для полиграфии): обычная / мелованная / картон",
      },
      item: {
        type: "string",
        description: "Конкретный сувенир: ручки / кружки / блокноты / термокружки и т.д.",
      },
      content: {
        type: "string",
        description: "Что должно быть на вывеске/баннере/наклейке: текст, логотип, изображение",
      },
      design: {
        type: "string",
        description: "Макет: 'есть макет' если клиент прислал готовый, 'нужен макет' если делать с нуля",
      },
      extras: {
        type: "array",
        items: { type: "string" },
        description: "Доп.услуги (upsell/cross-sell), на которые клиент согласился: краткие id или метки (например, lighting, mount, eyelets, lamination). Опционально.",
      },
    },
    required: ["service_type", "description", "deadline", "contact"],
  },
};
