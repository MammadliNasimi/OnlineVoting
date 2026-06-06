const { ethers } = require('ethers');

/**
 * Credential Issuer Service
 * 
 * Allows an authorized entity (DAO, Admin, or Multi-sig) to issue signed credentials
 * that permit participants to vote. Credentials are NOT Self-Sovereign Identity (SSI).
 * 
 * How it works:
 * 1. Admin/DAO signs a credential (emailHash, burner address, electionID) with their private key
 * 2. The signature is sent to the blockchain as part of the VoteProof
 * 3. Smart contract verifies the issuer's signature before accepting the vote
 * 4. This ensures only authorized voters can submit votes
 * 
 * Anonymity:
 * - The email itself is never stored on-chain; only the hash is used
 * - A "nullifier" is computed from this hash + electionID
 * - Nullifier is marked as "used" to prevent double voting
 * - Email is known only to the issuer and the participant
 * 
 * DAO-Compatible:
 * - The issuer can be a multi-sig wallet or DAO treasury
 * - Multiple issuers can be rotated for decentralization
 */
    constructor(issuerPrivateKey, contractAddress, chainId = 31337) {

        const cleanKey = typeof issuerPrivateKey === 'string' ? issuerPrivateKey.trim() : issuerPrivateKey;
        const cleanAddress = typeof contractAddress === 'string' ? contractAddress.trim() : contractAddress;
        const numericChainId = Number(chainId);
        this.issuerWallet = new ethers.Wallet(cleanKey);
        this.contractAddress = cleanAddress;
        this.chainId = Number.isFinite(numericChainId) ? numericChainId : 31337;

        this.domain = {
            name: 'VotingSSI',
            version: '1.0',
            chainId: this.chainId,
            verifyingContract: cleanAddress
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
