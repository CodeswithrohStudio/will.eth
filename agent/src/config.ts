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
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID!,
    authToken: process.env.TWILIO_AUTH_TOKEN!,
    from: process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886',
  },
  dbPath: process.env.AGENT_DB_PATH || './agent.db',
};
