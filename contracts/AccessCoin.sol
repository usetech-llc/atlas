pragma solidity ^0.4.16;

import "zeppelin-solidity/contracts/crowdsale/CappedCrowdsale.sol";
import "zeppelin-solidity/contracts/crowdsale/RefundableCrowdsale.sol";
import "zeppelin-solidity/contracts/token/MintableToken.sol";
import 'zeppelin-solidity/contracts/token/TokenVesting.sol';

contract AccessCoin is MintableToken {
  
  string public constant name = "AccessCoin";
  string public constant symbol = "ACX";
  uint8 public constant decimals = 18;

  // function AccessCoin() public {
  //  // initialize supply?
  // }

}

contract AccessCoinCrowdsale is CappedCrowdsale, RefundableCrowdsale {

  function AccessCoinCrowdsale(uint256 _startTime, uint256 _endTime, uint256 _rate, uint256 _goal, uint256 _cap, address _wallet) public
    CappedCrowdsale(_cap)
    FinalizableCrowdsale()
    RefundableCrowdsale(_goal)
    Crowdsale(_startTime, _endTime, _rate, _wallet)
  {
    //As goal needs to be met for a successful crowdsale
    //the value needs to less or equal than a cap which is limit for accepted funds
    require(_goal <= _cap);
  }



  // initialize TokenVesting contracts for each advisor (advisor[]) and founder (founders[])


  //@override
  function createTokenContract() internal returns (MintableToken) {
    return new AccessCoin();
  }

}
