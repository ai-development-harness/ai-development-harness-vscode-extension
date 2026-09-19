import * as vscode from 'vscode';
import { reloadCleanWorkspaceDocuments } from '../../../src/api/documentReloader';

jest.mock('../../../src/api/workspacePaths', () => ({
  validateWorkspaceRelativePath: (value: string) => value,
  resolveWorkspaceFile: async (root: string, value: string) => `${root}/${value}`,
}));

describe('reloadCleanWorkspaceDocuments', () => {
  beforeEach(() => {
    (vscode.workspace.textDocuments as unknown[]) = [];
    (vscode.window as unknown as { activeTextEditor: unknown }).activeTextEditor = undefined;
    jest.clearAllMocks();
  });

  it('обновляет только чистый открытый документ без показа editor', async () => {
    const document = {
      uri: { scheme: 'file', fsPath: '/workspace/file.md' },
      isDirty: false,
      lineCount: 1,
      lineAt: () => ({ text: 'old' }),
      getText: () => 'old',
      save: jest.fn(async () => true),
    };
    (vscode.workspace.textDocuments as unknown[]) = [document];
    (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValueOnce(Buffer.from('new'));

    const focusedEditor = { document: { uri: { fsPath: '/workspace/other.md' } } };
    (vscode.window as unknown as { activeTextEditor: unknown }).activeTextEditor = focusedEditor;
    const result = await reloadCleanWorkspaceDocuments('/workspace', ['file.md']);

    expect(result).toEqual({ reloaded: 1, skippedDirty: 0, failed: 0 });
    expect(vscode.workspace.applyEdit).toHaveBeenCalledTimes(1);
    expect(document.save).toHaveBeenCalledTimes(1);
    expect(vscode.window.showTextDocument).toBeUndefined();
    expect((vscode.window as unknown as { activeTextEditor: unknown }).activeTextEditor).toBe(focusedEditor);
  });

  it('не трогает dirty buffer', async () => {
    const document = { uri: { scheme: 'file', fsPath: '/workspace/file.md' }, isDirty: true };
    (vscode.workspace.textDocuments as unknown[]) = [document];

    expect(await reloadCleanWorkspaceDocuments('/workspace', ['file.md'])).toEqual({ reloaded: 0, skippedDirty: 1, failed: 0 });
    expect(vscode.workspace.applyEdit).not.toHaveBeenCalled();
  });

  it('учитывает отказ applyEdit и не сохраняет документ', async () => {
    const document = {
      uri: { scheme: 'file', fsPath: '/workspace/file.md' },
      isDirty: false,
      lineCount: 1,
      lineAt: () => ({ text: 'old' }),
      getText: () => 'old',
      save: jest.fn(async () => true),
    };
    (vscode.workspace.textDocuments as unknown[]) = [document];
    (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValueOnce(Buffer.from('new'));
    (vscode.workspace.applyEdit as jest.Mock).mockResolvedValueOnce(false);

    await expect(reloadCleanWorkspaceDocuments('/workspace', ['file.md'])).resolves.toEqual({ reloaded: 0, skippedDirty: 0, failed: 1 });
    expect(document.save).not.toHaveBeenCalled();
  });

  it('учитывает неудачное сохранение после WorkspaceEdit', async () => {
    const document = {
      uri: { scheme: 'file', fsPath: '/workspace/file.md' },
      isDirty: false,
      lineCount: 1,
      lineAt: () => ({ text: 'old' }),
      getText: () => 'old',
      save: jest.fn(async () => false),
    };
    (vscode.workspace.textDocuments as unknown[]) = [document];
    (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValueOnce(Buffer.from('new'));
    (vscode.workspace.applyEdit as jest.Mock).mockResolvedValueOnce(true);

    await expect(reloadCleanWorkspaceDocuments('/workspace', ['file.md'])).resolves.toEqual({ reloaded: 0, skippedDirty: 0, failed: 1 });
    expect(document.save).toHaveBeenCalledTimes(1);
  });
});
