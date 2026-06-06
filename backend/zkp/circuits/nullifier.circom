// Simple nullifier circuit (prototype)
// Proof of knowledge of `emailHash` such that nullifier = emailHash + electionID
pragma circom 2.0.0;

template Nullifier() {
    // private input
    signal input emailHash;
    // public input
    signal input electionID;
    // public output
    signal output nullifier;

    nullifier <== emailHash + electionID;
}

component main = Nullifier();
