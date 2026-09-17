import * as path from 'node:path';
import { readFile } from 'node:fs/promises';
import * as vscode from 'vscode';
import type { I18nService } from '../locales/activation';
import { parseStepFile } from '../parser/markdownParser';
import { ManifestData, StepData } from '../parser/types';

export interface StepFileEntry {
  readonly uri: vscode.Uri;
  readonly data: StepData;
}

/**
 * `protocol.taskDirectory` из манифеста — единственный источник пути (ADR-001),
 * не хардкод `planning/tasks`. Нечитаемый/неразбираемый отдельный файл —
 * пропускается, не роняет весь список (та же деградация, что и в Parser layer).
 */
export async function listStepFiles(workspaceRoot: string, manifest: ManifestData): Promise<StepFileEntry[]> {
  // FIX STEP-005 (F-002): glob для `findFiles` — всегда POSIX-стиль (`/`),
  // независимо от ОС; `path.join` на Windows дал бы `\`, который в
  // glob-паттерне не эквивалентен разделителю пути.
  const pattern = new vscode.RelativePattern(
    workspaceRoot,
    path.posix.join(manifest.protocol.taskDirectory, 'STEP-*.md')
  );
  const uris = await vscode.workspace.findFiles(pattern);
  const entries: StepFileEntry[] = [];
  for (const uri of uris) {
    try {
      const content = await readFile(uri.fsPath, 'utf8');
      const parsed = parseStepFile(content);
      if (parsed.ok) {
        entries.push({ uri, data: parsed.value.data });
      }
    } catch {
      // нечитаемый файл — пропуск, не падение всего списка
    }
  }
  return entries;
}

export async function pickStep(
  entries: StepFileEntry[],
  i18n: I18nService,
  protocolName: string
): Promise<StepFileEntry | undefined> {
  const items = entries
    .slice()
    .sort((a, b) => a.data.id.localeCompare(b.data.id, undefined, { numeric: true }))
    .map((entry) => ({
      label: `${entry.data.id} — ${entry.data.title}`,
      description: entry.data.status,
      entry,
    }));
  const picked = await vscode.window.showQuickPick(items, {
    placeHolder: i18n.t('harness.command.stepPicker.prompt', { command: protocolName }),
  });
  return picked?.entry;
}
