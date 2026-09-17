# ADR-003 — MVP Command Palette ограничена 11 командами из 24

**Status:** Accepted
**Date:** 2026-09-17
**Deciders:** initializer (INIT PROJECT)
**Supersedes:** —
**Superseded by:** —

## Context

`docs/harness/COMMANDS.md` определяет 24 канонические команды протокола. Исходный артефакт-ТЗ описывал Command Palette Integration только для 11 из них (`INIT PROJECT, ADD STEP, PLAN STEP-NNN, IMPLEMENT STEP-NNN, REVIEW STEP-NNN, FIX STEP-NNN, RUN STEP-NNN, NEXT STEP, STATUS PROJECT, QUICK FIX, RECONCILE PROJECT`), не упоминая явно, что это подмножество, и одновременно заявлял цель «разработчик может выполнить полный цикл через UI плагина» — что для полного цикла (включая коммит/публикацию) неточно без `GIT CHECK`/`COMMIT`/`PUSH`/`PR`.

## Problem

Нужно явно решить объём MVP командной поверхности, чтобы (a) не давать пользователю ложное ощущение полноты покрытия протокола и (b) не блокировать старт разработки ожиданием решения по всем 24 командам сразу.

## Decision

MVP (см. `REQ-001`) реализует ровно 11 команд из исходного ТЗ. Оставшиеся 13 (`FIND SKILL, INSTALL SKILL, CREATE SKILL, GENERATE GITHUB TEMPLATES, AUDIT STEP-NNN, RELEASE CHECK, CHECK HARNESS UPDATE, UPDATE HARNESS, GIT CHECK, COMMIT, PUSH, PR, SYNC`) — явно вне MVP-скоупа, не Phase 2 продукта по умолчанию, а предмет отдельного продуктового решения после того, как MVP-цикл (`INIT → PLAN → IMPLEMENT → REVIEW`) будет реально опробован пользователями. `OQ-002` в `docs/OPEN_QUESTIONS.md` фиксирует нерешённый вопрос — включать ли хотя бы `GIT CHECK`/`COMMIT` в MVP, чтобы цикл «до коммита» был закрыт через UI без похода в терминал.

Командный слой (STEP-005) проектируется расширяемо (одна точка регистрации команды на входе), чтобы добавление оставшихся 13 команд позже не требовало архитектурного рефакторинга.

## Alternatives considered

### Вариант A — Реализовать все 24 команды в MVP

Полнее, но резко увеличивает объём MVP и риск для уже неопределённого вопроса интеграции с агентом (`OQ-001`); отклонено.

### Вариант B — 11 команд MVP, явно зафиксировано как сознательный вырез (выбрано)

Соответствует исходному объёму ТЗ, но убирает недосказанность из формулировки цели проекта.

## Consequences

Плюсы: управляемый объём MVP, прозрачность вместо молчаливого пробела. Минусы: пользователь MVP всё ещё уходит в обычный терминал/git-клиент для commit/push/PR — ограничение явно документировано в `docs/PROJECT.md` (Out of scope) вместо того, чтобы быть скрытым несоответствием.

## Security implications

Не применимо.

## Data / migration implications

Не применимо.

## Compatibility / operational implications

Не применимо.

## Traceability

- REQ: REQ-001
- STEP: STEP-005
