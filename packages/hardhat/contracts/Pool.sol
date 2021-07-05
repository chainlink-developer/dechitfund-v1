//SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.9.0;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "hardhat/console.sol";

contract Pool {
  using SafeMath for uint256;

  enum State {
    OPEN,
    STARTED,
    COMPLETE
  }

  struct Instalment {
    mapping(address => bool) memberPaid;
  }

  uint256 public noOfMembersNoOfTerms;
  address public token;
  uint256 public termPeriod;
  uint256 public instalmentAmount;
  uint256 public maxBidPercent;
  uint256 public currentTerm;
  State public state;
  address[] public members;
  mapping(address => bool) public isMember;
  uint256 public currentTermEndTimestamp;
  mapping(uint256 => Instalment) private instalments;

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

  function join() public {
    require(state == State.OPEN, "Pool State is not OPEN");
    require(
      members.length != noOfMembersNoOfTerms,
      "Pool already has required no. of members"
    );
    require(!isMember[msg.sender], "Caller is already a member");
    members.push(msg.sender);
    isMember[msg.sender] = true;
    if (members.length == noOfMembersNoOfTerms) {
      state = State.STARTED;
      currentTerm = 1;
      currentTermEndTimestamp = block.timestamp + termPeriod;
    }
  }

  function deposit() public {
    require(isMember[msg.sender], "Caller is not a member of the Pool");
    require(state == State.STARTED, "Pool State is not STARTED");
    require(
      block.timestamp < currentTermEndTimestamp,
      "Current term period has already ended"
    );
    require(
      !instalments[currentTerm].memberPaid[msg.sender],
      "Member has already paid for current term"
    );
    IERC20(token).transferFrom(msg.sender, address(this), instalmentAmount);
    instalments[currentTerm].memberPaid[msg.sender] = true;
  }

  function getMemberPaidForInstalment(uint256 _term, address _memberAddress)
    public
    view
    returns (bool)
  {
    return instalments[_term].memberPaid[_memberAddress];
  }
}
