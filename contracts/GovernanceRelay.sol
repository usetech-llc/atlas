pragma solidity ^0.4.18;

import "zeppelin-solidity/contracts/math/SafeMath.sol";
import "zeppelin-solidity/contracts/ownership/Ownable.sol";

contract GovernanceRelay {
	using SafeMath for uint256;

	// current governance contract address 
	address public governanceAddress;

	// current decision module address
	address public decisionModuleAddress;

	// current incentive pool address
	address public incentivePoolAddress;

	// governance change event
	event GovernanceChanged(address indexed _governanceAddress);

	// decision module change event
	event DecisionModuleChanged(address indexed _decisionModuleAddress);

	/**
	 * @dev initializes contract with default contracts
	 *
	 * @param _governanceAddress address of governance address	 
	 * @param _decisionModuleAddress address of decision module address	 
	 * @param _incentivePoolAddress address of incentive pool address	 
	 */
	function GovernanceRelay(address _governanceAddress , address _decisionModuleAddress , address _incentivePoolAddress) public {
		governanceAddress = _governanceAddress;
		decisionModuleAddress = _decisionModuleAddress;
		incentivePoolAddress = _incentivePoolAddress;
	}

	/**
	 * @dev modifier to check only governance can call it
	 *
	 */
	modifier onlyGovernance() {
		require(governanceAddress == msg.sender);
		_;
	}

	/**
	 * @dev modifier to check only decision module can call it
	 *
	 */
	modifier onlyDecisionModule() {
		require(decisionModuleAddress == msg.sender);
		_;
	}

	/**
	 * @dev set new governance contract
	 *
	 * @param _governanceAddress address of governance contract
	 */
	function setGovernance(address _governanceAddress) public onlyGovernance {
		governanceAddress = _governanceAddress;
		GovernanceChanged(_governanceAddress);
	}

	/**
	 * @dev set new decision module contract
	 *
	 * @param _decisionModuleAddress address of decision module contract
	 */
	function setDecisionModule(address _decisionModuleAddress) public onlyGovernance {
		decisionModuleAddress = _decisionModuleAddress;
		DecisionModuleChanged(_decisionModuleAddress);
	}

	/**
	 * @dev method to delegate calls to governance
	 *
	 */
	function() public {
        require(governanceAddress.delegatecall(msg.data));
    }

    // function setBlockNumber(uint256 blockNumber) public {
    // 	 governanceAddress.delegatecall(bytes4(keccak256("setBlockNumber(uint256)")), blockNumber);
    // }
}