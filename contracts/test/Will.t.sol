// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {Will} from "../src/Will.sol";
import {WillRegistry} from "../src/WillRegistry.sol";
import {MockYieldVault} from "../src/mocks/MockYieldVault.sol";
import {MockAnonAadhaar} from "../src/mocks/MockAnonAadhaar.sol";

contract WillTest is Test {
    WillRegistry public registry;
    MockYieldVault public vault;
    MockAnonAadhaar public anonAadhaar;

    address testator = makeAddr("testator");
    address heir1 = makeAddr("heir1");
    address heir2 = makeAddr("heir2");
    address stranger = makeAddr("stranger");

    uint256 constant CHECK_IN_INTERVAL = 30 days;
    uint256 constant DEPOSIT_AMOUNT = 1 ether;

    function setUp() public {
        vault = new MockYieldVault();
        anonAadhaar = new MockAnonAadhaar();
        registry = new WillRegistry(address(anonAadhaar), address(vault), address(0));

        // Seed vault with yield buffer
        vm.deal(address(vault), 100 ether);
        vm.deal(testator, 10 ether);
        vm.deal(heir1, 0.1 ether); // gas money
        vm.deal(heir2, 0.1 ether);
    }

    function _deployWill() internal returns (Will will) {
        address[] memory beneficiaries = new address[](2);
        beneficiaries[0] = heir1;
        beneficiaries[1] = heir2;

        string[] memory ensNames = new string[](2);
        ensNames[0] = "heir1.eth";
        ensNames[1] = "heir2.eth";

        uint256[] memory bps = new uint256[](2);
        bps[0] = 7000; // 70%
        bps[1] = 3000; // 30%

        vm.prank(testator);
        address willAddr = registry.createWill(
            beneficiaries, ensNames, bps, CHECK_IN_INTERVAL, "ipfs://QmTest"
        );
        will = Will(payable(willAddr));
    }

    function test_CreateWill() public {
        Will will = _deployWill();

        assertEq(will.testator(), testator);
        assertEq(uint256(will.getState()), uint256(Will.WillState.ACTIVE));
        assertEq(will.checkInInterval(), CHECK_IN_INTERVAL);
        assertEq(will.getBeneficiaryCount(), 2);
        assertTrue(registry.isRegisteredWill(address(will)));
    }

    function test_DepositETH() public {
        Will will = _deployWill();

        vm.prank(testator);
        will.depositETH{value: DEPOSIT_AMOUNT}();

        assertGt(will.depositedShares(), 0);
    }

    function test_CheckIn() public {
        Will will = _deployWill();

        vm.warp(block.timestamp + 20 days);

        vm.prank(testator);
        will.checkIn();

        assertEq(will.lastCheckIn(), block.timestamp);
        assertFalse(will.isTriggerable());
    }

    function test_WillBecomesTriggerable() public {
        Will will = _deployWill();

        // Move time past check-in interval
        vm.warp(block.timestamp + CHECK_IN_INTERVAL + 1);

        assertTrue(will.isTriggerable());
        assertEq(uint256(will.getState()), uint256(Will.WillState.TRIGGERABLE));
    }

    function test_Trigger() public {
        Will will = _deployWill();

        vm.prank(testator);
        will.depositETH{value: DEPOSIT_AMOUNT}();

        vm.warp(block.timestamp + CHECK_IN_INTERVAL + 1);

        vm.prank(stranger);
        will.trigger();

        assertEq(uint256(will.state()), uint256(Will.WillState.DISTRIBUTING));
        assertGt(will.ethBalanceAtDistribution(), 0);
        console.log("ETH at distribution:", will.ethBalanceAtDistribution());
    }

    function test_TriggerFailsIfCheckInCurrent() public {
        Will will = _deployWill();

        vm.prank(testator);
        will.checkIn();

        vm.expectRevert("Will: check-in not overdue");
        vm.prank(stranger);
        will.trigger();
    }

    function test_Claim() public {
        Will will = _deployWill();

        vm.prank(testator);
        will.depositETH{value: DEPOSIT_AMOUNT}();

        vm.warp(block.timestamp + CHECK_IN_INTERVAL + 1);
        will.trigger();

        uint256 heir1BalanceBefore = heir1.balance;

        // Build mock ZK proof
        uint256 nullifier = uint256(keccak256("heir1-nullifier"));
        uint256 timestamp = block.timestamp - 1 hours;
        uint256[8] memory proof;

        vm.prank(heir1);
        will.claim(
            uint256(uint160(address(will))),
            nullifier,
            timestamp,
            proof
        );

        assertTrue(will.getBeneficiaries()[0].hasClaimed);
        assertGt(heir1.balance, heir1BalanceBefore);
        console.log("Heir1 received:", heir1.balance - heir1BalanceBefore);
    }

    function test_CannotClaimTwice() public {
        Will will = _deployWill();
        vm.prank(testator);
        will.depositETH{value: DEPOSIT_AMOUNT}();
        vm.warp(block.timestamp + CHECK_IN_INTERVAL + 1);
        will.trigger();

        uint256 nullifier = uint256(keccak256("heir1-nullifier"));
        uint256 timestamp = block.timestamp - 1 hours;
        uint256[8] memory proof;

        vm.prank(heir1);
        will.claim(uint256(uint160(address(will))), nullifier, timestamp, proof);

        vm.expectRevert("Will: already claimed");
        vm.prank(heir1);
        will.claim(uint256(uint160(address(will))), nullifier + 1, timestamp, proof);
    }

    function test_CannotReplayNullifier() public {
        Will will = _deployWill();
        vm.prank(testator);
        will.depositETH{value: DEPOSIT_AMOUNT}();
        vm.warp(block.timestamp + CHECK_IN_INTERVAL + 1);
        will.trigger();

        uint256 nullifier = uint256(keccak256("shared-nullifier"));
        uint256 timestamp = block.timestamp - 1 hours;
        uint256[8] memory proof;

        vm.prank(heir1);
        will.claim(uint256(uint160(address(will))), nullifier, timestamp, proof);

        // heir2 cannot use same nullifier
        vm.expectRevert("Will: nullifier already used");
        vm.prank(heir2);
        will.claim(uint256(uint160(address(will))), nullifier, timestamp, proof);
    }

    function test_Revoke() public {
        Will will = _deployWill();
        vm.prank(testator);
        will.depositETH{value: DEPOSIT_AMOUNT}();

        uint256 testatorBalanceBefore = testator.balance;

        vm.prank(testator);
        will.revoke();

        assertEq(uint256(will.state()), uint256(Will.WillState.REVOKED));
        assertGt(testator.balance, testatorBalanceBefore);
    }

    function test_YieldAccrual() public {
        Will will = _deployWill();
        vm.prank(testator);
        will.depositETH{value: 1 ether}();

        // Fast-forward 1 year
        vm.warp(block.timestamp + 365 days);

        vm.warp(block.timestamp + CHECK_IN_INTERVAL + 365 days);
        will.trigger();

        // Should receive more than 1 ETH due to 5% yield
        assertGt(will.ethBalanceAtDistribution(), 1 ether);
        console.log("After 1yr yield, balance:", will.ethBalanceAtDistribution());
    }

    function test_MultipleWills() public {
        Will will1 = _deployWill();
        Will will2 = _deployWill();

        address[] memory wills = registry.getTestatorWills(testator);
        assertEq(wills.length, 2);
        assertEq(wills[0], address(will1));
        assertEq(wills[1], address(will2));
    }

    function test_GetTriggerableWills() public {
        _deployWill();
        _deployWill();

        vm.warp(block.timestamp + CHECK_IN_INTERVAL + 1);

        address[] memory triggerable = registry.getTriggerableWills();
        assertEq(triggerable.length, 2);
    }
}
