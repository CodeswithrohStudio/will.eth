# will.eth

**Onchain crypto inheritance via dead man's switch — no lawyers, no courts, no middlemen.**

$140B in crypto is lost every year when people die without a plan. There's no "forgot password" for a private key, and no probate court that can unlock a wallet. will.eth fixes this: set up your will once, check in monthly, and your heirs receive everything automatically if you stop.

---

## How it works

1. **Create your will** — Assign percentages to ENS names or wallet addresses. Deploy to Base in under 5 minutes.
2. **Check in monthly** — Tap a button in the app, or reply `ALIVE` to your Telegram bot. The contract resets.
3. **If the worst happens** — Miss two check-ins and any heir can trigger distribution. They claim using an Anon Aadhaar ZK proof — no KYC, no documents, no courts.
4. **While you're alive, your estate grows** — Idle funds earn ~7% APY in a YO Protocol vault on Base.

---

## Architecture

```
will.eth/
├── contracts/          Solidity — core protocol
│   ├── src/Will.sol            Dead man's switch contract (per-will)
│   ├── src/WillRegistry.sol    Factory — deploys and indexes wills
│   ├── src/interfaces/
│   │   └── IYOVault.sol        ERC-4626 interface for YO Protocol
│   └── script/Deploy.s.sol     Foundry deploy script
│
├── frontend/           Next.js 14 App Router
│   ├── src/app/
│   │   ├── page.tsx            Landing — storytelling-first
│   │   ├── create/page.tsx     4-step will creation wizard
│   │   ├── dashboard/page.tsx  Check-in, yield counter, will management
│   │   └── claim/page.tsx      Heir claim flow (ZK proof → receive ETH)
│   ├── src/hooks/              wagmi hooks for every contract call
│   ├── src/lib/                ABIs, types, deployed addresses
│   └── src/components/
│       └── YOWillDashboard.tsx YO Protocol yield panel
│
└── agent/              Node.js — Telegram bot + cron monitor
    └── src/
        ├── telegram/telegramBot.ts   Bot messages (reminders, alerts)
        ├── cron/checkInMonitor.ts    Polls Base every 6h, sends reminders
        └── index.ts                  Express server + bot handlers
```

---

## Deployed Contracts (Base Sepolia)

| Contract | Address |
|---|---|
| WillRegistry | [`0x54cE848C87C0C1F4bD15550Ef6CD36889D7A01DC`](https://sepolia.basescan.org/address/0x54cE848C87C0C1F4bD15550Ef6CD36889D7A01DC) |
| MockYieldVault | [`0xC2EE67446F85c37754BdD7b488C3A508cD3C09C1`](https://sepolia.basescan.org/address/0xC2EE67446F85c37754BdD7b488C3A508cD3C09C1) |
| AnonAadhaar | [`0x5706C45D8DCa96962c7baf3D7b5A34E59F4F52D2`](https://sepolia.basescan.org/address/0x5706C45D8DCa96962c7baf3D7b5A34E59F4F52D2) |

---

## Tech Stack

| Layer | Tech |
|---|---|
| Smart contracts | Solidity, Foundry, Base (L2) |
| Yield | YO Protocol (ERC-4626, yoUSD / yoETH) |
| Identity | Anon Aadhaar (ZK proofs — no personal data onchain) |
| ENS | viem ENS resolution (Ethereum mainnet) |
| Frontend | Next.js 14, wagmi, RainbowKit, Tailwind CSS v4 |
| Notifications | Telegram Bot API (node-telegram-bot-api) |
| Agent | Node.js, Express, SQLite, node-cron |

---

## Local Setup

### Prerequisites
- Node.js ≥ 20.9
- Foundry (`curl -L https://foundry.paradigm.xyz | bash`)

### 1. Contracts

```bash
cd contracts
forge install
forge build
forge test
```

Deploy to Base Sepolia:
```bash
cp .env.example .env   # fill PRIVATE_KEY and BASESCAN_API_KEY
forge script script/Deploy.s.sol --rpc-url https://sepolia.base.org --broadcast
```

### 2. Frontend

```bash
cd frontend
npm install
cp .env.example .env.local  # fill NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 3. Telegram Agent

**Create your bot first:**
1. Open Telegram → message `@BotFather` → `/newbot`
2. Copy the token it gives you

```bash
cd agent
npm install
cp .env.example .env    # paste your TELEGRAM_BOT_TOKEN
npm run dev
```

The agent starts long polling immediately. Send your wallet address to the bot to register for reminders.

**Bot commands:**

| Message | Action |
|---|---|
| `/start` | Welcome + instructions |
| `0x1234...abcd` | Register wallet |
| `ALIVE` | Acknowledge check-in reminder |
| `/status` | Show registered wallet |
| `/dashboard` | Dashboard link |

---

## Key Contracts

### Will.sol
Each deployed will is its own contract with:
- `depositETH()` / `depositUSDCToYO()` — fund the estate
- `checkIn()` — reset the deadline (testator only)
- `trigger()` — anyone can call after deadline passes
- `claim(nullifierSeed, nullifier, timestamp, proof)` — heir claims with ZK proof
- `revoke()` — testator cancels and withdraws all funds

### WillRegistry.sol
Factory that deploys `Will` contracts and maintains a global index:
- `createWill(beneficiaries, ensNames, bps, interval, docURI)`
- `getTriggerableWills()` — used by agent to find overdue wills
- `getTestatorWills(address)` — used by dashboard

---

## Environment Variables

**frontend/.env.local**
```
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id
```

**agent/.env**
```
TELEGRAM_BOT_TOKEN=1234567890:ABCdef...
REGISTRY_ADDRESS=0x54cE848C87C0C1F4bD15550Ef6CD36889D7A01DC
BASE_SEPOLIA_RPC=https://sepolia.base.org
RELAYER_PRIVATE_KEY=0x...   # optional: for bot-relayed check-ins
AGENT_DB_PATH=./agent.db
```
