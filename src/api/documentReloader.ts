import * as path from 'node:path';
import * as vscode from 'vscode';
import { resolveWorkspaceFile, validateWorkspaceRelativePath } from './workspacePaths';

export interface ReloadResult {
  reloaded: number;
  skippedDirty: number;
  failed: number;
}

function fullRange(document: vscode.TextDocument): vscode.Range {
  const lastLine = document.lineAt(document.lineCount - 1);
  return new vscode.Range(0, 0, document.lineCount - 1, lastLine.text.length);
}

/**
 * VSCode не предоставляет публичный `TextDocument.reload()`. Для уже открытых
 * чистых файлов применяем байты с диска через WorkspaceEdit и сразу сохраняем:
 * это не открывает editor и не меняет focus. Dirty buffers не трогаем — агентские
 * изменения остаются на диске, чтобы не потерять локальную незаписанную правку.
 */
export async function reloadCleanWorkspaceDocuments(workspaceRoot: string, changedFiles: readonly string[]): Promise<ReloadResult> {
  const result: ReloadResult = { reloaded: 0, skippedDirty: 0, failed: 0 };
  const lexicalRoot = path.resolve(workspaceRoot);
  const changed = new Set((await Promise.all(changedFiles.map(async (file) => {
    try {
      return await resolveWorkspaceFile(workspaceRoot, validateWorkspaceRelativePath(file));
    } catch {
      return undefined; // Удалённый файл или небезопасный путь не имеет открытого buffer для reload.
    }
  }))).filter((file): file is string => Boolean(file)));
  for (const document of vscode.workspace.textDocuments) {
    const documentPath = path.resolve(document.uri.fsPath);
    if (document.uri.scheme !== 'file' || !documentPath.startsWith(`${lexicalRoot}${path.sep}`)) continue;
    let realDocumentPath: string;
    try {
      realDocumentPath = await resolveWorkspaceFile(workspaceRoot, path.relative(lexicalRoot, documentPath));
    } catch {
      continue;
    }
    if (!changed.has(realDocumentPath)) continue;
    if (document.isDirty) {
      result.skippedDirty += 1;
      continue;
    }
    try {
      const diskText = Buffer.from(await vscode.workspace.fs.readFile(document.uri)).toString('utf8');
      if (diskText === document.getText()) continue;
      const edit = new vscode.WorkspaceEdit();
      edit.replace(document.uri, fullRange(document), diskText);
      if (!(await vscode.workspace.applyEdit(edit)) || !(await document.save())) {
        result.failed += 1;
        continue;
      }
      result.reloaded += 1;
    } catch {
      result.failed += 1;
    }
  }
  return result;
}
