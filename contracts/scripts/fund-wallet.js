const { ethers } = require("hardhat");
require('dotenv').config();

async function main() {
  console.log("💰 Funding wallet with test tokens...");

  // Get the test account with tokens from environment
  const testPrivateKey = process.env.LOCAL_TEST_PRIVATE_KEY;
  if (!testPrivateKey) {
    console.log("❌ LOCAL_TEST_PRIVATE_KEY not found in .env file");
    process.exit(1);
  }

  const deployer = new ethers.Wallet(testPrivateKey, ethers.provider);
  console.log("🔑 Deployer address:", deployer.address);

  // Ask for the user's wallet address
  const userWallet = process.argv[2];
  if (!userWallet) {
    console.log("❌ Please provide your wallet address as an argument");
    console.log("Usage: npx hardhat run scripts/fund-wallet.js --network localhost YOUR_WALLET_ADDRESS");
    process.exit(1);
  }

  console.log("👤 Target wallet:", userWallet);

  // Contract addresses from deployment
  const shibAddress = "0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6";
  const usdcAddress = "0x8A791620dd6260079BF849Dc5567aDC3F2FdC318";

  // Get contract instances
  const shibToken = await ethers.getContractAt("MockERC20", shibAddress);
  const usdcToken = await ethers.getContractAt("MockERC20", usdcAddress);

  // Check deployer balances
  const deployerShibBalance = await shibToken.balanceOf(deployer.address);
  const deployerUsdcBalance = await usdcToken.balanceOf(deployer.address);

  console.log("📊 Deployer balances:");
  console.log("   SHIB:", ethers.formatEther(deployerShibBalance));
  console.log("   USDC:", ethers.formatUnits(deployerUsdcBalance, 6));

  // Transfer tokens to user wallet
  const shibAmount = ethers.parseEther("10000"); // 10,000 SHIB
  const usdcAmount = ethers.parseUnits("1000", 6); // 1,000 USDC

  console.log("🚀 Transferring tokens...");

  // Transfer SHIB
  const shibTx = await shibToken.transfer(userWallet, shibAmount);
  await shibTx.wait();
  console.log("✅ SHIB transfer complete:", shibTx.hash);

  // Transfer USDC
  const usdcTx = await usdcToken.transfer(userWallet, usdcAmount);
  await usdcTx.wait();
  console.log("✅ USDC transfer complete:", usdcTx.hash);

  // Check final balances
  const userShibBalance = await shibToken.balanceOf(userWallet);
  const userUsdcBalance = await usdcToken.balanceOf(userWallet);

  console.log("\n🎉 Funding complete!");
  console.log("====================================");
  console.log("📋 Your wallet balances:");
  console.log("   SHIB:", ethers.formatEther(userShibBalance));
  console.log("   USDC:", ethers.formatUnits(userUsdcBalance, 6));
  console.log("\n💡 You can now test SHIB deposits on the frontend!");
  console.log("🌐 Frontend: http://localhost:3000");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });