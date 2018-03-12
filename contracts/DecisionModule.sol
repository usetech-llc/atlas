pragma solidity ^0.4.16;
import "./IncentivePoolParams.sol";

contract DecisionModule is IncentivePoolParams {

    // account address of "decision module"
    address public dm_address;

    function DecisionModule(address _address) internal{
        dm_address = _address;
    }

    // declare this function just to add some functionality
    function version() public returns (string);

    // this function should not be changed in child contracts - to save compatibility with IncentivePool
    function interfaceID() public pure returns (bytes32) {
        return IncentivePoolParams.dm_interfaceID;
    }

}