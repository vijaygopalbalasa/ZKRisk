const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

/**
 * Production Deployment Script for Fluence AI Service
 * Deploys zkRisk AI volatility inference service to Fluence Network
 */

// Production configuration
const PRODUCTION_CONFIG = {
  FLUENCE_NETWORK: process.env.FLUENCE_NETWORK || 'testnet',
  SERVICE_NAME: 'zkrisk-ai-volatility',
  DOCKER_IMAGE: 'zkrisk/ai-service:latest',
  MEMORY_LIMIT: '512MB',
  CPU_LIMIT: '0.5',
  TIMEOUT: 30000, // 30 seconds
  MAX_INSTANCES: 3,
  MIN_INSTANCES: 1,
  HEALTH_CHECK_PATH: '/health',
  METRICS_ENABLED: true
};

// Real contract addresses (will be updated after smart contract deployment)
const CONTRACT_ADDRESSES = {
  POLYGON_AMOY: {
    USDC: '0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582',
    LOAN: process.env.LOAN_CONTRACT_ADDRESS || '',
    X402: process.env.X402_CONTRACT_ADDRESS || '',
    ORACLE: process.env.ORACLE_CONTRACT_ADDRESS || ''
  }
};

async function main() {
  console.log('🚀 Starting Fluence AI Service Production Deployment');
  console.log('=================================================');

  try {
    // 1. Validate prerequisites
    await validatePrerequisites();

    // 2. Build production Docker image
    await buildDockerImage();

    // 3. Test service locally
    await testServiceLocally();

    // 4. Deploy to Fluence Network
    const serviceId = await deployToFluence();

    // 5. Configure service endpoints
    await configureService(serviceId);

    // 6. Run health checks
    await runHealthChecks(serviceId);

    // 7. Update contract addresses
    await updateContractAddresses(serviceId);

    console.log('\n🎉 Deployment completed successfully!');
    console.log('=====================================');
    console.log(`Service ID: ${serviceId}`);
    console.log(`Network: ${PRODUCTION_CONFIG.FLUENCE_NETWORK}`);
    console.log(`Health Check: ${serviceId}/health`);
    console.log(`Inference Endpoint: ${serviceId}/infer`);

    // Save deployment info
    const deploymentInfo = {
      timestamp: new Date().toISOString(),
      serviceId,
      network: PRODUCTION_CONFIG.FLUENCE_NETWORK,
      config: PRODUCTION_CONFIG,
      contracts: CONTRACT_ADDRESSES,
      endpoints: {
        health: `${serviceId}/health`,
        inference: `${serviceId}/infer`,
        metrics: `${serviceId}/metrics`
      }
    };

    fs.writeFileSync(
      path.join(__dirname, 'deployment-info.json'),
      JSON.stringify(deploymentInfo, null, 2)
    );

    console.log('\n📄 Deployment info saved to deployment-info.json');

  } catch (error) {
    console.error('❌ Deployment failed:', error.message);
    process.exit(1);
  }
}

async function validatePrerequisites() {
  console.log('\n🔍 Validating prerequisites...');

  // Check required files
  const requiredFiles = [
    'infer.py',
    'requirements.txt',
    'Dockerfile',
    'model/lstm_vol.onnx'
  ];

  for (const file of requiredFiles) {
    if (!fs.existsSync(file)) {
      throw new Error(`Required file missing: ${file}`);
    }
  }

  // Check environment variables
  const requiredEnvVars = [
    'FLUENCE_VM_ID',
    'LOAN_CONTRACT_ADDRESS',
    'X402_CONTRACT_ADDRESS',
    'ORACLE_CONTRACT_ADDRESS'
  ];

  const missingVars = requiredEnvVars.filter(env => !process.env[env]);
  if (missingVars.length > 0) {
    console.warn(`⚠️  Missing environment variables: ${missingVars.join(', ')}`);
    console.warn('   Service will use default values');
  }

  // Check Fluence CLI
  try {
    await execCommand('fluence --version');
    console.log('✅ Fluence CLI available');
  } catch (error) {
    throw new Error('Fluence CLI not installed. Install with: npm install -g @fluencelabs/cli');
  }

  // Check Docker
  try {
    await execCommand('docker --version');
    console.log('✅ Docker available');
  } catch (error) {
    throw new Error('Docker not available. Please install Docker.');
  }

  console.log('✅ All prerequisites validated');
}

async function buildDockerImage() {
  console.log('\n🏗️  Building production Docker image...');

  // Create optimized Dockerfile for production
  const productionDockerfile = `
FROM python:3.9-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \\
    gcc \\
    g++ \\
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application files
COPY infer.py .
COPY config.py .
COPY model/ ./model/

# Create non-root user
RUN useradd -m -u 1000 fluence
USER fluence

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \\
  CMD curl -f http://localhost:5000/health || exit 1

# Expose port
EXPOSE 5000

# Set production environment
ENV FLASK_ENV=production
ENV PYTHONUNBUFFERED=1

# Start application with gunicorn for production
CMD ["python", "-m", "gunicorn", "--bind", "0.0.0.0:5000", "--workers", "2", "--timeout", "30", "infer:app"]
`;

  fs.writeFileSync('Dockerfile.prod', productionDockerfile);

  try {
    await execCommand(`docker build -f Dockerfile.prod -t ${PRODUCTION_CONFIG.DOCKER_IMAGE} .`);
    console.log('✅ Docker image built successfully');
  } catch (error) {
    throw new Error(`Docker build failed: ${error.message}`);
  }
}

