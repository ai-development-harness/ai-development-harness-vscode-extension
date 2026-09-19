# STEP-018 — Принять ADR об ответственности пользователя за авторизацию agent CLI

**Статус:** Выполнено
**Type:** ADR
**Приоритет:** Критический
**Фаза:** MVP — architecture reconciliation
**Depends on:** STEP-017

## Requirements

- REQ-005

## ADR

- Новый ADR superseding ADR-008 только в части environment contract.

## Risk flags

- security-sensitive
- architecture
- external-integration

## Goal

Зафиксировать, что пользователь заранее авторизует и проверяет выбранный agent CLI; extension не передаёт credential/provider environment variables.

## Scope

- Новый Accepted ADR с alternatives и явным supersession узкого environment contract ADR-008.
- Traceability REQ-005, STEP-009, architecture baseline, ADR index и projections.

## Mutation policy

### Allowed

- `docs/adr/**`, `docs/architecture.md`, `docs/requirements/**`, `planning/**` только для decision/traceability.

### Forbidden

- `src/**`, `tests/**`, dependencies, CLI settings и исправление STEP-009.

## Out of scope

- Автоматическая авторизация, хранение/чтение secret values или provider configuration.

## Acceptance criteria

- Новый ADR однозначно запрещает extension передавать credential/provider environment variables и описывает prerequisite пользователя.
- Historical ADR-008 не переписан; active contracts не противоречат друг другу.
- Документация содержит безопасную инструкцию без secret values.

## Verification

- `python3 tools/harness/validate.py --mode commit` — PASS.
- `git diff --check` — без ошибок.
- Ручная проверка traceability и отсутствия production changes.

## Deliverables

- Новый Accepted ADR и синхронизированные projections.

## Implementation plan

**Plan status:** Ready
**Plan revision:** 1
**Planned at:** 2026-09-19T17:20:20+00:00
**Plan basis:** sha256:6c3fd2554ae8a13c669eeede7274768e278609bd6ca4ab9ccf3455e368cbbd55

1. Создать ADR-009, который supersedes только пункт ADR-008 об environment:
   extension передаёт лишь platform-home и runtime variables без credential,
   provider, proxy или certificate values; пользователь до запуска проверяет
   авторизацию CLI в своем terminal.
2. Сравнить сохранение allowlist, полное наследование environment и выбранную
   user-managed authentication; зафиксировать fail-closed behavior и запрет
   читать/логировать secret values.
3. Синхронизировать ADR index, architecture, REQ-005 и planning projections;
   добавить безопасную prerequisite-инструкцию без примеров secret values.
4. Проверить отсутствие `src/**`/`tests/**`, historical ADR-008 и валидность
   всех REQ/ADR/STEP ссылок. Следующий `STEP FIX STEP-009` меняет production
   code только после принятия ADR-009.

## Evidence

- Создан ADR-009: user-managed authentication supersedes только environment
  contract ADR-008; production code не изменён.
- По FAIL review `planning/reviews/STEP-018/REVIEW-2026-09-19T1723Z.md`
  синхронизированы metadata ADR-008, REQ-005, STEP-009, architecture debt и
  roadmap projections. Historical prose ADR-008 не менялся.

## Review status

**Latest verdict:** PASS
**Latest report:** `planning/reviews/STEP-018/REVIEW-2026-09-19T1729Z.md`
**Remediation:** F-001/F-002 закрыты и подтверждены независимым review.
