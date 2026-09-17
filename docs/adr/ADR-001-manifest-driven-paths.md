# ADR-001 — Все пути протокола читаются из `.project/manifest.yaml`, а не хардкодятся

**Status:** Accepted
**Date:** 2026-09-17
**Deciders:** initializer (INIT PROJECT)
**Supersedes:** —
**Superseded by:** —

## Context

Исходный артефакт-ТЗ предполагал, что плагин ищет `EXECUTION_PROTOCOL.md` по одному из двух хардкод-путей (`.project/` или `docs/harness/`). Реальный `ai-development-harness-template` хранит его в `planning/EXECUTION_PROTOCOL.md`, и этот путь (наравне с `taskDirectory`, `reviewDirectory`, `auditDirectory`, `roadmap`, `status` и др.) уже объявлен машиночитаемо в `.project/manifest.yaml → protocol.*` и `sources.*`.

## Problem

Хардкод директорий делает парсер плагина хрупким к любому будущему изменению структуры репозитория (в том числе через `UPDATE HARNESS`) и дублирует информацию, которая уже есть в манифесте.

## Decision

Все файловые пути, необходимые парсеру и командному слою плагина (`protocol.file`, `protocol.taskDirectory`, `protocol.reviewDirectory`, `protocol.auditDirectory`, `protocol.skillSearchDirectory`, `protocol.skillRegistry`, `protocol.harnessUpdateDirectory`, `sources.*`, `repository.*`), плагин читает из `.project/manifest.yaml` конкретного проекта при активации. Хардкод-путей и угадывания директорий по двум-трём вариантам — нет.

## Alternatives considered

### Вариант A — хардкод стандартных путей (как в исходном ТЗ)

Проще в реализации, но ломается при любом отклонении структуры проекта от momentary snapshot шаблона и противоречит самому назначению манифеста.

### Вариант B — манифест как единственный источник путей (выбрано)

Требует парсера YAML на старте активации, но устойчиво к эволюции протокола и корректно по духу Harness (`.project/manifest.yaml` — заявленный единый источник этой информации).

## Consequences

Плюсы: устойчивость к структурным изменениям, отсутствие дублирования. Минусы: если манифест отсутствует или повреждён, плагин не может определить пути вообще — требуется явная обработка этого случая (сообщение «не похоже на Harness-проект», а не молчаливый fallback на угаданные пути).

## Security implications

Не применимо.

## Data / migration implications

Не применимо.

## Compatibility / operational implications

При `UPDATE HARNESS`, меняющем состав манифеста (новая версия схемы), парсер должен деградировать по известным полям, а не падать целиком — отдельный STEP при появлении такой необходимости.

## Traceability

- REQ: REQ-001, REQ-002, REQ-003
- STEP: STEP-003
