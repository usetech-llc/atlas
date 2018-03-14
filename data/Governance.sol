pragma solidity ^0.4.18;

import "zeppelin-solidity/contracts/math/SafeMath.sol";
import "zeppelin-solidity/contracts/ownership/Ownable.sol";
import "./Timestamped.sol";
import "./AccessToken.sol";
import "./GovernanceRelay.sol";

contract Governance is Ownable, Timestamped {
	using SafeMath for uint256;

	// token contract address 
	address public tokenAddress;
	AccessToken public token;

	// current governance relay contract address 
	address public governanceRelayAddress;
	GovernanceRelay public governanceRelay;

	// array of candidate addresses
	mapping(uint256 => address[]) public candidates;

	// mapping of candidate indexes
	mapping(uint256 => mapping(address => uint256)) public candidateIndex;

	// number of candidate addresses
	mapping(uint256 => uint256) public candidateCount;

	// map to keep candidate owner
	mapping(uint256 => mapping (address => address)) public candidateOwner;

	// weight given to candidate 
	mapping(uint256 => mapping (address => uint256)) public candidateWeight;

	// array of voter addresses
	mapping(uint256 => address[]) public voters;

	// mapping of voter indexes
	mapping(uint256 => mapping (address => uint256)) public voterIndex;

	// number of voter addresses
	mapping(uint256 => uint256) public voterCount;

	// mapping to track who voted whom
	mapping(uint256 => mapping (address => address)) public voterCandidate;

	// votes given to candidate 
	mapping(uint256 => mapping (address => mapping (address => uint256))) public candidateVoters;

	// finalist variables
	mapping(uint256 => address) public finalist;
	mapping(uint256 => uint256) public finalistWeight;

	// array of supporter addresses
	mapping(uint256 => address[]) public supporters;

	// mapping to supporter index
	mapping(uint256 => mapping(address => uint256)) public supporterIndex;

	// number of supporter addresses
	mapping(uint256 => uint256) public supporterCount;

	// finalist supporters
	mapping(uint256 => mapping (address => uint256)) public finalistSupporters;
	mapping(uint256 => uint256) public finalistSupport;

	// decided contract variables 
	mapping(uint256 => address) public decided;
	mapping(uint256 => uint256) public decidedWeight;	
	mapping(uint256 => uint256) public decidedSupport;
	
	// quorum percentage
	uint public constant quorum = 50;

	// tokens in circulation, main unit
	uint public constant tokensInCirculation = 4000;

	// parameter to determine cycle counter
	uint256 public cycleCounter = 2;

	// candidate submit event
	event SubmitEvent(uint256 indexed _cycle, address indexed _sender , address indexed _candidate);

	// candidate cancel event
	event CancelEvent(uint256 indexed _cycle, address indexed _sender , address indexed _candidate);

	// candidate choose event
	event ChooseEvent(uint256 indexed _cycle, address indexed _sender , address indexed _candidate , uint256 _balance);

	// candidate choose change event
	event ChooseChangeEvent(uint256 indexed _cycle, address indexed _sender , address indexed _candidate , uint256 _oldBalance , uint256 _newBalance);

	// candidate decline event
	event DeclineEvent(uint256 indexed _cycle, address indexed _sender , address indexed _candidate , uint256 _balance);

	// finalist decide event
	event DecideEvent(uint256 indexed _cycle, address indexed _sender , address indexed _finalist , uint256 _balance);

	// finalist decide change event
	event DecideChangeEvent(uint256 indexed _cycle, address indexed _sender , address indexed _finalist , uint256 _oldBalance , uint256 _newBalance);

	// finalist dither event
	event DitherEvent(uint256 indexed _cycle, address indexed _sender , address indexed _finalist , uint256 _balance);

	// governance change event
	event GovernanceRelayChanged(address indexed _governanceRelayAddress);

	/**
	 * @dev constructor initialization
	 *
	 * @param _tokenAddress address of access token	 
	 */
	function Governance(address _tokenAddress) public {
		tokenAddress = _tokenAddress;
		token = AccessToken(_tokenAddress);
	}

	/**
	 * @dev set governance relay contract
	 *
	 * @param _governanceRelayAddress address of governance relay contract
	 */
	function setGovernanceRelay(address _governanceRelayAddress) public onlyOwner {
		governanceRelayAddress = _governanceRelayAddress;
		governanceRelay = GovernanceRelay(governanceRelayAddress);
		GovernanceRelayChanged(_governanceRelayAddress);
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
		require(candidateOwner[cycleCounter][candidate] == address(0));

		// add candidate to list 
		candidateIndex[cycleCounter][candidate] = candidateCount[cycleCounter];
		candidates[cycleCounter].length ++;
		candidates[cycleCounter][candidateCount[cycleCounter] ++] = candidate;

		// set candidate to valid one
		candidateOwner[cycleCounter][candidate] = msg.sender;

		// emit the event 
		SubmitEvent(cycleCounter , msg.sender , candidate);
		
		return true;
	}

	/**
	 * @dev removes governance contract address to list of candidates
	 *
	 * @param candidate address of the deployed contract that sender is cancelling
	 *
	 */
	function cancel(address candidate) public returns (bool) {
		// check if submission stage is running
		require(stage() == 1);
		
		// get the original owner of candidate
		var sender = candidateOwner[cycleCounter][candidate];

		// check if owner has sent cancel request
		if(sender == msg.sender) {
			// remove candidate from list 
			candidateCount[cycleCounter] --;
			candidates[cycleCounter][candidateIndex[cycleCounter][candidate]] = candidates[cycleCounter][candidateCount[cycleCounter]];
			candidateIndex[cycleCounter][candidates[cycleCounter][candidateCount[cycleCounter]]] = candidateIndex[cycleCounter][candidate];

			// set candidate to invalid one
			candidateOwner[cycleCounter][candidate] = address(0);

			// emit the event 
			CancelEvent(cycleCounter , msg.sender , candidate);
		}
		
		return true;
	}

	/**
	 * @dev removes and adds governance contract address to list of candidates
	 *
	 * @param candidate address of the deployed contract that sender is submitting
	 *
	 */
	 function submitSafe(address candidate) public returns (bool) {
	 	cancel(candidate);
	 	submit(candidate);

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
		require(candidateOwner[cycleCounter][candidate] != address(0));
		// check if user have not already voted
		require(candidateVoters[cycleCounter][candidate][msg.sender] == 0);
		// check if user have not already voted to someone else
		require(voterCandidate[cycleCounter][msg.sender] == address(0));

		// set voter variable 
		address voter = msg.sender;

		// get balance of token and check if user has enough balance
		uint256 balance = token.balanceOf(voter);
		require(balance > 0);

		// add weight to candidate
		candidateWeight[cycleCounter][candidate] = candidateWeight[cycleCounter][candidate].add(balance);

		// register voter for candidate
		candidateVoters[cycleCounter][candidate][voter] = candidateVoters[cycleCounter][candidate][voter].add(balance);

		// add voter to list 
		voterIndex[cycleCounter][voter] = voterCount[cycleCounter];
		voters[cycleCounter].length ++;
		voters[cycleCounter][voterCount[cycleCounter] ++] = voter;

		// register voter 
		voterCandidate[cycleCounter][voter] = candidate;

		// emit the event 
		ChooseEvent(cycleCounter , msg.sender , candidate , balance);

		// NOTE: Vote is being added to candidate
		// No need to call finalize method from this method because 
		// weight is getting increased so should always check for higher condition
		if(finalistWeight[cycleCounter] < candidateWeight[cycleCounter][candidate]) {
			finalist[cycleCounter] = candidate;
			finalistWeight[cycleCounter] = candidateWeight[cycleCounter][candidate];
		}

		return true;
	}

	/**
	 * @dev remove vote to governance contract address if applied
	 *
	 */
	function decline() public returns (bool) {
		// check if voting stage is running
		require(stage() == 2);
		
		// set voter variable 
		address voter = msg.sender;

		// get the candidate voter has voted for
		address candidate = voterCandidate[cycleCounter][voter];	

		// check if candidate has really voted
		if(candidate != address(0)) {
			// get voted balance 
			uint256 balance = candidateVoters[cycleCounter][candidate][voter];

			// cancel weight to candidate
			candidateWeight[cycleCounter][candidate] = candidateWeight[cycleCounter][candidate].sub(balance);

			// cancel voter for candidate
			candidateVoters[cycleCounter][candidate][voter] = candidateVoters[cycleCounter][candidate][voter].sub(balance);

			// remove voter from list 
			voterCount[cycleCounter] --;
			voters[cycleCounter][voterIndex[cycleCounter][voter]] = voters[cycleCounter][voterCount[cycleCounter]];
			voterIndex[cycleCounter][voters[cycleCounter][voterCount[cycleCounter]]] = voterIndex[cycleCounter][voter];

			// unregister voter 
			voterCandidate[cycleCounter][voter] = address(0);

			// emit the event 
			DeclineEvent(cycleCounter , msg.sender , candidate , balance);

			// NOTE: Vote is being taken off 
			// So if the vote is being taken off from finalist then re-eveluate finalist
			// Else finalist is not changing anyways
			if(finalist[cycleCounter] == candidate) {
				finalize();
			}
		}

		return true;
	}

	/**
	 * @dev removes existing vote and adds new vote to governance contract
	 *
	 * @param candidate address of the deployed contract that sender is voting
	 *
	 */
	 function chooseSafe(address candidate) public returns (bool) {
	 	decline();
	 	choose(candidate);

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
		require(finalistSupporters[cycleCounter][msg.sender] == 0);

		// supporter variable 
		address supporter = msg.sender;

		// get balance of token and check if user has enough balance
		uint256 balance = token.balanceOf(supporter);
		require(balance > 0);

		// add support to finalist
		finalistSupport[cycleCounter] = finalistSupport[cycleCounter].add(balance);

		// register supporter for finalist
		finalistSupporters[cycleCounter][supporter] = finalistSupporters[cycleCounter][supporter].add(balance);

		// add supporter to list 
		supporterIndex[cycleCounter][supporter] = supporterCount[cycleCounter];
		supporters[cycleCounter].length ++;
		supporters[cycleCounter][supporterCount[cycleCounter] ++] = supporter;

		// emit the event 
		DecideEvent(cycleCounter , msg.sender , finalist[cycleCounter] , balance);
		
		return true;
	}

	/**
	 * @dev adds dither to hightest voted governance contract address 
	 *
	 */
	function dither() public returns (bool) {
		// check if deciding stage is running 
		require(stage() == 3);

		// set voter variable 
		address supporter = msg.sender;

		// get the balance supporter has submitted
		uint256 balance = finalistSupporters[cycleCounter][supporter];	

		// check if finalist was really supported
		if(balance > 0) {
			// remove support to finalist
			finalistSupport[cycleCounter] = finalistSupport[cycleCounter].sub(balance);

			// register supporter for finalist
			finalistSupporters[cycleCounter][supporter] = finalistSupporters[cycleCounter][supporter].sub(balance);

			// remove supporter from list 
			supporterCount[cycleCounter] --;
			supporters[cycleCounter][supporterIndex[cycleCounter][supporter]] = supporters[cycleCounter][supporterCount[cycleCounter]];
			supporterIndex[cycleCounter][supporters[cycleCounter][supporterCount[cycleCounter]]] = supporterIndex[cycleCounter][supporter];

			// emit the event 
			DitherEvent(cycleCounter , msg.sender , finalist[cycleCounter] , balance);
		}

		return true;
	}

	/**
	 * @dev removes existing decision and adds decision to hightest voted governance contract address 
	 *
	 */
	function decideSafe() public returns (bool) {
		dither();
		decide();

		return true;
	}

	/**
	 * @dev iterates over the candidates and decides the finalist
	 *
	 */
	function finalize() public returns (bool) {
		// check if choose or decide stage is running 
		require(stage() == 2 || stage() == 3);

		// get current finalist values
		finalistWeight[cycleCounter] = candidateWeight[cycleCounter][finalist[cycleCounter]];

		for(uint256 i = 0 ; i < candidateCount[cycleCounter] ; i ++) {
			if(finalistWeight[cycleCounter] < candidateWeight[cycleCounter][candidates[cycleCounter][i]]) {
				finalist[cycleCounter] = candidates[cycleCounter][i];
				finalistWeight[cycleCounter] = candidateWeight[cycleCounter][candidates[cycleCounter][i]];
			}				
		}

		return true;
	}

	/**
	 * @dev transfer function is called from token contract 
	 * whenver tokens are transferred between two accounts
	 *
	 * @param from address The address which you want to send tokens from
	 * @param to address The address which you want to transfer to
	 * @param value uint256 the amount of tokens to be transferred
	 */
	function transfer(address from , address to , uint256 value) public returns (bool) {
		uint256 fromBalance = 0;
		uint256 toBalance = 0;

		// check if it is submit stage		
		if(stage() == 1) {
			// do nothing.. it doesn't matter if tokens are moved 
		} 
		// check if it is choose stage 
		else if(stage() == 2) {			
			// check if sender has already voted and change the weight of vote
			address fromCandidate = voterCandidate[cycleCounter][from];	
			if(fromCandidate != address(0)) {
				// get voted balance and reduce the weight of vote
				fromBalance = candidateVoters[cycleCounter][fromCandidate][from];
				candidateWeight[cycleCounter][fromCandidate] = candidateWeight[cycleCounter][fromCandidate].sub(value);
				candidateVoters[cycleCounter][fromCandidate][from] = candidateVoters[cycleCounter][fromCandidate][from].sub(value);

				// emit the event 
				ChooseChangeEvent(cycleCounter , from , fromCandidate , fromBalance , fromBalance.sub(value));

				// NOTE: Vote is being taken off 
				// So if the vote is being taken off from finalist then re-eveluate finalist
				// Else finalist is not changing anyways
				if(finalist[cycleCounter] == fromCandidate) {
					finalize();
				}
			}

			// check if receiver has already voted and change the weight of vote
			address toCandidate = voterCandidate[cycleCounter][to];	
			if(toCandidate != address(0)) {
				// get voted balance and increase the weight of vote
				toBalance = candidateVoters[cycleCounter][toCandidate][to];
				candidateWeight[cycleCounter][toCandidate] = candidateWeight[cycleCounter][toCandidate].add(value);
				candidateVoters[cycleCounter][toCandidate][to] = candidateVoters[cycleCounter][toCandidate][to].add(value);

				// emit the event 
				ChooseChangeEvent(cycleCounter , to , toCandidate , toBalance , toBalance.add(value));

				// NOTE: Vote is being added to candidate
				// No need to call finalize method from this method because 
				// weight is getting increased so should always check for higher condition
				if(finalistWeight[cycleCounter] < candidateWeight[cycleCounter][toCandidate]) {
					finalist[cycleCounter] = toCandidate;
					finalistWeight[cycleCounter] = candidateWeight[cycleCounter][toCandidate];
				}
			}
		}
		// check if it is decide stage 
		else if(stage() == 3) {
			// check if sender has already supported and change the weight of vote
			fromBalance = finalistSupporters[cycleCounter][from];	
			if(fromBalance > 0) {
				// reduce the weight of support
				finalistSupport[cycleCounter] = finalistSupport[cycleCounter].sub(value);
				finalistSupporters[cycleCounter][from] = finalistSupporters[cycleCounter][from].sub(value);

				// emit the event 
				DecideChangeEvent(cycleCounter , from , finalist[cycleCounter] , fromBalance , fromBalance.sub(value));
			}

			// check if receiver has already supported and change the weight of vote
			toBalance = finalistSupporters[cycleCounter][to];	
			if(toBalance > 0) {
				// reduce the weight of support
				finalistSupport[cycleCounter] = finalistSupport[cycleCounter].add(value);
				finalistSupporters[cycleCounter][to] = finalistSupporters[cycleCounter][to].add(value);

				// emit the event 
				DecideChangeEvent(cycleCounter , to , finalist[cycleCounter] , toBalance , toBalance.add(value));
			}
		}
	}

	/**
	 * @dev checks transfer function is locked or not
	 * whenver tokens are transferred between two accounts
	 *
	 * @param from address The address which you want to send tokens from
	 */
	function transferLocked(address from) public view returns (bool) {
		// check if choose stage is running
		if(stage() == 2) {			
			// check if sender has already voted and change the weight of vote
			address fromCandidate = voterCandidate[cycleCounter][from];	
			if(fromCandidate != address(0)) {
				return true;
			}
		}
		return false;
	}

	/**
	 * @dev checks if quorum reached
	 *
	 */
	function isQuorumReached(uint256 _cycleCounter) public view returns (bool) {
		// check if quorum reached
		bool quorumReached = false;
		if(finalistSupport[_cycleCounter].mul(100).div(tokensInCirculation.mul(1E18)) >= quorum) {
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
		require(finalist[cycleCounter] != address(0));

		// check if quorum reached
		if(isQuorumReached(cycleCounter)) {
			if (cycle() == 0) {
				// switch governance contract
				governanceRelay.setGovernance(finalist[cycleCounter]);
			}
			else {
				// switch decision module contract
				governanceRelay.setDecisionModule(finalist[cycleCounter]);
			}			
		}

		// update the decided values
		decided[cycleCounter] = finalist[cycleCounter];
		decidedWeight[cycleCounter] = finalistWeight[cycleCounter];
		decidedSupport[cycleCounter] = finalistSupport[cycleCounter];
		
		// finalist[cycleCounter] = address(0);
		// finalistWeight[cycleCounter] = 0;
		// finalistSupport[cycleCounter] = 0;

		// increment cycle counter
		cycleCounter = cycleCounter + 1;


		return true;
	}	
}