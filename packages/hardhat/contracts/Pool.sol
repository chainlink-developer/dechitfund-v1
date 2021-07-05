//SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.9.0;
pragma experimental ABIEncoderV2;

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

  struct Bid {
    uint256 bidAmount;
    address bidder;
  }

  struct Instalment {
    mapping(address => bool) memberPaid;
    Bid[] bids;
    uint256 lowestBidAmount;
    address lowestBidder;
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

  function deposit() public onlyMember requireStateStarted currentTermNotEnded {
    require(
      !instalments[currentTerm].memberPaid[msg.sender],
      "Member has already paid for current term"
    );
    IERC20(token).transferFrom(msg.sender, address(this), instalmentAmount);
    instalments[currentTerm].memberPaid[msg.sender] = true;
  }

  function bid(uint256 _bidAmount)
    public
    onlyMember
    requireStateStarted
    currentTermNotEnded
  {
    require(_bidAmount > 0, "Bid amount must be greater than zero");
    require(
      instalments[currentTerm].memberPaid[msg.sender],
      "Caller has not paid current term"
    );
    if (instalments[currentTerm].lowestBidAmount != 0) {
      require(
        _bidAmount < instalments[currentTerm].lowestBidAmount,
        "Bid amount must be less than current lowest bid"
      );
    }
    require(
      _bidAmount <= ((instalmentAmount * maxBidPercent) / 100),
      "Bid amount cannot be greater than max bid percent"
    );
    Bid memory newBid = Bid(_bidAmount, msg.sender);
    instalments[currentTerm].bids.push(newBid);
    instalments[currentTerm].lowestBidAmount = _bidAmount;
    instalments[currentTerm].lowestBidder = msg.sender;
  }

  function endCurrentTerm() public onlyMember requireStateStarted {
    require(
      block.timestamp > currentTermEndTimestamp,
      "Current term period has not ended"
    );
    address lowestBidder = instalments[currentTerm].lowestBidder;
    uint256 lowestBidAmount = instalments[currentTerm].lowestBidAmount;
    IERC20(token).transfer(lowestBidder, lowestBidAmount);
    uint256 singleShare = ((instalmentAmount * noOfMembersNoOfTerms) -
      lowestBidAmount) / (noOfMembersNoOfTerms - 1);
    for (uint256 index = 0; index < noOfMembersNoOfTerms; index++) {
      if (members[index] != lowestBidder)
        IERC20(token).transfer(members[index], singleShare);
    }
    if (currentTerm != noOfMembersNoOfTerms) {
      currentTerm = currentTerm + 1;
      currentTermEndTimestamp = currentTermEndTimestamp + termPeriod;
    } else {
      currentTerm = 0;
      currentTermEndTimestamp = 0;
      state = State.COMPLETE;
    }
  }

  function getBidsForInstalment(uint256 _term)
    public
    view
    returns (
      Bid[] memory,
      uint256,
      address
    )
  {
    return (
      instalments[_term].bids,
      instalments[_term].lowestBidAmount,
      instalments[_term].lowestBidder
    );
  }

  function getMemberPaidForInstalment(uint256 _term, address _memberAddress)
    public
    view
    returns (bool)
  {
    return instalments[_term].memberPaid[_memberAddress];
  }

  modifier onlyMember() {
    require(isMember[msg.sender], "Caller is not a member of the Pool");
    _;
  }

  modifier requireStateStarted() {
    require(state == State.STARTED, "Pool State is not STARTED");
    _;
  }

  modifier currentTermNotEnded() {
    require(
      block.timestamp < currentTermEndTimestamp,
      "Current term period has already ended"
    );
    _;
  }
}
