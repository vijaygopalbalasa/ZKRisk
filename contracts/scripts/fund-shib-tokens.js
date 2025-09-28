const hre = require("hardhat");

async function main() {
  console.log("🐕 Funding SHIB tokens to testnet deployer address");
  console.log("=====================================");

  const [deployer] = await hre.ethers.getSigners();
  const deployerAddress = deployer.address;

  console.log("Deployer address:", deployerAddress);
  console.log("Network:", hre.network.name);

  // Mock SHIB token contract ABI (for funding purposes)
  const mockShibABI = [
    "function mint(address to, uint256 amount) external",
    "function balanceOf(address account) external view returns (uint256)",
    "function symbol() external view returns (string)",
    "function decimals() external view returns (uint8)",
    "function transfer(address to, uint256 amount) external returns (bool)"
  ];

  // Deploy a mock SHIB token for testing (since SHIB doesn't exist on Amoy testnet)
  console.log("\n1. 🏭 Deploying Mock SHIB Token...");

  const MockERC20 = await hre.ethers.getContractFactory("MockERC20");
  const mockShib = await MockERC20.deploy(
    "Shiba Inu",
    "SHIB",
    0 // initialSupply - we'll mint separately
  );

  await mockShib.waitForDeployment();
  const shibAddress = await mockShib.getAddress();

  console.log("✅ Mock SHIB deployed at:", shibAddress);

  // Fund deployer with SHIB tokens
  console.log("\n2. 💰 Funding SHIB tokens to deployer...");

  const shibAmount = hre.ethers.parseEther("100000000000"); // 100 billion SHIB
  const mintTx = await mockShib.mint(deployerAddress, shibAmount);
  await mintTx.wait();

  console.log(`✅ Minted ${hre.ethers.formatEther(shibAmount)} SHIB to ${deployerAddress}`);

  // Check balance
  const balance = await mockShib.balanceOf(deployerAddress);
  console.log(`💰 SHIB Balance: ${hre.ethers.formatEther(balance)} SHIB`);

  // Save deployment info
  const deploymentInfo = {
    network: hre.network.name,
    mockSHIB: shibAddress,
    deployerAddress: deployerAddress,
    shibBalance: hre.ethers.formatEther(balance),
    timestamp: new Date().toISOString()
  };

  const fs = require('fs');
  if (!fs.existsSync('deployments')) {
    fs.mkdirSync('deployments');
  }

  fs.writeFileSync(
    `deployments/${hre.network.name}-tokens.json`,
    JSON.stringify(deploymentInfo, null, 2)
  );

  console.log("\n📋 Summary:");
  console.log("- Mock SHIB Address:", shibAddress);
  console.log("- Deployer Balance:", hre.ethers.formatEther(balance), "SHIB");
  console.log("- Deployment file:", `deployments/${hre.network.name}-tokens.json`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });