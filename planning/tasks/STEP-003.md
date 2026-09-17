# STEP-003 — Parser layer (manifest, STEP/REQ/ADR, EXECUTION_PROTOCOL)

**Статус:** Запланировано
**Type:** IMPLEMENTATION
**Приоритет:** Критический
**Фаза:** MVP — фундамент
**Depends on:** STEP-002

## Requirements

- REQ-001, REQ-002, REQ-003

## ADR

- ADR-001, ADR-002

## Risk flags

- none

## Goal

Реализовать слой чтения и парсинга Harness-артефактов (manifest, STEP/REQ/ADR markdown, EXECUTION_PROTOCOL.md) как единственный источник путей и структурированных данных для остальных компонентов.

## Context

ADR-001 и ADR-002 фиксируют решения (пути только из манифеста, labeled-markdown формат без frontmatter); реализация ещё не существует.

## Scope

- `yamlParser.ts` — чтение `.project/manifest.yaml` (`project.initialized`, `protocol.*`, `sources.*`, `language.*`).
- `markdownParser.ts` — извлечение bold-меток и секций из STEP/REQ/ADR-файлов по реальному формату TEMPLATE.md.
- `executionProtocol.ts` — структурный разбор `planning/EXECUTION_PROTOCOL.md` (список команд, enum статусов), по возможности динамически, не хардкодом.
- `types.ts` — типы результатов парсинга.
- Обработка отсутствующего/повреждённого манифеста: явная ошибка «не похоже на Harness-проект», без угадывания путей.

## Mutation policy

### Allowed

- `src/parser/**`, unit-тесты парсера.

### Conditional

- Изменение `types.ts` при появлении новых полей манифеста.

### Forbidden

- UI-код (explorer/editor/statusbar), agent integration.

## Out of scope

- Кэширование/инвалидация (появится вместе с explorer/status bar STEP при необходимости).
- Запись файлов — парсер только читает.

## Acceptance criteria

- Парсер корректно читает реальный `.project/manifest.yaml` из этого репозитория и из `ai-development-harness-template`.
- Парсер STEP-файла извлекает все поля реального `planning/tasks/TEMPLATE.md`.
- Парсер REQ/ADR извлекает поля соответствующих TEMPLATE.md.
- Отсутствующий манифест даёт понятную ошибку, а не исключение/краш.

## Verification

- Unit-тесты (`npm test`) на fixtures — реальные TEMPLATE.md и манифест, скопированные в `tests/fixtures`.

## Deliverables

- `src/parser/{yamlParser,markdownParser,executionProtocol,types}.ts` + тесты.
- `tests/fixtures/**`.

## Implementation plan

**Plan status:** Not planned
**Plan revision:** —
**Planned at:** —

Заполняется командой `PLAN STEP-003`.

## Evidence

Заполняется по факту реализации и verification.

## Review status

**Latest verdict:** NOT REVIEWED
**Latest report:** —

## Blocker / Failure reason

—
