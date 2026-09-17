# STEP-004 — i18n service (RU default + EN)

**Статус:** Выполнено
**Type:** IMPLEMENTATION
**Приоритет:** Средний
**Фаза:** MVP — фундамент
**Depends on:** STEP-002

## Requirements

- REQ-006

## ADR

- не требуется

## Risk flags

- `architecture` — **коррекция task-контракта этим PLAN** (было `none`): сервис устанавливает conventions, на которые опираются будущие STEP — (1) первая запись расширением файла состояния (`.project/harness-config.json`); (2) первая запись в `package.json → contributes.commands` и первое использование нативного механизма VSCode `package.nls.json`/`package.nls.<lang>.json` для локализации Command Palette — механизм, который STEP-005 повторит для 11 команд.

## Goal

Реализовать сервис локализации (RU default, EN) с автоопределением, ручным переключением и graceful fallback.

## Context

REQ-006 требует полной локализации UI на RU/EN с fallback без падений.

## Scope

- `src/locales/ru.json`, `en.json` — начальный набор ключей под уже спроектированные команды/ошибки.
- `i18n.ts` — load/translate/fallback (RU → ключ), определение языка через `vscode.env.language`, команда `harness: Change language`, сохранение выбора в `.project/harness-config.json`.

## Mutation policy

### Allowed

- `src/locales/**`.
- `tests/unit/locales/**`, `tests/integration/i18n.test.js`.

### Conditional

- Добавление новых ключей по мере появления UI в последующих STEP — сервис должен быть готов к росту словаря без переписывания API.
- **Коррекция task-контракта (обоснование — `## Implementation plan → Предпосылки`):** исходный Mutation policy (только `src/locales/**`) физически не позволяет выполнить Scope, который прямо требует команду `harness: Change language` и сохранение выбора в `.project/harness-config.json`. Добавлены строго точечные правки:
  - `src/extension.ts` — только вызов `activateI18n(context)` внутри `activate()`.
  - `package.json` — только одна запись `harness.changeLanguage` в `contributes.commands`.
  - `package.nls.json` (новый, default = ru — соответствует `manifest.yaml → language.default`) и `package.nls.en.json` (новый) — единственный нативный механизм VSCode для локализации `contributes.commands` title.
  - `tsconfig.json` — только `compilerOptions.resolveJsonModule: true` (нужен для типизированного `import` словарей JSON в strict-режиме).
  - `docs/architecture.md` — одна уточняющая фраза в `## Security boundaries`: `.project/harness-config.json` — фиксированный extension-owned путь вне ADR-001 (не Harness-протокольный артефакт, не читается через манифест).
  - `docs/development.md` — обновление одной устаревшей фразы в `## Testing` про число integration-тестов.

### Forbidden

- Хардкод текста напрямую в UI-коде вместо использования сервиса (закладывается как conventions для последующих STEP).
- Реализация Command Palette для остальных 11 MVP-команд (STEP-005) и Output Channel «Harness» (STEP-009) — вне scope, несмотря на то что этот STEP первым касается `contributes.commands`.

## Out of scope

- Перевод текста фич, которые ещё не реализованы (STEP-005..009) — только сам сервис и минимальный набор ключей для демонстрации.

## Acceptance criteria

- Сервис возвращает перевод по ключу для обоих языков.
- Отсутствующий ключ на EN возвращает RU без исключения.
- Отсутствующий ключ на RU возвращает сам ключ без исключения.
- `vscode.env.language` корректно определяет стартовый язык.
- Команда смены языка сохраняется и переживает перезапуск VSCode.

## Verification

