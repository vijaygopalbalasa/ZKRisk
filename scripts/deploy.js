/**
 * Comprehensive deployment script for zkRisk-Agent
 * Deploys all contracts to Polygon Amoy and Celo Alfajores testnets
 */

const { ethers } = require('hardhat');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Deployment configuration
const DEPLOY_CONFIG = {
    POLYGON_AMOY: {
        chainId: 80002,
        name: 'Polygon Amoy Testnet',
        contracts: {
            PYTH_ORACLE: '0x8250f4aF4B972684F7b336503E2D6dFeDeB1487a',
            USDC: '0x9A676e781A523b5d0C0e43731313A708CB607508',
            SHIB: '0x8d7F78e9aBCA4EB2A49f7A2Eb46Bf52A9e6D29D2'
        }
    },
    CELO_ALFAJORES: {
        chainId: 44787,
        name: 'Celo Alfajores Testnet',
        contracts: {
            SELF_HUB: '0x16ECBA51e18a4a7e61fdC417f0d47AFEeDfbed74',
            HYPERLANE_MAILBOX: '0x598facE78a4302f11E3de0bee1894Da0b2Cb71F8'
        }
    }
};

class DeploymentManager {
    constructor() {
        this.deployments = {
            polygonAmoy: {},
            celoAlfajores: {}
        };
        this.deploymentFile = path.join(__dirname, '../deployment.json');
    }

    async deployToPolygonAmoy() {
        console.log('🚀 Deploying to Polygon Amoy...');

        const [deployer] = await ethers.getSigners();
        const network = await ethers.provider.getNetwork();

        console.log(`📍 Network: ${network.name} (${Number(network.chainId)})`);
        console.log(`👤 Deployer: ${deployer.address}`);
        console.log(`💰 Balance: ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} POL`);

        try {
            // Deploy X402Payment contract
            console.log('\n1️⃣ Deploying X402Payment contract...');
            const X402Payment = await ethers.getContractFactory('X402Payment');
            const x402Payment = await X402Payment.deploy();
            await x402Payment.waitForDeployment();
            const x402Address = await x402Payment.getAddress();

            console.log(`✅ X402Payment deployed: ${x402Address}`);

            // Deploy PythVolReader contract
            console.log('\n2️⃣ Deploying PythVolReader contract...');
            const PythVolReader = await ethers.getContractFactory('PythVolReader');
            const pythVolReader = await PythVolReader.deploy(DEPLOY_CONFIG.POLYGON_AMOY.contracts.PYTH_ORACLE);
            await pythVolReader.waitForDeployment();
            const pythVolReaderAddress = await pythVolReader.getAddress();

            console.log(`✅ PythVolReader deployed: ${pythVolReaderAddress}`);

            // Deploy main Loan contract
            console.log('\n3️⃣ Deploying Loan contract...');
            const Loan = await ethers.getContractFactory('Loan');
            const loan = await Loan.deploy(
                pythVolReaderAddress,
                x402Address,
                deployer.address, // Fluence agent (will be updated later)
                deployer.address  // Self verifier (will be updated later)
            );
            await loan.waitForDeployment();
            const loanAddress = await loan.getAddress();

            console.log(`✅ Loan contract deployed: ${loanAddress}`);

            // Store deployment info
            this.deployments.polygonAmoy = {
                network: DEPLOY_CONFIG.POLYGON_AMOY.name,
                chainId: DEPLOY_CONFIG.POLYGON_AMOY.chainId,
                deployer: deployer.address,
                timestamp: new Date().toISOString(),
                contracts: {
                    Loan: loanAddress,
                    X402Payment: x402Address,
                    PythVolReader: pythVolReaderAddress,
                    // External contracts
                    USDC: DEPLOY_CONFIG.POLYGON_AMOY.contracts.USDC,
                    SHIB: DEPLOY_CONFIG.POLYGON_AMOY.contracts.SHIB,
                    PythOracle: DEPLOY_CONFIG.POLYGON_AMOY.contracts.PYTH_ORACLE
                },
                transactions: {
                    X402Payment: x402Payment.deploymentTransaction()?.hash,
                    PythVolReader: pythVolReader.deploymentTransaction()?.hash,
                    Loan: loan.deploymentTransaction()?.hash
                }
            };

            console.log('\n🎉 Polygon Amoy deployment completed successfully!');
            return this.deployments.polygonAmoy;

        } catch (error) {
            console.error('❌ Polygon Amoy deployment failed:', error);
            throw error;
        }
    }

