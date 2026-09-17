# STEP-007 — STEP File Editor (диагностика, code lens, hover, autocomplete, quick actions)

**Статус:** Запланировано
**Type:** IMPLEMENTATION
**Приоритет:** Высокий
**Фаза:** MVP — UI
**Depends on:** STEP-003

## Requirements

- REQ-003

## ADR

- ADR-002

## Risk flags

- none

## Goal

Реализовать smart-редактор STEP-файлов: custom language, диагностика, code lens, hover, autocomplete, quick actions.

## Context

REQ-003, ADR-002 (реальный формат — labeled markdown без frontmatter, glob `STEP-*.md`, не расширение `.step.md`).

## Scope

- TextMate grammar `syntaxes/harness-step.tmLanguage.json` и `language-configuration.json`, регистрация по glob `planning/tasks/STEP-*.md`.
- `validation.ts` — диагностика (пустые обязательные поля, битые REQ/STEP/ADR ссылки, циклические/неудовлетворяемые dependencies, попытка расширения Out of scope) как VSCode Diagnostics, non-blocking.
- `codeLens.ts` (Go to REQ/ADR, View in PLAN).
- `hoverProvider.ts`.
- `autocomplete.ts` (REQ-/STEP-/ADR- по существующим ID из parser layer).
- Quick actions (mark acceptance criterion done, request review, flag blocker, create follow-up STEP) как CodeActions/inline buttons.

## Mutation policy

### Allowed

- `src/editor/**`, `syntaxes/**`, `language-configuration.json`.

### Conditional

- Quick actions, мутирующие STEP-файл — только в пределах mutation policy самого STEP, не расширять production-логику мимо REQ-003.

### Forbidden

- Изменение самого протокола/TEMPLATE.md файлов.

## Out of scope

- STEP File Editor для REQ/ADR-файлов (в MVP фокус на STEP-NNN.md; расширение на REQ/ADR — отдельный REQ при запросе).

## Acceptance criteria

- Custom language активен только на `STEP-*.md`.
- Диагностика не блокирует редактирование.
- Code lens открывает целевой файл/секцию по клику.
- Autocomplete предлагает только существующие ID.
- Quick actions корректно обновляют файл.

## Verification

- Unit-тесты `validation.ts` на fixture STEP-файлах (валидных и с намеренными ошибками).
- Integration-тест открытия STEP-файла в Extension Development Host с проверкой диагностики.

## Deliverables

- `syntaxes/**`, `language-configuration.json`, `src/editor/**` + тесты.

## Implementation plan

**Plan status:** Not planned
**Plan revision:** —
**Planned at:** —

Заполняется командой `PLAN STEP-007`.

## Evidence

Заполняется по факту реализации и verification.

## Review status

**Latest verdict:** NOT REVIEWED
**Latest report:** —

## Blocker / Failure reason

—
