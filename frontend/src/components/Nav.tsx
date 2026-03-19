'use client';

import Link from 'next/link';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { usePathname } from 'next/navigation';

export default function Nav() {
  const pathname = usePathname();

  const links = [
    { href: '/create',    label: 'Create a will' },
    { href: '/dashboard', label: 'Dashboard'     },
  ];

  const isHome = pathname === '/';

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all ${
      isHome ? 'bg-transparent' : 'glass border-b border-white/[0.04]'
    }`}>
      <div className="max-w-6xl mx-auto px-5 sm:px-8">
        <div className="flex items-center justify-between h-[60px]">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-7 h-7 rounded-lg bg-violet-600 flex items-center justify-center text-white text-sm font-bold shadow-lg shadow-violet-900/40 group-hover:bg-violet-500 transition-colors">
              W
            </div>
            <span className="font-semibold text-[15px] tracking-tight text-white/90 group-hover:text-white transition-colors">
              will.eth
            </span>
          </Link>

          {/* Center nav — hidden on mobile */}
          <div className="hidden md:flex items-center gap-1">
            {links.map(link => (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  pathname === link.href
                    ? 'text-white bg-white/[0.07]'
                    : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Right: Connect */}
          <div className="scale-[0.9] origin-right">
            <ConnectButton
              accountStatus="avatar"
              chainStatus="none"
              showBalance={false}
            />
          </div>
        </div>
      </div>
    </nav>
  );
}
