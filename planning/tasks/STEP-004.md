# STEP-004 — i18n service (RU default + EN)

**Статус:** Запланировано
**Type:** IMPLEMENTATION
**Приоритет:** Средний
**Фаза:** MVP — фундамент
**Depends on:** STEP-002

## Requirements

- REQ-006

## ADR

- не требуется

## Risk flags

- none

## Goal

Реализовать сервис локализации (RU default, EN) с автоопределением, ручным переключением и graceful fallback.

## Context

REQ-006 требует полной локализации UI на RU/EN с fallback без падений.

## Scope

- `src/locales/ru.json`, `en.json` — начальный набор ключей под уже спроектированные команды/ошибки.
- `i18n.ts` — load/translate/fallback (RU → ключ), определение языка через `vscode.env.language`, команда `harness: Change language`, сохранение выбора в `.project/harness-config.json`.

## Mutation policy

### Allowed

- `src/locales/**`.

### Conditional

- Добавление новых ключей по мере появления UI в последующих STEP — сервис должен быть готов к росту словаря без переписывания API.

### Forbidden

- Хардкод текста напрямую в UI-коде вместо использования сервиса (закладывается как conventions для последующих STEP).

## Out of scope

- Перевод текста фич, которые ещё не реализованы (STEP-005..009) — только сам сервис и минимальный набор ключей для демонстрации.

## Acceptance criteria

- Сервис возвращает перевод по ключу для обоих языков.
- Отсутствующий ключ на EN возвращает RU без исключения.
- Отсутствующий ключ на RU возвращает сам ключ без исключения.
- `vscode.env.language` корректно определяет стартовый язык.
- Команда смены языка сохраняется и переживает перезапуск VSCode.

## Verification

- Unit-тесты `i18n.test.ts` (load/translate/fallback для обоих направлений) — `npm test`.

## Deliverables

- `src/locales/{ru.json,en.json,i18n.ts}` + тесты.

## Implementation plan

**Plan status:** Not planned
**Plan revision:** —
**Planned at:** —

Заполняется командой `PLAN STEP-004`.

## Evidence

Заполняется по факту реализации и verification.

## Review status

**Latest verdict:** NOT REVIEWED
**Latest report:** —

## Blocker / Failure reason

—
