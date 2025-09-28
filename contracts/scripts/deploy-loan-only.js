const { ethers } = require("hardhat");

async function main() {
  console.log("🏦 Deploying Loan Contract Only");
  console.log("================================");

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)));

  // Existing contract addresses
  const oracleAddress = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
  const x402Address = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";
  const fluenceAgent = "0x742d35CC6e64b2c5C8E4f1234567890123456789";
  const selfBridge = "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9";

  console.log("🏦 Deploying Loan contract...");
  const Loan = await ethers.getContractFactory("Loan");
  const loan = await Loan.deploy(
    oracleAddress,
    x402Address,
    fluenceAgent,
    selfBridge
  );

  await loan.waitForDeployment();
  const loanAddress = await loan.getAddress();

  console.log("✅ Loan deployed to:", loanAddress);

  // Update contract config
  const deploymentInfo = {
    network: "polygonAmoy",
    chainId: 80002,
    timestamp: new Date().toISOString(),
    deployer: deployer.address,
    contracts: {
      RealOracle: oracleAddress,
      X402Payment: x402Address,
      SelfProtocolBridge: selfBridge,
      Loan: loanAddress,
      MemeLoan: loanAddress, // Same as Loan
      MockSHIB: "0x22595C3725FEDc4e64748542B4C31C2A14a49963"
    }
  };

  console.log("📝 Updated deployment info:");
  console.log(JSON.stringify(deploymentInfo, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });