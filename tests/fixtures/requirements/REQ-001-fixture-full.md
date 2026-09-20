# REQ-001 — Command Palette с канонической командной поверхностью

**Приоритет:** Критический
**Источник:** brief

## Requirement

Пользователь может выполнить 11 MVP-команд Harness (`INIT PROJECT`, `ADD STEP`, `PLAN STEP-NNN`, `IMPLEMENT STEP-NNN`, `REVIEW STEP-NNN`, `FIX STEP-NNN`, `RUN STEP-NNN`, `NEXT STEP`, `STATUS PROJECT`, `QUICK FIX`, `RECONCILE PROJECT`) через Command Palette VSCode.

## Rationale

Ручной ввод команд протокола и ручная проверка dependencies/mutation policy — источник ошибок.

## Acceptance

- Все 11 команд доступны через Command Palette.
- Попытка выполнить mutating-команду при `project.initialized: false` блокируется.
- Попытка выполнить команду над STEP с невыполненной hard dependency блокируется.
- Результат выполнения отображается пользователю.

## Traceability

- STEP: STEP-005
- ADR: ADR-003
