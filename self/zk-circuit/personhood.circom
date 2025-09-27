pragma circom 2.1.6;

include "circomlib/circuits/comparators.circom";
include "circomlib/circuits/bitify.circom";
include "circomlib/circuits/poseidon.circom";

/**
 * @title PersonhoodVerification
 * @dev Zero-knowledge circuit for verifying identity requirements
 * Proves: age >= 18, country risk <= 2, unique identity
 * Without revealing: actual age, country, or personal data
 */
template PersonhoodVerification() {
    // Private inputs (known only to prover)
    signal private input age;           // Actual age
    signal private input countryRisk;   // Country risk score (0=low, 3=high)
    signal private input uniqueIdSalt;  // Salt for unique identity
    signal private input secretKey;     // User's secret key

    // Public inputs (verifiable by anyone)
    signal input nullifierHash;        // Prevents double-spending
    signal input commitmentHash;       // Commitment to user data

    // Output signals
    signal output valid;               // 1 if all requirements met, 0 otherwise
    signal output uniqueNullifier;    // Unique nullifier for this proof

    // Internal components
    component ageCheck = GreaterEqualThan(8);   // Check age >= 18
    component riskCheck = LessEqualThan(8);     // Check country risk <= 2
    component nullifierHasher = Poseidon(2);   // Generate nullifier
    component commitmentHasher = Poseidon(4);  // Generate commitment

    // Age verification: must be >= 18
    ageCheck.in[0] <== age;
    ageCheck.in[1] <== 18;

    // Country risk verification: must be <= 2 (low to medium risk)
    riskCheck.in[0] <== countryRisk;
    riskCheck.in[1] <== 2;

    // Generate unique nullifier to prevent double-spending
    nullifierHasher.inputs[0] <== secretKey;
    nullifierHasher.inputs[1] <== uniqueIdSalt;
    uniqueNullifier <== nullifierHasher.out;

    // Verify nullifier hash matches public input
    component nullifierVerify = IsEqual();
    nullifierVerify.in[0] <== uniqueNullifier;
    nullifierVerify.in[1] <== nullifierHash;

    // Generate commitment hash
    commitmentHasher.inputs[0] <== age;
    commitmentHasher.inputs[1] <== countryRisk;
    commitmentHasher.inputs[2] <== uniqueIdSalt;
    commitmentHasher.inputs[3] <== secretKey;

    // Verify commitment hash matches public input
    component commitmentVerify = IsEqual();
    commitmentVerify.in[0] <== commitmentHasher.out;
    commitmentVerify.in[1] <== commitmentHash;

    // All conditions must be satisfied
    component finalCheck = IsEqual();
    finalCheck.in[0] <== ageCheck.out + riskCheck.out + nullifierVerify.out + commitmentVerify.out;
    finalCheck.in[1] <== 4; // All 4 checks must pass

    valid <== finalCheck.out;
}

/**
 * @title AgeVerification
 * @dev Simplified circuit for age verification only
 */
template AgeVerification() {
    signal private input age;
    signal private input nonce;
    signal input ageCommitment;
    signal output isAdult;

    component ageCheck = GreaterEqualThan(8);
    component hasher = Poseidon(2);
    component verifyCommitment = IsEqual();

    // Check if age >= 18
    ageCheck.in[0] <== age;
    ageCheck.in[1] <== 18;

    // Verify age commitment
    hasher.inputs[0] <== age;
    hasher.inputs[1] <== nonce;

    verifyCommitment.in[0] <== hasher.out;
    verifyCommitment.in[1] <== ageCommitment;

    // Both age check and commitment verification must pass
    component finalAnd = IsEqual();
    finalAnd.in[0] <== ageCheck.out + verifyCommitment.out;
    finalAnd.in[1] <== 2;

    isAdult <== finalAnd.out;
}

/**
 * @title CountryRiskVerification
 * @dev Circuit for verifying country risk level
 */
template CountryRiskVerification() {
    signal private input countryCode;    // ISO country code as number
    signal private input riskScore;      // Risk score 0-3
    signal private input nonce;
    signal input riskCommitment;
    signal output lowRisk;

    component riskCheck = LessEqualThan(8);
    component hasher = Poseidon(3);
    component verifyCommitment = IsEqual();

    // Check if risk score <= 2
    riskCheck.in[0] <== riskScore;
    riskCheck.in[1] <== 2;

    // Verify risk commitment
    hasher.inputs[0] <== countryCode;
    hasher.inputs[1] <== riskScore;
    hasher.inputs[2] <== nonce;

    verifyCommitment.in[0] <== hasher.out;
    verifyCommitment.in[1] <== riskCommitment;

    // Both risk check and commitment verification must pass
    component finalAnd = IsEqual();
    finalAnd.in[0] <== riskCheck.out + verifyCommitment.out;
    finalAnd.in[1] <== 2;

    lowRisk <== finalAnd.out;
}

/**
 * @title AntiSybilVerification
 * @dev Circuit for preventing Sybil attacks using unique identity
 */
template AntiSybilVerification() {
    signal private input biometricHash;  // Hash of biometric data
    signal private input deviceId;       // Unique device identifier
    signal private input secretSalt;     // Secret salt
    signal input nullifierSeed;         // Public nullifier seed
    signal output nullifier;            // Unique nullifier for this identity
    signal output validIdentity;        // 1 if identity is valid

    component hasher = Poseidon(4);
    component validator = IsEqual();

    // Generate unique nullifier
    hasher.inputs[0] <== biometricHash;
    hasher.inputs[1] <== deviceId;
    hasher.inputs[2] <== secretSalt;
    hasher.inputs[3] <== nullifierSeed;

    nullifier <== hasher.out;

    // Simple validation - ensure inputs are non-zero
    component biometricCheck = IsZero();
    component deviceCheck = IsZero();

    biometricCheck.in <== biometricHash;
    deviceCheck.in <== deviceId;

    // Valid if both biometric and device hashes are non-zero
    component isValidCheck = IsEqual();
    isValidCheck.in[0] <== biometricCheck.out + deviceCheck.out;
    isValidCheck.in[1] <== 0; // Both checks should be 0 (not zero)

    validIdentity <== isValidCheck.out;
}

// Main component - choose which verification to use
component main = PersonhoodVerification();