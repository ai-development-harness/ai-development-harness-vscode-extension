# STEP-006 — Sidebar Explorer

**Статус:** Выполнено
**Type:** IMPLEMENTATION
**Приоритет:** Высокий
**Фаза:** MVP — UI
**Depends on:** STEP-003

## Requirements

- REQ-002

## ADR

- не требуется для реализации STEP-006.
- Зафиксирован ADR need (не блокирующий): `OQ-004` — правило резолюции путей, не объявленных в `.project/manifest.yaml` (каталог ADR). Решение изолировано в `src/explorer/paths.ts`; устойчивое правило оформляется отдельным ADR-005 (вероятно вместе со STEP-007, где от него зависит autocomplete по `ADR-NNN`).

## Risk flags

- none

## Goal

Реализовать Sidebar Explorer — дерево артефактов проекта с фильтрами, статус-иконками и context-menu.

## Context

REQ-002. Строится поверх Parser layer (STEP-003), путь и статус-модель берутся из манифеста/протокола, а не хардкодятся.

## Scope

- `treeProvider.ts` (VSCode `TreeDataProvider`) поверх Parser layer.
- `treeItem.ts`.
- Иконки по всем реальным статусам протокола — 6 значений (`Запланировано/В работе/Выполнено/Заблокировано/Отменено/Заменено`); набор читается из `planning/EXECUTION_PROTOCOL.md` §3 через `parseExecutionProtocol`, не хардкодится. Коррекция `PLAN STEP-006` (2026-09-18): исходная формулировка «5 статусов» противоречила §3 протокола и STEP-005 (`preDispatch.ts` уже трактует `Заменено` как терминальный статус) — STEP с `Заменено` остался бы без иконки.
- Фильтры (Status/Type/Priority/Risk flags) и поиск по ID, комбинируемые.
- Lazy loading по группам (Requirements/Architecture/Tasks/...).
- Context-menu: Create/Edit/Delete/Mark as done/Flag as blocker/Create follow-up STEP/View in Explorer.
- `refresh.ts` — обновление по file watcher на релевантные пути из манифеста.

## Mutation policy

### Allowed

- `src/explorer/**`.

### Conditional

