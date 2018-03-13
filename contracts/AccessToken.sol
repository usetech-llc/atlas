pragma solidity ^0.4.18;

import "zeppelin-solidity/contracts/token/ERC20/MintableToken.sol";
import "./IncentivePool.sol";
import "./Relay.sol";

contract AccessToken is MintableToken {
	string public constant name = "AccessToken";
	string public constant symbol = "ACX";
	uint8 public constant decimals = 18;

	address private minter;
	IncentivePool private incentivePool;

	// current governance relay contract address
	address public relayAddress;
	Relay public relay;

	/**
	* Modifier: only allowed addresses can mint
	*
	*/
	modifier onlyMinters() {
		require((minter == msg.sender) || (owner == msg.sender));
		_;
	}

	// governance change event
	event RelayChanged(address indexed _relayAddress);

	function AccessToken() public {
	}

	/**
	*  Set address of allowed minter
	*
	* @param _minterAddress - address that is allowed to mint
	*/
	function setMinter(address _minterAddress) onlyOwner external {
		minter = _minterAddress;
	}

	/**
	*  Set address of incentive pool contract
	*
	* @param _incentivePoolAddress - address of IncentivePool
	*/
	function setIncentivePool(address _incentivePoolAddress) onlyOwner external {
		incentivePool = IncentivePool(_incentivePoolAddress);
	}

	/**
	*  Mint tokens
	*
	* @param _to - address that will reveive new tokens
	* @param _amount - amount to mint (in token * 10^decimals units)
	* @return true in case of success
	*/
	function mint(address _to, uint256 _amount) onlyMinters canMint public returns (bool) {
		totalSupply_ = totalSupply_.add(_amount);
		balances[_to] = balances[_to].add(_amount);
		Mint(_to, _amount);
		Transfer(address(0), _to, _amount);
		return true;
	}

	/**
	 * @dev set new governance relay contract
	 *
	 * @param _relayAddress address of governance relay contract
	 */
	function setRelay(address _relayAddress) public onlyOwner {
		relayAddress = _relayAddress;
		relay = Relay(relayAddress);
		RelayChanged(_relayAddress);
	}

	/**
	 * @dev transfer token for a specified address
	 * @param _to The address to transfer to.
	 * @param _value The amount to be transferred.
	 */
	function transfer(address _to, uint256 _value) public returns (bool) {
		//require(relay.transferLocked(msg.sender, _to) == false);

		// Reset sender's inflation vote in incentive pool
		incentivePool.resetInflationVote(msg.sender);

		bool result = super.transfer(_to , _value);
		relay.transfer(msg.sender , _to , _value);

		return result;
	}

	/**
	 * @dev Transfer tokens from one address to another
	 * @param _from address The address which you want to send tokens from
	 * @param _to address The address which you want to transfer to
	 * @param _value uint256 the amount of tokens to be transferred
	 */
	function transferFrom(address _from, address _to, uint256 _value) public returns (bool) {
		require(relay.transferLocked(_from, _to) == false);

		// Reset sender's inflation vote in incentive pool
		incentivePool.resetInflationVote(_from);

		bool result = super.transferFrom(_from , _to , _value);
		relay.transfer(_from , _to , _value);

		return result;
	}
}
