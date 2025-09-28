const { ethers } = require("hardhat");

async function main() {
  console.log("🔍 Checking SHIB contract on Polygon Amoy...");

  const shibAddress = "0x22595C3725FEDc4e64748542B4C31C2A14a49963";

  try {
    // Check if contract exists
    const code = await ethers.provider.getCode(shibAddress);
    console.log("Contract code length:", code.length);

    if (code === "0x") {
      console.log("❌ No contract found at this address!");
      return;
    }

    console.log("✅ Contract exists");

    // Try to call basic ERC20 functions
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const shibContract = MockERC20.attach(shibAddress);

    try {
      const name = await shibContract.name();
      console.log("Name:", name);
    } catch (e) {
      console.log("❌ name() failed:", e.message);
    }

    try {
      const symbol = await shibContract.symbol();
      console.log("Symbol:", symbol);
    } catch (e) {
      console.log("❌ symbol() failed:", e.message);
    }

    try {
      const decimals = await shibContract.decimals();
      console.log("Decimals:", decimals);
    } catch (e) {
      console.log("❌ decimals() failed:", e.message);
    }

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