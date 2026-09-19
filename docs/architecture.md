# Architecture

> Архитектурный baseline создаётся `INIT PROJECT` только на уровне решений, поддержанных brief/requirements или необходимых для начала roadmap. Неопределённости не превращаются в выдуманные факты.

## System context

VSCode extension, работающий над git-репозиторием, структурированным по `ai-development-harness-template`. Читает состояние проекта только из файлов на диске (нет собственной базы данных, нет сетевого backend'а плагина). Для выполнения mutating-команд (`PLAN`, `IMPLEMENT`, `REVIEW` и т.д.) делегирует фактическую работу внешнему агенту — первично Codex CLI (единственный runtime, реально сконфигурированный в этом шаблоне через `.codex/`), опционально Claude Code. Механизм вызова — headless CLI с JSON-выводом через stdin, см. `ADR-004`.

## Основные компоненты / границы

- **Parser layer** (`src/parser/`) — чтение `.project/manifest.yaml`, парсинг STEP/REQ/ADR-файлов (labeled markdown, см. ADR-002), структурный разбор `EXECUTION_PROTOCOL.md`, разбор таблицы `docs/requirements/STATUS.md` (projection-таблица, единственный canonical источник lifecycle-статуса REQ, `STEP-015`) и единый artifact-path resolver/registry по ADR-005. Manifest остаётся primary source; для schema gaps разрешены только зарегистрированные derivations, привязанные к поддерживаемой manifest generation. Остальные компоненты получают готовые workspace-relative paths и не вычисляют layout самостоятельно.
- **Command layer** (`src/commands/`) — регистрация Command Palette команд, pre-dispatch валидация (INIT guard, dependencies, mutation policy), делегирование в agent integration layer.
- **Agent integration layer** (`src/api/`) — вызов агента для выполнения команды; тонкий адаптер над двумя headless CLI executor'ами (Codex первично, Claude Code опционально), контракт — `ADR-004`.
- **Explorer** (`src/explorer/`) — `TreeDataProvider` поверх Parser layer.
- **Editor providers** (`src/editor/`) — diagnostics, code lens, hover, autocomplete для STEP/REQ/ADR-файлов.
- **Status bar** (`src/ui/statusBar.ts`) — агрегированное состояние поверх Parser layer, с батчингом.
- **i18n service** (`src/locales/`) — независим от остальных компонентов, используется всеми UI-слоями.
- **Git helper** (`src/git/`) — обёртка над `simple-git` для сборки контекста (branch, staged changes) команд.

## Data / state model

Состояние не хранится плагином отдельно — при каждом обращении перечитываются файлы проекта (manifest, STEP/REQ/ADR, PLAN/STATUS). Кэширование (Sidebar Explorer, `src/explorer/treeProvider.ts`, STEP-006 — по группам дерева, с debounce ~250мс) инвалидируется по `vscode.workspace.createFileSystemWatcher` на путях, возвращённых единым resolver: explicit manifest paths либо зарегистрированные derivations ADR-005. Используется watcher, а не `onDidChangeTextDocument`/`onDidSaveTextDocument`: внешний агент (ADR-004) пишет файлы headless CLI мимо редактора, и события изменения/сохранения открытого документа такие правки не видят.

## Основные потоки

Типичный поток команды: пользователь вызывает команду из Command Palette → Command layer читает контекст через Parser layer → pre-dispatch валидация (INIT guard / dependencies / mutation policy) → при успехе делегирование Agent integration layer → результат (изменённые файлы, next command, ошибки) выводится в Output Channel «Harness» → затронутые файлы и sidebar explorer обновляются → status bar предлагает следующую команду.

## External dependencies / integrations

- VSCode Extension API (v1.85+).
- `simple-git` — git-статус для сборки контекста команд.
- Внешний агент, первично Codex CLI (SDK/headless-режим — уточняется STEP-001), опционально Claude Code — точный интеграционный контракт не определён, см. OQ-001.
- Нет внешних сетевых сервисов, кроме потенциального вызова агента.

## Security boundaries

Плагин читает/пишет только файлы внутри workspace, попадающие под explicit manifest paths или зарегистрированные derived paths ADR-005, либо под собственный фиксированный путь настроек `.project/harness-config.json` (STEP-004: extension-owned settings, не источник protocol topology). Derivation использует только константный suffix и manifest anchor; произвольный filesystem probing запрещён. Плагин не выполняет произвольный shell помимо git-операций через `simple-git` и вызова агента с фиксированными, не пользовательски-инъецируемыми аргументами. Не отправляет телеметрию, не обращается к внешним сервисам кроме выбранного механизма вызова агента.

## Reliability / observability

Трёхуровневая обработка ошибок (из исходного ТЗ, подтверждена как требование в REQ-005): (1) pre-validation блокирует dispatch до вызова агента; (2) ошибки вызова агента обрабатываются с retry/graceful offline-fallback; (3) runtime-ошибки парсинга/данных не приводят к падению расширения — деградация конкретной фичи с сообщением пользователю.

## Deployment / runtime assumptions

VSCode 1.85+, Electron only, Node.js runtime, бандлится через esbuild. Публикация — VSCode Marketplace, `.vsix`.

## Accepted ADR

См. `docs/adr/README.md`.

## Известный architecture debt / drift

Механизм интеграции с агентом выбран и подтверждён живым вызовом (`ADR-004`), но happy-path для Codex CLI (первичный executor) эмпирически не подтверждён — только error-path (реальная квота аккаунта была исчерпана во время STEP-001). Agent integration layer (`src/api/`) ещё не реализован (реализация — `STEP-009`); переподтвердить Codex happy-path перед/во время неё.

ADR-005 закрепляет Parser/path-resolution boundary единственным владельцем resolver/registry. Neutral surface `src/parser/artifactPaths.ts` уже реализует allowlisted derivations для `adrDirectory` и `requirementsStatus`; Explorer, watcher и actions получают из неё готовые пути. Для неизвестного поколения manifest resolver возвращает `undefined`: обычный Explorer локально деградирует, а destructive delete guard fail-closed блокирует удаление, пока не сможет проверить все источники входящих ссылок.
