# ADR-010 — MVP использует только manual handoff к agent CLI

**Status:** Accepted
**Date:** 2026-09-19
**Deciders:** STEP-019
**Supersedes:** ADR-004, Decision пункты 1–7 только для automatic invocation из Extension Host в MVP
**Superseded by:** ADR-011, Decision 2 только в части visual representation free-text command

## Context

REQ-005 и ADR-004 предполагали automatic lifecycle headless Codex/Claude CLI
из Extension Host. ADR-007 и ADR-008 позже потребовали доказуемые scoped
filesystem boundaries и containment всего process tree, поэтому current
implementation fail-closed использует manual fallback.

Capability matrix ниже отделяет документированные vendor свойства от
необходимого product evidence. Ни одна строка не доказывает containment
descendants, создавших новую session, при отмене из Extension Host; поэтому
документированные sandbox capabilities сами по себе не допускают automatic
lifecycle. Для Claude Code sandboxing не поддерживается на native Windows.

## Problem

Нельзя сохранять в MVP обещание automatic agent lifecycle, когда extension не
доказывает безопасную read/write boundary и cancellation containment. Manual
fallback не должен называться automatic execution.

## Decision

1. В MVP Extension Host не запускает Codex CLI или Claude Code CLI
   автоматически для выполнения Harness-команд. Любой вызов, требующий agent
   lifecycle, fail-closed завершает dispatch локализованным manual handoff.
2. Manual handoff показывает canonical command и безопасное объяснение; сам
   пользователь запускает CLI в контролируемом им terminal. Extension не
   передаёт prompt или repository context дочернему agent process, не обещает
   auto-reload, retry или Ctrl+C для ручного процесса и не читает secrets.
3. REQ-005 фиксирует этот MVP contract. Current STEP-009 остаётся
   `Заблокировано`: его task contract и verification требуют отдельного
   `STEP FIX STEP-009`, прежде чем статус можно будет пересмотреть.
4. Automatic executor может вернуться только через новый ADR и отдельный
   implementation STEP с evidence на каждой supported platform: path-scoped
   read/write enforcement, containment process tree при cancel, minimal
   environment, structured result и Extension Host end-to-end regressions.

## Alternatives considered

### Codex CLI с текущим OS-level sandbox

Отклонён для MVP automatic lifecycle. Документация подтверждает platform-level
sandbox, но не достаточный для данного контракта path-scoped lifecycle и
containment detached descendants.

### Claude Code CLI с permission modes

Отклонён. Permission modes и `--allowedTools` не заменяют OS-level boundary;
кроме того, официальная документация прямо указывает отсутствие sandboxing на
native Windows.

### Manual handoff (выбрано)

Выбран как единственный честный текущий contract: он сохраняет user control и
не выдаёт недоказанные свойства за safety guarantee.

## Consequences

REQ-005 больше не обещает automatic agent invocation в MVP. Existing manual
fallback остаётся безопасным operational behavior, но не закрывает STEP-009,
пока его устаревшие acceptance criteria не будут согласованы отдельным FIX и
независимым review. Automatic executor становится будущей architecture work,
а не неявным долгом текущего CLI adapter.

## Security implications

ADR-007, ADR-008 и ADR-009 сохраняются: context bundle не является sandbox,
consent не заменяет containment, а credential/provider values не попадают в
Extension Host child environment, UI или evidence. Новая automatic path не
может использовать опасные bypass flags как замену isolation.

## Data / migration implications

Не применимо.

## Compatibility / operational implications

Поддерживаемые Codex/Claude installations остаются пользовательской
ответственностью. Пользователь может выполнить CLI вручную в своей среде; это
не создаёт extension-owned гарантий lifecycle.

## Evidence

- Matrix проверена 2026-09-19 по primary documentation. Значение
  `Документировано` означает vendor claim, но не готовность extension;
  `Не доказано` — отсутствует product-specific evidence; `Недоступно` —
  vendor/platform contract прямо исключает capability.

| Executor / platform | Scoped read: vendor | Scoped write: vendor | Cancel process tree: product | Minimal environment: product | Structured result: vendor | Product verdict |
|---|---|---|---|---|---|---|
| Codex / macOS | Документировано; product proof отсутствует | Документировано; product proof отсутствует | Не доказано | Не доказано | Документировано | manual only |
| Codex / Linux | Документировано; product proof отсутствует | Документировано; product proof отсутствует | Не доказано | Не доказано | Документировано | manual only |
| Codex / WSL2 | Документировано; product proof отсутствует | Документировано; product proof отсутствует | Не доказано | Не доказано | Документировано | manual only |
| Codex / native Windows | Документировано; product proof отсутствует | Документировано; product proof отсутствует | Не доказано | Не доказано | Документировано | manual only |
| Claude / macOS | Документировано; product proof отсутствует | Документировано; product proof отсутствует | Не доказано | Не доказано | Документировано | manual only |
| Claude / Linux | Документировано; product proof отсутствует | Документировано; product proof отсутствует | Не доказано | Не доказано | Документировано | manual only |
| Claude / WSL2 | Документировано; product proof отсутствует | Документировано; product proof отсутствует | Не доказано | Не доказано | Документировано | manual only |
| Claude / native Windows | Недоступно | Недоступно | Не доказано | Не доказано | Документировано | manual only |

- OpenAI: [Sandbox](https://learn.chatgpt.com/docs/sandboxing) и
  [Permissions](https://learn.chatgpt.com/docs/permissions) — platform-native
  enforcement, writable roots и inherited boundary child commands;
  [Non-interactive mode](https://learn.chatgpt.com/docs/non-interactive-mode)
  — `codex exec` и structured output.
- Anthropic: [Sandboxing](https://code.claude.com/docs/en/sandboxing) —
  OS-enforced `allowRead`/`allowWrite` on macOS/Linux/WSL2;
  [setup](https://code.claude.com/docs/en/getting-started) — sandboxing
  отсутствует на native Windows; [CLI reference](https://code.claude.com/docs/en/cli-usage)
  — `-p` и structured JSON output.
- `planning/reviews/STEP-009/REVIEW-2026-09-19T1742Z.md` — current command
  path не доказывает full lifecycle и cancellation/retry recovery.

## Traceability

- REQ: REQ-005
- STEP: STEP-009, STEP-019
- Related: ADR-004, ADR-007, ADR-008, ADR-009
