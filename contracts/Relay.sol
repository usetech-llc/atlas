pragma solidity ^0.4.18;

import "zeppelin-solidity/contracts/math/SafeMath.sol";
import "zeppelin-solidity/contracts/ownership/Ownable.sol";
import "./AccessToken.sol";
import "./Governance.sol";
import "./DecisionModule.sol";
import "./CommonParams.sol";

contract Relay is CommonParams {
	using SafeMath for uint256;

	// current token contract address
	address public tokenAddress;
	AccessToken public token;

	// current governance contract address
	address public governanceAddress;
	Governance public governance;

	// current decision module address
	address public decisionModuleAddress;
	DecisionModule public decisionModule;

	// governance change event
	event GovernanceChanged(address indexed _governanceAddress);

	// decision module change event
	event DecisionModuleChanged(address indexed _decisionModuleAddress);

	/**
	 * @dev initializes contract with default contracts
	 *
	 * @param _governanceAddress address of governance address
	 * @param _decisionModuleAddress address of decision module address
	 */
	function Relay(address _tokenAddress , address _governanceAddress , address _decisionModuleAddress) public {
		tokenAddress = _tokenAddress;
		token = AccessToken(tokenAddress);

		governanceAddress = _governanceAddress;
		governance = Governance(governanceAddress);
		if(governance.interfaceID() != g_interfaceID){
			revert();
		}

		decisionModuleAddress = _decisionModuleAddress;
		decisionModule = DecisionModule(decisionModuleAddress);
		if(decisionModule.interfaceID() != dm_interfaceID){
			revert();
		}
	}

	/**
	 * @dev modifier to check only governance can call it
	 *
	 */
	modifier onlyGovernance() {
		// added this condition because governance contract might push decision module based on counter
		// see test case "governance : close : should allow close finalist with quorum reached"
		require(governanceAddress == msg.sender);
		_;
	}

	/**
	 * @dev modifier to check only token can call it
	 *
	 */
	modifier onlyToken() {
		require(tokenAddress == msg.sender);
		_;
	}

	/**
	 * @dev set new governance contract
	 *
	 * @param _governanceAddress address of governance contract
	 */
	function setGovernance(address _governanceAddress) public onlyGovernance {
		governanceAddress = _governanceAddress;
		governance = Governance(governanceAddress);
		GovernanceChanged(_governanceAddress);
		if(governance.interfaceID() != g_interfaceID){
			revert();
		}
	}

	/**
	 * @dev set new decision module contract
	 *
	 * @param _decisionModuleAddress address of decision module contract
	 */
	function setDecisionModule(address _decisionModuleAddress) public onlyGovernance {
		decisionModuleAddress = _decisionModuleAddress;
		decisionModule = DecisionModule(decisionModuleAddress);
		DecisionModuleChanged(_decisionModuleAddress);
		if(decisionModule.interfaceID() != dm_interfaceID){
			revert();
		}
	}

    /**
	 * @dev sends token transfer call to active contract
	 *
	 * @param from address The address which you want to send tokens from
	 * @param to address The address which you want to transfer to
	 * @param value uint256 the amount of tokens to be transferred
	 */
	function transfer(address from, address to, uint256 value) public onlyToken {
		governance.transfer(from, to, value);
		decisionModule.transfer(from, to, value);
	}

	/**
	* @dev checks transfer function is locked or not
	* whenver tokens are transferred between two accounts
	*
	* @param from address The address which you want to send tokens from
	* @param to address The address which you want to receive tokens to
	*/
	function transferLocked(address from, address to) public view returns (bool) {
		return governance.transferLocked(from, to) || decisionModule.transferLocked(from, to);
	}
}

// inspired by https://consensys.github.io/smart-contract-best-practices/software_engineering/