- Unit-тесты `tests/unit/locales/i18n.test.ts` (`npm test`): `resolveLanguage`/`translate` — обе fallback-directions на синтетических словарях; `readHarnessConfig`/`writeHarnessConfig` round-trip на временном файле (`os.tmpdir()`); загрузка реальных `src/locales/{ru,en}.json` и сверка фактических demonstration-ключей.
- Integration-тест `tests/integration/i18n.test.js` (`npm run test:integration`, `@vscode/test-electron`): команда `harness.changeLanguage` зарегистрирована; программный вызов `vscode.commands.executeCommand('harness.changeLanguage', 'en')` (bypass интерактивного QuickPick) сохраняет выбор в `.project/harness-config.json` тестового workspace, повторное чтение конфигурации подтверждает persisted-значение — эквивалент «переживает перезапуск» в границах возможностей test harness (полный relaunch Electron вне scope автоматизации).

## Deliverables

- `src/locales/{ru.json,en.json,i18n.ts,activation.ts}` — `activation.ts` выделен из `i18n.ts` при IMPLEMENT (vscode-слой отдельно от чистого слоя, см. Evidence п.3); публичный контракт для STEP-005/STEP-010 (`getI18nService`, `I18nService`) находится в `activation.ts`.
- `tests/unit/locales/i18n.test.ts`, `tests/integration/i18n.test.js`, `tests/fixtures/workspace/.gitkeep`.
- `package.nls.json`, `package.nls.en.json`.
- Точечные правки: `src/extension.ts`, `package.json`, `tsconfig.json`, `docs/architecture.md`, `docs/development.md`, `.vscode-test.mjs` (`workspaceFolder`, обнаружено при IMPLEMENT), `.gitignore` (см. `## Mutation policy → Conditional` и Evidence).

## Implementation plan

**Plan status:** Planned
**Plan revision:** 1
**Planned at:** 2026-09-17

### Предпосылки

- STEP-002 выполнен (`PASS`) — hard dependency удовлетворена: toolchain (TS strict, ESLint, esbuild, Jest, `@vscode/test-cli`) доступен.
- Новый ADR не требуется. Проверено по двум потенциально спорным точкам:
  1. **Путь `.project/harness-config.json` вне перечня ADR-001.** Это не новое архитектурное решение — путь уже зафиксирован дословно в принятом REQ-006 и в исходном Scope этого STEP. ADR-001 регулирует пути к уже существующим Harness-протокольным артефактам, читаемым из `sources.*`/`protocol.*`/`repository.*` манифеста; `.project/harness-config.json` — новый файл, который создаёт и единолично владеет сам plugin, не Harness template. Требуется не решение, а согласование формулировки `docs/architecture.md` с уже принятым REQ-006 (см. Mutation policy → Conditional) — оформлено этим PLAN явно, не спрятано.
  2. **Выбор `package.nls.json`/`package.nls.<lang>.json` как механизма локализации `contributes.commands`.** Это единственный нативный способ VSCode локализовать title/category контрибуций (аналогично выбору конкретной YAML-библиотеки в STEP-003 — техническая реализация уже принятого требования, а не архитектурная развилка с реальными альтернативами). Конвенция явно зафиксирована в Data/API implications ниже, чтобы STEP-005 не изобретал свою.
- Task-контракт скорректирован (Risk flags `none → architecture`, Mutation policy, Verification, Deliverables) — см. секции выше, не скрыто внутри этого плана.

### Implementation approach

1. **`src/locales/{ru.json,en.json}`** — плоский `Record<string, string>`, три demonstration-ключа, полностью симметричные в обоих файлах (намеренно без асимметрии в реальных словарях — недостающий-ключ fallback покрывается unit-тестами на синтетических словарях, не порчей продакшн-контента):
   - `harness.language.ru.label`, `harness.language.en.label` — подписи пунктов QuickPick.
   - `harness.command.changeLanguage.prompt` — заголовок QuickPick.
