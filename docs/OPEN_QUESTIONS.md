# Open Questions

Здесь находятся существенные вопросы, которые нельзя безопасно решить предположением.

Формат:

```text
OQ-001 — Краткий вопрос
Status: OPEN | RESOLVED | DEFERRED
Affects: REQ-..., STEP-..., ADR-...
Context: ...
Decision needed: ...
Resolution: ...
```

`INIT PROJECT` должен предпочесть OPEN_QUESTION выдуманному архитектурному решению. Когда вопрос решён, зафиксируй результат в соответствующем REQ/ADR/STEP и обнови статус здесь.

## Текущие вопросы

```text
OQ-001 — Каким механизмом плагин вызывает агента (Claude Code / Codex) для выполнения команды и получения structured-результата?
Status: RESOLVED
Affects: REQ-005, STEP-001, STEP-009
Context: Исходный ТЗ предполагал HTTP-подобный «Claude Code API» с JSON-контрактом HarnessCommand/HarnessResult, которого не существует в задокументированном виде. Реалистичные варианты: headless CLI (print/JSON output режим), открытый VSCode-терминал с автовставкой промпта, процесс через Agent SDK.
Decision needed: Выбрать механизм и подтвердить его spike'ом до начала STEP-009 (Terminal Integration).
Resolution: ADR-004. Headless CLI с JSON-выводом, подтверждено живыми вызовами обоих CLI (`spikes/agent-invocation/`): `codex exec --json` — первичный executor (happy-path не подтверждён эмпирически из-за квоты аккаунта, только error-path); `claude -p --output-format json` — вторичный, полностью подтверждён (успешный read-only вызов). Промпт передаётся через stdin (не argv) — снимает найденный вживую баг с variadic-флагами/argv injection.
```

```text
OQ-002 — Включать ли GIT CHECK / COMMIT в MVP command set?
Status: DEFERRED (см. ADR-003)
Affects: REQ-001, docs/PROJECT.md (Out of scope)
Context: Без этих команд заявка «полный цикл через UI» не покрывает завершение цикла (commit). ADR-003 сознательно оставляет вопрос открытым до опробования MVP пользователями, а не решает его сейчас.
Decision needed: Продуктовое решение после первого реального использования 11-командного MVP.
Resolution: —
```

```text
OQ-003 — Какова семантика «soft» dependency edges для будущего графа зависимостей (Phase 2, REQ-007)?
Status: OPEN
Affects: REQ-007
Context: planning/EXECUTION_PROTOCOL.md определяет только поле `Depends on` (hard dependency); различие soft/hard рёбер из исходного ТЗ не имеет опоры в протоколе.
Decision needed: Определить понятие до начала реализации графа зависимостей (вне MVP roadmap).
Resolution: —
```

```text
OQ-004 — Как плагин резолвит пути к артефактам, которые реально существуют в Harness-проекте, но НЕ объявлены в `.project/manifest.yaml` (в первую очередь каталог ADR `docs/adr/`)?
Status: RESOLVED
Affects: REQ-002, REQ-003, ADR-001, ADR-005, STEP-006, STEP-007, STEP-015, STEP-016
Context: Обнаружено при `PLAN STEP-006` (2026-09-18). ADR-001 требовал брать все пути из манифеста, и манифест объявляет `sources.{requirements,architecture,roadmap,status,projectOverview,localBrief}`, `protocol.{file,taskDirectory,reviewDirectory,auditDirectory,skillSearchDirectory,skillRegistry,harnessUpdateDirectory}` и `repository.*`. Каталога ADR среди них нет, хотя Parser layer (STEP-003) уже умеет разбирать ADR-файлы (`parseAdrFile`), REQ-002 требует группу `Architecture` в дереве, а REQ-003 — autocomplete по существующим `ADR-NNN`. Манифест фактически относится к `ownership.shared`, но его schema поставляется Harness: собственный неизвестный upstream ключ создал бы local schema fork и риск конфликтов при `UPDATE HARNESS`. Рассматривались derivation от manifest anchor, override в `.project/harness-config.json` и расширение upstream manifest.
`PLAN STEP-015` (2026-09-18) добавил второго зависимого: `docs/requirements/STATUS.md` тоже не объявлен в манифесте (тот же случай — canonical источник REQ-статуса, `AGENTS.md` §10), и `deriveReqStatusPath` (`src/explorer/paths.ts`) применяет тот же вариант (a), что и `deriveAdrDir`, деривацией от `dirname(sources.requirements)`. Изолированное решение STEP-006 стало фактическим повторяемым приёмом для второго независимого потребителя — ADR need усилился, но per `IMPLEMENT STEP-015` решение по-прежнему остаётся в одном модуле `src/explorer/paths.ts`.
Decision needed: Решено в ADR-005. После независимого PASS review STEP-016 требуется отдельный `FIX STEP-015`, который реализует neutral resolver и затем проходит новый review.
Resolution: ADR-005 supersede ADR-001 и принимает manifest-first resolver/registry с precedence: schema-known explicit field → allowlisted deterministic derivation для поддерживаемой manifest generation → artifact unavailable. Для `harness.version: "1"` зарегистрированы только `adrDirectory = dirname(sources.architecture)/adr` и `requirementsStatus = dirname(sources.requirements)/STATUS.md`. Explicit path не откатывается к derivation при ошибке; filesystem probing и topology override через `.project/harness-config.json` запрещены. Отсутствующий artifact деградирует локально без подмены источника данных. Единственный долговременный owner — Parser/path-resolution boundary; Explorer, watcher и будущий Editor используют его результат.
```

```text
OQ-005 — Должно ли действие «Mark as done» из Sidebar Explorer синхронизировать projection-файлы (`planning/PLAN.md`, `planning/STATUS.md`) и статус связанного REQ?
Status: DEFERRED
Affects: REQ-002, STEP-006
Context: Обнаружено при `REVIEW STEP-006` (`REVIEW-2026-09-18T0900.md`, F-010) и подтверждено незакрытым при повторном review (`REVIEW-2026-09-18T1500.md`, F-017). `src/explorer/actions.ts.markDone` пишет `**Статус:** Выполнено` только в canonical STEP-файл; `AGENTS.md` §10 и `EXECUTION_PROTOCOL.md` §25 требуют, чтобы projection-файлы не расходились с canonical, но синхронизация STEP↔PLAN/STATUS↔REQ — не одна механическая правка (нужно решить, что считать «синхронизацией»: строку в таблице PLAN, статус REQ, оба; и как это соотносится с тем, что projection-файлы и так предполагаются производными от canonical state — `RECONCILE PROJECT` уже умеет это сверять).
Decision needed: Продуктовое решение — либо явно предупреждать пользователя после «Mark as done» и рекомендовать `RECONCILE PROJECT`, либо вынести автоматическую синхронизацию отдельным STEP с собственным Implementation plan. До решения `Mark as done` из UI сознательно оставляет этот разрыв (задокументировано здесь, а не молча).
Resolution: —
```
