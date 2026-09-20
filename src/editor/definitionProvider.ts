import * as vscode from 'vscode';
import type { StepEditorIndex } from './validation';

/** Возвращает ссылочный ID точно под курсором, включая дефис в `STEP-NNN`. */
function referenceAtPosition(document: vscode.TextDocument, position: vscode.Position): { id: string; range: vscode.Range } | undefined {
  const line = document.lineAt(position.line).text;
  for (const match of line.matchAll(/\b(?:REQ|STEP|ADR)-\d+\b/g)) {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    if (position.character >= start && position.character <= end) {
      return { id: match[0], range: new vscode.Range(position.line, start, position.line, end) };
    }
  }
  return undefined;
}

/**
 * REQ-003: Definition Provider использует URI, сохранённый при manifest-resolved
 * индексировании. Поэтому Ctrl+Click/F12 не угадывает layout ADR/STEP.
 */
export function createDefinitionProvider(index: () => StepEditorIndex): vscode.DefinitionProvider {
  return {
    async provideDefinition(document, position): Promise<vscode.Location | undefined> {
      const reference = referenceAtPosition(document, position);
      if (!reference) return undefined;

      const current = index();
      const target = current.requirements.get(reference.id) ?? current.steps.get(reference.id) ?? current.adrs.get(reference.id);
      return target?.uri ? locationAtId(target.uri, reference.id) : undefined;
    },
  };
}

async function locationAtId(uri: vscode.Uri, id: string): Promise<vscode.Location | undefined> {
  try {
    const document = await vscode.workspace.openTextDocument(uri);
    const offset = document.getText().indexOf(id);
    if (offset < 0) return undefined;
    const position = document.positionAt(offset);
    return new vscode.Location(uri, new vscode.Range(position, document.positionAt(offset + id.length)));
  } catch {
    return undefined;
  }
}
