# ADR-004 — Вызов агента через headless CLI (`codex exec --json` первично, `claude -p --output-format json` вторично) со stdin-передачей промпта

**Status:** Accepted
**Date:** 2026-09-17
**Deciders:** STEP-001 (research)
**Supersedes:** —
**Superseded by:** —

## Context

Исходный артефакт-ТЗ (раздел 4.1) предполагал вызов несуществующего «Claude Code API» с JSON-контрактом `HarnessCommand`/`HarnessResult`. `docs/OPEN_QUESTIONS.md` OQ-001 фиксировал эту неопределённость. Planning-анализ STEP-001 также выявил, что сам протокол-слой этого шаблона сконфигурирован под **Codex CLI** (`.codex/config.toml`, native subagents) — нигде в `AGENTS.md`/`docs/harness/**` не упоминается Claude Code; последний остаётся вторичным/опциональным executor.

## Problem

Нужен реальный, проверяемый механизм, которым плагин (а) передаёт контекст (EXECUTION_PROTOCOL.md, manifest, STEP/REQ/ADR, git status) агенту, (б) получает структурированный (не свободный текст) результат: успех/ошибка, финальное сообщение, затронутые файлы (когда применимо), (в) может корректно завершить долгое выполнение (cancel).

## Decision

1. **Механизм — headless CLI, non-interactive, JSON-вывод**, не HTTP API и не SDK-процесс (последний не существует в задокументированном виде ни для Codex, ни как обязательная зависимость для Claude Code в контексте этого расширения).
2. **Codex CLI — первичный executor** (`codex exec --json -s <sandbox> -C <workspace> --ephemeral [-o <file>] `): реально подтверждено (живой вызов, `evidence/codex-exec-stdout.jsonl`), что при ошибке возвращает чистый построчный JSON (`thread.started` → `turn.started` → `error`/`turn.failed`). Happy-path (`turn.completed`) не удалось эмпирически подтвердить в этом окружении из-за исчерпанной квоты аккаунта — переподтвердить перед/во время STEP-009.
3. **Claude Code — вторичный/опциональный executor** (`claude -p --output-format json --permission-mode <mode> --allowedTools <tools>`): полностью подтверждено живым вызовом (`evidence/claude-print-stdout.json`) — `is_error`, `subtype`, `result`, `session_id`, `permission_denials`, `total_cost_usd`, `duration_ms`, `num_turns`, `stop_reason` доступны как структурированные поля единого JSON-объекта на stdout.
4. **Agent integration layer (STEP-009) проектируется как тонкий адаптер** с одним интерфейсом (`invoke(context, options) → AgentInvocationResult`) и двумя реализациями (Codex/Claude), выбор executor — по наличию бинаря на PATH и/или явной настройке пользователя; отсутствие обоих — явный blocker с предложением manual-режима (REQ-005 tier 2).
5. **Промпт и весь собранный контекст передаются через stdin**, вызов — через `child_process.spawn` с argv-массивом, **не** через shell-строку. Причина — реально воспроизведённый баг: variadic-опция `claude --allowedTools <tools...>` при ином порядке аргументов «съедает» следующий позиционный prompt-аргумент; тот же класс проблем (quoting/escaping/argv-injection) в общем случае непредсказуем, когда контекст содержит текст из репозитория пользователя. Stdin-передача документированно поддержана обоими CLI и снимает проблему целиком.
6. **Cancel** — `child_process` kill (SIGINT/SIGTERM) выбранного процесса; для Codex дополнительно доступен `--ephemeral` (не оставляет session-файлы), для Claude — `session_id` из финального JSON можно использовать для `--resume` в будущем, но не обязателен для MVP cancel-семантики.
7. **Sandbox/permission по умолчанию — максимально ограничивающий для читающих команд** (`codex exec -s read-only`, `claude --permission-mode plan --allowedTools Read`) и явно расширяется только для команд, которым по контракту разрешена mutation (`IMPLEMENT`, `FIX`, `RECONCILE` и т.д., согласно STEP mutation policy) — плагин не должен запускать агента с `--dangerously-bypass-approvals-and-sandbox`/`--dangerously-skip-permissions` никогда.

`docs/OPEN_QUESTIONS.md` OQ-001 → `RESOLVED`, ссылка на это ADR.

## Alternatives considered

### Вариант A — HTTP-подобный «Claude Code API» (исходный ТЗ)

Не существует в задокументированном виде для целевой аудитории продукта; отклонено сразу, без spike.

### Вариант B — Claude Agent SDK / аналог для Codex как npm-зависимость в bundle расширения

Дал бы in-process структурированный event-stream без spawn процесса, но: (а) увеличивает вес bundle расширения, (б) для Codex CLI эквивалент SDK не был обнаружен/подтверждён за время STEP-001 (не хватило evidence, чтобы принять решение сейчас, а не выдумать его), (в) требует отдельного жизненного цикла аутентификации внутри расширения вместо переиспользования уже настроенного CLI пользователя. Не отклонён окончательно — может быть пересмотрено отдельным ADR (Supersedes), если headless CLI-подход упрётся в реальные ограничения при STEP-009.

### Вариант C — Открытый VSCode-терминал + автоподстановка промпта

Не даёт надёжного структурированного результата без VSCode Shell Integration API; сохраняется как fallback-режим для случая, когда ни `codex`, ни `claude` не найдены на PATH (REQ-005 tier 2 «offline/manual mode»), но не как основной механизм.

### Вариант D — headless CLI, JSON-вывод (выбрано)

Подтверждено реальными вызовами на обоих CLI прямо в этом окружении (см. `spikes/agent-invocation/`). Из отклонённых minus'ов: зависимость от версии CLI и её флагов (не заморожен формальный контракт со стороны Anthropic/OpenAI) — компенсируется тем, что оба вывода уже сейчас достаточно стабильно структурированы (именованные JSON-поля, не regex по human-readable тексту), и integration-тесты STEP-011 должны включать проверку именно этой структуры как contract test.

## Consequences

Плюсы: реально подтверждённый, а не гипотетический механизм; переиспользует существующую аутентификацию пользователя; не увеличивает вес bundle расширения (Вариант D vs B); безопасен по умолчанию (read-only/plan permission для non-mutating команд). Минусы: два разных CLI с разными флагами/форматом JSON — Agent integration layer обязан инкапсулировать это различие за общим интерфейсом (пункт 4 Decision), а не протекать наружу в командный слой (STEP-005); happy-path Codex не подтверждён эмпирически в рамках этого STEP — риск зафиксирован явно, не скрыт.

## Security implications

Никогда не использовать `--dangerously-bypass-approvals-and-sandbox`/`--dangerously-skip-permissions`. Промпт/контекст — только через stdin (argv injection risk снят, см. Decision п.5). Sandbox/permission mode — минимально необходимый для типа команды (read-only для non-mutating, ограниченный write-scope для mutating, никогда unrestricted).

## Data / migration implications

Не применимо.

## Compatibility / operational implications

Плагин должен явно проверять наличие `codex`/`claude` на PATH при активации и понятно сообщать пользователю, если ни один не найден (REQ-005 tier 1/2). Обновления версий CLI могут менять формат JSON-вывода — contract-тесты STEP-011 обязаны ловить breaking changes, а не полагаться на ручную проверку постфактум.

## Traceability

- REQ: REQ-005
- STEP: STEP-001, STEP-009
