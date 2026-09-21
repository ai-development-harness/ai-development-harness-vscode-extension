# STEP-008 — Status Bar

**Статус:** Выполнено
**Type:** IMPLEMENTATION
**Приоритет:** Средний
**Фаза:** MVP — UI
**Depends on:** STEP-003, STEP-005

## Requirements

- REQ-004

## ADR

- не требуется

## Risk flags

- none

## Goal

Реализовать элементы status bar с батчингом обновлений.

## Context

REQ-004. «Next command» переиспользует логику `NEXT STEP` из STEP-005, счётчик warnings — существующую diagnostic-логику STEP-007. В MVP click warnings открывает VS Code Problems panel; полноценный Health Dashboard — REQ-008, вне MVP.

## Scope

- `statusBar.ts` — left/right items (статус инициализации, completion bar, next command, счётчик health-warnings).
- Батчинг обновлений (debounce, не чаще раза в секунду).
- Click-обработчики на каждый item.

## Mutation policy

### Allowed

- `src/ui/statusBar.ts`, подключение в `src/extension.ts`, локализация и focused
  unit/integration tests.

### Conditional

- Выбор источника «next command» — переиспользовать логику `NEXT STEP` из STEP-005, не дублировать.

### Forbidden

- Собственная логика health-report вычислений сверх простого счётчика существующих diagnostics.

## Out of scope

- Полноценный health report webview (REQ-008).

## Acceptance criteria

- Элементы видны и обновляются при изменении файлов проекта.
- Обновление не чаще раза в секунду и не блокирует редактор.
- Клик по каждому элементу выполняет заявленное действие.

## Verification

- Unit-тест debounce-логики.
- Ручная проверка в Extension Development Host (изменение файла → задержка → обновление status bar).

## Deliverables

- `src/ui/statusBar.ts` + тесты.

## Implementation plan

**Plan status:** Ready
**Plan revision:** 2
**Planned at:** 2026-09-21T08:28:43+00:00
**Plan basis:** sha256:758e9b9128420e007e5a0c2ad5216770646cee283a79a394d24ef73295d79af3

### Предпосылки и границы

- `src/commands/projectStatus.ts` уже владеет агрегацией roadmap, а
  `src/commands/nextStep.ts` — выбором и запуском рекомендованной команды;
  Status Bar переиспользует эти чистые функции и не создаёт второй selector.
- `vscode.languages.getDiagnostics()` является существующим источником
  diagnostics; warnings item считает только Error/Warning внутри
  manifest-resolved task directory и открывает Problems panel. Полный health
  report и отдельный webview остаются вне scope REQ-008.
- Изменение требует регистрации disposable в `activate()`, локализованных
  подписей и тестового seam, поэтому первоначальный single-file Allowed scope
  расширен только минимальными supporting files.

### Порядок реализации

1. Сохранить controller из четырёх `StatusBarItem`: manifest initialization,
   roadmap completion, next command и warnings. Зафиксировать exact actions:
   `vscode.open` для manifest и manifest-resolved STATUS.md, рекомендованный
   `harness.plan`/`harness.fix`/`harness.implement` для next и
   `workbench.action.problems.focus` для warnings.
2. Вынести debounce controller с интервалом 1000 ms. Он coalesces filesystem,
   diagnostic и language events, не выполняет параллельные refresh и после
   dispose не публикует устаревшее состояние.
3. Получать manifest и STEP только через существующие Parser/stepPicker APIs;
   completion вычислять из `Выполнено` относительно общего числа STEP. Считать
   warnings из existing diagnostics, без нового health computation.
4. Сохранять subscriptions artifact watchers, пока manifest-resolved
   `taskDirectory` и `sources.status` не изменились; при смене manifest
   пересобрать их без окна потери external event. На смену языка обновлять
   labels, а все disposables добавить в extension context.