async function testServiceLocally() {
  console.log('\n🧪 Testing service locally...');

  // Start container
  const containerId = await execCommand(
    `docker run -d -p 5001:5000 --name zkrisk-test ${PRODUCTION_CONFIG.DOCKER_IMAGE}`
  );

  try {
    // Wait for service to start
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Test health endpoint
    const healthResponse = await axios.get('http://localhost:5001/health', { timeout: 10000 });
    if (healthResponse.status !== 200) {
      throw new Error('Health check failed');
    }

    // Test inference endpoint
    const inferenceResponse = await axios.post('http://localhost:5001/infer', {
      volatility_data: [0.1, 0.15, 0.12, 0.18, 0.14]
    }, { timeout: 10000 });

    if (inferenceResponse.status !== 200 || !inferenceResponse.data.lambda) {
      throw new Error('Inference test failed');
    }

    console.log('✅ Local service tests passed');
    console.log(`   Lambda result: ${inferenceResponse.data.lambda}`);

  } finally {
    // Clean up test container
    await execCommand(`docker stop ${containerId.trim()}`);
    await execCommand(`docker rm ${containerId.trim()}`);
  }
}

async function deployToFluence() {
  console.log('\n🌐 Deploying to Fluence Network...');

  // Create Fluence service configuration
  const serviceConfig = {
    name: PRODUCTION_CONFIG.SERVICE_NAME,
    image: PRODUCTION_CONFIG.DOCKER_IMAGE,
    resources: {
      memory: PRODUCTION_CONFIG.MEMORY_LIMIT,
      cpu: PRODUCTION_CONFIG.CPU_LIMIT
    },
    scaling: {
      min: PRODUCTION_CONFIG.MIN_INSTANCES,
      max: PRODUCTION_CONFIG.MAX_INSTANCES
    },
    healthCheck: {
      path: PRODUCTION_CONFIG.HEALTH_CHECK_PATH,
      interval: 30,
      timeout: 10
    },
    environment: {
      FLUENCE_VM_ID: process.env.FLUENCE_VM_ID,
      LOAN_CONTRACT_ADDRESS: CONTRACT_ADDRESSES.POLYGON_AMOY.LOAN,
      X402_CONTRACT_ADDRESS: CONTRACT_ADDRESSES.POLYGON_AMOY.X402,
      ORACLE_CONTRACT_ADDRESS: CONTRACT_ADDRESSES.POLYGON_AMOY.ORACLE,
      PRODUCTION: 'true'
    }
  };

  fs.writeFileSync('fluence-service.json', JSON.stringify(serviceConfig, null, 2));

  try {
    const deployResult = await execCommand(
      `fluence service deploy --config fluence-service.json --network ${PRODUCTION_CONFIG.FLUENCE_NETWORK}`
    );

    const serviceId = extractServiceId(deployResult);
    console.log(`✅ Service deployed: ${serviceId}`);
    return serviceId;

  } catch (error) {
    throw new Error(`Fluence deployment failed: ${error.message}`);
  }
}

async function configureService(serviceId) {
  console.log('\n⚙️  Configuring service...');

  // Set up service configuration
  const config = {
    serviceId,
    endpoints: {
      inference: '/infer',
      health: '/health',
      metrics: '/metrics'
    },
    pricing: {
      perCall: 0.005, // $0.005 USDC per inference
      currency: 'USDC'
    }
  };

  try {
    // Configure service endpoints and pricing
    await execCommand(`fluence service config set ${serviceId} --config '${JSON.stringify(config)}'`);
    console.log('✅ Service configured');

  } catch (error) {
    console.warn(`⚠️  Service configuration warning: ${error.message}`);
  }
}

async function runHealthChecks(serviceId) {
  console.log('\n🏥 Running health checks...');

  const maxAttempts = 10;
  let attempts = 0;

  while (attempts < maxAttempts) {
    try {
      const healthUrl = `https://${serviceId}.fluence.network/health`;
      const response = await axios.get(healthUrl, { timeout: 5000 });

      if (response.status === 200 && response.data.status === 'healthy') {
        console.log('✅ Health checks passed');
        return;
      }

    } catch (error) {
      attempts++;
      console.log(`⏳ Health check attempt ${attempts}/${maxAttempts}...`);
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }

  throw new Error('Health checks failed - service may not be ready');
}

async function updateContractAddresses(serviceId) {
  console.log('\n📝 Updating contract addresses...');

  // Create deployment summary for contracts
  const contractUpdate = {
    fluenceServiceId: serviceId,
    fluenceEndpoint: `https://${serviceId}.fluence.network`,
    timestamp: new Date().toISOString(),
    contracts: CONTRACT_ADDRESSES.POLYGON_AMOY
  };

  // Save for contract deployment to use
  fs.writeFileSync(
    path.join(__dirname, '..', 'contracts', 'fluence-service.json'),
    JSON.stringify(contractUpdate, null, 2)
  );

  console.log('✅ Contract addresses updated');
}

// Utility functions
function execCommand(command) {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`${error.message}\\n${stderr}`));
      } else {
        resolve(stdout);
      }
    });
  });
}

function extractServiceId(deployOutput) {
  // Parse Fluence CLI output to extract service ID
  const match = deployOutput.match(/Service ID: ([a-zA-Z0-9-]+)/);
  if (match) {
    return match[1];
  }
  throw new Error('Could not extract service ID from deployment output');
}

// Run deployment
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main, PRODUCTION_CONFIG, CONTRACT_ADDRESSES };