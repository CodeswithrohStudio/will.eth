import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http } from 'viem';
import { sepolia } from 'viem/chains';

// ENS names resolve against Ethereum Sepolia
// Multiple RPCs with fallback — public endpoints can be flaky
// Alchemy is primary — most reliable for ENS
const ALCHEMY = process.env.ALCHEMY_SEPOLIA_RPC || 'https://eth-sepolia.g.alchemy.com/v2/KaLqzUGXxlel0D2-A8nnDDSvzwRfjrIJ';
const SEPOLIA_RPCS = [
  ALCHEMY,
  'https://rpc.sepolia.org',
  'https://ethereum-sepolia.blockpi.network/v1/rpc/public',
  'https://sepolia.drpc.org',
];

function makeClient(rpc: string) {
  return createPublicClient({
    chain: sepolia,
    transport: http(rpc, { timeout: 8_000 }),
  });
}

async function resolveWithFallback<T>(
  fn: (client: ReturnType<typeof makeClient>) => Promise<T>
): Promise<T> {
  let lastErr: unknown;
  for (const rpc of SEPOLIA_RPCS) {
    try {
      const result = await fn(makeClient(rpc));
      return result;
    } catch (err) {
      console.warn(`[ENS] RPC ${rpc} failed:`, err instanceof Error ? err.message : err);
      lastErr = err;
    }
  }
  throw lastErr;
}

export async function GET(req: NextRequest) {
  const name    = req.nextUrl.searchParams.get('name');
  const address = req.nextUrl.searchParams.get('address');

  try {
    if (name) {
      const resolvedAddress = await resolveWithFallback((c) =>
        c.getEnsAddress({ name })
      );

      if (!resolvedAddress) {
        console.log(`[ENS] "${name}" resolved but returned null — not registered on Sepolia`);
        return NextResponse.json(
          { error: `"${name}" not found on Sepolia testnet` },
          { status: 404 }
        );
      }

      console.log(`[ENS] ${name} → ${resolvedAddress}`);
      return NextResponse.json({ name, address: resolvedAddress });
    }

    if (address) {
      const ensName = await resolveWithFallback((c) =>
        c.getEnsName({ address: address as `0x${string}` })
      );
      return NextResponse.json({ address, name: ensName ?? null });
    }

    return NextResponse.json({ error: 'Provide name or address param' }, { status: 400 });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error('[ENS] All RPCs failed:', detail);
    return NextResponse.json({ error: 'ENS resolution failed', detail }, { status: 500 });
  }
}
