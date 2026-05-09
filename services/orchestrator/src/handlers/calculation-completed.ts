import { Logger } from 'pino';
import { Database } from '../services/database';
import { NotificationService, NotificationChannel } from '../services/notifications';

/**
 * calculation.completed — расчёт сохранён с результатом.
 * Уведомляем автора.
 */
export async function handleCalculationCompleted(
  calculationId: string,
  projectId: string,
  userId: string,
  metadata: Record<string, any> | undefined,
  logger: Logger,
  db: Database,
  notifications: NotificationService,
): Promise<void> {
  try {
    const calcName = metadata?.calc_name || 'Расчёт';
    logger.info({ calculationId, projectId, calcName }, 'Calculation completed');

    if (userId) {
      await notifications.send({
        userId,
        type: 'calculation_completed',
        title: 'Расчёт завершён',
        message: `${calcName} — результат сохранён в проекте.`,
        taskId: calculationId,
        channels: [NotificationChannel.IN_APP],
        severity: 'info',
      });
    }
  } catch (error) {
    logger.error({ error, calculationId }, 'Error handling calculation.completed');
    throw error;
  }
}
