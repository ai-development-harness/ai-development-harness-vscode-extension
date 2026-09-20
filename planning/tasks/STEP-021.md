# STEP-021 — Корректировка Smart STEP Editor по findings review STEP-007

**Статус:** Выполнено
**Type:** BUGFIX
**Приоритет:** Высокий
**Фаза:** MVP — UI
**Depends on:** STEP-007, STEP-016

## Requirements

- REQ-003

## ADR

- ADR-002
- ADR-005

## Risk flags

- concurrency

## Goal

Довести Smart STEP Editor из STEP-007 до production-состояния, устранив
подтверждённые findings независимого review без расширения продуктового
контракта REQ-003.

## Context

Текущая реализация анализирует текст открытого STEP, но для графа зависимостей
использует сохранённую запись этого же STEP из общего `StepEditorIndex`; поэтому
цикл в несохранённом документе не виден до записи на диск. Кроме того, editor
validation запускает полную проверку на каждое изменение, Markdown comments
сконфигурированы как незакрываемый line comment, runtime selector повторяет
статический layout contribution, а grammar не наследует обычную Markdown
tokenization. ADR-005 сохраняет manifest-first topology и запрещает consumer
path guessing; ограничение статических VS Code language contributions должно
быть явно отделено от runtime поведения.

## Scope

- При validation подменять только запись текущего STEP in-memory документом в
  локальной проекции index, не мутируя общий index и не меняя остальные STEP.
- Добавить отменяемый debounce validation с latest-only публикацией diagnostics.
- Исправить Markdown block comment contribution и проверить `harness-step`.
- Убрать из runtime provider selector лишнюю зависимость от static layout, если
  это безопасно; оставить в `package.json` только неизбежное ограничение VS Code
  и задокументировать его.
- Расширить TextMate grammar стандартной Markdown grammar через поддерживаемый
  механизм composition без копирования grammar в репозиторий.
- Добавить focused unit/regression coverage для каждого finding.

## Mutation policy

### Allowed

- `src/editor/**`, `syntaxes/harness-step.tmLanguage.json`,
  `language-configuration.json`, `package.json`.
- Тесты editor и относящаяся к ограничению платформы документация.
- `planning/tasks/STEP-021.md`, `planning/PLAN.md`, `planning/STATUS.md`,
  `docs/requirements/STATUS.md`, immutable review reports STEP-021.

### Conditional

- Изменение `docs/requirements/SPEC.md` допускается только при необходимости
  точно зафиксировать уже существующее platform compatibility constraint, без
  нового product contract.

### Forbidden

- Изменение Harness command protocol, canonical STEP/REQ/ADR format,
  `planning/tasks/TEMPLATE.md`, `.project/manifest.yaml` или filesystem probing.
- Новая продуктовая функциональность REQ-003 и refactoring вне editor scope.

## Out of scope

- Dynamic language association по `.project/manifest.yaml` в `package.json`,
  если VS Code contribution API её не поддерживает.
- Изменение layout Harness, второго topology source или fallback-гадания путей.
- Изменение quick actions, navigation, autocomplete, watcher refresh либо
  latest-only CodeLens refresh, кроме необходимого regression preservation.

## Acceptance criteria

- Несохранённый текущий STEP с dependency cycle получает `dependencyCycle`
  diagnostic немедленно; сохранённый index и другие STEP не мутируются.
- Validation не запускает полную проверку на каждый keystroke, публикует только
  результат последнего текста и не публикует pending work после dispose.
- VS Code Markdown comment action создаёт парный `<!-- ... -->` block comment.
- Runtime providers следуют manifest-resolved `taskDirectory` настолько, насколько
  допускает VS Code API; remaining static language-association constraint
  документирован без filesystem guessing и без нарушения ADR-005.
- `harness-step` сохраняет fenced code, links, emphasis, inline code, lists и
  прочие обычные Markdown capabilities через grammar composition.
- Existing quick actions, navigation, autocomplete, watcher refresh и latest-only
  CodeLens refresh не регрессируют.

## Verification

- Focused regressions: unsaved dependency cycle, validation debounce/latest-only,
  comment configuration, Markdown grammar composition и manifest-resolved editor
  behavior.
