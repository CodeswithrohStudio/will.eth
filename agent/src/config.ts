import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3001'),
  baseSepolia: {
    rpc: process.env.BASE_SEPOLIA_RPC || 'https://sepolia.base.org',
    relayerKey: process.env.RELAYER_PRIVATE_KEY as `0x${string}`,
  },
  contracts: {
    registry: process.env.REGISTRY_ADDRESS as `0x${string}`,
  },
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN!,
  },
  mongoUri: process.env.MONGO_URI!,
};
