# STEP-001 — Research: механизм вызова агента для command dispatch

**Статус:** Выполнено
**Type:** RESEARCH
**Приоритет:** Критический
**Фаза:** MVP — фундамент
**Depends on:** —

## Requirements

- REQ-005

## ADR

- ADR-004

## Risk flags

- architecture

## Goal

Определить и доказать рабочий механизм, которым плагин передаёт контекст агенту-исполнителю протокола для выполнения канонической команды и получает structured-результат — без выдуманного HTTP API из исходного ТЗ.

## Context

Исходный артефакт-ТЗ (раздел 4.1) описывает JSON-контракт `HarnessCommand`/`HarnessResult` поверх «Claude Code API», которого не существует в задокументированном виде. См. `docs/OPEN_QUESTIONS.md` OQ-001. Это блокирует STEP-005 (dispatch) и STEP-009 (Terminal Integration).

**Уточнение по факту planning-анализа:** сам скопированный protocol layer (`.codex/config.toml`, `.codex/agents/*.toml`, native Codex subagents, инструкция в README «Открой репозиторий в Codex») сконфигурирован под **Codex CLI**. Ни в `AGENTS.md`, ни в `docs/harness/**`, ни в `planning/EXECUTION_PROTOCOL.md` нет ни одного упоминания Claude Code — это предположение пришло из исходного артефакта-ТЗ и из `PROJECT_BRIEF.local.md`, а не из фактически сконфигурированного runtime репозитория-шаблона. Research обязан взять это за основной факт: Codex CLI — первично поддерживаемый и уже сконфигурированный executor; Claude Code — вторичный/опциональный target, который требует собственной конфигурации (аналог `.codex/` для Claude, если такая существует) прежде чем на него можно полагаться.

## Scope

- Изучить реально доступные способы вызова **Codex CLI** (первичный target): non-interactive/headless режим выполнения, структурированный (JSON) вывод, способ передать project-scoped agent role из `.codex/config.toml`/`.codex/agents/*.toml`, аутентификация, кроссплатформенность, отмена долгого выполнения.
- Тем же критериям оценить Claude Code как вторичный/опциональный target — если для него нет эквивалента `.codex/`-конфигурации, зафиксировать это как отдельный gap, а не как «то же самое что Codex».
- Оценить нейтральный fallback-вариант: открытый VSCode-терминал с автоподстановкой промпта (работает для любого CLI-агента, но не даёт structured-результата без VSCode Shell Integration API).
- Зафиксировать ограничения каждого варианта: аутентификация, кроссплатформенность, возможность получить structured-результат (не просто текст), поведение при долгом выполнении, возможность отмены.
- Реализовать минимальный spike: реальный запуск одной команды (например `PLAN STEP-002` на fixture-проекте) через выбранный механизм и разбор полученного результата.
- Задокументировать решение отдельным ADR, включая явное решение — поддерживать один executor в MVP или абстрагировать Agent integration layer за адаптером с первой реализацией под Codex CLI.

## Mutation policy

### Allowed

- Spike-скрипт вне production-кода расширения (например `spikes/`, не входит в bundle).

### Conditional

- —

### Forbidden

- Полноценная реализация Agent integration layer (это STEP-009).
- Изменение production-кода расширения.

## Out of scope

- Полноценная реализация Terminal Integration (STEP-009).
- UI для отображения прогресса выполнения.

## Acceptance criteria

- Проведено сравнение минимум двух реальных вариантов вызова с конкретными плюсами/минусами.
- Spike демонстрирует реальный end-to-end вызов на fixture-проекте с получением результата.
- Решение зафиксировано отдельным ADR с обоснованием и альтернативами.
- `docs/OPEN_QUESTIONS.md` OQ-001 переведён в `RESOLVED`.

## Verification

- Ручной прогон spike-скрипта с реальным CLI/SDK; вывод команды и её результат приложены как Evidence.

