'use client';

import { useReadContract, useWriteContract, useWaitForTransactionReceipt, useChainId } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { getYOVault, getUSDC, projectEstate, YIELD_ASSETS } from '@/lib/yo-config';

// ─── ERC-20 ABI fragments ─────────────────────────────────────────────────────
const ERC20_ABI = [
  { name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'allowance', type: 'function', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'approve', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }] },
] as const;

// ─── YO Vault ERC-4626 ABI ────────────────────────────────────────────────────
const YO_VAULT_ABI = [
  { name: 'totalAssets',    type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'totalSupply',    type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'balanceOf',      type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'convertToAssets',type: 'function', stateMutability: 'view', inputs: [{ name: 'shares', type: 'uint256' }], outputs: [{ type: 'uint256' }] },
  { name: 'previewDeposit', type: 'function', stateMutability: 'view', inputs: [{ name: 'assets', type: 'uint256' }], outputs: [{ type: 'uint256' }] },
  { name: 'previewRedeem',  type: 'function', stateMutability: 'view', inputs: [{ name: 'shares', type: 'uint256' }], outputs: [{ type: 'uint256' }] },
  { name: 'deposit',        type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'assets', type: 'uint256' }, { name: 'receiver', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'redeem',         type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'shares', type: 'uint256' }, { name: 'receiver', type: 'address' }, { name: 'owner', type: 'address' }], outputs: [{ type: 'uint256' }] },
] as const;

