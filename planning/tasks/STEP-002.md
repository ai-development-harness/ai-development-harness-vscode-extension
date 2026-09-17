# STEP-002 — Project scaffolding и инструментарий

**Статус:** Запланировано
**Type:** IMPLEMENTATION
**Приоритет:** Критический
**Фаза:** MVP — фундамент
**Depends on:** —

## Requirements

- не требуется для purely technical corrective task

## ADR

- не требуется

## Risk flags

- none

## Goal

Создать рабочий скелет VSCode extension проекта с инструментарием, достаточным для последующей разработки и тестирования.

## Context

Репозиторий после `INIT PROJECT` содержит только Harness protocol layer — никакого product code/tooling ещё нет.

## Scope

- `package.json` (name, VSCode engine — актуальная минимальная версия, не устаревшая `^1.85.0` из исходного ТЗ 2024 года; activation events, `contributes` skeleton).
- Минимальный entry point `src/extension.ts` (no-op `activate`/`deactivate`) — без него Acceptance criterion «Extension Development Host запускается без ошибок активации» физически не проверяем; это не «функциональность» (см. Out of scope), а минимально необходимый скелет.
- `tsconfig.json` в strict mode.
- ESLint **flat config** (`eslint.config.js`) — **исправление task contract**: ESLint 10 (текущая актуальная версия) полностью убрал поддержку `.eslintrc.*`, только flat config. См. Implementation plan.
- esbuild bundling script.
- `.vscode/launch.json` для Extension Development Host.
- Jest конфигурация для unit-тестов.
- `@vscode/test-cli` + `@vscode/test-electron` (Mocha) для integration-тестов (без содержательных тестов пока) — актуальная официально рекомендуемая пара на 2026 год.
- Минимальный project-specific CI workflow (install+lint+build+test), отдельно от `.github/workflows/harness-integrity.yml`.

## Mutation policy

### Allowed

- Создание нового tooling/config в корне и `src/`.

### Conditional

- Изменение `.gitignore` при появлении build artifacts (`dist/`, `out/`) — уже частично покрыто скопированным файлом, требуется проверка достаточности.

### Forbidden

- Product-логика команд/explorer/editor (реализуется последующими STEP).

## Out of scope

- Реализация любой функциональности (parser, commands, explorer и т.д.) — только скелет и инструментарий.

## Acceptance criteria

- `npm install` и сборка проходят без ошибок на чистом клоне.
- Extension Development Host запускается (F5) без ошибок активации.
- Тестовый раннер запускается без ошибок конфигурации (даже с нулевым числом содержательных тестов).
- Линтер запускается без конфигурационных ошибок.

## Verification

- `npm install`
- `npm run build`
- `npm test`
- `npm run lint`

(Точные имена npm-скриптов фиксируются при реализации и переносятся в `docs/development.md` — не хардкодить здесь заранее выдуманные названия сверх типовых.)

## Deliverables

- `package.json`, `src/extension.ts` (no-op stub), `tsconfig.json`, `eslint.config.js`, esbuild-скрипт, `.vscode/launch.json`, Jest config, `.vscode-test.mjs` (конфигурация `@vscode/test-cli`), CI workflow.
- Обновлённый `docs/development.md` (реальные команды вместо TBD).

## Implementation plan

**Plan status:** Planned
**Plan revision:** 1
**Planned at:** 2026-09-17

### Проверенные (не по памяти — `npm view`/официальные источники на дату планирования) версии зависимостей

| Пакет | Версия | Источник/причина |
|---|---|---|
| `typescript` | `^6.0.3` (**не** `7.0.2`, актуальный latest) | `npm view typescript@7.0.2` существует, но TS 7.0 «ships without a stable programmatic API» ([InfoQ](https://www.infoq.com/news/2026/08/typescript-7-released/)) — от него зависят `@typescript-eslint/*` и `ts-jest`. `npm view @typescript-eslint/parser peerDependencies` → `typescript: >=4.8.4 <6.1.0`; `npm view ts-jest peerDependencies` → `typescript: >=4.3 <7`. Связывающее ограничение — `<6.1.0`. Последний стабильный 6.x — `6.0.3`. |
| `@types/vscode` | `^1.138.0` | `npm view @types/vscode version` = `1.138.0`, совпадает с реальным latest VSCode stable на дату планирования ([VS Code 1.138 release notes](https://code.visualstudio.com/updates/v1_138)). |
| `@types/node` | `^22.20.3` | `npm view`, соответствует установленному в этом окружении Node `v22.16.0` (major совпадает). |
| `eslint` | `^10.10.0` | `npm view`; **breaking**: `.eslintrc.*` полностью удалён, только flat config ([ESLint v10.0.0 released](https://eslint.org/blog/2026/02/eslint-v10.0.0-released/), [Migrate to v10.x](https://eslint.org/docs/latest/use/migrate-to-10.0.0)). Требует Node `^20.19.0 \|\| ^22.13.0 \|\| >=24` — совпадает с окружением. |
| `@typescript-eslint/eslint-plugin`, `@typescript-eslint/parser` | `^8.70.0` | `npm view`; ограничивают `typescript` версией (см. выше) — решающий фактор выбора TS 6.x вместо 7.x. |
| `esbuild` | `^0.28.2` | `npm view`; не зависит от `typescript` API (свой парсер, только strip types для bundling) — можно смело брать latest независимо от ограничения typescript-eslint/ts-jest. |
| `jest`, `ts-jest`, `@types/jest` | `^30.5.1`, `^29.4.12`, `^30.0.0` | `npm view`; `ts-jest@29.4.12` совместим и с TS 6.x, и предполагает будущую совместимость с TS 7 (диапазон `<7` для peer, но не жёстче) — но пока фиксируем TS 6.x из-за typescript-eslint. |
| `@vscode/test-cli`, `@vscode/test-electron`, `mocha`, `@types/mocha` | `^0.0.15`, `^3.1.0`, `^12.0.1`, `^10.0.10` | `npm view`; связка `@vscode/test-cli` + `@vscode/test-electron` + Mocha подтверждена как текущая официально рекомендуемая («Quick Setup (Recommended)») в [VS Code extension testing guide](https://code.visualstudio.com/api/working-with-extensions/testing-extension) на дату планирования. `@vscode/test-cli` всё ещё pre-1.0 (`0.0.15`) — принимается как риск (см. Risks), альтернатива (прямой API `@vscode/test-electron` без `test-cli`) держится в уме, не реализуется без необходимости. |
| `@vscode/vsce` | `^4.0.0` | `npm view`; нужен только в STEP-013 (packaging), но версия зафиксирована здесь для консистентности `package.json` devDependencies с самого начала. |

**Task-contract correction (см. также обновлённые Scope/Deliverables выше):** исходный STEP-002 (как и раздел 3.2 исходного артефакта-ТЗ) называл `.eslintrc` — на актуальной версии ESLint (10.x) это гарантированно не работает; заменено на `eslint.config.js`.

### `engines.vscode`

Не хардкодить `^1.85.0` (устарело на ~2 года относительно реального latest `1.138`). Точную минимальную версию зафиксировать при IMPLEMENT после быстрой проверки, с какой версии стабильны конкретно нужные API (`TreeDataProvider`, `CodeLensProvider`, `HoverProvider`, `CompletionItemProvider` — стабильны уже много лет; `terminal.shellIntegration`/`onDidEndTerminalShellExecution`, нужные для STEP-009 — появились позже, ориентировочно нужно не старше `^1.93.0`, проверить точно при IMPLEMENT STEP-009, но `engines.vscode` в `package.json` выставить сразу с запасом, не только под STEP-002).

### Структура (создаётся этим STEP)

```text
package.json
tsconfig.json
eslint.config.js
esbuild.config.mjs          # production build + watch mode
jest.config.mjs
.vscode-test.mjs            # конфигурация @vscode/test-cli
.vscode/launch.json
.nvmrc                      # "22" — закрепить major Node для контрибьюторов
src/
  extension.ts              # no-op activate()/deactivate(), main entry point
tests/
  unit/.gitkeep              # unit-тесты появятся вместе с STEP-003+ (Jest)
  integration/extension.test.ts  # один тривиальный smoke-тест (activate без ошибок)
.github/workflows/ci.yml    # install → lint → typecheck → build → test, отдельно от harness-integrity.yml
```

### npm scripts (фиксируются здесь, переносятся в `docs/development.md` при IMPLEMENT)

| Script | Команда | Назначение |
|---|---|---|
| `compile` | `tsc --noEmit` | Только typecheck (эмит делает esbuild). |
| `build` | `node esbuild.config.mjs` | Production bundle → `dist/extension.js`. |
| `watch` | `node esbuild.config.mjs --watch` | Dev-режим. |
| `lint` | `eslint src` | Flat config подхватывается автоматически. |
| `test` | `jest` | Unit-тесты. |
| `test:integration` | `vscode-test` (через `@vscode/test-cli`, конфиг `.vscode-test.mjs`) | Extension Host integration-тесты. |
| `vscode:prepublish` | `npm run build` | Стандартный VSCode-хук перед `vsce package`/publish. |
| `package` | `vsce package` | STEP-013, но script фиксируется сразу для консистентности. |

### Impacted areas / data-API implications

Все файлы — новые, ничего не конфликтует с уже существующим protocol layer (`.agents/`, `.codex/`, `.project/`, `planning/`, `docs/` не трогаются, кроме `docs/development.md`). Production-логика (parser/commands/explorer/editor) не создаётся — только скелет и один no-op entry point.

### Test strategy / Verification sequence

1. `npm install` на чистом клоне (без `node_modules`) — должен пройти без peer-dependency conflicts (версии выше подобраны совместимыми; при конфликте — типичная причина: кто-то по памяти поставил `typescript@latest` вместо `^6.0.3`).
2. `npm run compile` — `tsc --noEmit` без ошибок (strict mode, пустой `src/extension.ts` с корректными типами `vscode.ExtensionContext`).
3. `npm run lint` — 0 ошибок/warnings на новых файлах.
4. `npm run build` — esbuild создаёт `dist/extension.js`.
5. `npm test` — Jest запускается и завершается успешно (0 содержательных тестов на этом этапе — это ожидаемо, не ошибка).
6. `npm run test:integration` — Extension Development Host поднимается, no-op `activate()` не бросает исключений (один smoke-тест).
7. F5 в VSCode (Extension Development Host) — ручная проверка, что окно открывается без Developer Tools ошибок активации.
8. CI (`.github/workflows/ci.yml`) проходит все вышеперечисленные шаги на push/PR.

### Risks / rollback

- Риск: `@vscode/test-cli@0.0.15` — pre-1.0, возможны breaking changes в будущих версиях. Митигация: зафиксировать точную версию (`0.0.15`, не `^0.0.15` — pre-1.0 semver не даёт реальных гарантий совместимости даже на patch), обновлять осознанно отдельным STEP, не автоматически.
- Риск: TypeScript 7.0 всё равно станет обязательным, когда экосистема (`typescript-eslint`, `ts-jest`) добавит поддержку — тогда потребуется отдельный upgrade STEP (не STEP-002 задним числом). Зафиксировать как известный technical debt в `docs/architecture.md` после IMPLEMENT.
- Риск: реальный `engines.vscode` может конфликтовать с версией VSCode, установленной у конкретного контрибьютора/CI. Митигация: CI использует свежий `@vscode/test-electron` download (тянет актуальный стабильный VSCode), несовпадение обнаружится сразу в CI, а не в проде.
- Rollback: весь STEP — новые файлы, откат тривиален (`git revert`), никакого product-state не затрагивается.

### Handoff

По завершении: `IMPLEMENT STEP-002`.

## Evidence

Заполняется по факту реализации и verification.

## Review status

**Latest verdict:** NOT REVIEWED
**Latest report:** —

## Blocker / Failure reason

—
