pragma solidity ^0.4.18;

import "zeppelin-solidity/contracts/token/ERC20/MintableToken.sol";
import "./IncentivePool.sol";

contract AccessToken is MintableToken {

	string public constant name = "AccessToken";
	string public constant symbol = "ACX";
	uint8 public constant decimals = 18;

	address private minter;
	IncentivePool private incentivePool;

	/**
	* Modifier: only allowed addresses can mint
	*
	*/
	modifier onlyMinters() {
		require((minter == msg.sender) || (owner == msg.sender));
		_;
	}

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
	*  Overrides standard transfer method to support voting reset
	*
	* @param _to - token receiver
	* @param _value - amount to transfer (in token * 10^decimals units)
	* @return true in case of success
	*/
	function transfer(address _to, uint256 _value) public returns (bool) {
		// Reset sender's inflation vote in incentive pool
		incentivePool.resetInflationVote(msg.sender);

		return BasicToken.transfer(_to, _value);
	}

	/**
	*  Overrides standard transferFrom method to support voting reset
	*
	* @param _from - token spender
	* @param _to - token receiver
	* @param _value - amount to transfer (in token * 10^decimals units)
	* @return true in case of success
	*/
	function transferFrom(address _from, address _to, uint256 _value) public returns (bool) {
		// Reset sender's inflation vote in incentive pool
		incentivePool.resetInflationVote(_from);

		return StandardToken.transferFrom(_from, _to, _value);
	}
}
