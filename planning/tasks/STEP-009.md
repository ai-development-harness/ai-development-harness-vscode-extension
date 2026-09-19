# STEP-009 — Terminal Integration (финализация)

**Статус:** Выполнено
**Type:** IMPLEMENTATION
**Приоритет:** Критический
**Фаза:** MVP — интеграция
**Depends on:** STEP-001, STEP-005

## Requirements

- REQ-005
- REQ-006

## ADR

- ADR-004
- ADR-006
- ADR-007
- ADR-008
- ADR-009
- ADR-010
- ADR-011

## Risk flags

- external-integration

## Goal

Финализировать безопасный MVP manual handoff: Output Channel и pre-validation
помогают пользователю запустить agent CLI самостоятельно, не создавая
automatic lifecycle в Extension Host.

## Context

REQ-005. STEP-001 определяет механизм вызова агента; этот STEP доводит его до продакшн-реализации, встроенной во все команды STEP-005.

ADR-010 пересмотрел MVP REQ-005 до manual handoff. Historical automatic-lifecycle
plan ниже сохранён для traceability, но superseded и не задаёт текущую реализацию.
Текущий контракт STEP — только manual handoff без context transfer или spawn.

## Required FIX handoff

`STEP FIX STEP-009` реализует ADR-011: exact canonical command допускается
только без free text; text-command показывает локализованный safe descriptor,
не являющийся исполнимой Harness-командой. Добавить unit и Extension Host
regressions RU/EN: оба sink содержат expected descriptor, raw token/CR/LF/
ANSI/control bytes не достигают UI, invalid input даёт localized blocker, а
fake Codex/Claude не запускаются.

## Scope

- Output Channel «Harness» и локализованный manual handoff для любой команды,
  которой нужен agent lifecycle.
- Pre-validation canonical command и Mutation policy до handoff, без context
  builder, executor resolution или `spawn`.
- Safe representation text-command по ADR-011 перед каждым Output Channel/UI
  sink; raw free text не используется как i18n param или diagnostic value.
- Безопасная отмена extension-owned dispatch без управления manual process
  пользователя.

## Mutation policy

### Allowed

- `src/api/**`, `src/git/**`, интеграция в `src/commands/**`.

### Conditional

- Retry-политика (число попыток/backoff) — зафиксировать явно в Verification, не оставлять магическими числами без объяснения.

### Forbidden

- Изменение выбранного в STEP-001 механизма без нового ADR (Superseded).

## Out of scope

- Automatic executor, context bundle/stdin transport, retry, auto-reload,
  structured agent result и cancellation ручного CLI процесса.
- Параллельное выполнение нескольких команд одновременно.

## Acceptance criteria

- Любая command path, которой нужен agent, завершается manual handoff без
  context transfer, executor resolution или `spawn`.
- Output Channel и notification не содержат raw secret-shaped free text,
  CR/LF или ANSI/control bytes из canonical command.
- Для valid text-command оба sink содержат одинаковый локализованный safe
  descriptor; для command без free text — exact canonical command.
- Pre-validation error показывает понятное действие и не запускает CLI.
- Отмена не затрагивает manual process пользователя и не портит состояние
  extension.

## Verification

- Unit regression: classification representation, RU/EN catalog и token-shaped
  free text, CR/LF/ANSI/control bytes не попадают в Output Channel/UI params.
- Extension Host regression: оба sink непусты и содержат localized descriptor;
  fake Codex/Claude не запускаются для valid/invalid agent command path.
- `npm run compile`, `npm run lint`, `npm test -- --runInBand`, `npm run build`,
  `npm run test:integration`, `git diff --check` и
  `python3 tools/harness/validate.py --mode commit`.

## Deliverables

- `src/api/agentDispatcher.ts`, локализованные сообщения и focused unit /
  Extension Host regressions.
- Синхронизированные REQ-005, architecture и planning evidence.

## Implementation plan

**Plan status:** Superseded by ADR-010
**Plan revision:** 1
**Planned at:** 2026-09-19T13:10:14+00:00
**Plan basis:** sha256:b6c1f1a32453afb7b9ee9e5002ec539826e591f59dcefc540da985aa86efbe08

> Historical plan. Он описывает automatic lifecycle, который ADR-010 признал
> небезопасным для MVP; его пункты не должны исполняться или использоваться как
> acceptance criteria. Актуальная revision 2 приведена после исторической записи.

### Основание и границы

- Реализовать только решение `ADR-004`: headless CLI без shell, prompt и
  контекст через stdin, JSON как единственный machine-readable transport.
  `codex exec --json` остаётся primary executor, `claude -p --output-format
  json` — secondary executor; отсутствие обоих бинарей переводит вызов в
  явный manual fallback с понятным сообщением, а не в заглушку или HTTP API.
- Сохранить `src/commands/**` тонким: все существующие команды продолжают
  вызывать общий `AgentDispatcher`; зарегистрированные 11 MVP-команд не
  получают собственных CLI-веток. `STATUS PROJECT` и `NEXT STEP`, которые
  не используют dispatcher, не менять.
