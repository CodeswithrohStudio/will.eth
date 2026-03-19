// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {WillRegistry} from "../src/WillRegistry.sol";
import {MockYieldVault} from "../src/mocks/MockYieldVault.sol";
import {MockAnonAadhaar} from "../src/mocks/MockAnonAadhaar.sol";

contract Deploy is Script {
    // ── Testnet USDC (Base Sepolia) ─────────────────────────────────────
    // Using Circle's official Base Sepolia USDC
    address constant BASE_SEPOLIA_USDC = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;

    // ── Mainnet addresses (for reference — not used in this testnet deploy) ──
    // USDC on Base mainnet: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
    // YO yoUSD vault:       0x0000000f2eb9f69274678c76222b35eec7588a65
    // YO yoETH vault:       0x3a43aec53490cb9fa922847385d82fe25d0e9de7

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        // Deploy mock dependencies (replace with real addresses on mainnet)
        MockYieldVault vault = new MockYieldVault();
        MockAnonAadhaar anonAadhaar = new MockAnonAadhaar();

        // Seed vault with ETH buffer for yield simulation
        vault.seed{value: 0.05 ether}();

        // Deploy registry — pass USDC address for YO integration
        WillRegistry registry = new WillRegistry(
            address(anonAadhaar),
            address(vault),
            BASE_SEPOLIA_USDC
        );

        vm.stopBroadcast();

        console.log("=== Will.eth Deployed ===");
        console.log("MockYieldVault:  ", address(vault));
        console.log("MockAnonAadhaar: ", address(anonAadhaar));
        console.log("WillRegistry:    ", address(registry));
        console.log("USDC (testnet):  ", BASE_SEPOLIA_USDC);

        // Write addresses to file for frontend
        string memory json = string.concat(
            '{\n',
            '  "REGISTRY_ADDRESS": "', vm.toString(address(registry)), '",\n',
            '  "YIELD_VAULT_ADDRESS": "', vm.toString(address(vault)), '",\n',
            '  "ANON_AADHAAR_ADDRESS": "', vm.toString(address(anonAadhaar)), '",\n',
            '  "USDC_ADDRESS": "', vm.toString(BASE_SEPOLIA_USDC), '",\n',
            '  "CHAIN_ID": "84532"\n',
            '}'
        );
        vm.writeFile("../frontend/src/lib/deployed-addresses.json", json);
        console.log("Addresses written to frontend/src/lib/deployed-addresses.json");
    }
}
