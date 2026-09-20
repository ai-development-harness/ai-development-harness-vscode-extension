import { provideCompletionItems } from '../../../src/editor/autocomplete';
import { createCodeActions } from '../../../src/editor/codeActions';
import { createCodeLenses } from '../../../src/editor/codeLens';
import { StepEditorIndex } from '../../../src/editor/validation';

const t = (key: string, params?: Record<string, string>): string => `${key}${params?.id ?? ''}`;
const index: StepEditorIndex = {
  requirements: new Map([['REQ-001', { title: 'Требование' }]]),
  steps: new Map([['STEP-001', { title: 'Шаг', status: 'В работе', content: '' }]]),
  adrs: new Map([['ADR-001', { title: 'Решение' }]]),
};

function document(lines: string[]) {
  const text = lines.join('\n');
  return {
    uri: { fsPath: '/tmp/STEP-001.md' },
    lineCount: lines.length,
    lineAt: (line: number) => ({ text: lines[line], lineNumber: line }),
    getText: (range?: { end?: { line: number }; endLine?: number }) => range ? `${lines.slice(0, range.end?.line ?? range.endLine ?? 0).join('\n')}\n` : text,
  };
}

describe('editor providers', () => {
  it('CodeAction меняет только prefix canonical plain acceptance bullet и делегирует точный STEP ID', () => {
    const doc = document(['# STEP-001 — Тест', '## Acceptance criteria', '  - Критерий', '', '## Verification', '- Соседний пункт']);
    const actions = createCodeActions(doc as never, { start: { line: 2, character: 0 } } as never, t);
    expect((actions[0].edit as unknown as { replacements: unknown[] }).replacements).toEqual([{ uri: doc.uri, range: expect.anything(), text: '  - [x] ' }]);
    expect(actions.slice(1).map((action) => action.command)).toEqual([
      { title: 'harness.editor.action.requestReview', command: 'harness.review', arguments: ['STEP-001'] },
      { title: 'harness.editor.action.flagBlocker', command: 'harness.explorer.flagBlocker', arguments: ['STEP-001'] },
      { title: 'harness.editor.action.createFollowUp', command: 'harness.explorer.createFollowUpStep', arguments: ['STEP-001'] },
    ]);
  });

  it('autocomplete возвращает только существующие ID и заменяет весь typed prefix', () => {
    const doc = document(['REQ-']);
    const reqItems = provideCompletionItems(doc as never, { line: 0, character: 4 } as never, index);
    expect(reqItems.map((item) => item.label)).toEqual(['REQ-001']);
    expect(reqItems[0].insertText).toBe('REQ-001');
    expect(reqItems[0].range).toEqual(expect.objectContaining({ startLine: 0, startCharacter: 0, endLine: 0, endCharacter: 4 }));
    const adr = document(['ADR-']);
    const adrItem = provideCompletionItems(adr as never, { line: 0, character: 4 } as never, index)[0];
    expect(adrItem.label).toBe('ADR-001');
    expect(adrItem.detail).toBeUndefined();
    expect(adrItem.documentation).toEqual(expect.objectContaining({ value: 'Решение' }));
  });

  it('CodeLens создаёт переходы только для существующих REQ/ADR и передаёт STEP ID в PLAN', () => {
    const doc = document(['# STEP-001 — Тест', '## Requirements', '- REQ-001 и REQ-999', '- ADR-001 и ADR-999']);
    const lenses = createCodeLenses(doc as never, index, t);
    expect(lenses).toHaveLength(3);
    expect(lenses.map((lens) => (lens.command as { title: string }).title)).toEqual([
      'harness.editor.codelens.openPlan',
      'harness.editor.codelens.openReferenceREQ-001',
      'harness.editor.codelens.openReferenceADR-001',
    ]);
    expect(lenses[0].command).toEqual(expect.objectContaining({ arguments: ['STEP-001'] }));
  });
});
