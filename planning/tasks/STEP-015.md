# STEP-015 — Убрать lifecycle-статус REQ из `docs/requirements/SPEC.md`

**Статус:** Выполнено
**Type:** REFACTOR
**Приоритет:** Средний
**Фаза:** MVP — traceability hygiene
**Depends on:** STEP-016

## Requirements

- REQ-002 (Sidebar Explorer артефактов проекта) — Explorer сегодня отображает REQ-статус, читая его из `SPEC.md`; смена источника данных затрагивает уже реализованное поведение этого REQ.

## ADR

- **ADR-005 (принятый prerequisite через выполненный STEP-016)** — «Двухуровневая резолюция путей Harness-артефактов» (`OQ-004`, `docs/OPEN_QUESTIONS.md`). Исходный `PLAN STEP-015` (r1, 2026-09-18) считал ADR need неблокирующим, но независимый `REVIEW-2026-09-19T1221.md` (F-003) подтвердил конфликт реализации с ADR-001. STEP-016 завершён с повторным независимым PASS review; ADR-005 supersede ADR-001, поэтому STEP-015 разблокирован для отдельного FIX.
- Новый ADR **на сам факт** переноса источника REQ-статуса со `SPEC.md` на `STATUS.md` **не требуется**: это правило уже принято (`AGENTS.md` §10, `planning/EXECUTION_PROTOCOL.md` §6.11/§10.9/§14.2), STEP-015 восстанавливает соответствие ему, а не выбирает новую развилку.
- Действующие ограничения, которые STEP-015 обязан соблюсти: ADR-005 (manifest-first resolver + зарегистрированные derivations) и ADR-002 (labeled markdown + деградация вместо падения на нераспознанном формате).

## Risk flags

- regression: изменение затрагивает уже реализованный и принятый (`PASS` review) функционал Explorer (STEP-006, REQ-002)

## Goal

Убрать поле `**Статус:**` из каждой секции `docs/requirements/SPEC.md`, оставив там только definition/rationale/acceptance/traceability, как того требует `AGENTS.md` §10: «`docs/requirements/SPEC.md` хранит definition/rationale/acceptance/traceability REQ без lifecycle-статуса; текущее состояние REQ фиксируется только в `docs/requirements/STATUS.md`». Т.к. `src/parser/markdownParser.ts` (`parseReqSpec`) сегодня читает `Статус` именно из `SPEC.md`, а `src/explorer/treeItem.ts` показывает это значение как REQ-описание в дереве, а парсера для `docs/requirements/STATUS.md` в коде нет вовсе — удаление поля без изменения кода сломает отображение REQ-статуса в Explorer. По решению пользователя (2026-09-18) scope STEP-015 расширен на production code: нужно перевести источник REQ-статуса для инструментов на `STATUS.md`, прежде чем убирать поле из `SPEC.md`.

## Context

Найдено при `RECONCILE PROJECT` (2026-09-18, `planning/audits/RECONCILE-2026-09-18.md`). Каждая из 10 секций REQ в `SPEC.md` (REQ-001..REQ-010) содержит собственное поле `**Статус:**`, что прямо противоречит правилу §10. Это не просто избыточность: значения уже разошлись со `STATUS.md` —

- REQ-001: `SPEC.md` = «Частично», `STATUS.md` (до этого RECONCILE) = «Запланировано» — при том что `STEP-005` (единственный реализующий STEP) имеет канонический `Статус: Выполнено` и PASS review (`planning/reviews/STEP-005/REVIEW-2026-09-17T2350.md`);
- REQ-006: `SPEC.md` = «Запланировано», `STATUS.md` = «В работе» — при том что `STEP-004` уже `Выполнено` с PASS review.

Наличие двух источников lifecycle-статуса — структурная причина этого расхождения: пока поле существует в `SPEC.md`, оно будет продолжать расходиться со `STATUS.md`, потому что команды протокола (`REVIEW`, `STATUS PROJECT`, `RECONCILE PROJECT`) по контракту обновляют только `STATUS.md`.

## Scope

- `docs/requirements/SPEC.md` — удалить строку `**Статус:** ...` из каждой из 10 секций REQ; проверить, что оставшаяся структура (Приоритет/Источник/Requirement/Rationale/Acceptance/Traceability) не сломана.
- `docs/requirements/STATUS.md` — свериться, что после удаления поля из `SPEC.md` таблица `STATUS.md` остаётся единственным источником текущего REQ-статуса и её значения по каждому REQ соответствуют фактическому evidence (canonical STEP-статусы + review verdicts) на момент выполнения STEP.
- `src/parser/**` — добавить парсер `docs/requirements/STATUS.md` (таблица REQ/Статус/...), убрать чтение `Статус` из `parseReqSpec`; конкретный дизайн (новая функция/тип, переиспользование существующих table/label helpers) определяет `PLAN STEP-015`.
- `src/explorer/**` — переключить источник REQ-статуса для tree item description/tooltip/иконки с `ReqData.status` (из `SPEC.md`) на данные нового парсера `STATUS.md`.
- `tests/unit/parser/**`, `tests/unit/explorer/**` — обновить/добавить тесты под новый источник статуса.

## Mutation policy

### Allowed

- Удаление поля `**Статус:**` в `SPEC.md` для всех 10 REQ.
- Синхронизация значений в `docs/requirements/STATUS.md`, если конкретное расхождение однозначно устраняется фактическим evidence (STEP status + review verdict).
- Добавление парсера `docs/requirements/STATUS.md` в `src/parser/**` и переключение `src/explorer/**` на него как источник REQ-статуса — минимально необходимое для сохранения текущего поведения Explorer (REQ-002) после удаления поля из `SPEC.md`.
- Соответствующие изменения/новые тесты в `tests/unit/parser/**` и `tests/unit/explorer/**`.

### Conditional

- Если для какого-то REQ отсутствует однозначное каноническое evidence для выбора правильного значения в `STATUS.md` — зафиксировать это отдельным пунктом Evidence, не гадать.
- Создание ADR — только если `PLAN STEP-015` (или делегированный `architect`) заключит, что смена источника REQ-статуса является устойчивым архитектурным решением, а не локальной правкой парсера.

### Forbidden

- Изменение смысла Requirement/Rationale/Acceptance/Traceability какого-либо REQ.
- Любое изменение внешнего/наблюдаемого поведения Explorer для REQ, кроме источника данных (никаких новых полей, иконок, фильтров сверх того, что нужно для сохранения текущего поведения).
- Изменение production code вне `src/parser/**`/`src/explorer/**`, необходимого для переноса источника REQ-статуса.
- Изменение REQ, не относящихся к найденному structural issue (структура одна и та же для всех 10 — правка не «заодно», а корень найденного дефекта).

## Out of scope

- Пересмотр самих REQ (формулировок, приоритетов, acceptance criteria).
- Переоценка Phase 2 REQ (REQ-007..REQ-010) — их `Отложено`-статус не пересматривается этим STEP.

## Acceptance criteria

- В `docs/requirements/SPEC.md` не осталось ни одного поля `**Статус:**` внутри секций REQ.
- `docs/requirements/STATUS.md` остаётся единственным local place lifecycle-статуса REQ и не противоречит canonical STEP-статусам/review verdicts на момент закрытия STEP.
- `parseReqSpec` (`src/parser/markdownParser.ts`) больше не читает и не ожидает поле `Статус` из `SPEC.md` (нет parse warning про отсутствующую метку `Статус` для REQ).
- Explorer (REQ-узлы дерева, `src/explorer/**`) после изменения показывает тот же REQ-статус, что и до изменения, но полученный из парсера `docs/requirements/STATUS.md`, а не из `SPEC.md`.
- Существующие тесты `tests/unit/parser/markdownParser.test.ts` и `tests/unit/explorer/**`, ссылавшиеся на REQ `Статус` из `SPEC.md`, обновлены под новый источник; добавлены тесты нового парсера `STATUS.md`.

## Verification

- `python3 tools/harness/validate.py --mode commit` (или актуальный commit-gate) — без новых нарушений.
- Полный test suite проекта (`npm test` / актуальная команда — уточнить в `PLAN STEP-015`) — все тесты, включая новые/изменённые для парсера `STATUS.md` и Explorer, зелёные.

## Deliverables

