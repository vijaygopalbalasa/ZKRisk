pragma circom 2.0.0;

include "circomlib/circuits/comparators.circom";
include "circomlib/circuits/poseidon.circom";

// ZK circuit to prove creditworthiness without revealing actual income/score
template CreditworthinessProof() {
    // Private inputs (secret)
    signal private input income;           // User's monthly income
    signal private input creditScore;      // User's credit score (300-850)
    signal private input assetValue;       // Total asset value
    signal private input debtAmount;       // Total existing debt
    signal private input salt;             // Random salt for privacy

    // Public inputs
    signal input minIncome;                // Minimum required income
    signal input minCreditScore;           // Minimum required credit score
    signal input maxDebtRatio;             // Maximum debt-to-income ratio (in basis points)
    signal input nullifierHash;           // Prevents double spending/reuse

    // Outputs
    signal output creditHash;              // Hash commitment of creditworthiness
    signal output isEligible;              // 1 if eligible, 0 if not

    // Components for comparisons
    component incomeCheck = GreaterEqThan(32);
    component creditCheck = GreaterEqThan(16);
    component debtRatioCheck = LessEqThan(32);

    // Component for hashing
    component hasher = Poseidon(5);

    // Verify income meets minimum requirement
    incomeCheck.in[0] <== income;
    incomeCheck.in[1] <== minIncome;

    // Verify credit score meets minimum requirement
    creditCheck.in[0] <== creditScore;
    creditCheck.in[1] <== minCreditScore;

    // Calculate debt-to-income ratio (debt * 10000 / income)
    signal debtRatio <== debtAmount * 10000 / income;

    // Verify debt ratio is acceptable
    debtRatioCheck.in[0] <== debtRatio;
    debtRatioCheck.in[1] <== maxDebtRatio;

    // Check if all conditions are met
    signal incomeOk <== incomeCheck.out;
    signal creditOk <== creditCheck.out;
    signal debtOk <== debtRatioCheck.out;

    // Combine all checks (all must be 1)
    signal eligible1 <== incomeOk * creditOk;
    isEligible <== eligible1 * debtOk;

    // Generate commitment hash including salt for privacy
    hasher.inputs[0] <== income;
    hasher.inputs[1] <== creditScore;
    hasher.inputs[2] <== assetValue;
    hasher.inputs[3] <== debtAmount;
    hasher.inputs[4] <== salt;

    creditHash <== hasher.out;

    // Constrain nullifier to prevent reuse
    signal nullifierSquare <== nullifierHash * nullifierHash;
    nullifierSquare === nullifierHash * nullifierHash;
}

component main = CreditworthinessProof();