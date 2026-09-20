# ADR-012 — `requirementsStatus` резолвится от `sources.requirements` как от каталога

**Status:** Accepted
**Date:** 2026-09-20
**Deciders:** root-agent (IMPLEMENT STEP-025)
**Supersedes:** ADR-005
**Superseded by:** —

## Context

`ADR-005` зафиксировал два allowlisted compatibility rules для `harness.version: "1"`, применимых, пока upstream manifest schema не объявляет `adrDirectory`/`requirementsStatus` как explicit поля. Правило для `requirementsStatus` было написано для anchor-файла: `sources.requirements` в момент принятия `ADR-005` указывал на единственный файл `docs/requirements/SPEC.md`, поэтому derivation `join(dirname(sources.requirements), "STATUS.md")` была корректна.

Начиная со `STEP-024`, `docs/requirements/` перешёл на per-file layout (`REQ-NNN-*.md` + `SPEC.md` как чистый индекс), и `.harness/manifest.yaml` → `sources.requirements` теперь указывает на **каталог** `docs/requirements`, а не на файл. Формула `ADR-005` в этом случае вычисляет `dirname("docs/requirements")` = `docs`, то есть несуществующий `docs/STATUS.md`. `readReqStatuses` в `src/explorer/model.ts` ловит ошибку чтения и деградирует до пустой карты статусов; watcher (`src/explorer/refresh.ts`) следит за несуществующим путём. Итог: REQ-узлы Sidebar Explorer теряют lifecycle-статус из `docs/requirements/STATUS.md`, хотя сам файл существует и корректен.

Это архитектурный drift между текстом Accepted `ADR-005` и фактической upstream manifest schema, а не новая архитектурная проблема: двухуровневый precedence (explicit field → allowlisted derivation → unavailable), единый registry-boundary и запрет filesystem probing из `ADR-005` остаются в силе и этим решением не пересматриваются.

## Problem

`sources.requirements` в текущей manifest generation — directory-anchor, а не file-anchor. Правило `requirementsStatus` должно быть исправлено под эту форму anchor без:

- превращения derivation в dual-shape эвристику (`dirname` для файла vs `join` для каталога, определяемую угадыванием по расширению) — именно такой dual-layout fallback `STEP-024` устранил как принцип для `sources.requirements`;
- изменения `adrDirectory` (у него anchor остаётся file-anchor `sources.architecture`, и он не затронут этим drift);
- изменения решений `ADR-005`, которые drift не затрагивает (precedence, registry, запрет probing, fail-closed деградация).

## Decision

Для `harness.version: "1"` derivation `requirementsStatus` меняется с `join(dirname(sources.requirements), "STATUS.md")` на:

```
requirementsStatus = join(sources.requirements, "STATUS.md")
```

`sources.requirements` трактуется как каталог canonical product requirements и их projections — так его объявляет текущая manifest schema Harness 0.5.3 (`.harness/manifest.yaml` → `sources.requirements: docs/requirements`, комментарий «Каталог canonical product requirements и их projections»). Anchor не проверяется динамически (файл это или каталог): для `harness.version: "1"` он всегда каталог, и правило рассчитано ровно на эту форму.

`adrDirectory` не меняется: его anchor (`sources.architecture`) остаётся file-anchor, и derivation `join(dirname(sources.architecture), "adr")` продолжает применяться без изменений.

Остальные положения `ADR-005` (двухуровневый precedence, единый resolver/registry boundary, запрет distributed hardcode/probing/recursive search, fail-closed локальная деградация при недоступном derived artifact) переносятся без изменений и этим ADR не пересматриваются.

## Alternatives considered

### Вариант A — dual-shape эвристика по расширению пути

`if (sources.requirements` заканчивается на `.md`) dirname(...) else join(...)`. Поддерживал бы оба поколения anchor без явного versioning, но воспроизводит именно тот dual-layout fallback, который `STEP-024` устранил как принцип: два негласных layout-контракта в одном правиле, неявно завязанные на строковое совпадение расширения файла. Отклонён.

### Вариант B — отдельный corrective STEP вместо ADR в рамках STEP-025

Формально отделяет исправление derivation-формулы от текущего STEP. Но `STEP-025` уже не может выполнить свой acceptance criterion про `reqStatusMap` без этого исправления (bugfix авторизован в Scope/Mutation policy `STEP-025` в любом случае), а откладывание только самого ADR оставило бы код и текст Accepted `ADR-005` в противоречии до отдельного STEP — то есть drift без объявленной причины дольше, чем необходимо. Отклонён в пользу принятия `ADR-012` в рамках того же STEP, где обнаружен и исправлен drift.

### Вариант C — исправить формулировку `ADR-005` напрямую («задним числом»)

`AGENTS.md` §2 прямо запрещает переписывать Accepted ADR задним числом: устойчивое решение фиксируется новым ADR с `Supersedes`, а не редактированием принятого текста. Отклонён.

## Consequences

Положительные последствия:

- `resolveHarnessArtifactPath(manifest, 'requirementsStatus')` снова резолвится в существующий `docs/requirements/STATUS.md` для directory-anchor manifest, вместо несуществующего `docs/STATUS.md`;
- REQ-узлы Sidebar Explorer снова получают lifecycle-статус из canonical `STATUS.md`;
- `adrDirectory` и остальной registry `ADR-005` не затронуты;
- правило остаётся allowlisted и generation-scoped, без нового общего fallback-механизма.

Ограничения:

- derivation для `harness.version: "1"` больше не работает, если `sources.requirements` когда-либо снова станет file-anchor без явного нового ADR — намеренный trade-off, соответствующий фактической текущей upstream schema;
- как и в `ADR-005`, до появления schema-known explicit поля `requirementsStatus` compatibility rule остаётся суффиксным compatibility knowledge, а не decl derivation upstream manifest.

## Security implications

Не применимо: изменяется только формула соединения уже доверенных workspace-relative anchor-путей (`posix.join` вместо `posix.join(posix.dirname(...))`), без новых источников path input и без изменения workspace-containment гарантий `ADR-005`.

## Data / migration implications

Data migration отсутствует: `docs/requirements/STATUS.md` уже существует по целевому пути и не перемещается. Изменяется только производная formula в `src/parser/artifactPaths.ts`.

## Compatibility / operational implications

Затрагивает только derivation для `harness.version: "1"` с directory-anchor `sources.requirements`. Будущий explicit schema-known `requirementsStatus` (первый уровень precedence `ADR-005`) по-прежнему имеет приоритет над этим allowlisted rule и не требует его изменения.

## Traceability

- REQ: REQ-002
- STEP: STEP-025