## Deliverables

- Spike-скрипт (не публикуется в bundle расширения).
- Новый ADR с решением.
- Обновлённый `docs/OPEN_QUESTIONS.md` (OQ-001 → RESOLVED).

## Implementation plan

**Plan status:** Planned
**Plan revision:** 1
**Planned at:** 2026-09-17

### Кандидаты и критерии оценки

Три кандидата для сравнения, приоритет — Codex CLI как первичный target (см. Context):

| Критерий | A. Codex CLI non-interactive/headless | B. Codex через процесс-обёртку (аналог Agent SDK, если существует для Codex) | C. Открытый терминал + автоподстановка промпта (любой CLI) |
|---|---|---|---|
| Structured-результат (не просто текст) | проверить `--json`/эквивалент вывода | да, по определению SDK | нет без VSCode Shell Integration API — в лучшем случае частично |
| Reuse существующей auth пользователя | да (использует уже настроенный Codex CLI) | зависит от SDK | да |
| Отмена долгого выполнения | kill процесса — проверить graceful cancel | зависит от SDK API | ненадёжно (Ctrl+C в терминале не гарантированно мапится на команду плагина) |
| Кроссплатформенность (Win/Mac/Linux) | проверить наличие бинаря на PATH на всех трёх | проверить | наследует ограничения терминала VSCode, обычно ок |
| Зависимость/вес bundle расширения | нет (spawn внешнего процесса) | новая npm-зависимость | нет |
| Пригодность как MVP fallback при недоступности A/B | — | — | да, единственный вариант, всегда работающий вручную |

Claude Code оценивается по тем же критериям как secondary target **только если** для него найдена рабочая конфигурация, эквивалентная `.codex/` в этом шаблоне; если такой конфигурации нет — фиксируется как gap в ADR, а не реализуется вслепую.

### Порядок исследования

1. Проверить, что `codex` CLI действительно предоставляет non-interactive/headless режим с возможностью: (a) задать `cwd` = workspace проекта, (b) передать произвольный prompt/skill-инструкцию, (c) получить результат в структурированном виде (JSON или парсибельный текст с чёткими маркерами), (d) прервать выполнение. Задокументировать точные флаги/API, которые реально существуют (не полагаться на память — проверить `--help`/официальную документацию).
2. Провести тот же анализ для Claude Code, отметить конкретные отличия/gaps.
3. Оценить вариант C (терминал + VSCode Shell Integration API `terminal.shellIntegration`/`onDidEndTerminalShellExecution`) как universal fallback независимо от результатов 1–2 — он нужен в любом случае как деградация при недоступном CLI.
4. Выбрать основной механизм для MVP по критериям выше; зафиксировать, обязательно ли абстрагировать Agent integration layer за интерфейсом (адаптер на исполнителя) уже в MVP, или это можно отложить до появления второго реального executor.

### Spike

- Расположение: `spikes/agent-invocation/` в корне репозитория (вне `src/`, не входит в bundle расширения — попадает под Mutation policy Allowed).
- Самодостаточный: собственный минимальный `package.json`/скрипт (Node.js), не зависит от STEP-002 (scaffolding расширения ещё не существует — STEP-001 не имеет от него зависимости).
- Сценарий: запустить выбранный механизм (кандидат A, при необходимости B) на **fixture-проекте** — используем сам этот репозиторий (`ai-development-harness-vscode-extension`) как fixture, реальная команда `PLAN STEP-002` (Project scaffolding — read-only по отношению к product code, безопасный тестовый прогон).
- Критерий успеха: получен результат вызова (stdout/JSON), из которого можно программно извлечь: (а) факт успеха/ошибки, (б) какие файлы затронуты, (в) достаточно ли информации, чтобы предложить пользователю next command — без парсинга произвольного human-readable текста регулярками сверх разумного.
- Cancel-тест: запустить долгую команду и прервать её (SIGINT/kill), убедиться, что процесс завершается чисто и не оставляет repository в неконсистентном состоянии (например незакоммиченные частичные правки — допустимо, но не битые файлы).

