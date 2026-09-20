<!-- PROJECT:START -->
# AI Development Harness Navigator

VSCode extension, превращающая редактор в IDE-слой над [AI Development Harness](https://github.com/ai-development-harness/ai-development-harness-template): командная палитра для канонических команд протокола, дерево артефактов проекта, smart-редактор STEP-файлов, status bar с состоянием проекта и интеграция с агентом для их выполнения.

Проект инициализирован, product code ещё не написан. Roadmap — 13 STEP (`STEP-001`..`STEP-013`), MVP покрывает 11 из 24 канонических команд протокола (см. `ADR-003`). Ближайший открытый вопрос — механизм вызова агента для выполнения команд (`STEP-001`, `docs/OPEN_QUESTIONS.md` OQ-001).

Следующая рекомендуемая команда: `STEP PLAN STEP-001` (или `STEP PLAN STEP-002` параллельно — обе не имеют зависимостей).

Подробнее: [`docs/PROJECT.md`](docs/PROJECT.md) · [требования](docs/requirements/SPEC.md) · [архитектура](docs/architecture.md) · [roadmap](planning/PLAN.md)
<!-- PROJECT:END -->

## Runtime adapters

Harness protocol не привязан к одной модели или одному coding agent:

- Codex: `.codex/config.toml` + `.codex/agents/*.toml`;
- Claude Code: `CLAUDE.md` + `.claude/settings.json` + `.claude/agents/*.md`.

`AGENTS.md`, execution protocol, REQ/ADR/STEP и `.agents/skills/` остаются общими источниками истины.

## Документация Harness

- [Начало работы](.harness/docs/GETTING_STARTED.md)
- [Как устроена документация и связи REQ / ADR / STEP / PLAN / STATUS](.harness/docs/DOCUMENT_MODEL.md)
- [Глоссарий терминов Harness](.harness/docs/GLOSSARY.md)
- [Структура репозитория](.harness/docs/REPOSITORY_LAYOUT.md)
- [Команды](.harness/docs/COMMANDS.md)
- [Execution Protocol](.harness/docs/EXECUTION_PROTOCOL.md)
- [Обновление Harness в существующем проекте](.harness/docs/UPDATES.md)
- [Агенты, модели и reasoning effort](.harness/docs/AGENT_CONFIGURATION.md)
- [Claude Code adapter](.harness/docs/CLAUDE_CODE.md)
- [Git workflow: GIT CHECK / GIT COMMIT / GIT PUSH / GIT PR / GIT SYNC](.harness/docs/GIT_WORKFLOW.md)
- [CI и Harness Integrity](.harness/docs/CI.md)
- [Skills: SKILL FIND / SKILL INSTALL / SKILL CREATE](.harness/docs/SKILL_MANAGEMENT.md)
- [Синтаксис команд и цепочек](.harness/docs/COMMAND_SYNTAX.md)
- [Таблица допустимых переходов команд](.harness/docs/COMMAND_TRANSITIONS.md)
- [Полное оглавление документации Harness](.harness/docs/README.md)
