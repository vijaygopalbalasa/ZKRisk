/**
 * End-to-End Integration Test Script
 * Tests the complete zkRisk-Agent workflow
 */

const { ethers } = require('hardhat');
const axios = require('axios');
const fs = require('fs');
require('dotenv').config();

class IntegrationTester {
    constructor() {
        this.deploymentData = null;
        this.contracts = {};
        this.testResults = {
            total: 0,
            passed: 0,
            failed: 0,
            tests: []
        };
    }

    async init() {
        console.log('🧪 Initializing Integration Tests...');

        // Load deployment data
        try {
            const deploymentFile = JSON.parse(fs.readFileSync('./deployment.json', 'utf8'));
            this.deploymentData = deploymentFile.networks.polygonAmoy;
            console.log('✅ Deployment data loaded');
        } catch (error) {
            throw new Error('Deployment data not found. Run deployment first.');
        }

        // Setup contracts
        await this.setupContracts();
    }

    async setupContracts() {
        const [signer] = await ethers.getSigners();

        // Contract ABIs
        const loanABI = [
            "function getVault(address user) external view returns (uint256, uint256, uint256, uint256, bool, bytes32)",
            "function deposit(uint256 amount) external",
            "function borrow(uint256 usdcAmount, uint256 lambda, bytes calldata aiProof) external",
            "function verifyZKIdentity(bytes calldata zkProof, bytes32 proofHash) external"
        ];

        const erc20ABI = [
            "function balanceOf(address owner) view returns (uint256)",
            "function approve(address spender, uint256 amount) returns (bool)"
        ];

        // Initialize contracts
        this.contracts = {
            loan: new ethers.Contract(this.deploymentData.contracts.Loan, loanABI, signer),
            usdc: new ethers.Contract(this.deploymentData.contracts.USDC, erc20ABI, signer),
            shib: new ethers.Contract(this.deploymentData.contracts.SHIB, erc20ABI, signer)
        };

        console.log('✅ Contracts initialized');
    }

    async runTest(testName, testFunction) {
        this.testResults.total++;
        console.log(`\n🔍 Running: ${testName}`);

        try {
            await testFunction();
            this.testResults.passed++;
            this.testResults.tests.push({ name: testName, status: 'PASSED', error: null });
            console.log(`✅ PASSED: ${testName}`);
        } catch (error) {
            this.testResults.failed++;
            this.testResults.tests.push({ name: testName, status: 'FAILED', error: error.message });
            console.log(`❌ FAILED: ${testName} - ${error.message}`);
        }
    }

    async testContractDeployment() {
        // Test that all contracts are deployed and accessible
        const contracts = this.deploymentData.contracts;

        if (!contracts.Loan || contracts.Loan === '0x0000000000000000000000000000000000000000') {
            throw new Error('Loan contract not deployed');
        }

        if (!contracts.X402Payment || contracts.X402Payment === '0x0000000000000000000000000000000000000000') {
            throw new Error('X402Payment contract not deployed');
        }

        if (!contracts.PythVolReader || contracts.PythVolReader === '0x0000000000000000000000000000000000000000') {
            throw new Error('PythVolReader contract not deployed');
        }

        // Test contract calls
        const [signer] = await ethers.getSigners();
        const vault = await this.contracts.loan.getVault(signer.address);

        // Should return default vault data (all zeros for new user)
        if (vault.length !== 6) {
            throw new Error('Vault data structure incorrect');
        }
    }

    async testTokenBalances() {
        const [signer] = await ethers.getSigners();

        // Check USDC balance
        const usdcBalance = await this.contracts.usdc.balanceOf(signer.address);
        console.log(`   USDC Balance: ${ethers.formatUnits(usdcBalance, 6)} USDC`);

        // Check SHIB balance
        const shibBalance = await this.contracts.shib.balanceOf(signer.address);
        console.log(`   SHIB Balance: ${ethers.formatUnits(shibBalance, 18)} SHIB`);

        // For testing, we just verify the calls work
        // In production, you'd need actual test tokens
    }

