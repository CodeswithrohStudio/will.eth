import Link from 'next/link';

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative overflow-hidden px-6 py-24 sm:py-32 lg:px-8">
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-gradient-to-br from-gray-950 via-gray-950 to-purple-950/30" />
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl" />
        </div>

        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-purple-700/50 bg-purple-900/20 text-purple-300 text-sm mb-8">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
            Live on Base Sepolia
          </div>

          <h1 className="text-5xl sm:text-7xl font-bold tracking-tight text-white mb-6 leading-tight">
            Your crypto.<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400">
              Your legacy.
            </span>
          </h1>

          <p className="text-xl text-gray-400 mb-4 max-w-2xl mx-auto leading-relaxed">
            $140 billion in crypto is lost every year when people die without a plan.
            Your family cannot access your wallet. There&apos;s no &ldquo;forgot password&rdquo; for a private key.
          </p>
          <p className="text-xl text-white mb-10 max-w-2xl mx-auto font-medium">
            Will.eth fixes this. A dead man&apos;s switch for your crypto — no lawyer, no probate, no middleman.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/create"
              className="px-8 py-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-lg transition-all hover:scale-105 active:scale-95 shadow-lg shadow-purple-900/40"
            >
              Create Your Will
            </Link>
            <Link
              href="/dashboard"
              className="px-8 py-4 rounded-xl border border-gray-700 hover:border-gray-500 text-gray-300 hover:text-white font-semibold text-lg transition-all"
            >
              View Dashboard
            </Link>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-24 px-6 lg:px-8 border-t border-gray-800/50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-white mb-4">How it works</h2>
          <p className="text-center text-gray-400 mb-16 max-w-xl mx-auto">
            Set it up once. Check in monthly. Your heirs are protected forever.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
            {[
              {
                step: '01',
                icon: '📝',
                title: 'Create your will',
                desc: 'Assign percentages to ENS names. alice.eth gets 60%. mum.will.eth gets 40%. Human-readable. Onchain.',
              },
              {
                step: '→',
                icon: null,
                title: null,
                desc: null,
                arrow: true,
              },
              {
                step: '02',
                icon: '💬',
                title: 'Monthly check-in',
                desc: 'Tap a button in the app OR reply "ALIVE" to a WhatsApp message. Takes 5 seconds.',
              },
              {
                step: '→',
                icon: null,
                title: null,
                desc: null,
                arrow: true,
              },
              {
                step: '03',
                icon: '⚡',
                title: 'Miss two check-ins',
                desc: 'The contract assumes incapacitation. Time-locked distribution triggers automatically.',
              },
            ].map((item, i) => (
              item.arrow ? (
                <div key={i} className="hidden md:flex justify-center text-2xl text-gray-600">→</div>
              ) : (
                <div key={i} className="rounded-2xl border border-gray-800 bg-gray-900/50 p-6">
                  <div className="text-xs font-bold text-purple-400 mb-3">{item.step}</div>
                  <div className="text-3xl mb-3">{item.icon}</div>
                  <h3 className="font-semibold text-white mb-2">{item.title}</h3>
                  <p className="text-sm text-gray-400 leading-relaxed">{item.desc}</p>
                </div>
              )
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div className="rounded-2xl border border-gray-800 bg-gray-900/50 p-6">
              <div className="text-xs font-bold text-purple-400 mb-3">04</div>
              <div className="text-3xl mb-3">🔐</div>
              <h3 className="font-semibold text-white mb-2">Heirs claim with ZK proof</h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                Beneficiaries use Anon Aadhaar to prove they&apos;re real verified humans — without revealing any personal data. No KYC, no courts, no documents.
              </p>
            </div>
            <div className="rounded-2xl border border-gray-800 bg-gray-900/50 p-6">
              <div className="text-xs font-bold text-green-400 mb-3">BONUS</div>
              <div className="text-3xl mb-3">📈</div>
              <h3 className="font-semibold text-white mb-2">Your estate earns yield</h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                While you&apos;re alive, idle funds earn 5% APY in a Morpho/Aave vault. Death becomes a DeFi position — your heirs receive more than you locked in.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-16 px-6 border-t border-gray-800/50 bg-gray-900/30">
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { value: '$140B+', label: 'Lost annually to death/lost keys' },
            { value: '0', label: 'Lawyers required' },
            { value: '5%', label: 'APY on idle assets' },
            { value: '∞', label: 'Borders it works across' },
          ].map(stat => (
            <div key={stat.label}>
              <div className="text-3xl font-bold text-white mb-1">{stat.value}</div>
              <div className="text-sm text-gray-400">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Tech Stack */}
      <section className="py-24 px-6 lg:px-8 border-t border-gray-800/50">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-12">Built with the best</h2>
          <div className="flex flex-wrap justify-center gap-4">
            {[
              { name: 'Base', desc: 'L2 execution' },
              { name: 'Anon Aadhaar', desc: 'ZK identity' },
              { name: 'ENS', desc: 'Human-readable heirs' },
              { name: 'Fileverse', desc: 'Encrypted documents' },
              { name: 'Morpho', desc: 'Yield on assets' },
              { name: 'WhatsApp AI', desc: 'Non-crypto check-ins' },
            ].map(tech => (
              <div
                key={tech.name}
                className="px-4 py-3 rounded-xl border border-gray-700 bg-gray-900/50"
              >
                <div className="font-semibold text-white text-sm">{tech.name}</div>
                <div className="text-xs text-gray-500">{tech.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6 border-t border-gray-800/50">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-4xl font-bold text-white mb-4">
            Don&apos;t let your crypto die with you.
          </h2>
          <p className="text-gray-400 mb-8 text-lg">
            Set up your will in under 5 minutes. Your family will thank you.
          </p>
          <Link
            href="/create"
            className="inline-flex px-10 py-5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xl transition-all hover:scale-105 active:scale-95 shadow-2xl shadow-purple-900/50"
          >
            Create Your Will Now
          </Link>
          <p className="mt-4 text-sm text-gray-600">Free. Permissionless. Onchain forever.</p>
        </div>
      </section>
    </div>
  );
}
