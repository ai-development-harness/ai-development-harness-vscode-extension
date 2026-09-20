# STEP-025 — Адаптировать REQ-consumers к per-file docs/requirements/REQ-NNN-*.md

**Статус:** Выполнено
**Type:** BUGFIX
**Приоритет:** Критический
**Фаза:** MVP stabilization
**Depends on:** STEP-024

## Requirements

- REQ-001, REQ-002

## ADR

- ADR-002, ADR-005 (Superseded by ADR-012 within this STEP), ADR-012 (новый, Supersedes ADR-005)

## Risk flags

- architecture

## Goal

Восстановить корректное чтение и парсинг REQ-артефактов после того, как canonical requirements перешли на per-file layout (`docs/requirements/REQ-NNN-*.md` + `SPEC.md` как чистый индекс), не ломая существующую `docs/requirements/STATUS.md` traceability projection.

## Context

`docs/requirements/SPEC.md` и отдельные `docs/requirements/REQ-NNN-*.md` уже находятся в per-file layout, где `SPEC.md` содержит только таблицу ссылок, а определение/rationale/acceptance/traceability каждого REQ — в собственном файле. Manifest (`.harness/manifest.yaml` → `sources.requirements`) уже указывает на каталог `docs/requirements`, а не на единственный файл.

Production-код, однако, всё ещё реализует более раннюю модель "один файл SPEC.md с несколькими REQ-NNN секциями" (`src/parser/markdownParser.ts:parseReqSpec`, комментарий `docs/requirements/SPEC.md (несколько REQ-NNN в одном файле)`):

- `src/explorer/paths.ts` объявляет источник requirements как `{ kind: 'file', relPath: manifest.sources.requirements, parseAs: 'req' }` — то есть как один файл, а не как `{ kind: 'dir', ... }`, как уже сделано для `tasks`/`adr`.
- `src/explorer/model.ts` (`buildNodesForFile`) и `src/explorer/actions.ts` (`listReqsForDelete`) читают `manifest.sources.requirements` через `readFile`, что для каталога завершается ошибкой чтения, которая молча проглатывается (`console.warn` / `{ available: false }`).
- `src/editor/validation.ts` вызывает `parseReqSpec(sources.requirements)` с тем же результатом.

Итог: Sidebar Explorer не показывает узлы Requirements, definition/validation-провайдеры в редакторе не резолвят REQ-ссылки, а `listReqsForDelete` (guard от удаления REQ, на который ещё ссылаются STEP) молча возвращает `available: false` — то есть защита от удаления REQ фактически отключена на текущем layout. Это architecture drift между Accepted ADR-002/ADR-005 (manifest-driven resolution, единый parser layer) и фактическим состоянием per-file `docs/requirements/`.

`docs/requirements/STATUS.md`-парсер (`src/parser/requirementsStatus.ts`) уже корректен для текущего layout и менять его не требуется.

## Scope

- Добавить parser layer для одного REQ-файла (`docs/requirements/REQ-NNN-*.md`) по существующему `docs/requirements/TEMPLATE.md`, переиспользуя `ADR-002`-семейство (labeled markdown секции), без реализации YAML frontmatter.
- Перевести `src/explorer/paths.ts` на `{ kind: 'dir', relDir: manifest.sources.requirements, glob: 'REQ-*.md', parseAs: 'req' }` по аналогии с `tasks`/`adr`.
- Обновить `src/explorer/model.ts`, `src/explorer/actions.ts` (`listReqsForDelete`) и `src/editor/validation.ts` на чтение каталога REQ-файлов вместо одного файла.
- Сохранить существующее поведение `docs/requirements/STATUS.md` (`requirementsStatus` artifact path, `reqStatusMap`) без изменений контракта.
- Обновить/добавить fixtures и unit/Extension Host regression тесты на актуальный per-file layout (в дополнение к существующим, а не вместо них, если старый single-file layout ещё встречается где-то в тестах намеренно как legacy fixture).
- Принять `ADR-012` (`Supersedes: ADR-005`), фиксирующий исправленную формулу `requirementsStatus = join(sources.requirements, 'STATUS.md')` для directory-anchor текущей manifest schema; исправить сам derivation в `src/parser/artifactPaths.ts` по этой формуле; проставить `ADR-005` `Superseded by: ADR-012`, не переписывая остальной текст ADR-005 задним числом (решение root-agent, см. Implementation plan п.0.3).

## Mutation policy

### Allowed

- `src/parser/**`, `src/explorer/**`, `src/editor/validation.ts`, `src/editor/definitionProvider.ts` (только вызовы REQ-parsing), `src/editor/activation.ts` (только REQ index loading в `loadIndex` и `stepEditorWatchPatterns`), связанные `tests/**` и fixtures, `docs/adr/ADR-012-*.md` (новый файл), `docs/adr/ADR-005-*.md` (только поле `Superseded by`), `docs/architecture.md`/traceability-projections, затронутые ADR-012.

