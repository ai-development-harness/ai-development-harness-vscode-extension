# RECONCILE PROJECT — 2026-09-18

> Audit report. Production code не менялся. Затронуты только projection/canonical documentation файлы, перечисленные ниже.

## Precondition

`.project/manifest.yaml → project.initialized: true` — RECONCILE применим.

## Область сверки

- `docs/requirements/SPEC.md` + `docs/requirements/STATUS.md` (REQ)
- `docs/adr/ADR-001..ADR-004` (Accepted ADR)
- `docs/architecture.md`
- `planning/tasks/STEP-001..STEP-014.md` (canonical STEP)
- `planning/PLAN.md`, `planning/STATUS.md` (projections)
- `docs/OPEN_QUESTIONS.md`
- фактический код/тесты (`src/**`, `tests/**`) — выборочно, там, где STATUS.md/PLAN.md делают проверяемые утверждения о нём.

## Находки

### F-1 (Substantive, structural) — `SPEC.md` хранит lifecycle-статус REQ вопреки `AGENTS.md` §10

`docs/requirements/SPEC.md` содержит поле `**Статус:**` в каждой из 10 секций REQ (REQ-001..REQ-010), хотя `AGENTS.md` §10 однозначно требует: «`docs/requirements/SPEC.md` хранит definition/rationale/acceptance/traceability REQ без lifecycle-статуса; текущее состояние REQ фиксируется только в `docs/requirements/STATUS.md`».

Наличие двух источников статуса уже привело к реальному расхождению:

- **REQ-001**: `SPEC.md` = «Частично»; `STATUS.md` (до этого reconcile) = «Запланировано» и `Evidence: —`, хотя единственный реализующий STEP (`STEP-005`) канонически `Выполнено` с PASS review (`planning/reviews/STEP-005/REVIEW-2026-09-17T2350.md`).
- **REQ-006**: `SPEC.md` = «Запланировано»; `STATUS.md` = «В работе», хотя `STEP-004` канонически `Выполнено` с PASS review.

Остальные 8 REQ на момент аудита совпадают между `SPEC.md` и `STATUS.md` (REQ-002 Выполнено/Выполнено, REQ-003/004 Запланировано/Запланировано, REQ-005 Запланировано/Запланировано — соответствует STEP-001 Выполнено (research only) + STEP-009 не начат, REQ-007..010 Отложено/Отложено).

**Действие:** не исправлено production code, не переписан SPEC.md как «мелкая правка» (structural, затрагивает все 10 REQ разом). Создан corrective STEP: `planning/tasks/STEP-015.md` (`DOCUMENTATION`, без REQ/ADR — enforcement уже принятого правила, не новая архитектура). PLAN/STATUS обновлены.

**Синхронизирован только однозначный projection drift**: `docs/requirements/STATUS.md` REQ-001 → `Частично` с evidence на `STEP-005`+review (см. изменённый файл ниже). REQ-006 в `STATUS.md` уже был корректен («В работе») — не трогался. Само поле `Статус` в `SPEC.md` не удалялось — это scope `STEP-015`, не reconcile.

### F-2 (Non-substantive, projection sync) — `docs/requirements/STATUS.md` REQ-001 не отражал закрытый STEP-005

См. F-1: исправлено напрямую как однозначный projection drift (canonical evidence — `planning/tasks/STEP-005.md` Status: Выполнено + PASS review — не оставляет пространства для интерпретации).

### Проверено, drift не найден

