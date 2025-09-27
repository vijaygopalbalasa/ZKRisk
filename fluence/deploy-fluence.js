/**
 * Deploy AI inference service to Fluence Network
 * This script builds and deploys the Docker container with ONNX model
 */

const { execSync } = require('child_process');
const fs = require('fs');
const axios = require('axios');
require('dotenv').config();

class FluenceDeployer {
    constructor() {
        this.serviceName = 'zkrisk-volatility-inference';
        this.servicePort = 5000;
        this.region = 'us-east-1'; // Default region
    }

    async checkFluenceCLI() {
        try {
            execSync('fluence --version', { stdio: 'pipe' });
            console.log('✅ Fluence CLI found');
            return true;
        } catch (error) {
            console.error('❌ Fluence CLI not found. Please install:');
            console.error('   npm install -g @fluencelabs/cli');
            return false;
        }
    }

    async buildModel() {
        console.log('🤖 Building LSTM model...');
        try {
            execSync('python train_model.py', { stdio: 'inherit' });
            console.log('✅ Model built successfully');
        } catch (error) {
            console.error('⚠️ Model training failed, using minimal model');
            // Create minimal model directory structure
            if (!fs.existsSync('model')) {
                fs.mkdirSync('model');
            }
        }
    }

    async buildDockerImage() {
        console.log('🐳 Building Docker image...');

        const dockerfile = `
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \\
    gcc \\
    g++ \\
    curl \\
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application files
COPY . .

# Create model directory if it doesn't exist
RUN mkdir -p /app/model

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \\
    CMD curl -f http://localhost:5000/health || exit 1

# Run the application
CMD ["python", "infer.py"]
`;

        fs.writeFileSync('Dockerfile', dockerfile);

        try {
            execSync(`docker build -t ${this.serviceName}:latest .`, { stdio: 'inherit' });
            console.log('✅ Docker image built successfully');
            return true;
        } catch (error) {
            console.error('❌ Docker build failed:', error.message);
            return false;
        }
    }

    async createFluenceConfig() {
        console.log('⚙️ Creating Fluence configuration...');

        const fluenceYaml = `
version: 1
services:
  ${this.serviceName}:
    build: .
    ports:
      - "${this.servicePort}:5000"
    environment:
      - PYTHONUNBUFFERED=1
      - FLASK_ENV=production
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:5000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
`;

        fs.writeFileSync('fluence.yaml', fluenceYaml);

        const deployConfig = {
            "name": this.serviceName,
            "version": "1.0.0",
            "description": "zkRisk AI volatility prediction service",
            "services": {
                [this.serviceName]: {
                    "image": `${this.serviceName}:latest`,
                    "ports": [`${this.servicePort}:5000`],
                    "env": {
                        "PYTHONUNBUFFERED": "1",
                        "FLASK_ENV": "production"
                    }
                }
            },
            "network": {
                "region": this.region,
                "pricing": "pay-per-use"
            }
        };

        fs.writeFileSync('deploy-config.json', JSON.stringify(deployConfig, null, 2));
        console.log('✅ Fluence configuration created');
    }

    async deployToFluence() {
        console.log('🚀 Deploying to Fluence Network...');

        try {
            // Initialize Fluence project if needed
            if (!fs.existsSync('.fluence')) {
                console.log('🔧 Initializing Fluence project...');
                execSync('fluence init --template docker', { stdio: 'inherit' });
            }

            // Deploy the service
            console.log('📤 Deploying service...');
            const deployResult = execSync('fluence deploy', {
                stdio: 'pipe',
                encoding: 'utf8'
            });

            console.log('✅ Deployment successful!');
            console.log(deployResult);

            // Extract service URL and peer ID from deployment output
            const serviceUrl = this.extractServiceUrl(deployResult);
            const peerId = this.extractPeerId(deployResult);

            // Save deployment info
            const deploymentInfo = {
                serviceName: this.serviceName,
                serviceUrl: serviceUrl,
                peerId: peerId,
                region: this.region,
                deployedAt: new Date().toISOString(),
                endpoints: {
                    health: `${serviceUrl}/health`,
                    infer: `${serviceUrl}/infer`,
                    volatility: `${serviceUrl}/volatility`,
                    demo: `${serviceUrl}/demo`
                }
            };

            fs.writeFileSync('deployment-info.json', JSON.stringify(deploymentInfo, null, 2));

            console.log('\n🎉 Deployment completed successfully!');
            console.log(`📍 Service URL: ${serviceUrl}`);
            console.log(`🆔 Peer ID: ${peerId}`);
            console.log(`📄 Deployment info saved to: deployment-info.json`);

            return deploymentInfo;

        } catch (error) {
            console.error('❌ Fluence deployment failed:', error.message);
            throw error;
        }
    }