### Conditional

- Изменение `src/parser/types.ts` (`ReqData`/`ArtifactSourceItem`) — только если новый per-file parser не укладывается в существующие типы без расширения.

### Forbidden

- Изменение `docs/requirements/**` содержимого (уже в целевом layout).
- Изменение `docs/requirements/STATUS.md` parser-контракта (`src/parser/requirementsStatus.ts`) без доказанной необходимости.
- Работа над scope STEP-024 (control-plane `.harness/**` paths) — этот STEP не переносит `.project/**`→`.harness/**`, а адаптирует REQ-consumers к уже актуальному per-file layout поверх результата STEP-024.
- Реализация REQ-007/008/009/010 (Phase 2, отложено).

## Out of scope

- Любые изменения `docs/requirements/REQ-NNN-*.md`, `SPEC.md`, `STATUS.md` как контента — они уже в целевой форме.
- UI/UX доработки Explorer сверх восстановления корректного отображения REQ-узлов.
- Любой новый ADR, кроме `ADR-012` (`Supersedes: ADR-005`), явно ограниченного исправлением формулы `requirementsStatus` под directory-anchor; сам двухуровневый precedence/registry/запрет probing из ADR-005 не пересматривается.

## Acceptance criteria

- Sidebar Explorer показывает узлы Requirements для текущего `docs/requirements/*.md` layout репозитория без ошибок чтения.
- `listReqsForDelete`/аналогичный delete-reference guard корректно резолвит существующие REQ и не деградирует молча до `available: false` на per-file layout.
- Editor validation/definition provider резолвят REQ-ссылки (`REQ-NNN`) на актуальный per-file layout.
- `docs/requirements/STATUS.md`-based статус (`reqStatusMap`) продолжает корректно сопоставляться с REQ-узлами.
- Регрессионные тесты доказывают поведение на fixture, скопированном с реального per-file layout (`docs/requirements/TEMPLATE.md` + пример REQ-NNN файла).

## Verification

- `npm run compile`
- `npm test` (или актуальный test script проекта — уточнить фактическую команду перед PLAN/IMPLEMENT)
- Ручная/Extension Host проверка: Sidebar Explorer открывает REQ-узел и переходит в правильный `REQ-NNN-*.md` файл.

## Deliverables

- Новый/обновлённый parser для single-REQ-file layout.
- Обновлённые `src/explorer/paths.ts`, `src/explorer/model.ts`, `src/explorer/actions.ts`, `src/editor/validation.ts`.
- Обновлённые/новые fixtures и regression-тесты.
- `docs/adr/ADR-012-*.md` (Accepted, Supersedes ADR-005), `docs/adr/ADR-005-*.md` с обновлённым полем `Superseded by`.

## Implementation plan

**Plan status:** Ready
**Plan revision:** 3
**Planned at:** 2026-09-20T15:43:11+00:00
**Plan basis:** sha256:8a280eced2e48711a29ae2d4490854951b68484121a9e9d0ae2c4076c0363f85

### 0. Предусловия и решения, которые нужно принять до IMPLEMENT

**0.1. Dependency STEP-024 — выполнена фактически.** Проверено по факту, а не по
`**Статус:**`: реализация control-plane `.harness/**` находится в commits `870e728` и
`7f1686a` на текущей ветке `chore/harness-v053-control-plane`; рабочее дерево не содержит
ни одной незакоммиченной правки `src/**` или `tests/**` (`git status` показывает только
`docs/requirements/REQ-001|REQ-002`, `docs/requirements/STATUS.md`, `planning/PLAN.md`,
`planning/STATUS.md` и untracked `planning/tasks/STEP-025.md`). Последний review-цикл
STEP-024 (`planning/reviews/STEP-024/REVIEW-2026-09-20T1505Z.md`) — `PASS`. Коллизии с
in-flight правками STEP-024 в общих файлах (`src/parser/**`, `src/explorer/**`,
`src/editor/validation.ts`) нет; STEP-025 стартует с чистого STEP-024 baseline.

**0.2. Требуется расширение Mutation policy → Allowed на `src/editor/activation.ts`.**
Acceptance criterion «Editor validation/definition provider резолвят REQ-ссылки» физически
недостижим без правки `loadIndex` и `stepEditorWatchPatterns` в `src/editor/activation.ts`
(именно там `manifest.sources.requirements` читается как один файл, строки 170 и 305), а
текущий Allowed-список перечисляет из `src/editor/**` только `validation.ts` и
`definitionProvider.ts`. Root-agent должен добавить `src/editor/activation.ts` в Allowed с
ограничением «только REQ index loading и watch patterns» до начала IMPLEMENT.
`src/explorer/refresh.ts` расширения не требует — он уже внутри `src/explorer/**`.

