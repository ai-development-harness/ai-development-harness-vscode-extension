# Spike: механизм вызова агента (STEP-001)

Вне production-кода расширения (см. Mutation policy STEP-001) — не входит в bundle плагина.

## Что проверялось

Реальный, живой (не гипотетический) вызов обоих CLI-агентов, доступных в этом окружении, в headless/non-interactive режиме, с read-only промптом над этим репозиторием: «прочитай `planning/tasks/STEP-002.md`, выведи одним предложением содержимое секции `## Goal`, ничего не редактируй».

## Codex CLI (`codex exec`)

```bash
codex exec \
  -s read-only \
  -C "$(pwd)" \
  --ephemeral \
  --json \
  -o /tmp/codex-spike-last-message.txt \
  "<prompt>"
```

Результат: `exit code 1` — реальный `usage limit` аккаунта («try again at Sep 20th, 2026»), не сбой механизма. Вывод — чистый JSONL на stdout (см. `evidence/codex-exec-stdout.jsonl`, stderr — `evidence/codex-exec-stderr.txt`): `thread.started` (с `thread_id`) → `turn.started` → `error` (структурированное `message`) → `turn.failed` (то же `error` в объекте). Файл `-o` (`--output-last-message`) не создаётся при неуспехе — это наблюдаемое, не документированное явно поведение, которое Agent integration layer обязан учитывать (не полагаться только на наличие файла как индикатор успеха, дублировать проверку по JSONL-событию `turn.failed`/`turn.completed`).

**Не удалось эмпирически подтвердить** happy-path (`turn.completed` с реальным финальным сообщением) из-за исчерпанной квоты аккаунта в этом окружении — переподтвердить при первой реальной реализации STEP-009 или на другом аккаунте. Структура `error`/`turn.failed` событий подтверждена реально, что уже достаточно для проектирования error-handling (REQ-005, tier 2).

## Claude Code (`claude -p`)

```bash
claude \
  --output-format json \
  --permission-mode plan \
  --permission-prompts none \
  --allowedTools Read \
  -p "<prompt>"
```

Результат: `exit code 0`, полный happy path. Единый JSON-объект на stdout (см. `evidence/claude-print-stdout.json`): `is_error: false`, `subtype: "success"`, `result` — корректный текстовый ответ (реально прочитал файл и верно процитировал его Goal), `session_id`, `permission_denials: []` (подтверждает, что `--permission-mode plan --allowedTools Read` действительно ограничил агента read-only и он не пытался ничего писать), `total_cost_usd`, `duration_ms`, `num_turns`, `stop_reason: "end_turn"`.

## Найденная операционная/security-проблема (реальная, не гипотетическая)

Первая попытка вызова `claude` с порядком аргументов `--allowedTools "Read" "<prompt>"` провалилась с `Error: Input must be provided either through stdin or as a prompt argument` — variadic-опция `--allowedTools <tools...>` (Commander-style) «съела» следующий позиционный аргумент (сам промпт) как ещё один элемент списка инструментов. Помогло только размещение `-p "<prompt>"` без последующих variadic-опций после него.

**Вывод для Agent integration layer (STEP-009):** промпт/контекст нельзя собирать как shell-интерполированную строку с непредсказуемым порядком флагов — это одновременно источник трудноуловимых багов (как выше) и потенциальной command/argument injection, если контекст (текст STEP-файла, имена файлов) содержит спецсимволы. Обязательное решение: вызывать оба CLI через `child_process.spawn` с argv-массивом (не через shell `exec`/`string`) **и передавать основной prompt/контекст через stdin**, а не как positional argv — оба CLI документированно поддерживают чтение промпта из stdin (`codex exec` — явно в `--help`; `claude -p` — подтверждено сообщением об ошибке «Input must be provided either through stdin or as a prompt argument»). Это снимает весь класс проблем с quoting/escaping/argv-ordering.

## Итог для ADR

См. `docs/adr/ADR-004-agent-invocation-mechanism.md`.
