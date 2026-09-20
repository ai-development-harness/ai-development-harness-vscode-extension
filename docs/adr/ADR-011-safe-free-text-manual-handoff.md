# ADR-011 — Безопасное представление free-text команд в manual handoff MVP

**Status:** Accepted
**Date:** 2026-09-19
**Deciders:** STEP-020
**Supersedes:** ADR-010, Decision 2 только в части visual representation free-text command
**Superseded by:** —

## Context

ADR-010 перевёл MVP на manual handoff и потребовал показывать canonical command
с безопасным объяснением. Для `STEP ADD: <free text>` и `PROJECT QUICK FIX:
<free text>` exact command содержит user-controlled text. Он может содержать
secret value, control bytes или bidi format characters, поэтому exact echo в
Output Channel или notification противоречит REQ-005.

## Problem

Нельзя одновременно показывать exact canonical text-command и гарантировать,
что Extension Host не выводит raw secret-shaped free text. Один redaction
detector не образует безопасную product boundary и меняет семантику command.
Также MVP не устанавливает единый syntax пользовательского Codex/Claude CLI.

## Decision

1. Разделить internal canonical command и handoff representation. CTS
   валидирует exact command внутри Extension Host, но representation является
   только UI-текстом и не выдаётся за исполнимую Harness-команду.
2. Exact canonical command показывается только когда CTS input равен `none`,
   либо для optional input, если пользователь не передал free text.
3. При required input и при фактически переданном optional free text
   representation содержит protocol family и локализованный placeholder, явно
   обозначенный как неисполняемый шаблон. Original text не попадает в
   Extension Host Output Channel, notification, i18n params, clipboard,
   terminal automation, extension-owned storage или дочерний process. Это не
   изменяет отдельный Harness protocol execution-state, который хранит raw
   canonical command для restart semantics вне Extension Host handoff surface.
4. Пользователь сам открывает установленный и авторизованный CLI в
   контролируемом terminal и повторно вводит original intent в agent session.
   Extension не предписывает command-line syntax конкретного CLI и не передаёт
   ему prompt или context.
5. Empty, whitespace-only, control-only или structurally invalid input даёт
   локализованный actionable blocker без handoff и без spawn. Все prose,
   placeholders и reasons локализуются RU/EN; protocol tokens не переводятся.

## Alternatives considered

### Exact command после redaction

Отклонён: неполный detector раскрывает secret, а masking меняет command и не
делает его исполнимым.

### Clipboard или terminal automation

Отклонён: создаёт новую secret-transfer surface и нарушает manual-only boundary.

### Не принимать free text в Command Palette

Отклонён для MVP: это меняет UX REQ-001 и требует отдельного product STEP.

## Consequences

Manual handoff text-command имеет сознательную UX-цену: пользователь повторно
вводит описание в своём terminal. STEP-009 обязан реализовать и доказать оба
localized UI sink, safe descriptor, no-spawn и invalid-input paths.

## Security implications

Security boundary Extension Host — never-echo или persistence raw free text в
handoff surfaces, а не попытка признать redaction полной защитой. ADR-007,
ADR-008, ADR-009 и automatic-lifecycle запрет ADR-010 остаются без изменений.

## Data / migration implications

Не применимо.

## Compatibility / operational implications

CTS grammar и user-managed CLI installations не меняются. Изменяется только
контракт отображения text-command; rollback возможен лишь новым superseding ADR.

## Traceability

- REQ: REQ-005, REQ-006
- STEP: STEP-009, STEP-020
- Related: ADR-007, ADR-008, ADR-009, ADR-010
