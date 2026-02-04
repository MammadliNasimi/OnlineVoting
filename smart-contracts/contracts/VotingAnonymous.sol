// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title Anonymous Voting Contract with Off-Chain Authorization
 * @notice This contract enables anonymous voting where authorization happens off-chain
 * @dev Uses ECDSA signature verification to ensure only admin-authorized votes are accepted
 * 
 * Architecture:
 * 1. User requests vote authorization from backend with a unique commitment
 * 2. Backend (acting as Admin) signs the commitment if user is eligible
 * 3. User submits vote with commitment, choice, and signature
 * 4. Contract verifies admin signature and prevents double voting using commitment
 */
contract VotingAnonymous {
    // ========== STATE VARIABLES ==========
    
    /// @notice Admin address - set at deployment, signs vote authorizations off-chain
    address public admin;
    
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
    
    /// @notice Current election ID
    uint256 public currentElectionId;
    
    /// @notice Mapping: electionId => Election
    mapping(uint256 => Election) public elections;
    
    /// @notice Mapping: electionId => array of Candidates
    mapping(uint256 => Candidate[]) public candidates;
    
    /// @notice Mapping: electionId => commitment => bool (prevents double voting)
    /// @dev commitment is hash(userSecret + electionId) generated client-side
    mapping(uint256 => mapping(bytes32 => bool)) public usedCommitments;
    
    // ========== EVENTS ==========
    
    /// @notice Emitted when a vote is successfully cast
    /// @param electionId The election ID
    /// @param candidateId The candidate who received the vote
    /// @param commitment The unique commitment hash (prevents tracking voter identity)
    event VoteCast(
        uint256 indexed electionId,
        uint256 candidateId,
        bytes32 indexed commitment
    );
    
    /// @notice Emitted when a new election is created
    event ElectionCreated(
        uint256 indexed electionId,
        string title,
        uint256 startTime,
        uint256 endTime
    );
    
    // ========== MODIFIERS ==========
    
    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin can perform this action");
        _;
    }
    
    modifier electionActive(uint256 _electionId) {
        Election memory election = elections[_electionId];
        require(election.isActive, "Election is not active");
        require(block.timestamp >= election.startTime, "Election has not started");
        require(block.timestamp <= election.endTime, "Election has ended");
        _;
    }
    
    // ========== CONSTRUCTOR ==========
    
    constructor(address _admin) {
        require(_admin != address(0), "Admin address cannot be zero");
        admin = _admin;
    }
    
    // ========== CORE VOTING FUNCTION ==========
    
    /**
     * @notice Cast a vote with off-chain authorization
     * @dev Verifies admin signature before accepting vote, prevents double voting via commitment
     * 
     * @param electionId The election ID
     * @param candidateId The candidate to vote for
     * @param commitment Unique hash (e.g., keccak256(userSecret + electionId))
     * @param signature Admin's signature of the commitment (from backend)
     * 
     * Flow:
     * 1. Verify election is active
     * 2. Verify commitment hasn't been used (prevents double voting)
     * 3. Verify signature was created by admin
     * 4. Record vote and mark commitment as used
     */
    function vote(
        uint256 electionId,
        uint256 candidateId,
        bytes32 commitment,
        bytes memory signature
    ) 
        external 
        electionActive(electionId) 
    {
        // 1. Check commitment hasn't been used (prevents double voting)
        require(
            !usedCommitments[electionId][commitment],
            "Commitment already used - double voting detected"
        );
        
        // 2. Verify candidate exists
        require(
            candidateId < candidates[electionId].length,
            "Invalid candidate ID"
        );
        
        // 3. Verify admin signature
        require(
            verifySignature(commitment, signature),
            "Invalid admin signature - unauthorized vote"
        );
        
        // 4. Mark commitment as used (prevents reuse)
        usedCommitments[electionId][commitment] = true;
        
        // 5. Record the vote
        candidates[electionId][candidateId].voteCount++;
        
        // 6. Emit event (commitment is indexed for verification, but doesn't reveal voter)
        emit VoteCast(electionId, candidateId, commitment);
    }
    
    // ========== SIGNATURE VERIFICATION ==========
    
    /**
     * @notice Verify that a signature was created by the admin
     * @dev Uses ECDSA recovery with Ethereum's signed message prefix
     * 
     * @param commitment The commitment hash that was signed
     * @param signature The signature to verify
     * @return bool True if signature is valid and from admin
     * 
     * Note: Ethereum prefixes messages with "\x19Ethereum Signed Message:\n32"
     * This matches the signing method used in the backend
     */
    function verifySignature(
        bytes32 commitment,
        bytes memory signature
    ) 
        internal 
        view 
        returns (bool) 
    {
        // 1. Add Ethereum signed message prefix
        bytes32 ethSignedMessageHash = getEthSignedMessageHash(commitment);
        
        // 2. Recover signer address from signature
        address signer = recoverSigner(ethSignedMessageHash, signature);
        
        // 3. Check if signer is the admin
        return signer == admin;
    }
    
    /**
     * @notice Prefix hash with Ethereum signed message header
     * @param _messageHash Original message hash
     * @return bytes32 Hash with Ethereum prefix
     */
    function getEthSignedMessageHash(bytes32 _messageHash)
        internal
        pure
        returns (bytes32)
    {
        return keccak256(
            abi.encodePacked(
                "\x19Ethereum Signed Message:\n32",
                _messageHash
            )
        );
    }
    
    /**
     * @notice Recover signer address from signature
     * @param _ethSignedMessageHash The prefixed message hash
     * @param _signature The signature bytes
     * @return address The address that created the signature
     */
    function recoverSigner(
        bytes32 _ethSignedMessageHash,
        bytes memory _signature
    )
        internal
        pure
        returns (address)
    {
        require(_signature.length == 65, "Invalid signature length");
        
        bytes32 r;
        bytes32 s;
        uint8 v;
        
        // Split signature into r, s, v components
        assembly {
            r := mload(add(_signature, 32))
            s := mload(add(_signature, 64))
            v := byte(0, mload(add(_signature, 96)))
        }
        
        // ecrecover returns zero address on error
        return ecrecover(_ethSignedMessageHash, v, r, s);
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
        onlyAdmin 
    {
        require(_startTime < _endTime, "Invalid time range");
        require(_candidateNames.length > 0, "At least one candidate required");
        
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
     * @param _electionId Election ID to end
     */
    function endElection(uint256 _electionId) external onlyAdmin {
        require(elections[_electionId].isActive, "Election already ended");
        elections[_electionId].isActive = false;
    }
    
    // ========== VIEW FUNCTIONS ==========
    
    /**
     * @notice Get election results
     * @param _electionId Election ID
     * @return names Array of candidate names
     * @return votes Array of vote counts
     */
    function getResults(uint256 _electionId)
        external
        view
        returns (string[] memory names, uint256[] memory votes)
    {
        uint256 candidateCount = candidates[_electionId].length;
        names = new string[](candidateCount);
        votes = new uint256[](candidateCount);
        
        for (uint256 i = 0; i < candidateCount; i++) {
            names[i] = candidates[_electionId][i].name;
            votes[i] = candidates[_electionId][i].voteCount;
        }
        
        return (names, votes);
    }
    
    /**
     * @notice Check if a commitment has been used
     * @param _electionId Election ID
     * @param _commitment Commitment hash
     * @return bool True if commitment was already used
     */
    function hasVoted(uint256 _electionId, bytes32 _commitment)
        external
        view
        returns (bool)
    {
        return usedCommitments[_electionId][_commitment];
    }
    
    /**
     * @notice Get candidate count for an election
     * @param _electionId Election ID
     * @return uint256 Number of candidates
     */
    function getCandidateCount(uint256 _electionId)
        external
        view
        returns (uint256)
    {
        return candidates[_electionId].length;
    }
}
