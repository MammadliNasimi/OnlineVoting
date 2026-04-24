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

        this.issuerWallet = new ethers.Wallet(issuerPrivateKey);
        this.contractAddress = contractAddress;
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

    async issueAuthorizationToken(email, electionID) {
        try {
            const emailHash = this.hashEmail(email);
            const timestamp = Math.floor(Date.now() / 1000);

            console.log('\n🎫 Issuing ZK-Email Authorization Token:');
            console.log('   Email Hash:', emailHash);
            console.log('   Election ID:', electionID);

            return {
                emailHash: emailHash,
                electionID: electionID,
                timestamp: timestamp,
                issuer: this.issuerWallet.address,
                validUntil: timestamp + 3600
            };

        } catch (error) {
            console.error('❌ Error issuing authorization:', error);
            throw error;
        }
    }

    async verifyCredential(credential) {
        try {
            const voteProof = {
                emailHash: credential.emailHash,
                electionID: BigInt(credential.electionID),
                candidateID: BigInt(credential.candidateID),
                timestamp: BigInt(credential.timestamp)
            };

            const recoveredAddress = ethers.verifyTypedData(
                this.domain,
                this.types,
                voteProof,
                credential.signature
            );

            const isValid = recoveredAddress.toLowerCase() === this.issuerWallet.address.toLowerCase();
            console.log('\n🔍 Credential Verification:');
            console.log('   Expected:', this.issuerWallet.address);
            console.log('   Recovered:', recoveredAddress);
            console.log('   Valid:', isValid);

            return isValid;

        } catch (error) {
            console.error('❌ Error verifying credential:', error);
            return false;
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