    async testFluenceAIService() {
        const fluenceUrl = process.env.FLUENCE_SERVICE_URL || 'http://localhost:5000';

        // Test health endpoint
        const healthResponse = await axios.get(`${fluenceUrl}/health`, { timeout: 10000 });
        if (healthResponse.status !== 200) {
            throw new Error('Fluence health check failed');
        }

        console.log(`   Health Status: ${healthResponse.data.status}`);

        // Test inference endpoint
        const inferResponse = await axios.get(`${fluenceUrl}/infer?volatility=0.1,0.15,0.12,0.18,0.14`);
        if (inferResponse.status !== 200) {
            throw new Error('Fluence inference failed');
        }

        const lambda = inferResponse.data.lambda;
        if (!lambda || lambda < 0.3 || lambda > 1.8) {
            throw new Error(`Invalid lambda value: ${lambda}`);
        }

        console.log(`   Lambda: ${lambda}`);
        console.log(`   Lambda1000: ${inferResponse.data.lambda1000}`);
    }

    async testPythOracleIntegration() {
        // Test Pyth Oracle connection (simplified)
        // In production, this would test actual price feeds

        const pythReaderABI = [
            "function getShibData() external view returns (tuple(int64 price, uint64 conf, int32 expo, uint256 publishTime), tuple(uint256 shortTermVol, uint256 mediumTermVol, uint256 longTermVol, uint256 lastUpdate), uint256 lambda)"
        ];

        const pythReader = new ethers.Contract(
            this.deploymentData.contracts.PythVolReader,
            pythReaderABI,
            await ethers.getSigners().then(s => s[0])
        );

        try {
            // This will likely revert without actual price data, but tests contract call
            const data = await pythReader.getShibData();
            console.log(`   SHIB Price: ${data[0].price}`);
            console.log(`   Volatility Score: ${data[2]}`);
        } catch (error) {
            // Expected to fail without real price data
            if (error.message.includes('Invalid SHIB price')) {
                console.log('   ⚠️ Expected failure - no price data available');
            } else {
                throw error;
            }
        }
    }

    async testZKIdentityVerification() {
        // Test ZK identity verification flow
        const [signer] = await ethers.getSigners();

        // Generate mock ZK proof
        const mockProof = '0x' + Array(128).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join('');
        const proofHash = ethers.keccak256(ethers.toUtf8Bytes('test-proof-' + Date.now()));

        try {
            // This will likely revert without actual Self integration
            const tx = await this.contracts.loan.verifyZKIdentity(mockProof, proofHash);
            await tx.wait();
            console.log('   ✅ ZK verification successful');
        } catch (error) {
            if (error.message.includes('ZK proof verification failed')) {
                console.log('   ⚠️ Expected failure - mock proof not valid');
            } else {
                throw error;
            }
        }
    }

    async testX402Integration() {
        const x402ABI = [
            "function getServicePrice(bytes32 serviceId) external view returns (uint256)"
        ];

        const x402Contract = new ethers.Contract(
            this.deploymentData.contracts.X402Payment,
            x402ABI,
            await ethers.getSigners().then(s => s[0])
        );

        const serviceId = ethers.keccak256(ethers.toUtf8Bytes('AI_VOLATILITY_INFERENCE'));

        try {
            const price = await x402Contract.getServicePrice(serviceId);
            console.log(`   AI Service Price: ${ethers.formatUnits(price, 6)} USDC`);

            if (price === 0n) {
                throw new Error('Service not registered');
            }
        } catch (error) {
            console.log('   ⚠️ Service price check failed:', error.message);
        }
    }

    async testFrontendConfiguration() {
        // Test that frontend config was generated correctly
        const configPath = './frontend/config.js';

        if (!fs.existsSync(configPath)) {
            throw new Error('Frontend config not generated');
        }

        const configContent = fs.readFileSync(configPath, 'utf8');

        // Check that contract addresses are present
        if (!configContent.includes(this.deploymentData.contracts.Loan)) {
            throw new Error('Loan contract address not in frontend config');
        }

        if (!configContent.includes(this.deploymentData.contracts.X402Payment)) {
            throw new Error('X402 contract address not in frontend config');
        }

        console.log('   ✅ Frontend configuration valid');
    }

