# ADR-007 — Честная read-boundary для headless agent CLI

**Status:** Accepted
**Date:** 2026-09-19
**Deciders:** STEP-009 FIX
**Supersedes:** —
**Superseded by:** —

## Context

ADR-004 выбрал headless Codex и Claude CLI. Режимы `read-only` и `plan`
запрещают запись, но сами по себе не являются path-scoped гарантией чтения
только выбранных артефактов исходного workspace.

## Problem

Временный context bundle уменьшает объём передаваемых данных, но не должен
выдаваться за OS-level sandbox. Абсолютный путь repository в prompt также
создаёт ненужный ориентир для чтения невыбранных файлов.

## Decision

1. Read-only invocation получает только allowlisted context bundle и не
   получает абсолютный путь исходного workspace в prompt.
2. Bundle является data-minimization мерой, а не обещанием технической
   filesystem isolation.
3. Только executor с подтверждённой OS-level read isolation может получить
   automatic read-only invocation. Иначе extension предлагает manual fallback.
4. Workspace-wide write по-прежнему требует отдельного consent ADR-006.

## Alternatives considered

### Вариант A — считать bundle sandbox

Отклонён: Node `cwd` не ограничивает filesystem access дочернего процесса.

### Вариант B — consent для каждого read-only запуска

Отклонён: consent не создаёт технической boundary и ухудшает UX.

## Consequences

Prompt не раскрывает location repository. Будущий executor с path-scoped read
sandbox может включаться автоматически после отдельной проверки контракта.

## Security implications

Не заявлять гарантию, которую выбранный CLI технически не обеспечивает.

## Data / migration implications

Не применимо.

## Compatibility / operational implications

Read-only fallback не меняет mutation flow и не ослабляет ADR-006.

## Traceability

- REQ: REQ-005
- STEP: STEP-009
