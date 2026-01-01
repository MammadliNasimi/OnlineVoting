import { expect } from "chai";
import hre from "hardhat";
const { ethers } = hre;

describe("Voting Contract", function () {
  it("Should create election and vote", async function () {
    const Voting = await ethers.getContractFactory("Voting");
    const voting = await Voting.deploy();

    await voting.createElection("Test Election", ["Alice", "Bob"]);
    const election = await voting.elections(1);
    expect(election.title).to.equal("Test Election");

    const [signer] = await ethers.getSigners();
    await voting.vote(1, 0);
    const hasVoted = await voting.hasVoted(1, signer.address);
    expect(hasVoted).to.be.true;

    const [candidates, votes] = await voting.getResults(1);
    expect(votes[0]).to.equal(1n);
  });
});
