# STEP-016 — Принять ADR-005: резолюция путей к Harness-артефактам вне manifest

**Статус:** Выполнено
**Type:** ADR
**Приоритет:** Высокий
**Фаза:** MVP — architecture reconciliation
**Depends on:** STEP-003, STEP-006

## Requirements

- REQ-002 — Sidebar Explorer должен находить все отображаемые Harness-артефакты без неявного hardcode, несовместимого с архитектурным контрактом.
- REQ-003 — autocomplete по существующим `ADR-NNN` требует устойчивого правила резолюции каталога ADR до реализации STEP File Editor.

## ADR

- Результат STEP — новый ADR-005, который принимает устойчивое правило резолюции путей к Harness-артефактам, отсутствующим в `.project/manifest.yaml`, и явно определяет отношение к Accepted ADR-001.
- ADR-005 обязан использовать `Supersedes: ADR-001`: разрешение зарегистрированной derivation меняет абсолютный контракт ADR-001 «manifest как единственный источник путей». Исторический текст ADR-001 не переписывается.

## Risk flags

- architecture

## Goal

Принять и зафиксировать единое архитектурное правило для резолюции Harness-артефактов, путь к которым не объявлен в `.project/manifest.yaml`, чтобы устранить architecture drift из `OQ-004`/`REVIEW STEP-015` и дать STEP-015 и будущему STEP-007 однозначный контракт.

## Context

ADR-001 требует получать все необходимые пути из `.project/manifest.yaml` и запрещает hardcode/угадывание директорий. Фактический Harness manifest не объявляет каталог `docs/adr/` и файл `docs/requirements/STATUS.md`, хотя они нужны REQ-002/REQ-003. STEP-006 ввёл изолированный `deriveAdrDir`, а STEP-015 — `deriveReqStatusPath`; оба производят путь от ближайшего объявленного `sources.*`-пути и деградируют при отсутствии артефакта.

`REVIEW STEP-015` (`planning/reviews/STEP-015/REVIEW-2026-09-19T1221.md`, F-003) подтвердил, что документирование этого приёма в `OQ-004` и task-планах не отменяет Accepted ADR-001. До нового архитектурного решения STEP-015 нельзя закрыть, а размножение того же правила в STEP-007 создаст третью неформальную реализацию.

## Scope

- Сопоставить фактический manifest contract, ownership `.project/manifest.yaml` и два текущих потребителя: каталог ADR и requirements status projection.
- Оценить минимум три альтернативы из `OQ-004`: детерминированная деривация от ближайшего объявленного пути; project-owned override в `.project/harness-config.json`; расширение upstream manifest contract.
- Принять одно устойчивое правило с точными границами применимости, precedence, проверкой существования, graceful degradation и требованиями к будущим потребителям.
- Явно разрешить конфликт с ADR-001 через новый ADR-005: сохранить ADR-001 как исторический record и указать `Supersedes: ADR-001` / `Superseded by: ADR-005`.
- Синхронизировать architecture baseline, ADR index, `OQ-004`, REQ/STEP traceability и roadmap/status projections.
- Сформировать конкретный handoff для `FIX STEP-015`; для STEP-007 зафиксировать контракт, но не планировать и не реализовывать editor.

## Mutation policy

### Allowed

- `docs/adr/ADR-005-*.md`, `docs/adr/README.md`.
- Минимальное обновление metadata ADR-001 (`Superseded by`/статус в index), если ADR-005 действительно supersede его решение; исторические Context/Problem/Decision ADR-001 не переписываются.
- `docs/architecture.md`, `docs/OPEN_QUESTIONS.md` (`OQ-004`), `docs/requirements/SPEC.md`, `docs/requirements/STATUS.md` — только синхронизация принятого архитектурного решения и traceability.
- `planning/tasks/STEP-016.md`, `planning/tasks/STEP-015.md`, `planning/PLAN.md`, `planning/STATUS.md` — только lifecycle/dependency/evidence/handoff projections, необходимые этому ADR STEP.
- `planning/tasks/STEP-007.md` — только синхронизация ADR-005 traceability и handoff будущему consumer; планирование или реализация Editor запрещены.
- Точные fixture-копии изменённых canonical docs (`tests/fixtures/adr/ADR-001-manifest-driven-paths.md`, `tests/fixtures/requirements/{SPEC,STATUS}.md`) и соответствующие assertions в `tests/unit/parser/markdownParser.test.ts` — только механическая синхронизация metadata/traceability, без изменения parser behavior.

### Conditional

- Ссылка на upstream Harness change допустима как future direction/evidence; изменение самого upstream contract требует отдельной работы и не подменяется локальным ADR.
- Если анализ докажет, что решение невозможно принять без изменения product requirement, остановиться с конкретным blocker вместо молчаливого изменения REQ.

### Forbidden

- Изменение production code в `src/**`, runtime behavior Explorer или тестовой логики за пределами явно разрешённой синхронизации fixtures/assertions.
- Добавление project-owned ключей в `.project/manifest.yaml` без изменения upstream Harness contract.
- Переписывание исторической мотивации Accepted ADR-001 задним числом.
- Реализация FIX STEP-015 или будущего STEP-007 «заодно».

## Out of scope

- Правка `deriveAdrDir`, `deriveReqStatusPath`, watcher-ов, parser layer или Explorer.
- Проектирование всех потенциальных будущих Harness-артефактов; правило должно быть расширяемым, но ADR фиксирует доказанные текущие случаи и критерии добавления новых.
- Upstream release/update самого Harness.
- Закрытие STEP-015: после ADR требуется отдельный `FIX STEP-015` и новый независимый review.

## Acceptance criteria

- Создан ADR-005 со статусом `Accepted`, полными Context/Problem/Decision/Alternatives/Consequences и traceability к REQ-002, REQ-003, STEP-006, STEP-007, STEP-015 и STEP-016.
- ADR-005 однозначно определяет источник и precedence путей, допустимость/недопустимость деривации, поведение при отсутствии артефакта и единственное место владения правилом.
- ADR-005 явно supersede ADR-001 с сохранением исторического Context/Problem/Decision; metadata и ADR index не оставляют оба несовместимых решения действующими.
- Решение покрывает оба текущих случая (`docs/adr/`, `docs/requirements/STATUS.md`) и не требует отдельного скрытого правила для каждого потребителя.
- `OQ-004` переведён в `RESOLVED` со ссылкой на ADR-005; ADR index, architecture baseline, REQ/STEP traceability и projections согласованы.
- В ADR зафиксирован проверяемый handoff для `FIX STEP-015`; production code и `.project/manifest.yaml` в этом STEP не изменены.

## Verification

- `python3 tools/harness/validate.py --mode commit` — PASS без новых нарушений.
- `git diff --check` — без пробельных ошибок.
- Ручная consistency-проверка: ссылки ADR/REQ/STEP/OQ существуют; ADR-001/ADR-005 не заявляют одновременно несовместимые действующие решения; PLAN/STATUS/REQ projections совпадают с canonical task-файлами.
- Scope-check относительно pre-RUN snapshot: нет изменений в `src/**` и `.project/manifest.yaml`; изменения в `tests/**` ограничены разрешёнными fixture-копиями и прямыми assertions их metadata/traceability.

## Deliverables

- `docs/adr/ADR-005-*.md` — принятое архитектурное решение.
- Синхронизированные `docs/adr/README.md`, `docs/architecture.md`, `docs/OPEN_QUESTIONS.md` и traceability REQ.
- Обновлённые task/roadmap/status projections с явным handoff в `FIX STEP-015`.

## Implementation plan

**Plan status:** Planned
**Plan revision:** r1
**Planned at:** 2026-09-19T12:34:40+03:00

### Предпосылки и архитектурный вывод

