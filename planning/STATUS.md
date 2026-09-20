# Project Status

> Projection текущего execution state. Обновляется из canonical task/evidence и requirements.

## Summary

Проект инициализирован (`INIT PROJECT`, 2026-09-17). Roadmap состоит из 13 STEP MVP (STEP-001..STEP-013), corrective STEP-014/STEP-015/STEP-021 и architecture reconciliation STEP-016..STEP-020, покрывающих REQ-001..REQ-006. Phase 2 REQ (REQ-007..REQ-010) зафиксированы как `Отложено` без STEP. Project scaffolding/инструментарий (`STEP-002`), Parser layer (`STEP-003`), i18n service (`STEP-004`), Command Palette с 11 MVP-командами + pre-dispatch валидацией (`STEP-005`), Sidebar Explorer (`STEP-006`), Smart STEP Editor (`STEP-007`, corrective `STEP-021`), manual handoff (`STEP-009`), corrective STEP-014/STEP-015 и ADR STEP-016..STEP-020 выполнены. Status Bar остаётся в будущем STEP-008.

## In progress

—

## Blocked

—

## Next unblocked work

- `STEP-008` (Status Bar) — зависел от STEP-003, STEP-005, оба `Выполнено` — полностью разблокирован, доступен для `PLAN`.

## Recent completed

- `STEP-021` — corrective BUGFIX Smart STEP Editor: устранены diagnostics
  циклов в несохранённом документе, stale validation и некорректная Markdown
  comment configuration; runtime watcher следует manifest-resolved
  `taskDirectory`, а grammar композиционно сохраняет Markdown. PASS
  (`planning/reviews/STEP-021/REVIEW-2026-09-20T0755Z.md`) подтвердил
  исправления и полный verification gate.

- `STEP-007` — STEP File Editor: custom language, advisory diagnostics,
  CodeLens/Definition/Hover, autocomplete и guarded quick actions. Единый
  manifest-resolved index следует за внешними create/change/delete; generation
  guard не допускает возврата устаревшего index при перекрывающихся refresh.
  Independent review — PASS
  (`planning/reviews/STEP-007/REVIEW-2026-09-20T0708Z.md`); проверки: compile,
  lint, build, 309 unit tests, 27 Extension Host tests и Harness validation.
  Последующий independent review обнаружил production gaps; их устранил
  corrective STEP-021 с PASS review.

- `STEP-009` — manual-only handoff для agent-requiring команд: CTS и Mutation
  policy pre-validation выполняются до handoff, text-command получает
  локализованный неисполняемый safe descriptor, а command без free text
  сохраняет exact canonical command. PASS
  (`planning/reviews/STEP-009/REVIEW-2026-09-20T0422Z.md`) подтвердил safe
  release target, RU/EN UI sinks, invalid-chain blocker и no-spawn boundary.
  Automatic lifecycle остаётся вне MVP и требует нового ADR.

- `STEP-020` — принят ADR-011 о безопасном представлении free-text команд в
  manual handoff MVP. Exact canonical command остаётся только для CTS
  `input=none` и optional без текста; required и фактически переданный optional
  text используют локализованный неисполняемый descriptor. Independent review
  — PASS (`planning/reviews/STEP-020/REVIEW-2026-09-19T1915Z.md`), повторный
  security review — PASS; implementation подтверждена в завершённом STEP-009.

- `STEP-019` — принят ADR-010 и REQ-005 сужен до manual handoff. Capability
  matrix разделяет vendor claims и product proof; current Codex/Claude не
  допускаются для automatic lifecycle. После двух FIX-проходов третий свежий
  architecture/security review — PASS
  (`planning/reviews/STEP-019/REVIEW-2026-09-19T1815Z.md`); runtime remediation
  подтверждена в завершённом STEP-009.

- `STEP-018` — принят ADR-009: авторизация Codex/Claude CLI остаётся
  ответственностью пользователя, а extension не передаёт
  credential/provider/proxy/certificate environment variables. После FIX
  traceability/projections независимый review — PASS
  (`planning/reviews/STEP-018/REVIEW-2026-09-19T1729Z.md`); runtime drift
  подтверждён в завершённом STEP-009.

