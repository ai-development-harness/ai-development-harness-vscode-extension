# STEP-014 — Закрыть TOCTOU-окно между guard'ом `canMarkDone` и записью в Explorer

**Статус:** Выполнено
**Type:** BUGFIX
**Приоритет:** Средний
**Фаза:** MVP — UI
**Depends on:** STEP-006

## Requirements

- REQ-002

## ADR

- не требуется: устраняет race в уже принятом решении STEP-006/ADR-002, новой архитектурной развилки нет.

## Risk flags

- deterministic-gate bypass (см. `## Context`)

## Goal

Устранить остаточное окно гонки в `src/explorer/actions.ts` между проверкой guard'а `canMarkDone`/`canFlagBlocker`/`canDelete` и фактической записью файла: пока открыто модальное подтверждение (`showWarningMessage`/`showQuickPick`, время ожидания пользователя не ограничено), содержимое STEP-файла может измениться (параллельная работа headless-агента по ADR-004), а перед записью guard повторно не проверяется.

## Context

Найдено при `REVIEW STEP-006` (`planning/reviews/STEP-006/REVIEW-2026-09-18T1108.md`, finding F-018, Non-blocking/Medium — не блокировал закрытие STEP-006, вынесено отдельным corrective STEP согласно Handoff этого review). Фактический порядок операций в `markDone`: `readFreshStep` (чтение №1) → `canMarkDone(step)` на содержимом чтения №1 → `showWarningMessage(..., { modal: true })` — неограниченное по времени ожидание пользователя → `writeStepFile` (чтение №2 + запись). `setStatus`/round-trip verify в `stepWriter.ts` проверяют только то, что относительно чтения №2 изменилось ровно ожидаемое поле; они не перепроверяют `reviewStatus.latestVerdict === 'PASS'`/непустой `evidence`.

Это остаточный случай того же класса дефекта, что был закрыт как `F-003` в первом FIX-проходе STEP-006 (`AGENTS.md` §8/§11, `EXECUTION_PROTOCOL.md` §3: статус `Выполнено` разрешён только при доказанном review PASS). F-003 закрыл систематически достижимую ветку (устаревшие данные узла дерева); здесь остаётся именно гонка по времени, но конкурентная запись STEP-файла агентом — штатная модель продукта (ADR-004), поэтому окно нельзя считать чисто теоретическим.

