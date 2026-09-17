# STEP-002 — Project scaffolding и инструментарий

**Статус:** Запланировано
**Type:** IMPLEMENTATION
**Приоритет:** Критический
**Фаза:** MVP — фундамент
**Depends on:** —

## Requirements

- не требуется для purely technical corrective task

## ADR

- не требуется

## Risk flags

- none

## Goal

Создать рабочий скелет VSCode extension проекта с инструментарием, достаточным для последующей разработки и тестирования.

## Context

Репозиторий после `INIT PROJECT` содержит только Harness protocol layer — никакого product code/tooling ещё нет.

## Scope

- `package.json` (name, VSCode engine `^1.85.0`, activation events, `contributes` skeleton).
- `tsconfig.json` в strict mode.
- ESLint config.
- esbuild bundling script.
- `.vscode/launch.json` для Extension Development Host.
- Jest конфигурация для unit-тестов.
- `@vscode/test-electron` скелет для integration-тестов (без содержательных тестов пока).
- Минимальный project-specific CI workflow (install+lint+build), отдельно от `.github/workflows/harness-integrity.yml`.

## Mutation policy

### Allowed

- Создание нового tooling/config в корне и `src/`.

### Conditional

- Изменение `.gitignore` при появлении build artifacts (`dist/`, `out/`) — уже частично покрыто скопированным файлом, требуется проверка достаточности.

### Forbidden

- Product-логика команд/explorer/editor (реализуется последующими STEP).

## Out of scope

- Реализация любой функциональности (parser, commands, explorer и т.д.) — только скелет и инструментарий.

## Acceptance criteria

- `npm install` и сборка проходят без ошибок на чистом клоне.
- Extension Development Host запускается (F5) без ошибок активации.
- Тестовый раннер запускается без ошибок конфигурации (даже с нулевым числом содержательных тестов).
- Линтер запускается без конфигурационных ошибок.

## Verification

- `npm install`
- `npm run build`
- `npm test`
- `npm run lint`

(Точные имена npm-скриптов фиксируются при реализации и переносятся в `docs/development.md` — не хардкодить здесь заранее выдуманные названия сверх типовых.)

## Deliverables

- `package.json`, `tsconfig.json`, `.eslintrc`, esbuild-скрипт, `.vscode/launch.json`, Jest config, CI workflow.
- Обновлённый `docs/development.md` (реальные команды вместо TBD).

## Implementation plan

**Plan status:** Not planned
**Plan revision:** —
**Planned at:** —

Заполняется командой `PLAN STEP-002`.

## Evidence

Заполняется по факту реализации и verification.

## Review status

**Latest verdict:** NOT REVIEWED
**Latest report:** —

## Blocker / Failure reason

—
