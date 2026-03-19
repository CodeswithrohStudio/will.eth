'use client';
import { useReadContract, useWriteContract, useWaitForTransactionReceipt, useAccount } from 'wagmi';
import { CONTRACT_ADDRESSES, WILL_REGISTRY_ABI } from '@/lib/contracts';
import { decodeEventLog } from 'viem';

export function useTestatorWills() {
  const { address } = useAccount();
  return useReadContract({
    address: CONTRACT_ADDRESSES.REGISTRY,
    abi: WILL_REGISTRY_ABI,
    functionName: 'getTestatorWills',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });
}

export function useWillCount() {
  return useReadContract({
    address: CONTRACT_ADDRESSES.REGISTRY,
    abi: WILL_REGISTRY_ABI,
    functionName: 'getWillCount',
  });
}

export function useCreateWill() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess, data: receipt } = useWaitForTransactionReceipt({ hash });

  // Extract the deployed Will address from the WillCreated event in the receipt
  const deployedWillAddress: `0x${string}` | undefined = (() => {
    if (!receipt) return undefined;
    for (const log of receipt.logs) {
      try {
        const decoded = decodeEventLog({
          abi: WILL_REGISTRY_ABI,
          eventName: 'WillCreated',
          data: log.data,
          topics: log.topics,
        });
        return (decoded.args as { willAddress: `0x${string}` }).willAddress;
      } catch {
        // Not a WillCreated log, skip
      }
    }
    return undefined;
  })();

  const createWill = (
    beneficiaries: `0x${string}`[],
    ensNames: string[],
    basisPoints: bigint[],
    checkInInterval: bigint,
    fileverseDocId: string
  ) => {
    writeContract({
      address: CONTRACT_ADDRESSES.REGISTRY,
      abi: WILL_REGISTRY_ABI,
      functionName: 'createWill',
      args: [beneficiaries, ensNames, basisPoints, checkInInterval, fileverseDocId],
    });
  };

  return { createWill, hash, isPending, isConfirming, isSuccess, deployedWillAddress, error };
}
