/**
 * Шаблоны типовых заказов — префилл orderData (клиент жмёт кнопку в /templates).
 */
export const ORDER_TEMPLATES = [
  {
    id: "banner_1200",
    title: "🖼 Баннер 1200×630",
    preset: {
      type: "баннер",
      size: "1200×630",
      design: "нужен макет / референс",
    },
  },
  {
    id: "rollup",
    title: "📜 Roll-up / стенд",
    preset: {
      type: "roll-up",
      size: "85×200 см",
    },
  },
  {
    id: "smm_pack",
    title: "📱 SMM пакет (посты + stories)",
    preset: {
      type: "SMM",
      description: "Ведение соцсетей: посты и stories, 1 месяц",
    },
  },
];

export function getTemplateById(id) {
  return ORDER_TEMPLATES.find((t) => t.id === id) || null;
}
