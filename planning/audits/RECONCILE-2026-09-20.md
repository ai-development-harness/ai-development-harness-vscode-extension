# PROJECT RECONCILE — 2026-09-20

**Scope:** project
**Mode:** RECONCILE

## Precondition

`.harness/manifest.yaml → project.initialized: true`; команда применима.

## Sources checked

- Actual control-plane после `HARNESS UPDATE APPLY`: `.harness/manifest.yaml`, `.harness/command-transitions.json`, `planning/harness-updates/UPDATE-2026-09-20T12-07-22Z.md`.
- Runtime consumers и tests: `src/api/commandPolicy.ts`, `src/commands/activation.ts`, `src/parser/**`, `src/explorer/**`, `src/editor/**`, `src/locales/**`, `tests/**`.
- Canonical requirements, ADR, STEP, projections и previous reconcile reports.

## Actual state

- Control-plane Harness успешно перенесён из `.project/**` в `.harness/**` с target `v0.5.3`.
- Extension остаётся привязанным к legacy layout: `src/api/commandPolicy.ts` импортирует удалённый `../../.project/command-transitions.json`, а command activation читает `.project/manifest.yaml`.
- Canonical requirements были монолитно размещены в `docs/requirements/SPEC.md`; проведена lossless migration в отдельные `REQ-NNN-*.md`. `SPEC.md` стал index projection, lifecycle сохранён только в `STATUS.md`.

## Drift / findings

1. **Blocking runtime drift.** После relocation compilation fails: `npm run compile` завершается `TS2307` для `../../.project/command-transitions.json`. Bootstrap всех зависящих возможностей не поддерживает current Harness project.
2. **Command-syntax drift.** `check-command-references.py` нашёл 192 legacy references в 23 live Markdown files. Исторические task/evidence не переписываются; current product docs и runtime command contract входят в corrective scope.
3. **Resolved document-model drift.** Monolithic requirements migrated to standalone canonical files. Validator confirms direct projection links and lifecycle separation.

## Evidence

| Проверка | Результат |
|---|---|
| `npm run compile` | FAIL: TS2307, удалённый `.project/command-transitions.json` |
| `python3 .harness/tools/check-command-references.py --json` | DRIFT: 192 findings в 23 live Markdown files |
| `python3 .harness/tools/validate.py --mode manual` | PASS: 393 tracked files checked |

## Corrective actions

- Создан `STEP-024` (BUGFIX, critical): адаптация extension и fixtures к `.harness/**`, current CTS и canonical command syntax.
- Production code не менялся.

## Recommended next command

`STEP PLAN STEP-024`
