# STEP-024 — Адаптировать Navigator к control-plane `.harness`

**Статус:** В работе
**Type:** BUGFIX
**Приоритет:** Критический
**Фаза:** MVP stabilization
**Depends on:** STEP-003, STEP-005, STEP-006, STEP-007, STEP-009

## Requirements

- REQ-001, REQ-002, REQ-003, REQ-005, REQ-006

## ADR

- ADR-003, ADR-005

## Risk flags

- architecture

## Goal

Восстановить совместимость extension с control-plane `.harness/**` Harness v0.5.3, не создавая fallback к удалённому `.project/**` layout.

## Context

`HARNESS UPDATE APPLY` перенёс control plane из `.project/**` в `.harness/**`. Фактический код и fixtures extension продолжают читать `.project/manifest.yaml`, а `src/api/commandPolicy.ts` импортирует удалённый `.project/command-transitions.json`; `npm run compile` завершается TS2307. Это нарушает bootstrap Parser, Command Palette, Explorer, Editor, manual handoff и локализацию для обновлённого Harness-проекта.

## Scope

- Перенести bootstrap manifest/CTS/settings paths и test fixtures на `.harness/**` согласно текущему manifest и control-plane.
- Адаптировать canonical command labels и Command Palette contract к текущему CTS, где это требуется для MVP surface.
- Обновить manifest-driven Parser, Explorer, Editor, command and i18n consumers без consumer-level path guessing.
- Добавить focused regression tests для compilation, activation и custom layout на `.harness/**`.
- Синхронизировать current-state documentation и traceability после доказанной реализации.

## Mutation policy

### Allowed

- `src/**`, `tests/**`, `package.json`, `package.nls*.json`, documentation и planning projections, относящиеся к control-plane compatibility.

### Conditional

- Новый ADR только если изучение покажет изменение устойчивого решения ADR-003 или ADR-005, а не адаптацию к upstream layout.

### Forbidden

- Fallback, probing или dual-layout поддержка `.project/**`.
- Изменение Harness-owned `.harness/**`, кроме project-owned runtime evidence.
- Реализация будущих команд вне MVP или automatic agent execution.

## Out of scope

- Status Bar (`STEP-008`), полная локализация (`STEP-010`) и coverage release work (`STEP-011`).
- Изменение upstream Harness protocol или его update graph.
- Миграция пользовательских внешних проектов вне поддерживаемого current Harness layout.
- Нормализация legacy canonical command syntax в документах/фрагментах, не затронутых
  control-plane-миграцией (`.project/**`→`.harness/**`, `docs/harness/**`→`.harness/docs/**`) —
  пример: исправление формы `<ГЛАГОЛ> SKILL`/`<ГЛАГОЛ> STEP` там, где это не часть строки,
  уже правившейся под control-plane path adaptation. Такая нормализация — отдельный
  `STEP ADD:`/`PROJECT QUICK FIX` при явном запросе, а не часть STEP-024.

## Acceptance criteria

- `npm run compile` и build проходят без ссылок на удалённый `.project/**`.
- Extension читает `.harness/manifest.yaml` и bundled/current CTS; Parser, Command Palette, Explorer, Editor и manual handoff используют только manifest-resolved или явно extension-owned paths.
- Unit и Extension Host regressions доказывают работу на fixture с `.harness/**` и отсутствие fallback к `.project/**`.
- Документация, затронутая переносом control-plane (`.project/**`→`.harness/**`,
  `docs/harness/**`→`.harness/docs/**`), использует актуальные пути и текущий canonical command
  syntax **в затронутых фрагментах**; immutable history не переписывается.
  `check-command-references.py` используется как diff-gate относительно baseline,
  зафиксированного в Evidence до начала STEP-024 (см. раздел Verification) — критерий прохождения
  — ноль **новых** findings относительно этого baseline, а не абсолютный ноль findings по всему
  репозиторию. Pre-existing findings вне затронутых control-plane фрагментов документируются в
  Evidence и остаются вне scope этого STEP (см. Out of scope).

## Verification

- `npm run compile`
- `npm run lint`
- `npm run build`
- `npm test -- --runInBand`
- `npm run test:integration`
- `npm run test:integration:pre-activation`
- `python3 .harness/tools/check-command-references.py --json` — ожидаемый результат: `DRIFT`
  допустим; критерий прохождения — 0 новых findings относительно pre-STEP baseline (зафиксирован
  в Evidence), а не абсолютный ноль findings. При описании исправлений в Evidence не цитировать
  устаревший command syntax открытым текстом (вне inline-code с явной пометкой «пример», не
  участвующей в подсчёте) — сам текст Evidence входит в область сканирования checker'а и ранее уже
  дважды порождал self-referential findings.
- `python3 .harness/tools/validate.py --mode manual`

## Deliverables

- Обновлённые runtime consumers и fixtures control-plane.
- Focused regression tests.
- Синхронизированные documentation/projections и independent review evidence.

## Implementation plan

