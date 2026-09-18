<!-- PROJECT:START -->
# AI Development Harness Navigator

VSCode extension, превращающая редактор в IDE-слой над [AI Development Harness](https://github.com/ai-development-harness/ai-development-harness-template): командная палитра для канонических команд протокола, дерево артефактов проекта, smart-редактор STEP-файлов, status bar с состоянием проекта и интеграция с агентом для их выполнения.

Проект инициализирован, product code ещё не написан. Roadmap — 13 STEP (`STEP-001`..`STEP-013`), MVP покрывает 11 из 24 канонических команд протокола (см. `ADR-003`). Ближайший открытый вопрос — механизм вызова агента для выполнения команд (`STEP-001`, `docs/OPEN_QUESTIONS.md` OQ-001).

Следующая рекомендуемая команда: `PLAN STEP-001` (или `PLAN STEP-002` параллельно — обе не имеют зависимостей).

Подробнее: [`docs/PROJECT.md`](docs/PROJECT.md) · [требования](docs/requirements/SPEC.md) · [архитектура](docs/architecture.md) · [roadmap](planning/PLAN.md)
<!-- PROJECT:END -->

## Runtime adapters

Harness protocol не привязан к одной модели или одному coding agent:

- Codex: `.codex/config.toml` + `.codex/agents/*.toml`;
- Claude Code: `CLAUDE.md` + `.claude/settings.json` + `.claude/agents/*.md`.

`AGENTS.md`, execution protocol, REQ/ADR/STEP и `.agents/skills/` остаются общими источниками истины.

## Документация Harness

- [Начало работы](docs/harness/GETTING_STARTED.md)
- [Как устроена документация и связи REQ / ADR / STEP / PLAN / STATUS](docs/harness/DOCUMENT_MODEL.md)
- [Глоссарий терминов Harness](docs/harness/GLOSSARY.md)
- [Структура репозитория](docs/harness/REPOSITORY_LAYOUT.md)
- [Команды](docs/harness/COMMANDS.md)
- [Execution Protocol](planning/EXECUTION_PROTOCOL.md)
- [Обновление Harness в существующем проекте](docs/harness/UPDATES.md)
- [Агенты, модели и reasoning effort](docs/harness/AGENT_CONFIGURATION.md)
- [Claude Code adapter](docs/harness/CLAUDE_CODE.md)
- [Git workflow: COMMIT / PUSH / PR / SYNC](docs/harness/GIT_WORKFLOW.md)
- [CI и Harness Integrity](docs/harness/CI.md)
- [Skills: FIND / INSTALL / CREATE](docs/harness/SKILL_MANAGEMENT.md)
- [Полное оглавление документации Harness](docs/harness/README.md)
