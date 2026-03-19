import { createPublicClient, http } from 'viem';
import { mainnet } from 'viem/chains';

const client = createPublicClient({
  chain: mainnet,
  transport: http('https://eth.llamarpc.com'),
});

export async function resolveENSName(name: string): Promise<string | null> {
  try {
    const address = await client.getEnsAddress({ name });
    return address;
  } catch {
    return null;
  }
}

export async function reverseResolve(address: `0x${string}`): Promise<string | null> {
  try {
    const name = await client.getEnsName({ address });
    return name;
  } catch {
    return null;
  }
}
