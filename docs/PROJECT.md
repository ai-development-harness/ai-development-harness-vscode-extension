# Project

> Этот файл заполняется `INIT PROJECT` на основании `PROJECT_BRIEF.local.md`.

## Название

AI Development Harness Navigator (harness-navigator)

## Краткое описание

VSCode extension, превращающая текстовый редактор в IDE-слой над AI Development Harness: командную палитру для канонических команд протокола, дерево артефактов (REQ/ADR/STEP/PLAN/STATUS/Skills), smart-редактор STEP-файлов с валидацией и навигацией, status bar с состоянием проекта и интеграцию с агентом для выполнения команд.

## Проблема и цель

Ручная работа с Harness (помнить синтаксис команд, вручную проверять dependencies/mutation policy, копировать контекст агенту) создаёт трение и риск нарушения протокола. Цель — UI-слой, который не даёт нарушить протокол (INIT guard, dependency gate, mutation policy) и убирает необходимость помнить синтаксис/копипастить контекст.

## Пользователи / участники

- Разработчики, работающие с проектами на базе `ai-development-harness-template`.
- Одиночные разработчики и небольшие команды (2–5 человек).
- Пользователи Claude Code / Codex CLI как исполнителя протокола.

## Ключевые сценарии

1. Command Palette: 11 MVP-команд (`INIT PROJECT`, `ADD STEP`, `PLAN STEP-NNN`, `IMPLEMENT STEP-NNN`, `REVIEW STEP-NNN`, `FIX STEP-NNN`, `RUN STEP-NNN`, `NEXT STEP`, `STATUS PROJECT`, `QUICK FIX`, `RECONCILE PROJECT`) с pre-flight валидацией перед dispatch.
2. Sidebar Explorer — дерево артефактов проекта с фильтрами и статус-иконками.
3. STEP File Editor — валидация, code lens, hover, autocomplete, quick actions на реальном формате STEP-файлов (labeled markdown, без frontmatter).
4. Status Bar — состояние инициализации, прогресс, next command, health-warnings.
5. Terminal Integration — сборка контекста и передача агенту для выполнения команды (механизм вызова — открытый вопрос, см. `docs/OPEN_QUESTIONS.md` OQ-001 и `STEP-001`).
6. Локализация UI: RU (default) + EN, с fallback.

Phase 2 (после MVP, не в текущем roadmap): dependency graph visualization, health dashboard, mutation policy enforcement warnings, keyboard shortcuts.

## Границы продукта

### In scope

- 11 MVP-команд из `docs/requirements/SPEC.md` (REQ-001..REQ-006) поверх проектов, следующих структуре `ai-development-harness-template`.
- Чтение путей протокола из `.project/manifest.yaml` (не хардкод директорий).
- RU (default) + EN локализация с graceful fallback.

### Out of scope (MVP)

- Остальные 13 команд полного протокола (`FIND/INSTALL/CREATE SKILL`, `GENERATE GITHUB TEMPLATES`, `AUDIT STEP-NNN`, `RELEASE CHECK`, `CHECK/UPDATE HARNESS`, `GIT CHECK`, `COMMIT`, `PUSH`, `PR`, `SYNC`) — см. `ADR-003`.
- Dependency graph visualization, Health dashboard, Mutation policy enforcement warnings, Keyboard shortcuts — Phase 2, деферред REQ.
- Team-функции (assign reviewer, permissions), cloud sync, телеметрия.
- Модификация `EXECUTION_PROTOCOL.md` из плагина.
- Нестандартная структура репозитория (не по `ai-development-harness-template`), другие VCS, web/mobile версии.

## Ограничения

- VSCode 1.85+, Electron only (без web-версии).
- TypeScript strict mode, npm, esbuild bundling.
- Offline-first, git-only; без cloud sync и телеметрии.
- Read-only доступ к `EXECUTION_PROTOCOL.md`.

## Нефункциональные ожидания

- Sidebar explorer: <500ms на проекте с 50 артефактами.
- Открытие STEP-файла (parse + validate): <200ms.
- Command dispatch (pre-flight checks): <100ms.
- Обновление status bar: <50ms, батчинг не чаще раза в секунду.
- Unit test coverage >80%.
- Локализация RU/EN с graceful fallback без падений при отсутствующем переводе.

## Референсы и внешние источники

- `ai-development-harness-template` (соседний репозиторий в этом monorepo) — источник структуры проекта, `planning/EXECUTION_PROTOCOL.md`, `docs/harness/COMMANDS.md` (полный список из 24 команд), skill-файлов.
- `https://ai-development-harness.ru/` — обзор системы, getting started guide.
- Исходный артефакт-ТЗ (`harness-navigator-tz.md`) и его ревизия против реального шаблона — `TZ_REVIEW_AND_PLAN.md` в этом репозитории.

## Основные риски и неопределённости

См. `docs/OPEN_QUESTIONS.md`.
