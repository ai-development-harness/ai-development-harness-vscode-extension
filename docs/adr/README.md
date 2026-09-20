# Architecture Decision Records

ADR фиксирует **устойчивое архитектурное решение**, его контекст и последствия. ADR не создаётся для каждой задачи.

## Статусы

- `Proposed`
- `Accepted`
- `Rejected`
- `Superseded`
- `Deprecated`

## Правила

1. Accepted ADR считается immutable historical decision record.
2. Если контракт меняется, создай новый ADR и укажи `Supersedes`.
3. Не переписывай прошлую мотивацию задним числом.
4. Если решение ещё не принято, используй `Proposed` или `OPEN_QUESTIONS`, а не выдумывай Accepted ADR.
5. ID не переиспользуется: `ADR-001`, `ADR-002`, ...

## Index

| ADR | Название | Статус |
|---|---|---|
| [ADR-001](ADR-001-manifest-driven-paths.md) | Все пути протокола читаются из `.project/manifest.yaml` | Superseded by ADR-005 |
| [ADR-002](ADR-002-step-file-format.md) | STEP/REQ/ADR-файлы парсятся как labeled markdown, не YAML frontmatter | Accepted |
| [ADR-003](ADR-003-mvp-command-scope.md) | MVP Command Palette ограничена 11 командами из 24 | Accepted |
| [ADR-004](ADR-004-agent-invocation-mechanism.md) | Вызов агента через headless CLI (`codex exec`/`claude -p`, JSON, stdin) | Superseded by ADR-010 для automatic invocation из Extension Host в MVP |
| [ADR-005](ADR-005-artifact-path-resolution.md) | Двухуровневая резолюция путей Harness-артефактов | Superseded by ADR-012 для derivation `requirementsStatus` |
| [ADR-006](ADR-006-agent-write-consent.md) | Явное подтверждение workspace-wide записи для headless agent CLI | Superseded by ADR-008 для automatic write flow |
| [ADR-007](ADR-007-agent-read-boundary.md) | Честная read-boundary для headless agent CLI | Accepted |
| [ADR-008](ADR-008-headless-agent-write-boundary.md) | Безопасная граница write-invocation headless agent CLI | Accepted; supersedes ADR-006 automatic write flow; пункт 4 superseded by ADR-009 |
| [ADR-009](ADR-009-user-managed-agent-cli-authentication.md) | Авторизация agent CLI управляется пользователем | Accepted; supersedes ADR-008 environment contract |
| [ADR-010](ADR-010-manual-agent-handoff-mvp.md) | MVP использует только manual handoff к agent CLI | Accepted; supersedes ADR-004 Decision 1–7 для automatic invocation из Extension Host в MVP |
| [ADR-011](ADR-011-safe-free-text-manual-handoff.md) | Безопасное представление free-text команд в manual handoff MVP | Accepted; supersedes ADR-010 Decision 2 только для visual representation free-text command |
| [ADR-012](ADR-012-requirements-status-directory-anchor.md) | `requirementsStatus` резолвится от `sources.requirements` как от каталога | Accepted; supersedes ADR-005 derivation `requirementsStatus` только для directory-anchor `sources.requirements` |