5. Добавить focused unit tests scheduler (burst, in-flight event, dispose) и
   Extension Host regressions с bounded polling: exact text/action/URI всех
   items; create/delete STEP; Error/Warning внутри task directory; исключение
   Info/Hint и diagnostics вне него; custom `taskDirectory`/`sources.status` и
   их смена через manifest. Каждый fixture обязан восстановить файл и дождаться
   обратного refresh.

### Совместимость, verification и rollback

- Product API, manifest schema и command semantics не меняются. Отсутствующий
  workspace/manifest приводит к локальному inert state без fallback path
  guessing.
- Выполнить focused status-bar tests, `npm run compile`, `npm run lint`,
  `npm test`, `npm run build`, не менее двух последовательных
  `npm run test:integration`, Harness validation и `git diff --check`.
- Rollback удаляет только registration/status-bar controller и новые
  localization/test files; Parser, command и diagnostic layers остаются
  нетронутыми.

## Evidence

- `npm run compile` — exit 0.
- `npx jest tests/unit/ui/statusBar.test.ts --runInBand` — exit 0, 2 tests.
- `npm run lint` — exit 0.
- `npm test -- --runInBand` — exit 0, 27 suites, 334 tests passed.
- `npm run build` — exit 0.
- `XDG_RUNTIME_DIR=/tmp npm run test:integration` — exit 0, 27 Extension Host tests passed.
- `python3 .harness/tools/validate.py --mode commit` — exit 0, PASS.
- `git diff --check` — exit 0.
- `STEP FIX STEP-008`: `npm run compile`, `npm run lint`, `npm test -- --runInBand`
  (334 tests), `npm run build`, `XDG_RUNTIME_DIR=/tmp npm run test:integration`
  (27 tests), Harness validation и `git diff --check` — exit 0.
- Повторный `STEP FIX STEP-008`: focused Status Bar suite — 5 tests; полный
  `npm test` — 337 tests; compile, lint, build, integration, Harness validation
  и `git diff --check` — exit 0.
- `STEP FIX STEP-008` по F-004: `npm run build`, `XDG_RUNTIME_DIR=/tmp npm run
  test:integration` — 28 tests passed; `npm test` — 337 tests passed; lint,
  Harness validation и `git diff --check` — exit 0.
- `STEP FIX STEP-008` по F-001 review `0714Z`: `npm run compile`, `npm run
  build`, `XDG_RUNTIME_DIR=/tmp npm run test:integration` — exit 0, 28
  Extension Host tests passed; `npm test -- --runInBand` — exit 0, 27 suites
  and 337 tests passed; `npm run lint`, Harness validation и `git diff --check`
  — exit 0. Новый Extension Host regression подтверждает refresh после внешней
  правки и command ID/argument рекомендуемого STEP.
- `STEP FIX STEP-008` по review `0737Z`: устранено окно пересоздания artifact
  watcher во время refresh; integration-test заменил fixed delay на bounded
  polling и проверяет exact URI/actions. `npm run compile`, `npm run build`,
  три последовательных запуска `XDG_RUNTIME_DIR=/tmp npm run test:integration`
  — exit 0, по 28 Extension Host tests; focused Status Bar suite — 6 tests;
  полный `npm test -- --runInBand` — exit 0, 27 suites and 338 tests; lint,
  Harness validation и `git diff --check` — exit 0.
- `STEP PLAN STEP-008` revision 2 уточнил MVP-контракт warnings и acceptance
  matrix. `STEP FIX STEP-008` по review `0816Z`: `npm run compile`, `npm run
  build`, два последовательных `XDG_RUNTIME_DIR=/tmp npm run test:integration`
  — exit 0, по 29 Extension Host tests; полный `npm test -- --runInBand` —
  exit 0, 27 suites and 338 tests; lint, Harness validation и `git diff --check`
  — exit 0. Новый regression доказывает filtering diagnostics и custom
  manifest-resolved task/status paths с cleanup.

## Review status

**Latest verdict:** PASS
**Latest report:** `planning/reviews/STEP-008/REVIEW-2026-09-21T0839Z.md`

## Blocker / Failure reason

—
