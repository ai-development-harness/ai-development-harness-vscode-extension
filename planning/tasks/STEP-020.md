# STEP-020 — Принять ADR о безопасном представлении free-text команд в manual handoff MVP

**Статус:** Выполнено
**Type:** ADR
**Приоритет:** Критический
**Фаза:** MVP — architecture/product resolution
**Depends on:** STEP-019

## Requirements

- REQ-005
- REQ-006

## ADR

- Новый ADR — уточнение safe representation и user workflow для manual handoff.
- ADR-010

## Risk flags

- security-sensitive
- architecture
- external-integration

## Goal

Устранить конфликт между требованием показать canonical command и запретом
выводить user-controlled secret-shaped free text в manual handoff MVP.

## Context

`REVIEW STEP-009` от 2026-09-19 выявил, что `STEP ADD: <free text>` не может
одновременно быть показан как exact canonical command и не раскрывать secret
value. ADR-010 требует и canonical command, и безопасное объяснение, но не
определяет representation text-command и точный manual workflow пользователя.

## Scope

- Принять новый ADR, который supersedes ADR-010 Decision 2 только в части
  представления free-text команд и описывает user-controlled manual workflow.
- Выбрать и зафиксировать отдельные правила для command без free text и для
  command с free text: допустимое безопасное representation, локализация и
  поведение при недопустимом input.
- Синхронизировать REQ-005, при необходимости REQ-006, STEP-009, architecture
  baseline, ADR index и planning/requirements projections с принятым решением.
- Определить точные acceptance и Extension Host evidence для последующего
  `STEP FIX STEP-009`.

## Mutation policy

### Allowed

- `docs/adr/**`, `docs/architecture.md`, `docs/requirements/**`, `planning/**`
  для decision, traceability и projections.

### Conditional

- Изменение REQ-005/REQ-006 допустимо только как явное следствие нового ADR и
  без ослабления запрета на secret values в Output Channel/UI.

### Forbidden

- `src/**`, `tests/**`, dependencies и автоматический запуск agent CLI.
- Переписывание historical Accepted ADR вместо нового ADR с `Supersedes`.

## Out of scope

- Реализация локализации, Output Channel/UI или тестов STEP-009.
- Передача prompt/context bundle, clipboard/terminal automation или secret
  storage в Extension Host.
- Возврат automatic lifecycle либо изменение ADR-007/ADR-008 security boundary.

## Acceptance criteria

- Новый ADR однозначно определяет безопасное representation text-command и
  manual workflow, не требующий вывода raw free text.
- Для command с CTS input `none` и optional без переданного text сохранено
  отображение exact canonical command; для required/optional text-command
  явно описано неисполняемое representation и manual continuation.
- REQ-005, ADR-010 supersession, STEP-009 и projections не содержат
  противоречивых требований к canonical command, localization и secret safety.
- Handoff для STEP-009 содержит наблюдаемые RU/EN acceptance и E2E scenarios
  для Output Channel, notification, no-spawn и invalid input.

## Verification

- Ручная traceability-проверка: REQ-005/REQ-006 ↔ STEP-009/STEP-020 ↔ новый
  ADR; historical ADR-004 и ADR-010 не переписаны.
- Прочитать новый ADR против REQ-005, ADR-007/ADR-008/ADR-009/ADR-010 и
  `REVIEW-2026-09-19T1853Z.md`; зафиксировать отсутствие логического конфликта.
- `python3 tools/harness/validate.py --mode commit` — PASS.
- `git diff --check` — без ошибок.
- Подтвердить отсутствие production code, tests, dependencies и secret values.

## Deliverables

- Новый Accepted ADR с bounded supersession ADR-010.
- Синхронизированные REQ, STEP-009, architecture, ADR index и projections.
- Явный handoff `STEP FIX STEP-009` с согласованными acceptance criteria.

## Implementation plan

**Plan status:** Ready
**Plan revision:** 1
**Planned at:** 2026-09-19T19:06:51+00:00
**Plan basis:** sha256:270dc61c5f793dc236ca95d37a42c00e39586b1141ef3046dd782398a1f75b33