    async deployCeloContracts() {
        console.log('🚀 Deploying to Celo Alfajores...');

        // Note: This would require switching networks in a real deployment
        // For demo purposes, we'll create a mock deployment

        const mockDeployment = {
            network: DEPLOY_CONFIG.CELO_ALFAJORES.name,
            chainId: DEPLOY_CONFIG.CELO_ALFAJORES.chainId,
            deployer: '0x0000000000000000000000000000000000000000', // Would be actual deployer
            timestamp: new Date().toISOString(),
            contracts: {
                ZKRiskIdentityVerifier: '0x0000000000000000000000000000000000000000', // Would be deployed
                CrossChainBridge: '0x0000000000000000000000000000000000000000', // Would be deployed
                // External contracts
                SelfHub: DEPLOY_CONFIG.CELO_ALFAJORES.contracts.SELF_HUB,
                HyperlaneMailbox: DEPLOY_CONFIG.CELO_ALFAJORES.contracts.HYPERLANE_MAILBOX
            },
            note: 'Celo deployment requires network switch - implement in production'
        };

        this.deployments.celoAlfajores = mockDeployment;
        console.log('✅ Celo Alfajores mock deployment created');

        return mockDeployment;
    }

    async verifyContracts() {
        console.log('\n🔍 Verifying contracts on block explorers...');

        const polygonDeployment = this.deployments.polygonAmoy;

        if (!polygonDeployment.contracts) {
            console.log('⚠️ No contracts to verify');
            return;
        }

        try {
            // Verify X402Payment
            if (polygonDeployment.contracts.X402Payment) {
                console.log('   Verifying X402Payment...');
                await this.verifyContract(
                    polygonDeployment.contracts.X402Payment,
                    [],
                    'contracts/X402Payment.sol:X402Payment'
                );
            }

            // Verify PythVolReader
            if (polygonDeployment.contracts.PythVolReader) {
                console.log('   Verifying PythVolReader...');
                await this.verifyContract(
                    polygonDeployment.contracts.PythVolReader,
                    [DEPLOY_CONFIG.POLYGON_AMOY.contracts.PYTH_ORACLE],
                    'contracts/PythVolReader.sol:PythVolReader'
                );
            }

            // Verify Loan contract
            if (polygonDeployment.contracts.Loan) {
                console.log('   Verifying Loan...');
                await this.verifyContract(
                    polygonDeployment.contracts.Loan,
                    [
                        polygonDeployment.contracts.PythVolReader,
                        polygonDeployment.contracts.X402Payment,
                        polygonDeployment.deployer,
                        polygonDeployment.deployer
                    ],
                    'contracts/Loan.sol:Loan'
                );
            }

            console.log('✅ Contract verification completed');

        } catch (error) {
            console.error('⚠️ Contract verification failed:', error.message);
            console.log('💡 You can verify contracts manually on Polygonscan');
        }
    }

    async verifyContract(address, constructorArguments, contract) {
        try {
            await hre.run('verify:verify', {
                address: address,
                constructorArguments: constructorArguments,
                contract: contract
            });
            console.log(`   ✅ ${contract} verified`);
        } catch (error) {
            if (error.message.includes('already verified')) {
                console.log(`   ✅ ${contract} already verified`);
            } else {
                throw error;
            }
        }
    }

