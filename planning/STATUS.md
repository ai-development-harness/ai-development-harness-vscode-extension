# Project Status

> Projection текущего execution state. Обновляется из canonical task/evidence и requirements.

## Summary

Проект инициализирован (`INIT PROJECT`, 2026-09-17). Product code ещё не создан — roadmap состоит из 13 STEP MVP (STEP-001..STEP-013), покрывающих REQ-001..REQ-006. Phase 2 REQ (REQ-007..REQ-010) зафиксированы как `Отложено` без STEP.

## In progress

—

## Blocked

—

## Next unblocked work

- `STEP-001` — Research: механизм вызова агента (зависимостей нет).
- `STEP-002` — Project scaffolding (зависимостей нет).

Оба доступны для `PLAN STEP-NNN` немедленно; рекомендуемая следующая команда — `PLAN STEP-001` (разблокирует STEP-005/STEP-009, самый долгий путь до MVP) или `PLAN STEP-002` параллельно.

## Recent completed

—

## Known drift / risks

- OQ-001 (механизм вызова агента) не решён — блокирует STEP-005/STEP-009 до закрытия STEP-001.
- OQ-002 (включать ли GIT CHECK/COMMIT в MVP) намеренно отложен решением ADR-003.
- OQ-003 (семантика soft/hard dependency edges) не решена — блокирует будущую реализацию REQ-007, вне текущего MVP roadmap.
- Исходная 9-недельная оценка срока из артефакта-ТЗ (`TZ_REVIEW_AND_PLAN.md`) не переносится в этот roadmap как обязательство — зависит от исхода STEP-001.