2. **`package.nls.json`** (default, ru-текст — совпадает с `manifest.yaml → language.default`) и **`package.nls.en.json`** — по одному ключу `harness.command.changeLanguage.title`, на который ссылается `%harness.command.changeLanguage.title%` в новой записи `package.json → contributes.commands` (`command: "harness.changeLanguage"`, `category: "Harness"` — статичная, не локализуется, бренд-подобный namespace). VSCode нативно выбирает `package.nls.<vscode-display-language>.json`, иначе default — та же fallback-направленность (RU-полный default), что и в runtime-словаре.
3. **`src/locales/i18n.ts`** — два слоя в одном файле:
   - **Чистый слой** (без импорта `vscode`, тестируется напрямую в Jest):
     - `type Language = 'ru' | 'en'`; `interface HarnessConfig { language?: Language }`.
     - `resolveLanguage(envLanguage: string, stored: Language | undefined): Language` — `stored`, если задан; иначе `en`, если `envLanguage` (lowercase) начинается с `en`; иначе `ru` (проектный default покрывает всё остальное, включая сам `ru`).
     - `translate(dictionaries: Record<Language, Record<string, string>>, lang: Language, key: string): string` — `dictionaries[lang][key]` → иначе (если `lang !== 'ru'`) `dictionaries.ru[key]` → иначе сам `key`. Явно без исключений на любом пути (Acceptance).
     - `readHarnessConfig(configPath: string): Promise<Result<HarnessConfig, ConfigError>>` (тип `Result`/`ok`/`err` — переиспользуется импортом из `src/parser/types.ts`, без изменения этого файла). Отсутствующий файл — не ошибка (`ok({})`, ожидаемое первое включение, в отличие от `NotFound` для обязательного `manifest.yaml` в ADR-001/STEP-003 — сознательно другая семантика, зафиксирована комментарием в коде). Синтаксически некорректный JSON — деградация до `ok({})` с предупреждением через `vscode.window.showWarningMessage` на вызывающей стороне (чистая функция не знает про vscode), не крах (Reliability policy `docs/architecture.md`).
     - `writeHarnessConfig(configPath: string, config: HarnessConfig): Promise<Result<void, ConfigError>>` — `fs.mkdir(dirname, { recursive: true })` затем `fs.writeFile` (pretty JSON).
   - **Тонкий vscode-слой:**
     - `activateI18n(context: vscode.ExtensionContext): I18nService` — резолвит `configPath = path.join(workspaceFolders[0].uri.fsPath, '.project', 'harness-config.json')` (нет открытого workspace — сервис работает в режиме только автоопределения, персист недоступен, не крах); импортирует `ru.json`/`en.json` типизированным JSON-import (бандлится esbuild — без изменений упаковки/`.vscodeignore`, вне scope STEP-013); читает конфиг, резолвит стартовый язык; создаёт `vscode.EventEmitter<Language>` (`onDidChangeLanguage`); регистрирует `harness.changeLanguage`: если вызвана с явным `Language`-аргументом — использует его напрямую (программный/тестовый путь), иначе показывает `vscode.window.showQuickPick` с двумя локализованными пунктами; на выборе — обновляет state, файрит event, вызывает `writeHarnessConfig` (ошибка записи — `showWarningMessage`, не throw).
     - `getI18nService(): I18nService` — module-level singleton accessor для будущих потребителей (STEP-005/010), устанавливается `activateI18n`; вызов до активации — программная ошибка (falsifiable порядок activation в `extension.ts`), не пользовательский error path.
4. **`src/extension.ts`** — единственная правка: `activateI18n(context)` в `activate()`.

### Impacted modules/files

- Новые: `src/locales/{ru.json,en.json,i18n.ts}`, `package.nls.json`, `package.nls.en.json`, `tests/unit/locales/i18n.test.ts`, `tests/integration/i18n.test.js`.
- Точечно изменённые: `src/extension.ts`, `package.json` (`contributes.commands`), `tsconfig.json` (`resolveJsonModule`), `docs/architecture.md`, `docs/development.md`.
- Не затрагивается: `src/parser/**` (только читается тип `Result`/`ok`/`err`, без импорта путей/манифеста — i18n не знает о `.project/manifest.yaml`), `src/commands/**`/`src/explorer/**`/`src/editor/**`/`src/ui/**` (ещё не существуют).

