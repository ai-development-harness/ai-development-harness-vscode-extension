# ADR-005 — Двухуровневая резолюция путей Harness-артефактов

**Status:** Accepted
**Date:** 2026-09-19
**Deciders:** architect (RUN STEP-016)
**Supersedes:** ADR-001
**Superseded by:** ADR-012

## Context

`.project/manifest.yaml` остаётся основным машиночитаемым источником путей проекта, но его текущая schema не объявляет два реально используемых Harness-артефакта: каталог ADR и projection lifecycle-статусов REQ. Они нужны Sidebar Explorer (REQ-002) и будущему STEP File Editor (REQ-003).

STEP-006 локализовал вывод каталога ADR в `deriveAdrDir`, а STEP-015 добавил аналогичный `deriveReqStatusPath`. Оба пути выводятся от ближайшего обязательного `sources.*`-пути manifest. Это повторяемый архитектурный приём, но ADR-001 разрешал только exact manifest fields и запрещал derivation, поэтому фактический код расходится с действующим решением.

`.project/manifest.yaml` относится к `ownership.shared` в `.project/harness-update.toml`: Harness поставляет schema, а project-specific значения участвуют в 3-way merge. Это не разрешает проекту самостоятельно расширять schema неизвестными upstream ключами — такой ключ создал бы локальный fork контракта и риск конфликтов при `UPDATE HARNESS`.

## Problem

Нужно поддержать доказанные schema gaps, не превращая их в распределённый hardcode, filesystem probing или второй независимый topology source. Правило должно:

- одинаково работать для Explorer, watcher-ов и будущего Editor;
- иметь однозначный precedence при будущем расширении upstream manifest;
- не читать stale artifact при ошибке authoritative path;
- деградировать локально, если необязательный артефакт отсутствует;
- оставаться ограниченным поддерживаемой manifest schema/generation.

## Decision

Пути Harness-артефактов резолвятся по именованному artifact ID через единый neutral resolver/registry в Parser/path-resolution boundary. Consumer получает готовый workspace-relative path и не вычисляет его самостоятельно.

Precedence для каждого artifact ID:

1. **Schema-known explicit manifest field**, если поддерживаемая schema объявляет его.
2. **Зарегистрированная deterministic derivation**, только если для artifact ID существует allowlisted правило, применимое к текущей manifest schema/generation.
3. **Artifact unavailable**, если ни один предыдущий источник неприменим.

Для `harness.version: "1"` разрешены ровно два текущих compatibility rules:

| Artifact ID | Manifest anchor | Derivation | Ожидаемый тип |
|---|---|---|---|
| `adrDirectory` | `sources.architecture` | `join(dirname(sources.architecture), "adr")` | каталог |
| `requirementsStatus` | `sources.requirements` | `join(dirname(sources.requirements), "STATUS.md")` | файл |

Derivation не является общим fallback-механизмом. Запрещены перебор альтернативных имён, recursive filesystem search, догадки по текущей рабочей директории и global default вне registry. Для неподдерживаемой manifest generation путь не угадывается.

Explicit field authoritative. Если он присутствует, но target отсутствует, имеет неверный тип или не читается, resolver/consumer не откатывается к derived candidate: такой fallback мог бы незаметно прочитать stale artifact по прежнему layout.

Перед использованием target проверяется на существование и ожидаемый тип. Сбой затрагивает только зависимую возможность:

- недоступный `adrDirectory` означает отсутствие ADR nodes и ADR autocomplete; `architecture.md` и остальные группы продолжают работать;
- недоступный `requirementsStatus` не удаляет REQ nodes из `SPEC.md`, но их lifecycle-status остаётся пустым; запрещён fallback к удалённому полю `SPEC.md` или `sources.status`, потому что `sources.status` указывает на STEP projection `planning/STATUS.md`.

До реализации neutral resolver текущие `deriveAdrDir` и `deriveReqStatusPath` являются локализованной реализацией этих двух правил. `FIX STEP-015` обязан вынести правила в общую Parser/path-resolution surface либо создать отдельный corrective STEP, если такой refactor не помещается в его Mutation policy. STEP-007 использует только эту общую surface и не добавляет собственную derivation.

## Alternatives considered

### Вариант A — только explicit fields после upstream expansion

Наиболее чисто сохраняет исходную идею ADR-001 и является желаемым долгосрочным направлением. Текущий upstream manifest, однако, не содержит нужных полей; изменение требует отдельного Harness release/update и сейчас не разблокирует STEP-015. Будущее schema-known поле поддерживается первым уровнем выбранного precedence.

### Вариант B — project-owned override в `.project/harness-config.json`

Позволяет задавать произвольный layout без upstream release, но создаёт второй topology source, смешивает UI settings расширения с Harness protocol paths и требует новых schema, watcher, path-containment и migration contracts. Вариант отклонён до появления доказанного продуктового требования на пользовательский override.

### Вариант C — fixed defaults или filesystem probing

Прост в краткосрочной реализации, но не имеет schema/generation boundary, скрывает ошибки layout и может выбрать неожиданный или stale artifact. Вариант отклонён.

### Вариант D — allowlisted derivation от manifest anchors (выбрано)

Разблокирует оба текущих gap без локального расширения manifest, сохраняет переносимость при relocation anchor и ограничивает layout knowledge одним registry. Цена — два suffix convention остаются compatibility knowledge до появления explicit upstream fields.

## Consequences

Положительные последствия:

- Explorer, watcher-ы и Editor используют один контракт без копирования `dirname + suffix`;
- текущий layout работает без data migration и без изменения `.project/manifest.yaml`;
- перенос `sources.architecture` или `sources.requirements` вместе с дочерними артефактами сохраняет работоспособность;
- будущий explicit manifest field получает приоритет без изменения consumer API.

Ограничения:

- rename или non-sibling layout derived artifact не поддерживается без нового зарегистрированного правила либо explicit upstream field;
- registry необходимо версионировать по поддерживаемой manifest schema/generation;
- до выполнения handoff `FIX STEP-015` реализация остаётся Explorer-specific и ещё не соответствует целевой ownership boundary.

## Security implications

Решение не добавляет произвольные пользовательские path values и не выполняет broad filesystem scan: suffix каждого правила константен, а anchor приходит из уже доверенной manifest boundary. Derived target, как и explicit manifest target, должен оставаться workspace-relative и использоваться только внутри workspace. Общая проверка безопасности самих manifest paths не расширяется этим ADR и остаётся отдельной обязанностью Parser/filesystem boundary.

## Data / migration implications

Data migration отсутствует: существующие файлы не перемещаются, manifest и `.project/harness-config.json` не меняются. Требуется code migration к единому resolver, выполняемая после этого ADR отдельным `FIX STEP-015` либо corrective STEP.

## Compatibility / operational implications

Старые проекты поколения `harness.version: "1"` используют два allowlisted compatibility rules. Если будущий Harness release добавит schema-known `adrDirectory` или `requirementsStatus`, расширение после поддержки новой schema использует explicit field и не применяет derivation для этого artifact ID. Отсутствующий или повреждённый authoritative target приводит к локальной деградации, а не к fallback на старый layout.

## Traceability

- REQ: REQ-002, REQ-003
- STEP: STEP-006, STEP-007, STEP-015, STEP-016
