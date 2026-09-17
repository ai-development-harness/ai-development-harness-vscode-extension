import * as fs from 'node:fs';
import * as path from 'node:path';
import { parseExecutionProtocol } from '../../../src/parser/executionProtocol';

const PROTOCOL_PATH = path.join(__dirname, '..', '..', 'fixtures', 'protocol', 'EXECUTION_PROTOCOL.md');

function read(filePath: string): string {
  return fs.readFileSync(filePath, 'utf8');
}

describe('parseExecutionProtocol', () => {
  it('извлекает статусы/типы/risk flags/обязательные поля/команды из реального EXECUTION_PROTOCOL.md', () => {
    const result = parseExecutionProtocol(read(PROTOCOL_PATH));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const { data, warnings } = result.value;

    expect(data.stepTypes).toEqual([
      'IMPLEMENTATION',
      'BUGFIX',
      'REFACTOR',
      'RESEARCH',
      'ADR',
      'AUDIT',
      'REVIEW',
      'HARDENING',
      'DOCUMENTATION',
      'RELEASE',
    ]);

    expect(data.stepStatuses).toEqual([
      'Запланировано',
      'В работе',
      'Выполнено',
      'Заблокировано',
      'Отменено',
      'Заменено',
    ]);

    expect(data.riskFlags).toEqual([
      'security-sensitive',
      'data-migration',
      'destructive',
      'public-api',
      'architecture',
      'concurrency',
      'external-integration',
      'performance-critical',
      'release-critical',
    ]);

    expect(data.requiredStepFields).toContain('Status');
    expect(data.requiredStepFields).toContain('Mutation policy');
    expect(data.requiredStepFields).toContain('Blocker/Failure reason при необходимости');
    expect(data.requiredStepFields.length).toBe(20);

    // Дерево команд извлекается динамически сканированием заголовков `N. \`TOKEN\``,
    // не хардкодом — 22 реально существующих в протоколе на сегодня.
    expect(data.commands.length).toBe(22);
    const commandNames = data.commands.map((c) => c.name);
    expect(commandNames).toContain('INIT PROJECT');
    expect(commandNames).toContain('PLAN STEP-NNN');
    expect(commandNames).toContain('STATUS PROJECT');
    expect(commandNames).toContain('SYNC');
    // Заголовок с двумя backtick-группами («COMMIT» / «COMMIT: <подсказка>») —
    // берётся первый токен, заголовок не отбрасывается целиком.
    expect(commandNames).toContain('COMMIT');
    const commit = data.commands.find((c) => c.name === 'COMMIT');
    expect(commit?.sectionTitle).toBe('19. `COMMIT` / `COMMIT: <подсказка>`');

    expect(warnings).toEqual([]);
  });

  it('деградирует (warning, не exception), если секция статусов не найдена', () => {
    const content = '# Protocol\n\n## 1. Сущности\n\nтекст без нужных секций\n';
    const result = parseExecutionProtocol(content);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.data.stepStatuses).toEqual([]);
    const warningFields = result.value.warnings.map((w) => w.field);
    expect(warningFields).toContain('stepStatuses');
    expect(warningFields).toContain('commands');
  });

  it('даёт явную ParseError на пустой контент, не exception', () => {
    const result = parseExecutionProtocol('');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('empty-content');
  });

  it('даёт явную ParseError, если контент непустой, но заголовков нет вообще', () => {
    const result = parseExecutionProtocol('просто текст без единого markdown-заголовка');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('missing-heading');
  });
});