- `docs/requirements/SPEC.md` без lifecycle-статуса REQ.
- `docs/requirements/STATUS.md`, сверенная с фактическим evidence.
- Новый парсер `docs/requirements/STATUS.md` в `src/parser/**` с тестами.
- `src/explorer/**`, переключённый на новый источник REQ-статуса, с обновлёнными тестами.

## Implementation plan

**Plan status:** Planned
**Plan revision:** r1
**Planned at:** 2026-09-18T15:15Z

### Предпосылки

- **Hard dependencies:** нет (`Depends on: —`). Blocker'ов уровня dependencies нет.
- **Фактическое состояние кода (проверено, canonical — код):**
  - `src/parser/markdownParser.ts:318–378` (`parseReqSpec`) читает `**Статус:**` из каждой секции REQ и предупреждает (`${id}.status`) при его отсутствии;
  - `src/parser/types.ts:148–158` — `ReqData.status: string`;
  - **единственный потребитель `ReqData.status` во всём репозитории — `src/explorer/treeItem.ts:60** (`item.description = node.data.status` для `case 'req'`). Ни tooltip, ни иконки, ни `contextValue` у REQ-узла нет;
  - **REQ не участвует в фильтрации по статусу.** `src/explorer/model.ts:131–141` (`filterNodes`) применяет Status/Type/Priority/Risk flags только к `step`-узлам; к `req`/`adr` применяется исключительно `matchesIdQuery` (поиск по ID). Это зафиксировано и в doc-комментарии `src/explorer/filter.ts:1–10` («у REQ несовместимый набор статусов»). Значит `FilterState` и `filter.ts` в этом STEP **не меняются вообще**;
  - `src/explorer/actions.ts:31–39` (`listAllReqs`) → `src/explorer/guards.ts:63` (`canDelete`) используют только `traceability.step`, не `status`;
  - парсера markdown-таблиц в `src/parser/**` нет: `markdownParser.ts` умеет секции/bold-метки/labeled-bullets/bullets, `executionProtocol.ts` — заголовки/bullets, `yamlParser.ts` — YAML. Table-парсинг пишется с нуля.
- **`docs/requirements/STATUS.md` не объявлен в `.project/manifest.yaml`.** Манифест объявляет `sources.requirements` (= `docs/requirements/SPEC.md`) и `sources.status` (= `planning/STATUS.md` — **это projection STEP, а не REQ; использовать его нельзя**). Это ровно случай `OQ-004`, для которого STEP-006 уже применил вариант (a) — деривацию из соседнего объявленного пути с graceful degradation (`src/explorer/paths.ts:48–57`, `deriveAdrDir`).
- **Решение по ADR (обязательное к фиксации по `## Mutation policy → Conditional`):**
  1. Перенос источника REQ-статуса `SPEC.md` → `STATUS.md` **ADR не требует**: `AGENTS.md` §10 и `EXECUTION_PROTOCOL.md` §6.11/§10.9/§14.2 уже объявляют `docs/requirements/STATUS.md` единственным persisted местом lifecycle-статуса REQ. Архитектурной развилки нет — есть несоответствие кода уже принятому правилу (по `AGENTS.md` §2 это architecture drift, который закрывается кодом, а не новым решением). Создавать ADR на восстановление соответствия — прямое нарушение `AGENTS.md` §9 («не создавай ADR на каждую техническую правку»).
  2. **ADR need подтверждён для другой темы** — `OQ-004`: правило резолюции путей к артефактам, не объявленным в манифесте. STEP-015 делает `docs/requirements/STATUS.md` вторым таким артефактом, т.е. превращает изолированный приём STEP-006 в фактическое правило. Кандидат-номер **ADR-005 свободен** (в `docs/adr/` есть ADR-001..ADR-004; упоминания «ADR-005» в репозитории — только как планируемого, `src/explorer/paths.ts:52`, `OQ-004`, `planning/tasks/STEP-006.md`).
  3. **ADR-005 не блокирует `IMPLEMENT STEP-015`**, потому что: (i) правило остаётся изолированным в одном модуле `src/explorer/paths.ts` — после этого STEP там будет ровно два однострочных deriver'а (`deriveAdrDir`, `deriveReqStatusPath`), и смена решения на вариант (b)/(c) — правка двух строк, как и обещал `OQ-004`; (ii) STEP-006 с тем же ADR need прошёл независимый review с PASS — прецедент в этом же проекте; (iii) блокировать corrective hygiene-STEP, закрывающий активный расходящийся drift, на decision process непропорционально. STEP-015 обязан взамен: не расширять правило за пределы `paths.ts` и обновить `OQ-004`, зафиксировав появление второго зависимого (см. Шаг 7).
  4. **Условный Шаг 0 (если root-agent/пользователь решит ратифицировать правило до реализации):** `ADD STEP: принять ADR-005 — правило резолюции путей к Harness-артефактам, не объявленным в .project/manifest.yaml` → `RUN STEP-016` (Type `ADR`, исполняет `architect`). Каркас содержания ADR-005: **Context** — манифест объявляет не все реально существующие артефакты (`docs/adr/**`, `docs/requirements/STATUS.md`), манифест harness-owned (`.project/harness-update.toml → ownership.shared`), собственный ключ проекту туда добавлять нельзя; **Problem** — без правила каждая подсистема изобретёт свою деривацию, знание размажется по модулям и `UPDATE HARNESS` станет непредсказуемым; **Decision** — вариант (a): деривация от ближайшего объявленного `sources.*`-пути, единственное место деривации — `src/explorer/paths.ts`, обязательна проверка существования и graceful degradation (нет файла/каталога → узел/поле деградирует, без ошибки и без выдуманных данных); **Alternatives** — (b) override в `.project/harness-config.json`, (c) upstream-предложение добавить `sources.adrDirectory`/`sources.requirementsStatus` в манифест (не отвергается, а помечается как желаемое долгосрочное решение); **Consequences** — фиксирует два текущих потребителя (`deriveAdrDir`, `deriveReqStatusPath`) и обязывает будущие подсистемы (REQ-003 autocomplete, REQ-004 status bar) не заводить третью копию правила; **Traceability** — REQ: REQ-002, REQ-003; STEP: STEP-006, STEP-015; закрывает `OQ-004`. Если Шаг 0 выполняется, ADR-005 должен явно упомянуть `docs/requirements/STATUS.md` как второго потребителя.
- **Корректность `## Context` STEP-015 подтверждена** с одним уточнением, влияющим на Шаг 6: в `docs/requirements/STATUS.md` у REQ-006 стоит `В работе`, но это значение **отсутствует в словаре статусов REQ** (`docs/requirements/SPEC.md → ## Статусы`: `Запланировано | Частично | Выполнено | Отложено | Отменено`). То есть расхождение REQ-006 — не только «SPEC vs STATUS», но и невалидное значение в самом `STATUS.md`. Разрешается однозначно по evidence (см. Шаг 6), гадать не требуется.

### Implementation approach

Идея: сначала построить и покрыть тестами **новый источник** REQ-статуса, затем переключить на него единственного потребителя, затем убрать старый источник и только в конце синхронизировать сами данные. На каждом шаге репозиторий остаётся компилируемым и зелёным; шаг с удалением поля из `SPEC.md` — последний из мутирующих контракт, чтобы откат был дешёвым.

**Шаг 1. Parser: разбор таблицы `docs/requirements/STATUS.md`.**

1.1. `src/parser/markdownParser.ts` — добавить низкоуровневый примитив рядом с существующими `extractBoldLabels`/`extractLabeledBullets`/`extractBulletItems`:

```ts
/** Строки первой непрерывной markdown-таблицы: ячейки без внешних `|`, trim, separator-строки отброшены. */
export function extractTableRows(text: string): string[][]
```

Контракт: строка считается табличной, если после `trim()` начинается с `|`; ячейки — `split('|')` с отбрасыванием крайних пустых и `trim()` каждой; строка-разделитель (все ячейки состоят только из `-` и `:`) отбрасывается; первая непрерывная группа табличных строк — результат, последующие таблицы игнорируются (в `STATUS.md` таблица одна; контракт фиксируется тестом). Примитив чистый, без знания о REQ.

1.2. Новый модуль `src/parser/requirementsStatus.ts` (отдельный файл — тот же приём, что `executionProtocol.ts`: собственный артефакт, переиспользующий примитивы `markdownParser.ts`; `markdownParser.ts` остаётся семейством ADR-002 labeled-markdown парсеров):

```ts
import { extractTableRows } from './markdownParser';
import { MarkdownParseError, ParseWarning, ReqStatusEntry, Result, err, ok } from './types';

