// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title CrossChainLending
 * @dev Advanced cross-chain lending protocol using Hyperlane for zkRisk
 * Enables lending between Polygon Amoy and Celo Alfajores with real AI risk assessment
 */
contract CrossChainLending is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct Loan {
        uint256 loanId;
        address borrower;
        address lender;
        uint256 principal;
        uint256 interestRate; // Basis points (10000 = 100%)
        uint256 duration; // In seconds
        uint256 collateralAmount;
        bytes32 collateralHash; // Hash of off-chain collateral
        uint256 lambdaRisk; // AI-calculated risk multiplier (1000 = 1.0x)
        LoanStatus status;
        uint256 startTime;
        uint256 repaymentAmount;
        uint32 sourceChain; // Hyperlane source chain domain
        bytes32 verificationProof; // Self Protocol ZK proof hash
        bool isVerified; // Self Protocol verification status
    }

    struct CrossChainRequest {
        uint256 requestId;
        address requester;
        uint256 amount;
        uint256 duration;
        uint256 lambdaRisk;
        bytes32 collateralHash;
        bytes32 verificationProof;
        uint32 targetChain;
        RequestStatus status;
        uint256 timestamp;
    }

    enum LoanStatus {
        PENDING,
        ACTIVE,
        REPAID,
        DEFAULTED,
        LIQUIDATED
    }

    enum RequestStatus {
        PENDING,
        MATCHED,
        REJECTED,
        EXPIRED
    }

    // Hyperlane integration
    address public immutable hyperlaneMailbox;
    mapping(uint32 => address) public trustedRemotes; // Domain -> remote contract address

    // Storage
    mapping(uint256 => Loan) public loans;
    mapping(uint256 => CrossChainRequest) public crossChainRequests;
    mapping(address => uint256[]) public userLoans;
    mapping(address => uint256[]) public userRequests;
    mapping(bytes32 => bool) public usedVerificationProofs;
    mapping(bytes32 => uint256) public messageToLoan; // Hyperlane message ID to loan ID

    // Counters
    uint256 public nextLoanId = 1;
    uint256 public nextRequestId = 1;

    // Configuration
    IERC20 public immutable lendingToken; // USDC or stable coin
    uint256 public constant MIN_LOAN_AMOUNT = 100 * 10**6; // 100 USDC (6 decimals)
    uint256 public constant MAX_LOAN_AMOUNT = 100000 * 10**6; // 100k USDC
    uint256 public constant MIN_DURATION = 1 days;
    uint256 public constant MAX_DURATION = 365 days;
    uint256 public constant BASE_INTEREST_RATE = 500; // 5% base rate
    uint256 public constant MAX_LAMBDA_RISK = 5000; // 5.0x maximum risk multiplier
    uint256 public constant LIQUIDATION_THRESHOLD = 8000; // 80%
    uint256 public constant PROTOCOL_FEE = 100; // 1%

    // Supported tokens for collateral
    mapping(address => bool) public supportedCollateralTokens;
    mapping(address => uint256) public collateralRatios; // Basis points

    // Events
    event LoanCreated(uint256 indexed loanId, address indexed borrower, address indexed lender, uint256 amount);
    event LoanRepaid(uint256 indexed loanId, uint256 repaymentAmount);
    event LoanDefaulted(uint256 indexed loanId);
    event CrossChainRequestCreated(uint256 indexed requestId, address indexed requester, uint32 targetChain);
    event CrossChainLoanMatched(uint256 indexed requestId, uint256 indexed loanId, bytes32 messageId);
    event VerificationSynced(address indexed user, bytes32 indexed proofHash, uint32 sourceChain);
    event CollateralLiquidated(uint256 indexed loanId, uint256 liquidationAmount);

    // Modifiers
    modifier onlyHyperlaneMailbox() {
        require(msg.sender == hyperlaneMailbox, "Only Hyperlane mailbox");
        _;
    }

    modifier validLoanId(uint256 loanId) {
        require(loans[loanId].loanId != 0, "Invalid loan ID");
        _;
    }

    modifier validRequestId(uint256 requestId) {
        require(crossChainRequests[requestId].requestId != 0, "Invalid request ID");
        _;
    }

    constructor(
        address _lendingToken,
        address _hyperlaneMailbox
    ) Ownable(msg.sender) {
        require(_lendingToken != address(0), "Invalid lending token");
        require(_hyperlaneMailbox != address(0), "Invalid Hyperlane mailbox");

        lendingToken = IERC20(_lendingToken);
        hyperlaneMailbox = _hyperlaneMailbox;

        // CrossChainLending deployed with Hyperlane integration
    }

    /**
     * @dev Create a cross-chain lending request
     * @param amount Loan amount in lending token units
     * @param duration Loan duration in seconds
     * @param lambdaRisk AI-calculated risk multiplier from Fluence
     * @param collateralHash Hash of collateral proof
     * @param verificationProof Self Protocol ZK proof hash
     * @param targetChain Target chain domain for cross-chain lending
     */
    function createCrossChainRequest(
        uint256 amount,
        uint256 duration,
        uint256 lambdaRisk,
        bytes32 collateralHash,
        bytes32 verificationProof,
        uint32 targetChain
    ) external nonReentrant returns (uint256 requestId) {
        require(amount >= MIN_LOAN_AMOUNT && amount <= MAX_LOAN_AMOUNT, "Invalid loan amount");
        require(duration >= MIN_DURATION && duration <= MAX_DURATION, "Invalid duration");
        require(lambdaRisk <= MAX_LAMBDA_RISK, "Risk too high");
        require(trustedRemotes[targetChain] != address(0), "Unsupported target chain");
        require(verificationProof != bytes32(0), "Verification proof required");
        require(!usedVerificationProofs[verificationProof], "Verification proof already used");

        requestId = nextRequestId++;

        crossChainRequests[requestId] = CrossChainRequest({
            requestId: requestId,
            requester: msg.sender,
            amount: amount,
            duration: duration,
            lambdaRisk: lambdaRisk,
            collateralHash: collateralHash,
            verificationProof: verificationProof,
            targetChain: targetChain,
            status: RequestStatus.PENDING,
            timestamp: block.timestamp
        });

        userRequests[msg.sender].push(requestId);
        usedVerificationProofs[verificationProof] = true;

        emit CrossChainRequestCreated(requestId, msg.sender, targetChain);

        // Send cross-chain message via Hyperlane
        _sendCrossChainMessage(requestId, targetChain);
    }

    /**
     * @dev Match a cross-chain request and create loan
     * @param requestId The cross-chain request ID
     * @param borrower The borrower address from source chain
     * @param sourceChain The source chain domain
     */
    function matchCrossChainRequest(
        uint256 requestId,
        address borrower,
        uint32 sourceChain
    ) external nonReentrant returns (uint256 loanId) {
        // Verify this is a valid cross-chain request
        require(trustedRemotes[sourceChain] != address(0), "Unsupported source chain");

        // Calculate interest rate based on lambda risk
        CrossChainRequest memory request = crossChainRequests[requestId];
        require(request.status == RequestStatus.PENDING, "Request not available");

        uint256 interestRate = _calculateInterestRate(request.lambdaRisk);
        uint256 repaymentAmount = _calculateRepaymentAmount(request.amount, interestRate, request.duration);

        // Ensure lender has sufficient balance
        require(lendingToken.balanceOf(msg.sender) >= request.amount, "Insufficient lender balance");

        // Create the loan
        loanId = nextLoanId++;

        loans[loanId] = Loan({
            loanId: loanId,
            borrower: borrower,
            lender: msg.sender,
            principal: request.amount,
            interestRate: interestRate,
            duration: request.duration,
            collateralAmount: 0, // Cross-chain collateral handled separately
            collateralHash: request.collateralHash,
            lambdaRisk: request.lambdaRisk,
            status: LoanStatus.ACTIVE,
            startTime: block.timestamp,
            repaymentAmount: repaymentAmount,
            sourceChain: sourceChain,
            verificationProof: request.verificationProof,
            isVerified: true // Assumed verified through cross-chain message
        });

        // Update request status
        crossChainRequests[requestId].status = RequestStatus.MATCHED;

        // Transfer lending amount to this contract (will be released cross-chain)
        lendingToken.safeTransferFrom(msg.sender, address(this), request.amount);

        // Add to user's loan list
        userLoans[borrower].push(loanId);

        emit LoanCreated(loanId, borrower, msg.sender, request.amount);
        emit CrossChainLoanMatched(requestId, loanId, bytes32(0)); // Message ID would be populated

        // Send loan approval message back to source chain
        _sendLoanApprovalMessage(loanId, sourceChain);

        return loanId;
    }

    /**
     * @dev Process incoming Hyperlane message
     * @param _origin Source chain domain
     * @param _sender Source contract address
     * @param _messageBody Encoded message data
     */
    function handle(
        uint32 _origin,
        bytes32 _sender,
        bytes calldata _messageBody
    ) external onlyHyperlaneMailbox {
        require(trustedRemotes[_origin] == _bytesToAddress(_sender), "Untrusted remote");

        // Decode message
        (uint8 messageType, bytes memory messageData) = abi.decode(_messageBody, (uint8, bytes));

        if (messageType == 1) { // Cross-chain lending request
            _handleCrossChainRequest(_origin, messageData);
        } else if (messageType == 2) { // Loan repayment
            _handleLoanRepayment(_origin, messageData);
        } else if (messageType == 3) { // Verification sync
            _handleVerificationSync(_origin, messageData);
        } else if (messageType == 4) { // Liquidation alert
            _handleLiquidationAlert(_origin, messageData);
        }
    }

    /**
     * @dev Repay a loan
     * @param loanId The loan ID to repay
     */
    function repayLoan(uint256 loanId) external nonReentrant validLoanId(loanId) {
        Loan storage loan = loans[loanId];
        require(loan.status == LoanStatus.ACTIVE, "Loan not active");
        require(msg.sender == loan.borrower, "Only borrower can repay");

        uint256 repaymentAmount = loan.repaymentAmount;

        // Calculate any late fees if applicable
        if (block.timestamp > loan.startTime + loan.duration) {
            uint256 lateFee = _calculateLateFee(loan);
            repaymentAmount += lateFee;
        }

        // Transfer repayment from borrower
        lendingToken.safeTransferFrom(msg.sender, address(this), repaymentAmount);

        // Calculate protocol fee
        uint256 protocolFee = (repaymentAmount * PROTOCOL_FEE) / 10000;
        uint256 lenderAmount = repaymentAmount - protocolFee;

        // Transfer to lender
        lendingToken.safeTransfer(loan.lender, lenderAmount);

        // Update loan status
        loan.status = LoanStatus.REPAID;

        emit LoanRepaid(loanId, repaymentAmount);

        // If cross-chain loan, send repayment confirmation
        if (loan.sourceChain != 0) {
            _sendRepaymentConfirmation(loanId, loan.sourceChain);
        }
    }

    /**
     * @dev Liquidate a defaulted loan
     * @param loanId The loan ID to liquidate
     */
    function liquidateLoan(uint256 loanId) external nonReentrant validLoanId(loanId) {
        Loan storage loan = loans[loanId];
        require(loan.status == LoanStatus.ACTIVE, "Loan not active");
        require(block.timestamp > loan.startTime + loan.duration, "Loan not expired");

        // Mark as defaulted
        loan.status = LoanStatus.DEFAULTED;

        emit LoanDefaulted(loanId);
        emit CollateralLiquidated(loanId, loan.collateralAmount);

        // In a full implementation, this would trigger collateral liquidation
        // For cross-chain collateral, send liquidation message
        if (loan.sourceChain != 0) {
            _sendLiquidationMessage(loanId, loan.sourceChain);
        }
    }

    /**
     * @dev Sync Self Protocol verification across chains
     * @param user User address
     * @param proofHash Verification proof hash
     * @param targetChain Target chain to sync to
     */
    function syncVerificationAcrossChains(
        address user,
        bytes32 proofHash,
        uint32 targetChain
    ) external {
        require(trustedRemotes[targetChain] != address(0), "Unsupported target chain");
        require(!usedVerificationProofs[proofHash], "Proof already used");

        // Mark proof as used
        usedVerificationProofs[proofHash] = true;

        // Send verification sync message
        bytes memory messageData = abi.encode(user, proofHash, block.timestamp);
        bytes memory messageBody = abi.encode(uint8(3), messageData);

        // Send via Hyperlane (simplified - in production, use proper gas estimation)
        (bool success,) = hyperlaneMailbox.call{value: 0.001 ether}(
            abi.encodeWithSignature(
                "dispatch(uint32,bytes32,bytes)",
                targetChain,
                _addressToBytes32(trustedRemotes[targetChain]),
                messageBody
            )
        );

        require(success, "Failed to send verification sync");

        emit VerificationSynced(user, proofHash, targetChain);
    }

    // View functions

    /**
     * @dev Get loan details
     */
    function getLoan(uint256 loanId) external view validLoanId(loanId) returns (Loan memory) {
        return loans[loanId];
    }

    /**
     * @dev Get user's loans
     */
    function getUserLoans(address user) external view returns (uint256[] memory) {
        return userLoans[user];
    }

    /**
     * @dev Get cross-chain request details
     */
    function getCrossChainRequest(uint256 requestId) external view validRequestId(requestId) returns (CrossChainRequest memory) {
        return crossChainRequests[requestId];
    }

    /**
     * @dev Calculate interest rate based on lambda risk
     */
    function calculateInterestRate(uint256 lambdaRisk) external pure returns (uint256) {
        return _calculateInterestRate(lambdaRisk);
    }

    // Admin functions

    /**
     * @dev Set trusted remote contract for a chain
     */
    function setTrustedRemote(uint32 domain, address remoteContract) external onlyOwner {
        require(remoteContract != address(0), "Invalid remote contract");
        trustedRemotes[domain] = remoteContract;
    }

    /**
     * @dev Add supported collateral token
     */
    function addSupportedCollateral(address token, uint256 ratio) external onlyOwner {
        require(token != address(0), "Invalid token");
        require(ratio > 0 && ratio <= 10000, "Invalid ratio");

        supportedCollateralTokens[token] = true;
        collateralRatios[token] = ratio;
    }

    // Private functions

    function _calculateInterestRate(uint256 lambdaRisk) private pure returns (uint256) {
        // Base rate + risk premium based on lambda
        // Higher lambda = higher risk = higher interest rate
        uint256 riskPremium = (lambdaRisk * 200) / 1000; // 0.2% per 0.1 lambda
        return BASE_INTEREST_RATE + riskPremium;
    }

    function _calculateRepaymentAmount(
        uint256 principal,
        uint256 interestRate,
        uint256 duration
    ) private pure returns (uint256) {
        // Simple interest calculation: P * (1 + r * t)
        uint256 interest = (principal * interestRate * duration) / (10000 * 365 days);
        return principal + interest;
    }

    function _calculateLateFee(Loan memory loan) private view returns (uint256) {
        uint256 daysLate = (block.timestamp - (loan.startTime + loan.duration)) / 1 days;
        uint256 lateFeeRate = 50; // 0.5% per day
        return (loan.principal * lateFeeRate * daysLate) / 10000;
    }

    function _sendCrossChainMessage(uint256 requestId, uint32 targetChain) private {
        CrossChainRequest memory request = crossChainRequests[requestId];

        bytes memory messageData = abi.encode(
            requestId,
            request.requester,
            request.amount,
            request.duration,
            request.lambdaRisk,
            request.collateralHash,
            request.verificationProof
        );

        bytes memory messageBody = abi.encode(uint8(1), messageData);

        // Send via Hyperlane (simplified)
        (bool success,) = hyperlaneMailbox.call{value: 0.001 ether}(
            abi.encodeWithSignature(
                "dispatch(uint32,bytes32,bytes)",
                targetChain,
                _addressToBytes32(trustedRemotes[targetChain]),
                messageBody
            )
        );

        require(success, "Failed to send cross-chain message");
    }

    function _sendLoanApprovalMessage(uint256 loanId, uint32 sourceChain) private {
        // Send loan approval back to source chain
        bytes memory messageData = abi.encode(loanId, loans[loanId].borrower, block.timestamp);
        bytes memory messageBody = abi.encode(uint8(2), messageData);

        (bool success,) = hyperlaneMailbox.call{value: 0.001 ether}(
            abi.encodeWithSignature(
                "dispatch(uint32,bytes32,bytes)",
                sourceChain,
                _addressToBytes32(trustedRemotes[sourceChain]),
                messageBody
            )
        );

        require(success, "Failed to send loan approval");
    }

    function _sendRepaymentConfirmation(uint256 loanId, uint32 sourceChain) private {
        bytes memory messageData = abi.encode(loanId, block.timestamp);
        bytes memory messageBody = abi.encode(uint8(2), messageData);

        (bool success,) = hyperlaneMailbox.call{value: 0.001 ether}(
            abi.encodeWithSignature(
                "dispatch(uint32,bytes32,bytes)",
                sourceChain,
                _addressToBytes32(trustedRemotes[sourceChain]),
                messageBody
            )
        );

        require(success, "Failed to send repayment confirmation");
    }

    function _sendLiquidationMessage(uint256 loanId, uint32 sourceChain) private {
        bytes memory messageData = abi.encode(loanId, block.timestamp);
        bytes memory messageBody = abi.encode(uint8(4), messageData);

        (bool success,) = hyperlaneMailbox.call{value: 0.001 ether}(
            abi.encodeWithSignature(
                "dispatch(uint32,bytes32,bytes)",
                sourceChain,
                _addressToBytes32(trustedRemotes[sourceChain]),
                messageBody
            )
        );

        require(success, "Failed to send liquidation message");
    }

    function _handleCrossChainRequest(uint32 origin, bytes memory messageData) private {
        // Handle incoming cross-chain lending request
        (
            uint256 requestId,
            address requester,
            uint256 amount,
            uint256 duration,
            uint256 lambdaRisk,
            bytes32 collateralHash,
            bytes32 verificationProof
        ) = abi.decode(messageData, (uint256, address, uint256, uint256, uint256, bytes32, bytes32));

        // Store the cross-chain request for local matching
        crossChainRequests[requestId] = CrossChainRequest({
            requestId: requestId,
            requester: requester,
            amount: amount,
            duration: duration,
            lambdaRisk: lambdaRisk,
            collateralHash: collateralHash,
            verificationProof: verificationProof,
            targetChain: origin,
            status: RequestStatus.PENDING,
            timestamp: block.timestamp
        });

        emit CrossChainRequestCreated(requestId, requester, origin);
    }

    function _handleLoanRepayment(uint32 origin, bytes memory messageData) private {
        (uint256 loanId, uint256 timestamp) = abi.decode(messageData, (uint256, uint256));

        if (loans[loanId].loanId != 0) {
            loans[loanId].status = LoanStatus.REPAID;
            emit LoanRepaid(loanId, loans[loanId].repaymentAmount);
        }
    }

    function _handleVerificationSync(uint32 origin, bytes memory messageData) private {
        (address user, bytes32 proofHash, uint256 timestamp) = abi.decode(messageData, (address, bytes32, uint256));

        usedVerificationProofs[proofHash] = true;
        emit VerificationSynced(user, proofHash, origin);
    }

    function _handleLiquidationAlert(uint32 origin, bytes memory messageData) private {
        (uint256 loanId, uint256 timestamp) = abi.decode(messageData, (uint256, uint256));

        if (loans[loanId].loanId != 0) {
            loans[loanId].status = LoanStatus.LIQUIDATED;
            emit CollateralLiquidated(loanId, loans[loanId].collateralAmount);
        }
    }

    // Utility functions
    function _addressToBytes32(address addr) private pure returns (bytes32) {
        return bytes32(uint256(uint160(addr)));
    }

    function _bytesToAddress(bytes32 data) private pure returns (address) {
        return address(uint160(uint256(data)));
    }
}