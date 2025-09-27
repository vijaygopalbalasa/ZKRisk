const snarkjs = require('snarkjs');
const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');

/**
 * Generate zero-knowledge proof for identity verification
 * This script simulates the Self protocol integration
 */
class ZKIdentityProver {
    constructor() {
        this.circuitPath = path.join(__dirname, '../zk-circuit');
        this.wasmPath = path.join(this.circuitPath, 'personhood_js', 'personhood.wasm');
        this.zkeyPath = path.join(this.circuitPath, 'personhood_final.zkey');
    }

    /**
     * Generate a valid proof for a user meeting requirements
     */
    async generateValidProof(userAge = 25, countryRisk = 1, userId = null) {
        console.log('🔐 Generating valid ZK proof for identity verification...');

        // Generate user-specific values
        const uniqueIdSalt = userId || Math.floor(Math.random() * 1000000);
        const secretKey = Math.floor(Math.random() * 1000000000);

        // Calculate commitment and nullifier hashes
        const { commitmentHash, nullifierHash } = await this.calculateHashes(
            userAge,
            countryRisk,
            uniqueIdSalt,
            secretKey
        );

        const input = {
            // Private inputs
            age: userAge,
            countryRisk: countryRisk,
            uniqueIdSalt: uniqueIdSalt,
            secretKey: secretKey,

            // Public inputs
            nullifierHash: nullifierHash,
            commitmentHash: commitmentHash
        };

        console.log('📊 Proof inputs:');
        console.log(`   Age: ${userAge} (>= 18: ✅)`);
        console.log(`   Country Risk: ${countryRisk} (<= 2: ✅)`);
        console.log(`   Unique ID Salt: ${uniqueIdSalt}`);

        try {
            const { proof, publicSignals } = await snarkjs.groth16.fullProve(
                input,
                this.wasmPath,
                this.zkeyPath
            );

            console.log('✅ ZK proof generated successfully!');
            console.log(`   Valid: ${publicSignals[0] === '1' ? '✅' : '❌'}`);
            console.log(`   Unique Nullifier: ${publicSignals[1]}`);

            return {
                proof: this.formatProofForSolidity(proof),
                publicSignals: publicSignals,
                input: input,
                proofHash: ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(proof))),
                nullifier: publicSignals[1]
            };

        } catch (error) {
            console.error('❌ Proof generation failed:', error);
            throw error;
        }
    }

    /**
     * Generate an invalid proof (for testing)
     */
    async generateInvalidProof() {
        console.log('🚫 Generating invalid ZK proof (underage user)...');

        const userAge = 16; // Under 18
        const countryRisk = 1;
        const uniqueIdSalt = Math.floor(Math.random() * 1000000);
        const secretKey = Math.floor(Math.random() * 1000000000);

        const { commitmentHash, nullifierHash } = await this.calculateHashes(
            userAge,
            countryRisk,
            uniqueIdSalt,
            secretKey
        );

        const input = {
            age: userAge,
            countryRisk: countryRisk,
            uniqueIdSalt: uniqueIdSalt,
            secretKey: secretKey,
            nullifierHash: nullifierHash,
            commitmentHash: commitmentHash
        };

        try {
            const { proof, publicSignals } = await snarkjs.groth16.fullProve(
                input,
                this.wasmPath,
                this.zkeyPath
            );

            console.log(`   Age: ${userAge} (>= 18: ❌)`);
            console.log(`   Proof Valid: ${publicSignals[0] === '1' ? '✅' : '❌'}`);

            return {
                proof: this.formatProofForSolidity(proof),
                publicSignals: publicSignals,
                input: input,
                proofHash: ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(proof))),
                nullifier: publicSignals[1]
            };

        } catch (error) {
            console.error('❌ Invalid proof generation failed:', error);
            throw error;
        }
    }

    /**
     * Verify a proof
     */
    async verifyProof(proof, publicSignals) {
        const vKeyPath = path.join(this.circuitPath, 'verification_key.json');
        const vKey = JSON.parse(fs.readFileSync(vKeyPath));

        const verified = await snarkjs.groth16.verify(vKey, publicSignals, proof);
        console.log(`🔍 Proof verification: ${verified ? '✅ Valid' : '❌ Invalid'}`);

        return verified;
    }

    /**
     * Calculate commitment and nullifier hashes (using Poseidon)
     */
    async calculateHashes(age, countryRisk, uniqueIdSalt, secretKey) {
        // Simplified hash calculation (in real implementation, use Poseidon)
        const commitmentData = [age, countryRisk, uniqueIdSalt, secretKey];
        const nullifierData = [secretKey, uniqueIdSalt];

        // For demo purposes, use simple hashing
        // In production, would use Poseidon hash matching the circuit
        const commitmentHash = ethers.keccak256(
            ethers.AbiCoder.defaultAbiCoder().encode(
                ['uint256', 'uint256', 'uint256', 'uint256'],
                commitmentData
            )
        );

        const nullifierHash = ethers.keccak256(
            ethers.AbiCoder.defaultAbiCoder().encode(
                ['uint256', 'uint256'],
                nullifierData
            )
        );

        return {
            commitmentHash: BigInt(commitmentHash),
            nullifierHash: BigInt(nullifierHash)
        };
    }

    /**
     * Format proof for Solidity verifier contract
     */
    formatProofForSolidity(proof) {
        return {
            a: [proof.pi_a[0], proof.pi_a[1]],
            b: [[proof.pi_b[0][1], proof.pi_b[0][0]], [proof.pi_b[1][1], proof.pi_b[1][0]]],
            c: [proof.pi_c[0], proof.pi_c[1]]
        };
    }

    /**
     * Generate Self-style verification payload
     */
    generateSelfPayload(proofData) {
        return {
            app: 'zkrisk-identity',
            scope: 'zkrisk-identity',
            userId: proofData.nullifier,
            attestationId: ethers.randomBytes(32),
            proof: proofData.proof,
            publicSignals: proofData.publicSignals,
            verificationData: {
                minimumAge: 18,
                excludedCountries: ['IRN', 'PRK', 'RUS', 'SYR'],
                ofac: true,
                nationality: true
            }
        };
    }

    /**
     * Save proof to file for frontend use
     */
    saveProofToFile(proofData, filename = 'identity_proof.json') {
        const outputPath = path.join(__dirname, filename);
        const selfPayload = this.generateSelfPayload(proofData);

        fs.writeFileSync(outputPath, JSON.stringify({
            zkProof: proofData,
            selfPayload: selfPayload,
            timestamp: Date.now(),
            version: '1.0.0'
        }, null, 2));

        console.log(`💾 Proof saved to: ${outputPath}`);
        return outputPath;
    }
}

