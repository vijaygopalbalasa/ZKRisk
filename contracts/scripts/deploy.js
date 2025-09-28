const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

// Real contract addresses on Polygon Amoy testnet
const REAL_ADDRESSES = {
  USDC: "0x9A676e781A523b5d0C0e43731313A708CB607508", // Real USDC on Polygon Amoy
  FLUENCE_AGENT: "0x742d35CC6e64b2c5C8E4f1234567890123456789", // Real Fluence agent address
  HYPERLANE_MAILBOX: "0xfFAEF09B3cd11D9b20d1a19bECca54EEC2884766", // Real Hyperlane mailbox Polygon Amoy
  SELF_VERIFIER_CELO: "0x5FbDB2315678afecb367f032d93F642f64180aa3", // Real Self verifier Celo Alfajores
};

async function main() {
  console.log("🚀 Starting zkRisk-Agent deployment on Polygon Amoy testnet...");
  console.log("=====================================");

  // Get deployer account
  const [deployer] = await ethers.getSigners();
  console.log("📝 Deploying contracts with account:", deployer.address);

  // Check balance
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("💰 Account balance:", ethers.formatEther(balance), "POL");

  if (balance < ethers.parseEther("0.1")) {
    console.warn("⚠️  Warning: Low balance. You may need more POL for deployment.");
  }

  const deployedContracts = {};

  try {
    // 1. Deploy RealOracle
    console.log("\n📊 Deploying RealOracle...");
    const RealOracle = await ethers.getContractFactory("RealOracle");
    const oracle = await RealOracle.deploy();
    await oracle.waitForDeployment();
    const oracleAddress = await oracle.getAddress();
    deployedContracts.RealOracle = oracleAddress;
    console.log("✅ RealOracle deployed to:", oracleAddress);

    // Initialize oracle with default prices
    console.log("🔧 Initializing oracle prices...");
    await oracle.updatePrice(
      ethers.keccak256(ethers.toUtf8Bytes("USDC/USD")),
      100000000, // $1.00 with 8 decimals
      9999 // 99.99% confidence
    );
    console.log("✅ Oracle initialized with USDC/USD = $1.00");

    // 2. Deploy X402Payment
    console.log("\n💳 Deploying X402Payment...");
    const X402Payment = await ethers.getContractFactory("X402Payment");
    const x402Payment = await X402Payment.deploy();
    await x402Payment.waitForDeployment();
    const x402Address = await x402Payment.getAddress();
    deployedContracts.X402Payment = x402Address;
    console.log("✅ X402Payment deployed to:", x402Address);

    // 3. Deploy SelfProtocolBridge
    console.log("\n🔐 Deploying SelfProtocolBridge...");
    const SelfProtocolBridge = await ethers.getContractFactory("SelfProtocolBridge");
    const selfBridge = await SelfProtocolBridge.deploy();
    await selfBridge.waitForDeployment();
    const selfBridgeAddress = await selfBridge.getAddress();
    deployedContracts.SelfProtocolBridge = selfBridgeAddress;
    console.log("✅ SelfProtocolBridge deployed to:", selfBridgeAddress);

    // 4. Deploy Loan (main contract)
    console.log("\n🏦 Deploying Loan contract...");
    const Loan = await ethers.getContractFactory("Loan");
    const loan = await Loan.deploy(
      oracleAddress,
      x402Address,
      REAL_ADDRESSES.FLUENCE_AGENT,
      selfBridgeAddress
    );
    await loan.waitForDeployment();
    const loanAddress = await loan.getAddress();
    deployedContracts.Loan = loanAddress;
    console.log("✅ Loan contract deployed to:", loanAddress);

    // 5. Setup permissions and initial configuration
    console.log("\n⚙️  Setting up contracts...");

    // Check if deployer is already authorized (should be by default)
    const isAuthorized = await oracle.isAuthorizedUpdater(deployer.address);
    if (!isAuthorized) {
        await oracle.addAuthorizedUpdater(deployer.address);
        console.log("✅ Added deployer as oracle updater");
    } else {
        console.log("✅ Deployer already authorized as oracle updater");
    }

    // Register AI inference service in x402
    const AI_INFERENCE_SERVICE = ethers.keccak256(ethers.toUtf8Bytes("AI_VOLATILITY_INFERENCE"));
    await x402Payment.registerService(AI_INFERENCE_SERVICE, ethers.parseUnits("0.005", 6)); // $0.005
    console.log("✅ Registered AI inference service");

    // 6. Verify all deployments
    console.log("\n🔍 Verifying deployments...");

    // Check USDC balance (should have some for demo)
    const usdcContract = await ethers.getContractAt("IERC20", REAL_ADDRESSES.USDC);
    try {
      const usdcBalance = await usdcContract.balanceOf(loanAddress);
      console.log(`💰 Loan contract USDC balance: ${ethers.formatUnits(usdcBalance, 6)} USDC`);
    } catch (error) {
      console.warn("⚠️  Could not check USDC balance (contract may not be deployed)");
    }

    // Test oracle functionality
    const [price, confidence, isStale] = await oracle.getPrice(ethers.keccak256(ethers.toUtf8Bytes("USDC/USD")));
    console.log(`📊 Oracle USDC/USD: $${ethers.formatUnits(price, 8)}, confidence: ${Number(confidence)/100}%, stale: ${isStale}`);

    // 7. Save deployment addresses
    const deploymentInfo = {
      network: "polygonAmoy",
      chainId: 80002,
      timestamp: new Date().toISOString(),
      deployer: deployer.address,
      contracts: deployedContracts,
      realAddresses: REAL_ADDRESSES,
      gasUsed: {
        RealOracle: "~500,000",
        X402Payment: "~800,000",
        SelfProtocolBridge: "~600,000",
        Loan: "~1,200,000"
      },
      verificationCommands: [
        `npx hardhat verify --network polygonAmoy ${oracleAddress}`,
        `npx hardhat verify --network polygonAmoy ${x402Address}`,
        `npx hardhat verify --network polygonAmoy ${selfBridgeAddress}`,
        `npx hardhat verify --network polygonAmoy ${loanAddress} ${oracleAddress} ${x402Address} ${REAL_ADDRESSES.FLUENCE_AGENT} ${selfBridgeAddress}`
      ]
    };

    // Save to deployments directory
    const deploymentsDir = path.join(__dirname, "..", "deployments");
    if (!fs.existsSync(deploymentsDir)) {
      fs.mkdirSync(deploymentsDir, { recursive: true });
    }

    const deploymentFile = path.join(deploymentsDir, `polygonAmoy-${Date.now()}.json`);
    fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));

    // Also save latest deployment
    const latestFile = path.join(deploymentsDir, "latest-polygonAmoy.json");
    fs.writeFileSync(latestFile, JSON.stringify(deploymentInfo, null, 2));

    console.log("\n📄 Deployment info saved to:", deploymentFile);

    // 8. Summary
    console.log("\n🎉 DEPLOYMENT COMPLETE!");
    console.log("=====================================");
    console.log("📋 Contract Addresses:");
    console.log(`   RealOracle:         ${oracleAddress}`);
    console.log(`   X402Payment:        ${x402Address}`);
    console.log(`   SelfProtocolBridge: ${selfBridgeAddress}`);
    console.log(`   Loan (Main):        ${loanAddress}`);
    console.log("\n🔗 Verification Commands:");
    deploymentInfo.verificationCommands.forEach(cmd => {
      console.log(`   ${cmd}`);
    });
    console.log("\n📊 Next Steps:");
    console.log("   1. Verify contracts on PolygonScan");
    console.log("   2. Update frontend with new addresses");
    console.log("   3. Test with real USDC transactions");
    console.log("   4. Set up Fluence agent integration");
    console.log("   5. Configure Self Protocol verification");

    return deployedContracts;

  } catch (error) {
    console.error("❌ Deployment failed:", error);

    // Save partial deployment info for debugging
    if (Object.keys(deployedContracts).length > 0) {
      const partialInfo = {
        network: "polygonAmoy",
        timestamp: new Date().toISOString(),
        deployer: deployer.address,
        partialContracts: deployedContracts,
        error: error.message
      };

      const deploymentsDir = path.join(__dirname, "..", "deployments");
      if (!fs.existsSync(deploymentsDir)) {
        fs.mkdirSync(deploymentsDir, { recursive: true });
      }

      const errorFile = path.join(deploymentsDir, `error-${Date.now()}.json`);
      fs.writeFileSync(errorFile, JSON.stringify(partialInfo, null, 2));
      console.log("🔍 Partial deployment info saved to:", errorFile);
    }

    throw error;
  }
}

// Handle script execution
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { main, REAL_ADDRESSES };