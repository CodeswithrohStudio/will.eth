'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

/* ── Reveal-on-scroll hook ─────────────────────────────────────────────── */
function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) el.classList.add('in-view'); },
      { threshold: 0.12 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return ref;
}

/* ── Animated stat counter ─────────────────────────────────────────────── */
function Counter({ target, prefix = '', suffix = '' }: { target: number; prefix?: string; suffix?: string }) {
  const [value, setValue] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      obs.disconnect();
      let start = 0;
      const step = target / 80;
      const id = setInterval(() => {
        start += step;
        if (start >= target) { setValue(target); clearInterval(id); }
        else setValue(Math.floor(start));
      }, 18);
    }, { threshold: 0.5 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [target]);
  return <span ref={ref}>{prefix}{value.toLocaleString()}{suffix}</span>;
}

export default function LandingPage() {
  const r1 = useReveal();
  const r2 = useReveal();
  const r3 = useReveal();
  const r4 = useReveal();

  return (
    <div className="min-h-screen">

      {/* ── ACT 1: HERO ─────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-5 text-center overflow-hidden">

        {/* Ambient glow */}
        <div className="absolute inset-0 pointer-events-none" aria-hidden>
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[640px] h-[640px] rounded-full bg-green-500/8 blur-[130px]" />
          <div className="absolute bottom-0 left-1/4 w-80 h-80 rounded-full bg-green-700/6 blur-[100px]" />
        </div>

        {/* Live badge */}
        <div className="anim-fade-up d-100 mb-10 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-white/[0.08] bg-white/[0.04] text-zinc-400 text-xs font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse flex-shrink-0" />
          Live on Base — permissionless, forever
        </div>

        {/* Main headline */}
        <h1 className="anim-fade-up d-200 text-5xl sm:text-6xl md:text-7xl font-bold tracking-tight text-white leading-[1.05] max-w-3xl">
          Your crypto<br />
          <span className="grad-text">dies with you.</span>
        </h1>

        <p className="anim-fade-up d-300 mt-7 text-lg sm:text-xl text-zinc-400 max-w-xl leading-relaxed">
          There&apos;s no &ldquo;forgot password&rdquo; for a private key.
          No lawyer who can unlock your wallet. No inheritance court for crypto.
        </p>

        <p className="anim-fade-up d-400 mt-4 text-base sm:text-lg text-white/80 max-w-lg leading-relaxed font-medium">
          will.eth is a dead man&apos;s switch on Base — it protects your family
          automatically, with no middleman.
        </p>

        {/* CTAs */}
        <div className="anim-fade-up d-500 mt-10 flex flex-col sm:flex-row gap-3 items-center">
          <Link
            href="/create"
            className="px-8 py-3.5 rounded-xl bg-green-500 hover:bg-green-400 text-white font-semibold text-[15px] transition-all hover:scale-[1.03] active:scale-[0.97] shadow-lg shadow-green-900/30"
          >
            Set up your will — it&apos;s free
          </Link>
          <a
            href="#how-it-works"
            className="px-6 py-3.5 rounded-xl text-zinc-400 hover:text-white text-[15px] font-medium transition-colors"
          >
            See how it works ↓
          </a>
        </div>

        {/* Scroll cue */}
        <div className="anim-fade-in d-600 absolute bottom-10 left-1/2 -translate-x-1/2 text-zinc-600 text-xs animate-bounce select-none">
          ↓
        </div>
      </section>

      {/* ── ACT 2: THE PROBLEM ──────────────────────────────────────── */}
      <section className="py-32 px-5">
        <div className="max-w-5xl mx-auto">
          <div ref={r1} className="reveal text-center mb-20">
            <div className="text-7xl sm:text-8xl md:text-9xl font-black text-white tracking-tight num">
              $<Counter target={140} />B
            </div>
            <p className="mt-4 text-zinc-400 text-lg">
              in crypto lost every year — to death, lost keys, and no plan.
            </p>
          </div>

          <div ref={r2} className="reveal grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                icon: '🔑',
                problem: 'No key, no coins.',
                body: 'Your private key is in your head. When you\'re gone, so is your wallet — permanently.',
              },
              {
                icon: '⚖️',
                problem: 'Probate can\'t touch crypto.',
                body: 'A judge can transfer a house. They cannot transfer ETH. The legal system was built before the blockchain.',
              },
              {
                icon: '😢',
                problem: 'Your family pays the price.',
                body: 'Not you — them. Grieving while watching a life\'s savings sit forever unreachable.',
              },
            ].map(item => (
              <div key={item.problem} className="card p-6 space-y-3">
                <div className="text-3xl">{item.icon}</div>
                <h3 className="text-[16px] font-semibold text-white">{item.problem}</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── ACT 3: HOW IT WORKS ─────────────────────────────────────── */}
      <section id="how-it-works" className="py-32 px-5 border-t border-white/[0.04]">
        <div className="max-w-5xl mx-auto">

          <div ref={r3} className="reveal text-center mb-16">
            <p className="text-xs font-semibold tracking-wider uppercase text-green-400 mb-3">How it works</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
              Set it once. It runs forever.
            </h2>
            <p className="mt-4 text-zinc-400 max-w-lg mx-auto">
              Think of it like a heartbeat monitor for your wallet.
              You tap a button monthly. If you stop — your heirs get everything automatically.
            </p>
          </div>

          {/* Timeline */}
          <div className="space-y-3">

            <div className="flex gap-4 sm:gap-8 items-start">
              <div className="flex flex-col items-center gap-1 flex-shrink-0 mt-1">
                <div className="w-9 h-9 rounded-xl bg-green-500 flex items-center justify-center text-white font-bold text-sm">1</div>
                <div className="w-px flex-1 bg-white/[0.06] min-h-[40px]" />
              </div>
              <div className="card card-hover p-5 flex-1 mb-3">
                <div className="text-xs font-semibold text-green-400 uppercase tracking-wider mb-1">Today</div>
                <h3 className="text-[16px] font-semibold text-white mb-1">You write your will</h3>
                <p className="text-sm text-zinc-400">Enter ENS names or wallet addresses. Set percentages. Deploy to Base in under 5 minutes.</p>
              </div>
            </div>

            <div className="flex gap-4 sm:gap-8 items-start">
              <div className="flex flex-col items-center gap-1 flex-shrink-0 mt-1">
                <div className="w-9 h-9 rounded-xl bg-white/[0.07] flex items-center justify-center text-white font-bold text-sm">2</div>
                <div className="w-px flex-1 bg-white/[0.06] min-h-[40px]" />
              </div>
              <div className="card card-hover p-5 flex-1 mb-3">
                <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">Every month</div>
                <h3 className="text-[16px] font-semibold text-white mb-1">You check in — takes 5 seconds</h3>
                <p className="text-sm text-zinc-400">Tap the button in the app. Or reply &ldquo;ALIVE&rdquo; to a Telegram message. The contract resets. Your family stays protected.</p>
              </div>
            </div>

            <div className="flex gap-4 sm:gap-8 items-start">
              <div className="flex flex-col items-center gap-1 flex-shrink-0 mt-1">
                <div className="w-9 h-9 rounded-xl bg-white/[0.07] flex items-center justify-center text-white font-bold text-sm">3</div>
              </div>
              <div className="card p-5 flex-1 border-green-700/30">
                <div className="text-xs font-semibold text-green-400 uppercase tracking-wider mb-1">When it matters most</div>
                <h3 className="text-[16px] font-semibold text-white mb-1">Your heirs receive everything</h3>
                <p className="text-sm text-zinc-400">If you miss two check-ins, any heir can trigger the contract. They verify identity privately with a ZK proof — no courts, no KYC, no waiting.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── ACT 4: YIELD ────────────────────────────────────────────── */}
      <section className="py-32 px-5 border-t border-white/[0.04]">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">

            <div ref={r4} className="reveal space-y-5">
              <p className="text-xs font-semibold tracking-wider uppercase text-green-400">While you&apos;re alive</p>
              <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight leading-snug">
                Your estate grows<br />while you sleep.
              </h2>
              <p className="text-zinc-400 leading-relaxed">
                Idle funds deposited into your will earn real yield on Base via YO Protocol.
                When the time comes, your heirs receive <span className="text-white font-semibold">more than you locked in</span>.
              </p>
              <div className="space-y-3">
                {[
                  { label: '7.2% APY on USDC', sub: 'Stable, USD-denominated yield' },
                  { label: '4.8% APY on ETH',  sub: 'Denominated in native ETH' },
                  { label: 'Non-custodial',     sub: 'Your keys. Your vault. Always.' },
                ].map(item => (
                  <div key={item.label} className="flex items-start gap-3">
                    <div className="w-4 h-4 rounded-full bg-green-500/20 border border-green-500/40 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-white">{item.label}</div>
                      <div className="text-xs text-zinc-500">{item.sub}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="pt-2">
                <span className="text-xs text-zinc-600">Powered by</span>
                <span className="ml-2 text-xs font-semibold text-zinc-400">YO Protocol · Base</span>
              </div>
            </div>

            {/* Compound illustration */}
            <div className="card p-6 space-y-4">
              <div className="text-sm font-semibold text-white mb-1">If you deposit $10,000 today</div>
              <div className="space-y-3">
                {[
                  { years: 5,  val: 14185,  bar: 28 },
                  { years: 10, val: 20122,  bar: 52 },
                  { years: 20, val: 40545,  bar: 80 },
                  { years: 35, val: 115231, bar: 100 },
                ].map(row => (
                  <div key={row.years} className="space-y-1">
                    <div className="flex justify-between text-xs text-zinc-400">
                      <span>In {row.years} years</span>
                      <span className="text-green-400 font-semibold num">${row.val.toLocaleString()}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-green-600 to-green-400"
                        style={{ width: `${row.bar}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-zinc-600 pt-2">@ 7.2% APY (USDC) compounded annually. Not financial advice.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── ACT 5: TECH / TRUST ─────────────────────────────────────── */}
      <section className="py-24 px-5 border-t border-white/[0.04]">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-xs font-semibold tracking-wider uppercase text-zinc-500 mb-8">Built on infrastructure you can trust</p>
          <div className="flex flex-wrap justify-center gap-3">
            {[
              { name: 'Base',         badge: 'L2 execution' },
              { name: 'Anon Aadhaar', badge: 'ZK identity' },
              { name: 'ENS',          badge: 'Human-readable heirs' },
              { name: 'YO Protocol',  badge: 'Yield on Base' },
              { name: 'Fileverse',    badge: 'Encrypted docs' },
              { name: 'Telegram',     badge: 'Non-crypto check-ins' },
            ].map(t => (
              <div key={t.name} className="px-4 py-2.5 rounded-xl card flex flex-col items-center gap-0.5">
                <div className="text-sm font-semibold text-white">{t.name}</div>
                <div className="text-xs text-zinc-500">{t.badge}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── ACT 6: FINAL CTA ────────────────────────────────────────── */}
      <section className="py-32 px-5 border-t border-white/[0.04]">
        <div className="max-w-2xl mx-auto text-center space-y-6">
          <h2 className="text-4xl sm:text-5xl font-bold text-white tracking-tight leading-tight">
            Don&apos;t let your crypto<br />
            <span className="grad-text">die with you.</span>
          </h2>
          <p className="text-zinc-400 text-lg">
            Five minutes today protects your family forever.
          </p>
          <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/create"
              className="px-10 py-4 rounded-xl bg-green-500 hover:bg-green-400 text-white font-bold text-[16px] transition-all hover:scale-[1.03] active:scale-[0.97] shadow-2xl shadow-green-900/30"
            >
              Create Your Will — Free
            </Link>
            <Link
              href="/dashboard"
              className="px-8 py-4 rounded-xl border border-white/[0.08] text-zinc-400 hover:text-white font-medium text-[16px] transition-colors"
            >
              View Dashboard
            </Link>
          </div>
          <p className="text-xs text-zinc-600 pt-2">Permissionless · Open source · Onchain forever</p>
        </div>
      </section>

    </div>
  );
}
