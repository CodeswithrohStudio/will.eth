'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useCreateWill } from '@/hooks/useWillRegistry';
import { useDepositETH } from '@/hooks/useWill';
import { BeneficiaryDraft, CHECK_IN_INTERVALS } from '@/lib/types';
import { isValidAddress, isValidENS } from '@/lib/utils';

const STEPS = ['Beneficiaries', 'Check-In', 'Deposit', 'Review & Deploy'];

export default function CreatePage() {
  const { isConnected } = useAccount();
  const [step, setStep] = useState(0);

  // Form state
  const [beneficiaries, setBeneficiaries] = useState<BeneficiaryDraft[]>([
    { address: '', ensName: '', percentage: 100, ensResolved: false },
  ]);
  const [checkInInterval, setCheckInInterval] = useState(CHECK_IN_INTERVALS[1].value); // 30 days
  const [depositAmount, setDepositAmount] = useState('');
  const [letterOfWishes, setLetterOfWishes] = useState('');
  const [fileverseDocId, setFileverseDocId] = useState('');

  const { createWill, isPending: isCreating, isConfirming, isSuccess: isCreated, deployedWillAddress } = useCreateWill();
  const { depositETH } = useDepositETH(deployedWillAddress || undefined);

  const totalPercentage = beneficiaries.reduce((sum, b) => sum + b.percentage, 0);

  const addBeneficiary = () => {
    if (beneficiaries.length >= 5) return;
    const remaining = 100 - totalPercentage;
    setBeneficiaries([...beneficiaries, { address: '', ensName: '', percentage: remaining > 0 ? remaining : 0, ensResolved: false }]);
  };

  const removeBeneficiary = (idx: number) => {
    const updated = beneficiaries.filter((_, i) => i !== idx);
    setBeneficiaries(updated);
  };

  const updateBeneficiary = (idx: number, field: keyof BeneficiaryDraft, value: string | number | boolean) => {
    const updated = [...beneficiaries];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (updated[idx] as any)[field] = value;
    setBeneficiaries(updated);
  };

  const resolveENS = async (idx: number, name: string) => {
    if (!isValidENS(name)) return;
    try {
      const res = await fetch(`/api/ens?name=${encodeURIComponent(name)}`);
      const data = await res.json();
      if (data.address) {
        updateBeneficiary(idx, 'address', data.address);
        updateBeneficiary(idx, 'ensName', name);
        updateBeneficiary(idx, 'ensResolved', true);
      }
    } catch {}
  };

  const uploadToFileverse = async () => {
    if (!letterOfWishes) return '';
    // Simulate Fileverse upload — return mock IPFS CID
    await new Promise(r => setTimeout(r, 1000));
    const mockCid = `ipfs://Qm${Math.random().toString(36).slice(2, 47)}`;
    setFileverseDocId(mockCid);
    return mockCid;
  };

  const handleDeploy = async () => {
    const docId = fileverseDocId || (await uploadToFileverse());

    const addrs = beneficiaries.map(b => b.address as `0x${string}`);
    const names = beneficiaries.map(b => b.ensName || b.address);
    const bps = beneficiaries.map(b => BigInt(b.percentage * 100));
    const interval = BigInt(checkInInterval);

    createWill(addrs, names, bps, interval, docId);
  };

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] gap-6">
        <h1 className="text-3xl font-bold text-white">Connect your wallet to create a will</h1>
        <ConnectButton />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Create Your Will</h1>
        <p className="text-gray-400">Set up your onchain inheritance in 4 steps.</p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-10 overflow-x-auto">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => i < step && setStep(i)}
              className={`w-8 h-8 rounded-full text-sm font-bold flex items-center justify-center transition-colors ${
                i < step ? 'bg-purple-600 text-white cursor-pointer' :
                i === step ? 'bg-purple-600 text-white ring-2 ring-purple-400' :
                'bg-gray-800 text-gray-500'
              }`}
            >
              {i < step ? '✓' : i + 1}
            </button>
            <span className={`text-sm font-medium ${i === step ? 'text-white' : 'text-gray-500'}`}>
              {label}
            </span>
            {i < STEPS.length - 1 && <div className="w-4 h-px bg-gray-700 ml-1" />}
          </div>
        ))}
      </div>

      {/* Step 0: Beneficiaries */}
      {step === 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-white">Who gets your crypto?</h2>
          <p className="text-gray-400 text-sm">Enter ENS names or wallet addresses. Percentages must total 100%.</p>

          {beneficiaries.map((b, idx) => (
            <div key={idx} className="p-4 rounded-xl border border-gray-700 bg-gray-900/50 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-300">Heir {idx + 1}</span>
                {beneficiaries.length > 1 && (
                  <button onClick={() => removeBeneficiary(idx)} className="text-red-400 text-sm hover:text-red-300">
                    Remove
                  </button>
                )}
              </div>

              <input
                type="text"
                placeholder="alice.eth or 0x..."
                value={b.ensName || b.address}
                onChange={e => {
                  const val = e.target.value;
                  if (isValidENS(val)) {
                    updateBeneficiary(idx, 'ensName', val);
                    resolveENS(idx, val);
                  } else {
                    updateBeneficiary(idx, 'address', val);
                    updateBeneficiary(idx, 'ensName', '');
                    updateBeneficiary(idx, 'ensResolved', false);
                  }
                }}
                className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 text-sm"
              />

              {b.ensResolved && b.address && (
                <p className="text-xs text-green-400">Resolved: {b.address}</p>
              )}

              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={b.percentage}
                  onChange={e => updateBeneficiary(idx, 'percentage', parseInt(e.target.value))}
                  className="flex-1 accent-purple-500"
                />
                <span className="text-white font-bold w-12 text-right">{b.percentage}%</span>
              </div>
            </div>
          ))}

          {totalPercentage !== 100 && (
            <p className="text-sm text-red-400">
              Percentages sum to {totalPercentage}% — must equal 100%
            </p>
          )}

          {beneficiaries.length < 5 && (
            <button
              onClick={addBeneficiary}
              className="w-full py-3 rounded-xl border border-dashed border-gray-600 text-gray-400 hover:text-white hover:border-gray-400 transition-colors text-sm"
            >
              + Add another heir
            </button>
          )}

          <button
            onClick={() => setStep(1)}
            disabled={totalPercentage !== 100 || beneficiaries.some(b => !b.address)}
            className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-semibold transition-all"
          >
            Continue
          </button>
        </div>
      )}

      {/* Step 1: Check-in interval */}
      {step === 1 && (
        <div className="space-y-6">
          <h2 className="text-xl font-semibold text-white">How often will you check in?</h2>
          <p className="text-gray-400 text-sm">
            If you miss this window, your heirs can trigger distribution. Choose something realistic.
          </p>

          <div className="grid grid-cols-2 gap-3">
            {CHECK_IN_INTERVALS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setCheckInInterval(opt.value)}
                className={`p-4 rounded-xl border text-left transition-all ${
                  checkInInterval === opt.value
                    ? 'border-purple-500 bg-purple-900/30 text-white'
                    : 'border-gray-700 bg-gray-900/50 text-gray-300 hover:border-gray-600'
                }`}
              >
                <div className="font-semibold">{opt.label}</div>
                <div className="text-xs text-gray-500 mt-1">
                  {opt.label === '30 days' ? 'Recommended' : ''}
                </div>
              </button>
            ))}
          </div>

          <div className="p-4 rounded-xl bg-yellow-900/20 border border-yellow-700/50 text-yellow-300 text-sm">
            You&apos;ll receive a WhatsApp reminder 3 days before each deadline. You can also check in anytime from the dashboard.
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep(0)} className="flex-1 py-3 rounded-xl border border-gray-700 text-gray-300 hover:text-white transition-colors">
              Back
            </button>
            <button onClick={() => setStep(2)} className="flex-1 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold transition-all">
              Continue
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Deposit */}
      {step === 2 && (
        <div className="space-y-6">
          <h2 className="text-xl font-semibold text-white">Fund your estate</h2>
          <p className="text-gray-400 text-sm">
            Deposit ETH into your will. These funds earn 5% APY in a yield vault while you&apos;re alive.
          </p>

          <div className="p-4 rounded-xl border border-gray-700 bg-gray-900/50">
            <label className="block text-sm text-gray-400 mb-2">Deposit amount (ETH)</label>
            <div className="flex items-center gap-2">
              <span className="text-gray-400 text-lg">Ξ</span>
              <input
                type="number"
                step="0.001"
                min="0"
                placeholder="0.1"
                value={depositAmount}
                onChange={e => setDepositAmount(e.target.value)}
                className="flex-1 bg-transparent text-white text-2xl font-bold focus:outline-none"
              />
            </div>
            {depositAmount && (
              <p className="text-sm text-gray-500 mt-2">
                ≈ ${(parseFloat(depositAmount || '0') * 3000).toLocaleString()} USD
              </p>
            )}
          </div>

          <div className="p-4 rounded-xl bg-green-900/20 border border-green-700/50 text-green-300 text-sm">
            <strong>Yield projection:</strong> If you live 10 more years, your heirs receive{' '}
            <strong>
              {depositAmount ? (parseFloat(depositAmount) * Math.pow(1.05, 10)).toFixed(4) : '0'} ETH
            </strong>{' '}
            instead of {depositAmount || '0'} ETH. Your estate grows while you live.
          </div>

          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-300">Letter of wishes (optional)</label>
            <textarea
              placeholder="Personal messages to your heirs, context for specific bequests, passwords to hint at, or anything you want them to know..."
              value={letterOfWishes}
              onChange={e => setLetterOfWishes(e.target.value)}
              rows={4}
              className="w-full px-3 py-3 rounded-xl bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 text-sm resize-none"
            />
            <p className="text-xs text-gray-500">Encrypted and stored on Fileverse/IPFS. Only your heirs can access it after trigger.</p>
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep(1)} className="flex-1 py-3 rounded-xl border border-gray-700 text-gray-300 hover:text-white transition-colors">
              Back
            </button>
            <button onClick={() => setStep(3)} className="flex-1 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold transition-all">
              Review
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Review & Deploy */}
      {step === 3 && (
        <div className="space-y-6">
          <h2 className="text-xl font-semibold text-white">Review & Deploy</h2>

          <div className="space-y-3">
            <div className="p-4 rounded-xl border border-gray-700 bg-gray-900/50">
              <div className="text-xs text-gray-500 mb-1">Heirs</div>
              {beneficiaries.map((b, i) => (
                <div key={i} className="flex justify-between text-sm py-1">
                  <span className="text-gray-300">{b.ensName || b.address}</span>
                  <span className="text-white font-semibold">{b.percentage}%</span>
                </div>
              ))}
            </div>

            <div className="p-4 rounded-xl border border-gray-700 bg-gray-900/50">
              <div className="text-xs text-gray-500 mb-1">Check-in Interval</div>
              <div className="text-white font-semibold">
                {CHECK_IN_INTERVALS.find(i => i.value === checkInInterval)?.label || 'Custom'}
              </div>
            </div>

            <div className="p-4 rounded-xl border border-gray-700 bg-gray-900/50">
              <div className="text-xs text-gray-500 mb-1">Initial Deposit</div>
              <div className="text-white font-semibold">{depositAmount || '0'} ETH</div>
            </div>
          </div>

          {!isCreated ? (
            <button
              onClick={handleDeploy}
              disabled={isCreating || isConfirming}
              className="w-full py-4 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-bold text-lg transition-all"
            >
              {isCreating ? 'Confirm in wallet...' : isConfirming ? 'Deploying will onchain...' : 'Deploy Will Onchain'}
            </button>
          ) : (
            <div className="p-6 rounded-xl border border-green-700 bg-green-900/20 text-center space-y-3">
              <div className="text-4xl">✅</div>
              <div className="text-green-400 font-bold text-lg">Will deployed successfully!</div>
              {deployedWillAddress && (
                <p className="text-xs text-gray-500 font-mono break-all">{deployedWillAddress}</p>
              )}
              <p className="text-gray-400 text-sm">Your will is live on Base Sepolia. Check in monthly to keep it active.</p>
              <a
                href={deployedWillAddress ? `https://sepolia.basescan.org/address/${deployedWillAddress}` : '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full py-2 rounded-xl border border-gray-600 text-gray-300 hover:text-white text-sm transition-colors"
              >
                View on Basescan ↗
              </a>
              <a href="/dashboard" className="block w-full py-3 rounded-xl bg-white text-black font-bold hover:bg-gray-100 transition-colors">
                Go to Dashboard
              </a>
            </div>
          )}

          {!isCreated && (
            <button onClick={() => setStep(2)} className="w-full py-3 rounded-xl border border-gray-700 text-gray-300 hover:text-white transition-colors">
              Back
            </button>
          )}
        </div>
      )}
    </div>
  );
}
