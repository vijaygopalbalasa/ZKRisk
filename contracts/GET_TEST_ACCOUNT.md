# Getting Test Account for SHIB Tokens

## Option 1: Import Pre-funded Test Account to MetaMask

1. Open MetaMask
2. Click account icon → "Import Account"
3. Use the private key from your `.env` file:
   ```
   LOCAL_TEST_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
   ```
4. This account has:
   - 10,000,000 SHIB tokens
   - 100,000 USDC tokens
   - ETH for gas fees

## Option 2: Fund Your Current Wallet

Run this command with your wallet address:
```bash
cd /Users/vijaygopalb/ZKRIsk/contracts
npx hardhat run scripts/fund-wallet.js --network localhost YOUR_WALLET_ADDRESS
```

Example:
```bash
npx hardhat run scripts/fund-wallet.js --network localhost 0x1234567890123456789012345678901234567890
```

## Security Note

The test account private key is stored securely in your `.env` file and is only used for local development. Never use this key on real networks or with real funds.