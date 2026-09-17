# Project Status

> Projection текущего execution state. Обновляется из canonical task/evidence и requirements.

## Summary

Проект инициализирован (`INIT PROJECT`, 2026-09-17). Roadmap состоит из 13 STEP MVP (STEP-001..STEP-013), покрывающих REQ-001..REQ-006. Phase 2 REQ (REQ-007..REQ-010) зафиксированы как `Отложено` без STEP. Project scaffolding/инструментарий (`STEP-002`) выполнен — есть рабочий toolchain (build/lint/test/CI) и no-op entry point расширения; никакой продуктовой функциональности (parser/commands/explorer/editor) ещё нет.

## In progress

—

## Blocked

—

## Next unblocked work

- `STEP-003` и `STEP-004` — зависели только от `STEP-002`, теперь разблокированы, доступны для `PLAN` (могут вестись параллельно). `STEP-005`/`STEP-009` по-прежнему не полностью unblocked — `STEP-005` ждёт `STEP-003`/`STEP-004`, `STEP-009` ждёт `STEP-005`.

## Recent completed

- `STEP-002` — Project scaffolding и инструментарий. `PASS` (`planning/reviews/STEP-002/REVIEW-2026-09-17T1752.md`, второй review-цикл) после одного FIX-цикла (F-001: устаревшее утверждение в `docs/development.md` про `.vscode/launch.json`, закрыто и подтверждено). Toolchain: TypeScript strict, ESLint 10 flat config, esbuild bundling, Jest (unit), `@vscode/test-cli`+Mocha (integration), project-specific CI (`ci.yml`, отдельно от `harness-integrity.yml`). Остаточная явно раскрытая оговорка: буквальный интерактивный F5-прогон через VSCode UI агентом не выполнялся (нет доступа к UI) — покрыт эквивалентной автоматической проверкой (`npm run test:integration`, реальный headless Extension Host).
- `STEP-001` — Research: механизм вызова агента для command dispatch. `PASS` (`planning/reviews/STEP-001/REVIEW-2026-09-17T1900.md`, третий review-цикл) после двух FIX-циклов (F-001..F-004, все закрыты живыми, проверяемыми данными). Решение — `ADR-004`. Остаточные явно раскрытые ограничения: Codex happy-path/cancel не подтверждены эмпирически из-за квоты аккаунта — переподтвердить перед/во время `STEP-009`.

## Known drift / risks

- OQ-001 (механизм вызова агента) — `RESOLVED` (`ADR-004`), но с явно раскрытым пробелом: Codex CLI (первичный executor) подтверждён только по error-path, happy-path не проверен эмпирически (реальная квота аккаунта исчерпана во время STEP-001, доступна вновь после 2026-09-20). Переподтвердить перед/во время STEP-009.
- OQ-002 (включать ли GIT CHECK/COMMIT в MVP) намеренно отложен решением ADR-003.
- OQ-003 (семантика soft/hard dependency edges) не решена — блокирует будущую реализацию REQ-007, вне текущего MVP roadmap.
- Исходная 9-недельная оценка срока из артефакта-ТЗ (`TZ_REVIEW_AND_PLAN.md`) не переносится в этот roadmap как обязательство.
