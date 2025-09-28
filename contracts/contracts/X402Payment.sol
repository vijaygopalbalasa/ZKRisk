// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "./interfaces/IX402Payment.sol";

interface IERC3009 {
    function transferWithAuthorization(
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;

    function receiveWithAuthorization(
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;
}

/**
 * @title X402Payment
 * @dev Implementation of x402 micropayment protocol for AI inference payments
 * Enables automatic payments for API calls and AI services
 */
contract X402Payment is IX402Payment, Ownable, ReentrancyGuard {
    struct Service {
        address provider;
        uint256 pricePerCall;
        bool active;
        uint256 totalCalls;
        uint256 totalRevenue;
    }

    // USDC on Polygon Amoy testnet (Real address)
    IERC20 public immutable USDC = IERC20(0x9A676e781A523b5d0C0e43731313A708CB607508);
    IERC3009 public immutable USDC_EIP3009 = IERC3009(0x9A676e781A523b5d0C0e43731313A708CB607508);

    mapping(bytes32 => Service) public services;
    mapping(address => mapping(bytes32 => uint256)) public userServiceCalls;
    mapping(address => uint256) public userTotalSpent;
    mapping(address => uint256) public providerRevenue;
    mapping(bytes32 => bool) public usedNonces; // Track used EIP-3009 nonces

    uint256 public constant PLATFORM_FEE_BASIS_POINTS = 250; // 2.5%
    uint256 public constant MAX_PLATFORM_FEE = 1000; // 10% max platform fee
    uint256 public constant MIN_SERVICE_PRICE = 1e3; // 0.001 USDC minimum
    uint256 public constant MAX_SERVICE_PRICE = 1000e6; // 1000 USDC maximum
    uint256 public platformRevenue;

    event ServiceUpdated(bytes32 indexed serviceId, uint256 newPrice, bool active);
    event PaymentCompleted(
        address indexed user,
        bytes32 indexed serviceId,
        uint256 amount,
        uint256 platformFee
    );

    constructor() Ownable(msg.sender) {}

    /**
     * @dev Register or update a service for x402 payments
     * @param serviceId Unique identifier for the service
     * @param pricePerCall Cost per service call in USDC (6 decimals)
     */
    function registerService(bytes32 serviceId, uint256 pricePerCall) external override {
        require(pricePerCall >= MIN_SERVICE_PRICE, "Price too low");
        require(pricePerCall <= MAX_SERVICE_PRICE, "Price too high");

        services[serviceId] = Service({
            provider: msg.sender,
            pricePerCall: pricePerCall,
            active: true,
            totalCalls: 0,
            totalRevenue: 0
        });

        emit ServiceRegistered(serviceId, msg.sender, pricePerCall);
        emit ServiceUpdated(serviceId, pricePerCall, true);
    }

    /**
     * @dev Update service price (only provider)
     * @param serviceId Service identifier
     * @param newPrice New price per call
     */
    function updateServicePrice(bytes32 serviceId, uint256 newPrice) external {
        Service storage service = services[serviceId];
        require(service.provider == msg.sender, "Only provider can update");
        require(newPrice >= MIN_SERVICE_PRICE, "Price too low");
        require(newPrice <= MAX_SERVICE_PRICE, "Price too high");

        service.pricePerCall = newPrice;
        emit ServiceUpdated(serviceId, newPrice, service.active);
    }

    /**
     * @dev Toggle service active status (only provider)
     * @param serviceId Service identifier
     */
    function toggleServiceStatus(bytes32 serviceId) external {
        Service storage service = services[serviceId];
        require(service.provider == msg.sender, "Only provider can toggle");

        service.active = !service.active;
        emit ServiceUpdated(serviceId, service.pricePerCall, service.active);
    }

    /**
     * @dev Make payment for service usage
     * @param serviceId Service identifier
     * @param recipient Payment recipient (can be different from provider)
     */
    function payForService(bytes32 serviceId, address recipient)
        external
        payable
        override
        nonReentrant
    {
        Service storage service = services[serviceId];
        require(service.provider != address(0), "Service not found");
        require(service.active, "Service not active");

        uint256 amount = service.pricePerCall;
        uint256 platformFee = (amount * PLATFORM_FEE_BASIS_POINTS) / 10000;
        uint256 providerAmount = amount - platformFee;

        // Transfer USDC from user
        require(
            USDC.transferFrom(msg.sender, address(this), amount),
            "USDC transfer failed"
        );

        // Transfer to provider/recipient
        require(
            USDC.transfer(recipient, providerAmount),
            "Provider payment failed"
        );

        // Update statistics
        service.totalCalls++;
        service.totalRevenue += providerAmount;
        userServiceCalls[msg.sender][serviceId]++;
        userTotalSpent[msg.sender] += amount;
        providerRevenue[recipient] += providerAmount;
        platformRevenue += platformFee;

        emit X402PaymentMade(msg.sender, recipient, amount, serviceId);
        emit PaymentCompleted(msg.sender, serviceId, amount, platformFee);
    }

    /**
     * @dev Make payment with EIP-3009 permit (gasless transactions)
     * @param serviceId Service identifier
     * @param recipient Payment recipient
     * @param from Address to transfer from
     * @param validAfter Valid after timestamp
     * @param validBefore Valid before timestamp
     * @param nonce Unique nonce
     * @param v Signature v
     * @param r Signature r
     * @param s Signature s
     */
    function payForServiceWithPermit(
        bytes32 serviceId,
        address recipient,
        address from,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external nonReentrant {
        Service storage service = services[serviceId];
        require(service.provider != address(0), "Service not found");
        require(service.active, "Service not active");
        require(!usedNonces[nonce], "Nonce already used");
        require(block.timestamp >= validAfter, "Authorization not yet valid");
        require(block.timestamp <= validBefore, "Authorization expired");

        // Mark nonce as used
        usedNonces[nonce] = true;

        uint256 amount = service.pricePerCall;
        uint256 platformFee = (amount * PLATFORM_FEE_BASIS_POINTS) / 10000;
        uint256 providerAmount = amount - platformFee;

        // Use EIP-3009 receiveWithAuthorization for gasless payment
        USDC_EIP3009.receiveWithAuthorization(
            from,
            address(this),
            amount,
            validAfter,
            validBefore,
            nonce,
            v,
            r,
            s
        );

        // Transfer to provider/recipient
        require(
            USDC.transfer(recipient, providerAmount),
            "Provider payment failed"
        );

        // Update statistics
        service.totalCalls++;
        service.totalRevenue += providerAmount;
        userServiceCalls[from][serviceId]++;
        userTotalSpent[from] += amount;
        providerRevenue[recipient] += providerAmount;
        platformRevenue += platformFee;

        emit X402PaymentMade(from, recipient, amount, serviceId);
        emit PaymentCompleted(from, serviceId, amount, platformFee);
    }

    /**
     * @dev Make payment with ETH (converted to USDC equivalent)
     * @param serviceId Service identifier
     * @param recipient Payment recipient
     */
    function payForServiceETH(bytes32 serviceId, address recipient)
        external
        payable
        nonReentrant
    {
        Service storage service = services[serviceId];
        require(service.provider != address(0), "Service not found");
        require(service.active, "Service not active");
        require(msg.value > 0, "Must send ETH");

        uint256 platformFee = (msg.value * PLATFORM_FEE_BASIS_POINTS) / 10000;
        uint256 providerAmount = msg.value - platformFee;

        // Transfer ETH to provider/recipient
        (bool success, ) = payable(recipient).call{value: providerAmount}("");
        require(success, "ETH transfer failed");

        // Update statistics
        service.totalCalls++;
        service.totalRevenue += providerAmount;
        userServiceCalls[msg.sender][serviceId]++;
        userTotalSpent[msg.sender] += msg.value;
        providerRevenue[recipient] += providerAmount;
        platformRevenue += platformFee;

        emit X402PaymentMade(msg.sender, recipient, msg.value, serviceId);
        emit PaymentCompleted(msg.sender, serviceId, msg.value, platformFee);
    }

    /**
     * @dev Get service price
     * @param serviceId Service identifier
     * @return price Price per call in USDC
     */
    function getServicePrice(bytes32 serviceId)
        external
        view
        override
        returns (uint256 price)
    {
        return services[serviceId].pricePerCall;
    }

    /**
     * @dev Get service details
     * @param serviceId Service identifier
     */
    function getServiceDetails(bytes32 serviceId)
        external
        view
        returns (
            address provider,
            uint256 pricePerCall,
            bool active,
            uint256 totalCalls,
            uint256 totalRevenue
        )
    {
        Service memory service = services[serviceId];
        return (
            service.provider,
            service.pricePerCall,
            service.active,
            service.totalCalls,
            service.totalRevenue
        );
    }

    /**
     * @dev Get user statistics
     * @param user User address
     * @param serviceId Service identifier
     */
    function getUserStats(address user, bytes32 serviceId)
        external
        view
        returns (uint256 calls, uint256 totalSpent)
    {
        return (userServiceCalls[user][serviceId], userTotalSpent[user]);
    }

    /**
     * @dev Withdraw platform fees (only owner)
     */
    function withdrawPlatformFees() external onlyOwner {
        uint256 usdcBalance = USDC.balanceOf(address(this));
        if (usdcBalance > 0) {
            require(USDC.transfer(owner(), usdcBalance), "USDC transfer failed");
        }

        uint256 ethBalance = address(this).balance;
        if (ethBalance > 0) {
            (bool success, ) = payable(owner()).call{value: ethBalance}("");
            require(success, "ETH transfer failed");
        }
    }

    /**
     * @dev Emergency withdraw (only owner)
     */
    function emergencyWithdraw(address token) external onlyOwner {
        if (token == address(0)) {
            (bool success, ) = payable(owner()).call{value: address(this).balance}("");
            require(success, "ETH transfer failed");
        } else {
            IERC20 tokenContract = IERC20(token);
            uint256 balance = tokenContract.balanceOf(address(this));
            require(tokenContract.transfer(owner(), balance), "Token transfer failed");
        }
    }
}