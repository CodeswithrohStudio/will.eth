import deployedAddresses from './deployed-addresses.json';

export const CONTRACT_ADDRESSES = {
  REGISTRY: deployedAddresses.REGISTRY_ADDRESS as `0x${string}`,
  YIELD_VAULT: deployedAddresses.YIELD_VAULT_ADDRESS as `0x${string}`,
  ANON_AADHAAR: deployedAddresses.ANON_AADHAAR_ADDRESS as `0x${string}`,
};

export const WILL_REGISTRY_ABI = [
  {
    name: 'createWill',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'beneficiaries', type: 'address[]' },
      { name: 'ensNames', type: 'string[]' },
      { name: 'basisPoints', type: 'uint256[]' },
      { name: 'checkInInterval', type: 'uint256' },
      { name: 'fileverseDocId', type: 'string' },
    ],
    outputs: [{ name: 'willAddress', type: 'address' }],
  },
  {
    name: 'getTestatorWills',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'testator', type: 'address' }],
    outputs: [{ name: '', type: 'address[]' }],
  },
  {
    name: 'getAllWills',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address[]' }],
  },
  {
    name: 'getTriggerableWills',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: 'triggerable', type: 'address[]' }],
  },
  {
    name: 'getWillCount',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'isRegisteredWill',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'WillCreated',
    type: 'event',
    inputs: [
      { name: 'willAddress', type: 'address', indexed: true },
      { name: 'testator', type: 'address', indexed: true },
      { name: 'checkInInterval', type: 'uint256', indexed: false },
      { name: 'beneficiaryCount', type: 'uint256', indexed: false },
      { name: 'timestamp', type: 'uint256', indexed: false },
    ],
  },
] as const;

export const WILL_ABI = [
  // State
  { name: 'testator', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { name: 'state', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8' }] },
  { name: 'lastCheckIn', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'checkInInterval', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'depositedShares', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'ethBalanceAtDistribution', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'fileverseDocId', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { name: 'triggerTimestamp', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  {
    name: 'isBeneficiary',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'address' }],
    outputs: [{ type: 'bool' }],
  },
  // Views
  { name: 'isTriggerable', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'bool' }] },
  { name: 'deadline', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'daysUntilDeadline', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'int256' }] },
  { name: 'getBeneficiaryCount', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  {
    name: 'getState',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint8' }],
  },
  {
    name: 'getBeneficiaries',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{
      type: 'tuple[]',
      components: [
        { name: 'wallet', type: 'address' },
        { name: 'ensName', type: 'string' },
        { name: 'basisPoints', type: 'uint256' },
        { name: 'hasClaimed', type: 'bool' },
        { name: 'nullifierUsed', type: 'uint256' },
      ],
    }],
  },
  { name: 'totalYieldEarned', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  // Write functions
  { name: 'checkIn', type: 'function', stateMutability: 'nonpayable', inputs: [], outputs: [] },
  { name: 'trigger', type: 'function', stateMutability: 'nonpayable', inputs: [], outputs: [] },
  {
    name: 'depositETH',
    type: 'function',
    stateMutability: 'payable',
    inputs: [],
    outputs: [],
  },
  { name: 'revoke', type: 'function', stateMutability: 'nonpayable', inputs: [], outputs: [] },
  {
    name: 'claim',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'nullifierSeed', type: 'uint256' },
      { name: 'nullifier', type: 'uint256' },
      { name: 'timestamp', type: 'uint256' },
      { name: 'groth16Proof', type: 'uint256[8]' },
    ],
    outputs: [],
  },
  {
    name: 'updateCheckInInterval',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'newInterval', type: 'uint256' }],
    outputs: [],
  },
  // Events
  {
    name: 'CheckedIn',
    type: 'event',
    inputs: [
      { name: 'testator', type: 'address', indexed: true },
      { name: 'timestamp', type: 'uint256', indexed: false },
      { name: 'nextDeadline', type: 'uint256', indexed: false },
    ],
  },
  {
    name: 'WillTriggered',
    type: 'event',
    inputs: [
      { name: 'triggeredBy', type: 'address', indexed: true },
      { name: 'timestamp', type: 'uint256', indexed: false },
      { name: 'totalValue', type: 'uint256', indexed: false },
    ],
  },
  {
    name: 'Claimed',
    type: 'event',
    inputs: [
      { name: 'beneficiary', type: 'address', indexed: true },
      { name: 'ethAmount', type: 'uint256', indexed: false },
      { name: 'timestamp', type: 'uint256', indexed: false },
    ],
  },
] as const;
