import * as path from 'node:path';
import { readFile } from 'node:fs/promises';
import { parseExecutionProtocol } from '../../../src/parser/executionProtocol';
import { STATUS_ICONS, statusPresentation } from '../../../src/explorer/statusIcon';

const PROTOCOL_FIXTURE = path.join(__dirname, '../../fixtures/protocol/EXECUTION_PROTOCOL.md');

describe('statusPresentation', () => {
  it('ключи карты иконок равны ровно parseExecutionProtocol(...).stepStatuses (защита от protocol drift)', async () => {
    const content = await readFile(PROTOCOL_FIXTURE, 'utf8');
    const parsed = parseExecutionProtocol(content);
    if (!parsed.ok) throw new Error('protocol fixture failed to parse');
    expect(new Set(Object.keys(STATUS_ICONS))).toEqual(new Set(parsed.value.data.stepStatuses));
  });

  it('покрывает все 6 реальных статусов протокола иконкой', () => {
    const statuses = ['Запланировано', 'В работе', 'Выполнено', 'Заблокировано', 'Отменено', 'Заменено'];
    for (const status of statuses) {
      expect(statusPresentation(status).icon).toBeTruthy();
    }
  });

  it('неизвестный статус деградирует до нейтральной иконки, не бросает', () => {
    expect(statusPresentation('НовыйБудущийСтатус')).toEqual({ icon: 'question' });
  });
});
