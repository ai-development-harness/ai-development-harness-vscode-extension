# Architecture

> Архитектурный baseline создаётся `INIT PROJECT` только на уровне решений, поддержанных brief/requirements или необходимых для начала roadmap. Неопределённости не превращаются в выдуманные факты.

## System context

VSCode extension, работающий над git-репозиторием, структурированным по `ai-development-harness-template`. Читает состояние проекта только из файлов на диске (нет собственной базы данных, нет сетевого backend'а плагина). В MVP команды, которым нужен agent lifecycle, завершаются локальным manual handoff: пользователь сам запускает установленный и авторизованный CLI в контролируемом им terminal. Extension Host не создаёт agent process и не передаёт ему контекст; safe representation text-command определяется ADR-011.

## Основные компоненты / границы

- **Parser layer** (`src/parser/`) — чтение `.project/manifest.yaml`, парсинг STEP/REQ/ADR-файлов (labeled markdown, см. ADR-002), структурный разбор `EXECUTION_PROTOCOL.md`, разбор таблицы `docs/requirements/STATUS.md` (projection-таблица, единственный canonical источник lifecycle-статуса REQ, `STEP-015`) и единый artifact-path resolver/registry по ADR-005. Manifest остаётся primary source; для schema gaps разрешены только зарегистрированные derivations, привязанные к поддерживаемой manifest generation. Остальные компоненты получают готовые workspace-relative paths и не вычисляют layout самостоятельно.
- **Command layer** (`src/commands/`) — регистрация Command Palette команд, pre-dispatch валидация (INIT guard, dependencies, mutation policy) и локальный manual handoff по ADR-010.
- **Agent integration layer** (`src/api/`) — текущая fail-closed адаптерная поверхность manual handoff; automatic invocation не является MVP flow. Historical CLI transport ADR-004 может вернуться только с новым ADR и platform evidence; авторизация CLI остаётся пользовательской по ADR-009.
- **Explorer** (`src/explorer/`) — `TreeDataProvider` поверх Parser layer.
- **Editor providers** (`src/editor/`) — diagnostics, code lens, hover, autocomplete для STEP/REQ/ADR-файлов.
- **Status bar** (`src/ui/statusBar.ts`) — агрегированное состояние поверх Parser layer, с батчингом.
- **i18n service** (`src/locales/`) — независим от остальных компонентов, используется всеми UI-слоями.
- **Git helper** (`src/git/`) — read-only обёртка над `git` через argv для снимка branch и staged/unstaged/untracked изменений в контексте команды.

## Data / state model

Состояние не хранится плагином отдельно — при каждом обращении перечитываются файлы проекта (manifest, STEP/REQ/ADR, PLAN/STATUS). Кэширование (Sidebar Explorer, `src/explorer/treeProvider.ts`, STEP-006 — по группам дерева, с debounce ~250мс) инвалидируется по `vscode.workspace.createFileSystemWatcher` на путях, возвращённых единым resolver: explicit manifest paths либо зарегистрированные derivations ADR-005. Watcher отслеживает любые внешние изменения на диске, включая ручной запуск CLI пользователем; он не является evidence automatic invocation из Extension Host.

## Основные потоки

MVP поток для любой команды, которой нужен agent: пользователь вызывает команду из Command Palette → Command layer выполняет pre-dispatch validation → Extension Host показывает локализованный manual handoff в Output Channel/notification → пользователь при необходимости запускает CLI в контролируемом им terminal. Команда без free text показывает exact canonical command; text-command — safe non-executable descriptor по ADR-011, а исходный intent пользователь повторно вводит сам. Extension не spawn'ит CLI, не передаёт context bundle/stdin и не получает structured result.

Automatic read/write lifecycle, changed-files reload, retry и Ctrl+C-гарантии
для agent process отсутствуют в MVP. Они могут вернуться только после нового
ADR, supported platform matrix и доказанного OS-level containment.

## External dependencies / integrations

- VSCode Extension API (v1.85+).
- Локальный `git` CLI — read-only snapshot для контекста команд.
- Пользовательский agent CLI: Codex или Claude Code может быть запущен только пользователем вне Extension Host. Historical headless transport ADR-004 не является текущей интеграцией.
- Extension не использует внешние сетевые сервисы и не создаёт agent process.

## Security boundaries

Плагин читает/пишет только файлы внутри workspace, попадающие под explicit manifest paths или зарегистрированные derived paths ADR-005, либо под собственный фиксированный путь настроек `.project/harness-config.json` (STEP-004: extension-owned settings, не источник protocol topology). Перед чтением agent context выполняются lexical containment и `realpath`-проверка, поэтому traversal и symlink наружу отклоняются. Derivation использует только константный suffix и manifest anchor; произвольный filesystem probing запрещён. Плагин не выполняет shell: git и agent CLI разрешаются в trusted absolute executable вне workspace и запускаются фиксированным argv. В MVP Extension Host не запускает agent CLI автоматически: ADR-010 требует manual handoff, а ADR-007/ADR-008 сохраняют правило, что context bundle, `cwd` и consent не являются filesystem sandbox или containment. Не отправляет телеметрию и не обращается к внешним сервисам через agent process.

## Reliability / observability

Для manual handoff REQ-005 требует pre-validation и понятную локальную
диагностику без запуска agent process. Retry, auto-reload и cancellation
чужого manual process не являются гарантиями Extension Host; они могут
вернуться только с automatic executor, прошедшим отдельный ADR/evidence gate.

## Deployment / runtime assumptions

VSCode 1.85+, Electron only, Node.js runtime, бандлится через esbuild. Публикация — VSCode Marketplace, `.vsix`.

## Accepted ADR

См. `docs/adr/README.md`.

## Известный architecture debt / drift

`STEP FIX STEP-009` реализовал ADR-008: current mutating commands переходят в
manual fallback до executor resolution/spawn; Git pre-consent hardened, а
external output sanitised. ADR-010 распространил это честное MVP-правило на
весь automatic agent lifecycle: extension не spawn'ит current CLI. Environment
boundary приведена к ADR-009: credential/provider/proxy/certificate variables
не передаются, а пользователь самостоятельно авторизует CLI в terminal.
Automatic executor потребует нового ADR, доказанной platform boundary и
отдельного implementation STEP. ADR-011 согласовал contract safe free-text
representation; STEP-009 ждёт implementation этого документированного handoff.

ADR-005 закрепляет Parser/path-resolution boundary единственным владельцем resolver/registry. Neutral surface `src/parser/artifactPaths.ts` уже реализует allowlisted derivations для `adrDirectory` и `requirementsStatus`; Explorer, watcher и actions получают из неё готовые пути. Для неизвестного поколения manifest resolver возвращает `undefined`: обычный Explorer локально деградирует, а destructive delete guard fail-closed блокирует удаление, пока не сможет проверить все источники входящих ссылок.
