# STAGE 1: Report Lifecycle Integration

## Цель
Внедрить сервис `ReportLifecycleManager` для формализованного создания инженерных отчетов (отход от «текста в чате» к структурированным артефактам).

## План действий
1. [ ] **Создать `ReportManager` (Service)**: Разработать сервис в `/services/api-server/src/services/reportManager.ts`.
   - Методы: `generateReport(data)`, `signReport(reportId)`, `getVersionedData(projectId)`.
2. [ ] **Расширить БД**: Создать миграцию для таблицы `reports` (id, project_id, content, status, checksum, created_by).
3. [ ] **Интеграция с Orchestrator**: Модифицировать `orchestrator.ts`, чтобы при запросе на "отчет" вызывался `ReportManager`, а не просто текстовая генерация.
4. [ ] **Верификация**: Создание тестового отчета через CLI/Chat, проверка записи в БД и наличия хеш-суммы.

## Текущий статус
- [ ] Ожидает реализации.
