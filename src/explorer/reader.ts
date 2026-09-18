import * as path from 'node:path';
import * as posix from 'node:path/posix';
import { readFile, readdir, stat } from 'node:fs/promises';

/**
 * Порт чтения файловой системы (REQ-002 Implementation plan п.3) — ключ к
 * тестируемости `treeProvider`/перф-теста без мока `vscode`. Все пути на
 * границе порта — workspace-relative POSIX-строки (не абсолютные fs-пути,
 * не `vscode.Uri`), чтобы обе реализации (`vscodeReader.ts` здесь ниже —
 * fs-реализация) давали идентичный контракт.
 */
export interface ArtifactReader {
  /** Список workspace-relative POSIX-путей файлов под `dir`, совпадающих с `glob` (поддержаны `*` и `**`). */
  list(dir: string, glob: string): Promise<string[]>;
  read(relPath: string): Promise<string>;
  exists(relPath: string): Promise<boolean>;
}

/** Минимальный glob → RegExp: `*` — любой сегмент без `/`, `**` — произвольная глубина. */
export function globToRegExp(glob: string): RegExp {
  let out = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*' && glob[i + 1] === '*') {
      out += '.*';
      i++;
      if (glob[i + 1] === '/') i++;
    } else if (c === '*') {
      out += '[^/]*';
    } else if ('.+^${}()|[]\\'.includes(c)) {
      out += '\\' + c;
    } else {
      out += c;
    }
  }
  return new RegExp(`^${out}$`);
}

/** Тестовая/перф-реализация поверх `node:fs/promises` (Implementation plan п.3). */
export function createFsArtifactReader(workspaceRoot: string): ArtifactReader {
  return {
    async list(dir, glob) {
      const absDir = path.join(workspaceRoot, dir);
      let names: string[];
      try {
        names = await readdir(absDir, { recursive: glob.includes('**') });
      } catch {
        return [];
      }
      const matcher = globToRegExp(glob);
      const results: string[] = [];
      for (const name of names) {
        const posixName = name.split(path.sep).join('/');
        if (!matcher.test(posixName)) continue;
        const abs = path.join(absDir, name);
        try {
          const info = await stat(abs);
          if (!info.isFile()) continue;
        } catch {
          continue;
        }
        results.push(posix.join(dir, posixName));
      }
      results.sort();
      return results;
    },
    async read(relPath) {
      return readFile(path.join(workspaceRoot, relPath), 'utf8');
    },
    async exists(relPath) {
      try {
        await stat(path.join(workspaceRoot, relPath));
        return true;
      } catch {
        return false;
      }
    },
  };
}
