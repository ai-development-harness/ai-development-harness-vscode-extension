# Project Status

> Projection текущего execution state. Обновляется из canonical task/evidence и requirements.

## Summary

Проект инициализирован (`INIT PROJECT`, 2026-09-17). Product code ещё не создан — roadmap состоит из 13 STEP MVP (STEP-001..STEP-013), покрывающих REQ-001..REQ-006. Phase 2 REQ (REQ-007..REQ-010) зафиксированы как `Отложено` без STEP.

## In progress

- `STEP-001` — Research: механизм вызова агента. `FIX STEP-001` (2026-09-17) закрыл все 3 finding FAIL-review (`planning/reviews/STEP-001/REVIEW-2026-09-17T1800.md`) живыми stdin- и cancel-тестами на обоих CLI (см. Evidence п.5 в STEP-001). Ожидает повторный `REVIEW STEP-001`. Остаточные раскрытые ограничения: Codex happy-path и Codex cancel не подтверждены эмпирически из-за квоты аккаунта (доступна вновь 2026-09-20) — не blocker, зафиксировано в ADR-004.

## Blocked

—

## Next unblocked work

- Повторный `REVIEW STEP-001` — независимая проверка исправлений.
- `STEP-002` — Project scaffolding (зависимостей нет, доступен для `PLAN STEP-002` параллельно).
- После PASS: `STEP-005`/`STEP-009` разблокируются полностью.

## Recent completed

—

## Known drift / risks

- OQ-001 (механизм вызова агента) — `RESOLVED` (`ADR-004`), но с явно раскрытым пробелом: Codex CLI (первичный executor) подтверждён только по error-path, happy-path не проверен эмпирически (реальная квота аккаунта исчерпана во время STEP-001, доступна вновь после 2026-09-20). Переподтвердить перед/во время STEP-009.
- OQ-002 (включать ли GIT CHECK/COMMIT в MVP) намеренно отложен решением ADR-003.
- OQ-003 (семантика soft/hard dependency edges) не решена — блокирует будущую реализацию REQ-007, вне текущего MVP roadmap.
- Исходная 9-недельная оценка срока из артефакта-ТЗ (`TZ_REVIEW_AND_PLAN.md`) не переносится в этот roadmap как обязательство.
