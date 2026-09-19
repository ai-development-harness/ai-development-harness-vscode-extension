# PROJECT RECONCILE — 2026-09-19

**Scope:** project
**Mode:** RECONCILE

## Precondition

`.project/manifest.yaml → project.initialized: true`; команда применима.

## Sources checked

- Фактическая реализация и тесты path-resolution: `src/parser/artifactPaths.ts`, потребители в `src/explorer/{paths,refresh,actions}.ts`, `tests/unit/parser/artifactPaths.test.ts`.
- Канонические REQ и их lifecycle projection: `docs/requirements/SPEC.md`, `docs/requirements/STATUS.md`.
- Архитектурные решения и их проекция: ADR-001, ADR-005, `docs/adr/README.md`, `docs/architecture.md`, `docs/OPEN_QUESTIONS.md`.
- Canonical STEP-001..STEP-016, последние независимые review STEP-015/STEP-016 и projections `planning/PLAN.md`, `planning/STATUS.md`.
- Предыдущий reconcile report `planning/audits/RECONCILE-2026-09-18.md`.

## Actual state

- Предыдущая структурная находка устранена: `SPEC.md` не хранит lifecycle-статус REQ, а единственным источником остаётся `docs/requirements/STATUS.md`. `STEP-015` имеет статус `Выполнено` и PASS independent review.
- ADR-005 принят, корректно supersede ADR-001 и централизует два allowlisted правила для `harness.version: "1"`: `adrDirectory` и `requirementsStatus`. Реализация `resolveHarnessArtifactPath` является единственным владельцем этих derivation; Explorer, watcher и delete guard используют её, а не локальные вычисления путей.
- Канонические статусы STEP-001..STEP-006 и STEP-014..STEP-016 совпадают с `PLAN.md`/`STATUS.md`; для оставшихся STEP-007..STEP-013 зависимости и состояние планирования согласованы. `STEP-007`, `STEP-008` и `STEP-009` действительно разблокированы для `PLAN`.
- REQ status projection согласована с реализующими STEP и evidence: REQ-001 и REQ-006 остаются `Частично`, REQ-002 — `Выполнено`; REQ-003..REQ-005 запланированы, REQ-007..REQ-010 отложены.

## Drift / findings

Новых substantive, architectural или projection drift не обнаружено.

Известные ограничения остаются явно раскрытыми и не являются новыми находками reconcile:

- Codex CLI happy-path требуется подтвердить перед или во время STEP-009.
- OQ-003 и OQ-005 остаются открытыми/отложенными продуктово-архитектурными решениями.
- Технические долги Explorer, отмеченные в review STEP-006/STEP-014, не входят в scope этой сверки.

## Evidence

| Проверка | Результат |
|---|---|
| `python3 tools/harness/validate.py --mode commit` | PASS: 308 tracked files checked; только ожидаемое предупреждение об отсутствии staged files |
| Рабочее дерево перед созданием отчёта | чистое |
| Сверка metadata STEP/ADR, REQ projection и ссылок на evidence | расхождений не найдено |
| Сверка фактических consumers ADR-005 resolver | все текущие consumers используют `resolveHarnessArtifactPath`; локальных `derive*`-реализаций нет |

Полный test suite не перезапускался: это не замена STEP-specific verification и не требуется для проверки документального/projection drift в данном reconcile.

## Corrective actions

- Не требуются. Production code, REQ, ADR, STEP и существующие projections не изменялись.
- Создан только этот immutable audit report.

## Recommended next command

`STEP PLAN STEP-009` — критический разблокированный MVP scope; перед реализацией переподтвердить Codex CLI happy-path по ADR-004 и `docs/OPEN_QUESTIONS.md`.
