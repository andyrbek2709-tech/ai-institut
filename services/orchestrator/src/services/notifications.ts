import { Logger } from 'pino';

export interface NotificationPayload {
  userId: string;
  type: string;
  title: string;
  message: string;
  taskId?: string;
  channels: NotificationChannel[];
  severity: 'info' | 'warning' | 'error';
}

export enum NotificationChannel {
  IN_APP = 'in_app',
  EMAIL = 'email',
  TELEGRAM = 'telegram',
}

export class NotificationService {
  private logger: Logger;
  private telegramBotToken?: string;
  private telegramChatId?: string;

  constructor(
    logger: Logger,
    telegramConfig?: { botToken: string; chatId: string },
  ) {
    this.logger = logger;
    this.telegramBotToken = telegramConfig?.botToken;
    this.telegramChatId = telegramConfig?.chatId;
  }

  async send(payload: NotificationPayload): Promise<void> {
    const results = await Promise.allSettled(
      payload.channels.map(channel => this.sendToChannel(channel, payload)),
    );

    results.forEach((result, i) => {
      if (result.status === 'rejected') {
        this.logger.warn(
          { error: result.reason, channel: payload.channels[i] },
          'Failed to send notification to channel',
        );
      }
    });
  }

  private async sendToChannel(
    channel: NotificationChannel,
    payload: NotificationPayload,
  ): Promise<void> {
    switch (channel) {
      case NotificationChannel.IN_APP:
        return this.sendInApp(payload);
      case NotificationChannel.EMAIL:
        return this.sendEmail(payload);
      case NotificationChannel.TELEGRAM:
        return this.sendTelegram(payload);
    }
  }

  private async sendInApp(payload: NotificationPayload): Promise<void> {
    this.logger.info(
      { userId: payload.userId, title: payload.title },
      'In-app notification queued',
    );
  }

  private async sendEmail(payload: NotificationPayload): Promise<void> {
    this.logger.info(
      { userId: payload.userId, title: payload.title },
      'Email notification queued',
    );
  }

  private async sendTelegram(payload: NotificationPayload): Promise<void> {
    if (!this.telegramBotToken || !this.telegramChatId) {
      this.logger.warn('Telegram config not available, skipping');
      return;
    }

    try {
      const message = `
*${payload.title}*
${payload.message}
Severity: ${payload.severity}
      `.trim();

      const url = `https://api.telegram.org/bot${this.telegramBotToken}/sendMessage`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: this.telegramChatId,
          text: message,
          parse_mode: 'Markdown',
        }),
      });

      if (!response.ok) {
        throw new Error(`Telegram API error: ${response.statusText}`);
      }

      this.logger.info({ userId: payload.userId }, 'Telegram notification sent');
    } catch (error) {
      this.logger.error({ error }, 'Failed to send Telegram notification');
      throw error;
    }
  }
}
