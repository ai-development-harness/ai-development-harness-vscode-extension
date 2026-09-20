# ADR-008 — Безопасная граница write-invocation headless agent CLI

**Status:** Accepted
**Date:** 2026-09-19
**Deciders:** STEP-017
**Supersedes:** ADR-006 (automatic headless write-invocation)
**Superseded by:** ADR-009 (только пункт 4: environment contract)

## Context

ADR-004 закрепил transport через headless Codex CLI и optional Claude Code CLI,
а ADR-006 потребовал informed consent для workspace-wide записи. ADR-007
отдельно не называет context bundle технической read-boundary.

Последний независимый review STEP-009 показал, что write-mode остаётся
неопределённым: `workspace-write` и `acceptEdits` не доказывают чтение только
выбранных артефактов, а остановка POSIX process group не покрывает потомка,
создавшего новую session. На native Windows Claude Code не предоставляет
sandboxing. Поэтому согласие на запись не может выдаваться за containment
чтения или гарантию отмены.

## Problem

Нужно либо технически ограничить filesystem read и всё дерево write-процесса,
либо не запускать write-mode автоматически. Нельзя компенсировать отсутствие
такой boundary предупреждением, `cwd`, context bundle или `taskkill`/signal,
которые не доказывают требуемые свойства на всех платформах.

## Decision

1. Для текущих Codex CLI и Claude Code CLI automatic headless write-invocation
   запрещён на POSIX и native Windows. Extension fail-closed предлагает manual
   fallback: показывает canonical command и безопасные инструкции, но не
   создаёт write-процесс через `child_process`. Пользователь сам запускает
   команду в контролируемом им terminal; extension не заявляет для неё
   containment или Ctrl+C-гарантию.
2. Матрица разрешённых текущих комбинаций: Codex/POSIX, Codex/Windows,
   Claude/POSIX и Claude/native Windows — только manual fallback для записи.
   Automatic write допускается лишь после отдельного ADR и evidence, что
   конкретная executor/platform combination одновременно обеспечивает
   path-scoped read boundary и containment всего дерева.
3. Будущий automatic executor обязан использовать OS-level supervisor:
   на POSIX — механизм, который уничтожает descendants после `setsid` (например,
   cgroup или эквивалент); на Windows — Job Object или эквивалент с фактическим
   kill-on-close. Process group, `SIGTERM`, `taskkill` и абсолютный путь к нему
   могут быть лишь transport detail, но не достаточной гарантией. При
   недоступности supervisor, неподтверждённой платформе или ошибке activation
   запуск блокируется до spawn.
4. Новый executor перед automatic start получает minimal environment по
   per-executor allowlist имён, сверенной с документированными auth/provider,
   proxy, certificate и platform-home variables. Не наследуются произвольные
   переменные, `GIT_CONFIG_*` и unrelated secrets; значения allowlist не входят
   в prompt, Output Channel, notifications, errors, telemetry или evidence.
5. ADR-006 superseded только в части automatic write flow: прежний consent
   больше не разрешает запуск. ADR-004 сохраняет выбранный CLI transport, а
   ADR-007 сохраняет честную read-boundary для read-only flow.

## Alternatives considered

### Вариант A — OS-level containment сейчас

Отклонён для текущего STEP: ни один документально подтверждённый current
executor/platform contract не доказывает одновременно scoped read и tree-wide
cancel. Реализация supervisor и platform regressions — отдельная corrective
работа.

### Вариант B — расширенный informed consent

Отклонён: честное раскрытие host-wide read risk улучшило бы UX-информирование,
но не предотвращает чтение credentials или detached write после cancel.

### Вариант C — manual fallback (выбран)

Выбран как единственный current safe mode: пользователь сохраняет контроль
над процессом и host permissions, а extension не обещает свойство, которое
не может обеспечить.

## Consequences

Автоматизация mutating commands временно деградирует до понятного manual
handoff. Automatic read-only invocation по ADR-007 не расширяется этим
решением. REQ-005 не выполнен до отдельной corrective реализации и её review.

## Security implications

Correction STEP-009 обязана закрыть findings `REVIEW-2026-09-19T1614Z.md`:

- F-001: pre-consent Git запускается с fail-closed config/environment policy;
- F-002: реализуется fail-closed write boundary и manual fallback этого ADR;
- F-003: current corrective work закрывает риск отсутствием automatic
  write-spawn; containment detached descendants и его regression обязательны
  только для будущего отдельного ADR, возвращающего automatic write;
- F-004: реализуется и тестируется per-executor environment allowlist;
- F-005: все external strings проходят через единый bounded sanitization;
- F-006: добавляется Windows regression фактической tree cancellation либо
  Windows automatic mode остаётся blocked;
- F-007: out-of-scope изменение `.codex/config.toml` исключается из STEP-009.

## Data / migration implications

Не применимо.

## Compatibility / operational implications

Manual fallback должен быть локализован, не раскрывать prompt, secret values
или лишние пути и явно сообщать, что automatic write недоступен. Каждый
будущий executor/platform onboarding требует отдельного evidence для read
boundary, cancellation и environment contract.

## Traceability

- REQ: REQ-005
- STEP: STEP-009, STEP-017
- Related: ADR-004, ADR-007
