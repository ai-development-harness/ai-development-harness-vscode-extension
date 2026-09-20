# STEP-007 — STEP File Editor (диагностика, code lens, hover, autocomplete, quick actions)

**Статус:** Выполнено
**Type:** IMPLEMENTATION
**Приоритет:** Высокий
**Фаза:** MVP — UI
**Depends on:** STEP-003, STEP-016

## Requirements

- REQ-003

## ADR

- ADR-002
- ADR-005

## Risk flags

- none

## Goal

Реализовать smart-редактор STEP-файлов: custom language, диагностика, code lens, hover, autocomplete, quick actions.

## Context

REQ-003, ADR-002 (реальный формат — labeled markdown без frontmatter, glob `STEP-*.md`, не расширение `.step.md`). Autocomplete и поиск `ADR-NNN` используют neutral Parser/path-resolution resolver ADR-005; STEP-007 не вводит собственную derivation путей.

## Scope

- TextMate grammar `syntaxes/harness-step.tmLanguage.json` и `language-configuration.json`, регистрация по glob `planning/tasks/STEP-*.md`.
- `validation.ts` — диагностика (пустые обязательные поля, битые REQ/STEP/ADR ссылки, циклические/неудовлетворяемые dependencies, попытка расширения Out of scope) как VSCode Diagnostics, non-blocking.
- `codeLens.ts` (Go to REQ/ADR, View in PLAN).
- `hoverProvider.ts`.
- `autocomplete.ts` (REQ-/STEP-/ADR- по существующим ID из parser layer).
- Quick actions (mark acceptance criterion done, request review, flag blocker, create follow-up STEP) как CodeActions/inline buttons.

## Mutation policy

### Allowed

- `src/editor/**`, `syntaxes/**`, `language-configuration.json`.

### Conditional

- Quick actions, мутирующие STEP-файл — только в пределах mutation policy самого STEP, не расширять production-логику мимо REQ-003.

### Forbidden

- Изменение самого протокола/TEMPLATE.md файлов.

## Out of scope

- STEP File Editor для REQ/ADR-файлов (в MVP фокус на STEP-NNN.md; расширение на REQ/ADR — отдельный REQ при запросе).

## Acceptance criteria

- Custom language активен только на `STEP-*.md`.
- Диагностика не блокирует редактирование.
- Code lens открывает целевой файл/секцию по клику.
- Autocomplete предлагает только существующие ID.
- Quick actions корректно обновляют файл.

## Verification

- Unit-тесты `validation.ts` на fixture STEP-файлах (валидных и с намеренными ошибками).
- Integration-тест открытия STEP-файла в Extension Development Host с проверкой диагностики.

## Deliverables

- `syntaxes/**`, `language-configuration.json`, `src/editor/**` + тесты.

## Implementation plan

**Plan status:** Ready
**Plan revision:** 1
**Planned at:** 2026-09-20T04:40:03+00:00
**Plan basis:** sha256:71c4d278bfba94e2a9ccdc5235e4221dc5e75c9ae2328ead848549f8b017acaf

### Предпосылки и границы

- Зависимости `STEP-003` и `STEP-016` завершены: использовать публичные
  `parseStepFile`/`parseReqSpec`/`parseAdrFile` и
  `resolveHarnessArtifactPath`, не копировать правила расположения
  `docs/adr` или других артефактов в Editor.
- Целевой документ определяется единственным VSCode `DocumentSelector` для
  языка `harness-step` и glob `**/planning/tasks/STEP-*.md`; обычные Markdown,
  REQ и ADR не получают ни подсветку, ни providers.
- Проверки и подсказки остаются advisory: диагностический provider никогда не
  отменяет изменение документа и не выполняет запись сам.
- «Расширение Out of scope» диагностируется как противоречие между
  нормализованным пунктом `Scope` и пунктом `Out of scope` одного STEP. Это
  проверяемая семантика содержимого, а не недоказуемое предположение о
  намерении пользователя или скрытое хранение истории редактора.

