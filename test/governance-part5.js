'use strict';
var AccessToken = artifacts.require("./AccessToken.sol");
var Governance = artifacts.require("./Governance.sol");
var DecisionModule = artifacts.require("./DecisionModule.sol");
var Relay = artifacts.require("./Relay.sol");

var assert_throw = require('./helpers/utils').assert_throw;
var promisify = require('./helpers/utils').promisify;
var getBalance = require('./helpers/utils').getBalance;
var makeNumber = require('./helpers/utils').makeNumber;

var setOwner = require('./governance-helper').setOwner;
var setTokenInstance = require('./governance-helper').setTokenInstance;
var setGovernanceInstance = require('./governance-helper').setGovernanceInstance;
var setDecisionModuleInstance = require('./governance-helper').setDecisionModuleInstance;
var setRelayInstance = require('./governance-helper').setRelayInstance;

var submitGovernance = require('./governance-helper').submitGovernance;
var chooseGovernance = require('./governance-helper').chooseGovernance;
var decideGovernance = require('./governance-helper').decideGovernance;
var closeGovernance = require('./governance-helper').closeGovernance;
var pushGovernance = require('./governance-helper').pushGovernance;
var voteGovernance = require('./governance-helper').voteGovernance;
var unvoteGovernance = require('./governance-helper').unvoteGovernance;
var supportGovernance = require('./governance-helper').supportGovernance;

var tokenInstance;
var governanceInstance;
var decisionModuleInstance;
var relayInstance;

var owner, wallet;

var day = 60 * 60 * 24;
var month = day * 30;
var year = day * 365;

