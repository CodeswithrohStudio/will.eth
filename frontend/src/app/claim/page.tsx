'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { formatEther } from 'viem';
import { useWillState, useClaim, useIsBeneficiary } from '@/hooks/useWill';
import { WillState, WILL_STATE_LABELS } from '@/lib/types';
import { bpsToPercent, shortenAddress } from '@/lib/utils';

function ClaimContent() {
  const { address, isConnected } = useAccount();
  const searchParams = useSearchParams();
  const willAddress = searchParams.get('will') as `0x${string}` | null;

  const will = useWillState(willAddress || undefined);
  const isBeneficiary = useIsBeneficiary(willAddress || undefined, address);
  const { claim, isPending, isConfirming, isSuccess } = useClaim(willAddress || undefined);

  const [proofGenerated, setProofGenerated] = useState(false);
  const [generatingProof, setGeneratingProof] = useState(false);

  // Mock proof generation (replace with real Anon Aadhaar SDK)
  const generateProof = async () => {
    setGeneratingProof(true);
    // Simulate Anon Aadhaar proof generation
    await new Promise(r => setTimeout(r, 2000));
    setProofGenerated(true);
    setGeneratingProof(false);
  };

  const handleClaim = () => {
    if (!willAddress || !address) return;

    // Mock ZK proof values (real implementation uses @anon-aadhaar/react)
    const nullifierSeed = BigInt(parseInt(willAddress.slice(2, 12), 16));
    const nullifier = BigInt('0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join(''));
    const timestamp = BigInt(Math.floor(Date.now() / 1000) - 3600);
    const proof = [0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n] as const;

    claim(nullifierSeed, nullifier, timestamp, proof);
  };

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
        <h1 className="text-2xl font-bold text-white">Connect your wallet to claim</h1>
        <ConnectButton />
      </div>
    );
  }

  if (!willAddress) {
    return (
      <div className="max-w-md mx-auto px-4 py-12 text-center">
        <div className="text-4xl mb-4">❌</div>
        <h1 className="text-2xl font-bold text-white mb-2">No will address provided</h1>
        <p className="text-gray-400">Use the link provided by the will creator or the agent notification.</p>
      </div>
    );
  }

  const state = will.state as WillState | undefined;
  const myBeneficiary = will.beneficiaries?.find(
    b => b.wallet.toLowerCase() === address?.toLowerCase()
  );

  const isDistributing = state === WillState.DISTRIBUTING;

  return (
    <div className="max-w-lg mx-auto px-4 py-12 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Claim Your Inheritance</h1>
        <p className="text-gray-400 mt-1">Verify your identity with Anon Aadhaar to receive your share.</p>
      </div>

      {/* Will info */}
      <div className="p-4 rounded-xl border border-gray-700 bg-gray-900/50 space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Will address</span>
          <a
            href={`https://sepolia.basescan.org/address/${willAddress}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-purple-400 font-mono hover:text-purple-300"
          >
            {shortenAddress(willAddress)} ↗
          </a>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Status</span>
          <span className={`font-semibold ${isDistributing ? 'text-yellow-400' : 'text-gray-300'}`}>
            {state !== undefined ? WILL_STATE_LABELS[state] : 'Loading...'}
          </span>
        </div>
        {will.ethBalanceAtDistribution && will.ethBalanceAtDistribution > 0n && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Total estate</span>
            <span className="text-white font-semibold">{formatEther(will.ethBalanceAtDistribution)} ETH</span>
          </div>
        )}
      </div>

      {/* Not a beneficiary */}
      {isBeneficiary.data === false && (
        <div className="p-4 rounded-xl bg-red-900/20 border border-red-700 text-red-300">
          <strong>Not a beneficiary</strong> — your wallet ({shortenAddress(address!)}) is not listed in this will.
        </div>
      )}

      {/* Not distributing */}
      {!isDistributing && state !== undefined && (
        <div className="p-4 rounded-xl bg-yellow-900/20 border border-yellow-700 text-yellow-300">
          This will is not yet distributing. Current state: <strong>{WILL_STATE_LABELS[state]}</strong>.
          {state === WillState.TRIGGERABLE && (
            <div className="mt-2 text-sm">
              The will is overdue — anyone can trigger distribution by calling the contract.
            </div>
          )}
        </div>
      )}

      {/* Claim flow */}
      {isDistributing && isBeneficiary.data && myBeneficiary && (
        <div className="space-y-4">
          <div className="p-5 rounded-xl border border-green-700/50 bg-green-900/20">
            <div className="text-sm text-gray-400 mb-1">Your share</div>
            <div className="text-3xl font-bold text-green-400">
              {will.ethBalanceAtDistribution
                ? `${(parseFloat(formatEther(will.ethBalanceAtDistribution)) * Number(myBeneficiary.basisPoints) / 10000).toFixed(4)} ETH`
                : '...'}
            </div>
            <div className="text-sm text-gray-400 mt-1">{bpsToPercent(myBeneficiary.basisPoints)} of estate</div>
          </div>

          {myBeneficiary.hasClaimed ? (
            <div className="p-4 rounded-xl bg-green-900/20 border border-green-700 text-center">
              <div className="text-2xl mb-2">✅</div>
              <div className="text-green-400 font-bold">Already claimed!</div>
              <div className="text-gray-400 text-sm mt-1">Your share has been transferred to your wallet.</div>
            </div>
          ) : (
            <>
              {/* Anon Aadhaar verification */}
              <div className="p-5 rounded-xl border border-gray-700 bg-gray-900/50 space-y-4">
                <div>
                  <div className="text-sm font-semibold text-white mb-1">Identity Verification</div>
                  <p className="text-xs text-gray-400">
                    Prove you are a real verified human using Anon Aadhaar ZK proof. No personal data is revealed on-chain.
                  </p>
                </div>

                {!proofGenerated ? (
                  <button
                    onClick={generateProof}
                    disabled={generatingProof}
                    className="w-full py-3 rounded-xl border border-blue-600 bg-blue-900/30 hover:bg-blue-900/50 text-blue-300 font-semibold transition-all disabled:opacity-50"
                  >
                    {generatingProof ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="w-4 h-4 border-2 border-blue-300 border-t-transparent rounded-full animate-spin" />
                        Generating ZK proof...
                      </span>
                    ) : (
                      '🔐 Verify with Anon Aadhaar'
                    )}
                  </button>
                ) : (
                  <div className="flex items-center gap-2 text-green-400 text-sm font-medium">
                    <span>✓</span>
                    <span>ZK proof generated — identity verified</span>
                  </div>
                )}

                <div className="text-xs text-gray-500 border-t border-gray-700 pt-3">
                  <strong className="text-gray-400">Privacy guarantee:</strong> The proof proves you are a verified Indian citizen over 18 without revealing your Aadhaar number, name, or any personal information.
                </div>
              </div>

              {proofGenerated && !isSuccess && (
                <button
                  onClick={handleClaim}
                  disabled={isPending || isConfirming}
                  className="w-full py-4 rounded-xl bg-yellow-600 hover:bg-yellow-500 disabled:bg-gray-700 text-white font-bold text-lg transition-all"
                >
                  {isPending || isConfirming ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      {isConfirming ? 'Confirming...' : 'Confirm in wallet...'}
                    </span>
                  ) : (
                    'Claim Inheritance'
                  )}
                </button>
              )}

              {isSuccess && (
                <div className="p-6 rounded-xl border border-green-700 bg-green-900/20 text-center space-y-2">
                  <div className="text-4xl">🎉</div>
                  <div className="text-green-400 font-bold text-xl">Inheritance claimed!</div>
                  <p className="text-gray-400 text-sm">Your ETH has been transferred to your wallet.</p>
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
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <ClaimContent />
    </Suspense>
  );
}
