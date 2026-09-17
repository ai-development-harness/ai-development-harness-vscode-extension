# Development

## Prerequisites

- Node.js `22.x` (см. `.nvmrc`), npm.
- VSCode `^1.96.0` (см. `engines.vscode` в `package.json`) для Extension Development Host.

## Local setup

```sh
nvm use     # опционально, если используется nvm
npm install
```

## Development commands

| Команда | Назначение |
|---|---|
| `npm run compile` | Typecheck (`tsc --noEmit`), без эмита. |
| `npm run build` | Production bundle → `dist/extension.js` (esbuild). |
| `npm run watch` | esbuild в watch-режиме для разработки. |
| `npm run lint` | ESLint (flat config, `src/**/*.ts`). |
| `npm test` | Unit-тесты (Jest). |
| `npm run test:integration` | Integration-тесты в Extension Host (`@vscode/test-cli` + Mocha). |
| `npm run package` | `vsce package` (используется начиная с STEP-013). |

## Testing

- Unit-тесты: Jest, конфигурация `jest.config.mjs`, файлы `tests/unit/**/*.test.ts`. С STEP-003 покрывают Parser layer (`src/parser/**`) на fixtures — реальных `.project/manifest.yaml`/`TEMPLATE.md`/`SPEC.md`/`EXECUTION_PROTOCOL.md`, скопированных в `tests/fixtures/**`.
- Integration-тесты: Mocha через `@vscode/test-cli`, конфигурация `.vscode-test.mjs`, файлы `tests/integration/**/*.test.js` (JS, не TS — `@vscode/test-cli` не транспилирует TypeScript, поэтому integration-тесты пишутся напрямую в JS, чтобы не вводить отдельный build-шаг только для тестов). Один smoke-тест на STEP-002: активация extension без исключений.

## Lint / formatting / type checking

- `npm run lint` — ESLint 10, flat config (`eslint.config.js`), только `.eslintrc.*` больше не поддерживается этой версией ESLint.
- `npm run compile` — строгий typecheck (`tsconfig.json`, `strict: true`), эмит выполняет отдельно esbuild.

## Build

`npm run build` — esbuild (`esbuild.config.mjs`) бандлит `src/extension.ts` → `dist/extension.js` (CommonJS, `external: ['vscode']`).

## Extension Development Host

`.vscode/launch.json` содержит конфигурацию `Run Extension` (тип `extensionHost`, `--extensionDevelopmentPath=${workspaceFolder}`, `outFiles` на `dist/extension.js`, `preLaunchTask: "npm: build"` — использует auto-detected VSCode npm task). F5 в VSCode пересобирает bundle (`npm run build`) и открывает Extension Development Host с загруженным extension. Автоматический эквивалент той же проверки (без интерактивного UI) — `npm run test:integration`, который поднимает реальный Extension Host и активирует extension.

## Environment / configuration

Нет собственных env-переменных/секретов на этом этапе.

## Database / migrations

Не применимо.

## CI/CD

- `.github/workflows/ci.yml` — project-specific pipeline: install → lint → typecheck → build → unit tests → integration tests (`xvfb-run` для headless Extension Host на Linux runner).
- `.github/workflows/harness-integrity.yml` — отдельный baseline Harness validator, не связан с product tooling.

## Git и CI

Repository Git workflow задаётся `docs/harness/GIT_WORKFLOW.md` и `.project/git-policy.toml`. Harness Integrity CI является baseline; project-specific CI добавляется после определения фактического stack/tooling.