### Test strategy / Verification sequence

1. Ручной прогон spike для кандидата A (Codex CLI headless) — зафиксировать реальный вызов, вывод, время выполнения.
2. При необходимости — то же для Claude Code (если конфигурация найдена) и/или кандидата B.
3. Cancel-тест (см. выше).
4. Сравнительная таблица кандидатов дополняется фактическими данными (не гипотезами) по итогам 1–3.
5. Результат оформляется как ADR (Proposed → Accepted), `OQ-001` переводится в `RESOLVED` со ссылкой на ADR.

### Impacted areas / data-API implications

Product code не создаётся (STEP-002 ещё не выполнен). Затрагиваются только: `spikes/agent-invocation/**` (новое, вне bundle), `docs/OPEN_QUESTIONS.md` (OQ-001 → RESOLVED), новый ADR, `docs/architecture.md` (снять пометку «известный architecture debt» по агент-интеграции), STEP-001 Evidence/Review status.

### Risks / rollback

- Риск: ни Codex CLI, ни Claude Code не дают structured-результата без хрупкого парсинга текста → рассматривать headless + `--output-format json`/эквивалент как обязательное требование к выбору, иначе явно принять вариант C как MVP-baseline с честно ограниченным UX (без auto-parsed next command) вместо того чтобы выдумывать несуществующий JSON-контракт.
- Риск: механизм платформенно-зависим (например недоступен на Windows) → зафиксировать как известное ограничение в ADR, не блокировать STEP-001 целиком ради 100% кроссплатформенности, если целевая аудитория MVP это допускает (уточнить у пользователя при необходимости).
- Rollback: если выбранный в ADR механизм окажется нерабочим при реализации STEP-009, создаётся новый ADR со статусом `Supersedes` — не переписывается история задним числом.

### Handoff

