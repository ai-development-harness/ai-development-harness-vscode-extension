# Requirements Status

> Projection-файл. Должен соответствовать `SPEC.md` и доказанному evidence.

| REQ | Название | Статус | Реализующие STEP | Evidence |
|---|---|---|---|---|
| REQ-001 | Command Palette с канонической командной поверхностью | Частично | STEP-005, STEP-009 | `planning/tasks/STEP-005.md` (Статус: Выполнено), PASS `planning/reviews/STEP-005/REVIEW-2026-09-17T2350.md`; PASS `planning/reviews/STEP-009/REVIEW-2026-09-19T2038Z.md` подтвердил manual handoff для agent-requiring paths. REQ остаётся частичным: его acceptance требует отображать результат выполнения, а MVP намеренно не выполняет agent lifecycle автоматически. |
| REQ-002 | Sidebar Explorer артефактов проекта | Выполнено | STEP-006, STEP-015, STEP-016 | `planning/tasks/STEP-006.md`, PASS `planning/reviews/STEP-006/REVIEW-2026-09-18T1108.md`; PASS `planning/reviews/STEP-015/REVIEW-2026-09-19T1135Z.md`; ADR-005 подтверждён PASS `planning/reviews/STEP-016/REVIEW-2026-09-19T0951Z.md` |
| REQ-003 | Smart-редактор STEP-файлов | Выполнено | STEP-007, STEP-016, STEP-021, STEP-022, STEP-023 | Базовая реализация: `planning/tasks/STEP-007.md`, PASS `planning/reviews/STEP-007/REVIEW-2026-09-20T0708Z.md`; ADR-005 подтверждён PASS `planning/reviews/STEP-016/REVIEW-2026-09-19T0951Z.md`; corrective STEP-021 подтверждён PASS `planning/reviews/STEP-021/REVIEW-2026-09-20T0755Z.md`; manifest-driven custom layout подтверждён PASS `planning/reviews/STEP-022/REVIEW-2026-09-20T0917Z.md`; isolated pre-activation CI evidence подтверждено PASS `planning/reviews/STEP-023/REVIEW-2026-09-20T0958Z.md`. |
| REQ-004 | Status Bar с состоянием проекта | Запланировано | STEP-008 | — |
| REQ-005 | Manual handoff к agent CLI в MVP | Выполнено | STEP-001, STEP-009, STEP-017, STEP-018, STEP-019, STEP-020 | PASS `planning/reviews/STEP-009/REVIEW-2026-09-20T0422Z.md`: manual handoff покрывает exact command/safe descriptor, localized blocker и no-spawn boundary. Automatic lifecycle остаётся отдельной future capability и требует нового ADR и implementation STEP. |
| REQ-006 | Локализация UI (RU/EN) | Частично | STEP-004, STEP-009, STEP-010, STEP-020 | PASS `planning/reviews/STEP-009/REVIEW-2026-09-19T2038Z.md` подтвердил RU/EN manual-handoff representation и blocker. Полная локализация остального UI остаётся в STEP-010. |
| REQ-007 | Dependency graph visualization (Phase 2) | Отложено | — | — |
| REQ-008 | Health Dashboard (Phase 2) | Отложено | — | — |
| REQ-009 | Mutation Policy enforcement warnings (Phase 2) | Отложено | — | — |
| REQ-010 | Keyboard shortcuts (Phase 2) | Отложено | — | — |
