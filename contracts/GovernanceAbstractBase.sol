pragma solidity ^0.4.16;
import "./CommonParams.sol";

contract GovernanceAbstractBase is CommonParams {

    // declare this function just to add some functionality
    function version() public returns (string);

    // this function should not be changed in child contracts - to save compatibility with IncentivePool
    function interfaceID() public pure returns (bytes32) {
        return CommonParams.g_interfaceID;
    }

}
