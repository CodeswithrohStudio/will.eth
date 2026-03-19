'use client';
import {
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from 'wagmi';
import { WILL_ABI } from '@/lib/contracts';
import { parseEther } from 'viem';

export function useWillState(willAddress?: `0x${string}`) {
  const state = useReadContract({
    address: willAddress,
    abi: WILL_ABI,
    functionName: 'getState',
    query: { enabled: !!willAddress, refetchInterval: 10000 },
  });

  const lastCheckIn = useReadContract({
    address: willAddress,
    abi: WILL_ABI,
    functionName: 'lastCheckIn',
    query: { enabled: !!willAddress, refetchInterval: 15000 },
  });

  const checkInInterval = useReadContract({
    address: willAddress,
    abi: WILL_ABI,
    functionName: 'checkInInterval',
    query: { enabled: !!willAddress },
  });

  const deadline = useReadContract({
    address: willAddress,
    abi: WILL_ABI,
    functionName: 'deadline',
    query: { enabled: !!willAddress, refetchInterval: 30000 },
  });

  const daysUntilDeadline = useReadContract({
    address: willAddress,
    abi: WILL_ABI,
    functionName: 'daysUntilDeadline',
    query: { enabled: !!willAddress, refetchInterval: 30000 },
  });

  const beneficiaries = useReadContract({
    address: willAddress,
    abi: WILL_ABI,
    functionName: 'getBeneficiaries',
    query: { enabled: !!willAddress },
  });

  const depositedShares = useReadContract({
    address: willAddress,
    abi: WILL_ABI,
    functionName: 'depositedShares',
    query: { enabled: !!willAddress, refetchInterval: 15000 },
  });

  const fileverseDocId = useReadContract({
    address: willAddress,
    abi: WILL_ABI,
    functionName: 'fileverseDocId',
    query: { enabled: !!willAddress },
  });

  const ethBalanceAtDistribution = useReadContract({
    address: willAddress,
    abi: WILL_ABI,
    functionName: 'ethBalanceAtDistribution',
    query: { enabled: !!willAddress },
  });

  return {
    state: state.data,
    lastCheckIn: lastCheckIn.data,
    checkInInterval: checkInInterval.data,
    deadline: deadline.data,
    daysUntilDeadline: daysUntilDeadline.data,
    beneficiaries: beneficiaries.data,
    depositedShares: depositedShares.data,
    fileverseDocId: fileverseDocId.data,
    ethBalanceAtDistribution: ethBalanceAtDistribution.data,
    isLoading: state.isLoading,
  };
}

export function useCheckIn(willAddress?: `0x${string}`) {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const checkIn = () => {
    if (!willAddress) return;
    writeContract({
      address: willAddress,
      abi: WILL_ABI,
      functionName: 'checkIn',
    });
  };

  return { checkIn, hash, isPending, isConfirming, isSuccess, error };
}

export function useTrigger(willAddress?: `0x${string}`) {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const trigger = () => {
    if (!willAddress) return;
    writeContract({
      address: willAddress,
      abi: WILL_ABI,
      functionName: 'trigger',
    });
  };

  return { trigger, hash, isPending, isConfirming, isSuccess, error };
}

export function useDepositETH(willAddress?: `0x${string}`) {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const depositETH = (ethAmount: string) => {
    if (!willAddress) return;
    writeContract({
      address: willAddress,
      abi: WILL_ABI,
      functionName: 'depositETH',
      value: parseEther(ethAmount),
    });
  };

  return { depositETH, hash, isPending, isConfirming, isSuccess, error };
}

export function useClaim(willAddress?: `0x${string}`) {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const claim = (
    nullifierSeed: bigint,
    nullifier: bigint,
    timestamp: bigint,
    groth16Proof: readonly [bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint]
  ) => {
    if (!willAddress) return;
    writeContract({
      address: willAddress,
      abi: WILL_ABI,
      functionName: 'claim',
      args: [nullifierSeed, nullifier, timestamp, groth16Proof],
    });
  };

  return { claim, hash, isPending, isConfirming, isSuccess, error };
}

export function useRevoke(willAddress?: `0x${string}`) {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const revoke = () => {
    if (!willAddress) return;
    writeContract({
      address: willAddress,
      abi: WILL_ABI,
      functionName: 'revoke',
    });
  };

  return { revoke, hash, isPending, isConfirming, isSuccess, error };
}

export function useIsBeneficiary(willAddress?: `0x${string}`, userAddress?: `0x${string}`) {
  return useReadContract({
    address: willAddress,
    abi: WILL_ABI,
    functionName: 'isBeneficiary',
    args: userAddress ? [userAddress] : undefined,
    query: { enabled: !!willAddress && !!userAddress },
  });
}
