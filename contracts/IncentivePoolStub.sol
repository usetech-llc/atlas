pragma solidity ^0.4.18;
import './IncentivePool.sol';

contract IncentivePoolStub is IncentivePool {

  function IncentivePoolStub(address _relay, address _token) public
		IncentivePool(_relay, _token) {
	}

	function getCurveValueTestable(uint256 _timestamp) public constant returns (uint256) {
		return getCurveValue(_timestamp);
	}

	function getMintedAmountForTimestampTestable(uint256 timeStamp) internal constant returns (uint256 mintedTokenAmount) {
		return getMintedAmountForTimestamp(timeStamp);
	}

}