- Hard dependencies удовлетворены: STEP-003 и STEP-006 имеют статус `Выполнено` и PASS review. STEP-016 не заблокирован; STEP-015 и STEP-007, напротив, корректно ждут его результата.
- `.project/manifest.yaml` фактически относится к `ownership.shared` в `.project/harness-update.toml`, а не к `harness_owned`. Однако его schema поставляется Harness; локальный project-owned ключ без upstream contract создал бы fork schema и запрещён scope STEP-016.
- ADR-001 недвусмысленно запрещает любой путь, не представленный exact manifest field. Поэтому выбранное ниже разрешение детерминированной derivation меняет контракт, а не только поясняет его: ADR-005 должен иметь `Supersedes: ADR-001`; ADR-001 сохраняет исторический текст и получает только metadata `Status: Superseded` / `Superseded by: ADR-005`.
- Архитектурная рекомендация PLAN: принять двухуровневую manifest-first резолюцию для Harness protocol artifacts. Формальное принятие выполняет `RUN STEP-016` через architect и независимый review; если RUN отвергнет эту рекомендацию, он не подменяет решение молча, а фиксирует blocker/новую dependency.

### Целевой контракт ADR-005

1. Каждый путь запрашивается по именованному artifact ID через единый resolver/registry, а не выводится consumer-ом.
2. Precedence:
   1. schema-known explicit manifest field, если поддерживаемая версия manifest его объявляет;
   2. зарегистрированная deterministic derivation для этого artifact ID и поддерживаемой schema/generation;
   3. artifact unavailable.
3. Для текущего `harness.version: "1"` allowlist содержит ровно два доказанных gap:
   - `adrDirectory = join(dirname(sources.architecture), "adr")`;
   - `requirementsStatus = join(dirname(sources.requirements), "STATUS.md")`.
4. Derivation — compatibility convention, а не path guessing: запрещены перебор альтернативных директорий, recursive search и fallback на произвольный default. Unsupported manifest generation не угадывается.
5. Explicit path authoritative: если поле существует, но target отсутствует/нечитаем, resolver не откатывается к derived candidate, чтобы не прочитать stale artifact.
6. Перед использованием проверяются existence/type. Ошибка деградирует только зависимый artifact: нет ADR directory → нет ADR nodes/completions, но `architecture.md` остаётся; нет requirements status → REQ из `SPEC.md` остаются с пустым status, без fallback к удалённому полю `SPEC.md` или `sources.status` (это STEP projection).
7. Долговременный owner — нейтральный Parser/path-resolution boundary (`src/parser/**`), а consumers (Explorer, watcher, будущий Editor) получают готовые paths. STEP-016 не меняет код; ADR обязан дать этот handoff отдельному `FIX STEP-015`.

### План выполнения `RUN STEP-016`

1. Составить в Evidence decision matrix трёх вариантов по одинаковым критериям: покрытие обоих текущих gap, совместимость с текущим manifest/update ownership, единый owner, portability, degradation, возможность разблокировать STEP-015 и migration к upstream schema.
2. Создать `docs/adr/ADR-005-artifact-path-resolution.md` со статусом `Accepted`, `Supersedes: ADR-001` и решением из секции «Целевой контракт». Alternatives:
   - manifest-only/upstream expansion — архитектурно чистый long-term target, но текущий release не содержит полей и вариант сейчас не разблокирует STEP-015;
   - override в `.project/harness-config.json` — отклонить: второй topology source, смешение UI settings с protocol paths, новые schema/watch/containment/migration obligations;
   - fixed/global defaults и filesystem probing — отклонить как неуправляемый hardcode;
   - выбранная allowlisted derivation от manifest anchors — текущий compatibility contract.
3. Полностью заполнить Consequences/Security/Data/Compatibility:
   - произвольные пользовательские paths и broad filesystem scan не вводятся; workspace boundary сохраняется;
   - data/manifest migration отсутствует;
   - relocation manifest anchor поддерживается, но rename/non-sibling layout требует будущего explicit upstream field;
   - future explicit field автоматически получает высший precedence.