### Основание и границы

- REQ-005 и ADR-010 требуют manual handoff, но их literal требование canonical
  command конфликтует с запретом показывать secret value в free text. Это
  product/architecture contract, а не defect regex или localization catalog.
- Existing Accepted ADR не переписываются. Новый ADR должен supersede только
  ADR-010 Decision 2 в части visual representation text-command; запрет spawn,
  context bundle и automatic lifecycle остаётся без изменений.
- STEP не реализует UI. Его результат — один явный contract, по которому
  последующий FIX STEP-009 сможет локализовать Output/UI и написать E2E tests.

### Порядок

1. Сверить REQ-005/REQ-006, ADR-007..ADR-010 и review STEP-009; записать
   противоречие exact canonical free text ↔ no secret disclosure и отсутствие
   единого CLI invocation syntax для user-managed terminal.
2. Принять ADR-011 с разделением двух представлений по CTS input metadata, а
   не regex-списку command family: exact canonical command допускается только
   для input `none` или absent optional text; required/optional text-command
   отображается как локализованный safe descriptor, намеренно не исполнимый.
3. Зафиксировать manual workflow: extension не копирует, не передаёт и не
   выводит original text; пользователь в выбранном CLI/terminal самостоятельно
   повторно вводит исходное описание. ADR не навязывает syntax конкретного CLI.
4. Синхронизировать REQ-005, REQ-006, architecture baseline, ADR index,
   STEP-009 current handoff и projections. Убрать stale утверждение REQ-001 о
   будущем automatic invocation, не меняя historical evidence.
5. Сформулировать для STEP-009 precise RU/EN acceptance: оба sink содержат
   одинаковый localized safe descriptor; не содержат raw text/control bytes;
   invalid input и incomplete policy дают localized action; agent CLI не spawn.
6. Выполнить traceability/diff/Harness checks и передать ADR на independent
   architecture/security review без product-code mutation.

### Затрагиваемые артефакты

- Новый `docs/adr/ADR-011-safe-free-text-manual-handoff.md`; metadata
  `ADR-010` и `docs/adr/README.md` без переписывания historical Decision.
- `docs/requirements/SPEC.md`, `docs/requirements/STATUS.md`,
  `docs/architecture.md`, `planning/tasks/STEP-009.md`, `planning/PLAN.md` и
  `planning/STATUS.md`.
- `src/**` и `tests/**` остаются только future handoff STEP-009.

### Совместимость, риски и rollback

- Изменяется user-facing contract, но не CTS grammar: original command остаётся
  canonical только внутри dispatch, а descriptor не выдаётся за command для
  повторного запуска через Command Palette.
- Цена security boundary — пользователь вручную повторно вводит free text в
  terminal. Это честнее, чем копировать secret в Output Channel, clipboard или
  external process.
- Rollback требует нового ADR; нельзя восстановить exact free-text output
  простой правкой локализации, так как это вернёт disclosure risk.

## Evidence

- Принят ADR-011 с bounded supersession ADR-010 Decision 2: exact canonical
  command остаётся только для no-input commands, а text-command использует
  localized non-executable safe descriptor и user re-entry workflow.
- Синхронизированы REQ-005/REQ-006, architecture baseline, ADR index,
  STEP-009 handoff и roadmap/requirements projections. Historical ADR Decision
  и evidence не переписывались.
- В scope STEP-020 не изменялись `src/**`, `tests/**`, dependencies и секреты.
- Independent review: PASS `planning/reviews/STEP-020/REVIEW-2026-09-19T1915Z.md`;
  повторный security review — PASS, findings отсутствуют.
- Проверки: `git diff --check` — 0; `python3 tools/harness/validate.py --mode
  commit` — 0 (`HARNESS VALIDATION: PASS`). Production test suite не
  запускался: documentation-only scope запрещает изменение `src/**`/`tests/**`.

## Review status

**Latest verdict:** PASS
**Latest report:** `planning/reviews/STEP-020/REVIEW-2026-09-19T1915Z.md`

## Blocker / Failure reason

—
