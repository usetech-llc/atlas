pragma solidity ^0.4.18;

import "zeppelin-solidity/contracts/token/ERC20/MintableToken.sol";

contract AccessToken is MintableToken {
  
	string public constant name = "AccessToken";
	string public constant symbol = "ACX";
	uint8 public constant decimals = 18;

	function AccessToken() public {

	}
}
