# STEP-003 — Parser layer (manifest, STEP/REQ/ADR, EXECUTION_PROTOCOL)

**Статус:** Выполнено
**Type:** IMPLEMENTATION
**Приоритет:** Критический
**Фаза:** MVP — фундамент
**Depends on:** STEP-002

## Requirements

- REQ-001, REQ-002, REQ-003

## ADR

- ADR-001, ADR-002

## Risk flags

- none

## Goal

Реализовать слой чтения и парсинга Harness-артефактов (manifest, STEP/REQ/ADR markdown, EXECUTION_PROTOCOL.md) как единственный источник путей и структурированных данных для остальных компонентов.

## Context

ADR-001 и ADR-002 фиксируют решения (пути только из манифеста, labeled-markdown формат без frontmatter); реализация ещё не существует.

## Scope

- `yamlParser.ts` — чтение `.project/manifest.yaml` (`project.initialized`, `protocol.*`, `sources.*`, `language.*`).
- `markdownParser.ts` — извлечение bold-меток и секций из STEP/REQ/ADR-файлов по реальному формату TEMPLATE.md.
- `executionProtocol.ts` — структурный разбор `planning/EXECUTION_PROTOCOL.md` (список команд, enum статусов), по возможности динамически, не хардкодом.
- `types.ts` — типы результатов парсинга.
- Обработка отсутствующего/повреждённого манифеста: явная ошибка «не похоже на Harness-проект», без угадывания путей.

## Mutation policy

### Allowed

- `src/parser/**`, unit-тесты парсера.

### Conditional

- Изменение `types.ts` при появлении новых полей манифеста.
- `package.json`/`package-lock.json` — строго добавление одной production YAML-зависимости для `yamlParser.ts` (в репозитории нет ни одной production YAML-библиотеки; `js-yaml` присутствует только транзитивно у dev-инструментов). Без прочих изменений манифеста расширения.
- `tsconfig.json` — строго добавление `compilerOptions.types: ["node", "jest"]`. Обнаружено при `IMPLEMENT`: автоматическое подключение глобальных `@types/*` (Node-глобалы `__dirname`/`console`, Jest-глобалы `describe`/`it`/`expect`) не работает в этом окружении/версии TypeScript ни для одного файла без явного поля `types` (воспроизведено на изолированном minimal-repro вне зависимости от остального `node_modules`). Дефект STEP-002 не проявлялся, так как `src/extension.ts` не использовал ни Node-, ни Jest-глобалы. `@types/vscode` не затронут — резолвится через обычный `import 'vscode'`, а не через этот механизм.
- `docs/development.md` — строго исправление одной строки в секции `## Testing`, утверждавшей «на STEP-002 содержательных тестов ещё нет» — это первый STEP, добавивший реальные unit-тесты, утверждение устарело.

### Forbidden

- UI-код (explorer/editor/statusbar), agent integration.

## Out of scope

- Кэширование/инвалидация (появится вместе с explorer/status bar STEP при необходимости).
- Запись файлов — парсер только читает.

## Acceptance criteria

- Парсер корректно читает реальный `.project/manifest.yaml` из этого репозитория и из `ai-development-harness-template`.
- Парсер STEP-файла извлекает все поля реального `planning/tasks/TEMPLATE.md`.
- Парсер REQ/ADR извлекает поля соответствующих TEMPLATE.md.
- Отсутствующий манифест даёт понятную ошибку, а не исключение/краш.

## Verification

- Unit-тесты (`npm test`) на fixtures — реальные TEMPLATE.md и манифест, скопированные в `tests/fixtures`.

## Deliverables

- `src/parser/{yamlParser,markdownParser,executionProtocol,types}.ts` + тесты.
- `tests/fixtures/**`.

## Implementation plan

**Plan status:** Planned
**Plan revision:** 1
**Planned at:** 2026-09-17T2100

### Предпосылки

- STEP-002 выполнен (`PASS`) — hard dependency удовлетворена, доступен toolchain (TS strict, ESLint, esbuild, Jest, `@vscode/test-cli`).
- Новый ADR не требуется: ADR-001 (пути только из манифеста) и ADR-002 (labeled markdown, не frontmatter) уже фиксируют оба архитектурных решения этого STEP. Выбор конкретной YAML-библиотеки и способа парсинга markdown — implementation detail, не решение уровня ADR.
- Коррекция task-контракта: Mutation policy STEP-003 не покрывала добавление npm-зависимости для чтения YAML — исправлено этим PLAN (см. `## Mutation policy → Conditional` выше), а не спрятано внутри этого плана.