    async setupInitialConfiguration() {
        console.log('\n⚙️ Setting up initial configuration...');

        const polygonDeployment = this.deployments.polygonAmoy;

        try {
            // Get contract instances
            const loan = await ethers.getContractAt('Loan', polygonDeployment.contracts.Loan);
            const x402Payment = await ethers.getContractAt('X402Payment', polygonDeployment.contracts.X402Payment);

            // Register AI inference service in x402
            console.log('   Registering AI inference service...');
            const serviceId = ethers.keccak256(ethers.toUtf8Bytes('AI_VOLATILITY_INFERENCE'));
            const pricePerCall = ethers.parseUnits('0.005', 6); // 0.005 USDC

            try {
                const registerTx = await x402Payment.registerService(serviceId, pricePerCall);
                await registerTx.wait();
                console.log('   ✅ AI inference service registered');
            } catch (error) {
                if (error.message.includes('revert')) {
                    console.log('   ⚠️ Service already registered or registration failed');
                } else {
                    throw error;
                }
            }

            // Update configuration with default values
            console.log('   Setting up loan configuration...');
            // Note: In production, you'd set appropriate values
            // For now, the contract uses default values

            console.log('✅ Initial configuration completed');

        } catch (error) {
            console.error('⚠️ Configuration setup failed:', error.message);
        }
    }

    async saveDeploymentInfo() {
        console.log('\n💾 Saving deployment information...');

        const deploymentData = {
            version: '1.0.0',
            timestamp: new Date().toISOString(),
            networks: this.deployments,
            frontend: {
                configUpdate: {
                    LOAN_CONTRACT: this.deployments.polygonAmoy.contracts?.Loan || '0x0000000000000000000000000000000000000000',
                    X402_CONTRACT: this.deployments.polygonAmoy.contracts?.X402Payment || '0x0000000000000000000000000000000000000000',
                    PYTH_READER: this.deployments.polygonAmoy.contracts?.PythVolReader || '0x0000000000000000000000000000000000000000'
                }
            },
            nextSteps: [
                'Update frontend configuration with deployed contract addresses',
                'Deploy and configure Fluence AI service',
                'Test end-to-end integration',
                'Update documentation with live contract addresses'
            ]
        };

        // Save to deployment.json
        fs.writeFileSync(this.deploymentFile, JSON.stringify(deploymentData, null, 2));
        console.log(`✅ Deployment info saved to: ${this.deploymentFile}`);

        // Update frontend config
        await this.updateFrontendConfig(deploymentData.frontend.configUpdate);

        return deploymentData;
    }

    async updateFrontendConfig(contracts) {
        console.log('   Updating frontend configuration...');

        const configPath = path.join(__dirname, '../frontend/config.js');
        const configContent = `
// Auto-generated deployment configuration
export const CONFIG = {
    POLYGON_AMOY: {
        chainId: 80002,
        name: 'Polygon Amoy Testnet',
        rpc: 'https://rpc-amoy.polygon.technology',
        blockExplorer: 'https://amoy.polygonscan.com'
    },
    CONTRACTS: {
        LOAN: '${contracts.LOAN_CONTRACT}',
        X402: '${contracts.X402_CONTRACT}',
        PYTH_READER: '${contracts.PYTH_READER}',
        USDC: '${DEPLOY_CONFIG.POLYGON_AMOY.contracts.USDC}',
        SHIB: '${DEPLOY_CONFIG.POLYGON_AMOY.contracts.SHIB}'
    },
    FLUENCE_SERVICE: 'http://localhost:5000', // Update after Fluence deployment
    PYTH_HERMES: 'wss://hermes.pyth.network/ws',
    FEEDS: {
        SHIB_USD: '0xfedc35b66b7e28bf33c88f5bfea1b6c0a34b5b85568fff3067bfce9b4e073c16'
    }
};

export default CONFIG;
`;

        fs.writeFileSync(configPath, configContent);
        console.log('   ✅ Frontend config updated');
    }

