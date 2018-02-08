var AccessToken = artifacts.require("./AccessToken.sol");
var AccessTokenSale = artifacts.require("./AccessTokenSale.sol");
var AccessTokenVesting = artifacts.require('./AccessTokenVesting.sol');

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

		});			
	});	
};