`flagBlocker` этим дефектом не затронут (InputBox вызывается до `readFreshStep`, ожидания между guard'ом и записью нет). `deleteArtifact` затронут структурно так же (`canDelete` проверяется до модального подтверждения), но последствие мягче — удаление идёт через `useTrash: true`, откат возможен.

## Scope

- `src/explorer/actions.ts` — `markDone`: после закрытия модального подтверждения и непосредственно перед вызовом `writeStepFile`/`setStatus`, перечитать STEP-файл и повторно вызвать `canMarkDone` на свежем содержимом; при несовпадении с состоянием на момент подтверждения — fail-closed с уже существующим локализованным `messageKey` (без второго диалога).
- То же для `deleteArtifact` (`canDelete`) — повторная проверка входящих ссылок непосредственно перед `workspace.fs.delete`.
- Минимально достаточный рефакторинг `stepWriter.ts`/`guards.ts`, если потребуется единая read-verify-write последовательность (без изменения публичного контракта `setStatus`/`setBlocker`/`setStatusAndBlocker` за пределами необходимого).

## Mutation policy

### Allowed

- `src/explorer/actions.ts`, `src/explorer/guards.ts`, `src/explorer/stepWriter.ts`.
- `tests/unit/explorer/**` — регрессионные тесты.

### Conditional

- `src/locales/{ru.json,en.json}` — только если понадобится новый message key для отличения «guard не пройден изначально» от «guard не пройден повторно после подтверждения» (не обязательно — можно переиспользовать существующие ключи `canMarkDone`/`canFlagBlocker`/`canDelete`).

### Forbidden

- Изменение `src/commands/preDispatch.ts` (переиспользуется, не модифицируется — тот же принцип, что в STEP-006).
- Расширение scope на F-019..F-025 (другие non-blocking findings STEP-006) — не решаются «заодно»; при необходимости фиксируются отдельными `ADD STEP:`.

## Out of scope

- F-019 (реконструкция пути по `<id>.md` вместо `node.uri`), F-020 (накопление watcher-подписок), F-021 (ADR-glob вне `paths.ts`), F-022 (недифференцированное «нет артефактов»/«скрыто фильтром») — отдельные non-blocking findings STEP-006, не входят в этот corrective STEP; фиксируются по потребности отдельными `ADD STEP:`.
- `deleteArtifact` для узлов, не являющихся STEP (REQ/ADR/file) — F-018 сформулирован именно для `canMarkDone`/`canDelete` над STEP-узлами; расширение guard'ов на другие типы узлов вне текущего понимания дефекта.

## Acceptance criteria

- Воспроизводимый до фикса сценарий (guard проходит на устаревшем содержимом, файл меняется во время открытого модального диалога, запись всё равно происходит) после фикса не воспроизводится: запись блокируется тем же локализованным сообщением, что при изначально непройденном guard'е.
- `flagBlocker` не регрессирует (остаётся без ожидания между guard'ом и записью, либо получает ту же защиту, если рефакторинг `stepWriter.ts` этого потребует).
- Существующие 140 unit- и 15 integration-тестов STEP-006 остаются зелёными без ослабления.

## Verification

- Unit-тест: замокать `showWarningMessage`/`showQuickPick` так, чтобы обработчик перезаписывал fixture-файл (`latestVerdict` → `FAIL` или terminal-статус) непосредственно перед возвратом подтверждения пользователя, и утверждать отсутствие `writeFile`/`delete`.
- Регрессионный прогон полного набора `tests/unit/explorer/**` и `tests/integration/explorer.test.js`.

## Deliverables

- Точечный патч `src/explorer/actions.ts` (+ `guards.ts`/`stepWriter.ts` при необходимости) с regression-тестами.
- `tests/mocks/vscode.ts` — минимальный класс-стаб `RelativePattern` (см. `## Evidence` → «Отклонение от плана»; зафиксировано как FIX по finding F-001 review `REVIEW-2026-09-18T1157.md`).

## Implementation plan

**Plan status:** Planned
**Plan revision:** 1
**Planned at:** 2026-09-18

### Предпосылки

- Hard dependency **STEP-006 — `Выполнено`** (проверено по `planning/tasks/STEP-006.md:3` и `## Review status` → PASS, `planning/reviews/STEP-006/REVIEW-2026-09-18T1108.md`). Blocker'ов нет, планирование идёт на фактически существующей реализации.
- **Новый ADR не требуется** (подтверждено планом, не только текстом `## ADR`): устойчивые решения уже приняты — ADR-002 (labeled markdown как канонический формат STEP-файла; writer остаётся minimal-diff поверх публичного API парсера), ADR-004 (headless CLI-агент пишет STEP-файлы параллельно с пользователем — это и есть причина, по которой окно нельзя считать теоретическим), ADR-001 (пути только из манифеста — сохраняется). Архитектурной развилки нет: меняется порядок уже существующих проверок внутри одного модуля.
- Правило «`Выполнено` из UI только при review PASS + непустом evidence» уже зафиксировано `src/explorer/guards.ts:28` и `## Implementation plan → Data / API implications` STEP-006; STEP-014 его не ослабляет и не переопределяет, а делает проверяемым в момент записи.

#### Расхождения между `## Context` STEP-014 и фактическим кодом (canonical — код)

Проверены все утверждения Context; фактических противоречий, требующих правки `## Context`/`## Scope`, не найдено. Три уточнения, под которые скорректирован план:

1. **`writeStepFile` физически находится не в `stepWriter.ts`, а в `src/explorer/actions.ts:337–352`** (приватный хелпер, не экспортируется). Именно он делает «чтение №2 + запись». `src/explorer/stepWriter.ts` — чистый модуль без I/O: `setStatus` (`:41`), `setBlocker` (`:55`), `setStatusAndBlocker` (`:77`) принимают уже прочитанный `content`. Поэтому точка врезки re-guard — `actions.ts`, а не `stepWriter.ts`; `## Scope` («минимально достаточный рефакторинг `stepWriter.ts`/`guards.ts`, если потребуется») в итоге **не задействуется**: оба модуля остаются без изменений.
2. **Round-trip verify описан в Context точно.** `setStatus:50` и `setStatusAndBlocker:90` вызывают `stepEqualExcept(before, after, [...])`, где `before` — разбор того же `content`, что пришёл в функцию (чтение №2). То есть verify действительно гарантирует только «относительно чтения №2 изменилось ровно ожидаемое поле» и ничего не знает про `reviewStatus`/`evidence`. Ослабление/усиление этой проверки не требуется.
3. **`flagBlocker` (`actions.ts:263–293`) не имеет пользовательского ожидания между guard'ом и записью** — `showInputBox` (`:277`) вызывается до `readFreshStep` (`:279`), что совпадает с Context и с F-018. Но между `readFreshStep` и чтением №2 внутри `writeStepFile` остаётся ненулевой асинхронный зазор (двойное чтение того же файла). Формулировка `## Goal` перечисляет `canFlagBlocker` наравне с остальными; план закрывает и этот зазор — бесплатно, через общий guarded-write путь, что прямо разрешено Acceptance criteria («либо получает ту же защиту, если рефакторинг этого потребует»).

### Implementation approach

Суть фикса: **guard должен вычисляться на том же чтении файла, из которого строится записываемый контент.** Сейчас guard считается на чтении №1 (`readFreshStep`), а контент — на чтении №2 (внутри `writeStepFile`); между ними стоит модальный диалог без ограничения по времени. План переносит guard внутрь той же «транзакции», что и transform+write, не вводя новых абстракций и не меняя публичных контрактов.

**Шаг 1. `src/explorer/actions.ts:337–352` — приватный `writeStepFile` становится guarded-write.**

Новая сигнатура (имя можно сохранить или переименовать в `guardedWriteStepFile` — на усмотрение реализации, символ приватный):

```ts
async function writeStepFile(
  absPath: string,
  expectedStepId: string,
  reguard: (fresh: StepData) => ValidationResult,
  transform: (content: string) => ReturnType<typeof setStatus>,
  i18n: I18nService
): Promise<boolean>
```

Порядок внутри, строго fail-closed:

1. `vscode.workspace.fs.readFile` оборачивается в `try/catch` (сейчас — голый `await` на `:343`). Файл исчез/недоступен между подтверждением и записью → `showErrorMessage(i18n.t('harness.explorer.error.stepUnreadable', { step: expectedStepId }))`, `return false`. Это закрывает необработанный reject, появляющийся ровно в окне F-018.
2. `parseStepFile(content)`; `!parsed.ok` → тот же `stepUnreadable`, `return false`.
3. `parsed.value.data.id !== expectedStepId` → `stepUnreadable`, `return false` (файл по пути подменён другим STEP; дешёвая проверка идентичности цели).
4. `const g = reguard(parsed.value.data); if (!g.ok) { showErrorMessage(i18n.t(g.messageKey, g.params)); return false; }` — **тот же локализованный messageKey**, что при изначально непройденном guard'е, без второго диалога (требование `## Scope`).
5. Далее без изменений: `transform(content)` → при `!result.ok` существующее `harness.explorer.error.writeFailed` → `writeFile`.

Ключевой инвариант: `transform` применяется ровно к тому `content`, который прошёл re-guard. Поэтому round-trip verify `stepWriter.ts` остаётся корректным относительно того же чтения, публичный контракт `setStatus`/`setBlocker`/`setStatusAndBlocker` не меняется, `stepWriter.ts` не редактируется.

В `actions.ts` добавляется `import type { ValidationResult } from '../commands/preDispatch';` (сейчас импортируется только `checkInitGuard`, `:5`) и `StepData` уже импортирован (`:9`). `src/commands/preDispatch.ts` не изменяется (Mutation policy → Forbidden).

**Шаг 2. `markDone` (`actions.ts:224–261`).**

- Пред-диалоговый `canMarkDone` (`:246`) **сохраняется** — он отвечает за UX (не показывать модалку там, где действие заведомо запрещено), но перестаёт быть единственной проверкой.
- `stepPath` (`:258`) вычисляется один раз и передаётся в guarded-write вместе с `step.id` и `reguard = (fresh) => canMarkDone(fresh)`.
- Вызов `provider.invalidate('tasks')` (`:260`) остаётся **безусловным**, в том числе при `false` из guarded-write: если re-guard сработал, значит файл на диске действительно изменился во время диалога — инвалидация дерева в этом случае не паразитная, а желательная. Это осознанное решение, а не упущение.

**Шаг 3. `flagBlocker` (`actions.ts:263–293`).**

Тот же вызов guarded-write с `reguard = (fresh) => canFlagBlocker(fresh, reason)` (текст причины захватывается замыканием — он к этому моменту уже введён и неизменен). Поведение при валидном сценарии не меняется; дополнительно закрывается зазор из п.3 «Расхождений». Регрессия исключается контрольным тестом (см. Test strategy).

**Шаг 4. `deleteArtifact` (`actions.ts:301–335`).**

Здесь записи через `writeStepFile` нет, поэтому re-guard оформляется явно:

- локальный хелпер `evaluateDeleteGuard(workspaceRoot, manifest, stepId): Promise<ValidationResult>` инкапсулирует существующие `Promise.all([listAllSteps, listAllReqs, listAllAdrs])` (`:315–319`) + `canDelete` (`:320`);
- первый вызов — на прежнем месте, до модального подтверждения (UX);
- **второй вызов — сразу после `confirmed` и непосредственно перед `vscode.workspace.fs.delete`** (`:333`); при `!ok` — `showErrorMessage(i18n.t(g.messageKey, g.params))` и `return`, без второго диалога. Это прямое требование `## Scope` («повторная проверка входящих ссылок непосредственно перед `workspace.fs.delete`»).

Сценарий, который это закрывает: во время открытой модалки агент (ADR-004) создаёт `STEP-NNN` с `Depends on: <target>` либо дописывает `## Traceability` в REQ/ADR — удаление порождает dangling-ссылку (§1 протокола, тот же класс, что `FIX STEP-005 F-001`).

**Шаг 5. Чего план сознательно НЕ делает.**

- `src/explorer/guards.ts` и `src/explorer/stepWriter.ts` не изменяются: сигнатуры `canMarkDone(step)`/`canFlagBlocker(step, reason)`/`canDelete(id, steps, reqs, adrs)` уже чистые и полностью пригодны для повторного вызова. Разрешение `## Mutation policy → Allowed` на них остаётся неиспользованным — это нормально.
- `src/locales/{ru,en}.json` не изменяются: `## Mutation policy → Conditional` допускает новый ключ, но `## Scope` требует «тот же локализованный messageKey, что при изначально непройденном guard'е», и Acceptance criteria это фиксирует. Все нужные ключи существуют: `harness.explorer.error.markDoneNoPass`, `...markDoneNoEvidence`, `...flagBlockerTerminal`, `...flagBlockerEmptyReason`, `...deleteHasReferences`, `...stepUnreadable`, `...writeFailed` (`src/locales/ru.json:40–46`). Симметрия RU/EN не затрагивается.
- `src/commands/preDispatch.ts` не изменяется (Forbidden).
- Путь STEP-файла по-прежнему собирается как `<taskDirectory>/<id>.md` (`readFreshStep:73`, `markDone:258`, `flagBlocker:290`, `deleteArtifact:332`) — это F-019, явно вынесенный в `## Out of scope`. Резолюция по `node.uri` здесь не делается; `expectedStepId`-проверка из Шага 1 к F-019 отношения не имеет (она сравнивает id внутри уже открытого файла, а не выбирает путь).
- Атомарность записи (file lock / CAS по mtime) не вводится — см. Risks.

### Impacted modules/files

- **Изменяется:** `src/explorer/actions.ts` — единственный production-файл. Затрагиваемые символы: приватный `writeStepFile` (`:337–352`), `markDone` (`:224–261`), `flagBlocker` (`:263–293`), `deleteArtifact` (`:301–335`), новый приватный `evaluateDeleteGuard`, новый `import type { ValidationResult }`.
- **Изменяется:** `tests/unit/explorer/actions.test.ts` — новые регрессионные `describe`-блоки (см. Test strategy).
- **Читаются, но не изменяются:** `src/explorer/guards.ts`, `src/explorer/stepWriter.ts`, `src/explorer/treeProvider.ts`, `src/commands/{preDispatch,stepPicker}.ts`, `src/parser/**`, `src/locales/**` (существующей поверхности мока `window.showWarningMessage`/`showInputBox`/`workspace.fs.{readFile,writeFile,delete}`/`workspace.findFiles` достаточно).
- **Изменяется (уточнено по факту, см. `## Evidence` и finding F-001 review `REVIEW-2026-09-18T1157.md`):** `tests/mocks/vscode.ts` — потребовался минимальный класс-стаб `RelativePattern`, которого план не предвидел; исходное допущение «существующей поверхности мока достаточно» было неверным именно в этой части.
- **Не создаются новые файлы.** `package.json`, `package.nls*.json`, `src/extension.ts`, `resources/**`, integration-тесты не трогаются: набор команд и их аргументы не меняются.

### Data / API implications

- Публичная поверхность расширения не меняется: ни одного нового/переименованного `harness.explorer.*` command id, аргументы команд прежние, `package.json` не трогается → integration-тесты (15) остаются валидными без правок.
- Экспортируемые сигнатуры `markDone`/`flagBlocker`/`deleteArtifact` не меняются (то же число и порядок параметров) — `src/explorer/activation.ts` не правится.
- Контракт `stepWriter.ts` (`setStatus`/`setBlocker`/`setStatusAndBlocker`) не меняется — обещание STEP-006 «STEP-007/STEP-010 переиспользуют этот модуль» остаётся в силе.
- Формат STEP-файла (ADR-002) не затрагивается: изменений в правилах записи нет, только в условиях допуска к записи.
- **Новая конвенция для STEP-007/STEP-008:** любое мутирующее действие над STEP-файлом обязано проверять guard на том же чтении, из которого строится записываемый контент. Guarded-write в `actions.ts` — образец; дублировать второй writer запрещено (уже зафиксировано STEP-006).
- Миграции данных, изменения схем и обратной совместимости нет — поведение меняется только в направлении «строже отказывать».

### Test strategy

Всё новое покрытие — в `tests/unit/explorer/actions.test.ts` (Jest, мок `vscode` из `tests/mocks/vscode.ts`, реальные файлы во временном каталоге `mkdtemp`, как в существующих `describe` для F-002/F-003/F-015). Приём воспроизведения гонки: `vscode.window.showWarningMessage.mockImplementation(async () => { <перезапись fixture-файла>; return 'harness.explorer.confirm.yes'; })` — мок i18n в этом файле возвращает сам ключ для строк без параметров, поэтому сравнение `confirmed !== i18n.t('harness.explorer.confirm.yes')` в коде проходит.

Новый `describe('STEP-014 (F-018): guard перепроверяется на свежем контенте непосредственно перед записью')`:

1. **`markDone`, verdict меняется во время модалки.** На диске `Latest verdict: PASS` + непустой Evidence (пред-диалоговый guard проходит); мок `showWarningMessage` переписывает файл на `FAIL` и возвращает подтверждение. Assert: `vscode.workspace.fs.writeFile` **не вызван**, `showErrorMessage` получил `harness.explorer.error.markDoneNoPass`, содержимое файла на диске по-прежнему без `**Статус:** Выполнено`.
2. **`markDone`, Evidence опустошается во время модалки.** Тот же приём, ожидание — `harness.explorer.error.markDoneNoEvidence`, записи нет.
3. **`markDone`, файл удалён/повреждён во время модалки.** Мок удаляет файл (или пишет пустую строку) перед возвратом подтверждения. Ожидание — `harness.explorer.error.stepUnreadable`, отсутствие необработанного reject (тест падает на текущей реализации по unhandled rejection/отсутствию сообщения).
4. **Контрольный (анти-тавтологический) кейс `markDone`.** Файл во время модалки не меняется → `writeFile` вызван ровно один раз, повторный `parseStepFile` с диска даёт `status === 'Выполнено'`. Без этого кейса все предыдущие проходили бы и на «сломанной наглухо» реализации.
5. **`deleteArtifact`, входящая ссылка появляется во время модалки.** `vscode.workspace.findFiles` мокируется по вызовам: первый вызов (пред-диалоговый `listAllSteps`) → только сам target; после подтверждения → target + новый STEP с `Depends on: <target>` (реальные файлы в tmpdir, `Uri.file` мока возвращает `{ fsPath }`, `listStepFiles` читает их через `node:fs`). Assert: `vscode.workspace.fs.delete` **не вызван**, `showErrorMessage` получил `harness.explorer.error.deleteHasReferences`.
6. **Контрольный кейс `deleteArtifact`.** Ссылок не появилось → `fs.delete` вызван с `{ useTrash: true }`.
7. **Регрессия `flagBlocker` (Acceptance criteria).** Валидный сценарий сквозь новый guarded-write: `showInputBox` возвращает причину, файл не меняется → одна запись, с диска читаются `**Статус:** Заблокировано` и текст причины в `## Blocker / Failure reason`. Дополнительно сохраняются существующие кейсы F-003/F-015 для `flagBlocker` — они не должны потребовать правок.

Существующие 7 кейсов в `actions.test.ts` и остальные тесты `tests/unit/explorer/**` правиться не должны; любая вынужденная правка существующего ассерта — сигнал, что изменено поведение за пределами scope, и должна быть явно объяснена в Evidence.

**Анти-тавтологическая проверка (обязательна, приём из FIX STEP-006):** каждый из кейсов 1, 2, 3, 5 прогнать на временно откаченной реализации (`git stash` правки `actions.ts`) и убедиться, что он падает именно ожидаемым ассертом; результат зафиксировать в Evidence. Кейсы 4, 6, 7 — наоборот, должны проходить и до, и после фикса.

### Verification sequence

1. `npm run compile` (`tsc --noEmit`, strict) — 0 ошибок.
2. `npm run lint` — 0 ошибок/предупреждений.
3. `npm run build` (esbuild) — бандл собирается.
4. `npm test` (Jest) — **все 140 существующих тестов зелёные без правок ассертов** + новые кейсы STEP-014 (ожидаемо 7).
5. `npm run test:integration` (`@vscode/test-cli`, headless VSCode) — **15/15 зелёные** без изменений в `tests/integration/explorer.test.js`.
6. Анти-тавтологический прогон из Test strategy (временный revert) — зафиксировать, какой ассерт падает в каждом из кейсов 1/2/3/5.
7. `git status --short` — изменены ровно два файла (`src/explorer/actions.ts`, `tests/unit/explorer/actions.test.ts`); `src/commands/**`, `src/parser/**`, `src/locales/**`, `package.json` не тронуты (проверить отдельным `git status --short` по этим путям); `tests/fixtures/workspace/` не испорчен прогоном.

(`python3 tools/harness/validate.py --mode commit` — не verification этого STEP, а обязательный pre-commit gate по `AGENTS.md` §17.)

### Risks / rollback

- **Остаточное окно сохраняется, но становится микроскопическим.** Между чтением №2 (с re-guard) и `writeFile`/`fs.delete` по-прежнему нет атомарности: конкурентная запись агента в этот зазор будет перезаписана (last-writer-wins). Окно сокращается с неограниченного (ожидание человека) до одного асинхронного I/O-хопа. Полное устранение требует file lock либо CAS по mtime/хэшу — это отдельное устойчивое решение (потенциальный ADR) и в `## Scope` STEP-014 не входит. Зафиксировать этот остаток в Evidence явно, чтобы REVIEW не принял его за упущение.
- **Риск тавтологичных тестов** (мок гонки легко написать так, что он проходит на любой реализации) — снимается контрольными кейсами 4/6/7 и обязательным temporary-revert прогоном.
- **Риск скрытой регрессии `flagBlocker`** при переводе на общий guarded-write — снимается кейсом 7 и сохранением существующих F-003/F-015 кейсов.
- **Риск расползания scope** на F-019 (путь по `<id>.md`): проверка `expectedStepId` внутри открытого файла может выглядеть как «частично F-019». Граница: STEP-014 не меняет *способ выбора пути*, только валидирует содержимое уже открытого файла. Любая правка резолюции пути — вне scope.
- **Ручная проверка в EDH** по-прежнему недоступна в non-interactive сессии (так было во всех трёх проходах STEP-006). Компенсируется unit-покрытием именно vscode-facing слоя `actions.ts` — того самого, где живут F-002/F-003/F-015/F-018.
- **Rollback:** изменения локализованы в одном production-файле; откат = `git checkout src/explorer/actions.ts tests/unit/explorer/actions.test.ts`. Ни один другой модуль, контракт или командная поверхность не затрагиваются, поэтому откат не задевает STEP-003/004/005/006.

### Handoff

`IMPLEMENT STEP-014`.

## Evidence

Реализация выполнена буквально по `## Implementation plan` (revision 1); отклонение от плана — одно, зафиксировано ниже.

### Изменённые файлы

- `src/explorer/actions.ts` — единственный production-файл (как и планировалось):
  - `writeStepFile` (`:337` было → guarded-write) получила параметры `expectedStepId` и `reguard`; `readFile` обёрнут в `try/catch` (fail-closed `stepUnreadable`), добавлена проверка `parsed.value.data.id !== expectedStepId`, `reguard(parsed.value.data)` вызывается перед `transform`.
  - `markDone` передаёт `reguard = (fresh) => canMarkDone(fresh)`; пред-диалоговый `canMarkDone` и безусловный `provider.invalidate('tasks')` сохранены как в плане.
  - `flagBlocker` передаёт `reguard = (fresh) => canFlagBlocker(fresh, reason)` через тот же guarded-write.
  - `deleteArtifact` использует новый приватный `evaluateDeleteGuard(workspaceRoot, manifest, stepId)` (инкапсулирует прежние `listAllSteps`/`listAllReqs`/`listAllAdrs` + `canDelete`), вызванный дважды: до модалки (UX) и сразу после подтверждения перед `vscode.workspace.fs.delete`.
  - Добавлен `import type { ValidationResult } from '../commands/preDispatch';`. `src/commands/preDispatch.ts` не менялся.
- `tests/unit/explorer/actions.test.ts` — новый `describe('STEP-014 (F-018): guard перепроверяется на свежем контенте непосредственно перед записью')` с 7 кейсами (см. ниже) + вспомогательный фикстурный шаблон `REFERENCING_STEP_TEMPLATE`.
- `planning/tasks/STEP-014.md` — этот файл (Статус, Evidence).

### Отклонение от плана (зафиксировано, не является скрытым upsize scope)

- **`tests/mocks/vscode.ts` пришлось изменить**, хотя `## Implementation plan → Impacted modules/files` относил его к «читаются, но не изменяются» с обоснованием «существующей поверхности мока достаточно». На практике `deleteArtifact` — и до, и после фикса — вызывает `evaluateDeleteGuard` → `listAllSteps` → `listStepFiles` → `new vscode.RelativePattern(...)`, а класса `RelativePattern` в моке не было вовсе (ни один существующий тест не проходил через этот путь: target всегда резолвился через объект `HarnessNode`, минуя `listAllSteps` для резолюции, но `deleteArtifact` всё равно безусловно вызывает `evaluateDeleteGuard`). Без стаба `new vscode.RelativePattern(...)` бросает `TypeError: ... is not a constructor` ещё до вызова замоканного `findFiles`. Добавлен минимальный класс-стаб (конструктор без логики, 8 строк) — единственное изменение мока, обосновано в комментарии внутри файла. Существующие 140 тестов это не затронуло (подтверждено прогоном).

### Verification sequence — результаты

1. `npm run compile` (`tsc --noEmit`) — 0 ошибок.
2. `npm run lint` (`eslint src`) — 0 ошибок/предупреждений.
3. `npm run build` (`node esbuild.config.mjs`) — `esbuild: build complete.`
4. `npm test` (Jest) — **147/147 passed** (16 test suites), из них 140 существующих без единой правки ассертов + 7 новых STEP-014. Время: ~3.3–3.5s.
5. `npm run test:integration` (`@vscode/test-cli`, headless VSCode) — **15/15 passing**, `tests/integration/explorer.test.js` не менялся.
6. Анти-тавтологический прогон (`git stash push -- src/explorer/actions.ts`, тесты и мок оставлены) → `npx jest tests/unit/explorer/actions.test.ts -t "STEP-014"`:
   - Кейс 1 (verdict → FAIL во время модалки): упал на `expect(vscode.workspace.fs.writeFile).not.toHaveBeenCalled()` — `Received number of calls: 1` (запись всё же произошла на устаревшем guard'е).
   - Кейс 2 (Evidence опустошается): упал на том же ассерте — `writeFile` вызван 1 раз.
   - Кейс 3 (файл удалён во время модалки): упал на `resolves.toBeUndefined()` — промис `markDone` **реджектится** (`ENOENT: no such file or directory, open '.../STEP-009.md'`), т.е. до фикса это ровно необработанный reject, о котором предупреждает `## Context`.
   - Кейс 5 (входящая ссылка появляется во время модалки delete): упал на `expect(vscode.workspace.fs.delete).not.toHaveBeenCalled()` — `Received number of calls: 1`.
   - Контрольные кейсы 4/6/7 в том же прогоне (`npx jest tests/unit/explorer/actions.test.ts -t "STEP-014"` → `7 skipped, 7 passed, 14 total`) прошли на откаченной реализации, как и требует Test strategy; `7 skipped` — это существующие тесты файла (F-002/F-003/F-015 из STEP-006), отфильтрованные `-t`, а не пропущенные кейсы STEP-014 (исправлено по finding F-006 review `REVIEW-2026-09-18T1157.md`; прежняя формулировка ошибочно занижала собственный результат).
   - После прогона: `git stash pop` — реализация восстановлена; `npm test` повторно даёт 147/147.
7. `git status --short` после всех изменений: `planning/tasks/STEP-014.md`, `src/explorer/actions.ts`, `tests/mocks/vscode.ts`, `tests/unit/explorer/actions.test.ts`. `src/commands/**`, `src/parser/**`, `src/locales/**`, `package.json`, `tests/integration/**` не тронуты (проверено отдельно).

### Остаточный риск (ожидаемый, зафиксирован по требованию плана)

Между чтением №2 внутри `writeStepFile`/`evaluateDeleteGuard` (второй вызов) и самой `writeFile`/`fs.delete` по-прежнему нет атомарности: конкурентная запись STEP-файла агентом (ADR-004) в этот микроскопический асинхронный зазор будет перезаписана по правилу last-writer-wins. Это не регрессия и не новый дефект — окно сокращено с «неограниченное время ожидания человека у модалки» до «один асинхронный I/O-хоп», что и было целью `## Scope`. Полное устранение потребовало бы file lock либо CAS по mtime/хэшу файла — устойчивое архитектурное решение вне `## Scope` STEP-014 (см. `## Implementation plan → Risks`). Фиксируется явно, чтобы REVIEW не счёл это упущением.

### FIX-проход (по `REVIEW-2026-09-18T1157.md`, findings F-001/F-002/F-005/F-006/F-007)

`FIX STEP-014` применён к non-blocking findings первого review в пределах разрешённого §11 EXECUTION_PROTOCOL.md scope (`AGENTS.md` §11: reviewer не является автором фикса; здесь фикс — механическая корректировка задокументированных Low-находок, не новый feature/refactor). F-003 и F-004 **не тронуты** — review сам квалифицировал их как кандидатов отдельного corrective STEP (hardening Explorer вместе со STEP-006 F-019..F-022), а не как предмет этого FIX-прохода.

- **F-002 (пробелы покрытия `writeStepFile`).** Добавлены два кейса в `tests/unit/explorer/actions.test.ts` → `describe('STEP-014 (F-018)…')`: (а) `showWarningMessage` переписывает fixture-файл в нечитаемый (пустая строка) контент во время модалки `markDone` → `harness.explorer.error.stepUnreadable`, `writeFile` не вызван; (б) `showWarningMessage` подменяет содержимое тем же путём на другой STEP (`REFERENCING_STEP_TEMPLATE`, id `STEP-010`) → та же ветка `stepUnreadable` через проверку `parsed.value.data.id !== expectedStepId`. Оба — только `tests/unit/explorer/**`, внутри `## Mutation policy → Allowed`.
- **F-005 (нет негативного теста на re-guard `flagBlocker`).** Добавлен кейс, воспроизводящий именно асинхронный зазор между `readFreshStep` (чтение №1) и вторым чтением внутри `writeStepFile`, а не более ранний путь через `showInputBox`: `vscode.workspace.fs.readFile` замокан так, что на **втором** вызове (чтение №2 внутри guarded-write) переписывает fixture-файл на терминальный статус `Отменено` перед возвратом содержимого. Guard первого чтения (`readFreshStep`) проходит на ещё-нетерминальном статусе; re-guard на чтении №2 ловит терминальный статус → `harness.explorer.error.flagBlockerTerminal`, `writeFile` не вызван.
- **Анти-тавтологическая проверка (обязательна для новых негативных кейсов, приём из FIX STEP-006).** `git stash push -- src/explorer/actions.ts` → `npx jest tests/unit/explorer/actions.test.ts -t "F-002|F-005|unparseable|подменяется|терминальным"`: все три новых кейса падают на откаченной реализации ожидаемыми ассертами (unparseable-кейс падает на `writeFailed`/verify-mismatch вместо `stepUnreadable`; id-mismatch и flagBlocker-терминал кейсы падают на `writeFile`/`toHaveBeenCalledTimes` — запись всё же происходит). `git stash pop` восстановил фикс; `npm test` после восстановления снова зелёный.
- **F-001 (traceability `tests/mocks/vscode.ts`).** `## Deliverables` и `## Implementation plan → Impacted modules/files` дополнены явным упоминанием изменённого `tests/mocks/vscode.ts` (класс-стаб `RelativePattern`) — устранено расхождение, отмеченное review.
- **F-006 (неточность п.6 Evidence про `jest -t`).** Буллет про анти-тавтологический прогон переписан на фактическое поведение: `7 skipped` — это существующие тесты файла (F-002/F-003/F-015 STEP-006), отфильтрованные `-t "STEP-014"`, а не пропущенные контрольные кейсы STEP-014; контрольные 4/6/7 прошли в том же прогоне, как и требовала Test strategy.
- **F-007 (projection drift).** `planning/PLAN.md` и `planning/STATUS.md` синхронизированы с этим закрытием STEP-014 (см. отдельные правки этих файлов в этом же коммите).

Product code (`src/explorer/actions.ts`) в рамках этого FIX-прохода **не менялся** — все findings были либо тестовым покрытием, либо документацией/traceability, что и предсказывал review (`Handoff` → «ни то, ни другое не требует изменения product code»).

### Verification sequence FIX-прохода — результаты

1. `npm run compile` (`tsc --noEmit`) — 0 ошибок.
2. `npm run lint` (`eslint src`) — 0 ошибок/предупреждений.
3. `npm run build` (`node esbuild.config.mjs`) — `esbuild: build complete.`
4. `npm test` (Jest) — **150/150 passed** (16 test suites): 147 из первого прохода + 3 новых (F-002 ×2, F-005 ×1).
5. `npm run test:integration` (`@vscode/test-cli`, headless VSCode 1.138.0) — **15/15 passing**, `tests/integration/explorer.test.js` не менялся.
6. Анти-тавтологический прогон новых кейсов (см. выше) — все три падают на откаченной реализации ожидаемыми ассертами; после `git stash pop` `npm test` снова 150/150.
7. `python3 tools/harness/validate.py --mode commit` — **PASS**, 273 файла (единственное WARNING — «no staged files yet», информационное).
8. `git status --short` после FIX-прохода: изменены `planning/tasks/STEP-014.md`, `tests/unit/explorer/actions.test.ts` (плюс синхронизация `planning/PLAN.md`/`planning/STATUS.md` отдельно по F-007); `src/explorer/actions.ts`, `src/commands/**`, `src/parser/**`, `src/locales/**`, `package.json`, `tests/integration/**`, `tests/mocks/vscode.ts` не тронуты этим FIX-проходом (mock изменён первым IMPLEMENT-проходом, зафиксировано выше).

## Review status

**Latest verdict:** PASS
**Latest report:** `planning/reviews/STEP-014/REVIEW-2026-09-18T1157.md`

Первый review цикла (независимый reviewer, 2026-09-18T1157 UTC). Blocking-дефектов нет. Deterministic verification перезапущена независимо и совпала с Evidence (compile/lint/build чисто, `npm test` 147/147, `npm run test:integration` 15/15, `validate.py --mode commit` PASS). Анти-тавтологический прогон воспроизведён ревьюером самостоятельно: на откаченном `actions.ts` падают ровно кейсы 1/2/3/5, контрольные 4/6/7 проходят. Изменение `tests/mocks/vscode.ts` квалифицировано как оправданное минимальное supporting-изменение, а не нарушение scope discipline. Семь non-blocking findings (все Low): F-001 (дописать `tests/mocks/vscode.ts` в Deliverables), F-002/F-005 (пробелы покрытия новых защитных веток), F-003/F-004 (асимметрии; F-003 принадлежит Out of scope F-019), F-006 (неточность п.6 Evidence про `jest -t`), F-007 (projection drift PLAN/STATUS). Закрытие в `Выполнено` разрешено по §10.9 при механическом выполнении §25.

**FIX-проход (2026-09-18, после review).** F-002, F-005, F-001, F-006, F-007 устранены (см. `## Evidence → FIX-проход`); F-003/F-004 сознательно не тронуты — они вне scope этого FIX (кандидаты отдельного corrective STEP, как явно указал review). Product code не менялся, новый review-цикл по §11 EXECUTION_PROTOCOL.md не требуется (review сам это подтвердил: «ни то, ни другое не требует изменения product code и не является предметом нового review-цикла»). Deterministic verification FIX-прохода — см. выше, все проверки зелёные. Закрытие STEP-014 в `Выполнено` производится в рамках этого FIX-прохода по разрешению §10.9 исходного PASS-review.

## Blocker / Failure reason

—