### Data/API implications

- Публичный контракт для STEP-005/STEP-010: `import { getI18nService, Language } from '../locales/i18n'` → `service.t(key)`, `service.getLanguage()`, `service.onDidChangeLanguage`. Прямой импорт конкретного модуля, без barrel-файла (как и в parser layer).
- **Конвенция для STEP-005** (явно зафиксирована здесь, чтобы не изобреталась заново): каждая новая запись `contributes.commands` локализует `title` через `%key%` + `package.nls.json`/`package.nls.en.json`; category — по необходимости, не обязательно переводить.
- `package.json` поверхность: одна новая команда `harness.changeLanguage`.
- `.project/harness-config.json` — новый формат файла, единолично управляемый этим сервисом; схема на этом STEP — только `{ "language"?: "ru" | "en" }`, расширяемо без breaking change (unknown-поля не читаются, но и не удаляются при перезаписи — `writeHarnessConfig` мержит поверх прочитанного объекта, не перезаписывает файл целиком новым голым объектом).

### Test strategy

- `tests/unit/locales/i18n.test.ts` (Jest, без vscode-мока — тестируется только чистый слой):
  - `resolveLanguage`: `stored='en'` побеждает `envLanguage='ru-RU'`; без `stored` — `envLanguage` `'en'`/`'en-US'` → `en`; `'ru'`/`'de'`/`'fr'`/`''` → `ru` (default покрывает всё, кроме `en*`).
  - `translate` на синтетических словарях: точное совпадение; отсутствие в `en` → `ru`-значение; отсутствие в обоих → сам key; отсутствие в `ru` (не в `en`) — намеренно не поддерживаемый сценарий (RU — authoritative), тест фиксирует поведение «ключ», а не «крах».
  - `readHarnessConfig`/`writeHarnessConfig`: round-trip на `fs.mkdtemp(os.tmpdir())`; отсутствующий файл → `ok({})`; повреждённый JSON (fixture-строка) → **`err({kind:'invalid-json',...})`** без исключения (FIX STEP-004: формулировка ниже до этой правки ошибочно утверждала `ok({})` — расхождение прозы с фактическим поведением, отмечено Reviewer 2 REVIEW-2026-09-17T2200 как non-blocking наблюдение; сам код и тест всегда возвращали `err`, менялась только прозa плана).
  - Загрузка реальных `src/locales/ru.json`/`en.json` (`import`, не fixture-копия — это и есть продакшн-файл): все три demonstration-ключа присутствуют, идентичны по набору ключей в обоих файлах.
- `tests/integration/i18n.test.js` (Mocha/`@vscode/test-electron`, реальный `vscode`-модуль): `vscode.commands.getCommands(true)` содержит `harness.changeLanguage`; `executeCommand('harness.changeLanguage', 'en')` не бросает; после вызова `.project/harness-config.json` тестового workspace содержит `{"language":"en"}`; independent повторный `readHarnessConfig` на этом пути возвращает то же значение (persistence через реальный `vscode`, не мок).

### Verification sequence

1. `npm run compile` (`tsc --noEmit`, strict, включая новый `resolveJsonModule`).
2. `npm run lint`.
3. `npm run build` (esbuild — подтверждает, что JSON-словари и новая команда бандлятся без ошибок; `external: ['vscode']` не нарушен).
4. `npm test` — unit-тесты, включая новые `i18n.test.ts`, все существующие parser-тесты остаются зелёными (regression check).
5. `npm run test:integration` — включая новый `i18n.test.js`, существующий `extension.test.js` остаётся зелёным.
6. Ручная проверка в Extension Development Host: `Ctrl+Shift+P` → `Harness: Change language` (или `Harness: Изменить язык`, в зависимости от display language VSCode) видна и открывает QuickPick с двумя пунктами.