### Порядок реализации

1. Добавить `harness-step` в `package.json` с path-glob для
   `planning/tasks/STEP-*.md`, TextMate grammar
   `syntaxes/harness-step.tmLanguage.json` и `language-configuration.json`.
   Grammar выделяет заголовки, обязательные bold-метки, идентификаторы
   `STEP-NNN`/`REQ-NNN`/`ADR-NNN`, а также секции и markdown-чекбоксы; она не
   назначается по расширению `.md` в целом.
2. Создать `src/editor/validation.ts` как чистый слой. Он строит структурные
   diagnostics из текста STEP и индекса текущего workspace: пустые
   обязательные поля/секции, отсутствующие REQ/STEP/ADR, отсутствующие или
   незавершённые hard dependencies, dependency cycles и конфликт Scope с Out
   of scope. Для каждой ошибки возвращать точный range и severity; ошибки
   чтения optional ADR directory по ADR-005 приводят к локальной
   диагностике/деградации, без guessed path или filesystem scan.
3. В `src/editor/activation.ts` создать workspace index через manifest и
   Parser boundary, зарегистрировать `DiagnosticCollection`, обработчики
   открытия/изменения/закрытия документов и debounce валидации. Индекс REQ
   читается из `sources.requirements`, STEP — из `protocol.taskDirectory`, ADR
   — только через `resolveHarnessArtifactPath(manifest, 'adrDirectory')`.
   При недоступном manifest providers локально не действуют и не ломают
   редактор.
4. Реализовать `codeLens.ts` и `hoverProvider.ts`: ссылки REQ/ADR получают
   точный target, а ссылка PLAN — `sources.roadmap`; переход открывает файл и
   позиционируется на найденный идентификатор/строку. Hover показывает
   компактные данные распарсенного target либо локальное сообщение о его
   недоступности, не подменяя ошибочный target догадкой.
5. Реализовать `autocomplete.ts` из того же индекса: после префиксов
   `REQ-`, `STEP-`, `ADR-` предлагать только существующие IDs соответствующего
   типа, с documentation/detail. Не предлагать ID из недоступного источника и
   не выполнять I/O на каждый символ вне debounce/кэша activation boundary.
6. Реализовать `codeActions.ts`. Для пункта Acceptance criteria action
   заменяет только выбранный bullet на `- [x] ...` через `WorkspaceEdit`.
   Request review, flag blocker и create follow-up делегируют существующим
   зарегистрированным командам `harness.review`,
   `harness.explorer.flagBlocker` и
   `harness.explorer.createFollowUpStep` с ID текущего STEP: тем самым
   сохраняются уже существующие pre-dispatch, confirm и guarded-write
   границы. Action не делает прямую запись за пределами выбранного acceptance
   bullet и не изменяет протокол/TEMPLATE.
7. Подключить Editor activation из `src/extension.ts`, добавить RU/EN ключи
   только для отображаемых диагностик, hover и actions, затем расширить
   package manifests и test setup без затрагивания Command/Explorer logic.

### Затрагиваемые области и совместимость

- Новые: `src/editor/{activation,validation,codeLens,hoverProvider,autocomplete,codeActions}.ts`,
  `syntaxes/harness-step.tmLanguage.json`, `language-configuration.json`,
  editor-specific unit/integration tests.
- Изменяемые: `package.json`, `src/extension.ts`,
  `src/locales/{ru,en}.json`, при необходимости `tests/integration/extension.test.js`.
- Не меняются Parser contracts, `.project/manifest.yaml`, markdown templates,
  protocol и существующие command/explorer mutation paths. Новые данные,
  network, migrations и public API отсутствуют.

### Стратегия тестирования и verification

1. Unit-тесты `validation.ts` на реальных и синтетических fixture STEP:
   пустые поля, каждая битая ссылка, missing/unsatisfied dependency, цикл,
   Scope/Out-of-scope conflict и корректный документ; отдельно — отсутствие
   ADR resolver target без fallback.
