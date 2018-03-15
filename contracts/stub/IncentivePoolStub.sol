pragma solidity ^0.4.18;
import '../IncentivePool.sol';

contract IncentivePoolStub is IncentivePool {

	uint256 public last_ACX_update;

	function IncentivePoolStub(address _relay, address _token) public
		IncentivePool(_relay, _token) {
	}

	function getCurveValueTestable(uint256 _timestamp) public constant returns (uint256) {
		return getCurveValue(_timestamp);
	}

	function getMintedAmountForTimestampTestable(uint256 timeStamp) public constant returns (uint256 mintedTokenAmount) {
		return getMintedAmountForTimestamp(timeStamp);
	}

	function mintACXTestable() public {
		mintACX();
		last_ACX_update = now;
	}

	function setInflationRate(uint256 _rate, uint256 _timestamp) public {
		inflation_timestamp.push(_timestamp);
		inflation_rate.push(_rate);
	}
}