4. Обновить ADR-001 только исторической metadata (`Status: Superseded`, `Superseded by: ADR-005`), синхронизировать `docs/adr/README.md`; Context/Problem/Decision ADR-001 не переписывать.
5. Обновить `docs/architecture.md`: Parser layer владеет общим artifact-path resolver; consumers и watcher используют его результат; manifest primary, allowlisted convention разрешена только для schema gaps. Исправить абсолютную формулировку security boundary, чтобы она учитывала ADR-approved derived paths, но по-прежнему запрещала чтение вне workspace.
6. Перевести `OQ-004` в `RESOLVED`: записать точный precedence, два allowlisted artifact ID, единственного owner, graceful degradation и ссылку на ADR-005. Исправить неточную прежнюю формулировку о manifest как `harness_owned`: фактический ownership — `shared`, schema при этом Harness-managed.
7. Синхронизировать REQ:
   - acceptance REQ-002 заменить с абсолютного «только пути из manifest» на проверяемый контракт ADR-005: explicit manifest paths либо зарегистрированные centralized derivations для schema gaps; consumer-level hardcode/search запрещены;
   - активная ADR traceability REQ-002 → ADR-005, REQ-003 → ADR-002, ADR-005; ADR-001 остаётся только superseded history;
   - `docs/requirements/STATUS.md` обновить только по evidence/traceability STEP-016, не повышая lifecycle-статус REQ из-за документационного решения.
8. Механически синхронизировать fixture-копии ADR-001 и requirements docs, а в `markdownParser.test.ts` — только прямые expected status/supersededBy/ADR IDs. Новый parser behavior и новые test abstractions не добавлять.
9. Обновить projections/handoff:
   - STEP-016 в ходе mutation → `В работе`; закрывать как `Выполнено` только после независимого PASS review и зелёных gates;
   - после PASS STEP-015 вернуть из `Заблокировано` в `В работе`, снять blocker и направить в `FIX STEP-015`; до PASS не разблокировать;
   - STEP-007 сохраняет hard dependency STEP-016 и после PASS использует ADR-005 как контракт, без реализации editor в этом STEP;
   - в STEP-015 отметить, что прежняя плановая гипотеза «ADR-005 не блокирует» опровергнута review и заменена принятым ADR, не переписывая историческое Evidence.
10. Записать Evidence с фактическими файлами, command/exit/observed и handoff. Не менять `src/**`, `.project/manifest.yaml` или runtime behavior.

### Impacted files

**Создаётся:**
- `docs/adr/ADR-005-artifact-path-resolution.md`.

**Изменяются:**
- `docs/adr/ADR-001-manifest-driven-paths.md` — metadata only;
- `docs/adr/README.md`, `docs/architecture.md`, `docs/OPEN_QUESTIONS.md`;
- `docs/requirements/SPEC.md`, `docs/requirements/STATUS.md`;
- `planning/tasks/STEP-016.md`, `planning/tasks/STEP-015.md`, `planning/PLAN.md`, `planning/STATUS.md`;
- `planning/tasks/STEP-007.md` — только ADR-005 traceability/handoff, без планирования Editor;
- exact fixture mirrors `tests/fixtures/adr/ADR-001-manifest-driven-paths.md`, `tests/fixtures/requirements/{SPEC,STATUS}.md` и прямые expectations `tests/unit/parser/markdownParser.test.ts`.

**Только читаются:**
- `.project/manifest.yaml`, `.project/harness-update.toml`;
- `src/explorer/{paths,refresh,actions}.ts`, `src/parser/{types,yamlParser}.ts`;
- STEP-003/006, review STEP-015 F-003.

**Не изменяются:**
- `src/**`, `.project/manifest.yaml`, runtime config/schema, остальные tests/fixtures.

### Data/API/compatibility implications

- Runtime/API/data/schema mutation в STEP-016 отсутствует; migration не требуется.
- Durable architecture contract меняется: ADR-001 superseded узко, manifest остаётся primary, а два текущих derived location становятся поддерживаемой compatibility convention.
- `.project/harness-config.json` не расширяется и не становится источником protocol topology.
- Upstream manifest expansion остаётся preferred migration path; новый explicit field вытесняет derivation без изменения consumer API.
- Код пока остаётся в architecture drift относительно будущего shared resolver; это сознательный handoff, а не заявленная реализация ADR. `FIX STEP-015` должен создать/вынести neutral resolver, перевести Explorer/watcher/actions на него и дать STEP-007 единственную reusable surface. Если такой refactor выйдет за Mutation policy STEP-015, до FIX создаётся отдельный corrective STEP, а соответствие не декларируется только документацией.

