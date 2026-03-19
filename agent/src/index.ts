import express from 'express';
import cron from 'node-cron';
import { config } from './config';
import {
  runCheckInMonitor,
  registerChatId,
  processAliveMessage,
  getWalletForChatId,
} from './cron/checkInMonitor';
import { getBot, sendWelcome } from './telegram/telegramBot';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Start Telegram bot (long polling)
const bot = getBot();

/* ── Telegram message handlers ─────────────────────────────────────── */

bot.onText(/\/start/, async (msg) => {
  await sendWelcome(String(msg.chat.id));
});

bot.onText(/\/help/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
    `*will\\.eth Bot Help*\n\n` +
    `• Send your wallet address \\(0x\\.\\.\\.\\) to register\n` +
    `• Reply *ALIVE* to check in\n` +
    `• /status — see your registered wallet\n` +
    `• /dashboard — link to your dashboard`,
    { parse_mode: 'MarkdownV2' }
  );
});

bot.onText(/\/status/, async (msg) => {
  const wallet = await getWalletForChatId(String(msg.chat.id));
  if (wallet) {
    bot.sendMessage(msg.chat.id, `✅ Registered wallet:\n\`${wallet}\``, { parse_mode: 'MarkdownV2' });
  } else {
    bot.sendMessage(msg.chat.id, 'No wallet registered yet\\. Send your wallet address to register\\.', { parse_mode: 'MarkdownV2' });
  }
});

bot.onText(/\/dashboard/, (msg) => {
  bot.sendMessage(msg.chat.id, 'Open your dashboard: https://willeth.xyz/dashboard');
});

// Wallet address registration
bot.onText(/^(0x[a-fA-F0-9]{40})$/, async (msg, match) => {
  const chatId = String(msg.chat.id);
  const walletAddress = match![1];
  await registerChatId(walletAddress, chatId);
  bot.sendMessage(
    msg.chat.id,
    `✅ *Wallet registered\\!*\n\n` +
    `\`${walletAddress}\`\n\n` +
    `I'll remind you before each check\\-in deadline\\. ` +
    `Reply *ALIVE* anytime — that counts as a check\\-in\\. No app needed\\.`,
    { parse_mode: 'MarkdownV2' }
  );
});

// ALIVE → check-in confirmation
bot.onText(/^ALIVE$/i, async (msg) => {
  try {
    await processAliveMessage(String(msg.chat.id));
  } catch (err) {
    console.error('[Bot] Error processing ALIVE:', err);
    bot.sendMessage(msg.chat.id, '❌ Something went wrong. Please try again or check in via the dashboard.');
  }
});

// Fallback
bot.on('message', (msg) => {
  const text = msg.text || '';
  if (/^\//.test(text) || /^0x[a-fA-F0-9]{40}$/.test(text) || /^ALIVE$/i.test(text)) return;
  bot.sendMessage(
    msg.chat.id,
    'Send your wallet address \\(0x\\.\\.\\.\\) to register, or reply *ALIVE* to check in\\.',
    { parse_mode: 'MarkdownV2' }
  );
});

/* ── HTTP API ──────────────────────────────────────────────────────── */

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

app.post('/register', async (req, res) => {
  const { walletAddress, chatId } = req.body;
  if (!walletAddress || !chatId) {
    return res.status(400).json({ error: 'walletAddress and chatId required' });
  }
  await registerChatId(walletAddress, chatId);
  res.json({ success: true });
});

app.post('/monitor/run', async (_req, res) => {
  runCheckInMonitor().catch(console.error);
  res.json({ success: true, message: 'Monitor run started' });
});

/* ── Cron: every 6 hours ───────────────────────────────────────────── */
cron.schedule('0 */6 * * *', () => {
  console.log('[Cron] Running check-in monitor...');
  runCheckInMonitor().catch(console.error);
});

setTimeout(() => {
  console.log('[Startup] Running initial monitor check...');
  runCheckInMonitor().catch(console.error);
}, 10_000);

app.listen(config.port, () => {
  console.log(`[Agent] will.eth agent running on port ${config.port}`);
  console.log(`[Agent] Telegram bot active`);
  console.log(`[Agent] Registry: ${config.contracts.registry}`);
});

export default app;
