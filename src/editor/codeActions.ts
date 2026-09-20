import * as vscode from 'vscode';
import type { Translate } from './validation';

export function createCodeActions(document: vscode.TextDocument, range: vscode.Range, t: Translate): vscode.CodeAction[] {
  const line = document.lineAt(range.start.line);
  const actions: vscode.CodeAction[] = [];
  const before = document.getText(new vscode.Range(new vscode.Position(0, 0), new vscode.Position(line.lineNumber, 0)));
  const bullet = /^(\s*)-\s+(?:\[ \]\s+)?(.+)$/.exec(line.text);
  if (isAcceptanceCriterion(before) && bullet && !/^\s*-\s+\[[xX]\]\s+/.test(line.text)) {
    const action = new vscode.CodeAction(t('harness.editor.action.markAcceptance'), vscode.CodeActionKind.QuickFix);
    action.edit = new vscode.WorkspaceEdit();
    // Canonical TEMPLATE uses plain bullets; replace only bullet prefix and preserve its text/indent.
    const prefixLength = bullet[1].length + line.text.slice(bullet[1].length).length - bullet[2].length;
    action.edit.replace(document.uri, new vscode.Range(line.lineNumber, 0, line.lineNumber, prefixLength), `${bullet[1]}- [x] `);
    actions.push(action);
  }
  const stepId = document.getText().match(/^#\s+(STEP-\d+)/m)?.[1];
  if (stepId) for (const [key, command] of [['harness.editor.action.requestReview', 'harness.review'], ['harness.editor.action.flagBlocker', 'harness.explorer.flagBlocker'], ['harness.editor.action.createFollowUp', 'harness.explorer.createFollowUpStep']] as const) {
    const title = t(key);
    const action = new vscode.CodeAction(title, vscode.CodeActionKind.QuickFix);
    action.command = { title, command, arguments: [stepId] };
    actions.push(action);
  }
  return actions;
}

function isAcceptanceCriterion(before: string): boolean {
  const lastHeading = [...before.matchAll(/^##[ \t]+([^\r\n]+)$/gm)].at(-1)?.[1]?.trim();
  return lastHeading === 'Acceptance criteria';
}