**Plan status:** Ready
**Plan revision:** 2
**Planned at:** 2026-09-20T14:39:56+00:00
**Plan basis:** sha256:b96d8fd52a27d3702ef556b73be2ef175827ab10ffa025e139f0cc16068d3b19

1. Ввести в Parser boundary единственный extension-owned locator текущего
   bootstrap manifest (`.harness/manifest.yaml`) и перевести на него
   `src/commands/activation.ts`, `src/explorer/activation.ts` и
   `src/editor/activation.ts`, включая reload/watcher paths. Обновить
   комментарии и типовую документацию Parser с `.project/**` на `.harness/**`.
   Locator не должен пробовать старый путь: отсутствие `.harness/manifest.yaml`
   остаётся типизированной ошибкой `parseManifest`, а не переходом в legacy
   layout.

2. Сделать CTS extension-owned bundled input для `src/api/commandPolicy.ts`:
   брать актуальную таблицу из `.harness/command-transitions.json` на этапе
   сборки/package asset либо из эквивалентного source-owned representation,
   доступного в установленном extension. Сохранить fail-closed parsing,
   transition/effect checks и безопасное представление free text; сверить
   metadata и названия MVP-команд с current namespaced CTS, не добавляя
   команды за пределами 11-командной поверхности ADR-003.

3. Перенести runtime consumers на manifest-resolved/current control plane:
   Explorer paths и watchers, Editor manifest refresh/watch patterns и
   pre-activation flow, Command Palette pre-dispatch, а также extension-owned
   i18n settings. Путь к настройкам должен находиться в `.harness/**` и
   сохранять read-merge-write/fallback semantics; consumers не получают
   собственных layout guesses, dual-layout или filesystem probing.

4. Перестроить active unit и Extension Host fixtures из `.project/**` в
   `.harness/**`, включая manifest repository fields, i18n config и custom
   `taskDirectory`. Дополнить focused regressions: compilation/import bundled
   CTS, activation в workspace только с `.harness/manifest.yaml`, Editor до
   activation с custom layout, Explorer/Command Palette и i18n на новом пути,
   а также отрицательную проверку, что наличие либо отсутствие
   `.project/manifest.yaml` не образует fallback. Обновить ожидаемые
   manifest/watcher paths и snapshots только там, где fixture моделирует
   current layout.

5. После доказанной реализации синхронизировать current-state sections
   `AGENTS.md`, `README.md`, `docs/PROJECT.md`, `docs/architecture.md` и
   `docs/development.md`, а также затронутые REQ/STEP/roadmap projections с
   `.harness/**` и current canonical command syntax. Не переписывать Accepted
   ADR, historical evidence, старые review/audit/update reports или исходное
   ТЗ; при несовместимости, выходящей за адаптацию layout, остановиться и
   оформить отдельное ADR/STEP.

6. (Ревизия 2, `STEP PLAN STEP-024`) Зафиксировать canonical pre-STEP baseline для
   `check-command-references.py --json` в Evidence: baseline = **192 findings**, подтверждено
   `git stash -u` на чистом дереве до первого diff STEP-024 (см. Verification pass, attempt 2).
   Все последующие Fix/Review проходы сравнивают итог с этим зафиксированным числом, а не друг с
   другом и не с промежуточными пересчётами. При описании исправлений в Evidence не цитировать
   устаревший command syntax открытым текстом парой «старое → новое» — такой текст сам входит в
   область сканирования checker'а по `planning/tasks/**` и уже дважды порождал self-referential
   findings (194 вместо 192, затем 191 вместо 169); описывать замены нужно нейтрально (например,
   ссылкой на файл:строку и характер правки — «namespaced form по AGENTS.md §3» — без побуквенного
   воспроизведения legacy-формы).

Verification implementation pass: последовательно выполнить `npm run compile`,
`npm run lint`, `npm run build`, `npm test -- --runInBand`, `npm run test:integration`,
`python3 .harness/tools/check-command-references.py --json` и
`python3 .harness/tools/validate.py --mode manual`; отдельно зафиксировать
`git diff --check`. Перед переводом STEP в `Выполнено` нужен свежий независимый
`STEP REVIEW STEP-024`; планирование не меняет lifecycle status STEP.

## Evidence

Создано `PROJECT RECONCILE` 2026-09-20: `npm run compile` завершился TS2307 из-за удалённого `../../.project/command-transitions.json`.

### Verification pass 2026-09-20 (STEP IMPLEMENT STEP-024, attempt 2)

Все команды выполнены последовательно из корня репозитория. Exit code — буквально захваченный
(`echo "EXIT:$?"` сразу после каждой команды); текст ниже там, где отмечено «литерально», —
точный terminal output; где отмечено «резюме» — нормализованное описание, а не дословная цитата.

- `npm run compile` — exit 0. Литерально: только заголовок `tsc --noEmit`, без diagnostics (нет
  TS2307 на удалённый `.project/command-transitions.json`).
- `npm run lint` — exit 0. Литерально: только заголовок `eslint src`, без warnings/errors.
- `npm run build` — exit 0. Литерально: `esbuild: build complete.`
- `npm test -- --runInBand` — exit 0. Литерально (хвост): `Test Suites: 25 passed, 25 total` /
  `Tests: 322 passed, 322 total`. (Вывод также содержит повторяющиеся ts-jest `TS151002` config
  warnings — не влияют на exit code, pre-existing.)
