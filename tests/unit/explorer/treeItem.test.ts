import { toTreeItem } from '../../../src/explorer/treeItem';
import { HarnessNode } from '../../../src/explorer/model';
import { ReqData } from '../../../src/parser/types';
import type { I18nService } from '../../../src/locales/activation';

const i18n: I18nService = {
  t: (key) => key,
  getLanguage: () => 'ru',
  onDidChangeLanguage: (() => ({ dispose: () => {} })) as I18nService['onDidChangeLanguage'],
};

function reqData(overrides: Partial<ReqData> = {}): ReqData {
  return {
    id: 'REQ-001',
    title: 'Тестовый REQ',
    priority: 'Средний',
    source: 'brief',
    requirement: '',
    rationale: '',
    acceptance: [],
    traceability: { step: [], adr: [] },
    ...overrides,
  };
}

/**
 * STEP-015 Acceptance criterion №4: Explorer показывает REQ-статус,
 * полученный из парсера `docs/requirements/STATUS.md` (`node.status`), а не
 * из `ReqData` (`SPEC.md`) — единственное место, где статус виден пользователю.
 */
describe('toTreeItem (req node)', () => {
  it('description === node.status (источник — STATUS.md, не ReqData из SPEC.md)', () => {
    const node: HarnessNode = {
      kind: 'req',
      uri: 'docs/requirements/SPEC.md',
      data: reqData(),
      status: 'Частично',
      groupId: 'requirements',
    };

    const item = toTreeItem(node, '/workspace', i18n);
    expect(item.description).toBe('Частично');
  });

  it('пустой статус (деградация чтения STATUS.md) — description пустая строка, узел всё равно строится', () => {
    const node: HarnessNode = {
      kind: 'req',
      uri: 'docs/requirements/SPEC.md',
      data: reqData(),
      status: '',
      groupId: 'requirements',
    };

    const item = toTreeItem(node, '/workspace', i18n);
    expect(item.description).toBe('');
    expect(item.label).toBe('REQ-001 — Тестовый REQ');
  });
});
