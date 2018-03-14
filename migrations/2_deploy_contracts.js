var AccessToken = artifacts.require("./AccessToken.sol");
var AccessTokenSale = artifacts.require("./AccessTokenSale.sol");
var AccessTokenVesting = artifacts.require('./AccessTokenVesting.sol');

var Governance = artifacts.require('./Governance.sol');
var DecisionModule = artifacts.require('./DecisionModule.sol');
var Relay = artifacts.require('./Relay.sol');

module.exports = function(deployer , network , accounts) {	
	var owner = accounts[0];
		
	deployer.deploy(AccessToken).then(function(){
		AccessToken.deployed().then(function(tokenInstance) {
			console.log('----------------------------------');
			console.log('Token Instance' , tokenInstance.address);
			console.log('----------------------------------');


			deployer.deploy(AccessTokenVesting , tokenInstance.address , 1520985599 + 1 , 30 * 60 * 60 * 24 , 1080 * 60 * 60 * 24 , true).then(function() {
				AccessTokenVesting.deployed().then(async function(vestingInstance) {
					console.log('----------------------------------');
					console.log('Token Vesting Instance' , vestingInstance.address);
					console.log('----------------------------------');


					deployer.deploy(AccessTokenSale , tokenInstance.address , vestingInstance.address).then(function() {
						AccessTokenSale.deployed().then(async function(saleInstance) {
							console.log('----------------------------------');
							console.log('Sale Instance' , saleInstance.address);
							console.log('----------------------------------');

							// mint tokens to sale contract
							var phase3Hardcap = await saleInstance.phase3Hardcap.call();
							await tokenInstance.mint(saleInstance.address , phase3Hardcap , {from: owner});

							// mint exchange tokens to sale contract
							var tokenVestingAmount = await saleInstance.tokenVestingAmount.call();
							await tokenInstance.mint(saleInstance.address , tokenVestingAmount , {from: owner});
						});
					});	

				});
			});	


			deployer.deploy(Governance , tokenInstance.address).then(function() {
				Governance.deployed().then(async function(governanceInstance) {
					console.log('----------------------------------');
					console.log('Governance Instance' , governanceInstance.address);
					console.log('----------------------------------');

					
					deployer.deploy(DecisionModule , tokenInstance.address).then(function() {
						DecisionModule.deployed().then(async function(decisionModuleInstance) {
							console.log('----------------------------------');
							console.log('Decision Module Instance' , decisionModuleInstance.address);
							console.log('----------------------------------');

							
							deployer.deploy(Relay , tokenInstance.address, governanceInstance.address , decisionModuleInstance.address).then(function() {
								Relay.deployed().then(async function(relayInstance) {
									console.log('----------------------------------');
									console.log('Relay Instance' , relayInstance.address);
									console.log('----------------------------------');

									// set reference to governance instance
									await tokenInstance.setRelay(relayInstance.address);
									await governanceInstance.setRelay(relayInstance.address);
									await decisionModuleInstance.setRelay(relayInstance.address);
								});
							});
						});
					});		
				});
			});	
		});			
	});	
};
