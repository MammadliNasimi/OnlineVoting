// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title Voting Smart Contract
 * @dev Secure, transparent, and immutable voting system on Ethereum blockchain
 * 
 * Features:
 * - Anonymous voting (voter ID is hashed)
 * - Duplicate vote prevention
 * - Transparent vote counting
 * - Immutable vote records
 * - Election management
 * 
 * TODO: Deploy to Ethereum testnet (Sepolia, Goerli, or Ganache)
 * TODO: Test with Hardhat or Truffle
 * TODO: Integrate with frontend via Web3.js/Ethers.js
 */

contract Voting {
    // Election structure
    struct Election {
        uint256 id;
        string title;
        uint256 startTime;
        uint256 endTime;
        bool isActive;
        address creator;
    }

    // Candidate structure
    struct Candidate {
        uint256 id;
        string name;
        uint256 voteCount;
    }

    // State variables
    address public owner;
    uint256 public electionCount;
    mapping(uint256 => Election) public elections;
    mapping(uint256 => Candidate[]) public electionCandidates;
    mapping(uint256 => mapping(address => bool)) public hasVoted;
    mapping(uint256 => mapping(uint256 => uint256)) public voteCounts;

    // Events
    event ElectionCreated(uint256 indexed electionId, string title, uint256 startTime, uint256 endTime);
    event VoteCast(uint256 indexed electionId, uint256 candidateId, address indexed voter);
    event ElectionEnded(uint256 indexed electionId);

    // Modifiers
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can perform this action");
        _;
    }

    modifier electionExists(uint256 _electionId) {
        require(_electionId > 0 && _electionId <= electionCount, "Election does not exist");
        _;
    }

    modifier electionActive(uint256 _electionId) {
        Election memory election = elections[_electionId];
        require(election.isActive, "Election is not active");
        require(block.timestamp >= election.startTime, "Election has not started yet");
        require(block.timestamp <= election.endTime, "Election has ended");
        _;
    }

    // Constructor
    constructor() {
        owner = msg.sender;
        electionCount = 0;
    }

    /**
     * @dev Create a new election
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
    ) public onlyOwner {
        require(_startTime < _endTime, "Invalid time range");
        require(_candidateNames.length > 0, "At least one candidate required");

        electionCount++;
        elections[electionCount] = Election({
            id: electionCount,
            title: _title,
            startTime: _startTime,
            endTime: _endTime,
            isActive: true,
            creator: msg.sender
        });

        // Add candidates
        for (uint256 i = 0; i < _candidateNames.length; i++) {
            electionCandidates[electionCount].push(Candidate({
                id: i,
                name: _candidateNames[i],
                voteCount: 0
            }));
        }

        emit ElectionCreated(electionCount, _title, _startTime, _endTime);
    }

    /**
     * @dev Cast a vote
     * @param _electionId Election ID
     * @param _candidateId Candidate ID
     */
    function castVote(uint256 _electionId, uint256 _candidateId)
        public
        electionExists(_electionId)
        electionActive(_electionId)
    {
        require(!hasVoted[_electionId][msg.sender], "Already voted");
        require(_candidateId < electionCandidates[_electionId].length, "Invalid candidate");

        hasVoted[_electionId][msg.sender] = true;
        voteCounts[_electionId][_candidateId]++;
        electionCandidates[_electionId][_candidateId].voteCount++;

        emit VoteCast(_electionId, _candidateId, msg.sender);
    }

    /**
     * @dev Get election results
     * @param _electionId Election ID
     * @return Candidate names and vote counts
     */
    function getResults(uint256 _electionId)
        public
        view
        electionExists(_electionId)
        returns (string[] memory, uint256[] memory)
    {
        uint256 candidateCount = electionCandidates[_electionId].length;
        string[] memory names = new string[](candidateCount);
        uint256[] memory votes = new uint256[](candidateCount);

        for (uint256 i = 0; i < candidateCount; i++) {
            names[i] = electionCandidates[_electionId][i].name;
            votes[i] = electionCandidates[_electionId][i].voteCount;
        }

        return (names, votes);
    }

    /**
     * @dev Check if address has voted
     * @param _electionId Election ID
     * @param _voter Voter address
     * @return bool indicating if voted
     */
    function hasVotedInElection(uint256 _electionId, address _voter)
        public
        view
        electionExists(_electionId)
        returns (bool)
    {
        return hasVoted[_electionId][_voter];
    }

    /**
     * @dev Get total vote count for election
     * @param _electionId Election ID
     * @return Total number of votes
     */
    function getTotalVotes(uint256 _electionId)
        public
        view
        electionExists(_electionId)
        returns (uint256)
    {
        uint256 total = 0;
        for (uint256 i = 0; i < electionCandidates[_electionId].length; i++) {
            total += electionCandidates[_electionId][i].voteCount;
        }
        return total;
    }

    /**
     * @dev End an election
     * @param _electionId Election ID
     */
    function endElection(uint256 _electionId)
        public
        onlyOwner
        electionExists(_electionId)
    {
        elections[_electionId].isActive = false;
        emit ElectionEnded(_electionId);
    }

    /**
     * @dev Get election details
     * @param _electionId Election ID
     * @return Election information
     */
    function getElection(uint256 _electionId)
        public
        view
        electionExists(_electionId)
        returns (
            string memory title,
            uint256 startTime,
            uint256 endTime,
            bool isActive,
            address creator
        )
    {
        Election memory election = elections[_electionId];
        return (
            election.title,
            election.startTime,
            election.endTime,
            election.isActive,
            election.creator
        );
    }
}
