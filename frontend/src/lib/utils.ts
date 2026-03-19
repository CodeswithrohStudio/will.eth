import { formatEther } from 'viem';

export function formatETH(value: bigint, decimals = 4): string {
  const formatted = parseFloat(formatEther(value));
  return formatted.toFixed(decimals);
}

export function formatUSD(ethValue: bigint, ethPrice = 3000): string {
  const eth = parseFloat(formatEther(ethValue));
  return (eth * ethPrice).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
  });
}

export function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function formatDaysRemaining(days: bigint): string {
  const d = Number(days);
  if (d < 0) return `${Math.abs(d)} days overdue`;
  if (d === 0) return 'Due today';
  if (d === 1) return '1 day remaining';
  return `${d} days remaining`;
}

export function formatTimestamp(timestamp: bigint): string {
  return new Date(Number(timestamp) * 1000).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function calculateYieldAPY(principal: bigint, current: bigint, daysElapsed: number): number {
  if (principal === 0n || daysElapsed === 0) return 0;
  const p = parseFloat(formatEther(principal));
  const c = parseFloat(formatEther(current));
  const annualizedReturn = ((c - p) / p) * (365 / daysElapsed);
  return annualizedReturn * 100;
}

export function bpsToPercent(bps: bigint): string {
  return `${(Number(bps) / 100).toFixed(0)}%`;
}

export function isValidAddress(address: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(address);
}

export function isValidENS(name: string): boolean {
  return name.endsWith('.eth') && name.length > 4;
}
