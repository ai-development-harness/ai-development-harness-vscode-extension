/**
 * REQ-002: codicon-идентификаторы для статуса STEP, без файловых ассетов и
 * без импорта `vscode` (чистый модуль, напрямую тестируемый в Jest — сборка
 * `vscode.ThemeIcon` остаётся в `treeItem.ts`).
 *
 * Ключи этой карты обязаны покрывать ровно
 * `parseExecutionProtocol(...).stepStatuses` — это проверяется
 * `tests/unit/explorer/statusIcon.test.ts`, чтобы drift протокола (появление
 * нового статуса) ловился автоматически, а не оставлял STEP без иконки.
 */

export interface StatusPresentation {
  icon: string;
  color?: string;
}

export const STATUS_ICONS: Readonly<Record<string, StatusPresentation>> = {
  Запланировано: { icon: 'circle-outline' },
  'В работе': { icon: 'sync' },
  Выполнено: { icon: 'pass-filled', color: 'charts.green' },
  Заблокировано: { icon: 'error', color: 'charts.red' },
  Отменено: { icon: 'circle-slash', color: 'disabledForeground' },
  Заменено: { icon: 'arrow-right', color: 'charts.purple' },
};

/** Неизвестное/будущее значение статуса деградирует до нейтральной иконки, а не роняет дерево. */
export const UNKNOWN_STATUS_PRESENTATION: StatusPresentation = { icon: 'question' };

export function statusPresentation(status: string): StatusPresentation {
  return STATUS_ICONS[status] ?? UNKNOWN_STATUS_PRESENTATION;
}
