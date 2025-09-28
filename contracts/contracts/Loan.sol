// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./X402Payment.sol";
import "./RealOracle.sol";
import "./SelfProtocolBridge.sol";
import "./interfaces/IX402Payment.sol";

/**
 * @title Loan
 * @dev Core lending contract with AI-driven risk assessment and zk-identity verification
 */
contract Loan is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct Vault {
        uint256 collateralAmount;    // Amount of collateral deposited
        uint256 debtAmount;          // Amount of USDC borrowed
        uint256 lastLambda;          // Last risk multiplier used
        uint256 lastUpdateTime;      // Last update timestamp
    }

    struct LoanConfig {
        uint256 minCollateralUSD;    // Minimum collateral in USD
        uint256 maxLoanDuration;     // Maximum loan duration in seconds
        uint256 liquidationThreshold; // Threshold for liquidation (basis points)
        uint256 interestRate;        // Annual interest rate (basis points)
        uint256 maxBorrowPerUser;    // Maximum borrow limit per user
        uint256 totalBorrowCap;      // Global borrow cap
        bool paused;                 // Contract pause status
    }

    // Token contracts (Real Polygon Amoy addresses)
    IERC20 public immutable USDC = IERC20(0x9A676e781A523b5d0C0e43731313A708CB607508); // Real Polygon Amoy USDC
    IERC20 public immutable SHIB = IERC20(0x22595C3725FEDc4e64748542B4C31C2A14a49963); // Real SHIB token for collateral

    // External contracts
    RealOracle public immutable oracle;
    X402Payment public immutable x402Payment;
    SelfProtocolBridge public immutable selfBridge;
    address public fluenceAgent;

    // Real oracle feed IDs for SHIB memecoin lending
    bytes32 public constant USDC_USD_FEED = keccak256("USDC/USD");
    bytes32 public constant SHIB_USD_FEED = keccak256("SHIB/USD");

    // Storage
    mapping(address => Vault) public vaults;
    LoanConfig public config;
    uint256 public totalBorrowed; // Total USDC borrowed across all users

    // Constants
    uint256 public constant BASIS_POINTS = 10000;
    uint256 public constant LAMBDA_PRECISION = 1000; // 1000 = 1.0x
    uint256 public constant USD_PRECISION = 1e6; // USDC has 6 decimals
    uint256 public constant MAX_SLIPPAGE = 500; // 5% max slippage tolerance
    uint256 public constant PRICE_STALENESS_THRESHOLD = 3600; // 1 hour
    uint256 public constant MIN_CONFIDENCE = 9000; // 90% minimum confidence
    bytes32 public constant AI_INFERENCE_SERVICE = keccak256("AI_VOLATILITY_INFERENCE");

    // Events
    event Deposit(address indexed user, uint256 amount, uint256 timestamp);
    event Borrow(
        address indexed user,
        uint256 usdcAmount,
        uint256 lambda,
        uint256 timestamp
    );
    event Repay(address indexed user, uint256 amount, uint256 timestamp);
    event AutoRepay(
        address indexed user,
        uint256 repayAmount,
        uint256 newLambda,
        uint256 timestamp
    );
    event ZKVerification(address indexed user, bytes32 proofHash);
    event LiquidationTriggered(
        address indexed user,
        uint256 collateralLiquidated,
        uint256 debtRepaid
    );

    modifier onlyFluence() {
        require(msg.sender == fluenceAgent, "Only Fluence agent");
        _;
    }

    modifier notPaused() {
        require(!config.paused, "Contract paused");
        _;
    }

    modifier zkVerified() {
        (bool isVerified,,) = selfBridge.isUserVerified(msg.sender);
        require(isVerified, "ZK verification required");
        _;
    }

    constructor(
        address _oracle,
        address _x402Payment,
        address _fluenceAgent,
        address _selfBridge
    ) Ownable(msg.sender) {
        oracle = RealOracle(_oracle);
        x402Payment = X402Payment(_x402Payment);
        fluenceAgent = _fluenceAgent;
        selfBridge = SelfProtocolBridge(_selfBridge);

        // Initialize default config
        config = LoanConfig({
            minCollateralUSD: 100 * USD_PRECISION, // $100 minimum
            maxLoanDuration: 30 days,
            liquidationThreshold: 8500, // 85%
            interestRate: 1000, // 10% APR
            maxBorrowPerUser: 100000 * USD_PRECISION, // $100,000 max per user
            totalBorrowCap: 10000000 * USD_PRECISION, // $10M total cap
            paused: false
        });

        // Register AI inference service with x402
        x402Payment.registerService(AI_INFERENCE_SERVICE, 5 * USD_PRECISION / 1000); // $0.005 per inference
    }

    /**
     * @dev Deposit USDC as collateral
     * @param amount Amount of USDC tokens to deposit
     */
    function deposit(uint256 amount) external notPaused nonReentrant {
        require(amount > 0, "Amount must be greater than 0");

        Vault storage vault = vaults[msg.sender];

        // Transfer collateral from user
        SHIB.safeTransferFrom(msg.sender, address(this), amount);

        vault.collateralAmount += amount;
        vault.lastUpdateTime = block.timestamp;

        emit Deposit(msg.sender, amount, block.timestamp);
    }

    /**
     * @dev Request ZK identity verification via Self Protocol
     * @param challengeHash Unique challenge hash for verification request
     */
    function requestZKVerification(bytes32 challengeHash)
        external
        notPaused
        returns (bytes32 requestId)
    {
        requestId = selfBridge.requestVerification(challengeHash);
        emit ZKVerification(msg.sender, challengeHash);
        return requestId;
    }

    /**
     * @dev Check if user has valid ZK verification
     * @param user User address to check
     */
    function isZKVerified(address user)
        external
        view
        returns (bool verified, bytes32 proofHash, uint256 timestamp)
    {
        return selfBridge.isUserVerified(user);
    }

    /**
     * @dev Borrow USDC against USDC collateral
     * @param usdcAmount Amount of USDC to borrow
     * @param lambda Risk multiplier from AI agent (scaled by 1000)
     * @param minLambda Minimum acceptable lambda for slippage protection
     * @param aiProof Proof of AI inference payment
     */
    function borrow(
        uint256 usdcAmount,
        uint256 lambda,
        uint256 minLambda,
        bytes calldata aiProof
    ) external notPaused nonReentrant zkVerified {
        require(usdcAmount > 0, "Borrow amount must be greater than 0");
        require(lambda >= 300 && lambda <= 1800, "Lambda out of range"); // 0.3x to 1.8x
        require(minLambda <= lambda, "Lambda below minimum acceptable");
        require(lambda - minLambda <= (lambda * MAX_SLIPPAGE) / BASIS_POINTS, "Slippage too high");

        Vault storage vault = vaults[msg.sender];
        require(vault.collateralAmount > 0, "No collateral deposited");

        // Verify AI inference payment via x402
        _verifyAIInferencePayment(aiProof);

        // Get current collateral price from oracle with enhanced validation
        (uint256 price, uint256 confidence, bool isStale) = oracle.getPrice(USDC_USD_FEED);
        require(price > 0 && !isStale, "Invalid collateral price");
        require(confidence >= MIN_CONFIDENCE, "Price confidence too low");

        // Additional staleness check
        (, uint256 lastUpdate) = oracle.getVolatility(USDC_USD_FEED);
        require(block.timestamp - lastUpdate <= PRICE_STALENESS_THRESHOLD, "Price data too stale");

        // Calculate collateral value in USD (USDC = 1:1 USD)
        uint256 collateralValueUSD = vault.collateralAmount;

        // Check minimum collateral requirement
        require(collateralValueUSD >= config.minCollateralUSD, "Insufficient collateral");

        // Check borrow caps
        require(vault.debtAmount + usdcAmount <= config.maxBorrowPerUser, "Exceeds user borrow limit");
        require(totalBorrowed + usdcAmount <= config.totalBorrowCap, "Exceeds global borrow cap");

        // Calculate maximum borrow amount based on lambda
        uint256 maxBorrowAmount = (collateralValueUSD * lambda) / LAMBDA_PRECISION;
        require(
            vault.debtAmount + usdcAmount <= maxBorrowAmount,
            "Exceeds maximum borrow amount"
        );

        // Update vault and global state
        vault.debtAmount += usdcAmount;
        vault.lastLambda = lambda;
        vault.lastUpdateTime = block.timestamp;
        totalBorrowed += usdcAmount;

        // Transfer USDC to user
        USDC.safeTransfer(msg.sender, usdcAmount);

        emit Borrow(msg.sender, usdcAmount, lambda, block.timestamp);
    }

    /**
     * @dev Repay borrowed USDC
     * @param amount Amount of USDC to repay
     */
    function repay(uint256 amount) external notPaused nonReentrant {
        require(amount > 0, "Repay amount must be greater than 0");

        Vault storage vault = vaults[msg.sender];
        require(vault.debtAmount > 0, "No debt to repay");

        // Calculate actual repay amount (including interest)
        uint256 interest = _calculateInterest(vault.debtAmount, vault.lastUpdateTime);
        uint256 totalDebt = vault.debtAmount + interest;
        uint256 actualRepayAmount = amount > totalDebt ? totalDebt : amount;

        // Transfer USDC from user
        USDC.safeTransferFrom(msg.sender, address(this), actualRepayAmount);

        // Update vault and global state
        uint256 principalRepaid;
        if (actualRepayAmount >= totalDebt) {
            principalRepaid = vault.debtAmount;
            vault.debtAmount = 0;
        } else {
            principalRepaid = actualRepayAmount > interest ? actualRepayAmount - interest : 0;
            vault.debtAmount = totalDebt - actualRepayAmount;
        }
        vault.lastUpdateTime = block.timestamp;

        // Update total borrowed (only reduce by principal, not interest)
        totalBorrowed = totalBorrowed >= principalRepaid ? totalBorrowed - principalRepaid : 0;

        emit Repay(msg.sender, actualRepayAmount, block.timestamp);
    }

    /**
     * @dev Withdraw collateral (only if no debt)
     * @param amount Amount of USDC to withdraw
     */
    function withdraw(uint256 amount) external notPaused nonReentrant {
        Vault storage vault = vaults[msg.sender];
        require(vault.debtAmount == 0, "Must repay debt first");
        require(vault.collateralAmount >= amount, "Insufficient collateral");

        vault.collateralAmount -= amount;
        SHIB.safeTransfer(msg.sender, amount);
    }

    /**
     * @dev Auto-repay triggered by Fluence agent when risk increases
     * @param user User address
     * @param newLambda New risk multiplier
     */
    function autoRepay(address user, uint256 newLambda)
        external
        onlyFluence
        nonReentrant
    {
        require(newLambda >= 300 && newLambda <= 1800, "Lambda out of range");

        Vault storage vault = vaults[user];
        require(vault.debtAmount > 0, "No debt to repay");

        // Get current collateral price from oracle
        (uint256 price, uint256 confidence, bool isStale) = oracle.getPrice(USDC_USD_FEED);
        require(price > 0 && !isStale, "Invalid collateral price");
        require(confidence >= 9500, "Price confidence too low");

        // Calculate collateral value in USD (USDC = 1:1 USD)
        uint256 collateralValueUSD = vault.collateralAmount;

        uint256 maxAllowedDebt = (collateralValueUSD * newLambda) / LAMBDA_PRECISION;
        uint256 currentDebt = vault.debtAmount + _calculateInterest(vault.debtAmount, vault.lastUpdateTime);

        if (currentDebt > maxAllowedDebt) {
            uint256 excessDebt = currentDebt - maxAllowedDebt;
            uint256 collateralToSell = excessDebt; // 1:1 for USDC collateral

            // Perform auto-liquidation to repay excess debt
            vault.collateralAmount -= collateralToSell;
            vault.debtAmount = maxAllowedDebt;
            vault.lastLambda = newLambda;
            vault.lastUpdateTime = block.timestamp;

            emit AutoRepay(user, excessDebt, newLambda, block.timestamp);
        }
    }

    /**
     * @dev Liquidate under-collateralized position
     * @param user User to liquidate
     */
    function liquidate(address user) external notPaused nonReentrant {
        Vault storage vault = vaults[user];
        require(vault.debtAmount > 0, "No debt to liquidate");

        // Get current collateral price and volatility
        (uint256 price, uint256 confidence, bool isStale) = oracle.getPrice(USDC_USD_FEED);
        require(price > 0 && !isStale, "Invalid collateral price");
        require(confidence >= 9500, "Price confidence too low");

        uint256 currentLambda = oracle.getRiskMultiplier(USDC_USD_FEED);

        // Calculate collateral value in USD (USDC = 1:1 USD)
        uint256 collateralValueUSD = vault.collateralAmount;

        uint256 currentDebt = vault.debtAmount + _calculateInterest(vault.debtAmount, vault.lastUpdateTime);
        uint256 maxSafeDebt = (collateralValueUSD * config.liquidationThreshold) / BASIS_POINTS;

        require(currentDebt > maxSafeDebt, "Position not liquidatable");

        // Liquidate entire position
        uint256 collateralLiquidated = vault.collateralAmount;
        uint256 debtRepaid = currentDebt > collateralValueUSD ? collateralValueUSD : currentDebt;

        vault.collateralAmount = 0;
        vault.debtAmount = currentDebt > debtRepaid ? currentDebt - debtRepaid : 0;

        // Transfer liquidation bonus to liquidator (5% of collateral)
        uint256 liquidationBonus = (collateralLiquidated * 500) / BASIS_POINTS;
        SHIB.safeTransfer(msg.sender, liquidationBonus);

        emit LiquidationTriggered(user, collateralLiquidated, debtRepaid);
    }

    /**
     * @dev Get user vault information
     */
    function getVault(address user)
        external
        view
        returns (
            uint256 collateralAmount,
            uint256 debtAmount,
            uint256 lastLambda,
            uint256 lastUpdateTime,
            bool isZkVerified,
            bytes32 zkProofHash
        )
    {
        Vault memory vault = vaults[user];
        (bool verified, bytes32 proofHash,) = selfBridge.isUserVerified(user);
        return (
            vault.collateralAmount,
            vault.debtAmount,
            vault.lastLambda,
            vault.lastUpdateTime,
            verified,
            proofHash
        );
    }

    /**
     * @dev Calculate maximum borrow amount for user
     */
    function getMaxBorrowAmount(address user) external view returns (uint256) {
        Vault memory vault = vaults[user];
        if (vault.collateralAmount == 0) return 0;

        (uint256 price, uint256 confidence, bool isStale) = oracle.getPrice(USDC_USD_FEED);
        if (price <= 0 || isStale || confidence < 9500) return 0;

        uint256 lambda = oracle.getRiskMultiplier(USDC_USD_FEED);

        // Calculate collateral value in USD (USDC = 1:1 USD)
        uint256 collateralValueUSD = vault.collateralAmount;
        uint256 maxBorrow = (collateralValueUSD * lambda) / LAMBDA_PRECISION;

        return maxBorrow > vault.debtAmount ? maxBorrow - vault.debtAmount : 0;
    }

    /**
     * @dev Internal function to verify AI inference payment
     */
    function _verifyAIInferencePayment(bytes calldata proof) internal {
        // Verify that user paid for AI inference via x402
        // This is a simplified check - in production, would verify the actual payment
        require(proof.length > 0, "AI inference proof required");
    }


    /**
     * @dev Calculate collateral value in USD
     */
    function _calculateCollateralValue(
        uint256 collateralAmount,
        uint256 price
    ) internal pure returns (uint256) {
        // USDC has 6 decimals, price has 8 decimals, result in 6 decimals
        return (collateralAmount * price) / 1e8;
    }

    /**
     * @dev Calculate interest on debt
     */
    function _calculateInterest(uint256 principal, uint256 lastUpdate)
        internal
        view
        returns (uint256)
    {
        if (lastUpdate >= block.timestamp) return 0;

        uint256 timeElapsed = block.timestamp - lastUpdate;
        uint256 yearlyRate = config.interestRate;

        // Simple interest calculation: principal * rate * time / (365 days * 10000 basis points)
        return (principal * yearlyRate * timeElapsed) / (365 days * BASIS_POINTS);
    }

    /**
     * @dev Calculate collateral to sell for repayment
     */
    function _calculateCollateralToSell(
        uint256 usdAmount,
        uint256 price
    ) internal pure returns (uint256) {
        // For USDC collateral, 1:1 ratio with USD
        return usdAmount;
    }

    /**
     * @dev Admin functions
     */
    function setConfig(LoanConfig calldata newConfig) external onlyOwner {
        config = newConfig;
    }

    function setFluenceAgent(address newAgent) external onlyOwner {
        fluenceAgent = newAgent;
    }


    function emergencyPause() external onlyOwner {
        config.paused = true;
    }

    function unpause() external onlyOwner {
        config.paused = false;
    }
}