# STEP-026 — Исправить подсветку ссылок Harness во вложенном Markdown

**Статус:** Выполнено
**Type:** BUGFIX
**Приоритет:** Высокий
**Фаза:** MVP stabilization
**Depends on:** STEP-007, STEP-021, STEP-023

## Requirements

- REQ-003

## ADR

- ADR-002
- ADR-005

## Risk flags

- none

## Goal

Сделать подсветку ссылок `REQ-NNN`, `STEP-NNN` и `ADR-NNN` одинаковой во всех
поддерживаемых Markdown-контекстах STEP-файла, не меняя их navigation/definition
поведение.

## Context

Пользователь подтвердил, что Ctrl+Click корректно резолвит ссылки в обычном
тексте и в списках, но TextMate-подсветка применяется непоследовательно: ссылки
в простом тексте получают Harness scope, а те же ссылки внутри Markdown-списков
или других вложенных контекстов остаются без него. `DefinitionProvider` ищет
ссылки регулярным выражением по строке и не зависит от grammar, поэтому это
локальный visual defect grammar layer, а не дефект index или manifest resolution.

STEP-021 уже завершён с compositional grammar `text.html.markdown`; его task и
immutable review reports не изменяются. Нужен отдельный corrective STEP, который
устранит взаимодействие custom reference rule с вложенными правилами Markdown.

## Scope

- Проанализировать composition/injection boundary TextMate grammar для
  `harness-step` и выбрать поддерживаемый VS Code способ применения reference
  scope внутри Markdown-вложений.
- Исправить grammar contribution так, чтобы `REQ-NNN`, `STEP-NNN` и `ADR-NNN`
  получали единый Harness scope в обычном тексте, списках и прочих поддерживаемых
  Markdown-контекстах.
- Добавить regression-покрытие grammar contribution и фактически доступного
  tokenization seam; явно документировать platform blocker, если public VS Code
  API не позволяет наблюдать scopes программно.
- Сохранить существующие Markdown grammar composition, navigation, hover,
  autocomplete, diagnostics и CodeLens.

## Mutation policy

### Allowed

- `syntaxes/**`, `package.json`, `package-lock.json`, `.vscodeignore`, связанные `tests/**` и минимальная
  platform-compatibility документация.
- Этот task, `planning/PLAN.md`, `planning/STATUS.md`, REQ-003 traceability и
  новый immutable review report STEP-026.

### Conditional

- Новая test-only dependency — только если без неё нельзя доказать scopes через
  public, стабильный API и её необходимость подтверждена PLAN.

### Forbidden

- Изменение `src/editor/definitionProvider.ts` или navigation semantics: они
  уже работают во всех наблюдённых контекстах.
- Копирование или vendor обычной Markdown grammar, использование internal VS
  Code API, изменение Harness artifact format/manifest или reopening STEP-021.

## Out of scope

- Новые виды ссылок, изменение diagnostics, autocomplete, CodeLens или quick
  actions.
- Цветовая тема VS Code и пользовательские theme overrides.
- Изменения в завершённых task/review артефактах STEP-007, STEP-021, STEP-022 и
  STEP-023.

## Acceptance criteria

- `REQ-NNN`, `STEP-NNN` и `ADR-NNN` имеют Harness reference scope в обычном
  тексте и внутри Markdown-списка в `harness-step` document.
- Исправление не лишает документ стандартной Markdown tokenization для fenced
  code, links, emphasis и inline code.
- Ctrl+Click/definition resolution продолжает работать для всех трёх типов
  ссылок в обоих контекстах.
- Regression покрывает defect либо фиксирует конкретный public platform blocker
  без ложного заявления о проверке scopes.

## Verification

- Focused grammar/tokenization regression и существующие editor provider tests.
- `npm run compile`
- `npm run lint`
- `npm test`
- `npm run build`
- `npm run test:integration`
- `python3 .harness/tools/validate.py --mode commit`
- `git diff --check`

## Deliverables

- Исправленная TextMate grammar/injection contribution для `harness-step`.
- Focused regression tests и проверенное evidence.
- Синхронизированные task/REQ/roadmap projections и независимый review report.

## Implementation plan

**Plan status:** Ready
**Plan revision:** 1
**Planned at:** 2026-09-20T17:13:23+00:00
**Plan basis:** sha256:26e3c7c61150a622577922d85f31e453be79999baf7ab699bf9b14fd2af2471b

### Предпосылки и границы

- Дефект воспроизведён на текущем `syntaxes/harness-step.tmLanguage.json`:
  верхнеуровневое правило `constant.other.reference.harness-step` конкурирует
  только на root scope, тогда как Markdown list/blockquote rules создают
  вложенный scope. `DefinitionProvider` (`src/editor/definitionProvider.ts`)
  сканирует всю строку самостоятельно, поэтому его менять нельзя и не нужно.
- Официальный VS Code TextMate contract поддерживает injection grammar через
  `contributes.grammars[].injectTo` и `injectionSelector`; это не требует
  копирования Markdown grammar, internal VS Code API или нового ADR.
