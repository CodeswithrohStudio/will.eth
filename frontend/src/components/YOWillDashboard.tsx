'use client';

import { useState, useEffect, useRef } from 'react';
import { useAccount } from 'wagmi';
import { useWillYOPosition, useDepositUSDCToYO, useEstateProjection, useUSDCBalance, useYOVaultState, useGuardianRedeem } from '@/hooks/useYO';
import { useWillState } from '@/hooks/useWill';
import { fmtUSD, getYOVault, YIELD_ASSETS } from '@/lib/yo-config';
import { formatDaysRemaining } from '@/lib/utils';
import { WillState } from '@/lib/types';
import { useChainId } from 'wagmi';

interface Props {
  willAddress: `0x${string}`;
}

// ─── Animated counter ────────────────────────────────────────────────────────
function AnimatedNumber({ value, prefix = '', suffix = '', decimals = 2, className = '' }: {
  value: number; prefix?: string; suffix?: string; decimals?: number; className?: string;
}) {
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);

  useEffect(() => {
    const start = prev.current;
    const end   = value;
    const delta = end - start;
    if (Math.abs(delta) < 0.000001) return;

    const duration = 800;
    const startTime = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setDisplay(start + delta * eased);
      if (progress < 1) requestAnimationFrame(tick);
      else prev.current = end;
    };

    requestAnimationFrame(tick);
  }, [value]);

  return (
    <span className={className}>
      {prefix}{display.toFixed(decimals)}{suffix}
    </span>
  );
}

