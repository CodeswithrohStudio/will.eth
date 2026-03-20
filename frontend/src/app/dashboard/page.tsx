'use client';

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { formatEther } from 'viem';
import { useTestatorWills } from '@/hooks/useWillRegistry';
import { useWillState, useCheckIn, useTrigger, useDepositETH, useRevoke } from '@/hooks/useWill';
import { WillState, WILL_STATE_LABELS } from '@/lib/types';
import { formatDaysRemaining, bpsToPercent, shortenAddress } from '@/lib/utils';
import { YOWillDashboard } from '@/components/YOWillDashboard';
import Link from 'next/link';

/* ── State badge ─────────────────────────────────────────────────────── */
function StateBadge({ state }: { state: WillState | undefined }) {
  if (state === undefined) return <div className="w-20 h-5 rounded-full bg-white/[0.06] shimmer" />;
  const map: Record<WillState, { label: string; cls: string }> = {
    [WillState.ACTIVE]:       { label: 'Active',       cls: 'bg-green-500/10 text-green-400 border-green-500/30' },
    [WillState.TRIGGERABLE]:  { label: 'Overdue!',     cls: 'bg-red-500/10 text-red-400 border-red-500/30 pulse-red' },
    [WillState.DISTRIBUTING]: { label: 'Distributing', cls: 'bg-amber-500/10 text-amber-400 border-amber-500/30' },
    [WillState.REVOKED]:      { label: 'Revoked',      cls: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/30' },
  };
  const { label, cls } = map[state] ?? { label: WILL_STATE_LABELS[state], cls: '' };
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-semibold ${cls}`}>
      {state === WillState.ACTIVE && <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />}
      {label}
    </span>
  );
}

/* ── Countdown ring ──────────────────────────────────────────────────── */
function CountdownRing({ days, total }: { days: number; total: number }) {
  const pct = Math.max(0, Math.min(1, days / total));
  const r = 26, circ = 2 * Math.PI * r;
  const urgent = days <= 3;
  return (
    <div className="relative w-16 h-16 flex-shrink-0">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="5" />
        <circle
          cx="32" cy="32" r={r} fill="none"
          stroke={urgent ? '#f43f5e' : '#22C55E'}
          strokeWidth="5"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - pct)}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-xs font-bold num leading-none ${urgent ? 'text-red-400' : 'text-white'}`}>{days}</span>
        <span className="text-[9px] text-zinc-600 leading-none">days</span>
      </div>
    </div>
  );
}

/* ── Will card ───────────────────────────────────────────────────────── */
function WillCard({ willAddress }: { willAddress: `0x${string}` }) {
  const will = useWillState(willAddress);
  const { checkIn, isPending: checkingIn, isConfirming: confirmingCheckIn, isSuccess: checkedIn } = useCheckIn(willAddress);
  const { trigger, isPending: triggering, isConfirming: confirmingTrigger } = useTrigger(willAddress);
  const { revoke, isPending: revoking } = useRevoke(willAddress);
  const { depositETH } = useDepositETH(willAddress);

  const [showDeposit, setShowDeposit] = useState(false);
  const [depositAmt, setDepositAmt] = useState('');
  const [yieldDisplay, setYieldDisplay] = useState(0);

  useEffect(() => {
    if (!will.depositedShares) return;
    const target = parseFloat(formatEther(will.depositedShares)) * 0.05
      * (Date.now() / 1000 - Number(will.lastCheckIn || 0)) / (365 * 24 * 60 * 60);
    let current = 0;
    const iv = setInterval(() => {
      current += target / 80;
      if (current >= target) { setYieldDisplay(target); clearInterval(iv); }
      else setYieldDisplay(current);
    }, 20);
    return () => clearInterval(iv);
  }, [will.depositedShares, will.lastCheckIn]);

  const state = will.state as WillState | undefined;
  const days = will.daysUntilDeadline !== undefined ? Number(will.daysUntilDeadline) : 0;
  const urgent = days <= 3 && state === WillState.ACTIVE;

  return (
    <div className={`card card-hover space-y-0 overflow-hidden transition-all ${
      urgent ? 'border-red-600/40 shadow-lg shadow-red-900/20' :
      state === WillState.TRIGGERABLE ? 'border-red-500/30' :
      state === WillState.ACTIVE ? 'border-green-700/20' : ''
    }`}>

      {/* Header */}
      <div className="p-5 border-b border-white/[0.04] flex items-center justify-between gap-4">
        <a
          href={`https://sepolia.basescan.org/address/${willAddress}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-zinc-500 font-mono hover:text-green-400 transition-colors"
        >
          {shortenAddress(willAddress)} ↗
        </a>
        <StateBadge state={state} />
      </div>

      {/* Body */}
      <div className="p-5 space-y-5">

        {/* Yield counter */}
        {will.depositedShares && will.depositedShares > 0n && (
          <div className="flex items-center gap-4 p-4 rounded-xl bg-green-950/30 border border-green-800/25">
            <div className="flex-1 min-w-0">
              <div className="text-xs text-green-500 font-semibold mb-0.5">Yield earned</div>
              <div className="text-2xl font-bold text-green-400 num">
                +{yieldDisplay.toFixed(6)} ETH
              </div>
              <div className="text-xs text-zinc-600 mt-0.5">
                Principal: {formatEther(will.depositedShares)} ETH
              </div>
            </div>
            <div className="text-2xl opacity-30">📈</div>
          </div>
        )}

        {/* Countdown */}
        {state === WillState.ACTIVE && (
          <div className={`flex items-center gap-4 p-4 rounded-xl border ${
            urgent ? 'bg-red-950/30 border-red-700/35' : 'bg-white/[0.02] border-white/[0.06]'
          }`}>
            <CountdownRing days={days} total={30} />
            <div>
              <div className={`text-xs font-semibold mb-0.5 ${urgent ? 'text-red-400' : 'text-zinc-400'}`}>
                {urgent ? '⚠ Check in soon' : 'Next check-in deadline'}
              </div>
              <div className={`text-[17px] font-bold ${urgent ? 'text-red-300' : 'text-white'}`}>
                {formatDaysRemaining(BigInt(days))}
              </div>
            </div>
          </div>
        )}

        {/* Overdue */}
        {state === WillState.TRIGGERABLE && (
          <div className="p-4 rounded-xl bg-red-950/30 border border-red-700/35 text-center">
            <div className="text-red-400 font-bold">Check-in overdue</div>
            <p className="text-xs text-red-300/50 mt-1">Anyone can now trigger distribution.</p>
          </div>
        )}

        {/* Heirs */}
        {will.beneficiaries && will.beneficiaries.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs text-zinc-500 font-semibold uppercase tracking-wider">Protected</div>
            {will.beneficiaries.map((b, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center text-xs text-green-400 font-bold flex-shrink-0">
                  {(b.ensName || b.wallet).slice(0, 1).toUpperCase()}
                </div>
                <span className="text-sm text-zinc-300 flex-1 truncate min-w-0">
                  {b.ensName || shortenAddress(b.wallet)}
                </span>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="w-12 h-1 rounded-full bg-white/[0.08] overflow-hidden">
                    <div className="h-full bg-green-500 rounded-full" style={{ width: `${Number(b.basisPoints) / 100}%` }} />
                  </div>
                  <span className="text-xs text-zinc-400 font-medium w-9 text-right num">{bpsToPercent(b.basisPoints)}</span>
                  {b.hasClaimed && <span className="text-green-400 text-xs">✓</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="p-5 pt-0 space-y-2">

        {state === WillState.ACTIVE && (
          <>
            <button
              onClick={() => checkIn()}
              disabled={checkingIn || confirmingCheckIn}
              className={`w-full py-3.5 rounded-xl font-bold text-[15px] transition-all disabled:opacity-50 ${
                checkedIn
                  ? 'bg-green-500/10 border border-green-500/30 text-green-400'
                  : urgent
                  ? 'bg-red-500 hover:bg-red-400 text-white shadow-lg shadow-red-900/25 hover:scale-[1.01] active:scale-[0.99]'
                  : 'bg-green-500 hover:bg-green-400 text-white shadow-lg shadow-green-900/25 hover:scale-[1.01] active:scale-[0.99]'
              }`}
            >
              {checkingIn || confirmingCheckIn ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  {confirmingCheckIn ? 'Confirming…' : 'Confirm in wallet…'}
                </span>
              ) : checkedIn ? (
                '✓ Checked in — you\'re safe'
              ) : (
                "I'm Alive — Check In"
              )}
            </button>

            <button
              onClick={() => setShowDeposit(!showDeposit)}
              className="w-full py-2.5 rounded-xl border border-white/[0.07] text-zinc-500 hover:text-zinc-300 hover:border-white/[0.12] text-sm transition-all"
            >
              {showDeposit ? '↑ Hide' : '+ Add funds'}
            </button>

            {showDeposit && (
              <div className="flex gap-2">
                <input
                  type="number"
                  step="0.001"
                  placeholder="0.1 ETH"
                  value={depositAmt}
                  onChange={e => setDepositAmt(e.target.value)}
                  className="flex-1 px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white text-sm focus:outline-none focus:border-green-500/60 num"
                />
                <button
                  onClick={() => depositAmt && depositETH(depositAmt)}
                  className="px-4 py-2.5 rounded-xl bg-green-500 hover:bg-green-400 text-white text-sm font-semibold transition-colors"
                >
                  Deposit
                </button>
              </div>
            )}
          </>
        )}

        {state === WillState.TRIGGERABLE && (
          <button
            onClick={() => trigger()}
            disabled={triggering || confirmingTrigger}
            className="w-full py-3.5 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-bold transition-all"
          >
            {triggering || confirmingTrigger ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Triggering…
              </span>
            ) : 'Trigger Distribution'}
          </button>
        )}

        {state === WillState.DISTRIBUTING && (
          <Link
            href={`/claim?will=${willAddress}`}
            className="block w-full py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-white font-bold text-center transition-all"
          >
            Claim as Heir →
          </Link>
        )}

        {(state === WillState.ACTIVE || state === WillState.TRIGGERABLE) && (
          <button
            onClick={() => {
              if (confirm('This cancels your will and returns all funds to you. Are you sure?')) revoke();
            }}
            disabled={revoking}
            className="w-full py-2 text-zinc-700 hover:text-red-400 text-xs transition-colors"
          >
            Revoke will
          </button>
        )}
      </div>

      {/* YO yield panel */}
      {(state === WillState.ACTIVE || state === WillState.TRIGGERABLE) && (
        <div className="border-t border-white/[0.04]">
          <YOWillDashboard willAddress={willAddress} />
        </div>
      )}
    </div>
  );
}

/* ── Dashboard page ──────────────────────────────────────────────────── */
export default function DashboardPage() {
  const { isConnected } = useAccount();
  const { data: wills, isLoading } = useTestatorWills();

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] px-5 gap-8 text-center">
        <div className="space-y-3">
          <h1 className="text-3xl font-bold text-white">Connect to see your wills</h1>
          <p className="text-zinc-400 max-w-sm">Your wills are tied to your wallet address.</p>
        </div>
        <ConnectButton />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-5 py-16">

      {/* Header */}
      <div className="flex items-start justify-between mb-10 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Your Wills</h1>
          <p className="text-zinc-500 text-sm mt-1">Check in monthly. Your family stays protected.</p>
        </div>
        <Link
          href="/create"
          className="px-4 py-2.5 rounded-xl bg-green-500 hover:bg-green-400 text-white font-semibold text-sm transition-all flex-shrink-0"
        >
          + New Will
        </Link>
      </div>

      {/* Telegram callout */}
      <div className="mb-8 p-4 rounded-xl border border-sky-700/25 bg-sky-950/20 flex gap-3 items-center">
        <div className="w-10 h-10 rounded-xl bg-sky-500/15 border border-sky-500/25 flex items-center justify-center flex-shrink-0">
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-sky-400">
            <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.927 13.62l-2.96-.924c-.643-.203-.658-.643.136-.953l11.57-4.461c.537-.194 1.006.131.836.94h-.575z"/>
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-white">Check in without opening the app</div>
          <p className="text-xs text-zinc-400 mt-0.5">
            Message <span className="text-white font-mono text-[11px] bg-white/[0.07] px-1.5 py-0.5 rounded">@willeth_bot</span> on Telegram · Send your wallet to register · Reply{' '}
            <span className="text-green-400 font-mono text-[11px] bg-green-950/50 px-1.5 py-0.5 rounded">ALIVE</span> to check in.
          </p>
        </div>
        <a
          href="https://t.me/willeth_bot"
          target="_blank"
          rel="noopener noreferrer"
          className="flex-shrink-0 px-3 py-1.5 rounded-lg bg-sky-500/15 border border-sky-500/25 text-sky-400 text-xs font-semibold hover:bg-sky-500/25 transition-colors"
        >
          Open ↗
        </a>
      </div>

      {/* Will list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <div className="w-7 h-7 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !wills || wills.length === 0 ? (
        <div className="text-center py-24 space-y-5">
          <div className="relative inline-block">
            <div className="w-20 h-20 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mx-auto">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-9 h-9 text-zinc-600" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
              </svg>
            </div>
          </div>
          <div>
            <h2 className="text-xl font-semibold text-white">No wills yet</h2>
            <p className="text-zinc-500 max-w-xs mx-auto mt-1 text-sm">Protect your family in under 5 minutes. Your wallet, your rules.</p>
          </div>
          <Link
            href="/create"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-green-500 hover:bg-green-400 text-white font-semibold transition-all hover:scale-[1.02] shadow-lg shadow-green-900/25"
          >
            <span>+</span> Create Your First Will
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {wills.map(willAddr => (
            <WillCard key={willAddr} willAddress={willAddr} />
          ))}
        </div>
      )}
    </div>
  );
}
