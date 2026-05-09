# Полный перечень расчётов в EngHub

**Дата:** 2026-05-09  
**Источник:** `enghub-main/src/calculations/registry.ts`  
**Всего расчётов:** 90 (+ 2 базовых шаблона = 92 в кодовой базе)

> ⚠️ NOTE: STATE.md упоминает 274 расчёта. Это может быть старая цифра или включать расчёты из БД Supabase. Уточните с бэкендом.

---

## Категории расчётов

### 🔥 TX — Тепловые системы (2)
1. **tx_heat_balance** — Тепловая мощность (Нагрев/Охлаждение)
2. **tt_pressure_drop** — Потери давления (Дарси–Вейсбах)

### ⚙️ TH — Теплотехнические расчёты (28)
3. **th_raschet_plotnosti_svoystv_smesi** — Расчёт плотности/свойств смеси
4. **th_raschet_rashoda** — Расчёт расхода
5. **th_raschet_vremeni_zapolneniya_oporozhneniya_emkosti** — Расчёт времени заполнения/опорожнения ёмкости
6. **th_poteri_davleniya_po_uchastku** — Потери давления по участку
7. **th_raschet_skorosti_potoka** — Расчёт скорости потока
8. **th_raschet_chisla_reynol_dsa** — Расчёт числа Рейнольдса
9. **th_raschet_koeffitsienta_treniya** — Расчёт коэффициента трения
10. **th_balans_po_komponentam** — Баланс по компонентам
11. **th_poteri_davleniya** — Потери давления
12. **th_skorost_potoka_v_trube** — Скорость потока в трубе
13. **th_chislo_reynol_dsa** — Число Рейнольдса
14. **th_tolschina_stenki** — Толщина стенки
15. **th_proverka_na_vnutrennee_davlenie** — Проверка на внутреннее давление
16. **th_massa_truboprovoda** — Масса трубопровода
17. **th_lineynoe_rasshirenie** — Линейное расширение
18. **th_raschet_uklonov** — Расчёт уклонов
19. **th_raschet_rashoda_cherez_diametr** — Расчёт расхода через диаметр
20. **th_proverka_dopustimyh_skorostey** — Проверка допустимых скоростей
21. **th_sbor_nagruzok** — Сбор нагрузок
22. **th_raschet_reaktsii_opory** — Расчёт реакции опоры
23. **th_raschet_izgibayuschego_momenta** — Расчёт изгибающего момента
24. **th_raschet_poperechnoy_sily** — Расчёт поперечной силы
25. **th_proverka_prochnosti_elementa** — Проверка прочности элемента
26. **th_progib_balki** — Прогиб балки
27. **th_proverka_ustoychivosti** — Проверка устойчивости
28. **th_raschet_vesa_konstruktsii** — Расчёт веса конструкции
29. **th_nagruzki_ot_oborudovaniya** — Нагрузки от оборудования
30. **th_proverka_ankerov** — Проверка анкеров

### ⚡ EO — Электротехнические и приборные расчёты (30)
31. **eo_raschet_moschnosti** — Расчёт мощности
32. **eo_raschet_toka** — Расчёт тока
33. **eo_podbor_secheniya_kabelya** — Подбор сечения кабеля
34. **eo_poteri_napryazheniya** — Потери напряжения
35. **eo_raschet_soprotivleniya_kabelya** — Расчёт сопротивления кабеля
36. **eo_nagrev_kabelya** — Нагрев кабеля
37. **eo_raschet_osveschennosti** — Расчёт освещённости
38. **eo_balans_nagruzok** — Баланс нагрузок
39. **eo_raschet_potreblyaemoy_moschnosti** — Расчёт потребляемой мощности
40. **eo_proverka_dopustimogo_padeniya_napryazheniya** — Проверка допустимого падения напряжения
41. **eo_pereschet_signalov** — Пересчёт сигналов
42. **eo_masshtabirovanie_signalov** — Масштабирование сигналов
43. **eo_raschet_pogreshnosti** — Расчёт погрешности
44. **eo_raschet_diapazona_izmereniy** — Расчёт диапазона измерений
45. **eo_lineynaya_interpolyatsiya_signalov** — Линейная интерполяция сигналов
46. **eo_raschet_vremeni_otklika** — Расчёт времени отклика
47. **eo_raschet_potrebleniya_pitaniya** — Расчёт потребления питания
48. **eo_proverka_diapazonov_datchikov** — Проверка диапазонов датчиков
49. **eo_konversiya_edinits_izmereniya** — Конверсия единиц измерения
50. **eo_raschet_bazovyh_parametrov_signalov** — Расчёт базовых параметров сигналов
51. **eo_teplopoteri_pomescheniya** — Теплопотери помещения
52. **eo_raschet_vozduhoobmena** — Расчёт воздухообмена
53. **eo_rashod_vozduha** — Расход воздуха
54. **eo_skorost_vozduha_v_kanale** — Скорость воздуха в канале
55. **eo_poteri_davleniya** — Потери давления
56. **eo_raschet_moschnosti_otopleniya** — Расчёт мощности отопления
57. **eo_temperaturnyy_balans** — Температурный баланс
58. **eo_raschet_ploschadi_vozduhovodov** — Расчёт площади воздуховодов
59. **eo_proverka_skorostey_vozduha** — Проверка скоростей воздуха
60. **eo_raschet_teplovoy_nagruzki** — Расчёт тепловой нагрузки

