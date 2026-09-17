# ADR-002 — STEP/REQ/ADR-файлы парсятся как labeled markdown-секции, не YAML frontmatter

**Status:** Accepted
**Date:** 2026-09-17
**Deciders:** initializer (INIT PROJECT)
**Supersedes:** —
**Superseded by:** —

## Context

Исходный артефакт-ТЗ предполагал YAML frontmatter в `STEP-NNN.md` и custom language mode по расширению `.step.md`. Реальный `planning/tasks/TEMPLATE.md` не содержит frontmatter вообще: поля — жирные inline-метки в теле markdown (`**Статус:**`, `**Type:**`, `**Приоритет:**`, `**Фаза:**`, `**Depends on:**`), файл имеет обычное имя `STEP-NNN.md`. Аналогично устроены `docs/requirements/TEMPLATE.md` (`REQ-NNN`) и `docs/adr/TEMPLATE.md` (`ADR-NNN`, хотя там уже есть похожие на frontmatter поля `**Status:**`/`**Date:**` — тоже bold-метки, не YAML).

## Problem

Парсер, спроектированный под YAML frontmatter, не будет находить поля вообще ни в одном реальном файле протокола; custom language, зарегистрированный по расширению `.step.md`, не активируется ни на одном реальном файле (`STEP-NNN.md` — расширение `.md`).

## Decision

1. Парсер задач/требований/решений извлекает поля по regex/markdown-AST над секциями и bold-метками конкретного шаблона (`## <Section>` заголовки + `**Label:** value` строки), а не через YAML frontmatter парсер.
2. Custom language mode (`harness-step`) регистрируется в `package.json` через `filenames`/`pattern`-glob `planning/tasks/STEP-*.md`, а не через `fileExtensions`.
3. При изменении реального шаблона (`planning/tasks/TEMPLATE.md` и т.п.) в будущем релизе Harness парсер должен деградировать (пропустить нераспознанное поле с warning), а не падать — это тестируется unit-тестами на реальных TEMPLATE.md файлах, скопированных как fixtures.

## Alternatives considered

### Вариант A — YAML frontmatter (как в исходном ТЗ)

Стандартный подход для многих VSCode-расширений, но требует миграции формата всех существующих Harness-проектов — вне полномочий этого плагина (протокол read-only для плагина).

### Вариант B — Парсинг существующего labeled-markdown формата (выбрано)

Соответствует реальному протоколу без миграций; чуть более хрупкий парсер (текстовые метки вместо структурированного YAML), компенсируется fixture-тестами на реальных TEMPLATE.md.

## Consequences

Плюсы: работает на реальных проектах без изменения протокола. Минусы: парсер чувствительнее к точной формулировке меток (`**Статус:**` vs `**Status:**` — шаблоны сейчас смешивают RU/EN лейблы); необходимо покрыть оба варианта или зафиксировать, что метки полей всегда на языке `language.documentation` проекта.

## Security implications

Не применимо.

## Data / migration implications

Не применимо — формат файлов не меняется, только способ чтения.

## Compatibility / operational implications

Любое будущее `UPDATE HARNESS`, меняющее `planning/tasks/TEMPLATE.md`/`docs/requirements/TEMPLATE.md`/`docs/adr/TEMPLATE.md`, потенциально ломает парсер полей — покрывается STEP-003 fixture-тестами и регресс-проверкой при `UPDATE HARNESS` (вне MVP-скоупа этого плагина, см. REQ out-of-scope).

## Traceability

- REQ: REQ-003
- STEP: STEP-003, STEP-007
