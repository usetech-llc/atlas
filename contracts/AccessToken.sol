pragma solidity ^0.4.18;

import "zeppelin-solidity/contracts/token/ERC20/MintableToken.sol";

contract AccessToken is MintableToken {
  
	string public constant name = "AccessToken";
	string public constant symbol = "ACX";
	uint8 public constant decimals = 18;

	function AccessToken() public {

	}

	//	vpredtechenskaya 22.02.2018 added temporary to test
	function mint(address _to, uint256 _amount) canMint public returns (bool) {
		totalSupply_ = totalSupply_.add(_amount);
		balances[_to] = balances[_to].add(_amount);
		Mint(_to, _amount);
		Transfer(address(0), _to, _amount);
		return true;
	}
}