export function parseReqStatus(
  content: string
): Result<{ data: ReqStatusEntry[]; warnings: ParseWarning[] }, MarkdownParseError>

/** Удобный индекс для потребителей: id → status. */
export function reqStatusMap(entries: ReqStatusEntry[]): Map<string, string>
```

Алгоритм `parseReqStatus`:
- пустой контент → `err({ kind: 'empty-content' })` (симметрия с `parseStepFile`/`parseReqSpec`/`parseAdrFile`);
- `extractTableRows(content)`; нет таблицы или нет data-строк с `REQ-NNN` → `err({ kind: 'missing-table' })`;
- **колонки резолвятся по имени заголовка, а не по индексу** (`REQ`, `Название`, `Статус`, `Реализующие STEP`, `Evidence`) — устойчиво к добавлению/перестановке колонок будущим `UPDATE HARNESS`; отсутствие колонки `Статус` → `warnings.push({ field: 'table.status', ... })`, статусы пустые, но ошибки нет (ADR-002 §3: деградация, не падение);
- data-строка принимается, если её ячейка `REQ` матчит `/^REQ-[A-Za-z0-9]+$/` после снятия окружающих backticks/`*`; непохожая строка пропускается с warning `row.<n>`;
- дубликат id → warning `REQ-NNN.duplicate`, побеждает первая строка (детерминированно).

1.3. `src/parser/types.ts`:
- новый тип рядом с `ReqData`:

```ts
export interface ReqStatusEntry {
  id: string;
  title: string;
  status: string;
  steps: string[];   // extractIds(..., 'STEP') из колонки «Реализующие STEP»
  evidence: string;  // сырой текст ячейки Evidence
}
```
- `MarkdownParseError` дополняется вариантом `| { kind: 'missing-table' }` (аддитивно; существующие потребители делают только логирование `parsed.error`, не exhaustive-switch — проверено: `src/explorer/model.ts:59/67/75`, `src/explorer/actions.ts:35/56/78`).

1.4. Fixtures/тесты: `tests/fixtures/requirements/STATUS.md` — точная копия реального `docs/requirements/STATUS.md` (как уже сделано для `SPEC.md`/`TEMPLATE.md`); новый `tests/unit/parser/requirementsStatus.test.ts` (см. Test strategy). После Шага 1 остальной код не тронут, suite зелёный.

**Шаг 2. Резолюция пути (ADR-001 / `OQ-004`).**

`src/explorer/paths.ts` — рядом с `deriveAdrDir`, с тем же по смыслу комментарием и ссылкой на `OQ-004`/ADR-005:

```ts
/** `docs/requirements/SPEC.md` → `docs/requirements/STATUS.md`. НЕ `manifest.sources.status` — это projection STEP (`planning/STATUS.md`). */
export function deriveReqStatusPath(manifest: ManifestData): string {
  return posix.join(posix.dirname(manifest.sources.requirements), 'STATUS.md');
}
```

и расширение source item (аддитивное, опциональное поле):

```ts
| { kind: 'file'; relPath: string; parseAs?: 'req'; statusFrom?: string }
```

В `resolveArtifactSources` группа `requirements` получает `statusFrom: deriveReqStatusPath(manifest)`. Остальные группы не меняются.

**Шаг 3. Explorer: узел REQ получает собственный статус.**

3.1. `src/explorer/model.ts` — тип узла:

```ts
| { kind: 'req'; uri: string; data: ReqData; status: string; groupId: GroupId }
```

Статус — **поле узла, а не поле `ReqData`**: `ReqData` по контракту = «разобранное из `SPEC.md`», и подмешивать туда значение из другого файла означало бы воспроизвести ту же двусмысленность источника, которую этот STEP убирает.

3.2. `loadGroupChildren` читает источник статусов **один раз на загрузку группы**, до цикла по items (не по одному разу на REQ):

```ts
async function readReqStatuses(relPath: string, reader: ArtifactReader): Promise<Map<string, string>>
```
- `reader.read` бросил → `console.warn('[harness.explorer] failed to read <relPath>: ...')` + пустая Map;
- `parseReqStatus` вернул `err` → `console.warn` + пустая Map;
- иначе `reqStatusMap(entries)`.

**Важно для сохранения текущего поведения:** неудача чтения `STATUS.md` **не увеличивает счётчик `skipped`** и не порождает `message`-узел `readError` — это деградация одного поля, а не потеря артефакта; узлы REQ строятся всегда. Существующие кейсы `model.test.ts` («битый файл → message-узел», «пустая группа → message-узел») не должны измениться.

3.3. `buildNodesForFile` в ветке `parseAs === 'req'` получает готовую `Map` и строит узлы: `status: statusByReq.get(data.id) ?? ''`.

3.4. `src/explorer/treeItem.ts:57–64`, `case 'req'` — единственная правка: `item.description = node.status;` вместо `node.data.status`. Label, `command`, `contextValue` не меняются; иконки и tooltip у REQ как не было, так и не появляется (`## Mutation policy → Forbidden`).

**Шаг 4. Убрать старый источник.**

4.1. `src/parser/markdownParser.ts:340–346` — убрать `const status = labels.get('Статус') ?? ''` и warning `${id}.status`; `Приоритет`/`Источник` продолжают читаться.
4.2. `src/parser/types.ts` — убрать поле `status` из `ReqData`.

Удаление поля (а не «оставить, но не заполнять») выбрано осознанно: компилятор сам найдёт всех потребителей (`npm run compile`), а рудиментарное всегда-пустое поле — источник ровно того класса тихого дефекта, который чинит этот STEP. Риск низкий: `ReqData` не входит ни в какой публичный API расширения (`src/extension.ts` экспортирует только `{ explorerProvider }` для integration-тестов), потребителей три и все внутри `src/**`/`tests/**`.
4.3. Правки-следствия: `tests/unit/explorer/guards.test.ts:54–67` — убрать `status` из хелпера `req()`; `tests/unit/parser/markdownParser.test.ts` — см. Test strategy.

**Шаг 5. `docs/requirements/SPEC.md`.**

- Удалить строку `**Статус:** ...` во всех 10 секциях REQ-001..REQ-010 (строки 25, 53, 81, 109, 136, 164, 191, 216, 241, 266 на момент планирования). Остающийся порядок в шапке каждой секции: `**Приоритет:**` → `**Источник:**` → `#### Requirement` → `#### Rationale` → `#### Acceptance` → `#### Traceability`.
- Секцию `## Статусы` (строки 13–19) **оставить**: это словарь допустимых значений (определение), а не lifecycle-состояние конкретного REQ; после удаления полей он остаётся единственным местом, где этот словарь определён, и на него опирается Шаг 6. Рекомендуется (не обязательно) дописать одну строку-указатель: «Текущее значение статуса каждого REQ хранится только в `STATUS.md`.»
- `#### Traceability` REQ-002: `- STEP: STEP-006` → `- STEP: STEP-006, STEP-015` (двусторонняя проверяемость связи REQ↔STEP, `AGENTS.md` §10). Смысл Requirement/Rationale/Acceptance не трогать.
- Синхронизировать fixture-копии: `tests/fixtures/requirements/SPEC.md` (копия реального файла, используется `markdownParser.test.ts`) и `tests/fixtures/projects/explorer/docs/requirements/SPEC.md` (синтетические REQ-001/REQ-002 — убрать `**Статус:**` и там же, чтобы фикстура не противоречила новому формату).
- `docs/requirements/TEMPLATE.md` **не трогать** (вне `## Scope`; см. Risks — остаточный риск и предложенный follow-up).

**Шаг 6. `docs/requirements/STATUS.md` — сверка с evidence.**

Проверка всех 10 строк по canonical STEP-статусам и review verdicts (выполнена при планировании):

