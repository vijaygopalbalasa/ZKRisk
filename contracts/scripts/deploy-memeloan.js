const { ethers } = require("hardhat");

async function main() {
  console.log("🐕 Deploying MemeLoan contract for SHIB lending...");

  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();

  console.log("Deployer:", deployer.address);
  console.log("Network:", network.name, "Chain ID:", network.chainId);

  // Contract addresses from existing deployment
  const loanContractAddress = "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9";

  try {
    console.log("🚀 Deploying MemeLoan contract...");

    const MemeLoan = await ethers.getContractFactory("MemeLoan");
    const memeLoan = await MemeLoan.deploy(loanContractAddress);

    console.log("⏳ Waiting for deployment...");
    await memeLoan.waitForDeployment();

    const contractAddress = await memeLoan.getAddress();
    console.log("✅ MemeLoan deployed to:", contractAddress);

    // Get deployment transaction
    const deploymentTx = memeLoan.deploymentTransaction();
    console.log("📊 Deployment Transaction:", deploymentTx.hash);

    // Save deployment info
    const deploymentInfo = {
      contractName: "MemeLoan",
      contractAddress: contractAddress,
      deploymentTransaction: deploymentTx.hash,
      deployer: deployer.address,
      network: network.name,
      chainId: network.chainId.toString(),
      timestamp: new Date().toISOString(),
      constructorArgs: [
        loanContractAddress
      ]
    };

    // Write deployment info to file
    const fs = require("fs");
    const deploymentsDir = "./deployments";
    if (!fs.existsSync(deploymentsDir)) {
      fs.mkdirSync(deploymentsDir);
    }

    const deploymentFile = `${deploymentsDir}/memeloan-${network.chainId}.json`;
    fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
    console.log("📝 Deployment info saved to:", deploymentFile);

    console.log("\n🎉 MemeLoan Contract Deployment Complete!");
    console.log(`\n📋 Contract Details:`);
    console.log(`Address: ${contractAddress}`);
    console.log(`Transaction: ${deploymentTx.hash}`);
    console.log(`Explorer: https://amoy.polygonscan.com/address/${contractAddress}`);

    return {
      contractAddress,
      transactionHash: deploymentTx.hash,
      deploymentInfo
    };

  } catch (error) {
    console.error("❌ Deployment failed:", error);
    throw error;
  }
}

if (require.main === module) {
  main()
    .then((result) => {
      console.log("\n✅ MemeLoan deployment successful!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ MemeLoan deployment failed:", error);
      process.exit(1);
    });
}

module.exports = main;