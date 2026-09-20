# REQ-001 — Command Palette с канонической командной поверхностью

**Приоритет:** Критический
**Источник:** brief

## Requirement

Пользователь может выполнить 11 MVP-команд Harness через Command Palette VSCode. Перед выполнением каждой команды система обязана проверить: `project.initialized` (INIT guard), unmet hard dependencies выбранного STEP, границы mutation policy текущего STEP — и заблокировать dispatch с понятным объяснением при нарушении любого из условий.

## Rationale

Ручной ввод команд протокола и ручная проверка dependencies/mutation policy — источник ошибок; UI должен физически не позволять нарушить protocol invariants.

## Acceptance

- Все 11 команд доступны через Command Palette и видимы в ней под префиксом `harness:`.
- Попытка выполнить mutating-команду при `project.initialized: false` блокируется с объяснением и ссылкой на команду инициализации.
- Попытка выполнить команду над STEP с невыполненной hard dependency блокируется с указанием конкретного blocking STEP.
- Результат выполнения (изменённые файлы, next command, ошибки) отображается пользователю и не требует ручного открытия файлов для проверки успеха.

## Traceability

- STEP: STEP-005, STEP-024, STEP-025
- ADR: ADR-003
