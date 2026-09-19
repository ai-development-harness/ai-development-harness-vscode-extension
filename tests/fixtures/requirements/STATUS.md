# Requirements Status

> Projection-файл. Должен соответствовать `SPEC.md` и доказанному evidence.

| REQ | Название | Статус | Реализующие STEP | Evidence |
|---|---|---|---|---|
| REQ-001 | Command Palette с канонической командной поверхностью | Частично | STEP-005 | `planning/tasks/STEP-005.md` (Статус: Выполнено), PASS `planning/reviews/STEP-005/REVIEW-2026-09-17T2350.md`; полное закрытие REQ ждёт реального agent invocation из `STEP-009` |
| REQ-002 | Sidebar Explorer артефактов проекта | Выполнено | STEP-006, STEP-015, STEP-016 | `planning/tasks/STEP-006.md`, PASS `planning/reviews/STEP-006/REVIEW-2026-09-18T1108.md`; PASS `planning/reviews/STEP-015/REVIEW-2026-09-19T1135Z.md`; ADR-005 подтверждён PASS `planning/reviews/STEP-016/REVIEW-2026-09-19T0951Z.md` |
| REQ-003 | Smart-редактор STEP-файлов | Запланировано | STEP-007, STEP-016 | ADR-005 подтверждён PASS `planning/reviews/STEP-016/REVIEW-2026-09-19T0951Z.md`; STEP-007 использует общий resolver |
| REQ-004 | Status Bar с состоянием проекта | Запланировано | STEP-008 | — |
| REQ-005 | Terminal Integration с агентом | Запланировано | STEP-001, STEP-009 | — |
| REQ-006 | Локализация UI (RU/EN) | Частично | STEP-004, STEP-010 | `planning/tasks/STEP-004.md` (сервис + первая локализованная команда), PASS `planning/reviews/STEP-004/REVIEW-2026-09-17T2300.md`; полное покрытие REQ ждёт `STEP-010` |
| REQ-007 | Dependency graph visualization (Phase 2) | Отложено | — | — |
| REQ-008 | Health Dashboard (Phase 2) | Отложено | — | — |
| REQ-009 | Mutation Policy enforcement warnings (Phase 2) | Отложено | — | — |
| REQ-010 | Keyboard shortcuts (Phase 2) | Отложено | — | — |
