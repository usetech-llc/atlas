pragma solidity ^0.4.16;

contract IncentivePool {

	/*** FIELDS ***/
	address public constant relay = 0x00; // CHANGE

	// time periods
	uint public constant deterministic_minting_period = 10 years;
	uint public constant ETH_unlocking_period = 5 years;
	// timestamps
	uint public genesis;
	uint public last_ACX_update;
	uint public last_ETH_update;

	uint public ACX_minted; // cumulative ACX minted
	uint public ACX_balance; // ACX_minted minus ACX distributed

	uint public ETH_unlocked; // cumulative ETH unlocked
	uint public ETH_balance; // ETH_unlocked minus ETH distributed

	mapping (address => uint) public ACX_allocations;
	mapping (address => uint) public ETH_allocations;

	uint public inflation_rate;
	uint public inflation_support;
	mapping (address => bool) public inflation_votes;

	/*** MODIFIERS ***/
	modifier onlyController() {
		//require(relay.decision_module == msg.sender || relay.governance == msg.sender); // only DM & G contracts can request reward allocations
		_;
	}

	/*** FUNCTIONS ***/
	// Constructor
	function IncentivePool() {
		uint cur = now;
		genesis = cur;
		last_ACX_update = cur;
		last_ETH_update = cur;
		ACX_minted = ACX_balance = ETH_unlocked = ETH_balance = 0;
		inflation_rate = inflation_support = 0;
	}

	// Following the "Withdrawal from Contracts" pattern (https://solidity.readthedocs.io/en/latest/common-patterns.html#withdrawal-from-contracts)
	function allocateACX(uint payout, address recipient) public onlyController {
		ACX_allocations[recipient] += payout;
		ACX_balance -= payout;
		// call mintACX
	}

	function allocateETH(uint payout, address recipient) public onlyController {
		ETH_allocations[recipient] += payout;
		ETH_balance -= payout;
		// call unlockETH
	}

	function claimACX() external {
		uint payout = ACX_allocations[msg.sender];
		ACX_allocations[msg.sender] = 0; // update sender's ACX allocation to 0
		//AccessCoin.transfer(msg.sender, payout); // transfer ACX to sender
	}

	function claimETH() external {
		uint payout = ETH_allocations[msg.sender];
		ETH_allocations[msg.sender] = 0; // update sender's ETH allocation to 0
		msg.sender.transfer(payout); // transfer ETH to sender
	}

	// updates ACX supply every time rewards are allocated (based on time elapsed since last update)
	function mintACX() private {
		/* 3 cases:
			a. last update and now are in deterministic period
			b. last update is in deterministic period, now is dynamic period
			c. last update and now are in dynamic period
		*/
		// (purposely redundant for clarity)
		if (last_ACX_update < deterministic_minting_period && now < deterministic_minting_period) {
			// update according to curve
		}
		else if (last_ACX_update < deterministic_minting_period && now >= deterministic_minting_period) {
			// update according to curve + dynamic rate
		}
		else if (last_ACX_update >= deterministic_minting_period && now >= deterministic_minting_period){
			// update according to dynamic rate
		}
		last_ACX_update = now;
	}

	// updates ETH unlocked every time ETH rewards are allocated (based on time elapsed since last update)
	function unlockETH() private {
		/* 2 cases
			a. now is in unlocking period
			b. last_update is in unlocking period, now is past it
		*/
		if (now < ETH_unlocking_period){
			// update according to curve
		}
		else if (last_ETH_update < ETH_unlocking_period && now >= ETH_unlocking_period){
			// update according to curve up to end of unlocking period
		}
		last_ETH_update = now;
	}

	function inflationSwitch() public {
		// flip the inflation vote of the sender's tokens
		bool support = inflation_votes[msg.sender];
		if (support) {
			inflation_votes[msg.sender] = false;
			//inflation_support -= AccessCoin.balance(msg.sender);
		}
		else {
			inflation_votes[msg.sender] = true;
			//inflation_support += AccessCoin.balance(msg.sender);	
		}
		//inflation_rate = inflation_support / circulating_supply; // update master inflation rate accordingly		
	}

}
