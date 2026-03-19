// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IYieldVault} from "./interfaces/IYieldVault.sol";
import {IAnonAadhaar} from "./interfaces/IAnonAadhaar.sol";

/// @title Will
/// @notice Dead man's switch crypto inheritance contract
/// @dev Deploy via WillRegistry. Testator must check in periodically or assets flow to heirs.
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

    // ─── Immutables ───────────────────────────────────────────────────────
    address public immutable testator;
    address public immutable registry;
    IYieldVault public immutable yieldVault;
    IAnonAadhaar public immutable anonAadhaar;

    // ─── Config ───────────────────────────────────────────────────────────
    uint256 public checkInInterval;
    string  public fileverseDocId;

    // ─── State ────────────────────────────────────────────────────────────
    WillState public state;
    uint256   public lastCheckIn;
    uint256   public triggerTimestamp;
    uint256   public depositedShares;
    uint256   public ethBalanceAtDistribution;

    Beneficiary[] public beneficiaries;
    mapping(uint256 => bool) public usedNullifiers;
    mapping(address => bool) public isBeneficiary;
    mapping(address => uint256) public beneficiaryIndex;

    // ─── Events ───────────────────────────────────────────────────────────
    event CheckedIn(address indexed testator, uint256 timestamp, uint256 nextDeadline);
    event WillTriggered(address indexed triggeredBy, uint256 timestamp, uint256 totalValue);
    event Claimed(address indexed beneficiary, uint256 ethAmount, uint256 timestamp);
    event FundsDeposited(address indexed depositor, uint256 ethAmount, uint256 shares);
    event WillRevoked(address indexed testator, uint256 ethReturned, uint256 timestamp);
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

    // ─── Constructor ──────────────────────────────────────────────────────
    constructor(
        address _testator,
        address _registry,
        address _yieldVault,
        address _anonAadhaar,
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

        // Validate basis points sum to 10000
        uint256 totalBps;
        for (uint256 i = 0; i < _basisPoints.length; i++) {
            totalBps += _basisPoints[i];
        }
        require(totalBps == 10000, "Will: bps must sum to 10000");

        testator = _testator;
        registry = _registry;
        yieldVault = IYieldVault(_yieldVault);
        anonAadhaar = IAnonAadhaar(_anonAadhaar);
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

    // ─── Core Functions ───────────────────────────────────────────────────

    /// @notice Testator proves they are alive
    function checkIn() external onlyTestator onlyActive {
        lastCheckIn = block.timestamp;
        emit CheckedIn(testator, block.timestamp, block.timestamp + checkInInterval);
    }

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

        // Withdraw all funds from yield vault
        uint256 withdrawn = 0;
        if (depositedShares > 0) {
            try yieldVault.withdraw(depositedShares) returns (uint256 assets) {
                withdrawn = assets;
            } catch {
                // Vault withdrawal failed — distribute whatever is in the contract
            }
            depositedShares = 0;
        }

        ethBalanceAtDistribution = address(this).balance;
        emit WillTriggered(msg.sender, block.timestamp, ethBalanceAtDistribution);
    }

    /// @notice Beneficiary claims their share using Anon Aadhaar ZK proof
    /// @param nullifierSeed Must equal uint256(address(this)) — binds proof to this will
    /// @param nullifier     Unique nullifier from Anon Aadhaar
    /// @param timestamp     Proof generation timestamp (must be < 24h old)
    /// @param groth16Proof  ZK proof bytes [a0, a1, b00, b01, b10, b11, c0, c1]
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

        // Verify Anon Aadhaar ZK proof
        bool valid = anonAadhaar.verifyAnonAadhaarProof(
            nullifierSeed,
            nullifier,
            timestamp,
            uint256(uint160(msg.sender)), // signal = claimer address
            [uint256(0), uint256(0), uint256(0), uint256(0)], // no reveals needed
            groth16Proof
        );
        require(valid, "Will: invalid ZK proof");

        // Mark as claimed
        usedNullifiers[nullifier] = true;
        beneficiaries[idx].hasClaimed = true;
        beneficiaries[idx].nullifierUsed = nullifier;

        // Calculate share
        uint256 share = (ethBalanceAtDistribution * beneficiaries[idx].basisPoints) / 10000;
        uint256 available = address(this).balance;
        uint256 toSend = share > available ? available : share;

        if (toSend > 0) {
            (bool success,) = payable(msg.sender).call{value: toSend}("");
            require(success, "Will: transfer failed");
        }

        emit Claimed(msg.sender, toSend, block.timestamp);
    }

    /// @notice Deposit ETH into yield vault
    function depositETH() external payable onlyTestator {
        require(msg.value > 0, "Will: zero deposit");
        require(
            state == WillState.ACTIVE || state == WillState.TRIGGERABLE,
            "Will: cannot deposit"
        );

        uint256 shares = yieldVault.deposit{value: msg.value}(msg.value);
        depositedShares += shares;

        emit FundsDeposited(msg.sender, msg.value, shares);
    }

    /// @notice Emergency cancel — testator withdraws all funds and revokes will
    function revoke() external onlyTestator nonReentrant {
        require(state == WillState.ACTIVE || state == WillState.TRIGGERABLE, "Will: cannot revoke");

        state = WillState.REVOKED;

        // Withdraw from vault
        uint256 withdrawn = 0;
        if (depositedShares > 0) {
            try yieldVault.withdraw(depositedShares) returns (uint256 assets) {
                withdrawn = assets;
            } catch {}
            depositedShares = 0;
        }

        uint256 balance = address(this).balance;
        if (balance > 0) {
            (bool success,) = payable(testator).call{value: balance}("");
            require(success, "Will: revoke transfer failed");
        }

        emit WillRevoked(testator, balance, block.timestamp);
    }

    /// @notice Update check-in interval (only testator, only when active)
    function updateCheckInInterval(uint256 newInterval) external onlyTestator onlyActive {
        require(newInterval >= 1 days, "Will: interval too short");
        uint256 old = checkInInterval;
        checkInInterval = newInterval;
        emit CheckInIntervalUpdated(old, newInterval);
    }

    /// @notice Update Fileverse document ID
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

    function totalYieldEarned() external view returns (uint256) {
        if (depositedShares == 0) return 0;
        try yieldVault.previewWithdraw(depositedShares) returns (uint256 currentValue) {
            // We need to track the original deposit amount
            return currentValue > address(this).balance
                ? currentValue - address(this).balance
                : 0;
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

    receive() external payable {}
}