### Test strategy и verification sequence

1. До mutation сохранить pre-RUN snapshot `git status --short`/список файлов, чтобы отделить существующий dirty scope STEP-015 от изменений STEP-016.
2. Проверить exact fixture sync для изменённых canonical docs (`cmp -s`).
3. Запустить `npm test -- --runInBand tests/unit/parser/markdownParser.test.ts` после metadata/traceability sync; затем полный `npm test -- --runInBand`, поскольку изменяется общий parser fixture.
4. `python3 tools/harness/validate.py --mode commit` → PASS.
5. `git diff --check` → без ошибок.
6. Scope-check относительно pre-RUN snapshot: STEP-016 не добавил изменений в `src/**`/`.project/manifest.yaml`; test diff ограничен объявленными fixtures/assertions.
7. Ручная consistency-проверка:
   - все ADR/REQ/STEP/OQ ссылки существуют;
   - ADR-001 и ADR-005 не остаются одновременно активными с несовместимыми Decisions;
   - ADR index/status metadata совпадают;
   - OQ-004 = `RESOLVED` и его Resolution совпадает с ADR-005;
   - PLAN/STATUS/task dependencies/statuses согласованы;
   - ADR-005 содержит оба artifact ID, precedence, no-probing, existence/degradation, owner, future upstream migration и handoff `FIX STEP-015`.

### Риски и rollback

- **Бесконтрольный hardcode под видом exception.** Митигация: artifact-ID allowlist, exact manifest anchors, schema/generation gate, no probing, central registry.
- **Закрепление текущего layout навсегда.** Митигация: future explicit manifest field имеет precedence; upstream path зафиксирован как long-term migration.
- **Split-brain через config override.** Митигация: `.project/harness-config.json` явно отклонён как topology source.
- **Документация заявит Parser ownership, а код останется Explorer-specific.** Митигация: явный обязательный handoff в FIX и запрет считать STEP-015 закрытым до его реализации/review.
- **Порча существующего dirty scope STEP-015.** Митигация: pre-RUN snapshot, точечные edits, scope-check по delta запуска.
- До Accepted/PASS draft ADR и doc-sync можно откатить как единый docs scope. После Accepted архитектурное решение не переписывается/не «откатывается»: изменение оформляется новым superseding ADR.

### Handoff

`RUN STEP-016` (Type `ADR`, architect → deterministic verification → независимый review). Не использовать `IMPLEMENT STEP-016` как coding workflow.

## Evidence

### Architect/decision phase — 2026-09-19

Создан `docs/adr/ADR-005-artifact-path-resolution.md` со статусом `Accepted` и `Supersedes: ADR-001`. ADR-001 сохранён как исторический record: изменена только lifecycle metadata (`Status: Superseded`, `Superseded by: ADR-005`).

Decision matrix:

| Вариант | Покрывает оба gap сейчас | Один owner | Совместимость с update/schema | Graceful degradation | Разблокирует STEP-015 | Решение |
|---|---|---|---|---|---|---|
| Только upstream explicit fields | нет | да | наилучшая после нового release | да | нет | long-term target |
| Override в `.project/harness-config.json` | да | нет, второй topology source | project-owned, но требует schema/watch/migration | требует нового контракта | да | отклонён |
| Fixed defaults / filesystem probing | да | формально | хрупко, не ограничено schema | может выбрать stale artifact | да | отклонён |
| Allowlisted derivation от manifest anchors | да | да, shared resolver/registry | совместимо с текущей generation; explicit field впоследствии выше | локальная, без fallback/search | да | принято |

Принятый контракт фиксирует precedence `explicit manifest field → registered derivation → unavailable`, ровно два правила для `harness.version: "1"`, запрет fallback от ошибочного explicit path и обязательную локальную деградацию. `.project/harness-config.json` не становится источником protocol topology.

