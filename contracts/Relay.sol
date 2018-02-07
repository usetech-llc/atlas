pragma solidity ^0.4.16;

contract Relay {

	/*** FIELDS ***/
	address public governance;
	address public decision_module;
	address public constant incentive_pool = 0x00;	//CHANGE

	/*** MODIFIERS ***/
	modifier onlyGovernance() {
		require(governance == msg.sender); // only run if called by Governance Contract
		_;
	}

	/*** FUNCTIONS ***/
	function Relay(address initial_governance) {
		governance = initial_governance;
		decision_module = 0x0;
	}

	// swap governance address following successful governance cycle
	function setGovernance(address new_governance) public onlyGovernance {
		governance = new_governance; // set new governance address
	}

	function setDecisionModule(address new_decision_module) public onlyGovernance {
		decision_module = new_decision_module; // set new decision module address
	}

	// this can be a return function that just returns the current addresses of the DM and G contracts
	function() public {
		// find way to do dynamic call delegation... option to delegatecall to governance or DM
		require(governance.delegatecall(msg.data) || decision_module.delegatecall(msg.data)); // this is an expensive approach
	}
	/* apparently delegatecall only forwards and cannot return values from functions? ... if so this is problematic */

}

// inspired by https://consensys.github.io/smart-contract-best-practices/software_engineering/