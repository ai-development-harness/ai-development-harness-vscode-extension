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

**Поправка (FIX STEP-001, F-001):** изначально здесь было заявлено «подтверждено `git status` после прогона» — на момент этого конкретного вызова изолированная проверка `git status` до/после фактически не выполнялась, только позже, уже после добавления новых файлов в рабочую директорию. Ретроспективно (чистый `git status` на момент коммита `77604ca`, без посторонних файлов) похоже, что вызов не оставил следов, но эта строка описывала непроведённую проверку как проведённую. Все последующие live-вызовы в этом spike (stdin-тесты, cancel-тест ниже) бракетированы `git status` до/после по факту, не только на словах.

## Найденная операционная/security-проблема (реальная, не гипотетическая)

Первая попытка вызова `claude` с порядком аргументов `--allowedTools "Read" "<prompt>"` провалилась с `Error: Input must be provided either through stdin or as a prompt argument` — variadic-опция `--allowedTools <tools...>` (Commander-style) «съела» следующий позиционный аргумент (сам промпт) как ещё один элемент списка инструментов. Помогло только размещение `-p "<prompt>"` без последующих variadic-опций после него.

Изначально (до `FIX STEP-001`) отсюда делался вывод, что решение — передавать prompt через stdin, но сам stdin-путь live не тестировался (только argv-путь, после исправления порядка флагов). Это было зафиксировано как finding `F-002` в `REVIEW-2026-09-17T1800.md`. Ниже — фактическая проверка.

## FIX STEP-001 — F-002: живой stdin-тест для обоих CLI

Тот же read-only промпт, что и выше, но без positional prompt-аргумента — только через stdin.

```bash
echo "<prompt>" | codex exec -s read-only -C "$(pwd)" --ephemeral --json
echo "<prompt>" | claude --output-format json --permission-mode plan --permission-prompts none --allowedTools Read -p
```

Оба прогона бракетированы `git status` до/после — идентичен, посторонних изменений нет.

- **Codex** (`evidence/codex-exec-stdin-stdout.jsonl`, stderr — `evidence/codex-exec-stdin-stderr.txt`): stderr явно печатает `Reading prompt from stdin...` (в отличие от `Reading additional input from stdin...`, который появлялся при *дополнительном* stdin с уже заданным positional-промптом в самом первом прогоне) — CLI однозначно распознал pure-stdin режим. Дошёл до того же `thread.started` → `turn.started` → `error`/`turn.failed` (тот же usage limit), т.е. stdin-контент реально дошёл до turn execution, а не был отброшен на этапе парсинга аргументов. Happy-path по-прежнему не подтверждён (квота), но сам факт корректного приёма stdin как единственного источника prompt — подтверждён.
- **Claude** (`evidence/claude-print-stdin-stdout.json`): exit 0, полный happy path через stdin. `is_error: false`, `subtype: "success"`, `result` — корректный (и даже более подробный, чем в argv-варианте) ответ, `permission_denials: []`, `total_cost_usd: 0.0925`, `num_turns: 2`, `stop_reason: "end_turn"`.

**Вывод (обновлено после живой проверки):** оба CLI реально принимают prompt/контекст через stdin, не только по документации/тексту ошибки. Промпт/контекст нельзя собирать как shell-интерполированную строку с непредсказуемым порядком флагов — источник и багов (variadic-flag swallowing выше), и potential injection. Решение: вызывать оба CLI через `child_process.spawn` с argv-массивом (не shell-строка) **и передавать prompt/контекст через stdin** — теперь подтверждено эмпирически для обоих, не только по документации.

## FIX STEP-001 — F-003: cancel-тест (`claude -p`)

Запущен `claude -p` в background (более длинный promt — перечислить и описать все STEP-файлы), через 3 секунды отправлен `SIGTERM` дочернему процессу. Полная расшифровка (команда, PID, `ps`/`pgrep`, exit status, размеры файлов) сохранена как durable-артефакт в `evidence/claude-cancel-test.txt` (добавлено вторым циклом `FIX STEP-001`, F-004 — изначально эти данные существовали только в тексте сессии).

Результат:
- Процесс (`PID`, прямой child, без вложенных subprocess — `pgrep -P` пуст) переставал отвечать на `kill -0` уже через 1 секунду после `SIGTERM` — быстрое чистое завершение, `SIGKILL` не потребовался.
- `wait $PID` → exit status `143` (= 128+15, стандартный код завершения по `SIGTERM`).
- `pgrep -af claude` после теста не показал orphan-процессов, связанных с этим вызовом (остальные найденные `claude`-процессы — не относящиеся к тесту: сама текущая VSCode-сессия и chrome native host).
- `stdout`/`stderr` файлы пусты (0 байт) — **важная деталь для дизайна**: при `--output-format json` отменённый вызов не оставляет НИКАКОГО частичного, пригодного к парсингу результата (в отличие от вероятного поведения `--output-format stream-json`, который стримит построчный JSON и мог бы дать частичный прогресс). Agent integration layer (STEP-009) должен трактовать cancel как «результата нет» безусловно при `--output-format json`, не пытаться восстановить частичный ответ.
- `git status` до/после идентичен — repository не осталось в неконсистентном состоянии.

Codex отдельно не тестировался на cancel (review допускал проверку «хотя бы для одного CLI», и Codex сейчас всё равно упирается в квоту за ~10с, что даёт мало окна для содержательного mid-flight cancel).

## Итог для ADR

См. `docs/adr/ADR-004-agent-invocation-mechanism.md` (обновлён по итогам `FIX STEP-001`).
