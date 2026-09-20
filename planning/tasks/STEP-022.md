# STEP-022 — Назначать язык Smart STEP Editor для manifest-resolved taskDirectory

**Статус:** Выполнено
**Type:** BUGFIX
**Приоритет:** Высокий
**Фаза:** MVP — UI
**Depends on:** STEP-007, STEP-021

## Requirements

- REQ-003

## ADR

- ADR-002
- ADR-005

## Risk flags

- concurrency

## Goal

Сделать Smart STEP Editor manifest-driven и для custom `protocol.taskDirectory`:
канонический STEP-документ должен получить `harness-step` через публичный VS Code
API и подключить существующие language-only providers.

## Context

После завершённого STEP-021 независимый review выявил, что `loadIndex()` и
watcher уже используют `manifest.protocol.taskDirectory`, но declarative
`filenamePatterns` статичен и покрывает только default layout. Поэтому STEP в
custom layout открывается как Markdown и не активирует editor providers.
Декларативное ограничение не запрещает runtime assignment через
`vscode.languages.setTextDocumentLanguage`; оно должно оставаться строго
привязанным к manifest-resolved canonical directory.

## Scope

- При activation и открытии Markdown-документа проверять принадлежность
  canonical `manifest.protocol.taskDirectory` и имя `STEP-*.md` по
  нормализованной path/relative-path семантике.
- Idempotent-но назначать `harness-step` через публичный VS Code API, локально
  обрабатывая ошибку и lifecycle смены языка.
- Добавить unit и Extension Host regression для custom layout, включая
  observable provider behavior после runtime language assignment.
- Исправить documentation, добавленную реализацией STEP-021, отделив static
  declarative association от runtime association для manifest-resolved layout,
  без изменения STEP-021 и immutable review reports.

## Mutation policy

### Allowed

- `src/editor/**`, `tests/unit/editor/**`, `tests/integration/**`,
  `package.json` только при необходимости test wiring.
- Документация Smart STEP Editor и status projections.
- `planning/tasks/STEP-022.md`, `planning/PLAN.md`, `planning/STATUS.md`,
  `docs/requirements/STATUS.md`.

### Conditional

- Изменение `docs/requirements/SPEC.md` только если требуется уточнить уже
  существующий REQ-003 без расширения product contract.

### Forbidden

- Изменение Harness command protocol, manifest schema, canonical STEP/REQ/ADR
  format, `planning/tasks/TEMPLATE.md`, resolver contract, STEP-021 и его
  immutable review reports.
- Fallback scanning, второй список task directories, hardcoded
  `planning/tasks` в runtime logic и unrelated refactoring.

## Out of scope

- Новая продуктовая функциональность Smart STEP Editor.
- Изменение static `filenamePatterns`: contribution остаётся fast/default
  association для обычного layout.
- Изменение PR title/body, создание PR, commit или push.

## Acceptance criteria

- STEP `custom/steps/STEP-101.md` при `protocol.taskDirectory: custom/steps`
  получает `harness-step` после activation/open и активирует хотя бы один
  observable provider.
- STEP вне canonical directory, `tasks-old` sibling и non-STEP Markdown внутри
  directory не получают runtime language assignment.
- Уже назначенный `harness-step` не вызывает повторный assignment; lifecycle и
  dispose не создают duplicate actions, providers или stale diagnostics.
- Default layout продолжает использовать static association без лишнего runtime
  вызова.
- Документация корректно различает static `package.json` contribution и
  runtime association через публичный VS Code API.

## Verification

- Focused unit и Extension Host regressions custom layout и lifecycle.
- `npm run compile`
- `npm run lint`
- `npm test -- --runInBand`
- `npm run build`
- `XDG_RUNTIME_DIR=/tmp npm run test:integration`
- `python3 tools/harness/validate.py --mode commit`
- `git diff --check`

## Deliverables

- Manifest-driven runtime language association, focused regressions и точная
  documentation note.

## Implementation plan