| REQ | Текущее | Evidence | Итог |
|---|---|---|---|
| REQ-001 | Частично | STEP-005 `Выполнено` + PASS; полное закрытие ждёт STEP-009 | без изменений |
| REQ-002 | Выполнено | STEP-006 `Выполнено` + PASS (`REVIEW-2026-09-18T1108.md`) | без изменений |
| REQ-003 | Запланировано | STEP-007 `Запланировано` | без изменений |
| REQ-004 | Запланировано | STEP-008 `Запланировано` | без изменений |
| REQ-005 | Запланировано | STEP-001 `Выполнено` (research), STEP-009 `Запланировано` | без изменений |
| REQ-006 | **В работе** | STEP-004 `Выполнено` + PASS; STEP-010 `Запланировано` | **→ `Частично`** |
| REQ-007..010 | Отложено | STEP не запланированы (Phase 2) | без изменений |

Единственная правка данных — REQ-006: значение `В работе` отсутствует в словаре `SPEC.md → ## Статусы`, а фактическая конфигурация evidence (один из двух реализующих STEP выполнен с PASS) идентична REQ-001, у которого стоит `Частично`. Замена однозначна, гадания нет (`## Mutation policy → Allowed`). Колонку Evidence для REQ-006 дополнить ссылкой на канонический review-файл STEP-004 (`planning/reviews/STEP-004/REVIEW-2026-09-17T2300.md` — путь проверить перед записью) вместо сокращения `REVIEW-2026-09-17T2300.md`.

**Наблюдаемый эффект в Explorer (ожидаемый, не регрессия — зафиксировать в Evidence, чтобы REVIEW не принял его за дефект):** после Шагов 3–6 описания REQ-узлов совпадают с прежними для 9 из 10 REQ; **REQ-006 меняется `Запланировано` → `Частично`** — это и есть цель STEP (Explorer перестаёт показывать устаревшее значение из `SPEC.md`).

**Шаг 7. Синхронизация projection/документации (только фактически затронутое).**

- `planning/PLAN.md:22` — строка STEP-015: колонка `Type` `DOCUMENTATION` → `REFACTOR`, колонка `REQ` `—` → `REQ-002` (task-контракт изменён пользователем 2026-09-18; projection обязан совпадать с canonical — `AGENTS.md` §10).
- `planning/STATUS.md` — в пунктах про STEP-015 снять формулировку «без REQ/ADR» и упомянуть REQ-002 + кандидата ADR-005; в «Known drift / risks» отметить, что drift `SPEC.md` закрыт этим STEP (после прохождения verification).
- `docs/OPEN_QUESTIONS.md` → `OQ-004`: в `Affects` добавить `STEP-015`, в `Context` — один абзац о втором зависимом (`docs/requirements/STATUS.md`, `deriveReqStatusPath`); статус остаётся `OPEN` (закрывает его только ADR-005).
- `docs/architecture.md:11` (Parser layer) — дописать разбор `docs/requirements/STATUS.md` (projection-таблица) к перечислению того, что умеет слой. Одна строка.
- `docs/requirements/STATUS.md`/`SPEC.md` — уже в Шагах 5–6.

**Шаг 8.** Полный verification run (см. Verification sequence).

### Impacted modules/files

**Изменяются (production):**

- `src/parser/markdownParser.ts` — `+extractTableRows`, `-чтение метки «Статус»` в `parseReqSpec`;
- `src/parser/requirementsStatus.ts` — **новый**, `parseReqStatus` / `reqStatusMap`;
- `src/parser/types.ts` — `+ReqStatusEntry`, `+MarkdownParseError.missing-table`, `-ReqData.status`;
- `src/explorer/paths.ts` — `+deriveReqStatusPath`, `+statusFrom?` в `ArtifactSourceItem`, `statusFrom` для группы `requirements`;
- `src/explorer/model.ts` — `+status` в `req`-узле, `+readReqStatuses`, передача Map в `buildNodesForFile`;
- `src/explorer/treeItem.ts` — одна строка в `case 'req'`.

**Изменяются (docs/planning):** `docs/requirements/SPEC.md`, `docs/requirements/STATUS.md`, `docs/OPEN_QUESTIONS.md` (`OQ-004`), `docs/architecture.md` (одна строка), `planning/PLAN.md`, `planning/STATUS.md`, `planning/tasks/STEP-015.md` (Evidence/Review status).

**Изменяются (tests/fixtures):** `tests/unit/parser/requirementsStatus.test.ts` (новый), `tests/unit/parser/markdownParser.test.ts`, `tests/unit/explorer/model.test.ts`, `tests/unit/explorer/paths.test.ts`, `tests/unit/explorer/guards.test.ts`, `tests/fixtures/requirements/STATUS.md` (новая), `tests/fixtures/requirements/SPEC.md`, `tests/fixtures/projects/explorer/docs/requirements/{SPEC.md,STATUS.md}` (вторая — новая).

**Читаются, но НЕ изменяются:** `src/explorer/filter.ts` (REQ не фильтруется по статусу — проверено), `src/explorer/guards.ts`, `src/explorer/actions.ts`, `src/explorer/treeProvider.ts`, `src/explorer/reader.ts`/`vscodeReader.ts`, `src/explorer/statusIcon.ts`, `src/commands/**`, `src/locales/**` и `package.nls*.json` (новых пользовательских строк нет — статус приходит данными), `.project/manifest.yaml` (harness-owned/shared; собственные ключи туда не добавляются — см. `OQ-004`), `docs/requirements/TEMPLATE.md`, `tests/fixtures/workspace/**` (в нём нет `docs/requirements/`, integration-фикстура не затрагивается).

### Data / API compatibility

- **Публичного API расширения изменение не касается.** `src/extension.ts` экспортирует только `{ explorerProvider }` (тестовая инфраструктура STEP-006); `ReqData`, `HarnessNode`, `MarkdownParseError` — внутренние типы. Версия `0.0.1`, расширение не опубликовано, downstream-потребителей нет.
- **`ReqData`: поле `status` удаляется** (breaking внутри `src/**`, но compile-time и полностью покрыто `npm run compile`). Рассмотренная альтернатива «оставить поле, перестать заполнять» отвергнута: всегда-пустое поле сохраняет ложный контракт и позволяет будущему коду молча прочитать пустой статус — тот же дефект, который закрывает STEP.
- **`HarnessNode` (`kind: 'req'`) получает обязательное поле `status`** — аддитивно для потребителей чтения, но требует правки всех конструкторов узла (их два: `model.ts`, тесты).
- **`MarkdownParseError` расширяется** вариантом `missing-table` — аддитивно; ни один потребитель не делает exhaustive-switch по этому типу (проверено).
- **Форматы файлов на диске не меняются** (кроме удаления строки из `SPEC.md`): `STATUS.md` читается как есть, схема таблицы не навязывается — колонки резолвятся по имени, отсутствующая колонка деградирует в warning.
- **Обратная совместимость с чужими Harness-проектами:** проект без `docs/requirements/STATUS.md` (или с другим её форматом) продолжает показывать REQ-узлы — просто без описания; без ошибок и без выдуманных значений. Проект, в котором `SPEC.md` всё ещё содержит `**Статус:**` (например, сгенерированный из текущего `docs/requirements/TEMPLATE.md`), парсится без warning — метка просто игнорируется.

### Test strategy

**Новые (`tests/unit/parser/requirementsStatus.test.ts`):**

1. разбирает реальную фикстуру `tests/fixtures/requirements/STATUS.md`: 10 записей REQ-001..REQ-010, у REQ-002 `status === 'Выполнено'`, `steps` REQ-006 === `['STEP-004','STEP-010']`, `warnings === []`;
2. колонки резолвятся по имени: таблица с переставленными/добавленной колонкой даёт тот же результат;
3. отсутствует колонка `Статус` → `ok`, статусы пустые, warning `table.status` (деградация по ADR-002 §3);
4. пустой контент → `err({ kind: 'empty-content' })`; markdown без таблицы → `err({ kind: 'missing-table' })`;
5. мусорная строка внутри таблицы (не `REQ-NNN`) пропускается с warning, остальные записи сохраняются; дубликат id → warning, побеждает первая строка;
6. `extractTableRows` (в `tests/unit/parser/markdownParser.test.ts`): отбрасывает separator-строку, снимает внешние `|`, тримит ячейки, не падает на строке с непарным числом `|`.

**Обновляемые:**

