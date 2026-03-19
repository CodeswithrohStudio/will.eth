// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IYieldVault} from "../interfaces/IYieldVault.sol";

/// @title MockYieldVault
/// @notice Simulates 5% APY yield vault for hackathon demo
contract MockYieldVault is IYieldVault {
    uint256 public constant APY_BPS = 500; // 5% APY in basis points
    uint256 public constant SECONDS_PER_YEAR = 365 days;
    uint256 private constant PRECISION = 1e18;

    struct DepositInfo {
        uint256 principal;
        uint256 depositTime;
        bool active;
    }

    mapping(address => DepositInfo) public deposits;
    uint256 public totalShares;

    receive() external payable {}

    function deposit(uint256 /*amount*/) external payable override returns (uint256 shares) {
        require(msg.value > 0, "MockYieldVault: zero deposit");
        shares = msg.value; // 1:1 shares for simplicity

        if (deposits[msg.sender].active) {
            // Compound existing deposit
            uint256 currentValue = _currentValue(msg.sender);
            deposits[msg.sender].principal = currentValue + msg.value;
            deposits[msg.sender].depositTime = block.timestamp;
        } else {
            deposits[msg.sender] = DepositInfo({
                principal: msg.value,
                depositTime: block.timestamp,
                active: true
            });
        }

        totalShares += shares;
        emit Deposited(msg.sender, msg.value, shares);
    }

    function withdraw(uint256 shares) external override returns (uint256 assets) {
        require(deposits[msg.sender].active, "MockYieldVault: no deposit");
        assets = _currentValue(msg.sender);

        // Reset deposit
        deposits[msg.sender].active = false;
        deposits[msg.sender].principal = 0;
        totalShares = totalShares >= shares ? totalShares - shares : 0;

        // Transfer assets (principal + yield)
        // Seed the vault with extra ETH to simulate yield payouts
        uint256 contractBalance = address(this).balance;
        uint256 toSend = assets > contractBalance ? contractBalance : assets;
        (bool success,) = payable(msg.sender).call{value: toSend}("");
        require(success, "MockYieldVault: transfer failed");

        emit Withdrawn(msg.sender, shares, toSend);
        return toSend;
    }

    function previewWithdraw(uint256 /*shares*/) external view override returns (uint256 assets) {
        return _currentValue(msg.sender);
    }

    function currentAPY() external pure override returns (uint256 bps) {
        return APY_BPS;
    }

    function _currentValue(address depositor) internal view returns (uint256) {
        DepositInfo storage info = deposits[depositor];
        if (!info.active || info.principal == 0) return 0;

        uint256 elapsed = block.timestamp - info.depositTime;
        // yield = principal * APY_BPS * elapsed / (10000 * SECONDS_PER_YEAR)
        uint256 yield = (info.principal * APY_BPS * elapsed) / (10000 * SECONDS_PER_YEAR);
        return info.principal + yield;
    }

    function currentValueOf(address depositor) external view returns (uint256) {
        return _currentValue(depositor);
    }

    /// @dev Seed function to fund the vault with yield buffer
    function seed() external payable {}
}
