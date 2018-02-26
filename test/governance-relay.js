// 'use strict';
// var assert_throw = require('./helpers/utils').assert_throw;
// var AccessToken = artifacts.require("./AccessToken.sol");

// var Governance = artifacts.require("./Governance.sol");
// var GovernanceRelay = artifacts.require("./GovernanceRelay.sol");

// const promisify = (inner) =>
// 	new Promise((resolve, reject) =>
// 		inner((err, res) => {
// 			if (err) { reject(err) }
// 			resolve(res);
// 		})
// );
// const getBalance = (account, at) => promisify(cb => web3.eth.getBalance(account, at, cb));
// const makeNumber = (number) => {return parseInt(number * 10 ** -18)}; 		

// var tokenInstance;
// var governanceInstance;
// var governanceRelayInstance;

// var owner, wallet;

// var day = 60 * 60 * 24;
// var month = day * 30;
// var year = day * 365;


// contract('GovernanceRelay' , (accounts) => {
// 	owner = accounts[0];
// 	wallet = accounts[1];
	
// 	beforeEach(async () => {
// 		// deploy token contract
// 		tokenInstance = await AccessToken.new({from: owner});

// 		// deploy governance contract
// 		governanceInstance = await Governance.new(tokenInstance.address , {from: owner});

// 		// deploy governance relay contract
// 		governanceRelayInstance = await GovernanceRelay.new(governanceInstance.address , governanceInstance.address , governanceInstance.address , {from: owner});

// 		// mint some tokens to owner
// 		await tokenInstance.mint(owner , 100000E18 , {from: owner});
// 		await tokenInstance.mint(accounts[5] , 100E18 , {from: owner});
// 		await tokenInstance.mint(accounts[6] , 100E18 , {from: owner});
// 	});

// 	/* BLOCK NUMBER METHODS */

// 	it('timestamped : should set blockNumber' , async () => {
// 		await governanceRelayInstance.setBlockNumber(2000000 , {from: owner});
// 		var blockNumber = await governanceRelayInstance.getBlockNumber.call();
// 		assert.equal(blockNumber.toNumber() , 2000000 , 'blockNumber should be set');
// 	});

// 	// it('timestamped : should get blockNumber' , async () => {
// 	// 	var blockNumber = await governanceRelayInstance.getBlockNumber.call();
// 	// 	assert.isTrue(blockNumber.toNumber() > 0 , 'blockNumber should be get');	
// 	// });

// 	// it('timestamped : should reset blockNumber' , async () => {
// 	// 	await governanceRelayInstance.setBlockNumber(123 , {from: owner});
// 	// 	var blockNumber = await governanceRelayInstance.getBlockNumber.call();
// 	// 	assert.equal(blockNumber.toNumber() , 123 , 'blockNumber should be set');

// 	// 	await governanceRelayInstance.setBlockNumber(0);
// 	// 	var blockNumber = await governanceRelayInstance.getBlockNumber.call();	
// 	// 	assert.isTrue(blockNumber > 0 , 'blockNumber should be reset');
// 	// });
// });	