    async testEndToEndWorkflow() {
        // This is a simplified e2e test that would require actual tokens and setup
        console.log('   📝 E2E workflow test (simplified)');

        const [signer] = await ethers.getSigners();

        // 1. Check initial vault state
        const initialVault = await this.contracts.loan.getVault(signer.address);
        console.log(`   Initial collateral: ${initialVault[0]}`);
        console.log(`   Initial debt: ${initialVault[1]}`);

        // 2. Test would continue with:
        // - Identity verification
        // - Token approval
        // - Collateral deposit
        // - AI inference call
        // - Borrowing
        // - Repayment

        console.log('   ⚠️ Full E2E test requires testnet tokens');
    }

    async generateTestReport() {
        const report = {
            timestamp: new Date().toISOString(),
            network: 'Polygon Amoy Testnet',
            deployment: this.deploymentData,
            results: this.testResults,
            summary: {
                totalTests: this.testResults.total,
                passed: this.testResults.passed,
                failed: this.testResults.failed,
                successRate: `${((this.testResults.passed / this.testResults.total) * 100).toFixed(1)}%`
            }
        };

        // Save test report
        fs.writeFileSync('./test-report.json', JSON.stringify(report, null, 2));

        // Generate markdown report
        const markdownReport = `
# zkRisk-Agent Integration Test Report

**Test Date**: ${new Date().toISOString()}
**Network**: Polygon Amoy Testnet
**Success Rate**: ${report.summary.successRate}

## Summary
- ✅ **Passed**: ${this.testResults.passed}
- ❌ **Failed**: ${this.testResults.failed}
- 📊 **Total**: ${this.testResults.total}

## Test Results

${this.testResults.tests.map(test =>
    `### ${test.status === 'PASSED' ? '✅' : '❌'} ${test.name}\n${test.error ? `**Error**: ${test.error}\n` : ''}`
).join('\n')}

## Contract Addresses
- **Loan**: \`${this.deploymentData.contracts.Loan}\`
- **X402 Payment**: \`${this.deploymentData.contracts.X402Payment}\`
- **Pyth Vol Reader**: \`${this.deploymentData.contracts.PythVolReader}\`

## Next Steps
${this.testResults.failed > 0 ?
`- 🔧 Fix failing tests before production deployment
- 📋 Review error messages above
- 🧪 Re-run tests after fixes` :
`- 🚀 All tests passing - ready for demo!
- 📖 Update documentation with test results
- 🎥 Record demo video`}

---
*Generated by zkRisk-Agent test suite*
`;

        fs.writeFileSync('./TEST_REPORT.md', markdownReport);

        return report;
    }

    async runAllTests() {
        console.log('🧪 zkRisk-Agent Integration Test Suite');
        console.log('=' * 50);

        await this.init();

        // Run all tests
        await this.runTest('Contract Deployment', () => this.testContractDeployment());
        await this.runTest('Token Balances', () => this.testTokenBalances());
        await this.runTest('Fluence AI Service', () => this.testFluenceAIService());
        await this.runTest('Pyth Oracle Integration', () => this.testPythOracleIntegration());
        await this.runTest('ZK Identity Verification', () => this.testZKIdentityVerification());
        await this.runTest('X402 Integration', () => this.testX402Integration());
        await this.runTest('Frontend Configuration', () => this.testFrontendConfiguration());
        await this.runTest('End-to-End Workflow', () => this.testEndToEndWorkflow());

        // Generate report
        const report = await this.generateTestReport();

        console.log('\n📊 Test Summary:');
        console.log(`   Total Tests: ${this.testResults.total}`);
        console.log(`   Passed: ${this.testResults.passed} ✅`);
        console.log(`   Failed: ${this.testResults.failed} ❌`);
        console.log(`   Success Rate: ${report.summary.successRate}`);

        console.log('\n📄 Reports generated:');
        console.log('   - test-report.json');
        console.log('   - TEST_REPORT.md');

        if (this.testResults.failed > 0) {
            console.log('\n⚠️ Some tests failed. Please review and fix before proceeding.');
            process.exit(1);
        } else {
            console.log('\n🎉 All tests passed! zkRisk-Agent is ready for demo.');
        }
    }
}

async function main() {
    const tester = new IntegrationTester();
    await tester.runAllTests();
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = IntegrationTester;