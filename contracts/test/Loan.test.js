const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("zkRisk Loan Contract", function () {
    // Test fixture for contract deployment
    async function deployLoanFixture() {
        const [owner, user1, user2, fluenceAgent] = await ethers.getSigners();

        // Deploy mock tokens
        const MockERC20 = await ethers.getContractFactory("MockERC20");
        const usdc = await MockERC20.deploy("USD Coin", "USDC", 6);
        const shib = await MockERC20.deploy("Shiba Inu", "SHIB", 18);

        // Deploy mock Pyth oracle
        const MockPyth = await ethers.getContractFactory("MockPyth");
        const mockPyth = await MockPyth.deploy();

        // Deploy X402Payment
        const X402Payment = await ethers.getContractFactory("X402Payment");
        const x402Payment = await X402Payment.deploy();

        // Deploy PythVolReader
        const PythVolReader = await ethers.getContractFactory("PythVolReader");
        const pythVolReader = await PythVolReader.deploy(await mockPyth.getAddress());

        // Deploy main Loan contract
        const Loan = await ethers.getContractFactory("Loan");
        const loan = await Loan.deploy(
            await pythVolReader.getAddress(),
            await x402Payment.getAddress(),
            fluenceAgent.address,
            owner.address // Self verifier
        );

        // Mint test tokens
        await usdc.mint(user1.address, ethers.parseUnits("10000", 6)); // 10k USDC
        await shib.mint(user1.address, ethers.parseUnits("1000000000", 18)); // 1B SHIB
        await usdc.mint(await loan.getAddress(), ethers.parseUnits("100000", 6)); // Liquidity

        return {
            loan,
            x402Payment,
            pythVolReader,
            mockPyth,
            usdc,
            shib,
            owner,
            user1,
            user2,
            fluenceAgent
        };
    }

    describe("Deployment", function () {
        it("Should deploy with correct parameters", async function () {
            const { loan, pythVolReader, x402Payment, owner, fluenceAgent } = await loadFixture(deployLoanFixture);

            expect(await loan.pythReader()).to.equal(await pythVolReader.getAddress());
            expect(await loan.x402Payment()).to.equal(await x402Payment.getAddress());
            expect(await loan.fluenceAgent()).to.equal(fluenceAgent.address);
            expect(await loan.owner()).to.equal(owner.address);
        });

        it("Should have correct token addresses", async function () {
            const { loan } = await loadFixture(deployLoanFixture);

            expect(await loan.USDC()).to.not.equal(ethers.ZeroAddress);
            expect(await loan.SHIB()).to.not.equal(ethers.ZeroAddress);
        });

        it("Should initialize with default config", async function () {
            const { loan } = await loadFixture(deployLoanFixture);

            const config = await loan.config();
            expect(config.minCollateralUSD).to.equal(ethers.parseUnits("100", 6));
            expect(config.liquidationThreshold).to.equal(8500);
            expect(config.interestRate).to.equal(1000);
            expect(config.paused).to.equal(false);
        });
    });

    describe("Collateral Deposit", function () {
        it("Should allow users to deposit SHIB collateral", async function () {
            const { loan, shib, user1 } = await loadFixture(deployLoanFixture);

            const depositAmount = ethers.parseUnits("1000000", 18); // 1M SHIB

            // Approve and deposit
            await shib.connect(user1).approve(await loan.getAddress(), depositAmount);
            await expect(loan.connect(user1).deposit(depositAmount))
                .to.emit(loan, "Deposit")
                .withArgs(user1.address, depositAmount, await ethers.provider.getBlock('latest').then(b => b.timestamp + 1));

            // Check vault state
            const vault = await loan.getVault(user1.address);
            expect(vault[0]).to.equal(depositAmount); // collateralAmount
            expect(vault[1]).to.equal(0); // debtAmount
        });

        it("Should revert when depositing zero amount", async function () {
            const { loan, user1 } = await loadFixture(deployLoanFixture);

            await expect(loan.connect(user1).deposit(0))
                .to.be.revertedWith("Amount must be greater than 0");
        });

        it("Should revert when insufficient allowance", async function () {
            const { loan, shib, user1 } = await loadFixture(deployLoanFixture);

            const depositAmount = ethers.parseUnits("1000000", 18);

            // Don't approve enough tokens
            await shib.connect(user1).approve(await loan.getAddress(), depositAmount / 2n);

            await expect(loan.connect(user1).deposit(depositAmount))
                .to.be.reverted;
        });
    });

    describe("ZK Identity Verification", function () {
        it("Should allow valid ZK proof verification", async function () {
            const { loan, user1 } = await loadFixture(deployLoanFixture);

            const mockProof = "0x" + "a".repeat(128);
            const proofHash = ethers.keccak256(ethers.toUtf8Bytes("test-proof"));

            await expect(loan.connect(user1).verifyZKIdentity(mockProof, proofHash))
                .to.emit(loan, "ZKVerification")
                .withArgs(user1.address, proofHash);

            // Check verification status
            const vault = await loan.getVault(user1.address);
            expect(vault[4]).to.equal(true); // zkVerified
        });

        it("Should revert when proof hash is zero", async function () {
            const { loan, user1 } = await loadFixture(deployLoanFixture);

            const mockProof = "0x" + "a".repeat(128);
            const zeroHash = ethers.ZeroHash;

            await expect(loan.connect(user1).verifyZKIdentity(mockProof, zeroHash))
                .to.be.revertedWith("Invalid proof hash");
        });

        it("Should revert when proof is already used", async function () {
            const { loan, user1, user2 } = await loadFixture(deployLoanFixture);

            const mockProof = "0x" + "a".repeat(128);
            const proofHash = ethers.keccak256(ethers.toUtf8Bytes("test-proof"));

            // First user uses the proof
            await loan.connect(user1).verifyZKIdentity(mockProof, proofHash);

            // Second user tries to use same proof
            await expect(loan.connect(user2).verifyZKIdentity(mockProof, proofHash))
                .to.be.revertedWith("Proof already used");
        });
    });

    describe("Borrowing", function () {
        async function setupVerifiedUserWithCollateral() {
            const fixture = await loadFixture(deployLoanFixture);
            const { loan, shib, user1 } = fixture;

            // Verify identity
            const mockProof = "0x" + "a".repeat(128);
            const proofHash = ethers.keccak256(ethers.toUtf8Bytes("test-proof"));
            await loan.connect(user1).verifyZKIdentity(mockProof, proofHash);

            // Deposit collateral
            const depositAmount = ethers.parseUnits("100000000", 18); // 100M SHIB
            await shib.connect(user1).approve(await loan.getAddress(), depositAmount);
            await loan.connect(user1).deposit(depositAmount);

            return fixture;
        }

        it("Should allow borrowing with valid parameters", async function () {
            const { loan, user1 } = await setupVerifiedUserWithCollateral();

            const borrowAmount = ethers.parseUnits("100", 6); // 100 USDC
            const lambda = 1200; // 1.2x
            const mockAiProof = "0x" + "b".repeat(64);

            await expect(loan.connect(user1).borrow(borrowAmount, lambda, mockAiProof))
                .to.emit(loan, "Borrow")
                .withArgs(user1.address, borrowAmount, lambda, await ethers.provider.getBlock('latest').then(b => b.timestamp + 1));

            // Check vault state
            const vault = await loan.getVault(user1.address);
            expect(vault[1]).to.equal(borrowAmount); // debtAmount
            expect(vault[2]).to.equal(lambda); // lastLambda
        });

        it("Should revert when user is not verified", async function () {
            const { loan, shib, user1 } = await loadFixture(deployLoanFixture);

            // Deposit collateral but don't verify identity
            const depositAmount = ethers.parseUnits("100000000", 18);
            await shib.connect(user1).approve(await loan.getAddress(), depositAmount);
            await loan.connect(user1).deposit(depositAmount);

            const borrowAmount = ethers.parseUnits("100", 6);
            const lambda = 1200;
            const mockAiProof = "0x" + "b".repeat(64);

            await expect(loan.connect(user1).borrow(borrowAmount, lambda, mockAiProof))
                .to.be.revertedWith("ZK verification required");
        });

        it("Should revert when lambda is out of range", async function () {
            const { loan, user1 } = await setupVerifiedUserWithCollateral();

            const borrowAmount = ethers.parseUnits("100", 6);
            const invalidLambda = 2000; // > 1800
            const mockAiProof = "0x" + "b".repeat(64);

            await expect(loan.connect(user1).borrow(borrowAmount, invalidLambda, mockAiProof))
                .to.be.revertedWith("Lambda out of range");
        });

        it("Should revert when no collateral deposited", async function () {
            const { loan, user1 } = await loadFixture(deployLoanFixture);

            // Verify identity but don't deposit collateral
            const mockProof = "0x" + "a".repeat(128);
            const proofHash = ethers.keccak256(ethers.toUtf8Bytes("test-proof"));
            await loan.connect(user1).verifyZKIdentity(mockProof, proofHash);

            const borrowAmount = ethers.parseUnits("100", 6);
            const lambda = 1200;
            const mockAiProof = "0x" + "b".repeat(64);

            await expect(loan.connect(user1).borrow(borrowAmount, lambda, mockAiProof))
                .to.be.revertedWith("No collateral deposited");
        });
    });

    describe("Repayment", function () {
        async function setupUserWithLoan() {
            const fixture = await setupVerifiedUserWithCollateral();
            const { loan, user1 } = fixture;

            // Borrow
            const borrowAmount = ethers.parseUnits("100", 6);
            const lambda = 1200;
            const mockAiProof = "0x" + "b".repeat(64);
            await loan.connect(user1).borrow(borrowAmount, lambda, mockAiProof);

            return fixture;
        }

        it("Should allow loan repayment", async function () {
            const { loan, usdc, user1 } = await setupUserWithLoan();

            const repayAmount = ethers.parseUnits("100", 6);

            // Approve USDC for repayment
            await usdc.connect(user1).approve(await loan.getAddress(), repayAmount);

            await expect(loan.connect(user1).repay(repayAmount))
                .to.emit(loan, "Repay")
                .withArgs(user1.address, repayAmount, await ethers.provider.getBlock('latest').then(b => b.timestamp + 1));

            // Check vault state
            const vault = await loan.getVault(user1.address);
            expect(vault[1]).to.equal(0); // debtAmount should be 0
        });

        it("Should revert when no debt to repay", async function () {
            const { loan, user1 } = await setupVerifiedUserWithCollateral();

            const repayAmount = ethers.parseUnits("100", 6);

            await expect(loan.connect(user1).repay(repayAmount))
                .to.be.revertedWith("No debt to repay");
        });
    });

    describe("Auto Repay (Fluence Agent)", function () {
        async function setupUserWithLoan() {
            const fixture = await setupVerifiedUserWithCollateral();
            const { loan, user1 } = fixture;

            // Borrow
            const borrowAmount = ethers.parseUnits("100", 6);
            const lambda = 1200;
            const mockAiProof = "0x" + "b".repeat(64);
            await loan.connect(user1).borrow(borrowAmount, lambda, mockAiProof);

            return fixture;
        }

        it("Should allow Fluence agent to trigger auto repay", async function () {
            const { loan, user1, fluenceAgent, mockPyth } = await setupUserWithLoan();

            // Mock price data for calculations
            await mockPyth.setPrice(ethers.parseUnits("0.00001", 8), -8); // $0.00001 SHIB price

            const newLambda = 800; // Lower lambda due to increased volatility

            await expect(loan.connect(fluenceAgent).autoRepay(user1.address, newLambda))
                .to.emit(loan, "AutoRepay");
        });

        it("Should revert when non-Fluence agent calls autoRepay", async function () {
            const { loan, user1, user2 } = await setupUserWithLoan();

            const newLambda = 800;

            await expect(loan.connect(user2).autoRepay(user1.address, newLambda))
                .to.be.revertedWith("Only Fluence agent");
        });
    });

    describe("View Functions", function () {
        it("Should return correct vault information", async function () {
            const { loan, user1 } = await setupVerifiedUserWithCollateral();

            const vault = await loan.getVault(user1.address);

            expect(vault[0]).to.be.gt(0); // collateralAmount
            expect(vault[1]).to.equal(0); // debtAmount (no loan yet)
            expect(vault[4]).to.equal(true); // zkVerified
        });

        it("Should calculate max borrow amount correctly", async function () {
            const { loan, user1, mockPyth } = await setupVerifiedUserWithCollateral();

            // Mock SHIB price and volatility
            await mockPyth.setPrice(ethers.parseUnits("0.00001", 8), -8);

            const maxBorrow = await loan.getMaxBorrowAmount(user1.address);
            expect(maxBorrow).to.be.gt(0);
        });
    });

    describe("Admin Functions", function () {
        it("Should allow owner to update configuration", async function () {
            const { loan, owner } = await loadFixture(deployLoanFixture);

            const newConfig = {
                minCollateralUSD: ethers.parseUnits("200", 6),
                maxLoanDuration: 60 * 24 * 60 * 60, // 60 days
                liquidationThreshold: 9000,
                interestRate: 1200,
                paused: false
            };

            await loan.connect(owner).setConfig(newConfig);

            const config = await loan.config();
            expect(config.minCollateralUSD).to.equal(newConfig.minCollateralUSD);
            expect(config.liquidationThreshold).to.equal(newConfig.liquidationThreshold);
        });

        it("Should allow owner to pause contract", async function () {
            const { loan, owner } = await loadFixture(deployLoanFixture);

            await loan.connect(owner).emergencyPause();

            const config = await loan.config();
            expect(config.paused).to.equal(true);
        });

        it("Should revert when non-owner calls admin functions", async function () {
            const { loan, user1 } = await loadFixture(deployLoanFixture);

            await expect(loan.connect(user1).emergencyPause())
                .to.be.revertedWithCustomError(loan, "OwnableUnauthorizedAccount");
        });
    });

    describe("Edge Cases", function () {
        it("Should handle maximum deposit amount", async function () {
            const { loan, shib, user1 } = await loadFixture(deployLoanFixture);

            const maxAmount = ethers.parseUnits("1000000000", 18); // 1B SHIB

            await shib.connect(user1).approve(await loan.getAddress(), maxAmount);
            await expect(loan.connect(user1).deposit(maxAmount)).to.not.be.reverted;
        });

        it("Should handle multiple deposits from same user", async function () {
            const { loan, shib, user1 } = await loadFixture(deployLoanFixture);

            const depositAmount = ethers.parseUnits("100000000", 18);

            // First deposit
            await shib.connect(user1).approve(await loan.getAddress(), depositAmount);
            await loan.connect(user1).deposit(depositAmount);

            // Second deposit
            await shib.connect(user1).approve(await loan.getAddress(), depositAmount);
            await loan.connect(user1).deposit(depositAmount);

            const vault = await loan.getVault(user1.address);
            expect(vault[0]).to.equal(depositAmount * 2n);
        });
    });
});

async function setupVerifiedUserWithCollateral() {
    const fixture = await loadFixture(deployLoanFixture);
    const { loan, shib, user1 } = fixture;

    // Verify identity
    const mockProof = "0x" + "a".repeat(128);
    const proofHash = ethers.keccak256(ethers.toUtf8Bytes("test-proof"));
    await loan.connect(user1).verifyZKIdentity(mockProof, proofHash);

    // Deposit collateral
    const depositAmount = ethers.parseUnits("100000000", 18); // 100M SHIB
    await shib.connect(user1).approve(await loan.getAddress(), depositAmount);
    await loan.connect(user1).deposit(depositAmount);

    return fixture;
}