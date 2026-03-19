'use client';

import Link from 'next/link';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { usePathname } from 'next/navigation';

export default function Nav() {
  const pathname = usePathname();

  const links = [
    { href: '/', label: 'Home' },
    { href: '/create', label: 'Create Will' },
    { href: '/dashboard', label: 'Dashboard' },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-gray-800 bg-gray-950/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2">
              <span className="text-2xl">⚖️</span>
              <span className="font-bold text-lg tracking-tight text-white">will.eth</span>
            </Link>
            <div className="hidden md:flex items-center gap-6">
              {links.map(link => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`text-sm font-medium transition-colors ${
                    pathname === link.href
                      ? 'text-white'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
          <ConnectButton />
        </div>
      </div>
    </nav>
  );
}
