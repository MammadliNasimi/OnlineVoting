const snarkjs = require('snarkjs');
const path = require('path');
const fs = require('fs');

const USE_MOCK_PROOF = !fs.existsSync(path.resolve(__dirname, '../../zkp/build/nullifier.wasm'));

/**
 * Generate a nullifier ZK proof using snarkjs + compiled circuit
 * Falls back to mock proof if circuit not compiled
 */
async function generateProof(emailHashHex, electionID) {
  if (USE_MOCK_PROOF) {
    return generateMockProof(emailHashHex, electionID);
  }
  
  // Real snarkjs proof generation (requires compiled circuit)
  const buildDir = path.resolve(__dirname, '../../zkp/build');
  const wasmPath = path.join(buildDir, 'nullifier.wasm');
  const zkeyPath = path.join(buildDir, 'nullifier_final.zkey');

  if (!fs.existsSync(wasmPath) || !fs.existsSync(zkeyPath)) {
    console.warn('⚠️  Circuit artifacts not found, falling back to mock proof');
    return generateMockProof(emailHashHex, electionID);
  }

  // Convert hex emailHash to decimal string for witness input
  let emailHashDec;
  try {
    emailHashDec = BigInt(emailHashHex).toString();
  } catch (err) {
    throw new Error('Invalid emailHash hex input. Provide 0x-prefixed hex string.');
  }

  const input = {
    emailHash: emailHashDec,
    electionID: Number(electionID)
  };

  // Use snarkjs to produce proof (requires groth16 setup)
  try {
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(input, wasmPath, zkeyPath);
    console.log('✅ Real ZK proof generated');
    return { proof, publicSignals };
  } catch (err) {
    console.warn('⚠️  Real proof generation failed, falling back to mock:', err.message);
    return generateMockProof(emailHashHex, electionID);
  }
}

/**
 * Generate a mock proof for testing (no circuit required)
 * Structure matches snarkjs output: { proof: {a, b, c}, publicSignals: [...] }
 */
function generateMockProof(emailHashHex, electionID) {
  // Mock nullifier = hash(emailHash + electionID)
  // In real circuit, this would be computed by the circuit
  const nullifier = BigInt(emailHashHex) + BigInt(electionID);
  
  // Groth16 proof structure (mock - not cryptographically valid)
  const mockProof = {
    // Proof points (fake values for testing structure)
    a: [
      BigInt('12345678901234567890'),
      BigInt('98765432109876543210')
    ],
    b: [
      [
        BigInt('11111111111111111111'),
        BigInt('22222222222222222222')
      ],
      [
        BigInt('33333333333333333333'),
        BigInt('44444444444444444444')
      ]
    ],
    c: [
      BigInt('55555555555555555555'),
      BigInt('66666666666666666666')
    ]
  };
  
  // Public signals: [nullifier]
  const publicSignals = [nullifier.toString()];
  
  console.log('✅ Mock ZK proof generated (circuit not compiled; real proof after: snarkjs zkey export)');
  return { proof: mockProof, publicSignals };
}

module.exports = { generateProof };

