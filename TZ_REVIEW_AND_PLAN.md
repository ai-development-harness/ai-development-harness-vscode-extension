# Оценка ТЗ и план работы — VSCode Harness Navigator Plugin

> Рабочий документ для использования в другой сессии. Источник ТЗ: `https://claude.ai/artifact/QMhVi5Ran6JJ7s1BRzsJNg`
> Сверка проведена против реального `ai-development-harness-template` (соседний репозиторий).
> Дата: 2026-09-17.

## Решения, принятые с пользователем

- **Интеграция с Claude/агентом (раздел 4.1 ТЗ)**: не фиксируем механизм заранее — решаем отдельным research-STEP до кодирования Terminal Integration.
- **Репозиторий `ai-development-harness-vscode-extension`**: строим как собственный harness-проект (dogfooding) — bootstrap из шаблона, разработка через `ADD STEP` / `PLAN` / `IMPLEMENT` / `REVIEW`, а не как обычный npm-проект без протокола.

---

## Оценка ТЗ

Документ хорошо структурирован (MVP/Phase 2/Phase 3, Gherkin-сценарии, риски, метрики), но при сверке с реальным `ai-development-harness-template` найден ряд содержательных несоответствий.

### Критичные проблемы

1. **Не существует «Claude Code API» с описанным контрактом.** Раздел 4.1 придумывает JSON-протокол `HarnessCommand`/`HarnessResult` и предлагает «отправить контекст к Claude Code API». На практике Claude Code — это CLI/агент (headless/print-режим, Agent SDK), а не HTTP API с такой синхронной сигнатурой. Это блокирует Terminal Integration (2.1.5) — нужна архитектурная развилка: шелл-вызов `claude -p ...` и парсинг текстового вывода, либо открытый VSCode-терминал с вставкой промпта, либо процесс через Agent SDK. ТЗ должно было поставить это как открытый вопрос (раздел 12), а не как решённый факт.

2. **Путь к EXECUTION_PROTOCOL.md указан неверно.** ТЗ: искать в `.project/` или `docs/harness/`. Реально: `planning/EXECUTION_PROTOCOL.md`, путь уже объявлен машиночитаемо в `.project/manifest.yaml → protocol.file` (там же `taskDirectory`, `reviewDirectory`, `auditDirectory`, `roadmap`, `status`). Плагин должен читать все пути из манифеста, а не хардкодить директории.

3. **Формат STEP-файлов описан неверно.** ТЗ предполагает YAML frontmatter и расширение `.step.md` с custom language mode. Реально — обычный `STEP-NNN.md`, без frontmatter, с полями как жирными inline-метками (`**Статус:**`, `**Type:**`, `**Приоритет:**`, `**Фаза:**`, `**Depends on:**` — смешение RU/EN лейблов). Меняет дизайн парсера (по секциям/меткам, не YAML) и способ регистрации custom language (по glob имени файла `STEP-*.md`, не по расширению).

### Существенные, но не блокирующие несоответствия

4. **11 команд в ТЗ — подмножество 24 канонических команд протокола** (полный список см. `docs/harness/COMMANDS.md`):
   `INIT PROJECT, ADD STEP, FIND SKILL, INSTALL SKILL, CREATE SKILL, GENERATE GITHUB TEMPLATES, QUICK FIX, PLAN STEP-NNN, IMPLEMENT STEP-NNN, REVIEW STEP-NNN, FIX STEP-NNN, RUN STEP-NNN, AUDIT STEP-NNN, STATUS PROJECT, NEXT STEP, RECONCILE PROJECT, RELEASE CHECK, CHECK HARNESS UPDATE, UPDATE HARNESS, GIT CHECK, COMMIT, PUSH, PR, SYNC`.
   Урезание до MVP — нормально, но тезис 1.3 ТЗ («полный цикл через UI», «полноценная IDE») переобещает: без `GIT CHECK/COMMIT/PUSH/PR` разработчик всё равно уходит в терминал вручную. Это отдельное продуктовое решение — включить хотя бы `GIT CHECK`+`COMMIT` в MVP или явно снизить заявку успеха.

5. **«Soft» vs «hard» dependency edges (2.2.1)** не имеют опоры в протоколе — там определено только поле `Depends on` / «hard dependencies». Нужно либо убрать различие, либо явно определить, что такое «soft» (например, REQ-ссылки vs `Depends on`).

6. **Внутренняя несогласованность статусов.** Реальных статусов 5: `Запланировано / В работе / Выполнено / Заблокировано / Отменено`. Фильтр в 2.1.2 верно перечисляет их (Done/In Progress/Planned/Blocked/Cancelled), но легенда иконок там же использует `❓ pending` вместо иконки для `Отменено`.

7. **Утечка третьего языка.** В 5.1 `translations.test.ts` описан как «verify all keys translated for RU, EN, **TR**», хотя весь остальной документ говорит только про RU/EN — похоже на копипаст-остаток.

### Сильные стороны

- Статусы, пути `docs/requirements/`, `docs/adr/`, `planning/tasks/`, `planning/reviews/`, `.agents/skills/`, поле `project.initialized`, структура Mutation policy (`### Allowed/Conditional/Forbidden`) — подтвердились при сверке с шаблоном.
- Формат приёмочных критериев через Gherkin, разбиение MVP/Phase2/Phase3, таблица рисков — качественно и пригодно для работы.
- 9-недельная оценка оптимистична, особенно с учётом открытого вопроса №1 — до его решения объём работ раздела 2.1.5/4 непредсказуем.

---

## План работы

### Фаза 0 — Bootstrap репозитория как harness-проекта

