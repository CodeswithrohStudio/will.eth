// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IAnonAadhaar} from "../interfaces/IAnonAadhaar.sol";

/// @title MockAnonAadhaar
/// @notice Always-valid Anon Aadhaar verifier for hackathon demo
/// @dev Replace with real verifier address in production
contract MockAnonAadhaar is IAnonAadhaar {
    /// @notice In demo mode, any proof with a non-zero nullifier is valid
    function verifyAnonAadhaarProof(
        uint256 /*nullifierSeed*/,
        uint256 nullifier,
        uint256 timestamp,
        uint256 /*signal*/,
        uint256[4] calldata /*revealArray*/,
        uint256[8] calldata /*groth16Proof*/
    ) external view override returns (bool valid) {
        // Basic sanity checks
        require(nullifier != 0, "MockAnonAadhaar: zero nullifier");
        require(timestamp > 0, "MockAnonAadhaar: zero timestamp");
        // Proof must be generated within the last 24 hours
        require(
            timestamp > block.timestamp - 1 days,
            "MockAnonAadhaar: proof expired"
        );
        return true;
    }
}
