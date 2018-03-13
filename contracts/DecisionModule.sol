pragma solidity ^0.4.16;
import "./DecisionModule.sol";

contract DecisionModule is DecisionModuleAbstractBase {

    function version() public returns (string) {
        return "0.1";
    }
}
