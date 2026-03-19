// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IYOVault
/// @notice ERC-4626-compatible interface for YO Protocol vaults
/// @dev Real vault addresses on Base mainnet:
///      yoUSD: 0x0000000f2eb9f69274678c76222b35eec7588a65
///      yoETH: 0x3a43aec53490cb9fa922847385d82fe25d0e9de7
interface IYOVault {
    // ─── ERC-20 ───────────────────────────────────────────────────────────
    function balanceOf(address account) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);

    // ─── ERC-4626 ─────────────────────────────────────────────────────────

    /// @notice The ERC-20 asset this vault accepts (e.g. USDC address)
    function asset() external view returns (address);

    /// @notice Deposit `assets` amount of underlying, receive `shares` yoTokens
    function deposit(uint256 assets, address receiver) external returns (uint256 shares);

    /// @notice Burn `shares` yoTokens, receive `assets` amount of underlying
    function redeem(uint256 shares, address receiver, address owner) external returns (uint256 assets);

    /// @notice Preview how many shares a given asset deposit would yield
    function previewDeposit(uint256 assets) external view returns (uint256 shares);

    /// @notice Preview how many assets a given shares redemption would yield
    function previewRedeem(uint256 shares) external view returns (uint256 assets);

    /// @notice Convert shares to underlying asset amount at current exchange rate
    function convertToAssets(uint256 shares) external view returns (uint256 assets);

    /// @notice Total underlying assets held by the vault
    function totalAssets() external view returns (uint256);

    /// @notice Total yoToken supply
    function totalSupply() external view returns (uint256);
}
