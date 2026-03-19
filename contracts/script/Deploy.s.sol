// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {WillRegistry} from "../src/WillRegistry.sol";
import {MockYieldVault} from "../src/mocks/MockYieldVault.sol";
import {MockAnonAadhaar} from "../src/mocks/MockAnonAadhaar.sol";

contract Deploy is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        // Deploy mock dependencies (replace with real addresses on mainnet)
        MockYieldVault vault = new MockYieldVault();
        MockAnonAadhaar anonAadhaar = new MockAnonAadhaar();

        // Seed vault with ETH buffer for yield simulation
        vault.seed{value: 0.05 ether}();

        // Deploy registry
        WillRegistry registry = new WillRegistry(
            address(anonAadhaar),
            address(vault)
        );

        vm.stopBroadcast();

        console.log("=== Will.eth Deployed ===");
        console.log("MockYieldVault:  ", address(vault));
        console.log("MockAnonAadhaar: ", address(anonAadhaar));
        console.log("WillRegistry:    ", address(registry));

        // Write addresses to file for frontend
        string memory json = string.concat(
            '{\n',
            '  "REGISTRY_ADDRESS": "', vm.toString(address(registry)), '",\n',
            '  "YIELD_VAULT_ADDRESS": "', vm.toString(address(vault)), '",\n',
            '  "ANON_AADHAAR_ADDRESS": "', vm.toString(address(anonAadhaar)), '",\n',
            '  "CHAIN_ID": "84532"\n',
            '}'
        );
        vm.writeFile("../frontend/src/lib/deployed-addresses.json", json);
        console.log("Addresses written to frontend/src/lib/deployed-addresses.json");
    }
}