### Risks / rollback

- **VSCode не умеет динамически обновлять уже отрисованный title Command Palette без reload окна** — известное ограничение платформы (`package.nls.*` резолвится VSCode по `vscode.env.language` один раз при загрузке, не по ручному override нашего сервиса). Не противоречит Acceptance criteria этого STEP (они про сервис и его собственную команду, не про полный REQ-006), но ограничивает то, что STEP-010 сможет сделать «без перезапуска VSCode» для строк из `contributes.*` конкретно — зафиксировано здесь как известный factual constraint, не blocking для STEP-004, но обязательный контекст для STEP-010 при его собственном PLAN.
- Нет открытого workspace (`workspaceFolders` пуст) — персист языка недоступен; сервис деградирует до чистого автоопределения по `vscode.env.language`, не крашится. Покрыто явной веткой в `activateI18n`, не тестировано integration-тестом (требует запуска Extension Host без workspace — вне текущего `.vscode-test.mjs`, не блокирует Acceptance).
- Rollback STEP целиком: удалить `src/locales/**`, `tests/unit/locales/**`, `tests/integration/i18n.test.js`, `package.nls*.json`; откатить точечные правки `src/extension.ts`/`package.json`/`tsconfig.json`/`docs/architecture.md`/`docs/development.md`. Другие компоненты ещё не зависят от i18n (STEP-005 — первый потребитель, ещё не реализован).

### Handoff

`IMPLEMENT STEP-004`.

## Evidence

`IMPLEMENT STEP-004` (2026-09-17):

1. **Созданные файлы**: `src/locales/{ru.json,en.json,i18n.ts,activation.ts}` (см. п.2 ниже про разделение на два `.ts`-файла), `package.nls.json`, `package.nls.en.json`, `tests/unit/locales/i18n.test.ts`, `tests/integration/i18n.test.js`, `tests/fixtures/workspace/.gitkeep`.
2. **Точечные правки по Mutation policy → Conditional**: `src/extension.ts` (`activate()` теперь `async`, вызывает `activateI18n(context)`), `package.json` (`contributes.commands` → `harness.changeLanguage`), `tsconfig.json` (`resolveJsonModule: true`), `docs/architecture.md` (уточнение `## Security boundaries` про `.project/harness-config.json` вне ADR-001), `docs/development.md` (обновлён абзац `## Testing`).
3. **Коррекции, обнаруженные при IMPLEMENT и не предусмотренные PLAN** (зафиксированы явно, не скрыты):
   - **Разделение `i18n.ts` на чистый слой (`i18n.ts`) и vscode-слой (`activation.ts`)**. PLAN описывал «два слоя в одном файле», но реальный прогон `npm test` показал: `import * as vscode from 'vscode'` в верхней части модуля ломает Jest (`Cannot find module 'vscode'`) даже для файла, где вызовы vscode API физически не достигаются тестами — ES/CJS-модуль резолвится целиком при загрузке независимо от того, какие функции вызываются. Исправлено переносом `activateI18n`/`getI18nService`/`I18nService` в отдельный `src/locales/activation.ts`, импортирующий чистые функции из `i18n.ts`. Публичный контракт для STEP-005/STEP-010 из PLAN не изменился по сути, только путь: `getI18nService`/`I18nService` теперь из `../locales/activation`, а не `../locales/i18n`.
   - **`.vscode-test.mjs` — добавлен `workspaceFolder: 'tests/fixtures/workspace'`**. Не было в PLAN Mutation policy. Без реально открытого workspace `vscode.workspace.workspaceFolders` пуст в Extension Host, и `activateI18n` не может резолвить `.project/harness-config.json` — Test strategy PLAN явно требовала проверить персист в «workspace тестового окружения», что физически невозможно без этой опции (альтернатива — `vscode.workspace.updateWorkspaceFolders()` в рантайме теста — отклонена: по документации VSCode API добавление первой workspace-папки может перезапустить extension host, что сделало бы тест непредсказуемым).
   - Новая fixture-директория `tests/fixtures/workspace/` (с `.gitkeep`) — минимальный workspace для integration-тестов; генерируемый в ней `.project/harness-config.json` добавлен в `.gitignore` (`tests/fixtures/workspace/.project/`), тест дополнительно удаляет его в `suiteTeardown` — после прогона `git status` чист.
   - Тест на реальные словари использовал `toHaveProperty('harness.language.ru.label')` — Jest трактует точку в пути как вложенность (`harness → language → ru → label`), а не буквальный ключ; исправлено на `Object.prototype.hasOwnProperty.call(...)`.