По завершении: `REVIEW STEP-001` (RESEARCH-тип — верификация ADR и спайка reviewer'ом), далее разблокируются `STEP-005`/`STEP-009`.

## Evidence

`RUN STEP-001` (2026-09-17), выполнено в текущей сессии как research (без production-мутации кода расширения — его ещё нет, STEP-002 не начат):

1. **Инспекция реально установленных CLI** в окружении: `codex --version` → `codex-cli 0.154.0` (`codex login status` → `Logged in using ChatGPT`); `claude --version` → `2.1.263 (Claude Code)` (`claude auth status` → `loggedIn: true`, `subscriptionType: "pro"`). Оба CLI документируют headless-режим со структурированным JSON-выводом (`codex exec --json`/`--output-schema`; `claude -p --output-format json`) — подтверждено по `--help`, не по памяти.
2. **Живой read-only spike** (см. `spikes/agent-invocation/README.md`, сырые данные — `spikes/agent-invocation/evidence/`):
   - `codex exec -s read-only --ephemeral --json ...` → exit 1, но чистый структурированный JSONL (`thread.started`/`turn.started`/`error`/`turn.failed`). Причина ошибки — реальный usage limit аккаунта («try again at Sep 20th, 2026»), не сбой механизма. Happy-path НЕ подтверждён эмпирически — известное ограничение, зафиксировано в `docs/architecture.md` (Known architecture debt) и в ADR-004.
   - `claude -p --output-format json --permission-mode plan --permission-prompts none --allowedTools Read "..."` → exit 0, полный успех. Корректно прочитал `planning/tasks/STEP-002.md` и точно процитировал его `## Goal`, `permission_denials: []`, `is_error: false`. *(Исправлено `FIX STEP-001`, F-001: исходно здесь стояло «подтверждено `git status` после прогона» — эта конкретная проверка фактически не была выполнена изолированно в момент вызова, только ретроспективно позже. См. `spikes/agent-invocation/README.md` для полной формулировки исправления.)*
3. **Побочная находка**: первая попытка вызова `claude` с порядком `--allowedTools "Read" "<prompt>"` привела к реальной ошибке `Input must be provided either through stdin or as a prompt argument` — variadic-опция поглотила позиционный prompt. На момент `RUN STEP-001` из этого делался вывод про stdin как решение, но сам stdin-путь ещё не был проверен вживую (см. п.5 — проверено `FIX STEP-001`).
4. Решение зафиксировано `ADR-004` (Accepted). `docs/OPEN_QUESTIONS.md` OQ-001 → `RESOLVED`.
5. **`FIX STEP-001` (2026-09-17)** — закрытие findings `REVIEW-2026-09-17T1800.md`:
   - **F-001**: см. исправление в п.2 выше и в `spikes/agent-invocation/README.md`.
   - **F-002**: живой stdin-тест для обоих CLI, бракетированный `git status` до/после (идентичен, без изменений). `echo "<prompt>" | codex exec --json ...` → stderr `Reading prompt from stdin...`, дошёл до `turn.started` (тот же usage limit дальше, но stdin реально принят и обработан). `echo "<prompt>" | claude -p --output-format json ...` → exit 0, полный happy path через stdin, `total_cost_usd: 0.0925`. Evidence — `spikes/agent-invocation/evidence/{codex-exec-stdin-stdout.jsonl,codex-exec-stdin-stderr.txt,claude-print-stdin-stdout.json}`. ADR-004 Decision §5 обновлён — stdin-передача теперь подтверждена эмпирически для обоих CLI, не только по документации.
   - **F-003**: cancel-тест на `claude -p` (запущен в background, `SIGTERM` через 3с). Процесс завершился в пределах 1с (exit 143), без orphan-процессов, `stdout`/`stderr` пусты (при `--output-format json` cancel не даёт partial-результата — зафиксировано как design constraint), `git status` до/после идентичен. Codex cancel отдельно не тестировался (review допускал проверку на одном CLI; у Codex сейчас слишком короткое окно из-за квоты для содержательного mid-flight теста) — зафиксировано как остаточное ограничение в ADR-004 Consequences, не скрыто.
   - `ADR-004` обновлён (Decision §5/§6, Consequences, Security implications) по итогам обеих проверок.
6. **`FIX STEP-001` (второй цикл, 2026-09-17)** — закрытие F-004 из `REVIEW-2026-09-17T1830.md`: cancel-тест (п.5 выше) был реально проведён, но не имел сохранённого durable-артефакта. Данные из п.5 (команда, PID, `ps`/`pgrep`, exit status, размеры файлов) сохранены в `spikes/agent-invocation/evidence/claude-cancel-test.txt` — без новых вызовов CLI, только фиксация уже полученного результата.

## Review status

**Latest verdict:** PASS
**Latest report:** `planning/reviews/STEP-001/REVIEW-2026-09-17T1900.md`

## Blocker / Failure reason

Нет. Все findings трёх review-циклов закрыты и подтверждены:

- `REVIEW-2026-09-17T1800.md`: F-001/F-002/F-003 — закрыты первым `FIX STEP-001`.
- `REVIEW-2026-09-17T1830.md`: F-004 — закрыт вторым `FIX STEP-001`.
- `REVIEW-2026-09-17T1900.md`: PASS, полный повторный проход по acceptance criteria без новых non-cosmetic находок.

Остаточные, явно раскрытые ограничения (не blocker — известные пределы этого окружения, не влияют на закрытие research-задачи STEP-001): (1) Codex happy-path (`turn.completed`) не подтверждён эмпирически из-за квоты аккаунта, доступна вновь после 2026-09-20 — переподтвердить перед/во время `STEP-009`; (2) Codex cancel-поведение отдельно не тестировалось. Оба зафиксированы в `ADR-004` Consequences.
