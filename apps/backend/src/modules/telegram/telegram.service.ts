import { config } from '../../config/index.js';
import { logger } from '../../utils/logger.js';

export class TelegramService {
  private botToken: string;
  private isConfigured: boolean;

  constructor() {
    this.botToken = config.TELEGRAM_BOT_TOKEN;
    this.isConfigured = Boolean(this.botToken && this.botToken.length > 10);
    if (!this.isConfigured) {
      logger.info('Telegram Bot is not configured. Telegram notifications will be logged to console.');
    }
  }

  async sendMessage(chatId: string, text: string, parseMode = 'HTML'): Promise<boolean> {
    if (!this.isConfigured) {
      logger.info({ chatId, text }, '[Mock Telegram] Notification sent');
      return true;
    }

    try {
      const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: parseMode,
          disable_web_page_preview: true,
        }),
      });

      if (!response.ok) {
        const errBody = await response.text();
        logger.error({ status: response.status, errBody }, 'Telegram API error');
        return false;
      }

      return true;
    } catch (error) {
      logger.error({ error }, 'Failed to deliver Telegram notification');
      return false;
    }
  }

  async sendReminderNotification(chatId: string, reminderTitle: string, scheduledAt: Date): Promise<boolean> {
    const formattedDate = scheduledAt.toLocaleString('en-US', { timeZone: config.DEFAULT_TIMEZONE });
    const text = `⏰ <b>Reminder Alert</b>\n\n📌 <b>${reminderTitle}</b>\n🕒 <i>Time: ${formattedDate}</i>\n\n<i>From your AI Robot Assistant</i>`;
    return this.sendMessage(chatId, text);
  }

  async sendDeviceOfflineAlert(chatId: string, deviceName: string, lastSeen: Date): Promise<boolean> {
    const formatted = lastSeen.toLocaleString('en-US', { timeZone: config.DEFAULT_TIMEZONE });
    const text = `⚠️ <b>Robot Alert</b>\n\n🤖 <b>${deviceName}</b> has gone offline.\n🕒 <i>Last seen: ${formatted}</i>`;
    return this.sendMessage(chatId, text);
  }
}

export const telegramService = new TelegramService();