**0.3. Architecture drift относительно ADR-005 — отдельное решение root-agent.** ADR-005
(Decision, таблица derivations для `harness.version: "1"`) буквально фиксирует
`requirementsStatus = join(dirname(sources.requirements), "STATUS.md")`. Правило написано
под anchor-файл (`docs/requirements/SPEC.md`). На текущем manifest `sources.requirements`
— каталог (`docs/requirements`), поэтому правило сейчас вычисляет **`docs/STATUS.md`**,
которого не существует: `readReqStatuses` ловит ошибку чтения, статусы REQ пусты, а watcher
следит за несуществующим путём. Это второй, независимый от `parseReqSpec` дефект того же
корня, и без его исправления acceptance criterion про `reqStatusMap` невыполним. Само
исправление (`join(sources.requirements, 'STATUS.md')`) лежит в Allowed (`src/parser/**`) и
не меняет устойчивое решение ADR-005 (двухуровневый precedence, единый registry, запрет
probing сохраняются) — меняется только конкретное compatibility rule под изменившуюся
upstream-схему manifest. Но текст Accepted ADR-005 после этого становится неточным, а
AGENTS.md §2 запрещает править Accepted ADR задним числом. Решение root-agent (одно из):
(a) отдельный ADR-012 с `Supersedes: ADR-005` — тогда Out of scope STEP-025 («Новый ADR»)
нужно снять; (b) отдельный corrective STEP на приведение ADR-005 в соответствие. Код по
п.2 ниже реализуется в любом случае — это bugfix, а не изменение решения.

**0.4. `src/parser/types.ts` (Conditional).** План использует одно additive-расширение
`MarkdownParseError` (см. п.1). Это подпадает под Conditional и должно быть отмечено в
Evidence как осознанное расширение типов.

### 1. Parser: `parseReqFile` для одного `REQ-NNN-*.md`

Файл: `src/parser/markdownParser.ts`.

Новый экспорт по образцу `parseAdrFile`/`parseStepFile` (одиночный артефакт, `data` — объект,
не массив):

```ts
export function parseReqFile(
  content: string
): Result<{ data: ReqData; warnings: ParseWarning[] }, MarkdownParseError>
```

Реализация переиспользует уже существующую ADR-002 machinery, без нового формата и без YAML
frontmatter: `splitSections`, `REQ_TITLE_RE`, `extractBoldLabels`, `childSections`,
`extractLabeledBullets`, `extractBulletItems`, `extractIds`, `countLabeledBullets`,
`isValidStepReference`. Тело текущего цикла `parseReqSpec` (строки ~400-455) выносится в
приватный `readReqAt(sections, idx, warnings): ReqData`; `parseReqFile` вызывает его для
единственного найденного REQ-заголовка. Секционная логика уже level-agnostic
(`childSections` сравнивает уровни, а не абсолютный `###`), поэтому per-file layout
`# REQ-NNN — …` + `## Requirement|Rationale|Acceptance|Traceability` разбирается той же
функцией — новый формат не вводится. `ReqData` не меняется.

Fail-closed контракт:

- пустой контент → `err({ kind: 'empty-content' })`;
- нет секций → `err({ kind: 'missing-heading' })`;
- ноль заголовков, matching `REQ_TITLE_RE` → `err({ kind: 'missing-heading' })` — это то, что
  защищает index `SPEC.md` и `STATUS.md` от разбора как REQ;
- больше одного REQ-заголовка в файле → `err({ kind: 'multiple-headings' })` (additive-вариант
  в `MarkdownParseError`, см. п.0.4). Деградация «взять первый + warning» здесь недопустима:
  delete-guard оценивает warnings только по traceability-полям, и потерянный второй REQ дал бы
  молчаливую dangling-ссылку — ровно тот дефект, который чинит этот STEP.
- Отсутствующие необязательные метки/секции (`Источник`, `Rationale`, `Traceability`) остаются
  warnings, не ошибкой — поведение `parseReqSpec` сохраняется дословно.

`parseReqSpec` удаляется в п.8, после миграции всех consumers (иначе останется мёртвый экспорт
и legacy-фикстура, противоречащая canonical layout).

### 2. Parser: derivation `requirementsStatus`

Файл: `src/parser/artifactPaths.ts`, строка 26:
`requirementsStatus: (manifest) => posix.join(manifest.sources.requirements, 'STATUS.md')`.

Anchor трактуется как каталог — так его объявляет текущая manifest schema Harness 0.5.3
(«Каталог canonical product requirements и их projections»). Dual-shape эвристика (если путь
кончается на `.md` → `dirname`, иначе → `join`) сознательно **не** вводится: это тот самый
dual-layout fallback, который STEP-024 устранил как принцип. `adrDirectory` не трогается.

### 3. Explorer: источники путей

Файл: `src/explorer/paths.ts`.

