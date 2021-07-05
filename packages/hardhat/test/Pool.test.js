const { ethers } = require("hardhat");
const { use, expect } = require("chai");
const { solidity } = require("ethereum-waffle");
const contracts = require("./utils/contracts");

use(solidity);

describe("DeChitFund v1", function () {
  let accounts;
  // let deployer;
  let wallet1;

  let poolContract;
  let daiContract;
  let daiDecimals;

  const monthInSeconds = 30 * 24 * 60 * 60;

  const binance = "0x28c6c06298d514db089934071355e5743bf21d60";
  const snatchAmount = 5000;

  const poolStates = {
    OPEN: 0,
    STARTED: 1,
    COMPLETE: 2,
  };

  const deployArgs = {
    noOfMembersNoOfTerms: 10,
    token: contracts.DAI_ADDRESS,
    termPeriod: monthInSeconds,
    instalmentAmount: ethers.utils.parseEther("200"),
    maxBidPercent: 90,
  };

  before("get accounts", async () => {
    accounts = await ethers.getSigners();
    // deployer = accounts[0];
    wallet1 = accounts[1];
  });

  before("snatch DAI to member accounts", async function () {
    const snatchTxns = [];

    const accountToImpersonate = binance;
    await ethers.provider.send("hardhat_impersonateAccount", [accountToImpersonate]);
    const impersonatedSigner = await ethers.provider.getSigner(accountToImpersonate);
    daiContract = new ethers.Contract(contracts.DAI_ADDRESS, contracts.DAI_ABI, impersonatedSigner);
    daiDecimals = await daiContract.decimals();
    for (let account = 1; account <= deployArgs.noOfMembersNoOfTerms; account += 1) {
      const signer = accounts[account];
      snatchTxns.push(
        daiContract.transfer(signer.address, ethers.utils.parseEther(snatchAmount.toString()))
      );
    }
    await Promise.all(snatchTxns);

    const wallet1DaiBalance = parseInt(
      ethers.utils.formatUnits(await daiContract.balanceOf(wallet1.address), daiDecimals),
      10
    );

    expect(wallet1DaiBalance).to.be.at.least(
      snatchAmount,
      "wallet1 doesn't have at least 5000 DAI"
    );
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
