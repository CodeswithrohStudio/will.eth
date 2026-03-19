import { createPublicClient, createWalletClient, http, parseAbi } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import Database from 'better-sqlite3';
import { config } from '../config';
import { sendCheckInReminder, sendTriggerAlert } from '../whatsapp/twilioBot';
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

// WillState enum
const WillState = {
  ACTIVE: 0,
  TRIGGERABLE: 1,
  DISTRIBUTING: 2,
  REVOKED: 3,
} as const;

let db: Database.Database;

export function initDB(dbPath: string) {
  db = new Database(dbPath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS phone_registrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      wallet_address TEXT NOT NULL UNIQUE,
      phone_number TEXT NOT NULL,
      created_at INTEGER DEFAULT (strftime('%s', 'now'))
    );
    CREATE TABLE IF NOT EXISTS reminder_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      will_address TEXT NOT NULL,
      phone_number TEXT NOT NULL,
      sent_at INTEGER DEFAULT (strftime('%s', 'now')),
      days_remaining INTEGER
    );
  `);
  console.log('[DB] Initialized at', dbPath);
}

export function registerPhone(walletAddress: string, phoneNumber: string) {
  const stmt = db.prepare(
    'INSERT OR REPLACE INTO phone_registrations (wallet_address, phone_number) VALUES (?, ?)'
  );
  stmt.run(walletAddress.toLowerCase(), phoneNumber);
}

function getPhoneForWallet(walletAddress: string): string | null {
  const row = db.prepare(
    'SELECT phone_number FROM phone_registrations WHERE wallet_address = ?'
  ).get(walletAddress.toLowerCase()) as { phone_number: string } | undefined;
  return row?.phone_number || null;
}

function wasRecentlyReminded(willAddress: string, daysWithin: number): boolean {
  const cutoff = Math.floor(Date.now() / 1000) - daysWithin * 24 * 60 * 60;
  const row = db.prepare(
    'SELECT id FROM reminder_log WHERE will_address = ? AND sent_at > ?'
  ).get(willAddress, cutoff);
  return !!row;
}

function logReminder(willAddress: string, phoneNumber: string, daysRemaining: number) {
  db.prepare(
    'INSERT INTO reminder_log (will_address, phone_number, days_remaining) VALUES (?, ?, ?)'
  ).run(willAddress, phoneNumber, daysRemaining);
}

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

      const testatorPhone = getPhoneForWallet(testator);

      // Send reminder if deadline is approaching
      if ((state === WillState.ACTIVE || state === WillState.TRIGGERABLE) && testatorPhone) {
        const shouldRemind =
          (daysRemaining <= 7 && !wasRecentlyReminded(willAddress, 3)) ||
          (daysRemaining <= 1 && !wasRecentlyReminded(willAddress, 1));

        if (shouldRemind) {
          await sendCheckInReminder(testatorPhone, willAddress, Math.max(0, daysRemaining));
          logReminder(willAddress, testatorPhone, daysRemaining);
          console.log(`[Monitor] Sent reminder for ${willAddress} (${daysRemaining} days)`);
        }
      }

      // Notify heirs if distributing
      if (state === WillState.DISTRIBUTING) {
        for (const b of beneficiaries) {
          const heirPhone = getPhoneForWallet(b.wallet);
          if (heirPhone && !b.hasClaimed && !wasRecentlyReminded(`${willAddress}-${b.wallet}`, 1)) {
            const ensName = b.ensName || await reverseResolve(b.wallet) || b.wallet;
            await sendTriggerAlert(heirPhone, willAddress, [ensName]);
            logReminder(`${willAddress}-${b.wallet}`, heirPhone, 0);
          }
        }
      }
    } catch (err) {
      console.error(`[Monitor] Error processing will ${willAddress}:`, err);
    }
  }

  console.log('[Monitor] Run complete');
}

// On-chain check-in via relayer wallet
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