- `tests/unit/parser/markdownParser.test.ts` — убрать `expect(req001.status)` / `expect(req007.status)`; в кейсе «деградирует ... на REQ-блоке без Статус/Источник/…» заменить `expect(warningFields).toContain('REQ-777.status')` на `.not.toContain('REQ-777.status')` (прямая проверка Acceptance criterion «нет parse warning про отсутствующую метку `Статус`») и переименовать сам кейс; остальные assertions (`priority`, `source`, `rationale`, `traceability`) сохранить;
- `tests/unit/explorer/paths.test.ts` — `deriveReqStatusPath` даёт `docs/requirements/STATUS.md` для фикстурного манифеста и **не** равен `manifest.sources.status` (регрессия против подмены `planning/STATUS.md`);
- `tests/unit/explorer/model.test.ts` — кейс «Requirements» дополняется: у узлов REQ-001/REQ-002 `status` берётся из фикстурной `docs/requirements/STATUS.md`, а **не** из `SPEC.md` (значения в фикстурах делаются заведомо различными — например в `SPEC.md` статус удалён, в `STATUS.md` REQ-002 = `Выполнено`); **новый кейс деградации**: reader, бросающий на `docs/requirements/STATUS.md`, — узлы REQ всё равно построены, `status === ''`, `message`-узел `readError` **не** появляется и `skipped` не растёт;
- `tests/unit/explorer/guards.test.ts` — хелпер `req()` без `status` (компиляционная правка, поведение не меняется).

**Прямое покрытие наблюдаемого поведения (Acceptance criterion №4):** в `tests/unit/explorer/` добавить кейс на `toTreeItem` для `req`-узла (модуль уже тестируем через `tests/mocks/vscode.ts`, как `treeProvider.test.ts`): `description === node.status`. Это единственное место, где статус виден пользователю, — без такого теста «Explorer показывает тот же статус» остаётся недоказанным.

**Integration (`tests/integration/explorer.test.js`):** не расширяется — фикстурный workspace (`tests/fixtures/workspace/`) не содержит `docs/requirements/**`, группа `Requirements` там пуста; добавление туда REQ/STATUS-фикстур выходит за `## Scope` и не нужно для acceptance. Прогон обязателен как регрессионная проверка.

### Verification sequence

Baseline, снятый при планировании (2026-09-18): `npm test` → **16 suites / 150 тестов, все зелёные**. Ожидание после STEP-015: то же число suites +1 (`requirementsStatus.test.ts`) и не меньше 150 тестов.

1. `npm run compile` (`tsc --noEmit`) — 0 ошибок; это же основная проверка последствий удаления `ReqData.status`.
2. `npm run lint` (`eslint src`) — 0 ошибок/предупреждений.
3. `npm run build` (esbuild) — бандл собирается.
4. `npm test` (Jest, `tests/unit`) — все зелёные, включая новые кейсы парсера и деградации Explorer.
5. `npm run test:integration` (`@vscode/test-cli`, headless VSCode) — все зелёные (регрессия активации/дерева).
6. `python3 tools/harness/validate.py --mode commit` — PASS, без новых нарушений.
7. Ручная сверка вывода (без GUI): для каждого REQ-001..REQ-010 сравнить значение `description`, которое даст новый источник, с прежним значением из `SPEC.md`; ожидаемая единственная разница — REQ-006 (`Запланировано` → `Частично`). Зафиксировать таблицу в Evidence.
8. `git status --short` — изменения ограничены перечнем из Impacted modules/files; `src/commands/**`, `src/editor/**`, `src/ui/**`, `src/api/**`, `src/git/**`, `src/locales/**` не тронуты (проверить отдельным `git status --short`).

Evidence оформлять по `AGENTS.md` §8: буквальный вывод — только если реально захвачен, иначе `Command` / `Exit code` / `Observed`.

### Risks / rollback

- **R1 (regression, главный). Explorer перестаёт показывать статус REQ** (пустые `description`), если `STATUS.md` не прочитан/не разобран или id не совпали. Митигация: тест деградации + тест `toTreeItem` + `console.warn` на каждый провал чтения/разбора (тот же приём, что `model.ts:52`); п.7 Verification sequence фиксирует таблицу «до/после» по всем 10 REQ. Затронут REQ-002 с PASS-review — поэтому проверка наблюдаемого поведения вынесена в отдельный acceptance-шаг, а не выводится из «тесты зелёные».
- **R2. Хрупкость table-парсера** при будущем `UPDATE HARNESS`, меняющем шапку таблицы. Митигация: резолюция колонок по имени + деградация в warnings вместо исключения (ADR-002 §3, `## Compatibility` ADR-002); тесты на переставленные/отсутствующие колонки.
- **R3. Подмена источника** `docs/requirements/STATUS.md` на `manifest.sources.status` (`planning/STATUS.md`) — они называются одинаково и оба «STATUS.md». Митигация: явный комментарий в `deriveReqStatusPath` + негативный тест в `paths.test.ts`.
- **R4. Архитектурный:** правило деривации пути размножится за пределы `paths.ts`. Митигация: вся деривация — в `paths.ts`; `model.ts` получает готовый относительный путь через `statusFrom` и ничего не выводит сам; `OQ-004` обновляется (Шаг 7).
- **R5 (остаточный, вне scope).** `docs/requirements/TEMPLATE.md` по-прежнему содержит `**Статус:** Запланировано`, поэтому новый REQ, созданный по шаблону, снова внесёт lifecycle-статус в `SPEC.md`. Парсер это переживёт (метка игнорируется), но структурная причина дефекта закрыта не полностью. Рекомендуемый follow-up после закрытия STEP-015: `QUICK FIX` на удаление строки из `docs/requirements/TEMPLATE.md` + сверка с upstream-шаблоном Harness (файл не входит в `harness_owned` по `.project/harness-update.toml`, но происходит из шаблона — вероятен upstream-репорт).
- **R6. Perf.** Добавляется одно дополнительное чтение файла на раскрытие группы `Requirements` (не на каждый REQ). Порог REQ-002 (<500 мс) относится к группе Tasks и измеряется `perf.test.ts` отдельно; влияния нет.
- **Rollback.** Шаги 1–4 (код+тесты), 5–6 (данные) и 7 (projections) естественно ложатся в отдельные commits. Откат наблюдаемой регрессии = revert commit'ов кода и данных вместе (после Шага 5 старого источника в `SPEC.md` уже нет, поэтому откатывать только Explorer нельзя — порядок шагов именно это и защищает: до Шага 5 репозиторий всегда рабочий при любом из двух источников). Git-мутации выполняются только явными командами (`AGENTS.md` §17).

### Blockers

- Технических blocker'ов нет; hard dependencies отсутствуют.
- Процедурный, **не блокирующий**: ADR need по `OQ-004` (кандидат ADR-005). Условия, при которых STEP-015 идёт без него, перечислены в `## Implementation plan → Предпосылки` п.3; если пользователь/root-agent решит ратифицировать правило заранее — выполнить условный Шаг 0 до `IMPLEMENT`.

### Handoff

`IMPLEMENT STEP-015` (либо сначала `ADD STEP:` на ADR-005 — условный Шаг 0, по решению пользователя).

## Evidence

Реализация выполнена строго по `## Implementation plan` (r1, 2026-09-18T15:15Z), Шаги 1–8, без ADR-005 (условный Шаг 0 не выполнялся — root-agent/пользователь его не запросил; блокирующих условий не возникло).

### FIX — 2026-09-19 (по FAIL review `REVIEW-2026-09-18T1600.md`)

- F-001: `src/explorer/refresh.ts` теперь добавляет derived `deriveReqStatusPath(manifest)` в `watchedPaths` для группы `requirements`. Поэтому внешняя headless-правка `docs/requirements/STATUS.md` вызывает тот же `invalidate('requirements')`, что и правка `SPEC.md`; новое поведение не добавляет новую публичную поверхность extension.
- `tests/unit/explorer/refresh.test.ts` — новый unit-тест чистого test seam `watchedPaths`: фиксирует оба наблюдаемых пути группы `requirements` — `SPEC.md` и derived `STATUS.md`.
- F-002: в `docs/requirements/STATUS.md` и его точной fixture-копии `tests/fixtures/requirements/STATUS.md` у REQ-002 колонка `Реализующие STEP` синхронизирована с canonical traceability: `STEP-006, STEP-015`.

### Проверки FIX-прохода

