import { base, baseSepolia } from 'viem/chains';

// ─── YO Protocol Vault Addresses ─────────────────────────────────────────────
export const YO_VAULTS = {
  // Base Mainnet (8453) — real YO vaults
  [base.id]: {
    yoUSD: '0x0000000f2eb9f69274678c76222b35eec7588a65' as `0x${string}`,
    yoETH: '0x3a43aec53490cb9fa922847385d82fe25d0e9de7' as `0x${string}`,
    yoBTC: '0xbcbc8cb4d1e8ed048a6276a5e94a3e952660bcbc' as `0x${string}`,
  },
  // Base Sepolia (84532) — use mock vault (real YO not deployed on testnet)
  [baseSepolia.id]: {
    yoUSD: '0xC2EE67446F85c37754BdD7b488C3A508cD3C09C1' as `0x${string}`, // MockYieldVault
    yoETH: '0xC2EE67446F85c37754BdD7b488C3A508cD3C09C1' as `0x${string}`,
    yoBTC: '0xC2EE67446F85c37754BdD7b488C3A508cD3C09C1' as `0x${string}`,
  },
} as const;

// ─── USDC Addresses ───────────────────────────────────────────────────────────
export const USDC = {
  [base.id]: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as `0x${string}`,
  // Base Sepolia — mock USDC (no official USDC on testnet)
  [baseSepolia.id]: '0x036CbD53842c5426634e7929541eC2318f3dCF7e' as `0x${string}`,
} as const;

// ─── Supported assets for Will.eth ────────────────────────────────────────────
export type YOAsset = 'ETH' | 'USDC';

export const YIELD_ASSETS: { label: string; asset: YOAsset; vaultKey: 'yoUSD' | 'yoETH'; apy: number }[] = [
  { label: 'USDC', asset: 'USDC', vaultKey: 'yoUSD', apy: 7.2 },
  { label: 'ETH',  asset: 'ETH',  vaultKey: 'yoETH', apy: 4.8 },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function getYOVault(chainId: number, vaultKey: 'yoUSD' | 'yoETH'): `0x${string}` {
  const chain = YO_VAULTS[chainId as keyof typeof YO_VAULTS];
  if (!chain) return YO_VAULTS[base.id][vaultKey];
  return chain[vaultKey];
}

export function getUSDC(chainId: number): `0x${string}` {
  return USDC[chainId as keyof typeof USDC] ?? USDC[base.id];
}

/** Project estate value using compound interest */
export function projectEstate(principal: number, apyPercent: number, years: number): number {
  return principal * Math.pow(1 + apyPercent / 100, years);
}

/** Format USD with commas */
export function fmtUSD(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
}

export const IS_MAINNET = process.env.NEXT_PUBLIC_CHAIN_ID === '8453';
