const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
  console.log("🛡️ Deploying Self Protocol Verification Contract");
  console.log("==============================================");

  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();

  console.log(`\n📋 Deployment Details:`);
  console.log(`Network: ${network.name} (Chain ID: ${network.chainId})`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Balance: ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} ETH`);

  try {
    // Deploy Self Protocol Bridge
    console.log("\n🚀 Deploying SelfProtocolBridge contract...");
    const SelfProtocolBridge = await ethers.getContractFactory("SelfProtocolBridge");
    const selfProtocolBridge = await SelfProtocolBridge.deploy();

    console.log("⏳ Waiting for deployment...");
    await selfProtocolBridge.waitForDeployment();

    const contractAddress = await selfProtocolBridge.getAddress();
    console.log(`✅ SelfProtocolBridge deployed to: ${contractAddress}`);

    // Get deployment transaction
    const deploymentTx = selfProtocolBridge.deploymentTransaction();
    console.log(`📊 Deployment Transaction: ${deploymentTx.hash}`);
    console.log(`⛽ Gas Used: ${deploymentTx.gasLimit.toString()}`);

    // Save deployment info
    const deploymentInfo = {
      contractName: "SelfProtocolBridge",
      contractAddress: contractAddress,
      deploymentTransaction: deploymentTx.hash,
      deployer: deployer.address,
      network: network.name,
      chainId: network.chainId.toString(),
      timestamp: new Date().toISOString(),
      blockNumber: deploymentTx.blockNumber,
      gasLimit: deploymentTx.gasLimit.toString(),
      gasPrice: deploymentTx.gasPrice ? deploymentTx.gasPrice.toString() : "0"
    };

    // Write deployment info to file
    const deploymentsDir = "./deployments";
    if (!fs.existsSync(deploymentsDir)) {
      fs.mkdirSync(deploymentsDir);
    }

    const deploymentFile = `${deploymentsDir}/self-protocol-${network.chainId}.json`;
    fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
    console.log(`📝 Deployment info saved to: ${deploymentFile}`);

    // Test basic functionality
    console.log("\n🧪 Testing contract functionality...");

    // Test challenge generation
    const nonce = Math.floor(Math.random() * 1000000);
    const challengeHash = await selfProtocolBridge.generateChallenge(deployer.address, nonce);
    console.log(`🎯 Generated challenge hash: ${challengeHash}`);

    // Test verification request
    console.log("📝 Creating verification request...");
    const requestTx = await selfProtocolBridge.requestVerification(challengeHash);
    await requestTx.wait();
    console.log(`✅ Verification request created: ${requestTx.hash}`);

    // Check verification status
    const [isVerified, proofHash, timestamp] = await selfProtocolBridge.isUserVerified(deployer.address);
    console.log(`🔍 User verification status: ${isVerified}`);

    console.log("\n🎉 Self Protocol Contract Deployment Complete!");
    console.log(`\n📋 Contract Details:`);
    console.log(`Address: ${contractAddress}`);
    console.log(`Transaction: ${deploymentTx.hash}`);
    console.log(`Explorer: https://amoy.polygonscan.com/address/${contractAddress}`);
    console.log(`Transaction Explorer: https://amoy.polygonscan.com/tx/${deploymentTx.hash}`);

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
      console.log("\n✅ Deployment successful!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Deployment failed:", error);
      process.exit(1);
    });
}

module.exports = main;