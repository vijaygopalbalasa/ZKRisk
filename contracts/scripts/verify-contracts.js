const { ethers } = require("hardhat");

async function main() {
  console.log("🔍 Verifying deployed contracts...");

  const shibAddress = "0x22595C3725FEDc4e64748542B4C31C2A14a49963";
  const loanAddress = "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9";

  try {
    // Check SHIB contract
    console.log("\n📋 Checking SHIB Contract at:", shibAddress);
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const shibToken = MockERC20.attach(shibAddress);

    const shibName = await shibToken.name();
    const shibSymbol = await shibToken.symbol();
    const shibDecimals = await shibToken.decimals();

    console.log("✅ SHIB Contract verified:");
    console.log("  - Name:", shibName);
    console.log("  - Symbol:", shibSymbol);
    console.log("  - Decimals:", shibDecimals);

    // Check Loan contract
    console.log("\n📋 Checking Loan Contract at:", loanAddress);
    const Loan = await ethers.getContractFactory("Loan");
    const loanContract = Loan.attach(loanAddress);

    // Try to call a function to verify it exists
    try {
      // This should exist if it's the right contract
      const oracle = await loanContract.oracle();
      console.log("✅ Loan Contract verified:");
      console.log("  - Oracle address:", oracle);
    } catch (error) {
      console.log("❌ Loan contract verification failed:", error.message);

      // Try MemeLoan instead
      console.log("\n📋 Trying MemeLoan Contract...");
      const MemeLoan = await ethers.getContractFactory("MemeLoan");
      const memeLoanContract = MemeLoan.attach(loanAddress);

      // Check if this is actually a MemeLoan contract
      try {
        const [deployer] = await ethers.getSigners();
        const position = await memeLoanContract.getUserPosition(deployer.address);
        console.log("✅ MemeLoan Contract verified:");
        console.log("  - Position check successful");
      } catch (memeLoanError) {
        console.log("❌ MemeLoan contract verification failed:", memeLoanError.message);
      }
    }

  } catch (error) {
    console.error("❌ Contract verification failed:", error);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });