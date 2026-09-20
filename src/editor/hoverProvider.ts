import * as vscode from 'vscode';
import type { StepEditorIndex, Translate } from './validation';

export function provideHover(document: vscode.TextDocument, position: vscode.Position, index: StepEditorIndex, t: Translate): vscode.Hover | undefined {
  const range = document.getWordRangeAtPosition(position, /(?:REQ|STEP|ADR)-\d+/);
  if (!range) return undefined;
  const id = document.getText(range);
  const value = index.requirements.get(id) ?? index.steps.get(id) ?? index.adrs.get(id);
  return value ? new vscode.Hover(new vscode.MarkdownString(`**${id}** — ${value.title}`), range) : new vscode.Hover(t('harness.editor.hover.unavailable'), range);
}
