// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {FlareHubAuthenticityRegistry, IZkVerify} from "../src/FlareHubAuthenticityRegistry.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract MockZkVerify is IZkVerify {
    bool public shouldReturn;

    function setReturnValue(bool _value) external {
        shouldReturn = _value;
    }

    function verifyProofAggregation(uint256, uint256, bytes32, bytes32[] calldata, uint256, uint256)
        external
        view
        returns (bool)
    {
        return shouldReturn;
    }
}

contract FlareHubAuthenticityRegistryTest is Test {
    FlareHubAuthenticityRegistry public registry;
    FlareHubAuthenticityRegistry public implementation;
    MockZkVerify public mockZkVerify;

    address public owner = address(this);
    address public user1 = address(0x1);
    address public user2 = address(0x2);

    uint256 public constant DOMAIN_ID = 1;

    bytes32 public commitment1 = keccak256("commitment1");
    bytes32 public nullifier1 = keccak256("nullifier1");
    bytes32 public commitment2 = keccak256("commitment2");
    bytes32 public nullifier2 = keccak256("nullifier2");

    event AuthenticityVerified(
        address indexed user, bytes32 indexed commitment, bytes32 indexed nullifier, uint256 aggregationId
    );
    event NullifierRegistered(bytes32 indexed nullifier);
    event ZkVerifyContractUpdated(address indexed oldContract, address indexed newContract);
    event DomainIdUpdated(uint256 oldDomainId, uint256 newDomainId);

    function setUp() public {
        mockZkVerify = new MockZkVerify();
        mockZkVerify.setReturnValue(true);

        implementation = new FlareHubAuthenticityRegistry();

        bytes memory initData =
            abi.encodeWithSelector(FlareHubAuthenticityRegistry.initialize.selector, address(mockZkVerify), DOMAIN_ID);

        ERC1967Proxy proxy = new ERC1967Proxy(address(implementation), initData);
        registry = FlareHubAuthenticityRegistry(address(proxy));
    }

    function test_Initialize() public view {
        assertEq(address(registry.zkVerifyContract()), address(mockZkVerify));
        assertEq(registry.domainId(), DOMAIN_ID);
    }

    function test_RevertInitialize_ZeroAddress() public {
        FlareHubAuthenticityRegistry newImpl = new FlareHubAuthenticityRegistry();

        bytes memory initData =
            abi.encodeWithSelector(FlareHubAuthenticityRegistry.initialize.selector, address(0), DOMAIN_ID);

        vm.expectRevert(FlareHubAuthenticityRegistry.ZeroAddress.selector);
        new ERC1967Proxy(address(newImpl), initData);
    }

    function test_VerifyAuthenticity() public {
        bytes32[] memory merklePath = new bytes32[](2);
        merklePath[0] = keccak256("path0");
        merklePath[1] = keccak256("path1");

        vm.prank(user1);
        vm.expectEmit(true, true, true, true);
        emit NullifierRegistered(nullifier1);
        vm.expectEmit(true, true, true, true);
        emit AuthenticityVerified(user1, commitment1, nullifier1, 100);

        registry.verifyAuthenticity(commitment1, nullifier1, 100, keccak256("leaf"), merklePath, 4, 0);

        assertTrue(registry.isVerified(user1));
        assertEq(registry.userCommitments(user1), commitment1);
        assertTrue(registry.nullifierUsed(nullifier1));
    }

    function test_RevertVerifyAuthenticity_NullifierAlreadyUsed() public {
        bytes32[] memory merklePath = new bytes32[](1);
        merklePath[0] = keccak256("path0");

        vm.prank(user1);
        registry.verifyAuthenticity(commitment1, nullifier1, 100, keccak256("leaf"), merklePath, 2, 0);

        vm.prank(user2);
        vm.expectRevert(FlareHubAuthenticityRegistry.NullifierAlreadyUsed.selector);
        registry.verifyAuthenticity(commitment2, nullifier1, 100, keccak256("leaf"), merklePath, 2, 0);
    }

    function test_RevertVerifyAuthenticity_AlreadyVerified() public {
        bytes32[] memory merklePath = new bytes32[](1);
        merklePath[0] = keccak256("path0");

        vm.prank(user1);
        registry.verifyAuthenticity(commitment1, nullifier1, 100, keccak256("leaf"), merklePath, 2, 0);

        vm.prank(user1);
        vm.expectRevert(FlareHubAuthenticityRegistry.AlreadyVerified.selector);
        registry.verifyAuthenticity(commitment2, nullifier2, 100, keccak256("leaf"), merklePath, 2, 0);
    }

    function test_RevertVerifyAuthenticity_InvalidProof() public {
        mockZkVerify.setReturnValue(false);

        bytes32[] memory merklePath = new bytes32[](1);
        merklePath[0] = keccak256("path0");

        vm.prank(user1);
        vm.expectRevert(FlareHubAuthenticityRegistry.InvalidProof.selector);
        registry.verifyAuthenticity(commitment1, nullifier1, 100, keccak256("leaf"), merklePath, 2, 0);
    }

    function test_GetVerification() public {
        bytes32[] memory merklePath = new bytes32[](1);
        merklePath[0] = keccak256("path0");

        vm.prank(user1);
        registry.verifyAuthenticity(commitment1, nullifier1, 100, keccak256("leaf"), merklePath, 2, 0);

        (bytes32 commitment, uint256 timestamp, bool verified) = registry.getVerification(user1);

        assertEq(commitment, commitment1);
        assertEq(timestamp, block.timestamp);
        assertTrue(verified);
    }

    function test_GetVerification_NotVerified() public view {
        (bytes32 commitment, uint256 timestamp, bool verified) = registry.getVerification(user1);

        assertEq(commitment, bytes32(0));
        assertEq(timestamp, 0);
        assertFalse(verified);
    }

    function test_SetZkVerifyContract() public {
        MockZkVerify newMock = new MockZkVerify();

        vm.expectEmit(true, true, false, false);
        emit ZkVerifyContractUpdated(address(mockZkVerify), address(newMock));

        registry.setZkVerifyContract(address(newMock));

        assertEq(address(registry.zkVerifyContract()), address(newMock));
    }

    function test_RevertSetZkVerifyContract_ZeroAddress() public {
        vm.expectRevert(FlareHubAuthenticityRegistry.ZeroAddress.selector);
        registry.setZkVerifyContract(address(0));
    }

    function test_RevertSetZkVerifyContract_NotOwner() public {
        vm.prank(user1);
        vm.expectRevert();
        registry.setZkVerifyContract(address(0x123));
    }

    function test_SetDomainId() public {
        uint256 newDomainId = 42;

        vm.expectEmit(true, true, false, false);
        emit DomainIdUpdated(DOMAIN_ID, newDomainId);

        registry.setDomainId(newDomainId);

        assertEq(registry.domainId(), newDomainId);
    }

    function test_RevertSetDomainId_NotOwner() public {
        vm.prank(user1);
        vm.expectRevert();
        registry.setDomainId(42);
    }

    function testFuzz_VerifyAuthenticity(bytes32 _commitment, bytes32 _nullifier) public {
        vm.assume(_commitment != bytes32(0));
        vm.assume(_nullifier != bytes32(0));

        bytes32[] memory merklePath = new bytes32[](1);
        merklePath[0] = keccak256("path0");

        vm.prank(user1);
        registry.verifyAuthenticity(_commitment, _nullifier, 100, keccak256("leaf"), merklePath, 2, 0);

        assertTrue(registry.isVerified(user1));
        assertEq(registry.userCommitments(user1), _commitment);
        assertTrue(registry.nullifierUsed(_nullifier));
    }
}