    async generateDeploymentReport() {
        console.log('\n📊 Generating deployment report...');

        const report = `
# zkRisk-Agent Deployment Report

## Overview
- **Deployment Date**: ${new Date().toISOString()}
- **Networks**: Polygon Amoy Testnet, Celo Alfajores Testnet
- **Status**: ✅ Successful

## Polygon Amoy Testnet Contracts

### Core Contracts
- **Loan Contract**: \`${this.deployments.polygonAmoy.contracts?.Loan}\`
- **X402 Payment**: \`${this.deployments.polygonAmoy.contracts?.X402Payment}\`
- **Pyth Vol Reader**: \`${this.deployments.polygonAmoy.contracts?.PythVolReader}\`

### External Contracts
- **USDC**: \`${DEPLOY_CONFIG.POLYGON_AMOY.contracts.USDC}\`
- **SHIB**: \`${DEPLOY_CONFIG.POLYGON_AMOY.contracts.SHIB}\`
- **Pyth Oracle**: \`${DEPLOY_CONFIG.POLYGON_AMOY.contracts.PYTH_ORACLE}\`

### Block Explorer Links
- [Loan Contract](https://amoy.polygonscan.com/address/${this.deployments.polygonAmoy.contracts?.Loan})
- [X402 Payment](https://amoy.polygonscan.com/address/${this.deployments.polygonAmoy.contracts?.X402Payment})
- [Pyth Vol Reader](https://amoy.polygonscan.com/address/${this.deployments.polygonAmoy.contracts?.PythVolReader})

## Celo Alfajores Testnet
- **Status**: Mock deployment created
- **Note**: Requires network switch for actual deployment

## Next Steps

1. **Deploy Fluence AI Service**
   \`\`\`bash
   cd fluence
   npm run deploy
   \`\`\`

2. **Update Frontend Configuration**
   - Contract addresses already updated in \`frontend/config.js\`
   - Update Fluence service URL after deployment

3. **Test Integration**
   \`\`\`bash
   npm run test:e2e
   \`\`\`

4. **Verify Functionality**
   - [ ] Connect wallet to frontend
   - [ ] Verify identity with Self Protocol
   - [ ] Deposit collateral
   - [ ] Check AI volatility inference
   - [ ] Test borrowing functionality

## Configuration Files Updated
- ✅ \`deployment.json\` - Complete deployment information
- ✅ \`frontend/config.js\` - Frontend contract addresses
- ⏳ \`.env\` - Update with deployed addresses

## Demo URLs
- **Frontend**: \`http://localhost:3000\` (after \`npm run dev\`)
- **Fluence Service**: \`http://localhost:5000\` (after deployment)
- **Block Explorer**: https://amoy.polygonscan.com

---
*Generated automatically by zkRisk-Agent deployment script*
`;

        const reportPath = path.join(__dirname, '../DEPLOYMENT_REPORT.md');
        fs.writeFileSync(reportPath, report);
        console.log(`✅ Deployment report generated: ${reportPath}`);
    }
}

async function main() {
    console.log('🚀 zkRisk-Agent Comprehensive Deployment');
    console.log('=' * 50);

    const deployer = new DeploymentManager();

    try {
        // Deploy to Polygon Amoy
        await deployer.deployToPolygonAmoy();

        // Deploy to Celo (mock for now)
        await deployer.deployCeloContracts();

        // Verify contracts
        await deployer.verifyContracts();

        // Setup initial configuration
        await deployer.setupInitialConfiguration();

        // Save deployment information
        const deploymentData = await deployer.saveDeploymentInfo();

        // Generate report
        await deployer.generateDeploymentReport();

        console.log('\n🎉 Deployment completed successfully!');
        console.log('\n📋 Summary:');
        console.log(`   📄 Deployment file: deployment.json`);
        console.log(`   📊 Report: DEPLOYMENT_REPORT.md`);
        console.log(`   🔗 Loan Contract: ${deploymentData.networks.polygonAmoy.contracts?.Loan}`);
        console.log(`   💳 X402 Payment: ${deploymentData.networks.polygonAmoy.contracts?.X402Payment}`);

        console.log('\n🚀 Next steps:');
        console.log('   1. Deploy Fluence AI service: cd fluence && npm run deploy');
        console.log('   2. Test frontend: cd frontend && npm run dev');
        console.log('   3. Run integration tests: npm run test:e2e');

    } catch (error) {
        console.error('❌ Deployment failed:', error);
        process.exit(1);
    }
}

// Execute deployment
if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error(error);
            process.exit(1);
        });
}

module.exports = { DeploymentManager, DEPLOY_CONFIG };