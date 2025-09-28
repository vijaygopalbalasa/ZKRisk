const { ethers } = require("hardhat");

async function main() {
  console.log("🔍 Checking Loan contract on Polygon Amoy...");

  const loanAddress = "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9";

  try {
    // Check if contract exists
    const code = await ethers.provider.getCode(loanAddress);
    console.log("Contract code length:", code.length);

    if (code === "0x") {
      console.log("❌ No contract found at this address!");
      return;
    }

    console.log("✅ Contract exists");

    // Try to read contract properties
    const abi = [
      "function SHIB() external view returns (address)",
      "function USDC() external view returns (address)",
      "function oracle() external view returns (address)"
    ];

    const contract = new ethers.Contract(loanAddress, abi, ethers.provider);

    try {
      const shibAddr = await contract.SHIB();
      console.log("SHIB Address:", shibAddr);
    } catch (e) {
      console.log("❌ SHIB() failed:", e.message);
    }

    try {
      const usdcAddr = await contract.USDC();
      console.log("USDC Address:", usdcAddr);
    } catch (e) {
      console.log("❌ USDC() failed:", e.message);
    }

    try {
      const oracleAddr = await contract.oracle();
      console.log("Oracle Address:", oracleAddr);
    } catch (e) {
      console.log("❌ oracle() failed:", e.message);
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