- В составе реализации перепроверить живой happy-path и отмену Codex, которые
  не были доказаны в STEP-001 из-за лимита аккаунта. Невозможность выполнить
  эту ручную внешнюю проверку не маскировать unit-тестами.

### Порядок реализации

1. Создать `src/api/` как единственного владельца интеграции: определить
   расширенный контракт контекста и результата (`command`, workspace,
   выбранный STEP/free text, собранные артефакты, изменённые файлы, next
   command, executor и диагностическая причина) и интерфейс executor'а.
   Перенести контракт из `src/commands/agentDispatcher.ts` либо оставить там
   только совместимый re-export, чтобы Command layer зависел от абстракции,
   а не от конкретного CLI.
2. Добавить независимый `src/git/gitHelper.ts`: получить через аргументный
   процесс git branch/status (включая staged/unstaged/untracked), вернуть
   структурированную ошибку вместо throw и не выполнять mutating git-команд.
   Не добавлять `simple-git`: текущий `package.json` её не содержит, а scope
   требует тонкую обёртку именно в `src/git/gitHelper.ts`.
3. Реализовать контекстный сборщик в `src/api/`: читать пути исключительно из
   разобранного manifest/resolver, включать `EXECUTION_PROTOCOL.md`, manifest,
   целевой STEP, его REQ и ADR, а также git snapshot. При unreadable/malformed
   артефакте завершать pre-validation ошибкой до spawn; не сканировать
   произвольные файлы workspace.
4. Реализовать адаптеры Codex и Claude с `child_process.spawn(command, args,
   { cwd, shell: false })`, строго фиксированными argv и stdin для полного
   prompt. Выбирать executor по явной extension-настройке, если она появится
   в минимальном scope, иначе Codex при наличии, затем Claude; проверять
   бинарь без shell. Режим sandbox/permissions вычислять из command/mutation
   policy: read-only/plan для читающих команд, минимальный разрешённый write
   scope для mutation; никогда не использовать dangerous flags. Нормализовать
   JSONL Codex и финальный JSON Claude в один result, а malformed/empty JSON,
   spawn error и non-zero exit — в типизированные agent errors.
5. Ввести один lifecycle invocation в dispatcher: создать Output Channel
   `Harness`, выводить start/context/executor/progress/result и безопасную
   диагностику без секретов/полного prompt. Для transient agent error показать
   локализованное действие Retry и выполнить не более **одной** повторной
   попытки без backoff (итерации CLI дорогие и пользователь уже видит
   предложение); pre-validation не повторять, а runtime parsing/UI errors
   ловить на границе dispatch и деградировать до уведомления без падения
   Extension Host.
6. Подключить реальный dispatcher в `src/commands/activation.ts`, удалив
   `NotImplementedAgentDispatcher`. Дополнить `DispatchContext` только теми
   данными, которые нужны для context builder, и после успешного результата
   показать локализованное summary/next command. Привязать `CancellationToken`
   VSCode к одному активному invocation: отдельная команда `harness.cancel…`
   либо корректно зарегистрированный cancel action должна послать `SIGTERM`,
   дождаться закрытия stdout/stderr и вернуть `cancelled` без попытки разобрать
   partial JSON. Однопоточный guard блокирует второй запуск до финализации
   первого; параллельность не реализовывать.
7. После успешного агента обновить открытые изменённые документы через
   VSCode API только если документ не имеет локальных unsaved changes; иначе
   сообщить о конфликте и не перезатирать буфер. Explorer уже владеет
   `FileSystemWatcher`-инвалидацией, поэтому не дублировать его refresh-логику;
   проверить, что reload не вызывает focus/active-editor смену.
8. Добавить RU и EN строки для Output Channel, отсутствующего executor,
   pre-validation, retry, cancel, conflict reload и runtime recovery. Это
   локализация нового UI STEP-009, а не полная ретроспективная локализация
   STEP-010. Синхронизировать `docs/architecture.md` с реальными модулями и
   снять только реализованный debt после evidence.

### Тесты и verification

- Unit-тесты для context builder (состав/allowlisted paths, missing artifact),
  git helper (успех и ошибка), выбора executor/argv/stdin, нормализации обоих
  JSON-форматов, non-zero/malformed output, one-retry policy и cancel без
  partial result. Мок spawn и VSCode API; реальные CLI в unit-тесты не
  включать.
- Расширить mock `vscode` минимальными Output Channel, editor/document и
  cancellation surfaces; покрыть dispatcher и command activation без
  регрессии регистрации 11 MVP-команд.
- Integration-тест Extension Host на fixture project: Command Palette command
  собирает контекст, передаёт его fake executable, публикует структурированный
  output/result, предлагает next command и перезагружает внешний файл без
  смены активного editor. Отдельно проверить cancel и симулированную
  недоступность executor/agent.
