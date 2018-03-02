var AccessToken = artifacts.require("./AccessToken.sol");
var IncentivePool = artifacts.require("./IncentivePool.sol");
var Relay = artifacts.require("./Relay.sol");

module.exports = function(deployer , network , accounts) {
    var owner = accounts[0];
    var governance = accounts[1];
    var decision_module = accounts[2];

    AccessToken.deployed().then(function(){
        AccessToken.deployed().then(function(tokenInstance){
            console.log('""""""""""""""""""""""""""""""""""');
            console.log('Token Instance' , tokenInstance.address);
            console.log('""""""""""""""""""""""""""""""""""');

            deployer.deploy(Relay, governance).then(function(){

                Relay.deployed().then(function(relayInstance){
                    relayInstance.setDecisionModule(decision_module);

                    console.log('""""""""""""""""""""""""""""""""""');
                    console.log('Relay Instance' , relayInstance.address);
                    console.log('""""""""""""""""""""""""""""""""""');

                    deployer.deploy(IncentivePool, relayInstance.address, tokenInstance.address).then(function(){
                        IncentivePool.deployed().then(function (incentivePoolInstance) {

                            console.log('""""""""""""""""""""""""""""""""""');
                            console.log('Incentive Pool Instance' , incentivePoolInstance.address);
                            console.log('""""""""""""""""""""""""""""""""""');
                        });
                    });
                });
            });
        });
    });
}