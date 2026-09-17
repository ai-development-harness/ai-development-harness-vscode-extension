# Project Roadmap

> Projection-файл. Полный контракт каждого шага находится в `planning/tasks/STEP-NNN.md`.

| STEP | Название | Type | Priority | Status | Depends on | REQ |
|---|---|---|---|---|---|---|
| STEP-001 | Research: механизм вызова агента для command dispatch | RESEARCH | Критический | В работе | — | REQ-005 |
| STEP-002 | Project scaffolding и инструментарий | IMPLEMENTATION | Критический | Запланировано | — | — |
| STEP-003 | Parser layer (manifest, STEP/REQ/ADR, EXECUTION_PROTOCOL) | IMPLEMENTATION | Критический | Запланировано | STEP-002 | REQ-001, REQ-002, REQ-003 |
| STEP-004 | i18n service (RU default + EN) | IMPLEMENTATION | Средний | Запланировано | STEP-002 | REQ-006 |
| STEP-005 | Command Palette: 11 MVP-команд + pre-dispatch валидация | IMPLEMENTATION | Критический | Запланировано | STEP-001, STEP-003, STEP-004 | REQ-001 |
| STEP-006 | Sidebar Explorer | IMPLEMENTATION | Высокий | Запланировано | STEP-003 | REQ-002 |
| STEP-007 | STEP File Editor (диагностика, code lens, hover, autocomplete) | IMPLEMENTATION | Высокий | Запланировано | STEP-003 | REQ-003 |
| STEP-008 | Status Bar | IMPLEMENTATION | Средний | Запланировано | STEP-003, STEP-005 | REQ-004 |
| STEP-009 | Terminal Integration (финализация) | IMPLEMENTATION | Критический | Запланировано | STEP-001, STEP-005 | REQ-005 |
| STEP-010 | Полная локализация реализованного UI | IMPLEMENTATION | Средний | Запланировано | STEP-004, STEP-005, STEP-006, STEP-007, STEP-008, STEP-009 | REQ-006 |
| STEP-011 | Test suite: >80% coverage + integration-тесты | IMPLEMENTATION | Высокий | Запланировано | STEP-005..STEP-010 | REQ-001..REQ-006 |
| STEP-012 | Документационный пакет (RU/EN) | DOCUMENTATION | Средний | Запланировано | STEP-005..STEP-010 | REQ-001..REQ-006 |
| STEP-013 | Упаковка и релиз v0.1.0 (MVP beta) | RELEASE | Высокий | Запланировано | STEP-011, STEP-012 | — |

## Не запланировано (Phase 2, деферред REQ)

REQ-007 (Dependency graph), REQ-008 (Health Dashboard), REQ-009 (Mutation Policy enforcement warnings), REQ-010 (Keyboard shortcuts) — статус `Отложено`, STEP не созданы. См. `docs/requirements/SPEC.md` и `docs/OPEN_QUESTIONS.md` (OQ-003 для REQ-007).

## Незаблокированная работа прямо сейчас

STEP-001 и STEP-002 не имеют зависимостей — оба доступны для `PLAN` немедленно (могут вестись параллельно).
