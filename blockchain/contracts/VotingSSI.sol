// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title Self-Sovereign Identity Voting Contract
 * @notice Anonymous voting using EIP-712 structured data signing and nullifiers
 * @dev Implements verifiable credentials model with Issuer-Holder-Verifier pattern
 * 
 * Architecture:
 * 1. Issuer (University/Admin) creates signed credentials for eligible voters
 * 2. Holder (Student) receives credential without revealing identity
 * 3. Smart Contract verifies credential and prevents double voting via nullifiers
 * 
 * Key Features:
 * - EIP-712 typed structured data for secure signing
 * - Nullifier mechanism prevents double voting while preserving anonymity
 * - No on-chain identity storage - only hashed nullifiers
 * - Credential-based authorization (Self-Sovereign Identity principles)
 */
contract VotingSSI {
    // ========== EIP-712 DOMAIN ==========
    
    /// @notice EIP-712 Domain Separator
    bytes32 public DOMAIN_SEPARATOR;
    
    /// @notice Credential typehash for EIP-712 (Issuer signs this)
    bytes32 public constant CREDENTIAL_TYPEHASH = keccak256(
        "Credential(bytes32 emailHash,address burner,uint256 electionID)"
    );

    /// @notice Vote typehash for EIP-712 (Burner wallet signs this)
    bytes32 public constant VOTE_TYPEHASH = keccak256(
        "Vote(uint256 candidateID,uint256 electionID,uint256 timestamp)"
    );
    

    // ========== CUSTOM ERRORS ==========
    error Unauthorized();
    error ElectionNotActive();
    error ElectionNotStarted();
    error ElectionEnded();
    error InvalidIssuer();
    error DoubleVoting();
    error InvalidCandidate();
    error ProofExpired();
    error InvalidSignatures();
    error InvalidSignatureLength();
    error InvalidSignatureV();
    error ECDSAFailed();
    error InvalidTimeRange();
    error NoCandidates();
    error ElectionAlreadyEnded();

    // ========== STATE VARIABLES ==========
    
    /// @notice Credential Issuer address (University/Admin)
    address public issuer;
    
    /// @notice Election metadata
    struct Election {
        uint256 id;
        string title;
        uint256 startTime;
        uint256 endTime;
        bool isActive;
    }
    
    /// @notice Candidate information
    struct Candidate {
        uint256 id;
        string name;
        uint256 voteCount;
    }
    
    /// @notice Vote Proof structure for Burner Wallet SSI
    struct VoteProof {
        bytes32 emailHash;      // Unique hashed identifier
        address burner;         // One-time random address created by student
        uint256 electionID;     // Election identifier
        uint256 candidateID;    // Chosen candidate
        uint256 timestamp;      // Vote operation timestamp
        bytes issuerSignature;  // Admin signs: (emailHash, burner, electionID)
        bytes burnerSignature;  // Burner signs: (candidateID, electionID, timestamp)
    }

    /// @notice Current election ID counter
    uint256 public currentElectionId;
    
    /// @notice Mapping: electionId => Election
    mapping(uint256 => Election) public elections;
    
    /// @notice Mapping: electionId => array of Candidates
    mapping(uint256 => Candidate[]) public candidates;
    
    /// @notice Nullifier Mechanism: prevents double voting
    /// @dev nullifier = keccak256(abi.encodePacked(studentIDHash, electionID))
    /// Maps nullifier => used status
    mapping(bytes32 => bool) public usedNullifiers;
    
    // ========== EVENTS ==========
    
    /// @notice Emitted when a vote is successfully cast
    event VoteCast(
        uint256 indexed electionID,
        uint256 candidateID,
        bytes32 indexed nullifier,
        uint256 timestamp
    );
    
    /// @notice Emitted when a new election is created
    event ElectionCreated(
        uint256 indexed electionID,
        string title,
        uint256 startTime,
        uint256 endTime
    );
    
    /// @notice Emitted when issuer is updated
    event IssuerUpdated(address indexed oldIssuer, address indexed newIssuer);
    
    // ========== MODIFIERS ==========
    
    modifier onlyIssuer() {
        if (msg.sender != issuer) revert Unauthorized();
        _;
    }
    
    modifier electionActive(uint256 _electionID) {
        Election memory election = elections[_electionID];
        if (!election.isActive) revert ElectionNotActive();
        if (block.timestamp < election.startTime) revert ElectionNotStarted();
        if (block.timestamp > election.endTime) revert ElectionEnded();
        _;
    }
    
    // ========== CONSTRUCTOR ==========
    
    constructor(address _issuer, string memory _name, string memory _version) {
        if (_issuer == address(0)) revert InvalidIssuer();
        issuer = _issuer;
        
        // Initialize EIP-712 domain separator
        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes(_name)),
                keccak256(bytes(_version)),
                block.chainid,
                address(this)
            )
        );
    }
    
    // ========== CORE VOTING FUNCTION ==========
    
    /**
     * @notice Cast a vote using verifiable credential
     * @dev Verifies EIP-712 signature and nullifier before accepting vote
     * 
     * @param proof VoteProof struct containing all necessary data
     * 
     * Flow:
     * 1. Validate election is active
     * 2. Calculate nullifier from studentIDHash + electionID
     * 3. Check nullifier hasn't been used (prevents double voting)
     * 4. Verify EIP-712 signature from issuer
     * 5. Record vote and mark nullifier as used
     * 
     * Security: studentIDHash is never stored on-chain, only the nullifier
     */
    function vote(VoteProof calldata proof) 
        external 
        electionActive(proof.electionID)
    {
        // 1. Calculate nullifier (deterministic per email per election)
        // ZK-Email: nullifier = keccak256(emailHash + electionID) — email never revealed
        bytes32 nullifier = keccak256(
            abi.encodePacked(proof.emailHash, proof.electionID)
        );
        
        // 2. Check nullifier hasn't been used (prevents double voting)
        if (usedNullifiers[nullifier]) revert DoubleVoting();
        
        // 3. Verify candidate exists
        if (proof.candidateID >= candidates[proof.electionID].length) revert InvalidCandidate();
        
        // 4. Verify timestamp is recent (prevent replay attacks)
        if (block.timestamp > proof.timestamp + 1 hours) revert ProofExpired();
        
        // 5. Verify issuer's and burner's EIP-712 signatures
        if (!verifyVoteProof(proof)) revert InvalidSignatures();
        
        // 6. Mark nullifier as used (prevents reuse)
        usedNullifiers[nullifier] = true;
        
        // 7. Record the vote
        unchecked { ++candidates[proof.electionID][proof.candidateID].voteCount; }
        
        // 8. Emit event (nullifier indexed for verification, preserves anonymity)
        emit VoteCast(proof.electionID, proof.candidateID, nullifier, proof.timestamp);
    }
    
    // ========== EIP-712 SIGNATURE VERIFICATION ==========
    
    /**
     * @notice Verify EIP-712 signature of VoteProof
     * @dev 1) Verify Issuer gave credential to Burner. 2) Verify Burner signed the Vote
     * 
     * @param proof The VoteProof to verify
     * @return bool True if both signatures are valid
     */
    function verifyVoteProof(VoteProof calldata proof) 
        internal 
        view 
        returns (bool) 
    {
        // 1. Verify Issuer Credential
        bytes32 credHash = keccak256(
            abi.encode(
                CREDENTIAL_TYPEHASH,
                proof.emailHash,
                proof.burner,
                proof.electionID
            )
        );
        
        bytes32 credDigest = keccak256(
            abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, credHash)
        );
        
        address credSigner = recoverSigner(credDigest, proof.issuerSignature);
        if (credSigner != issuer) revert InvalidSignatures();

        // 2. Verify Burner Vote Signature
        bytes32 voteHash = keccak256(
            abi.encode(
                VOTE_TYPEHASH,
                proof.candidateID,
                proof.electionID,
                proof.timestamp
            )
        );
        
        bytes32 voteDigest = keccak256(
            abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, voteHash)
        );
        
        address voteSigner = recoverSigner(voteDigest, proof.burnerSignature);
        if (voteSigner != proof.burner) revert InvalidSignatures();

        return true;
    }
    
    /**
     * @notice Recover signer address from ECDSA signature
     * @param digest The message digest that was signed
     * @param signature The signature bytes (65 bytes: r, s, v)
     * @return address The address that created the signature
     */
    function recoverSigner(bytes32 digest, bytes memory signature)
        internal
        pure
        returns (address)
    {
        if (signature.length != 65) revert InvalidSignatureLength();
        
        bytes32 r;
        bytes32 s;
        uint8 v;
        
        // Split signature into r, s, v components
        assembly {
            r := mload(add(signature, 32))
            s := mload(add(signature, 64))
            v := byte(0, mload(add(signature, 96)))
        }
        
        // Ensure v is either 27 or 28
        if (v < 27) {
            v += 27;
        }
        
        if (v != 27 && v != 28) revert InvalidSignatureV();
        
        // ecrecover returns zero address on error
        address signer = ecrecover(digest, v, r, s);
        if (signer == address(0)) revert ECDSAFailed();
        
        return signer;
    }
    
    // ========== ADMIN FUNCTIONS ==========
    
    /**
     * @notice Create a new election
     * @param _title Election title
     * @param _startTime Election start timestamp
     * @param _endTime Election end timestamp
     * @param _candidateNames Array of candidate names
     */
    function createElection(
        string memory _title,
        uint256 _startTime,
        uint256 _endTime,
        string[] memory _candidateNames
    ) 
        external 
        onlyIssuer 
    {
        if (_startTime >= _endTime) revert InvalidTimeRange();
        if (_candidateNames.length == 0) revert NoCandidates();
        
        currentElectionId++;
        
        elections[currentElectionId] = Election({
            id: currentElectionId,
            title: _title,
            startTime: _startTime,
            endTime: _endTime,
            isActive: true
        });
        
        // Add candidates
        for (uint256 i = 0; i < _candidateNames.length; i++) {
            candidates[currentElectionId].push(Candidate({
                id: i,
                name: _candidateNames[i],
                voteCount: 0
            }));
        }
        
        emit ElectionCreated(currentElectionId, _title, _startTime, _endTime);
    }
    
    /**
     * @notice End an election
     * @param _electionID Election ID to end
     */
    function endElection(uint256 _electionID) external onlyIssuer {
        if (!elections[_electionID].isActive) revert ElectionAlreadyEnded();
        elections[_electionID].isActive = false;
    }
    
    /**
     * @notice Update issuer address
     * @param _newIssuer New issuer address
     */
    function updateIssuer(address _newIssuer) external onlyIssuer {
        if (_newIssuer == address(0)) revert InvalidIssuer();
        address oldIssuer = issuer;
        issuer = _newIssuer;
        emit IssuerUpdated(oldIssuer, _newIssuer);
    }
    
    // ========== VIEW FUNCTIONS ==========
    
    /**
     * @notice Get election results
     * @param _electionID Election ID
     * @return names Array of candidate names
     * @return votes Array of vote counts
     */
    function getResults(uint256 _electionID)
        external
        view
        returns (string[] memory names, uint256[] memory votes)
    {
        uint256 candidateCount = candidates[_electionID].length;
        names = new string[](candidateCount);
        votes = new uint256[](candidateCount);
        
        for (uint256 i = 0; i < candidateCount; i++) {
            names[i] = candidates[_electionID][i].name;
            votes[i] = candidates[_electionID][i].voteCount;
        }
        
        return (names, votes);
    }
    
    /**
     * @notice Check if a nullifier has been used
     * @param _nullifier The nullifier to check
     * @return bool True if nullifier was already used
     */
    function isNullifierUsed(bytes32 _nullifier)
        external
        view
        returns (bool)
    {
        return usedNullifiers[_nullifier];
    }
    
    /**
     * @notice Calculate nullifier for a student and election
     * @dev Helper function for off-chain nullifier calculation
     * @param _studentIDHash Hashed student ID
     * @param _electionID Election ID
     * @return bytes32 The nullifier
     */
    /// @notice Calculate nullifier for an emailHash and election (ZK-Email model)
    function calculateNullifier(bytes32 _emailHash, uint256 _electionID)
        external
        pure
        returns (bytes32)
    {
        return keccak256(abi.encodePacked(_emailHash, _electionID));
    }
    
    /**
     * @notice Get candidate count for an election
     * @param _electionID Election ID
     * @return uint256 Number of candidates
     */
    function getCandidateCount(uint256 _electionID)
        external
        view
        returns (uint256)
    {
        return candidates[_electionID].length;
    }
    
    /**
     * @notice Get domain separator (useful for off-chain signing)
     * @return bytes32 The EIP-712 domain separator
     */
    function getDomainSeparator() external view returns (bytes32) {
        return DOMAIN_SEPARATOR;
    }
}
