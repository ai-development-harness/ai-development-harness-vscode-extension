# ADR-009 — Авторизация agent CLI управляется пользователем

**Status:** Accepted
**Date:** 2026-09-19
**Deciders:** STEP-018
**Supersedes:** ADR-008, Decision пункт 4 (environment contract)
**Superseded by:** —

## Context

ADR-008 потребовал per-executor allowlist auth/provider/proxy/certificate
variables. Такой список неизбежно дрейфует с CLI и создаёт риск передачи
секретов из Extension Host дочернему процессу.

## Problem

Extension не должна становиться владельцем авторизации, provider routing или
secret environment выбранного agent CLI.

## Decision

1. Пользователь до работы с extension самостоятельно устанавливает,
   авторизует и проверяет нужный Codex CLI либо Claude Code CLI в своем
   terminal.
2. Extension не читает, не хранит, не валидирует и не передаёт credential,
   provider, proxy или certificate environment variables. Допустимы только
   platform-home и минимальные runtime variables, не содержащие секретов.
3. При недоступной или неавторизованной CLI extension показывает безопасную
   диагностику и manual fallback; не запрашивает и не логирует secret values.
4. Инструкция для пользователя: завершить login/configuration CLI и выполнить
   безопасную локальную проверку выбранного CLI до запуска command из VSCode.

## Alternatives considered

### Per-executor allowlist

Отклонён: contract быстро устаревает и расширяет поверхность передачи secrets.

### Полное наследование environment

Отклонён: передаёт unrelated secrets и делает boundary непроверяемой.

## Consequences

STEP-009 удаляет credential/provider allowlist и документирует prerequisite.
Automatic write остаётся запрещён ADR-008; этот ADR не изменяет transport,
read boundary или containment.

## Security implications

Ни credential values, ни provider configuration не входят в prompt, Output
Channel, UI, evidence или child environment extension.

## Data / migration implications

Не применимо.

## Compatibility / operational implications

Пользователь отвечает за поддерживаемую его CLI конфигурацию; failure
авторизации не повторяется скрытым изменением environment.

## Traceability

- REQ: REQ-005
- STEP: STEP-009, STEP-018
- Related: ADR-004, ADR-007, ADR-008
