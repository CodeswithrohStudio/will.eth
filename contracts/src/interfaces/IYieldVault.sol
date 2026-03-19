// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IYieldVault {
    function deposit(uint256 amount) external payable returns (uint256 shares);
    function withdraw(uint256 shares) external returns (uint256 assets);
    function previewWithdraw(uint256 shares) external view returns (uint256 assets);
    function currentAPY() external view returns (uint256 bps);

    event Deposited(address indexed caller, uint256 amount, uint256 shares);
    event Withdrawn(address indexed caller, uint256 shares, uint256 assets);
}
