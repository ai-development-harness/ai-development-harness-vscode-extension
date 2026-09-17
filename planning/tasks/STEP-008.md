# STEP-008 — Status Bar

**Статус:** Запланировано
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

REQ-004. «Next command» переиспользует логику `NEXT STEP` из STEP-005, счётчик warnings — существующую diagnostic-логику STEP-007 (полноценный Health Dashboard — REQ-008, вне MVP).

## Scope

- `statusBar.ts` — left/right items (статус инициализации, completion bar, next command, счётчик health-warnings).
- Батчинг обновлений (debounce, не чаще раза в секунду).
- Click-обработчики на каждый item.

## Mutation policy

### Allowed

- `src/ui/statusBar.ts`.

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

**Plan status:** Not planned
**Plan revision:** —
**Planned at:** —

Заполняется командой `PLAN STEP-008`.

## Evidence

Заполняется по факту реализации и verification.

## Review status

**Latest verdict:** NOT REVIEWED
**Latest report:** —

## Blocker / Failure reason

—
