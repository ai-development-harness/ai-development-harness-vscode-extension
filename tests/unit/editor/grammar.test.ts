import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { Registry, parseRawGrammar, type IGrammar, type IToken, type StateStack } from 'vscode-textmate';
import { createOnigScanner, createOnigString, loadWASM } from 'vscode-oniguruma';

const root = path.resolve(__dirname, '../../..');
const markdownScope = 'text.html.markdown';
const harnessScope = 'text.harness-step.markdown';
const referenceScope = 'text.harness-step.references';
const referenceTokenScope = 'constant.other.reference.harness-step';

let oniguruma: Promise<void> | undefined;

function loadOniguruma(): Promise<void> {
  oniguruma ??= fs.readFile(require.resolve('vscode-oniguruma/release/onig.wasm'))
    .then((wasm) => loadWASM(wasm.buffer.slice(wasm.byteOffset, wasm.byteOffset + wasm.byteLength)));
  return oniguruma;
}

async function createGrammar(): Promise<IGrammar> {
  const grammarPaths = new Map([
    [harnessScope, path.join(root, 'syntaxes', 'harness-step.tmLanguage.json')],
    [referenceScope, path.join(root, 'syntaxes', 'harness-step-references.tmLanguage.json')],
  ]);
  // Минимальная grammar сохраняет реальные Markdown scope names. Это изолирует
  // контракт injection от версии встроенной VS Code grammar, которую CI не хранит.
  const markdownGrammar = {
    scopeName: markdownScope,
    patterns: [
      { begin: '```', end: '```', name: 'markup.fenced_code.block.markdown' },
      { begin: '`', end: '`', name: 'markup.inline.raw.string.markdown' },
      { begin: '\\*', end: '\\*', name: 'markup.italic.markdown' },
      { begin: '\\[', end: '\\)', name: 'markup.underline.link.markdown' },
      { begin: '^> ', end: '$', name: 'markup.quote.markdown' },
      { begin: '^- ', end: '$', name: 'markup.list.unnumbered.markdown' },
    ],
  };
  const registry = new Registry({
    onigLib: loadOniguruma().then(() => ({ createOnigScanner, createOnigString })),
    loadGrammar: async (scopeName) => {
      if (scopeName === markdownScope) {
        return parseRawGrammar(JSON.stringify(markdownGrammar), 'markdown.tmLanguage.json');
      }
      const grammarPath = grammarPaths.get(scopeName);
      return grammarPath ? parseRawGrammar(await fs.readFile(grammarPath, 'utf8'), grammarPath) : null;
    },
    getInjections: (scopeName) => scopeName === harnessScope ? [referenceScope] : undefined,
  });
  const grammar = await registry.loadGrammar(harnessScope);
  if (!grammar) {
    throw new Error('Не удалось загрузить TextMate grammar harness-step');
  }
  return grammar;
}

function tokenAt(tokens: IToken[], line: string, reference: string): IToken {
  const start = line.indexOf(reference);
  expect(start).toBeGreaterThanOrEqual(0);
  const token = tokens.find(({ startIndex, endIndex }) => startIndex <= start && endIndex >= start + reference.length);
  expect(token).toBeDefined();
  return token!;
}

describe('TextMate grammar harness-step', () => {
  it('инъецирует Harness reference scope в prose, список и blockquote, не перехватывая Markdown code', async () => {
    const grammar = await createGrammar();
    let ruleStack: StateStack | null = null;
    const tokenize = (line: string) => {
      const result = grammar.tokenizeLine(line, ruleStack);
      ruleStack = result.ruleStack;
      return result.tokens;
    };

    for (const [line, reference] of [
      ['REQ-001 STEP-001 ADR-001', 'REQ-001'],
      ['- STEP-002', 'STEP-002'],
      ['> ADR-003', 'ADR-003'],
    ]) {
      expect(tokenAt(tokenize(line), line, reference).scopes).toContain(referenceTokenScope);
    }

    const inlineCode = '`REQ-004`';
    expect(tokenAt(tokenize(inlineCode), inlineCode, 'REQ-004').scopes).toContain('markup.inline.raw.string.markdown');
    expect(tokenAt(tokenize(inlineCode), inlineCode, 'REQ-004').scopes).not.toContain(referenceTokenScope);

    tokenize('```');
    const fencedCode = 'STEP-005';
    expect(tokenAt(tokenize(fencedCode), fencedCode, 'STEP-005').scopes).toContain('markup.fenced_code.block.markdown');
    expect(tokenAt(tokenize(fencedCode), fencedCode, 'STEP-005').scopes).not.toContain(referenceTokenScope);
    tokenize('```');

    const emphasis = '*ADR-006*';
    expect(tokenAt(tokenize(emphasis), emphasis, 'ADR-006').scopes).toContain('markup.italic.markdown');
    const link = '[REQ-007](https://example.test)';
    expect(tokenAt(tokenize(link), link, 'REQ-007').scopes).toContain('markup.underline.link.markdown');
  });
});
