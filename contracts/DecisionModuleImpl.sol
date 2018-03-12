pragma solidity ^0.4.16;
import "./DecisionModule.sol";

contract DecisionModuleImpl is DecisionModule {

    function DecisionModuleImpl(address _address) DecisionModule(_address) public {}

    function version() public returns (string) {
        return "0.1";
    }
}