- `npm run test:integration` — exit 0. Литерально (хвост Mocha-репортера): `27 passing (6s)` и
  `Exit code:   0`. Покрывает activation, Explorer (STEP-006), STEP editor (STEP-007) и Harness
  commands (STEP-005) в реальном Extension Host на fixture-workspace с `.harness/manifest.yaml`.
- `python3 .harness/tools/check-command-references.py --json` — exit 0, JSON `status: "DRIFT"`,
  192 findings (резюме подсчёта по `path`). Все findings — legacy flat command syntax без
  namespace-префикса в `README.md`, `docs/PROJECT.md`, `docs/GLOSSARY.md`,
  `docs/OPEN_QUESTIONS.md`, `docs/architecture.md`, `docs/README.md`, `planning/STATUS.md` и
  историчных `planning/tasks/STEP-001.md`…`STEP-020.md`. Проверено `git stash -u` + повторный
  прогон на чистом дереве (baseline до STEP-024): тот же `status: "DRIFT"`, те же 192 findings —
  drift существовал до начала этого STEP и не связан с control-plane `.harness/**` миграцией.
  Правки STEP-024 в `docs/PROJECT.md`/`docs/architecture.md` (пути `.project/` → `.harness/`) не
  добавили и не убрали ни одного finding — проверено точечным сравнением findings по
  `docs/PROJECT.md` после правки. Не исправлялось в рамках STEP-024: это отдельный,
  непропорционально широкий scope (переписывание historical STEP task files нарушило бы запрет на
  переписывание immutable history из AGENTS.md §10) и не относится к Scope/Goal этого STEP;
  требует отдельного STEP при явном запросе.

  **Уточнение (STEP FIX STEP-024, см. ниже, F-002):** на момент первого review прохода это число
  было ошибочно указано как pre-existing 192 без оговорок, хотя фактический прогон checker'а
  давал **194** finding. Расхождение — не ошибка checker'а: предыдущая формулировка этого самого
  пункта Evidence приводила устаревший command syntax открытым текстом в backticks, и checker,
  сканируя весь `planning/tasks/**`, засчитывал эти же цитаты как ещё 2 drift-finding
  (self-referential — Evidence описывал drift и одновременно порождал его). Формулировка выше уже
  переписана без прямого цитирования устаревшего порядка слов; после этой правки `check-command-references.py --json`
  вновь даёт ровно 192 finding — только pre-existing baseline, 0 добавленных этим STEP.
- `npm run test:integration:pre-activation` — exit 0. Литерально (хвост Mocha-репортера):
  `1 passing (744ms)`, `Exit code:   0`. Отдельный CI-gated suite (`.vscode-test.mjs` исключает
  этот файл из основного `npm run test:integration`; см. `.github/workflows/ci.yml`), покрывающий
  `tests/integration/editor.pre-activation.test.js`, который этот STEP фактически изменил (см.
  «Доработано в этом проходе» ниже). Добавлено в Verification и сюда по STEP FIX STEP-024 F-003 —
  ранее выполнялось (в т.ч. независимо ревьюером), но не фиксировалось.
- `python3 .harness/tools/validate.py --mode manual` — exit 0. Литерально:
  `HARNESS VALIDATION: PASS (409 tracked files checked, mode=manual)`.
- `git diff --check` — exit 0, пустой вывод (нет trailing whitespace / conflict markers).

### Реализация, найденная уже выполненной (git status на начало attempt 2)

Локатор bootstrap manifest (`HARNESS_MANIFEST_REL_PATH = '.harness/manifest.yaml'` в
`src/parser/artifactPaths.ts`), bundled CTS import `.harness/command-transitions.json` в
`src/api/commandPolicy.ts`, runtime consumers (`src/commands/activation.ts`,
`src/explorer/**`, `src/editor/activation.ts`, `src/locales/activation.ts` →
`.harness/harness-config.json`) и переписанные unit/integration fixtures
(`tests/fixtures/**/.harness/**`, `tests/fixtures/manifest/*.yaml`) — уже присутствовали в
рабочем дереве до этого прохода и без fallback к `.project/**` (подтверждено `grep -rn
"\.project" src/ tests/` — единственные совпадения: поле схемы `manifest.project.*`,
исторический ADR-001 fixture-контент и произвольные имена temp-директорий в generic
`readHarnessConfig`/`writeHarnessConfig` round-trip тестах, не связанные с реальным layout).

### Доработано в этом проходе (в рамках Allowed scope)

- `tests/integration/editor.pre-activation.test.js`: `manifestPath` был `.project/manifest.yaml`
  — реальный баг (Extension Host правил бы несуществующий файл вместо `.harness/manifest.yaml`,
  который читает `resolveHarnessArtifactPath`/`parseManifest`). Исправлено на
  `.harness/manifest.yaml`.
