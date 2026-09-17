# STEP-006 — Sidebar Explorer

**Статус:** Запланировано
**Type:** IMPLEMENTATION
**Приоритет:** Высокий
**Фаза:** MVP — UI
**Depends on:** STEP-003

## Requirements

- REQ-002

## ADR

- не требуется

## Risk flags

- none

## Goal

Реализовать Sidebar Explorer — дерево артефактов проекта с фильтрами, статус-иконками и context-menu.

## Context

REQ-002. Строится поверх Parser layer (STEP-003), путь и статус-модель берутся из манифеста/протокола, а не хардкодятся.

## Scope

- `treeProvider.ts` (VSCode `TreeDataProvider`) поверх Parser layer.
- `treeItem.ts`.
- Иконки по 5 реальным статусам (`Запланировано/В работе/Выполнено/Заблокировано/Отменено`).
- Фильтры (Status/Type/Priority/Risk flags) и поиск по ID, комбинируемые.
- Lazy loading по группам (Requirements/Architecture/Tasks/...).
- Context-menu: Create/Edit/Delete/Mark as done/Flag as blocker/Create follow-up STEP/View in Explorer.
- `refresh.ts` — обновление по file watcher на релевантные пути из манифеста.

## Mutation policy

### Allowed

- `src/explorer/**`.

### Conditional

- Действия context-menu, мутирующие файлы (mark as done, flag as blocker) — реализовать как явную запись через parser-слой, не скрытые side effects.

### Forbidden

- Собственная логика pre-dispatch валидации (переиспользовать из STEP-005, не дублировать).

## Out of scope

- Drag-drop переупорядочивание (было в исходном ТЗ, но требует отдельного решения о семантике; не критично для MVP — фиксируется отдельным REQ/STEP при запросе).

## Acceptance criteria

- Дерево строится по путям из манифеста.
- 5 статус-иконок соответствуют реальному enum протокола.
- Комбинация фильтров и поиска работает одновременно.
- Explorer загружается за <500ms на fixture-проекте с 50 артефактами.
- Click открывает файл, right-click показывает меню.

## Verification

- Unit-тесты `treeProvider` на fixture-дереве.
- Перф-тест на синтетическом проекте с 50 STEP.
- Ручная проверка в Extension Development Host.

## Deliverables

- `src/explorer/**` + тесты.
- Fixture-проект с 50 STEP для перф-теста.

## Implementation plan

**Plan status:** Not planned
**Plan revision:** —
**Planned at:** —

Заполняется командой `PLAN STEP-006`.

## Evidence

Заполняется по факту реализации и verification.

## Review status

**Latest verdict:** NOT REVIEWED
**Latest report:** —

## Blocker / Failure reason

—
