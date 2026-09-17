# STEP-010 — Полная локализация реализованного UI

**Статус:** Запланировано
**Type:** IMPLEMENTATION
**Приоритет:** Средний
**Фаза:** MVP — локализация
**Depends on:** STEP-004, STEP-005, STEP-006, STEP-007, STEP-008, STEP-009

## Requirements

- REQ-006

## ADR

- не требуется

## Risk flags

- none

## Goal

Локализовать весь реализованный UI (команды/меню/status bar/ошибки/hover/диагностику/terminal output/webviews) на RU и EN.

## Context

STEP-004 создал сервис и минимальный словарь; этот STEP закрывает REQ-006 полностью, применяя сервис ко всем поверхностям, реализованным в STEP-005..009.

## Scope

- Пройти по всем user-facing строкам из STEP-005..009, заменить хардкод на i18n-вызовы.
- Дополнить `ru.json`/`en.json` недостающими ключами, включая error hints.
- Локализовать terminal output и любые webview-строки.
- Тест на полноту словаря: каждый используемый в коде ключ присутствует в обоих файлах или имеет задокументированный fallback.

## Mutation policy

### Allowed

- Замена строковых литералов на i18n-вызовы во всех затронутых `src/**`.

### Conditional

- —

### Forbidden

- Изменение логики фич (только замена текстовых строк).

## Out of scope

- Локализация Phase 2 фич (REQ-007..010) — появится вместе с их реализацией.

## Acceptance criteria

- Переключение языка обновляет все видимые UI-элементы без перезапуска VSCode.
- Отсутствующий перевод не приводит к ошибке в консоли.
- `translations.test.ts` подтверждает покрытие ключей для RU и EN (без стороннего третьего языка).

## Verification

- `npm test` (`translations.test.ts`).
- Ручная проверка переключения языка в Extension Development Host по каждой реализованной фиче.

## Deliverables

- Обновлённые `src/locales/{ru,en}.json`.
- Тест на полноту словаря.
- `src/**` без хардкод-строк в user-facing путях.

## Implementation plan

**Plan status:** Not planned
**Plan revision:** —
**Planned at:** —

Заполняется командой `PLAN STEP-010`.

## Evidence

Заполняется по факту реализации и verification.

## Review status

**Latest verdict:** NOT REVIEWED
**Latest report:** —

## Blocker / Failure reason

—