- `STEP-017` — принят ADR-008: current Codex/Claude write-mode на POSIX и
  native Windows fail-closed переводится в manual fallback. Automatic write
  допустим только после отдельного ADR и evidence scoped read/process-tree
  containment. После двух document-only FIX-проходов независимый review — PASS
  (`planning/reviews/STEP-017/REVIEW-2026-09-19T1641Z.md`); реализация manual
  handoff подтверждена в завершённом STEP-009.

- `STEP-015` — lifecycle-статус удалён из всех REQ секций `docs/requirements/SPEC.md`; Explorer читает его из нового parser `docs/requirements/STATUS.md`. ADR-005 централизует allowlisted путь `requirementsStatus`; watcher обновляет группу Requirements. Последний независимый review — `PASS` (`planning/reviews/STEP-015/REVIEW-2026-09-19T1135Z.md`) после FIX F-001..F-011, включая fail-closed delete guard для повреждённых/duplicate reference-полей. Проверки: compile, lint, build, 207 unit tests, 15 integration tests и fixture sync.
- `STEP-016` — принят ADR-005 о manifest-first резолюции путей с allowlisted derivations `adrDirectory` и `requirementsStatus`; ADR-001 помечен `Superseded`, OQ-004 закрыт. Первый review выявил F-001 (отсутствовала STEP-007 → ADR-005 traceability), FIX синхронизировал task contract; повторный независимый review — `PASS` (`planning/reviews/STEP-016/REVIEW-2026-09-19T0951Z.md`). Production code и `.project/manifest.yaml` не менялись; runtime handoff — `FIX STEP-015`.
- `STEP-014` — Закрыть TOCTOU-окно между guard'ом `canMarkDone` и записью в Explorer (corrective, F-018 из `REVIEW STEP-006`). `PASS` (`planning/reviews/STEP-014/REVIEW-2026-09-18T1157.md`, первый review-цикл) + `FIX STEP-014` по пяти non-blocking findings (F-001, F-002, F-005, F-006, F-007 — все Low). Guard (`canMarkDone`/`canFlagBlocker`/`canDelete`) теперь вычисляется на том же чтении STEP-файла, из которого строится записываемый контент, — перенесён внутрь общего guarded-write `writeStepFile`/`evaluateDeleteGuard` в `src/explorer/actions.ts`, вместо чтения до неограниченного по времени модального подтверждения. `deleteArtifact` получил повторную проверку входящих ссылок сразу после подтверждения и непосредственно перед `fs.delete`. Deliverables: `src/explorer/actions.ts`, `tests/mocks/vscode.ts` (класс-стаб `RelativePattern`), 10 новых unit-тестов в `tests/unit/explorer/actions.test.ts` (150/150 всего). Product code не менялся в FIX-проходе — только тестовое покрытие (F-002, F-005) и документация/traceability (F-001, F-006, F-007). Обоснованно отложенный technical debt: остаточное микроскопическое окно last-writer-wins между чтением №2 и `writeFile`/`fs.delete` (требует file lock/CAS — отдельное устойчивое решение); F-003/F-004 (Low, асимметрии `deleteArtifact`) — кандидаты в тот же будущий corrective STEP, что STEP-006 F-019..F-022.
- `STEP-006` — Sidebar Explorer. `PASS` (`planning/reviews/STEP-006/REVIEW-2026-09-18T1108.md`, третий review-цикл) после двух FIX-циклов. Review #1 (`REVIEW-2026-09-18T0900.md`): FAIL — F-001 (точечная инвалидация дерева не доходила до UI, `ExtHostTreeView` идентифицирует element по ссылке), F-002 (mutating-действия обходили `checkInitGuard`), F-003 (`canMarkDone` проверялся по устаревшим данным узла вместо файла) — все три blocking, все закрыты по корню в FIX-проходе №1 и подтверждены независимо в `REVIEW-2026-09-18T1500.md` (PASS по диффу, но закрытие запрещено: неснятый пункт 6 Verification sequence — ручная проверка в EDH — и новый F-013 Medium про непересчитываемые при смене манифеста пути провайдера). FIX-проход №2 закрыл F-013..F-017 и заменил ручную EDH-проверку содержательным расширением `tests/integration/explorer.test.js` (реальный headless Extension Host: структура дерева, иконки, `contextValue`, меню, реакция на внешнюю правку файла через настоящий `FileSystemWatcher`) — альтернатива, явно разрешённая review. Deliverables: `src/explorer/**` (12 модулей), 140 unit- + 15 integration-тестов, fixture-проект на 50 STEP для перф-теста (14.2мс при пороге 500мс). Обоснованно отложенный technical debt: F-018 (Medium) — остаточное TOCTOU-окно между guard'ом `canMarkDone` и записью через модальное подтверждение без ограничения по времени (тот же класс, что закрытый F-003) — **закрыто `STEP-014`**; F-019..F-022 (Low, hardening-кандидаты, остаются открытыми); F-010/`OQ-005` — `Mark as done` из UI не синхронизирует projection-файлы (сознательно, продуктовое решение вне STEP-006).
- `STEP-005` — Command Palette: 11 MVP-команд + pre-dispatch валидация. `PASS` (`planning/reviews/STEP-005/REVIEW-2026-09-17T2350.md`, второй review-цикл) после одного FIX-цикла (F-001 blocking: недостижимая/dangling hard dependency — STEP, чей `Depends on` ссылается на несуществующий STEP-файл, молча трактовался как не имеющий блокера; F-002 non-blocking: Windows-небезопасный `path.join` в glob-паттерне `stepPicker.ts` — оба закрыты, F-001 подтверждён эмпирическим воспроизведением дефекта до/после фикса). Deliverables: `src/commands/**` (18 файлов — pre-dispatch validation, 11 команд под `harness.*`, `STATUS PROJECT`/`NEXT STEP` без агента, временная `NotImplementedAgentDispatcher` как единственная точка интеграции для STEP-009), 36 unit- + 2 integration-теста. REQ-001 → `Частично` (полное закрытие требует реального agent invocation из STEP-009, явно вне scope этого STEP).
- `STEP-004` — i18n service (RU default + EN). `PASS` (`planning/reviews/STEP-004/REVIEW-2026-09-17T2300.md`, второй review-цикл, два независимых ревьюера) после одного FIX-цикла (F-001 Reviewer 1: сообщения об ошибке в `activation.ts` были захардкожены на русском в обход только что введённого i18n-сервиса; F-001 Reviewer 2/F-002 Reviewer 1: `readHarnessConfig` отбрасывал неизвестные поля `.project/harness-config.json` при чтении — оба закрыты, подтверждено построчной проверкой и независимыми эмпирическими тестами обоих ревьюеров). Deliverables: `src/locales/{ru.json,en.json,i18n.ts,activation.ts}`, команда `harness.changeLanguage` (первая запись в `contributes.commands`, локализована через нативный `package.nls.json`/`package.nls.en.json` — конвенция для STEP-005), 50 unit-тестов + 4 integration-теста. Обоснованно отложенный technical debt: произвольные fs-ошибки чтения конфига (не только «файл отсутствует») маскируются без warning — не обещано Acceptance criteria, предмет отдельного ADD STEP при реальной потребности.
- `STEP-003` — Parser layer (manifest, STEP/REQ/ADR, EXECUTION_PROTOCOL). `PASS` (`planning/reviews/STEP-003/REVIEW-2026-09-17T2320.md`, второй review-цикл) после одного FIX-цикла (F-001: деградация `parseAdrFile` не была покрыта тестами; F-002: деградация внутри REQ-блока не была покрыта — оба закрыты новыми тестами на fixtures, production-код парсера не менялся). Deliverables: `src/parser/{types,yamlParser,markdownParser,executionProtocol}.ts`, 26 unit-тестов на реальных fixtures репозитория и `ai-development-harness-template`. Известный, явно раскрытый и сознательно отложенный technical debt: `splitSections` не учитывает fenced code blocks (не проявляется ни на одном текущем файле репозитория); `ExecutionProtocolCommand.name` не нормализован для многословных заголовков команд — нормализация потребуется в `STEP-005`.
- `STEP-002` — Project scaffolding и инструментарий. `PASS` (`planning/reviews/STEP-002/REVIEW-2026-09-17T1752.md`, второй review-цикл) после одного FIX-цикла (F-001: устаревшее утверждение в `docs/development.md` про `.vscode/launch.json`, закрыто и подтверждено). Toolchain: TypeScript strict, ESLint 10 flat config, esbuild bundling, Jest (unit), `@vscode/test-cli`+Mocha (integration), project-specific CI (`ci.yml`, отдельно от `harness-integrity.yml`). Остаточная явно раскрытая оговорка: буквальный интерактивный F5-прогон через VSCode UI агентом не выполнялся (нет доступа к UI) — покрыт эквивалентной автоматической проверкой (`npm run test:integration`, реальный headless Extension Host).
- `STEP-001` — Research: механизм вызова агента для command dispatch. `PASS` (`planning/reviews/STEP-001/REVIEW-2026-09-17T1900.md`, третий review-цикл) после двух FIX-циклов (F-001..F-004, все закрыты живыми, проверяемыми данными). Решение — `ADR-004`. Остаточные явно раскрытые ограничения: Codex happy-path/cancel не подтверждены эмпирически из-за квоты аккаунта — переподтвердить перед/во время `STEP-009`.

