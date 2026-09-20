# STEP-023 — Стабилизировать pre-activation regression Smart STEP Editor в CI

**Статус:** Выполнено
**Type:** BUGFIX
**Приоритет:** Высокий
**Фаза:** MVP — UI
**Depends on:** STEP-007, STEP-022

## Requirements

- REQ-003

## ADR

- ADR-002
- ADR-005

## Risk flags

- concurrency

## Goal

Сделать доказательство pre-activation пути Smart STEP Editor детерминированным:
custom STEP должен быть открыт до первой activation в отдельном Extension Host,
а CI не должен зависеть от порядка остальных integration-тестов.

## Context

CI для `293fb61` выявил, что regression STEP-022 открывает документ после
того, как другие integration-тесты уже активировали extension. Повторный
`ext.activate()` не запускает initial `workspace.textDocuments` sweep, поэтому
test может ложно падать с `markdown` вместо `harness-step`. Отдельный run того
же commit прошёл, что подтверждает order-dependent test setup, а не evidence
pre-activation lifecycle.

## Scope

- Выделить pre-activation scenario в отдельный Extension Host run с custom
  manifest, документом, открытым до первой activation, и observable diagnostics
  или CodeLens assertion.
- Подключить isolated run к локальному npm workflow и CI без дублирования
  production logic.
- Надёжно восстановить fixture manifest и temporary files при успехе/ошибке.

## Mutation policy

### Allowed

- `tests/integration/**`, отдельная VS Code test configuration, `package.json`
  и `.github/workflows/ci.yml` только для isolated test wiring.
- `planning/tasks/STEP-023.md`, `planning/PLAN.md`, `planning/STATUS.md`,
  `docs/requirements/STATUS.md`.

### Conditional

- `.gitignore` только при появлении runtime-generated fixture artifact.

### Forbidden

- Изменение production `src/**`, manifest schema, resolver, protocol, template,
  STEP-022 и его immutable reports.
- Ослабление/удаление pre-activation acceptance или order-dependent retry.

## Out of scope

- Новая функциональность Smart STEP Editor или изменение language association.
- Изменение PR title/body, commit или push.

## Acceptance criteria

- Isolated Extension Host run открывает `custom/steps/STEP-101.md` до первой
  activation и доказывает `harness-step` плюс observable provider behavior.
- Main integration suite не содержит order-dependent pre-activation assertion.
- Local and GitHub CI запускают isolated regression; fixture восстанавливается
  после каждого исхода.
- Полный required project gate проходит детерминированно.

## Verification

- Focused isolated Extension Host command и обычный integration suite.
- `npm run compile`
- `npm run lint`
- `npm test -- --runInBand`
- `npm run build`
- `XDG_RUNTIME_DIR=/tmp npm run test:integration`
- `python3 tools/harness/validate.py --mode commit`
- `git diff --check`

## Deliverables

- Isolated pre-activation Extension Host regression, CI wiring и evidence.

## Implementation plan

**Plan status:** Ready
**Plan revision:** 1
**Planned at:** 2026-09-20T09:46:40+00:00
**Plan basis:** sha256:41116e0cf3ff72d1827d861afd0d0aed374b12ed2a76327b6191892229e8f6e0

### Предпосылки и границы

- Failure GitHub CI run `35502772161` воспроизводил assertion `markdown` vs
  `harness-step`: главный `tests/integration/**/*.test.js` host уже активировал
  extension в других files, поэтому `ext.activate()` больше не выполняет
  initial document sweep. Это test-isolation defect, не production regression.
- Новый scenario обязан запускаться в отдельном process/Extension Host. Порядок
  Mocha files, retry или искусственная deactivation не доказывают требуемую
  pre-first-activation семантику.

### Порядок реализации

1. Перенести единственный pre-activation test из
   `tests/integration/editor.test.js` в отдельный focused file вне glob
   основной integration suite. Сохранить setup: изменить fixture manifest на
   `custom/steps`, открыть `STEP-101.md` как Markdown, лишь затем получить и
   активировать extension; assert language и diagnostics.
2. Создать отдельную `.vscode-test` configuration с тем же workspace fixture,
   Snap sanitization и glob только focused file. Добавить npm script,
   вызывающий `vscode-test --config <isolated config>`, чтобы локальный запуск
   поднимал свежий Extension Host без состояния основной suite.
3. Добавить отдельный CI step с `xvfb-run -a` для этого script. Основная
   integration command остаётся независимой и больше не включает impossible
   pre-activation case; CI failure точно указывает isolated lifecycle gate.
4. Проверить `finally`: manifest возвращён, target и пустые directories удалены
   при success/failure; unit/production code не меняются. Выполнить focused,
   main и полный project gates; зафиксировать exact results в Evidence.

### Затрагиваемые области и совместимость

- Изменяются только test files/configuration, npm script, CI step и status
  projections. Runtime `registerStepEditor`, manifest schema, provider selector
  и static language contribution остаются неизменны.
- New CI command скачивает/использует тот же VS Code version and workspace as
  existing integration suite but runs serially as its own host.

### Стратегия тестирования и verification

1. `XDG_RUNTIME_DIR=/tmp npm run test:integration:pre-activation` доказывает
   fresh-host path: custom manifest → open Markdown → first activation →
   `harness-step` → diagnostics.
2. `XDG_RUNTIME_DIR=/tmp npm run test:integration` доказывает, что main suite
   remains green without order dependency.
3. Последовательно выполнить compile, lint, full Jest, build, обе integration
   commands, Harness validation и `git diff --check`.

### Риски и rollback

- Duplicating setup across hosts may leave fixture artifacts; `finally` removes
  only the created target/directories and restores exact manifest content.
- A separate CI step adds VS Code startup time but removes false red status;
  rollback removes only isolated test/config/script/CI step while preserving
  production implementation.

## Evidence

- `XDG_RUNTIME_DIR=/tmp npm run test:integration:pre-activation` — exit code 0;
  отдельный Extension Host выполнил 1 test: custom manifest, открытый до первой
  activation `STEP-101.md`, получил `harness-step` и diagnostics для `REQ-999`.
- `XDG_RUNTIME_DIR=/tmp npm run test:integration` — exit code 0; 27 passing,
  основной test glob не включает pre-activation scenario.
- `npm run compile` — exit code 0.
- `npm run lint` — exit code 0.
- `npm test -- --runInBand` — exit code 0; 25 suites, 322 tests passed.
- `npm run build` — exit code 0; esbuild build complete.
- `python3 tools/harness/validate.py --mode commit` — exit code 0; Harness
  validation PASS (389 tracked files), warning только об отсутствии staged files.
- `git diff --check` — exit code 0.
- После focused run fixture проверен: `custom/` отсутствует, manifest восстановил
  `protocol.taskDirectory: planning/tasks`.

## Review status

**Latest verdict:** PASS
**Latest report:** `planning/reviews/STEP-023/REVIEW-2026-09-20T0958Z.md`

## Blocker / Failure reason

—
