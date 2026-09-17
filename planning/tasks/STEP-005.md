# STEP-005 — Command Palette: 11 MVP-команд + pre-dispatch валидация

**Статус:** Запланировано
**Type:** IMPLEMENTATION
**Приоритет:** Критический
**Фаза:** MVP — командный слой
**Depends on:** STEP-001, STEP-003, STEP-004

## Requirements

- REQ-001

## ADR

- ADR-003

## Risk flags

- architecture

## Goal

Реализовать Command Palette со всеми 11 MVP-командами и обязательной pre-dispatch валидацией.

## Context

REQ-001 и ADR-003 (скоуп 11 из 24 команд). Зависит от решения STEP-001 (механизм вызова агента) для фактического dispatch — сама команда без него не может выполнить mutating-действие.

## Scope

- `baseCommand.ts` — общий контракт команды (pre-dispatch validation hook + dispatch hook).
- По одному модулю на команду: `init.ts`, `addStep.ts`, `plan.ts`, `implement.ts`, `review.ts`, `fix.ts`, `run.ts`, `nextStep.ts`, `status.ts`, `quickFix.ts`, `reconcile.ts`.
- Pre-dispatch: INIT guard, unmet hard dependencies, mutation policy boundary check.
- UI ввода: textbox для `ADD STEP`/`QUICK FIX`, dropdown с существующими STEP-NNN для остальных.
- Регистрация всех команд в `package.json → contributes.commands`.

## Mutation policy

### Allowed

- `src/commands/**`, `package.json → contributes.commands`.

### Conditional

- Изменение `baseCommand.ts` при появлении общей потребности (например retry-логика) — не переписывать уже реализованные команды без причины.

### Forbidden

- Реализация оставшихся 13 команд протокола (вне скоупа ADR-003).
- Любая логика explorer/editor/statusbar.

## Out of scope

- Сама передача контекста агенту и обработка его ответа за пределами интерфейса, определённого STEP-001 (делегируется, не переизобретается здесь).
- Полная локализация текста команд (базовые ключи из STEP-004 переиспользуются, остальное — STEP-010).

## Acceptance criteria

- Все 11 команд видны в Command Palette под префиксом `harness:`.
- Каждая команда проходит pre-dispatch валидацию перед вызовом агента.
- Попытка mutating-команды при `initialized: false` блокируется с понятным сообщением.
- Попытка команды над STEP с unmet hard dependency блокируется с указанием конкретного блокера.

## Verification

- Unit-тесты pre-dispatch валидации на fixture-проектах (initialized/uninitialized, с/без unmet dependencies).
- Integration-тест (`@vscode/test-electron`) на реальный вызов минимум одной read-only команды (`STATUS PROJECT`) в Extension Development Host.

## Deliverables

- `src/commands/**` + тесты.
- Обновлённый `package.json`.

## Implementation plan

**Plan status:** Not planned
**Plan revision:** —
**Planned at:** —

Заполняется командой `PLAN STEP-005`.

## Evidence

Заполняется по факту реализации и verification.

## Review status

**Latest verdict:** NOT REVIEWED
**Latest report:** —

## Blocker / Failure reason

—