- Перед статусом `Выполнено` выполнить `npm run compile`, `npm run lint`,
  `npm test`, `npm run build`, целевой `npm run test:integration`, затем
  ручные прогоны real Codex happy-path и Ctrl+C/SIGTERM cancellation с
  сохранёнными командами, exit code и наблюдением. При недоступной квоте или
  CLI зафиксировать это как blocker/evidence gap, не заявлять acceptance.

### Совместимость, риски и rollback

- Контракт CLI может измениться: parsers должны быть изолированы по executor,
  сообщения об unknown event/schema version должны быть диагностируемыми.
- Prompt содержит данные репозитория: никаких shell-строк, secret logging или
  unrestricted permissions. Пользовательские пути не выходят за manifest и
  ADR-005 resolver boundary.
- Reload может конфликтовать с dirty editor: безопасная политика — сохранить
  фокус и не трогать несохранённый буфер. Изменения агента остаются на диске и
  явно сообщаются пользователю.
- Rollback — вернуть wiring к `NotImplementedAgentDispatcher` и удалить
  `src/api/**`/`src/git/**` одним обратным изменением; ADR-004 не изменять.
  Смена executor-механизма требует нового ADR с `Supersedes`.

### Актуальная revision 2 — manual handoff MVP

**Plan status:** Ready
**Planned at:** 2026-09-19T18:39:05+00:00

1. Для text-команд отклонить пустой, whitespace-only и control-only input до
   dispatch; строить free-text command по `undefined`, а не truthiness.
2. До Output Channel/UI проверить итоговую команду по bundled CTS graph и
   Mutation policy. Ошибка pre-validation не создаёт handoff и не запускает CLI.
3. Реализовать ADR-011: representation определяется по CTS input metadata;
   `STEP ADD` и `PROJECT QUICK FIX` показывают только command family и
   локализованный неисполняемый placeholder, без echo raw free text.
4. Добавить owning-layer и Extension Host regressions RU/EN для secret-shaped
   input, CR/LF, ANSI, Unicode separators, пустого ввода, обоих UI sink и
   отсутствия spawn; выполнить обязательные quality gates и записать evidence.

## Evidence

Историческое evidence ниже фиксирует последовательные FIX-проходы. Полнота
acceptance criteria и Verification доказана итоговым независимым PASS review
`planning/reviews/STEP-009/REVIEW-2026-09-19T2038Z.md`.

- `npm run compile` — exit code 0; `tsc --noEmit` завершился успешно.
- `npm run lint` — exit code 0; `eslint src` не сообщил ошибок.
- `npm test -- --runInBand` — exit code 0; 25 suites и 217 tests passed. В выводе есть существующие предупреждения `ts-jest` TS151002, без test failures.
- `npm run build` — exit code 0; esbuild сообщил `build complete`.
- `npm run test:integration` — exit code 0; Extension Host запущен с локально
  установленным VS Code 1.138.0, 15 integration-сценариев прошли. Version
  resolver сообщил DNS `EAI_AGAIN` для `update.code.visualstudio.com`, но
  корректно использовал уже установленную версию и на assertions это не
  повлияло.
- Unit-тесты покрывают context builder, Git snapshot, argv/stdin policy и JSON normalizers executor'ов, один user-confirmed retry, cancel без partial result и reload только чистого открытого документа без `showTextDocument`.
- Ручной Codex smoke-test 2026-09-19: `codex exec --json -s read-only -C
  <workspace> --ephemeral` нашёл бинарь (`codex-cli 0.154.0-alpha.6.2`) и
  принял prompt через stdin (`Reading prompt from stdin...`), но не дошёл до
  `turn.completed`: DNS-резолюция `api.openai.com` завершалась `Try again`.
  Поэтому реальный happy-path и Ctrl+C/SIGTERM cancellation не доказаны; они
  обязательны перед закрытием STEP и не заменяются mock-тестами.
- Повторный ручной Codex smoke-test 2026-09-19: `codex exec --json -s
  read-only -C <workspace> --ephemeral` (CLI `0.154.0`) принял нейтральный
  prompt через stdin и завершился JSONL-событиями `thread.started`,
  `turn.started`, `item.completed` и `turn.completed` (exit code 0).
- Ручной smoke-test отмены 2026-09-19: нейтральный read-only вызов Codex в
  `/tmp` с `--skip-git-repo-check` был прерван `timeout --foreground
  --signal=TERM 2s`; до отмены получены `thread.started` и `turn.started`,
  команда завершилась exit code 124 без `turn.completed` и без partial result.
- Повторные проверки реализации 2026-09-19: `npm run compile` (0), `npm run
  lint` (0), `npm test -- --runInBand` (0; 26 suites, 225 tests; существующее
  предупреждение `ts-jest` TS151002), `npm run build` (0) и `npm run
  test:integration` (0; 18 Extension Host scenarios). Первый integration
  запуск в sandbox завершился EROFS при создании runtime socket; повторный
  запуск с доступом к локальному runtime прошёл успешно.

### FIX — 2026-09-19 (по FAIL review `REVIEW-2026-09-19T1349Z.md`, F-001..F-008)

