# REQ-003 — Smart-редактор STEP-файлов

**Приоритет:** Высокий
**Источник:** brief

## Requirement

При открытии `planning/tasks/STEP-NNN.md` пользователь получает: подсветку синтаксиса полей и ссылок (`REQ-NNN`/`STEP-NNN`/`ADR-NNN`), inline-диагностику (пустые обязательные поля, битые ссылки, недостижимые/циклические dependencies, попытка расширить `Out of scope`), кликабельные code lens на связанные REQ/ADR/PLAN, autocomplete по существующим ID и quick actions (mark acceptance criterion, request review, flag blocker, create follow-up STEP).

## Rationale

STEP-файл — контракт STEP; ошибки в нём (битые ссылки, нарушение mutation policy) должны быть видны сразу, а не обнаруживаться агентом постфактум.

## Acceptance

- Custom language активируется по glob `STEP-*.md` (реальный формат — labeled markdown без YAML frontmatter).
- Диагностика не блокирует редактирование (только предупреждения/ошибки, редактирование доступно всегда).
- Code lens открывает целевой REQ/ADR/секцию PLAN.md по клику.
- Autocomplete предлагает только реально существующие ID из `docs/requirements/`, `docs/adr/`, `planning/tasks/`.

## Traceability

- STEP: STEP-007, STEP-016, STEP-021, STEP-022, STEP-023, STEP-024
- ADR: ADR-002, ADR-005
