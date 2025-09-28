const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
  console.log("🟣 POLYGON AMOY TESTNET DEPLOYMENT");
  console.log("===================================");

  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();

  // Validate we're on Polygon Amoy
  if (network.chainId !== 80002n) {
    throw new Error(`Wrong network! Expected Polygon Amoy (80002), got ${network.chainId}`);
  }

  console.log(`\n🔧 Deployment Configuration:`);
  console.log(`Network: Polygon Amoy Testnet (${network.chainId})`);
  console.log(`Deployer: ${deployer.address}`);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`POL Balance: ${ethers.formatEther(balance)} POL`);

  if (balance < ethers.parseEther("0.01")) {
    throw new Error("Insufficient POL for deployment. Need at least 0.01 POL");
  }

  try {
    // Existing contract addresses from your deployment
    const EXISTING_CONTRACTS = {
      RealOracle: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
      X402Payment: "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0",
      SelfProtocolBridge: "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9",
      Loan: "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9",
      MockSHIB: "0x22595C3725FEDc4e64748542B4C31C2A14a49963"
    };

    console.log(`\n📋 Using Existing Contracts:`);
    Object.entries(EXISTING_CONTRACTS).forEach(([name, address]) => {
      console.log(`  ${name}: ${address}`);
    });

    // Deploy MemeLoan contract with lower gas
    console.log("\n🐕 Deploying MemeLoan for SHIB Lending...");

    const MemeLoan = await ethers.getContractFactory("MemeLoan");

    // Deploy with gas optimization
    const memeLoan = await MemeLoan.deploy(
      EXISTING_CONTRACTS.Loan,
      {
        gasLimit: 800000, // Set explicit gas limit
        gasPrice: ethers.parseUnits("50", "gwei") // Lower gas price
      }
    );

    console.log("⏳ Waiting for deployment confirmation...");
    await memeLoan.waitForDeployment();

    const memeLoanAddress = await memeLoan.getAddress();
    const deploymentTx = memeLoan.deploymentTransaction();

    console.log("\n✅ DEPLOYMENT SUCCESSFUL!");
    console.log(`📄 MemeLoan Contract: ${memeLoanAddress}`);
    console.log(`🔗 Transaction: ${deploymentTx.hash}`);
    console.log(`⛽ Gas Used: ${deploymentTx.gasLimit?.toString() || 'Unknown'}`);

    // Create comprehensive deployment summary
    const deploymentSummary = {
      deployment_info: {
        network: "Polygon Amoy Testnet",
        network_id: "polygonAmoy",
        chain_id: 80002,
        deployer: deployer.address,
        timestamp: new Date().toISOString(),
        deployment_name: "zkRisk_SHIB_Lending_AmoyTestnet"
      },
      contracts: {
        // Existing contracts
        RealOracle: EXISTING_CONTRACTS.RealOracle,
        X402Payment: EXISTING_CONTRACTS.X402Payment,
        SelfProtocolBridge: EXISTING_CONTRACTS.SelfProtocolBridge,
        Loan: EXISTING_CONTRACTS.Loan,
        MockSHIB: EXISTING_CONTRACTS.MockSHIB,
        // Newly deployed
        MemeLoan: memeLoanAddress
      },
      contract_functions: {
        MemeLoan: {
          primary: [
            "deposit(uint256 amount)",
            "borrow(uint256 usdcAmount, uint256 lambda, uint256 minLambda, bytes aiProof)",
            "mintInsurance(string memeText, uint256 loanAmount)",
            "claimInsurance(uint256 tokenId)"
          ],
          view: [
            "insurances(uint256 tokenId)",
            "userInsurances(address user)",
            "SHIB()",
            "USDC()",
            "loanContract()"
          ]
        }
      },
      explorer_links: {
        MemeLoan: `https://amoy.polygonscan.com/address/${memeLoanAddress}`,
        Transaction: `https://amoy.polygonscan.com/tx/${deploymentTx.hash}`,
        SHIB_Token: `https://amoy.polygonscan.com/address/${EXISTING_CONTRACTS.MockSHIB}`,
        Loan_Contract: `https://amoy.polygonscan.com/address/${EXISTING_CONTRACTS.Loan}`
      },
      frontend_config: {
        network_name: "polygonAmoy",
        memeLoan_address: memeLoanAddress,
        shib_address: EXISTING_CONTRACTS.MockSHIB,
        loan_address: EXISTING_CONTRACTS.Loan
      },
      verification_command: `npx hardhat verify --network polygonAmoy ${memeLoanAddress} ${EXISTING_CONTRACTS.Loan}`,
      gas_info: {
        deployment_cost: deploymentTx.gasLimit?.toString() || 'Unknown',
        gas_price_gwei: "50",
        estimated_cost_pol: "~0.04 POL"
      }
    };

    // Save deployment summary
    const outputFile = "./deployments/polygon-amoy-memeloan-deployment.json";
    fs.writeFileSync(outputFile, JSON.stringify(deploymentSummary, null, 2));
    console.log(`\n📝 Deployment summary saved: ${outputFile}`);

    // Also update the main config file
    const mainConfigFile = "./deployments/latest-polygonAmoy.json";
    if (fs.existsSync(mainConfigFile)) {
      const mainConfig = JSON.parse(fs.readFileSync(mainConfigFile, 'utf8'));
      mainConfig.contracts.MemeLoan = memeLoanAddress;
      mainConfig.timestamp = new Date().toISOString();
      fs.writeFileSync(mainConfigFile, JSON.stringify(mainConfig, null, 2));
      console.log(`📝 Updated main config: ${mainConfigFile}`);
    }

    console.log("\n🎉 POLYGON AMOY DEPLOYMENT COMPLETE!");
    console.log("=====================================");
    console.log(`🔗 View on Explorer: https://amoy.polygonscan.com/address/${memeLoanAddress}`);
    console.log(`💰 SHIB Tokens Available: 101B SHIB at ${EXISTING_CONTRACTS.MockSHIB}`);
    console.log(`🚀 Frontend URL: http://localhost:3001`);

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
      console.log("\n✅ Polygon Amoy deployment completed successfully!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n❌ Polygon Amoy deployment failed:", error.message);
      process.exit(1);
    });
}

module.exports = main;