import * as path from 'node:path';
import * as vscode from 'vscode';
import { DICTIONARIES, Language, readHarnessConfig, resolveLanguage, translate, writeHarnessConfig } from './i18n';

export interface I18nService {
  t(key: string, params?: Record<string, string>): string;
  getLanguage(): Language;
  readonly onDidChangeLanguage: vscode.Event<Language>;
}

let singleton: I18nService | undefined;

/** Для потребителей из STEP-005/STEP-010; вызов до `activateI18n()` — программная ошибка порядка активации. */
export function getI18nService(): I18nService {
  if (!singleton) {
    throw new Error('getI18nService() вызван до activateI18n()');
  }
  return singleton;
}

function resolveConfigPath(): string | undefined {
  const folder = vscode.workspace.workspaceFolders?.[0];
  // Settings находятся рядом с current control-plane, но не влияют на его topology.
  return folder ? path.join(folder.uri.fsPath, '.harness', 'harness-config.json') : undefined;
}

export async function activateI18n(context: vscode.ExtensionContext): Promise<I18nService> {
  const configPath = resolveConfigPath();
  let currentLanguage = resolveLanguage(vscode.env.language, undefined);
  const emitter = new vscode.EventEmitter<Language>();

  const service: I18nService = {
    t: (key, params) => translate(DICTIONARIES, currentLanguage, key, params),
    getLanguage: () => currentLanguage,
    onDidChangeLanguage: emitter.event,
  };

  if (configPath) {
    const stored = await readHarnessConfig(configPath);
    if (stored.ok) {
      currentLanguage = resolveLanguage(vscode.env.language, stored.value.language);
    } else {
      void vscode.window.showWarningMessage(
        service.t('harness.config.readError', { path: configPath, message: stored.error.message })
      );
    }
  }

  const setLanguage = async (language: Language): Promise<void> => {
    currentLanguage = language;
    emitter.fire(language);
    if (!configPath) {
      return;
    }
    const existing = await readHarnessConfig(configPath);
    const base = existing.ok ? existing.value : {};
    const written = await writeHarnessConfig(configPath, { ...base, language });
    if (!written.ok) {
      void vscode.window.showWarningMessage(
        service.t('harness.config.writeError', { path: configPath, message: written.error.message })
      );
    }
  };

  context.subscriptions.push(
    emitter,
    vscode.commands.registerCommand('harness.changeLanguage', async (explicitLanguage?: Language) => {
      if (explicitLanguage === 'ru' || explicitLanguage === 'en') {
        await setLanguage(explicitLanguage);
        return;
      }
      const picked = await vscode.window.showQuickPick(
        [
          { label: service.t('harness.language.ru.label'), language: 'ru' as const },
          { label: service.t('harness.language.en.label'), language: 'en' as const },
        ],
        { placeHolder: service.t('harness.command.changeLanguage.prompt') }
      );
      if (picked) {
        await setLanguage(picked.language);
      }
    })
  );

  singleton = service;
  return service;
}
