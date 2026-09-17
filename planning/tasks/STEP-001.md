# STEP-001 — Research: механизм вызова агента для command dispatch

**Статус:** Запланировано
**Type:** RESEARCH
**Приоритет:** Критический
**Фаза:** MVP — фундамент
**Depends on:** —

## Requirements

- REQ-005

## ADR

- ADR по итогам этого STEP (номер присваивается при закрытии)

## Risk flags

- architecture

## Goal

Определить и доказать рабочий механизм, которым плагин передаёт контекст агенту (Claude Code / Codex) для выполнения канонической команды и получает structured-результат — без выдуманного HTTP API из исходного ТЗ.

## Context

Исходный артефакт-ТЗ (раздел 4.1) описывает JSON-контракт `HarnessCommand`/`HarnessResult` поверх «Claude Code API», которого не существует в задокументированном виде. См. `docs/OPEN_QUESTIONS.md` OQ-001. Это блокирует STEP-005 (dispatch) и STEP-009 (Terminal Integration).

## Scope

- Изучить реально доступные способы вызова Claude Code / Codex: headless CLI (print/JSON output режим), открытый VSCode-терминал с автоподстановкой промпта, процесс через Agent SDK.
- Зафиксировать ограничения каждого варианта: аутентификация, кроссплатформенность, возможность получить structured-результат (не просто текст), поведение при долгом выполнении, возможность отмены.
- Реализовать минимальный spike: реальный запуск одной команды (например `PLAN STEP-002` на fixture-проекте) через выбранный механизм и разбор полученного результата.
- Задокументировать решение отдельным ADR.

## Mutation policy

### Allowed

- Spike-скрипт вне production-кода расширения (например `spikes/`, не входит в bundle).

### Conditional

- —

### Forbidden

- Полноценная реализация Agent integration layer (это STEP-009).
- Изменение production-кода расширения.

## Out of scope

- Полноценная реализация Terminal Integration (STEP-009).
- UI для отображения прогресса выполнения.

## Acceptance criteria

- Проведено сравнение минимум двух реальных вариантов вызова с конкретными плюсами/минусами.
- Spike демонстрирует реальный end-to-end вызов на fixture-проекте с получением результата.
- Решение зафиксировано отдельным ADR с обоснованием и альтернативами.
- `docs/OPEN_QUESTIONS.md` OQ-001 переведён в `RESOLVED`.

## Verification

- Ручной прогон spike-скрипта с реальным CLI/SDK; вывод команды и её результат приложены как Evidence.

## Deliverables

- Spike-скрипт (не публикуется в bundle расширения).
- Новый ADR с решением.
- Обновлённый `docs/OPEN_QUESTIONS.md` (OQ-001 → RESOLVED).

## Implementation plan

**Plan status:** Not planned
**Plan revision:** —
**Planned at:** —

Заполняется командой `PLAN STEP-001`.

## Evidence

Заполняется по факту реализации и verification.

## Review status

**Latest verdict:** NOT REVIEWED
**Latest report:** —

## Blocker / Failure reason

—
