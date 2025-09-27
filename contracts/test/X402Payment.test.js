const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("X402Payment Contract", function () {
    async function deployX402Fixture() {
        const [owner, provider, user1, user2] = await ethers.getSigners();

        // Deploy mock USDC
        const MockERC20 = await ethers.getContractFactory("MockERC20");
        const usdc = await MockERC20.deploy("USD Coin", "USDC", 6);

        // Deploy X402Payment contract
        const X402Payment = await ethers.getContractFactory("X402Payment");
        const x402Payment = await X402Payment.deploy();

        // Mint USDC to users
        await usdc.mint(user1.address, ethers.parseUnits("1000", 6));
        await usdc.mint(user2.address, ethers.parseUnits("1000", 6));

        return {
            x402Payment,
            usdc,
            owner,
            provider,
            user1,
            user2
        };
    }

    describe("Deployment", function () {
        it("Should deploy with correct USDC address", async function () {
            const { x402Payment } = await loadFixture(deployX402Fixture);

            expect(await x402Payment.USDC()).to.not.equal(ethers.ZeroAddress);
            expect(await x402Payment.PLATFORM_FEE_BASIS_POINTS()).to.equal(250); // 2.5%
        });
    });

    describe("Service Registration", function () {
        it("Should allow service registration", async function () {
            const { x402Payment, provider } = await loadFixture(deployX402Fixture);

            const serviceId = ethers.keccak256(ethers.toUtf8Bytes("AI_INFERENCE"));
            const pricePerCall = ethers.parseUnits("0.01", 6); // 0.01 USDC

            await expect(x402Payment.connect(provider).registerService(serviceId, pricePerCall))
                .to.emit(x402Payment, "ServiceRegistered")
                .withArgs(serviceId, provider.address, pricePerCall);

            const serviceDetails = await x402Payment.getServiceDetails(serviceId);
            expect(serviceDetails[0]).to.equal(provider.address); // provider
            expect(serviceDetails[1]).to.equal(pricePerCall); // pricePerCall
            expect(serviceDetails[2]).to.equal(true); // active
        });

        it("Should revert when registering with zero price", async function () {
            const { x402Payment, provider } = await loadFixture(deployX402Fixture);

            const serviceId = ethers.keccak256(ethers.toUtf8Bytes("AI_INFERENCE"));
            const zeroPricePerCall = 0;

            await expect(x402Payment.connect(provider).registerService(serviceId, zeroPricePerCall))
                .to.be.revertedWith("Price must be greater than 0");
        });

        it("Should allow provider to update service price", async function () {
            const { x402Payment, provider } = await loadFixture(deployX402Fixture);

            const serviceId = ethers.keccak256(ethers.toUtf8Bytes("AI_INFERENCE"));
            const initialPrice = ethers.parseUnits("0.01", 6);
            const newPrice = ethers.parseUnits("0.02", 6);

            // Register service
            await x402Payment.connect(provider).registerService(serviceId, initialPrice);

            // Update price
            await expect(x402Payment.connect(provider).updateServicePrice(serviceId, newPrice))
                .to.emit(x402Payment, "ServiceUpdated")
                .withArgs(serviceId, newPrice, true);

            const serviceDetails = await x402Payment.getServiceDetails(serviceId);
            expect(serviceDetails[1]).to.equal(newPrice);
        });

        it("Should revert when non-provider tries to update service", async function () {
            const { x402Payment, provider, user1 } = await loadFixture(deployX402Fixture);

            const serviceId = ethers.keccak256(ethers.toUtf8Bytes("AI_INFERENCE"));
            const pricePerCall = ethers.parseUnits("0.01", 6);
            const newPrice = ethers.parseUnits("0.02", 6);

            // Register service
            await x402Payment.connect(provider).registerService(serviceId, pricePerCall);

            // Try to update from different account
            await expect(x402Payment.connect(user1).updateServicePrice(serviceId, newPrice))
                .to.be.revertedWith("Only provider can update");
        });
    });

    describe("Service Payments", function () {
        async function setupRegisteredService() {
            const fixture = await loadFixture(deployX402Fixture);
            const { x402Payment, provider } = fixture;

            const serviceId = ethers.keccak256(ethers.toUtf8Bytes("AI_INFERENCE"));
            const pricePerCall = ethers.parseUnits("0.1", 6); // 0.1 USDC

            await x402Payment.connect(provider).registerService(serviceId, pricePerCall);

            return { ...fixture, serviceId, pricePerCall };
        }

        it("Should allow payment for service with USDC", async function () {
            const { x402Payment, usdc, user1, provider, serviceId, pricePerCall } = await setupRegisteredService();

            // Approve USDC for payment
            await usdc.connect(user1).approve(await x402Payment.getAddress(), pricePerCall);

            const platformFee = (pricePerCall * 250n) / 10000n; // 2.5%
            const providerAmount = pricePerCall - platformFee;

            await expect(x402Payment.connect(user1).payForService(serviceId, provider.address))
                .to.emit(x402Payment, "X402PaymentMade")
                .withArgs(user1.address, provider.address, pricePerCall, serviceId)
                .and.to.emit(x402Payment, "PaymentCompleted")
                .withArgs(user1.address, serviceId, pricePerCall, platformFee);

            // Check balances
            expect(await usdc.balanceOf(provider.address)).to.equal(providerAmount);

            // Check statistics
            const serviceDetails = await x402Payment.getServiceDetails(serviceId);
            expect(serviceDetails[3]).to.equal(1); // totalCalls
            expect(serviceDetails[4]).to.equal(providerAmount); // totalRevenue

            const userStats = await x402Payment.getUserStats(user1.address, serviceId);
            expect(userStats[0]).to.equal(1); // calls
            expect(userStats[1]).to.equal(pricePerCall); // totalSpent
        });

        it("Should allow payment for service with ETH", async function () {
            const { x402Payment, user1, provider, serviceId } = await setupRegisteredService();

            const ethAmount = ethers.parseEther("0.001"); // 0.001 ETH
            const platformFee = (ethAmount * 250n) / 10000n;
            const providerAmount = ethAmount - platformFee;

            const initialProviderBalance = await ethers.provider.getBalance(provider.address);

            await expect(x402Payment.connect(user1).payForServiceETH(serviceId, provider.address, { value: ethAmount }))
                .to.emit(x402Payment, "X402PaymentMade")
                .withArgs(user1.address, provider.address, ethAmount, serviceId);

            // Check provider received ETH (approximately, accounting for gas)
            const finalProviderBalance = await ethers.provider.getBalance(provider.address);
            expect(finalProviderBalance - initialProviderBalance).to.be.closeTo(providerAmount, ethers.parseEther("0.0001"));
        });

        it("Should revert when service not found", async function () {
            const { x402Payment, user1, provider } = await loadFixture(deployX402Fixture);

            const nonExistentServiceId = ethers.keccak256(ethers.toUtf8Bytes("NON_EXISTENT"));

            await expect(x402Payment.connect(user1).payForService(nonExistentServiceId, provider.address))
                .to.be.revertedWith("Service not found");
        });

        it("Should revert when service is inactive", async function () {
            const { x402Payment, user1, provider, serviceId } = await setupRegisteredService();

            // Deactivate service
            await x402Payment.connect(provider).toggleServiceStatus(serviceId);

            await expect(x402Payment.connect(user1).payForService(serviceId, provider.address))
                .to.be.revertedWith("Service not active");
        });

        it("Should revert when insufficient USDC allowance", async function () {
            const { x402Payment, usdc, user1, provider, serviceId, pricePerCall } = await setupRegisteredService();

            // Approve less than required
            await usdc.connect(user1).approve(await x402Payment.getAddress(), pricePerCall / 2n);

            await expect(x402Payment.connect(user1).payForService(serviceId, provider.address))
                .to.be.revertedWith("USDC transfer failed");
        });
    });

    describe("Service Management", function () {
        async function setupRegisteredService() {
            const fixture = await loadFixture(deployX402Fixture);
            const { x402Payment, provider } = fixture;

            const serviceId = ethers.keccak256(ethers.toUtf8Bytes("AI_INFERENCE"));
            const pricePerCall = ethers.parseUnits("0.1", 6);

            await x402Payment.connect(provider).registerService(serviceId, pricePerCall);

            return { ...fixture, serviceId, pricePerCall };
        }

        it("Should allow provider to toggle service status", async function () {
            const { x402Payment, provider, serviceId } = await setupRegisteredService();

            // Initially active
            let serviceDetails = await x402Payment.getServiceDetails(serviceId);
            expect(serviceDetails[2]).to.equal(true);

            // Toggle to inactive
            await expect(x402Payment.connect(provider).toggleServiceStatus(serviceId))
                .to.emit(x402Payment, "ServiceUpdated")
                .withArgs(serviceId, serviceDetails[1], false);

            serviceDetails = await x402Payment.getServiceDetails(serviceId);
            expect(serviceDetails[2]).to.equal(false);

            // Toggle back to active
            await x402Payment.connect(provider).toggleServiceStatus(serviceId);
            serviceDetails = await x402Payment.getServiceDetails(serviceId);
            expect(serviceDetails[2]).to.equal(true);
        });

        it("Should return correct service price", async function () {
            const { x402Payment, serviceId, pricePerCall } = await setupRegisteredService();

            const price = await x402Payment.getServicePrice(serviceId);
            expect(price).to.equal(pricePerCall);
        });

        it("Should track provider revenue correctly", async function () {
            const { x402Payment, usdc, user1, provider, serviceId, pricePerCall } = await setupRegisteredService();

            // Make multiple payments
            for (let i = 0; i < 3; i++) {
                await usdc.connect(user1).approve(await x402Payment.getAddress(), pricePerCall);
                await x402Payment.connect(user1).payForService(serviceId, provider.address);
            }

            const platformFee = (pricePerCall * 250n) / 10000n;
            const providerAmountPerCall = pricePerCall - platformFee;
            const expectedTotalRevenue = providerAmountPerCall * 3n;

            expect(await x402Payment.providerRevenue(provider.address)).to.equal(expectedTotalRevenue);
        });
    });

    describe("Admin Functions", function () {
        it("Should allow owner to withdraw platform fees", async function () {
            const { x402Payment, usdc, user1, provider, owner } = await setupRegisteredService();

            const serviceId = ethers.keccak256(ethers.toUtf8Bytes("AI_INFERENCE"));
            const pricePerCall = ethers.parseUnits("0.1", 6);

            // Make payment to generate fees
            await usdc.connect(user1).approve(await x402Payment.getAddress(), pricePerCall);
            await x402Payment.connect(user1).payForService(serviceId, provider.address);

            const platformFee = (pricePerCall * 250n) / 10000n;
            expect(await x402Payment.platformRevenue()).to.equal(platformFee);

            // Withdraw fees
            const initialBalance = await usdc.balanceOf(owner.address);
            await x402Payment.connect(owner).withdrawPlatformFees();
            const finalBalance = await usdc.balanceOf(owner.address);

            expect(finalBalance - initialBalance).to.equal(platformFee);
        });

        it("Should revert when non-owner tries to withdraw fees", async function () {
            const { x402Payment, user1 } = await loadFixture(deployX402Fixture);

            await expect(x402Payment.connect(user1).withdrawPlatformFees())
                .to.be.revertedWithCustomError(x402Payment, "OwnableUnauthorizedAccount");
        });

        it("Should allow emergency withdraw", async function () {
            const { x402Payment, usdc, owner } = await loadFixture(deployX402Fixture);

            // Send some USDC to contract
            await usdc.mint(await x402Payment.getAddress(), ethers.parseUnits("100", 6));

            const initialBalance = await usdc.balanceOf(owner.address);
            await x402Payment.connect(owner).emergencyWithdraw(await usdc.getAddress());
            const finalBalance = await usdc.balanceOf(owner.address);

            expect(finalBalance - initialBalance).to.equal(ethers.parseUnits("100", 6));
        });
    });

    describe("Edge Cases", function () {
        it("Should handle zero payment amount in ETH", async function () {
            const { x402Payment, user1, provider } = await setupRegisteredService();

            const serviceId = ethers.keccak256(ethers.toUtf8Bytes("AI_INFERENCE"));

            await expect(x402Payment.connect(user1).payForServiceETH(serviceId, provider.address, { value: 0 }))
                .to.be.revertedWith("Must send ETH");
        });

        it("Should handle multiple services from same provider", async function () {
            const { x402Payment, provider } = await loadFixture(deployX402Fixture);

            const serviceId1 = ethers.keccak256(ethers.toUtf8Bytes("AI_INFERENCE_1"));
            const serviceId2 = ethers.keccak256(ethers.toUtf8Bytes("AI_INFERENCE_2"));
            const pricePerCall = ethers.parseUnits("0.1", 6);

            await x402Payment.connect(provider).registerService(serviceId1, pricePerCall);
            await x402Payment.connect(provider).registerService(serviceId2, pricePerCall * 2n);

            expect(await x402Payment.getServicePrice(serviceId1)).to.equal(pricePerCall);
            expect(await x402Payment.getServicePrice(serviceId2)).to.equal(pricePerCall * 2n);
        });

        it("Should handle service overwrite", async function () {
            const { x402Payment, provider } = await loadFixture(deployX402Fixture);

            const serviceId = ethers.keccak256(ethers.toUtf8Bytes("AI_INFERENCE"));
            const initialPrice = ethers.parseUnits("0.1", 6);
            const newPrice = ethers.parseUnits("0.2", 6);

            // Register service
            await x402Payment.connect(provider).registerService(serviceId, initialPrice);

            // Register again with different price (should overwrite)
            await x402Payment.connect(provider).registerService(serviceId, newPrice);

            expect(await x402Payment.getServicePrice(serviceId)).to.equal(newPrice);
        });
    });
});

async function setupRegisteredService() {
    const fixture = await loadFixture(deployX402Fixture);
    const { x402Payment, provider } = fixture;

    const serviceId = ethers.keccak256(ethers.toUtf8Bytes("AI_INFERENCE"));
    const pricePerCall = ethers.parseUnits("0.1", 6);

    await x402Payment.connect(provider).registerService(serviceId, pricePerCall);

    return { ...fixture, serviceId, pricePerCall };
}