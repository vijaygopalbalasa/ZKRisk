// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IX402Payment
 * @dev Interface for x402 micropayment protocol integration
 */
interface IX402Payment {
    event X402PaymentMade(
        address indexed payer,
        address indexed recipient,
        uint256 amount,
        bytes32 indexed serviceId
    );

    event ServiceRegistered(
        bytes32 indexed serviceId,
        address indexed provider,
        uint256 pricePerCall
    );

    /**
     * @dev Register a service for x402 payments
     * @param serviceId Unique identifier for the service
     * @param pricePerCall Cost per service call in wei
     */
    function registerService(bytes32 serviceId, uint256 pricePerCall) external;

    /**
     * @dev Make payment for service usage
     * @param serviceId Service identifier
     * @param recipient Payment recipient
     */
    function payForService(bytes32 serviceId, address recipient) external payable;

    /**
     * @dev Get service price
     * @param serviceId Service identifier
     * @return price Price per call in wei
     */
    function getServicePrice(bytes32 serviceId) external view returns (uint256 price);
}