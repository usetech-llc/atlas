pragma solidity ^0.4.18;

import "zeppelin-solidity/contracts/math/SafeMath.sol";
import "zeppelin-solidity/contracts/ownership/Ownable.sol";
import "./Timestamped.sol";
import "./AccessToken.sol";

contract Governance is Ownable, Timestamped {
	using SafeMath for uint256;

	// token
	AccessToken public token;

	// reference addresses
	address public tokenAddress;

	// array of candidate addresses
	address[] public candidates;

	// number of candidate addresses
	uint256 public candidateCount = 0;

	// map to keep candidate list unique
	mapping (address => bool) public candidateList;

	// votes given to candidate 
	mapping (address => uint256) public candidateVotes;

	// weight given to candidate 
	mapping (address => uint256) public candidateWeight;

	// array of voter addresses
	address[] public voters;

	// number of voter addresses
	uint256 public voterCount = 0;

	// mapping to track who voted whom
	mapping (address => address) public voterList;

	// votes given to candidate 
	mapping (address => mapping (address => uint256)) public candidateVoters;

	// finalist variables
	address public finalist;
	uint256 public finalistVotes;
	uint256 public finalistWeight;

	// array of supporter addresses
	address[] public supporters;

	// number of supporter addresses
	uint256 public supporterCount = 0;

	// finalist supporters
	mapping (address => uint256) public finalistSupporters;
	uint256 public finalistSupport;

	// decided contract variables 
	address public decided;
	uint256 public decidedVotes;
	uint256 public decidedWeight;	
	uint256 public decidedSupport;

	
	// quorum percentage
	uint public constant quorum = 50;

	// tokens in circulation, main unit
	uint public constant tokensInCirculation = 4000;

	// parameter to determine cycle counter
	uint256 public cycleCounter = 2;

	/**
	 * @dev returns the stage of election
	 *
	 * @param _tokenAddress address of access token	 
	 */
	function Governance(address _tokenAddress) public {
		token = AccessToken(_tokenAddress);
	}

	/**
	 * @dev returns the stage of election
	 * every block is apprx 15 seconds
	 * 1 year  = 2,103,840 blocks, approx 2,000,000 block
	 * 6 months = 1,000,000
	 */
	function stage() public view returns (uint256) {
		uint mod = getBlockNumber() % 1000000;
		if (mod < 500000) {
			if (mod < 166667) {
				return 1;			// stage 1 (submit)
			} else if (mod < 333333) {
				return 2;			// stage 2 (choose)
			} else  {
				return 3;			// stage 3 (decide)
			}
		} else {
			return 0;				// non-election
		}
	}

	/**
	 * @dev returns the cycle of election
	 *
	 */
	function cycle() public view returns (uint256) {
		if ((cycleCounter) % 3 == 0) {
			return 0; // governance contract
		}
		else {
			return 1; // decision module
		}	
	}

	/**
	 * @dev adds governance contract address to list of candidates
	 *
	 * @param candidate address of the deployed contract that sender is submitting
	 *
	 */
	function submit(address candidate) public returns (bool) {
		// check if submission stage is running
		require(stage() == 1);
		// check if candidate is not submitted before
		require(candidateList[candidate] == false);

		// add candidate to list 
		if(candidateCount == candidates.length) {
			candidates.length += 1;
		}
		candidates[candidateCount ++] = candidate;

		// set candidate to valid one
		candidateList[candidate] = true;
		
		return true;
	}

	/**
	 * @dev adds vote to governance contract address 
	 *
	 * @param candidate address of the deployed contract that sender is voting
	 *
	 */
	function choose(address candidate) public returns (bool) {
		// check if voting stage is running
		require(stage() == 2);
		// check if candidate is valid one
		require(candidateList[candidate]);
		// check if user have not already voted
		require(candidateVoters[candidate][msg.sender] == 0);
		// check if user have not already voted to someone else
		require(voterList[msg.sender] == address(0));

		// get balance of token and check if user has enough balance
		uint256 balance = token.balanceOf(msg.sender);
		require(balance > 0);

		// add vote to candidate
		candidateVotes[candidate] = candidateVotes[candidate].add(1);

		// add weight to candidate
		candidateWeight[candidate] = candidateWeight[candidate].add(balance);

		// register voter for candidate
		candidateVoters[candidate][msg.sender] = candidateVoters[candidate][msg.sender].add(balance);

		// add voter to list 
		if(voterCount == voters.length) {
			voters.length += 1;
		}
		voters[voterCount ++] = msg.sender;

		// register voter 
		voterList[msg.sender] = candidate;

		// check the finalist
		if(finalistWeight < candidateWeight[candidate]) {
			finalist = candidate;
			finalistWeight = candidateWeight[candidate];
			finalistVotes = candidateVotes[candidate];
		}

		return true;
	}

	/**
	 * @dev adds decision to hightest voted governance contract address 
	 *
	 */
	function decide() public returns (bool) {
		// check if deciding stage is running 
		require(stage() == 3);
		// check if user has not already decided 
		require(finalistSupporters[msg.sender] == 0);

		// get balance of token and check if user has enough balance
		uint256 balance = token.balanceOf(msg.sender);
		require(balance > 0);

		// add support to finalist
		finalistSupport = finalistSupport.add(balance);

		// register supporter for finalist
		finalistSupporters[msg.sender] = finalistSupporters[msg.sender].add(balance);

		// add voter to list 
		if(supporterCount == supporters.length) {
			supporters.length += 1;
		}
		supporters[supporterCount ++] = msg.sender;
		
		return true;
	}

	/**
	 * @dev checks if quorum reached
	 *
	 */
	function isQuorumReached() public view returns (bool) {
		// check if quorum reached
		bool quorumReached = false;
		if(finalistSupport.mul(100).div(tokensInCirculation.mul(1E18)) >= quorum) {
			quorumReached = true;
		}
		return quorumReached;
	}

	/**
	 * @dev close the election and update growth contract
	 *
	 */
	function close() public returns (bool) {
		// check if close stage is reached 
		require(stage() == 0);
		// check if finalist is selected
		require(finalist != address(0));

		// check if quorum reached
		if(isQuorumReached()) {
			if (cycle() == 0) {
				// switch governance contract
			}
			else {
				// switch decision module contract
			}			
		}

		// increment cycle counter
		cycleCounter = cycleCounter + 1;

		// reset finalist and previous variables
		reset();

		return true;
	}

	function reset() internal returns (bool) {
		// update variables to prevent duplicate calls
		decided = finalist;
		decidedVotes = finalistVotes;
		decidedWeight = finalistWeight;
		decidedSupport = finalistSupport;

		finalist = address(0);
		finalistVotes = 0;
		finalistWeight = 0;
		finalistSupport = 0;

		uint256 i = 0;
		uint256 j = 0;

		// reset candidate voters 
		for(i = 0 ; i < candidateCount ; i ++) {
			for(j = 0 ; j < voterCount ; j ++) {
				candidateVoters[candidates[i]][voters[j]] = 0;
			}
		}

		// reset candidate mapping 
		for(i = 0 ; i < candidateCount ; i ++) {
			candidateList[candidates[i]] = false;
			candidateVotes[candidates[i]] = 0;
			candidateWeight[candidates[i]] = 0;
			candidates[i] = address(0);
		}
		candidateCount = 0;

		// reset voter mapping 
		for(i = 0 ; i < voterCount ; i ++) {
			voterList[voters[i]] = address(0);
			voters[i] = address(0);
		}
		voterCount = 0;

		// reset finalist supporters 
		for(i = 0 ; i < supporterCount ; i ++) {
			finalistSupporters[supporters[i]] = 0;
			supporters[i] = address(0);
		}
		supporterCount = 0;

		return true;
	}
}