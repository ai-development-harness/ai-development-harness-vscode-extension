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
| STEP-007 | STEP File Editor (диагностика, code lens, hover, autocomplete) | IMPLEMENTATION | Высокий | Выполнено | STEP-003, STEP-016 | REQ-003 |
| STEP-008 | Status Bar | IMPLEMENTATION | Средний | Запланировано | STEP-003, STEP-005 | REQ-004 |
| STEP-009 | Manual handoff к agent CLI в MVP | IMPLEMENTATION | Критический | Выполнено | STEP-001, STEP-005 | REQ-005 |
| STEP-010 | Полная локализация реализованного UI | IMPLEMENTATION | Средний | Запланировано | STEP-004, STEP-005, STEP-006, STEP-007, STEP-008, STEP-009 | REQ-006 |
| STEP-011 | Test suite: >80% coverage + integration-тесты | IMPLEMENTATION | Высокий | Запланировано | STEP-005..STEP-010 | REQ-001..REQ-006 |
| STEP-012 | Документационный пакет (RU/EN) | DOCUMENTATION | Средний | Запланировано | STEP-005..STEP-010 | REQ-001..REQ-006 |
| STEP-013 | Упаковка и релиз v0.1.0 (MVP beta) | RELEASE | Высокий | Запланировано | STEP-011, STEP-012 | — |
| STEP-014 | Закрыть TOCTOU-окно между guard'ом `canMarkDone` и записью в Explorer | BUGFIX | Средний | Выполнено | STEP-006 | REQ-002 |
| STEP-015 | Убрать lifecycle-статус REQ из `docs/requirements/SPEC.md` | REFACTOR | Средний | Выполнено | STEP-016 | REQ-002 |
| STEP-016 | Принять ADR-005: резолюция путей к Harness-артефактам вне manifest | ADR | Высокий | Выполнено | STEP-003, STEP-006 | REQ-002, REQ-003 |
| STEP-017 | Принять ADR о безопасной границе write-invocation headless agent CLI | ADR | Критический | Выполнено | STEP-001, STEP-005 | REQ-005 |
| STEP-018 | Принять ADR об ответственности пользователя за авторизацию agent CLI | ADR | Критический | Выполнено | STEP-017 | REQ-005 |
| STEP-019 | Выбрать безопасный automatic executor или пересмотреть scope REQ-005 | ADR | Критический | Выполнено | STEP-017, STEP-018 | REQ-005 |
| STEP-020 | Принять ADR о безопасном представлении free-text команд в manual handoff MVP | ADR | Критический | Выполнено | STEP-019 | REQ-005, REQ-006 |
| STEP-021 | Корректировка Smart STEP Editor по findings review STEP-007 | BUGFIX | Высокий | Выполнено | STEP-007, STEP-016 | REQ-003 |
| STEP-022 | Назначать язык Smart STEP Editor для manifest-resolved taskDirectory | BUGFIX | Высокий | Выполнено | STEP-007, STEP-021 | REQ-003 |
| STEP-023 | Стабилизировать pre-activation regression Smart STEP Editor в CI | BUGFIX | Высокий | Выполнено | STEP-007, STEP-022 | REQ-003 |
| STEP-024 | Адаптировать Navigator к control-plane `.harness` | BUGFIX | Критический | Запланировано | STEP-003, STEP-005, STEP-006, STEP-007, STEP-009 | REQ-001, REQ-002, REQ-003, REQ-005, REQ-006 |
| STEP-025 | Адаптировать REQ-consumers к per-file `docs/requirements/REQ-NNN-*.md` | BUGFIX | Критический | Выполнено | STEP-024 | REQ-001, REQ-002 |

## Не запланировано (Phase 2, деферред REQ)

REQ-007 (Dependency graph), REQ-008 (Health Dashboard), REQ-009 (Mutation Policy enforcement warnings), REQ-010 (Keyboard shortcuts) — статус `Отложено`, STEP не созданы. См. `docs/requirements/SPEC.md` и `docs/OPEN_QUESTIONS.md` (OQ-003 для REQ-007).

## Незаблокированная работа прямо сейчас

STEP-024 — критический corrective scope после relocation control-plane; полностью разблокирован для `STEP PLAN STEP-024`.
