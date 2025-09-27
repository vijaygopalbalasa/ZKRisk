const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("🔍 Checking deployment status...");

  // Read latest deployment
  const deploymentsDir = path.join(__dirname, "..", "deployments");
  const latestFile = path.join(deploymentsDir, "latest-polygonAmoy.json");

  if (!fs.existsSync(latestFile)) {
    console.log("❌ No deployment found");
    console.log("Run: npm run deploy:amoy");
    return;
  }

  const deployment = JSON.parse(fs.readFileSync(latestFile, "utf8"));
  const contracts = deployment.contracts;

  console.log("📋 Deployment found from:", deployment.timestamp);
  console.log("🔗 Contract addresses:");

  // Check each contract
  const provider = ethers.provider;
  const checks = [];

  for (const [name, address] of Object.entries(contracts)) {
    console.log(`\n📄 ${name}: ${address}`);

    try {
      // Check if contract exists
      const code = await provider.getCode(address);
      if (code === "0x") {
        console.log(`   ❌ No code deployed`);
        checks.push({ name, status: "❌ No code" });
      } else {
        console.log(`   ✅ Contract deployed (${code.length} bytes)`);

        // Try to interact with contract
        try {
          if (name === "RealOracle") {
            const oracle = await ethers.getContractAt("RealOracle", address);
            const [price, confidence] = await oracle.getPrice(ethers.keccak256(ethers.toUtf8Bytes("USDC/USD")));
            console.log(`   💰 USDC price: $${ethers.formatUnits(price, 8)} (${confidence/100}%)`);
          } else if (name === "X402Payment") {
            const x402 = await ethers.getContractAt("X402Payment", address);
            const usdcAddress = await x402.USDC();
            console.log(`   💳 USDC address: ${usdcAddress}`);
          } else if (name === "Loan") {
            const loan = await ethers.getContractAt("Loan", address);
            const totalBorrowed = await loan.totalBorrowed();
            console.log(`   🏦 Total borrowed: ${ethers.formatUnits(totalBorrowed, 6)} USDC`);
          }
          checks.push({ name, status: "✅ Working" });
        } catch (interactionError) {
          console.log(`   ⚠️  Contract deployed but interaction failed: ${interactionError.message.slice(0, 50)}...`);
          checks.push({ name, status: "⚠️  Partial" });
        }
      }

      // Check verification status
      console.log(`   🔗 PolygonScan: https://amoy.polygonscan.com/address/${address}`);

    } catch (error) {
      console.log(`   ❌ Check failed: ${error.message}`);
      checks.push({ name, status: "❌ Error" });
    }
  }

  // Summary
  console.log("\n📊 Summary:");
  checks.forEach(check => {
    console.log(`   ${check.name}: ${check.status}`);
  });

  const workingCount = checks.filter(c => c.status === "✅ Working").length;
  const totalCount = checks.length;

  if (workingCount === totalCount) {
    console.log("\n🎉 All contracts working properly!");
    console.log("✅ Ready for frontend integration");
  } else {
    console.log(`\n⚠️  ${workingCount}/${totalCount} contracts working`);
    console.log("Consider redeploying failed contracts");
  }

  // Next steps
  console.log("\n📋 Next steps:");
  console.log("   1. Verify contracts: npm run verify:amoy");
  console.log("   2. Update frontend with addresses");
  console.log("   3. Test with demo script");
  console.log("   4. Fund contracts for demo");

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