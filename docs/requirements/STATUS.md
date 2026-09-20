# Requirements Status

> Projection-файл. Должен соответствовать `SPEC.md` и доказанному evidence.

| REQ | Название | Статус | Реализующие STEP | Evidence |
|---|---|---|---|---|
| [REQ-001](REQ-001-command-palette.md) | Command Palette с канонической командной поверхностью | Частично | STEP-005, STEP-009, STEP-024, STEP-025 | Предыдущее evidence действительно только для legacy layout; `STEP-024` восстанавливает совместимость с current control-plane `.harness/**`; `STEP-025` устраняет drift REQ delete-guard от per-file `docs/requirements/`. |
| [REQ-002](REQ-002-sidebar-explorer.md) | Sidebar Explorer артефактов проекта | Частично | STEP-006, STEP-015, STEP-016, STEP-024, STEP-025 | Предыдущее evidence действительно только для legacy layout; `STEP-024` восстанавливает совместимость с current control-plane `.harness/**`; `STEP-025` устраняет drift чтения REQ-узлов от per-file `docs/requirements/`. |
| [REQ-003](REQ-003-step-editor.md) | Smart-редактор STEP-файлов | Частично | STEP-007, STEP-016, STEP-021, STEP-022, STEP-023, STEP-024, STEP-026 | Предыдущее evidence действительно только для legacy layout; `STEP-024` восстанавливает совместимость с current control-plane `.harness/**`; `STEP-026` исправляет неполную TextMate-подсветку ссылок во вложенном Markdown. |
| [REQ-004](REQ-004-status-bar.md) | Status Bar с состоянием проекта | Запланировано | STEP-008 | — |
| [REQ-005](REQ-005-manual-handoff.md) | Manual handoff к agent CLI в MVP | Частично | STEP-001, STEP-009, STEP-017, STEP-018, STEP-019, STEP-020, STEP-024 | Предыдущее evidence действительно только для legacy layout; `STEP-024` восстанавливает совместимость с current control-plane `.harness/**`. |
| [REQ-006](REQ-006-localization.md) | Локализация UI (RU/EN) | Частично | STEP-004, STEP-009, STEP-010, STEP-020, STEP-024 | Предыдущее evidence действительно только для legacy layout; `STEP-024` восстанавливает совместимость с current control-plane `.harness/**`. |
| [REQ-007](REQ-007-dependency-graph.md) | Dependency graph visualization (Phase 2, отложено) | Отложено | — | — |
| [REQ-008](REQ-008-health-dashboard.md) | Health Dashboard (Phase 2, отложено) | Отложено | — | — |
| [REQ-009](REQ-009-mutation-policy-warnings.md) | Mutation Policy enforcement warnings (Phase 2, отложено) | Отложено | — | — |
| [REQ-010](REQ-010-keyboard-shortcuts.md) | Keyboard shortcuts (Phase 2, отложено) | Отложено | — | — |
