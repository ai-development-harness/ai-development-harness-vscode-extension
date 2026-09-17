# STEP-013 — Упаковка и релиз v0.1.0 (MVP beta)

**Статус:** Запланировано
**Type:** RELEASE
**Приоритет:** Высокий
**Фаза:** MVP — релиз
**Depends on:** STEP-011, STEP-012

## Requirements

- не требуется для purely technical corrective task

## ADR

- не требуется

## Risk flags

- release-critical

## Goal

Собрать и подготовить к публикации v0.1.0 (MVP beta).

## Context

Финальный STEP MVP-roadmap перед публикацией на VSCode Marketplace.

## Scope

- Финальная полировка (устранение известных papercuts из предыдущих REVIEW).
- Сборка `.vsix`.
- Прохождение manual testing checklist (раздел 5.3 исходного ТЗ, адаптированный под фактическую реализованную функциональность).
- Подготовка Marketplace listing (описание, скриншоты, иконка).

## Mutation policy

### Allowed

- `package.json` (версия/metadata), сборочные артефакты, маркетинговые материалы.

### Conditional

- Точечные bugfix-правки, найденные на manual testing checklist — если выходят за мелкий фикс, оформляются как follow-up STEP, а не расширяют этот.

### Forbidden

- Новая функциональность.

## Out of scope

- Публикация на Marketplace как таковая (отдельное решение пользователя/владельца аккаунта, не автоматизируется этим STEP).

## Acceptance criteria

- `.vsix` собирается без ошибок.
- Manual testing checklist пройден полностью, результаты приложены как Evidence.
- `CHANGELOG.md` обновлён финальной версией 0.1.0.

## Verification

- `npm run package` (точное имя фиксируется по факту реализации STEP-002).
- Полный прогон manual testing checklist в чистом Extension Development Host.

## Deliverables

- `.vsix`-файл.
- Обновлённый `CHANGELOG.md`.
- Отчёт по manual testing checklist.

## Implementation plan

**Plan status:** Not planned
**Plan revision:** —
**Planned at:** —

Заполняется командой `PLAN STEP-013`.

## Evidence

Заполняется по факту реализации и verification.

## Review status

**Latest verdict:** NOT REVIEWED
**Latest report:** —

## Blocker / Failure reason

—
