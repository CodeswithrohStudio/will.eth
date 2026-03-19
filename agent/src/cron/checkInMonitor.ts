import { createPublicClient, createWalletClient, http, parseAbi } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import Database from 'better-sqlite3';
import { config } from '../config';
import { sendCheckInReminder, sendTriggerAlert, sendCheckInConfirmation } from '../telegram/telegramBot';
import { reverseResolve } from '../ens/resolver';

const REGISTRY_ABI = parseAbi([
  'function getAllWills() view returns (address[])',
  'function isRegisteredWill(address) view returns (bool)',
]);

const WILL_ABI = parseAbi([
  'function testator() view returns (address)',
  'function getState() view returns (uint8)',
  'function deadline() view returns (uint256)',
  'function checkInInterval() view returns (uint256)',
  'function lastCheckIn() view returns (uint256)',
  'function isTriggerable() view returns (bool)',
  'function getBeneficiaries() view returns ((address wallet, string ensName, uint256 basisPoints, bool hasClaimed, uint256 nullifierUsed)[])',
  'function checkIn()',
]);

const WillState = {
  ACTIVE: 0,
  TRIGGERABLE: 1,
  DISTRIBUTING: 2,
  REVOKED: 3,
} as const;

let db: Database.Database;

/* ── DB init ─────────────────────────────────────────────────────────── */
export function initDB(dbPath: string) {
  db = new Database(dbPath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS telegram_registrations (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      wallet_address TEXT NOT NULL UNIQUE,
      chat_id        TEXT NOT NULL,
      created_at     INTEGER DEFAULT (strftime('%s', 'now'))
    );
    CREATE TABLE IF NOT EXISTS reminder_log (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      will_address TEXT NOT NULL,
      chat_id      TEXT NOT NULL,
      sent_at      INTEGER DEFAULT (strftime('%s', 'now')),
      days_remaining INTEGER
    );
  `);
  console.log('[DB] Initialized at', dbPath);
}

/* ── Registration ────────────────────────────────────────────────────── */
export function registerChatId(walletAddress: string, chatId: string) {
  db.prepare(
    'INSERT OR REPLACE INTO telegram_registrations (wallet_address, chat_id) VALUES (?, ?)'
  ).run(walletAddress.toLowerCase(), chatId);
  console.log(`[DB] Registered chatId ${chatId} for wallet ${walletAddress}`);
}

export function getChatIdForWallet(walletAddress: string): string | null {
  const row = db.prepare(
    'SELECT chat_id FROM telegram_registrations WHERE wallet_address = ?'
  ).get(walletAddress.toLowerCase()) as { chat_id: string } | undefined;
  return row?.chat_id || null;
}

export function getWalletForChatId(chatId: string): string | null {
  const row = db.prepare(
    'SELECT wallet_address FROM telegram_registrations WHERE chat_id = ?'
  ).get(chatId) as { wallet_address: string } | undefined;
  return row?.wallet_address || null;
}

/* ── Reminder dedup ──────────────────────────────────────────────────── */
function wasRecentlyReminded(willAddress: string, daysWithin: number): boolean {
  const cutoff = Math.floor(Date.now() / 1000) - daysWithin * 24 * 60 * 60;
  const row = db.prepare(
    'SELECT id FROM reminder_log WHERE will_address = ? AND sent_at > ?'
  ).get(willAddress, cutoff);
  return !!row;
}

function logReminder(willAddress: string, chatId: string, daysRemaining: number) {
  db.prepare(
    'INSERT INTO reminder_log (will_address, chat_id, days_remaining) VALUES (?, ?, ?)'
  ).run(willAddress, chatId, daysRemaining);
}

/* ── ALIVE message handler (called by Telegram bot handler) ──────────── */
export async function processAliveMessage(chatId: string): Promise<void> {
  const walletAddress = getWalletForChatId(chatId);
  if (!walletAddress) {
    console.log(`[Monitor] ALIVE from unregistered chatId ${chatId}`);
    return;
  }

  // Send confirmation — actual on-chain check-in is done via the dashboard
  // (bot doesn't hold a relayer key in basic setup; user taps "Check In" in app)
  const nextDeadline = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await sendCheckInConfirmation(chatId, nextDeadline);
  console.log(`[Monitor] Processed ALIVE from ${walletAddress}`);
}

/* ── Main monitor loop ───────────────────────────────────────────────── */
export async function runCheckInMonitor() {
  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(config.baseSepolia.rpc),
  });

  console.log('[Monitor] Starting check-in monitor run...');

  let allWills: readonly `0x${string}`[];
  try {
    allWills = await publicClient.readContract({
      address: config.contracts.registry,
      abi: REGISTRY_ABI,
      functionName: 'getAllWills',
    });
  } catch (err) {
    console.error('[Monitor] Failed to fetch wills:', err);
    return;
  }

  console.log(`[Monitor] Found ${allWills.length} wills`);

  for (const willAddress of allWills) {
    try {
      const [state, deadlineTs, testator, beneficiaries] = await Promise.all([
        publicClient.readContract({ address: willAddress, abi: WILL_ABI, functionName: 'getState' }),
        publicClient.readContract({ address: willAddress, abi: WILL_ABI, functionName: 'deadline' }),
        publicClient.readContract({ address: willAddress, abi: WILL_ABI, functionName: 'testator' }),
        publicClient.readContract({ address: willAddress, abi: WILL_ABI, functionName: 'getBeneficiaries' }),
      ]);

      const now = Math.floor(Date.now() / 1000);
      const deadline = Number(deadlineTs);
      const daysRemaining = Math.ceil((deadline - now) / 86400);

      const testatorChatId = getChatIdForWallet(testator);

      // Remind testator if deadline approaching
      if ((state === WillState.ACTIVE || state === WillState.TRIGGERABLE) && testatorChatId) {
        const shouldRemind =
          (daysRemaining <= 7 && !wasRecentlyReminded(willAddress, 3)) ||
          (daysRemaining <= 1 && !wasRecentlyReminded(willAddress, 1));

        if (shouldRemind) {
          await sendCheckInReminder(testatorChatId, willAddress, Math.max(0, daysRemaining));
          logReminder(willAddress, testatorChatId, daysRemaining);
          console.log(`[Monitor] Sent reminder for ${willAddress} (${daysRemaining} days)`);
        }
      }

      // Notify heirs if distributing
      if (state === WillState.DISTRIBUTING) {
        for (const b of beneficiaries) {
          const heirChatId = getChatIdForWallet(b.wallet);
          if (heirChatId && !b.hasClaimed && !wasRecentlyReminded(`${willAddress}-${b.wallet}`, 1)) {
            const ensName = b.ensName || await reverseResolve(b.wallet) || b.wallet;
            await sendTriggerAlert(heirChatId, willAddress, [ensName]);
            logReminder(`${willAddress}-${b.wallet}`, heirChatId, 0);
          }
        }
      }
    } catch (err) {
      console.error(`[Monitor] Error processing will ${willAddress}:`, err);
    }
  }

  console.log('[Monitor] Run complete');
}

/* ── On-chain check-in via relayer ───────────────────────────────────── */
export async function relayCheckIn(willAddress: `0x${string}`) {
  if (!config.baseSepolia.relayerKey) {
    throw new Error('No relayer key configured');
  }

  const account = privateKeyToAccount(config.baseSepolia.relayerKey);
  const walletClient = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(config.baseSepolia.rpc),
  });

  const hash = await walletClient.writeContract({
    address: willAddress,
    abi: WILL_ABI,
    functionName: 'checkIn',
  });

  console.log(`[Relayer] Check-in tx: ${hash}`);
  return hash;
}
