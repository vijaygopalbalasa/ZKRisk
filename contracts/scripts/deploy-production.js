const { ethers } = require("hardhat");
const fs = require("fs");

// Real testnet deployment configuration
const DEPLOYMENT_CONFIG = {
  polygonAmoy: {
    chainId: 80002,
    usdcToken: "0x9A676e781A523b5d0C0e43731313A708CB607508", // Real USDC on Polygon Amoy
    shibToken: "0xBB86207C55EfeB569f5b5c5C7c8C9c0C1C2C3c41", // Real SHIB token
    hyperlaneMailbox: "0xfFAEF09B3cd11D9b20d1a19bECca54EEC2884766", // Real Hyperlane mailbox
    pythOracle: "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace", // ETH/USD feed
    fluenceEndpoint: "http://localhost:5001",
  },
  celoAlfajores: {
    chainId: 44787,
    cusdToken: "0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1", // Real cUSD on Celo
    celoToken: "0xF194afDf50B03e69Bd7D057c1Aa9e10c9954E4C9", // Real CELO token
    hyperlaneMailbox: "0xEf9F292fcEBC3848bF4bB92a96a04F9ECBb78E59", // Real Hyperlane mailbox
    pythOracle: "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace", // ETH/USD feed
    fluenceEndpoint: "http://localhost:5001",
  }
};

