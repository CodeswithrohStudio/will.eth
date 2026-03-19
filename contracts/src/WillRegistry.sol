// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Will} from "./Will.sol";

/// @title WillRegistry
/// @notice Factory contract that deploys and tracks all Will instances
contract WillRegistry {
    // ─── State ────────────────────────────────────────────────────────────
    address public immutable anonAadhaar;
    address public immutable yieldVault;
    address public immutable usdc; // USDC token passed to each Will

    mapping(address => address[]) public testatorWills;
    mapping(address => bool) public isRegisteredWill;

    address[] public allWills;

    // ─── Events ───────────────────────────────────────────────────────────
    event WillCreated(
        address indexed willAddress,
        address indexed testator,
        uint256 checkInInterval,
        uint256 beneficiaryCount,
        uint256 timestamp
    );

    // ─── Constructor ──────────────────────────────────────────────────────
    constructor(address _anonAadhaar, address _yieldVault, address _usdc) {
        require(_anonAadhaar != address(0), "Registry: zero anonAadhaar");
        require(_yieldVault != address(0), "Registry: zero yieldVault");
        anonAadhaar = _anonAadhaar;
        yieldVault = _yieldVault;
        usdc = _usdc; // may be address(0) on testnet — Will handles this
    }

    // ─── Functions ────────────────────────────────────────────────────────

    /// @notice Deploy a new Will contract
    /// @param beneficiaries     Array of heir wallet addresses
    /// @param ensNames          Human-readable ENS names (parallel array)
    /// @param basisPoints       Shares in basis points (must sum to 10000)
    /// @param checkInInterval   Seconds between required check-ins (min 1 day)
    /// @param fileverseDocId    IPFS/Fileverse CID of the letter of wishes
    function createWill(
        address[] calldata beneficiaries,
        string[] calldata ensNames,
        uint256[] calldata basisPoints,
        uint256 checkInInterval,
        string calldata fileverseDocId
    ) external returns (address willAddress) {
        Will will = new Will(
            msg.sender,
            address(this),
            yieldVault,
            anonAadhaar,
            usdc,
            beneficiaries,
            ensNames,
            basisPoints,
            checkInInterval,
            fileverseDocId
        );

        willAddress = address(will);
        testatorWills[msg.sender].push(willAddress);
        isRegisteredWill[willAddress] = true;
        allWills.push(willAddress);

        emit WillCreated(
            willAddress,
            msg.sender,
            checkInInterval,
            beneficiaries.length,
            block.timestamp
        );
    }

    // ─── View Functions ───────────────────────────────────────────────────

    function getTestatorWills(address testator) external view returns (address[] memory) {
        return testatorWills[testator];
    }

    function getWillCount() external view returns (uint256) {
        return allWills.length;
    }

    function getAllWills() external view returns (address[] memory) {
        return allWills;
    }

    /// @notice Get wills that are currently overdue (triggerable)
    function getTriggerableWills() external view returns (address[] memory triggerable) {
        uint256 count = 0;
        for (uint256 i = 0; i < allWills.length; i++) {
            try Will(payable(allWills[i])).isTriggerable() returns (bool t) {
                if (t) count++;
            } catch {}
        }

        triggerable = new address[](count);
        uint256 idx = 0;
        for (uint256 i = 0; i < allWills.length; i++) {
            try Will(payable(allWills[i])).isTriggerable() returns (bool t) {
                if (t) triggerable[idx++] = allWills[i];
            } catch {}
        }
    }
}
