pragma circom 2.1.6;

include "circomlib/circuits/poseidon.circom";

template AuthenticityProof() {
    // Private inputs
    signal input walletAddress;      // User's Flare wallet (as field element)
    signal input uniqueIdentifier;   // Hash of biometric/document data
    signal input salt;               // Random salt for privacy
    signal input nullifierSecret;    // Secret for generating nullifier
    
    // Public inputs
    signal input commitment;         // Public commitment to verify against
    signal input nullifier;          // Prevents double-registration
    
    // Compute commitment: poseidon(wallet, identifier, salt)
    component commitmentHasher = Poseidon(3);
    commitmentHasher.inputs[0] <== walletAddress;
    commitmentHasher.inputs[1] <== uniqueIdentifier;
    commitmentHasher.inputs[2] <== salt;
    
    // Verify commitment matches public input
    commitment === commitmentHasher.out;
    
    // Compute nullifier: poseidon(nullifierSecret, uniqueIdentifier)
    // This ensures same identifier can't register twice
    component nullifierHasher = Poseidon(2);
    nullifierHasher.inputs[0] <== nullifierSecret;
    nullifierHasher.inputs[1] <== uniqueIdentifier;
    
    // Verify nullifier matches
    nullifier === nullifierHasher.out;
}

component main { public [commitment, nullifier] } = AuthenticityProof();
