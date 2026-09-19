/**
 * FIX STEP-006 (F-001): minimal `vscode` module stub for Jest, covering only
 * the surface `src/explorer/{treeProvider,treeItem}.ts` actually use. This
 * exists solely to let `treeProvider.test.ts` exercise the real
 * `HarnessTreeDataProvider` class (not a reimplementation of its logic) and
 * assert the exact defect class from F-001: `fire()` must target an object
 * reference the host can still find via `getChildren()`.
 */

export class EventEmitter<T> {
  private listeners: Array<(e: T) => void> = [];
  readonly event = (listener: (e: T) => void): { dispose(): void } => {
    this.listeners.push(listener);
    return { dispose: () => {} };
  };
  fire(data: T): void {
    for (const l of this.listeners) l(data);
  }
  dispose(): void {}
}

export enum TreeItemCollapsibleState {
  None = 0,
  Collapsed = 1,
  Expanded = 2,
}

export class ThemeIcon {
  constructor(
    public id: string,
    public color?: unknown
  ) {}
}

export class ThemeColor {
  constructor(public id: string) {}
}

export class TreeItem {
  description?: string;
  tooltip?: string;
  iconPath?: unknown;
  command?: unknown;
  contextValue?: string;
  resourceUri?: unknown;
  constructor(
    public label: string,
    public collapsibleState?: TreeItemCollapsibleState
  ) {}
}

export const Uri = {
  file(fsPath: string): { fsPath: string } {
    return { fsPath };
  },
};

/**
 * STEP-014: minimal stub so `listStepFiles`' `new vscode.RelativePattern(...)`
 * does not throw. No prior test exercised the real `listAllSteps` →
 * `findFiles` path (targets always resolved via a tree-node object); the
 * STEP-014 delete-guard re-check tests are the first to go through it for
 * real, with `findFiles` itself mocked per-call in the test file.
 */
export class RelativePattern {
  constructor(
    public base: unknown,
    public pattern: string
  ) {}
}

export class Range {
  constructor(
    public startLine: number,
    public startCharacter: number,
    public endLine: number,
    public endCharacter: number
  ) {}
}

export class WorkspaceEdit {
  readonly replacements: Array<{ uri: { fsPath: string }; range: Range; text: string }> = [];
  replace(uri: { fsPath: string }, range: Range, text: string): void {
    this.replacements.push({ uri, range, text });
  }
}

/* eslint-disable @typescript-eslint/no-var-requires */
const nodeFs = require('node:fs');

/**
 * Delegates to the real filesystem so tests can exercise `actions.ts` guard
 * wiring (F-002/F-003 regressions) against real temp fixture files, without
 * reimplementing `vscode.workspace.fs` semantics.
 */
export const workspace = {
  fs: {
    readFile: jest.fn(async (uri: { fsPath: string }) => new Uint8Array(nodeFs.readFileSync(uri.fsPath))),
    writeFile: jest.fn(async (uri: { fsPath: string }, content: Uint8Array) => {
      nodeFs.writeFileSync(uri.fsPath, Buffer.from(content));
    }),
    delete: jest.fn(async () => {}),
    stat: jest.fn(async (uri: { fsPath: string }) => {
      nodeFs.statSync(uri.fsPath);
      return {};
    }),
  },
  findFiles: jest.fn(async () => []),
  workspaceFolders: undefined as unknown,
  textDocuments: [] as unknown[],
  applyEdit: jest.fn(async () => true),
};

export const window = {
  // Reload меняет buffer через WorkspaceEdit и не должен переключать редактор.
  // Явное поле позволяет regression-тесту проверять это свойство без GUI host.
  activeTextEditor: undefined as unknown,
  showErrorMessage: jest.fn(),
  showWarningMessage: jest.fn(),
  showInputBox: jest.fn(),
  showQuickPick: jest.fn(),
  createOutputChannel: jest.fn(() => ({ appendLine: jest.fn(), show: jest.fn(), dispose: jest.fn() })),
};

export const commands = {
  executeCommand: jest.fn(),
  registerCommand: jest.fn(() => ({ dispose: () => {} })),
};