### Implementation approach

1. **`types.ts`** — единый `Result<T, E>` (`{ ok: true; value: T } | { ok: false; error: E }`) как contract возврата всех parser-функций: ожидаемые ошибки (нет манифеста, битый YAML, отсутствующее обязательное поле, нераспознанная markdown-секция) — это значения, не исключения, — соответствует требованию ADR-001/ADR-002 «явная ошибка/деградация, не крах». Типы: `ManifestData` (1:1 со схемой `.project/manifest.yaml`: harness/project/language/sources/protocol/repository), `ManifestError = NotFound | InvalidYaml(details) | MissingRequiredField(path)`, `StepData`/`ReqData`/`AdrData` (1:1 с полями реальных `TEMPLATE.md`), `ParseWarning { field, reason }` — для нераспознанных/пустых необязательных меток, не блокирует результат, `ExecutionProtocolData { stepTypes, stepStatuses, riskFlags, requiredStepFields, commands: { name, sectionTitle }[] }`.
2. **`yamlParser.ts`** — `parseManifest(manifestPath): Promise<Result<ManifestData, ManifestError>>`. Читает файл через `fs/promises`; отсутствие файла → `NotFound` (текст для пользователя формирует UI-слой/i18n, вне scope STEP-003). Парсит через новую dependency `yaml` (чистый JS, включённые TS-типы, без native bindings). Валидирует обязательные по ADR-001 ключи (`project.initialized`, `protocol.*`, `sources.*`, `repository.*`, `language.*`) → отсутствие обязательного ключа даёт `MissingRequiredField`. Пути не хардкодятся — возвращаемый объект сам является источником путей для остальных слоёв.
3. **`markdownParser.ts`** — низкоуровневый `extractLabeledSections(content)`: построчный regex-разбор по `##`/`###`/`####` заголовкам и `**Label:** value` строкам (без remark/unified — формат TEMPLATE.md жёстко строчный, AST-библиотека добавила бы вес бандла без пользы). `parseStepFile`, `parseReqSpec` (SPEC.md — несколько REQ через `### REQ-NNN — <Название>` + разделитель `---`), `parseAdrFile` — каждая со своей меткой→поле картой по реальному TEMPLATE.md своей сущности (ADR-002 явно фиксирует риск смешения RU/EN меток: `**Статус:**` в STEP, `**Status:**`/`**Date:**` в ADR — маппинги не унифицируются одним RU/EN словарём). Нераспознанное/пустое обязательное поле → `ParseWarning`, не exception. Функции чистые (принимают string, не читают файлы) — тестируемость на fixtures.
4. **`executionProtocol.ts`** — `parseExecutionProtocol(content)`. Статусы/типы STEP/risk flags/обязательные поля STEP извлекаются по буллет-листу внутри секции, найденной по тексту заголовка (не по номеру раздела — номер может сдвинуться при правке протокола). Команды — сканирование всех H2 вида `` ## N. `COMMAND NAME` `` по всему файлу, без привязки к конкретным номерам (соответствует «по возможности динамически» из scope: правка протокола не требует правки парсера). Ненайденная секция → `ParseWarning` и частичный результат, не полный отказ.

### Impacted modules/files

- Новые: `src/parser/{types,yamlParser,markdownParser,executionProtocol}.ts`.
- Тесты: `tests/unit/parser/{yamlParser,markdownParser,executionProtocol}.test.ts`.
- Fixtures (копии реальных файлов, кроме одного намеренно синтетического): `tests/fixtures/manifest/initialized.manifest.yaml` (копия `.project/manifest.yaml` этого репозитория), `tests/fixtures/manifest/uninitialized.manifest.yaml` (копия из `ai-development-harness-template`), `tests/fixtures/tasks/{TEMPLATE.md,STEP-002.md}`, `tests/fixtures/tasks/STEP-malformed.md` (единственный не скопированный 1:1 — намеренно повреждён для теста деградации), `tests/fixtures/requirements/{TEMPLATE.md,SPEC.md}`, `tests/fixtures/adr/{TEMPLATE.md,ADR-001-manifest-driven-paths.md,ADR-002-step-file-format.md}`, `tests/fixtures/protocol/EXECUTION_PROTOCOL.md`.
- `package.json`/`package-lock.json` — добавление `yaml` в `dependencies`.
- Не затрагивается: `src/extension.ts` и `src/{commands,explorer,editor,ui}/**` (ещё не существуют; parser не создаёт на них зависимостей).

