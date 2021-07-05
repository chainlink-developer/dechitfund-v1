const { ethers } = require("hardhat");
const { use, expect } = require("chai");
const { solidity } = require("ethereum-waffle");

use(solidity);

describe("DeChitFund v1", function () {
  let poolContract;

  const DAI = "0x6B175474E89094C44Da98b954EedeAC495271d0F";
  const monthInSeconds = 30 * 24 * 60 * 60;

  const poolStates = {
    OPEN: 0,
    STARTED: 1,
    COMPLETE: 2,
  };

  describe("Pool", function () {
    it("Should deploy and initialize Pool", async function () {
      const Pool = await ethers.getContractFactory("Pool");

      const args = {
        noOfMembersNoOfTerms: 10,
        token: DAI,
        termPeriod: monthInSeconds,
        instalmentAmount: ethers.utils.parseEther("200"),
        maxBidPercent: 90,
      };

      poolContract = await Pool.deploy(
        args.noOfMembersNoOfTerms,
        args.token,
        args.termPeriod,
        args.instalmentAmount,
        args.maxBidPercent
      );

      expect(await poolContract.noOfMembersNoOfTerms()).to.equal(args.noOfMembersNoOfTerms);
      expect(await poolContract.token()).to.equal(args.token);
      expect(await poolContract.termPeriod()).to.equal(args.termPeriod);
      expect(await poolContract.instalmentAmount()).to.equal(args.instalmentAmount);
      expect(await poolContract.maxBidPercent()).to.equal(args.maxBidPercent);
      expect(await poolContract.state()).to.equal(poolStates.OPEN);
    });
  });
});
