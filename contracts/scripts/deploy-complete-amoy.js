const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
  console.log("🟣 COMPLETE POLYGON AMOY TESTNET DEPLOYMENT");
  console.log("===========================================");

  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();

  // Validate we're on Polygon Amoy
  if (network.chainId !== 80002n) {
    throw new Error(`Wrong network! Expected Polygon Amoy (80002), got ${network.chainId}`);
  }

  console.log(`\n🔧 Deployment Configuration:`);
  console.log(`Network: Polygon Amoy Testnet`);
  console.log(`Chain ID: ${network.chainId}`);
  console.log(`Deployer: ${deployer.address}`);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`POL Balance: ${ethers.formatEther(balance)} POL`);

  if (balance < ethers.parseEther("0.05")) {
    throw new Error("Insufficient POL for deployment. Need at least 0.05 POL");
  }

  const deployedContracts = {};

  try {
    // Use existing contracts where possible
    deployedContracts.RealOracle = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
    deployedContracts.X402Payment = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";
    deployedContracts.SelfProtocolBridge = "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9";
    deployedContracts.MockSHIB = "0x22595C3725FEDc4e64748542B4C31C2A14a49963";

    console.log(`\n📋 Using Existing Infrastructure:`);
    console.log(`  RealOracle: ${deployedContracts.RealOracle}`);
    console.log(`  X402Payment: ${deployedContracts.X402Payment}`);
    console.log(`  SelfProtocolBridge: ${deployedContracts.SelfProtocolBridge}`);
    console.log(`  MockSHIB: ${deployedContracts.MockSHIB}`);

    // Deploy new Loan contract with correct SHIB address
    console.log("\n🏦 Deploying Loan Contract (with correct SHIB address)...");

    const Loan = await ethers.getContractFactory("Loan");
    const loanContract = await Loan.deploy(
      deployedContracts.RealOracle,
      deployedContracts.X402Payment,
      "0x742d35CC6e64b2c5C8E4f1234567890123456789", // Fluence agent placeholder
      deployedContracts.SelfProtocolBridge,
      {
        gasLimit: 1200000,
        gasPrice: ethers.parseUnits("40", "gwei")
      }
    );

    console.log("⏳ Waiting for Loan deployment...");
    await loanContract.waitForDeployment();

    deployedContracts.Loan = await loanContract.getAddress();
    console.log(`✅ Loan deployed: ${deployedContracts.Loan}`);

    // Deploy MemeLoan contract
    console.log("\n🐕 Deploying MemeLoan Contract...");

    const MemeLoan = await ethers.getContractFactory("MemeLoan");
    const memeLoanContract = await MemeLoan.deploy(
      deployedContracts.Loan,
      {
        gasLimit: 1500000,
        gasPrice: ethers.parseUnits("40", "gwei")
      }
    );

    console.log("⏳ Waiting for MemeLoan deployment...");
    await memeLoanContract.waitForDeployment();

    deployedContracts.MemeLoan = await memeLoanContract.getAddress();
    console.log(`✅ MemeLoan deployed: ${deployedContracts.MemeLoan}`);

    // Create comprehensive deployment summary
    const deploymentSummary = {
      deployment_info: {
        name: "zkRisk_SHIB_Lending_Polygon_Amoy_Complete",
        network: "Polygon Amoy Testnet",
        network_id: "polygonAmoy",
        chain_id: 80002,
        deployer: deployer.address,
        timestamp: new Date().toISOString(),
        description: "Complete SHIB lending deployment with Paper-Hand Insurance NFTs"
      },
      contracts: deployedContracts,
      token_addresses: {
        SHIB: deployedContracts.MockSHIB,
        USDC: "0x9A676e781A523b5d0C0e43731313A708CB607508"
      },
      primary_functionality: {
        deposit: `${deployedContracts.MemeLoan}.deposit(uint256 amount)`,
        borrow: `${deployedContracts.MemeLoan}.borrow(uint256 usdcAmount, uint256 lambda, uint256 minLambda, bytes aiProof)`,
        mint_insurance: `${deployedContracts.MemeLoan}.mintInsurance(string memeText, uint256 loanAmount)`,
        claim_insurance: `${deployedContracts.MemeLoan}.claimInsurance(uint256 tokenId)`
      },
      explorer_links: {
        Loan: `https://amoy.polygonscan.com/address/${deployedContracts.Loan}`,
        MemeLoan: `https://amoy.polygonscan.com/address/${deployedContracts.MemeLoan}`,
        SHIB_Token: `https://amoy.polygonscan.com/address/${deployedContracts.MockSHIB}`
      },
      frontend_config: {
        network: "polygonAmoy",
        memeLoan: deployedContracts.MemeLoan,
        loan: deployedContracts.Loan,
        mockSHIB: deployedContracts.MockSHIB,
        realOracle: deployedContracts.RealOracle,
        selfBridge: deployedContracts.SelfProtocolBridge,
        x402Payment: deployedContracts.X402Payment
      },
      test_info: {
        shib_tokens_available: "101,000,000,000 SHIB",
        test_wallet: deployer.address,
        frontend_url: "http://localhost:3001"
      }
    };

    // Save deployment summary
    const outputFile = "./deployments/polygon-amoy-complete-deployment.json";
    fs.writeFileSync(outputFile, JSON.stringify(deploymentSummary, null, 2));
    console.log(`\n📝 Complete deployment summary: ${outputFile}`);

    // Update main config
    const mainConfigFile = "./deployments/latest-polygonAmoy.json";
    const mainConfig = {
      network: "polygonAmoy",
      chainId: 80002,
      timestamp: new Date().toISOString(),
      deployer: deployer.address,
      contracts: deployedContracts,
      realAddresses: {
        USDC: "0x9A676e781A523b5d0C0e43731313A708CB607508",
        FLUENCE_AGENT: "0x742d35CC6e64b2c5C8E4f1234567890123456789",
        HYPERLANE_MAILBOX: "0xfFAEF09B3cd11D9b20d1a19bECca54EEC2884766",
        SELF_VERIFIER_CELO: deployedContracts.RealOracle
      }
    };

    fs.writeFileSync(mainConfigFile, JSON.stringify(mainConfig, null, 2));
    console.log(`📝 Updated main config: ${mainConfigFile}`);

    console.log("\n🎉 POLYGON AMOY COMPLETE DEPLOYMENT SUCCESS!");
    console.log("===============================================");
    console.log(`🏦 Loan Contract: ${deployedContracts.Loan}`);
    console.log(`🐕 MemeLoan Contract: ${deployedContracts.MemeLoan}`);
    console.log(`💰 SHIB Token: ${deployedContracts.MockSHIB}`);
    console.log(`🚀 Frontend: http://localhost:3001`);
    console.log(`🔗 Explorer: https://amoy.polygonscan.com/address/${deployedContracts.MemeLoan}`);

    return deploymentSummary;

  } catch (error) {
    console.error("\n❌ DEPLOYMENT FAILED!");
    console.error("Error:", error.message);
    throw error;
  }
}

if (require.main === module) {
  main()
    .then((result) => {
      console.log("\n✅ Polygon Amoy complete deployment finished!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n❌ Polygon Amoy deployment failed:", error.message);
      process.exit(1);
    });
}

module.exports = main;