## Known drift / risks

- STEP-004 зафиксировала платформенное ограничение для будущего `PLAN STEP-010`: VSCode резолвит `package.nls.*` (заголовки `contributes.commands` в Command Palette) один раз при загрузке по `vscode.env.language`, не по ручному переключению языка через `harness.changeLanguage` — обновление таких заголовков без перезапуска VSCode невозможно на уровне платформы. Не блокирует REQ-006 Acceptance для динамически строящегося UI (status bar, hover, сообщения), но ограничивает то, что STEP-010 сможет сделать «без перезапуска» именно для `contributes.*`-заголовков.
- OQ-001 (механизм вызова агента) — `RESOLVED` (`ADR-004`). Historical
  read-only smoke-тесты STEP-009 подтвердили primary Codex JSONL happy-path и
  отмену по SIGTERM; текущий MVP contract не запускает CLI, а его реализация
  подтверждена PASS `REVIEW-2026-09-19T2038Z.md`.
- OQ-002 (включать ли GIT CHECK/COMMIT в MVP) намеренно отложен решением ADR-003.
- OQ-003 (семантика soft/hard dependency edges) не решена — блокирует будущую реализацию REQ-007, вне текущего MVP roadmap.
- Исходная 9-недельная оценка срока из артефакта-ТЗ (`TZ_REVIEW_AND_PLAN.md`) не переносится в этот roadmap как обязательство.
- `RECONCILE PROJECT` (2026-09-18, `planning/audits/RECONCILE-2026-09-18.md`) нашёл, что `docs/requirements/SPEC.md` вопреки `AGENTS.md` §10 хранил собственное поле `Статус` для всех 10 REQ, и его значения разошлись с `docs/requirements/STATUS.md` (например, REQ-001 и REQ-006). Corrective `STEP-015` завершён: поле `Статус` удалено из всех 10 секций `SPEC.md`, Explorer переключён на новый парсер `docs/requirements/STATUS.md`; REQ-006 синхронизирован (`В работе` → `Частично`). PASS `planning/reviews/STEP-015/REVIEW-2026-09-19T1135Z.md` подтвердил remediation.
- `OQ-004` разрешён ADR-005: manifest-first resolver допускает только два зарегистрированных schema-gap правила (`requirementsStatus`, `adrDirectory`) и запрещает consumer-level path guessing. Правила реализованы в neutral Parser/path-resolution resolver; соответствие подтверждено PASS `planning/reviews/STEP-015/REVIEW-2026-09-19T1135Z.md`.