- `ArtifactSourceItem`: `parseAs` и `statusFrom` становятся общими для обоих вариантов —
  `parseAs?: 'step' | 'adr' | 'req'` и `statusFrom?: string` и в `file`-, и в `dir`-варианте
  (сейчас `statusFrom` объявлен только на `file`, а `'req'` отсутствует в `dir`).
- Группа `requirements`:
  `{ kind: 'dir', relDir: manifest.sources.requirements, glob: 'REQ-*.md', parseAs: 'req', ...(requirementsStatus ? { statusFrom: requirementsStatus } : {}) }`
  — ровно та же форма, что уже используется для `tasks`/`adr`.
- Glob `REQ-*.md` по построению исключает `SPEC.md`, `STATUS.md` и `TEMPLATE.md`; отдельный
  узел для index `SPEC.md` **не** добавляется (Out of scope: UI-доработки сверх восстановления
  REQ-узлов).
- Ветка неподдерживаемого поколения manifest (`requirementsStatus === undefined`) сохраняется:
  каталог читается, статусы пусты.

### 4. Explorer: построение узлов

Файл: `src/explorer/model.ts`.

- `loadGroupChildren`: условие чтения STATUS.md меняется с
  `item.kind === 'file' && item.statusFrom !== undefined` на `item.statusFrom !== undefined`
  (иначе dir-источник потеряет статусы). `readReqStatuses` остаётся как есть — вызывается один
  раз на группу, а не на REQ.
- `buildNodesForFile`, ветка `parseAs === 'req'`: `parseReqSpec` → `parseReqFile`; возвращается
  один узел `{ kind: 'req', uri: relPath, data: parsed.value.data, status: statusByReq.get(id) ?? '', groupId }`.
  Побочный полезный эффект: `uri` теперь указывает на конкретный `REQ-NNN-*.md`, а не на общий
  файл, — это и есть механика, закрывающая acceptance criterion про переход в правильный файл.
- Семантика деградации не меняется: ошибка чтения/разбора одного файла → `undefined` → `skipped++`
  → узел `harness.explorer.message.readError`.

### 5. Explorer: delete-reference guard

Файл: `src/explorer/actions.ts`, `listReqsForDelete` (строки 71-80).

Переписать один в один по образцу уже проверенного `listAdrsForDelete` (строки 82-99):
`readdir(path.join(workspaceRoot, manifest.sources.requirements))` → фильтр
`file.startsWith('REQ-') && file.endsWith('.md')` → `readFile` + `parseReqFile` по каждому →
любой `!parsed.ok` или `hasDeleteReferenceWarning(warnings, 'req')` → `{ available: false }`;
ошибка `readdir` → `{ available: false }`. `hasDeleteReferenceWarning` не меняется: поля
warnings `parseReqFile` сохраняют формат `${id}.traceability[.step]`. Это восстанавливает
fail-closed защиту, которая сейчас всегда деградирует в `available: false` (и потому ведёт себя
как «источник недоступен» на каждом удалении).

### 6. Editor: индекс и watchers

Файлы: `src/editor/validation.ts`, `src/editor/activation.ts` (см. п.0.2).

- `createEditorIndex`: параметр `requirements?: string` + `requirementsUri?: vscode.Uri`
  заменяется на `requirements: Array<{ content: string; uri?: vscode.Uri }>` — та же форма, что
  уже у `steps` и `adrs`. Внутри: цикл с `parseReqFile`, `index.requirements.set(id, { title, uri: source.uri })`.
- `loadIndex` (`activation.ts:304-310`): вместо `readFileSafely(requirementsPath)` —
  `readMarkdownDirectory(path.join(root, manifest.sources.requirements), /^REQ-\d+.*\.md$/)`;
  существующая функция уже даёт `{ content, uri }[]` и устойчива к исчезновению файла между
  `readdir` и `readFile`. Регексп намеренно требует цифры, чтобы `TEMPLATE.md` (`REQ-NNN`) не
  попал в индекс.
- `stepEditorWatchPatterns` (`activation.ts:170`): `manifest.sources.requirements` →
  `` `${manifest.sources.requirements}/REQ-*.md` `` (каталог как `RelativePattern` не матчится
  ни на что).
- `definitionProvider.ts` не меняется: он уже берёт `uri` из индекса; правильный per-REQ URI
  приходит из `loadIndex`.

### 7. Explorer: watchers

Файл: `src/explorer/refresh.ts`, `watchedPaths`, строка 36:
`{ groupId: 'requirements', relGlob: `${manifest.sources.requirements}/REQ-*.md` }`.
Строка со `statusFrom`-путём остаётся, но теперь резолвится в существующий
`docs/requirements/STATUS.md` благодаря п.2. Комментарий над функцией («`SPEC.md`») привести в
соответствие с per-file layout.

### 8. Удаление legacy single-file слоя

После п.1-7 у `parseReqSpec` не остаётся ни одного production consumer. Удалить: сам экспорт,
комментарий-заголовок `docs/requirements/SPEC.md (несколько REQ-NNN в одном файле)` и
`describe('parseReqSpec')` в `tests/unit/parser/markdownParser.test.ts` вместе с legacy-фикстурой
`tests/fixtures/requirements/SPEC.md` (это не намеренная legacy-фикстура, а устаревшая копия
бывшего canonical файла — сохранять её значит консервировать тот самый drift). Покрытие
переносится на `parseReqFile` (п.9). Если реализация покажет, что какой-то тест действительно
проверяет multi-REQ layout осмысленно, он переоформляется как негативный кейс
`multiple-headings`, а не как поддерживаемый формат.

### 9. Fixtures и тесты

Fixture-манифесты (`sources.requirements: docs/requirements/SPEC.md` → `docs/requirements`,
вместе с comment-строкой примера):
`tests/fixtures/manifest/initialized.manifest.yaml`,
`tests/fixtures/manifest/uninitialized.manifest.yaml`,
`tests/fixtures/projects/explorer/.harness/manifest.yaml`,
`tests/fixtures/workspace/.harness/manifest.yaml`,
`tests/fixtures/projects/apiContext/.harness/manifest.yaml`.

Fixture-контент (перевод в per-file layout по `docs/requirements/TEMPLATE.md`):

- `tests/fixtures/projects/explorer/docs/requirements/`: `SPEC.md` разбить на
  `REQ-001-fixture-a.md` и `REQ-002-fixture-b.md` (заголовок уровня 1, секции уровня 2);
  `STATUS.md` оставить без изменений (значения `Частично`/`Выполнено` продолжают доказывать
  источник статуса); вместо прежнего `SPEC.md` положить index-таблицу, чтобы негативный тест
  «index не разбирается как REQ» шёл на реальной форме.
- `tests/fixtures/workspace/docs/requirements/`: `SPEC.md` → `REQ-001-editor-definition.md`
  (+ index `SPEC.md`). Это workspace Extension Host-тестов.
- `tests/fixtures/requirements/`: вместо multi-REQ `SPEC.md` — самодостаточные
  `REQ-001-*.md` (полный валидный), `REQ-00X` с отсутствующими необязательными секциями и
  index `SPEC.md`; `STATUS.md` и `TEMPLATE.md` остаются. Фикстуры должны быть
  self-contained: нельзя ассертить на копию реального `docs/requirements/REQ-001-*.md`, у
  которого traceability меняется каждым STEP.
- `tests/unit/explorer/actions.test.ts::createEmptyReferenceSources` и все delete-guard кейсы,
  пишущие `docs/requirements/SPEC.md` (в т.ч. «нечитаемый REQ source», строки ~581-600 и
  ~683-720), переводятся на запись `docs/requirements/REQ-NNN-*.md`; кейс «нечитаемый источник»
  моделируется недоступным каталогом по образцу ADR-кейса (строка ~551).

Обновляемые существующие тесты (ожидания, не новая логика):
`tests/unit/parser/yamlParser.test.ts:20,36`; `tests/unit/explorer/paths.test.ts:40-47,64-68,79-80`
(включая relocated-кейс `knowledge/req` → `knowledge/req/STATUS.md`);
`tests/unit/parser/artifactPaths.test.ts:36,43`; `tests/unit/explorer/refresh.test.ts:18-29`;
`tests/unit/explorer/model.test.ts:27-64`; `tests/unit/explorer/treeItem.test.ts:35,48`;
`tests/unit/editor/activation.test.ts:24`; `tests/unit/editor/validation.test.ts:88`
(передача `requirements` массивом).

Новые regression-тесты (минимальный достаточный набор, каждый закрывает конкретный дефект):

1. `parseReqFile` на per-file фикстуре → один `ReqData`, `warnings: []`, корректные
   `priority`/`source`/`acceptance`/`traceability`.
2. `parseReqFile` на index `SPEC.md` → `err({ kind: 'missing-heading' })` (index-файл никогда не
   становится REQ-узлом).
3. `parseReqFile` на файле с двумя REQ-заголовками → `err({ kind: 'multiple-headings' })`.
4. `parseReqFile` на REQ без `Источник`/`Rationale`/`Traceability` → `ok` + ожидаемые warnings
   (деградация сохранена).
5. `resolveHarnessArtifactPath(manifest, 'requirementsStatus') === 'docs/requirements/STATUS.md'`
   для directory-anchor — пин ровно того вычисления, которое сейчас даёт `docs/STATUS.md`.
6. `loadGroupChildren` на explorer-фикстуре → узлы `REQ-001`/`REQ-002`, у каждого `uri` — свой
   `REQ-*.md`, статусы из `STATUS.md`; отсутствует узел `harness.explorer.message.readError`.