| Command | Exit code | Observed |
|---|---|---|
| `npm test -- --runInBand tests/unit/explorer/refresh.test.ts` | 0 | Новый regression test: 1 suite / 1 test passed. Jest вывел существующие предупреждения `ts-jest` TS151002, без test failure. |
| `npm run compile` | 0 | `tsc --noEmit` завершился без ошибок. |
| `npm run lint` | 0 | `eslint src` завершился без ошибок и предупреждений. |
| `npm test -- --runInBand` | 0 | 19 suites / 166 tests passed; предупреждения `ts-jest` TS151002 не относятся к этому изменению. |
| `npm run test:integration` | 0 | Headless VS Code Extension Host: 15 passing. |
| `python3 tools/harness/validate.py --mode commit` | 0 | `HARNESS VALIDATION: PASS (275 tracked files checked, mode=commit)`; единственный WARNING — отсутствие staged files, ожидаемо: COMMIT не выполнялся. |
| `git diff --check` | 0 | Пробельных ошибок в рабочем diff нет. |

### Изменённые файлы

**Production:**
- `src/parser/markdownParser.ts` — добавлен `extractTableRows`; из `parseReqSpec` убрано чтение метки `Статус` и warning `${id}.status`.
- `src/parser/requirementsStatus.ts` — новый, `parseReqStatus`/`reqStatusMap`.
- `src/parser/types.ts` — добавлены `ReqStatusEntry`, `MarkdownParseError.missing-table`; убрано поле `status` из `ReqData`.
- `src/explorer/paths.ts` — добавлены `deriveReqStatusPath`, `statusFrom?` в `ArtifactSourceItem`; группа `requirements` получает `statusFrom`.
- `src/explorer/model.ts` — `HarnessNode` (`kind: 'req'`) получил поле `status`; добавлен `readReqStatuses` (один раз на загрузку группы, graceful degradation — без роста `skipped`, без `message`-узла `readError`); `buildNodesForFile` для `parseAs === 'req'` строит `status` из переданной Map.
- `src/explorer/treeItem.ts` — `case 'req'`: `item.description = node.status` вместо `node.data.status`.

**Docs/planning:**
- `docs/requirements/SPEC.md` — удалено поле `**Статус:**` из всех 10 секций REQ-001..REQ-010; в `## Статусы` добавлена строка-указатель на `STATUS.md`; `#### Traceability` REQ-002: `STEP-006` → `STEP-006, STEP-015`.
- `docs/requirements/STATUS.md` — REQ-006: `В работе` → `Частично` (единственная правка данных, см. Шаг 6 плана); Evidence-ссылка REQ-006 дополнена полным путём `planning/reviews/STEP-004/REVIEW-2026-09-17T2300.md` (файл существовал, путь проверен).
- `docs/OPEN_QUESTIONS.md` (`OQ-004`) — `Affects` дополнен `STEP-015`; `Context` дополнен абзацем про второго зависимого (`docs/requirements/STATUS.md`, `deriveReqStatusPath`); `Status` остаётся `OPEN`.
- `docs/architecture.md` — одна строка в описании Parser layer про разбор `docs/requirements/STATUS.md`.
- `planning/PLAN.md` — строка STEP-015: `Type` `DOCUMENTATION` → `REFACTOR`, `Status` `Запланировано` → `В работе`, `REQ` `—` → `REQ-002`.
- `planning/STATUS.md` — STEP-015 перенесён из «Next unblocked work» в «In progress»; `Known drift / risks` обновлён (drift закрывается этим STEP после review); `OQ-004` дополнен упоминанием второго зависимого.
- `planning/tasks/STEP-015.md` — `Статус` `Запланировано` → `В работе`; эта секция Evidence.

**Tests/fixtures:**
- `tests/unit/parser/requirementsStatus.test.ts` — новый (7 кейсов: реальная фикстура, резолюция по имени колонки, деградация без колонки `Статус`, `empty-content`/`missing-table`, мусорная строка + дубликат, `reqStatusMap`).
- `tests/unit/parser/markdownParser.test.ts` — добавлен `describe('extractTableRows', ...)` (3 кейса); убраны/инвертированы assertions про `req.status`/`REQ-777.status`.
- `tests/unit/explorer/model.test.ts` — добавлены 2 кейса: статус REQ-узла из фикстурной `STATUS.md` (значения намеренно отличаются от прежних `SPEC.md`), деградация чтения `STATUS.md` (узлы строятся, `status === ''`, `readError` не появляется).
- `tests/unit/explorer/paths.test.ts` — добавлен кейс `deriveReqStatusPath`/`statusFrom` (в т.ч. негативная проверка против `manifest.sources.status`).
- `tests/unit/explorer/guards.test.ts` — хелпер `req()` без поля `status` (компиляционная правка).
- `tests/unit/explorer/treeItem.test.ts` — новый, прямое покрытие Acceptance criterion №4 (`toTreeItem` для `req`-узла: `description === node.status`, в т.ч. пустой статус).
- `tests/fixtures/requirements/STATUS.md` — новая, точная копия финального `docs/requirements/STATUS.md`.
- `tests/fixtures/requirements/SPEC.md` — синхронизирована с финальным `docs/requirements/SPEC.md` (заодно устранено предсуществовавшее расхождение с формулировкой REQ-002 Acceptance из `PLAN STEP-006` — фикстура была скопирована из более старой версии файла).
- `tests/fixtures/projects/explorer/docs/requirements/SPEC.md` — убраны `**Статус:**` из REQ-001/REQ-002.
- `tests/fixtures/projects/explorer/docs/requirements/STATUS.md` — новая, синтетическая, значения намеренно отличаются от прежних `SPEC.md` (REQ-001 `Выполнено`→`Частично`, REQ-002 `Запланировано`→`Выполнено`), чтобы тест доказывал смену источника.

### Verification sequence — результаты

| # | Command | Exit code | Observed |
|---|---|---|---|
| 1 | `npm run compile` | 0 | `tsc --noEmit` — без ошибок |
| 2 | `npm run lint` | 0 | `eslint src` — без ошибок/предупреждений |
| 3 | `npm run build` | 0 | `esbuild: build complete.` |
| 4 | `npm test` | 0 | Jest: **18 suites / 165 тестов, все зелёные** (baseline 16/150 → +2 suite `requirementsStatus.test.ts`, `treeItem.test.ts`, +15 тестов). Первый прогон дал 1 падение в `tests/unit/explorer/paths.test.ts` («никакой Harness-путь не захардкожен вне paths.ts») — JSDoc-комментарий в `model.ts` буквально содержал `docs/requirements/STATUS.md`, попав под regex-проверку файла. Исправлено (комментарий переформулирован без хардкода пути, семантика деривации не изменилась) — повторный прогон зелёный. |
| 5 | `npm run test:integration` | 0 | `@vscode/test-cli` (headless Extension Host) — **15 passing**, все зелёные, включая `Harness Sidebar Explorer (STEP-006)` набор (8 тестов). |
| 6 | `python3 tools/harness/validate.py --mode commit` | 0 | `HARNESS VALIDATION: PASS (275 tracked files checked, mode=commit)`; единственный WARNING — «no staged files yet», ожидаемо (COMMIT не выполнялся). |
| 7 | Ручная сверка REQ-описаний (до/после) | — | См. таблицу ниже. |
| 8 | `git status --short` scope-check | — | Изменённые/новые файлы ограничены перечнем из `Impacted modules/files`; `src/commands/**`, `src/editor/**`, `src/ui/**`, `src/api/**`, `src/git/**`, `src/locales/**` не затронуты (проверено `grep` по выводу `git status --short`). `planning/audits/RECONCILE-2026-09-18.md` и `planning/tasks/STEP-015.md` — untracked, но не созданы в рамках этого IMPLEMENT-прохода (существовали до начала работы, см. git status в системном контексте задачи). |

### Ручная сверка description REQ-001..REQ-010 (до/после)

| REQ | До (`SPEC.md`, на момент планирования) | После (`STATUS.md`, текущий источник Explorer) | Изменилось? |
|---|---|---|---|
| REQ-001 | Частично | Частично | нет |
| REQ-002 | Выполнено | Выполнено | нет |
| REQ-003 | Запланировано | Запланировано | нет |
| REQ-004 | Запланировано | Запланировано | нет |
| REQ-005 | Запланировано | Запланировано | нет |
| REQ-006 | Запланировано | **Частично** | **да** (ожидаемо, см. Шаг 6 плана и Acceptance criteria) |
| REQ-007 | Отложено | Отложено | нет |
| REQ-008 | Отложено | Отложено | нет |
| REQ-009 | Отложено | Отложено | нет |
| REQ-010 | Отложено | Отложено | нет |

