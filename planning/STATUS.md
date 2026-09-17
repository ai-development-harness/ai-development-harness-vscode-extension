# Project Status

> Projection текущего execution state. Обновляется из canonical task/evidence и requirements.

## Summary

Проект инициализирован (`INIT PROJECT`, 2026-09-17). Product code ещё не создан — roadmap состоит из 13 STEP MVP (STEP-001..STEP-013), покрывающих REQ-001..REQ-006. Phase 2 REQ (REQ-007..REQ-010) зафиксированы как `Отложено` без STEP.

## In progress

—

## Blocked

—

## Next unblocked work

- `STEP-002` — Project scaffolding (зависимостей нет). `STEP-005`/`STEP-009` частично разблокированы (их зависимость на `STEP-001` закрыта), но полностью не unblocked — `STEP-005` всё ещё ждёт `STEP-003`/`STEP-004`, `STEP-009` ждёт `STEP-005`.

## Recent completed

- `STEP-001` — Research: механизм вызова агента для command dispatch. `PASS` (`planning/reviews/STEP-001/REVIEW-2026-09-17T1900.md`, третий review-цикл) после двух FIX-циклов (F-001..F-004, все закрыты живыми, проверяемыми данными). Решение — `ADR-004`. Остаточные явно раскрытые ограничения: Codex happy-path/cancel не подтверждены эмпирически из-за квоты аккаунта — переподтвердить перед/во время `STEP-009`.

## Known drift / risks

- OQ-001 (механизм вызова агента) — `RESOLVED` (`ADR-004`), но с явно раскрытым пробелом: Codex CLI (первичный executor) подтверждён только по error-path, happy-path не проверен эмпирически (реальная квота аккаунта исчерпана во время STEP-001, доступна вновь после 2026-09-20). Переподтвердить перед/во время STEP-009.
- OQ-002 (включать ли GIT CHECK/COMMIT в MVP) намеренно отложен решением ADR-003.
- OQ-003 (семантика soft/hard dependency edges) не решена — блокирует будущую реализацию REQ-007, вне текущего MVP roadmap.
- Исходная 9-недельная оценка срока из артефакта-ТЗ (`TZ_REVIEW_AND_PLAN.md`) не переносится в этот roadmap как обязательство.