7. `loadGroupChildren`: `TEMPLATE.md`/`SPEC.md`/`STATUS.md` не порождают REQ-узлов.
8. `deleteArtifact` (через публичную поверхность, как существующие кейсы): удаление REQ, на
   который ссылается STEP, блокируется; контрольный кейс без входящих ссылок проходит;
   недоступный каталог requirements блокирует удаление. Это прямой gate на «guard не деградирует
   молча» — сейчас он провалится на текущем коде.
9. `stepEditorWatchPatterns` содержит `<requirements>/REQ-*.md` и ни одного «голого» пути каталога.
10. Extension Host: `tests/integration/editor.test.js:67` — Definition для `REQ-001` резолвится в
    `docs/requirements/REQ-001-*.md` (сейчас ассерт указывает на `SPEC.md`);
    `tests/integration/explorer.test.js` — группа `requirements` отдаёт req-узлы, а не
    `message`-узел.

### 10. Data / API compatibility

- `ReqData`, `ReqStatusEntry`, `parseReqStatus`, `reqStatusMap` — контракт не меняется;
  `src/parser/requirementsStatus.ts` не трогается (Forbidden соблюдён).
- `.harness/manifest.yaml` и `docs/requirements/**` не изменяются (Forbidden/Out of scope).
- Breaking изменения внутренних API — только внутри extension: `parseReqSpec` удаляется,
  `createEditorIndex` меняет сигнатуру, `ArtifactSourceItem` расширяется. Внешних потребителей
  нет; `package.json` contributions, команды, i18n-ключи и `harness.explorer.*` API не затронуты.
- Обратная совместимость с manifest, где `sources.requirements` указывает на файл, сознательно
  не поддерживается (см. п.2).

### 11. Verification

Последовательно из корня репозитория, с буквальным захватом exit code после каждой команды;
имена скриптов сверены с `package.json`:

- `npm run compile` (`tsc --noEmit`)
- `npm run lint` (`eslint src`)
- `npm run build`
- `npm test -- --runInBand` (`jest`; baseline STEP-024 — 25 suites / 327 tests)
- `npm run test:integration` (`vscode-test`; baseline — 27 passing)
- `npm run test:integration:pre-activation`
- `python3 .harness/tools/validate.py --mode manual`
- `git diff --check`

Ручная/Extension Host проверка из раздела Verification задачи покрывается п.9.10 в headless
Extension Host (прецедент STEP-006: review прямо разрешает эту замену ручному прогону).
`check-command-references.py` этим STEP не затрагивается (код и фикстуры, не command syntax).

### 12. Риски и rollback

- **ADR-005 (высокий).** См. п.0.3: без решения root-agent останется расхождение между кодом и
  текстом Accepted ADR. Реализация кода не блокируется, но review может справедливо отметить
  drift, если решение не зафиксировано.
- **Широкий fixture-churn (средний).** `tests/fixtures/manifest/*.yaml` используется
  commands/preDispatch/actions-сьютами. Митигация: менять манифесты и зависимый контент одним
  проходом и прогонять полный `npm test` сразу после п.9, до правок интеграционных тестов.
- **Расширение `MarkdownParseError` (низкий).** Все consumers уже обрабатывают `!parsed.ok`
  обобщённо; exhaustive-switch по kind в коде нет (проверить `tsc` — он это и поймает).
- **Удаление `parseReqSpec` (низкий).** Потеря покрытия multi-REQ формата — сознательная:
  формат перестал быть canonical; негативный кейс `multiple-headings` фиксирует новую норму.
- **Пустая группа Requirements при опечатке в glob (низкий).** Тесты 6 и 7 п.9 ловят обе
  стороны (и «ничего не нашли», и «нашли лишнее»).
- **Rollback.** Изменения разложены по независимым файловым группам (parser → paths → model →
  actions → editor → watchers → fixtures); откат — по группам, `git revert`/`git checkout --`
  до соответствующего шага. Данные не мигрируются, поэтому откат кода не требует обратной
  миграции артефактов.

## Evidence

**Deviation from plan (ADR ID).** Implementation plan п.0.3/1/пп.9-10 and Scope/Mutation policy/Deliverables specified the new ADR as `ADR-006` (`Supersedes: ADR-005`). Before creating the file, `docs/adr/README.md`/`ls docs/adr/` were checked and `docs/adr/ADR-006-agent-write-consent.md` (Accepted, unrelated decision) already exists in the repository — the plan's ID choice conflicted with `docs/adr/README.md` §"Правила" rule 5 (`ID не переиспользуется`). The new ADR was created as `docs/adr/ADR-012-requirements-status-directory-anchor.md` instead (next unused ID after `ADR-011`), with identical content/decision to what the plan specified for "ADR-006", and all task-file/code/test references to the new ADR updated to `ADR-012` accordingly (STEP-025.md `## ADR`, Scope, Mutation policy, Deliverables, Implementation plan п.0.3/133; `src/parser/artifactPaths.ts` comments; `docs/adr/ADR-005-artifact-path-resolution.md` `Superseded by`; `docs/adr/README.md` index). No other part of the plan's approach changed.

