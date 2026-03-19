import TelegramBot from 'node-telegram-bot-api';
import { config } from '../config';

let bot: TelegramBot | null = null;

/* ── Lazy singleton ─────────────────────────────────────────────────── */
export function getBot(): TelegramBot {
  if (!bot) {
    bot = new TelegramBot(config.telegram.botToken, { polling: true });
    console.log('[Telegram] Bot started with long polling');
  }
  return bot;
}

/* ── Outbound messages ──────────────────────────────────────────────── */

export async function sendCheckInReminder(
  chatId: string,
  willAddress: string,
  daysRemaining: number
): Promise<void> {
  const urgencyPrefix =
    daysRemaining <= 1 ? '🚨 *URGENT* — ' :
    daysRemaining <= 3 ? '⏰ ' : '';

  const text =
    `${urgencyPrefix}*will\\.eth Check\\-In Required*\n\n` +
    `Your crypto inheritance will trigger in *${daysRemaining} day${daysRemaining !== 1 ? 's' : ''}* if you don't check in\\.\n\n` +
    `Reply *ALIVE* right now to reset the clock and protect your family's inheritance\\.\n\n` +
    `Will: \`${willAddress.slice(0, 10)}…\`\n` +
    `Dashboard: https://willeth\\.xyz/dashboard`;

  await getBot().sendMessage(chatId, text, { parse_mode: 'MarkdownV2' });
  console.log(`[Telegram] Sent check-in reminder to chatId ${chatId} (${daysRemaining} days)`);
}

export async function sendTriggerAlert(
  chatId: string,
  willAddress: string,
  heirs: string[]
): Promise<void> {
  const text =
    `🔔 *will\\.eth — Distribution Triggered*\n\n` +
    `A will has been triggered for distribution\\.\n\n` +
    `Will: \`${willAddress}\`\n\n` +
    `Heirs can now claim at:\n` +
    `https://willeth\\.xyz/claim?will=${willAddress}\n\n` +
    heirs.map(h => `• ${h.replace(/[._-]/g, '\\$&')}`).join('\n');

  await getBot().sendMessage(chatId, text, { parse_mode: 'MarkdownV2' });
}

export async function sendCheckInConfirmation(
  chatId: string,
  nextDeadline: Date
): Promise<void> {
  const dateStr = nextDeadline.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const text =
    `✅ *Checked in\\!* Your will is safe\\.\n\n` +
    `Next deadline: *${dateStr}*\n\n` +
    `Your estate keeps earning yield while you're alive\\. ` +
    `Manage at: https://willeth\\.xyz/dashboard`;

  await getBot().sendMessage(chatId, text, { parse_mode: 'MarkdownV2' });
}

export async function sendWelcome(chatId: string): Promise<void> {
  const text =
    `👋 *Welcome to will\\.eth\\!*\n\n` +
    `I protect your crypto inheritance on Base using a dead man's switch\\.\n\n` +
    `*To register*, send me your wallet address:\n` +
    `\`0x1234\\.\\.\\.abcd\`\n\n` +
    `I'll remind you before each check\\-in deadline\\. ` +
    `Reply *ALIVE* anytime — that counts as a check\\-in\\. No app needed\\.`;

  await getBot().sendMessage(chatId, text, { parse_mode: 'MarkdownV2' });
}
