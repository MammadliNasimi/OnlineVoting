/**
 * Generate a local mock nullifier proof.
 *
 * The project now runs the ZKP flow as a lightweight local prototype so the
 * vote pipeline remains deterministic and easy to test without circuit builds.
 */
async function generateProof(emailHashHex, electionID) {
  return generateMockProof(emailHashHex, electionID);
}

/**
 * Generate a mock proof for local testing.
 * Structure matches snarkjs output: { proof: {a, b, c}, publicSignals: [...] }
 */
function generateMockProof(emailHashHex, electionID) {
  // Mock nullifier = hash(emailHash + electionID)
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
  
  console.log('✅ Mock ZK proof generated (local prototype)');
  return { proof: mockProof, publicSignals };
}

module.exports = { generateProof };