**Code changes (Allowed/Conditional scope).**
- `src/parser/types.ts`: added `MarkdownParseError` variant `{ kind: 'multiple-headings' }` (Conditional, per plan п.0.4/1).
- `src/parser/markdownParser.ts`: replaced `parseReqSpec` (multi-REQ-per-file) with `parseReqFile` (single-REQ-per-file, fail-closed on 0 or >1 REQ headings via `missing-heading`/`multiple-headings`); shared body factored into private `readReqAt`.
- `src/parser/artifactPaths.ts`: `requirementsStatus` derivation changed from `join(dirname(sources.requirements), 'STATUS.md')` to `join(sources.requirements, 'STATUS.md')` (ADR-012); `adrDirectory` unchanged.
- `src/parser/requirementsStatus.ts`: comment reference `parseReqSpec` → `parseReqFile` (no contract change).
- `src/explorer/paths.ts`: `ArtifactSourceItem` `dir` variant gains `parseAs?: 'req'` and `statusFrom?: string`; `requirements` group source changed from `{ kind: 'file', ... }` to `{ kind: 'dir', relDir: sources.requirements, glob: 'REQ-*.md', parseAs: 'req', statusFrom? }`.
- `src/explorer/model.ts`: `buildNodesForFile` req branch uses `parseReqFile`/single node; `loadGroupChildren` reads `item.statusFrom` regardless of `item.kind` (was `file`-only).
- `src/explorer/actions.ts`: `listReqsForDelete` rewritten to `readdir`+`parseReqFile` per `REQ-*.md` file (mirrors `listAdrsForDelete`), replacing the always-`{available:false}` single-file `readFile`+`parseReqSpec` path — this is the fix for the silently-disabled REQ delete guard.
- `src/editor/validation.ts`: `createEditorIndex` `requirements` param changed from `string|undefined` to `Array<{content,uri?}>` (matches `steps`/`adrs` shape); indexes via `parseReqFile` per source.
- `src/editor/activation.ts`: `loadIndex` reads `docs/requirements` via `readMarkdownDirectory(..., /^REQ-\d+.*\.md$/)` instead of one file; `stepEditorWatchPatterns` emits `${sources.requirements}/REQ-*.md` instead of the bare directory path.
- `src/explorer/refresh.ts`: `watchedPaths` requirements glob changed to `${sources.requirements}/REQ-*.md`; comment updated from `SPEC.md` framing to per-file framing.