### 💧 VK — Водоснабжение и канализация (10)
61. **vk_rashod_vody** — Расход воды
62. **vk_balans_vodopotrebleniya** — Баланс водопотребления
63. **vk_poteri_davleniya** — Потери давления
64. **vk_skorost_potoka** — Скорость потока
65. **vk_ob_em_rezervuara** — Объём резервуара
66. **vk_vremya_zapolneniya** — Время заполнения
67. **vk_raschet_diametra_truby** — Расчёт диаметра трубы
68. **vk_proverka_uklonov** — Проверка уклонов
69. **vk_gidravlika_prostyh_setey** — Гидравлика простых сетей
70. **vk_raschet_napora** — Расчёт напора

### 📐 G — Геодезия и геометрия (10)
71. **g_balans_zemlyanyh_mass** — Баланс земляных масс
72. **g_ob_em_vyemki_nasypi** — Объём выемки/насыпи
73. **g_raschet_uklonov** — Расчёт уклонов
74. **g_otmetki** — Отметки
75. **g_ploschadi_uchastkov** — Площади участков
76. **g_rasstoyaniya_mezhdu_ob_ektami** — Расстояния между объектами
77. **g_proverka_gabaritov** — Проверка габаритов
78. **g_raschet_koordinat** — Расчёт координат
79. **g_geometriya_ploschadki** — Геометрия площадки
80. **g_privyazka_ob_ektov** — Привязка объектов

### 🛡️ PB — Промышленная безопасность (10)
81. **pb_kategorirovanie_pomescheniy** — Категорирование помещений
82. **pb_opredelenie_klassov_zon** — Определение классов зон
83. **pb_raschet_ob_emov_pomescheniy** — Расчёт объёмов помещений
84. **pb_proverka_rasstoyaniy** — Проверка расстояний
85. **pb_raschet_kolichestva_veschestva** — Расчёт количества вещества
86. **pb_prosteyshie_otsenki_utechek** — Простейшие оценки утечек
87. **pb_raschet_vremeni_nakopleniya_gaza** — Расчёт времени накопления газа
88. **pb_proverka_ventilyatsii** — Проверка вентиляции
89. **pb_opredelenie_granits_zon** — Определение границ зон
90. **pb_bazovaya_otsenka_stsenariev** — Базовая оценка сценариев

---

## Статистика

| Категория | Кол-во | Доля |
|-----------|--------|------|
| TH (Теплотехнические) | 28 | 30.4% |
| EO (Электротехнические) | 30 | 32.6% |
| VK (Водоснабжение) | 10 | 10.9% |
| G (Геодезия) | 10 | 10.9% |
| PB (Безопасность) | 10 | 10.9% |
| TX+TT (Базовые) | 2 | 2.2% |
| **ИТОГО** | **92** | **100%** |

---

## ⚠️ Примечания

1. **Расчёты помечены как "🚧 В разработке"** — UI badge в CalculationView сигнализирует о статусе разработки
2. **274 расчёта (из STATE.md)** — могут быть включены расчёты из Supabase БД или планируемые к добавлению
3. **Шаблон расчёта** — стандартный: inputs (параметры) → calculate() → results + report (LaTeX формулы)
4. **Интеграция** — реестр подключен в `CalculationView.tsx` через `calcRegistry[calcId]`

---

**Файл составлен:** 2026-05-09 14:30 UTC  
**Выведено из:** `enghub-main/src/calculations/registry.ts`
