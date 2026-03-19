.PHONY: install test build deploy dev

install:
	cd contracts && forge install
	cd frontend && npm install --legacy-peer-deps
	cd agent && npm install

test:
	cd contracts && forge test -v

build:
	cd contracts && forge build
	cd frontend && npm run build
	cd agent && npx tsc --noEmit

# Deploy to Base Sepolia (set PRIVATE_KEY in contracts/.env first)
deploy:
	cd contracts && forge script script/Deploy.s.sol --rpc-url base_sepolia --broadcast --verify

dev-frontend:
	cd frontend && npm run dev

dev-agent:
	cd agent && npx ts-node src/index.ts