1. Скопировать в репозиторий скелет из `ai-development-harness-template`: `.agents/`, `.codex/`, `.project/` (включая `harness.lock.json` с зафиксированным release `0.1.1`), `planning/`, `docs/harness/`, `tools/harness/validate.py`, `.github/` workflow целостности (если есть).
2. Написать `PROJECT_BRIEF.local.md` — вход для `INIT PROJECT`, с уже исправленными фактами (реальные пути из манифеста, формат STEP без frontmatter, MVP = 11 команд как сознательный вырез из 24, вопрос интеграции с Claude — как открытый и решаемый первым STEP).
3. `INIT PROJECT` → `docs/PROJECT.md`, `REQ-NNN`, `ADR-NNN`, черновой `STEP-NNN`/roadmap, `PLAN.md`, `STATUS.md`, `.project/manifest.yaml → initialized: true`.
4. Сохранить уже закоммиченные `README.md`/`LICENSE` (MIT).

**Требует подтверждения пользователя** — создаёт много файлов и коммитов сразу.

### Фаза 1 — Research-STEP: механизм вызова Claude

- `Type: RESEARCH`, `Risk flags: architecture`.
- Goal: доказать рабочий способ передачи контекста (EXECUTION_PROTOCOL.md, manifest, STEP-файл, git status) агенту и получения structured-результата (изменённые файлы, next command, ошибки) — без выдуманного HTTP-контракта из раздела 4.1 ТЗ.
- Verification: spike — реальный запуск команды (например `PLAN STEP-001`) через выбранный механизм на тестовом harness-проекте, разбор вывода.
- Deliverable: `ADR-00X` с решением + минимальный `src/api/claudeIntegration.ts` прототип.
- Блокирует: все STEP Terminal Integration и command dispatch (Фаза 3, Фаза 7).

### Фаза 2 — Инфраструктура (параллельно с Фазой 1)

- **STEP: Project scaffolding** — `package.json`, `tsconfig.json` (strict), ESLint, esbuild bundling, `.vscode/launch.json` (Extension Development Host), Jest + `@vscode/test-electron`, CI skeleton.
- **STEP: Parser layer** — пути из `.project/manifest.yaml` (`protocol.file`, `taskDirectory`, `reviewDirectory`, `roadmap`, `status`), не хардкод; парсер STEP-файлов по секциям/жирным меткам (не YAML frontmatter); парсер `EXECUTION_PROTOCOL.md` по возможности вытягивает список команд/enum статусов динамически, устойчиво к будущим `UPDATE HARNESS`.
- **STEP: i18n service** — `ru.json`/`en.json`, fallback RU→ключ, `vscode.env.language`, сохранение в `.project/harness-config.json`. Без TR.

### Фаза 3 — MVP-команды (Command Palette), по одной STEP на команду

Порядок по зависимостям: `INIT PROJECT` → `STATUS PROJECT` / `NEXT STEP` (read-only, безопасны для раннего теста) → `ADD STEP` → `PLAN STEP-NNN` → `IMPLEMENT STEP-NNN` → `REVIEW STEP-NNN` → `FIX STEP-NNN` → `RUN STEP-NNN` → `QUICK FIX` → `RECONCILE PROJECT`. Каждый STEP: pre-dispatch валидация (INIT guard, dependencies, mutation policy stub), вызов через API из Фазы 1, обновление затронутых файлов.

*Открытый вопрос (не решён, продуктовое решение):* добавлять ли `GIT CHECK`+`COMMIT` в MVP, чтобы «полный цикл через UI» из тезиса 1.3 ТЗ был действительно полным.

### Фаза 4 — Sidebar Explorer

`TreeDataProvider` по дереву из манифеста, статусы/иконки (5 реальных статусов, без придуманного `❓ pending`), фильтры, lazy loading по группам, context-menu действия. Зависит от Фазы 2 (parser).

### Фаза 5 — STEP File Editor

Custom language по glob `STEP-*.md` (не по расширению `.step.md`), диагностика на реальном формате полей, CodeLens (`Go to REQ/ADR`, `View in PLAN`), hover, autocomplete по существующим ID, quick actions. Зависит от Фазы 2.

### Фаза 6 — Status Bar

Индикатор инициализации, completion bar, «Next command», health-warnings; батчинг обновлений. Зависит от Фаз 2–4.

### Фаза 7 — Terminal Integration (финализация)

Output Channel «Harness», сборка контекста (protocol/manifest/STEP/git status), три уровня error handling (раздел 3.3 ТЗ), отмена по Ctrl+C. Зависит от решения Фазы 1.

### Фаза 8 — Документация и тесты

- Unit-тесты (parser, validation, graph, i18n) до >80% покрытия.
- Integration-тесты через `@vscode/test-electron` на фикстурном harness-проекте.
- `README.md`/`README.ru.md`/`README.en.md`, `CONTRIBUTING.md`, `API.md`, `TROUBLESHOOTING.md`, `CHANGELOG.md`.

### Фаза 9 — Релиз v0.1.0 (MVP)

Полировка, сборка `.vsix`, manual testing checklist (раздел 5.3 ТЗ), публикация.

### Post-MVP (Phase 2 продукта по ТЗ)

Dependency graph (сначала снять несоответствие «soft/hard» рёбер с реальной моделью), Health dashboard, Mutation policy enforcement, keyboard shortcuts — после стабилизации MVP.

---

## Следующий шаг

Начать с Фазы 0 (копирование скелета шаблона + `PROJECT_BRIEF.local.md` + `INIT PROJECT`) — после подтверждения пользователя.
