# Requirements Specification

> Канонический реестр продуктовых требований. `REQ` описывает **что система обязана обеспечивать**, а не способ реализации.

## Правила

- ID стабилен и не переиспользуется: `REQ-001`, `REQ-002`, ...
- Требование должно быть проверяемым.
- Техническая задача сама по себе не требует отдельного REQ.
- Implementation detail не маскируй под product requirement.
- При изменении смысла requirement обновляй traceability и roadmap.

## Статусы

- `Запланировано`
- `Частично`
- `Выполнено`
- `Отложено`
- `Отменено`

Текущее значение статуса каждого REQ хранится только в `STATUS.md`.

## Требования

### REQ-001 — Command Palette с канонической командной поверхностью

**Приоритет:** Критический
**Источник:** brief

#### Requirement

Пользователь может выполнить 11 MVP-команд Harness (`INIT PROJECT`, `ADD STEP`, `PLAN STEP-NNN`, `IMPLEMENT STEP-NNN`, `REVIEW STEP-NNN`, `FIX STEP-NNN`, `RUN STEP-NNN`, `NEXT STEP`, `STATUS PROJECT`, `QUICK FIX`, `RECONCILE PROJECT`) через Command Palette VSCode. Перед выполнением каждой команды система обязана проверить: `project.initialized` (INIT guard), unmet hard dependencies выбранного STEP, границы mutation policy текущего STEP — и заблокировать dispatch с понятным объяснением при нарушении любого из условий.

#### Rationale

Ручной ввод команд протокола и ручная проверка dependencies/mutation policy — источник ошибок; UI должен физически не позволять нарушить protocol invariants.

#### Acceptance

- Все 11 команд доступны через Command Palette и видимы в ней под префиксом `harness:`.
- Попытка выполнить mutating-команду при `project.initialized: false` блокируется с объяснением и ссылкой на `INIT PROJECT`.
- Попытка выполнить команду над STEP с невыполненной hard dependency блокируется с указанием конкретного blocking STEP.
- Результат выполнения (изменённые файлы, next command, ошибки) отображается пользователю и не требует ручного открытия файлов для проверки успеха.

#### Traceability

- STEP: STEP-005
- ADR: ADR-003

---

### REQ-002 — Sidebar Explorer артефактов проекта

**Приоритет:** Высокий
**Источник:** brief

#### Requirement

Пользователь видит иерархическое дерево всех артефактов проекта (Project Configuration, Requirements, Architecture, Tasks, Roadmap, Status, Reviews, Skills) с индикацией статуса каждого STEP по всем реальным статусам протокола (`Запланировано/В работе/Выполнено/Заблокировано/Отменено/Заменено`), может фильтровать по статусу/типу/приоритету/risk flags и искать по ID, а клик по узлу открывает соответствующий файл.

#### Rationale

Без дерева пользователь вынужден вручную обходить файловую структуру `docs/`/`planning/`, чтобы понять состояние проекта.

#### Acceptance

- Дерево строится через единый resolver ADR-005: из explicit путей `.project/manifest.yaml`, а для schema gaps — только из централизованных зарегистрированных derivations от manifest anchors; consumer-level hardcode и filesystem search запрещены.
- Иконки статусов соответствуют ровно тому набору статусов, который определён в `planning/EXECUTION_PROTOCOL.md` (§3) — на момент правки это шесть значений; набор читается из протокола, а не хардкодится (коррекция `PLAN STEP-006` 2026-09-18: исходная формулировка «ровно пяти» противоречила §3 протокола, где определено шесть статусов, включая `Заменено`).
- Explorer загружается за <500ms на проекте с 50 артефактами (lazy loading по группам).
- Фильтры по Status/Type/Priority/Risk flags и поиск по ID работают одновременно (комбинируются).

#### Traceability

- STEP: STEP-006, STEP-015, STEP-016
- ADR: ADR-005

---

### REQ-003 — Smart-редактор STEP-файлов

**Приоритет:** Высокий
**Источник:** brief

#### Requirement

При открытии `planning/tasks/STEP-NNN.md` пользователь получает: подсветку синтаксиса полей и ссылок (`REQ-NNN`/`STEP-NNN`/`ADR-NNN`), inline-диагностику (пустые обязательные поля, битые ссылки, недостижимые/циклические dependencies, попытка расширить `Out of scope`), кликабельные code lens на связанные REQ/ADR/PLAN, autocomplete по существующим ID и quick actions (mark acceptance criterion, request review, flag blocker, create follow-up STEP).

#### Rationale

STEP-файл — контракт STEP; ошибки в нём (битые ссылки, нарушение mutation policy) должны быть видны сразу, а не обнаруживаться агентом постфактум.

#### Acceptance

- Custom language активируется по glob `STEP-*.md` (реальный формат — labeled markdown без YAML frontmatter).
- Диагностика не блокирует редактирование (только предупреждения/ошибки, редактирование доступно всегда).
- Code lens открывает целевой REQ/ADR/секцию PLAN.md по клику.
- Autocomplete предлагает только реально существующие ID из `docs/requirements/`, `docs/adr/`, `planning/tasks/`.

#### Traceability

- STEP: STEP-007, STEP-016
- ADR: ADR-002, ADR-005

---

### REQ-004 — Status Bar с состоянием проекта

