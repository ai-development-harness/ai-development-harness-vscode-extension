# STEP-009 — Terminal Integration (финализация)

**Статус:** Запланировано
**Type:** IMPLEMENTATION
**Приоритет:** Критический
**Фаза:** MVP — интеграция
**Depends on:** STEP-001, STEP-005

## Requirements

- REQ-005

## ADR

- ADR по итогам STEP-001 (номер уточняется)

## Risk flags

- external-integration

## Goal

Финализировать Terminal Integration: Output Channel, полная сборка контекста, три уровня обработки ошибок, отмена выполнения.

## Context

REQ-005. STEP-001 определяет механизм вызова агента; этот STEP доводит его до продакшн-реализации, встроенной во все команды STEP-005.

## Scope

- Output Channel «Harness».
- Сборка контекста (EXECUTION_PROTOCOL.md, manifest, релевантные STEP/REQ/ADR, git status через `src/git/gitHelper.ts`).
- Реализация Agent integration layer по решению STEP-001.
- Auto-reload изменённых файлов без потери фокуса редактора.
- Три уровня error handling (pre-validation / agent-error-with-retry / runtime-recover).
- Отмена выполнения по Ctrl+C.

## Mutation policy

### Allowed

- `src/api/**`, `src/git/**`, интеграция в `src/commands/**`.

### Conditional

- Retry-политика (число попыток/backoff) — зафиксировать явно в Verification, не оставлять магическими числами без объяснения.

### Forbidden

- Изменение выбранного в STEP-001 механизма без нового ADR (Superseded).

## Out of scope

- Параллельное выполнение нескольких команд одновременно (однопоточная модель на MVP).

## Acceptance criteria

- Terminal output структурирован и читаем.
- Auto-reload не сбрасывает фокус редактора.
- Ошибки agent/API показываются с объяснением и retry, где применимо.
- Runtime-ошибка парсинга не роняет расширение.
- Команда прерывается по Ctrl+C без порчи состояния файлов.

## Verification

- Integration-тест полного цикла на fixture-проекте (реальный вызов через механизм из STEP-001).
- Ручная проверка отмены (Ctrl+C) и восстановления после сбоя агента (симуляция недоступности).

## Deliverables

- `src/api/**`, `src/git/gitHelper.ts` + тесты.
- Обновлённая интеграция во все команды STEP-005.

## Implementation plan

**Plan status:** Not planned
**Plan revision:** —
**Planned at:** —

Заполняется командой `PLAN STEP-009`.

## Evidence

Заполняется по факту реализации и verification.

## Review status

**Latest verdict:** NOT REVIEWED
**Latest report:** —

## Blocker / Failure reason

—
