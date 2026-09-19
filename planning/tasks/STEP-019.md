# STEP-019 — Выбрать безопасный automatic executor или пересмотреть scope REQ-005

**Статус:** Выполнено
**Type:** ADR
**Приоритет:** Критический
**Фаза:** MVP — architecture/product resolution
**Depends on:** STEP-017, STEP-018

## Requirements

- REQ-005

## ADR

- Новый ADR — итоговое решение о supported automatic executor либо о сужении product contract REQ-005.
- ADR-004
- ADR-007
- ADR-008
- ADR-009

## Risk flags

- security-sensitive
- architecture
- external-integration
- concurrency

## Goal

Принять доказуемое решение для blocker'а STEP-009: определить executor, который безопасно поддерживает automatic lifecycle REQ-005, либо честно сузить REQ-005 до реализуемого manual flow.

## Context

FAIL review STEP-009 (`planning/reviews/STEP-009/REVIEW-2026-09-19T1742Z.md`)
подтвердил, что current Codex/Claude fail-closed переходят в manual fallback.
ADR-007 и ADR-008 запрещают выдавать context bundle, `cwd`, consent или
process-group termination за доказанную isolation/containment boundary. До
отдельного решения REQ-005 и STEP-009 нельзя закрывать на основании mock или
manual-fallback evidence.

## Scope

- Сформировать проверяемую capability matrix для кандидатов automatic executor'а на каждой поддерживаемой платформе: scoped filesystem read, разрешённая write-boundary, containment всего process tree при отмене, minimal environment и наблюдаемый structured result.
- Проверить capability claims по первичной документации и воспроизводимым evidence; неподтверждённую платформу или capability считать unavailable.
- Принять новый ADR с одним из двух результатов: ограниченный supported automatic executor с fail-closed fallback либо пересмотренный product contract REQ-005, где manual handoff не выдаётся за automatic lifecycle.
- Синхронизировать только затронутые REQ-005, STEP-009, architecture baseline, ADR index и roadmap projections с принятым решением.
- Определить follow-up implementation и regression evidence, необходимые перед повторным `STEP FIX STEP-009` / `STEP REVIEW STEP-009`.

## Mutation policy

### Allowed

- `docs/adr/**`, `docs/architecture.md`, `docs/requirements/**`, `planning/**` для evidence-backed decision и traceability.

### Conditional

- Изменение REQ-005 допустимо только как явный выбранный результат после сравнения вариантов и без ложного заявления automatic execution.

### Forbidden

- `src/**`, `tests/**`, dependencies, конфигурация CLI или реализация supervisor/executor.
- Ослабление ADR-007/ADR-008 на основании consent, `cwd`, context bundle или непроверяемых claims.

## Out of scope

- Реализация нового executor, OS-level supervisor или platform-specific sandbox.
- Закрытие STEP-009, изменение его статуса или повторный review без отдельного `STEP FIX STEP-009`.
- Автоматизация login, доступ к credential values и передача secret environment variables.

## Acceptance criteria

- Для каждого рассмотренного executor/platform зафиксированы evidence и verdict по scoped read, write-boundary, process-tree cancellation, environment boundary и structured result.
- Новый ADR однозначно выбирает либо безопасный supported automatic flow с fail-closed boundary, либо согласованное с пользователем сужение REQ-005; historical ADR не переписываются.
- Если safe executor не доказан, REQ-005 и projections не обещают automatic lifecycle, а STEP-009 остаётся заблокированным либо получает traceable follow-up согласно принятому scope.
- Если safe executor доказан, follow-up контракт содержит точные supported platforms, failure behavior и обязательные Extension Host regression scenarios для F-001/F-002 review STEP-009.

## Verification

