# STEP-024 — Адаптировать Navigator к control-plane `.harness`

**Статус:** Запланировано
**Type:** BUGFIX
**Приоритет:** Критический
**Фаза:** MVP stabilization
**Depends on:** STEP-003, STEP-005, STEP-006, STEP-007, STEP-009

## Requirements

- REQ-001, REQ-002, REQ-003, REQ-005, REQ-006

## ADR

- ADR-003, ADR-005

## Risk flags

- architecture

## Goal

Восстановить совместимость extension с control-plane `.harness/**` Harness v0.5.3, не создавая fallback к удалённому `.project/**` layout.

## Context

`HARNESS UPDATE APPLY` перенёс control plane из `.project/**` в `.harness/**`. Фактический код и fixtures extension продолжают читать `.project/manifest.yaml`, а `src/api/commandPolicy.ts` импортирует удалённый `.project/command-transitions.json`; `npm run compile` завершается TS2307. Это нарушает bootstrap Parser, Command Palette, Explorer, Editor, manual handoff и локализацию для обновлённого Harness-проекта.

## Scope

- Перенести bootstrap manifest/CTS/settings paths и test fixtures на `.harness/**` согласно текущему manifest и control-plane.
- Адаптировать canonical command labels и Command Palette contract к текущему CTS, где это требуется для MVP surface.
- Обновить manifest-driven Parser, Explorer, Editor, command and i18n consumers без consumer-level path guessing.
- Добавить focused regression tests для compilation, activation и custom layout на `.harness/**`.
- Синхронизировать current-state documentation и traceability после доказанной реализации.

## Mutation policy

### Allowed

- `src/**`, `tests/**`, `package.json`, `package.nls*.json`, documentation и planning projections, относящиеся к control-plane compatibility.

### Conditional

- Новый ADR только если изучение покажет изменение устойчивого решения ADR-003 или ADR-005, а не адаптацию к upstream layout.

### Forbidden

- Fallback, probing или dual-layout поддержка `.project/**`.
- Изменение Harness-owned `.harness/**`, кроме project-owned runtime evidence.
- Реализация будущих команд вне MVP или automatic agent execution.

## Out of scope

- Status Bar (`STEP-008`), полная локализация (`STEP-010`) и coverage release work (`STEP-011`).
- Изменение upstream Harness protocol или его update graph.
- Миграция пользовательских внешних проектов вне поддерживаемого current Harness layout.

## Acceptance criteria

- `npm run compile` и build проходят без ссылок на удалённый `.project/**`.
- Extension читает `.harness/manifest.yaml` и bundled/current CTS; Parser, Command Palette, Explorer, Editor и manual handoff используют только manifest-resolved или явно extension-owned paths.
- Unit и Extension Host regressions доказывают работу на fixture с `.harness/**` и отсутствие fallback к `.project/**`.
- Документация отражает реализованный control-plane и текущий canonical command syntax; immutable history не переписывается.

## Verification

- `npm run compile`
- `npm run lint`
- `npm run build`
- `npm test -- --runInBand`
- `npm run test:integration`
- `python3 .harness/tools/check-command-references.py --json`
- `python3 .harness/tools/validate.py --mode manual`

## Deliverables

- Обновлённые runtime consumers и fixtures control-plane.
- Focused regression tests.
- Синхронизированные documentation/projections и independent review evidence.

## Implementation plan

**Plan status:** Not planned
**Plan revision:** —
**Planned at:** —
**Plan basis:** —

Заполняется командой `STEP PLAN STEP-024`.

## Evidence

Создано `PROJECT RECONCILE` 2026-09-20: `npm run compile` завершился TS2307 из-за удалённого `../../.project/command-transitions.json`.

## Review status

**Latest verdict:** NOT REVIEWED
**Latest report:** —

## Blocker / Failure reason

—