- Current architecture note запрещает новую test dependency лишь потому, что
  STEP-021 не имел проверяемого public seam. Здесь visual regression требует
  token-level proof: допустимо добавить только test dependency `vscode-textmate`
  с `vscode-oniguruma`, если опытный tokenization regression не может быть
  построен через уже установленные пакеты. Такое изменение синхронизирует
  `docs/architecture.md`, но не попадает в runtime VSIX.

### Порядок реализации

1. Вынести rule для `REQ|STEP|ADR-NNN` в отдельную injection grammar
   `syntaxes/harness-step-references.tmLanguage.json`. Зарегистрировать её в
   `package.json` с отдельным `scopeName`, `injectTo:
   ["text.harness-step.markdown"]` и left-priority `injectionSelector`, чтобы
   rule применяется раньше Markdown rule в nested contexts. Основная grammar
   сохраняет `text.html.markdown` include и другие Harness rules; дублирующее
   root reference rule удалить после того, как injection покрывает root и
   nested contexts.
2. Ограничить selector так, чтобы reference rule не переопределяло Markdown
   code contexts (fenced и inline code), если фактическая tokenization
   подтвердит их отдельные scopes. Списки, blockquotes и prose остаются целями
   injection. Не добавлять special cases по конкретным ID или по файлам.
3. Добавить focused grammar test. Он загружает installed Markdown grammar из
   реального VS Code test runtime через standalone TextMate tokenizer и
   регистрирует Harness grammar + injection grammar. Проверить scopes для
   `REQ-NNN`, `STEP-NNN`, `ADR-NNN` в prose, list и blockquote, а также
   сохранение Markdown scope для fenced code, inline code, emphasis и links.
   Если actual runtime grammar нельзя загрузить детерминированно в CI, test
   фиксирует contribution shape, а manual Extension Development Host check
   остаётся отдельным непрошедшим acceptance blocker.
4. Сохранить existing provider tests и добавить/расширить Extension Host
   regression, доказывающую definition resolution тех же трёх ID в prose и
   list. Это предотвращает accidental coupling visual grammar с navigation.
5. Обновить architecture note только по принятому test seam, затем выполнить
   полный verification gate. Evidence фиксирует реальные command results, а
   Review выполняется отдельным независимым проходом.

### Затрагиваемые области и совместимость

- Изменяются `syntaxes/harness-step.tmLanguage.json`, новый injection grammar,
  `package.json`/lockfile, focused editor tests и, при добавлении test seam,
  `docs/architecture.md`.
- VSIX продолжает включать обе grammar JSON через `.vscodeignore`; package test
  должен подтвердить это явно.
- Manifest paths, language association, parser/index и все editor providers не
  меняются. Поддерживаемый VS Code baseline остаётся `^1.137.0`.

### Стратегия тестирования и verification

1. Tokenization regression: все три reference ID получают
   `constant.other.reference.harness-step` в prose/list/blockquote, при этом
   Markdown code/link/emphasis scopes остаются доступны.
2. Existing unit/integration editor tests: Definition Provider по-прежнему
   резолвит REQ/STEP/ADR в том же document, независимо от visual grammar.
3. Последовательно выполнить `npm run compile`, `npm run lint`, `npm test`,
   `npm run build`, `npm run test:integration`, `npm run package`,
   `python3 .harness/tools/validate.py --mode commit` и `git diff --check`.

### Риски и rollback

- Неправильный injection selector может перекрыть code-fence или inline-code
  tokenization. Token-level regression содержит отрицательные cases; rollback
  удаляет только injection contribution и возвращает root rule.
- Runtime Markdown grammar может меняться между VS Code releases. Test загружает
  именно version, используемую Extension Host, а lockfile фиксирует standalone
  tokenizer. При несовместимости task блокируется с точным evidence вместо
  добавления internal API или vendored grammar.
- Новая grammar должна попасть в VSIX. Проверка `npm run package` и contents
  archive — обязательный release-safety gate.

## Evidence

- `npx jest tests/unit/editor/grammar.test.ts --runInBand` — exit 0: TextMate
  regression прошёл (1 suite, 1 test); подтверждены prose, list, blockquote и
  исключения для inline/fenced code.
- `npm run compile` — exit 0.
- `npm run lint` — exit 0.
- `npm test` — exit 0: 26 suites, 332 tests passed.
- `npm run build` — exit 0.
- `XDG_RUNTIME_DIR=/tmp npm run test:integration` — exit 0: 27 Extension Host
  tests passed, включая Definition Provider в prose и списке.
- `npm run package` — exit 0: VSIX содержит
  `syntaxes/harness-step.tmLanguage.json` и
  `syntaxes/harness-step-references.tmLanguage.json`.
- `python3 .harness/tools/validate.py --mode commit` — exit 0,
  `HARNESS VALIDATION: PASS`.
- `git diff --check` — exit 0.

## Review status

**Latest verdict:** PASS
**Latest report:** `planning/reviews/STEP-026/REVIEW-2026-09-20T1727Z.md`

## Blocker / Failure reason

—
