# REQ-002 — Sidebar Explorer артефактов проекта

**Приоритет:** Высокий
**Источник:** brief

## Requirement

Пользователь видит иерархическое дерево всех артефактов проекта (Project Configuration, Requirements, Architecture, Tasks, Roadmap, Status, Reviews, Skills) с индикацией статуса каждого STEP по всем реальным статусам протокола (`Запланировано/В работе/Выполнено/Заблокировано/Отменено/Заменено`), может фильтровать по статусу/типу/приоритету/risk flags и искать по ID, а клик по узлу открывает соответствующий файл.

## Rationale

Без дерева пользователь вынужден вручную обходить файловую структуру `docs/`/`planning/`, чтобы понять состояние проекта.

## Acceptance

- Дерево строится через единый resolver ADR-005: из explicit путей manifest, а для schema gaps — только из централизованных зарегистрированных derivations от manifest anchors; consumer-level hardcode и filesystem search запрещены.
- Иконки статусов соответствуют ровно тому набору статусов, который определён в execution protocol; набор читается из протокола, а не хардкодится.
- Explorer загружается за <500ms на проекте с 50 артефактами (lazy loading по группам).
- Фильтры по Status/Type/Priority/Risk flags и поиск по ID работают одновременно (комбинируются).

## Traceability

- STEP: STEP-006, STEP-015, STEP-016, STEP-024
- ADR: ADR-005
