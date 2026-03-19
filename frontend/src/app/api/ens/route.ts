import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http } from 'viem';
import { mainnet } from 'viem/chains';

const client = createPublicClient({
  chain: mainnet,
  transport: http('https://eth.llamarpc.com'),
});

export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get('name');
  const address = req.nextUrl.searchParams.get('address');

  try {
    if (name) {
      // Resolve ENS name to address
      const resolvedAddress = await client.getEnsAddress({ name: name as string });
      if (!resolvedAddress) {
        return NextResponse.json({ error: 'ENS name not found' }, { status: 404 });
      }
      return NextResponse.json({ name, address: resolvedAddress });
    }

    if (address) {
      // Reverse resolve address to ENS name
      const ensName = await client.getEnsName({ address: address as `0x${string}` });
      return NextResponse.json({ address, name: ensName || null });
    }

    return NextResponse.json({ error: 'Provide name or address param' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: 'ENS resolution failed' }, { status: 500 });
  }
}
