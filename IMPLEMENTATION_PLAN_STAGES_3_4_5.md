# STAGE 3: Revision System

## Цель
Внедрить систему контроля версий (ревизий) для инженерных отчетов: возможность просмотра истории, сравнения диффов и отката к предыдущим состояниям.

## План действий
1. **Schema Update:** Добавить таблицу `report_revisions` (хранит контент, checksum и метаданные каждой версии отчета).
2. **Versioning Logic:** Реализовать `createRevision` в `ReportLifecycleManager`.
3. **Diff Engine:** Добавить инструмент `diff_reports` (сравнение текущей ревизии с предыдущей).
4. **State Persistence:** Обновление логики создания отчета — если отчет по дисциплине уже существует, создавать новую ревизию, а не запись в `reports`.

---

# STAGE 4: Normative Traceability

## Цель
Обеспечить автоматическую привязку каждой формулы/требования в отчете к конкретному пункту нормативной базы.

## План действий
1. **Normative Mapping:** Добавить в `ReportData` обязательный блок `normative_traceability` (map: section -> clause_id).
2. **AI Enforcement:** Обновить системный промпт оркестратора для требования обязательных ссылок (`citation_id`) при генерации отчетов.
3. **Traceability Table:** Таблица `report_normative_links` (связь отчета с конкретными чанками AGSK).

---

# STAGE 5: Engineering Signature Chain

## Цель
Реализовать цепочку согласований (Generated -> Reviewed -> Approved) с криптографической проверкой.

## План действий
1. **Status Machine:** Переход состояний отчета (добавить `status` workflow).
2. **Signature Logic:** Добавить эндпоинт `POST /api/reports/:id/sign` с проверкой прав (ГИП/Лид).
3. **Immutable Audit:** Логгирование каждой подписи в `report_audit_log` (кто, когда, checksum на момент подписи).