- `tests/integration/i18n.test.js`: `configPath()` был `.project/harness-config.json`, тогда как
  `src/locales/activation.ts → resolveConfigPath()` резолвит `.harness/harness-config.json` —
  тест писал/читал не тот файл, который использует runtime. Исправлено на
  `.harness/harness-config.json`.
- Doc sync (Implementation plan, шаг 5), current-state упоминания `.project/manifest.yaml` /
  `.project/harness-config.json` / `.project/git-policy.toml` заменены на `.harness/**`:
  `docs/PROJECT.md` (in-scope раздел), `docs/architecture.md` (Parser layer, Security
  boundaries), `docs/development.md` (Testing, Git и CI), `AGENTS.md` (Project context: ADR-001
  помечен Superseded by ADR-005, добавлена current manifest path). Не переписаны: Accepted/
  Superseded ADR-файлы (`docs/adr/ADR-001-*.md`, `docs/adr/ADR-005-*.md`, immutable), `docs/adr/
  README.md` (историческая цитата title ADR-001), `docs/OPEN_QUESTIONS.md` (OQ-004 — историческая
  запись resolved open question), `planning/STATUS.md` (historical evidence entries), исторические
  `planning/tasks/STEP-NNN.md`/`planning/reviews/**`/`planning/audits/**`/`planning/
  harness-updates/**` (immutable history по AGENTS.md §10), `TZ_REVIEW_AND_PLAN.md` (исходное ТЗ).

### STEP FIX STEP-024 (findings из `planning/reviews/STEP-024/REVIEW-2026-09-20T1304Z.md`)

**F-001 (Medium, исправлено):** Добавлены focused unit regressions, доказывающие пин литерала
bootstrap path и отсутствие fallback к `.project/**` (deterministic gate, не только статический
код-ревью):

- `tests/unit/parser/artifactPaths.test.ts` — новый `describe('HARNESS_MANIFEST_REL_PATH')`:
  `expect(HARNESS_MANIFEST_REL_PATH).toBe('.harness/manifest.yaml')` — сравнение с буквальным
  литералом, а не константы с собой.
- `tests/unit/explorer/paths.test.ts` — новый `describe('MANIFEST_REL_PATH')`, тот же пин для
  `MANIFEST_REL_PATH` (устраняет тавтологию, отмеченную ревьюером в `paths.test.ts:25`; сам тест на
  строке 25 не удалён — он проверяет другое свойство, что источник Project Configuration item'а —
  именно этот re-export, а не отдельный литерал).
- `tests/unit/parser/yamlParser.test.ts` — новый тест `parseManifest`: `mkdtemp` создаёт tmp-каталог
  **только** с `.project/manifest.yaml` (валидным по schema — скопирован fixture, чтобы отличить
  «не нашёл файл» от «нашёл, но не распарсил»); `parseManifest(join(dir, HARNESS_MANIFEST_REL_PATH))`
  проверяется на `result.ok === false` и `result.error.kind === 'not-found'` — типизированная
  ошибка, не молчаливое чтение legacy-файла.
- `tests/unit/explorer/refresh.test.ts` — новый тест: ни один `relGlob` из `watchedPaths(manifest)`
  не начинается с `.project/`.
- `tests/unit/editor/activation.test.ts` — новый тест: ни один pattern из
  `stepEditorWatchPatterns(editorManifest)` не начинается с `.project/`.

Итог: unit suite вырос с 322 до 327 тестов (см. Verification pass ниже), все 5 новых — зелёные.
Production code не менялся (F-001 — test-only gap).

**F-002 (Low, исправлено):** Пункт Evidence про `check-command-references.py` исправлен: указано
фактическое число (194 на момент review, из которых 2 — self-referential drift, порождённый самой
предыдущей формулировкой этого же пункта через прямое цитирование устаревшего порядка слов в
backticks). Формулировка переписана без цитирования legacy word order; после правки инструмент
снова даёт ровно 192 finding (см. независимый прогон ниже) — весь этот delta пришёлся на сам
Evidence-текст, а не на production/doc правки STEP-024.

**F-003 (Low, исправлено):** `npm run test:integration:pre-activation` добавлен в секцию
Verification (см. выше) и в Evidence (результат зафиксирован в Verification pass ниже) — это
CI-gated suite, покрывающий реально изменённый в рамках STEP-024 `tests/integration/editor.pre-activation.test.js`.

**F-004 (Low, намеренно не исправлено в рамках STEP-024):** устаревший комментарий в
`.vscode-test.mjs:12-13` про `.project/harness-config.json` — вне Allowed mutation scope этого
STEP (`.vscode-test.mjs` не входит в `src/**`/`tests/**`/перечисленную документацию). Оставлено как
кандидат в отдельный `PROJECT QUICK FIX` по рекомендации ревьюера.

#### Verification pass 2026-09-20 (STEP FIX STEP-024)

Все команды выполнены заново из корня репозитория после правок F-001–F-003; exit code — буквально
захваченный (`echo "EXIT:$?"` сразу после каждой команды).

