import { createPublicClient, createWalletClient, http, parseAbi } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import { config } from '../config';
import { registrationsCol, reminderLogCol } from '../db/mongo';
import { sendCheckInReminder, sendTriggerAlert, sendCheckInConfirmation } from '../telegram/telegramBot';
import { reverseResolve } from '../ens/resolver';

const REGISTRY_ABI = parseAbi([
  'function getAllWills() view returns (address[])',
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

const WillState = { ACTIVE: 0, TRIGGERABLE: 1, DISTRIBUTING: 2, REVOKED: 3 } as const;

/* ── Registration ────────────────────────────────────────────────────── */
export async function registerChatId(walletAddress: string, chatId: string) {
  const col = await registrationsCol();
  await col.updateOne(
    { walletAddress: walletAddress.toLowerCase() },
    { $set: { walletAddress: walletAddress.toLowerCase(), chatId, createdAt: new Date() } },
    { upsert: true }
  );
  console.log(`[DB] Registered chatId ${chatId} for wallet ${walletAddress}`);
}

export async function getChatIdForWallet(walletAddress: string): Promise<string | null> {
  const col = await registrationsCol();
  const doc = await col.findOne({ walletAddress: walletAddress.toLowerCase() });
  return doc?.chatId ?? null;
}

export async function getWalletForChatId(chatId: string): Promise<string | null> {
  const col = await registrationsCol();
  const doc = await col.findOne({ chatId });
  return doc?.walletAddress ?? null;
}

/* ── Reminder dedup ──────────────────────────────────────────────────── */
async function wasRecentlyReminded(willAddress: string, daysWithin: number): Promise<boolean> {
  const col = await reminderLogCol();
  const cutoff = new Date(Date.now() - daysWithin * 24 * 60 * 60 * 1000);
  const doc = await col.findOne({ willAddress, sentAt: { $gt: cutoff } });
  return !!doc;
}

async function logReminder(willAddress: string, chatId: string, daysRemaining: number) {
  const col = await reminderLogCol();
  await col.insertOne({ willAddress, chatId, sentAt: new Date(), daysRemaining });
}

/* ── ALIVE handler ───────────────────────────────────────────────────── */
export async function processAliveMessage(chatId: string): Promise<void> {
  const walletAddress = await getWalletForChatId(chatId);
  if (!walletAddress) {
    console.log(`[Monitor] ALIVE from unregistered chatId ${chatId}`);
    return;
  }
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
      const daysRemaining = Math.ceil((Number(deadlineTs) - now) / 86400);
      const testatorChatId = await getChatIdForWallet(testator);

      // Remind testator if deadline approaching
      if ((state === WillState.ACTIVE || state === WillState.TRIGGERABLE) && testatorChatId) {
        const shouldRemind =
          (daysRemaining <= 7 && !(await wasRecentlyReminded(willAddress, 3))) ||
          (daysRemaining <= 1 && !(await wasRecentlyReminded(willAddress, 1)));

        if (shouldRemind) {
          await sendCheckInReminder(testatorChatId, willAddress, Math.max(0, daysRemaining));
          await logReminder(willAddress, testatorChatId, daysRemaining);
          console.log(`[Monitor] Sent reminder for ${willAddress} (${daysRemaining} days)`);
        }
      }

      // Notify heirs if distributing
      if (state === WillState.DISTRIBUTING) {
        for (const b of beneficiaries) {
          const heirChatId = await getChatIdForWallet(b.wallet);
          const key = `${willAddress}-${b.wallet}`;
          if (heirChatId && !b.hasClaimed && !(await wasRecentlyReminded(key, 1))) {
            const ensName = b.ensName || await reverseResolve(b.wallet) || b.wallet;
            await sendTriggerAlert(heirChatId, willAddress, [ensName]);
            await logReminder(key, heirChatId, 0);
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
  if (!config.baseSepolia.relayerKey) throw new Error('No relayer key configured');

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
