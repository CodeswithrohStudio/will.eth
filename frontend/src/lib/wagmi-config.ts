import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { baseSepolia } from 'viem/chains';

export const config = getDefaultConfig({
  appName: 'Will.eth',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'demo',
  chains: [baseSepolia],
  ssr: true,
});
