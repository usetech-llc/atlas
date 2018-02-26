pragma solidity ^0.4.18;

import "zeppelin-solidity/contracts/ownership/Ownable.sol";

/**
 * @title Timestamped
 * @dev The Timestamped contract has sets dummy timestamp for method calls
 */
contract Timestamped is Ownable {
	uint256 public ts = 0;
	uint256 public plus = 0;
	uint256 public bn = 0;

	function setBlockTime(uint256 _ts) public onlyOwner {
		ts = _ts;
	}

	function setPlusTime(uint256 _plus) public onlyOwner {
		plus = _plus;
	}

	function getBlockTime() public view returns (uint256) {
		if(ts > 0) {
			return ts + plus;
		} else {
			return block.timestamp + plus; 
		}
	}

	function setBlockNumber(uint256 _bn) public onlyOwner {
		bn = _bn;
	}

	function getBlockNumber() public view returns (uint256) {
		if(bn > 0) {
			return bn;
		} else {
			return block.number; 
		}
	}
}