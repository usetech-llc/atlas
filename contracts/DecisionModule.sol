pragma solidity ^0.4.18;

import "zeppelin-solidity/contracts/math/SafeMath.sol";
import "zeppelin-solidity/contracts/ownership/Ownable.sol";
import "./Timestamped.sol";
import "./AccessToken.sol";
import "./Relay.sol";
import "./DecisionModuleAbstractBase.sol";

contract DecisionModule is Ownable, Timestamped, DecisionModuleAbstractBase {
	using SafeMath for uint256;

	// token contract address 
	address public tokenAddress;
	AccessToken public token;

	// current relay contract address 
	address public relayAddress;
	Relay public relay;

	/**
	 * @dev constructor initialization
	 *
	 * @param _tokenAddress address of access token	 
	 */
	function DecisionModule(address _tokenAddress) public {
		tokenAddress = _tokenAddress;
		token = AccessToken(_tokenAddress);
	}

	/**
	 * @dev modifier to check only relay can call it
	 *
	 */
	modifier onlyRelay() {
		require(relayAddress == msg.sender);
		_;
	}

	/**
	 * @dev set relay contract
	 *
	 * @param _relayAddress address of governance relay contract
	 */
	function setRelay(address _relayAddress) public onlyOwner {
		require(relayAddress == address(0));
		relayAddress = _relayAddress;
		relay = Relay(relayAddress);
	}

	/**
	 * @dev transfer function is called from token contract 
	 * whenver tokens are transferred between two accounts
	 *
	 * @param from address The address which you want to send tokens from
	 * @param to address The address which you want to transfer to
	 * @param value uint256 the amount of tokens to be transferred
	 */
	function transfer(address from , address to , uint256 value) public onlyRelay {
			
	}

	/**
	 * @dev checks transfer function is locked or not
	 * whenver tokens are transferred between two accounts
	 *
	 * @param from address The address which you want to send tokens from
	 * @param to address The address which you want to receive tokens to
	 */
	function transferLocked(address from, address to) public view returns (bool) {
		return false;
	}

	function version() public returns (string) {
		return "1.0";
	}
}