- `npm run compile` — exit 0. Литерально: только заголовок `tsc --noEmit`, без diagnostics.
- `npm run lint` — exit 0. Литерально: только заголовок `eslint src`, без warnings/errors.
- `npm run build` — exit 0. Литерально: `esbuild: build complete.`
- `npm test -- --runInBand` — exit 0. Литерально (хвост): `Test Suites: 25 passed, 25 total` /
  `Tests: 327 passed, 327 total` (322 из attempt 2 + 5 новых regression из F-001).
- `npm run test:integration` — exit 0. Литерально (хвост Mocha-репортера): `27 passing (6s)`,
  `Exit code:   0`.
- `npm run test:integration:pre-activation` — exit 0. Литерально (хвост Mocha-репортера):
  `1 passing (772ms)`, `Exit code:   0`.
- `python3 .harness/tools/check-command-references.py --json` — exit 0, JSON `status: "DRIFT"`,
  **192** findings (тот же pre-existing baseline; self-referential 2 finding из предыдущей
  формулировки Evidence устранены переформулировкой — см. F-002).
- `python3 .harness/tools/validate.py --mode manual` — exit 0. Литерально:
  `HARNESS VALIDATION: PASS (409 tracked files checked, mode=manual)`.
- `git diff --check` — exit 0, пустой вывод.

### STEP FIX STEP-024, второй проход (findings из `planning/reviews/STEP-024/REVIEW-2026-09-20T1403Z.md`)

**F-001 (Medium, исправлено):** doc sync первого прохода правил `.project/**` current-state
упоминания, но пропустил отдельный namespace `docs/harness/**`, удалённый тем же relocation
`870e728` (`HARNESS UPDATE APPLY` v0.5.3) — актуальное расположение этой документации
`.harness/docs/**` (подтверждено `git show 870e728 --stat` и наличием файлов на текущем `HEAD`).
Исправлены висящие ссылки в четырёх project-owned docs:

- `docs/development.md:60` — `docs/harness/GIT_WORKFLOW.md` → `.harness/docs/GIT_WORKFLOW.md`
  (в том же предложении, где `.project/git-policy.toml` уже был исправлен на
  `.harness/git-policy.toml` первым проходом).
- `docs/skills/README.md:9` — `docs/harness/SKILL_MANAGEMENT.md` → `.harness/docs/SKILL_MANAGEMENT.md`.
- `docs/GLOSSARY.md:7` — markdown-ссылка `[`harness/GLOSSARY.md`](harness/GLOSSARY.md)` →
  `[`.harness/docs/GLOSSARY.md`](../.harness/docs/GLOSSARY.md)`.
- `docs/README.md:19-25` — раздел «Документация Harness» переписан с `harness/` (каталог внутри
  `docs/`, не существующий на текущем `HEAD`) на `.harness/docs/**`: заголовок раздела, три
  пункта списка (`README.md`, `DOCUMENT_MODEL.md`, `GLOSSARY.md`).

`.harness/docs/**` не изменён (Harness-owned) — правки только в пойнтерах на него из
project-owned docs, как и требовал fix direction ревьюера.

**F-002 (Low, исправлено, выбран вариант (a)):** из 192 pre-existing findings
`check-command-references.py` 23 находились в пяти live mutable документах, не покрытых
обоснованием immutable-history в Evidence: `docs/PROJECT.md` (18), `README.md` (2),
`docs/GLOSSARY.md` (1), `docs/README.md` (1), `docs/architecture.md` (1). Выбран вариант (a) —
точечное исправление, а не сужение criterion 4 — потому что после точного перечисления
findings это оказался механический, низкорисковый набор из двух паттернов (заголовочная форма
init-команды — 4 вхождения; развёрнутый список canonical command labels в `docs/PROJECT.md:25,44`
и `README.md:8` — остальные вхождения), полностью внутри Allowed scope («documentation и planning
projections, относящиеся к control-plane compatibility» — здесь речь о текущем canonical command
syntax, том же измерении current-state, что и path adaptation), без риска задеть несвязанный
контент. Ниже каждая позиция описана как file:line + характер правки (namespaced form per
AGENTS.md §3), без побуквенного воспроизведения pre-namespace формы — сама эта Evidence-строка
входит в область сканирования checker'а по `planning/tasks/**`, и цитирование обеих сторон замены
ранее уже дважды порождало self-referential drift (см. F-002 первого прохода выше). Исправлено:

- `README.md:8` — две команды `STEP PLAN STEP-NNN` в тексте примера приведены к namespaced form
  (verb-first форма без префикса `STEP` заменена на текущую).
- `docs/PROJECT.md:3` — заголовочная ссылка на команду инициализации проекта приведена к
  namespaced form (шапка файла).
- `docs/PROJECT.md:25` — список из 11 MVP-команд: восемь позиций (инициализация, планирование,
  реализация, review, fix, run, next-команда, статус-команда, quick-fix-команда,
  reconcile-команда) приведены к namespaced canonical form per AGENTS.md §3; `ADD STEP` в этом же
  перечислении не тронут — checker его как drift не отмечает, отдельного canonical mapping для
  этой формы вне scope правки этого прохода (нормализовано позже, см. третий проход ниже).
