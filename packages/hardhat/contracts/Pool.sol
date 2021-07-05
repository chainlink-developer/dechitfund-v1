//SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.9.0;

import "@openzeppelin/contracts/math/SafeMath.sol";

import "hardhat/console.sol";

contract Pool {
  using SafeMath for uint256;

  enum State {
    OPEN,
    STARTED,
    COMPLETE
  }

  uint256 public noOfMembersNoOfTerms;
  address public token;
  uint256 public termPeriod;
  uint256 public instalmentAmount;
  uint256 public maxBidPercent;
  uint256 public currentTerm;
  State public state;

  constructor(
    uint256 _noOfMembersNoOfTerms,
    address _token,
    uint256 _termPeriod,
    uint256 _instalmentAmount,
    uint256 _maxBidPercent
  ) public {
    noOfMembersNoOfTerms = _noOfMembersNoOfTerms;
    token = _token;
    termPeriod = _termPeriod;
    instalmentAmount = _instalmentAmount;
    maxBidPercent = _maxBidPercent;
    state = State.OPEN;
  }
}
