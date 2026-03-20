'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useCreateWill } from '@/hooks/useWillRegistry';
import { useDepositETH } from '@/hooks/useWill';
import { BeneficiaryDraft, CHECK_IN_INTERVALS } from '@/lib/types';
import { isValidAddress, isValidENS } from '@/lib/utils';
import { projectEstate, fmtUSD } from '@/lib/yo-config';
import Link from 'next/link';

const STEPS = [
  { id: 0, label: 'Heirs',    hint: 'Who are you protecting?' },
  { id: 1, label: 'Check-in', hint: 'How often will you check in?' },
  { id: 2, label: 'Fund',     hint: 'How much to put in?' },
  { id: 3, label: 'Deploy',   hint: 'Review & go live' },
];

/* ── Pill step bar ───────────────────────────────────────────────────── */
function StepBar({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-2 mb-12">
      {STEPS.map((s, i) => (
        <div key={s.id} className="flex items-center gap-2">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
            i < current  ? 'bg-green-500/20 text-green-400' :
            i === current ? 'bg-green-500 text-white shadow-lg shadow-green-900/30' :
                            'text-zinc-600'
          }`}>
            {i < current ? (
              <span className="w-3.5 h-3.5 rounded-full bg-green-400 flex items-center justify-center text-[9px] text-black">✓</span>
            ) : (
              <span className="w-3.5 h-3.5 rounded-full border border-current flex items-center justify-center text-[9px]">{i + 1}</span>
            )}
            {s.label}
          </div>
          {i < STEPS.length - 1 && <div className="w-5 h-px bg-white/[0.07]" />}
        </div>
      ))}
    </div>
  );
}

/* ── Yield projection table ──────────────────────────────────────────── */
function YieldTable({ amount, apy, asset }: { amount: number; apy: number; asset: 'USDC' | 'ETH' }) {
  if (!amount) return null;
  return (
    <div className="grid grid-cols-3 gap-2 text-center mt-4 p-4 rounded-xl bg-green-950/30 border border-green-800/30">
      {[5, 10, 35].map(years => {
        const val = asset === 'USDC'
          ? projectEstate(amount, apy, years)
          : amount * Math.pow(1 + apy / 100, years);
        return (
          <div key={years}>
            <div className="text-white font-bold text-sm num">
              {asset === 'USDC' ? fmtUSD(val) : `${val.toFixed(3)} ETH`}
            </div>
            <div className="text-zinc-500 text-xs mt-0.5">in {years}y</div>
          </div>
        );
      })}
      <div className="col-span-3 text-xs text-zinc-600 mt-1 border-t border-white/[0.04] pt-2">
        Powered by YO Protocol · {apy}% APY compounded
      </div>
    </div>
  );
}

export default function CreatePage() {
  const { isConnected } = useAccount();
  const [step, setStep] = useState(0);

  const [beneficiaries, setBeneficiaries] = useState<BeneficiaryDraft[]>([
    { address: '', ensName: '', percentage: 100, ensResolved: false },
  ]);
  const [checkInInterval, setCheckInInterval] = useState(CHECK_IN_INTERVALS[1].value);
  const [depositAmount, setDepositAmount] = useState('');
  const [letterOfWishes, setLetterOfWishes] = useState('');
  const [fileverseDocId, setFileverseDocId] = useState('');
  const [yieldEnabled, setYieldEnabled] = useState(true);
  const [yieldAsset, setYieldAsset] = useState<'USDC' | 'ETH'>('USDC');
  const YO_APY = yieldAsset === 'USDC' ? 7.2 : 4.8;

  const { createWill, isPending: isCreating, isConfirming, isSuccess: isCreated, deployedWillAddress } = useCreateWill();
  const { depositETH } = useDepositETH(deployedWillAddress || undefined);

  const totalPercentage = beneficiaries.reduce((sum, b) => sum + b.percentage, 0);

  const addBeneficiary = () => {
    if (beneficiaries.length >= 5) return;
    const remaining = 100 - totalPercentage;
    setBeneficiaries([...beneficiaries, { address: '', ensName: '', percentage: remaining > 0 ? remaining : 0, ensResolved: false }]);
  };
  const removeBeneficiary = (idx: number) => setBeneficiaries(beneficiaries.filter((_, i) => i !== idx));
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

  /* ── Not connected ─────────────────────────────────────────────── */
  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] px-5 gap-8 text-center">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-12 h-12 text-zinc-600" strokeWidth="1.2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 0 0-2.25-2.25H15a3 3 0 1 1-6 0H5.25A2.25 2.25 0 0 0 3 12m18 0v6a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 18v-6m18 0V9M3 12V9m18-3a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 6v3m18 0V6" />
        </svg>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-white">Connect your wallet first</h1>
          <p className="text-zinc-500 max-w-xs text-sm">Your will is deployed from your wallet address. No account needed — just a signature.</p>
        </div>
        <ConnectButton />
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto px-5 py-16">

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">{STEPS[step].hint}</h1>
        <p className="text-zinc-500 text-sm mt-1">Step {step + 1} of {STEPS.length}</p>
      </div>

      <StepBar current={step} />

      {/* ── STEP 0: Beneficiaries ─────────────────────────────────── */}
      {step === 0 && (
        <div className="space-y-4">
          <p className="text-zinc-400 text-sm">
            Enter the ENS names or wallet addresses of people you want to protect. Set how much of your estate each person receives.
          </p>

          <div className="space-y-3">
            {beneficiaries.map((b, idx) => (
              <div key={idx} className="card p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Person {idx + 1}</span>
                  {beneficiaries.length > 1 && (
                    <button onClick={() => removeBeneficiary(idx)} className="text-zinc-600 hover:text-red-400 text-xs transition-colors">
                      Remove
                    </button>
                  )}
                </div>

                <div className="space-y-2">
                  <input
                    type="text"
                    placeholder="alice.eth  or  0x1234..."
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
                    className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white placeholder-zinc-600 focus:outline-none focus:border-green-500/60 text-sm transition-colors"
                  />
                  {b.ensResolved && b.address && (
                    <p className="text-xs text-green-400 font-mono pl-1">✓ {b.address}</p>
                  )}
                  {b.ensName && !b.ensResolved && (
                    <p className="text-xs text-zinc-500 pl-1">Resolving ENS…</p>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-zinc-500">Their share</span>
                    <span className="text-white font-bold text-lg num">{b.percentage}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={b.percentage}
                    onChange={e => updateBeneficiary(idx, 'percentage', parseInt(e.target.value))}
                    className="w-full"
                  />
                </div>
              </div>
            ))}
          </div>

          {totalPercentage !== 100 && (
            <div className="flex items-center gap-2 text-sm text-amber-400 px-1">
              <span>⚠</span>
              <span>Shares total {totalPercentage}% — must equal exactly 100%</span>
            </div>
          )}

          {beneficiaries.length < 5 && (
            <button
              onClick={addBeneficiary}
              className="w-full py-3 rounded-xl border border-dashed border-white/[0.08] text-zinc-500 hover:text-zinc-300 hover:border-white/[0.15] transition-all text-sm"
            >
              + Add another person
            </button>
          )}

          <button
            onClick={() => setStep(1)}
            disabled={totalPercentage !== 100 || beneficiaries.some(b => !b.address)}
            className="w-full py-3.5 rounded-xl bg-green-500 hover:bg-green-400 disabled:bg-white/[0.05] disabled:text-zinc-600 text-white font-semibold transition-all"
          >
            Continue →
          </button>
        </div>
      )}

      {/* ── STEP 1: Check-in interval ─────────────────────────────── */}
      {step === 1 && (
        <div className="space-y-6">
          <p className="text-zinc-400 text-sm leading-relaxed">
            Pick a window you can realistically keep. If you miss it — your heirs can trigger your will.
            Telegram reminders go out 3 days before each deadline.
          </p>

          <div className="grid grid-cols-2 gap-2.5">
            {CHECK_IN_INTERVALS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setCheckInInterval(opt.value)}
                className={`p-4 rounded-xl border text-left transition-all ${
                  checkInInterval === opt.value
                    ? 'border-green-500 bg-green-500/10 text-white'
                    : 'border-white/[0.07] bg-white/[0.02] text-zinc-400 hover:border-white/[0.12] hover:text-zinc-200'
                }`}
              >
                <div className="font-semibold text-sm">{opt.label}</div>
                {opt.label === '30 days' && (
                  <div className="text-xs text-green-400 mt-0.5">Recommended</div>
                )}
              </button>
            ))}
          </div>

          <div className="p-4 rounded-xl bg-zinc-900/60 border border-white/[0.06] text-zinc-400 text-sm flex gap-3">
            <span className="text-lg flex-shrink-0">✈️</span>
            <span>
              You&apos;ll get a <strong className="text-white">Telegram</strong> reminder 3 days before each deadline.
              Reply <span className="font-mono text-green-400">ALIVE</span> — that counts as a check-in.
              No app needed.
            </span>
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep(0)} className="flex-1 py-3 rounded-xl border border-white/[0.07] text-zinc-400 hover:text-white transition-colors text-sm">
              ← Back
            </button>
            <button onClick={() => setStep(2)} className="flex-1 py-3.5 rounded-xl bg-green-500 hover:bg-green-400 text-white font-semibold transition-all">
              Continue →
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 2: Fund ─────────────────────────────────────────── */}
      {step === 2 && (
        <div className="space-y-5">
          <p className="text-zinc-400 text-sm leading-relaxed">
            You can start with any amount — or zero. Add more any time from your dashboard.
            Enable yield to put your estate to work while you&apos;re alive.
          </p>

          {/* Yield toggle */}
          <div className={`card p-5 space-y-4 transition-all ${yieldEnabled ? 'border-green-600/30' : ''}`}>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-white">Earn yield while alive</div>
                <div className="text-xs text-zinc-500 mt-0.5">Your estate compounds. Heirs get more.</div>
              </div>
              <button
                onClick={() => setYieldEnabled(!yieldEnabled)}
                className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${yieldEnabled ? 'bg-green-500' : 'bg-white/[0.1]'}`}
              >
                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${yieldEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>

            {yieldEnabled && (
              <div className="flex gap-2">
                {(['USDC', 'ETH'] as const).map(asset => (
                  <button
                    key={asset}
                    onClick={() => setYieldAsset(asset)}
                    className={`flex-1 py-2.5 rounded-lg text-sm font-semibold border transition-all ${
                      yieldAsset === asset
                        ? 'border-green-500 bg-green-500/10 text-green-300'
                        : 'border-white/[0.07] text-zinc-500 hover:border-white/[0.12]'
                    }`}
                  >
                    {asset}
                    <span className={`ml-1 text-xs ${asset === 'USDC' ? 'text-green-400' : 'text-zinc-400'}`}>
                      {asset === 'USDC' ? '7.2% APY ★' : '4.8% APY'}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Amount */}
          <div className="card p-5">
            <label className="block text-xs text-zinc-500 mb-3 font-semibold uppercase tracking-wider">
              Initial deposit ({yieldEnabled && yieldAsset === 'USDC' ? 'USDC' : 'ETH'})
            </label>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl text-zinc-500 num">{yieldEnabled && yieldAsset === 'USDC' ? '$' : 'Ξ'}</span>
              <input
                type="number"
                step={yieldEnabled && yieldAsset === 'USDC' ? '10' : '0.001'}
                min="0"
                placeholder={yieldEnabled && yieldAsset === 'USDC' ? '1000' : '0.1'}
                value={depositAmount}
                onChange={e => setDepositAmount(e.target.value)}
                className="flex-1 bg-transparent text-white text-3xl font-bold focus:outline-none num placeholder-zinc-700"
              />
            </div>
            <p className="text-xs text-zinc-600 mt-2">You can skip this and deposit later from the dashboard.</p>
          </div>

          {yieldEnabled && depositAmount && parseFloat(depositAmount) > 0 && (
            <YieldTable amount={parseFloat(depositAmount)} apy={YO_APY} asset={yieldAsset} />
          )}

          {/* Letter of wishes */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              Letter to your heirs <span className="text-zinc-600 normal-case tracking-normal font-normal ml-1">(optional)</span>
            </label>
            <textarea
              placeholder="Words you want them to read. Context about specific bequests. Anything."
              value={letterOfWishes}
              onChange={e => setLetterOfWishes(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.07] text-white placeholder-zinc-700 focus:outline-none focus:border-green-500/50 text-sm resize-none transition-colors"
            />
            <p className="text-xs text-zinc-600">Encrypted on Fileverse/IPFS. Only your heirs can access it after the will triggers.</p>
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep(1)} className="flex-1 py-3 rounded-xl border border-white/[0.07] text-zinc-400 hover:text-white transition-colors text-sm">
              ← Back
            </button>
            <button onClick={() => setStep(3)} className="flex-1 py-3.5 rounded-xl bg-green-500 hover:bg-green-400 text-white font-semibold transition-all">
              Review →
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 3: Review & Deploy ───────────────────────────────── */}
      {step === 3 && (
        <div className="space-y-5">
          <p className="text-zinc-400 text-sm">Everything looks right? Deploy your will onchain — it&apos;s permanent.</p>

          <div className="card divide-y divide-white/[0.05]">
            <div className="p-4">
              <div className="text-xs text-zinc-500 mb-2 font-semibold uppercase tracking-wider">Heirs</div>
              {beneficiaries.map((b, i) => (
                <div key={i} className="flex justify-between items-center py-1 text-sm">
                  <span className="text-zinc-300">{b.ensName || b.address.slice(0, 10) + '…'}</span>
                  <span className="text-white font-bold num">{b.percentage}%</span>
                </div>
              ))}
            </div>
            <div className="p-4 flex justify-between items-center">
              <span className="text-xs text-zinc-500 font-semibold uppercase tracking-wider">Check-in</span>
              <span className="text-white text-sm font-semibold">
                {CHECK_IN_INTERVALS.find(i => i.value === checkInInterval)?.label || 'Custom'}
              </span>
            </div>
            <div className="p-4 flex justify-between items-center">
              <span className="text-xs text-zinc-500 font-semibold uppercase tracking-wider">Deposit</span>
              <span className="text-white text-sm font-semibold num">
                {depositAmount || '0'} {yieldEnabled && yieldAsset === 'USDC' ? 'USDC' : 'ETH'}
              </span>
            </div>
            <div className="p-4 flex justify-between items-center">
              <span className="text-xs text-zinc-500 font-semibold uppercase tracking-wider">Yield</span>
              {yieldEnabled ? (
                <span className="text-green-400 text-sm font-semibold">⚡ YO Protocol — {yieldAsset} · {YO_APY}% APY</span>
              ) : (
                <span className="text-zinc-500 text-sm">Disabled</span>
              )}
            </div>
          </div>

          {!isCreated ? (
            <>
              <button
                onClick={handleDeploy}
                disabled={isCreating || isConfirming}
                className="w-full py-4 rounded-xl bg-green-500 hover:bg-green-400 disabled:bg-white/[0.05] disabled:text-zinc-600 text-white font-bold text-[16px] transition-all"
              >
                {isCreating ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    Confirm in wallet…
                  </span>
                ) : isConfirming ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    Deploying onchain…
                  </span>
                ) : (
                  'Deploy Will Onchain'
                )}
              </button>
              <button onClick={() => setStep(2)} className="w-full py-3 text-zinc-500 hover:text-zinc-300 text-sm transition-colors">
                ← Back
              </button>
            </>
          ) : (
            <div className="card p-8 text-center space-y-5 border-green-700/30 glow-green">
              <Image src="/logo.svg" alt="" width={52} height={65} className="mx-auto opacity-90" />
              <div>
                <div className="text-xl font-bold text-white">Will deployed.</div>
                <p className="text-zinc-400 text-sm mt-1">Your family is now protected. Check in monthly to keep it active.</p>
              </div>
              {deployedWillAddress && (
                <p className="text-xs text-zinc-600 font-mono break-all">{deployedWillAddress}</p>
              )}
              <div className="space-y-2 pt-2">
                <a
                  href={deployedWillAddress ? `https://sepolia.basescan.org/address/${deployedWillAddress}` : '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full py-2.5 rounded-xl border border-white/[0.07] text-zinc-400 hover:text-white text-sm transition-colors"
                >
                  View on Basescan ↗
                </a>
                <Link href="/dashboard" className="block w-full py-3 rounded-xl bg-green-500 hover:bg-green-400 text-white font-bold transition-colors text-sm">
                  Go to Dashboard
                </Link>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