- `docs/PROJECT.md:44` — список out-of-scope команд: GitHub-templates-команда, audit-команда,
  harness-update-команды (check/apply) и все четыре git-команды (commit/push/pr/sync) приведены к
  namespaced canonical form.
- `docs/architecture.md:3`, `docs/GLOSSARY.md:3`, `docs/README.md:3` — заголовочная ссылка на
  команду инициализации проекта приведена к namespaced form.

Независимый повторный прогон `check-command-references.py --json` после правок: `status: "DRIFT"`,
**169** findings (192 − 23), из них 0 приходится на `docs/PROJECT.md`, `README.md`,
`docs/GLOSSARY.md`, `docs/README.md`, `docs/architecture.md` — эти пять файлов полностью чисты.
Остаток 169 — прежний pre-existing baseline в historical/immutable документах
(`planning/tasks/STEP-001..020.md`, `docs/OPEN_QUESTIONS.md`, `planning/STATUS.md`), покрытый
обоснованием AGENTS.md §10, не relevant к control-plane path adaptation и не тронут этим STEP.

#### Verification pass 2026-09-20 (STEP FIX STEP-024, второй проход)

Все команды выполнены заново из корня репозитория после docs-only правок F-001/F-002; exit
code — буквально захваченный (`echo "EXIT:$?"` сразу после каждой команды). Production code и
тесты в этом проходе не менялись.

- `npm run compile` — exit 0. Литерально: только заголовок `tsc --noEmit`, без diagnostics.
- `npm run lint` — exit 0. Литерально: только заголовок `eslint src`, без warnings/errors.
- `npm run build` — exit 0. Литерально: `esbuild: build complete.`
- `npm test -- --runInBand` — exit 0. Литерально (хвост): `Test Suites: 25 passed, 25 total` /
  `Tests: 327 passed, 327 total` (без изменений — docs-only проход).
- `npm run test:integration` — exit 0. Литерально (хвост Mocha-репортера): `27 passing (6s)`,
  `Exit code:   0`.
- `npm run test:integration:pre-activation` — exit 0. Литерально (хвост Mocha-репортера):
  `1 passing (636ms)`, `Exit code:   0`.
- `python3 .harness/tools/check-command-references.py --json` — exit 0, JSON `status: "DRIFT"`,
  **169** findings (было 192; −23 в пяти live docs по F-002, 0 добавленных). Ноль findings, связанных
  с control-plane путями `.harness/**`/`.project/**`.
- `python3 .harness/tools/validate.py --mode manual` — exit 0. Литерально:
  `HARNESS VALIDATION: PASS (409 tracked files checked, mode=manual)`.
- `git diff --check` — exit 0, пустой вывод.

Криterion 4 («Документация отражает реализованный control-plane и текущий canonical command
syntax») теперь имеет deterministic evidence по обеим половинам: dangling `docs/harness/**`
references устранены (F-001), а command-syntax drift в live project-owned docs сведён к нулю
(F-002); остаточный `DRIFT` статус checker'а относится исключительно к historical/immutable
записям вне scope этого STEP.

Свежий независимый `STEP REVIEW STEP-024` — отдельная следующая команда; этот проход её не
заменяет.

### STEP FIX STEP-024, третий проход (findings из `planning/reviews/STEP-024/REVIEW-2026-09-20T1418Z.md`)

**F-001 (Medium, исправлено):** раздел «STEP FIX STEP-024, второй проход» (описание F-002 второго
прохода, ранее строки 315-335) перечислял обе стороны каждой command-syntax замены в backticks —
исходную (pre-namespace) и целевую форму. Поскольку сама эта Evidence-строка входит в область
сканирования `check-command-references.py` по `planning/tasks/**`, каждая исходная форма
засчитывалась как ещё один drift-finding — 22 self-referential finding поверх 169 pre-existing
(169 + 22 = 191). Это регрессия того же дефекта, который цикл 1 уже нашёл и объявил закрытым
(тогда — 2 finding; сейчас — 22, из-за развёрнутого перечисления всех замен F-002 второго прохода
дословными парами). Исправление: соответствующий блок переписан так, чтобы каждая позиция
описывалась как `file:line` + характер правки («namespaced form per AGENTS.md §3», с указанием
какая именно команда или группа команд затронута), без побуквенного воспроизведения
pre-namespace словоформы в backticks. Ни исходные, ни целевые формы больше не цитируются парой
«старое → новое»; там, где целевая (canonical, уже действующая) форма упоминается отдельно вне
такой пары, это не входит в checker-scope, поэтому не создаёт finding. Независимый повторный
прогон после правки: `status: "DRIFT"`, **169** findings — совпадает с зафиксированным canonical
pre-STEP baseline (Implementation plan, шаг 6), 0 findings относятся к `planning/tasks/STEP-024.md`
(проверено фильтрацией findings JSON по `path`).

**F-002 (Low, исправлено):** три живые строки с pre-namespace command syntax, не покрытые
checker'ом (для этих словоформ в его таблице нет mapping), но входящие в criterion 4 буквально
(«текущий canonical command syntax»):

- `docs/skills/README.md:9` — перечисление skill-команд приведено к namespaced форме per
  AGENTS.md §3 (`SKILL FIND`, `SKILL INSTALL`, `SKILL CREATE` вместо verb-first порядка слов без
  префикса `SKILL`).
- `docs/PROJECT.md:44` — оставшаяся из списка out-of-scope команд skill-группа
  (`FIND`/`INSTALL`/`CREATE SKILL`) приведена к namespaced форме — остальные семь позиций этой же
  строки уже были приведены вторым проходом.
- `docs/PROJECT.md:25` — форма для команды добавления шага в списке 11 MVP-команд приведена к
  namespaced форме (`STEP ADD:`) — эта позиция была явно отложена во втором проходе (см. F-002
  второго прохода выше) и теперь нормализована.

Обе строки правлены точечно, без затрагивания соседнего контента; риск нулевой (docs-only,
verb order change, без изменения ссылок на пути или семантики).

**F-003 (Low, исправлено):** `docs/PROJECT.md:68` (раздел «Референсы и внешние источники»)
ссылался на `planning/EXECUTION_PROTOCOL.md` и `docs/harness/COMMANDS.md` в соседнем
`ai-development-harness-template` — оба пути отсутствуют там же (проверено листингом
`../ai-development-harness-template`), поскольку тот же upstream control-plane relocation
перенёс их под `.harness/docs/`. Обе ссылки заменены на текущее фактическое расположение
(`.harness/docs/EXECUTION_PROTOCOL.md`, `.harness/docs/COMMANDS.md`) с сохранением атрибуции
соседнему репозиторию как источнику структуры проекта.

Затронутые файлы этого прохода: `planning/tasks/STEP-024.md` (только раздел Evidence, описание
F-002 второго прохода), `docs/skills/README.md`, `docs/PROJECT.md` — все внутри Allowed mutation
scope («documentation и planning projections, относящиеся к control-plane compatibility»,
namespaced command syntax уже квалифицировался как то же измерение current-state во втором
проходе). Harness-owned `.harness/**`, `docs/adr/**` и прочая immutable history не изменены.
Production code и тесты не менялись.

#### Verification pass 2026-09-20 (STEP FIX STEP-024, третий проход)

Все команды выполнены заново из корня репозитория после правок F-001–F-003; exit code —
буквально захваченный (`echo "EXIT:$?"` сразу после каждой команды). Docs-only проход;
production code и тесты не менялись.

- `npm run compile` — exit 0. Литерально: только заголовок `tsc --noEmit`, без diagnostics.
- `npm run lint` — exit 0. Литерально: только заголовок `eslint src`, без warnings/errors.
- `npm run build` — exit 0. Литерально: `esbuild: build complete.`
- `npm test -- --runInBand` — exit 0. Литерально (хвост): `Test Suites: 25 passed, 25 total` /
  `Tests: 327 passed, 327 total` (без изменений — docs-only проход).
- `npm run test:integration` — exit 0. Литерально (хвост Mocha-репортера): `27 passing (6s)`,
  `Exit code:   0`.
- `npm run test:integration:pre-activation` — exit 0. Литерально (хвост Mocha-репортера):
  `1 passing (740ms)`, `Exit code:   0`.
- `python3 .harness/tools/check-command-references.py --json` — exit 0, JSON `status: "DRIFT"`,
  **169** findings — совпадает с canonical pre-STEP baseline (192) минус 23 findings, закрытых
  вторым проходом (F-002 второго прохода); 0 findings в `planning/tasks/STEP-024.md` (проверено
  фильтрацией JSON output по `path == "planning/tasks/STEP-024.md"`, а не подсчётом по тексту
  Evidence).
- `python3 .harness/tools/validate.py --mode manual` — exit 0. Литерально:
  `HARNESS VALIDATION: PASS (409 tracked files checked, mode=manual)`.
- `git diff --check` — exit 0, пустой вывод.

Criterion 4 по итогам этого прохода: `check-command-references.py` возвращает ровно
canonical baseline (169 = 192 − 23) с нулём self-inflicted findings в самом task-файле; три
дополнительные live pre-namespace формы, не покрытые checker'ом (F-002 этого прохода), и одна
dangling-ссылка на неверный upstream путь (F-003 этого прохода) устранены точечно. Свежий
независимый `STEP REVIEW STEP-024` — отдельная следующая команда; этот проход её не заменяет.

## Review status

**Latest verdict:** PASS
**Latest report:** `planning/reviews/STEP-024/REVIEW-2026-09-20T1505Z.md`

История review-циклов:

- `planning/reviews/STEP-024/REVIEW-2026-09-20T1304Z.md` — `FAIL` (F-001 Medium, F-002/F-003/F-004 Low).
  Исправления внесены `STEP FIX STEP-024` (см. соответствующий раздел Evidence выше).
