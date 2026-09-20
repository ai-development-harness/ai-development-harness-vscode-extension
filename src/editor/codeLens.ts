import * as vscode from 'vscode';
import type { StepEditorIndex, Translate } from './validation';

export function createCodeLenses(document: vscode.TextDocument, index: StepEditorIndex, t: Translate): vscode.CodeLens[] {
  const lenses: vscode.CodeLens[] = [];
  const stepId = document.getText().match(/^#\s+(STEP-\d+)/m)?.[1];
  for (let line = 0; line < document.lineCount; line += 1) {
    const text = document.lineAt(line).text;
    for (const match of text.matchAll(/\b(REQ|ADR)-\d+\b/g)) {
      const known = match[1] === 'REQ' ? index.requirements.has(match[0]) : index.adrs.has(match[0]);
      if (known) lenses.push(new vscode.CodeLens(new vscode.Range(line, match.index ?? 0, line, (match.index ?? 0) + match[0].length), { title: t('harness.editor.codelens.openReference', { id: match[0] }), command: 'harness.editor.openReference', arguments: [match[0]] }));
    }
    if (/^##\s+Requirements\b/.test(text)) lenses.push(new vscode.CodeLens(new vscode.Range(line, 0, line, text.length), { title: t('harness.editor.codelens.openPlan'), command: 'harness.editor.openPlan', arguments: stepId ? [stepId] : [] }));
  }
  return lenses;
}
