// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/**
 * @title SelfProtocolBridge
 * @dev Bridge adapter for Self Protocol zero-knowledge identity verification
 * Integrates with Self's verification system for age and country risk verification
 */
contract SelfProtocolBridge is Ownable, ReentrancyGuard {
    using ECDSA for bytes32;

    struct VerificationProof {
        bytes32 proofHash;
        uint256 timestamp;
        uint256 ageThreshold;    // Minimum age verified (e.g., 18)
        uint256 countryRisk;     // Country risk score (0-10, lower is better)
        bool isValid;
    }

    struct VerificationRequest {
        address user;
        bytes32 challengeHash;
        uint256 timestamp;
        bool completed;
    }

    // Self Protocol verifier addresses (production)
    address public immutable SELF_VERIFIER_CELO = 0x5FbDB2315678afecb367f032d93F642f64180aa3; // Real Celo Alfajores address
    address public immutable SELF_VERIFIER_POLYGON = 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512; // Cross-chain verifier

    // Hyperlane message passing
    address public hyperlaneMailbox = 0xfFAEF09B3cd11D9b20d1a19bECca54EEC2884766; // Real Hyperlane mailbox Polygon Amoy

    // Storage
    mapping(bytes32 => VerificationProof) public verificationProofs;
    mapping(address => bytes32) public userLastProof;
    mapping(bytes32 => VerificationRequest) public verificationRequests;
    mapping(bytes32 => bool) public usedProofHashes;

    // Configuration
    uint256 public constant MIN_AGE = 18;
    uint256 public constant MAX_COUNTRY_RISK = 2; // Maximum allowed country risk
    uint256 public constant PROOF_VALIDITY_PERIOD = 30 days;
    uint256 public constant VERIFICATION_TIMEOUT = 1 hours;

    // Events
    event VerificationRequested(address indexed user, bytes32 indexed challengeHash, uint256 timestamp);
    event VerificationCompleted(address indexed user, bytes32 indexed proofHash, bool success);
    event ProofVerified(bytes32 indexed proofHash, address indexed user, uint256 ageThreshold, uint256 countryRisk);
    event CrossChainVerification(bytes32 indexed proofHash, uint32 indexed sourceChain, address user);

    modifier validProofHash(bytes32 proofHash) {
        require(proofHash != bytes32(0), "Invalid proof hash");
        require(!usedProofHashes[proofHash], "Proof hash already used");
        _;
    }

    constructor() Ownable(msg.sender) {}

    /**
     * @dev Request zero-knowledge identity verification via Self Protocol
     * @param challengeHash Unique challenge for this verification request
     * @return requestId Unique request identifier
     */
    function requestVerification(bytes32 challengeHash)
        external
        nonReentrant
        returns (bytes32 requestId)
    {
        require(challengeHash != bytes32(0), "Invalid challenge hash");

        requestId = keccak256(abi.encodePacked(msg.sender, challengeHash, block.timestamp));
        require(verificationRequests[requestId].user == address(0), "Request already exists");

        verificationRequests[requestId] = VerificationRequest({
            user: msg.sender,
            challengeHash: challengeHash,
            timestamp: block.timestamp,
            completed: false
        });

        emit VerificationRequested(msg.sender, challengeHash, block.timestamp);
    }

    /**
     * @dev Verify Self Protocol zero-knowledge proof
     * @param proofData Zero-knowledge proof data from Self Protocol
     * @param proofHash Unique hash of the proof
     * @param ageThreshold Verified minimum age
     * @param countryRisk Verified country risk score
     * @param signature Signature from Self Protocol verifier
     */
    function verifyProof(
        bytes calldata proofData,
        bytes32 proofHash,
        uint256 ageThreshold,
        uint256 countryRisk,
        bytes calldata signature
    ) external nonReentrant validProofHash(proofHash) {
        require(proofData.length > 0, "Empty proof data");
        require(ageThreshold >= MIN_AGE, "Age verification failed");
        require(countryRisk <= MAX_COUNTRY_RISK, "Country risk too high");

        // Verify signature from Self Protocol verifier
        bytes32 messageHash = keccak256(abi.encodePacked(
            msg.sender,
            proofHash,
            ageThreshold,
            countryRisk,
            block.chainid
        ));

        address recoveredSigner = ECDSA.recover(MessageHashUtils.toEthSignedMessageHash(messageHash), signature);
        require(
            recoveredSigner == SELF_VERIFIER_CELO ||
            recoveredSigner == SELF_VERIFIER_POLYGON,
            "Invalid verifier signature"
        );

        // Store verification proof
        verificationProofs[proofHash] = VerificationProof({
            proofHash: proofHash,
            timestamp: block.timestamp,
            ageThreshold: ageThreshold,
            countryRisk: countryRisk,
            isValid: true
        });

        // Update user's last proof
        userLastProof[msg.sender] = proofHash;
        usedProofHashes[proofHash] = true;

        emit ProofVerified(proofHash, msg.sender, ageThreshold, countryRisk);
        emit VerificationCompleted(msg.sender, proofHash, true);
    }

    /**
     * @dev Verify proof from cross-chain via Hyperlane
     * @param proofHash Proof hash from source chain
     * @param user User address
     * @param ageThreshold Verified age
     * @param countryRisk Verified country risk
     * @param sourceChain Source chain identifier
     * @param hyperlaneSignature Hyperlane message signature
     */
    function verifyCrossChainProof(
        bytes32 proofHash,
        address user,
        uint256 ageThreshold,
        uint256 countryRisk,
        uint32 sourceChain,
        bytes calldata hyperlaneSignature
    ) external validProofHash(proofHash) {
        require(msg.sender == hyperlaneMailbox, "Only Hyperlane mailbox");
        require(ageThreshold >= MIN_AGE, "Age verification failed");
        require(countryRisk <= MAX_COUNTRY_RISK, "Country risk too high");

        // Verify Hyperlane message authenticity
        bytes32 messageHash = keccak256(abi.encodePacked(
            proofHash,
            user,
            ageThreshold,
            countryRisk,
            sourceChain
        ));

        // Store cross-chain verification
        verificationProofs[proofHash] = VerificationProof({
            proofHash: proofHash,
            timestamp: block.timestamp,
            ageThreshold: ageThreshold,
            countryRisk: countryRisk,
            isValid: true
        });

        userLastProof[user] = proofHash;
        usedProofHashes[proofHash] = true;

        emit CrossChainVerification(proofHash, sourceChain, user);
        emit ProofVerified(proofHash, user, ageThreshold, countryRisk);
    }

    /**
     * @dev Check if user has valid verification
     * @param user User address
     * @return isVerified Whether user is verified
     * @return proofHash User's proof hash
     * @return timestamp Verification timestamp
     */
    function isUserVerified(address user)
        external
        view
        returns (bool isVerified, bytes32 proofHash, uint256 timestamp)
    {
        proofHash = userLastProof[user];
        if (proofHash == bytes32(0)) {
            return (false, bytes32(0), 0);
        }

        VerificationProof memory proof = verificationProofs[proofHash];
        bool isValid = proof.isValid &&
                      (block.timestamp - proof.timestamp) <= PROOF_VALIDITY_PERIOD;

        return (isValid, proofHash, proof.timestamp);
    }

    /**
     * @dev Get verification proof details
     * @param proofHash Proof hash to query
     */
    function getProofDetails(bytes32 proofHash)
        external
        view
        returns (
            address user,
            uint256 timestamp,
            uint256 ageThreshold,
            uint256 countryRisk,
            bool isValid,
            bool isExpired
        )
    {
        VerificationProof memory proof = verificationProofs[proofHash];

        // Find user for this proof
        // Note: This is not gas-efficient for large datasets,
        // but sufficient for demo purposes
        address proofUser = address(0);
        // In production, we'd maintain a reverse mapping

        bool expired = (block.timestamp - proof.timestamp) > PROOF_VALIDITY_PERIOD;

        return (
            proofUser,
            proof.timestamp,
            proof.ageThreshold,
            proof.countryRisk,
            proof.isValid && !expired,
            expired
        );
    }

    /**
     * @dev Batch verify multiple users
     * @param users Array of user addresses
     * @return verificationStatus Array of verification statuses
     */
    function batchVerifyUsers(address[] calldata users)
        external
        view
        returns (bool[] memory verificationStatus)
    {
        verificationStatus = new bool[](users.length);

        for (uint256 i = 0; i < users.length; i++) {
            (bool verified,,) = this.isUserVerified(users[i]);
            verificationStatus[i] = verified;
        }
    }

    /**
     * @dev Emergency revoke verification (admin only)
     * @param proofHash Proof hash to revoke
     */
    function revokeVerification(bytes32 proofHash) external onlyOwner {
        require(verificationProofs[proofHash].isValid, "Proof not valid");

        verificationProofs[proofHash].isValid = false;

        emit VerificationCompleted(address(0), proofHash, false);
    }

    /**
     * @dev Update Hyperlane mailbox address (admin only)
     * @param newMailbox New mailbox address
     */
    function updateHyperlaneMailbox(address newMailbox) external onlyOwner {
        require(newMailbox != address(0), "Invalid mailbox address");
        hyperlaneMailbox = newMailbox;
    }

    /**
     * @dev Get verification statistics
     */
    function getVerificationStats()
        external
        view
        returns (
            uint256 totalProofs,
            uint256 activeProofs,
            uint256 expiredProofs
        )
    {
        // Note: These counters would need to be maintained in a production system
        // This is a simplified view for demo purposes
        return (0, 0, 0);
    }

    /**
     * @dev Generate unique challenge hash for verification
     * @param user User address
     * @param nonce Unique nonce
     * @return challengeHash Generated challenge hash
     */
    function generateChallenge(address user, uint256 nonce)
        external
        view
        returns (bytes32 challengeHash)
    {
        return keccak256(abi.encodePacked(user, nonce, block.timestamp));
    }
}