- **STEP-014 → REQ-002 → evidence → review**: цепочка traceability целая. `planning/tasks/STEP-014.md` (Статус: Выполнено) → PASS `planning/reviews/STEP-014/REVIEW-2026-09-18T1157.md` (первый цикл) + FIX-проход по 5 non-blocking findings, отражённым в `planning/STATUS.md`. `docs/requirements/STATUS.md` REQ-002 = «Выполнено» с корректной evidence-ссылкой на STEP-006 (STEP-014 — corrective bugfix того же REQ, не отдельная запись в REQ STATUS — согласуется с тем, что REQ уже был Выполнено). Дублирования/потери traceability не найдено.
- **Accepted ADR vs код**: `ADR-001` (manifest-driven paths), `ADR-002` (labeled markdown, не YAML frontmatter), `ADR-003` (11 из 24 команд), `ADR-004` (headless CLI, stdin, Codex первично/Claude Code опционально) — все согласуются с `docs/architecture.md` и утверждениями в `planning/STATUS.md`/task-файлах STEP-001..STEP-006, STEP-014. Признаков молчаливого отступления кода от Accepted ADR не найдено. Ни один Accepted ADR не переписывался.
- **`docs/architecture.md`**: корректно отражает состояние после STEP-001/ADR-004 — фиксирует нереализованность `src/api/` (STEP-009) и неподтверждённый Codex happy-path; согласуется с `planning/STATUS.md` → `Known drift / risks`.
- **`docs/OPEN_QUESTIONS.md`**: OQ-001 корректно `RESOLVED` → `ADR-004`, с явно раскрытым остаточным пробелом (Codex happy-path), который также отражён в `planning/STATUS.md`. OQ-002/OQ-003 актуальны и не требуют действия сейчас (вне MVP roadmap / сознательно отложены). OQ-004 (ADR directory resolution) и OQ-005 (Mark as done projection sync) остаются `OPEN`/`DEFERRED` — не блокируют текущий unblocked work (`STEP-007`/`STEP-008`/`STEP-009`/`STEP-015`), корректно не потеряны.
- **PLAN.md / STATUS.md coverage**: все non-deferred REQ (REQ-001..REQ-006) имеют STEP coverage; Phase 2 REQ (REQ-007..REQ-010) корректно помечены `Отложено` без STEP, с обоснованием и ссылкой на OQ-003 для REQ-007.
- **Dependency graph**: нет циклов; `STEP-007/008/009/015` корректно показаны разблокированными в PLAN.md/STATUS.md после закрытия их единственных hard dependencies.
- Не проводился full re-run test suite (вне scope RECONCILE — deterministic gates проверяются STEP-specific `REVIEW`/`RELEASE CHECK`); утверждения STATUS.md о числе тестов сверены только на предмет внутренней согласованности повествования, не пересчитывались построчно.

## Изменённые файлы (только documentation/projection, production code не менялся)

- `planning/tasks/STEP-015.md` — **создан**: corrective STEP (DOCUMENTATION) на удаление lifecycle-статуса из `SPEC.md`.
- `planning/PLAN.md` — **изменён**: добавлена строка `STEP-015`, обновлён абзац «Незаблокированная работа прямо сейчас».
- `planning/STATUS.md` — **изменён**: добавлен `STEP-015` в «Next unblocked work», добавлен пункт в «Known drift / risks» с ссылкой на этот audit report.
- `docs/requirements/STATUS.md` — **изменён**: REQ-001 статус `Запланировано` → `Частично`, evidence заполнена ссылками на `STEP-005` + PASS review.

## Traceability после reconcile

```
REQ-001 → STEP-005 (Выполнено, PASS) [частично, ждёт STEP-009] → STATUS.md синхронизирован
REQ-002 → STEP-006 (Выполнено, PASS) + STEP-014 (corrective, Выполнено, PASS) → без изменений, drift не найден
STEP-015 → (без REQ, enforcement AGENTS.md §10) → PLAN.md/STATUS.md добавлены
```

## Blockers / Risks

- `SPEC.md` продолжает содержать некорректное поле `Статус` до выполнения `STEP-015` — риск повторного расхождения, если кто-то будет читать `SPEC.md` напрямую вместо `STATUS.md` (приоритет источников истины по `AGENTS.md` §2 это покрывает, но явный defect остаётся до FIX).
- Не блокирует `STEP-007`/`STEP-008`/`STEP-009` — независимый scope.

## Рекомендуемая следующая команда

`PLAN STEP-015` (низкий риск, независим от STEP-007/008/009 — можно вести параллельно), либо, если приоритетнее продуктовая функциональность — `PLAN STEP-007`/`PLAN STEP-008`/`PLAN STEP-009`.
