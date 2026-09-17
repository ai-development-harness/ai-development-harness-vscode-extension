# STEP-012 — Документационный пакет (RU/EN)

**Статус:** Запланировано
**Type:** DOCUMENTATION
**Приоритет:** Средний
**Фаза:** MVP — стабилизация
**Depends on:** STEP-005, STEP-006, STEP-007, STEP-008, STEP-009, STEP-010

## Requirements

- REQ-001, REQ-002, REQ-003, REQ-004, REQ-005, REQ-006

## ADR

- не требуется

## Risk flags

- none

## Goal

Подготовить полный документационный пакет плагина на русском и английском языках.

## Context

Раздел 11.2 исходного ТЗ. К моменту этого STEP функциональность уже реализована STEP-005..010, поэтому документация описывает фактическое, а не планируемое поведение.

## Scope

- `README.md` (общий, со ссылками) + `README.ru.md` + `README.en.md` (features/installation/quick start/скриншоты).
- `CONTRIBUTING.md` (EN, dev setup, обзор архитектуры).
- `API.md` (internal API для контрибьюторов, включая i18n API).
- `TROUBLESHOOTING.md`.
- `CHANGELOG.md` (запись v0.1.0).

## Mutation policy

### Allowed

- `README.md` (product-часть, не Harness-секция), `README.ru.md`, `README.en.md`, `CONTRIBUTING.md`, `API.md`, `TROUBLESHOOTING.md`, `CHANGELOG.md`.

### Conditional

- —

### Forbidden

- Изменение Harness-секции `README.md` (generated/managed часть, описывающая сам протокол).

## Out of scope

- Маркетинговые материалы для Marketplace listing (отдельно в STEP-013).

## Acceptance criteria

- Все перечисленные файлы существуют и отражают фактическую функциональность.
- README на RU и EN синхронизированы по содержанию.
- CONTRIBUTING описывает реальные dev-команды (сверка с `docs/development.md`), без выдуманных.

## Verification

- Ручная сверка каждого документа с фактическим поведением расширения на момент STEP.

## Deliverables

- `README.md`/`README.ru.md`/`README.en.md`, `CONTRIBUTING.md`, `API.md`, `TROUBLESHOOTING.md`, `CHANGELOG.md`.

## Implementation plan

**Plan status:** Not planned
**Plan revision:** —
**Planned at:** —

Заполняется командой `PLAN STEP-012`.

## Evidence

Заполняется по факту реализации и verification.

## Review status

**Latest verdict:** NOT REVIEWED
**Latest report:** —

## Blocker / Failure reason

—
