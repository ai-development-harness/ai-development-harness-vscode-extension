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
