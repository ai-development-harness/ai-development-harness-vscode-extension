import * as vscode from 'vscode';
import type { StepEditorIndex } from './validation';

export function provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, index: StepEditorIndex): vscode.CompletionItem[] {
  const linePrefix = document.lineAt(position.line).text.slice(0, position.character);
  const match = linePrefix.match(/(REQ|STEP|ADR)-[A-Za-z0-9]*$/);
  if (!match) return [];
  const kind = match[1];
  const items = kind === 'REQ' ? index.requirements : kind === 'STEP' ? index.steps : index.adrs;
  const range = new vscode.Range(position.line, position.character - match[0].length, position.line, position.character);

  return [...items.entries()].map(([id, value]) => {
    const item = new vscode.CompletionItem(id, vscode.CompletionItemKind.Reference);
    // REQ-003: VSCode по умолчанию заменяет только word range и оставляет
    // `STEP-0` перед вставкой. Явный range заменяет весь typed ID, а описание
    // остаётся documentation-pane, поэтому в документ попадает только ID.
    item.range = range;
    item.insertText = id;
    item.documentation = new vscode.MarkdownString(value.title);
    return item;
  });
}
