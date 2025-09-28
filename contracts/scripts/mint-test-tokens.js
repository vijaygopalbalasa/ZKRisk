const { ethers } = require("hardhat");

async function main() {
  console.log("🪙 Minting test SHIB tokens for testing...");

  const [deployer] = await ethers.getSigners();
  console.log("Deployer address:", deployer.address);

  // SHIB token contract address
  const shibAddress = "0x22595C3725FEDc4e64748542B4C31C2A14a49963";

  // Connect to the SHIB contract
  const MockERC20 = await ethers.getContractFactory("MockERC20");
  const shibToken = MockERC20.attach(shibAddress);

  // Amount to mint: 1 billion SHIB tokens (with 18 decimals)
  const mintAmount = ethers.parseEther("1000000000");

  try {
    console.log("🔍 Checking contract owner...");
    const owner = await shibToken.owner();
    console.log("Contract owner:", owner);
    console.log("Deployer address:", deployer.address);

    if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
      console.log("❌ You are not the owner of the SHIB contract");
      console.log("❌ Cannot mint tokens");

      // Try to get current balance instead
      const balance = await shibToken.balanceOf(deployer.address);
      console.log(`📊 Current SHIB balance: ${ethers.formatEther(balance)} SHIB`);

      if (balance > 0) {
        console.log("✅ You already have SHIB tokens, you can test with them");
      } else {
        console.log("❌ You have no SHIB tokens");
        console.log("💡 Solution: Deploy a new SHIB contract or use the existing balance from the deployer");
      }
      return;
    }

    console.log("🪙 Minting SHIB tokens...");
    const tx = await shibToken.mint(deployer.address, mintAmount);
    await tx.wait();

    console.log("✅ Minted 1 billion SHIB tokens!");
    console.log("Transaction:", tx.hash);

    // Check new balance
    const newBalance = await shibToken.balanceOf(deployer.address);
    console.log(`📊 New SHIB balance: ${ethers.formatEther(newBalance)} SHIB`);

  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });