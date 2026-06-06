const path = require('path');
const { generateProof } = require('../../services/zkp/proofGenerator');

async function main() {
  const emailHash = process.argv[2] || '0x1';
  const electionID = process.argv[3] || '1';

  try {
    const res = await generateProof(emailHash, electionID);
    console.log('Proof generated:');
    console.log(JSON.stringify(res, null, 2));
  } catch (err) {
    console.error('Failed to generate proof:', err.message);
    process.exit(1);
  }
}

main();