4. **`npm run compile`** (`tsc --noEmit`, strict, включая новый `resolveJsonModule`) — 0 ошибок.
5. **`npm run lint`** (ESLint 10, `src/**`) — 0 ошибок/warnings.
6. **`npm run build`** (esbuild) — `esbuild: build complete.`; JSON-словари (`ru.json`/`en.json`) забандлены как literal-объекты, `external: ['vscode']` не нарушен.
7. **`npm test`** (Jest) — `Test Suites: 4 passed, 4 total`, `Tests: 41 passed, 41 total` (было 26 после STEP-003, добавлено 15 в `i18n.test.ts`). Все ранее существующие parser-тесты остались зелёными (regression check).
8. **`npm run test:integration`** (`@vscode/test-cli`, реальный VSCode `1.138.0` linux-x64, headless — в этой среде запустился без Xvfb) — `4 passing (108ms)`: `extension activates without throwing` (STEP-002, без регрессии) + три новых `i18n.test.js` (регистрация `harness.changeLanguage`; программный `executeCommand('harness.changeLanguage', 'en')` пишет `.project/harness-config.json` тестового workspace; независимое повторное чтение подтверждает persisted-значение).
9. **Ручная проверка F5/Extension Development Host не выполнялась в этой сессии** (нет интерактивного доступа к UI) — как и в STEP-002, `npm run test:integration` (п.8) уже подтверждает реальную активацию расширения и реальный вызов команды через настоящий Extension Host, что покрывает существо Verification sequence п.6 плана (видимость и функциональность команды), но не визуальный вид QuickPick.
10. **Покрытие Acceptance criteria**:
    - «Возвращает перевод по ключу для обоих языков» / «EN→RU fallback» / «RU→ключ fallback» — `translate` протестирован на синтетических словарях, все три ветки (`i18n.test.ts`).
    - «`vscode.env.language` определяет стартовый язык» — `resolveLanguage` протестирован на `en`/`en-US`/`ru`/`de`/`fr`/`''` (unit) и реально резолвится в `activateI18n` при отсутствии сохранённого языка (код-ревью самого модуля; отдельный integration-тест на этот путь не добавлен — см. `## Implementation plan → Risks`, ветка не критична и не тестировалась изолированно, так как персист-ветка её перекрывает при наличии сохранённого значения).
    - «Команда сохраняется и переживает перезапуск» — `readHarnessConfig`/`writeHarnessConfig` round-trip (unit) + реальный `executeCommand` → чтение с диска независимым вызовом (integration, `i18n.test.js`), что является практическим эквивалентом «переживает перезапуск» в границах возможностей test harness (полный relaunch Electron не автоматизирован — см. PLAN Risks).
11. **Не реализовано намеренно (Out of scope подтверждён)**: перевод текста нереализованных фич STEP-005..009; Output Channel «Harness» (STEP-009); Command Palette для остальных 11 команд (STEP-005).

## FIX STEP-004 (2026-09-17, закрытие findings `REVIEW-2026-09-17T2200.md`)

