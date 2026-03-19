// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IYieldVault} from "./interfaces/IYieldVault.sol";
import {IYOVault} from "./interfaces/IYOVault.sol";
import {IAnonAadhaar} from "./interfaces/IAnonAadhaar.sol";

/// @title Will
/// @notice Dead man's switch crypto inheritance contract
/// @dev Supports ETH (via IYieldVault) and USDC (via YO Protocol ERC-4626 vaults).
///      YO vault on Base mainnet:
///        yoUSD: 0x0000000f2eb9f69274678c76222b35eec7588a65
///        yoETH: 0x3a43aec53490cb9fa922847385d82fe25d0e9de7
contract Will is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ─── Enums ────────────────────────────────────────────────────────────
    enum WillState {
        ACTIVE,       // Testator is alive, check-ins happening
        TRIGGERABLE,  // Check-in overdue, anyone can trigger distribution
        DISTRIBUTING, // Assets being distributed to beneficiaries
        REVOKED       // Testator cancelled the will
    }

    // ─── Structs ──────────────────────────────────────────────────────────
    struct Beneficiary {
        address wallet;
        string  ensName;
        uint256 basisPoints;  // Share of estate (sum must equal 10000)
        bool    hasClaimed;
        uint256 nullifierUsed;
    }

    /// @notice Tracks a USDC position in a YO Protocol vault
    struct YOPosition {
        address vaultAddress;   // YO vault address (e.g. yoUSD on Base)
        uint256 sharesHeld;     // yoTokens held by this contract
        uint256 principalUSDC;  // Original USDC deposited (6 decimals)
        uint64  depositedAt;    // Timestamp of first deposit
    }

    // ─── Immutables ───────────────────────────────────────────────────────
    address public immutable testator;
    address public immutable registry;
    IYieldVault public immutable yieldVault;    // ETH yield vault (legacy / testnet mock)
    IAnonAadhaar public immutable anonAadhaar;
    IERC20 public immutable usdc;               // USDC token contract

    // ─── Config ───────────────────────────────────────────────────────────
    uint256 public checkInInterval;
    string  public fileverseDocId;

    // ─── Guardian ─────────────────────────────────────────────────────────
    address public guardian;
    uint256 public guardianRedeemUnlocksAt;     // 0 = no pending redeem

    uint256 private constant GUARDIAN_TIMELOCK = 48 hours;

    // ─── YO Protocol Position ─────────────────────────────────────────────
    YOPosition public yoPosition;

    // ─── State ────────────────────────────────────────────────────────────
    WillState public state;
    uint256   public lastCheckIn;
    uint256   public triggerTimestamp;
    uint256   public depositedShares;               // ETH vault shares
    uint256   public ethBalanceAtDistribution;
    uint256   public usdcBalanceAtDistribution;     // USDC (principal + yield) at trigger

    Beneficiary[] public beneficiaries;
    mapping(uint256 => bool) public usedNullifiers;
    mapping(address => bool) public isBeneficiary;
    mapping(address => uint256) public beneficiaryIndex;

    // ─── Events ───────────────────────────────────────────────────────────
    event CheckedIn(address indexed testator, uint256 timestamp, uint256 nextDeadline);
    event WillTriggered(address indexed triggeredBy, uint256 timestamp, uint256 ethTotal, uint256 usdcTotal);
    event Claimed(address indexed beneficiary, uint256 ethAmount, uint256 usdcAmount, uint256 timestamp);
    event ETHDeposited(address indexed depositor, uint256 ethAmount, uint256 shares);
    event USDCDepositedToYO(address indexed depositor, address yoVault, uint256 usdcAmount, uint256 yoShares);
    event YORedeemed(address yoVault, uint256 shares, uint256 usdcReturned);
    event WillRevoked(address indexed testator, uint256 ethReturned, uint256 usdcReturned, uint256 timestamp);
    event GuardianSet(address indexed guardian);
    event GuardianRedeemInitiated(address indexed guardian, uint256 unlocksAt);
    event GuardianRedeemed(address indexed guardian, uint256 usdcReturned);
    event CheckInIntervalUpdated(uint256 oldInterval, uint256 newInterval);
    event FileverseDocUpdated(string newDocId);

    // ─── Modifiers ────────────────────────────────────────────────────────
    modifier onlyTestator() {
        require(msg.sender == testator, "Will: not testator");
        _;
    }

    modifier onlyActive() {
        require(state == WillState.ACTIVE, "Will: not active");
        _;
    }

    modifier onlyDistributing() {
        require(state == WillState.DISTRIBUTING, "Will: not distributing");
        _;
    }

    modifier onlyGuardian() {
        require(msg.sender == guardian, "Will: not guardian");
        _;
    }

    // ─── Constructor ──────────────────────────────────────────────────────
    constructor(
        address _testator,
        address _registry,
        address _yieldVault,
        address _anonAadhaar,
        address _usdc,
        address[] memory _beneficiaries,
        string[] memory _ensNames,
        uint256[] memory _basisPoints,
        uint256 _checkInInterval,
        string memory _fileverseDocId
    ) {
        require(_testator != address(0), "Will: zero testator");
        require(_beneficiaries.length > 0, "Will: no beneficiaries");
        require(_beneficiaries.length == _ensNames.length, "Will: array mismatch");
        require(_beneficiaries.length == _basisPoints.length, "Will: array mismatch");
        require(_checkInInterval >= 1 days, "Will: interval too short");

        uint256 totalBps;
        for (uint256 i = 0; i < _basisPoints.length; i++) {
            totalBps += _basisPoints[i];
        }
        require(totalBps == 10000, "Will: bps must sum to 10000");

        testator = _testator;
        registry = _registry;
        yieldVault = IYieldVault(_yieldVault);
        anonAadhaar = IAnonAadhaar(_anonAadhaar);
        usdc = IERC20(_usdc); // may be address(0) when USDC path is unused
        checkInInterval = _checkInInterval;
        fileverseDocId = _fileverseDocId;
        lastCheckIn = block.timestamp;
        state = WillState.ACTIVE;

        for (uint256 i = 0; i < _beneficiaries.length; i++) {
            require(_beneficiaries[i] != address(0), "Will: zero beneficiary");
            require(!isBeneficiary[_beneficiaries[i]], "Will: duplicate beneficiary");
            beneficiaryIndex[_beneficiaries[i]] = beneficiaries.length;
            isBeneficiary[_beneficiaries[i]] = true;
            beneficiaries.push(Beneficiary({
                wallet: _beneficiaries[i],
                ensName: _ensNames[i],
                basisPoints: _basisPoints[i],
                hasClaimed: false,
                nullifierUsed: 0
            }));
        }
    }

    // ─── Core: Check-In ───────────────────────────────────────────────────

    /// @notice Testator proves they are alive
    function checkIn() external onlyTestator onlyActive {
        lastCheckIn = block.timestamp;
        emit CheckedIn(testator, block.timestamp, block.timestamp + checkInInterval);
    }

    // ─── Core: Trigger ────────────────────────────────────────────────────

    /// @notice Anyone can call when check-in is overdue — starts distribution
    function trigger() external nonReentrant {
        require(
            state == WillState.ACTIVE || state == WillState.TRIGGERABLE,
            "Will: invalid state"
        );
        require(
            block.timestamp > lastCheckIn + checkInInterval,
            "Will: check-in not overdue"
        );

        state = WillState.DISTRIBUTING;
        triggerTimestamp = block.timestamp;

        // 1. Withdraw ETH from legacy yield vault
        if (depositedShares > 0) {
            try yieldVault.withdraw(depositedShares) returns (uint256) {}
            catch {}
            depositedShares = 0;
        }
        ethBalanceAtDistribution = address(this).balance;

        // 2. Redeem USDC from YO vault (principal + all accrued yield)
        if (yoPosition.sharesHeld > 0) {
            address yoAddr = yoPosition.vaultAddress;
            uint256 shares = yoPosition.sharesHeld;
            yoPosition.sharesHeld = 0;

            try IYOVault(yoAddr).redeem(shares, address(this), address(this)) returns (uint256 usdcReturned) {
                emit YORedeemed(yoAddr, shares, usdcReturned);
            } catch {}
        }
        usdcBalanceAtDistribution = _hasUSDC() ? usdc.balanceOf(address(this)) : 0;

        emit WillTriggered(msg.sender, block.timestamp, ethBalanceAtDistribution, usdcBalanceAtDistribution);
    }

    // ─── Core: Claim ──────────────────────────────────────────────────────

    /// @notice Beneficiary claims their share (ETH + USDC) using Anon Aadhaar ZK proof
    /// @param nullifierSeed  Must equal uint256(address(this)) — binds proof to this will
    /// @param nullifier      Unique nullifier from Anon Aadhaar
    /// @param timestamp      Proof generation timestamp (must be < 24h old)
    /// @param groth16Proof   ZK proof bytes [a0, a1, b00, b01, b10, b11, c0, c1]
    function claim(
        uint256 nullifierSeed,
        uint256 nullifier,
        uint256 timestamp,
        uint256[8] calldata groth16Proof
    ) external nonReentrant onlyDistributing {
        require(isBeneficiary[msg.sender], "Will: not a beneficiary");
        uint256 idx = beneficiaryIndex[msg.sender];
        require(!beneficiaries[idx].hasClaimed, "Will: already claimed");
        require(!usedNullifiers[nullifier], "Will: nullifier already used");
        require(
            nullifierSeed == uint256(uint160(address(this))),
            "Will: wrong nullifier seed"
        );

        bool valid = anonAadhaar.verifyAnonAadhaarProof(
            nullifierSeed,
            nullifier,
            timestamp,
            uint256(uint160(msg.sender)),
            [uint256(0), uint256(0), uint256(0), uint256(0)],
            groth16Proof
        );
        require(valid, "Will: invalid ZK proof");

        usedNullifiers[nullifier] = true;
        beneficiaries[idx].hasClaimed = true;
        beneficiaries[idx].nullifierUsed = nullifier;

        uint256 bps = beneficiaries[idx].basisPoints;

        // ETH share
        uint256 ethShare = (ethBalanceAtDistribution * bps) / 10000;
        uint256 ethAvail = address(this).balance;
        uint256 ethToSend = ethShare > ethAvail ? ethAvail : ethShare;
        if (ethToSend > 0) {
            (bool ok,) = payable(msg.sender).call{value: ethToSend}("");
            require(ok, "Will: ETH transfer failed");
        }

        // USDC share (principal + all YO yield)
        uint256 usdcToSend = 0;
        if (_hasUSDC() && usdcBalanceAtDistribution > 0) {
            uint256 usdcShare = (usdcBalanceAtDistribution * bps) / 10000;
            uint256 usdcAvail = usdc.balanceOf(address(this));
            usdcToSend = usdcShare > usdcAvail ? usdcAvail : usdcShare;
            if (usdcToSend > 0) usdc.safeTransfer(msg.sender, usdcToSend);
        }

        emit Claimed(msg.sender, ethToSend, usdcToSend, block.timestamp);
    }

    // ─── Deposits ─────────────────────────────────────────────────────────

    /// @notice Deposit ETH into the legacy yield vault (ETH path)
    function depositETH() external payable onlyTestator {
        require(msg.value > 0, "Will: zero deposit");
        require(state == WillState.ACTIVE || state == WillState.TRIGGERABLE, "Will: cannot deposit");

        uint256 shares = yieldVault.deposit{value: msg.value}(msg.value);
        depositedShares += shares;

        emit ETHDeposited(msg.sender, msg.value, shares);
    }

    /// @notice Deposit USDC into a YO Protocol vault — the yield layer
    /// @param yoVaultAddress  YO vault on Base (yoUSD: 0x0000000f..., yoETH: 0x3a43aec5...)
    /// @param usdcAmount      Amount of USDC (6 decimals) to deposit
    /// @dev Testator must approve(willAddress, usdcAmount) on USDC contract first
    function depositUSDCToYO(address yoVaultAddress, uint256 usdcAmount) external onlyTestator nonReentrant {
        require(_hasUSDC(), "Will: USDC not configured");
        require(usdcAmount > 0, "Will: zero amount");
        require(yoVaultAddress != address(0), "Will: zero vault");
        require(state == WillState.ACTIVE || state == WillState.TRIGGERABLE, "Will: cannot deposit");
        require(
            yoPosition.vaultAddress == address(0) || yoPosition.vaultAddress == yoVaultAddress,
            "Will: vault mismatch, revoke to switch vaults"
        );

        // Pull USDC from testator into this contract
        usdc.safeTransferFrom(msg.sender, address(this), usdcAmount);

        // Approve YO vault to spend our USDC
        usdc.forceApprove(yoVaultAddress, usdcAmount);

        // Deposit into YO vault → receive yoTokens (shares)
        uint256 sharesReceived = IYOVault(yoVaultAddress).deposit(usdcAmount, address(this));

        // Track position
        yoPosition.vaultAddress = yoVaultAddress;
        yoPosition.sharesHeld += sharesReceived;
        yoPosition.principalUSDC += usdcAmount;
        if (yoPosition.depositedAt == 0) {
            yoPosition.depositedAt = uint64(block.timestamp);
        }

        emit USDCDepositedToYO(msg.sender, yoVaultAddress, usdcAmount, sharesReceived);
    }

    // ─── Revoke ───────────────────────────────────────────────────────────

    /// @notice Testator cancels the will — all funds returned
    function revoke() external onlyTestator nonReentrant {
        require(state == WillState.ACTIVE || state == WillState.TRIGGERABLE, "Will: cannot revoke");

        state = WillState.REVOKED;

        // Withdraw ETH from legacy vault
        if (depositedShares > 0) {
            try yieldVault.withdraw(depositedShares) returns (uint256) {}
            catch {}
            depositedShares = 0;
        }

        // Redeem USDC from YO vault back to testator
        if (yoPosition.sharesHeld > 0) {
            try IYOVault(yoPosition.vaultAddress).redeem(
                yoPosition.sharesHeld, testator, address(this)
            ) returns (uint256 returned) {
                emit YORedeemed(yoPosition.vaultAddress, yoPosition.sharesHeld, returned);
            } catch {}
            yoPosition.sharesHeld = 0;
        }

        // Return any remaining USDC (edge case)
        uint256 usdcBal = 0;
        if (_hasUSDC()) {
            usdcBal = usdc.balanceOf(address(this));
            if (usdcBal > 0) usdc.safeTransfer(testator, usdcBal);
        }

        // Return ETH
        uint256 ethBal = address(this).balance;
        emit WillRevoked(testator, ethBal, usdcBal, block.timestamp);
        if (ethBal > 0) {
            (bool ok,) = payable(testator).call{value: ethBal}("");
            require(ok, "Will: revoke ETH failed");
        }
    }

    // ─── Guardian Emergency Redeem ────────────────────────────────────────

    /// @notice Testator designates a trusted guardian
    function setGuardian(address _guardian) external onlyTestator {
        require(_guardian != address(0), "Will: zero guardian");
        guardian = _guardian;
        emit GuardianSet(_guardian);
    }

    /// @notice Guardian initiates emergency redeem — starts 48h timelock
    /// @dev Only available during ACTIVE state (can't compete with trigger)
    function initiateGuardianRedeem() external onlyGuardian {
        require(yoPosition.sharesHeld > 0, "Will: no YO position");
        require(guardianRedeemUnlocksAt == 0, "Will: redeem already pending");
        require(state == WillState.ACTIVE, "Will: only during active state");

        guardianRedeemUnlocksAt = block.timestamp + GUARDIAN_TIMELOCK;
        emit GuardianRedeemInitiated(guardian, guardianRedeemUnlocksAt);
    }

    /// @notice Guardian executes redeem after 48h timelock expires
    /// @dev Principal + yield is returned to testator. Yield is included
    ///      as a full redemption; partial principal-only redemption would
    ///      require the vault to support it (out of scope for current YO spec).
    function executeGuardianRedeem() external onlyGuardian nonReentrant {
        require(guardianRedeemUnlocksAt > 0, "Will: no pending redeem");
        require(block.timestamp >= guardianRedeemUnlocksAt, "Will: timelock active");
        require(yoPosition.sharesHeld > 0, "Will: no shares");

        uint256 sharesToRedeem = yoPosition.sharesHeld;
        yoPosition.sharesHeld = 0;
        guardianRedeemUnlocksAt = 0;

        uint256 usdcReturned = IYOVault(yoPosition.vaultAddress).redeem(
            sharesToRedeem, testator, address(this)
        );

        emit GuardianRedeemed(guardian, usdcReturned);
    }

    // ─── Config ───────────────────────────────────────────────────────────

    function updateCheckInInterval(uint256 newInterval) external onlyTestator onlyActive {
        require(newInterval >= 1 days, "Will: interval too short");
        uint256 old = checkInInterval;
        checkInInterval = newInterval;
        emit CheckInIntervalUpdated(old, newInterval);
    }

    function updateFileverseDoc(string calldata newDocId) external onlyTestator {
        fileverseDocId = newDocId;
        emit FileverseDocUpdated(newDocId);
    }

    // ─── View Functions ───────────────────────────────────────────────────

    function isTriggerable() public view returns (bool) {
        return state == WillState.ACTIVE && block.timestamp > lastCheckIn + checkInInterval;
    }

    function deadline() public view returns (uint256) {
        return lastCheckIn + checkInInterval;
    }

    function daysUntilDeadline() public view returns (int256) {
        if (block.timestamp >= lastCheckIn + checkInInterval) {
            return -int256((block.timestamp - lastCheckIn - checkInInterval) / 1 days);
        }
        return int256((lastCheckIn + checkInInterval - block.timestamp) / 1 days);
    }

    function getBeneficiaries() external view returns (Beneficiary[] memory) {
        return beneficiaries;
    }

    function getBeneficiaryCount() external view returns (uint256) {
        return beneficiaries.length;
    }

    function getYOPosition() external view returns (YOPosition memory) {
        return yoPosition;
    }

    /// @notice Current USDC value of YO position (principal + accrued yield)
    function currentYOValue() external view returns (uint256) {
        if (yoPosition.sharesHeld == 0) return 0;
        try IYOVault(yoPosition.vaultAddress).previewRedeem(yoPosition.sharesHeld) returns (uint256 v) {
            return v;
        } catch {
            return yoPosition.principalUSDC;
        }
    }

    /// @notice Net yield earned above principal
    function yieldEarned() external view returns (uint256) {
        if (yoPosition.sharesHeld == 0) return 0;
        try IYOVault(yoPosition.vaultAddress).previewRedeem(yoPosition.sharesHeld) returns (uint256 current) {
            return current > yoPosition.principalUSDC ? current - yoPosition.principalUSDC : 0;
        } catch {
            return 0;
        }
    }

    function getState() external view returns (WillState) {
        if (state == WillState.ACTIVE && block.timestamp > lastCheckIn + checkInInterval) {
            return WillState.TRIGGERABLE;
        }
        return state;
    }

    function totalYieldEarned() external view returns (uint256) {
        if (depositedShares == 0) return 0;
        try yieldVault.previewWithdraw(depositedShares) returns (uint256 currentValue) {
            return currentValue > address(this).balance ? currentValue - address(this).balance : 0;
        } catch {
            return 0;
        }
    }

    /// @dev Returns true if a real USDC contract is configured
    function _hasUSDC() internal view returns (bool) {
        return address(usdc) != address(0);
    }

    receive() external payable {}
}
