const { ethers } = require("hardhat");
const { use, expect } = require("chai");
const { solidity } = require("ethereum-waffle");

use(solidity);

describe("DeChitFund v1", function () {
  let accounts;
  let deployer;
  let wallet1;

  let poolContract;

  const DAI = "0x6B175474E89094C44Da98b954EedeAC495271d0F";
  const monthInSeconds = 30 * 24 * 60 * 60;

  const poolStates = {
    OPEN: 0,
    STARTED: 1,
    COMPLETE: 2,
  };

  const deployArgs = {
    noOfMembersNoOfTerms: 10,
    token: DAI,
    termPeriod: monthInSeconds,
    instalmentAmount: ethers.utils.parseEther("200"),
    maxBidPercent: 90,
  };

  before(async () => {
    accounts = await ethers.getSigners();
    deployer = accounts[0];
    wallet1 = accounts[1];
  });

  describe("Pool", function () {
    it("Should deploy and initialize Pool", async function () {
      const Pool = await ethers.getContractFactory("Pool");

      poolContract = await Pool.deploy(
        deployArgs.noOfMembersNoOfTerms,
        deployArgs.token,
        deployArgs.termPeriod,
        deployArgs.instalmentAmount,
        deployArgs.maxBidPercent
      );

      expect(await poolContract.noOfMembersNoOfTerms()).to.equal(deployArgs.noOfMembersNoOfTerms);
      expect(await poolContract.token()).to.equal(deployArgs.token);
      expect(await poolContract.termPeriod()).to.equal(deployArgs.termPeriod);
      expect(await poolContract.instalmentAmount()).to.equal(deployArgs.instalmentAmount);
      expect(await poolContract.maxBidPercent()).to.equal(deployArgs.maxBidPercent);
      expect(await poolContract.state()).to.equal(poolStates.OPEN);
    });

    it("Should allow non-members to join Pool", async function () {
      await poolContract.connect(wallet1).join();

      expect(await poolContract.members(0)).to.equal(wallet1.address);
      expect(await poolContract.isMember(wallet1.address)).to.equal(true);
    });

    it("Should disallow existing members to join Pool", async function () {
      await expect(poolContract.connect(wallet1).join()).to.be.revertedWith(
        "Caller is already a member"
      );
    });

    it("Should start Pool when last member has joined Pool", async function () {
      await poolContract.connect(accounts[2]).join();
      await poolContract.connect(accounts[3]).join();
      await poolContract.connect(accounts[4]).join();
      await poolContract.connect(accounts[5]).join();
      await poolContract.connect(accounts[6]).join();
      await poolContract.connect(accounts[7]).join();
      await poolContract.connect(accounts[8]).join();
      await poolContract.connect(accounts[9]).join();
      await poolContract.connect(accounts[10]).join();

      expect(await poolContract.state()).to.equal(poolStates.STARTED);
      expect(await poolContract.currentTerm()).to.equal(1);
      expect((await poolContract.currentTermEndTimestamp()).toNumber()).to.equal(
        (await ethers.provider.getBlock()).timestamp + deployArgs.termPeriod
      );
    });

    it("Should disallow new members to join when Pool State is not OPEN", async function () {
      await expect(poolContract.connect(accounts[11]).join()).to.be.revertedWith(
        "Pool State is not OPEN"
      );
    });

    it.skip("Should disallow new members to join when Pool already has required no. of members", async function () {
      await expect(poolContract.connect(accounts[11]).join()).to.be.revertedWith(
        "Pool already has required no. of members"
      );
    });
  });
});