1. **F-001 Reviewer 1 закрыт (blocking):** `translate()` (`src/locales/i18n.ts`) получил опциональный `params?: Record<string,string>` с подстановкой `{placeholder}` через `String.prototype.replace`; недостающий параметр оставляет плейсхолдер как есть (не исключение). Добавлены ключи `harness.config.readError`/`harness.config.writeError` в `ru.json`/`en.json` (с плейсхолдерами `{path}`/`{message}`). `src/locales/activation.ts`: оба `vscode.window.showWarningMessage(...)` теперь вызывают `service.t('harness.config.readError'|'harness.config.writeError', { path, message })` вместо хардкод-строк на русском; `I18nService.t` расширен тем же `params?`-параметром.
2. **F-001 Reviewer 2 / F-002 Reviewer 1 закрыт (blocking, по существу одна находка):** `HarnessConfig` получил индексную сигнатуру `[key: string]: unknown`; `readHarnessConfig` теперь возвращает весь распарсенный объект (`{ ...parsed }`), нормализуя только `language` (удаляется, если не `'ru'|'en'`), вместо того чтобы конструировать новый объект из одного поля `language`. Проверено новым тестом на полный цикл read→merge→write (`tests/unit/locales/i18n.test.ts`) — поле `futureField` теперь переживает смену языка.
3. **Рекомендованные non-blocking из handoff — закрыты тестами** (production-код дополнительно не менялся, кроме уже описанного в п.1/2): `readHarnessConfig` на JSON-массиве/строке/числе/`null` (деградация до `ok({})`); объект с отсутствующим/невалидным `language`, но с другими полями (поля сохраняются, `language` отсутствует); `writeHarnessConfig` на ошибке `fs.mkdir` (путь назначения проходит через существующий файл, не директорию) → `err({kind:'write-failed',...})`, не исключение.
4. **Наблюдение Reviewer 2 (расхождение прозы плана с фактическим поведением) закрыто:** `## Implementation plan → Test strategy` исправлена — повреждённый JSON давал и продолжает давать `err({kind:'invalid-json',...})`, не `ok({})`; менялась только формулировка плана, не код/тест.
5. **Не закрыто намеренно (осталось как technical debt, не входило в обязательный/рекомендованный handoff):** Reviewer 1 F-003 (произвольные fs-ошибки чтения, не только ENOENT, маскируются под «файл отсутствует» без warning) — не обещано Acceptance criteria этого STEP, различение кодов ошибок — предмет отдельного ADD STEP при появлении реальной потребности в observability, а не скрытое расширение текущего FIX.
6. **Повторная verification** (полный прогон, не только изменённые файлы): `npm run compile` (0 ошибок), `npm run lint` (0 ошибок/warnings), `npm run build` (`esbuild: build complete.`), `npm test` — `Tests: 50 passed, 50 total` (было 41, добавлено 9), `npm run test:integration` — реальный VSCode `1.138.0` linux-x64 headless, `4 passing` (регрессии нет, сообщения об ошибках в этом прогоне не вызывались — happy-path команды не меняет поведение). После прогона `git status` вне заявленных Deliverables чист.

## Review status

**Latest verdict:** PASS
**Latest report:** `planning/reviews/STEP-004/REVIEW-2026-09-17T2300.md`

История: `REVIEW-2026-09-17T2200.md` — FAIL (F-001 Reviewer 1: хардкод RU в `activation.ts`; F-001 Reviewer 2/F-002 Reviewer 1: потеря неизвестных полей `.project/harness-config.json` при чтении), закрыт `FIX STEP-004`, подтверждено `REVIEW-2026-09-17T2300.md` — PASS (два независимых ревьюера).

## Blocker / Failure reason

Нет. Оба review-цикла пройдены: два независимых blocking finding первого цикла закрыты `FIX STEP-004` и подтверждены двумя независимыми повторными review (построчная проверка кода + собственные эмпирические тесты read→merge→write и интерполяции сообщений).
