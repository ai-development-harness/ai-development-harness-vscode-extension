import { createEditorIndex, validateStepDocument } from '../../../src/editor/validation';

const t = (key: string, params?: Record<string, string>): string => `${key} ${Object.values(params ?? {}).join(' ')}`;

const valid = `# STEP-001 — Проверка

**Статус:** Выполнено
**Type:** IMPLEMENTATION
**Приоритет:** Высокий
**Фаза:** MVP
**Depends on:** —

## Requirements

- REQ-001

## ADR

- ADR-001

## Risk flags

- none

## Goal

Готово

## Context

Готово

## Scope

- Редактор

## Mutation policy

### Allowed

- src/editor

### Conditional

- —

### Forbidden

- —

## Out of scope

- —

## Acceptance criteria

- [ ] Проверка

## Verification

- test

## Deliverables

- test

## Implementation plan

**Plan status:** Ready
**Plan revision:** 1
**Planned at:** 2026-01-01

## Evidence

Нет

## Review status

**Latest verdict:** NOT REVIEWED
**Latest report:** —

## Blocker / Failure reason

—`;

describe('validateStepDocument', () => {
  it('не создаёт diagnostics для согласованного STEP', () => {
    const index = createEditorIndex({ requirements: '# REQ-001 — Требование\n\n**Приоритет:** Высокий\n**Источник:** test\n\n## Requirement\n\nТекст\n\n## Rationale\n\nТекст\n\n## Acceptance\n\n- Проверка\n\n## Traceability\n\n- **STEP:** STEP-001\n- **ADR:** ADR-001', steps: [{ content: valid }], adrs: [{ content: '# ADR-001 — Решение\n\n**Status:** Accepted\n**Date:** 2026-01-01\n**Deciders:** test\n**Supersedes:** —\n**Superseded by:** —\n\n## Context\n\nТекст\n\n## Problem\n\nТекст\n\n## Decision\n\nТекст\n\n## Consequences\n\nТекст\n\n## Alternatives\n\nТекст\n\n## Traceability\n\n- **REQ:** REQ-001\n- **STEP:** STEP-001' }] });
    expect(validateStepDocument(valid, index, t)).toEqual([]);
  });

  it('сообщает о битых ссылках, невыполненной зависимости и цикле', () => {
    const cyclic = valid.replace('STEP-001', 'STEP-002').replace('**Depends on:** —', '**Depends on:** STEP-003').replace('REQ-001', 'REQ-999');
    const index = createEditorIndex({ steps: [{ content: cyclic.replace('**Статус:** Выполнено', '**Статус:** В работе') }, { content: valid.replace('STEP-001', 'STEP-003').replace('**Статус:** Выполнено', '**Статус:** В работе').replace('**Depends on:** —', '**Depends on:** STEP-002') }], adrs: [] });
    const messages = validateStepDocument(cyclic, index, t).map((item) => item.message).join('\n');
    expect(messages).toContain('REQ-999');
    expect(messages).toContain('harness.editor.diagnostic.unsatisfiedDependency');
    expect(messages).toContain('harness.editor.diagnostic.dependencyCycle');
  });

  it('привязывает diagnostic каждой невыполненной зависимости к её полному ID', () => {
    const target = valid.replace('**Depends on:** —', '**Depends on:** STEP-019, STEP-022');
    const step019 = valid.replace('STEP-001', 'STEP-019').replace('**Статус:** Выполнено', '**Статус:** В работе');
    const step022 = valid.replace('STEP-001', 'STEP-022').replace('**Статус:** Выполнено', '**Статус:** В работе');
    const index = createEditorIndex({ steps: [{ content: target }, { content: step019 }, { content: step022 }], adrs: [] });
    const diagnostics = validateStepDocument(target, index, t).filter((item) => item.message.includes('unsatisfiedDependency'));

    expect(diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ message: expect.stringContaining('STEP-019'), offset: target.indexOf('STEP-019'), length: 'STEP-019'.length }),
      expect.objectContaining({ message: expect.stringContaining('STEP-022'), offset: target.indexOf('STEP-022'), length: 'STEP-022'.length }),
    ]));
  });

  it('привязывает битые REQ, ADR и STEP к owning section, а не раннему prose-упоминанию', () => {
    const broken = valid
      .replace('**Depends on:** —', '**Depends on:** STEP-999')
      .replace('## Requirements\n\n- REQ-001', '## Context\n\nВ prose упомянуты REQ-999 и ADR-999\n\n## Requirements\n\n- REQ-999')
      .replace('## Context\n\nГотово\n\n', '')
      .replace('- ADR-001', '- ADR-999');
    const index = createEditorIndex({ steps: [{ content: broken }], adrs: [] });
    const diagnostics = validateStepDocument(broken, index, t).filter((item) => item.message.includes('missingReference'));
    const expected = [
      ['REQ-999', broken.lastIndexOf('REQ-999')],
      ['ADR-999', broken.lastIndexOf('ADR-999')],
      ['STEP-999', broken.indexOf('STEP-999')],
    ];
    for (const [id, offset] of expected) expect(diagnostics).toEqual(expect.arrayContaining([expect.objectContaining({ message: expect.stringContaining(id as string), offset, length: (id as string).length })]));
  });

  it('выявляет пересечение Scope и Out of scope', () => {
    const conflicting = valid.replace('- —\n\n## Acceptance criteria', '- Редактор\n\n## Acceptance criteria');
    const index = createEditorIndex({ steps: [{ content: conflicting }], adrs: [] });
    expect(validateStepDocument(conflicting, index, t).some((item) => item.message.includes('harness.editor.diagnostic.scopeConflict'))).toBe(true);
  });

  it('диагностирует пустые обязательные root-поля и секции', () => {
    const incomplete = valid.replace('**Type:** IMPLEMENTATION', '**Type:** ').replace('- [ ] Проверка\n\n## Verification', '\n## Verification');
    const index = createEditorIndex({ steps: [{ content: incomplete }], adrs: [] });
    const messages = validateStepDocument(incomplete, index, t).map((item) => item.message).join('\n');
    expect(messages).toContain('harness.editor.diagnostic.emptyField type');
    expect(messages).toContain('harness.editor.diagnostic.emptySection Acceptance criteria');
  });

  it('не считает prose в обязательных секциях пустым', () => {
    const prose = valid
      .replace('- REQ-001', 'Связи с требованиями проверяются агентом по текущему контракту.')
      .replace('- ADR-001', 'Архитектурные решения читаются из accepted ADR.')
      .replace('- Редактор', 'Реализовать только согласованный editor flow без расширения protocol.');
    const index = createEditorIndex({ steps: [{ content: prose }], adrs: [] });
    const messages = validateStepDocument(prose, index, t).map((item) => item.message).join('\n');

    expect(messages).not.toContain('harness.editor.diagnostic.emptySection Requirements');
    expect(messages).not.toContain('harness.editor.diagnostic.emptySection ADR');
    expect(messages).not.toContain('harness.editor.diagnostic.emptySection Scope');
  });
});
