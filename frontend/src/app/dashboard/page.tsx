'use client';

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { formatEther } from 'viem';
import { useTestatorWills } from '@/hooks/useWillRegistry';
import { useWillState, useCheckIn, useTrigger, useDepositETH, useRevoke } from '@/hooks/useWill';
import { WillState, WILL_STATE_LABELS, WILL_STATE_COLORS } from '@/lib/types';
import { formatDaysRemaining, bpsToPercent, shortenAddress } from '@/lib/utils';
import { YOWillDashboard } from '@/components/YOWillDashboard';
import Link from 'next/link';

function WillCard({ willAddress }: { willAddress: `0x${string}` }) {
  const will = useWillState(willAddress);
  const { checkIn, isPending: checkingIn, isConfirming: confirmingCheckIn, isSuccess: checkedIn } = useCheckIn(willAddress);
  const { trigger, isPending: triggering, isConfirming: confirmingTrigger, isSuccess: triggered } = useTrigger(willAddress);
  const { revoke, isPending: revoking } = useRevoke(willAddress);
  const [showDeposit, setShowDeposit] = useState(false);
  const [depositAmt, setDepositAmt] = useState('');
  const { depositETH } = useDepositETH(willAddress);
  const [yieldDisplay, setYieldDisplay] = useState(0);

  // Animate yield counter
  useEffect(() => {
    if (!will.depositedShares) return;
    const target = parseFloat(formatEther(will.depositedShares)) * 0.05 * (Date.now() / 1000 - Number(will.lastCheckIn || 0)) / (365 * 24 * 60 * 60);
    let current = 0;
    const interval = setInterval(() => {
      current += target / 100;
      if (current >= target) {
        setYieldDisplay(target);
        clearInterval(interval);
      } else {
        setYieldDisplay(current);
      }
    }, 20);
    return () => clearInterval(interval);
  }, [will.depositedShares, will.lastCheckIn]);

  const state = will.state as WillState | undefined;
  const stateLabel = state !== undefined ? WILL_STATE_LABELS[state] : 'Loading';
  const stateColor = state !== undefined ? WILL_STATE_COLORS[state] : '';
  const days = will.daysUntilDeadline !== undefined ? Number(will.daysUntilDeadline) : 0;

  return (
    <div className="rounded-2xl border border-gray-700 bg-gray-900/60 p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-gray-500 font-mono">{shortenAddress(willAddress)}</p>
          <a
            href={`https://sepolia.basescan.org/address/${willAddress}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-purple-400 hover:text-purple-300"
          >
            View on Basescan ↗
          </a>
        </div>
        <span className={`px-3 py-1 rounded-full border text-xs font-bold ${stateColor}`}>
          {stateLabel}
        </span>
      </div>

      {/* Yield counter */}
      {will.depositedShares && will.depositedShares > 0n && (
        <div className="p-4 rounded-xl bg-green-900/20 border border-green-800">
          <div className="text-xs text-green-400 mb-1">Yield earned (5% APY)</div>
          <div className="text-2xl font-bold text-green-400">
            +{yieldDisplay.toFixed(6)} ETH
          </div>
          <div className="text-xs text-green-600 mt-1">
            Principal: {formatEther(will.depositedShares)} ETH
          </div>
        </div>
      )}

      {/* Countdown */}
      {state === WillState.ACTIVE && (
        <div className={`p-4 rounded-xl ${days <= 3 ? 'bg-red-900/20 border border-red-800' : 'bg-gray-800/50'}`}>
          <div className="text-xs text-gray-400 mb-1">Next check-in deadline</div>
          <div className={`text-xl font-bold ${days <= 3 ? 'text-red-400' : 'text-white'}`}>
            {formatDaysRemaining(BigInt(days))}
          </div>
        </div>
      )}

      {/* Beneficiaries */}
      {will.beneficiaries && will.beneficiaries.length > 0 && (
        <div>
          <div className="text-xs text-gray-500 mb-2">Heirs</div>
          <div className="space-y-2">
            {will.beneficiaries.map((b, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="text-gray-300 font-mono text-xs">
                  {b.ensName || shortenAddress(b.wallet)}
                </span>
                <div className="flex items-center gap-2">
                  <div className="w-16 h-1.5 rounded-full bg-gray-700 overflow-hidden">
                    <div
                      className="h-full bg-purple-500 rounded-full"
                      style={{ width: `${Number(b.basisPoints) / 100}%` }}
                    />
                  </div>
                  <span className="text-white font-medium w-10 text-right">
                    {bpsToPercent(b.basisPoints)}
                  </span>
                  {b.hasClaimed && <span className="text-green-400 text-xs">✓</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="space-y-2">
        {state === WillState.ACTIVE && (
          <>
            <button
              onClick={() => checkIn()}
              disabled={checkingIn || confirmingCheckIn}
              className="w-full py-3 rounded-xl bg-green-600 hover:bg-green-500 disabled:bg-gray-700 text-white font-bold transition-all hover:scale-[1.01] active:scale-[0.99]"
            >
              {checkingIn || confirmingCheckIn ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  {confirmingCheckIn ? 'Confirming...' : 'Confirm in wallet...'}
                </span>
              ) : checkedIn ? (
                '✓ Checked In! You\'re safe.'
              ) : (
                'Check In — I\'m Alive'
              )}
            </button>

            <button
              onClick={() => setShowDeposit(!showDeposit)}
              className="w-full py-2 rounded-xl border border-gray-600 text-gray-300 hover:text-white text-sm transition-colors"
            >
              + Add Funds
            </button>

            {showDeposit && (
              <div className="flex gap-2">
                <input
                  type="number"
                  step="0.001"
                  placeholder="0.1 ETH"
                  value={depositAmt}
                  onChange={e => setDepositAmt(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-xl bg-gray-800 border border-gray-700 text-white text-sm focus:outline-none focus:border-purple-500"
                />
                <button
                  onClick={() => depositAmt && depositETH(depositAmt)}
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium"
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
            className="w-full py-3 rounded-xl bg-red-600 hover:bg-red-500 disabled:bg-gray-700 text-white font-bold transition-all"
          >
            {triggering || confirmingTrigger ? 'Triggering...' : 'Trigger Distribution'}
          </button>
        )}

        {state === WillState.DISTRIBUTING && (
          <Link
            href={`/claim?will=${willAddress}`}
            className="block w-full py-3 rounded-xl bg-yellow-600 hover:bg-yellow-500 text-white font-bold text-center transition-all"
          >
            Claim as Heir
          </Link>
        )}

        {(state === WillState.ACTIVE || state === WillState.TRIGGERABLE) && (
          <button
            onClick={() => {
              if (confirm('Are you sure? This will cancel your will and return all funds.')) {
                revoke();
              }
            }}
            disabled={revoking}
            className="w-full py-2 rounded-xl text-red-500 hover:text-red-400 text-sm transition-colors"
          >
            Revoke Will
          </button>
        )}
      </div>

      {/* YO Protocol yield dashboard */}
      {(state === WillState.ACTIVE || state === WillState.TRIGGERABLE) && (
        <div className="mt-1">
          <YOWillDashboard willAddress={willAddress} />
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const { isConnected, address } = useAccount();
  const { data: wills, isLoading } = useTestatorWills();

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] gap-6">
        <h1 className="text-3xl font-bold text-white">Connect your wallet to view your wills</h1>
        <ConnectButton />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Your Wills</h1>
          <p className="text-gray-400 mt-1">Manage your onchain inheritance</p>
        </div>
        <Link
          href="/create"
          className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-medium transition-all"
        >
          + Create Will
        </Link>
      </div>

      {/* WhatsApp registration prompt */}
      <div className="mb-6 p-4 rounded-xl border border-blue-700/50 bg-blue-900/20">
        <div className="flex items-start gap-3">
          <span className="text-2xl">💬</span>
          <div>
            <div className="text-sm font-semibold text-white">Enable WhatsApp check-ins</div>
            <p className="text-xs text-gray-400 mt-1">
              Get reminders and check in via WhatsApp — no dApp needed. Message <strong className="text-white">+1 (555) WILL-ETH</strong> with your wallet address to register.
            </p>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !wills || wills.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-5xl mb-4">⚖️</div>
          <h2 className="text-xl font-semibold text-white mb-2">No wills yet</h2>
          <p className="text-gray-400 mb-6">Create your first will to protect your crypto legacy.</p>
          <Link
            href="/create"
            className="inline-flex px-6 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold transition-all"
          >
            Create Your First Will
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {wills.map(willAddr => (
            <WillCard key={willAddr} willAddress={willAddr} />
          ))}
        </div>
      )}
    </div>
  );
}
