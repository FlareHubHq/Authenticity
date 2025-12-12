// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

interface IZkVerify {
    function verifyProofAggregation(
        uint256 _domainId,
        uint256 _aggregationId,
        bytes32 _leaf,
        bytes32[] calldata _merklePath,
        uint256 _leafCount,
        uint256 _index
    ) external view returns (bool);
}

contract FlareHubAuthenticityRegistry is Initializable, UUPSUpgradeable, OwnableUpgradeable {
    IZkVerify public zkVerifyContract;
    uint256 public domainId;

    mapping(bytes32 => bool) public nullifierUsed;
    mapping(address => bytes32) public userCommitments;
    mapping(address => uint256) public verifiedAt;

    event AuthenticityVerified(
        address indexed user, bytes32 indexed commitment, bytes32 indexed nullifier, uint256 aggregationId
    );

    event NullifierRegistered(bytes32 indexed nullifier);
    event ZkVerifyContractUpdated(address indexed oldContract, address indexed newContract);
    event DomainIdUpdated(uint256 oldDomainId, uint256 newDomainId);

    error NullifierAlreadyUsed();
    error InvalidProof();
    error AlreadyVerified();
    error ZeroAddress();

    constructor() {
        _disableInitializers();
    }

    function initialize(address _zkVerifyContract, uint256 _domainId) public initializer {
        __Ownable_init(msg.sender);
        if (_zkVerifyContract == address(0)) revert ZeroAddress();
        zkVerifyContract = IZkVerify(_zkVerifyContract);
        domainId = _domainId;
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}

    function verifyAuthenticity(
        bytes32 commitment,
        bytes32 nullifier,
        uint256 aggregationId,
        bytes32 leaf,
        bytes32[] calldata merklePath,
        uint256 leafCount,
        uint256 index
    ) external {
        if (nullifierUsed[nullifier]) revert NullifierAlreadyUsed();
        if (userCommitments[msg.sender] != bytes32(0)) revert AlreadyVerified();

        bool valid =
            zkVerifyContract.verifyProofAggregation(domainId, aggregationId, leaf, merklePath, leafCount, index);

        if (!valid) revert InvalidProof();

        nullifierUsed[nullifier] = true;
        emit NullifierRegistered(nullifier);

        userCommitments[msg.sender] = commitment;
        verifiedAt[msg.sender] = block.timestamp;

        emit AuthenticityVerified(msg.sender, commitment, nullifier, aggregationId);
    }

    function isVerified(address user) external view returns (bool) {
        return userCommitments[user] != bytes32(0);
    }

    function getVerification(address user)
        external
        view
        returns (bytes32 commitment, uint256 timestamp, bool verified)
    {
        commitment = userCommitments[user];
        timestamp = verifiedAt[user];
        verified = commitment != bytes32(0);
    }

    function setZkVerifyContract(address _zkVerifyContract) external onlyOwner {
        if (_zkVerifyContract == address(0)) revert ZeroAddress();
        address old = address(zkVerifyContract);
        zkVerifyContract = IZkVerify(_zkVerifyContract);
        emit ZkVerifyContractUpdated(old, _zkVerifyContract);
    }

    function setDomainId(uint256 _domainId) external onlyOwner {
        uint256 old = domainId;
        domainId = _domainId;
        emit DomainIdUpdated(old, _domainId);
    }
}