- F-001: `src/api/workspacePaths.ts` запрещает absolute/traversal paths и
  проверяет `realpath` workspace и target; symlink наружу прекращает
  pre-validation. Добавлены regression cases для всех трёх сценариев.
- F-002/F-003: принят ADR-006. `RUN STEP-NNN` и mutation-команды получают
  write-mode только после отдельного явного consent, который показывает
  canonical command и parsed `Mutation policy → Allowed`; read-only режим
  больше не выбирается по ошибочному строковому префиксу.
- F-004: prompt требует exact JSON schema; оба adapter'а нормализуют
  `summary`, `changedFiles`, `nextCommand`, а reload получает только
  валидированные changed paths. Command layer показывает предложенную next
  command.
- F-005: Extension Host tests запускают `PLAN STEP-1` с fake Codex/Claude
  executable: доказывают stdin context, structured result, reload только
  указанного документа без смены active editor, fallback при недоступном Codex
  и cancel уже запущенного процесса через зарегистрированную команду.
- F-006/F-007: unit evidence покрывает stdin transport, оба normalizer'а,
  malformed и non-zero result, отмену до spawn и cancel без partial result;
  invocation использует `AbortController`, завершает process group через
  SIGTERM с bounded SIGKILL escalation и отменяется при `dispose()`. Отдельно
  обработан `EPIPE`, когда CLI закрывает stdin до приёма prompt: Extension Host
  получает typed `spawn` error вместо необработанного исключения.
- F-008: git и executor разрешают trusted absolute executable по PATH и
  отклоняют binary, чей `realpath` расположен внутри workspace.
- Проверки FIX: `npm run compile` (0), `npm test -- --runInBand` (0; 26 suites,
  225 tests; существующие TS151002 warnings), `npm run lint` (0), `npm run
  build` (0), `npm run test:integration` (0; 18 Extension Host scenarios),
  `git diff --check` (0), `python3 tools/harness/validate.py --mode commit`
  (0; PASS). Version resolver снова сообщил DNS `EAI_AGAIN`, но использовал
  установленный VS Code 1.138.0.

### FIX — 2026-09-19 (по FAIL review `REVIEW-2026-09-19T1456Z.md`)

- Команды Command layer приведены к canonical CTS syntax. Write policy больше
  не выводится из legacy regex: STEP mutation требует непустой `Allowed` и
  отдельного consent с фактической командой и путями.
- CLI запускается только по explicit absolute setting; `PATH` не является
  источником доверия. Диагностика ограничена и redact-ится, а read-only
  invocation получает временный allowlisted context bundle вместо workspace.
- `npm run compile`, `npm test -- --runInBand` (26 suites, 226 tests), `npm
  run lint` и `npm run build` завершились с exit code 0. `git diff --check`
  завершился с exit code 0.
- `npm run test:integration` завершился с exit code 1: три прежних сценария
  запускают mutating `PLAN` без ответа на обязательный interactive consent и
  ждут fake CLI до timeout. Это test-seam gap, не замаскированный зелёными
  unit tests; требуется адаптировать Extension Host coverage к ADR-006 до
  следующего review.

### FIX — 2026-09-19 (закрытие Extension Host test-seam ADR-006)

- Fixture `STEP-1` теперь содержит фактический `Mutation policy → Allowed`
  для изменяемого test-файла. Это сохраняет fail-closed поведение production
  dispatcher и не подменяет consent пустой policy.
- Extension Host scenarios подтверждают настоящий consent-toast встроенными
  VS Code-командами до запуска fake executor. Покрыты full cycle fake Codex,
  fallback к fake Claude и `harness.cancelAgent` после реального старта
  процесса; тест cancel запускается до success-сценариев, чтобы старые
  информационные notifications не перехватывали primary action consent.
- Проверки: `npm run compile` (0), `npm run lint` (0), `npm test --
  --runInBand` (0; 26 suites, 226 tests), `npm run build` (0), `npm run
  test:integration` (0; 18 Extension Host scenarios), `git diff --check` (0),
  `python3 tools/harness/validate.py --mode commit` (0; PASS). Первый
  integration-запуск в sandbox ожидаемо завершился `EROFS` при создании
  runtime socket; повторный запуск с доступом к local runtime прошёл.

### FIX — 2026-09-19 (по FAIL review `REVIEW-2026-09-19T1528Z.md`)

- Принят ADR-007: temporary context bundle уменьшает передаваемые данные, но
  не выдаётся за filesystem sandbox; абсолютный путь исходного workspace не
  попадает в prompt.
- Codex JSONL разбирается потоково: progress больше 64 KiB не вытесняет
  terminal result. Claude возвращает typed `too-large`, а result schema
  требует `summary`, `changedFiles` и canonical `nextCommand` либо `null`.
- Workspace/folder configuration не может выбрать executable; configuration
  ограничена machine scope. Git использует platform-specific trusted path.
- Ctrl+C прекращает ожидание consent/retry toast и возвращает `cancelled`;
  Windows использует `taskkill /t /f` для process tree.
- Проверки: `npm run compile` (0), `npm test -- --runInBand` (0; 26 suites,
  230 tests), `npm run lint` (0), `npm run build` (0), `npm run
  test:integration` (0; 18 Extension Host scenarios, после повторного запуска
  с runtime access), `git diff --check` (0), `python3 tools/harness/validate.py
  --mode commit` (0; PASS).

### FIX — 2026-09-19 (по FAIL review `REVIEW-2026-09-19T1548Z.md`, F-001..F-006)

- F-001: `CliExecutor` требует явную capability `readIsolation` до automatic
  read-only запуска. У текущих Codex/Claude CLI такой capability нет, поэтому
  dispatcher возвращает manual fallback до resolution/bundle/spawn; context
  bundle больше не описывается как filesystem sandbox. Unit-regression создаёт
  decoy `.env` вне bundle и доказывает отсутствие child process.
- F-002: Abort listener регистрируется до первого asynchronous pre-spawn шага;
  signal повторно проверяется после resolver, bundle и непосредственно перед
  spawn. Child, созданный одновременно с cancel, сразу получает termination.
  Unit-тесты покрывают cancel в delayed resolution и после реального spawn.
- F-003/F-004: один незавершённый Codex JSONL event и terminal payload
  ограничены 1 MiB с typed `too-large`; потоковые Codex event'ы передаются в
  Output Channel как redacted bounded `[progress]` записи. Для Claude до
  финального JSON доступен lifecycle progress `Claude process started`.
- F-005/F-006: requirements исключается из общего context по exact resolved
  path, что не зависит от Windows separators; fixture подтверждает inclusion
  связанного REQ и исключение соседнего. Добавлены focused contract tests для
  progress, cancellation и read boundary.
- Проверки: `npm run compile` (0); `npm test -- --runInBand
  tests/unit/api/executors.test.ts tests/unit/api/agentDispatcher.test.ts
  tests/unit/api/contextBuilder.test.ts` (0; 3 suites, 22 tests; только
  существующее предупреждение ts-jest TS151002); `npm run lint` (0); `npm test
  -- --runInBand` (0; 26 suites, 234 tests; TS151002); `npm run build` (0);
  `git diff --check` (0); `python3 tools/harness/validate.py --mode commit`
  (0; PASS). `npm run test:integration` сначала завершился 1 в sandbox из-за
  `EROFS` при создании VS Code runtime socket; повторный запуск с доступом к
  local runtime завершился 0: 18 Extension Host scenarios passed.

### FIX — 2026-09-19 (по FAIL review `REVIEW-2026-09-19T1600Z.md`, F-001..F-004)

- F-001: Windows termination строит `taskkill.exe` только как абсолютный путь
  `%SystemRoot%\\System32\\taskkill.exe`; при отсутствии корректного
  `SystemRoot` не выполняется PATH/CWD lookup. Unit-regression проверяет
  формирование trusted path и игнорирование окружающего search path.
- F-002: validation `nextCommand` расширена до полного CTS surface из
  `.project/command-transitions.json`, включая `GIT CHECK`, `PROJECT STATUS`,
  `STEP NEXT` и допустимые Git/STEP/HARNESS chains; неканонический текст
  остаётся malformed. Real Extension Host happy path возвращает `GIT CHECK`,
  проходит parser, reload и завершает command без ошибки.
- F-003: real fake Codex JSONL process отправляет `item.progress`, callback
  получает bounded progress до terminal result. Unit и Extension Host cancel
  создают delayed descendant write; после `harness.cancelAgent` result
  `cancelled` завершается, а marker не появляется, что доказывает termination
  process group и отсутствие post-cancel file mutation.
- F-004: выделен platform-independent seam exact resolved path. Windows-style
  `C:\\...\\SPEC.md` исключается из full context, а `relevantSections` оставляет
  связанный REQ и исключает соседний независимо от separator.
- Проверки: `npm run compile` (0); focused API unit tests (0; 3 suites,
  26 tests; существующее предупреждение ts-jest TS151002); `npm test --
  --runInBand` (0; 26 suites, 239 tests; TS151002); `npm run lint` (0);
  `npm run build` (0); `git diff --check` (0); `python3
  tools/harness/validate.py --mode commit` (0; PASS). `npm run
  test:integration` в sandbox завершился 1 из-за `EROFS` runtime socket,
  повторный запуск с доступом к local runtime завершился 0: 18 scenarios
  passed, включая updated fake JSONL progress/GIT CHECK и process-tree cancel.

### FIX — 2026-09-19 (по FAIL review `REVIEW-2026-09-19T1614Z.md`, F-001..F-007)

- F-001: Git pre-consent snapshot очищает `GIT_CONFIG_*`, выключает optional
  locks и передаёт `-c core.fsmonitor=false`, поэтому repository config не
  может включить fsmonitor executable во время `status`.
- F-002/F-003/F-006: по ADR-008 mutating command останавливается на manual
  fallback до executor resolution и spawn. Current Codex/Claude write-process
  не существует, поэтому Ctrl+C не создаёт ложной process-tree гарантии; future
  containment требует отдельного ADR.
