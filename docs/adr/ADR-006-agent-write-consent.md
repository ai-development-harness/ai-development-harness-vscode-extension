# ADR-006 — Явное подтверждение workspace-wide записи для headless agent CLI

**Status:** Accepted
**Date:** 2026-09-19
**Deciders:** STEP-009 FIX
**Supersedes:** —
**Superseded by:** —

## Context

ADR-004 выбрал Codex CLI и Claude Code CLI как headless executor'ы. Их
write-режимы разрешают запись во всём workspace: ни `workspace-write`, ни
`acceptEdits` не умеют технически ограничить доступ перечнем путей из Mutation
policy конкретного STEP.

## Problem

Нельзя выдавать агенту workspace-wide write автоматически и одновременно
заявлять, что Mutation policy является enforceable path-scoped sandbox. Такая
неточность превращает prompt injection из контекста репозитория в возможность
изменить файл за пределами Scope.

## Decision

1. Перед каждым invocation, которому требуется запись, extension строит
   fail-closed policy из canonical command и parsed Mutation policy target STEP.
2. Если CLI не даёт ограничить write перечисленными путями, extension показывает
   пользователю эти пути и требует отдельного явного подтверждения именно
   workspace-wide доступа. Отказ не запускает executor.
3. `RUN STEP-NNN` считается потенциально mutating orchestration: до появления
   path-scoped sandbox он также требует подтверждения, а не получает read-only
   режим по строковому префиксу.
4. Confirmation — граница согласия пользователя, а не техническое enforcement
   Mutation policy. Агент получает только минимальный режим, который реально
   поддерживает CLI; dangerous flags из ADR-004 по-прежнему запрещены.

## Alternatives considered

### Вариант A — считать Mutation policy path sandbox

Отклонён: выбранные CLI такой sandbox не предоставляют, поэтому гарантия была
бы ложной.

### Вариант B — автоматический workspace-wide write

Отклонён: prompt или artifact из repository мог бы изменить несвязанный файл
без отдельного согласия пользователя.

### Вариант C — explicit confirmation (выбрано)

Сохраняет headless CLI из ADR-004 и делает расширение прав доступа прозрачным
до spawn. Цена — дополнительное действие пользователя для mutation.

## Consequences

Mutation-команды не являются полностью unattended. Будущий executor с
path-scoped sandbox может заменить confirmation техническим enforcement через
новый ADR, не меняя исторический контракт ADR-004.

## Security implications

Отказ или отсутствие подтверждения fail-closed. В confirmation не выводится
prompt или содержимое артефактов; показываются только canonical command и
заявленные allowlisted пути.

## Data / migration implications

Не применимо.

## Compatibility / operational implications

Read-only команды не меняют поведение. Для `RUN STEP-NNN` write-подтверждение
безопаснее прежнего ошибочного read-only запуска и позволяет оркестрации
дойти до mutating child action.

## Traceability

- REQ: REQ-005
- STEP: STEP-009
