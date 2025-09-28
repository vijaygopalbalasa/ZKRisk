const { ethers } = require("hardhat");

async function main() {
  console.log("🚀 Deploying additional contracts...");

  const [deployer] = await ethers.getSigners();
  console.log("🔑 Deploying with account:", deployer.address);

  // Get deployed oracle address
  const oracleAddress = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
  const loanAddress = "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9";

  // Deploy Paper-Hand Insurance NFT
  console.log("🐕 Deploying PaperHandInsurance...");
  const PaperHandInsurance = await ethers.getContractFactory("PaperHandInsurance");
  const paperHandInsurance = await PaperHandInsurance.deploy(oracleAddress);
  await paperHandInsurance.waitForDeployment();
  const paperHandAddress = await paperHandInsurance.getAddress();
  console.log("✅ PaperHandInsurance deployed to:", paperHandAddress);

  // Deploy MemeLoan
  console.log("🎭 Deploying MemeLoan...");
  const MemeLoan = await ethers.getContractFactory("MemeLoan");
  const memeLoan = await MemeLoan.deploy(loanAddress);
  await memeLoan.waitForDeployment();
  const memeLoanAddress = await memeLoan.getAddress();
  console.log("✅ MemeLoan deployed to:", memeLoanAddress);

  // Deploy mock SHIB token for testing
  console.log("🐕 Deploying Mock SHIB Token...");
  const MockERC20 = await ethers.getContractFactory("MockERC20");
  const shibToken = await MockERC20.deploy("Shiba Inu", "SHIB", ethers.parseEther("1000000000"));
  await shibToken.waitForDeployment();
  const shibAddress = await shibToken.getAddress();
  console.log("✅ Mock SHIB deployed to:", shibAddress);

  // Deploy mock USDC token for testing
  console.log("💵 Deploying Mock USDC Token...");
  const usdcToken = await MockERC20.deploy("USD Coin", "USDC", ethers.parseUnits("1000000", 6));
  await usdcToken.waitForDeployment();
  const usdcAddress = await usdcToken.getAddress();
  console.log("✅ Mock USDC deployed to:", usdcAddress);

  // Fund deployer with tokens for testing
  console.log("💰 Funding deployer with test tokens...");
  await shibToken.transfer(deployer.address, ethers.parseEther("10000000"));
  await usdcToken.transfer(deployer.address, ethers.parseUnits("100000", 6));

  console.log("\n🎉 Additional deployment complete!");
  console.log("=====================================");
  console.log("📋 New Contract Addresses:");
  console.log("   PaperHandInsurance:", paperHandAddress);
  console.log("   MemeLoan:          ", memeLoanAddress);
  console.log("   Mock SHIB:         ", shibAddress);
  console.log("   Mock USDC:         ", usdcAddress);
  console.log("\n💡 Update frontend wagmi.ts with these addresses!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });