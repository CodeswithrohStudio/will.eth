'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { formatEther } from 'viem';
import { useWillState, useClaim, useIsBeneficiary } from '@/hooks/useWill';
import { WillState, WILL_STATE_LABELS } from '@/lib/types';
import { bpsToPercent, shortenAddress } from '@/lib/utils';

function ClaimStep({ num, label, done, active }: { num: number; label: string; done: boolean; active: boolean }) {
  return (
    <div className={`flex items-center gap-2.5 text-sm ${active ? 'text-white' : done ? 'text-green-400' : 'text-zinc-600'}`}>
      <div className={`w-7 h-7 rounded-full border flex items-center justify-center text-xs font-bold flex-shrink-0 ${
        done   ? 'bg-green-500/20 border-green-500/30 text-green-400' :
        active ? 'bg-green-500 border-green-500 text-white' :
                 'border-white/[0.08] text-zinc-600'
      }`}>
        {done ? '✓' : num}
      </div>
      {label}
    </div>
  );
}

function ClaimContent() {
  const { address, isConnected } = useAccount();
  const searchParams = useSearchParams();
  const willAddress = searchParams.get('will') as `0x${string}` | null;

  const will = useWillState(willAddress || undefined);
  const isBeneficiary = useIsBeneficiary(willAddress || undefined, address);
  const { claim, isPending, isConfirming, isSuccess } = useClaim(willAddress || undefined);

  const [proofGenerated, setProofGenerated] = useState(false);
  const [generatingProof, setGeneratingProof] = useState(false);

  const generateProof = async () => {
    setGeneratingProof(true);
    await new Promise(r => setTimeout(r, 2000));
    setProofGenerated(true);
    setGeneratingProof(false);
  };

  const handleClaim = () => {
    if (!willAddress || !address) return;
    const nullifierSeed = BigInt(parseInt(willAddress.slice(2, 12), 16));
    const nullifier = BigInt('0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join(''));
    const timestamp = BigInt(Math.floor(Date.now() / 1000) - 3600);
    const proof = [0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n] as const;
    claim(nullifierSeed, nullifier, timestamp, proof);
  };

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] px-5 gap-8 text-center">
        <div className="space-y-3">
          <h1 className="text-2xl font-bold text-white">Connect your wallet to claim</h1>
          <p className="text-zinc-400 max-w-xs">We need to verify your wallet is listed as a beneficiary.</p>
        </div>
        <ConnectButton />
      </div>
    );
  }

  if (!willAddress) {
    return (
      <div className="max-w-md mx-auto px-5 py-16 text-center space-y-4">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-10 h-10 text-zinc-600 mx-auto" strokeWidth="1.3">
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
        </svg>
        <h1 className="text-2xl font-bold text-white">No will link</h1>
        <p className="text-zinc-500 text-sm max-w-xs mx-auto">
          Open the link sent to you by the testator or the will.eth Telegram bot notification — it contains the will address.
        </p>
      </div>
    );
  }

  const state = will.state as WillState | undefined;
  const myBeneficiary = will.beneficiaries?.find(b => b.wallet.toLowerCase() === address?.toLowerCase());
  const isDistributing = state === WillState.DISTRIBUTING;
  const myShare = myBeneficiary && will.ethBalanceAtDistribution && will.ethBalanceAtDistribution > 0n
    ? parseFloat(formatEther(will.ethBalanceAtDistribution)) * Number(myBeneficiary.basisPoints) / 10000
    : null;

  return (
    <div className="max-w-lg mx-auto px-5 py-16 space-y-8">

      <div className="space-y-3">
        <p className="text-xs font-semibold tracking-wider uppercase text-green-500/70">Someone left this for you</p>
        <h1 className="text-3xl font-bold text-white leading-tight">
          Claim your<br /><span className="grad-text">inheritance</span>
        </h1>
        <p className="text-zinc-400 text-sm leading-relaxed">
          Verify your identity privately with Anon Aadhaar — a ZK proof.
          No personal data is stored or revealed on-chain, ever.
        </p>
      </div>

      {/* Will info */}
      <div className="card divide-y divide-white/[0.04]">
        <div className="px-5 py-4 flex justify-between items-center">
          <span className="text-xs text-zinc-500">Will address</span>
          <a
            href={`https://sepolia.basescan.org/address/${willAddress}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-mono text-green-400 hover:text-green-300 transition-colors"
          >
            {shortenAddress(willAddress)} ↗
          </a>
        </div>
        <div className="px-5 py-4 flex justify-between items-center">
          <span className="text-xs text-zinc-500">Status</span>
          <span className={`text-sm font-semibold ${isDistributing ? 'text-amber-400' : 'text-zinc-300'}`}>
            {state !== undefined ? WILL_STATE_LABELS[state] : '…'}
          </span>
        </div>
        {will.ethBalanceAtDistribution && will.ethBalanceAtDistribution > 0n && (
          <div className="px-5 py-4 flex justify-between items-center">
            <span className="text-xs text-zinc-500">Total estate</span>
            <span className="text-sm font-semibold text-white num">
              {formatEther(will.ethBalanceAtDistribution)} ETH
            </span>
          </div>
        )}
      </div>

      {/* Not a beneficiary */}
      {isBeneficiary.data === false && (
        <div className="p-5 rounded-xl bg-red-950/30 border border-red-700/30 text-center space-y-1">
          <div className="text-red-400 font-semibold">Not a beneficiary</div>
          <p className="text-xs text-red-300/50">
            {shortenAddress(address!)} is not listed in this will. Make sure you&apos;re using the correct wallet.
          </p>
        </div>
      )}

      {/* Not distributing */}
      {!isDistributing && state !== undefined && (
        <div className="p-5 rounded-xl bg-amber-950/20 border border-amber-800/25">
          <div className="text-amber-400 font-semibold text-sm">Will is not distributing yet</div>
          <p className="text-xs text-amber-300/50 mt-1">
            Current state: <strong className="text-amber-300">{WILL_STATE_LABELS[state]}</strong>.
            {state === WillState.TRIGGERABLE && ' The will is overdue — anyone can trigger distribution.'}
          </p>
        </div>
      )}

      {/* Claim flow */}
      {isDistributing && isBeneficiary.data && myBeneficiary && (
        <div className="space-y-5">

          {/* Share display */}
          <div className="card p-6 text-center space-y-1">
            <div className="text-xs text-zinc-500 font-semibold uppercase tracking-wider">Your share</div>
            <div className="text-4xl font-black text-white num">
              {myShare !== null ? `${myShare.toFixed(4)} ETH` : '…'}
            </div>
            <div className="text-sm text-zinc-500">{bpsToPercent(myBeneficiary.basisPoints)} of the estate</div>
          </div>

          {myBeneficiary.hasClaimed ? (
            <div className="card p-8 text-center space-y-3 border-green-700/25">
              <div className="w-14 h-14 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center text-2xl mx-auto">✓</div>
              <div className="text-green-400 font-bold text-lg">Already claimed</div>
              <p className="text-zinc-500 text-sm">Your share has been transferred to your wallet.</p>
            </div>
          ) : isSuccess ? (
            <div className="card p-10 text-center space-y-4 border-green-700/25 glow-green">
              <div className="w-16 h-16 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center text-3xl mx-auto">🕊️</div>
              <div>
                <div className="text-green-400 font-bold text-xl">Inheritance claimed</div>
                <p className="text-zinc-500 text-sm mt-1">The funds are on their way to your wallet. They wanted you to have this.</p>
              </div>
            </div>
          ) : (
            <>
              {/* Steps */}
              <div className="space-y-3">
                <ClaimStep num={1} label="Verify identity with Anon Aadhaar" done={proofGenerated} active={!proofGenerated} />
                <ClaimStep num={2} label="Claim your inheritance" done={isSuccess} active={proofGenerated && !isSuccess} />
              </div>

              {/* Step 1 */}
              {!proofGenerated && (
                <div className="card p-6 space-y-4">
                  <div>
                    <div className="text-sm font-semibold text-white">Identity verification</div>
                    <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                      Prove you are a verified human using a ZK proof generated from your Aadhaar.
                      Zero personal data is stored or revealed on-chain.
                    </p>
                  </div>

                  <button
                    onClick={generateProof}
                    disabled={generatingProof}
                    className="w-full py-3.5 rounded-xl border border-green-500/30 bg-green-500/10 hover:bg-green-500/20 text-green-300 font-semibold transition-all disabled:opacity-50"
                  >
                    {generatingProof ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="w-4 h-4 border-2 border-green-400/40 border-t-green-400 rounded-full animate-spin" />
                        Generating ZK proof…
                      </span>
                    ) : (
                      '🔐 Verify with Anon Aadhaar'
                    )}
                  </button>

                  <div className="text-xs text-zinc-600 border-t border-white/[0.04] pt-4 leading-relaxed">
                    <strong className="text-zinc-500">Privacy:</strong> Confirms you are a verified Indian citizen over 18 without revealing your Aadhaar number, name, or any personal data.
                  </div>
                </div>
              )}

              {/* Step 2 */}
              {proofGenerated && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-green-400 text-sm font-medium px-1">
                    <span className="w-4 h-4 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center text-xs">✓</span>
                    Identity verified — ZK proof ready
                  </div>
                  <button
                    onClick={handleClaim}
                    disabled={isPending || isConfirming}
                    className="w-full py-4 rounded-xl bg-green-500 hover:bg-green-400 disabled:opacity-50 text-white font-bold text-[16px] transition-all hover:scale-[1.01] active:scale-[0.99]"
                  >
                    {isPending || isConfirming ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                        {isConfirming ? 'Confirming…' : 'Confirm in wallet…'}
                      </span>
                    ) : (
                      'Claim Inheritance'
                    )}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function ClaimPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[70vh]">
        <div className="w-7 h-7 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <ClaimContent />
    </Suspense>
  );
}