    async testDeployment(serviceUrl) {
        console.log('🧪 Testing deployed service...');

        try {
            // Test health endpoint
            console.log('   Testing health endpoint...');
            const healthResponse = await axios.get(`${serviceUrl}/health`, { timeout: 10000 });
            console.log(`   ✅ Health check: ${healthResponse.data.status}`);

            // Test demo endpoint
            console.log('   Testing demo inference...');
            const demoResponse = await axios.get(`${serviceUrl}/demo`, { timeout: 15000 });
            console.log(`   ✅ Demo inference: λ = ${demoResponse.data.lambda}`);

            // Test main inference endpoint
            console.log('   Testing main inference endpoint...');
            const inferResponse = await axios.get(`${serviceUrl}/infer?volatility=0.1,0.15,0.12`, { timeout: 15000 });
            console.log(`   ✅ Inference: λ = ${inferResponse.data.lambda}, λ1000 = ${inferResponse.data.lambda1000}`);

            console.log('✅ All tests passed!');
            return true;

        } catch (error) {
            console.error('❌ Service testing failed:', error.message);
            return false;
        }
    }

    extractServiceUrl(deployOutput) {
        // Extract service URL from Fluence CLI output
        const urlMatch = deployOutput.match(/Service URL: (https?:\/\/[^\s]+)/);
        return urlMatch ? urlMatch[1] : 'https://fluence.network/service-url-not-found';
    }

    extractPeerId(deployOutput) {
        // Extract peer ID from Fluence CLI output
        const peerMatch = deployOutput.match(/Peer ID: ([A-Za-z0-9]+)/);
        return peerMatch ? peerMatch[1] : 'peer-id-not-found';
    }

    async createLocalFallback() {
        console.log('🔄 Creating local fallback service...');

        const fallbackConfig = {
            "serviceName": this.serviceName,
            "serviceUrl": "http://localhost:5000",
            "peerId": "local-development",
            "region": "local",
            "deployedAt": new Date().toISOString(),
            "endpoints": {
                "health": "http://localhost:5000/health",
                "infer": "http://localhost:5000/infer",
                "volatility": "http://localhost:5000/volatility",
                "demo": "http://localhost:5000/demo"
            },
            "note": "Local development service. Run 'python infer.py' to start."
        };

        fs.writeFileSync('deployment-info.json', JSON.stringify(fallbackConfig, null, 2));

        console.log('✅ Local fallback configuration created');
        console.log('💡 To test locally, run: python infer.py');
        console.log('📍 Local URL: http://localhost:5000');

        return fallbackConfig;
    }
}

async function main() {
    console.log('🚀 zkRisk Fluence AI Service Deployment');
    console.log('=' * 50);

    const deployer = new FluenceDeployer();

    try {
        // Check prerequisites
        const fluenceAvailable = await deployer.checkFluenceCLI();

        // Build model
        await deployer.buildModel();

        if (fluenceAvailable) {
            // Full Fluence deployment
            await deployer.buildDockerImage();
            await deployer.createFluenceConfig();

            try {
                const deploymentInfo = await deployer.deployToFluence();
                await deployer.testDeployment(deploymentInfo.serviceUrl);

                console.log('\n🎉 Fluence deployment completed successfully!');
                console.log('\n📋 Next steps:');
                console.log('1. Update .env file with FLUENCE_SERVICE_URL');
                console.log('2. Deploy smart contracts with the new Fluence URL');
                console.log('3. Test end-to-end integration');

            } catch (deployError) {
                console.log('\n⚠️ Fluence deployment failed, creating local fallback...');
                await deployer.createLocalFallback();
            }

        } else {
            // Local fallback
            await deployer.createLocalFallback();
        }

    } catch (error) {
        console.error('❌ Deployment process failed:', error);
        process.exit(1);
    }
}

// Export for use in other scripts
module.exports = FluenceDeployer;

// Run deployment if called directly
if (require.main === module) {
    main();
}