2. Unit-тесты providers: selector ограничен `STEP-*.md`; lens/hover ведут в
   правильный artifact/PLAN, autocomplete содержит только ID из индексируемых
   источников, CodeAction создаёт минимальный `WorkspaceEdit` или делегирует
   точную команду с ID.
3. Integration-тест в реальном headless Extension Development Host: открыть
   fixture `STEP-*.md`, дождаться Diagnostics, проверить регистрацию language
   и providers, а также применить acceptance CodeAction к временной копии
   файла. Временный файл удалить в teardown; исходные fixture не менять.
4. Перед handoff выполнить `npm run compile`, `npm run lint`, `npm test`,
   `npm run build`, `npm run test:integration` и `git diff --check`.

### Риски и rollback

- TextMate grammar и VSCode contribution проверяются через фактически
  загруженный manifest в Extension Host; при ошибке registration удалить
  только новый editor contribution, не расширяя glob на все Markdown.
- Индексация workspace должна быть ограничена manifest/resolver paths и
  обновляться с debounce; при недоступном optional source соответствующая
  функция деградирует локально.
- Мутирующие actions ограничены минимальным edit либо существующими
  guarded-write командами; rollback — удалить editor layer и contributions,
  не требуется migration или восстановление данных.

## Evidence

- Command: `npm run compile`; Exit code: 0; Observed: TypeScript compilation completed without errors.
- Command: `npm run lint`; Exit code: 0; Observed: ESLint passed for `src`.
- Command: `npm test`; Exit code: 0; Observed: 23 suites and 297 tests passed.
- Command: `npm run build`; Exit code: 0; Observed: esbuild completed successfully.
- Command: `XDG_RUNTIME_DIR=/tmp npm run test:integration`; Exit code: 0; Observed: 21 Extension Development Host tests passed, including `STEP editor (STEP-007)` for `STEP-*.md` language and non-blocking diagnostics.
- Command: `git diff --check`; Exit code: 0; Observed: no whitespace errors.
- Повторный verification после remediation: `npm run compile && npm run lint && npm test && npm run build && XDG_RUNTIME_DIR=/tmp npm run test:integration && git diff --check`; Exit code: 0; Observed: 24 unit suites / 299 tests и 21 Extension Development Host tests passed.
- Command: `node -e "const grammar=require('./syntaxes/harness-step.tmLanguage.json'); for (const item of grammar.patterns) new RegExp(item.match); const checkbox=new RegExp(grammar.patterns.at(-1).match); if (!checkbox.test('- [ ] item') || !checkbox.test('- [x] item') || !checkbox.test('- [X] item') || checkbox.test('- [y] item')) process.exit(1);" && npm run compile && git diff --check`; Exit code: 0; Observed: JSON grammar loaded, every `patterns[].match` compiled, checkbox matched unchecked/lowercase-uppercase checked forms only, TypeScript and whitespace checks passed.
- Повторный verification после provider coverage: `npm run compile && npm run lint && npm test && npm run build && XDG_RUNTIME_DIR=/tmp npm run test:integration && git diff --check`; Exit code: 0; Observed: 25 unit suites / 302 tests и 21 Extension Development Host tests passed.
- Независимый root-agent verification: `npm run compile && npm run lint && npm test && npm run build && XDG_RUNTIME_DIR=/tmp npm run test:integration && git diff --check`; Exit code: 0; Observed: 25 Jest suites / 302 tests, build и 21 Extension Development Host test passed; `Gtk`, `DBus`, `NSS` и ChatModel log-сообщения не повлияли на exit code 0.
- Regression после ручного F5: `npm run compile && npm run lint && npm test -- --runInBand && git diff --check`; Exit code: 0; Observed: 25 Jest suites / 303 tests passed. `Requirements`, `ADR` и `Scope` с prose больше не диагностируются как пустые без распознанных ID/bullet.
- Regression автокомплита после ручного F5: `npm run compile && npm run lint && npm test -- --runInBand && npm run build && git diff --check`; Exit code: 0; Observed: 25 Jest suites / 303 tests passed. Completion item заменяет полный typed `REQ-/STEP-/ADR-` prefix, вставляет только ID и выводит описание через documentation pane.
- Extension Host regression ADR completion: `npm run compile && npm run lint && npm test -- --runInBand && npm run build && XDG_RUNTIME_DIR=/tmp npm run test:integration && git diff --check`; Exit code: 0; Observed: 25 Jest suites / 303 tests и 22 Extension Development Host tests passed. Реальный `CompletionItem` для `ADR-001` имеет `detail === undefined`, непустую `documentation`, `insertText === 'ADR-001'` и range, заменяющий полный `ADR-`.
- Regression dependency diagnostic range: `npm run compile && npm run lint && npm test -- --runInBand tests/unit/editor/validation.test.ts && npm run build && git diff --check`; Exit code: 0; Observed: 6 validation tests passed. Каждая невыполненная dependency привязана к собственному ID из `Depends on` и подчёркивает весь ID.
- Definition Provider: `npm run compile && npm run lint && npm test -- --runInBand && npm run build && XDG_RUNTIME_DIR=/tmp npm run test:integration && git diff --check`; Exit code: 0; Observed: 25 Jest suites / 304 tests и 23 Extension Development Host tests passed. `vscode.executeDefinitionProvider` ведёт по REQ, ADR и STEP reference в canonical manifest-resolved файлы.
- Исправление findings F-001..F-006: `npm run compile && npm run lint && npm test -- --runInBand && npm run build && XDG_RUNTIME_DIR=/tmp npm run test:integration && git diff --check`; Exit code: 0; Observed: 25 Jest suites / 306 tests и 26 Extension Development Host tests passed. Проверены canonical plain acceptance bullet, переход PLAN на целевой STEP, manifest-resolved watcher refresh после create/delete, canonical URI для suffix STEP и exact ADR filename, section-scoped ranges битых REQ/ADR/STEP и деградация при исчезновении файла во время индексации.
- Исправление F-001 повторного review: `npm run compile && npm run lint && npm test -- --runInBand && npm run build && XDG_RUNTIME_DIR=/tmp npm run test:integration && git diff --check`; Exit code: 0; Observed: 25 Jest suites / 306 tests и 27 Extension Development Host tests passed. После успешной замены editor index watcher публикует `onDidChangeCodeLenses`; реальный Extension Host держит STEP открытым и подтверждает появление и исчезновение ADR CodeLens после внешнего create/delete target без изменения или переоткрытия исходного STEP.
- Исправление F-001 из `REVIEW-2026-09-20T0651Z.md`: `npm run compile && npm run lint && npm test -- --runInBand && npm run build && XDG_RUNTIME_DIR=/tmp npm run test:integration && python3 tools/harness/validate.py --mode commit && git diff --check`; Exit code: 0; Observed: 25 Jest suites / 307 tests, 27 Extension Development Host tests и Harness validation (363 tracked files) passed. `CodeLensRefreshController` публикует инвалидацию ровно после успешной замены index, не публикует её после ошибки refresh и подавляет отложенное или уже выполняющееся событие после dispose.
- Исправление F-001 из `REVIEW-2026-09-20T0659Z.md`: `npm run compile && npm run lint && npm test -- --runInBand && npm run build && XDG_RUNTIME_DIR=/tmp npm run test:integration && python3 tools/harness/validate.py --mode commit && git diff --check`; Exit code: 0; Observed: 25 Jest suites / 309 tests, 27 Extension Development Host tests и Harness validation passed. Generation guard применяет manifest/index, перевыставляет watcher, валидирует документы и публикует CodeLens event только для последнего watcher refresh; controlled Promise regression доказывает, что завершившийся позднее A не перезаписывает завершившийся первым B, а `false` path не применяет index и не публикует событие.

## Review status

**Latest verdict:** PASS
**Latest report:** `planning/reviews/STEP-007/REVIEW-2026-09-20T0708Z.md`

## Blocker / Failure reason

—
