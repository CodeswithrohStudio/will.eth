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
    [WillState.ACTIVE]:      { label: 'Active',      cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
    [WillState.TRIGGERABLE]: { label: 'Overdue!',    cls: 'bg-red-500/10 text-red-400 border-red-500/30 pulse-red' },
    [WillState.DISTRIBUTING]:{ label: 'Distributing',cls: 'bg-amber-500/10 text-amber-400 border-amber-500/30' },
    [WillState.REVOKED]:     { label: 'Revoked',     cls: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/30' },
  };
  const { label, cls } = map[state] ?? { label: WILL_STATE_LABELS[state], cls: '' };
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-semibold ${cls}`}>
      {state === WillState.ACTIVE && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
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
          stroke={urgent ? '#f43f5e' : '#8b5cf6'}
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

/* ── Individual Will Card ────────────────────────────────────────────── */
function WillCard({ willAddress }: { willAddress: `0x${string}` }) {
  const will = useWillState(willAddress);
  const { checkIn, isPending: checkingIn, isConfirming: confirmingCheckIn, isSuccess: checkedIn } = useCheckIn(willAddress);
  const { trigger, isPending: triggering, isConfirming: confirmingTrigger } = useTrigger(willAddress);
  const { revoke, isPending: revoking } = useRevoke(willAddress);
  const { depositETH } = useDepositETH(willAddress);

  const [showDeposit, setShowDeposit] = useState(false);
  const [depositAmt, setDepositAmt] = useState('');
  const [yieldDisplay, setYieldDisplay] = useState(0);

  // Animate yield counter
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
      state === WillState.TRIGGERABLE ? 'border-red-500/30' : ''
    }`}>

      {/* Header strip */}
      <div className="p-5 border-b border-white/[0.04] flex items-center justify-between gap-4">
        <div className="min-w-0">
          <a
            href={`https://sepolia.basescan.org/address/${willAddress}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-zinc-500 font-mono hover:text-violet-400 transition-colors"
          >
            {shortenAddress(willAddress)} ↗
          </a>
        </div>
        <StateBadge state={state} />
      </div>

      {/* Main content */}
      <div className="p-5 space-y-5">

        {/* Yield counter */}
        {will.depositedShares && will.depositedShares > 0n && (
          <div className="flex items-center gap-4 p-4 rounded-xl bg-emerald-950/40 border border-emerald-800/30">
            <div className="flex-1 min-w-0">
              <div className="text-xs text-emerald-500 font-semibold mb-0.5">Yield earned</div>
              <div className="text-2xl font-bold text-emerald-400 num">
                +{yieldDisplay.toFixed(6)} ETH
              </div>
              <div className="text-xs text-zinc-600 mt-0.5">
                Principal: {formatEther(will.depositedShares)} ETH
              </div>
            </div>
            <div className="text-2xl opacity-40">📈</div>
          </div>
        )}

        {/* Countdown */}
        {state === WillState.ACTIVE && (
          <div className={`flex items-center gap-4 p-4 rounded-xl border ${
            urgent ? 'bg-red-950/40 border-red-700/40' : 'bg-white/[0.02] border-white/[0.06]'
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

        {/* Overdue warning */}
        {state === WillState.TRIGGERABLE && (
          <div className="p-4 rounded-xl bg-red-950/40 border border-red-700/40 text-center">
            <div className="text-red-400 font-bold">Check-in overdue</div>
            <p className="text-xs text-red-300/60 mt-1">Anyone can now trigger distribution. Act if this was a mistake.</p>
          </div>
        )}

        {/* Heirs */}
        {will.beneficiaries && will.beneficiaries.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs text-zinc-500 font-semibold uppercase tracking-wider">Protected</div>
            {will.beneficiaries.map((b, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-violet-600/20 border border-violet-500/20 flex items-center justify-center text-xs text-violet-400 font-bold flex-shrink-0">
                  {(b.ensName || b.wallet).slice(0, 1).toUpperCase()}
                </div>
                <span className="text-sm text-zinc-300 flex-1 truncate min-w-0">
                  {b.ensName || shortenAddress(b.wallet)}
                </span>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="w-12 h-1 rounded-full bg-white/[0.08] overflow-hidden">
                    <div className="h-full bg-violet-500 rounded-full" style={{ width: `${Number(b.basisPoints) / 100}%` }} />
                  </div>
                  <span className="text-xs text-zinc-400 font-medium w-9 text-right num">{bpsToPercent(b.basisPoints)}</span>
                  {b.hasClaimed && <span className="text-emerald-400 text-xs">✓</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Action area */}
      <div className="p-5 pt-0 space-y-2">

        {/* CHECK IN — the most important action */}
        {state === WillState.ACTIVE && (
          <>
            <button
              onClick={() => checkIn()}
              disabled={checkingIn || confirmingCheckIn}
              className={`w-full py-3.5 rounded-xl font-bold text-[15px] transition-all ${
                checkedIn
                  ? 'bg-emerald-600/20 border border-emerald-600/40 text-emerald-400'
                  : urgent
                  ? 'bg-red-500 hover:bg-red-400 text-white shadow-lg shadow-red-900/30 hover:scale-[1.01] active:scale-[0.99]'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/30 hover:scale-[1.01] active:scale-[0.99]'
              } disabled:opacity-50`}
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

            {/* Add funds */}
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
                  className="flex-1 px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white text-sm focus:outline-none focus:border-violet-500/60 num"
                />
                <button
                  onClick={() => depositAmt && depositETH(depositAmt)}
                  className="px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold transition-colors"
                >
                  Deposit
                </button>
              </div>
            )}
          </>
        )}

        {/* TRIGGER */}
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

        {/* CLAIM */}
        {state === WillState.DISTRIBUTING && (
          <Link
            href={`/claim?will=${willAddress}`}
            className="block w-full py-3.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-center transition-all"
          >
            Claim as Heir →
          </Link>
        )}

        {/* REVOKE */}
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

      {/* YO yield dashboard */}
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
          className="px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-sm transition-all flex-shrink-0"
        >
          + New Will
        </Link>
      </div>

      {/* WhatsApp callout */}
      <div className="mb-8 p-4 rounded-xl border border-white/[0.06] bg-white/[0.02] flex gap-3 items-start">
        <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-lg flex-shrink-0">
          💬
        </div>
        <div>
          <div className="text-sm font-semibold text-white">Check in by WhatsApp</div>
          <p className="text-xs text-zinc-500 mt-0.5">
            Message <span className="text-white font-mono">+1 (555) WILL-ETH</span> with your wallet address to register.
            Reply <span className="text-white font-mono">ALIVE</span> anytime — counts as a check-in.
          </p>
        </div>
      </div>

      {/* Will list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <div className="w-7 h-7 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !wills || wills.length === 0 ? (
        <div className="text-center py-24 space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-3xl mx-auto">
            ⚖️
          </div>
          <h2 className="text-xl font-semibold text-white">No wills yet</h2>
          <p className="text-zinc-500 max-w-sm mx-auto">Set up your first will and protect your family in under 5 minutes.</p>
          <Link
            href="/create"
            className="inline-flex px-6 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold transition-all mt-2"
          >
            Create Your First Will
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
