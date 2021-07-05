// deploy/00_deploy_pool_contract.js

const DAI = "0x6B175474E89094C44Da98b954EedeAC495271d0F";
const monthInSeconds = 30 * 24 * 60 * 60;

const { ethers } = require("ethers");

module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const args = {
    noOfMembersNoOfTerms: 10,
    token: DAI,
    termPeriod: monthInSeconds,
    instalmentAmount: ethers.utils.parseEther("200"),
    maxBidPercent: 90,
  };

  await deploy("Pool", {
    from: deployer,
    args: [
      args.noOfMembersNoOfTerms,
      args.token,
      args.termPeriod,
      args.instalmentAmount,
      args.maxBidPercent,
    ],
    log: true,
  });
};

module.exports.tags = ["Pool"];