**ADR.** `docs/adr/ADR-012-requirements-status-directory-anchor.md` created (Accepted, Supersedes ADR-005, scoped strictly to the `requirementsStatus` directory-anchor formula; `adrDirectory` and the rest of ADR-005's decisions — precedence, registry, probing ban — explicitly not revisited). `docs/adr/ADR-005-artifact-path-resolution.md` `Superseded by` field changed from `—` to `ADR-012`; rest of ADR-005 text unchanged (no retroactive rewrite). `docs/adr/README.md` index row for ADR-005 updated to "Superseded by ADR-012 для derivation `requirementsStatus`"; ADR-012 row added.

**Fixtures.** `sources.requirements` changed from `docs/requirements/SPEC.md` to `docs/requirements` in `tests/fixtures/manifest/{initialized,uninitialized}.manifest.yaml`, `tests/fixtures/projects/{explorer,apiContext}/.harness/manifest.yaml`, `tests/fixtures/workspace/.harness/manifest.yaml` (comments updated to match `.harness/manifest.yaml`'s directory-anchor wording). Per-file REQ fixtures created: `tests/fixtures/projects/explorer/docs/requirements/REQ-{001,002}-fixture-{a,b}.md` (+ `SPEC.md` rewritten as pure index; `STATUS.md` unchanged); `tests/fixtures/workspace/docs/requirements/REQ-001-editor-definition.md` (+ `SPEC.md` rewritten as pure index); `tests/fixtures/requirements/REQ-001-fixture-full.md` (self-contained, full valid REQ) and `REQ-777-fixture-partial.md` (missing optional Источник/Rationale/Traceability) (+ `SPEC.md` rewritten as pure index; `STATUS.md`/`TEMPLATE.md` unchanged, per plan). `tests/fixtures/projects/apiContext/docs/requirements/SPEC.md` content left unchanged (unreferenced by any test; only its manifest fixture's `sources.requirements` pointer was updated per plan's explicit fixture-manifest list).

**Legacy layer removed.** `parseReqSpec` export and its `describe('parseReqSpec', ...)` test block deleted from `tests/unit/parser/markdownParser.test.ts`, replaced by `describe('parseReqFile', ...)` (10 cases: full fixture, TEMPLATE.md, index-SPEC.md → `missing-heading`, synthetic missing-heading, multiple-headings, missing-optional-fields degradation, 4 Traceability/STEP-label corruption variants, duplicate Traceability section, empty-content).

**Updated existing tests (expectations only).** `tests/unit/parser/yamlParser.test.ts` (`sources.requirements` assertions → `docs/requirements`), `tests/unit/explorer/paths.test.ts` (dir-kind `ArtifactSourceItem` shape for `requirements`, including the `unsupported` and `относится` relocated-anchor cases: `knowledge/req/SPEC.md` → `knowledge/req`), `tests/unit/parser/artifactPaths.test.ts` (fixture manifest `sources.requirements` → directory-anchor `nested/requirements`, pinned `requirementsStatus` result), `tests/unit/explorer/refresh.test.ts` (`watchedPaths` requirements glob), `tests/unit/explorer/model.test.ts` (description text only, no logic change), `tests/unit/explorer/treeItem.test.ts` (synthetic node `uri` updated to per-file style), `tests/unit/editor/activation.test.ts` (`sources.requirements` → directory; added regression test for `stepEditorWatchPatterns` per-file glob), `tests/unit/editor/validation.test.ts` (`createEditorIndex` calls updated to the new `requirements: Array<...>` param shape), `tests/unit/explorer/actions.test.ts` (`createEmptyReferenceSources` and all ~9 REQ delete-guard cases at lines ~584-786 migrated from single `docs/requirements/SPEC.md` mutation to per-file `docs/requirements/REQ-001-fixture-full.md`; "нечитаемый REQ source" case remodeled as "недоступный REQ-каталог" per plan, mirroring the existing ADR-unavailable case), `tests/integration/editor.test.js` (Definition Provider assertion now expects `docs/requirements/REQ-001-editor-definition.md` instead of `SPEC.md`).

**Verification (root, sequential, literal captured exit codes):**

| Command | Exit code | Observed |
|---|---|---|
| `npm run compile` (`tsc --noEmit`) | 0 | No output (clean). |
| `npm run lint` (`eslint src`) | 0 | No output (clean). |
| `npm run build` (`node esbuild.config.mjs`) | 0 | `esbuild: build complete.` |
| `npm test -- --runInBand` (jest) | 0 | `Test Suites: 25 passed, 25 total` / `Tests: 331 passed, 331 total` (STEP-024 baseline: 25 suites / 327 tests; net +4 tests from added/split cases). |
| `npm run test:integration` (`vscode-test`) | 0 | `27 passing (6s)` (matches STEP-024 baseline of 27), including `Definition Provider ведёт по REQ, ADR и STEP reference` now resolving to `docs/requirements/REQ-001-editor-definition.md` and `дерево строит ровно 8 групп верхнего уровня из REQ-002`. |
| `npm run test:integration:pre-activation` | 0 | `1 passing (755ms)`. |
| `python3 .harness/tools/validate.py --mode manual` | 0 | `HARNESS VALIDATION: PASS (413 tracked files checked, mode=manual)`. |
| `git diff --check` | 0 | No output (no whitespace errors). |

Manual/Extension Host verification of "Sidebar Explorer opens a REQ node and navigates to the correct `REQ-NNN-*.md` file" (task `## Verification` bullet 3) is covered headlessly by the two integration assertions above (`REQ-001-editor-definition.md` Definition Provider resolution; 8-group tree with REQ-002 visible), per plan п.11's cited STEP-006 review precedent for headless Extension Host substitution.

**Acceptance criteria — status:**
- Sidebar Explorer shows Requirements nodes for the current per-file layout without read errors — met (`tests/unit/explorer/model.test.ts`, `tests/integration/explorer.test.js`).
- `listReqsForDelete` no longer silently degrades to `available: false` on per-file layout — met (`tests/unit/explorer/actions.test.ts` delete-guard suite, rewritten `listReqsForDelete`).
- Editor validation/definition provider resolve `REQ-NNN` references on per-file layout — met (`tests/integration/editor.test.js`, `loadIndex`/`createEditorIndex` changes).
- `docs/requirements/STATUS.md`-based `reqStatusMap` continues to map correctly to REQ nodes — met, and the underlying `requirementsStatus` derivation bug (independent of `parseReqSpec`) is also fixed via ADR-012.
- Regression tests on a fixture copied from the real per-file layout (`TEMPLATE.md` + example `REQ-NNN` file) — met (`tests/fixtures/requirements/TEMPLATE.md` reused as-is; `REQ-001-fixture-full.md` self-contained per plan's explicit "no assert against a real REQ file whose traceability drifts" constraint).

## Review status

**Latest verdict:** PASS (с non-blocking findings F-001..F-007)
**Latest report:** `planning/reviews/STEP-025/REVIEW-2026-09-20T1610Z.md`

## Blocker / Failure reason

—