- `planning/reviews/STEP-024/REVIEW-2026-09-20T1403Z.md` — второй независимый проход, `FAIL`.
  F-001–F-003 предыдущего прохода подтверждены закрытыми (новые регрессии доказаны
  mutation-инъекцией; drift-baseline 192 подтверждён поэлементным сравнением с чистым `HEAD`;
  pre-activation suite выполнена), F-004 корректно оставлен вне scope. Открыты два новых
  finding по acceptance criterion 4: F-001 (Medium) — висящие ссылки на удалённый namespace
  `docs/harness/**` в `docs/development.md:60`, `docs/README.md:19-25`, `docs/GLOSSARY.md:7`,
  `docs/skills/README.md:9`; F-002 (Low) — обоснование отказа от command-syntax drift
  покрывает 168 findings из 192, оставшиеся 23 строки живых mutable документов без решения.
- `planning/reviews/STEP-024/REVIEW-2026-09-20T1418Z.md` — третий независимый проход, `FAIL`.
  Acceptance criteria 1-3 подтверждены выполненными: собранный `dist/extension.js` проверен на
  отсутствие legacy путей, единственный locator подтверждён, отсутствие fallback доказано
  повторной mutation-инъекцией. Четыре dangling-ссылки цикла 2 подтверждены исправленными —
  проверкой фактического существования целевых файлов, а не текста правки; drift в пяти
  названных живых документах подтверждён нулевым. Mutation scope второго прохода (docs-only)
  соблюдён, immutable history не переписана, вся Verification воспроизведена с exit 0.
  Открыты три новых finding по criterion 4: F-001 (Medium) — Evidence фиксирует 169 findings
  `check-command-references.py`, свежий прогон даёт 191; разница ровно 22 — self-referential
  drift, внесённый самим текстом описания исправления в `planning/tasks/STEP-024.md:315-335`
  (регрессия дефекта, уже найденного и объявленного закрытым в цикле 1); F-002 (Low) — три
  живые строки с pre-namespace command syntax (`docs/skills/README.md:9`, `docs/PROJECT.md:44`
  и `:25`), две из них в строке, которую правил этот же проход, checker их не покрывает;
  F-003 (Low) — `docs/PROJECT.md:68` ссылается на два пути, не существующие ни здесь, ни в
  соседнем `ai-development-harness-template`, которому они атрибутированы.
- `planning/reviews/STEP-024/REVIEW-2026-09-20T1505Z.md` — четвёртый независимый проход, `PASS`.
  Все четыре acceptance criteria выполнены. Criteria 1-3 подтверждены заново собственной
  mutation-инъекцией ревьюера (locator переведён на legacy литерал — 6 упавших тестов; настоящий
  fallback в `parseManifest` — падает ровно целевой no-fallback тест), сборка проверена на уровне
  `dist/extension.js`. Criterion 4 оценён по суженной формулировке ревизии 2: diff-gate выполнен
  строго — pre-STEP baseline **независимо восстановлен ревьюером** из чистого `HEAD`
  (`git archive HEAD` в изолированный каталог) и дал ровно **192**, текущее дерево — ровно **169**,
  поэлементная разница −23 приходится ровно на пять правившихся живых документов и ни на один
  другой файл; **0** findings в `planning/tasks/STEP-024.md` (фильтрация JSON по `path`).
  Все три finding цикла 3 закрыты и проверены по фактическому состоянию файлов и существованию
  целевых путей, а не по тексту правок. Вся Verification-последовательность из девяти команд
  воспроизведена с exit 0 и совпала с Evidence. Mutation scope прохода (три docs/planning файла)
  соблюдён, immutable history не переписана. Открыт один non-blocking finding: L-1 (Low) — две
  строки Evidence (`:358`, `:432`) сохранили дословное inline-code упоминание pre-namespace
  словоформ; findings они не порождают только из-за lookahead `(?=[:\s])` в паттернах
  Harness-owned checker'а, поэтому риск чисто латентный и не блокирует. Наблюдения цикла 3
  (`.vscode-test.mjs:12-13`, семь `ADR-001`-комментариев в `src/**`) подтверждены как
  сознательно отложенные вне scope.

Доработка — docs-only, внутри Allowed mutation scope; production code и тесты не затрагиваются.

**Примечание к FAIL-вердикту цикла 2:** оба его finding (F-001, F-002) адресованы вторым
проходом `STEP FIX STEP-024` — см. раздел «STEP FIX STEP-024, второй проход» в Evidence выше;
цикл 3 подтвердил их закрытыми по существу. Оставшиеся открытыми findings — из цикла 3.

**Примечание к FAIL-вердикту цикла 3:** все три finding (F-001, F-002, F-003) адресованы третьим
проходом `STEP FIX STEP-024` — см. раздел «STEP FIX STEP-024, третий проход» в Evidence выше:
self-referential Evidence-текст переписан нейтрально (независимо подтверждено 169 findings, 0 в
`planning/tasks/STEP-024.md`), три live pre-namespace строки нормализованы, dangling-ссылка на
`docs/PROJECT.md:68` исправлена. Verdict выше сохранён как `FAIL` до свежего независимого
`STEP REVIEW STEP-024` — этот проход его не меняет.

## Blocker / Failure reason

—
