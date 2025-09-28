const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("🚀 zkRisk End-to-End Integration Tests", function () {
  let deployer, user1, user2;
  let contracts = {};
  let deploymentConfig;

  // Test parameters
  const COLLATERAL_AMOUNT = ethers.parseUnits("1000", 6); // 1000 USDC
  const BORROW_AMOUNT = ethers.parseUnits("800", 6); // 800 USDC
  const LAMBDA = 800; // 0.8x risk multiplier
  const MIN_LAMBDA = 760; // 5% slippage tolerance

  before(async function () {
    console.log("🧪 Setting up E2E Integration Tests...");

    [deployer, user1, user2] = await ethers.getSigners();

    // Configuration for local testing
    deploymentConfig = {
      usdcToken: "0x9A676e781A523b5d0C0e43731313A708CB607508", // Mock for testing
      hyperlaneMailbox: "0xfFAEF09B3cd11D9b20d1a19bECca54EEC2884766",
      pythOracle: "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
      fluenceEndpoint: "http://localhost:5001"
    };

    console.log("📋 Deploying contracts for integration tests...");
    await deployContracts();
    await setupContractPermissions();
    await fundTestAccounts();

    console.log("✅ E2E test setup complete");
  });

  async function deployContracts() {
    // 1. Deploy RealOracle
    const RealOracle = await ethers.getContractFactory("RealOracle");
    contracts.realOracle = await RealOracle.deploy();
    await contracts.realOracle.waitForDeployment();
    console.log(`🔮 RealOracle deployed: ${await contracts.realOracle.getAddress()}`);

    // 2. Deploy SelfProtocolBridge
    const SelfProtocolBridge = await ethers.getContractFactory("SelfProtocolBridge");
    contracts.selfBridge = await SelfProtocolBridge.deploy();
    await contracts.selfBridge.waitForDeployment();
    console.log(`🛡️ SelfBridge deployed: ${await contracts.selfBridge.getAddress()}`);

    // 3. Deploy X402Payment
    const X402Payment = await ethers.getContractFactory("X402Payment");
    contracts.x402Payment = await X402Payment.deploy();
    await contracts.x402Payment.waitForDeployment();
    console.log(`💳 X402Payment deployed: ${await contracts.x402Payment.getAddress()}`);

    // 4. Deploy CrossChainLending
    const CrossChainLending = await ethers.getContractFactory("CrossChainLending");
    contracts.crossChainLending = await CrossChainLending.deploy(
      deploymentConfig.usdcToken,
      deploymentConfig.hyperlaneMailbox
    );
    await contracts.crossChainLending.waitForDeployment();
    console.log(`🌉 CrossChainLending deployed: ${await contracts.crossChainLending.getAddress()}`);

    // 5. Deploy Main Loan Contract
    const Loan = await ethers.getContractFactory("Loan");
    contracts.loan = await Loan.deploy(
      await contracts.realOracle.getAddress(),
      await contracts.x402Payment.getAddress(),
      deployer.address, // Fluence agent
      await contracts.selfBridge.getAddress()
    );
    await contracts.loan.waitForDeployment();
    console.log(`💰 Loan deployed: ${await contracts.loan.getAddress()}`);

    // 6. Deploy MemeLoan
    const MemeLoan = await ethers.getContractFactory("MemeLoan");
    contracts.memeLoan = await MemeLoan.deploy(await contracts.loan.getAddress());
    await contracts.memeLoan.waitForDeployment();
    console.log(`🐕 MemeLoan deployed: ${await contracts.memeLoan.getAddress()}`);

    // 7. Deploy PythVolReader
    const PythVolReader = await ethers.getContractFactory("PythVolReader");
    contracts.pythVolReader = await PythVolReader.deploy(
      "0x2880aB155794e7179c9eE2e38200202908C17B43" // Mock Pyth address
    );
    await contracts.pythVolReader.waitForDeployment();
    console.log(`📊 PythVolReader deployed: ${await contracts.pythVolReader.getAddress()}`);
  }

  async function setupContractPermissions() {
    console.log("🔧 Setting up contract permissions...");

    // Configure Hyperlane mailbox in Self Bridge
    await contracts.selfBridge.updateHyperlaneMailbox(deploymentConfig.hyperlaneMailbox);

    // Authorize loan contract on oracle
    await contracts.realOracle.addAuthorizedUpdater(await contracts.loan.getAddress());

    // Initialize default prices in oracle
    const USDC_USD_FEED = ethers.keccak256(ethers.toUtf8Bytes("USDC/USD"));
    const SHIB_USD_FEED = ethers.keccak256(ethers.toUtf8Bytes("SHIB/USD"));

    await contracts.realOracle.updatePrice(USDC_USD_FEED, ethers.parseUnits("1", 8), 9900);
    await contracts.realOracle.updatePrice(SHIB_USD_FEED, ethers.parseUnits("0.00001", 8), 9800);

    console.log("✅ Contract permissions configured");
  }

  async function fundTestAccounts() {
    console.log("💰 Funding test accounts...");

    // Send ETH to test accounts for gas
    const fundingAmount = ethers.parseEther("1.0");
    await deployer.sendTransaction({ to: user1.address, value: fundingAmount });
    await deployer.sendTransaction({ to: user2.address, value: fundingAmount });

    console.log("✅ Test accounts funded");
  }

  describe("🧪 Complete End-to-End Workflow", function () {
    it("Should complete full lending workflow with ZK verification", async function () {
      console.log("\n🚀 Starting complete E2E lending workflow...");

      // Step 1: ZK Identity Verification
      console.log("Step 1: 🛡️ ZK Identity Verification");
      const challengeHash = ethers.keccak256(ethers.toUtf8Bytes(`challenge-${Date.now()}`));

      const requestTx = await contracts.selfBridge.connect(user1).requestVerification(challengeHash);
      const requestReceipt = await requestTx.wait();
      const requestId = requestReceipt.hash;

      // Submit proof (simplified for testing)
      const proofHash = ethers.keccak256(ethers.toUtf8Bytes(`proof-${user1.address}`));
      const mockProof = ethers.toUtf8Bytes("mock-zk-proof");

      await contracts.selfBridge.connect(user1).submitProof(
        requestId,
        proofHash,
        mockProof,
        "0x" // Mock Hyperlane signature
      );

      // Verify user is now ZK verified
      const [isVerified] = await contracts.selfBridge.isUserVerified(user1.address);
      expect(isVerified).to.be.true;
      console.log("   ✅ ZK verification complete");

      // Step 2: Deposit Collateral
      console.log("Step 2: 💰 Deposit Collateral");

      // First check vault before deposit
      const vaultBefore = await contracts.loan.getVault(user1.address);
      expect(vaultBefore[0]).to.equal(0); // No collateral initially

      await contracts.loan.connect(user1).deposit(COLLATERAL_AMOUNT);

      const vaultAfterDeposit = await contracts.loan.getVault(user1.address);
      expect(vaultAfterDeposit[0]).to.equal(COLLATERAL_AMOUNT);
      console.log("   ✅ Collateral deposited successfully");

      // Step 3: AI Risk Assessment & Borrow
      console.log("Step 3: 🤖 AI Risk Assessment & Borrow");

      // Mock AI payment proof
      const aiProof = ethers.keccak256(ethers.toUtf8Bytes(`ai-payment-${Date.now()}`));

      await contracts.loan.connect(user1).borrow(
        BORROW_AMOUNT,
        LAMBDA,
        MIN_LAMBDA,
        aiProof
      );

      const vaultAfterBorrow = await contracts.loan.getVault(user1.address);
      expect(vaultAfterBorrow[1]).to.equal(BORROW_AMOUNT);
      expect(vaultAfterBorrow[2]).to.equal(LAMBDA);
      console.log("   ✅ Borrow executed with AI risk assessment");

      // Step 4: Verify complete vault state
      console.log("Step 4: 📊 Verify Complete State");
      const finalVault = await contracts.loan.getVault(user1.address);

      expect(finalVault[0]).to.equal(COLLATERAL_AMOUNT); // Collateral
      expect(finalVault[1]).to.equal(BORROW_AMOUNT); // Debt
      expect(finalVault[2]).to.equal(LAMBDA); // Last lambda
      expect(finalVault[4]).to.be.true; // ZK verified

      console.log("   ✅ Complete lending workflow verified");
      console.log(`   📋 Final state - Collateral: ${ethers.formatUnits(finalVault[0], 6)} USDC`);
      console.log(`   📋 Final state - Debt: ${ethers.formatUnits(finalVault[1], 6)} USDC`);
      console.log(`   📋 Final state - Lambda: ${finalVault[2] / 1000}x`);
    });

    it("Should handle cross-chain lending request", async function () {
      console.log("\n🌉 Testing Cross-Chain Lending...");

      const amount = ethers.parseUnits("500", 6);
      const duration = 30;
      const lambdaRisk = 750;
      const collateralHash = ethers.keccak256(ethers.toUtf8Bytes("500USDC"));
      const verificationProof = ethers.keccak256(ethers.toUtf8Bytes(`proof-${user2.address}`));
      const targetChain = 44787; // Celo

      const requestTx = await contracts.crossChainLending.connect(user2).createCrossChainRequest(
        amount,
        duration,
        lambdaRisk,
        collateralHash,
        verificationProof,
        targetChain
      );

      const receipt = await requestTx.wait();
      expect(receipt.status).to.equal(1);

      console.log("   ✅ Cross-chain request created successfully");
    });

    it("Should create SHIB meme loan with NFT insurance", async function () {
      console.log("\n🐕 Testing SHIB Meme Loan...");

      const shibAmount = ethers.parseUnits("1000000", 18); // 1M SHIB
      const duration = 30;
      const dogMeme = "Diamond Hands SHIB 💎🐕";

      const loanId = 1; // Simplified for testing

      const createTx = await contracts.memeLoan.connect(user1).createPaperHandInsurance(
        loanId,
        shibAmount,
        duration,
        dogMeme
      );

      const receipt = await createTx.wait();
      expect(receipt.status).to.equal(1);

      // Verify NFT was minted
      const tokenId = 1;
      const insurance = await contracts.memeLoan.getInsurance(tokenId);

      expect(insurance[0]).to.equal(loanId);
      expect(insurance[1]).to.equal(shibAmount);
      expect(insurance[6]).to.equal(dogMeme);

      console.log("   ✅ SHIB meme loan with NFT insurance created");
    });

    it("Should handle loan repayment", async function () {
      console.log("\n💰 Testing Loan Repayment...");

      const repayAmount = BORROW_AMOUNT; // Full repayment

      await contracts.loan.connect(user1).repay(repayAmount);

      const vaultAfterRepay = await contracts.loan.getVault(user1.address);
      expect(vaultAfterRepay[1]).to.equal(0); // Debt should be 0

      console.log("   ✅ Loan repaid successfully");
    });

    it("Should handle collateral withdrawal", async function () {
      console.log("\n🏦 Testing Collateral Withdrawal...");

      const withdrawAmount = COLLATERAL_AMOUNT;

      await contracts.loan.connect(user1).withdraw(withdrawAmount);

      const vaultAfterWithdraw = await contracts.loan.getVault(user1.address);
      expect(vaultAfterWithdraw[0]).to.equal(0); // Collateral should be 0

      console.log("   ✅ Collateral withdrawn successfully");
    });
  });

  describe("🔧 Oracle Integration Tests", function () {
    it("Should provide accurate price feeds", async function () {
      console.log("\n📊 Testing Oracle Price Feeds...");

      const USDC_USD_FEED = ethers.keccak256(ethers.toUtf8Bytes("USDC/USD"));

      const [price, confidence, isStale] = await contracts.realOracle.getPrice(USDC_USD_FEED);

      expect(price).to.be.gt(0);
      expect(confidence).to.be.gte(9000);
      expect(isStale).to.be.false;

      console.log(`   ✅ USDC price: $${ethers.formatUnits(price, 8)}`);
      console.log(`   ✅ Confidence: ${confidence / 100}%`);
    });

    it("Should calculate risk multipliers correctly", async function () {
      console.log("\n🎯 Testing Risk Multiplier Calculation...");

      const USDC_USD_FEED = ethers.keccak256(ethers.toUtf8Bytes("USDC/USD"));

      const riskMultiplier = await contracts.realOracle.getRiskMultiplier(USDC_USD_FEED);

      expect(riskMultiplier).to.be.gte(300); // Minimum 0.3x
      expect(riskMultiplier).to.be.lte(1800); // Maximum 1.8x

      console.log(`   ✅ Risk multiplier: ${riskMultiplier / 1000}x`);
    });
  });

  describe("🛡️ Security & Access Control", function () {
    it("Should enforce ZK verification requirement", async function () {
      console.log("\n🔒 Testing ZK Verification Enforcement...");

      // Try to borrow without ZK verification (using user2 who isn't verified)
      const aiProof = ethers.keccak256(ethers.toUtf8Bytes("ai-proof"));

      await expect(
        contracts.loan.connect(user2).borrow(BORROW_AMOUNT, LAMBDA, MIN_LAMBDA, aiProof)
      ).to.be.revertedWith("ZK verification required");

      console.log("   ✅ ZK verification properly enforced");
    });

    it("Should enforce proper access controls", async function () {
      console.log("\n🔐 Testing Access Controls...");

      // Try to update oracle price from unauthorized account
      const USDC_USD_FEED = ethers.keccak256(ethers.toUtf8Bytes("USDC/USD"));

      await expect(
        contracts.realOracle.connect(user1).updatePrice(USDC_USD_FEED, ethers.parseUnits("1.01", 8), 9900)
      ).to.be.revertedWith("Not authorized");

      console.log("   ✅ Access controls properly enforced");
    });
  });

  describe("📊 Performance & Gas Optimization", function () {
    it("Should execute transactions within gas limits", async function () {
      console.log("\n⛽ Testing Gas Usage...");

      // Test gas usage for deposit
      const depositTx = await contracts.loan.connect(user1).deposit.estimateGas(COLLATERAL_AMOUNT);
      expect(depositTx).to.be.lt(200000); // Should be under 200k gas

      console.log(`   ✅ Deposit gas usage: ${depositTx} gas`);

      // Test gas usage for borrow
      const aiProof = ethers.keccak256(ethers.toUtf8Bytes("ai-proof"));
      const borrowTx = await contracts.loan.connect(user1).borrow.estimateGas(
        BORROW_AMOUNT, LAMBDA, MIN_LAMBDA, aiProof
      );
      expect(borrowTx).to.be.lt(400000); // Should be under 400k gas

      console.log(`   ✅ Borrow gas usage: ${borrowTx} gas`);
    });
  });

  after(async function () {
    console.log("\n🧹 Cleaning up integration tests...");
    console.log("✅ Integration test suite completed successfully");
  });
});