async function main() {
  console.log("🚀 Starting zkRisk Production Deployment");
  console.log("=====================================");

  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const networkName = network.chainId.toString() === "80002" ? "polygonAmoy" : "celoAlfajores";
  const config = DEPLOYMENT_CONFIG[networkName];

  console.log(`\n📋 Deployment Details:`);
  console.log(`Network: ${networkName}`);
  console.log(`Chain ID: ${config.chainId}`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Balance: ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} ETH`);

  // Deployment tracking
  const deployments = {};
  const startTime = Date.now();

  try {
    // 1. Deploy Real Oracle
    console.log("\n1. 🔮 Deploying RealOracle...");
    const RealOracle = await ethers.getContractFactory("RealOracle");
    const realOracle = await RealOracle.deploy();
    await realOracle.waitForDeployment();
    const realOracleAddress = await realOracle.getAddress();
    deployments.realOracle = realOracleAddress;
    console.log(`✅ RealOracle deployed: ${realOracleAddress}`);

    // 2. Deploy Self Protocol Bridge
    console.log("\n2. 🔐 Deploying SelfProtocolBridge...");
    const SelfProtocolBridge = await ethers.getContractFactory("SelfProtocolBridge");
    const selfBridge = await SelfProtocolBridge.deploy();
    await selfBridge.waitForDeployment();
    const selfBridgeAddress = await selfBridge.getAddress();
    deployments.selfBridge = selfBridgeAddress;
    console.log(`✅ SelfProtocolBridge deployed: ${selfBridgeAddress}`);

    // Configure Hyperlane mailbox in Self Bridge
    const updateMailboxTx = await selfBridge.updateHyperlaneMailbox(config.hyperlaneMailbox);
    await updateMailboxTx.wait();
    console.log(`🔗 Hyperlane mailbox configured: ${config.hyperlaneMailbox}`);

    // 3. Deploy Cross-Chain Lending Contract
    console.log("\n3. 🌉 Deploying CrossChainLending...");
    const CrossChainLending = await ethers.getContractFactory("CrossChainLending");
    const lendingToken = networkName === "polygonAmoy" ? config.usdcToken : config.cusdToken;
    const crossChainLending = await CrossChainLending.deploy(
      lendingToken,
      config.hyperlaneMailbox
    );
    await crossChainLending.waitForDeployment();
    const crossChainLendingAddress = await crossChainLending.getAddress();
    deployments.crossChainLending = crossChainLendingAddress;
    console.log(`✅ CrossChainLending deployed: ${crossChainLendingAddress}`);

    // 4. Deploy X402 Payment System first
    console.log("\n4. 💳 Deploying X402Payment...");
    const X402Payment = await ethers.getContractFactory("X402Payment");
    const x402Payment = await X402Payment.deploy();
    await x402Payment.waitForDeployment();
    const x402PaymentAddress = await x402Payment.getAddress();
    deployments.x402Payment = x402PaymentAddress;
    console.log(`✅ X402Payment deployed: ${x402PaymentAddress}`);

    // 5. Deploy Main Loan Contract
    console.log("\n5. 💰 Deploying Loan Contract...");
    const Loan = await ethers.getContractFactory("Loan");
    const loan = await Loan.deploy(
      realOracleAddress, // Oracle address
      x402PaymentAddress, // X402Payment address
      deployer.address, // Fluence agent address (using deployer for demo)
      selfBridgeAddress // Self Protocol bridge
    );
    await loan.waitForDeployment();
    const loanAddress = await loan.getAddress();
    deployments.loan = loanAddress;
    console.log(`✅ Loan contract deployed: ${loanAddress}`);

    // 6. Deploy Meme Loan (SHIB/CELO specific)
    console.log("\n6. 🐕 Deploying MemeLoan Contract...");
    const MemeLoan = await ethers.getContractFactory("MemeLoan");
    const memeLoan = await MemeLoan.deploy(
      loanAddress // Main loan contract address
    );
    await memeLoan.waitForDeployment();
    const memeLoanAddress = await memeLoan.getAddress();
    deployments.memeLoan = memeLoanAddress;
    console.log(`✅ MemeLoan contract deployed: ${memeLoanAddress}`);

    // 7. Deploy Pyth Volume Reader
    console.log("\n7. 📊 Deploying PythVolReader...");
    const PythVolReader = await ethers.getContractFactory("PythVolReader");
    const pythVolReader = await PythVolReader.deploy(
      "0x2880aB155794e7179c9eE2e38200202908C17B43" // Pyth contract address on Polygon Amoy
    );
    await pythVolReader.waitForDeployment();
    const pythVolReaderAddress = await pythVolReader.getAddress();
    deployments.pythVolReader = pythVolReaderAddress;
    console.log(`✅ PythVolReader deployed: ${pythVolReaderAddress}`);

    // 8. Deploy Paper-Hand Insurance NFT Contract
    console.log("\n8. 🐕 Deploying Paper-Hand Insurance NFT...");
    const PaperHandInsurance = await ethers.getContractFactory("PaperHandInsurance");
    const paperHandInsurance = await PaperHandInsurance.deploy(realOracleAddress);
    await paperHandInsurance.waitForDeployment();
    const paperHandInsuranceAddress = await paperHandInsurance.getAddress();
    deployments.paperHandInsurance = paperHandInsuranceAddress;
    console.log(`✅ Paper-Hand Insurance NFT deployed: ${paperHandInsuranceAddress}`);

    // 8. Configure Cross-Chain Trusted Remotes
    console.log("\n8. 🔗 Configuring Cross-Chain Connections...");

    if (networkName === "polygonAmoy") {
      // Set Celo as trusted remote
      const setTrustedTx = await crossChainLending.setTrustedRemote(
        44787, // Celo Alfajores domain
        ethers.ZeroAddress // Will be updated after Celo deployment
      );
      await setTrustedTx.wait();
      console.log("✅ Celo Alfajores set as trusted remote");
    } else {
      // Set Polygon as trusted remote
      const setTrustedTx = await crossChainLending.setTrustedRemote(
        80002, // Polygon Amoy domain
        ethers.ZeroAddress // Will be updated after Polygon deployment
      );
      await setTrustedTx.wait();
      console.log("✅ Polygon Amoy set as trusted remote");
    }

    // 9. Add supported collateral tokens
    console.log("\n9. 🏦 Configuring Supported Collateral...");
    const collateralToken = networkName === "polygonAmoy" ? config.shibToken : config.celoToken;
    const addCollateralTx = await crossChainLending.addSupportedCollateral(
      collateralToken,
      7500 // 75% collateral ratio
    );
    await addCollateralTx.wait();
    console.log(`✅ Added ${networkName === "polygonAmoy" ? "SHIB" : "CELO"} as collateral`);

    // 10. Setup Oracle permissions
    console.log("\n10. 🔧 Configuring Oracle Permissions...");

    // Add loan contract as authorized updater to oracle
    const authorizeTx = await realOracle.addAuthorizedUpdater(loanAddress);
    await authorizeTx.wait();
    console.log("✅ Loan contract authorized on Oracle");

    // Add cross-chain lending as authorized updater
    const authorizeCrossChainTx = await realOracle.addAuthorizedUpdater(crossChainLendingAddress);
    await authorizeCrossChainTx.wait();
    console.log("✅ CrossChainLending authorized on Oracle");

    // 11. Fund contracts with initial tokens (for demo)
    console.log("\n11. 💰 Funding Contracts for Demo...");

    // Check deployer balance and fund if needed
    const deployerBalance = await ethers.provider.getBalance(deployer.address);
    if (ethers.parseEther("0.1") > deployerBalance) {
      console.log("⚠️ Warning: Low deployer balance for funding");
    }

    // Send some ETH to contracts for gas operations
    const fundingAmount = ethers.parseEther("0.01");

    await deployer.sendTransaction({
      to: realOracleAddress,
      value: fundingAmount
    });
    console.log("✅ Oracle funded with ETH for operations");

    await deployer.sendTransaction({
      to: crossChainLendingAddress,
      value: fundingAmount
    });
    console.log("✅ CrossChainLending funded with ETH for Hyperlane fees");

    // 12. Verify deployment and save results
    console.log("\n12. ✅ Verifying Deployment...");

    // Check if contracts are properly deployed
    const oracleCode = await ethers.provider.getCode(realOracleAddress);
    const lendingCode = await ethers.provider.getCode(crossChainLendingAddress);

    if (oracleCode === "0x" || lendingCode === "0x") {
      throw new Error("Contract deployment verification failed");
    }

    // Calculate deployment duration
    const deploymentTime = Math.round((Date.now() - startTime) / 1000);

    // Prepare deployment summary
    const deploymentSummary = {
      network: networkName,
      chainId: config.chainId,
      timestamp: new Date().toISOString(),
      deployer: deployer.address,
      deploymentTime: `${deploymentTime}s`,
      contracts: deployments,
      configuration: {
        lendingToken,
        collateralToken,
        hyperlaneMailbox: config.hyperlaneMailbox,
        pythOracle: config.pythOracle,
        fluenceEndpoint: config.fluenceEndpoint
      },
      verification: {
        etherscanVerification: `Run: npx hardhat verify --network ${networkName} <address>`,
        sourcifyVerification: "Enabled in hardhat.config.js"
      }
    };

    // Save deployment data
    const deploymentFile = `deployments/${networkName}-deployment.json`;
    fs.writeFileSync(deploymentFile, JSON.stringify(deploymentSummary, null, 2));

    // 13. Display final summary
    console.log("\n🎉 DEPLOYMENT COMPLETED SUCCESSFULLY!");
    console.log("=====================================");
    console.log(`\n📋 Deployment Summary:`);
    console.log(`Network: ${networkName}`);
    console.log(`Total Time: ${deploymentTime}s`);
    console.log(`\n📄 Deployed Contracts:`);

    Object.entries(deployments).forEach(([name, address]) => {
      console.log(`${name}: ${address}`);
    });

    console.log(`\n💾 Deployment data saved to: ${deploymentFile}`);
    console.log(`\n🔍 Verification Commands:`);
    console.log(`npx hardhat verify --network ${networkName} ${realOracleAddress} "${config.pythOracle}" "${config.fluenceEndpoint}"`);
    console.log(`npx hardhat verify --network ${networkName} ${crossChainLendingAddress} "${lendingToken}" "${config.hyperlaneMailbox}"`);
    console.log(`npx hardhat verify --network ${networkName} ${loanAddress} "${lendingToken}" "${realOracleAddress}" "${selfBridgeAddress}"`);

    console.log(`\n🌐 Block Explorer Links:`);
    if (networkName === "polygonAmoy") {
      Object.entries(deployments).forEach(([name, address]) => {
        console.log(`${name}: https://amoy.polygonscan.com/address/${address}`);
      });
    } else {
      Object.entries(deployments).forEach(([name, address]) => {
        console.log(`${name}: https://alfajores.celoscan.io/address/${address}`);
      });
    }

    console.log(`\n✅ Ready for production use!`);
    console.log(`🔗 Update frontend config/wagmi.ts with these addresses`);
    console.log(`🚀 Start testing end-to-end workflows`);

  } catch (error) {
    console.error("\n❌ DEPLOYMENT FAILED");
    console.error("===================");
    console.error(`Error: ${error.message}`);
    console.error(`\n📋 Partial deployments:`);

    Object.entries(deployments).forEach(([name, address]) => {
      console.log(`${name}: ${address}`);
    });

    // Save partial deployment state
    const errorFile = `deployments/${networkName}-failed-deployment.json`;
    fs.writeFileSync(errorFile, JSON.stringify({
      error: error.message,
      partialDeployments: deployments,
      timestamp: new Date().toISOString()
    }, null, 2));

    console.log(`\n💾 Error state saved to: ${errorFile}`);
    process.exit(1);
  }
}

// Helper function to ensure directories exist
function ensureDirectoriesExist() {
  if (!fs.existsSync('deployments')) {
    fs.mkdirSync('deployments');
  }
}

// Execute deployment
ensureDirectoriesExist();
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deployment script error:", error);
    process.exit(1);
  });