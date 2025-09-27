const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("🔍 Starting contract verification...");

  // Read latest deployment
  const deploymentsDir = path.join(__dirname, "..", "deployments");
  const latestFile = path.join(deploymentsDir, "latest-polygonAmoy.json");

  if (!fs.existsSync(latestFile)) {
    throw new Error("No deployment found. Please run deployment first.");
  }

  const deployment = JSON.parse(fs.readFileSync(latestFile, "utf8"));
  console.log("📋 Found deployment from:", deployment.timestamp);

  // Verify each contract
  const contracts = deployment.contracts;
  const realAddresses = deployment.realAddresses;

  console.log("\n🔗 Verifying contracts on PolygonScan...");

  try {
    // Verify RealOracle
    console.log("1️⃣ Verifying RealOracle...");
    await hre.run("verify:verify", {
      address: contracts.RealOracle,
      constructorArguments: []
    });
    console.log("✅ RealOracle verified");

    // Verify X402Payment
    console.log("2️⃣ Verifying X402Payment...");
    await hre.run("verify:verify", {
      address: contracts.X402Payment,
      constructorArguments: []
    });
    console.log("✅ X402Payment verified");

    // Verify SelfProtocolBridge
    console.log("3️⃣ Verifying SelfProtocolBridge...");
    await hre.run("verify:verify", {
      address: contracts.SelfProtocolBridge,
      constructorArguments: []
    });
    console.log("✅ SelfProtocolBridge verified");

    // Verify Loan
    console.log("4️⃣ Verifying Loan...");
    await hre.run("verify:verify", {
      address: contracts.Loan,
      constructorArguments: [
        contracts.RealOracle,
        contracts.X402Payment,
        realAddresses.FLUENCE_AGENT,
        contracts.SelfProtocolBridge
      ]
    });
    console.log("✅ Loan verified");

    console.log("\n🎉 All contracts verified successfully!");
    console.log("🔗 View on PolygonScan:");
    console.log(`   RealOracle:         https://amoy.polygonscan.com/address/${contracts.RealOracle}`);
    console.log(`   X402Payment:        https://amoy.polygonscan.com/address/${contracts.X402Payment}`);
    console.log(`   SelfProtocolBridge: https://amoy.polygonscan.com/address/${contracts.SelfProtocolBridge}`);
    console.log(`   Loan (Main):        https://amoy.polygonscan.com/address/${contracts.Loan}`);

  } catch (error) {
    console.error("❌ Verification failed:", error.message);

    if (error.message.includes("already verified")) {
      console.log("ℹ️  Some contracts may already be verified");
    } else {
      throw error;
    }
  }
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { main };