Единственная разница — REQ-006, как и предсказывал `## Implementation plan`. Это цель STEP, не регрессия.

### Расхождения с планом

Расхождений с архитектурой/дизайном плана не было. Единственное отклонение — тактическое: п.4 Verification sequence при первом прогоне нашёл собственный побочный эффект реализации (буквальный путь в комментарии `model.ts`), не предусмотренный текстом плана дословно, но покрытый его же духом («вся деривация — в `paths.ts`», R4). Исправлено без изменения архитектуры/поведения (см. таблицу выше, строка 4).

### Не выполнено / оставлено для REVIEW

- `ADR-005` не создан (по решению плана — не блокирует, `OQ-004` обновлён).
- R5 (`docs/requirements/TEMPLATE.md` всё ещё содержит `**Статус:**`) — сознательно оставлен вне scope, зафиксирован как follow-up в плане.
- Повторный независимый `REVIEW STEP-015` проведён 2026-09-19: verdict `FAIL`, архитектурный finding F-003 блокирует перевод в `Выполнено`; см. `planning/reviews/STEP-015/REVIEW-2026-09-19T1221.md`.

### Architecture handoff из STEP-016 — 2026-09-19

ADR-005 принят и подтверждён повторным независимым PASS review STEP-016 (`planning/reviews/STEP-016/REVIEW-2026-09-19T0951Z.md`), заменив абсолютный manifest-only контракт ADR-001. Следующий `FIX STEP-015` должен реализовать единую neutral Parser/path-resolution surface, перевести на неё Explorer/watcher/actions, добавить проверки relocation manifest anchors и сохранить доказанную деградацию отсутствующего `requirementsStatus`. Исторический Evidence первоначальной реализации не переписывается.

### FIX — 2026-09-19 (по FAIL review `REVIEW-2026-09-19T1221.md`, F-003)

- `src/parser/artifactPaths.ts` — добавлен neutral resolver `resolveHarnessArtifactPath`. Для `harness.version: "1"` registry разрешает только `adrDirectory` от `sources.architecture` и `requirementsStatus` от `sources.requirements`; неподдерживаемое поколение возвращает `undefined`, без перебора имён или fallback.
- `src/explorer/paths.ts`, `refresh.ts` и `actions.ts` получают готовый путь только из resolver. Watcher отдельно наблюдает explicit `architecture.md` и добавляет ADR glob только из `adrDirectory`; при `undefined` source registry не создаёт ADR-directory и `statusFrom`, watcher не наблюдает derived artifacts, а actions возвращают пустой список ADR. Существующая деградация REQ/ADR остаётся локальной.
- Добавлены regression tests для relocation обоих manifest anchors, unavailable generation и отсутствия derived requirements/ADR watcher/source; старые локальные `deriveAdrDir`/`deriveReqStatusPath` удалены.
- F-004 также закрыт: `planning/PLAN.md` не предлагает повторный `PLAN`; после завершённого FIX projection указывает следующий проход `REVIEW STEP-015`.

### Проверки FIX F-003

| Command | Exit code | Observed |
|---|---:|---|
| Node-эквивалент targeted Jest: `tests/unit/parser/artifactPaths.test.ts`, `tests/unit/explorer/{paths,refresh}.test.ts` | 0 | 3 suites / 14 tests passed; только существующее предупреждение `ts-jest` TS151002. |
| Node-эквивалент affected Jest: parser requirements/markdown и Explorer model/actions/paths/refresh | 0 | 6 suites / 60 tests passed; только существующее предупреждение `ts-jest` TS151002. |
| Node-эквивалент `npm run compile` (`tsc --noEmit`) | 0 | Без ошибок. |
| Node-эквивалент `npm run lint` (`eslint src`) | 0 | Без ошибок и предупреждений. |
| `python3 tools/harness/validate.py --mode commit` | 0 | `HARNESS VALIDATION: PASS (275 tracked files checked, mode=commit)`; warning об отсутствии staged files ожидаем, commit не создавался. |
| `git diff --check` | 0 | Пробельных ошибок нет. |

### Независимая deterministic verification root-agent после FIX

| Command | Exit code | Observed |
|---|---:|---|
| Node-эквивалент `npm run compile` (`tsc --noEmit`) | 0 | Без ошибок. |
| Node-эквивалент `npm run lint` (`eslint src`) | 0 | Без ошибок и предупреждений. |
| Node-эквивалент `npm run build` (`node esbuild.config.mjs`) | 0 | `esbuild: build complete.` |
| Node-эквивалент `npm test -- --runInBand` | 0 | 20 suites / 173 tests passed; только существующие предупреждения `ts-jest` TS151002. |
| Node-эквивалент `npm run test:integration` (`vscode-test`) | 0 | Реальный VS Code Extension Host: 15 passing. Первый sandbox-запуск не смог создать IPC socket в `/run/user/1000`; повторный разрешённый запуск вне sandbox завершился успешно. |
| `cmp -s docs/requirements/SPEC.md tests/fixtures/requirements/SPEC.md` | 0 | Canonical SPEC и fixture побайтно совпадают. |
| `cmp -s docs/requirements/STATUS.md tests/fixtures/requirements/STATUS.md` | 0 | Canonical STATUS и fixture побайтно совпадают. |
| `python3 tools/harness/validate.py --mode commit` | 0 | `HARNESS VALIDATION: PASS (275 tracked files checked, mode=commit)`; ожидаемый warning об отсутствии staged files. |
| `git diff --check` | 0 | Пробельных ошибок нет. |

FIX завершён без изменения lifecycle-статуса: STEP-015 остаётся `В работе`, latest verdict сохраняет исторический `FAIL` до свежего независимого `REVIEW STEP-015`.

### FIX — 2026-09-19 (по FAIL review `REVIEW-2026-09-19T1014Z.md`, F-005/F-006)

- F-005: `deleteArtifact` получает availability-aware результаты чтения STEP/REQ/ADR sources. Пустой, успешно прочитанный источник остаётся допустимым; неподдерживаемое generation manifest, ошибка чтения каталога ADR, а также ошибка чтения или разбора любого источника больше не превращаются в `[]` и блокируют destructive action с нейтральным локализованным сообщением.
- `tests/unit/explorer/actions.test.ts` покрывает неподдерживаемое generation manifest, недоступный и неразбираемый ADR source, нечитаемый REQ source, неразбираемый STEP source и контрольное удаление через `useTrash`; существующий TOCTOU-кейс входящей ссылки сохранён.
- F-006: `docs/architecture.md` описывает фактический ownership `src/parser/artifactPaths.ts` и разные режимы normal degradation/delete fail-closed. Evidence REQ-002 и его точная fixture синхронизированы: FIX завершён, ожидается независимый review.

### Проверки FIX F-005/F-006

| Command | Exit code | Observed |
|---|---:|---|
| Node-эквивалент targeted Jest: `tests/unit/explorer/actions.test.ts` | 0 | 1 suite / 22 tests passed; новые fail-closed cases и существующие TOCTOU/reference cases зелёные. Выведено только существующее предупреждение `ts-jest` TS151002. |
| Node-эквивалент `npm run compile` (`tsc --noEmit`) | 0 | Без ошибок. |
| Node-эквивалент `npm run lint` (`eslint src`) | 0 | Без ошибок и предупреждений. |
| `python3 tools/harness/validate.py --mode commit` | 0 | `HARNESS VALIDATION: PASS (275 tracked files checked, mode=commit)`; warning об отсутствии staged files ожидаем, commit не создавался. |
| `git diff --check` | 0 | Пробельных ошибок нет. |
| `cmp -s docs/requirements/STATUS.md tests/fixtures/requirements/STATUS.md` | 0 | Canonical requirements STATUS и exact fixture побайтно совпадают. |

### Независимая deterministic verification root-agent после FIX F-005/F-006