### Data/API implications

- Публичный контракт для будущих потребителей (STEP-005/006/007/008) — прямой импорт из конкретных модулей `src/parser/*`; barrel-файл не создаётся (вне текущего Deliverables scope).
- Единственное изменение поверхности `package.json` — новая runtime-зависимость `yaml` (бандлится esbuild).
- Типы `ManifestData`/`StepData`/`ReqData`/`AdrData`/`ExecutionProtocolData` — internal-only, не сериализуются наружу; парсер только читает файлы (Out of scope подтверждён), ничего не пишет.

### Test strategy

- Jest unit-тесты (`ts-jest`, `roots: tests/unit`, уже сконфигурирован STEP-002) на всех fixtures.
- Позитивные кейсы: оба реальных манифеста (initialized/uninitialized), реальный `STEP-002.md`, реальный `SPEC.md` (REQ-001..010 извлекаются полностью), оба реальных ADR, реальный `EXECUTION_PROTOCOL.md` (статусы/типы/risk flags/команды).
- Негативные/деградационные кейсы: отсутствующий манифест → `ManifestError.NotFound` как значение, не throw; `STEP-malformed.md` (пустое обязательное поле) → `ok: true` с непустым `warnings`, если markdown-структура читаема, либо явный `ParseError`, если секции отсутствуют полностью — граница фиксируется тестом, не только прозой плана.

### Verification sequence

1. `npm run compile` (`tsc --noEmit`, strict).
2. `npm run lint`.
3. `npm test` — все unit-тесты parser проходят, включая fixture-тесты обоих acceptance criteria (манифест этого репозитория и манифест `ai-development-harness-template`).
4. Ручная проверка: `parseManifest` резолвит все пути `sources.*`/`protocol.*`/`repository.*` в конкретные, уже известные из чтения репозитория значения (assert по фактическим строкам, не приближённо).

### Risks / rollback

- Расхождение будущего `UPDATE HARNESS` с текущим `TEMPLATE.md` может сломать парсер полей — покрыто ADR-002 п.3 (деградация + fixture-тесты); полное устранение риска вне STEP-003, переподтверждение — отдельный STEP при `UPDATE HARNESS` (уже зафиксировано в ADR-002 Compatibility).
- Зависимость `yaml` — низкий риск (чистый JS, TS-типы, без native bindings). Rollback тривиален: parser — первый и единственный потребитель этой зависимости, другие компоненты на `src/parser/**` ещё не ссылаются (все consumer STEP запланированы позже).
- Rollback STEP целиком: удалить `src/parser/**`, `tests/unit/parser/**`, `tests/fixtures/**`, откатить `package.json`/`package-lock.json`.

### Handoff

`IMPLEMENT STEP-003`.

## Evidence

`IMPLEMENT STEP-003` (2026-09-17):

1. **Созданные файлы**: `src/parser/{types,yamlParser,markdownParser,executionProtocol}.ts`; тесты `tests/unit/parser/{yamlParser,markdownParser,executionProtocol}.test.ts`; fixtures `tests/fixtures/manifest/{initialized,uninitialized}.manifest.yaml` (копии реальных манифестов этого репозитория и `ai-development-harness-template`), `tests/fixtures/tasks/{TEMPLATE.md,STEP-002.md,STEP-malformed.md}` (первые два — копии реальных файлов, третий — намеренно синтетический с пустым `Goal` и отсутствующей секцией `ADR`, для проверки деградации), `tests/fixtures/requirements/{TEMPLATE.md,SPEC.md}`, `tests/fixtures/adr/{TEMPLATE.md,ADR-001-manifest-driven-paths.md,ADR-002-step-file-format.md}`, `tests/fixtures/protocol/EXECUTION_PROTOCOL.md`.
2. **Коррекции task-контракта, зафиксированные в `## Mutation policy` выше** (не спрятаны внутри Evidence):
   - `package.json`/`package-lock.json` — добавлена production-зависимость `yaml@^2.9.1` (`npm install yaml@^2.9.1 --save`, добавлено 1 package, конфликтов нет).
   - `tsconfig.json` — добавлено `compilerOptions.types: ["node", "jest"]`. Обнаружено при `tsc --noEmit`: без явного `types` компилятор не подключал ни `@types/node` (`__dirname`, `console`, `node:fs/promises`), ни `@types/jest` (`describe`/`it`/`expect`) ни для одного файла — воспроизведено на изолированном minimal-repro (`/tmp/ts-scratch`, тот же `tsconfig.json`, symlink на тот же `node_modules`) независимо от остального окружения. `@types/vscode` не затронут (резолвится через `import 'vscode'`, отдельный механизм). Дефект существовал с STEP-002, но не проявлялся — `src/extension.ts` не использовал эти глобалы.
   - `docs/development.md` — исправлена одна устаревшая строка в `## Testing` ("на STEP-002 содержательных тестов ещё нет").
