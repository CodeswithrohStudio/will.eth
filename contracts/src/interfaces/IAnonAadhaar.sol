// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IAnonAadhaar {
    function verifyAnonAadhaarProof(
        uint256 nullifierSeed,
        uint256 nullifier,
        uint256 timestamp,
        uint256 signal,
        uint256[4] calldata revealArray,
        uint256[8] calldata groth16Proof
    ) external view returns (bool valid);
}
