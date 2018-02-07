pragma solidity ^0.4.16;

contract Governance {

	/*** FIELDS ***/
	mapping (address => uint) public avaliable_votes; 	// maps addresses to balance - votes_cast;

	address[] public amendments; // submitted amendments
	mapping (address => mapping(uint => uint)) public amendment_support; // voter support for each amendment

	address public finalist; // address of finalist
	uint public finalist_support; // voting weight of finalist
	
	uint public cycle_counter;
	uint public constant quorum = 50; // 50% quorum

	/*
	bool public inflation_bool = true;
	*/

	/*** FUNCTIONS ***/
	// constructor
	function Governance() {
		finalist = 0;
		finalist_support = 0;
		cycle_counter = 2; 	// initializing to 2 forces 1 DM cycle before our first G cycle
	}

	function computeElectionStage() public constant returns (uint) {
		// every block is apprx 15 seconds
		// apprx 31,557,600 seconds in a year -> 2,103,840 blocks
		// -> 2,000,000
		// 1,000,000 in 6 months
		uint mod = block.number%1000000;
		if (mod < 500000){
			if (mod < 166667){
				return 1;			// stage 1 (submit)
			}
			else if (mod < 333333){
				return 2;			// stage 2 (choose)
			}
			else {
				return 3;			// stage 3 (decide)
			}
		}
		else {
			return 0;				// non-election
		}
	}

	function submit(address submission) public {
		require(computeElectionStage() == 1); // in stage 1 (submit)?
		//amendments.push(submission);
	}

	function choose(address choice) public {
		require(computeElectionStage() == 2); // in stage 2 (choose)?
		//remove vote weight = 0;
		// transfer method in token contract should call this for the sender
		// add voting weight (sender's balance) to the address chosen
		//remove vote weight

		// CALCULATE MY VOTING WEIGHT & prevent double voting 

		uint weight = 1; // PLACEHOLDER
		amendment_support[cycle_counter][choice] += weight; // add voting weight
		if (amendment_support[cycle_counter][choice] > amendment_support[cycle_counter][finalist]) {
			finalist = choice; // update address with most votes
		}
	}

	// called by voters to support finalist (those against just abstain)
	function decide() public {
		require(computeElectionStage() == 3); // in decision stage?

		// CALCULATE MY VOTING WEIGHT & prevent double voting

	 	// add voting weight to finalist_support
	 	uint weight = 1; // PLACEHOLDER
	 	finalist_support += weight;
	}

	// determine if the finalist amendment reached quorum
	function closeElection() public {
		require(computeElectionStage() == 0); // is election over?
		require(finalist != 0); // check that closeElection has not been called
		bool quorum_reached = false;
	
		uint circulating_tokens = 6000000; // PLACEHOLDER
		if (finalist_support*100/circulating_tokens > quorum){
			address temp  = finalist; // save finalist address in local variable
			quorum_reached = true;
		}

		// RESET PARAMETERS
		finalist = 0; 
		finalist_support = 0;

		cycle_counter += 1; // incremenet cycle_counter
		
		if (quorum_reached){
			if ((cycle_counter-1)%3 == 0) {
				// external call to switch governance contract
				//
			}
			else {
				// external call to switch DM contract
			}
		}
		
	}

}
