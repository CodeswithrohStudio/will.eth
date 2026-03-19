import { createPublicClient, http } from 'viem';
import { sepolia } from 'viem/chains';

// Resolve ENS against Ethereum Sepolia for testnet
const client = createPublicClient({
  chain: sepolia,
  transport: http('https://rpc.ankr.com/eth_sepolia'),
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