Синхронизированы ADR index, architecture baseline, `OQ-004`, REQ-002/REQ-003 traceability и roadmap/status projections. Product code и `.project/manifest.yaml` не изменялись этим architect phase. Кодовый handoff остаётся обязательным: после независимого PASS review выполнить `FIX STEP-015`, вынести rules в neutral Parser/path-resolution surface, подключить Explorer/watcher/actions и повторить `REVIEW STEP-015`.

Проверки architect phase:

| Command | Exit code | Observed |
|---|---:|---|
| `cmp -s docs/requirements/SPEC.md tests/fixtures/requirements/SPEC.md` | 0 | canonical SPEC и fixture побайтно совпадают |
| `cmp -s docs/requirements/STATUS.md tests/fixtures/requirements/STATUS.md` | 0 | canonical STATUS и fixture побайтно совпадают |
| `cmp -s docs/adr/ADR-001-manifest-driven-paths.md tests/fixtures/adr/ADR-001-manifest-driven-paths.md` | 0 | исторический ADR-001 и fixture побайтно совпадают |
| `npm test -- --runInBand tests/unit/parser/markdownParser.test.ts` | 0 | 1 suite / 18 tests passed; существующий warning `ts-jest` TS151002 |
| `npm test -- --runInBand` | 0 | 19 suites / 166 tests passed |
| `python3 tools/harness/validate.py --mode commit` | 0 | `HARNESS VALIDATION: PASS (275 tracked files checked, mode=commit)`; ожидаемый warning об отсутствии staged files |
| `git diff --check` | 0 | пробельных ошибок нет |

Ручная consistency-проверка подтвердила: ADR-005/REQ/STEP targets существуют; ADR-001 изменён только в двух metadata-строках и больше не отмечен active в ADR index; `OQ-004` имеет статус `RESOLVED`; PLAN/STATUS показывают STEP-016 как `В работе`, а STEP-015 остаётся заблокированным до независимого PASS review. Scope-check относительно pre-RUN snapshot: architect phase не добавил изменений в `src/**`, `.project/manifest.yaml` или STEP-007; test edits ограничены разрешёнными fixture mirrors и прямыми parser expectations. Существующий dirty production scope STEP-015 сохранён без отката.

До независимого review STEP остаётся `В работе`, verdict — `NOT REVIEWED`.

### FIX cycle — 2026-09-19, F-001 из `REVIEW-2026-09-19T0947Z.md`

Finding F-001 закрыт точечной traceability-синхронизацией: `planning/tasks/STEP-007.md` добавлен в разрешённый/затронутый scope STEP-016; canonical STEP-007 теперь ссылается на ADR-005 и явно требует использовать neutral Parser/path-resolution resolver без собственной derivation. Scope/Goal/Acceptance Editor не менялись, production code и tests не затронуты.

| Command | Exit code | Observed |
|---|---:|---|
| `python3 tools/harness/validate.py --mode commit` | 0 | `HARNESS VALIDATION: PASS (275 tracked files checked, mode=commit)`; ожидаемый warning об отсутствии staged files |
| `git diff --check` | 0 | пробельных ошибок нет |

До нового независимого review latest verdict остаётся `FAIL`.

### Закрытие RUN — 2026-09-19

Повторный независимый review `planning/reviews/STEP-016/REVIEW-2026-09-19T0951Z.md` завершился `PASS` без новых findings и подтвердил закрытие F-001. Acceptance criteria и deterministic gates доказаны; STEP-016 закрыт как `Выполнено`. ADR-005 остаётся принятым архитектурным контрактом, а следующий runtime handoff — `FIX STEP-015` с последующим независимым `REVIEW STEP-015`.

## Review status

**Latest verdict:** PASS
**Latest report:** `planning/reviews/STEP-016/REVIEW-2026-09-19T0951Z.md` — повторный независимый review подтвердил закрытие F-001, согласованность ADR/REQ/STEP traceability, зелёные gates и соблюдение scope. Handoff → закрытие STEP-016 root-agent'ом → `FIX STEP-015` → новый независимый `REVIEW STEP-015`.

## Blocker / Failure reason

—