- F-004: `executorEnvironment()` передаёт per-executor allowlist
  auth/provider/proxy/certificate имён и platform home variables, не наследуя
  unrelated secrets.
- F-005: `sanitizeExternalText()` — единая bounded redaction boundary для
  executor progress/error/result, Output Channel и dispatcher UI paths;
  covered Bearer и JSON credential formats.
- F-007: восстановлен repository-owned `sandbox_mode = "workspace-write"` в
  `.codex/config.toml`; out-of-scope ослабление runtime policy исключено.
- Проверки: `npm run compile` (0), `npm run lint` (0), `npm test --
  --runInBand` (0; 26 suites, 242 tests), `npm run build` (0), `npm run
  test:integration` (0; 18 Extension Host scenarios с runtime access),
  `git diff --check` (0), `python3 tools/harness/validate.py --mode commit`
  (0; PASS). Первый integration запуск в sandbox завершился 1 только из-за
  `EROFS` при создании runtime socket; повторный с local runtime прошёл.

### Architecture handoff — ADR-009

ADR-009 supersedes приведённый выше environment contract ADR-008: дальнейший
`STEP FIX STEP-009` не должен расширять или сохранять передачу
credential/provider/proxy/certificate variables. Он обязан привести реализацию
к user-managed authentication: пользователь заранее авторизует CLI в своём
terminal, а extension передаёт только минимальные platform-home/runtime
variables без secret values.

### FIX — 2026-09-19 (по FAIL review `REVIEW-2026-09-19T1708Z.md`, F-001..F-005)

- F-001/F-005: `structuredResult()` отклоняет secret-shaped и control-character
  `changedFiles`/`nextCommand` до Output Channel/UI; `sanitizeExternalText()`
  удаляет ANSI/CRLF/control characters и redacts quoted/standalone credentials.
  Codex публикует progress только для `item.progress`, а terminal
  `item.completed` не проходит через progress sink.
- F-002: проверка next command использует generic structural parser над
  canonical `.project/command-transitions.json`; tests покрывают invalid target
  introduction/change и cross-domain chain.
- F-003: regression создаёт временный repository с executable
  `core.fsmonitor`, вызывает реальный `getGitSnapshot()` и доказывает отсутствие
  marker; wrapper проверяет `-c core.fsmonitor=false` и очищенный `GIT_CONFIG*`
  для обоих Git вызовов.
- F-004: `executorEnvironment()` приведён к ADR-009: child получает только
  non-secret platform-home/runtime variables, без credential/provider/proxy/
  certificate и `GIT_CONFIG*`; no-spawn matrix остаётся для write path.
- Проверки: `npm run compile` (0), `npm run lint` (0), `npm test --
  --runInBand` (0; 26 suites, 247 tests; только существующее предупреждение
  `ts-jest` TS151002), `npm run build` (0), `npm run test:integration` (0;
  18 Extension Host scenarios с runtime access), `git diff --check` (0).
  Первый integration запуск в sandbox завершился 1 из-за `EROFS` при создании
  VS Code runtime socket; повторный запуск с local runtime завершился 0.

### FIX — 2026-09-19 (по FAIL review `REVIEW-2026-09-19T1742Z.md`)

- Исправимая часть F-002 закрыта owning-layer regressions: dispatcher
  отклоняет второй overlapping invocation без второго вызова executor,
  преобразует исключение context builder в runtime recovery и не запускает
  reload после malformed result.
- Reload regressions фиксируют сохранение `activeTextEditor`, отказ
  `WorkspaceEdit` и неудачное сохранение документа. Production security
  boundary и executor capabilities не изменялись.
- F-001 и end-to-end часть F-002 остаются архитектурным blocker: ADR-007
  запрещает automatic read-only invocation current CLI без доказанной
  OS-level isolation, а ADR-008 запрещает automatic write invocation current
  Codex/Claude на поддерживаемых платформах. Добавление test/config bypass
  нарушило бы Accepted ADR и не доказало бы production acceptance.
- Проверки: focused Jest — 14 tests passed; `npm test -- --runInBand` — exit
  code 0, 26 suites и 252 tests passed; `npm run compile`, `npm run lint`,
  `npm run build`, `git diff --check` — exit code 0; `npm run
  test:integration` в sandbox — exit code 1 из-за `EROFS` runtime socket,
  повтор с local runtime access — exit code 0, 18 scenarios passed.

### FIX — 2026-09-19 (ADR-010 и F-003 `STEP-019`)

- Historical automatic-lifecycle contract согласован с REQ-005/ADR-010:
  `HarnessAgentDispatcher` выполняет Mutation policy pre-validation и для
  любой agent-requiring command возвращает manual handoff до context builder,
  executor resolution или `spawn`.
- F-003 закрыт в owning layer: canonical command очищается перед `[start]`,
  Output Channel и i18n notification. Regression покрывает token-shaped free
  text, CR и ANSI escape sequence; raw value не попадает в output/UI params.
- Проверки: focused `tests/unit/api/agentDispatcher.test.ts` — exit code 0,
  3 tests passed; `npm run compile` — 0; `npm run lint` — 0; `npm test --
  --runInBand` — 0, 26 suites/245 tests passed (только existing TS151002
  warning); `npm run build` — 0; `git diff --check` — 0; Harness validation —
  PASS. `npm run test:integration` в sandbox — exit code 1 (`EROFS` runtime
  socket); повтор с local runtime access — exit code 0, 18 scenarios passed,
  включая fake Codex/Claude no-spawn paths.

### FIX — 2026-09-19 (по FAIL review `REVIEW-2026-09-19T1830Z.md`, F-001..F-004)

- F-001: `sanitizeExternalText()` соединяет split credential key до redaction,
  нормализует Unicode `Cc`/`Cf`/`Zl`/`Zp` и повторяет masking после
  нормализации; добавлены Bearer, common token и split-key regressions.
- F-002: text input отклоняет пустое, whitespace-only и control-only значение;
  dispatcher проверяет итоговую command по bundled CTS graph до Output Channel
  и Mutation policy. `undefined`, а не truthiness, определяет наличие input.
- F-003: Extension Host перехватывает фактические Output Channel/UI sinks и
  доказывает для hostile `harness.addStep` отсутствие raw secret, CR/LF,
  ANSI/Unicode control bytes и spawn. Отдельный scenario доказывает
  actionable pre-validation неполной Mutation policy без manual handoff.
- F-004: historical automatic-lifecycle revision 1 помечена superseded by
  ADR-010; добавлена актуальная manual-handoff revision 2.
- Проверки текущего FIX: focused Jest (`executors` + `agentDispatcher`) — 0,
  25 tests passed; `npm run compile` — 0; `npm run build` — 0; `npm run
  test:integration` — 0, 21 Extension Host scenarios после сборки актуального
  bundle. Первый integration запуск в sandbox завершился 1 из-за `EROFS`
  runtime socket; повтор с local runtime access прошёл. Полные `npm run lint`
  (0), `npm test -- --runInBand` (0; 26 suites, 245 tests), `npm run build`
  (0), `git diff --check` (0) и `python3 tools/harness/validate.py --mode
  commit` (0; PASS) выполнены после этого FIX.

### FIX — 2026-09-19 (ADR-011 safe manual handoff)

- Descriptor text-команд строится один раз до Output Channel и notification:
  `STEP ADD` и `PROJECT QUICK FIX` показывают локализованный неисполняемый
  шаблон, а command без free text сохраняет exact canonical representation.
  Original intent не становится i18n parameter и не достигает UI sink.
- `HarnessAgentDispatcher` повторно защищает direct invocation: пустой,
  whitespace-only или control-only text получает локализованный blocker до
  ручного handoff. Это сохраняет ту же fail-closed boundary вне Command Palette.
- Unit regressions проверяют RU/EN descriptor, отсутствие secret/control bytes
  в Output Channel и params, а также direct control-only input. Extension Host
  regression проходит реальный Command Palette path в RU и EN, проверяет оба
  sink и отсутствие fake Codex spawn.
- Проверки: `npm run compile` (0), `npm run lint` (0), `npm test --
  --runInBand` (0; 26 suites, 247 tests; существующее предупреждение
  `ts-jest` TS151002), `npm run build` (0), `npm run test:integration` (0;
  21 Extension Host scenarios с runtime access), `git diff --check` (0),
  `python3 tools/harness/validate.py --mode commit` (0; PASS). Первый
  integration-запуск в sandbox завершился 1 из-за `EROFS` runtime socket;
  повторный запуск с local runtime access прошёл.

### FIX — 2026-09-19 (по FAIL review `REVIEW-2026-09-19T1953Z.md`, F-001)

- Command Palette text-input validation передаёт в `harness.agent.preValidation`
  локализованный `harness.agent.preValidation.invalidCommand`, а не hardcoded
  русский текст; RU и EN получают один и тот же actionable contract со своим
  catalog value.
- Extension Host regression перехватывает реальный `showErrorMessage` и для
  empty, whitespace-only и control-only input требует точный RU/EN blocker,
  пустые Output Channel/warning sinks и отсутствие marker от fake Codex/Claude.
- Проверки: `npm run compile` (0); `npm run lint` (0); `npm run build` (0);
  `npm run test:integration` в sandbox (1, `EROFS` runtime socket), повторный
  запуск с local runtime access (0; 21 Extension Host scenarios passed,
  включая RU/EN invalid-input regression).

### FIX — 2026-09-19 (по FAIL review `REVIEW-2026-09-19T2000Z.md`, F-001)

- Extension Host regressions параметризованы для обеих ADR-011 text-command
  family: `harness.addStep` / `STEP ADD` и `harness.quickFix` / `PROJECT QUICK
  FIX`. В RU и EN hostile valid input проверяет один локализованный safe
  descriptor в Output Channel и notification, отсутствие raw secret/control
  bytes и отсутствие запуска fake Codex/Claude.
