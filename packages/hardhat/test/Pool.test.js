const { ethers, network } = require("hardhat");
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

  const instalmentAmount = 200;
  const deployArgs = {
    noOfMembersNoOfTerms: 10,
    token: contracts.DAI_ADDRESS,
    termPeriod: monthInSeconds,
    instalmentAmount: ethers.utils.parseEther(instalmentAmount.toString()),
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

    /* it.skip("Should disallow new members to join when Pool already has required no. of members", async function () {
      await expect(poolContract.connect(accounts[11]).join()).to.be.revertedWith(
        "Pool already has required no. of members"
      );
    }); */

    it("Should allow members to deposit to Pool for current term", async function () {
      const wallet1DaiBalanceBefore = parseInt(
        ethers.utils.formatUnits(await daiContract.balanceOf(wallet1.address), daiDecimals),
        10
      );
      const poolContractDaiBalanceBefore = parseInt(
        ethers.utils.formatUnits(await daiContract.balanceOf(poolContract.address), daiDecimals),
        10
      );

      await daiContract.connect(wallet1).approve(poolContract.address, deployArgs.instalmentAmount);

      await poolContract.connect(wallet1).deposit();

      const wallet1DaiBalanceAfter = parseInt(
        ethers.utils.formatUnits(await daiContract.balanceOf(wallet1.address), daiDecimals),
        10
      );
      const poolContractDaiBalanceAfter = parseInt(
        ethers.utils.formatUnits(await daiContract.balanceOf(poolContract.address), daiDecimals),
        10
      );

      expect(
        await poolContract.getMemberPaidForInstalment(
          await poolContract.currentTerm(),
          wallet1.address
        )
      ).to.equal(true);
      expect(wallet1DaiBalanceBefore - wallet1DaiBalanceAfter).to.be.equal(instalmentAmount);
      expect(poolContractDaiBalanceAfter - poolContractDaiBalanceBefore).to.be.equal(
        instalmentAmount
      );
    });

    it("Should allow members to bid on Pool for current term", async function () {
      const bidAmount = instalmentAmount * (deployArgs.maxBidPercent / 100);
      await poolContract.connect(wallet1).bid(ethers.utils.parseEther(bidAmount.toString()));

      const [bids, lowestBidAmount, lowestBidder] = await poolContract.getBidsForInstalment(
        await poolContract.currentTerm()
      );

      expect(parseInt(ethers.utils.formatUnits(bids[0].bidAmount, daiDecimals), 10)).to.be.equal(
        bidAmount
      );
      expect(bids[0].bidder).to.be.equal(wallet1.address);
      expect(parseInt(ethers.utils.formatUnits(lowestBidAmount, daiDecimals), 10)).to.be.equal(
        bidAmount
      );
      expect(lowestBidder).to.be.equal(wallet1.address);
    });

    it("Should allow members to end current term", async function () {
      const approveTxns = [];
      const balanceOfBeforeTxns = [];
      const balanceOfAfterTxns = [];

      const currentTerm = (await poolContract.currentTerm()).toNumber();
      const currentTermEndTimestamp = (await poolContract.currentTermEndTimestamp()).toNumber();
      const termPeriod = (await poolContract.termPeriod()).toNumber();

      for (let account = 2; account <= 10; account += 1) {
        approveTxns.push(
          daiContract
            .connect(accounts[account])
            .approve(poolContract.address, deployArgs.instalmentAmount)
        );
      }
      await Promise.all(approveTxns);

      const lowestBidAmount = 145;

      await poolContract.connect(accounts[2]).deposit();
      await poolContract.connect(accounts[3]).deposit();
      await poolContract.connect(accounts[4]).deposit();
      await poolContract.connect(accounts[3]).bid(ethers.utils.parseEther("160"));
      await poolContract.connect(accounts[5]).deposit();
      await poolContract.connect(accounts[6]).deposit();
      await poolContract.connect(accounts[7]).deposit();
      await poolContract.connect(accounts[8]).deposit();
      await poolContract.connect(accounts[6]).bid(ethers.utils.parseEther("150"));
      await poolContract
        .connect(accounts[8])
        .bid(ethers.utils.parseEther(lowestBidAmount.toString()));
      await poolContract.connect(accounts[9]).deposit();
      await poolContract.connect(accounts[10]).deposit();

      for (let account = 1; account <= 10; account += 1) {
        balanceOfBeforeTxns.push(daiContract.balanceOf(accounts[account].address));
      }
      const balancesBefore = (await Promise.all(balanceOfBeforeTxns)).map((balance) =>
        parseInt(ethers.utils.formatUnits(balance, daiDecimals), 10)
      );

      await network.provider.send("evm_setNextBlockTimestamp", [
        (await poolContract.currentTermEndTimestamp()).toNumber(),
      ]);
      await network.provider.send("evm_mine");

      await poolContract.connect(wallet1).endCurrentTerm();

      for (let account = 1; account <= 10; account += 1) {
        balanceOfAfterTxns.push(daiContract.balanceOf(accounts[account].address));
      }
      const balancesAfter = (await Promise.all(balanceOfAfterTxns)).map((balance) =>
        parseInt(ethers.utils.formatUnits(balance, daiDecimals), 10)
      );

      const singleShare = parseInt(
        (instalmentAmount * deployArgs.noOfMembersNoOfTerms - lowestBidAmount) /
          (deployArgs.noOfMembersNoOfTerms - 1),
        10
      );

      for (let index = 0; index < balancesBefore.length; index += 1) {
        if (index !== 7)
          expect(balancesAfter[index] - balancesBefore[index]).to.be.equal(singleShare);
        else expect(balancesAfter[index] - balancesBefore[index]).to.be.equal(lowestBidAmount);
      }

      expect(await poolContract.currentTerm()).to.be.equal(currentTerm + 1);
      expect(await poolContract.currentTermEndTimestamp()).to.be.equal(
        currentTermEndTimestamp + termPeriod
      );
    });

    it("Should set Pool as COMPLETE after last term", async function () {
      const approveTxns = [];
      const depositTxns = [];

      for (let account = 1; account <= 10; account += 1) {
        approveTxns.push(
          daiContract
            .connect(accounts[account])
            .approve(poolContract.address, ethers.constants.MaxUint256)
        );
      }
      await Promise.all(approveTxns);

      for (let term = 2; term <= deployArgs.noOfMembersNoOfTerms; term += 1) {
        for (let account = 1; account <= 10; account += 1) {
          depositTxns.push(poolContract.connect(accounts[account]).deposit());
        }
        /* eslint-disable no-await-in-loop */
        await Promise.all(depositTxns);
        await poolContract.connect(accounts[3]).bid(ethers.utils.parseEther("160"));
        await poolContract.connect(accounts[6]).bid(ethers.utils.parseEther("150"));
        await poolContract.connect(accounts[9]).bid(ethers.utils.parseEther("140"));

        await network.provider.send("evm_setNextBlockTimestamp", [
          (await poolContract.currentTermEndTimestamp()).toNumber(),
        ]);
        await network.provider.send("evm_mine");

        await poolContract.connect(wallet1).endCurrentTerm();
      }

      expect(await poolContract.currentTerm()).to.be.equal(0);
      expect(await poolContract.currentTermEndTimestamp()).to.be.equal(0);
      expect(await poolContract.state()).to.equal(poolStates.COMPLETE);
    });
  });
});
