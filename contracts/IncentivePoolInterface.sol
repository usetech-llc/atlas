pragma solidity ^0.4.16;

contract IncentivePoolInterface {

	function allocateACX(uint payout, address recipient) external;
	function allocateETH(uint payout, address recipient) external;
	function claimACX() external;
	function claimETH() external;
	function inflationSwitch() public;
	function resetInflationVote(address _addr) external;
	function updateInflation() external;
	function getCurrentInflation() public constant returns (uint256);

}
