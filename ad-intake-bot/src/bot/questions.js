// Локализованные вопросы для каждого шага сценария.
// Структура: QUESTIONS[lang][step] -> string.
// Если шаг отсутствует в QUESTIONS[lang] — fallback на QUESTIONS.ru.
//
// Шаги собраны из всех сценариев в scenarios.js:
//   service_type, location, size, content, design, lighting, where_use,
//   quantity, shape, material, sizes, print_type, type, paper_type, item,
//   description, deadline, contact, confirm.

export const QUESTIONS = {
  ru: {
    service_type: "Подскажите, что именно нужно — вывеска, баннер, наклейки, футболки, полиграфия (визитки/листовки), сувенирка или что-то другое?",
    location:    "Где будет вывеска — на улице или внутри помещения?",
    size:        "Примерно какой размер? Например, 1×2 метра, 3×6 метров.",
    content:     "Что должно быть написано или изображено? Текст, логотип, картинка?",
    design:      "У вас есть готовый макет, или нужно его разработать?",
    lighting:    "Подсветка нужна или без подсветки?",
    where_use:   "Где будет использоваться баннер — на улице, в зале, на стенде?",
    quantity:    "Сколько штук нужно?",
    shape:       "Какой формы — круг, квадрат, прямоугольник или индивидуальная?",
    material:    "Глянцевые или матовые? И на чём — бумага, плёнка, винил?",
    sizes:       "Какие размеры нужны (S, M, L, XL) и сколько каждой?",
    print_type:  "Печать или вышивка? Полноцветная или одноцветная?",
    type:        "Что именно — визитки, листовки, буклеты или что-то другое?",
    paper_type:  "Бумага какая — обычная, мелованная, плотная (картон)?",
    item:        "Какой именно сувенир — ручки, кружки, блокноты, термокружки, что-то ещё?",
    description: "Расскажите подробнее — что именно нужно сделать?",
    deadline:    "К какому сроку нужно?",
    contact:     "Как с вами лучше связаться — номер телефона или общаемся здесь, в Telegram?",
    confirm:     "Если всё верно — напишите «да», или поправьте что нужно.",
  },
  kk: {
    service_type: "Не керек екенін айтыңызшы — маңдайша, баннер, жапсырмалар, футболкалар, полиграфия (визитка/жарнама парақшалар), сувенир немесе басқа нәрсе ме?",
    location:    "Маңдайша қайда болады — сыртта ма, ішкі жерде ме?",
    size:        "Шамамен өлшемі қандай? Мысалы, 1×2 метр, 3×6 метр.",
    content:     "Не жазылу керек немесе бейнелену керек? Мәтін, логотип, сурет пе?",
    design:      "Дайын макет бар ма, әлде жасау керек пе?",
    lighting:    "Жарықтандыру керек пе, әлде онсыз ба?",
    where_use:   "Баннер қайда қолданылады — көшеде, залда, стендте ме?",
    quantity:    "Қанша дана керек?",
    shape:       "Қандай пішінде — дөңгелек, шаршы, тіктөртбұрыш немесе жеке пішін бе?",
    material:    "Жылтыр ма әлде күңгірт пе? Қандай материалда — қағаз, плёнка, винил?",
    sizes:       "Қандай өлшемдер керек (S, M, L, XL) және әрқайсысынан қанша?",
    print_type:  "Басу ма, кесте ме? Толық түсті ме әлде бір түсті ме?",
    type:        "Нақты не — визитка, жарнама парақшалары, буклет немесе басқа?",
    paper_type:  "Қағаз қандай — қарапайым, жалатылған, қалың (картон) ба?",
    item:        "Қандай сувенир — қалам, кружка, блокнот, термокружка, басқа ма?",
    description: "Толығырақ айтыңызшы — нақты не істеу керек?",
    deadline:    "Қашанға керек?",
    contact:     "Сізбен қалай байланысуға болады — телефон нөмірі немесе осы Telegram-да?",
    confirm:     "Егер бәрі дұрыс болса — «иә» деп жазыңыз, немесе түзетіңіз.",
  },
  en: {
    service_type: "What exactly do you need — a sign, banner, stickers, t-shirts, print (cards/flyers), souvenirs, or something else?",
    location:    "Will the sign be outdoors or indoors?",
    size:        "What size approximately? For example, 1×2 meters, 3×6 meters.",
    content:     "What should it say or show — text, logo, an image?",
    design:      "Do you have a ready design, or should we create it from scratch?",
    lighting:    "Do you need illumination, or no backlight?",
    where_use:   "Where will the banner be used — outdoors, indoor hall, on a stand?",
    quantity:    "How many do you need?",
    shape:       "What shape — round, square, rectangle, or custom?",
    material:    "Glossy or matte? And on what — paper, vinyl film, sticker stock?",
    sizes:       "Which sizes do you need (S, M, L, XL) and how many of each?",
    print_type:  "Print or embroidery? Full color or one color?",
    type:        "What exactly — business cards, flyers, brochures, something else?",
    paper_type:  "Paper type — standard, coated, heavyweight (cardboard)?",
    item:        "Which souvenir — pens, mugs, notebooks, thermos cups, something else?",
    description: "Tell me more — what exactly do you need?",
    deadline:    "What's the deadline?",
    contact:     "Best way to reach you — phone number or here in Telegram?",
    confirm:     "If everything looks right — reply 'yes', or correct anything that's off.",
  },
};

export function getQuestion(lang, step) {
  if (!step) return null;
  const tbl = QUESTIONS[lang] || QUESTIONS.ru;
  return tbl[step] || QUESTIONS.ru[step] || null;
}

// Если LLM-классификатор не уверен — короткое уточняющее предложение по 3 базовым типам.
export const FALLBACK_CLARIFY = {
  ru: "Это ближе к вывеске, баннеру или чему-то другому?",
  kk: "Бұл маңдайшаға, баннерге немесе басқа нәрсеге жақын ба?",
  en: "Is this closer to a sign, banner, or something else?",
};
