const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

async function buildCircuit() {
    console.log('🔧 Building Circom circuit for zkRisk identity verification...');

    const circuitName = 'personhood';
    const circuitFile = `${circuitName}.circom`;

    try {
        // Step 1: Compile the circuit
        console.log('📝 Compiling Circom circuit...');
        execSync(`circom ${circuitFile} --r1cs --wasm --sym --json`, {
            stdio: 'inherit',
            cwd: __dirname
        });

        // Step 2: Download powers of tau ceremony file (if not exists)
        const ptauFile = 'powersOfTau28_hez_final_15.ptau';
        const ptauPath = path.join(__dirname, ptauFile);

        if (!fs.existsSync(ptauPath)) {
            console.log('📦 Downloading powers of tau file...');
            execSync(`wget https://hermez.s3-eu-west-1.amazonaws.com/${ptauFile}`, {
                stdio: 'inherit',
                cwd: __dirname
            });
        }

        // Step 3: Generate verification key
        console.log('🔑 Generating verification key...');
        execSync(`snarkjs groth16 setup ${circuitName}.r1cs ${ptauFile} ${circuitName}_final.zkey`, {
            stdio: 'inherit',
            cwd: __dirname
        });

        // Step 4: Export verification key
        console.log('📤 Exporting verification key...');
        execSync(`snarkjs zkey export verificationkey ${circuitName}_final.zkey verification_key.json`, {
            stdio: 'inherit',
            cwd: __dirname
        });

        // Step 5: Generate Solidity verifier
        console.log('⚡ Generating Solidity verifier...');
        execSync(`snarkjs zkey export solidityverifier ${circuitName}_final.zkey ../contracts/contracts/PersonhoodVerifier.sol`, {
            stdio: 'inherit',
            cwd: __dirname
        });

        // Step 6: Clean up verification key format for Solidity
        const verifierPath = path.join(__dirname, '../contracts/contracts/PersonhoodVerifier.sol');
        if (fs.existsSync(verifierPath)) {
            let verifierContent = fs.readFileSync(verifierPath, 'utf8');

            // Update pragma and contract name
            verifierContent = verifierContent.replace(
                'pragma solidity ^0.6.11;',
                'pragma solidity ^0.8.24;'
            );
            verifierContent = verifierContent.replace(
                'contract Verifier {',
                'contract PersonhoodVerifier {'
            );

            fs.writeFileSync(verifierPath, verifierContent);
            console.log('✅ Updated Solidity verifier for Solidity 0.8.24');
        }

        console.log('✅ Circuit build completed successfully!');
        console.log('📁 Generated files:');
        console.log(`   - ${circuitName}.r1cs (R1CS constraint system)`);
        console.log(`   - ${circuitName}_js/${circuitName}.wasm (WebAssembly circuit)`);
        console.log(`   - ${circuitName}_final.zkey (Proving key)`);
        console.log(`   - verification_key.json (Verification key)`);
        console.log(`   - PersonhoodVerifier.sol (Solidity verifier)`);

    } catch (error) {
        console.error('❌ Circuit build failed:', error.message);
        process.exit(1);
    }
}

// Check if circom is installed
try {
    execSync('circom --version', { stdio: 'pipe' });
} catch (error) {
    console.error('❌ Circom not found. Please install circom first:');
    console.error('   npm install -g circom');
    process.exit(1);
}

// Check if snarkjs is installed
try {
    execSync('snarkjs --version', { stdio: 'pipe' });
} catch (error) {
    console.error('❌ snarkjs not found. Please install snarkjs first:');
    console.error('   npm install -g snarkjs');
    process.exit(1);
}

buildCircuit();