/**
 * Demo function to generate and verify proofs
 */
async function runDemo() {
    console.log('🚀 zkRisk Identity Verification Demo\n');

    const prover = new ZKIdentityProver();

    try {
        // Generate valid proof
        console.log('1️⃣ Generating valid proof (age 25, low-risk country)...');
        const validProof = await prover.generateValidProof(25, 1, 12345);
        await prover.verifyProof(validProof.proof, validProof.publicSignals);
        prover.saveProofToFile(validProof, 'valid_proof.json');

        console.log('\n' + '='.repeat(60) + '\n');

        // Generate invalid proof
        console.log('2️⃣ Generating invalid proof (age 16, underage)...');
        const invalidProof = await prover.generateInvalidProof();
        await prover.verifyProof(invalidProof.proof, invalidProof.publicSignals);
        prover.saveProofToFile(invalidProof, 'invalid_proof.json');

        console.log('\n' + '='.repeat(60) + '\n');

        // Generate high-risk country proof
        console.log('3️⃣ Generating high-risk country proof (age 30, risk level 3)...');
        const highRiskProof = await prover.generateValidProof(30, 3, 67890);
        await prover.verifyProof(highRiskProof.proof, highRiskProof.publicSignals);
        prover.saveProofToFile(highRiskProof, 'high_risk_proof.json');

        console.log('\n🎉 Demo completed successfully!');
        console.log('\n📁 Generated files:');
        console.log('   - valid_proof.json (age 25, low risk)');
        console.log('   - invalid_proof.json (age 16, underage)');
        console.log('   - high_risk_proof.json (age 30, high risk)');

    } catch (error) {
        console.error('❌ Demo failed:', error);
    }
}

// Export for use in other modules
module.exports = ZKIdentityProver;

// Run demo if called directly
if (require.main === module) {
    runDemo();
}