3. **`npm run compile`** (`tsc --noEmit`, strict, после исправления tsconfig) — 0 ошибок.
4. **`npm run lint`** (ESLint 10, `src/**`) — 0 ошибок/warnings.
5. **`npm run build`** (esbuild) — `esbuild: build complete.`, бандл с новой зависимостью `yaml` собирается без ошибок (ручная доп. проверка сверх Verification секции — подтверждает, что добавленная production-зависимость не ломает существующий deliverable STEP-002).
6. **`npm test`** (Jest) — `Test Suites: 3 passed, 3 total`, `Tests: 20 passed, 20 total`. Наблюдение (не блокирует, exit 0): ts-jest печатает `WARN TS151002` про `isolatedModules` при `module: Node16` — не исправлялось в рамках этого STEP (не входит в объявленный scope/Mutation policy, не влияет на прохождение тестов); возможный follow-up при появлении реальной необходимости.
7. **Покрытие acceptance criteria тестами**:
   - Оба реальных манифеста (этот репозиторий, `initialized: true`; `ai-development-harness-template`, `initialized: false`) читаются корректно, с проверкой конкретных значений путей (`yamlParser.test.ts`, 5 тестов, включая `NotFound`/`InvalidYaml`/`MissingRequiredField` как значения, не exceptions).
   - `parseStepFile` извлекает все поля реального `STEP-002.md` (проверены значения) и реального `planning/tasks/TEMPLATE.md` (все секции найдены, warnings пуст); деградация проверена на синтетическом `STEP-malformed.md` (`markdownParser.test.ts`, 5 тестов на STEP).
   - `parseReqSpec` извлекает все REQ-001..010 из реального `docs/requirements/SPEC.md` (id/title/status/priority/source/traceability проверены выборочно на REQ-001/003/007) и поля `docs/requirements/TEMPLATE.md` (3 теста).
   - `parseAdrFile` извлекает поля обоих реальных ADR (включая `alternativesConsidered` — 2 варианта у каждого, `traceability` с несколькими ID) и `docs/adr/TEMPLATE.md` (4 теста).
   - `parseExecutionProtocol` извлекает 10 типов STEP, 6 статусов, 9 risk flags, 20 обязательных полей и 22 команды (динамически, сканированием заголовков `` N. `TOKEN` ``, включая edge case с двумя backtick-группами в одном заголовке — `COMMIT`) из реального `EXECUTION_PROTOCOL.md`; деградация проверена на синтетическом неполном протоколе (3 теста).
8. **Не реализовано намеренно (Out of scope подтверждён)**: кэширование/инвалидация, запись файлов — парсер строго read-only, ничего не пишет ни в одном тесте/пути кода.

## FIX STEP-003 (2026-09-17, закрытие findings `REVIEW-2026-09-17T2245.md`)

Production-код парсера не менялся — все findings были про test coverage, не про дефект поведения на реальных данных.

