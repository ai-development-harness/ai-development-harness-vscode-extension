import * as path from 'node:path';
import * as posix from 'node:path/posix';
import * as vscode from 'vscode';
import { ArtifactReader } from './reader';

/**
 * Production-реализация `ArtifactReader` поверх `vscode.workspace.findFiles`.
 * FIX STEP-005 (F-002): glob для `findFiles` всегда POSIX-стиль
 * (`path.posix.join`), независимо от ОС.
 */
export function createVscodeArtifactReader(workspaceRoot: string): ArtifactReader {
  return {
    async list(dir, glob) {
      const pattern = new vscode.RelativePattern(workspaceRoot, posix.join(dir, glob));
      // FIX STEP-006 (F-009): `exclude === undefined` makes `findFiles` honor
      // the user's `files.exclude`/`search.exclude` settings, so a workspace
      // excluding e.g. `planning/**` would silently hide real artifacts —
      // divergent from the fs-backed test reader. `null` disables that.
      const uris = await vscode.workspace.findFiles(pattern, null);
      return uris
        .map((uri) => path.relative(workspaceRoot, uri.fsPath).split(path.sep).join('/'))
        .sort();
    },
    async read(relPath) {
      const uri = vscode.Uri.file(path.join(workspaceRoot, relPath));
      const bytes = await vscode.workspace.fs.readFile(uri);
      return Buffer.from(bytes).toString('utf8');
    },
    async exists(relPath) {
      const uri = vscode.Uri.file(path.join(workspaceRoot, relPath));
      try {
        await vscode.workspace.fs.stat(uri);
        return true;
      } catch {
        return false;
      }
    },
  };
}
