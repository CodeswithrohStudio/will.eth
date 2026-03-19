export enum WillState {
  ACTIVE = 0,
  TRIGGERABLE = 1,
  DISTRIBUTING = 2,
  REVOKED = 3,
}

export interface Beneficiary {
  wallet: `0x${string}`;
  ensName: string;
  basisPoints: bigint;
  hasClaimed: boolean;
  nullifierUsed: bigint;
}

export interface WillData {
  address: `0x${string}`;
  testator: `0x${string}`;
  state: WillState;
  lastCheckIn: bigint;
  checkInInterval: bigint;
  deadline: bigint;
  daysUntilDeadline: bigint;
  depositedShares: bigint;
  ethBalanceAtDistribution: bigint;
  fileverseDocId: string;
  beneficiaries: Beneficiary[];
}

export interface BeneficiaryDraft {
  address: string;
  ensName: string;
  percentage: number;
  ensResolved: boolean;
}

export const WILL_STATE_LABELS: Record<WillState, string> = {
  [WillState.ACTIVE]: 'Active',
  [WillState.TRIGGERABLE]: 'Overdue',
  [WillState.DISTRIBUTING]: 'Distributing',
  [WillState.REVOKED]: 'Revoked',
};

export const WILL_STATE_COLORS: Record<WillState, string> = {
  [WillState.ACTIVE]: 'text-green-400 bg-green-900/40 border-green-700',
  [WillState.TRIGGERABLE]: 'text-red-400 bg-red-900/40 border-red-700 animate-pulse',
  [WillState.DISTRIBUTING]: 'text-yellow-400 bg-yellow-900/40 border-yellow-700',
  [WillState.REVOKED]: 'text-gray-400 bg-gray-900/40 border-gray-700',
};

export const CHECK_IN_INTERVALS = [
  { label: '7 days', value: 7 * 24 * 60 * 60 },
  { label: '30 days', value: 30 * 24 * 60 * 60 },
  { label: '90 days', value: 90 * 24 * 60 * 60 },
  { label: '180 days', value: 180 * 24 * 60 * 60 },
  { label: '1 year', value: 365 * 24 * 60 * 60 },
];