1. **F-001 закрыт (blocking)**: добавлен `tests/fixtures/adr/ADR-malformed.md` (синтетический ADR без корневых меток `Status/Date/Deciders/Supersedes/Superseded by`, без секций `Alternatives considered` и `Traceability`) + тест в `markdownParser.test.ts` (`parseAdrFile`), проверяющий `ok: true` с непустыми `warnings` по всем 7 отсутствующим полям/секциям, а не exception.
2. **F-002 закрыт (blocking)**: добавлен тест в `markdownParser.test.ts` (`parseReqSpec`) с inline REQ-блоком без меток `Статус`/`Источник` и без секций `Rationale`/`Traceability` — проверено `ok: true`, корректные warnings с префиксом `REQ-777.*`, и что присутствующие поля (`Приоритет`, `Requirement`, `Acceptance`) warnings не получают.
3. **F-003 закрыт**: добавлен `tests/fixtures/tasks/STEP-malformed-2.md` (без корневых меток `Статус/Type/Приоритет/Фаза/Depends on`, без секций `Goal/Context/Mutation policy/Implementation plan/Evidence/Review status/Blocker` целиком) + тест, проверяющий warnings по всем 12 отсутствующим полям/секциям и что реально присутствующие секции (`Requirements`, `Scope`) при этом извлекаются штатно.
4. **F-004 закрыт**: два новых теста в `yamlParser.test.ts` — `MissingRequiredField` на отсутствующем вложенном поле (`sources` присутствует целиком, `sources.roadmap` отсутствует → `error.field === 'sources.roadmap'`, не только на отсутствующей секции целиком, как было ранее) и `InvalidYaml`, если документ синтаксически валиден, но не объект (YAML-список верхнего уровня).
5. **F-005 закрыт**: тест в `executionProtocol.test.ts` — `parseExecutionProtocol('текст без заголовков')` (непустой контент) → `error.kind === 'missing-heading'`, симметрично уже покрытому случаю для `parseStepFile`/`parseReqSpec`.
6. **F-006 (design note, не blocking) — решено не кодировать, а задокументировать**: секция/токен-лист, найденные, но давшие 0 распознанных элементов, warning не получают (только полное отсутствие секции — warning). Осознанное решение: отличить «формат сломался» от «легитимно объявлено пусто» (например, содержательное `- none` в Risk flags) по одной лишь структуре невозможно без догадок о намерении автора файла — такая эвристика была бы источником ложных warnings, а не сигналом реальной проблемы. Если у diagnostics-слоя (REQ-003/STEP-007) появится содержательная потребность (например, "секция технически распознана, но выглядит подозрительно пустой") — это решение того UI-слоя с доступом к семантике, не структурного парсера STEP-003.
7. **F-007/F-008 сознательно отложены (как допустил handoff review)**: F-007 (fenced code blocks в `splitSections` могут сломать границы секций) не проявляется ни на одном реальном файле репозитория сегодня — исправление добавило бы новую логику отслеживания ``` ``` ``` без единого реального fixture, который бы её проверял (создание такого fixture было бы гаданием о будущем формате, а не текущим требованием). F-008 (`ExecutionProtocolCommand.name` не нормализован для многословных заголовков команд) явно отмечен ревьюером как забота будущего `STEP-005` (Command Palette), не нарушающая ни одного acceptance criterion STEP-003 — нормализация токена команды осмысленна только в контексте того, как STEP-005 будет их отображать/диспетчеризовать.
8. **Повторная verification после правок**: `npm run compile` (0 ошибок), `npm run lint` (0 ошибок/warnings), `npm run build` (`esbuild: build complete.`), `npm test` — `Tests: 26 passed, 26 total` (было 20, добавлено 6). Branch coverage `src/parser/**` до FIX (по независимому test reviewer): `yamlParser.ts` 65.1%, `markdownParser.ts` 62.85%, `executionProtocol.ts` 92.3%. После FIX (`npx jest --coverage --collectCoverageFrom='src/parser/**/*.ts'`): `yamlParser.ts` 69.76%, `markdownParser.ts` 73.14%, `executionProtocol.ts` 96.15% — оставшиеся непокрытые ветки повторяют один и тот же паттерн «отсутствует конкретное одно из N параллельных полей одного класса» (например, `Allowed` vs `Conditional` vs `Forbidden` по отдельности), уже представленный минимум одним тестом на класс; дальнейшее наращивание было бы coverage ради coverage, не покрытием нового класса риска.

## Review status

**Latest verdict:** PASS
**Latest report:** `planning/reviews/STEP-003/REVIEW-2026-09-17T2320.md`

История: `REVIEW-2026-09-17T2245.md` — FAIL (F-001, F-002 blocking), закрыт `FIX STEP-003`, подтверждено `REVIEW-2026-09-17T2320.md` — PASS.

## Blocker / Failure reason

Нет. Оба review-цикла пройдены: два blocking finding первого цикла (F-001, F-002) закрыты `FIX STEP-003` и подтверждены независимым повторным review.