// ─── Will ABI fragments for YO ────────────────────────────────────────────────
const WILL_YO_ABI = [
  { name: 'depositUSDCToYO', type: 'function', stateMutability: 'nonpayable',
    inputs: [{ name: 'yoVaultAddress', type: 'address' }, { name: 'usdcAmount', type: 'uint256' }], outputs: [] },
  { name: 'getYOPosition', type: 'function', stateMutability: 'view', inputs: [],
    outputs: [{ type: 'tuple', components: [
      { name: 'vaultAddress',   type: 'address' },
      { name: 'sharesHeld',     type: 'uint256' },
      { name: 'principalUSDC', type: 'uint256' },
      { name: 'depositedAt',    type: 'uint64'  },
    ]}]},
  { name: 'currentYOValue', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'yieldEarned',    type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'initiateGuardianRedeem', type: 'function', stateMutability: 'nonpayable', inputs: [], outputs: [] },
  { name: 'executeGuardianRedeem',  type: 'function', stateMutability: 'nonpayable', inputs: [], outputs: [] },
  { name: 'setGuardian',    type: 'function', stateMutability: 'nonpayable', inputs: [{ name: '_guardian', type: 'address' }], outputs: [] },
  { name: 'guardian',       type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { name: 'guardianRedeemUnlocksAt', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
] as const;

// ─── Hook: YO vault state (totalAssets, APY, exchange rate) ──────────────────
export function useYOVaultState(vaultAddress?: `0x${string}`) {
  const totalAssets = useReadContract({
    address: vaultAddress,
    abi: YO_VAULT_ABI,
    functionName: 'totalAssets',
    query: { enabled: !!vaultAddress, refetchInterval: 30_000 },
  });

  const totalSupply = useReadContract({
    address: vaultAddress,
    abi: YO_VAULT_ABI,
    functionName: 'totalSupply',
    query: { enabled: !!vaultAddress, refetchInterval: 30_000 },
  });

  // Derive exchange rate: assets per share
  const exchangeRate =
    totalAssets.data && totalSupply.data && totalSupply.data > 0n
      ? Number(totalAssets.data) / Number(totalSupply.data)
      : 1;

  // Static APY from known vault type (YO doesn't expose APY on-chain directly)
  const apy = 7.2; // yoUSD ~7.2% — update via YO API if available

  return {
    totalAssets: totalAssets.data ?? 0n,
    totalSupply: totalSupply.data ?? 0n,
    exchangeRate,
    apy,
    isLoading: totalAssets.isLoading,
  };
}

// ─── Hook: User's YO balance in a vault ──────────────────────────────────────
export function useYOBalance(vaultAddress?: `0x${string}`, userAddress?: `0x${string}`) {
  const shares = useReadContract({
    address: vaultAddress,
    abi: YO_VAULT_ABI,
    functionName: 'balanceOf',
    args: userAddress ? [userAddress] : undefined,
    query: { enabled: !!vaultAddress && !!userAddress, refetchInterval: 15_000 },
  });

  const assets = useReadContract({
    address: vaultAddress,
    abi: YO_VAULT_ABI,
    functionName: 'convertToAssets',
    args: shares.data ? [shares.data] : undefined,
    query: { enabled: !!shares.data && shares.data > 0n, refetchInterval: 15_000 },
  });

  return {
    shares: shares.data ?? 0n,
    assets: assets.data ?? 0n,
    sharesFormatted: shares.data ? parseFloat(formatUnits(shares.data, 18)) : 0,
    assetsFormatted: assets.data ? parseFloat(formatUnits(assets.data, 6)) : 0,
  };
}

// ─── Hook: Will's YO position ─────────────────────────────────────────────────
export function useWillYOPosition(willAddress?: `0x${string}`) {
  const position = useReadContract({
    address: willAddress,
    abi: WILL_YO_ABI,
    functionName: 'getYOPosition',
    query: { enabled: !!willAddress, refetchInterval: 15_000 },
  });

  const currentValue = useReadContract({
    address: willAddress,
    abi: WILL_YO_ABI,
    functionName: 'currentYOValue',
    query: { enabled: !!willAddress, refetchInterval: 15_000 },
  });

  const yieldEarned = useReadContract({
    address: willAddress,
    abi: WILL_YO_ABI,
    functionName: 'yieldEarned',
    query: { enabled: !!willAddress, refetchInterval: 15_000 },
  });

  const pos = position.data;
  const principalUSDC = pos ? parseFloat(formatUnits(pos.principalUSDC, 6)) : 0;
  const currentUSDC   = currentValue.data ? parseFloat(formatUnits(currentValue.data, 6)) : principalUSDC;
  const yieldUSDC     = yieldEarned.data  ? parseFloat(formatUnits(yieldEarned.data, 6))  : 0;
  const apy           = 7.2; // yoUSD stable APY

  return {
    position: pos,
    principalUSDC,
    currentUSDC,
    yieldUSDC,
    apy,
    hasPosition: !!pos && pos.sharesHeld > 0n,
    isLoading: position.isLoading,
  };
}

// ─── Hook: Preview deposit into YO vault ─────────────────────────────────────
export function useYOPreviewDeposit(vaultAddress?: `0x${string}`, usdcAmount?: string) {
  const assets = usdcAmount && parseFloat(usdcAmount) > 0
    ? parseUnits(usdcAmount, 6)
    : undefined;

  return useReadContract({
    address: vaultAddress,
    abi: YO_VAULT_ABI,
    functionName: 'previewDeposit',
    args: assets ? [assets] : undefined,
    query: { enabled: !!vaultAddress && !!assets },
  });
}

// ─── Hook: Deposit USDC into Will's YO vault (2-step: approve + depositUSDCToYO)
export function useDepositUSDCToYO(willAddress?: `0x${string}`) {
  const chainId = useChainId();
  const usdcAddress = getUSDC(chainId);

  // Step 1: Approve USDC spend
  const {
    writeContract: approve,
    data: approveHash,
    isPending: isApproving,
  } = useWriteContract();
  const { isLoading: isConfirmingApprove, isSuccess: approveSuccess } =
    useWaitForTransactionReceipt({ hash: approveHash });

  // Step 2: Call depositUSDCToYO on the Will contract
  const {
    writeContract: deposit,
    data: depositHash,
    isPending: isDepositing,
  } = useWriteContract();
  const { isLoading: isConfirmingDeposit, isSuccess: depositSuccess } =
    useWaitForTransactionReceipt({ hash: depositHash });

  const depositUSDC = async (yoVaultAddress: `0x${string}`, usdcAmount: string) => {
    if (!willAddress) return;
    const amount = parseUnits(usdcAmount, 6);

    // Approve the Will contract to pull USDC
    approve({
      address: usdcAddress,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [willAddress, amount],
    });
  };

  // After approval confirmed, trigger the actual deposit
  const confirmDeposit = (yoVaultAddress: `0x${string}`, usdcAmount: string) => {
    if (!willAddress) return;
    const amount = parseUnits(usdcAmount, 6);
    deposit({
      address: willAddress,
      abi: WILL_YO_ABI,
      functionName: 'depositUSDCToYO',
      args: [yoVaultAddress, amount],
    });
  };

  return {
    depositUSDC,
    confirmDeposit,
    isApproving: isApproving || isConfirmingApprove,
    approveSuccess,
    isDepositing: isDepositing || isConfirmingDeposit,
    depositSuccess,
    usdcAddress,
  };
}

// ─── Hook: Check USDC allowance ───────────────────────────────────────────────
export function useUSDCAllowance(ownerAddress?: `0x${string}`, spenderAddress?: `0x${string}`) {
  const chainId = useChainId();
  const usdcAddress = getUSDC(chainId);

  return useReadContract({
    address: usdcAddress,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: ownerAddress && spenderAddress ? [ownerAddress, spenderAddress] : undefined,
    query: { enabled: !!ownerAddress && !!spenderAddress, refetchInterval: 5_000 },
  });
}

// ─── Hook: USDC balance ───────────────────────────────────────────────────────
export function useUSDCBalance(address?: `0x${string}`) {
  const chainId = useChainId();
  const usdcAddress = getUSDC(chainId);

  const result = useReadContract({
    address: usdcAddress,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 10_000 },
  });

  return {
    raw: result.data ?? 0n,
    formatted: result.data ? parseFloat(formatUnits(result.data, 6)) : 0,
    isLoading: result.isLoading,
  };
}

// ─── Hook: Guardian actions ───────────────────────────────────────────────────
export function useGuardianRedeem(willAddress?: `0x${string}`) {
  const guardian = useReadContract({
    address: willAddress,
    abi: WILL_YO_ABI,
    functionName: 'guardian',
    query: { enabled: !!willAddress },
  });

  const unlocksAt = useReadContract({
    address: willAddress,
    abi: WILL_YO_ABI,
    functionName: 'guardianRedeemUnlocksAt',
    query: { enabled: !!willAddress, refetchInterval: 10_000 },
  });

  const { writeContract: initiate, data: initiateHash, isPending: isInitiating } = useWriteContract();
  const { isLoading: isConfirmingInitiate, isSuccess: initiateSuccess } = useWaitForTransactionReceipt({ hash: initiateHash });

  const { writeContract: execute, data: executeHash, isPending: isExecuting } = useWriteContract();
  const { isLoading: isConfirmingExecute, isSuccess: executeSuccess } = useWaitForTransactionReceipt({ hash: executeHash });

  const { writeContract: setGuardianWrite, data: setHash, isPending: isSettingGuardian } = useWriteContract();
  const { isSuccess: setGuardianSuccess } = useWaitForTransactionReceipt({ hash: setHash });

  const initiateRedeem = () => {
    if (!willAddress) return;
    initiate({ address: willAddress, abi: WILL_YO_ABI, functionName: 'initiateGuardianRedeem' });
  };

  const executeRedeem = () => {
    if (!willAddress) return;
    execute({ address: willAddress, abi: WILL_YO_ABI, functionName: 'executeGuardianRedeem' });
  };

  const setGuardian = (guardianAddress: `0x${string}`) => {
    if (!willAddress) return;
    setGuardianWrite({ address: willAddress, abi: WILL_YO_ABI, functionName: 'setGuardian', args: [guardianAddress] });
  };

  const unlockTs = unlocksAt.data ? Number(unlocksAt.data) : 0;
  const hoursLeft = unlockTs > 0 ? Math.max(0, Math.ceil((unlockTs * 1000 - Date.now()) / 3_600_000)) : 0;

  return {
    guardian: guardian.data,
    unlocksAt: unlockTs,
    hoursLeft,
    hasPendingRedeem: unlockTs > 0,
    isUnlocked: unlockTs > 0 && Date.now() > unlockTs * 1000,
    initiateRedeem,
    isInitiating: isInitiating || isConfirmingInitiate,
    initiateSuccess,
    executeRedeem,
    isExecuting: isExecuting || isConfirmingExecute,
    executeSuccess,
    setGuardian,
    isSettingGuardian,
    setGuardianSuccess,
  };
}

// ─── Utility: project estate value ───────────────────────────────────────────
export function useEstateProjection(principalUSDC: number, apy: number) {
  const currentAge = 35; // placeholder — user could input this
  const targetAge  = 70;
  const years      = targetAge - currentAge;

  return {
    at70: projectEstate(principalUSDC, apy, years),
    at10y: projectEstate(principalUSDC, apy, 10),
    at5y:  projectEstate(principalUSDC, apy, 5),
    apy,
    years,
  };
}