| Command | Exit code | Observed |
|---|---:|---|
| Node-эквивалент `npm run compile` (`tsc --noEmit`) | 0 | Без ошибок. |
| Node-эквивалент `npm run lint` (`eslint src`) | 0 | Без ошибок и предупреждений. |
| Node-эквивалент `npm run build` (`node esbuild.config.mjs`) | 0 | `esbuild: build complete.` |
| Node-эквивалент `npm test -- --runInBand` | 0 | 20 suites / 178 tests passed; только существующие предупреждения `ts-jest` TS151002. |
| Node-эквивалент `npm run test:integration` (`vscode-test`) | 0 | Реальный VS Code Extension Host: 15 passing. |
| Exact fixture sync: SPEC, requirements STATUS, ADR-001 | 0 | 3/3 canonical/fixture пары побайтно совпадают. |
| `python3 tools/harness/validate.py --mode commit` | 0 | `HARNESS VALIDATION: PASS (275 tracked files checked, mode=commit)`; ожидаемый warning об отсутствии staged files. |
| `git diff --check` | 0 | Пробельных ошибок нет. |

Root-agent подтвердил отсутствие старых `deriveAdrDir`/`deriveReqStatusPath` в `src/**` и `tests/**`. FIX завершён; status остаётся `В работе`, исторический verdict сохраняется до свежего независимого review.

### FIX — 2026-09-19 (по FAIL review `REVIEW-2026-09-19T1027Z.md`, F-007)

- `src/explorer/actions.ts` — delete-specific readers считают source недоступным не только при read/parse error, но и при warnings, означающих неполноту полей входящих ссылок: `dependsOn` для STEP и `traceability` для REQ/ADR. Обычная деградация Explorer не меняется; fail-closed правило применяется только к destructive delete guard.
- ADR scan ограничен `ADR-*.md`, поэтому `README.md` и прочие markdown-файлы в каталоге не участвуют в доказательстве отсутствия ADR references.
- `tests/unit/explorer/actions.test.ts` — добавлены regression cases `ok + warning` для STEP/REQ/ADR и контрольный кейс игнорирования не-ADR markdown.

### Проверки FIX F-007

| Command | Exit code | Observed |
|---|---:|---|
| `npm run compile` | 0 | `tsc --noEmit` без ошибок. |
| `npm run lint` | 0 | `eslint src` без ошибок и предупреждений. |
| `npm run build` | 0 | `esbuild: build complete.` |
| `npm test` | 0 | Jest: 20 suites / 182 tests passed; только существующее предупреждение `ts-jest` TS151002. |
| `npm run test:integration` | 0 | Реальный headless VS Code Extension Host: 15 passing. Запуск вне sandbox потребовался для IPC-сокета VS Code. |

FIX F-007 завершён без изменения lifecycle-статуса: STEP-015 остаётся `В работе` до свежего независимого `REVIEW STEP-015`.

### FIX — 2026-09-19 (по FAIL review `REVIEW-2026-09-19T1040Z.md`, F-008)

- `src/parser/markdownParser.ts` — парсеры REQ/ADR добавляют `traceability.step` warning, если секция `Traceability` не содержит точной метки `STEP` либо её непустое значение не содержит корректного STEP ID. `—`, `не запланирован` и template placeholder `STEP-NNN` остаются явными допустимыми отсутствиями связи. Повреждённый непустой `Depends on` без STEP ID также получает warning.
- `src/explorer/actions.ts` — delete-specific availability check распознаёт вложенные warnings `traceability.step` как неполный источник incoming references и блокирует deletion. Обычная graceful degradation Explorer не меняется.
- `tests/unit/parser/markdownParser.test.ts` и `tests/unit/explorer/actions.test.ts` — добавлены regression cases для renamed и повреждённого значения `STEP` в REQ/ADR Traceability, а также повреждённого `Depends on`.

### Проверки FIX F-008

| Command | Exit code | Observed |
|---|---:|---|
| `npm run compile` | 0 | `tsc --noEmit` без ошибок. |
| `npm run lint` | 0 | `eslint src` без ошибок и предупреждений. |
| `npm run build` | 0 | `esbuild: build complete.` |
| `npm test` | 0 | Jest: 20 suites / 191 tests passed; только существующее предупреждение `ts-jest` TS151002. |
| `npm run test:integration` | 0 | Реальный headless VS Code Extension Host: 15 passing. Запуск вне sandbox потребовался для IPC-сокета VS Code. |
| Exact fixture sync | 0 | SPEC, requirements STATUS и ADR-001 fixture-копии совпадают побайтно. |
| `python3 tools/harness/validate.py --mode commit` | 0 | PASS; ожидаемое предупреждение об отсутствии staged files. |
| `git diff --check` | 0 | Пробельных ошибок нет. |

FIX F-008 завершён без изменения lifecycle-статуса: STEP-015 остаётся `В работе` до свежего независимого `REVIEW STEP-015`.

### FIX — 2026-09-19 (по FAIL review `REVIEW-2026-09-19T1105Z.md`, F-009)

- `src/parser/markdownParser.ts` — reference value считается валидным только как точный placeholder (`—`, `не запланирован`, `STEP-NNN`) либо как полный comma-separated список `STEP-<digits>`. Смешанный список с корректным и повреждённым token теперь выдаёт reference warning.
- `tests/unit/parser/markdownParser.test.ts` и `tests/unit/explorer/actions.test.ts` — добавлены parser/delete regression cases для mixed `Depends on`, REQ Traceability и ADR Traceability.

### Проверки FIX F-009

| Command | Exit code | Observed |
|---|---:|---|
| `npm run compile` | 0 | `tsc --noEmit` без ошибок. |
| `npm run lint` | 0 | `eslint src` без ошибок и предупреждений. |
| `npm run build` | 0 | `esbuild: build complete.` |
| `npm test` | 0 | Jest: 20 suites / 197 tests passed; только существующее предупреждение `ts-jest` TS151002. |
| `npm run test:integration` | 0 | Реальный headless VS Code Extension Host: 15 passing. Запуск вне sandbox потребовался для IPC-сокета VS Code. |
| Exact fixture sync | 0 | SPEC, requirements STATUS и ADR-001 fixture-копии совпадают побайтно. |
| `python3 tools/harness/validate.py --mode commit` | 0 | PASS; ожидаемое предупреждение об отсутствии staged files. |
| `git diff --check` | 0 | Пробельных ошибок нет. |

FIX F-009 завершён без изменения lifecycle-статуса: STEP-015 остаётся `В работе` до свежего независимого `REVIEW STEP-015`.

### FIX — 2026-09-19 (по FAIL review `REVIEW-2026-09-19T1124Z.md`, F-010/F-011)

- `src/parser/markdownParser.ts` — duplicate `Depends on`, duplicate `STEP`-метка и duplicate секция `Traceability` теперь создают reference warning. `deleteArtifact` уже обрабатывает такой warning fail-closed, поэтому parser не может скрыть более раннюю входящую ссылку последним placeholder.
- `tests/unit/parser/markdownParser.test.ts` и `tests/unit/explorer/actions.test.ts` — добавлены parser/delete regressions для duplicate reference-полей и duplicate `Traceability` в STEP, REQ и ADR.
- `tests/fixtures/requirements/STATUS.md` — синхронизирован побайтно с `docs/requirements/STATUS.md`.

### Проверки FIX F-010/F-011

| Command | Exit code | Observed |
|---|---:|---|
| `npm run compile` | 0 | `tsc --noEmit` без ошибок. |
| `npm run lint` | 0 | `eslint src` без ошибок и предупреждений. |
| `npm run build` | 0 | `esbuild: build complete.` |
| `npm test` | 0 | Jest: 20 suites / 207 tests passed; только существующее предупреждение `ts-jest` TS151002. |
| `npm run test:integration` | 0 | Реальный headless VS Code Extension Host: 15 passing. Запуск вне sandbox потребовался для IPC-сокета VS Code. |
| Exact fixture sync | 0 | SPEC, requirements STATUS и ADR-001 fixture-копии совпадают побайтно. |
| `python3 tools/harness/validate.py --mode commit` | 0 | PASS; ожидаемое предупреждение об отсутствии staged files. |
| `git diff --check` | 0 | Пробельных ошибок нет. |

FIX F-010/F-011 завершён без изменения lifecycle-статуса: STEP-015 остаётся `В работе` до свежего независимого `REVIEW STEP-015`.

## Review status

**Latest verdict:** PASS
**Latest report:** `planning/reviews/STEP-015/REVIEW-2026-09-19T1135Z.md` — F-001..F-011 закрыты; acceptance criteria и deterministic gates подтверждены независимым review.

## Blocker / Failure reason

—
