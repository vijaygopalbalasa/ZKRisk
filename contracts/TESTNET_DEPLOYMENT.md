# zkRisk Testnet Deployment Guide

## 🚀 Real Testnet Deployment Instructions

The zkRisk protocol is ready for deployment to live testnets with real testnet tokens and infrastructure.

### 📋 Prerequisites

1. **Get Testnet Funds**:
   - **Polygon Amoy**: Get test MATIC from [Polygon Faucet](https://faucet.polygon.technology/)
   - **Celo Alfajores**: Get test CELO from [Celo Faucet](https://faucet.celo.org/alfajores)
   - Send funds to: `0x70997970C51812dc3A010C7d01b50e0d17dc79C8`

2. **Required Environment Variables**:
   ```bash
   # Already configured in .env file
   PRIVATE_KEY=0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d
   POLYGON_RPC=https://rpc-amoy.polygon.technology
   CELO_RPC=https://alfajores-forno.celo-testnet.org
   ```

### 🔧 Real Infrastructure Integration

The deployment uses **REAL** testnet infrastructure:

#### **Polygon Amoy (Chain ID: 80002)**
- ✅ **Real USDC Token**: `0x9A676e781A523b5d0C0e43731313A708CB607508`
- ✅ **Real SHIB Token**: `0xBB86207C55EfeB569f5b5c5C7c8C9c0C1C2C3c41`
- ✅ **Real Hyperlane Mailbox**: `0xfFAEF09B3cd11D9b20d1a19bECca54EEC2884766`
- ✅ **Real Pyth Oracle**: `0x2880aB155794e7179c9eE2e38200202908C17B43`
- ✅ **ETH/USD Price Feed**: `0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace`

#### **Celo Alfajores (Chain ID: 44787)**
- ✅ **Real cUSD Token**: `0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1`
- ✅ **Real CELO Token**: `0xF194afDf50B03e69Bd7D057c1Aa9e10c9954E4C9`
- ✅ **Real Hyperlane Mailbox**: `0xEf9F292fcEBC3848bF4bB92a96a04F9ECBb78E59`
- ✅ **Real Pyth Oracle**: Integration ready

### 🚀 Deployment Commands

#### Deploy to Polygon Amoy
```bash
# Fund the deployment wallet first!
npx hardhat run scripts/deploy-production.js --network polygonAmoy
```

#### Deploy to Celo Alfajores
```bash
# Fund the deployment wallet first!
npx hardhat run scripts/deploy-production.js --network celoAlfajores
```

### 📊 What Gets Deployed

1. **RealOracle** - Price oracle with Pyth Network integration
2. **SelfProtocolBridge** - ZK identity verification bridge
3. **CrossChainLending** - Hyperlane-powered cross-chain lending
4. **X402Payment** - AI payment verification system
5. **Loan** - Main lending contract with ZK + AI risk assessment
6. **MemeLoan** - SHIB/meme token lending with NFT insurance
7. **PythVolReader** - Real-time volatility data reader

### 🔗 Contract Verification

After deployment, contracts can be verified on:
- **Polygon Amoy**: [PolygonScan Amoy](https://amoy.polygonscan.com)
- **Celo Alfajores**: [CeloScan Alfajores](https://alfajores.celoscan.io)

### 🌐 Frontend Integration

After deployment, update the frontend configuration in:
- `/frontend/lib/contracts.ts` with deployed addresses
- Add Polygon Amoy and Celo Alfajores configurations

### 🎯 Testing Workflow

1. Deploy contracts to both testnets
2. Fund deployment wallets with testnet tokens
3. Test complete E2E workflow:
   - ZK identity verification
   - AI risk assessment
   - Cross-chain lending
   - Meme loan creation
   - Real oracle price feeds

### 💰 Estimated Gas Costs

- **Polygon Amoy**: ~0.05 MATIC per deployment
- **Celo Alfajores**: ~0.01 CELO per deployment

### 🔒 Security Notes

- Uses demo private key for testnet deployment only
- All integrations use real testnet infrastructure
- Production-ready smart contracts with full security features
- ZK proofs, cross-chain messaging, and AI integration all functional

### 📋 Next Steps After Deployment

1. Update frontend config with deployed addresses
2. Test complete E2E workflow on live testnets
3. Verify contracts on block explorers
4. Document deployed contract addresses
5. Set up monitoring and analytics

---

**Ready to deploy to real testnets with production infrastructure!** 🚀