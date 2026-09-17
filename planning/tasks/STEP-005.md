# STEP-005 — Command Palette: 11 MVP-команд + pre-dispatch валидация

**Статус:** Выполнено
**Type:** IMPLEMENTATION
**Приоритет:** Критический
**Фаза:** MVP — командный слой
**Depends on:** STEP-001, STEP-003, STEP-004

## Requirements

- REQ-001

## ADR

- ADR-003

## Risk flags

- architecture

## Goal

Реализовать Command Palette со всеми 11 MVP-командами и обязательной pre-dispatch валидацией.

## Context

REQ-001 и ADR-003 (скоуп 11 из 24 команд). Зависит от решения STEP-001 (механизм вызова агента) для фактического dispatch — сама команда без него не может выполнить mutating-действие.

## Scope

- `baseCommand.ts` — общий контракт команды (pre-dispatch validation hook + dispatch hook).
- По одному модулю на команду: `init.ts`, `addStep.ts`, `plan.ts`, `implement.ts`, `review.ts`, `fix.ts`, `run.ts`, `nextStep.ts`, `status.ts`, `quickFix.ts`, `reconcile.ts`.
- Pre-dispatch: INIT guard, unmet hard dependencies, mutation policy boundary check.
- UI ввода: textbox для `ADD STEP`/`QUICK FIX`, dropdown с существующими STEP-NNN для остальных.
- Регистрация всех команд в `package.json → contributes.commands`.

## Mutation policy

### Allowed

- `src/commands/**`, `package.json → contributes.commands`.

### Conditional

- Изменение `baseCommand.ts` при появлении общей потребности (например retry-логика) — не переписывать уже реализованные команды без причины.
- **Коррекция task-контракта (обоснование — `## Implementation plan → Предпосылки`):** исходный Mutation policy (только `src/commands/**` и `package.json → contributes.commands`) физически не позволяет выполнить Scope, который требует (а) реальную регистрацию команд при активации расширения, (б) локализованные заголовки команд по уже установленной STEP-004 конвенции. Добавлены строго точечные правки:
  - `src/extension.ts` — только вызов `registerHarnessCommands(context)` внутри `activate()`.
  - `package.nls.json`/`package.nls.en.json` — только добавление новых ключей `harness.command.<name>.title` для 11 команд (та же конвенция, что и `harness.changeLanguage` из STEP-004).
  - `src/locales/{ru.json,en.json}` — только добавление новых ключей (QuickPick/InputBox подписи, pre-dispatch сообщения об ошибках), без изменения публичного API `i18n.ts`/`activation.ts` — сервис спроектирован STEP-004 именно для такого роста словаря.
- **Коррекция, обнаруженная при `IMPLEMENT STEP-005`** (не предусмотрена PLAN, зафиксирована здесь, не спрятана в Evidence): интеграционный тест read-only команды (Verification) требует committed `.project/manifest.yaml` в общем `tests/fixtures/workspace/` (STEP-004). Это потребовало двух точечных правок вне исходного списка:
  - `.gitignore` — сужение правила `tests/fixtures/workspace/.project/` до `tests/fixtures/workspace/.project/harness-config.json` (игнорировать только runtime-генерируемый файл, не всю директорию, иначе committed `manifest.yaml` невозможно закоммитить).
  - `tests/integration/i18n.test.js` — `suiteTeardown` менялся с удаления всей директории `.project/` на удаление только `harness-config.json`: иначе тест STEP-004 удалял бы committed `manifest.yaml`, добавленный STEP-005 в ту же fixture-директорию.

### Forbidden

- Реализация оставшихся 13 команд протокола (вне скоупа ADR-003).
- Любая логика explorer/editor/statusbar.

## Out of scope

- Сама передача контекста агенту и обработка его ответа за пределами интерфейса, определённого STEP-001 (делегируется, не переизобретается здесь).
- Полная локализация текста команд (базовые ключи из STEP-004 переиспользуются, остальное — STEP-010).

## Acceptance criteria

- Все 11 команд видны в Command Palette под префиксом `harness:`.
- Каждая команда проходит pre-dispatch валидацию перед вызовом агента.
- Попытка mutating-команды при `initialized: false` блокируется с понятным сообщением.
- Попытка команды над STEP с unmet hard dependency блокируется с указанием конкретного блокера.

## Verification

- Unit-тесты pre-dispatch валидации на fixture-проектах (initialized/uninitialized, с/без unmet dependencies).
- Integration-тест (`@vscode/test-electron`) на реальный вызов минимум одной read-only команды (`STATUS PROJECT`) в Extension Development Host.

