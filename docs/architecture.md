# Architecture

> Архитектурный baseline создаётся `INIT PROJECT` только на уровне решений, поддержанных brief/requirements или необходимых для начала roadmap. Неопределённости не превращаются в выдуманные факты.

## System context

VSCode extension, работающий над git-репозиторием, структурированным по `ai-development-harness-template`. Читает состояние проекта только из файлов на диске (нет собственной базы данных, нет сетевого backend'а плагина). Для выполнения mutating-команд (`PLAN`, `IMPLEMENT`, `REVIEW` и т.д.) делегирует фактическую работу внешнему агенту (Claude Code / Codex) — конкретный механизм вызова не определён, см. `docs/OPEN_QUESTIONS.md` OQ-001 и `STEP-001`.

## Основные компоненты / границы

- **Parser layer** (`src/parser/`) — чтение `.project/manifest.yaml`, парсинг STEP/REQ/ADR-файлов (labeled markdown, см. ADR-002), структурный разбор `EXECUTION_PROTOCOL.md`. Единственный компонент, знающий о путях к файлам (ADR-001) — остальные компоненты получают данные через него, не читают файловую систему напрямую.
- **Command layer** (`src/commands/`) — регистрация Command Palette команд, pre-dispatch валидация (INIT guard, dependencies, mutation policy), делегирование в agent integration layer.
- **Agent integration layer** (`src/api/`) — вызов агента для выполнения команды; механизм не определён (OQ-001).
- **Explorer** (`src/explorer/`) — `TreeDataProvider` поверх Parser layer.
- **Editor providers** (`src/editor/`) — diagnostics, code lens, hover, autocomplete для STEP/REQ/ADR-файлов.
- **Status bar** (`src/ui/statusBar.ts`) — агрегированное состояние поверх Parser layer, с батчингом.
- **i18n service** (`src/locales/`) — независим от остальных компонентов, используется всеми UI-слоями.
- **Git helper** (`src/git/`) — обёртка над `simple-git` для сборки контекста (branch, staged changes) команд.

## Data / state model

Состояние не хранится плагином отдельно — при каждом обращении перечитываются файлы проекта (manifest, STEP/REQ/ADR, PLAN/STATUS). Кэширование (если появится, для производительности explorer/status bar) инвалидируется по `vscode.workspace.onDidChangeTextDocument`/`onDidSaveTextDocument` на релевантных путях.

## Основные потоки

Типичный поток команды: пользователь вызывает команду из Command Palette → Command layer читает контекст через Parser layer → pre-dispatch валидация (INIT guard / dependencies / mutation policy) → при успехе делегирование Agent integration layer → результат (изменённые файлы, next command, ошибки) выводится в Output Channel «Harness» → затронутые файлы и sidebar explorer обновляются → status bar предлагает следующую команду.

## External dependencies / integrations

- VSCode Extension API (v1.85+).
- `simple-git` — git-статус для сборки контекста команд.
- Внешний агент (Claude Code / Codex CLI или SDK) — точный интеграционный контракт не определён, см. OQ-001.
- Нет внешних сетевых сервисов, кроме потенциального вызова агента.

## Security boundaries

Плагин читает/пишет только файлы внутри workspace, попадающие под пути из `.project/manifest.yaml`. Не выполняет произвольный shell помимо git-операций через `simple-git` и вызова агента с фиксированными, не пользовательски-инъецируемыми аргументами. Не отправляет телеметрию, не обращается к внешним сервисам кроме выбранного механизма вызова агента.

## Reliability / observability

Трёхуровневая обработка ошибок (из исходного ТЗ, подтверждена как требование в REQ-005): (1) pre-validation блокирует dispatch до вызова агента; (2) ошибки вызова агента обрабатываются с retry/graceful offline-fallback; (3) runtime-ошибки парсинга/данных не приводят к падению расширения — деградация конкретной фичи с сообщением пользователю.

## Deployment / runtime assumptions

VSCode 1.85+, Electron only, Node.js runtime, бандлится через esbuild. Публикация — VSCode Marketplace, `.vsix`.

## Accepted ADR

См. `docs/adr/README.md`.

## Известный architecture debt / drift

Механизм интеграции с агентом (OQ-001) не выбран — Agent integration layer на момент INIT является заглушкой/интерфейсом без реализации до завершения `STEP-001`.