- `npm run compile`
- `npm run lint`
- `npm test -- --runInBand`
- `npm run build`
- `XDG_RUNTIME_DIR=/tmp npm run test:integration`
- `python3 tools/harness/validate.py --mode commit`
- `git diff --check`

## Deliverables

- Исправленный editor validation/activation path, language configuration и
  compositional TextMate grammar.
- Focused regression tests, platform compatibility documentation и evidence.

## Implementation plan

**Plan status:** Ready
**Plan revision:** 1
**Planned at:** 2026-09-20T07:34:04+00:00
**Plan basis:** sha256:bf266a62c16e982f2495907ae7ba7c79367598be80a728ac546e911b51cb5fc4

### Предпосылки и границы

- `STEP-007` и `STEP-016` завершены; `parseStepFile`, `StepEditorIndex` и
  `resolveHarnessArtifactPath` являются существующими owning boundaries.
  Исправление не создаёт новый resolver, filesystem scan или mutation protocol.
- VS Code language contribution в `package.json` — статический declarative
  manifest: `filenamePatterns` не может читать workspace `.project/manifest.yaml`.
  Поэтому dynamic association нельзя корректно реализовать на этом уровне.
  Runtime providers могут и должны избегать повторного static path selector,
  опираясь на `languageId`; index, watcher и reading task files уже получают
  `taskDirectory` только от manifest.
- TextMate grammar может включать зарегистрированный scope стандартного
  Markdown (`text.html.markdown`), не копируя grammar. Harness-specific rules
  должны иметь приоритет перед base grammar, а остальной текст остаётся Markdown.
- Diagnostics остаются advisory и in-process: debounce отменяет только pending
  timer, а generation guard предотвращает publication устаревшего результата.

### Порядок реализации

1. В `validation.ts` после успешного parse создать локальную проекцию
   `index.steps`, в которой `data.id` указывает на in-memory `content` и
   актуальный status текущего документа. Передать только эту проекцию в cycle
   traversal; shared index и остальные entries не мутировать. Добавить test
   «saved A без dependency, saved B → A, unsaved A → B» с diagnostic до save.
2. Выделить небольшой disposable `ValidationController` рядом с существующим
   `CodeLensRefreshController`: `schedule(document)` перезапускает короткий
   timer, увеличивает generation и вызывает validation лишь для последнего
   snapshot. Перед `diagnostics.set` проверить generation/dispose и snapshot
   актуального документа; `dispose` очищает timer и делает late callback inert.
   Подключить controller к open/change/close, сохранив немедленную initial
   validation при registration и current CodeLens refresh flow.
3. Исправить `language-configuration.json` на `blockComment` с `<!--` и `-->`.
   Добавить deterministic manifest/config test, который утверждает отсутствие
   `lineComment` и точную block pair для `harness-step` contribution.
4. Сузить editor runtime `DocumentSelector` до language-only, не повторяя
   `planning/tasks` в TypeScript. Сохранить единственный вынужденный static
   `filenamePatterns` contribution, обеспечить, что `loadIndex`/watcher
   используют `manifest.protocol.taskDirectory`, и добавить regression на
   custom manifest task directory в runtime index/selector seam. Зафиксировать
   static contribution как VS Code compatibility constraint в architecture
   documentation, не меняя ADR-005 и не вводя dynamic fallback.
5. В grammar добавить base include `text.html.markdown` и сохранить custom
   Harness rules поверх него. Написать structural regression, которая
   проверяет scope include, custom rule precedence и отсутствие локальной копии
   Markdown grammar; дополнить Extension Host coverage на fenced code, link,
   emphasis, inline code и list scopes через tokenization API, если доступна
   стабильная test seam.
6. Запустить focused tests, затем весь обязательный gate. Обновить Evidence,
   requirement/status projections и архитектурную compatibility note только по
   фактическим результатам; после IMPLEMENT передать diff независимому REVIEW.

### Затрагиваемые области и совместимость

- Изменяются `src/editor/validation.ts`, `src/editor/activation.ts`,
  `language-configuration.json`, `syntaxes/harness-step.tmLanguage.json`,
  `package.json`, editor unit/integration tests и подтверждённая platform-note
  в `docs/architecture.md`.
- Не меняются Parser public contracts, manifest schema, canonical artifact
  format, command protocol, TEMPLATE и task layout.
