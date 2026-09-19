import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { resolveWorkspaceFile, validateWorkspaceRelativePath } from '../../../src/api/workspacePaths';

describe('workspace path boundary', () => {
  it('отклоняет traversal и absolute path до чтения файла', async () => {
    await expect(resolveWorkspaceFile(process.cwd(), '../outside.txt')).rejects.toThrow('выходит за пределы workspace');
    await expect(resolveWorkspaceFile(process.cwd(), path.resolve('/tmp/outside.txt'))).rejects.toThrow('абсолютный');
    expect(() => validateWorkspaceRelativePath('../outside.txt')).toThrow('выходит за пределы workspace');
  });

  it('отклоняет symlink из workspace во внешний файл', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'harness-path-root-'));
    const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'harness-path-outside-'));
    await fs.writeFile(path.join(outside, 'secret.txt'), 'secret');
    await fs.symlink(path.join(outside, 'secret.txt'), path.join(root, 'linked.txt'));

    await expect(resolveWorkspaceFile(root, 'linked.txt')).rejects.toThrow('Symlink');
    await fs.rm(root, { recursive: true, force: true });
    await fs.rm(outside, { recursive: true, force: true });
  });
});
