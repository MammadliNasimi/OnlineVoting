// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Voting {
    struct Election {
        uint id;
        string title;
        bool isActive;
        string[] candidates;
        mapping(uint => uint) votes; // candidateId => voteCount
        mapping(address => bool) hasVoted;
        uint totalVotes;
    }

    uint public electionCount;
    mapping(uint => Election) public elections;

    event ElectionCreated(uint id, string title);
    event Voted(uint electionId, address voter, uint candidateId);

    function createElection(string memory _title, string[] memory _candidates) public {
        electionCount++;
        Election storage newElection = elections[electionCount];
        newElection.id = electionCount;
        newElection.title = _title;
        newElection.isActive = true;
        newElection.candidates = _candidates;

        emit ElectionCreated(electionCount, _title);
    }

    function vote(uint _electionId, uint _candidateId) public {
        Election storage election = elections[_electionId];
        require(election.isActive, "Election is not active");
        require(!election.hasVoted[msg.sender], "You have already voted");
        require(_candidateId < election.candidates.length, "Invalid candidate");

        election.votes[_candidateId]++;
        election.hasVoted[msg.sender] = true;
        election.totalVotes++;

        emit Voted(_electionId, msg.sender, _candidateId);
    }

    function getResults(uint _electionId) public view returns (string[] memory, uint[] memory) {
        Election storage election = elections[_electionId];
        uint[] memory results = new uint[](election.candidates.length);

        for (uint i = 0; i < election.candidates.length; i++) {
            results[i] = election.votes[i];
        }

        return (election.candidates, results);
    }

    function hasVoted(uint _electionId, address _voter) public view returns (bool) {
        return elections[_electionId].hasVoted[_voter];
    }
}