contract('Governance' , (accounts) => {
	owner = accounts[0];
	wallet = accounts[1];
	
	beforeEach(async () => {
		// deploy token contracts
		tokenInstance = await AccessToken.new({from: owner});

		// deploy governance contracts	
		governanceInstance = await Governance.new(tokenInstance.address , {from: owner});
		decisionModuleInstance = await DecisionModule.new(tokenInstance.address , {from: owner});
		relayInstance = await Relay.new(tokenInstance.address , governanceInstance.address , decisionModuleInstance.address , {from: owner});
			
		// update governance relay	
		await tokenInstance.setRelay(relayInstance.address , {from : owner});
		await governanceInstance.setRelay(relayInstance.address , {from : owner});
		await decisionModuleInstance.setRelay(relayInstance.address , {from : owner});

		// mint some tokens to owner
		await tokenInstance.mint(owner , 100000E18 , {from: owner});
		await tokenInstance.mint(accounts[5] , 100E18 , {from: owner});
		await tokenInstance.mint(accounts[6] , 100E18 , {from: owner});

		setOwner(owner);
		setTokenInstance(tokenInstance);
		setGovernanceInstance(governanceInstance);
		setDecisionModuleInstance(decisionModuleInstance);
		setRelayInstance(relayInstance);
	});

	it('governance : part5 : locked : should allow token transfer normally' , async () => {
		var account1 = accounts[15];
		var account2 = accounts[16];

		await tokenInstance.transfer(account1 , 100E18 , {from: owner});
		await tokenInstance.transfer(account2 , 100E18 , {from: owner});
		
		var counter = await governanceInstance.cycleCounter.call();

		var transferLocked = await governanceInstance.transferLocked.call(account1, account1);
		assert.equal(transferLocked , false , 'transferLocked should match');

		var transferLocked = await relayInstance.transferLocked.call(account1, account1);
		assert.equal(transferLocked , false , 'transferLocked should match');

		await tokenInstance.transfer(account2 , 1E18 , {from: account1});

		var transferLocked = await governanceInstance.transferLocked.call(account1, account1);
		assert.equal(transferLocked , false , 'transferLocked should match');

		var transferLocked = await relayInstance.transferLocked.call(account1, account1);
		assert.equal(transferLocked , false , 'transferLocked should match');
	});

	it('governance : part5 : locked : should allow token transfer before submit' , async () => {
		var account1 = accounts[15];
		var account2 = accounts[16];

		await tokenInstance.transfer(account1 , 100E18 , {from: owner});
		await tokenInstance.transfer(account2 , 100E18 , {from: owner});

		var counter = await governanceInstance.cycleCounter.call();
		await governanceInstance.setBlockNumber(166665 , {from: owner});

		var transferLocked = await governanceInstance.transferLocked.call(account1, account1);
		assert.equal(transferLocked , false , 'transferLocked should match');

		var transferLocked = await relayInstance.transferLocked.call(account1, account1);
		assert.equal(transferLocked , false , 'transferLocked should match');

		await tokenInstance.transfer(account2 , 1E18 , {from: account1});

		var transferLocked = await governanceInstance.transferLocked.call(account1, account1);
		assert.equal(transferLocked , false , 'transferLocked should match');

		var transferLocked = await relayInstance.transferLocked.call(account1, account1);
		assert.equal(transferLocked , false , 'transferLocked should match');
	});

	it('governance : part5 : locked : should allow token transfer during submit' , async () => {
		var contract1 = accounts[11];
		var contract2 = accounts[12];

		var account1 = accounts[15];
		var account2 = accounts[16];

		await tokenInstance.transfer(account1 , 100E18 , {from: owner});
		await tokenInstance.transfer(account2 , 100E18 , {from: owner});
		
		var counter = await governanceInstance.cycleCounter.call();
		await pushGovernance(accounts, governanceInstance, contract1, account1);
		await pushGovernance(accounts, governanceInstance, contract2, account2);

		var transferLocked = await governanceInstance.transferLocked.call(account1, account1);
		assert.equal(transferLocked , false , 'transferLocked should match');

		var transferLocked = await relayInstance.transferLocked.call(account1, account1);
		assert.equal(transferLocked , false , 'transferLocked should match');

		await tokenInstance.transfer(account2 , 1E18 , {from: account1});

		var transferLocked = await governanceInstance.transferLocked.call(account1, account1);
		assert.equal(transferLocked , false , 'transferLocked should match');

		var transferLocked = await relayInstance.transferLocked.call(account1, account1);
		assert.equal(transferLocked , false , 'transferLocked should match');
	});

	it('governance : part5 : locked : should allow token transfer after submit' , async () => {
		var contract1 = accounts[11];
		var contract2 = accounts[12];

		var account1 = accounts[15];
		var account2 = accounts[16];

		await tokenInstance.transfer(account1 , 100E18 , {from: owner});
		await tokenInstance.transfer(account2 , 100E18 , {from: owner});
		
		var counter = await governanceInstance.cycleCounter.call();
		await pushGovernance(accounts, governanceInstance, contract1, account1);
		await pushGovernance(accounts, governanceInstance, contract2, account2);
		await governanceInstance.setBlockNumber(166666 * 3 , {from: owner});

		var transferLocked = await governanceInstance.transferLocked.call(account1, account1);
		assert.equal(transferLocked , false , 'transferLocked should match');

		var transferLocked = await relayInstance.transferLocked.call(account1, account1);
		assert.equal(transferLocked , false , 'transferLocked should match');

		await tokenInstance.transfer(account2 , 1E18 , {from: account1});

		var transferLocked = await governanceInstance.transferLocked.call(account1, account1);
		assert.equal(transferLocked , false , 'transferLocked should match');

		var transferLocked = await relayInstance.transferLocked.call(account1, account1);
		assert.equal(transferLocked , false , 'transferLocked should match');
	});

	it('governance : part5 : locked : should allow token transfer before choose' , async () => {
		var contract1 = accounts[11];
		var contract2 = accounts[12];

		var account1 = accounts[15];
		var account2 = accounts[16];

		await tokenInstance.transfer(account1 , 100E18 , {from: owner});
		await tokenInstance.transfer(account2 , 100E18 , {from: owner});
		
		var counter = await governanceInstance.cycleCounter.call();
		await pushGovernance(accounts, governanceInstance, contract1, account1);
		await pushGovernance(accounts, governanceInstance, contract2, account2);
		await governanceInstance.setBlockNumber(166666 * 2 , {from: owner});

		var transferLocked = await governanceInstance.transferLocked.call(account1, account1);
		assert.equal(transferLocked , false , 'transferLocked should match');

		var transferLocked = await relayInstance.transferLocked.call(account1, account1);
		assert.equal(transferLocked , false , 'transferLocked should match');

		await tokenInstance.transfer(account2 , 1E18 , {from: account1});

		var transferLocked = await governanceInstance.transferLocked.call(account1, account1);
		assert.equal(transferLocked , false , 'transferLocked should match');

		var transferLocked = await relayInstance.transferLocked.call(account1, account1);
		assert.equal(transferLocked , false , 'transferLocked should match');	
	});

	it('governance : part5 : locked : should allow token transfer during choose' , async () => {
		var contract1 = accounts[11];
		var contract2 = accounts[12];

		var account1 = accounts[5];
		var account2 = accounts[6];

		var counter = await governanceInstance.cycleCounter.call();
		await pushGovernance(accounts, governanceInstance, contract1, account1);
		await pushGovernance(accounts, governanceInstance, contract2, account2);
		await voteGovernance(accounts, governanceInstance, contract2, account2, 110E18);

		var transferLocked = await governanceInstance.transferLocked.call(account1, account1);
		assert.equal(transferLocked , false , 'transferLocked should match');

		var transferLocked = await relayInstance.transferLocked.call(account1, account1);
		assert.equal(transferLocked , false , 'transferLocked should match');

		// await tokenInstance.transfer(account2 , 1E18 , {from: account1});

		var transferLocked = await governanceInstance.transferLocked.call(account1, account1);
		assert.equal(transferLocked , false , 'transferLocked should match');

		var transferLocked = await relayInstance.transferLocked.call(account1, account1);
		assert.equal(transferLocked , false , 'transferLocked should match');	

		var transferLocked = await governanceInstance.transferLocked.call(account2, account2);
		assert.equal(transferLocked , true , 'transferLocked should match');

		var transferLocked = await relayInstance.transferLocked.call(account2, account2);
		assert.equal(transferLocked , true , 'transferLocked should match');	
	});

	it('governance : part5 : locked : should allow token transfer after choose' , async () => {
		var contract1 = accounts[11];
		var contract2 = accounts[12];

		var account1 = accounts[5];
		var account2 = accounts[6];

		var counter = await governanceInstance.cycleCounter.call();
		await pushGovernance(accounts, governanceInstance, contract1, account1);
		await pushGovernance(accounts, governanceInstance, contract2, account1);
		await voteGovernance(accounts, governanceInstance, contract2, account1, 110E18);
		await governanceInstance.setBlockNumber(166666 * 3 , {from: owner});

		var transferLocked = await governanceInstance.transferLocked.call(account1, account1);
		assert.equal(transferLocked , false , 'transferLocked should match');

		var transferLocked = await relayInstance.transferLocked.call(account1, account1);
		assert.equal(transferLocked , false , 'transferLocked should match');

		await tokenInstance.transfer(account2 , 1E18 , {from: account1});

		var transferLocked = await governanceInstance.transferLocked.call(account1, account1);
		assert.equal(transferLocked , false , 'transferLocked should match');

		var transferLocked = await relayInstance.transferLocked.call(account1, account1);
		assert.equal(transferLocked , false , 'transferLocked should match');	
	});

	it('governance : part5 : locked : should allow token transfer before decide' , async () => {
		var contract1 = accounts[11];
		var contract2 = accounts[12];

		var account1 = accounts[5];
		var account2 = accounts[6];

		var counter = await governanceInstance.cycleCounter.call();
		await pushGovernance(accounts, governanceInstance, contract1, account1);
		await pushGovernance(accounts, governanceInstance, contract2, account2);
		await voteGovernance(accounts, governanceInstance, contract2, account2, 110E18);
		await governanceInstance.setBlockNumber(166666 * 2 , {from: owner});

		var transferLocked = await governanceInstance.transferLocked.call(account1, account1);
		assert.equal(transferLocked , false , 'transferLocked should match');

		var transferLocked = await relayInstance.transferLocked.call(account1, account1);
		assert.equal(transferLocked , false , 'transferLocked should match');

		// await tokenInstance.transfer(account2 , 1E18 , {from: account1});

		var transferLocked = await governanceInstance.transferLocked.call(account1, account1);
		assert.equal(transferLocked , false , 'transferLocked should match');

		var transferLocked = await relayInstance.transferLocked.call(account1, account1);
		assert.equal(transferLocked , false , 'transferLocked should match');	

		var transferLocked = await governanceInstance.transferLocked.call(account2, account2);
		assert.equal(transferLocked , true , 'transferLocked should match');

		var transferLocked = await relayInstance.transferLocked.call(account2, account2);
		assert.equal(transferLocked , true , 'transferLocked should match');	
	});

	it('governance : part5 : locked : should allow token transfer during decide' , async () => {
		var contract1 = accounts[11];
		var contract2 = accounts[12];

		var account1 = accounts[5];
		var account2 = accounts[6];

		var counter = await governanceInstance.cycleCounter.call();
		await pushGovernance(accounts, governanceInstance, contract1, account1);
		await pushGovernance(accounts, governanceInstance, contract2, account2);
		await voteGovernance(accounts, governanceInstance, contract2, account2, 110E18);
		await supportGovernance(accounts , governanceInstance , account1);

		var transferLocked = await governanceInstance.transferLocked.call(account1, account1);
		assert.equal(transferLocked , false , 'transferLocked should match');

		var transferLocked = await relayInstance.transferLocked.call(account1, account1);
		assert.equal(transferLocked , false , 'transferLocked should match');

		await tokenInstance.transfer(account2 , 1E18 , {from: account1});

		var transferLocked = await governanceInstance.transferLocked.call(account1, account1);
		assert.equal(transferLocked , false , 'transferLocked should match');

		var transferLocked = await relayInstance.transferLocked.call(account1, account1);
		assert.equal(transferLocked , false , 'transferLocked should match');
	});

	it('governance : part5 : locked : should allow token transfer after decide' , async () => {
		var contract1 = accounts[11];
		var contract2 = accounts[12];

		var account1 = accounts[5];
		var account2 = accounts[6];

		var counter = await governanceInstance.cycleCounter.call();
		await pushGovernance(accounts, governanceInstance, contract1, account1);
		await pushGovernance(accounts, governanceInstance, contract2, account2);
		await voteGovernance(accounts, governanceInstance, contract2, account1, 110E18);
		await supportGovernance(accounts , governanceInstance , account1);
		await governanceInstance.setBlockNumber(166666 * 4, {from: owner});

		var transferLocked = await governanceInstance.transferLocked.call(account1, account1);
		assert.equal(transferLocked , false , 'transferLocked should match');

		var transferLocked = await relayInstance.transferLocked.call(account1, account1);
		assert.equal(transferLocked , false , 'transferLocked should match');

		await tokenInstance.transfer(account2 , 1E18 , {from: account1});

		var transferLocked = await governanceInstance.transferLocked.call(account1, account1);
		assert.equal(transferLocked , false , 'transferLocked should match');

		var transferLocked = await relayInstance.transferLocked.call(account1, account1);
		assert.equal(transferLocked , false , 'transferLocked should match');
	});

	it('governance : part5 : locked : should allow token transfer before close' , async () => {
		var contract1 = accounts[11];
		var contract2 = accounts[12];

		var account1 = accounts[5];
		var account2 = accounts[6];

		var counter = await governanceInstance.cycleCounter.call();
		await pushGovernance(accounts, governanceInstance, contract1, account1);
		await pushGovernance(accounts, governanceInstance, contract2, account2);
		await voteGovernance(accounts, governanceInstance, contract2, account2, 110E18);
		await supportGovernance(accounts , governanceInstance , account1);
		await governanceInstance.setBlockNumber(166666 * 3 , {from: owner});

		var transferLocked = await governanceInstance.transferLocked.call(account1, account1);
		assert.equal(transferLocked , false , 'transferLocked should match');

		var transferLocked = await relayInstance.transferLocked.call(account1, account1);
		assert.equal(transferLocked , false , 'transferLocked should match');

		await tokenInstance.transfer(account2 , 1E18 , {from: account1});

		var transferLocked = await governanceInstance.transferLocked.call(account1, account1);
		assert.equal(transferLocked , false , 'transferLocked should match');

		var transferLocked = await relayInstance.transferLocked.call(account1, account1);
		assert.equal(transferLocked , false , 'transferLocked should match');	
	});

	it('governance : part5 : locked : should allow token transfer during close' , async () => {
		var contract1 = accounts[11];
		var contract2 = accounts[12];

		var account1 = accounts[5];
		var account2 = accounts[6];

		var counter = await governanceInstance.cycleCounter.call();
		await pushGovernance(accounts, governanceInstance, contract1, account1);
		await pushGovernance(accounts, governanceInstance, contract2, account2);
		await voteGovernance(accounts, governanceInstance, contract2, account1, 110E18);
		await supportGovernance(accounts , governanceInstance , account1);
		await closeGovernance(accounts , governanceInstance , contract2);

		var transferLocked = await governanceInstance.transferLocked.call(account1, account1);
		assert.equal(transferLocked , false , 'transferLocked should match');

		var transferLocked = await relayInstance.transferLocked.call(account1, account1);
		assert.equal(transferLocked , false , 'transferLocked should match');

		await tokenInstance.transfer(account2 , 1E18 , {from: account1});

		var transferLocked = await governanceInstance.transferLocked.call(account1, account1);
		assert.equal(transferLocked , false , 'transferLocked should match');

		var transferLocked = await relayInstance.transferLocked.call(account1, account1);
		assert.equal(transferLocked , false , 'transferLocked should match');	
	});

	it('governance : part5 : locked : should allow token transfer after close' , async () => {
		var contract1 = accounts[11];
		var contract2 = accounts[12];

		var account1 = accounts[5];
		var account2 = accounts[6];

		var counter = await governanceInstance.cycleCounter.call();
		await pushGovernance(accounts, governanceInstance, contract1, account1);
		await pushGovernance(accounts, governanceInstance, contract2, account2);
		await voteGovernance(accounts, governanceInstance, contract1, account1, 110E18);
		await supportGovernance(accounts , governanceInstance , account1);
		await closeGovernance(accounts , governanceInstance , contract1);
		await governanceInstance.setBlockNumber(166666 * 5 , {from: owner});

		var transferLocked = await governanceInstance.transferLocked.call(account1, account1);
		assert.equal(transferLocked , false , 'transferLocked should match');

		var transferLocked = await relayInstance.transferLocked.call(account1, account1);
		assert.equal(transferLocked , false , 'transferLocked should match');

		await tokenInstance.transfer(account2 , 1E18 , {from: account1});

		var transferLocked = await governanceInstance.transferLocked.call(account1, account1);
		assert.equal(transferLocked , false , 'transferLocked should match');

		var transferLocked = await relayInstance.transferLocked.call(account1, account1);
		assert.equal(transferLocked , false , 'transferLocked should match');	
	});

	it('governance : part5 : locked : should allow token transfer during choose if not voted' , async () => {
		var contract1 = accounts[11];
		var contract2 = accounts[12];

		var account1 = accounts[5];
		var account2 = accounts[6];

		var counter = await governanceInstance.cycleCounter.call();
		await pushGovernance(accounts, governanceInstance, contract1, account1);
		await pushGovernance(accounts, governanceInstance, contract2, account2);
		await voteGovernance(accounts, governanceInstance, contract1, account1, 110E18);

		var transferLocked = await governanceInstance.transferLocked.call(account2, account2);
		assert.equal(transferLocked , false , 'transferLocked should match');

		var transferLocked = await relayInstance.transferLocked.call(account2, account2);
		assert.equal(transferLocked , false , 'transferLocked should match');

		// await tokenInstance.transfer(account1 , 1E18 , {from: account2});

		var transferLocked = await governanceInstance.transferLocked.call(account2, account2);
		assert.equal(transferLocked , false , 'transferLocked should match');

		var transferLocked = await relayInstance.transferLocked.call(account2, account2);
		assert.equal(transferLocked , false , 'transferLocked should match');		

		var transferLocked = await governanceInstance.transferLocked.call(account1, account1);
		assert.equal(transferLocked , true , 'transferLocked should match');

		var transferLocked = await relayInstance.transferLocked.call(account1, account1);
		assert.equal(transferLocked , true , 'transferLocked should match');		
	});

	it('governance : part5 : locked : should not allow token transfer during choose if voted' , async () => {
		var contract1 = accounts[11];
		var contract2 = accounts[12];

		var account1 = accounts[5];
		var account2 = accounts[6];

		var counter = await governanceInstance.cycleCounter.call();
		await pushGovernance(accounts, governanceInstance, contract1, account1);
		await pushGovernance(accounts, governanceInstance, contract2, account2);
		await voteGovernance(accounts, governanceInstance, contract1, account1, 110E18);

		var transferLocked = await governanceInstance.transferLocked.call(account1, account1);
		assert.equal(transferLocked , true , 'transferLocked should match');

		var transferLocked = await relayInstance.transferLocked.call(account1, account1);
		assert.equal(transferLocked , true , 'transferLocked should match');

		assert_throw(tokenInstance.transfer(account2 , 1E18 , {from: account1}));

		var transferLocked = await governanceInstance.transferLocked.call(account1, account1);
		assert.equal(transferLocked , true , 'transferLocked should match');

		var transferLocked = await relayInstance.transferLocked.call(account1, account1);
		assert.equal(transferLocked , true , 'transferLocked should match');

		await supportGovernance(accounts , governanceInstance , account1);

		var transferLocked = await governanceInstance.transferLocked.call(account1, account1);
		assert.equal(transferLocked , false , 'transferLocked should match');

		await tokenInstance.transfer(account2 , 1E18 , {from: account1});

		var transferLocked = await governanceInstance.transferLocked.call(account1, account1);
		assert.equal(transferLocked , false , 'transferLocked should match');
	});

	it('governance : part5 : locked : should allow token transfer during decide if voted' , async () => {
		var contract1 = accounts[11];
		var contract2 = accounts[12];

		var account1 = accounts[5];
		var account2 = accounts[6];

		var counter = await governanceInstance.cycleCounter.call();
		await pushGovernance(accounts, governanceInstance, contract1, account1);
		await pushGovernance(accounts, governanceInstance, contract2, account2);
		await voteGovernance(accounts, governanceInstance, contract1, account1, 110E18);
		await supportGovernance(accounts , governanceInstance , account1);

		var transferLocked = await governanceInstance.transferLocked.call(account1, account1);
		assert.equal(transferLocked , false , 'transferLocked should match');

		var transferLocked = await relayInstance.transferLocked.call(account1, account1);
		assert.equal(transferLocked , false , 'transferLocked should match');

		await tokenInstance.transfer(account2 , 1E18 , {from: account1});

		var transferLocked = await governanceInstance.transferLocked.call(account1, account1);
		assert.equal(transferLocked , false , 'transferLocked should match');

		var transferLocked = await relayInstance.transferLocked.call(account1, account1);
		assert.equal(transferLocked , false , 'transferLocked should match');
	});

	it('governance : part5 : locked : should allow token transfer during close if voted' , async () => {
		var contract1 = accounts[11];
		var contract2 = accounts[12];

		var account1 = accounts[5];
		var account2 = accounts[6];

		var counter = await governanceInstance.cycleCounter.call();
		await pushGovernance(accounts, governanceInstance, contract1, account1);
		await pushGovernance(accounts, governanceInstance, contract2, account2);
		await voteGovernance(accounts, governanceInstance, contract1, account1, 110E18);
		await supportGovernance(accounts , governanceInstance , account1);
		await closeGovernance(accounts , governanceInstance , contract1);

		var transferLocked = await governanceInstance.transferLocked.call(account1, account1);
		assert.equal(transferLocked , false , 'transferLocked should match');

		var transferLocked = await relayInstance.transferLocked.call(account1, account1);
		assert.equal(transferLocked , false , 'transferLocked should match');

		await tokenInstance.transfer(account2 , 1E18 , {from: account1});

		var transferLocked = await governanceInstance.transferLocked.call(account1, account1);
		assert.equal(transferLocked , false , 'transferLocked should match');

		var transferLocked = await relayInstance.transferLocked.call(account1, account1);
		assert.equal(transferLocked , false , 'transferLocked should match');	
	});

	it('governance : part5 : transfer : should not allow to call transfer on governance from outside' , async () => {
		var account1 = accounts[15];
		assert_throw(relayInstance.transfer(owner , account1 , 100E18 , {from: owner}));
	});
});	