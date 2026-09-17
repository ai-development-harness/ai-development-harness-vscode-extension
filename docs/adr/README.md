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
| [ADR-001](ADR-001-manifest-driven-paths.md) | Все пути протокола читаются из `.project/manifest.yaml` | Accepted |
| [ADR-002](ADR-002-step-file-format.md) | STEP/REQ/ADR-файлы парсятся как labeled markdown, не YAML frontmatter | Accepted |
| [ADR-003](ADR-003-mvp-command-scope.md) | MVP Command Palette ограничена 11 командами из 24 | Accepted |
