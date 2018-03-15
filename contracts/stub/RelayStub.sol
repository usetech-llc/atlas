pragma solidity ^0.4.18;
import '../Relay.sol';

contract RelayStub is Relay {

    function RelayStub(address _tokenAddress , address _governanceAddress , address _decisionModuleAddress) public
        Relay(_tokenAddress, _governanceAddress, _decisionModuleAddress) {
    }

    function setGovernanceAddress(address _governanceAddress){
        governanceAddress =_governanceAddress;
    }

    function setDecisionModuleAddress(address _decisionModuleAddress){
        decisionModuleAddress =_decisionModuleAddress;
    }

}