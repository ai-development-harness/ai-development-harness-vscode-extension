import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { Result, ok, err } from '../parser/types';
import ruDictionary from './ru.json';
import enDictionary from './en.json';

/**
 * REQ-006: RU default, EN, автоопределение по `vscode.env.language`, ручное
 * переключение через `harness.changeLanguage`, персист в
 * `.harness/harness-config.json`. Этот путь — фиксированный extension-owned
 * settings-файл вне ADR-001 (не Harness-протокольный артефакт из манифеста),
 * поэтому отсутствие файла — ожидаемое первое включение (`ok({})`), а не
 * `NotFound`-ошибка, как для обязательного `manifest.yaml` в `yamlParser.ts`.
 *
 * Чистый слой без импорта `vscode` — только так модуль резолвится в Jest
 * (`testEnvironment: 'node'` не предоставляет `vscode`); vscode-обёртка
 * (`activateI18n`, регистрация команды) вынесена в `activation.ts`.
 */

export type Language = 'ru' | 'en';

/**
 * FIX STEP-004 (F-001 Reviewer 2 / F-002 Reviewer 1, REVIEW-2026-09-17T2200):
 * поля, не известные текущей схеме, должны round-trip'иться через
 * read→merge→write без потерь — индексная сигнатура и вся логика
 * `readHarnessConfig` ниже это гарантируют.
 */
export interface HarnessConfig {
  language?: Language;
  [key: string]: unknown;
}

export type ConfigError =
  | { kind: 'invalid-json'; path: string; message: string }
  | { kind: 'write-failed'; path: string; message: string };

export const DICTIONARIES: Record<Language, Record<string, string>> = {
  ru: ruDictionary,
  en: enDictionary,
};

export function resolveLanguage(envLanguage: string, stored: Language | undefined): Language {
  if (stored === 'ru' || stored === 'en') {
    return stored;
  }
  return envLanguage.toLowerCase().startsWith('en') ? 'en' : 'ru';
}

/**
 * RU — authoritative словарь: EN → RU → сам ключ, без исключений на любом пути.
 * FIX STEP-004 (F-001, REVIEW-2026-09-17T2200): опциональный `params` для
 * сообщений с динамическими данными (например путь/текст ошибки) — без
 * этого `activation.ts` был вынужден хардкодить такие сообщения в обход
 * сервиса, что нарушало собственный Forbidden этого STEP.
 */
export function translate(
  dictionaries: Record<Language, Record<string, string>>,
  lang: Language,
  key: string,
  params?: Record<string, string>
): string {
  const direct = dictionaries[lang]?.[key];
  const template =
    direct !== undefined ? direct : lang !== 'ru' ? dictionaries.ru?.[key] : undefined;
  if (template === undefined) {
    return key;
  }
  if (!params) {
    return template;
  }
  return template.replace(/\{(\w+)\}/g, (placeholder, name: string) =>
    Object.prototype.hasOwnProperty.call(params, name) ? params[name] : placeholder
  );
}

export async function readHarnessConfig(configPath: string): Promise<Result<HarnessConfig, ConfigError>> {
  let raw: string;
  try {
    raw = await fs.readFile(configPath, 'utf8');
  } catch {
    return ok({});
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    return err({
      kind: 'invalid-json',
      path: configPath,
      message: error instanceof Error ? error.message : String(error),
    });
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return ok({});
  }

  // Все поля, кроме `language`, — неизвестная текущей схеме, но легитимная
  // будущая настройка (см. HarnessConfig doc-comment) — сохраняются как есть,
  // не только валидированный `language`.
  const config: HarnessConfig = { ...(parsed as Record<string, unknown>) };
  if (config.language !== 'ru' && config.language !== 'en') {
    delete config.language;
  }
  return ok(config);
}

export async function writeHarnessConfig(
  configPath: string,
  config: HarnessConfig
): Promise<Result<void, ConfigError>> {
  try {
    await fs.mkdir(path.dirname(configPath), { recursive: true });
    await fs.writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
    return ok(undefined);
  } catch (error) {
    return err({
      kind: 'write-failed',
      path: configPath,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
