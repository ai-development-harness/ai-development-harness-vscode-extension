# STEP-011 — Test suite: >80% coverage + integration-тесты MVP-цикла

**Статус:** Запланировано
**Type:** IMPLEMENTATION
**Приоритет:** Высокий
**Фаза:** MVP — стабилизация
**Depends on:** STEP-005, STEP-006, STEP-007, STEP-008, STEP-009, STEP-010

## Requirements

- REQ-001, REQ-002, REQ-003, REQ-004, REQ-005, REQ-006

## ADR

- не требуется

## Risk flags

- none

## Goal

Довести unit test coverage до >80% и добавить integration-тесты полного MVP-цикла через `@vscode/test-electron`.

## Context

Разрозненные unit-тесты уже написаны внутри STEP-002..010; этот STEP закрывает пробелы покрытия и добавляет end-to-end integration-сценарии.

## Scope

- Замер текущего coverage, добор недостающих unit-тестов до >80% (parser, validation, dependency-логика, i18n).
- Integration test suite на fixture harness-проекте (клон структуры template) — прогон каждой из 11 MVP-команд и проверка результата.
- Тесты error-путей: отсутствующий manifest, невалидный STEP, недоступный агент.

## Mutation policy

### Allowed

- `tests/**`, минимальные правки `src/**` только для тестируемости (например экспорт internal-функции), без изменения поведения.

### Conditional

- —

### Forbidden

- Изменение поведения фич под предлогом «упростить тестирование».

## Out of scope

- Нагрузочное/перф-тестирование сверх целевых показателей из `docs/PROJECT.md` (точечно уже покрыто в STEP-006).

## Acceptance criteria

- Unit test coverage >80% (отчёт приложен как Evidence).
- Integration-тесты покрывают все 11 MVP-команд на fixture-проекте.
- Тесты error-путей проходят и проверяют ожидаемое graceful-поведение, а не просто «не падает».

## Verification

- `npm test -- --coverage`
- `npm run test:integration` (точное имя фиксируется по факту реализации STEP-002)

## Deliverables

- Обновлённый `tests/**`, coverage-отчёт, fixture harness-проект для integration-тестов.

## Implementation plan

**Plan status:** Not planned
**Plan revision:** —
**Planned at:** —

Заполняется командой `PLAN STEP-011`.

## Evidence

Заполняется по факту реализации и verification.

## Review status

**Latest verdict:** NOT REVIEWED
**Latest report:** —

## Blocker / Failure reason

—
