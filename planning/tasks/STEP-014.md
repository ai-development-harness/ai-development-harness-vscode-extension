# STEP-014 — Закрыть TOCTOU-окно между guard'ом `canMarkDone` и записью в Explorer

**Статус:** Запланировано
**Type:** BUGFIX
**Приоритет:** Средний
**Фаза:** MVP — UI
**Depends on:** STEP-006

## Requirements

- REQ-002

## ADR

- не требуется: устраняет race в уже принятом решении STEP-006/ADR-002, новой архитектурной развилки нет.

## Risk flags

- deterministic-gate bypass (см. `## Context`)

## Goal

Устранить остаточное окно гонки в `src/explorer/actions.ts` между проверкой guard'а `canMarkDone`/`canFlagBlocker`/`canDelete` и фактической записью файла: пока открыто модальное подтверждение (`showWarningMessage`/`showQuickPick`, время ожидания пользователя не ограничено), содержимое STEP-файла может измениться (параллельная работа headless-агента по ADR-004), а перед записью guard повторно не проверяется.

## Context

Найдено при `REVIEW STEP-006` (`planning/reviews/STEP-006/REVIEW-2026-09-18T1108.md`, finding F-018, Non-blocking/Medium — не блокировал закрытие STEP-006, вынесено отдельным corrective STEP согласно Handoff этого review). Фактический порядок операций в `markDone`: `readFreshStep` (чтение №1) → `canMarkDone(step)` на содержимом чтения №1 → `showWarningMessage(..., { modal: true })` — неограниченное по времени ожидание пользователя → `writeStepFile` (чтение №2 + запись). `setStatus`/round-trip verify в `stepWriter.ts` проверяют только то, что относительно чтения №2 изменилось ровно ожидаемое поле; они не перепроверяют `reviewStatus.latestVerdict === 'PASS'`/непустой `evidence`.

Это остаточный случай того же класса дефекта, что был закрыт как `F-003` в первом FIX-проходе STEP-006 (`AGENTS.md` §8/§11, `EXECUTION_PROTOCOL.md` §3: статус `Выполнено` разрешён только при доказанном review PASS). F-003 закрыл систематически достижимую ветку (устаревшие данные узла дерева); здесь остаётся именно гонка по времени, но конкурентная запись STEP-файла агентом — штатная модель продукта (ADR-004), поэтому окно нельзя считать чисто теоретическим.

`flagBlocker` этим дефектом не затронут (InputBox вызывается до `readFreshStep`, ожидания между guard'ом и записью нет). `deleteArtifact` затронут структурно так же (`canDelete` проверяется до модального подтверждения), но последствие мягче — удаление идёт через `useTrash: true`, откат возможен.

## Scope

- `src/explorer/actions.ts` — `markDone`: после закрытия модального подтверждения и непосредственно перед вызовом `writeStepFile`/`setStatus`, перечитать STEP-файл и повторно вызвать `canMarkDone` на свежем содержимом; при несовпадении с состоянием на момент подтверждения — fail-closed с уже существующим локализованным `messageKey` (без второго диалога).
- То же для `deleteArtifact` (`canDelete`) — повторная проверка входящих ссылок непосредственно перед `workspace.fs.delete`.
- Минимально достаточный рефакторинг `stepWriter.ts`/`guards.ts`, если потребуется единая read-verify-write последовательность (без изменения публичного контракта `setStatus`/`setBlocker`/`setStatusAndBlocker` за пределами необходимого).

## Mutation policy

### Allowed

- `src/explorer/actions.ts`, `src/explorer/guards.ts`, `src/explorer/stepWriter.ts`.
- `tests/unit/explorer/**` — регрессионные тесты.

### Conditional

- `src/locales/{ru.json,en.json}` — только если понадобится новый message key для отличения «guard не пройден изначально» от «guard не пройден повторно после подтверждения» (не обязательно — можно переиспользовать существующие ключи `canMarkDone`/`canFlagBlocker`/`canDelete`).

### Forbidden

- Изменение `src/commands/preDispatch.ts` (переиспользуется, не модифицируется — тот же принцип, что в STEP-006).
- Расширение scope на F-019..F-025 (другие non-blocking findings STEP-006) — не решаются «заодно»; при необходимости фиксируются отдельными `ADD STEP:`.

## Out of scope

- F-019 (реконструкция пути по `<id>.md` вместо `node.uri`), F-020 (накопление watcher-подписок), F-021 (ADR-glob вне `paths.ts`), F-022 (недифференцированное «нет артефактов»/«скрыто фильтром») — отдельные non-blocking findings STEP-006, не входят в этот corrective STEP; фиксируются по потребности отдельными `ADD STEP:`.
- `deleteArtifact` для узлов, не являющихся STEP (REQ/ADR/file) — F-018 сформулирован именно для `canMarkDone`/`canDelete` над STEP-узлами; расширение guard'ов на другие типы узлов вне текущего понимания дефекта.

## Acceptance criteria

- Воспроизводимый до фикса сценарий (guard проходит на устаревшем содержимом, файл меняется во время открытого модального диалога, запись всё равно происходит) после фикса не воспроизводится: запись блокируется тем же локализованным сообщением, что при изначально непройденном guard'е.
- `flagBlocker` не регрессирует (остаётся без ожидания между guard'ом и записью, либо получает ту же защиту, если рефакторинг `stepWriter.ts` этого потребует).
- Существующие 140 unit- и 15 integration-тестов STEP-006 остаются зелёными без ослабления.

## Verification

- Unit-тест: замокать `showWarningMessage`/`showQuickPick` так, чтобы обработчик перезаписывал fixture-файл (`latestVerdict` → `FAIL` или terminal-статус) непосредственно перед возвратом подтверждения пользователя, и утверждать отсутствие `writeFile`/`delete`.
- Регрессионный прогон полного набора `tests/unit/explorer/**` и `tests/integration/explorer.test.js`.

## Deliverables

- Точечный патч `src/explorer/actions.ts` (+ `guards.ts`/`stepWriter.ts` при необходимости) с regression-тестами.

## Implementation plan

**Plan status:** Not planned
**Plan revision:** —
**Planned at:** —

Заполняется командой `PLAN STEP-014`.

## Evidence

Заполняется по факту реализации и verification.

## Review status

**Latest verdict:** NOT REVIEWED
**Latest report:** —

## Blocker / Failure reason

—
