const { ethers } = require('ethers');


const VOTE_PROOF_TYPES = {
    Credential: [
        { name: 'emailHash', type: 'bytes32' },
        { name: 'burner', type: 'address' },
        { name: 'electionID', type: 'uint256' }
    ]
};

class CredentialIssuer {
    constructor(issuerPrivateKey, contractAddress, chainId = 31337) {

        const cleanKey = typeof issuerPrivateKey === 'string' ? issuerPrivateKey.trim() : issuerPrivateKey;
        const cleanAddress = typeof contractAddress === 'string' ? contractAddress.trim() : contractAddress;
        this.issuerWallet = new ethers.Wallet(cleanKey);
        this.contractAddress = cleanAddress;
        this.chainId = chainId;

        this.domain = {
            name: 'VotingSSI',
            version: '1.0',
            chainId: chainId,
            verifyingContract: contractAddress
        };

        this.types = VOTE_PROOF_TYPES;

        console.log('✅ Credential Issuer initialized');
        console.log('   Issuer Address:', this.issuerWallet.address);
        console.log('   Contract Address:', contractAddress);
        console.log('   Chain ID:', chainId);
    }

    hashEmail(email) {

        const salt = 'ZKEMAIL_VOTING_SSI_2026';
        const normalized = email.trim().toLowerCase();
        return ethers.keccak256(ethers.toUtf8Bytes(normalized + salt));
    }

    async issueVoteCredential(email, electionID, burnerAddress) {
        try {

            const emailHash = this.hashEmail(email);

            const credentialProof = {
                emailHash: emailHash,
                burner: burnerAddress,
                electionID: electionID
            };

            console.log('\n📝 Issuing Burner-Bound Credential:');
            console.log('   Email Hash:', emailHash, '(email redacted)');
            console.log('   Burner Address:', burnerAddress);
            console.log('   Election ID:', electionID);

            const signature = await this.issuerWallet.signTypedData(
                this.domain,
                this.types,
                credentialProof
            );

            console.log('   ✅ Signature created:', signature);

            return {
                credential: {
                    emailHash: emailHash,
                    burner: burnerAddress,
                    electionID: electionID,
                    issuerSignature: signature
                },
                issuer: this.issuerWallet.address,
                issuedAt: new Date().toISOString()
            };

        } catch (error) {
            console.error('❌ Error issuing credential:', error);
            throw error;
        }
    }

    getDomain() {
        return this.domain;
    }

    getIssuerAddress() {
        return this.issuerWallet.address;
    }
}

module.exports = CredentialIssuer;