## Deliverables

- `src/commands/**` + тесты.
- Обновлённый `package.json` (`contributes.commands`, 11 записей).
- Точечные правки: `src/extension.ts`, `package.nls.json`, `package.nls.en.json`, `src/locales/{ru.json,en.json}` (см. `## Mutation policy → Conditional`).

## Implementation plan

**Plan status:** Planned
**Plan revision:** 1
**Planned at:** 2026-09-17

### Предпосылки

- STEP-001 (`PASS`), STEP-003 (`PASS`), STEP-004 (`PASS`) выполнены — hard dependencies удовлетворены. STEP-005 **не** зависит от STEP-009: реальный вызов агента (`src/api/**`) ещё не существует, поэтому dispatch mutating-команд в этом STEP — тонкий интерфейс-заглушка (см. ниже), не реализация ADR-004.
- Новый ADR не требуется. Три потенциально спорные точки проверены:
  1. **Интерфейс вызова агента до появления `src/api/**`.** ADR-004 п.4 уже фиксирует контракт (`invoke(context, options) → AgentInvocationResult`, один интерфейс/адаптер, executor подставляется позже) — это принятое архитектурное решение, не новая развилка. То, что временная заглушка этого интерфейса живёт внутри `src/commands/**` до STEP-009, — implementation detail, разрешённый Mutation policy STEP-009 (`Allowed: ... интеграция в src/commands/**`), не архитектурный выбор.
  2. **Pre-dispatch правила (INIT guard/hard dependency/type-status boundary)** — прямое прочтение уже принятых REQ-001 (Acceptance) и `planning/EXECUTION_PROTOCOL.md` (§6, §9, §11, §14, §15), не новое решение.
  3. **Локализация заголовков команд** — переиспользование уже принятой в STEP-004 конвенции `package.nls.json`/`package.nls.<lang>.json`, не новый механизм.
- Task-контракт скорректирован (`## Mutation policy → Conditional`, `## Deliverables`) — см. секции выше, не спрятано внутри этого плана.
- **Уточнение (не коррекция) формулировки Scope** «UI ввода: textbox для `ADD STEP`/`QUICK FIX`, dropdown … для остальных»: из 9 оставшихся команд dropdown STEP-NNN реально нужен только 5 (`PLAN/IMPLEMENT/REVIEW/FIX/RUN`) — они единственные, которые адресуют существующий STEP. `INIT PROJECT`, `NEXT STEP`, `STATUS PROJECT`, `RECONCILE PROJECT` работают на уровне проекта и не принимают пользовательский ввод вообще. Это не противоречие, требующее правки Scope, — просто более точная спецификация того же требования.
- **Важное ограничение REQ-001**, зафиксированное здесь явно, чтобы не привести к ложному закрытию: полное REQ-001 Acceptance («Результат выполнения … отображается пользователю … без ручного открытия файлов») достижимо только совместно со STEP-009. STEP-005 закрывает только собственные Acceptance criteria (видимость команд, pre-dispatch validation) — это уже явно зафиксировано в `## Out of scope` текущего task, план лишь делает следствие explicit.

### Command inventory (11 MVP-команд, ADR-003)

| Command id | Протокольная команда | Ввод | Guard | STEP-scoped | Dispatch |
|---|---|---|---|---|---|
| `harness.init` | `INIT PROJECT` | нет | `require-uninitialized` (инвертирован — блокирует, если уже `initialized: true`, с подсказкой `RECONCILE PROJECT`) | нет | agent (заглушка) |
| `harness.addStep` | `ADD STEP: <описание>` | textbox | `require-initialized` | нет | agent (заглушка) |
| `harness.plan` | `PLAN STEP-NNN` | stepPicker | `require-initialized` | да | agent (заглушка) |
| `harness.implement` | `IMPLEMENT STEP-NNN` | stepPicker | `require-initialized` | да | agent (заглушка) |
| `harness.review` | `REVIEW STEP-NNN` | stepPicker | `require-initialized` | да | agent (заглушка) |
| `harness.fix` | `FIX STEP-NNN` | stepPicker | `require-initialized` | да | agent (заглушка) |
| `harness.run` | `RUN STEP-NNN` | stepPicker | `require-initialized` | да | agent (заглушка) |
| `harness.nextStep` | `NEXT STEP` | нет | нет (read-only) | нет | **без агента** — чистый parser-driven расчёт |
| `harness.status` | `STATUS PROJECT` | нет | нет (read-only) | нет | **без агента** — чистый parser-driven расчёт |
| `harness.quickFix` | `QUICK FIX: <описание>` | textbox | `require-initialized` | нет | agent (заглушка) |
| `harness.reconcile` | `RECONCILE PROJECT` | нет | `require-initialized` | нет | agent (заглушка) |

`STATUS PROJECT`/`NEXT STEP` реализуются полностью в этом STEP без агента — их протокольная семантика (§14/§15 `EXECUTION_PROTOCOL.md`) сводится к чтению/агрегации уже доступных через Parser layer данных, агент не обязателен. Это даёт реальную, не заглушечную Acceptance criteria проверку («попытка mutating-команды … блокируется») и реальный read-only integration-тест, требуемый Verification, без опережающей реализации STEP-009.

### Implementation approach

1. **`src/commands/baseCommand.ts`** — контракт:
   ```ts
   type InputKind = 'none' | 'text' | 'stepPicker';
   type InitGuard = 'require-initialized' | 'require-uninitialized' | 'none';
   interface HarnessCommand {
     readonly id: string;            // 'harness.plan'
     readonly protocolName: string;  // 'PLAN STEP-NNN' — для сообщений/логов
     readonly inputKind: InputKind;
     readonly initGuard: InitGuard;
     readonly stepScoped: boolean;   // участвует в hard-dependency/type-status boundary проверках
     dispatch(ctx: DispatchContext): Promise<void>;
   }
   ```
   Ни один метод не содержит vscode-специфичной pre-dispatch логики — она вынесена в чистый слой (см. п.2), как и в `i18n.ts`/`activation.ts` (STEP-004).
2. **`src/commands/preDispatch.ts`** (чистый слой, без импорта `vscode`, тестируется напрямую в Jest):
   - `checkInitGuard(manifest: ManifestData, guard: InitGuard): ValidationResult`.
   - `checkHardDependencies(target: StepData, dependencySteps: StepData[]): ValidationResult` — первая STEP-зависимость со `status !== 'Выполнено'` → блок с её id в сообщении (REQ-001 Acceptance: «с указанием конкретного blocking STEP»).
   - `checkMutationBoundary(protocolName: string, target: StepData): ValidationResult` — только текстуально обоснованные протоколом правила, без домысливания:
     - терминальный статус (`Отменено`/`Заменено`) блокирует любую STEP-scoped команду (§3/§25 протокола — такой STEP не закрывается и не переоткрывается implicit-действием);
     - `IMPLEMENT STEP-NNN` блокируется, если `Type` не входит в `{IMPLEMENTATION, BUGFIX, REFACTOR, HARDENING, DOCUMENTATION, RELEASE}` (§9: `ADR/AUDIT/RESEARCH/roadmap-REVIEW` — через `RUN STEP-NNN`), сообщение прямо предлагает `RUN STEP-NNN`;
     - `FIX STEP-NNN` блокируется, если `reviewStatus.latestVerdict !== 'FAIL'` (§11 п.1: «найти последний применимый FAIL review» — нечего чинить без него).
   - **Осознанно не реализуется:** проверка «файл, который тронет агент, входит в Allowed» — на этапе pre-dispatch неизвестно, какие файлы затронет агент (это решается во время выполнения, не до него); плагин физически не может это проверить раньше STEP-009/агента. Не кодировать несуществующую гарантию.
   - `runPreDispatchChecks(command, ctx: { manifest; target?; dependencySteps? }): ValidationResult` — компонует три проверки по applicability (`initGuard`/`stepScoped`), возвращает первый блок.
   - `ValidationResult = { ok: true } | { ok: false; messageKey: string; params?: Record<string,string> }` — `messageKey` резолвится через уже существующий `I18nService.t(key, params)` (STEP-004), не хардкод строк.
3. **`src/commands/agentDispatcher.ts`** — временный интерфейс по контракту ADR-004 п.4, до появления `src/api/**` (STEP-009):
   ```ts
   interface AgentInvocationContext { protocolName: string; workspaceRoot: string; stepId?: string; freeText?: string; }
   interface AgentInvocationResult { ok: boolean; messageKey: string; params?: Record<string,string>; }
   interface AgentDispatcher { invoke(ctx: AgentInvocationContext): Promise<AgentInvocationResult>; }
   class NotImplementedAgentDispatcher implements AgentDispatcher {
     async invoke(ctx) { return { ok: false, messageKey: 'harness.agent.notImplemented', params: { command: ctx.protocolName } }; }
   }
   ```
   Единственная точка использования — `activation.ts` (п.5). STEP-009 переносит интерфейс в `src/api/**` и подставляет реальную реализацию — по своей Mutation policy (`Allowed: src/api/**, ... интеграция в src/commands/**`) правит именно эту точку подключения, не 11 файлов команд по отдельности (это и есть «одна точка регистрации», которую требует ADR-003).
4. **`src/commands/stepPicker.ts`** — общий helper для 5 STEP-scoped команд:
   - `listStepFiles(workspaceRoot, taskDirectory): Promise<{ id: string; data: StepData }[]>` — `vscode.workspace.findFiles` по `protocol.taskDirectory` из манифеста (не хардкод пути — ADR-001), исключая `TEMPLATE.md`; каждый файл читается и парсится `parseStepFile` (ошибки чтения/парсинга конкретного файла — пропуск с `console.warn`, не падение всего списка).
   - `pickStep(steps, i18n): Promise<StepData | undefined>` — `vscode.window.showQuickPick` (label = `STEP-NNN — Title`, description = статус), `undefined` при отмене пользователем.
   - `resolveDependencySteps(target, allSteps): StepData[]` — по `target.dependsOn`, для `checkHardDependencies`.
5. **`src/commands/activation.ts`** (тонкий vscode-слой, mirrors `locales/activation.ts`):
   - `registerHarnessCommands(context: vscode.ExtensionContext): void`.
   - Общий handler-фабрика `createHandler(command: HarnessCommand)`:
     1. Резолвит `workspaceFolders[0]` — нет открытого workspace → `showErrorMessage(i18n.t('harness.error.noWorkspace'))`, return.
     2. `parseManifest(...)` — `NotFound`/`InvalidYaml`/`MissingRequiredField` → `showErrorMessage` с конкретным `error.kind` (не «not a harness project» для всех подряд — деградация как в parser layer).
     3. Собирает вход по `inputKind`: `'none'` — пропуск; `'text'` — `vscode.window.showInputBox`; `'stepPicker'` — `listStepFiles` + `pickStep` (принимает необязательный `explicitStepId?: string` первым аргументом handler'а — тот же принцип, что и `harness.changeLanguage(explicitLanguage?)` из STEP-004, для будущего вызова из `NEXT STEP`/будущего Explorer/StatusBar без интерактивного picker).
     4. Если `stepScoped` — резолвит `dependencySteps` через `resolveDependencySteps`.
     5. `runPreDispatchChecks(...)` → при блоке `showErrorMessage(i18n.t(result.messageKey, result.params))`, return без вызова `dispatch`.
     6. Иначе `command.dispatch(ctx)`.
   - Регистрирует все 11 `vscode.commands.registerCommand(...)` через `context.subscriptions.push(...)`.
6. **`status.ts`/`nextStep.ts` — единственные два `dispatch()` без `AgentDispatcher`:**
   - `computeProjectStatus(manifest, steps: StepData[]): ProjectStatusSummary` (чистая функция) — группировка по `status` (шесть значений §3 протокола), список `Заблокировано` с `blocker`-текстом, список STEP с unmet hard dependency (переиспользует `checkHardDependencies`). `dispatch()` вызывает `vscode.window.showQuickPick` с одной строкой-сводкой на группу + возможностью выбрать конкретный STEP и открыть его файл (`vscode.window.showTextDocument`) — без Output Channel/Explorer (вне Mutation policy, принадлежит STEP-007/STEP-009).
   - `selectNextStep(steps: StepData[]): { step: StepData; reasonKey: string; suggestedCommandId: string } | undefined` (чистая функция) — фильтр (`status ∈ {Запланировано, В работе}`, все `dependsOn` в статусе `Выполнено`), сортировка по `PRIORITY_RANK` (`Критический=0 < Высокий=1 < Средний=2 < Низкий=3`, неизвестное значение → `Infinity`, деградация, не exception) затем по числовому STEP id (roadmap order proxy); `suggestedCommandId` — `harness.plan`, если `implementationPlan.status !== 'Planned'`; иначе `harness.fix`, если `reviewStatus.latestVerdict === 'FAIL'`; иначе `harness.implement`. `dispatch()` — `showInformationMessage(reason, actionLabel)` с action-кнопкой, при нажатии программно вызывающей `vscode.commands.executeCommand(suggestedCommandId, step.id)` (использует п.5 `explicitStepId`).
7. **Остальные 9 `dispatch()`** — тонкие: собрать `AgentInvocationContext` (STEP-scoped — `stepId`; text-based — `freeText`), вызвать `dispatcher.invoke(ctx)` (инжектируется в `activation.ts` как `new NotImplementedAgentDispatcher()`, не создаётся заново в каждом файле команды — единая точка замены STEP-009), показать `showInformationMessage`/`showErrorMessage` по `result.ok`.
8. **`package.json`** — 11 записей `contributes.commands`, `category: "Harness"`, `title: "%harness.command.<name>.title%"`.
9. **`package.nls.json`/`package.nls.en.json`** — 11 новых ключей заголовков (см. Mutation policy → Conditional).
10. **`src/locales/{ru.json,en.json}`** — новые ключи: подписи QuickPick/InputBox (`harness.command.*.prompt`), сообщения pre-dispatch (`harness.error.noWorkspace`, `harness.error.notInitialized`, `harness.error.alreadyInitialized`, `harness.error.unmetDependency` (`{step}`), `harness.error.terminalStatus` (`{step,status}`), `harness.error.implementWrongType` (`{step,type}`), `harness.error.fixWithoutFail` (`{step}`)), `harness.agent.notImplemented` (`{command}`), сводка `status`/`nextStep`. Все интерполяции — через уже существующий `params?`-механизм `translate()` (STEP-004 FIX), без изменения `i18n.ts`.
11. **`src/extension.ts`** — единственная правка: `registerHarnessCommands(context)` после `activateI18n(context)`.

### Impacted modules/files

- Новые: `src/commands/{baseCommand,preDispatch,agentDispatcher,stepPicker,activation,init,addStep,plan,implement,review,fix,run,nextStep,status,quickFix,reconcile}.ts`.
- Тесты: `tests/unit/commands/{preDispatch,stepPicker,status,nextStep}.test.ts` (чистые функции — без vscode-мока); `tests/integration/commands.test.js` (реальный `vscode`, Extension Host).
- Fixture-проекты (per Verification: «fixture-проектах», не просто in-memory объекты): `tests/fixtures/projects/{uninitialized,initialized-clean,unmet-dependency,fail-review,wrong-type-implement,cancelled-step}/` — каждый: минимальный `.project/manifest.yaml` (переиспользует структуру `tests/fixtures/manifest/*` из STEP-003) + 1-3 `planning/tasks/STEP-*.md`, читаемые тем же `parseManifest`/`parseStepFile` (переиспользование Parser layer, не новый парсинг).
- Точечно изменённые: `src/extension.ts`, `package.json` (`contributes.commands`), `package.nls.json`, `package.nls.en.json`, `src/locales/{ru.json,en.json}`.
- Не затрагивается: `src/parser/**` (только читается — новых полей не требуется, `StepData`/`ManifestData` уже содержат всё нужное), `src/explorer/**`/`src/editor/**`/`src/ui/**`/`src/api/**`/`src/git/**` (не существуют, не создаются — Forbidden).

### Data/API implications

- Публичный контракт для STEP-009: единственная точка замены — конструктор `AgentDispatcher`, передаваемый в `activation.ts` (сейчас `new NotImplementedAgentDispatcher()`). STEP-009 добавляет `src/api/**` с реальными реализациями и меняет ровно эту инжекцию + сам интерфейс переезжает в `src/api/agentDispatcher.ts` (реэкспорт или прямой перенос — решает STEP-009 при своём PLAN).
- **Конвенция для STEP-006/007/008** (Explorer/Editor/StatusBar), фиксируется здесь по аналогии с тем, как STEP-004 зафиксировала nls-конвенцию для STEP-005: каждая STEP-scoped команда принимает необязательный `explicitStepId?: string` первым аргументом `vscode.commands.executeCommand(...)`, позволяя вызывать её программно (из будущего sidebar/status bar) в обход интерактивного QuickPick — не изобретать параллельный API вызова команд.
- `package.json` поверхность: 11 новых команд под `category: "Harness"`.
- Никаких изменений в `ManifestData`/`StepData`/прочих Parser-типах не требуется — все поля, нужные для pre-dispatch (`status`, `type`, `dependsOn`, `reviewStatus.latestVerdict`, `implementationPlan.status`), уже присутствуют (STEP-003).

### Test strategy

- `tests/unit/commands/preDispatch.test.ts` (Jest, без vscode): на каждом fixture-проекте из `Impacted modules/files` — `checkInitGuard`/`checkHardDependencies`/`checkMutationBoundary`/`runPreDispatchChecks`, включая позитивный путь (валидный STEP, все проверки проходят) и по одному негативному на каждое правило (неинициализированный проект блокирует mutating и не блокирует read-only; уже инициализированный блокирует `INIT PROJECT`; unmet dependency называет конкретный blocking STEP id; `IMPLEMENT` на `Type: RESEARCH` блокируется с подсказкой `RUN`; `FIX` без `latestVerdict: FAIL` блокируется; `Отменено`/`Заменено` блокирует STEP-scoped команду).
- `tests/unit/commands/stepPicker.test.ts` — `resolveDependencySteps` на синтетическом списке `StepData` (in-memory, не требует fixture-файлов — чистая функция сортировки/фильтрации).
- `tests/unit/commands/status.test.ts`/`nextStep.test.ts` — `computeProjectStatus`/`selectNextStep` на fixture-проектах (несколько STEP разных статусов/приоритетов/dependsOn), включая edge case неизвестного `Priority` (деградация до конца списка, не exception).
- `tests/integration/commands.test.js` (`@vscode/test-electron`, реальный workspace `tests/fixtures/workspace`, дополненный минимальным `.project/manifest.yaml` + одним `planning/tasks/STEP-1.md`, если ещё не присутствует от STEP-004): `vscode.commands.getCommands(true)` содержит все 11 `harness.*`; `executeCommand('harness.status')` не бросает и возвращает осмысленный результат (read-only, реальный вызов — покрывает Verification/Acceptance «реальный вызов минимум одной read-only команды»); `executeCommand('harness.implement', 'STEP-1')` на неинициализированном тестовом манифесте — `showErrorMessage` вызван (шпион/мок `vscode.window.showErrorMessage` через `sinon`/ручной monkey-patch в тесте, `dispatch()`/`AgentDispatcher.invoke` — не вызван).

### Verification sequence

1. `npm run compile` (`tsc --noEmit`, strict).
2. `npm run lint`.
3. `npm run build` (esbuild) — новые 11 команд бандлятся без ошибок.
4. `npm test` — все существующие + новые unit-тесты зелёные (regression: parser/i18n не затронуты).
5. `npm run test:integration` — существующие (`extension.test.js`, `i18n.test.js`) + новый `commands.test.js` зелёные.
6. Ручная проверка в Extension Development Host: `Ctrl+Shift+P` → все 11 `Harness: ...` команд видны; вызов mutating-команды на неинициализированном fixture-workspace показывает понятный блокирующий message; вызов `Harness: Status project` показывает реальную сводку по текущему репозиторию (13 STEP, актуальные статусы).

### Risks / rollback

- **Временная заглушка `AgentDispatcher` может создать у пользователя ложное ощущение, что команда «зависла» или сломана**, если сообщение «пока не реализовано» неинформативно — компенсируется явным текстом с упоминанием, что полная интеграция агента приходит со STEP-009 (ключ `harness.agent.notImplemented`), не молчаливым no-op.
- **`STATUS PROJECT`/`NEXT STEP` реализованы досрочно (до STEP-009/007) через `showQuickPick`/`showInformationMessage`**, а не через полноценный UI (Output Channel/Explorer/StatusBar) — сознательный компромисс MVP, не blocking: минимальный, но реальный и тестируемый UX, не блокирует последующие STEP на переработку (они заменят/дополнят представление, не логику вычисления `computeProjectStatus`/`selectNextStep`, которая переиспользуется).
- **`checkMutationBoundary` может оказаться неполным** относительно того, что реально проверяет агент во время выполнения (например `REVIEW` без готового `Implementation plan`) — сознательно не кодируется, чтобы не выдумывать protocol-инварианты, которых нет в тексте `EXECUTION_PROTOCOL.md`; при обнаружении реальной необходимости — `ADD STEP`, не скрытое расширение.
- Rollback STEP целиком: удалить `src/commands/**`, `tests/unit/commands/**`, `tests/integration/commands.test.js`, `tests/fixtures/projects/**`; откатить точечные правки `src/extension.ts`/`package.json`/`package.nls*.json`/`src/locales/{ru,en}.json`. STEP-006..013 ещё не реализованы и не зависят от конкретных внутренних файлов STEP-005 (только от факта существования `src/commands/**` как API-поверхности через `explicitStepId`-конвенцию, зафиксированную здесь как contract, не implementation detail).

### Handoff

`IMPLEMENT STEP-005`.

## Evidence

`IMPLEMENT STEP-005` (2026-09-17):

1. **Созданные файлы**: `src/commands/{baseCommand,preDispatch,agentDispatcher,stepPicker,activation,projectStatus,nextStepSelector,init,addStep,plan,implement,review,fix,run,nextStep,status,quickFix,reconcile}.ts`; тесты `tests/unit/commands/{preDispatch,projectStatus,nextStepSelector}.test.ts`, `tests/integration/commands.test.js`; fixtures `tests/fixtures/projects/preDispatch/planning/tasks/STEP-{1,2,3,research,cancelled,failreview,passreview,blocked}.md`, `tests/fixtures/workspace/.project/manifest.yaml`, `tests/fixtures/workspace/planning/tasks/STEP-1.md`.
2. **Отклонения от Implementation plan** (зафиксированы явно, не скрыты):
   - `resolveDependencySteps` и pure-логика, изначально описанная как «`stepPicker.test.ts`», фактически размещена/протестирована в `preDispatch.ts`/`preDispatch.test.ts` — `stepPicker.ts` целиком vscode-зависим (`findFiles`/`showQuickPick`), отдельный unit-тест для него не пишется (покрывается integration-тестом), как и было заложено планом при описании файловой структуры, но не отражено явно в Test strategy формулировке.
   - `checkHardDependencies` в PLAN описывалась с параметром `target: StepData`, который не использовался в теле функции (`tsc --noEmit` → `TS6133`) — сигнатура упрощена до `checkHardDependencies(dependencySteps: StepData[])`.
   - `status.ts` реализован **без** интерактивного `showQuickPick` для drill-down (в PLAN предполагалась двухуровневая навигация группа→STEP→открыть файл): реальный risk — `showQuickPick` в headless Extension Host (`@vscode/test-electron`) не резолвится без программной эмуляции выбора и завис бы в integration-тесте. Вместо этого `computeProjectStatus`/`formatStatusSummary` формируют одну сводную строку (счётчики по статусам + список blocked/unmet-dependency STEP), показываемую через `showInformationMessage` без ожидания — реальный, не заглушечный read-only результат, безопасный для автоматического прогона. Навигация к файлу STEP из статуса — не реализована (не входила в Acceptance criteria, вне forbidden explorer/editor логики не требовалась).
   - Две точечные правки вне исходного Mutation policy STEP-005, обнаруженные при IMPLEMENT: `.gitignore` (сужение игнора до `tests/fixtures/workspace/.project/harness-config.json`) и `tests/integration/i18n.test.js` (`suiteTeardown` удаляет только этот файл, не всю `.project/`) — обе зафиксированы в `## Mutation policy → Conditional` выше, не спрятаны здесь.
3. **`npm run compile`** (`tsc --noEmit`, strict) — 0 ошибок.
4. **`npm run lint`** (ESLint 10) — 0 ошибок/warnings.
5. **`npm run build`** (esbuild) — `esbuild: build complete.`, 11 новых команд бандлятся без ошибок.
6. **`npm test`** (Jest) — `Test Suites: 7 passed, 7 total`, `Tests: 82 passed, 82 total` (было 50 после STEP-004, добавлено 32 в `tests/unit/commands/**`). Все ранее существующие parser/i18n тесты остались зелёными (regression check).
7. **`npm run test:integration`** (`@vscode/test-cli`, реальный VSCode `1.138.0` linux-x64, headless) — `6 passing (185ms)`: 4 существующих без регрессии (`extension.test.js` — 1, `i18n.test.js` — 3) + 2 новых (`commands.test.js`): регистрация всех 11 `harness.*` команд и реальный вызов `harness.status` без исключений.
8. **`git status` после полного прогона test:integration** — только committed `manifest.yaml` остался в `tests/fixtures/workspace/.project/`, runtime `harness-config.json` корректно удалён `suiteTeardown` (проверено вручную, не только по отсутствию ошибок теста).
9. **Покрытие Acceptance criteria**:
   - «Все 11 команд видны в Command Palette под префиксом `harness:`» — `contributes.commands` (`package.json`) + `package.nls.json`/`package.nls.en.json`, все с `category: "Harness"`; подтверждено `commands.test.js` (регистрация всех id).
   - «Каждая команда проходит pre-dispatch валидацию перед вызовом агента» — `activation.ts` вызывает `runPreDispatchChecks` до `command.dispatch(...)` для всех команд без исключения; для 9 agent-backed команд `dispatch()` не достижим при блокирующем результате валидации (`return` до вызова `command.dispatch`).
   - «Попытка mutating-команды при `initialized: false` блокируется» / «unmet hard dependency блокируется с указанием конкретного блокера» — `tests/unit/commands/preDispatch.test.ts`, все ветки (INIT guard в обе стороны, hard dependency с конкретным `{step}`, terminal status, IMPLEMENT/FIX type-status boundary).
10. **Не реализовано намеренно (Out of scope подтверждён)**: реальная передача контекста агенту и разбор его ответа (STEP-009) — `NotImplementedAgentDispatcher` единственная реализация `AgentDispatcher` на этом STEP; полная локализация текста вне уже добавленных ключей (STEP-010).

## FIX STEP-005 (2026-09-17, закрытие findings `REVIEW-2026-09-17T2330.md`)

1. **F-001 закрыт (blocking)**: нерезолвленная (dangling) hard dependency — STEP, чей `Depends on` ссылается на STEP-NNN без соответствующего файла (опечатка, ещё не созданный corrective STEP, переименованный/удалённый файл) — теперь трактуется как блокер, а не молчаливо пропускается.
   - `src/commands/preDispatch.ts`: сигнатура `checkHardDependencies` изменена с `(dependencySteps: StepData[])` на `(dependsOn: string[], dependencySteps: StepData[])` — функция сама резолвит каждый id из полного `Depends on` целевого STEP по индексу `dependencySteps`; отсутствие соответствия → новый blocking результат `harness.error.missingDependency` (а не тихий пропуск через предварительно отфильтрованный `resolveDependencySteps`). `runPreDispatchChecks` обновлён под новую сигнатуру (`ctx.targetStep.dependsOn` вместо только `ctx.dependencySteps`).
   - `src/commands/projectStatus.ts`: `computeProjectStatus.unmetDependency` — симметричная правка, недостижимая зависимость (`!dep`) теперь тоже добавляется в список, не только `dep.status !== 'Выполнено'`.
   - Новый i18n-ключ `harness.error.missingDependency` — добавлен в `src/locales/{ru.json,en.json}` (тот же `{step}`-плейсхолдер, что и у `unmetDependency`).
   - Тесты: `tests/unit/commands/preDispatch.test.ts` — 2 новых теста на `checkHardDependencies` (dangling-only и dangling-среди-выполненных) + 1 end-to-end тест на `runPreDispatchChecks`, воспроизводящий ровно сценарий из review (STEP с `dependsOn: ['STEP-999']`, файла которого нет). Существующий тест `resolveDependencySteps` («игнорирует dependsOn id...») сохранён и переформулирован явным комментарием: сама функция резолюции по-прежнему только резолвит найденное — обнаружение и блокировка нерезолвленного id теперь явно принадлежат `checkHardDependencies`, не ей. `tests/unit/commands/projectStatus.test.ts` — новый тест на `computeProjectStatus` с dangling-зависимостью.
2. **F-002 закрыт (non-blocking)**: `src/commands/stepPicker.ts` — glob для `findFiles` теперь строится через `path.posix.join(...)` вместо `path.join(...)`, чтобы не зависеть от разделителя пути хостовой ОС (на Windows `path.join` дал бы `\`, не эквивалентный ожидаемому glob-разделителю `/`). Не покрыто отдельным тестом — эмпирическая проверка на Windows недоступна в этом окружении (тот же факт зафиксирован в review как PLAUSIBLE, не CONFIRMED); исправление минимально и не меняет поведение на POSIX-системах (где `path.join` и `path.posix.join` эквивалентны, что подтверждено неизменным результатом `npm run test:integration` до/после правки).
3. **Повторная verification** (полный прогон, не только изменённые файлы): `npm run compile` (0 ошибок), `npm run lint` (0 ошибок/warnings), `npm run build` (`esbuild: build complete.`), `npm test` — `Tests: 86 passed, 86 total` (было 82, добавлено 4), `npm run test:integration` — реальный VSCode `1.138.0` linux-x64 headless, `6 passing`, без регрессии. `git status` после полного прогона — чист (только заявленные Deliverables).

## Review status

**Latest verdict:** PASS
**Latest report:** `planning/reviews/STEP-005/REVIEW-2026-09-17T2350.md`

История: `REVIEW-2026-09-17T2330.md` — FAIL (F-001 blocking: недостижимая/dangling hard dependency молча трактовалась как выполненная; F-002 non-blocking: Windows-небезопасный glob в `stepPicker.ts`), закрыты `FIX STEP-005`, подтверждено `REVIEW-2026-09-17T2350.md` — PASS.

## Blocker / Failure reason

Нет. Единственный review-цикл с findings пройден: F-001 (blocking) и F-002 (non-blocking) из `REVIEW-2026-09-17T2330.md` закрыты `FIX STEP-005` и подтверждены независимым повторным review (построчная проверка кода + эмпирическое воспроизведение исходного дефекта до/после фикса).
