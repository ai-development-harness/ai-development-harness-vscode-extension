# REQ-005 — Manual handoff к agent CLI в MVP

**Приоритет:** Критический
**Источник:** brief

## Requirement

При команде, требующей agent lifecycle, Extension Host выполняет pre-validation и показывает в Output Channel «Harness» и notification локализованный manual handoff. Для команды без user-controlled free text handoff содержит exact canonical command; при required input или фактически переданном optional input — безопасное неисполняемое representation без исходного текста. Пользователь самостоятельно запускает agent CLI в контролируемом terminal и повторно вводит original intent; extension не создаёт agent process, не передаёт context bundle и не выдаёт ручной процесс за automatic execution.

## Rationale

До появления доказуемого automatic executor приоритетом является честная security boundary: extension не должна обещать isolation, containment или отмену чужого процесса, которых не может технически обеспечить.

## Acceptance

- Output Channel и user notification объясняют manual handoff без prompt, secret values и лишних путей workspace.
- Для text-command оба sink показывают локализованный safe descriptor, не raw free text и не command, пригодную для повторного запуска через Harness.
- Pre-validation blocker не запускает agent CLI и содержит понятное действие для пользователя.
- Extension не заявляет auto-reload, retry или Ctrl+C guarantee для процесса, который пользователь запустил вручную.
- Возврат automatic lifecycle возможен только по отдельному ADR с evidence platform-specific isolation и process-tree containment.

## Traceability

- STEP: STEP-001, STEP-009, STEP-017, STEP-018, STEP-019, STEP-020, STEP-024
- ADR: ADR-004, ADR-007, ADR-008, ADR-009, ADR-010, ADR-011