- Для обеих family и языков empty, whitespace-only и control-only input
  проверяет точный localized blocker, пустые handoff sinks и отсутствие fake
  Codex/Claude. Focused unit regression параметризует safe descriptor для
  обеих family; Extension Host также подтверждает exact `STEP FIX STEP-009`
  в обоих sink для command без free text.
- Проверки: focused `npm test -- --runInBand tests/unit/api/agentDispatcher.test.ts`
  (0; 1 suite, 8 tests); `npm run compile` (0); `npm run build` (0);
  `npm run test:integration` в sandbox (1, `EROFS` runtime socket), повтор с
  local runtime access (0; 21 Extension Host scenarios); `npm run lint` (0);
  `npm test -- --runInBand` (0; 26 suites, 250 tests); `git diff --check`
  (0); `python3 tools/harness/validate.py --mode commit` (0; PASS).

### FIX — 2026-09-19 (по FAIL review `REVIEW-2026-09-19T2011Z.md`, F-001)

- Valid hostile fixture дополнен нейтральным `ordinary-intent-sentinel`.
  Extension Host regression отдельно требует его отсутствие в каждом Output
  Channel и notification sink для `STEP ADD` и `PROJECT QUICK FIX` в RU/EN,
  сохраняя descriptor, secret/control и fake Codex/Claude no-spawn проверки.
- Owning-layer unit regression добавляет тот же sentinel в обе text-command
  family и запрещает его в manual-handoff UI params и Output Channel; RU/EN
  descriptor test использует fixture с нейтральным original intent.
- Проверки: focused `npm test -- --runInBand tests/unit/api/agentDispatcher.test.ts`
  (0; 1 suite, 8 tests); `npm run compile` (0); `npm run lint` (0); `npm run
  build` (0); `npm run test:integration` в sandbox (1, `EROFS` runtime socket),
  повтор с local runtime access (0; 21 Extension Host scenarios); `git diff
  --check` (0); `npm test -- --runInBand` (0; 26 suites, 250 tests);
  `python3 tools/harness/validate.py --mode commit` (0; PASS).

### FIX — 2026-09-19 (по FAIL review `REVIEW-2026-09-19T2020Z.md`, F-001/F-002)

- Extension Host regression теперь отдельно проводит pure-normal valid intent с
  нейтральным `ordinary-intent-sentinel` без secret/control fragments для
  `STEP ADD` и `PROJECT QUICK FIX` в RU/EN. Для каждого input fixture оба
  sink сравниваются с exact safe representation, sentinel отсутствует, а fake
  Codex/Claude остаются незапущенными; hostile fixture сохранён отдельно.
- Для обеих text-command family notification сравнивается с полной
  локализованной `harness.agent.manualFallback` обёрткой в RU и EN. Exact
  command path `STEP FIX STEP-009` также проверяет оба sink и полный
  localized wrapper в обоих языках. Owning-layer unit regressions добавляют
  отдельный pure-normal path для обеих text-command family.
- Проверки: focused `npm test -- --runInBand tests/unit/api/agentDispatcher.test.ts`
  (0; 1 suite, 10 tests); `npm run test:integration` с local runtime access
  (0; 21 Extension Host scenarios); `npm run compile` (0); `npm run lint`
  (0); `npm test -- --runInBand` (0; 26 suites, 252 tests); `npm run build`
  (0); `git diff --check` (0); `python3 tools/harness/validate.py --mode
  commit` (0; PASS, 309 tracked files).

### FIX — 2026-09-19 (по FAIL review `REVIEW-2026-09-19T2030Z.md`, F-001)

- Каждый valid Extension Host scenario для `STEP ADD` и `PROJECT QUICK FIX`
  теперь сохраняет отдельный snapshot `showErrorMessage` и требует пустой
  error-notification sink для pure-normal и hostile input в RU/EN. Это
  доказывает отсутствие дополнительного diagnostic UI пути рядом с exact
  Output Channel, localized warning и fake Codex/Claude no-spawn checks.
- Exact non-text path `STEP FIX STEP-009` также требует пустой error
  notification для RU/EN.
- Проверки: `npm run test:integration` в sandbox (1; VS Code не смог создать
  runtime socket из-за `EROFS`), повтор с local runtime access (0; 21
  Extension Host scenarios passed); `npm run compile` (0); `npm run lint` (0);
  `npm test -- --runInBand` (0; 26 suites, 252 tests); `npm run build` (0);
  `git diff --check` (0); `python3 tools/harness/validate.py --mode commit`
  (0; PASS).

## Review status

**Latest verdict:** PASS
**Latest report:** `planning/reviews/STEP-009/REVIEW-2026-09-19T2038Z.md`

## Blocker / Failure reason

Нет. `REVIEW-2026-09-19T2038Z.md` подтвердил закрытие последнего finding:
valid text path и exact non-text path требуют пустой `showErrorMessage` sink.
Все предыдущие findings закрыты, полный набор deterministic gates прошёл.