- Ручная проверка traceability: REQ-005 ↔ STEP-009/STEP-019 ↔ новый ADR и отсутствие противоречий с ADR-004/ADR-007/ADR-008/ADR-009.
- Проверка primary documentation и воспроизводимых capability evidence для каждого заявленного executor/platform; недоступный evidence фиксируется как blocker, а не заменяется предположением.
- `python3 tools/harness/validate.py --mode commit` — PASS.
- `git diff --check` — без ошибок.
- Подтвердить отсутствие изменений production code, tests, dependencies и secret values.

## Deliverables

- Новый Accepted ADR либо traceable requirement-scope decision с capability evidence.
- Синхронизированные REQ-005, STEP-009, architecture и roadmap projections.
- Явный handoff: `STEP FIX STEP-009` только при доказанном implementation path, иначе следующий planning action по пересмотренному scope.

## Implementation plan

**Plan status:** Ready
**Plan revision:** 2
**Planned at:** 2026-09-19T17:56:31+00:00
**Plan basis:** sha256:e5c32c399203e1c8f1ed34c8a4e449fdbe74df48ccefa5beff6e932ba1d5b723

1. Проверить primary documentation Codex и Claude Code, а также latest FAIL
   review STEP-009, против пяти capability criteria task: scoped read,
   write-boundary, tree cancellation, minimal environment и structured result.
   Не считать documented sandbox доказательством всех критериев, если он не
   фиксирует нужную границу или lifecycle.
2. Зафиксировать matrix: Codex документирует OS-level sandbox и structured
   non-interactive output, но не даёт evidence для требуемой path-scoped
   write/read boundary и containment detached descendants; Claude Code не
   поддерживает sandboxing на native Windows. Поэтому ни одна current
   combination не допускается для automatic lifecycle REQ-005.
3. Принять ADR-010: MVP extension не spawn'ит agent CLI автоматически,
   сохраняет безопасный manual handoff и не выдаёт его за automatic execution.
   ADR-010 supersedes только automatic-invocation expectation ADR-004; ADR-007,
   ADR-008 и ADR-009 сохраняют fail-closed security boundaries.
4. Пересмотреть REQ-005 до truthful manual-handoff contract, обновить ADR
   index, architecture, STEP-009 traceability и projections. Создать
   follow-up STEP для reconciliation устаревшего STEP-009 contract; не менять
   production code и не закрывать STEP-009 в этом проходе.
5. Проверить traceability, `git diff --check` и Harness validator. Перед
   закрытием STEP провести независимый architecture/security review документации.

## Evidence

- Проверены primary documentation Codex и Claude Code, а также FAIL review
  STEP-009. Current CLI не дают полного доказательства path-scoped automatic
  lifecycle и containment detached descendants; Claude Code на native Windows
  не поддерживает sandboxing.
- Принят ADR-010 и REQ-005 сужен до manual handoff. Production code, tests,
  dependencies и CLI configuration не менялись.
- Historical STEP-009 сохранён `Заблокировано`; его contract reconciliation
  передан в отдельный `STEP FIX STEP-009`.
- По FAIL review `REVIEW-2026-09-19T1801Z.md` добавлены capability matrix,
  рабочие primary links и единый current-state manual-only architecture
  baseline. F-003 передан в `STEP FIX STEP-009`, потому что `src/**` запрещён
  Mutation policy этого ADR-step.
- По FAIL review `REVIEW-2026-09-19T1810Z.md` supersession ADR-004 уточнён
  для всех его extension-owned automatic Decision 1–7, matrix отделяет vendor
  capabilities от product proof, а F-003 закреплён в canonical FIX handoff
  STEP-009.
- Третий свежий независимый architecture/security review — PASS:
  `planning/reviews/STEP-019/REVIEW-2026-09-19T1815Z.md`. F-001/F-002/F-003
  предыдущего review закрыты; runtime remediation остаётся в `STEP FIX
  STEP-009`.

## Review status

**Latest verdict:** PASS
**Latest report:** `planning/reviews/STEP-019/REVIEW-2026-09-19T1815Z.md`
**Remediation:** F-001/F-002/F-003 закрыты и подтверждены независимым review.
