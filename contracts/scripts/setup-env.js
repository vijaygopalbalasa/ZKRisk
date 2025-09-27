const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");

async function main() {
  console.log("🔧 Setting up deployment environment...");

  // Create .env file if it doesn't exist
  const envPath = path.join(__dirname, "..", ".env");
  const envExamplePath = path.join(__dirname, "..", ".env.example");

  // Create .env.example with required variables
  const envExample = `# zkRisk-Agent Environment Configuration
#
# REQUIRED FOR DEPLOYMENT:
PRIVATE_KEY=your_wallet_private_key_here
POLYGON_RPC=https://rpc-amoy.polygon.technology
CELO_RPC=https://alfajores-forno.celo-testnet.org

# OPTIONAL - For contract verification:
POLYGONSCAN_API_KEY=your_polygonscan_api_key
CELOSCAN_API_KEY=your_celoscan_api_key

# FLUENCE CONFIGURATION:
FLUENCE_VM_ENDPOINT=https://your-fluence-vm.example.com
FLUENCE_AI_SERVICE_ID=your_fluence_service_id

# SELF PROTOCOL:
SELF_VERIFIER_ADDRESS=your_self_verifier_address

# HYPERLANE:
HYPERLANE_MAILBOX_AMOY=0x742d35Cc6e64B2C5c8e4F1234567890123456789
HYPERLANE_MAILBOX_CELO=0x742d35Cc6e64B2C5c8e4F1234567890123456789

# DEMO CONFIGURATION:
DEMO_WALLET_PRIVATE_KEY=demo_wallet_for_testing
USDC_HOLDER_ADDRESS=address_with_usdc_for_demo
`;

  fs.writeFileSync(envExamplePath, envExample);
  console.log("📄 Created .env.example");

  if (!fs.existsSync(envPath)) {
    fs.writeFileSync(envPath, envExample);
    console.log("📄 Created .env file (please update with your values)");
  } else {
    console.log("📄 .env file already exists");
  }

  // Create deployments directory
  const deploymentsDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
    console.log("📁 Created deployments directory");
  }

  // Create deployment addresses template
  const addressesTemplate = {
    polygonAmoy: {
      chainId: 80002,
      rpcUrl: "https://rpc-amoy.polygon.technology",
      explorer: "https://amoy.polygonscan.com",
      contracts: {
        RealOracle: "",
        X402Payment: "",
        SelfProtocolBridge: "",
        Loan: ""
      },
      realAddresses: {
        USDC: "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582",
        HyperlaneMailbox: "0x742d35Cc6e64B2C5c8e4F1234567890123456789"
      }
    },
    celoAlfajores: {
      chainId: 44787,
      rpcUrl: "https://alfajores-forno.celo-testnet.org",
      explorer: "https://alfajores.celoscan.io",
      contracts: {
        SelfProtocolVerifier: ""
      }
    }
  };

  const addressesFile = path.join(deploymentsDir, "addresses-template.json");
  fs.writeFileSync(addressesFile, JSON.stringify(addressesTemplate, null, 2));
  console.log("📄 Created addresses template");

  // Check wallet setup
  console.log("\n💳 Wallet Setup Check:");

  if (process.env.PRIVATE_KEY) {
    try {
      const wallet = new ethers.Wallet(process.env.PRIVATE_KEY);
      console.log(`✅ Wallet address: ${wallet.address}`);

      // Check balance on Polygon Amoy
      try {
        const provider = new ethers.JsonRpcProvider("https://rpc-amoy.polygon.technology");
        const balance = await provider.getBalance(wallet.address);
        console.log(`💰 Polygon Amoy balance: ${ethers.formatEther(balance)} POL`);

        if (balance < ethers.parseEther("0.1")) {
          console.warn("⚠️  Warning: Low POL balance. Get testnet tokens from:");
          console.warn("   https://faucet.polygon.technology/");
        }
      } catch (error) {
        console.warn("⚠️  Could not check POL balance (network issue)");
      }

    } catch (error) {
      console.error("❌ Invalid private key format");
    }
  } else {
    console.warn("⚠️  No PRIVATE_KEY in environment");
    console.log("   Please add your wallet private key to .env file");
  }

  // API Key checks
  console.log("\n🔑 API Key Check:");
  if (process.env.POLYGONSCAN_API_KEY) {
    console.log("✅ PolygonScan API key configured");
  } else {
    console.warn("⚠️  No PolygonScan API key (verification will be limited)");
    console.log("   Get one from: https://polygonscan.com/apis");
  }

  console.log("\n📋 Pre-deployment Checklist:");
  console.log("   ✅ Environment files created");
  console.log("   ✅ Deployment directory ready");
  console.log("   ⏳ Update .env with your values");
  console.log("   ⏳ Get testnet POL from faucet");
  console.log("   ⏳ Get PolygonScan API key (optional)");

  console.log("\n🚀 Ready to deploy! Run:");
  console.log("   npm run deploy:amoy");

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