- Действия context-menu, мутирующие файлы (mark as done, flag as blocker) — реализовать как явную запись через parser-слой, не скрытые side effects.
- Точечные правки вне `src/explorer/**`, без которых VSCode-фича физически не существует (добавлено `PLAN STEP-006` 2026-09-18, по аналогии с тем, как STEP-005 фиксировала свой `package.json`/nls surface):
  - `package.json` — `contributes.viewsContainers`, `contributes.views`, `contributes.menus`, `contributes.viewsWelcome` и новые `contributes.commands` для explorer-действий;
  - `package.nls.json`, `package.nls.en.json` — заголовки новых команд;
  - `src/locales/{ru.json,en.json}` — новые ключи user-facing строк (ярлыки групп, подтверждения, ошибки guard'ов);
  - `src/extension.ts` — одна строка регистрации explorer'а;
  - `resources/**` — единственная SVG-иконка для Activity Bar container;
  - `tests/**` — unit/integration тесты и fixtures.
- `Mark as done` и `Delete` реализуются как guarded-действия (см. `## Implementation plan`): статус `Выполнено` из UI недопустим в обход §3 протокола/`AGENTS.md` §8/§11, удаление отреференсенного артефакта недопустимо в обход стабильности ID (§1 протокола).

### Forbidden

- Собственная логика pre-dispatch валидации (переиспользовать из STEP-005, не дублировать).

## Out of scope

- Drag-drop переупорядочивание (было в исходном ТЗ, но требует отдельного решения о семантике; не критично для MVP — фиксируется отдельным REQ/STEP при запросе).

## Acceptance criteria

- Дерево строится по путям из манифеста.
- Статус-иконки покрывают весь enum статусов из `planning/EXECUTION_PROTOCOL.md` §3 (6 значений), неизвестное значение деградирует до нейтральной иконки, а не ломает дерево.
- Комбинация фильтров и поиска работает одновременно.
- Explorer загружается за <500ms на fixture-проекте с 50 артефактами.
- Click открывает файл, right-click показывает меню.

## Verification

- Unit-тесты `treeProvider` на fixture-дереве.
- Перф-тест на синтетическом проекте с 50 STEP.
- Ручная проверка в Extension Development Host.

## Deliverables

- `src/explorer/**` + тесты.
- Fixture-проект с 50 STEP для перф-теста.

## Implementation plan

**Plan status:** Planned
**Plan revision:** 1
**Planned at:** 2026-09-18

### Предпосылки

- Hard dependency **STEP-003 — `Выполнено`** (проверено по task-файлу, не только по `PLAN.md`). Parser layer реально предоставляет всё нужное: `parseManifest`, `parseStepFile`, `parseReqSpec`, `parseAdrFile`, `parseExecutionProtocol`, а также низкоуровневые примитивы labeled-markdown (`splitSections`, `findSectionIndex`, `extractBoldLabels`, `extractBulletItems`, `extractIds`). Blocker'ов нет.
- STEP-006 **не** зависит от STEP-005, но переиспользует уже принятые им конвенции: `ValidationResult`/`checkInitGuard` (`src/commands/preDispatch.ts`), `listStepFiles` (`src/commands/stepPicker.ts`), конвенцию «STEP-scoped команда принимает необязательный `explicitStepId` первым аргументом `executeCommand`» и разделение «чистый слой без `vscode`» ↔ «тонкий `activation.ts`».
- **Новый ADR для самого STEP-006 не требуется.** Проверены четыре потенциально спорные точки:
  1. *Регистрация `TreeDataProvider` и структура групп* — прямое применение `docs/architecture.md` («Explorer (`src/explorer/`) — `TreeDataProvider` поверх Parser layer») и ADR-001; развилки нет.
  2. *Watch/refresh strategy* — `FileSystemWatcher` вместо `onDidSaveTextDocument`: не архитектурная развилка, а единственный работающий вариант (агент по ADR-004 пишет файлы headless CLI мимо редактора, `onDidSaveTextDocument` такие изменения не видит). Это **расхождение с текущим текстом** `docs/architecture.md` → «Data / state model» синхронизируется при `IMPLEMENT` (§10 AGENTS.md), а не переписывается ADR.
  3. *Резолюция каталога ADR* — **реальный контрактный пробел**, зафиксирован отдельно как `OQ-004` и в секции `## ADR` выше; STEP-006 им не блокируется (см. п. «Группы дерева»).
  4. *Запись в STEP-файлы из context-menu* — устойчивое решение уже задано ADR-002 (labeled markdown как канонический формат); STEP-006 добавляет только minimal-diff writer поверх уже существующих примитивов парсера, не новый формат.
- Контрактные коррекции, вскрытые планом, вынесены **наружу** (не спрятаны здесь): `## Scope`/`## Acceptance criteria`/`## Mutation policy`/`## ADR` этого файла, `REQ-002` в `docs/requirements/SPEC.md`, новый `OQ-004` в `docs/OPEN_QUESTIONS.md`.

### Implementation approach

Тот же двухслойный приём, что в STEP-004/STEP-005: вся логика — в чистых модулях без импорта `vscode` (прямо тестируются в Jest), весь VSCode API — в тонком `activation.ts`/`treeItem.ts`/`refresh.ts`.

**1. `src/explorer/paths.ts` (чистый).** `resolveArtifactSources(manifest): ArtifactSource[]` — единственное место, где путь превращается в узел дерева. Все пути берутся из `ManifestData` (ADR-001); `.project/manifest.yaml` — единственный фиксированный self-path (тот же приём уже применён в `src/commands/activation.ts`). Каталог ADR не объявлен в манифесте (`OQ-004`) → деривация `dirname(manifest.sources.architecture) + '/adr'` с проверкой существования: каталога нет → группа `Architecture` показывает только `architecture.md`, без ошибки и без выдуманных узлов. Функция помечена комментарием со ссылкой на `OQ-004`, чтобы будущий ADR-005 менял ровно одну строку.

**2. `src/explorer/model.ts` (чистый).** Дискриминированное объединение узлов:
```ts
type HarnessNode =
  | { kind: 'group'; id: GroupId; sources: ArtifactSource[] }
  | { kind: 'file'; uri: string; label: string; groupId: GroupId }
  | { kind: 'step'; uri: string; data: StepData }
  | { kind: 'req'; uri: string; data: ReqData }
  | { kind: 'adr'; uri: string; data: AdrData }
  | { kind: 'message'; messageKey: string };   // «нет артефактов» / «не удалось прочитать»
```
`'message'` — явная деградация вместо пустого/исчезающего узла (Reliability §3 `docs/architecture.md`).

**3. Порт чтения файловой системы — ключ к тестируемости и к перф-тесту.**
```ts
interface ArtifactReader {
  list(dir: string, glob: string): Promise<string[]>;
  read(fsPath: string): Promise<string>;
  exists(fsPath: string): Promise<boolean>;
}
```
Production-реализация (`src/explorer/vscodeReader.ts`) — поверх `vscode.workspace.findFiles`/`RelativePattern` с POSIX-glob (учтён `FIX STEP-005 F-002`: только `path.posix.join`, иначе Windows-глоб ломается). Тестовая реализация — поверх `node:fs/promises`. Благодаря порту `treeProvider`-логика и перф-тест выполняются в Jest без мока `vscode`.

**4. `src/explorer/statusIcon.ts` (чистый).** `statusPresentation(status): { icon: string; color?: string }` — codicon-идентификаторы, без файловых ассетов: `Запланировано → circle-outline`, `В работе → sync`, `Выполнено → pass-filled/charts.green`, `Заблокировано → error/charts.red`, `Отменено → circle-slash/disabledForeground`, `Заменено → arrow-right/charts.purple`, неизвестное значение → `question` (деградация, не исключение). Ключи карты покрывают ровно `parseExecutionProtocol(...).stepStatuses` — это проверяется тестом (см. Test strategy), поэтому drift протокола ловится автоматически.

**5. `src/explorer/filter.ts` (чистый).** `FilterState { statuses: string[]; types: string[]; priorities: string[]; riskFlags: string[]; query: string }`; `applyFilters(steps, state)` — **AND между измерениями, OR внутри измерения**, пустой массив = «не фильтровать». `query` — регистронезависимый подстрочный матч по ID (REQ-002: «поиск по ID»), применяется ко всем ID-несущим узлам (`step`/`req`/`adr`); Status/Type/Priority/Risk flags — поля STEP, поэтому применяются только к группе `Tasks` (у REQ собственный, несовместимый набор статусов — `Частично`/`Отложено`; смешивать их в один фильтр было бы выдумыванием контракта). Источники значений: статусы/типы/risk flags — из `parseExecutionProtocol`; **приоритеты протоколом не перечислены** → список строится из фактически встреченных значений STEP-файлов (не хардкодить `Критический/Высокий/Средний/Низкий`).

**6. `src/explorer/stepWriter.ts` (чистый).** Минимально-диффовая запись в labeled markdown поверх примитивов `markdownParser`: `setStatus(content, status)` заменяет только строку `**Статус:** …`; `setBlocker(content, text)` заменяет только тело секции `## Blocker / Failure reason`. Контракт fail-closed: если целевая метка/секция не найдена — возвращается ошибка (`Result`), файл не трогается; после записи содержимое **перечитывается и переразбирается**, и действие считается успешным только если изменилось ровно ожидаемое поле. `src/parser/**` при этом не меняется (вне Allowed) — используется только его публичное API.

**7. `src/explorer/guards.ts` (чистый).** Переиспользует `ValidationResult` и `checkInitGuard` из `src/commands/preDispatch.ts` (Mutation policy → Forbidden: «не дублировать pre-dispatch валидацию»), добавляя только специфичные для мутирующих действий дерева проверки:
- `canMarkDone(step)` — `Выполнено` разрешено **только** при `reviewStatus.latestVerdict === 'PASS'` и непустом `evidence`. Иначе блок с объяснением и предложением `REVIEW STEP-NNN`. Это прямое следствие §3 протокола и `AGENTS.md` §8/§11: однокликовое «Mark as done» в обход review было бы обходом deterministic gate — самый опасный сценарий этого STEP.
- `canFlagBlocker(step)` — запрещено для терминальных статусов (`Отменено`/`Заменено`), требует непустого текста причины.
- `canDelete(node, allSteps, allReqs)` — удаление запрещено, если на артефакт есть входящие ссылки (`Depends on` других STEP, traceability REQ/ADR): блок с перечислением ссылающихся ID и предложением `Отменить STEP` вместо удаления. Основание — §1 протокола: ID стабилен и не переиспользуется; тихое удаление порождает ровно тот класс dangling-ссылок, который закрывался `FIX STEP-005 (F-001)`.

**8. `src/explorer/treeItem.ts` (vscode).** `toTreeItem(node, i18n)` → `vscode.TreeItem`: label/description/tooltip, `iconPath` из `statusPresentation` (`new vscode.ThemeIcon(icon, color && new vscode.ThemeColor(color))`), `command: vscode.open` для файловых узлов (REQ-002: «клик по узлу открывает файл»), `collapsibleState` по виду узла. `contextValue` кодирует **возможности**, а не только тип: `harness.step`, `harness.step.canMarkDone`, `harness.step.terminal`, `harness.req`, `harness.adr`, `harness.file` — `when`-условия меню используют их как UX-подсказку, но реальное решение всё равно принимают guard'ы из п.7 (defense in depth).

**9. `src/explorer/treeProvider.ts` (vscode-тонкий).** `HarnessTreeDataProvider implements vscode.TreeDataProvider<HarnessNode>`:
- `getChildren(undefined)` → 8 групп REQ-002 (`Project Configuration`, `Requirements`, `Architecture`, `Tasks`, `Roadmap`, `Status`, `Reviews`, `Skills`) **без единого чтения файлов** — только из уже разобранного при активации манифеста (это и есть lazy loading);
- `getChildren(group)` → содержимое считается по требованию и кладётся в `Map<GroupId, Promise<HarnessNode[]>>`; повторное раскрытие — из кэша;
- `Tasks` использует `ArtifactReader.list` + параллельный `Promise.all(read → parseStepFile)`; нечитаемый/неразбираемый файл пропускается с `console.warn` (та же деградация, что в `listStepFiles`), но общее число пропусков отражается узлом `'message'`, чтобы молчаливая потеря артефактов была видна;
- `invalidate(groupId?)` — сброс кэша и `_onDidChangeTreeData.fire(groupNode)` точечно (не всего дерева), чтобы не схлопывать раскрытые узлы.

**10. `src/explorer/refresh.ts` (vscode).** `createWatchers(workspaceRoot, manifest, onInvalidate)` — по одному `createFileSystemWatcher` на каждый **объявленный в манифесте** путь (taskDirectory, requirements, architecture + ADR-каталог, roadmap, status, reviewDirectory, skillRegistry, skillSearchDirectory) плюс сам `.project/manifest.yaml`. Изменение манифеста инвалидирует дерево целиком (пути могли измениться) и заново парсит манифест; остальные — только свою группу. Debounce 250 мс на группу: агент (ADR-004) пишет пачками, без батчинга получим шторм refresh'ей. Все watcher'ы уходят в `context.subscriptions`.

**11. `src/explorer/activation.ts` (vscode).** `registerHarnessExplorer(context)`: парсит манифест (те же ветки ошибок и i18n-ключи, что в `src/commands/activation.ts` — `manifestErrorKey`/`manifestErrorParams` переиспользуются, не копируются), выставляет context key `harness.isHarnessProject`, создаёт провайдер через `vscode.window.createTreeView('harness.artifacts', { treeDataProvider, showCollapseAll: true })`, вешает watcher'ы и регистрирует команды:
`harness.explorer.refresh`, `harness.explorer.filterByStatus`, `harness.explorer.filterByType`, `harness.explorer.filterByPriority`, `harness.explorer.filterByRiskFlag`, `harness.explorer.search`, `harness.explorer.clearFilters`, `harness.explorer.openFile`, `harness.explorer.revealInOsExplorer`, `harness.explorer.markDone`, `harness.explorer.flagBlocker`, `harness.explorer.createFollowUpStep`, `harness.explorer.delete`.
**Каждая** из них принимает необязательный явный аргумент (список значений фильтра / id узла) — по конвенции STEP-005; без аргумента открывает QuickPick/InputBox. Это не украшение: в headless Extension Host `showQuickPick` не резолвится и повесил бы integration-тест (зафиксировано в Evidence STEP-005), поэтому тесты вызывают команды с явным аргументом.
Активные фильтры отражаются в `treeView.description` и context key `harness.explorer.hasFilters` (показывает кнопку «сбросить фильтры» в `view/title`).

**12. Context-menu — маппинг на уже существующие команды, без дублирования.**
| Пункт меню | Реализация |
|---|---|
| Create | `executeCommand('harness.addStep')` (STEP-005, agent-backed) |
| Create follow-up STEP | `executeCommand('harness.addStep', '<предзаполненный текст со ссылкой на исходный STEP>')` |
| Edit | `vscode.window.showTextDocument(uri)` — smart-редактирование принадлежит STEP-007 |
| View in Explorer | `executeCommand('revealInExplorer', uri)` |
| Mark as done | `guards.canMarkDone` → modal-подтверждение → `stepWriter.setStatus` |
| Flag as blocker | `guards.canFlagBlocker` → InputBox с причиной → `stepWriter.setStatus('Заблокировано')` + `setBlocker` |
| Delete | `guards.canDelete` → modal-подтверждение → `workspace.fs.delete({ useTrash: true })` |

**13. `package.json`.** `contributes.viewsContainers.activitybar` (`id: harness`, icon `resources/harness.svg`), `contributes.views.harness` (`id: harness.artifacts`), `contributes.viewsWelcome` (нет манифеста → текст + кнопка `harness.init`), `contributes.menus` (`view/title` — фильтры/поиск/сброс/refresh; `view/item/context` — по `viewItem =~ /…/`), новые `contributes.commands`. `activationEvents` остаётся `[]` — VSCode ≥1.74 сам генерирует `onView:harness.artifacts`; проверяется вручную в EDH (см. Risks).

**14. `src/extension.ts`.** Одна строка: `registerHarnessExplorer(context)` после `registerHarnessCommands(context)`.

### Impacted modules/files

- Новые (`src/explorer/**`): `paths.ts`, `model.ts`, `reader.ts` (порт + `vscodeReader`), `statusIcon.ts`, `filter.ts`, `stepWriter.ts`, `guards.ts`, `treeItem.ts`, `treeProvider.ts`, `refresh.ts`, `actions.ts`, `activation.ts`.
- Новые тесты: `tests/unit/explorer/{paths,model,statusIcon,filter,stepWriter,guards,perf}.test.ts`, `tests/integration/explorer.test.js`.
- Новые fixtures: `tests/fixtures/projects/explorer/` (мини-проект: манифест + 3 STEP разных статусов + `SPEC.md` + `docs/adr/` + `planning/reviews/STEP-001/`), `tests/helpers/generatePerfProject.ts`.
- Новый ассет: `resources/harness.svg`.
- Точечно изменяемые: `package.json`, `package.nls.json`, `package.nls.en.json`, `src/locales/{ru,en}.json`, `src/extension.ts`, `docs/architecture.md` (секция «Data / state model» — фактический механизм инвалидации).
- **Читаются, но не изменяются:** `src/parser/**` (новых полей не требуется), `src/commands/{preDispatch,stepPicker,activation}.ts` (переиспользование API).
- Не создаются: `src/editor/**`, `src/ui/**`, `src/api/**`, `src/git/**` (STEP-007/008/009).
- **Дополнено по факту (FIX STEP-006, 2-й проход; зафиксировано при закрытии по F-023 `REVIEW-2026-09-18T1108.md`):** `src/extension.ts` — помимо регистрации explorer'а, публичный `exports` (`HarnessExtensionExports`) и тип возврата `activate()`, введённые ради headless integration-теста живого `TreeDataProvider` (минимальный supporting-refactoring по `AGENTS.md` §9, не отдельная фича); `tests/mocks/vscode.ts`, `jest.config.mjs` (`moduleNameMapper` для `vscode`) — test-infra, без которой vscode-facing слой (`treeProvider.ts`, `actions.ts`) не тестируется в Jest; `docs/OPEN_QUESTIONS.md` (`OQ-005` — сознательно не синхронизируемые после `Mark as done` projection-файлы).

### Data / API implications

- `ManifestData`/`StepData`/`ReqData`/`AdrData` не меняются — всех полей достаточно.
- **Новая публичная поверхность для STEP-007/STEP-010:** `stepWriter.ts` (`setStatus`/`setBlocker`) — quick actions STEP-007 («flag blocker», «create follow-up STEP») обязаны переиспользовать этот модуль, а не заводить второй writer labeled markdown. Если STEP-007 решит перенести его в общее место — это его PLAN-решение; дублирование запрещено.
- `guards.ts` фиксирует правило «`Выполнено` из UI только при review PASS + evidence» — STEP-007/STEP-008 должны переиспользовать его, а не ослаблять.
- `ArtifactReader` — порт для будущих потребителей (STEP-008 Status Bar читает те же артефакты); переиспользуем.
- Новые публичные command id `harness.explorer.*` с явными аргументами — стабильная поверхность для STEP-008/STEP-010.
- `docs/architecture.md` («Data / state model») будет приведён в соответствие с фактическим механизмом (`FileSystemWatcher` + debounce вместо `onDidChangeTextDocument`/`onDidSaveTextDocument`) — синхронизация документации по факту, не новое решение.

### Test strategy

Unit (Jest, без `vscode`, `roots: tests/unit`):
- `paths.test.ts` — все 8 групп резолвятся из `tests/fixtures/manifest/initialized.manifest.yaml`; отсутствие каталога ADR даёт группу без ADR-узлов и без ошибки; никакого пути нет в коде вне `paths.ts` (проверяется grep-тестом на хардкод `planning/tasks`/`docs/` в `src/explorer/**`).
- `statusIcon.test.ts` — **ключи карты иконок ровно равны `parseExecutionProtocol(fixture).stepStatuses`** (ловит будущий drift протокола, в т.ч. появление 7-го статуса); неизвестный статус → fallback.
- `filter.test.ts` — каждое измерение отдельно; комбинация всех четырёх + поиск одновременно (прямое покрытие Acceptance «комбинируются»); пустой фильтр = без изменений; неизвестное значение приоритета не роняет фильтрацию.
- `model.test.ts` — построение дерева на `tests/fixtures/projects/explorer/` через fs-`ArtifactReader`: состав групп, ленивость (группа не читает файлы до запроса детей — проверяется счётчиком вызовов порта), битый STEP-файл пропускается и отражается узлом `'message'`.
- `stepWriter.test.ts` — round-trip: после `setStatus` повторный `parseStepFile` даёт новый статус, **все остальные поля побайтово неизменны** (защита от переформатирования файла); отсутствие метки → `Result` с ошибкой и неизменный контент.
- `guards.test.ts` — `canMarkDone` блокирует при `latestVerdict: NOT REVIEWED`/`FAIL`/пустом evidence и разрешает при `PASS` + evidence; `canFlagBlocker` блокирует терминальные статусы; `canDelete` блокирует при входящей `Depends on`-ссылке и перечисляет ссылающийся ID.
- `perf.test.ts` — `generatePerfProject(50)` в `os.tmpdir()`, замер `getChildren(TasksGroup)` через fs-reader; assert `< 500ms` и `children.length === 50`; фактическое значение печатается для Evidence.

Integration (`@vscode/test-cli`, реальный Extension Host, `tests/integration/explorer.test.js`):
- все `harness.explorer.*` присутствуют в `vscode.commands.getCommands(true)`;
- `executeCommand('harness.explorer.refresh')` и `executeCommand('harness.explorer.clearFilters')` не бросают;
- `executeCommand('harness.explorer.filterByStatus', ['Выполнено'])` c явным аргументом не бросает и выставляет `harness.explorer.hasFilters` (интерактивные QuickPick в headless-режиме не вызываются — см. Risks);
- workspace остаётся `tests/fixtures/workspace` (уже содержит манифест и один STEP от STEP-004/005); мутирующие действия в integration-тестах **не** выполняются, чтобы не портить committed fixture.

### Verification sequence

1. `npm run compile` (`tsc --noEmit`, strict) — 0 ошибок.
2. `npm run lint` — 0 ошибок/warnings.
3. `npm run build` (esbuild) — бандл собирается.
4. `npm test` (Jest) — все прежние 86 тестов зелёные (regression parser/i18n/commands) + новые `tests/unit/explorer/**`.
5. `npm run test:integration` (`@vscode/test-cli`, реальный VSCode) — прежние 6 тестов зелёные + новый `explorer.test.js`.
6. Ручная проверка в Extension Development Host на этом же репозитории: контейнер `Harness` в Activity Bar; 8 групп; раскрытие `Tasks` показывает 13 STEP с корректными иконками (включая `Выполнено` для STEP-001..005); клик открывает файл; правый клик показывает меню; фильтр `Status=Выполнено` + поиск `006` комбинируются; правка STEP-файла извне (через `sed`/агента) обновляет дерево без перезапуска; `Mark as done` на STEP-006 **блокируется** (нет review PASS) — это и есть живая проверка guard'а.
7. `git status` после прогона — только заявленные Deliverables, никакого runtime-мусора в `tests/fixtures/workspace/`.

(`python3 tools/harness/validate.py --mode commit` — не verification этого STEP, а обязательный pre-commit gate по `AGENTS.md` §17.)

### Risks / rollback

- **Самый существенный риск — `Mark as done` как обход deterministic gate** (`AGENTS.md` §8/§11, §3 протокола): UI-кнопка, ставящая `Выполнено`, обесценивает обязательный review. Снимается guard'ом `canMarkDone` (PASS + evidence) + modal-подтверждением; guard покрыт unit-тестами и проверяется вручную в EDH.
- **`Delete` как источник dangling-ссылок** — ровно тот класс дефектов, что закрывал `FIX STEP-005 (F-001)`. Снимается fail-closed проверкой входящих ссылок и предложением «Отменить STEP» вместо удаления; `useTrash: true` оставляет пользователю откат.
- **Шторм refresh'ей во время работы агента** (много записей подряд) — debounce 250 мс + точечная инвалидация группы вместо всего дерева.
- **Флейки перф-теста в CI** — порог 500 мс при ожидаемых ~10–30 мс на 50 мелких файлах; замер идёт через fs-порт без VSCode-оверхеда, значение логируется. При систематической нестабильности порог не «подкручивается» молча, а выносится в отдельный finding.
- **Headless QuickPick вешает integration-тест** (подтверждено Evidence STEP-005) — все explorer-команды принимают явный аргумент; интерактивные пути в автотестах не вызываются.
- **`activationEvents: []` + contributed view** — расчёт на авто-генерацию `onView:` в VSCode ≥1.74; если в EDH дерево не появляется до вызова команды, добавляется явный `onView:harness.artifacts` (одна строка в `package.json`).
- **`OQ-004` (каталог ADR)** — если будущий ADR-005 выберет другой механизм, меняется одна функция в `src/explorer/paths.ts`; на дизайн дерева это не влияет.
- **Пересечение с STEP-007** (те же quick actions над STEP-файлом) — снимается конвенцией «STEP-007 переиспользует `stepWriter.ts`/`guards.ts`», зафиксированной в Data/API implications.
- **Rollback STEP целиком:** удалить `src/explorer/**`, `tests/unit/explorer/**`, `tests/integration/explorer.test.js`, `tests/fixtures/projects/explorer/**`, `tests/helpers/generatePerfProject.ts`, `resources/**`; откатить точечные правки `package.json`/`package.nls*.json`/`src/locales/{ru,en}.json`/`src/extension.ts`/`docs/architecture.md`. Ни один существующий модуль не переписывается, поэтому откат не задевает STEP-003/004/005.

### Handoff

`IMPLEMENT STEP-006`.

## Evidence

**IMPLEMENT STEP-006 (2026-09-18).** Реализация выполнена строго по Implementation plan (revision 1), без отклонений от выбранного approach.

Новые файлы (`src/explorer/**`):
- `paths.ts` — `resolveArtifactSources`/`deriveAdrDir` (OQ-004: деривация каталога ADR из `sources.architecture`).
- `model.ts` — `HarnessNode`, `loadGroupChildren` (lazy per-group, message-узел при пустой группе/пропусках).
- `reader.ts` — порт `ArtifactReader` + fs-реализация (`createFsArtifactReader`, `globToRegExp`).
- `vscodeReader.ts` — production-реализация поверх `vscode.workspace.findFiles`.
- `statusIcon.ts` — карта иконок по 6 статусам протокола + fallback `question`.
- `filter.ts` — `applyStepFilters`/`matchesIdQuery`/`collectPriorities` (AND между измерениями, OR внутри).
- `stepWriter.ts` — `setStatus`/`setBlocker`, round-trip verify (fail-closed).
- `guards.ts` — `canMarkDone`/`canFlagBlocker`/`canDelete`.
- `treeItem.ts`, `treeProvider.ts`, `refresh.ts` (`FileSystemWatcher`, debounce 250мс), `actions.ts`, `activation.ts`.

Точечные правки: `package.json` (`viewsContainers`/`views`/`viewsWelcome`/`menus`/13 новых `harness.explorer.*` команд), `package.nls.json`/`package.nls.en.json`, `src/locales/{ru,en}.json` (новые ключи, RU/EN параллельны — проверено `tests/unit/locales/i18n.test.ts`), `src/extension.ts` (`registerHarnessExplorer`), `resources/harness.svg` (новый ассет), `docs/architecture.md` («Data / state model» — синхронизировано под фактический `FileSystemWatcher`, как и предполагал план).

Новые тесты: `tests/unit/explorer/{paths,statusIcon,filter,stepWriter,guards,model,perf}.test.ts` (38 новых кейсов), `tests/integration/explorer.test.js` (4 кейса). Новые fixtures: `tests/fixtures/projects/explorer/**` (манифест + 3 STEP разных статусов + SPEC.md с 2 REQ + `docs/adr/ADR-001-fixture.md` + `planning/reviews/STEP-001/`), `tests/helpers/generatePerfProject.ts`.

Verification sequence (пункты 1–5 плана; пункт 6 — см. Risks/Deviation ниже; пункт 7 подтверждён):
1. `npm run compile` — 0 ошибок.
2. `npm run lint` — 0 ошибок/предупреждений.
3. `npm run build` — esbuild бандл собран успешно.
4. `npm test` (Jest) — **14 test suites / 124 теста, все зелёные** (86 прежних + 38 новых explorer).
5. `npm run test:integration` (`@vscode/test-cli`, реальный VSCode 1.138.0, headless) — **10 тестов, все зелёные** (6 прежних + 4 новых `explorer.test.js`: регистрация всех 13 `harness.explorer.*`, `refresh`/`clearFilters` без throw, `filterByStatus`/`search` с явным аргументом без throw).
6. Перф: замер `loadGroupChildren` на 50 синтетических STEP через fs-`ArtifactReader` — **~16мс** (порог 500мс, см. `perf.test.ts`, лог печатается в вывод теста).
7. `git status` после прогона — untracked/modified ограничены заявленными Deliverables; `tests/fixtures/workspace/` не тронут прогоном тестов.

**Отклонение от плана (пункт 6 Verification sequence — ручная проверка в EDH):** этот сеанс IMPLEMENT выполняется в non-interactive окружении без GUI VSCode, поэтому визуальная ручная проверка (Activity Bar контейнер, раскрытие 8 групп, клик/right-click, комбинация фильтр+поиск, live-обновление дерева на внешнюю правку файла, блокировка `Mark as done` на STEP-006 из-за отсутствия PASS) физически невыполнима из этой сессии. Она заменена (a) целевыми Jest-тестами на ту же логику через fs-порт (`model.test.ts`, `guards.test.ts`) и (b) integration-тестами реального Extension Host на headless-вызовах команд. Пункт 6 плана рекомендуется довыполнить вручную при `REVIEW STEP-006` или отдельно перед релизом; сам guard `canMarkDone` детерминированно покрыт unit-тестом (`guards.test.ts`: `Выполнено` требует PASS + непустой evidence).

Никаких иных отклонений от Implementation plan/Scope/Mutation policy нет; future/несвязанная работа (STEP-007/008/009: `src/editor/**`, `src/ui/**`, `src/api/**`) не затронута.

**FIX STEP-006 (2026-09-18), по `REVIEW-2026-09-18T0900.md`.** Исправлены все три blocking finding и два рекомендованных non-blocking; остальные non-blocking (F-006..F-012 кроме F-009/F-011/F-012, перечисленных ниже) сознательно оставлены на будущий проход — см. «Не исправлено» ниже.

Исправлено:

- **F-001 (Blocking).** `src/explorer/treeProvider.ts` — group-узлы теперь мемоизированы один раз в конструкторе (`groupNodes: ReadonlyMap<GroupId, HarnessNode>`); `getChildren(undefined)` и `invalidate(groupId)` возвращают/фаерят именно эти стабильные ссылки, а не свежие литералы. Регрессионный тест: `tests/unit/explorer/treeProvider.test.ts` (новый; воспроизводит `Map`-по-ссылке семантику `ExtHostTreeView` и проверяет, что `fire()` таргетит объект, уже возвращённый `getChildren()`). Тест подтверждён на старой реализации (временный revert) — падает соответствующей идентити-проверкой.
- **F-002 (Blocking).** `src/explorer/actions.ts` — `markDone`/`flagBlocker`/`deleteArtifact` теперь первым шагом вызывают `checkInitGuard(manifest, 'require-initialized')` (переиспользован из `src/commands/preDispatch.ts`, как и требовал Implementation plan п.7 — тип `ValidationResult` уже был импортирован, не хватало вызова самой функции). Регрессионный тест: `tests/unit/explorer/actions.test.ts` (новый, три кейса на `uninitialized.manifest.yaml`).
- **F-003 (Blocking).** `src/explorer/actions.ts` — добавлен `readFreshStep`: `markDone`/`flagBlocker` используют `resolveTargetStep` только для получения `id`, а `StepData` для guard'а и записи всегда перечитывают из файла непосредственно перед проверкой. Регрессионный тест: `tests/unit/explorer/actions.test.ts` (кейс «в узле PASS, на диске FAIL → запись не происходит» и аналог для `flagBlocker`/терминального статуса).
- **F-004 (Non-blocking, рекомендован в этом же проходе).** `src/explorer/guards.ts` (`canDelete` принимает `allAdrs: AdrData[]` и проверяет `traceability.step`), `src/explorer/actions.ts` (`listAllAdrs`, читает `deriveAdrDir(manifest)`). Тест: `tests/unit/explorer/guards.test.ts` (новый кейс на ADR-ссылку).
- **F-005 (Non-blocking, рекомендован в этом же проходе).** `src/explorer/stepWriter.ts` — новая `setStatusAndBlocker` применяет обе трансформации к одному прочитанному контенту и делает одну запись (round-trip verify по обоим полям сразу). `src/explorer/actions.ts.flagBlocker` вызывает её вместо двух последовательных `writeStepFile`. Тест: `tests/unit/explorer/stepWriter.test.ts` (round-trip + «нет секции → ошибка, статус в контенте не меняется»).
- **F-006 (Non-blocking, мелкое).** `src/explorer/model.ts` — восстановлен `console.warn` на каждый пропуск (как и требовал Implementation plan п.9), сообщение `harness.explorer.message.readError` в обоих locale-файлах больше не отсылает к несуществующему Output.
- **F-007 (Non-blocking, мелкое).** Команда `harness.explorer.revealInOsExplorer` переименована в `harness.explorer.viewInExplorer` (id + оба locale title) — соответствует фактическому поведению (`revealInExplorer`, панель Explorer, не ОС-проводник). Обновлены `package.json`, `package.nls*.json`, `tests/integration/explorer.test.js`.
- **F-009 (Non-blocking, мелкое).** `src/explorer/vscodeReader.ts` — `findFiles(pattern, null)` вместо `findFiles(pattern)`, чтобы production-порт не расходился с fs-тестовым по `files.exclude`/`search.exclude`.
- **F-011 (Non-blocking, мелкое).** `src/explorer/actions.ts.createFollowUpStep` — захардкоженный русский префикс заменён ключом `harness.explorer.prefill.followUp` (`src/locales/{ru,en}.json`).
- **F-012 (Non-blocking, мелкое).** `src/explorer/activation.ts` — `setContext harness.isHarnessProject = false` выставляется и при раннем `return` (отсутствие открытого workspace), а не только после успешного парсинга манифеста.

Не исправлено (сознательно, отдельным поводом): **F-008** (дублирование классификации терминальных статусов) требовало бы изменения `src/commands/preDispatch.ts`, который `## Implementation plan → Impacted modules/files` этого STEP явно относит к «Читаются, но не изменяются» (FIX STEP-006, 2-й проход, F-016: предыдущая формулировка ошибочно приписывала эту фразу `## Mutation policy`) — исправление вынесено за пределы текущего FIX-прохода, а не скрыто. F-010 (projection-файлы после `Mark as done`) — пробел контракта, не механическая правка; оставлен как есть, как и предлагал Handoff review, и теперь зафиксирован явно в `OQ-005` (`docs/OPEN_QUESTIONS.md`) — см. FIX STEP-006 (2-й проход).

Verification (перезапущено полностью после всех правок):

1. `npm run compile` — 0 ошибок.
2. `npm run lint` — 0 ошибок/предупреждений.
3. `npm run build` — esbuild бандл собран успешно.
4. `npm test` (Jest) — **16 test suites / 135 тестов, все зелёные** (124 прежних + 3 новых `treeProvider.test.ts` + 5 новых `actions.test.ts` + 1 новый `guards.test.ts` (F-004) + 2 новых `stepWriter.test.ts` (F-005) = 11 новых, из них 3 с явной F-00x регрессионной привязкой подтверждены temporary-revert методом).
5. `npm run test:integration` (`@vscode/test-cli`, headless VSCode 1.138.0) — **10 тестов, все зелёные** (команда `harness.explorer.viewInExplorer` переименована, состав команд не изменился).
6. `python3 tools/harness/validate.py --mode commit` — PASS.
7. `git status` — untracked/modified ограничены заявленными Deliverables STEP-006 плюс новыми test-infra файлами (`tests/mocks/vscode.ts`, `jest.config.mjs` — `moduleNameMapper` для `vscode`, необходимый только для того, чтобы `treeProvider.test.ts`/`actions.test.ts` могли реально протестировать vscode-facing слой, где жили F-001/F-002/F-003).

Пункт 6 исходного Verification sequence (ручная проверка в EDH) остаётся не выполненным человеком в этой non-interactive сессии по той же причине, что и в предыдущем IMPLEMENT-проходе; вместо этого добавлено целевое unit-покрытие именно vscode-facing слоя (`treeProvider.ts`, `actions.ts`), которое в REVIEW-2026-09-18T0900 было отмечено как отсутствующее и было прямой причиной необнаруженных F-001/F-003. Рекомендуется довыполнить вручную при следующем `REVIEW STEP-006` или перед релизом.

**FIX STEP-006 (2-й проход, 2026-09-18), по Handoff `REVIEW-2026-09-18T1500.md`.** Исправлен F-013 (Medium) и все четыре рекомендованных Low-finding (F-014..F-017); условие закрытия из п.1 Handoff (пункт 6 `## Verification sequence`) снято расширением integration-тестов, не ручной проверкой человеком (второй разрешённый по Handoff вариант).

Исправлено:

- **F-013 (Medium).** `src/explorer/treeProvider.ts` — `sources` больше не `private readonly`; новый публичный метод `setManifest(manifest)` пересчитывает `sources` через тот же `resolveArtifactSources`, чистит `cache` и вызывает `invalidate()`. `src/explorer/activation.ts` — колбэк перепарса `.project/manifest.yaml` теперь вызывает `provider.setManifest(manifest)` вместо голого `provider.invalidate()`, **до** `attachWatchers()`, как и требовал Fix direction review. Регрессионные тесты: `tests/unit/explorer/treeProvider.test.ts` (новый `describe('HarnessTreeDataProvider.setManifest (F-013 regression)')`, 2 кейса) — spy на `reader.list` подтверждает, что после `setManifest` с изменённым `protocol.taskDirectory` следующий `getChildren('tasks')` реально запрашивает новый каталог, и что кэш группы при этом сбрасывается (а не отдаёт устаревший список).
- **F-014 (Low).** Добавлен `describe('HarnessTreeDataProvider caching on real fixture data (F-014 regression)')` в `treeProvider.test.ts` — на `createFsArtifactReader(tests/fixtures/projects/explorer)` со счётчиком вызовов `reader.list`: раскрытие `tasks` → step-узлы + 1 вызов `list`; повторное раскрытие → счётчик не растёт (кэш-хит, тот же объект результата); `invalidate('tasks')` → счётчик растёт до 2, узлы возвращаются заново. Закрывает пробел предыдущего прохода, где `treeProvider.test.ts` покрывал только identity-семантику F-001 на `emptyReader`.
- **F-015 (Low).** `src/explorer/actions.ts` — `markDone`/`flagBlocker`: ветка `if (!step) return;` после `readFreshStep` заменена на `vscode.window.showErrorMessage(i18n.t('harness.explorer.error.stepUnreadable', { step: target.id }))` перед `return`. Новый ключ `harness.explorer.error.stepUnreadable` добавлен в `src/locales/{ru,en}.json` (симметрия подтверждена существующим `tests/unit/locales/i18n.test.ts`). Регрессионные тесты: `tests/unit/explorer/actions.test.ts` (новый `describe`, 2 кейса — отсутствующий файл для `markDone`, битый/пустой файл для `flagBlocker`; оба проверяют показ сообщения и отсутствие записи).
- **F-016 (Low, текст + опциональная дедупликация).** Уточнена формулировка в абзаце «Не исправлено» FIX Evidence (см. ниже по тексту) — цитата «Читаются, но не изменяются» указана как часть `## Implementation plan → Impacted modules/files`, а не `## Mutation policy`. Дополнительно (не обязательно, но выполнено по рекомендации review): `src/explorer/guards.ts` теперь экспортирует единый `TERMINAL_STATUSES`, `src/explorer/treeItem.ts` переиспользует его вместо собственной инлайн-копии. `src/commands/preDispatch.ts` не тронут (вне Allowed/Conditional scope, тот же вывод, что и в первом FIX-проходе) — третья копия (F-008) остаётся отдельным поводом.
- **F-017 (Low).** Решение оставить F-010 (projection-файлы не синхронизируются после `Mark as done`) незакрытым зафиксировано явно: новый `OQ-005` в `docs/OPEN_QUESTIONS.md` по формату существующих записей (`OQ-001`..`OQ-004`), со статусом `DEFERRED`.

**Условие закрытия (Handoff п.1): пункт 6 `## Verification sequence`.** Вместо ручной проверки в Extension Development Host (недоступна: обе сессии IMPLEMENT/FIX были non-interactive, без GUI VSCode) расширен `tests/integration/explorer.test.js` — реальный headless Extension Host, `@vscode/test-cli`, VSCode 1.138.0. Для доступа к живому `HarnessTreeDataProvider` из теста `src/explorer/activation.ts.registerHarnessExplorer` теперь возвращает `{ provider }` (новый экспортируемый тип `HarnessExplorerHandle`), а `src/extension.ts.activate` возвращает `{ explorerProvider }` через `exports` (тестовая инфраструктура — VSCode API это поддерживает нативно, `ext.activate()`/`ext.exports`). Новые сценарии:

- «дерево строит ровно 8 групп верхнего уровня из REQ-002» — `provider.getChildren()` на реальном активированном дереве.
- «Tasks: STEP-1 виден ... со статус-иконкой и contextValue, клик открывает файл» — `provider.getTreeItem(step1)` на fixture `STEP-1.md` (`**Статус:** Выполнено`) проверяет `iconPath.id === 'pass-filled'`, `contextValue` содержит `harness.step`, `command.command === 'vscode.open'` — прямое доказательство Acceptance criteria «Click открывает файл».
- «right-click меню: пункты harness.explorer.* объявлены в реальном манифесте расширения» — читает фактически загруженный `ext.packageJSON.contributes.menus['view/item/context']` (не копию из теста) и проверяет `when`/`command` для `markDone`/`flagBlocker`/`createFollowUpStep`/`delete`/`openFile`/`viewInExplorer` — headless-эквивалент «right-click показывает меню», поскольку сам клик правой кнопкой физически не воспроизводим без GUI.
- «создание STEP-файла на диске мимо API отражается в дереве» и «изменение статуса STEP-файла на диске отражается в дереве после debounce watcher» — новый STEP-файл (`STEP-9.md`, не committed, создаётся/удаляется самим тестом) пишется через `node:fs/promises` напрямую в `tests/fixtures/workspace/planning/tasks/` (мимо `vscode.workspace.fs`/редактора — тот же путь, что у headless-агента по ADR-004), затем `provider.getChildren('tasks')` опрашивается с retry-циклом (до 8с, шаг 200мс) до появления/обновления узла. Оба теста проходят на реальном `FileSystemWatcher` + debounce 250мс, `teardown` удаляет временный файл и ждёт его исчезновения из дерева, чтобы `tests/fixtures/workspace/` не оставался испорченным.

Verification (перезапущено полностью после всех правок):

1. `npm run compile` — 0 ошибок.
2. `npm run lint` — 0 ошибок/предупреждений.
3. `npm run build` — esbuild бандл собран успешно.
4. `npm test` (Jest) — **16 test suites / 140 тестов, все зелёные** (135 прежних + 3 новых в `treeProvider.test.ts` (F-013 ×2, F-014 ×1) + 2 новых в `actions.test.ts` (F-015 ×2) = 5 новых).
5. `npm run test:integration` (`@vscode/test-cli`, headless VSCode 1.138.0) — **15 тестов, все зелёные** (10 прежних + 5 новых `explorer.test.js`: 8-групп, STEP-1 иконка/contextValue/клик, right-click меню, создание STEP-файла извне, изменение статуса STEP-файла извне).
6. `python3 tools/harness/validate.py --mode commit` — PASS (231 файл; единственное WARNING — «no staged files yet», ожидаемо).
7. `git status --short` — untracked/modified ограничены Deliverables STEP-006 плюс уже известной test-infra (`tests/mocks/vscode.ts`, `jest.config.mjs`); `src/commands/**`, `src/parser/**`, `src/editor/**`, `src/ui/**`, `src/api/**`, `src/git/**` не тронуты (проверено отдельно `git status --short src/commands src/parser src/editor src/ui src/api src/git` — пусто); `tests/fixtures/workspace/` после прогона integration-тестов не содержит `STEP-9.md` (teardown подтверждён).

Не сделано в этом проходе (сознательно): полная дедупликация терминальных статусов с `src/commands/preDispatch.ts` (F-008) — вне Allowed/Conditional scope STEP-006, остаётся отдельным поводом. Автоматическая синхронизация projection-файлов после `Mark as done` (F-010/`OQ-005`) — продуктовое решение, не механическая правка, оставлено как явно зафиксированный open question. Future/несвязанная работа STEP-007/008/009 не затронута.

## Review status

**Latest verdict:** PASS (закрытие в `Выполнено` разрешено)
**Latest report:** `planning/reviews/STEP-006/REVIEW-2026-09-18T1108.md`

История:

- `REVIEW-2026-09-18T0900.md` — FAIL. Blocking: F-001 (точечная инвалидация дерева не доходит до UI — `invalidate(groupId)` фаерит новый объект, `ExtHostTreeView._getHandlesToRefresh` ищет element по ссылке; refresh по `FileSystemWatcher` и после мутаций фактически не работает), F-002 (мутирующие действия Explorer обходят `checkInitGuard`, который план требовал переиспользовать), F-003 (`canMarkDone` проверяется по закэшированным данным узла, а не по фактическому содержимому файла — обход deterministic gate). Non-blocking: F-004..F-012. Deterministic verification (compile/lint/build/`npm test` 124/124/`npm run test:integration` 10/10/перф 13.5мс) перезапущена независимо и совпадает с Evidence.
- `REVIEW-2026-09-18T1500.md` (FIX-pass) — **PASS** по существу диффа: F-001/F-002/F-003 исправлены по корню и подтверждены независимо (включая повторную проверку `ExtHostTreeView`-инварианта в фактической сборке VSCode 1.138.0), рекомендованные F-004/F-005 реально подключены, F-006/F-007/F-009/F-011/F-012 подтверждены фактически; scope-инцидент с `src/commands/preDispatch.ts` (F-008) обнаружен исполнителем и полностью откачен. Deterministic verification перезапущена независимо и совпадает с Evidence (`npm test` 135/135, `npm run test:integration` 10/10, `validate.py --mode commit` PASS, перф 13.2мс). Новые non-blocking: F-013 (Medium — перепарсенный `.project/manifest.yaml` не применяется к `HarnessTreeDataProvider.sources`, смена путей в манифесте не перестраивает дерево до перезапуска окна), F-014..F-017 (Low). **Закрытие STEP в `Выполнено` по §10.9 не разрешено**: пункт 6 `## Verification sequence` (ручная проверка в Extension Development Host) не выполнен ни в IMPLEMENT, ни в FIX-проходе, и acceptance criterion «Click открывает файл, right-click показывает меню» остаётся эмпирически недоказанным. Handoff: выполнить пункт 6 вручную (включая сценарий F-013) либо расширить `tests/integration/explorer.test.js` до проверки дерева/меню/watcher-реакции в реальном хосте; F-013 исправить в `FIX STEP-006` или вынести отдельным corrective STEP; F-014..F-017 — по возможности.
- `REVIEW-2026-09-18T1108.md` (после 2-го FIX-прохода) — **PASS**, закрытие разрешено. F-013..F-017 закрыты по корню и подтверждены независимо (регрессионные тесты нетавтологичны — падают на предыдущих реализациях). Условие Handoff предыдущего review снято: расширенный `tests/integration/explorer.test.js` содержательно проверяет в реальном headless Extension Host структуру дерева (8 групп живого провайдера), иконку/`contextValue`/клик реального `TreeItem`, контракт меню из фактически загруженного `packageJSON` и реакцию на внешнюю правку файла через настоящий `FileSystemWatcher` (тест пишет файл мимо API и только опрашивает `getChildren`, что не может пройти при сломанном watcher'е) — оба ранее недоказанных acceptance criteria («Click открывает файл», «right-click показывает меню») теперь подтверждены. Scope соблюдён (`src/commands/**`/`src/parser/**`/`src/editor/**`/`src/ui/**`/`src/api/**`/`src/git/**` не тронуты). Deterministic verification перезапущена независимо и совпадает с Evidence (`npm test` 140/140, `npm run test:integration` 15/15, `validate.py --mode commit` PASS, перф 14.2мс). Blocking-дефектов нет. Новые non-blocking: **F-018 (Medium)** — остаточное TOCTOU-окно между guard'ом `canMarkDone` и записью (модальное подтверждение не ограничено по времени и не перепроверяет файл повторно перед записью; тот же класс, что закрытый F-003, рекомендован отдельный corrective STEP); F-019..F-025 (Low) — реконструкция пути мутирующих действий по `<id>.md` вместо `node.uri`, накопление watcher-подписок при перепарсе манифеста, дублирование ADR-glob вне `paths.ts`, неразличимость «нет артефактов» и «скрыто фильтром», расширение `exports` `src/extension.ts` за букву Conditional (признано допустимым supporting-изменением), необходимость синхронизации projection-файлов при закрытии (см. ниже), нестабильная конвенция имён review-отчётов. Закрытие STEP в `Выполнено` разрешено при условии механической синхронизации projection-файлов и дополнения `## Impacted modules/files` — оба пункта выполнены при переводе STEP в `Выполнено`.

## Blocker / Failure reason

—