**Plan status:** Ready
**Plan revision:** 1
**Planned at:** 2026-09-20T08:49:52+00:00
**Plan basis:** sha256:7a27a8dc8fe288f83c808c9ea0b3b480ec430e278c871fdf47857073b091a244

### Предпосылки и границы

- `STEP-007` и `STEP-021` завершены, а `manifest.protocol.taskDirectory`
  уже является единственным источником directory для index и watcher. Новый
  код не меняет resolver и не получает topology из `package.json`.
- `package.json` сохраняет статический default pattern. Runtime assignment
  выполняется только после успешного чтения manifest в
  `registerStepEditor`, публичным `vscode.languages.setTextDocumentLanguage`.
- Смена language может вызвать новый open lifecycle. Idempotency строится на
  проверке `document.languageId`, поэтому повторное событие не регистрирует
  providers или listeners и не создаёт loop. Rejection поглощается в локальном
  `catch`; diagnostics остаются управляемыми существующим scheduler.

### Порядок реализации

1. В `src/editor/activation.ts` выделить чистую экспортируемую проверку
   canonical STEP document: нормализовать workspace-relative `taskDirectory`,
   вычислить `path.relative(taskDirectoryPath, document.fsPath)` и принять
   только non-empty/no-`..` descendant с basename, соответствующим
   `^STEP-.*\\.md$`. Это исключает sibling `tasks-old`, произвольные workspace
   файлы и Markdown вне directory без string-prefix logic.
2. Добавить малый lifecycle controller/функцию assignment, принимающую
   `TextDocument`, workspace root и manifest. Она возвращает без действия для
   non-Markdown/несовпадающих documents и уже `harness-step`; для canonical
   STEP вызывает `setTextDocumentLanguage` с локальным handling rejection.
   Использовать один disposable registration path для `workspace.textDocuments`
   при activation и `onDidOpenTextDocument`; не затрагивать регистрацию
   language-only providers.
3. Связать assignment до initial validation и с refresh manifest так, чтобы
   open documents получают язык и после manifest reload. Existing validation
   remains language-gated; повторное onDidOpen после смены языка лишь
   валидирует документ и не назначает язык снова.
4. В `tests/unit/editor/activation.test.ts` проверить path matching: custom
   child match, outside/no match, `tasks-old` boundary, non-STEP Markdown,
   already-assigned idempotency и dispose/lifecycle absence of duplicate calls.
   Расширить VS Code mock только необходимыми APIs.
5. В `tests/integration/editor.test.js` изменить fixture manifest временно на
   `custom/steps`, создать `custom/steps/STEP-101.md`, открыть его после
   activation и доказать `languageId === 'harness-step'` плюс diagnostics либо
   CodeLens. Teardown восстанавливает manifest и удаляет только временные
   custom artifacts; добавить negative path outside canonical directory, если
   это устойчиво в Extension Host.
6. Обновить точную note в `docs/architecture.md`: declarative contribution
   статичен, но runtime path manifest-driven через public API. Оставить
   `filenamePatterns` как default optimization и не изменять STEP-021/reports.
   После focused tests выполнить полный required gate и записать literal
   command/exit/observed evidence; затем передать diff независимому review.

### Затрагиваемые области и совместимость

- Меняются activation seam, editor unit/integration tests, test fixture
  lifecycle, `docs/architecture.md` и STEP/status projections.
- Существующие provider selectors остаются `{ language: 'harness-step'}` и
  default `planning/tasks` association не изменяется. Ни parser contracts, ни
  manifest schema, ни grammar/configuration не меняются.

### Стратегия тестирования и verification

1. Unit доказывают containment через `path.relative`, filename contract,
   idempotency, error handling и disposal без реального VS Code Host.
2. Extension Host regression доказывает весь путь custom manifest → open
   canonical STEP → `harness-step` → diagnostic/CodeLens; cleanup восстанавливает
   shared fixture после каждого test.
3. Последовательно выполнить `npm run compile`, `npm run lint`,
   `npm test -- --runInBand`, `npm run build`,
   `XDG_RUNTIME_DIR=/tmp npm run test:integration`,
   `python3 tools/harness/validate.py --mode commit`, `git diff --check`.

### Риски и rollback

- `setTextDocumentLanguage` может инициировать повторный open event. Guard по
  current `languageId`, single event listener и unit lifecycle test являются
  gate против loop/duplicate work.
- Ошибка assignment не должна отбрасывать index/watchers или existing default
  support: promise rejection обрабатывается локально. Rollback удаляет только
  runtime assigner; static association продолжает обслуживать default layout.
- Path containment ошибочно расширит editor scope; table-driven unit boundary
  cases и Extension Host negative scenario не допускают fallback scanning.

## Evidence

- `STEP FIX STEP-022` исправил F-001/F-002 из
  `planning/reviews/STEP-022/REVIEW-2026-09-20T0858Z.md`: runtime association
  запускает Promise-цепочку до вызова VS Code API, поэтому synchronous throw
  локально поглощается и очищает pending; явный non-Markdown language mode
  больше не заменяется на `harness-step`.
- `npm test -- --runInBand tests/unit/editor/activation.test.ts` — exit 0:
  17 tests passed. Добавлены regressions на synchronous throw без выхода из
  controller с последующей повторной попыткой и на `plaintext` no-op; сохранены
  containment custom directory, sibling boundary, filename contract,
  idempotency pending lifecycle и dispose.
- `npm run compile` — exit 0.
- `npm run lint` — exit 0.
- `npm test -- --runInBand` — exit 0: 25 suites, 322 tests passed.
- `npm run build` — exit 0: esbuild build complete.
- `XDG_RUNTIME_DIR=/tmp npm run test:integration` — exit 0: 28 Extension
  Host tests passed. Regression временно меняет `protocol.taskDirectory` на
  `custom/steps`, открывает `STEP-101.md`, подтверждает `harness-step` и
  diagnostics для `REQ-999`, затем восстанавливает fixture manifest.
- `python3 tools/harness/validate.py --mode commit` — exit 0: `HARNESS
  VALIDATION: PASS` (385 tracked files checked; warning только об отсутствии
  staged files).
- `git diff --check` — exit 0.
- `STEP FIX STEP-022` исправил F-003 из
  `planning/reviews/STEP-022/REVIEW-2026-09-20T0908Z.md`: Extension Host
  regression до `ext.activate()` временно задаёт `custom/steps`, открывает
  `STEP-101.md` как Markdown, затем подтверждает initial sweep в
  `workspace.textDocuments`, `harness-step` и diagnostics для `REQ-999`.
  Teardown восстанавливает manifest и удаляет только созданные test artifacts.
- `XDG_RUNTIME_DIR=/tmp npm run test:integration -- --grep 'открытый до activation'`
  — exit 0: 1 Extension Host test passed.
- `npm run compile` — exit 0.
- `npm run lint` — exit 0.
- `npm test -- --runInBand` — exit 0: 25 suites, 322 tests passed.
- `npm run build` — exit 0: esbuild build complete.
- `XDG_RUNTIME_DIR=/tmp npm run test:integration` — exit 0: 28 Extension
  Host tests passed.
- `python3 tools/harness/validate.py --mode commit` — exit 0: `HARNESS
  VALIDATION: PASS` (385 tracked files checked; warning только об отсутствии
  staged files).
- `git diff --check` — exit 0.

- Финальный независимый `STEP REVIEW STEP-022` — PASS:
  `planning/reviews/STEP-022/REVIEW-2026-09-20T0917Z.md`. Review повторно
  подтвердил F-001/F-002/F-003, focused pre-activation Extension Host path,
  полный gate и восстановление fixture.

## Review status

**Latest verdict:** PASS
**Latest report:** `planning/reviews/STEP-022/REVIEW-2026-09-20T0917Z.md`

## Blocker / Failure reason

—