**Приоритет:** Средний
**Источник:** brief

#### Requirement

Status bar показывает: статус инициализации проекта, процент завершения roadmap, рекомендуемую следующую команду, количество health-warnings. Клик по каждому элементу выполняет соответствующее действие (открыть manifest/STATUS.md/health report или выполнить предложенную команду). Обновления батчатся и не выполняются на каждое нажатие клавиши.

#### Rationale

Пользователю нужен постоянно видимый индикатор состояния проекта без необходимости открывать STATUS.md вручную.

#### Acceptance

- Элементы видны и корректно отражают текущее состояние манифеста/roadmap.
- Обновление происходит не чаще раза в секунду и не блокирует редактор.
- Клик по каждому элементу выполняет заявленное действие.

#### Traceability

- STEP: STEP-008
- ADR: не требуется

---

### REQ-005 — Terminal Integration с агентом

**Приоритет:** Критический
**Источник:** brief

#### Requirement

При выполнении команды через Command Palette система собирает контекст (`EXECUTION_PROTOCOL.md`, manifest, релевантные STEP/REQ/ADR файлы, git status), передаёт его агенту для выполнения, отображает прогресс и результат в отдельном Output Channel «Harness», автоматически перезагружает изменённые файлы и предлагает следующую команду. При ошибке — три уровня обработки: pre-validation blocker, API/агент-ошибка с retry, runtime-ошибка с graceful recovery без падения.

#### Rationale

Без автоматизации пользователь вручную копирует контекст агенту — то самое трение, которое REQ-001 и общая цель проекта призваны устранить.

#### Acceptance

- Терминальный вывод структурирован и читаем.
- Auto-reload изменённых файлов не сбрасывает фокус редактора.
- Ошибки показываются с понятным объяснением и предложением действия.
- Команду можно прервать (Ctrl+C) без порчи состояния проекта.

#### Traceability

- STEP: STEP-001, STEP-009
- ADR: не требуется (архитектурное решение фиксируется в ADR по итогам STEP-001)

---

### REQ-006 — Локализация UI (RU/EN)

**Приоритет:** Средний
**Источник:** brief

#### Requirement

Весь пользовательский текст (команды, меню, status bar, ошибки с подсказками, hover, диагностика, terminal output, webviews) доступен на русском (default) и английском языках. Язык определяется автоматически по `vscode.env.language`, может быть переключён вручную командой и сохраняется в `.project/harness-config.json`. При отсутствии перевода — fallback на русский, затем на ключ; без падений.

#### Rationale

Требование зафиксировано исходным ТЗ и подтверждено пользователем; RU — язык проекта по умолчанию согласно `.project/manifest.yaml → language`.

#### Acceptance

- Переключение языка обновляет все видимые UI-элементы без перезапуска VSCode.
- Отсутствующий перевод не приводит к ошибке в консоли — тихий fallback на RU, затем на ключ.
- Terminal output и webview-диалоги локализованы наравне с обычным UI.

#### Traceability

- STEP: STEP-004, STEP-010
- ADR: не требуется

---

### REQ-007 — Dependency graph visualization (Phase 2, отложено)

**Приоритет:** Низкий
**Источник:** brief

#### Requirement

Визуализация графа REQ/ADR/STEP с рёбрами зависимостей, критическим путём и блокерами.

#### Rationale

Ценно для проектов с большим roadmap, но не критично для MVP-цикла INIT→PLAN→IMPLEMENT→REVIEW.

#### Acceptance

- TBD — уточнить при переходе в активную разработку; см. `OQ-003` (семантика «soft»/«hard» рёбер не определена протоколом).

#### Traceability

- STEP: не запланирован
- ADR: не требуется

---

### REQ-008 — Health Dashboard (Phase 2, отложено)

**Приоритет:** Низкий
**Источник:** brief

#### Requirement

Webview-панель с агрегированным здоровьем проекта (coverage requirements, ADR clarity, roadmap progress, code↔docs sync, review backlog, риски, рекомендации).

#### Rationale

Полезная агрегирующая функция поверх уже существующих данных explorer/status bar; не блокирует базовый цикл разработки.

#### Acceptance

- TBD — уточнить при переходе в активную разработку.

#### Traceability

- STEP: не запланирован
- ADR: не требуется

---

### REQ-009 — Mutation Policy enforcement warnings (Phase 2, отложено)

**Приоритет:** Низкий
**Источник:** brief

#### Requirement

При редактировании STEP-файла — предупреждение и предложение создать follow-up STEP при попытке расширить `Out of scope` секцию.

#### Rationale

Усиление уже существующей diagnostic-логики REQ-003; отдельный REQ, так как поведение активное (предложение действия), а не пассивная диагностика.

#### Acceptance

- TBD — уточнить при переходе в активную разработку.

#### Traceability

- STEP: не запланирован
- ADR: не требуется

---

### REQ-010 — Keyboard shortcuts (Phase 2, отложено)

**Приоритет:** Низкий
**Источник:** brief

#### Requirement

Настраиваемые keybindings для частых команд (`NEXT STEP`, health report, dependency graph, `STATUS PROJECT`).

#### Rationale

Удобство, не блокирует MVP-цикл.

#### Acceptance

- TBD — уточнить при переходе в активную разработку.

#### Traceability

- STEP: не запланирован
- ADR: не требуется