// ─── Stat cell ────────────────────────────────────────────────────────────────
function StatCell({ icon, label, value, sub, highlight }: {
  icon: string; label: string; value: React.ReactNode; sub?: string; highlight?: 'green' | 'red' | 'amber';
}) {
  const colors: Record<string, string> = {
    green: 'text-green-400',
    red:   'text-red-400',
    amber: 'text-amber-400',
  };
  return (
    <div className="p-4 rounded-xl bg-gray-800/60 border border-gray-700/50 flex flex-col gap-1">
      <div className="text-xs text-gray-500 flex items-center gap-1.5">
        <span>{icon}</span>
        <span>{label}</span>
      </div>
      <div className={`text-xl font-bold ${highlight ? colors[highlight] : 'text-white'}`}>
        {value}
      </div>
      {sub && <div className="text-xs text-gray-500">{sub}</div>}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export function YOWillDashboard({ willAddress }: Props) {
  const { address } = useAccount();
  const chainId = useChainId();
  const yoVaultAddr = getYOVault(chainId, 'yoUSD');

  const yo      = useWillYOPosition(willAddress);
  const will    = useWillState(willAddress);
  const vault   = useYOVaultState(yoVaultAddr);
  const balance = useUSDCBalance(address);
  const proj    = useEstateProjection(yo.principalUSDC, yo.apy);
  const guardian = useGuardianRedeem(willAddress);

  const deposit = useDepositUSDCToYO(willAddress);

  const [depositAmount, setDepositAmount] = useState('');
  const [showDeposit, setShowDeposit]     = useState(false);
  const [showGuardian, setShowGuardian]   = useState(false);

  const state = will.state as WillState | undefined;
  const days  = will.daysUntilDeadline !== undefined ? Number(will.daysUntilDeadline) : 0;
  const isOverdue = days <= 0;

  // After approve confirms, trigger the deposit
  useEffect(() => {
    if (deposit.approveSuccess && depositAmount && parseFloat(depositAmount) > 0) {
      deposit.confirmDeposit(yoVaultAddr, depositAmount);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deposit.approveSuccess]);

  if (!yo.hasPosition && !showDeposit) {
    return (
      <div className="rounded-2xl border border-dashed border-purple-700/60 bg-gray-900/40 p-6">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl">⚡</span>
          <div>
            <div className="font-semibold text-white">Earn yield while you&apos;re alive</div>
            <div className="text-xs text-gray-400 mt-0.5">
              Deposit USDC → YO Protocol vault → ~{yo.apy}% APY on Base
            </div>
          </div>
          <button
            onClick={() => setShowDeposit(true)}
            className="ml-auto px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold transition-all"
          >
            Enable Yield
          </button>
        </div>

        {showDeposit && (
          <DepositForm
            depositAmount={depositAmount}
            setDepositAmount={setDepositAmount}
            yoVaultAddr={yoVaultAddr}
            deposit={deposit}
            balance={balance}
            apy={yo.apy}
            onClose={() => setShowDeposit(false)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-gray-700 bg-gray-900/60 overflow-hidden">
      {/* Card Header */}
      <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">📈</span>
          <span className="font-semibold text-white text-sm">YO Yield Vault</span>
          <span className="px-2 py-0.5 rounded-full bg-green-900/40 border border-green-700/50 text-green-400 text-xs font-bold">
            {yo.apy}% APY
          </span>
        </div>
        <a
          href={`https://app.yo.xyz`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-gray-500 hover:text-gray-400 transition-colors"
        >
          Powered by YO Protocol ↗
        </a>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 p-5">
        <StatCell
          icon="💰"
          label="Deposited"
          value={fmtUSD(yo.principalUSDC)}
          sub="Original USDC locked"
        />
        <StatCell
          icon="📈"
          label="Current Value"
          value={
            <AnimatedNumber
              value={yo.currentUSDC}
              prefix="$"
              decimals={2}
              className="text-white"
            />
          }
          sub="Principal + accrued yield"
          highlight={yo.currentUSDC > yo.principalUSDC ? 'green' : undefined}
        />
        <StatCell
          icon="🌱"
          label="Yield Earned"
          value={
            <AnimatedNumber
              value={yo.yieldUSDC}
              prefix="+$"
              decimals={4}
              className="text-green-400"
            />
          }
          sub="Growing every second"
          highlight="green"
        />
        <StatCell
          icon="📅"
          label={`Est. value at 70`}
          value={fmtUSD(proj.at70)}
          sub={`${proj.years}y @ ${yo.apy}% APY compound`}
          highlight="green"
        />

        {/* Check-in countdown */}
        <StatCell
          icon="⏱️"
          label="Next check-in"
          value={formatDaysRemaining(BigInt(days))}
          sub={will.deadline ? new Date(Number(will.deadline) * 1000).toLocaleDateString() : ''}
          highlight={isOverdue ? 'red' : days <= 3 ? 'amber' : undefined}
        />

        {/* Trigger risk */}
        <StatCell
          icon={isOverdue ? '🔴' : days <= 7 ? '🟡' : '🟢'}
          label="Trigger risk"
          value={isOverdue ? 'OVERDUE' : days <= 7 ? 'Amber — check in soon' : 'Low — you\'re safe'}
          highlight={isOverdue ? 'red' : days <= 7 ? 'amber' : 'green'}
        />
      </div>

      {/* Projection bar */}
      <div className="mx-5 mb-4 p-4 rounded-xl bg-gradient-to-r from-green-900/20 to-emerald-900/20 border border-green-800/40">
        <div className="text-xs text-gray-400 mb-2">Estate growth projection</div>
        <div className="flex items-end gap-3">
          {[
            { label: 'Now',  value: yo.principalUSDC },
            { label: '5y',   value: proj.at5y },
            { label: '10y',  value: proj.at10y },
            { label: '35y',  value: proj.at70 },
          ].map((pt, i) => {
            const maxVal = proj.at70 || 1;
            const pct    = Math.max(8, (pt.value / maxVal) * 100);
            return (
              <div key={i} className="flex flex-col items-center gap-1 flex-1">
                <div className="text-xs text-green-400 font-bold">{fmtUSD(pt.value)}</div>
                <div
                  className="w-full rounded-t-sm bg-gradient-to-t from-green-700 to-green-400 transition-all"
                  style={{ height: `${pct * 0.6}px` }}
                />
                <div className="text-xs text-gray-500">{pt.label}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Actions */}
      <div className="px-5 pb-5 space-y-2">
        <button
          onClick={() => setShowDeposit(!showDeposit)}
          className="w-full py-2.5 rounded-xl border border-gray-600 text-gray-300 hover:text-white text-sm transition-colors"
        >
          + Add More USDC
        </button>

        {showDeposit && (
          <DepositForm
            depositAmount={depositAmount}
            setDepositAmount={setDepositAmount}
            yoVaultAddr={yoVaultAddr}
            deposit={deposit}
            balance={balance}
            apy={yo.apy}
            onClose={() => setShowDeposit(false)}
          />
        )}

        <button
          onClick={() => setShowGuardian(!showGuardian)}
          className="w-full py-2 text-gray-500 hover:text-gray-400 text-xs transition-colors"
        >
          ⛑️ Guardian settings
        </button>

        {showGuardian && (
          <GuardianSection willAddress={willAddress} guardian={guardian} />
        )}
      </div>
    </div>
  );
}

// ─── Deposit form sub-component ───────────────────────────────────────────────
function DepositForm({ depositAmount, setDepositAmount, yoVaultAddr, deposit, balance, apy, onClose }: {
  depositAmount: string;
  setDepositAmount: (v: string) => void;
  yoVaultAddr: `0x${string}`;
  deposit: ReturnType<typeof useDepositUSDCToYO>;
  balance: { formatted: number };
  apy: number;
  onClose: () => void;
}) {
  const proj10 = depositAmount
    ? (parseFloat(depositAmount) * Math.pow(1 + apy / 100, 10)).toFixed(2)
    : '0.00';

  if (deposit.depositSuccess) {
    return (
      <div className="p-4 rounded-xl bg-green-900/20 border border-green-700 text-center space-y-1">
        <div className="text-2xl">✅</div>
        <div className="text-green-400 font-bold">USDC deposited into YO vault!</div>
        <div className="text-xs text-gray-400">Your estate is now earning yield.</div>
        <button onClick={onClose} className="text-xs text-gray-500 hover:text-gray-300 underline mt-1">
          Close
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 rounded-xl border border-gray-700 bg-gray-800/50 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-white">Deposit USDC</span>
        <span className="text-xs text-gray-400">Balance: ${balance.formatted.toFixed(2)}</span>
      </div>

      <div className="flex items-center gap-2 p-3 rounded-xl bg-gray-900 border border-gray-700 focus-within:border-purple-500 transition-colors">
        <span className="text-gray-400 text-sm font-mono">USDC</span>
        <input
          type="number"
          step="1"
          min="1"
          placeholder="100"
          value={depositAmount}
          onChange={e => setDepositAmount(e.target.value)}
          className="flex-1 bg-transparent text-white text-lg font-bold focus:outline-none text-right"
        />
      </div>

      {depositAmount && parseFloat(depositAmount) > 0 && (
        <div className="text-xs text-green-400">
          📈 In 10 years at {apy}% APY → <strong>${proj10}</strong> for your heirs
        </div>
      )}

      <div className="text-xs text-gray-500 bg-gray-900/50 rounded-lg p-2">
        <span className="text-purple-400 font-medium">2-step:</span> First approves USDC, then deposits into the YO yoUSD vault on Base.
      </div>

      {!deposit.approveSuccess ? (
        <button
          onClick={() => depositAmount && deposit.depositUSDC(yoVaultAddr, depositAmount)}
          disabled={deposit.isApproving || !depositAmount || parseFloat(depositAmount) <= 0}
          className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-bold text-sm transition-all"
        >
          {deposit.isApproving
            ? <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Approving USDC...</span>
            : '1 of 2 — Approve USDC'}
        </button>
      ) : (
        <button
          onClick={() => deposit.confirmDeposit(yoVaultAddr, depositAmount)}
          disabled={deposit.isDepositing}
          className="w-full py-3 rounded-xl bg-green-600 hover:bg-green-500 disabled:bg-gray-700 text-white font-bold text-sm transition-all"
        >
          {deposit.isDepositing
            ? <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Depositing into YO...</span>
            : '2 of 2 — Deposit into YO Vault'}
        </button>
      )}
    </div>
  );
}

// ─── Guardian sub-component ───────────────────────────────────────────────────
function GuardianSection({ willAddress, guardian }: {
  willAddress: `0x${string}`;
  guardian: ReturnType<typeof useGuardianRedeem>;
}) {
  const [guardianInput, setGuardianInput] = useState('');

  return (
    <div className="p-4 rounded-xl border border-gray-700 bg-gray-800/40 space-y-3 text-sm">
      <div className="font-medium text-white">⛑️ Emergency Guardian</div>
      <p className="text-xs text-gray-400">
        A guardian can emergency-redeem your YO position with a 48-hour timelock.
        Use this for a trusted family member or lawyer.
      </p>

      {!guardian.guardian || guardian.guardian === '0x0000000000000000000000000000000000000000' ? (
        <div className="space-y-2">
          <input
            type="text"
            placeholder="Guardian address (0x...)"
            value={guardianInput}
            onChange={e => setGuardianInput(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-gray-900 border border-gray-700 text-white text-xs focus:outline-none focus:border-purple-500"
          />
          <button
            onClick={() => guardianInput && guardian.setGuardian(guardianInput as `0x${string}`)}
            disabled={guardian.isSettingGuardian || !guardianInput}
            className="w-full py-2 rounded-xl bg-gray-700 hover:bg-gray-600 text-white text-xs font-medium disabled:opacity-50 transition-all"
          >
            {guardian.isSettingGuardian ? 'Setting...' : 'Set Guardian'}
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-gray-400">Guardian</span>
            <span className="text-white font-mono">{guardian.guardian.slice(0, 8)}...{guardian.guardian.slice(-4)}</span>
          </div>

          {!guardian.hasPendingRedeem ? (
            <button
              onClick={guardian.initiateRedeem}
              disabled={guardian.isInitiating}
              className="w-full py-2 rounded-xl border border-amber-700 text-amber-400 hover:bg-amber-900/20 text-xs font-medium disabled:opacity-50 transition-all"
            >
              {guardian.isInitiating ? 'Initiating...' : 'Initiate Emergency Redeem (48h timelock)'}
            </button>
          ) : (
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-amber-400">⏳ Redeem unlocks in</span>
                <span className="text-white font-bold">{guardian.hoursLeft}h remaining</span>
              </div>
              {guardian.isUnlocked && (
                <button
                  onClick={guardian.executeRedeem}
                  disabled={guardian.isExecuting}
                  className="w-full py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold disabled:opacity-50 transition-all"
                >
                  {guardian.isExecuting ? 'Executing...' : 'Execute Guardian Redeem'}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
