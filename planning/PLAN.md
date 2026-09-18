# Project Roadmap

> Projection-файл. Полный контракт каждого шага находится в `planning/tasks/STEP-NNN.md`.

| STEP | Название | Type | Priority | Status | Depends on | REQ |
|---|---|---|---|---|---|---|
| STEP-001 | Research: механизм вызова агента для command dispatch | RESEARCH | Критический | Выполнено | — | REQ-005 |
| STEP-002 | Project scaffolding и инструментарий | IMPLEMENTATION | Критический | Выполнено | — | — |
| STEP-003 | Parser layer (manifest, STEP/REQ/ADR, EXECUTION_PROTOCOL) | IMPLEMENTATION | Критический | Выполнено | STEP-002 | REQ-001, REQ-002, REQ-003 |
| STEP-004 | i18n service (RU default + EN) | IMPLEMENTATION | Средний | Выполнено | STEP-002 | REQ-006 |
| STEP-005 | Command Palette: 11 MVP-команд + pre-dispatch валидация | IMPLEMENTATION | Критический | Выполнено | STEP-001, STEP-003, STEP-004 | REQ-001 |
| STEP-006 | Sidebar Explorer | IMPLEMENTATION | Высокий | Выполнено | STEP-003 | REQ-002 |
| STEP-007 | STEP File Editor (диагностика, code lens, hover, autocomplete) | IMPLEMENTATION | Высокий | Запланировано | STEP-003 | REQ-003 |
| STEP-008 | Status Bar | IMPLEMENTATION | Средний | Запланировано | STEP-003, STEP-005 | REQ-004 |
| STEP-009 | Terminal Integration (финализация) | IMPLEMENTATION | Критический | Запланировано | STEP-001, STEP-005 | REQ-005 |
| STEP-010 | Полная локализация реализованного UI | IMPLEMENTATION | Средний | Запланировано | STEP-004, STEP-005, STEP-006, STEP-007, STEP-008, STEP-009 | REQ-006 |
| STEP-011 | Test suite: >80% coverage + integration-тесты | IMPLEMENTATION | Высокий | Запланировано | STEP-005..STEP-010 | REQ-001..REQ-006 |
| STEP-012 | Документационный пакет (RU/EN) | DOCUMENTATION | Средний | Запланировано | STEP-005..STEP-010 | REQ-001..REQ-006 |
| STEP-013 | Упаковка и релиз v0.1.0 (MVP beta) | RELEASE | Высокий | Запланировано | STEP-011, STEP-012 | — |
| STEP-014 | Закрыть TOCTOU-окно между guard'ом `canMarkDone` и записью в Explorer | BUGFIX | Средний | Запланировано | STEP-006 | REQ-002 |

## Не запланировано (Phase 2, деферред REQ)

REQ-007 (Dependency graph), REQ-008 (Health Dashboard), REQ-009 (Mutation Policy enforcement warnings), REQ-010 (Keyboard shortcuts) — статус `Отложено`, STEP не созданы. См. `docs/requirements/SPEC.md` и `docs/OPEN_QUESTIONS.md` (OQ-003 для REQ-007).

## Незаблокированная работа прямо сейчас

STEP-001..STEP-006 `Выполнено`. `STEP-007` зависит только от `STEP-003` — полностью разблокирован, доступен для `PLAN`. `STEP-008` (depends on STEP-003, STEP-005) и `STEP-009` (depends on STEP-001, STEP-005) тоже полностью разблокированы — их единственная незакрытая hard dependency была `STEP-005`.

`STEP-014` (corrective, F-018 из `REVIEW STEP-006`) зависит только от `STEP-006` — полностью разблокирован, доступен для `PLAN`.