- Существующая static association продолжит работать для default layout.
  После relocation `taskDirectory` index/watcher будут manifest-driven, но
  автоматическое присвоение `harness-step` новому glob остаётся платформенно
  статическим до отдельного совместимого VS Code/manifest решения.

### Стратегия тестирования и verification

1. Unit: unsaved cycle подменяет только current STEP; shared index остаётся
   равным исходному; external dependencies продолжают читаться из index.
2. Unit с fake timers: debounce coalesces keystrokes, latest-only callback
   публикуется один раз, previous pending/late result не публикуется, dispose
   отменяет pending work.
3. Manifest/config/grammar regressions: exact block comment pair, no static
   runtime selector, custom manifest `taskDirectory` в index path и base
   `text.html.markdown` include без vendored grammar.
4. Integration: existing editor providers, autocomplete/navigation, watcher
   refresh и CodeLens latest-only regressions остаются зелёными; добавить
   focused assertion для Markdown tokenization, если API стабильно доступно в
   Extension Development Host.
5. Последовательно выполнить `npm run compile`, `npm run lint`,
   `npm test -- --runInBand`, `npm run build`,
   `XDG_RUNTIME_DIR=/tmp npm run test:integration`,
   `python3 tools/harness/validate.py --mode commit`, `git diff --check`.

### Риски и rollback

- Ошибка debounce может скрыть diagnostics или опубликовать stale result;
  generation/snapshot guard и fake-timer tests являются rollback gate. При
  откате удаляется только controller wiring, index остаётся unchanged.
- Grammar include зависит от registered standard Markdown scope; integration
  check подтверждает фактическую VS Code tokenization. При platform failure
  нельзя копировать Markdown grammar: зафиксировать blocker и оставить
  existing contribution до отдельного решения.
- Static language association нельзя выдавать за manifest-driven capability.
  Runtime changes не должны расширять filesystem scope и при откате сводятся к
  восстановлению language-only selector без изменений artifact paths.

## Evidence

- Command: `npm run compile`; Exit code: 0; Observed: TypeScript compilation
  completed without errors.
- Command: `npm run lint`; Exit code: 0; Observed: ESLint passed for `src`.
- Command: `npm test -- --runInBand`; Exit code: 0; Observed: 25 Jest suites /
  316 tests passed. `ts-jest` emitted existing TS151002 configuration warnings
  without affecting the successful result.
- Command: `npm run build`; Exit code: 0; Observed: esbuild build completed.
- Command: `XDG_RUNTIME_DIR=/tmp npm run test:integration`; Exit code: 0;
  Observed: 27 Extension Development Host tests passed, including existing
  editor providers, navigation, autocomplete, watcher refresh and CodeLens
  refresh paths. Gtk/DBus/NSS environment messages did not affect exit code.
- Command: `python3 tools/harness/validate.py --mode commit`; Exit code: 0;
  Observed: Harness validation passed for 382 tracked files.
- Command: `git diff --check`; Exit code: 0; Observed: no whitespace errors.
- Focused regressions in `tests/unit/editor/validation.test.ts` and
  `tests/unit/editor/activation.test.ts`: unsaved cycle leaves shared index
  unchanged; debounce is latest-only/disposable; `blockComment`, Markdown
  composition and manifest-resolved runtime index are asserted deterministically.
- FIX after `REVIEW-2026-09-20T0746Z.md`: `registerValidationListeners` now
  has deterministic event-to-`DiagnosticCollection.set` coverage for latest
  text, independent documents and close cancellation; manifest-derived watcher
  patterns are covered for custom `taskDirectory`. Repeat commands `npm run
  compile`, `npm run lint`, `npm test -- --runInBand` (25 suites / 317 tests),
  `npm run build`, `XDG_RUNTIME_DIR=/tmp npm run test:integration` (27 tests),
  `python3 tools/harness/validate.py --mode commit` and `git diff --check`
  completed with exit code 0.
- Public VS Code 1.138 typings expose no TextMate grammar registry or token
  scopes for an already registered language. The grammar composition remains
  structurally asserted and loaded by Extension Development Host; no internal
  API, test dependency or copied Markdown grammar was introduced.

## Review status

**Latest verdict:** PASS
**Latest report:** `planning/reviews/STEP-021/REVIEW-2026-09-20T0755Z.md`

## Blocker / Failure reason

—
